import fs from 'fs';
import path from 'path';
import { config } from './config.js';

export interface UserEntity {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  created_at: string;
  updated_at: string;
}

class JsonFileDatabase {
  private filePath: string;
  private users: Map<string, UserEntity> = new Map();

  constructor(filePath: string) {
    this.filePath = filePath.endsWith('.json') ? filePath : `${filePath}.json`;
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const list: UserEntity[] = JSON.parse(raw);
        for (const u of list) {
          this.users.set(u.id, u);
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
      const data = Array.from(this.users.values());
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error(`Error persisting database file ${this.filePath}:`, e);
    }
  }

  prepare(query: string) {
    const lower = query.trim().toLowerCase();

    if (lower.startsWith('select id from users where email =') || lower.startsWith('select * from users where email =')) {
      return {
        get: (email: string) => {
          for (const u of this.users.values()) {
            if (u.email.toLowerCase() === email.toLowerCase()) {
              return { ...u };
            }
          }
          return undefined;
        },
      };
    }

    if (lower.startsWith('select id, email, name, role, created_at, updated_at from users where id =') || lower.startsWith('select * from users where id =')) {
      return {
        get: (id: string) => {
          const u = this.users.get(id);
          return u ? { ...u } : undefined;
        },
      };
    }

    if (lower.startsWith('insert into users')) {
      return {
        run: (id: string, email: string, password_hash: string, name: string, role: string, created_at: string, updated_at: string) => {
          const entity: UserEntity = { id, email, password_hash, name, role, created_at, updated_at };
          this.users.set(id, entity);
          this.persist();
          return { changes: 1 };
        },
      };
    }

    if (lower.startsWith('update users set name =')) {
      return {
        run: (name: string, updated_at: string, id: string) => {
          const u = this.users.get(id);
          if (u) {
            u.name = name;
            u.updated_at = updated_at;
            this.persist();
          }
          return { changes: 1 };
        },
      };
    }

    if (lower.startsWith('delete from users')) {
      return {
        run: () => {
          this.users.clear();
          this.persist();
          return { changes: 1 };
        },
      };
    }

    return {
      get: () => undefined,
      all: () => Array.from(this.users.values()),
      run: () => ({ changes: 0 }),
    };
  }
}

let dbInstance: JsonFileDatabase | null = null;

export function getDb(): JsonFileDatabase {
  if (!dbInstance) {
    dbInstance = new JsonFileDatabase(config.dbPath);
  }
  return dbInstance;
}
