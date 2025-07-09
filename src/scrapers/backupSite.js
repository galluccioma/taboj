import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import cheerio from 'cheerio';
import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { stopFlag, launchBrowser } from '../utils/config';

puppeteer.use(StealthPlugin());
stopFlag.value = false;

/**
 * Sanitize a string to be a safe filename:
 * - Keep only alphanumeric, underscore, hyphen, space
 * - Replace spaces with underscore
 * - Limit to 100 chars
 */
function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_\- ]/gi, '').replace(/\s+/g, '_').slice(0, 100);
}

/**
 * Recursively parse sitemap URL(s) to extract all URLs
 * Supports sitemapindex and urlset formats
 */
async function getUrlsFromSitemap(sitemapUrl, win) {
  const res = await axios.get(sitemapUrl);
  const parser = new XMLParser();
  const parsed = parser.parse(res.data);

  if (parsed.sitemapindex) {
    let sitemaps = parsed.sitemapindex.sitemap;
    if (!Array.isArray(sitemaps)) {
      sitemaps = [sitemaps]; // Ensure sitemaps is always an array
    }
    let allUrls = [];

    for (const sm of sitemaps) {
      const subUrl = sm.loc;
      if (win?.webContents) win.webContents.send('status', `[info] Scarico sub-sitemap: ${subUrl}`);
      const subUrls = await getUrlsFromSitemap(subUrl, win);
      allUrls = allUrls.concat(subUrls);
    }
    return allUrls;
  }

  if (parsed.urlset) {
    const urlEntries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    const urls = urlEntries.map(u => ({
      loc: u.loc,
      sitemap: sitemapUrl,
    }));
    return urls;
  }

  return [];
}

/**
 * Download all media (images, videos) from a page's HTML into the media folder.
 * Logs each download attempt and result.
 */
async function downloadAllMediaFromHtml({ html, url, cleanTitle, mediaFolder, win }) {
  const $ = cheerio.load(html);
  // Download images
  const imgUrls = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:')) imgUrls.push(src);
  });
  // Download videos
  const videoUrls = [];
  $('video').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:')) videoUrls.push(src);
    // Also check <source> tags inside <video>
    $(el).find('source').each((__, sourceEl) => {
      const s = $(sourceEl).attr('src');
      if (s && !s.startsWith('data:')) videoUrls.push(s);
    });
  });
  const allMedia = [...imgUrls, ...videoUrls];
  const baseUrl = new URL(url);
  if (!fs.existsSync(mediaFolder)) fs.mkdirSync(mediaFolder, { recursive: true });
  if (allMedia.length === 0) {
    if (win?.webContents) win.webContents.send('status', `[media] Nessun media trovato nella pagina: ${url}`);
    console.log(`[media] Nessun media trovato nella pagina: ${url}`);
  }
  for (let i = 0; i < allMedia.length; i++) {
    let mediaUrl = allMedia[i];
    try {
      // Resolve relative URLs
      if (!/^https?:\/\//i.test(mediaUrl)) {
        mediaUrl = new URL(mediaUrl, baseUrl.origin).href;
      }
      const ext = path.extname(mediaUrl).split('?')[0] || '';
      const filename = `${sanitizeFilename(cleanTitle)}_${i}${ext}`;
      const filePath = path.join(mediaFolder, filename);
      if (win?.webContents) win.webContents.send('status', `[media] Downloading: ${mediaUrl} -> ${filePath}`);
      console.log(`[media] Downloading: ${mediaUrl} -> ${filePath}`);
      // Download and save
      const response = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 30000 });
      fs.writeFileSync(filePath, response.data);
      if (win?.webContents) win.webContents.send('status', `📥 Media salvato: ${filePath}`);
      console.log(`[media] Saved: ${filePath}`);
    } catch (err) {
      if (win?.webContents) win.webContents.send('status', `❌ Errore download media: ${mediaUrl} (${err.message})`);
      console.log(`[media] Errore download media: ${mediaUrl} (${err.message})`);
    }
  }
}

/**
 * Naviga la pagina, fa screenshot desktop + mobile, analizza contenuti,
 * salva CSV singolo e ritorna dati per CSV globale
 *
 * @param {string} url
 * @param {object} browser
 * @param {string} baseFolderPath
 * @param {object} win
 * @param {string} subFolderName
 * @param {boolean} downloadMedia - If true, download all media to media folder
 * @param {string} mediaFolder - Path to the media folder
 */
