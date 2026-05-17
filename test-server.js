/**
 * test-server.js - piKioskoCliente
 * Servidor HTTP local que simula el API pikiosko y sirve los archivos
 * de video ubicados en ./test-videos/ (a.mp4 y b.mp4).
 *
 * Uso:
 *   node test-server.js
 *
 * Configura piKioskoCliente.conf:
 *   API_BASE_URL = http://localhost:3000/media/resources
 *   SCREEN_ID    = 1
 *   TOKEN        = test
 *   MEDIA_TYPE   = video
 *
 * La app llamará a:
 *   http://localhost:3000/media/resources?type=video&date=AAAA-MM-DD&screen=1&token=test
 *
 * Los videos se sirven desde:
 *   http://localhost:3000/test-videos/a.mp4
 *   http://localhost:3000/test-videos/b.mp4
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT       = 3000;
const VIDEOS_DIR = path.join(__dirname, 'test-videos');

// ── Verificar que los videos existen ──────────────────────────────────────────
['a.mp4', 'b.mp4'].forEach((f) => {
  const full = path.join(VIDEOS_DIR, f);
  if (!fs.existsSync(full)) {
    console.warn(`  AVISO: Archivo no encontrado: test-videos/${f}`);
  }
});

// ── Función auxiliar para construir un item con estructura pikiosko ────────────
function makeVideo(id, name, category, filename) {
  const now = new Date().toISOString();
  const url = `http://localhost:${PORT}/test-videos/${filename}`;
  return {
    id,
    category,
    type:        'video',
    name,
    description: `Video de prueba local - ${filename}`,
    screens:     '[TEST01:local]',
    file_path:   `multimedia/${filename}`,
    start_date:  '2026-01-01',
    end_date:    '2026-12-31',
    enabled:     1,
    created_by:  'dev@test.local',
    updated_by:  'dev@test.local',
    created_at:  now,
    updated_at:  now,
    file_name:   filename,
    url_path:    url,
  };
}

// ── Playlist con los dos videos locales ───────────────────────────────────────
const PLAYLIST = [
  makeVideo(1, 'Video A', 'Prueba', 'a.mp4'),
  makeVideo(2, 'Video B', 'Prueba', 'b.mp4'),
];

// ── Servidor ──────────────────────────────────────────────────────────────────
http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname  = parsedUrl.pathname;

  // ── Endpoint del API: /media/resources ─────────────────────────────────────
  if (pathname === '/media/resources') {
    const token = parsedUrl.searchParams.get('token') || '';
    const type  = parsedUrl.searchParams.get('type')  || 'video';
    const date  = parsedUrl.searchParams.get('date')  || '-';
    const screen = parsedUrl.searchParams.get('screen') || '-';

    if (!token) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Token requerido' }));
      console.log(`[${ts()}] 401 - token ausente`);
      return;
    }

    const list = type === 'video' || type === 'mixed' ? PLAYLIST : [];

    res.writeHead(200, {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(list, null, 2));
    console.log(`[${ts()}] /media/resources  type=${type}  date=${date}  screen=${screen}  items=${list.length}`);
    return;
  }

  // ── Servir archivos de video desde ./test-videos/ ─────────────────────────
  if (pathname.startsWith('/test-videos/')) {
    const filename = path.basename(pathname);           // evitar path traversal
    const filepath = path.join(VIDEOS_DIR, filename);

    if (!fs.existsSync(filepath)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end(`Archivo no encontrado: ${filename}\n`);
      console.log(`[${ts()}] 404 ${pathname}`);
      return;
    }

    const stat  = fs.statSync(filepath);
    const total = stat.size;
    const range = req.headers.range;

    // Soporte de Range requests (necesario para que el video pueda buscar posición)
    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : total - 1;
      const chunk = end - start + 1;

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${total}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunk,
        'Content-Type':   'video/mp4',
      });
      fs.createReadStream(filepath, { start, end }).pipe(res);
      console.log(`[${ts()}] 206 ${pathname}  bytes ${start}-${end}/${total}`);
    } else {
      res.writeHead(200, {
        'Content-Length': total,
        'Content-Type':   'video/mp4',
        'Accept-Ranges':  'bytes',
      });
      fs.createReadStream(filepath).pipe(res);
      console.log(`[${ts()}] 200 ${pathname}  (${(total / 1024 / 1024).toFixed(1)} MB)`);
    }
    return;
  }

  // ── 404 para cualquier otra ruta ────────────────────────────────────────────
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found\n');
  console.log(`[${ts()}] 404 ${req.url}`);

}).listen(PORT, () => {
  const d    = new Date();
  const date = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  console.log('\n--- piKioskoCliente - Servidor de prueba ---\n');

  console.log('  Videos servidos desde ./test-videos/:');
  ['a.mp4', 'b.mp4'].forEach((f) => {
    const full   = path.join(VIDEOS_DIR, f);
    const exists = fs.existsSync(full);
    const size   = exists ? ` (${(fs.statSync(full).size / 1024 / 1024).toFixed(1)} MB)` : ' (NO ENCONTRADO)';
    console.log(`    - http://localhost:${PORT}/test-videos/${f}${size}`);
  });

  console.log(`\n  API de playlist:`);
  console.log(`    http://localhost:${PORT}/media/resources?type=video&date=${date}&screen=1&token=test`);

  console.log('\n  piKioskoCliente.conf:');
  console.log('    API_BASE_URL = http://localhost:3000');
  console.log('    SCREEN_ID    = 1');
  console.log('    TOKEN        = test');
  console.log('    MEDIA_TYPE   = video\n');
  console.log('  Presiona Ctrl+C para detener.\n');
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function ts()  { return new Date().toLocaleTimeString(); }
function pad(n) { return String(n).padStart(2, '0'); }
