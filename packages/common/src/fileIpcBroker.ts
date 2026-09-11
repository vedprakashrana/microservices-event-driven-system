import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { NATS_STREAM_NAME, EventEnvelope } from '@app/common';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IPC_EVENT_DIR = path.resolve(__dirname, '..', '..', '.events');

if (!fs.existsSync(IPC_EVENT_DIR)) {
  fs.mkdirSync(IPC_EVENT_DIR, { recursive: true });
}

export class FileIpcJetStreamBroker {
  static async publish(subject: string, envelope: EventEnvelope) {
    const fileName = `${Date.now()}_${envelope.eventId}.json`;
    const filePath = path.join(IPC_EVENT_DIR, fileName);
    fs.writeFileSync(filePath, JSON.stringify({ subject, envelope }, null, 2), 'utf-8');
    return { seq: Date.now(), stream: NATS_STREAM_NAME };
  }

  static subscribe(onEvent: (subject: string, envelope: EventEnvelope) => Promise<void>) {
    // Poll the events directory for inter-process communication
    const processed = new Set<string>();

    const poll = async () => {
      try {
        if (!fs.existsSync(IPC_EVENT_DIR)) return;
        const files = fs.readdirSync(IPC_EVENT_DIR).filter((f) => f.endsWith('.json'));

        for (const file of files) {
          if (processed.has(file)) continue;
          processed.add(file);

          const filePath = path.join(IPC_EVENT_DIR, file);
          try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            await onEvent(parsed.subject, parsed.envelope);
          } catch (e) {
            console.error(`Error processing IPC event file ${file}:`, e);
          }
        }
      } catch (e) {
        console.error('IPC poll error:', e);
      }
    };

    setInterval(poll, 150);
    poll();
  }
}