async function screenshotAndAnalyze(url, browser, baseFolderPath, win, subFolderName = '', downloadMedia = false, mediaFolder = '') {
  const page = await browser.newPage();

  // -- Screenshot desktop --
  await page.setViewport({ width: 1920, height: 1080 });
  const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  const status = response.status();

  const html = await page.content();
  const title = await page.title();
  const cleanTitle = sanitizeFilename(title);

  // Cartella destinazione
  let targetFolder = '';
  let pageFolder = '';
  let desktopScreenshotPath = '';
  let mobileScreenshotPath = '';
  if (baseFolderPath) {
    targetFolder = subFolderName
      ? path.join(baseFolderPath, sanitizeFilename(subFolderName))
      : baseFolderPath;
    pageFolder = path.join(targetFolder, cleanTitle);
    if (!fs.existsSync(pageFolder)) fs.mkdirSync(pageFolder, { recursive: true });
  }

  // Salva screenshot desktop
  if (baseFolderPath && win) {
    desktopScreenshotPath = path.join(pageFolder, `${cleanTitle}_desktop.png`);
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    win.webContents.send('status', `✅ Screenshot desktop salvato: ${desktopScreenshotPath}`);
  }

  // -- Screenshot mobile --
  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  if (baseFolderPath && win) {
    mobileScreenshotPath = path.join(pageFolder, `${cleanTitle}_mobile.png`);
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    win.webContents.send('status', `✅ Screenshot mobile salvato: ${mobileScreenshotPath}`);
  }

  // Parsing html (puoi usare quello desktop o ricaricare, qui uso html desktop)
  const $ = cheerio.load(html);

  // --- MEDIA DOWNLOAD LOGIC ---
  if (downloadMedia && mediaFolder) {
    await downloadAllMediaFromHtml({ html, url, cleanTitle, mediaFolder, win });
  }
  // --- END MEDIA DOWNLOAD LOGIC ---

  const metaTitle = title;
  const metaTitleLength = title.length;
  const description = $('meta[name="description"]').attr('content') || 'NO DESCRIPTION';
  const descriptionLength = description.length;
  const robots = $('meta[name="robots"]').attr('content') || 'NO ROBOTS';
  const keywords = $('meta[name="keywords"]').attr('content') || 'NO KEYWORDS';

  const headers = [];
  $('h1, h2, h3').each((_, el) => {
    const tag = $(el).get(0).tagName.toUpperCase();
    const text = $(el).text().trim();
    const len = text.length;
    headers.push(`${tag} "${text}" (${len} caratteri)`);
  });

  const tips = [];
  if (headers.length && !headers[0].startsWith('H1')) {
    tips.push('INFO: Il primo tag di intestazione dovrebbe essere H1');
  }
  const titoli = headers.concat(tips).join(' | ');

  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    images.push(`${src} [alt: ${alt}]`);
  });

  const internalLinks = [];
  const externalLinks = [];
  const baseUrl = new URL(url);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const linkUrl = new URL(href, baseUrl.origin);
      if (linkUrl.origin === baseUrl.origin) internalLinks.push(linkUrl.href);
      else externalLinks.push(linkUrl.href);
    } catch {
      // link non valido, ignoro
    }
  });

  const uniqueInternalLinks = [...new Set(internalLinks)];
  const uniqueExternalLinks = [...new Set(externalLinks)];

  const structuredData = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      structuredData.push(JSON.stringify(json));
    } catch {
      // json non valido, ignoro
    }
  });

  const ogTags = {};
  $('meta[property^="og:"], meta[name^="og:"], meta[name^="twitter:"], meta[property^="twitter:"]').each((_, el) => {
    const prop = $(el).attr('property') || $(el).attr('name');
    const content = $(el).attr('content');
    if (prop && content) ogTags[prop] = content;
  });

    // -- Rilevamento strumenti analitici --
    const analyticsTools = [];
    const pageContent = html.toLowerCase();
  
    if (pageContent.includes('googletagmanager.com/gtm.js') || pageContent.includes('gtag(')) analyticsTools.push('GA4');
    if (pageContent.includes('google-analytics.com/analytics.js') || pageContent.includes("ga('")) analyticsTools.push('Universal Analytics');
    if (pageContent.includes('clarity.ms')) analyticsTools.push('Clarity');
    if (
      pageContent.includes('matomo.js') ||
      pageContent.includes('piwik.js') ||
      pageContent.includes('matomo') ||
      pageContent.includes('_mtm') ||
      pageContent.includes('analytics.mediaserviceitalia.it')
    ) {
      analyticsTools.push('Matomo');
    }
    if (pageContent.includes('hotjar.com') || pageContent.includes('hjsv_')) analyticsTools.push('Hotjar');
    if (pageContent.includes('connect.facebook.net') || pageContent.includes('fbq(')) analyticsTools.push('Facebook Pixel');
  
    const analyticsSummary = analyticsTools.length ? analyticsTools.join(', ') : 'NESSUNO';
  
    // -- Rilevamento cookie banner --
    const cookieBanners = [];
    if (pageContent.includes('cookieyes.com') || html.includes('id="cookieyes"')) cookieBanners.push('CookieYes');
    if (pageContent.includes('consent.cookiebot.com') || html.includes('CookieConsent')) cookieBanners.push('CookieBot');
    if (pageContent.includes('cdn.iubenda.com') || pageContent.includes('iubenda')) cookieBanners.push('Iubenda');
    if (cookieBanners.length === 0) cookieBanners.push('NESSUNO');
  
    const cookieSummary = cookieBanners.join(', ');
  
    // -- Rilevamento CMS --
    let cms = 'NON RILEVATO';
    if (pageContent.includes('wp-content') || pageContent.includes('wp-includes')) cms = 'WordPress';
    if (pageContent.includes('woocommerce')) cms = 'WooCommerce';
    if (pageContent.includes('prestashop') || pageContent.includes('/modules/')) cms = 'PrestaShop';
  
  await page.close();

  const csvData = [{
    Url: url,
    'Status HTTP': status,
    'Meta title[length]': `${metaTitle} [${metaTitleLength}]`,
    'Description[length]': `${description} [${descriptionLength}]`,
    Keywords: keywords,
    robots,
    'Titoli [lenght e consigli]': titoli,
    'Immagini (src e alt)': images.join(' | '),
    'Link interni': uniqueInternalLinks.join(' | '),
    'Link esterni': uniqueExternalLinks.join(' | '),
    'Dati strutturati (JSON-LD)': structuredData.join(' | '),
    'Dati social (OG e Twitter)': JSON.stringify(ogTags),
    'Strumenti analitici': analyticsSummary,
    'Cookie banner': cookieSummary,
    'CMS rilevato': cms,
  }];

  const csvPath = baseFolderPath ? path.join(pageFolder, `${cleanTitle}.csv`) : '';
  if (baseFolderPath && win) {
    const csv = await converter.json2csv(csvData, {
      delimiter: ';',
      prependHeader: true,
      trimHeaderFields: true,
    });
    fs.writeFileSync(csvPath, csv, 'utf8');
    win.webContents.send('status', `📄 CSV salvato: ${csvPath}`);
  }

  // Add file paths to the returned data
  return {
    ...csvData[0],
    csvPath,
    desktopScreenshotPath,
    mobileScreenshotPath,
  };
}

