import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-for-microservices-auth-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h',
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  natsToken: process.env.NATS_TOKEN || 'microservices-secure-nats-token-2026',
  dbPath: process.env.DB_PATH || './users.db',
};
