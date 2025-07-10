// Native
import path, { join } from 'path';
import os from 'os';
import fs from 'fs';
import windowStateKeeper from 'electron-window-state';
import { parse } from 'csv-parse/sync';

// Packages
import { BrowserWindow, app, ipcMain, IpcMainEvent, nativeTheme, dialog, shell } from 'electron';
import isDev from 'electron-is-dev';
import { stopFlag } from '../src/utils/config';
import { performMapsScraping } from '../src/scrapers/mapsScraping.js';
import { performDnsScraping } from '../src/scrapers/dnsScraping.js';
import { performFaqScraping } from '../src/scrapers/askScraping.js';
import { performBackupSite } from '../src/scrapers/backupSite.js';
import performGoogleAdsScraping from '../src/scrapers/googleAds.js';
import performMetaAdsScraping from '../src/scrapers/metaAds.js';


function createWindow() {
  // Recupera lo stato precedente della finestra o imposta i default
  const mainWindowState = windowStateKeeper({
    defaultWidth: 800,
    defaultHeight: 600
  });

  const window = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    // altre opzioni...
    frame: false,
    resizable: true,
    fullscreenable: true,
    webPreferences: {
      preload: join(__dirname, 'preload.js')
    }
  });

  // Associa lo stato alla finestra
  mainWindowState.manage(window);

  // Resto del tuo codice...
  const port = process.env.PORT || 3000;
  const url = isDev
    ? `http://localhost:${port}`
    : join(__dirname, '../dist-vite/index.html');

  if (isDev) {
    window.loadURL(url);
  } else {
    window.loadFile(url);
  }
  // Open the DevTools.
  // window.webContents.openDevTools();

  // For AppBar
  ipcMain.on('minimize', () => {
    // eslint-disable-next-line no-unused-expressions
    window.isMinimized() ? window.restore() : window.minimize();
    // or alternatively: win.isVisible() ? win.hide() : win.show()
  });
  ipcMain.on('maximize', () => {
    // eslint-disable-next-line no-unused-expressions
    window.isMaximized() ? window.restore() : window.maximize();
  });

  ipcMain.on('close', () => {
    window.close();
  });

  nativeTheme.themeSource = 'dark';
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

// listen the channel `message` and resend the received message to the renderer process
ipcMain.on('message', (event: IpcMainEvent, message: any) => {
  console.log(message);
  setTimeout(() => event.sender.send('message', 'common.hiElectron'), 500);
});

// IPC per inviare il nome utente
ipcMain.handle('get-username', async () => {
  return os.userInfo().username;
});