async function analyzePageForGlobalCsv(url, browser, downloadMedia = false, mediaFolder = '', win = null) {
  const page = await browser.newPage();
  const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  const status = response ? response.status() : 'NO RESPONSE';
  const html = await page.content();
  const title = await page.title();
  const cleanTitle = sanitizeFilename(title);
  console.log('[DEBUG] analyzePageForGlobalCsv html length:', html.length, 'title:', title);

  // --- MEDIA DOWNLOAD LOGIC ---
  if (downloadMedia && mediaFolder) {
    await downloadAllMediaFromHtml({ html, url, cleanTitle, mediaFolder, win });
  }
  // --- END MEDIA DOWNLOAD LOGIC ---

  if (!html || !title) {
    console.error('[ERROR] Failed to load or parse page:', url);
    await page.close();
    return {
      Url: url,
      'Status HTTP': status,
      'Meta title[length]': '',
      'Description[length]': '',
      Keywords: '',
      robots: '',
      'Titoli [lenght e consigli]': '',
      'Immagini (src e alt)': '',
      'Link interni': '',
      'Link esterni': '',
      'Dati strutturati (JSON-LD)': '',
      'Dati social (OG e Twitter)': '',
    };
  }

  // Parsing html (copy from screenshotAndAnalyze, but skip screenshots and file writes)
  const $ = cheerio.load(html);

  const metaTitle = title;
  const metaTitleLength = title.length;
  const description = $('meta[name="description"]').attr('content') || 'NO DESCRIPTION';
  const descriptionLength = description.length;
  const robots = $('meta[name="robots"]').attr('content') || 'NO ROBOTS';
  const keywords = $('meta[name="keywords"]').attr('content') || 'NO KEYWORDS';

  const headers = [];
  $('h1, h2, h3').each((_, el) => {
    const tag = $(el).get(0).tagName.toUpperCase();
    const text = $(el).text().trim();
    const len = text.length;
    headers.push(`${tag} "${text}" (${len} caratteri)`);
  });

  const tips = [];
  if (headers.length && !headers[0].startsWith('H1')) {
    tips.push('INFO: Il primo tag di intestazione dovrebbe essere H1');
  }
  const titoli = headers.concat(tips).join(' | ');

  const images = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src') || '';
    const alt = $(el).attr('alt') || '';
    images.push(`${src} [alt: ${alt}]`);
  });

  const internalLinks = [];
  const externalLinks = [];
  const baseUrl = new URL(url);
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    try {
      const linkUrl = new URL(href, baseUrl.origin);
      if (linkUrl.origin === baseUrl.origin) internalLinks.push(linkUrl.href);
      else externalLinks.push(linkUrl.href);
    } catch {
      // link non valido, ignoro
    }
  });

  const uniqueInternalLinks = [...new Set(internalLinks)];
  const uniqueExternalLinks = [...new Set(externalLinks)];

  const structuredData = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html());
      structuredData.push(JSON.stringify(json));
    } catch {
      // json non valido, ignoro
    }
  });

  const ogTags = {};
  $('meta[property^="og:"], meta[name^="og:"], meta[name^="twitter:"], meta[property^="twitter:"]').each((_, el) => {
    const prop = $(el).attr('property') || $(el).attr('name');
    const content = $(el).attr('content');
    if (prop && content) ogTags[prop] = content;
  });

  // -- Rilevamento strumenti analitici --
  const analyticsTools = [];
  const pageContent = html.toLowerCase();
  if (pageContent.includes('googletagmanager.com/gtm.js') || pageContent.includes('gtag(')) analyticsTools.push('GA4');
  if (pageContent.includes('google-analytics.com/analytics.js') || pageContent.includes("ga('")) analyticsTools.push('Universal Analytics');
  if (pageContent.includes('clarity.ms')) analyticsTools.push('Clarity');
  if (
    pageContent.includes('matomo.js') ||
    pageContent.includes('piwik.js') ||
    pageContent.includes('matomo') ||
    pageContent.includes('_mtm') ||
    pageContent.includes('analytics.mediaserviceitalia.it')
  ) {
    analyticsTools.push('Matomo');
  }
  if (pageContent.includes('hotjar.com') || pageContent.includes('hjsv_')) analyticsTools.push('Hotjar');
  if (pageContent.includes('connect.facebook.net') || pageContent.includes('fbq(')) analyticsTools.push('Facebook Pixel');
  const analyticsSummary = analyticsTools.length ? analyticsTools.join(', ') : 'NESSUNO';

  // -- Rilevamento cookie banner --
  const cookieBanners = [];
  if (pageContent.includes('cookieyes.com') || html.includes('id="cookieyes"')) cookieBanners.push('CookieYes');
  if (pageContent.includes('consent.cookiebot.com') || html.includes('CookieConsent')) cookieBanners.push('CookieBot');
  if (pageContent.includes('cdn.iubenda.com') || pageContent.includes('iubenda')) cookieBanners.push('Iubenda');
  if (cookieBanners.length === 0) cookieBanners.push('NESSUNO');
  const cookieSummary = cookieBanners.join(', ');

  // -- Rilevamento CMS --
  let cms = 'NON RILEVATO';
  if (pageContent.includes('wp-content') || pageContent.includes('wp-includes')) cms = 'WordPress';
  if (pageContent.includes('woocommerce')) cms = 'WooCommerce';
  if (pageContent.includes('prestashop') || pageContent.includes('/modules/')) cms = 'PrestaShop';

  await page.close();

  const result = {
    Url: url,
    'Status HTTP': status,
    'Meta title[length]': `${metaTitle} [${metaTitleLength}]`,
    'Description[length]': `${description} [${descriptionLength}]`,
    Keywords: keywords,
    robots,
    'Titoli [lenght e consigli]': titoli,
    'Immagini (src e alt)': images.join(' | '),
    'Link interni': uniqueInternalLinks.join(' | '),
    'Link esterni': uniqueExternalLinks.join(' | '),
    'Dati strutturati (JSON-LD)': structuredData.join(' | '),
    'Dati social (OG e Twitter)': JSON.stringify(ogTags),
    'Strumenti analitici': analyticsSummary,
    'Cookie banner': cookieSummary,
    'CMS rilevato': cms,
  };
  return result;
}

