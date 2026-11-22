import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { WhatsAppWorker } from './whatsappService.js';

dotenv.config({ path: process.env.WHATSAPP_ENV_FILE || '.env' });
const url = new URL(process.env.DATABASE_URL);
const supabase = url.hostname.endsWith('.pooler.supabase.com') || /^db\.[a-z0-9]+\.supabase\.co$/.test(url.hostname);
if (supabase) {
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl']) url.searchParams.delete(key);
}
const pool = new Pool({
  connectionString: url.href,
  connectionTimeoutMillis: 6000,
  max: 3,
  ...(supabase && { ssl: { ca: readFileSync(new URL('./certificates/supabase-root-2021.crt', import.meta.url)), rejectUnauthorized: true } }),
});
pool.on('error', (error) => console.error('[WhatsApp] Database connection interrupted:', error.code || error.name));
const worker = new WhatsAppWorker(pool);
const initial = await worker.heartbeat();
if (!initial) {
  await pool.end();
  throw new Error('A WhatsApp worker is already running, or its database settings are missing.');
}
console.log('[WhatsApp] Worker online');

let stopping = false;
let lastHeartbeat = Date.now();
const tick = setInterval(() => worker.tick().catch((error) => console.error('[WhatsApp] Worker cycle:', error.code || error.name)), 2000);
const heartbeat = setInterval(async () => {
  try {
    if (!await worker.heartbeat()) return void stop('Worker lease expired');
    lastHeartbeat = Date.now();
  } catch (error) {
    if (Date.now() - lastHeartbeat > 30_000) void stop('Database unreachable');
  }
}, 8000);

async function stop(reason) {
  if (stopping) return;
  stopping = true;
  console.log('[WhatsApp]', reason);
  clearInterval(tick);
  clearInterval(heartbeat);
  await worker.closeClient().catch(() => {});
  await pool.query('UPDATE whatsapp_settings SET worker_id = NULL, worker_seen_at = NULL, qr_code = NULL, qr_expires_at = NULL WHERE id = 1 AND worker_id = $1', [worker.id]).catch(() => {});
  await pool.end();
}

process.once('SIGINT', () => { void stop('Worker stopped'); });
process.once('SIGTERM', () => { void stop('Worker stopped'); });
if (initial.command === 'idle' && initial.bot_status !== 'disconnected') await worker.connect();
await worker.tick();
