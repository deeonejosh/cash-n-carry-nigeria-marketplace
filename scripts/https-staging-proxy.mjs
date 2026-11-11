import { createServer } from 'node:https';
import { request } from 'node:http';
import { readFileSync } from 'node:fs';

const { STAGING_TLS_CERT, STAGING_TLS_KEY } = process.env;
if (!STAGING_TLS_CERT || !STAGING_TLS_KEY) throw new Error('Loopback TLS certificate and key required');
const port = Number(process.env.STAGING_HTTPS_PORT ?? 3443);
const upstream = Number(process.env.STAGING_HTTP_PORT ?? 3109);

createServer({ key: readFileSync(STAGING_TLS_KEY), cert: readFileSync(STAGING_TLS_CERT) }, (req, res) => {
  const backend = request({
    hostname: '127.0.0.1', port: upstream, path: req.url, method: req.method,
    headers: { ...req.headers, 'x-forwarded-proto': 'https' },
  }, (response) => {
    res.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(res);
  });
  backend.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  res.on('close', () => backend.destroy());
  req.pipe(backend);
}).listen(port, '127.0.0.1');
