import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getDb } from '../src/db.js';

describe('User Service Auth & User Management', () => {
  const app = createApp();

  beforeEach(() => {
    // Reset test database table
    const db = getDb();
    db.prepare('DELETE FROM users').run();
  });

  it('should register a new user successfully and return JWT', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test Engineer',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@example.com');
    expect(res.body.data.token).toBeDefined();
  });

  it('should prevent duplicate registration with same email', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'Password123!',
        name: 'Initial User',
      });

    const res = await request(app)
      .post('/auth/register')
      .send({
        email: 'duplicate@example.com',
        password: 'Password123!',
        name: 'Duplicate User',
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USER_EXISTS');
  });

  it('should authenticate user and issue token', async () => {
    await request(app)
      .post('/auth/register')
      .send({
        email: 'login@example.com',
        password: 'MyStrongPassword123!',
        name: 'Login User',
      });

    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'login@example.com',
        password: 'MyStrongPassword123!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });

  it('should reject invalid login credentials', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'WrongPassword',
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});
