import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { notificationRoutes } from './routes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'UP',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
    });
  });

  // Mount notification routes
  app.use('/notifications', notificationRoutes);

  return app;
}
