/**
 * config.js - piKioskoCliente
 *
 * Responsabilidades:
 *   - Localizar y leer el archivo piKioskoCliente.conf (formato KEY = value)
 *   - Exponer los valores de configuración al resto de la aplicación
 *   - Construir la URL de la playlist con la fecha del día actual
 *   - Guardar los cambios realizados desde el panel de ajustes
 *
 * Parámetros soportados en piKioskoCliente.conf:
 *
 *   API_BASE_URL     URL completa del endpoint del API, sin query params.
 *                    Ejemplo: https://mi-servidor.com/media/resources
 *                    Los parámetros ?type=&date=&screen=&token= se añaden
 *                    automáticamente en cada llamado.
 *
 *   SCREEN_ID        Identificador de esta pantalla (parámetro screen=).
 *
 *   TOKEN            Token de autenticación de la pantalla (parámetro token=).
 *
 *   MEDIA_TYPE       Tipo de contenido a solicitar: video | image | mixed
 *                    Determina el parámetro type= en la URL generada.
 *
 *   BACKGROUND_COLOR Color de fondo detrás del video y en la pantalla de carga.
 *                    Acepta cualquier valor CSS: #RRGGBB, rgb(), nombre, etc.
 *
 *   BACKGROUND_IMAGE Imagen de fondo opcional. Puede ser una ruta absoluta,
 *                    relativa al propio archivo .conf, o una URL http/https.
 *                    Dejar vacío para no usar imagen de fondo.
 *
 *   SHOW_NAME        Muestra el nombre del video en la esquina superior izquierda
 *                    durante 5 segundos al cambiar de video. true | false
 *
 *   SHOW_DESCRIPTION Muestra la descripcion del video junto al nombre.
 *                    Solo se muestra si SHOW_NAME tambien es true. true | false
 *
 *   SHOW_PROGRESS    Muestra la barra de progreso en el borde inferior
 *                    de la pantalla durante la reproduccion. true | false
 */

const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

// ── VALORES POR DEFECTO ────────────────────────────────────────────────────────
// Se usan cuando el archivo .conf no existe o no incluye algún parámetro.
const DEFAULTS = {
  API_BASE_URL:     'http://localhost:3000/media/resources',
  SCREEN_ID:        '',
  TOKEN:            '',
  MEDIA_TYPE:       'video',   // 'video' | 'image' | 'mixed'
  BACKGROUND_COLOR: '#000000',
  BACKGROUND_IMAGE: '',
  SHOW_NAME:        'true',   // 'true' | 'false'
  SHOW_DESCRIPTION: 'true',   // 'true' | 'false'
  SHOW_PROGRESS:    'true',   // 'true' | 'false'
};

// ── LOCALIZAR EL ARCHIVO .conf ─────────────────────────────────────────────────
// Se busca en cuatro ubicaciones en orden de prioridad. La primera que exista
// es la que se usa. La ruta resuelta se cachea para no repetir la búsqueda.
let _confPath = null;

function getConfPath() {
  if (_confPath) return _confPath;

  const filename   = 'piKioskoCliente.conf';
  const candidates = [
    // 1. Junto al ejecutable empaquetado (.exe en Windows, AppImage en Linux)
    path.join(path.dirname(process.execPath), filename),
    // 2. Directorio de trabajo actual (útil con "npm start" en desarrollo)
    path.join(process.cwd(), filename),
    // 3. Un nivel por encima de resources/ (estructura de electron-builder)
    path.join(app.getAppPath(), '..', filename),
    // 4. Raíz del paquete Electron (fallback final)
    path.join(app.getAppPath(), filename),
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      console.log(`[CONFIG] Archivo encontrado: ${c}`);
      _confPath = c;
      return _confPath;
    }
  }

  // Si no se encuentra, se usará el candidato de desarrollo para escritura
  _confPath = candidates[1];
  console.warn(`[CONFIG] Archivo no encontrado. Se creará en: ${_confPath}`);
  return _confPath;
}

