export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ success: false, error: 'Dashboard backend is not configured.' }));
  }

  const url = new URL(req.url, 'http://localhost');
  const rewrittenPath = url.searchParams.get('__dashboard_path');
  url.searchParams.delete('__dashboard_path');
  const path = url.pathname === '/api/dashboard' && rewrittenPath
    ? `/api/${rewrittenPath}`
    : url.pathname;
  req.url = path + url.search;

  const { default: app } = await import('../server.js');
  return app(req, res);
}
