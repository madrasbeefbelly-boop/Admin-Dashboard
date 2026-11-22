export function formatChatId(value, group = false) {
  const input = String(value ?? '').trim();
  if (group) return /^\d+(?:-\d+)?@g\.us$/.test(input) ? input : null;
  if (input.endsWith('@c.us')) return /^[1-9]\d{7,14}@c\.us$/.test(input) ? input : null;
  if (!/^\+?[\d\s()-]+$/.test(input)) return null;
  const digits = input.replace(/\D/g, '');
  const number = digits.length === 10 && !input.startsWith('+') ? '91' + digits : digits;
  return /^[1-9]\d{7,14}$/.test(number) ? number + '@c.us' : null;
}

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format;
const quantity = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 4 }).format;

export async function enqueueWhatsApp(db, eventKey, kind, message, testTarget = null) {
  const { rows: [settings] } = await db.query('SELECT target_phone, target_group_id, alert_new_orders, alert_low_stock FROM whatsapp_settings WHERE id=1');
  if (!settings || (kind === 'order' && !settings.alert_new_orders) || (kind === 'low_stock' && !settings.alert_low_stock)) return [];
  const recipients = testTarget ? [testTarget] : [
    formatChatId(settings.target_phone), formatChatId(settings.target_group_id, true),
  ];
  const targets = [...new Set(recipients.filter(Boolean))];
  if (!targets.length) return [];
  const { rows } = await db.query(`
    INSERT INTO whatsapp_outbox (event_key, kind, target, message)
    SELECT $1, $2, target, $3 FROM unnest($4::text[]) AS target
    ON CONFLICT (event_key, target) DO NOTHING RETURNING id
  `, [eventKey, kind, message, targets]);
  return rows;
}

export function queueOrderAlert(db, order, items) {
  const lines = items.map(({ name, quantity, unit_price }) =>
    `• ${quantity} × ${name} · ${money(Number(quantity) * Number(unit_price))}`).join('\n');
  return enqueueWhatsApp(db, `order:${order.id}`, 'order', `🔔 *Madras Beef Belly — New order*

*Order:* ${order.order_ref}
*Customer:* ${order.customer_name || 'Walk-in'}
*Table:* ${order.table_no || 'Takeaway / Walk-in'}
*Payment:* ${order.payment_method || 'Cash'}

${lines}

*Total:* ${money(Number(order.total_amount))}`);
}

export async function queueLowStockAlert(db, key, item, previous, current) {
  if (item.minimum_stock == null) return;
  const threshold = Number(item.minimum_stock);
  if (!(previous > threshold && current <= threshold)) return;
  await enqueueWhatsApp(db, key, 'low_stock', `⚠️ *Madras Beef Belly — Low stock*

*Ingredient:* ${item.name}
*Current stock:* ${quantity(current)} ${item.unit}
*Minimum:* ${quantity(threshold)} ${item.unit}`);
}
