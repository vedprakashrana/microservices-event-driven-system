import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { authRouter } from './authRoutes.js';
import { userRoutes } from './userRoutes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'user-service',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount routers
  app.use('/auth', authRouter);
  app.use('/users', userRoutes);

  return app;
}
