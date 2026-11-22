export async function syncOrderToGoogleSheet(db, payload) {
  try {
    let webhookUrl = process.env.GOOGLE_SHEET_WEBHOOK_URL || '';
    if (db) {
      const { rows } = await db.query('SELECT google_sheet_webhook FROM whatsapp_settings WHERE id = 1 LIMIT 1').catch(() => ({ rows: [] }));
      if (rows[0]?.google_sheet_webhook) {
        webhookUrl = rows[0].google_sheet_webhook.trim();
      }
    }
    if (!webhookUrl || !webhookUrl.startsWith('http')) return false;

    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow',
    }).catch((err) => {
      console.error('[GoogleSheetSync] Delivery error:', err.message);
    });

    return true;
  } catch (error) {
    console.error('[GoogleSheetSync] Error:', error.message);
    return false;
  }
}
