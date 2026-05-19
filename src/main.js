/**
 * main.js - piKioskoCliente
 *
 * Proceso principal de Electron. Se ejecuta en Node.js (sin acceso al DOM).
 * Es el único proceso con acceso al sistema de archivos, la red a nivel nativo
 * y las APIs del sistema operativo.
 *
 * Responsabilidades:
 *   - Leer la configuración desde piKioskoCliente.conf al arrancar
 *   - Crear la ventana principal en modo kiosco (pantalla completa, sin bordes,
 *     siempre en primer plano, Alt+F4 deshabilitado en modo kiosco)
 *   - Descargar los archivos de video a la carpeta local de datos del usuario
 *   - Sincronizar la lista: eliminar videos obsoletos y descargar los nuevos
 *   - Registrar todos los eventos relevantes en un archivo de log con rotación
 *   - Atender las solicitudes del renderer a través de IPC (ipcMain.handle)
 *
 * Comunicación con el renderer (index.html / preload.js):
 *   fetch-and-sync  : construye URL con fecha actual, descarga JSON, sincroniza videos
 *   get-config      : devuelve la configuración activa y la URL de vista previa
 *   save-config     : guarda nuevos valores en .conf y recarga la configuración
 *   write-log       : escribe una línea en el archivo de log desde el renderer
 *   get-log-path    : devuelve la ruta del archivo de log activo
 *   close-app       : cierra la ventana y termina el proceso (funciona en kiosco)
 *
 * Estructura de archivos en el equipo del usuario:
 *   %APPDATA%\piKioskoCliente\videos\         videos descargados (Windows)
 *   ~/.config/piKioskoCliente/videos/          videos descargados (Linux/Pi)
 *   %APPDATA%\piKioskoCliente\piKioskoCliente.log    log activo
 *   %APPDATA%\piKioskoCliente\piKioskoCliente.bak.log log anterior (tras rotacion)
 */

const { app, BrowserWindow, ipcMain, screen, protocol } = require('electron');
const path    = require('path');
const fs      = require('fs');
const https   = require('https');
const http    = require('http');
const { URL } = require('url');

// ── CONFIGURACIÓN ──────────────────────────────────────────────────────────────
const { loadConfig, saveConfig, buildPlaylistUrl } = require('./config');
let CONFIG = loadConfig();

// Directorio local donde se almacenan los videos descargados.
// Persiste entre actualizaciones de la aplicación.
const VIDEOS_DIR = path.join(app.getPath('userData'), 'videos');

// Ruta del archivo de log. Se rota automáticamente al superar MAX_LOG_BYTES.
const LOG_FILE   = path.join(app.getPath('userData'), 'piKioskoCliente.log');

// ── LOGGER ─────────────────────────────────────────────────────────────────────
// Escribe líneas con timestamp e indicador de nivel en LOG_FILE.
// Cuando el archivo supera 2 MB se renombra a .bak.log y se crea uno nuevo,
// manteniendo siempre el log actual manejable en tamaño.
const MAX_LOG_BYTES = 2 * 1024 * 1024; // 2 MB

function writeLog(level, msg) {
  try {
    const line = '[' + new Date().toISOString() + '] [' + level.padEnd(5) + '] ' + msg + '\n';
    if (fs.existsSync(LOG_FILE)) {
      const size = fs.statSync(LOG_FILE).size;
      if (size >= MAX_LOG_BYTES) {
        const bak = LOG_FILE.replace('.log', '.bak.log');
        if (fs.existsSync(bak)) fs.unlinkSync(bak);
        fs.renameSync(LOG_FILE, bak);
      }
    }
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) {
    // No interrumpir la app si el log falla (disco lleno, permisos, etc.)
    console.error('[LOGGER] No se pudo escribir el log:', e.message);
  }
}

// Redirigir console.log/warn/error al archivo de log además de la consola.
// Esto captura todos los mensajes del proceso principal sin modificar el código
// de cada módulo individualmente.
const _origLog   = console.log.bind(console);
const _origWarn  = console.warn.bind(console);
const _origError = console.error.bind(console);
console.log   = (...a) => { _origLog(...a);   writeLog('INFO',  a.join(' ')); };
console.warn  = (...a) => { _origWarn(...a);  writeLog('WARN',  a.join(' ')); };
console.error = (...a) => { _origError(...a); writeLog('ERROR', a.join(' ')); };

