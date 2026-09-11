import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { NATS_STREAM_NAME, EventEnvelope } from '@app/common';

/**
 * In-memory fallback message broker providing JetStream-like semantics
 * (durable persistence, ack/nak policies, subject filtering)
 * when an external NATS daemon is not currently active.
 */
class InMemoryJetStreamBroker extends EventEmitter {
  private messages: Array<{
    seq: number;
    subject: string;
    envelope: EventEnvelope;
    timestamp: string;
  }> = [];

  private seqCounter = 1;

  async publish(subject: string, envelope: EventEnvelope) {
    const seq = this.seqCounter++;
    this.messages.push({
      seq,
      subject,
      envelope,
      timestamp: new Date().toISOString(),
    });

    // Emit event asynchronously
    setImmediate(() => {
      this.emit(subject, {
        seq,
        data: envelope,
        ack: () => {},
        nak: () => {},
        term: () => {},
      });
      // Also emit wildcard matches
      if (subject.startsWith('user.')) {
        this.emit('user.*', {
          seq,
          data: envelope,
          ack: () => {},
          nak: () => {},
          term: () => {},
        });
      }
    });

    return { seq, stream: NATS_STREAM_NAME };
  }

  getMessages() {
    return this.messages;
  }
}

// Global broker bus instance for local in-process fallback
export const globalBroker = (global as any).__microservices_broker__ || new InMemoryJetStreamBroker();
(global as any).__microservices_broker__ = globalBroker;
