import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getDb, UserEntity } from './db.js';
import { publishEvent } from './nats.js';
import { NATS_SUBJECTS, UserUpdatedEventData } from '@app/common';

export const userRoutes = Router();

const UpdateProfileSchema = z.object({
  name: z.string().min(1).optional(),
});

// GET /users/me
userRoutes.get('/me', (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;
  const correlationId = (req.headers['x-request-id'] as string) || uuidv4();

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing user context' },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const db = getDb();
  const user = db.prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?').get(userId) as Omit<UserEntity, 'password_hash'> | undefined;

  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  return res.status(200).json({
    success: true,
    data: { user },
    meta: { correlationId, timestamp: new Date().toISOString() },
  });
});

// PATCH /users/me
userRoutes.patch('/me', async (req: Request, res: Response) => {
  const userId = req.headers['x-user-id'] as string;
  const correlationId = (req.headers['x-request-id'] as string) || uuidv4();

  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing user context' },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const parseResult = UpdateProfileSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid payload' },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const { name } = parseResult.data;
  const db = getDb();
  const now = new Date().toISOString();

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserEntity | undefined;
  if (!user) {
    return res.status(404).json({
      success: false,
      error: { code: 'USER_NOT_FOUND', message: 'User not found' },
      meta: { correlationId, timestamp: new Date().toISOString() },
    });
  }

  const changes: string[] = [];
  if (name && name !== user.name) {
    changes.push(`name changed from '${user.name}' to '${name}'`);
    db.prepare('UPDATE users SET name = ?, updated_at = ? WHERE id = ?').run(name, now, userId);
  }

  if (changes.length > 0) {
    // Publish async profile updated event to NATS
    const eventPayload: UserUpdatedEventData = {
      userId,
      email: user.email,
      name,
      changes,
      updatedAt: now,
    };

    await publishEvent(
      NATS_SUBJECTS.USER_UPDATED,
      'user.updated',
      eventPayload,
      correlationId
    );
  }

  const updatedUser = db.prepare('SELECT id, email, name, role, created_at, updated_at FROM users WHERE id = ?').get(userId);

  return res.status(200).json({
    success: true,
    data: { user: updatedUser },
    meta: { correlationId, timestamp: now },
  });
});
