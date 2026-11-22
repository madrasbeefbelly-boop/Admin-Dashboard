import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import pkg from 'whatsapp-web.js';
import QRCode from 'qrcode';

const { Client, LocalAuth } = pkg;
const windowsChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

export async function deliverQueuedMessage(db, send) {
  const { rows: [job] } = await db.query(`
    WITH next_job AS (
      SELECT id FROM whatsapp_outbox
      WHERE sent_at IS NULL AND failed_at IS NULL AND next_attempt_at <= now()
      ORDER BY next_attempt_at, id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE whatsapp_outbox AS job
    SET attempts = job.attempts + 1, next_attempt_at = now() + interval '2 minutes'
    FROM next_job WHERE job.id = next_job.id
    RETURNING job.id, job.target, job.message, job.attempts
  `);
  if (!job) return false;
  try {
    await send(job.target, job.message);
  } catch (error) {
    const delay = Math.min(300, 5 * 2 ** job.attempts);
    await db.query(`
      UPDATE whatsapp_outbox
      SET failed_at = CASE WHEN attempts >= 6 THEN now() END,
        message = CASE WHEN attempts >= 6 THEN '' ELSE message END,
        next_attempt_at = now() + $3 * interval '1 second'
      WHERE id = $1 AND attempts = $2
    `, [job.id, job.attempts, delay]);
    console.error('[WhatsApp] Delivery attempt failed for job', job.id, error.name);
    return true;
  }
  await db.query("UPDATE whatsapp_outbox SET sent_at = now(), message = '' WHERE id = $1 AND attempts = $2", [job.id, job.attempts]);
  return true;
}

export class WhatsAppWorker {
  id = randomUUID();
  client = null;
  status = 'disconnected';
  busy = false;
  reconnectAt = 0;

  constructor(db) {
    this.db = db;
  }

  async heartbeat() {
    const { rows: [row] } = await this.db.query(`
      UPDATE whatsapp_settings SET worker_id = $1, worker_seen_at = now()
      WHERE id = 1 AND (worker_id = $1 OR worker_seen_at IS NULL OR worker_seen_at < now() - interval '40 seconds')
      RETURNING bot_status, command
    `, [this.id]);
    return row;
  }

  async publish(status, { qr = null, phone = null, error = null } = {}) {
    this.status = status;
    await this.db.query(`
      UPDATE whatsapp_settings SET bot_status = $2, qr_code = $3,
        qr_expires_at = CASE WHEN $3::text IS NULL THEN NULL ELSE now() + interval '55 seconds' END,
        bot_phone = $4, last_error = $5
      WHERE id = 1 AND worker_id = $1 AND command = 'idle'
    `, [this.id, status, qr, phone, error]);
  }

  async closeClient(logout = false) {
    const client = this.client;
    this.client = null;
    if (!client) return;
    if (logout && this.status === 'connected') await client.logout().catch(() => {});
    await client.destroy().catch(() => {});
  }

  retryBrowser() {
    if (this.client && !this.reconnectAt) this.reconnectAt = Date.now() + 3000;
  }

  async connect(refresh = false) {
    if (refresh) await this.closeClient(true);
    if (this.client) return;
    await this.publish('initializing');
    const executablePath = process.env.WHATSAPP_CHROME_PATH || (existsSync(windowsChrome) ? windowsChrome : undefined);
    const client = new Client({
      authStrategy: new LocalAuth({ dataPath: path.resolve(process.env.WHATSAPP_AUTH_DIR || '.wwebjs_auth'), clientId: 'restaurant-worker', rmMaxRetries: 8 }),
      authTimeoutMs: 60000,
      puppeteer: {
        executablePath,
        headless: true,
        args: ['--disable-dev-shm-usage', '--disable-gpu', '--disable-crash-reporter', '--disable-breakpad'],
      },
    });
    this.client = client;
    const handle = (event, callback) => client.on(event, (...args) => {
      if (client !== this.client) return;
      void callback(...args).catch(error => console.error('[WhatsApp] Could not publish', event, error.name));
    });
    handle('qr', async (raw) => {
      const qr = await QRCode.toDataURL(raw, { margin: 3, scale: 7, errorCorrectionLevel: 'M' });
      if (client === this.client && this.status !== 'connected') await this.publish('qr_ready', { qr });
    });
    handle('authenticated', async () => this.publish('initializing'));
    handle('ready', async () => {
      await this.publish('connected', { phone: client.info?.wid?.user ?? null });
      console.log('[WhatsApp] Linked and ready to send alerts');
    });
    const disconnected = async () => {
      await this.closeClient();
      await this.publish('disconnected', { error: 'WhatsApp disconnected. Request a fresh QR code to link the phone.' });
    };
    handle('auth_failure', disconnected);
    handle('disconnected', disconnected);
    void client.initialize().catch(async (error) => {
      if (client !== this.client) return;
      await this.closeClient();
      await this.publish('disconnected', { error: 'WhatsApp Web could not start. Request a fresh QR to retry.' });
      console.error('[WhatsApp] Browser launch failed:', error.message.split('\n')[0]);
    }).catch(error => console.error('[WhatsApp] Recovery failed:', error.name));
  }

  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const { rows: [request] } = await this.db.query(`
        WITH pending AS (
          SELECT command FROM whatsapp_settings WHERE id = 1 AND worker_id = $1 AND command <> 'idle' FOR UPDATE
        )
        UPDATE whatsapp_settings SET command = 'idle' FROM pending WHERE id = 1 RETURNING pending.command
      `, [this.id]);
      if (request?.command === 'disconnect') {
        this.reconnectAt = 0;
        await this.closeClient(true);
        await this.publish('disconnected');
      } else if (request?.command === 'refresh' || request?.command === 'start') {
        this.reconnectAt = 0;
        await this.connect(request.command === 'refresh');
      } else if (this.reconnectAt && Date.now() >= this.reconnectAt) {
        this.reconnectAt = 0;
        await this.closeClient();
        await this.connect();
      }
      if (this.status === 'connected' && this.client) {
        await deliverQueuedMessage(this.db, async (to, text) => {
          const message = await this.client.sendMessage(to, text, { waitUntilMsgSent: true });
          if (!message?.id) throw new Error('WhatsApp did not accept the message');
        });
      }
    } finally {
      this.busy = false;
    }
  }
}
