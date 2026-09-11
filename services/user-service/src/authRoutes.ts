import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb, UserEntity } from './db.js';
import { config } from './config.js';
import { publishEvent } from './nats.js';
import { NATS_SUBJECTS, UserCreatedEventData, UserPasswordResetEventData } from '@app/common';

export const authRouter = Router();

// Validation Schemas
const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required'),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

// POST /auth/register
authRouter.post('/register', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-request-id'] as string) || uuidv4();
  const parseResult = RegisterSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: parseResult.error.format(),
      },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const { email, password, name } = parseResult.data;
  const db = getDb();

  try {
    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'USER_EXISTS',
          message: 'A user with this email address already exists',
        },
        meta: { correlationId, timestamp: new Date().toISOString() },
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = uuidv4();
    const now = new Date().toISOString();

    // Insert user into SQLite
    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, email, passwordHash, name, 'user', now, now);

    // Asynchronously publish event to NATS JetStream (NO REST / NO WebSockets)
    const eventPayload: UserCreatedEventData = {
      userId,
      email,
      name,
      role: 'user',
      registeredAt: now,
    };

    let eventId: string | undefined;
    try {
      eventId = await publishEvent(
        NATS_SUBJECTS.USER_CREATED,
        'user.created',
        eventPayload,
        correlationId
      );
    } catch (e: any) {
      console.warn(`[Register] JetStream publish warning: ${e.message}`);
    }

    // Generate JWT Token
    const token = jwt.sign(
      { id: userId, email, role: 'user' },
      config.jwtSecret,
      { expiresIn: '2h' }
    );

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: userId,
          email,
          name,
          role: 'user',
          createdAt: now,
        },
        token,
        eventDispatched: {
          subject: NATS_SUBJECTS.USER_CREATED,
          eventId,
        },
      },
      meta: { correlationId, timestamp: now },
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to register user',
        details: error.message,
      },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }
});

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-request-id'] as string) || uuidv4();
  const parseResult = LoginSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid email or password format',
      },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const { email, password } = parseResult.data;
  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserEntity | undefined;
  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '2h' }
  );

  return res.status(200).json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at,
      },
      token,
    },
    meta: { correlationId, timestamp: new Date().toISOString() },
  });
});

// POST /auth/forgot-password
authRouter.post('/forgot-password', async (req: Request, res: Response) => {
  const correlationId = (req.headers['x-request-id'] as string) || uuidv4();
  const parseResult = ForgotPasswordSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid email' },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const { email } = parseResult.data;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserEntity | undefined;

  if (user) {
    const resetToken = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000).toISOString(); // 1 hour

    // Publish async password reset event to NATS
    const eventPayload: UserPasswordResetEventData = {
      userId: user.id,
      email: user.email,
      resetToken,
      expiresAt,
    };

    await publishEvent(
      NATS_SUBJECTS.USER_PASSWORD_RESET,
      'user.password_reset',
      eventPayload,
      correlationId
    );
  }

  // Always return 200 for security to prevent email enumeration
  return res.status(200).json({
    success: true,
    data: {
      message: 'If the account exists, a password reset notification has been dispatched asynchronously.',
    },
    meta: { correlationId, timestamp: new Date().toISOString() },
  });
});
