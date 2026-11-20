/**
 * Madras Beef Belly - WhatsApp Notification Service
 * Powered by whatsapp-web.js and LocalAuth
 */

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import QRCode from 'qrcode';
import fs from 'node:fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

class WhatsAppService {
  constructor() {
    this.client = null;
    this.status = 'disconnected'; // 'disconnected' | 'initializing' | 'qr_ready' | 'connected'
    this.qrCode = null;
    this.clientInfo = null;
    this.lastError = null;
    this.isInitializing = false;
  }

  // Get current status
  getStatus() {
    return {
      status: this.status,
      isConnected: this.status === 'connected',
      isInitializing: this.isInitializing,
      qrCode: this.qrCode,
      info: this.clientInfo,
      lastError: this.lastError
    };
  }

  // Start WhatsApp Client
  async start() {
    if (this.status === 'connected') {
      console.log('WhatsApp Client is already connected.');
      return;
    }
    if (this.isInitializing) {
      console.log('WhatsApp Client is already initializing...');
      return;
    }

    try {
      this.isInitializing = true;
      this.status = 'initializing';
      this.lastError = null;
      this.qrCode = null;

      const puppeteerOpts = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };

      if (fs.existsSync(CHROME_PATH)) {
        puppeteerOpts.executablePath = CHROME_PATH;
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: './.wwebjs_auth'
        }),
        puppeteer: puppeteerOpts
      });

      this.client.on('qr', async (qr) => {
        try {
          console.log('[WhatsApp] QR Code received from WhatsApp Web');
          this.qrCode = await QRCode.toDataURL(qr, { margin: 2, scale: 6 });
          this.status = 'qr_ready';
          this.isInitializing = false;
        } catch (qrErr) {
          console.error('[WhatsApp] QR generation error:', qrErr);
        }
      });

      this.client.on('ready', () => {
        console.log('[WhatsApp] Client is READY & connected!');
        this.status = 'connected';
        this.isInitializing = false;
        this.qrCode = null;
        this.clientInfo = {
          pushname: this.client.info?.pushname || 'Madras Beef Belly',
          wid: this.client.info?.wid?.user || '',
          phone: this.client.info?.wid?.user || ''
        };
      });

      this.client.on('authenticated', () => {
        console.log('[WhatsApp] Authenticated successfully');
        this.status = 'connected';
        this.qrCode = null;
      });

      this.client.on('auth_failure', (msg) => {
        console.error('[WhatsApp] Authentication failure:', msg);
        this.status = 'disconnected';
        this.isInitializing = false;
        this.lastError = typeof msg === 'string' ? msg : 'Authentication failed';
      });

      this.client.on('disconnected', (reason) => {
        console.log('[WhatsApp] Client disconnected:', reason);
        this.status = 'disconnected';
        this.isInitializing = false;
        this.qrCode = null;
        this.clientInfo = null;
      });

      await this.client.initialize();
    } catch (err) {
      console.error('[WhatsApp] Init error:', err);
      this.status = 'disconnected';
      this.isInitializing = false;
      this.lastError = err.message;
    }
  }

  // Disconnect & logout
  async disconnect() {
    try {
      if (this.client) {
        await this.client.logout().catch(() => {});
        await this.client.destroy().catch(() => {});
      }
      this.client = null;
      this.status = 'disconnected';
      this.qrCode = null;
      this.clientInfo = null;
      this.isInitializing = false;
      console.log('[WhatsApp] Client disconnected & destroyed');
      return { success: true };
    } catch (err) {
      console.error('[WhatsApp] Disconnect error:', err);
      return { success: false, error: err.message };
    }
  }

  // Format phone number to WhatsApp JID (Chat ID)
  formatChatId(phone) {
    if (!phone) return null;
    let clean = String(phone).replace(/\D/g, '');
    if (!clean) return null;

    // If already has group suffix
    if (phone.endsWith('@g.us')) return phone;
    if (phone.endsWith('@c.us')) return phone;

    // If 10 digits Indian mobile number (e.g., 9876543210), prepend 91
    if (clean.length === 10) {
      clean = '91' + clean;
    }

    return `${clean}@c.us`;
  }

  // Send raw message
  async sendMessage(to, message) {
    if (this.status !== 'connected' || !this.client) {
      throw new Error('WhatsApp client is not connected. Please scan QR code in Settings.');
    }

    const chatId = this.formatChatId(to);
    if (!chatId) {
      throw new Error('Invalid phone number provided for WhatsApp');
    }

    const res = await this.client.sendMessage(chatId, message);
    return { success: true, messageId: res.id?._serialized };
  }

  // Send New Order Notification
  async notifyNewOrder(order, pool) {
    try {
      if (this.status !== 'connected' || !this.client) return;

      const settingsRes = await pool.query('SELECT * FROM whatsapp_settings WHERE id = 1');
      const settings = settingsRes.rows[0];
      if (!settings || !settings.alert_new_orders) return;

      const target = settings.target_phone || settings.target_group_id;
      if (!target) return;

      const itemsList = Array.isArray(order.items) && order.items.length > 0
        ? order.items.map((it) => `• ${it.quantity}x ${it.name || it.item_name} (₹${Number(it.line_total || it.unit_price * it.quantity).toFixed(0)})`).join('\n')
        : '• Order items recorded';

      const timeStr = new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const message = 
`🔔 *MADRAS BEEF BELLY — NEW ORDER*

📋 *Order:* ${order.order_ref || order.id}
🪑 *Table:* ${order.table_no ? 'Table ' + order.table_no : 'Takeaway / Walk-in'}
👤 *Customer:* ${order.customer_name || 'Customer'}
💳 *Payment:* ${order.payment_method || 'Cash'}

*Items Ordered:*
${itemsList}

💰 *Total:* ₹${Number(order.total_amount).toFixed(2)}
🕒 *Time:* ${timeStr}
🚀 *Status:* ${order.status || 'New'}`;

      if (settings.target_phone) {
        await this.sendMessage(settings.target_phone, message).catch(err => console.error('[WhatsApp] Order send error:', err.message));
      }
      if (settings.target_group_id && settings.target_group_id !== settings.target_phone) {
        await this.sendMessage(settings.target_group_id, message).catch(err => console.error('[WhatsApp] Group order send error:', err.message));
      }
    } catch (err) {
      console.error('[WhatsApp] notifyNewOrder error:', err);
    }
  }

  // Send Low Stock Notification
  async notifyLowStock(ingredient, pool) {
    try {
      if (this.status !== 'connected' || !this.client) return;

      const settingsRes = await pool.query('SELECT * FROM whatsapp_settings WHERE id = 1');
      const settings = settingsRes.rows[0];
      if (!settings || !settings.alert_low_stock) return;

      const target = settings.target_phone || settings.target_group_id;
      if (!target) return;

      const message = 
`⚠️ *MADRAS BEEF BELLY — LOW STOCK ALERT*

🥩 *Ingredient:* ${ingredient.name}
📦 *Current Stock:* ${Number(ingredient.current_stock).toFixed(2)} ${ingredient.unit}
📉 *Minimum Required:* ${Number(ingredient.minimum_stock).toFixed(2)} ${ingredient.unit}
🏷️ *Category:* ${ingredient.category || 'General'}

_Please purchase or restock this ingredient soon to keep orders flowing!_`;

      if (settings.target_phone) {
        await this.sendMessage(settings.target_phone, message).catch(err => console.error('[WhatsApp] Low-stock send error:', err.message));
      }
      if (settings.target_group_id && settings.target_group_id !== settings.target_phone) {
        await this.sendMessage(settings.target_group_id, message).catch(err => console.error('[WhatsApp] Group low-stock send error:', err.message));
      }
    } catch (err) {
      console.error('[WhatsApp] notifyLowStock error:', err);
    }
  }

  // Send Test Message
  async sendTestMessage(targetPhone) {
    const timeStr = new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const message = 
`✅ *Madras Beef Belly — WhatsApp Bot Active!*

Your restaurant WhatsApp notification bot is connected and ready.
You will receive real-time alerts for:
• 🔔 New customer orders
• ⚠️ Low inventory & stock shortages

🕒 *Verified at:* ${timeStr}`;

    return await this.sendMessage(targetPhone, message);
  }
}

export const whatsappService = new WhatsAppService();
