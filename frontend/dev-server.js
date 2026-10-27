/**
 * CampusSplit High-Performance Development Server
 * Native Node.js HTTP server with Sucrase on-the-fly JSX transpilation
 * and reverse proxy to backend API.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { transform } = require('sucrase');

const PORT = process.env.FRONTEND_PORT || 3000;
const BACKEND_PORT = process.env.PORT || 5000;
const ROOT_DIR = path.resolve(__dirname);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jsx': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function proxyToBackend(req, res) {
  const options = {
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: req.headers
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: {
        code: 'BAD_GATEWAY',
        message: `Failed to connect to backend service on port ${BACKEND_PORT}. Is backend running? (${err.message})`
      }
    }));
  });

  req.pipe(proxyReq);
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();

  // On-the-fly JSX transpilation
  if (ext === '.jsx' || (ext === '.js' && !filePath.includes('vendor'))) {
    try {
      const code = fs.readFileSync(filePath, 'utf8');
      const compiled = transform(code, {
        transforms: ['jsx'],
        jsxPragma: 'React.createElement',
        jsxFragmentPragma: 'React.Fragment',
        filePath
      }).code;

      res.writeHead(200, {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'no-cache'
      });
      res.end(compiled);
      return;
    } catch (err) {
      console.error(`[JSX Error in ${filePath}]:`, err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`JSX Transpilation Error in ${path.basename(filePath)}:\n${err.message}`);
      return;
    }
  }

  // Regular static file
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // 1. API Reverse Proxy
  if (req.url.startsWith('/api/v1')) {
    return proxyToBackend(req, res);
  }

  // 2. Normalize path
  const urlPath = req.url.split('?')[0];
  let localPath;

  if (urlPath === '/' || urlPath === '') {
    localPath = path.join(ROOT_DIR, 'public', 'index.html');
  } else if (urlPath.startsWith('/vendor/')) {
    localPath = path.join(ROOT_DIR, 'public', urlPath);
  } else if (urlPath.startsWith('/src/')) {
    localPath = path.join(ROOT_DIR, urlPath);
  } else if (fs.existsSync(path.join(ROOT_DIR, 'public', urlPath))) {
    localPath = path.join(ROOT_DIR, 'public', urlPath);
  } else if (fs.existsSync(path.join(ROOT_DIR, 'src', urlPath))) {
    localPath = path.join(ROOT_DIR, 'src', urlPath);
  } else {
    // SPA Fallback for client-side routing
    localPath = path.join(ROOT_DIR, 'public', 'index.html');
  }

  serveFile(localPath, res);
});

server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`CampusSplit Frontend running at http://localhost:${PORT}`);
  console.log(`API Proxy configured for http://127.0.0.1:${BACKEND_PORT}`);
  console.log(`=================================================`);
});

module.exports = server;
