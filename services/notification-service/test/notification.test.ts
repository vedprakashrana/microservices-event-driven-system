import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getDb } from '../src/db.js';
import { v4 as uuidv4 } from 'uuid';

describe('Notification Service Audit & Metrics', () => {
  const app = createApp();

  beforeEach(() => {
    const db = getDb();
    db.prepare('DELETE FROM notification_audit').run();
  });

  it('should query notification audit logs correctly', async () => {
    const db = getDb();
    const eventId = uuidv4();
    db.prepare(`
      INSERT INTO notification_audit (id, event_id, event_type, recipient, channel, subject, body, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), eventId, 'user.created', 'user@example.com', 'EMAIL', 'Welcome', 'Welcome to system', 'DELIVERED', new Date().toISOString());

    const res = await request(app).get('/notifications/audit-logs');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data.logs[0].recipient).toBe('user@example.com');
  });

  it('should return metrics summary', async () => {
    const res = await request(app).get('/notifications/metrics');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('totalDispatched');
    expect(res.body.data).toHaveProperty('delivered');
  });
});
