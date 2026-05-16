/**
 * test-server.js — piKioskoCliente
 * Servidor HTTP local para probar la aplicación en desarrollo.
 *
 * Uso:
 *   node test-server.js
 *
 * Luego configura piKioskoCliente.conf:
 *   PLAYLIST_URL = http://localhost:3000/playlist.json
 */

const http = require('http');
const PORT = 3000;

// ── EDITA ESTA LISTA CON TUS VIDEOS ─────────────────────────────────────────
const PLAYLIST = [
  {
    id:       '1',
    filename: 'big_buck_bunny.mp4',
    url:      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
  {
    id:       '2',
    filename: 'elephant_dream.mp4',
    url:      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
  {
    id:       '3',
    filename: 'for_bigger_blazes.mp4',
    url:      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
];

http.createServer((req, res) => {
  if (req.url === '/playlist.json') {
    res.writeHead(200, {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(PLAYLIST, null, 2));
    console.log(`[${new Date().toLocaleTimeString()}] Playlist servida (${PLAYLIST.length} videos)`);
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
}).listen(PORT, () => {
  console.log(`\n✓ Servidor de prueba en http://localhost:${PORT}/playlist.json`);
  console.log('\nVideos disponibles:');
  PLAYLIST.forEach((v, i) => console.log(`  ${i + 1}. ${v.filename}`));
  console.log('\nPresiona Ctrl+C para detener.\n');
});
