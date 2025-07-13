// Funzione helper per inviare messaggi IPC in modo sicuro
// Previene l'errore "Object has been destroyed" quando la finestra è chiusa

export function safeSendMessage(win, channel, ...args) {
  if (win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
    try {
      win.webContents.send(channel, ...args);
    } catch (error) {
      console.log(`Errore nell'invio del messaggio ${channel}:`, error);
    }
  }
}

// Funzione helper per controllare se la finestra è ancora valida
export function isWindowValid(win) {
  return win && !win.isDestroyed() && win.webContents && !win.webContents.isDestroyed();
}

// Funzione per sanitizzare i nomi file
export function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9_\- ]/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 100);
} 