// ── GLOBALS ────────────────────────────────────────────────────────────────────
let mainWindow = null;

// En modo desarrollo (npm run dev o --dev) se desactiva el kiosco para poder
// redimensionar la ventana, usar DevTools y cerrar con Ctrl+Esc.
const isDev = process.argv.includes('--dev');

// ── DIRECTORIO DE VIDEOS ───────────────────────────────────────────────────────
function ensureVideosDir() {
  if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

// ── VENTANA PRINCIPAL ──────────────────────────────────────────────────────────
// Se crea en modo kiosco real (cuando no se pasa --dev): pantalla completa, sin borde,
// siempre encima de otras ventanas y sin responder a Alt+F4.
// El cierre se gestiona exclusivamente a través del botón ✕ de la app
// (IPC 'close-app' llama a mainWindow.destroy() y app.quit()).
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width, height,
    fullscreen:      true,
    frame:           false,
    kiosk:           !isDev,
    alwaysOnTop:     !isDev,
    backgroundColor: CONFIG.backgroundColor,
    icon:            path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration:  false,   // El renderer NO tiene acceso directo a Node.js
      contextIsolation: true,    // preload.js actúa como puente seguro
      preload:          path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // En modo desarrollo abrir DevTools automáticamente
  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  // En modo kiosco prevenir el cierre accidental (el evento se cancela;
  // el cierre real lo gestiona el IPC 'close-app' con mainWindow.destroy())
  mainWindow.on('close', (e) => { if (!isDev) e.preventDefault(); });
}

