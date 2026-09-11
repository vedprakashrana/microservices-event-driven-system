import fs from 'fs';
import path from 'path';
import { config } from './config.js';

export interface NotificationAuditEntity {
  id: string;
  event_id: string;
  event_type: string;
  recipient: string;
  channel: string;
  subject: string;
  body: string;
  status: 'DELIVERED' | 'FAILED' | 'DUPLICATE_SKIPPED';
  attempts: number;
  error_message?: string;
  correlation_id?: string;
  created_at: string;
}

class JsonFileAuditDatabase {
  private filePath: string;
  private audits: Map<string, NotificationAuditEntity> = new Map();

  constructor(filePath: string) {
    this.filePath = filePath.endsWith('.json') ? filePath : `${filePath}.json`;
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: NotificationAuditEntity[] = JSON.parse(raw);
        for (const a of list) {
          this.audits.set(a.id, a);
        }
      }
    } catch (e) {
      console.error(`Error loading database file ${this.filePath}:`, e);
    }
  }

  private persist() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = Array.from(this.audits.values());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Error persisting database file ${this.filePath}:`, e);
    }
  }

  prepare(query: string) {
    const lower = query.trim().toLowerCase();

    if (lower.startsWith('select id, status from notification_audit where event_id =')) {
      return {
        get: (eventId: string) => {
          for (const a of this.audits.values()) {
            if (a.event_id === eventId) {
              return { id: a.id, status: a.status };
            }
          }
          return undefined;
        },
      };
    }

    if (lower.startsWith('insert into notification_audit')) {
      return {
        run: (
          id: string,
          event_id: string,
          event_type: string,
          recipient: string,
          channel: string,
          subject: string,
          body: string,
          status: 'DELIVERED' | 'FAILED' | 'DUPLICATE_SKIPPED',
          attempts: number,
          error_message: string | null,
          correlation_id: string | null,
          created_at: string
        ) => {
          const entity: NotificationAuditEntity = {
            id,
            event_id,
            event_type,
            recipient,
            channel,
            subject,
            body,
            status,
            attempts,
            error_message: error_message || undefined,
            correlation_id: correlation_id || undefined,
            created_at,
          };
          this.audits.set(id, entity);
          this.persist();
          return { changes: 1 };
        },
      };
    }

    if (lower.startsWith('select count(*) as count from notification_audit where status =')) {
      const isDelivered = lower.includes("'delivered'");
      return {
        get: () => {
          const target = isDelivered ? 'DELIVERED' : 'FAILED';
          let count = 0;
          for (const a of this.audits.values()) {
            if (a.status === target) count++;
          }
          return { count };
        },
      };
    }

    if (lower.startsWith('select count(*) as count from notification_audit')) {
      return {
        get: () => ({ count: this.audits.size }),
      };
    }

    if (lower.startsWith('select event_type, count(*) as count from notification_audit group by event_type')) {
      return {
        all: () => {
          const map: Record<string, number> = {};
          for (const a of this.audits.values()) {
            map[a.event_type] = (map[a.event_type] || 0) + 1;
          }
          return Object.entries(map).map(([event_type, count]) => ({ event_type, count }));
        },
      };
    }

    if (lower.startsWith('select * from notification_audit')) {
      return {
        all: (...params: any[]) => {
          let list = Array.from(this.audits.values());
          if (lower.includes('where')) {
            if (lower.includes('recipient =') && lower.includes('event_id =')) {
              list = list.filter((a) => a.recipient === params[0] && a.event_id === params[1]);
            } else if (lower.includes('recipient =')) {
              list = list.filter((a) => a.recipient === params[0]);
            } else if (lower.includes('event_id =')) {
              list = list.filter((a) => a.event_id === params[0]);
            }
          }
          list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          const limit = typeof params[params.length - 1] === 'number' ? params[params.length - 1] : 50;
          return list.slice(0, limit);
        },
      };
    }

    if (lower.startsWith('delete from notification_audit')) {
      return {
        run: () => {
          this.audits.clear();
          this.persist();
          return { changes: 1 };
        },
      };
    }

    return {
      get: () => undefined,
      all: () => Array.from(this.audits.values()),
      run: () => ({ changes: 0 }),
    };
  }
}

let dbInstance: JsonFileAuditDatabase | null = null;

export function getDb(): JsonFileAuditDatabase {
  if (!dbInstance) {
    dbInstance = new JsonFileAuditDatabase(config.dbPath);
  }
  return dbInstance;
}