// ── PARSEAR FORMATO KEY = VALUE ────────────────────────────────────────────────
// Ignora líneas vacías y las que comienzan con #.
// La clave se normaliza a mayúsculas; el valor se recorta de espacios.
function parseConf(raw) {
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key   = trimmed.slice(0, eqIdx).trim().toUpperCase();
    const value = trimmed.slice(eqIdx + 1).trim();
    result[key] = value;
  }
  return result;
}

// ── RESOLVER RUTA DE IMAGEN DE FONDO ──────────────────────────────────────────
// Convierte el valor crudo de BACKGROUND_IMAGE en una URL utilizable por el
// elemento <img> del renderer, que solo puede cargar file:// o http(s)://.
function resolveImagePath(imagePath, confDir) {
  if (!imagePath) return '';
  // URL remota: se devuelve tal cual
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  // Ruta absoluta: se convierte a file://
  if (path.isAbsolute(imagePath)) {
    return `file://${imagePath.replace(/\\/g, '/')}`;
  }
  // Ruta relativa: se resuelve contra el directorio del .conf
  return `file://${path.resolve(confDir, imagePath).replace(/\\/g, '/')}`;
}

// ── CONSTRUIR URL DE PLAYLIST (con fecha automática) ──────────────────────────
// Se llama en cada sincronización para que la fecha siempre corresponda al
// día actual en el momento del llamado, no al momento del arranque.
//
// Estructura de la URL resultante:
//   {API_BASE_URL}?type={MEDIA_TYPE}&date={AAAA-MM-DD}&screen={SCREEN_ID}&token={TOKEN}
//
// Ejemplo con los valores por defecto del servidor de prueba:
//   http://localhost:3000/media/resources?type=video&date=2026-05-16&screen=1&token=test
//
// Ejemplo:
//   https://mi-servidor.com/media/resources?type=video&date=2026-05-16&screen=pantalla1&token=abc123
function buildPlaylistUrl(conf) {
  const today = new Date();
  const date  = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');

  // Sanear la URL base: eliminar query params existentes y la barra final
  // para evitar duplicados si el usuario los incluyó por error en el .conf
  const base   = (conf.apiBaseUrl || DEFAULTS.API_BASE_URL)
                   .replace(/[?&].*$/, '')
                   .replace(/\/$/, '');
  const type   = conf.mediaType || DEFAULTS.MEDIA_TYPE;
  const screen = conf.screenId  || '';
  const token  = conf.token     || '';

  return `${base}?type=${type}&date=${date}&screen=${screen}&token=${token}`;
}

// ── CARGAR CONFIGURACIÓN ───────────────────────────────────────────────────────
// Lee el .conf, mapea los valores a un objeto tipado y resuelve la ruta de la
// imagen de fondo. El token se enmascara en el log por seguridad.
function loadConfig() {
  const confPath = getConfPath();
  const raw      = fs.existsSync(confPath) ? fs.readFileSync(confPath, 'utf8') : '';
  const parsed   = parseConf(raw);
  const confDir  = path.dirname(confPath);

  const conf = {
    apiBaseUrl:          parsed.API_BASE_URL     || DEFAULTS.API_BASE_URL,
    screenId:            parsed.SCREEN_ID        || DEFAULTS.SCREEN_ID,
    token:               parsed.TOKEN            || DEFAULTS.TOKEN,
    mediaType:           parsed.MEDIA_TYPE       || DEFAULTS.MEDIA_TYPE,
    backgroundColor:     parsed.BACKGROUND_COLOR || DEFAULTS.BACKGROUND_COLOR,
    backgroundImage:     '',
    _rawBackgroundImage: parsed.BACKGROUND_IMAGE || '',
    showName:        (parsed.SHOW_NAME        || DEFAULTS.SHOW_NAME)        !== 'false',
    showDescription: (parsed.SHOW_DESCRIPTION || DEFAULTS.SHOW_DESCRIPTION) !== 'false',
    showProgress:    (parsed.SHOW_PROGRESS    || DEFAULTS.SHOW_PROGRESS)    !== 'false',
    _confPath:       confPath,
  };

  if (conf._rawBackgroundImage) {
    conf.backgroundImage = resolveImagePath(conf._rawBackgroundImage, confDir);
  }

  console.log('[CONFIG] Cargada:', {
    apiBaseUrl:      conf.apiBaseUrl,
    screenId:        conf.screenId,
    token:           conf.token ? '***' : '(vacío)',
    mediaType:       conf.mediaType,
    backgroundColor: conf.backgroundColor,
    backgroundImage: conf._rawBackgroundImage || '(ninguna)',
    showName:        conf.showName,
    showDescription: conf.showDescription,
    showProgress:    conf.showProgress,
  });

  return conf;
}

