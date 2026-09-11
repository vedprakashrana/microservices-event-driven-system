import { z } from 'zod';
export * from './inMemoryBroker.js';
export * from './fileIpcBroker.js';

// NATS Subject definitions
export const NATS_STREAM_NAME = 'USER_EVENTS_STREAM';
export const NATS_SUBJECTS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_PASSWORD_RESET: 'user.password_reset',
  USER_DELETED: 'user.deleted',
} as const;

export const NATS_CONSUMER_GROUPS = {
  NOTIFICATION_WORKER: 'notification-service-worker',
  DLQ_WORKER: 'dlq-service-worker',
} as const;

// Base Event Envelope Schema
export const EventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string(),
  timestamp: z.string().datetime(),
  version: z.string().default('1.0'),
  correlationId: z.string().optional(),
  source: z.string(),
  data: z.record(z.any()),
});

export type EventEnvelope<T = Record<string, any>> = {
  eventId: string;
  eventType: string;
  timestamp: string;
  version: string;
  correlationId?: string;
  source: string;
  data: T;
};

// User Created Event Payload
export const UserCreatedEventDataSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['user', 'admin']).default('user'),
  registeredAt: z.string().datetime(),
});
export type UserCreatedEventData = z.infer<typeof UserCreatedEventDataSchema>;

// User Password Reset Event Payload
export const UserPasswordResetEventDataSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  resetToken: z.string(),
  expiresAt: z.string().datetime(),
});
export type UserPasswordResetEventData = z.infer<typeof UserPasswordResetEventDataSchema>;

// User Updated Event Payload
export const UserUpdatedEventDataSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  name: z.string().optional(),
  changes: z.array(z.string()),
  updatedAt: z.string().datetime(),
});
export type UserUpdatedEventData = z.infer<typeof UserUpdatedEventDataSchema>;

// Standard API Response
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    correlationId?: string;
    timestamp: string;
  };
}