/**
 * Funzione principale:
 * - scarica sitemap, estrae URL
 * - per ogni URL chiama screenshotAndAnalyze (che salva CSV singolo)
 * - accumula dati per creare CSV globale alla fine
 *
 * @param {string} searchString
 * @param {string} folderPath
 * @param {object} win
 * @param {boolean} headless
 * @param {boolean} useProxy
 * @param {string} customProxy
 * @param {boolean} fullBackup
 * @param {boolean} downloadMedia - If true, download all media to media folder
 */
export async function performBackupSite(searchString, folderPath, win, headless = true, useProxy = false, customProxy = '', fullBackup = true, downloadMedia = false) {
  console.log('[DEBUG] fullBackup (backend):', fullBackup, typeof fullBackup);
  // Use base output folder if none provided
  let outputFolderPath = folderPath;
  if (!outputFolderPath) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output'));
    outputFolderPath = path.join(baseOutput, 'backup');
    win.webContents.send('status', `[INFO] i file saranno salvati nella cartella: ${outputFolderPath}`);  
  }
  // Sanitize the searchString for filename/folder use
  const sanitizedQuery = searchString ? sanitizeFilename(searchString) : 'global';
  // Append the sanitized query to the outputFolderPath
  outputFolderPath = path.join(outputFolderPath, sanitizedQuery);
  // Force to boolean if string
  let isFullBackup = fullBackup;
  if (typeof isFullBackup === 'string') {
    isFullBackup = isFullBackup === 'true';
  }
  console.log('[DEBUG] fullBackup (backend, coerced):', isFullBackup, typeof isFullBackup);
  if (win?.webContents) win.webContents.send('reset-logs');
  if (!fs.existsSync(outputFolderPath)) fs.mkdirSync(outputFolderPath, { recursive: true });

  const mediaFolder = path.join(outputFolderPath, 'media');

  try {
    let urlsWithSitemap;
    if (searchString.trim().endsWith('.xml')) {
      urlsWithSitemap = await getUrlsFromSitemap(searchString, win);
    } else {
      // Support multiple URLs separated by comma
      const urls = searchString.split(',').map(u => u.trim()).filter(Boolean);
      urlsWithSitemap = urls.map(u => ({ loc: u, sitemap: u }));
      if (win?.webContents) win.webContents.send('status', `[info] Analisi pagine: ${urls.join(', ')}`);
    }
    if (win?.webContents) win.webContents.send('status', `[info] Trovati ${urlsWithSitemap.length} URL.`);

    let proxyToUse = null;
    if (useProxy) proxyToUse = customProxy;

    const browser = await launchBrowser({ headless, proxy: proxyToUse, defaultViewport: null });

    const allCsvData = [];

    for (const { loc, sitemap } of urlsWithSitemap) {
      if (stopFlag.value) {
        if (win?.webContents) win.webContents.send('status', '[STOP] Scraping interrotto dall\'utente.');
        break;
      }
      try {
        const sitemapName = path.basename(sitemap, '.xml');
        let data;
        if (isFullBackup) {
          if (win?.webContents) win.webContents.send('status', `[progress] Backup completo: ${loc}`);
          data = await screenshotAndAnalyze(loc, browser, outputFolderPath, win, sitemapName, downloadMedia, mediaFolder);
        } else {
          if (win?.webContents) win.webContents.send('status', `[progress] Analisi pagina: ${loc}`);
          data = await analyzePageForGlobalCsv(loc, browser, downloadMedia, mediaFolder, win);
        }
        allCsvData.push(data);
      } catch (err) {
        if (win?.webContents) win.webContents.send('status', `❌ Errore su ${loc}: ${err.message}`);
      }
    }

    await browser.close();

    // Salva CSV globale nel root folder
    const globalCsv = await converter.json2csv(allCsvData, {
      delimiter: ';',
      prependHeader: true,
      trimHeaderFields: true,
    });
    const globalCsvName = `${sanitizedQuery}+seo_backup.csv`;
    const globalCsvPath = path.join(outputFolderPath, globalCsvName);
    fs.writeFileSync(globalCsvPath, globalCsv, 'utf8');

    if (win?.webContents) {
      win.webContents.send('status', `🧾 CSV globale salvato: ${globalCsvPath}`);
      win.webContents.send('status', '🧾 Tutti i report singoli sono stati salvati.');
      // Send all per-page data to the renderer
      win.webContents.send('backup-data', allCsvData);
      // Also send the folder path for UI actions
      win.webContents.send('backup-folder', outputFolderPath);
    }
  } catch (err) {
    if (win?.webContents) win.webContents.send('status', `[errore] ${err.message}`);
  }
}
