import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('API Gateway Routing & Health Check', () => {
  const app = createApp();

  it('should return health check endpoint status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBeDefined();
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('services');
  });

  it('should reject unauthorized access to protected user route', async () => {
    const res = await request(app).get('/api/v1/users/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