// ── GUARDAR CONFIGURACIÓN ──────────────────────────────────────────────────────
// Reescribe el archivo .conf completo con los nuevos valores.
// Se llama desde el manejador IPC 'save-config' tras confirmar en el panel de ajustes.
// El archivo se regenera con comentarios actualizados en cada guardado.
function saveConfig(newValues) {
  const confPath = getConfPath();

  const lines = [
    '# ──────────────────────────────────────────────────────────────────────────────',
    '# piKioskoCliente.conf',
    `# Última modificación: ${new Date().toLocaleString()}`,
    '# ──────────────────────────────────────────────────────────────────────────────',
    '',
    '# URL del endpoint del API incluyendo el path completo, sin query params.',
    '# En cada sincronizacion se construye la URL completa agregando:',
    '#   ?type={MEDIA_TYPE}&date={AAAA-MM-DD}&screen={SCREEN_ID}&token={TOKEN}',
    '# Ejemplo: https://mi-servidor.com/media/resources',
    `API_BASE_URL = ${(newValues.apiBaseUrl || DEFAULTS.API_BASE_URL).trim()}`,
    '',
    '# Identificador único de esta pantalla (parámetro screen= en la URL).',
    `SCREEN_ID = ${(newValues.screenId || '').trim()}`,
    '',
    '# Token de autenticación asignado a esta pantalla (parámetro token= en la URL).',
    `TOKEN = ${(newValues.token || '').trim()}`,
    '',
    '# Tipo de contenido a solicitar al servidor.',
    '# Valores permitidos: video | image | mixed',
    `MEDIA_TYPE = ${(newValues.mediaType || DEFAULTS.MEDIA_TYPE).trim()}`,
    '',
    '# Color de fondo detrás del video y en la pantalla de carga.',
    '# Acepta cualquier valor CSS válido: #RRGGBB, rgb(), nombre de color, etc.',
    `BACKGROUND_COLOR = ${(newValues.backgroundColor || DEFAULTS.BACKGROUND_COLOR).trim()}`,
    '',
    '# Imagen de fondo opcional (se adapta con object-fit: cover).',
    '# Puede ser ruta absoluta, relativa a este archivo .conf, o URL http/https.',
    '# Dejar en blanco para no usar imagen de fondo.',
    `BACKGROUND_IMAGE = ${(newValues.backgroundImage || '').trim()}`,
    '',
    '# Muestra el nombre del video en la esquina superior izquierda durante 5 segundos.',
    '# Valores permitidos: true | false',
    `SHOW_NAME = ${String(newValues.showName !== false && newValues.showName !== 'false')}`,
    '',
    '# Muestra la descripcion del video junto al nombre (requiere SHOW_NAME = true).',
    '# Valores permitidos: true | false',
    `SHOW_DESCRIPTION = ${String(newValues.showDescription !== false && newValues.showDescription !== 'false')}`,
    '',
    '# Muestra la barra de progreso en el borde inferior de la pantalla.',
    '# Valores permitidos: true | false',
    `SHOW_PROGRESS = ${String(newValues.showProgress !== false && newValues.showProgress !== 'false')}`,
    '',
  ];

  fs.writeFileSync(confPath, lines.join('\n'), 'utf8');
  console.log(`[CONFIG] Guardada en: ${confPath}`);
  return confPath;
}

module.exports = { loadConfig, saveConfig, getConfPath, buildPlaylistUrl };
