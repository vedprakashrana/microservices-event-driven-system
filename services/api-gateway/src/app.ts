import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from './config.js';
import { correlationIdMiddleware, authenticateToken, AuthenticatedRequest } from './middlewares.js';
import { swaggerDocument } from './swagger.js';

export function createApp() {
  const app = express();

  // Basic Middlewares
  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(morgan(':method :url :status :res[content-length] - :response-time ms [req-id: :req[x-request-id]]'));
  app.use(correlationIdMiddleware);
  app.use(express.json());

  // Global Rate Limiting
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Rate limit exceeded. Please try again later.',
      },
    },
  });
  app.use('/api/', limiter);

  // Swagger Documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Health check endpoint
  app.get('/health', async (req: Request, res: Response) => {
    const services: Record<string, string> = {
      gateway: 'healthy',
    };

    try {
      const userRes = await fetch(`${config.userServiceUrl}/health`, { signal: AbortSignal.timeout(1000) });
      services['userService'] = userRes.ok ? 'healthy' : 'degraded';
    } catch {
      services['userService'] = 'unreachable';
    }

    try {
      const notifRes = await fetch(`${config.notificationServiceUrl}/health`, { signal: AbortSignal.timeout(1000) });
      services['notificationService'] = notifRes.ok ? 'healthy' : 'degraded';
    } catch {
      services['notificationService'] = 'unreachable';
    }

    const isHealthy = Object.values(services).every((s) => s === 'healthy');
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'UP' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      services,
    });
  });

  // Reverse Proxy Forwarder using native fetch for maximum reliability
  const forwardRequest = async (targetBaseUrl: string, targetPath: string, req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUrl = new URL(targetPath, targetBaseUrl);
      // Append query parameters
      for (const [k, v] of Object.entries(req.query)) {
        if (v !== undefined) targetUrl.searchParams.append(k, String(v));
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (req.correlationId) headers['x-request-id'] = req.correlationId;
      if (req.user) {
        headers['x-user-id'] = req.user.id;
        headers['x-user-email'] = req.user.email;
        headers['x-user-role'] = req.user.role;
      }

      const options: RequestInit = {
        method: req.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
        options.body = JSON.stringify(req.body);
      }

      const upstreamRes = await fetch(targetUrl.toString(), options);
      const data = await upstreamRes.json().catch(() => null);

      res.status(upstreamRes.status).json(data || {});
    } catch (err: any) {
      console.error(`Forwarding error to ${targetBaseUrl}:`, err.message);
      res.status(502).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Downstream microservice is unavailable',
          details: err.message,
        },
      });
    }
  };

  // Auth Routes (Public) -> User Service
  app.all('/api/v1/auth/*', (req: Request, res: Response) => {
    const targetPath = req.path.replace(/^\/api\/v1/, '');
    forwardRequest(config.userServiceUrl, targetPath, req as AuthenticatedRequest, res);
  });

  // User Routes (Protected) -> User Service
  app.all('/api/v1/users/*', authenticateToken, (req: Request, res: Response) => {
    const targetPath = req.path.replace(/^\/api\/v1/, '');
    forwardRequest(config.userServiceUrl, targetPath, req as AuthenticatedRequest, res);
  });

  // Notification Service Routes (Protected) -> Notification Service
  app.all('/api/v1/notifications/*', authenticateToken, (req: Request, res: Response) => {
    const targetPath = req.path.replace(/^\/api\/v1/, '');
    forwardRequest(config.notificationServiceUrl, targetPath, req as AuthenticatedRequest, res);
  });

  // 404 Handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route not found: ${req.method} ${req.path}`,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  });

  return app;
}
