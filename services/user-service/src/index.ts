import { createApp } from './app.js';
import { config } from './config.js';
import { initNats, closeNats } from './nats.js';
import { getDb } from './db.js';

const app = createApp();

async function start() {
  // Ensure DB is initialized
  getDb();
  console.log(`📦 Database initialized at ${config.dbPath}`);

  // Connect to NATS JetStream
  try {
    await initNats();
  } catch (err: any) {
    console.warn(`⚠️ Warning: Initial NATS connection failed: ${err.message}. It will auto-reconnect.`);
  }

  const server = app.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(`👤 User Service running on port ${config.port}`);
    console.log(`💚 Health Check: http://localhost:${config.port}/health`);
    console.log(`=========================================`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\nGracefully shutting down User Service...');
    server.close();
    await closeNats();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
