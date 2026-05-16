/**
 * config.js — piKioskoCliente
 * Lee, parsea y guarda piKioskoCliente.conf desde el directorio del ejecutable.
 */

const fs   = require('fs');
const path = require('path');
const { app } = require('electron');

// ── VALORES POR DEFECTO ────────────────────────────────────────────────────────
const DEFAULTS = {
  PLAYLIST_URL:     'http://localhost:3000/playlist.json',
  BACKGROUND_COLOR: '#000000',
  BACKGROUND_IMAGE: '',
};

// ── BUSCAR EL ARCHIVO .conf ────────────────────────────────────────────────────
let _confPath = null;
function getConfPath() {
  if (_confPath) return _confPath;
  const filename   = 'piKioskoCliente.conf';
  const candidates = [
    path.join(path.dirname(process.execPath), filename),
    path.join(process.cwd(), filename),
    path.join(app.getAppPath(), '..', filename),
    path.join(app.getAppPath(), filename),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      console.log(`[CONFIG] Usando: ${c}`);
      _confPath = c;
      return _confPath;
    }
  }
  _confPath = candidates[1]; // dev fallback
  console.warn(`[CONFIG] No encontrado. Se usará: ${_confPath}`);
  return _confPath;
}

// ── PARSEAR FORMATO KEY = VALUE ────────────────────────────────────────────────
function parseConf(raw) {
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    result[trimmed.slice(0, eqIdx).trim().toUpperCase()] = trimmed.slice(eqIdx + 1).trim();
  }
  return result;
}

// ── RESOLVER RUTA DE IMAGEN ────────────────────────────────────────────────────
function resolveImagePath(imagePath, confDir) {
  if (!imagePath) return '';
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  if (path.isAbsolute(imagePath)) return `file://${imagePath.replace(/\\/g, '/')}`;
  return `file://${path.resolve(confDir, imagePath).replace(/\\/g, '/')}`;
}

// ── CARGAR CONFIGURACIÓN ───────────────────────────────────────────────────────
function loadConfig() {
  const confPath = getConfPath();
  const raw      = fs.existsSync(confPath) ? fs.readFileSync(confPath, 'utf8') : '';
  const parsed   = parseConf(raw);
  const confDir  = path.dirname(confPath);

  const conf = {
    playlistUrl:          parsed.PLAYLIST_URL     || DEFAULTS.PLAYLIST_URL,
    backgroundColor:      parsed.BACKGROUND_COLOR || DEFAULTS.BACKGROUND_COLOR,
    backgroundImage:      '',
    _rawBackgroundImage:  parsed.BACKGROUND_IMAGE || '',
    _confPath:            confPath,
  };

  if (conf._rawBackgroundImage) {
    conf.backgroundImage = resolveImagePath(conf._rawBackgroundImage, confDir);
  }

  console.log('[CONFIG] Cargada:', conf);
  return conf;
}

// ── GUARDAR CONFIGURACIÓN ──────────────────────────────────────────────────────
// newValues: { playlistUrl, backgroundColor, backgroundImage (raw string) }
function saveConfig(newValues) {
  const confPath = getConfPath();
  const lines = [
    '# ──────────────────────────────────────────────────────────────────────────────',
    '# piKioskoCliente.conf',
    `# Última modificación: ${new Date().toLocaleString()}`,
    '# ──────────────────────────────────────────────────────────────────────────────',
    '',
    '# URL del JSON con la lista de videos a reproducir.',
    `PLAYLIST_URL = ${(newValues.playlistUrl || DEFAULTS.PLAYLIST_URL).trim()}`,
    '',
    '# Color de fondo (CSS válido: #RRGGBB, rgb(), nombre de color, etc.)',
    `BACKGROUND_COLOR = ${(newValues.backgroundColor || DEFAULTS.BACKGROUND_COLOR).trim()}`,
    '',
    '# Imagen de fondo opcional (ruta absoluta, relativa al .conf, o URL http/https).',
    '# Dejar en blanco para no usar imagen de fondo.',
    `BACKGROUND_IMAGE = ${(newValues.backgroundImage || '').trim()}`,
    '',
  ];
  fs.writeFileSync(confPath, lines.join('\n'), 'utf8');
  console.log(`[CONFIG] Guardada en: ${confPath}`);
  return confPath;
}

module.exports = { loadConfig, saveConfig, getConfPath };
