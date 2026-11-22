export function formatChatId(value, group = false) {
  let input = String(value ?? '').trim();
  if (!input) return null;
  if (group || input.endsWith('@g.us')) {
    if (!input.endsWith('@g.us')) {
      input = `${input}@g.us`;
    }
    return /^\d+(?:-\d+)?@g\.us$/.test(input) ? input : null;
  }
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
    formatChatId(settings.target_group_id, true),
    formatChatId(settings.target_phone),
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

export function queueOrderServedAlert(db, order, items = []) {
  const lines = items.map((item) => {
    const itemName = item.name || item.item_name || 'Item';
    const qty = item.quantity || 1;
    const price = Number(item.unit_price || 0);
    return `• ${qty} × ${itemName} · ${money(Number(qty) * price)}`;
  }).join('\n');
  const itemsSection = lines ? `\n${lines}\n` : '';

  return enqueueWhatsApp(db, `order:served:${order.id}`, 'order', `🍽️ *Madras Beef Belly — Order Served*

*Order:* ${order.order_ref || order.order_number || order.id}
${itemsSection}
*Total:* ${money(Number(order.total_amount || order.total_value || 0))}`);
}

export function queueOrderCancelledAlert(db, order, items = [], reason = '') {
  const lines = items.map((item) => {
    const itemName = item.name || item.item_name || 'Item';
    const qty = item.quantity || 1;
    const price = Number(item.unit_price || 0);
    return `• ${qty} × ${itemName} · ${money(Number(qty) * price)}`;
  }).join('\n');
  const itemsSection = lines ? `\n${lines}\n` : '';

  return enqueueWhatsApp(db, `order:cancelled:${order.id}:${Date.now()}`, 'order', `❌ *Madras Beef Belly — Order Cancelled*

*Order:* ${order.order_ref || order.order_number || order.id}
${itemsSection}
*Total:* ${money(Number(order.total_amount || order.total_value || 0))}`);
}

export function queueOrderDeletedAlert(db, order, items = []) {
  const lines = items.map((item) => {
    const itemName = item.name || item.item_name || 'Item';
    const qty = item.quantity || 1;
    const price = Number(item.unit_price || 0);
    return `• ${qty} × ${itemName} · ${money(Number(qty) * price)}`;
  }).join('\n');
  const itemsSection = lines ? `\n${lines}\n` : '';

  return enqueueWhatsApp(db, `order:deleted:${order.id}:${Date.now()}`, 'order', `🗑️ *Madras Beef Belly — Order Deleted*

*Order:* ${order.order_ref || order.order_number || order.id}
${itemsSection}
*Total:* ${money(Number(order.total_amount || order.total_value || 0))}`);
}

export function queueOrderAlert(db, order, items = []) {
  const lines = items.map((item) => {
    const itemName = item.name || item.item_name || 'Item';
    const qty = item.quantity || 1;
    const price = Number(item.unit_price || 0);
    return `• ${qty} × ${itemName} · ${money(Number(qty) * price)}`;
  }).join('\n');
  const itemsSection = lines ? `\n${lines}\n` : '';

  return enqueueWhatsApp(db, `order:${order.id}`, 'order', `🔔 *Madras Beef Belly — New order*

*Order:* ${order.order_ref || order.order_number || order.id}
${itemsSection}
*Total:* ${money(Number(order.total_amount || order.total_value || 0))}`);
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
