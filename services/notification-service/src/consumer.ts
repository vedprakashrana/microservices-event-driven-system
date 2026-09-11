import { connect, NatsConnection, JSONCodec, JetStreamClient, AckPolicy, DeliverPolicy } from 'nats';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { getDb, NotificationAuditEntity } from './db.js';
import { NotificationDispatcher } from './dispatcher.js';
import {
  NATS_STREAM_NAME,
  NATS_CONSUMER_GROUPS,
  EventEnvelope,
  UserCreatedEventData,
  UserPasswordResetEventData,
  UserUpdatedEventData,
  globalBroker,
  FileIpcJetStreamBroker,
} from '@app/common';

const jc = JSONCodec();
let natsConn: NatsConnection | null = null;
let isRunning = false;

export async function startConsumer() {
  if (isRunning) return;

  try {
    natsConn = await connect({
      servers: config.natsUrl,
      token: config.natsToken,
      reconnectTimeWait: 1000,
      maxReconnectAttempts: 2,
      timeout: 2000,
    });

    console.log(`✅ [Notification Service] Connected to NATS JetStream`);
    const js: JetStreamClient = natsConn.jetstream();
    const jsm = await natsConn.jetstreamManager();

    try {
      await jsm.streams.info(NATS_STREAM_NAME);
    } catch {
      console.log(`Creating stream ${NATS_STREAM_NAME} from consumer...`);
      await jsm.streams.add({
        name: NATS_STREAM_NAME,
        subjects: ['user.*'],
      });
    }

    const consumerName = NATS_CONSUMER_GROUPS.NOTIFICATION_WORKER;
    await jsm.consumers.add(NATS_STREAM_NAME, {
      durable_name: consumerName,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      max_deliver: 5,
      ack_wait: 10 * 1000000000,
    });

    console.log(`🎯 JetStream Durable Consumer group '${consumerName}' initialized`);
    isRunning = true;

    const consumer = await js.consumers.get(NATS_STREAM_NAME, consumerName);
    const messages = await consumer.consume();

    (async () => {
      for await (const msg of messages) {
        try {
          const envelope = jc.decode(msg.data) as EventEnvelope;
          console.log(`📥 [Notification Consumer] Received event: ${envelope.eventType} (EventId: ${envelope.eventId})`);
          await handleEvent(envelope);
          msg.ack();
        } catch (err: any) {
          console.error(`❌ [Notification Consumer] Error handling event:`, err.message);
          if (msg.info.deliveryCount >= 5) {
            msg.term();
          } else {
            msg.nak();
          }
        }
      }
    })();
  } catch (err: any) {
    console.warn(`⚡ [Notification Service] NATS server not running (${err.message}). Listening to inter-process IPC Event Stream.`);
    isRunning = true;

    // In-memory event bus
    globalBroker.on('user.*', async ({ data }: { data: EventEnvelope }) => {
      try {
        console.log(`📥 [Notification Consumer] Received event from Stream: ${data.eventType} (EventId: ${data.eventId})`);
        await handleEvent(data);
      } catch (err: any) {
        console.error(`❌ [Notification Consumer] Error processing event:`, err);
      }
    });

    // Multi-process IPC subscriber
    FileIpcJetStreamBroker.subscribe(async (subject, envelope) => {
      try {
        console.log(`📥 [Notification Consumer] Received event from IPC Stream: ${envelope.eventType} (EventId: ${envelope.eventId})`);
        await handleEvent(envelope);
      } catch (err: any) {
        console.error(`❌ [Notification Consumer] Error processing IPC event:`, err);
      }
    });
  }
}

async function handleEvent(envelope: EventEnvelope) {
  const db = getDb();
  const { eventId, eventType, data, correlationId } = envelope;

  // 1. Idempotency Check: Prevent duplicate processing
  const existingAudit = db.prepare('SELECT id, status FROM notification_audit WHERE event_id = ?').get(eventId) as NotificationAuditEntity | undefined;
  if (existingAudit) {
    console.log(`⏩ [Idempotency] Event ${eventId} was already processed (status: ${existingAudit.status}). Skipping duplicate execution.`);
    return;
  }

  const now = new Date().toISOString();
  let channel: 'EMAIL' | 'SMS' | 'PUSH' = 'EMAIL';
  let recipient = '';
  let subject = '';
  let body = '';

  switch (eventType) {
    case 'user.created': {
      const user = data as UserCreatedEventData;
      recipient = user.email;
      channel = 'EMAIL';
      subject = `🎉 Welcome to our Platform, ${user.name}!`;
      body = `Hi ${user.name},\n\nYour account has been successfully created. Welcome aboard!\nUser ID: ${user.userId}\nRegistered At: ${user.registeredAt}`;
      break;
    }

    case 'user.password_reset': {
      const reset = data as UserPasswordResetEventData;
      recipient = reset.email;
      channel = 'EMAIL';
      subject = `🔒 Action Required: Reset Your Password`;
      body = `We received a request to reset your password.\nYour secure reset token: ${reset.resetToken}\nThis token expires at: ${reset.expiresAt}`;
      break;
    }

    case 'user.updated': {
      const updated = data as UserUpdatedEventData;
      recipient = updated.email;
      channel = 'EMAIL';
      subject = `🔔 Security Alert: Profile Updated`;
      body = `Hello,\n\nYour profile details have been modified:\n- ${updated.changes.join('\n- ')}\n\nIf you did not perform this change, please contact support immediately.`;
      break;
    }

    default:
      console.warn(`⚠️ Unknown event type received: ${eventType}`);
      return;
  }

  // 2. Dispatch the simulated notification
  const dispatchResult = await NotificationDispatcher.send(channel, recipient, subject, body);

  // 3. Save to Audit Database
  const auditId = uuidv4();
  db.prepare(`
    INSERT INTO notification_audit (
      id, event_id, event_type, recipient, channel, subject, body, status, attempts, error_message, correlation_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    auditId,
    eventId,
    eventType,
    recipient,
    channel,
    subject,
    body,
    dispatchResult.success ? 'DELIVERED' : 'FAILED',
    1,
    dispatchResult.error || null,
    correlationId || null,
    now
  );

  console.log(`✅ [Audit Log] Notification recorded with ID: ${auditId}`);
}

export async function stopConsumer() {
  if (natsConn) {
    await natsConn.drain();
    await natsConn.close();
    natsConn = null;
    isRunning = false;
  }
}
