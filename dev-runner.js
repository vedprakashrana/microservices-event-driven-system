import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('====================================================');
console.log('🚀 Launching Microservices Ecosystem...');
console.log('====================================================');

const services = [
  { name: 'User Service', script: 'services/user-service/src/index.ts', env: { PORT: '8001' } },
  { name: 'Notification Service', script: 'services/notification-service/src/index.ts', env: { PORT: '8002' } },
  { name: 'API Gateway', script: 'services/api-gateway/src/index.ts', env: { PORT: '8000' } },
];

const children = [];

for (const s of services) {
  const tsxCli = path.join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const child = spawn(process.execPath, [tsxCli, s.script], {
    cwd: __dirname,
    stdio: 'inherit',
    env: { ...process.env, ...s.env },
  });

  children.push(child);
}

process.on('SIGINT', () => {
  for (const c of children) {
    c.kill();
  }
  process.exit(0);
});