// IPC handler for 'choose-folder' to open a folder dialog
ipcMain.handle('choose-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('choose-file', async (_event, options) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: options && options.filters ? options.filters : undefined
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.on('stop-scraping', () => {
  stopFlag.value = true;
});

// Funzione per eseguire lo scraping
async function performScraping(
  searchString: string,
  scrapingType: string,
  folderPath: string,
  win: BrowserWindow,
  options: any = {}
) {
  if (scrapingType === 'maps') {
    const { headless, useProxy, customProxy } = options;
    await performMapsScraping(searchString, folderPath, win, headless, useProxy, customProxy);
  } else if (scrapingType === 'faq') {
    const { headless, scrapeTypes, useProxy, customProxy, maxToProcess } = options;
    await performFaqScraping(searchString, folderPath, win, headless, useProxy, customProxy, maxToProcess, scrapeTypes);
  } else if (scrapingType === 'dns') {
    const { dnsRecordTypes, doAMail, doLighthouse, doWayback } = options;
    await performDnsScraping(searchString, folderPath, win, dnsRecordTypes || [], doAMail, doLighthouse, doWayback);
  } else if (scrapingType === 'backup') {
    const { headless, useProxy, customProxy, fullBackup, downloadMedia } = options;
    if (typeof useProxy === 'boolean' && typeof customProxy === 'string' && typeof fullBackup === 'boolean') {
      await performBackupSite(searchString, folderPath, win, headless, useProxy, customProxy, fullBackup, downloadMedia);
    } else {
      await performBackupSite(searchString, folderPath, win, headless);
    }
  } else if (scrapingType === 'googleads') {
    const { headless, useProxy, customProxy, googleKeyFilePath } = options;
    await performGoogleAdsScraping(searchString, folderPath, win, headless, useProxy, customProxy, googleKeyFilePath);
  } else if (scrapingType === 'metaads') {
    const { headless, useProxy, customProxy, metaAdsAccessToken } = options;
    await performMetaAdsScraping(searchString, folderPath, win, headless, useProxy, customProxy, metaAdsAccessToken);
  } else {
    win.webContents.send('status', 'Tipo di scraping non valido.');
  }
}

// Gestisci l'evento per avviare lo scraping tramite IPC (Inter-Process Communication)
ipcMain.handle(
  'start-scraping',
  async (_event, ...args) => {
    console.log('Avvio dello scraping per:', args);
    const win = BrowserWindow.getAllWindows()[0];
    const scrapingType = args[1];
    if (scrapingType === 'faq') {
      // Restore positional argument passing for FAQ
      const [searchString, , folderPath, headless, scrapeTypes, useProxy, customProxy, maxToProcess] = args;
      await performFaqScraping(searchString, folderPath, win, headless, useProxy, customProxy, maxToProcess, scrapeTypes);
    } else if (scrapingType === 'maps') {
      const [searchString, , folderPath, headless, useProxy, customProxy] = args;
      await performScraping(searchString, scrapingType, folderPath, win, { headless, useProxy, customProxy });
    } else if (scrapingType === 'dns') {
      const [searchString, , folderPath, , dnsRecordTypes, doAMail, doLighthouse, doWayback] = args;
      await performScraping(searchString, scrapingType, folderPath, win, { dnsRecordTypes, doAMail, doLighthouse, doWayback });
    } else if (scrapingType === 'backup') {
      const [searchString, , folderPath, headless, useProxy, customProxy, fullBackup, downloadMedia] = args;
      await performScraping(searchString, scrapingType, folderPath, win, { headless, useProxy, customProxy, fullBackup, downloadMedia });
    } else if (scrapingType === 'googleads') {
      const [advertiser, , folderPath, headless, useProxy, customProxy, googleKeyFilePath] = args;
      await performScraping(advertiser, scrapingType, folderPath, win, { headless, useProxy, customProxy, googleKeyFilePath });
    } else if (scrapingType === 'metaads') {
      const [searchString, , folderPath, headless, useProxy, customProxy, metaAdsAccessToken] = args;
      await performScraping(searchString, scrapingType, folderPath, win, { headless, useProxy, customProxy, metaAdsAccessToken });
    } else {
      win.webContents.send('status', 'Tipo di scraping non valido.');
    }
  }
);

// IPC handler to delete backup files for a page
ipcMain.handle('delete-backup-files', async (_event, filePaths: string[]) => {
  try {
    for (const file of filePaths) {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    return { success: true };
  } catch (err) {
    let errorMsg = 'Unknown error';
    if (err instanceof Error) errorMsg = err.message;
    else if (typeof err === 'object' && err && 'message' in err) errorMsg = String((err as any).message);
    return { success: false, error: errorMsg };
  }
});

// IPC: List all CSV files in output/backup
ipcMain.handle('list-backup-csv-files', async () => {
  const baseOutput = ((global as any).getBaseOutputFolder ? (global as any).getBaseOutputFolder() : path.join(process.cwd(), 'output'));
  const backupDir = path.join(baseOutput, 'backup');
  if (!fs.existsSync(backupDir)) return [];
  return fs.readdirSync(backupDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(backupDir, f));
});

// IPC: Read a CSV file and return the first row as an object
ipcMain.handle('read-backup-csv', async (_event, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
    quote: '"',
    relax_quotes: true
  });
  return records || [];
});

// IPC: List all CSV files in output/faq
ipcMain.handle('list-faq-csv-files', async () => {
  const baseOutput = ((global as any).getBaseOutputFolder ? (global as any).getBaseOutputFolder() : path.join(process.cwd(), 'output'));
  const faqDir = path.join(baseOutput, 'faq');
  if (!fs.existsSync(faqDir)) return [];
  return fs.readdirSync(faqDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(faqDir, f));
});

// IPC: Read a CSV file and return all records
ipcMain.handle('read-faq-csv', async (_event, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
    quote: '"',
    relax_quotes: true
  });
  return records || [];
});

// IPC: Delete FAQ CSV files
ipcMain.handle('delete-faq-csv-files', async (_event, filePaths) => {
  try {
    for (const file of filePaths) {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    return { success: true };
  } catch (err) {
    let errorMsg = 'Unknown error';
    if (err instanceof Error) errorMsg = err.message;
    else if (typeof err === 'object' && err && 'message' in err) errorMsg = String((err as any).message);
    return { success: false, error: errorMsg };
  }
});

// IPC: List all CSV files in output/dns
ipcMain.handle('list-dns-csv-files', async () => {
  const baseOutput = ((global as any).getBaseOutputFolder ? (global as any).getBaseOutputFolder() : path.join(process.cwd(), 'output'));
  const dnsDir = path.join(baseOutput, 'dns');
  if (!fs.existsSync(dnsDir)) return [];
  return fs.readdirSync(dnsDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(dnsDir, f));
});

// IPC: Read a CSV file and return the first row as an object (DNS)
ipcMain.handle('read-dns-csv', async (_event, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
    quote: '"',
    relax_quotes: true
  });
  return records || [];
});

// IPC: Delete DNS CSV files
ipcMain.handle('delete-dns-csv-files', async (_event, filePaths) => {
  try {
    for (const file of filePaths) {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    return { success: true };
  } catch (err) {
    let errorMsg = 'Unknown error';
    if (err instanceof Error) errorMsg = err.message;
    else if (typeof err === 'object' && err && 'message' in err) errorMsg = String((err as any).message);
    return { success: false, error: errorMsg };
  }
});

// IPC: List all CSV files in output/maps
ipcMain.handle('list-maps-csv-files', async () => {
  const baseOutput = ((global as any).getBaseOutputFolder ? (global as any).getBaseOutputFolder() : path.join(process.cwd(), 'output'));
  const mapsDir = path.join(baseOutput, 'maps');
  if (!fs.existsSync(mapsDir)) return [];
  return fs.readdirSync(mapsDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(mapsDir, f));
});

// IPC: Read a CSV file and return all records
ipcMain.handle('read-maps-csv', async (_event, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
    quote: '"',
    relax_quotes: true
  });
  return records || [];
});

