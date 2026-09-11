import { Router, Request, Response } from 'express';
import { getDb, NotificationAuditEntity } from './db.js';

export const notificationRoutes = Router();

// GET /notifications/audit-logs
notificationRoutes.get('/audit-logs', (req: Request, res: Response) => {
  const recipient = req.query.recipient as string | undefined;
  const eventId = req.query.eventId as string | undefined;
  const limit = parseInt((req.query.limit as string) || '50', 10);

  const db = getDb();
  let query = 'SELECT * FROM notification_audit';
  const params: any[] = [];
  const conditions: string[] = [];

  if (recipient) {
    conditions.push('recipient = ?');
    params.push(recipient);
  }
  if (eventId) {
    conditions.push('event_id = ?');
    params.push(eventId);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const logs = db.prepare(query).all(...params) as NotificationAuditEntity[];

  return res.status(200).json({
    success: true,
    count: logs.length,
    data: { logs },
    meta: { timestamp: new Date().toISOString() },
  });
});

// GET /notifications/metrics
notificationRoutes.get('/metrics', (req: Request, res: Response) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM notification_audit').get() as { count: number };
  const delivered = db.prepare("SELECT COUNT(*) as count FROM notification_audit WHERE status = 'DELIVERED'").get() as { count: number };
  const failed = db.prepare("SELECT COUNT(*) as count FROM notification_audit WHERE status = 'FAILED'").get() as { count: number };
  const byType = db.prepare('SELECT event_type, COUNT(*) as count FROM notification_audit GROUP BY event_type').all();

  return res.status(200).json({
    success: true,
    data: {
      totalDispatched: total.count,
      delivered: delivered.count,
      failed: failed.count,
      breakdownByEventType: byType,
    },
    meta: { timestamp: new Date().toISOString() },
  });
});
