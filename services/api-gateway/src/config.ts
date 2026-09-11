import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-for-microservices-auth-2026',
  userServiceUrl: process.env.USER_SERVICE_URL || 'http://localhost:8001',
  notificationServiceUrl: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:8002',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
