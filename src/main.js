/**
 * main.js — piKioskoCliente
 * Proceso principal de Electron.
 */

const { app, BrowserWindow, ipcMain, screen, protocol } = require('electron');
const path    = require('path');
const fs      = require('fs');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');

// ── CONFIGURACIÓN ──────────────────────────────────────────────────────────────
const { loadConfig, saveConfig } = require('./config');
let CONFIG = loadConfig();

const VIDEOS_DIR = path.join(app.getPath('userData'), 'videos');

// ── GLOBALS ────────────────────────────────────────────────────────────────────
let mainWindow = null;
const isDev    = process.argv.includes('--dev');

// ── UTILIDADES ─────────────────────────────────────────────────────────────────
function ensureVideosDir() {
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// ── VENTANA PRINCIPAL ──────────────────────────────────────────────────────────
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width, height,
    fullscreen:    true,
    frame:         false,
    kiosk:         !isDev,
    alwaysOnTop:   !isDev,
    backgroundColor: CONFIG.backgroundColor,
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration:  false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.on('close', (e) => { if (!isDev) e.preventDefault(); });
}

// ── DESCARGA ───────────────────────────────────────────────────────────────────
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const parsed   = new URL(url);
    const protocol = parsed.protocol === 'https:' ? https : http;
    const tmpPath  = destPath + '.tmp';
    const file     = fs.createWriteStream(tmpPath);

    const doGet = (targetUrl) => {
      const prot = targetUrl.startsWith('https') ? https : http;
      const req  = prot.get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlink(tmpPath, () => {});
          return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(tmpPath, () => {});
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const total = parseInt(res.headers['content-length'], 10);
        let received = 0;
        res.on('data', (chunk) => {
          received += chunk.length;
          if (total && mainWindow) {
            mainWindow.webContents.send('download-progress', {
              url, percent: Math.round((received / total) * 100), downloaded: received, total,
            });
          }
        });
        res.pipe(file);
        file.on('finish', () =>
          file.close(() =>
            fs.rename(tmpPath, destPath, (err) => (err ? reject(err) : resolve(destPath)))
          )
        );
      });
      req.on('error', (err) => { file.close(); fs.unlink(tmpPath, () => {}); reject(err); });
      file.on('error', (err) => { file.close(); fs.unlink(tmpPath, () => {}); reject(err); });
    };

    doGet(url);
  });
}

// ── FETCH JSON ─────────────────────────────────────────────────────────────────
function fetchPlaylist(url) {
  return new Promise((resolve, reject) => {
    const prot = url.startsWith('https') ? https : http;
    prot.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON inválido: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

// ── SINCRONIZACIÓN ─────────────────────────────────────────────────────────────
async function syncVideos(playlist) {
  ensureVideosDir();

  const normalized = playlist.map((item, idx) => {
    if (typeof item === 'string') {
      return { id: String(idx), url: item, filename: item.split('/').pop() || `video_${idx}.mp4` };
    }
    return {
      id:       item.id       || String(idx),
      url:      item.url,
      filename: item.filename || item.url.split('/').pop() || `video_${idx}.mp4`,
    };
  });

  // Eliminar archivos no presentes en la nueva lista
  const existing    = fs.readdirSync(VIDEOS_DIR);
  const newFilenames = new Set(normalized.map((v) => v.filename));
  for (const f of existing) {
    if (!newFilenames.has(f)) {
      try { fs.unlinkSync(path.join(VIDEOS_DIR, f)); }
      catch (_) {}
      if (mainWindow) mainWindow.webContents.send('video-deleted', f);
    }
  }

  // Descargar nuevos
  const result = [];
  for (const video of normalized) {
    const destPath = path.join(VIDEOS_DIR, video.filename);
    if (!fs.existsSync(destPath)) {
      if (mainWindow) mainWindow.webContents.send('sync-status', { status: 'downloading', filename: video.filename });
      try {
        await downloadFile(video.url, destPath);
      } catch (err) {
        if (mainWindow) mainWindow.webContents.send('sync-status', { status: 'error', filename: video.filename, error: err.message });
        continue;
      }
    }
    result.push({ ...video, localPath: `file://${destPath.replace(/\\/g, '/')}` });
  }
  return result;
}

// ── IPC HANDLERS ──────────────────────────────────────────────────────────────

ipcMain.handle('fetch-and-sync', async () => {
  try {
    if (mainWindow) mainWindow.webContents.send('sync-status', { status: 'fetching-json' });
    const raw    = await fetchPlaylist(CONFIG.playlistUrl);
    const videos = await syncVideos(Array.isArray(raw) ? raw : (raw.videos || []));
    return { ok: true, videos };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('get-config', () => ({
  playlistUrl:          CONFIG.playlistUrl,
  backgroundColor:      CONFIG.backgroundColor,
  backgroundImage:      CONFIG.backgroundImage,
  rawBackgroundImage:   CONFIG._rawBackgroundImage || '',
  videosDir:            VIDEOS_DIR,
  confPath:             CONFIG._confPath,
}));

// Guardar configuración desde el panel de ajustes del renderer
ipcMain.handle('save-config', (_, newValues) => {
  try {
    const confPath = saveConfig(newValues);
    // Recargar config en memoria
    CONFIG = loadConfig();
    return { ok: true, confPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── APP LIFECYCLE ──────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  protocol.interceptFileProtocol('file', (request, callback) => {
    const url     = request.url.replace(/^file:\/\//, '');
    const decoded = decodeURIComponent(url);
    callback({ path: decoded });
  });
  ensureVideosDir();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