// IPC: Delete Maps CSV files
ipcMain.handle('delete-maps-csv-files', async (_event, filePaths) => {
  try {
    for (const file of filePaths) {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    return { success: true };
  } catch (err) {
    let errorMsg = 'Unknown error';
    if (err instanceof Error) errorMsg = err.message;
    else if (typeof err === 'object' && err && 'message' in err) errorMsg = String((err as any).message);
    return { success: false, error: errorMsg };
  }
});

// IPC: List all CSV files in output/googleads
ipcMain.handle('list-googleads-csv-files', async () => {
  const baseOutput = ((global as any).getBaseOutputFolder ? (global as any).getBaseOutputFolder() : path.join(process.cwd(), 'output'));
  const googleAdsDir = path.join(baseOutput, 'googleads');
  if (!fs.existsSync(googleAdsDir)) return [];
  return fs.readdirSync(googleAdsDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(googleAdsDir, f));
});

// IPC: Read a CSV file and return all records (Google Ads)
ipcMain.handle('read-googleads-csv', async (_event, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
    quote: '"',
    relax_quotes: true
  });
  return records || [];
});

// IPC: Delete Google Ads CSV files
ipcMain.handle('delete-googleads-csv-files', async (_event, filePaths) => {
  try {
    for (const file of filePaths) {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    return { success: true };
  } catch (err) {
    let errorMsg = 'Unknown error';
    if (err instanceof Error) errorMsg = err.message;
    else if (typeof err === 'object' && err && 'message' in err) errorMsg = String((err as any).message);
    return { success: false, error: errorMsg };
  }
});

// IPC: List all CSV files in output/metaads
ipcMain.handle('list-metaads-csv-files', async () => {
  const baseOutput = ((global as any).getBaseOutputFolder ? (global as any).getBaseOutputFolder() : path.join(process.cwd(), 'output'));
  const metaAdsDir = path.join(baseOutput, 'metaads');
  if (!fs.existsSync(metaAdsDir)) return [];
  return fs.readdirSync(metaAdsDir)
    .filter(f => f.endsWith('.csv'))
    .map(f => path.join(metaAdsDir, f));
});

// IPC: Read a CSV file and return all records (Meta Ads)
ipcMain.handle('read-metaads-csv', async (_event, filePath) => {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    delimiter: ',',
    quote: '"',
    relax_quotes: true
  });
  return records || [];
});

// IPC: Delete Meta Ads CSV files
ipcMain.handle('delete-metaads-csv-files', async (_event, filePaths) => {
  try {
    for (const file of filePaths) {
      if (file && fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
    return { success: true };
  } catch (err) {
    let errorMsg = 'Unknown error';
    if (err instanceof Error) errorMsg = err.message;
    else if (typeof err === 'object' && err && 'message' in err) errorMsg = String((err as any).message);
    return { success: false, error: errorMsg };
  }
});

const configPath = path.join(app.getPath('userData'), 'config.json');
function getBaseOutputFolder() {
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.baseOutputFolder) return config.baseOutputFolder;
    } catch {}
  }
  return path.join(process.cwd(), 'output');
}
(global as any).getBaseOutputFolder = getBaseOutputFolder;
function setBaseOutputFolder(folder: string) {
  let config: any = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {}
  }
  config.baseOutputFolder = folder;
  fs.mkdirSync(path.dirname(configPath), { recursive: true }); // Ensure directory exists
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// IPC: Get base output folder
ipcMain.handle('get-base-output-folder', async () => {
  return getBaseOutputFolder();
});

// IPC: Set base output folder
ipcMain.handle('set-base-output-folder', async (_event, folder) => {
  setBaseOutputFolder(folder);
  return true;
});

// IPC: List all backup folders and their files in output/backup
ipcMain.handle('list-backup-folders', async () => {
  const baseOutput = ((global as any).getBaseOutputFolder ? (global as any).getBaseOutputFolder() : path.join(process.cwd(), 'output'));
  const backupDir = path.join(baseOutput, 'backup');
  if (!fs.existsSync(backupDir)) return [];
  const folders = fs.readdirSync(backupDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  const result = folders.map(folder => {
    const folderPath = path.join(backupDir, folder);
    const files = fs.readdirSync(folderPath);
    return { folder, folderPath, files };
  });
  return result;
});

// Helper to delete a folder recursively
function deleteFolderRecursive(folderPath: string) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const curPath = path.join(folderPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(folderPath);
  }
}

ipcMain.handle('delete-backup-folder', async (_event, folderPath: string) => {
  try {
    deleteFolderRecursive(folderPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Open backup folder
ipcMain.handle('open-backup-folder', async (_event, folderPath: string) => {
  try {
    await shell.openPath(folderPath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