// ── DESCARGA DE ARCHIVO ────────────────────────────────────────────────────────
// Descarga url a destPath usando un archivo temporal (.tmp) para garantizar
// que no queden archivos corruptos si la descarga se interrumpe.
// Sigue redirecciones HTTP 301/302 automáticamente.
// Envía eventos 'download-progress' al renderer con el porcentaje completado.
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tmpPath = destPath + '.tmp';
    const file    = fs.createWriteStream(tmpPath);

    const doGet = (targetUrl) => {
      const prot = targetUrl.startsWith('https') ? https : http;
      const req  = prot.get(targetUrl, (res) => {
        // Seguir redirecciones
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          fs.unlink(tmpPath, () => {});
          return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(tmpPath, () => {});
          return reject(new Error(`HTTP ${res.statusCode} al descargar ${targetUrl}`));
        }

        const total      = parseInt(res.headers['content-length'], 10);
        let   received   = 0;

        res.on('data', (chunk) => {
          received += chunk.length;
          if (total && mainWindow) {
            mainWindow.webContents.send('download-progress', {
              url,
              percent:    Math.round((received / total) * 100),
              downloaded: received,
              total,
            });
          }
        });

        res.pipe(file);
        file.on('finish', () =>
          // Renombrar .tmp al destino final solo cuando la descarga es completa
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

// ── FETCH JSON DE PLAYLIST ─────────────────────────────────────────────────────
// Descarga y parsea el JSON devuelto por el API.
// La URL se construye en buildPlaylistUrl() con la fecha del día actual.
function fetchPlaylist(url) {
  return new Promise((resolve, reject) => {
    const prot = url.startsWith('https') ? https : http;
    prot.get(url, (res) => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try   { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON inválido: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

// ── SINCRONIZACIÓN DE VIDEOS ───────────────────────────────────────────────────
// Recibe el array JSON del API y:
//   1. Filtra los items con enabled === 0 (deshabilitados por el servidor)
//   2. Normaliza los campos al formato interno { id, name, url, filename, ... }
//      soportando tanto el formato del API pikiosko (url_path / file_name)
//      como un formato anterior (url / filename) para compatibilidad
//   3. Elimina del disco los archivos que ya no están en la lista
//   4. Descarga los archivos nuevos que aún no existen en caché
//   5. Devuelve la lista final con el campo localPath (file://) para el reproductor
async function syncVideos(playlist) {
  ensureVideosDir();

  // Paso 1 y 2: filtrar y normalizar
  const normalized = playlist
    .filter((item) => {
      if (item.enabled === 0 || item.enabled === false) {
        console.log(`[SYNC] Omitido (enabled:0): ${item.name || item.id}`);
        return false;
      }
      if (!item.url_path && !item.url && typeof item !== 'string') {
        console.warn(`[SYNC] Omitido (sin url_path ni url): ${item.name || item.id}`);
        return false;
      }
      return true;
    })
    .map((item, idx) => {
      if (typeof item === 'string') {
        // Formato C: array de URLs directas
        return {
          id:       String(idx),
          name:     item.split('/').pop() || `Video ${idx + 1}`,
          url:      item,
          filename: item.split('/').pop() || `video_${idx}.mp4`,
        };
      }
      // Formato A/B: objeto con campos del API pikiosko
      const url      = item.url_path || item.url || '';
      const filename = item.file_name || item.filename || url.split('/').pop() || `video_${idx}.mp4`;
      const name     = item.name || filename.replace(/\.[^.]+$/, '');
      return {
        id:          String(item.id || idx),
        name,        // nombre descriptivo (campo 'name' del API)
        url,         // URL de descarga (campo 'url_path' del API)
        filename,    // nombre del archivo en disco (campo 'file_name' del API)
        category:    item.category    || '',
        description: item.description || '',
        start_date:  item.start_date  || '',
        end_date:    item.end_date    || '',
      };
    });

  // Paso 3: eliminar archivos del disco que ya no están en la lista remota
  const existing     = fs.readdirSync(VIDEOS_DIR);
  const newFilenames = new Set(normalized.map((v) => v.filename));
  for (const f of existing) {
    if (!newFilenames.has(f)) {
      try {
        fs.unlinkSync(path.join(VIDEOS_DIR, f));
        console.log(`[SYNC] Eliminado del caché: ${f}`);
      } catch (e) {
        console.warn(`[SYNC] No se pudo eliminar ${f}: ${e.message}`);
      }
      if (mainWindow) mainWindow.webContents.send('video-deleted', f);
    }
  }

  // Paso 4: descargar los archivos que aún no están en caché
  const result = [];
  for (const video of normalized) {
    const destPath = path.join(VIDEOS_DIR, video.filename);
    if (!fs.existsSync(destPath)) {
      console.log(`[SYNC] Descargando: "${video.name}" (${video.filename})`);
      if (mainWindow) {
        mainWindow.webContents.send('sync-status', {
          status:   'downloading',
          filename: video.filename,
          name:     video.name,
        });
      }
      try {
        await downloadFile(video.url, destPath);
        console.log(`[SYNC] Descarga completa: ${video.filename}`);
      } catch (err) {
        console.error(`[SYNC] Error descargando ${video.filename}: ${err.message}`);
        if (mainWindow) {
          mainWindow.webContents.send('sync-status', {
            status:   'error',
            filename: video.filename,
            error:    err.message,
          });
        }
        continue; // saltar este archivo y continuar con el resto
      }
    } else {
      console.log(`[SYNC] En caché: ${video.filename}`);
    }

    // Paso 5: añadir al resultado con la ruta local para el reproductor
    result.push({
      ...video,
      localPath: `file://${destPath.replace(/\\/g, '/')}`,
    });
  }

  return result;
}

// ── MANEJADORES IPC ────────────────────────────────────────────────────────────

// Construye la URL del día actual, descarga el JSON y sincroniza los videos.
// El renderer llama a esto al arrancar y al terminar cada ciclo de reproducción.
ipcMain.handle('fetch-and-sync', async () => {
  try {
    if (mainWindow) mainWindow.webContents.send('sync-status', { status: 'fetching-json' });

    // buildPlaylistUrl genera la fecha del día en el momento del llamado
    const playlistUrl = buildPlaylistUrl(CONFIG);
    console.log(`[IPC] Consultando: ${playlistUrl}`);

    const raw = await fetchPlaylist(playlistUrl);

    // El API pikiosko devuelve un array directamente.
    // También se soportan { videos: [...] } y { data: [...] } por compatibilidad.
    let items = [];
    if (Array.isArray(raw)) {
      items = raw;
    } else if (raw && Array.isArray(raw.videos)) {
      items = raw.videos;
    } else if (raw && Array.isArray(raw.data)) {
      items = raw.data;
    } else {
      throw new Error('Formato de respuesta no reconocido (se esperaba un array JSON)');
    }

    console.log(`[IPC] ${items.length} items recibidos del servidor`);
    const videos = await syncVideos(items);
    return { ok: true, videos };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Devuelve la configuración activa al renderer, incluyendo la URL de vista previa
// generada con la fecha actual. Se usa para poblar el panel de ajustes.
ipcMain.handle('get-config', () => ({
  apiBaseUrl:         CONFIG.apiBaseUrl,
  screenId:           CONFIG.screenId,
  token:              CONFIG.token,
  mediaType:          CONFIG.mediaType,
  backgroundColor:    CONFIG.backgroundColor,
  backgroundImage:    CONFIG.backgroundImage,
  rawBackgroundImage: CONFIG._rawBackgroundImage || '',
  previewUrl:         buildPlaylistUrl(CONFIG),  // URL completa con fecha actual
  showName:           CONFIG.showName,
  showDescription:    CONFIG.showDescription,
  showProgress:       CONFIG.showProgress,
  startupDelay:       CONFIG.startupDelay,
  videosDir:          VIDEOS_DIR,
  confPath:           CONFIG._confPath,
}));

// Persiste los nuevos valores en piKioskoCliente.conf y recarga la configuración
// en memoria. Los cambios de URL/screen/token se aplican en la siguiente sync;
// los cambios de color/imagen se aplican inmediatamente en el renderer.
ipcMain.handle('save-config', (_, newValues) => {
  try {
    const confPath = saveConfig(newValues);
    CONFIG = loadConfig(); // recargar en memoria
    return { ok: true, confPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Permite al renderer escribir en el archivo de log del proceso principal.
// Se usa para registrar eventos de reproducción, errores de video, etc.
ipcMain.handle('write-log', (_, level, msg) => {
  writeLog(level, msg);
});

// Devuelve la ruta del archivo de log activo para mostrarla en el panel de ajustes.
ipcMain.handle('get-log-path', () => LOG_FILE);

// Cierra la aplicación desde el renderer.
// Se usa mainWindow.destroy() en lugar de mainWindow.close() porque en modo
// kiosco el evento 'close' tiene preventDefault(), lo que bloquea close().
// destroy() omite el evento y termina el proceso inmediatamente.
ipcMain.handle('close-app', () => {
  if (mainWindow) mainWindow.destroy();
  app.quit();
});

// ── CICLO DE VIDA DE LA APLICACIÓN ────────────────────────────────────────────
app.whenReady().then(() => {
  // Registrar el arranque en el log antes de cualquier otra operación
  writeLog('INFO', '──────────────────────────────────────────────────');
  writeLog('INFO', 'piKioskoCliente iniciando - v' + (require('../package.json').version || '?'));
  writeLog('INFO', 'Plataforma: ' + process.platform + ' ' + process.arch);
  writeLog('INFO', 'Node.js: ' + process.version);
  writeLog('INFO', 'Modo: ' + (isDev ? 'desarrollo' : 'kiosco'));
  writeLog('INFO', 'Config: ' + JSON.stringify({
    base:         CONFIG.apiBaseUrl,
    screen:       CONFIG.screenId,
    type:         CONFIG.mediaType,
    bg:           CONFIG.backgroundColor,
    startupDelay: CONFIG.startupDelay,
  }));

  // Registrar protocolo file:// para que el renderer pueda cargar videos e
  // imágenes desde el sistema de archivos local de forma segura
  protocol.interceptFileProtocol('file', (request, callback) => {
    const url     = request.url.replace(/^file:\/\//, '');
    const decoded = decodeURIComponent(url);
    callback({ path: decoded });
  });

  ensureVideosDir();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
