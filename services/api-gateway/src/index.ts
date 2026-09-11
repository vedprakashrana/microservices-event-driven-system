import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`=========================================`);
  console.log(`🚀 API Gateway running on port ${config.port}`);
  console.log(`📖 Swagger API Docs: http://localhost:${config.port}/docs`);
  console.log(`💚 Health Check: http://localhost:${config.port}/health`);
  console.log(`=========================================`);
});
