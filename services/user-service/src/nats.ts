import { connect, NatsConnection, JSONCodec, JetStreamClient, JetStreamManager } from 'nats';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';
import { NATS_STREAM_NAME, EventEnvelope, globalBroker, FileIpcJetStreamBroker } from '@app/common';

const jc = JSONCodec();
let natsConn: NatsConnection | null = null;
let jsClient: JetStreamClient | null = null;
let useFallbackBroker = false;

export async function initNats(): Promise<JetStreamClient | null> {
  if (jsClient) return jsClient;

  try {
    natsConn = await connect({
      servers: config.natsUrl,
      token: config.natsToken,
      reconnectTimeWait: 1000,
      maxReconnectAttempts: 2,
      timeout: 2000,
    });

    console.log(`✅ [User Service] Connected to NATS JetStream successfully`);

    const jsm: JetStreamManager = await natsConn.jetstreamManager();
    const streams = await jsm.streams.list().next();
    const streamNames = streams.map((s) => s.config.name);

    if (!streamNames.includes(NATS_STREAM_NAME)) {
      console.log(`Creating JetStream Stream: ${NATS_STREAM_NAME}...`);
      await jsm.streams.add({
        name: NATS_STREAM_NAME,
        subjects: ['user.*'],
      });
      console.log(`✅ Stream ${NATS_STREAM_NAME} created`);
    }

    jsClient = natsConn.jetstream();
    useFallbackBroker = false;
    return jsClient;
  } catch (err: any) {
    console.warn(`⚡ [User Service] NATS server not running at ${config.natsUrl} (${err.message}). Using high-performance resilient IPC JetStream broker fallback.`);
    useFallbackBroker = true;
    return null;
  }
}

export async function publishEvent<T extends Record<string, any> = any>(
  subject: string,
  eventType: string,
  data: T,
  correlationId?: string
): Promise<string> {
  const eventId = uuidv4();
  const envelope: EventEnvelope<T> = {
    eventId,
    eventType,
    timestamp: new Date().toISOString(),
    version: '1.0',
    correlationId,
    source: 'user-service',
    data,
  };

  if (!jsClient && !useFallbackBroker) {
    try {
      await initNats();
    } catch {
      useFallbackBroker = true;
    }
  }

  if (jsClient && !useFallbackBroker) {
    try {
      const ack = await jsClient.publish(subject, jc.encode(envelope));
      console.log(`📢 [JetStream Publisher] Published event '${subject}' (Seq: ${ack.seq}, EventId: ${eventId})`);
      return eventId;
    } catch (err: any) {
      console.error(`❌ [JetStream Publisher] Error publishing event to NATS:`, err.message);
    }
  }

  // Publish to in-memory + multi-process File IPC stream
  await globalBroker.publish(subject, envelope);
  await FileIpcJetStreamBroker.publish(subject, envelope);
  console.log(`📢 [Event Publisher] Published event '${subject}' via Broker Event Stream (EventId: ${eventId})`);
  return eventId;
}

export async function closeNats() {
  if (natsConn) {
    await natsConn.drain();
    await natsConn.close();
    natsConn = null;
    jsClient = null;
  }
}
