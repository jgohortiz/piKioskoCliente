const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('piKiosko', {
  fetchAndSync:  ()         => ipcRenderer.invoke('fetch-and-sync'),
  getConfig:     ()         => ipcRenderer.invoke('get-config'),
  saveConfig:    (values)   => ipcRenderer.invoke('save-config', values),

  onSyncStatus:       (cb) => ipcRenderer.on('sync-status',       (_, d) => cb(d)),
  onDownloadProgress: (cb) => ipcRenderer.on('download-progress', (_, d) => cb(d)),
  onVideoDeleted:     (cb) => ipcRenderer.on('video-deleted',     (_, f) => cb(f)),
  removeListeners:    (ch) => ipcRenderer.removeAllListeners(ch),
  closeApp:           ()              => ipcRenderer.invoke('close-app'),
  writeLog:           (level, msg)   => ipcRenderer.invoke('write-log', level, msg),
  getLogPath:         ()              => ipcRenderer.invoke('get-log-path'),
});
