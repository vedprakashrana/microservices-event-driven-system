import { createApp } from './app.js';
import { config } from './config.js';
import { startConsumer, stopConsumer } from './consumer.js';
import { getDb } from './db.js';

const app = createApp();

async function start() {
  // Initialize Database
  getDb();
  console.log(`📦 Notification DB initialized at ${config.dbPath}`);

  // Start NATS Consumer Worker
  startConsumer();

  const server = app.listen(config.port, () => {
    console.log(`=========================================`);
    console.log(`📬 Notification Service running on port ${config.port}`);
    console.log(`💚 Health Check: http://localhost:${config.port}/health`);
    console.log(`=========================================`);
  });

  const shutdown = async () => {
    console.log('\nGracefully shutting down Notification Service...');
    server.close();
    await stopConsumer();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
