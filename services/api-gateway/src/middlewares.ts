import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { config } from './config.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  correlationId?: string;
}

// Request Correlation ID Middleware
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers['x-request-id'] as string) || uuidv4();
  (req as AuthenticatedRequest).correlationId = correlationId;
  res.setHeader('X-Request-Id', correlationId);
  next();
}

// JWT Authentication Guard Middleware
export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token missing or invalid',
      },
      meta: {
        correlationId: (req as AuthenticatedRequest).correlationId,
        timestamp: new Date().toISOString(),
      },
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: string; email: string; role: string };
    (req as AuthenticatedRequest).user = payload;
    // Attach user info headers to upstream request
    req.headers['x-user-id'] = payload.id;
    req.headers['x-user-email'] = payload.email;
    req.headers['x-user-role'] = payload.role;
    next();
  } catch (err: any) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Token is invalid or expired',
        details: err.message,
      },
      meta: {
        correlationId: (req as AuthenticatedRequest).correlationId,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
