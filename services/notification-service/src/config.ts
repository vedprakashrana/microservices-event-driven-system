import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  natsUrl: process.env.NATS_URL || 'nats://localhost:4222',
  natsToken: process.env.NATS_TOKEN || 'microservices-secure-nats-token-2026',
  dbPath: process.env.DB_PATH || './notifications.db',
};
