// ../src/scrapers/backupSite.js
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import cheerio from 'cheerio';
import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { stopFlag, launchBrowser } from '../utils/config';
import { safeSendMessage } from '../utils/safeWindow.js';
import { Document, Packer, Paragraph, TextRun } from 'docx';


puppeteer.use(StealthPlugin());
stopFlag.value = false;

// ---------- Utils ----------
function sanitizeFilename(str) {
  return String(str || '').replace(/[^a-z0-9_\- ]/gi, '').replace(/\s+/g, '_').slice(0, 100);
}

function extractVisibleText(html) {
  const $ = cheerio.load(html || '');
  $('script, style, noscript').remove();
  let text = $('body').text();
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

function getBodyPlainText(html) {
  const $ = cheerio.load(String(html || ''), { decodeEntities: true });

  // Rimuovi elementi non testuali o di contorno
  $('script, style, noscript, svg, iframe, header, footer, nav, aside, template').remove();
  $('pre, code').remove(); // evita blocchi codice
  // Elementi nascosti più comuni
  $('[hidden], [aria-hidden="true"]').remove();
  $('[style*="display:none"], [style*="visibility:hidden"]').remove();
  $('.visually-hidden, .sr-only').remove();

  // Scegli contenitore principale
  let $root = $('main').first();
  if (!$root.length) $root = $('article').first();
  if (!$root.length) $root = $('#content, .content').first();
  if (!$root.length) $root = $('body');

  // Raccogli solo text-node (niente tag) e normalizza
  const lines = [];
  $root.find('*').contents().each(function () {
    // this.type === 'text' per cheerio 1.x
    if (this.type === 'text') {
      const t = $(this)
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      if (t) lines.push(t);
    }
  });

  // Unisci, rimuovi spazi doppi e righe duplicate adiacenti
  let out = lines.join('\n');
  out = out
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, arr) => l && (i === 0 || l !== arr[i - 1])) // no duplicati adiacenti
    .join('\n');

  // comprimi righe vuote consecutive
  out = out.replace(/\n{3,}/g, '\n\n');

  return out || '(nessun testo visibile estratto)';
}

async function getUrlsFromSitemap(sitemapUrl, win) {
  const res = await axios.get(sitemapUrl, { timeout: 30000 });
  const parser = new XMLParser();
  const parsed = parser.parse(res.data);

  if (parsed.sitemapindex) {
    let sitemaps = parsed.sitemapindex.sitemap;
    if (!Array.isArray(sitemaps)) sitemaps = [sitemaps];
    let allUrls = [];
    for (const sm of sitemaps) {
      const subUrl = sm.loc;
      win && safeSendMessage(win, 'status', `[info] Scarico sub-sitemap: ${subUrl}`);
      const subUrls = await getUrlsFromSitemap(subUrl, win);
      allUrls = allUrls.concat(subUrls);
    }
    return allUrls;
  }

  if (parsed.urlset) {
    const urlEntries = Array.isArray(parsed.urlset.url) ? parsed.urlset.url : [parsed.urlset.url];
    return urlEntries.map((u) => ({ loc: u.loc, sitemap: sitemapUrl }));
  }

  return [];
}

async function downloadAllMediaFromHtml({ html, url, cleanTitle, mediaFolder, win }) {
  const $ = cheerio.load(html || '');
  const imgUrls = [];
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:')) imgUrls.push(src);
  });
  const videoUrls = [];
  $('video').each((_, el) => {
    const src = $(el).attr('src');
    if (src && !src.startsWith('data:')) videoUrls.push(src);
    $(el)
      .find('source')
      .each((__, sourceEl) => {
        const s = $(sourceEl).attr('src');
        if (s && !s.startsWith('data:')) videoUrls.push(s);
      });
  });

  const allMedia = [...imgUrls, ...videoUrls];
  const baseUrl = new URL(url);

  if (!fs.existsSync(mediaFolder)) fs.mkdirSync(mediaFolder, { recursive: true });
  if (allMedia.length === 0) {
    win && safeSendMessage(win, 'status', `[media] Nessun media trovato nella pagina: ${url}`);
  }

  for (let i = 0; i < allMedia.length; i++) {
    let mediaUrl = allMedia[i];
    try {
      if (!/^https?:\/\//i.test(mediaUrl)) mediaUrl = new URL(mediaUrl, baseUrl.origin).href;
      const ext = path.extname(mediaUrl).split('?')[0] || '';
      const filename = `${sanitizeFilename(cleanTitle)}_${i}${ext}`;
      const filePath = path.join(mediaFolder, filename);
      win && safeSendMessage(win, 'status', `[media] Downloading: ${mediaUrl} -> ${filePath}`);
      const response = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 30000 });
      fs.writeFileSync(filePath, response.data);
      win && safeSendMessage(win, 'status', `📥 Media salvato: ${filePath}`);
    } catch (err) {
      win && safeSendMessage(win, 'status', `❌ Errore download media: ${mediaUrl} (${err.message})`);
    }
  }
}

// ---------- Page analyzers ----------
async function screenshotAndAnalyze(
  url,
  browser,
  baseFolderPath,
  win,
  subFolderName = '',
  downloadMedia = false,
  mediaFolder = '',
  downloadText = false
) {
  const page = await browser.newPage();

  // Desktop visit
  await page.setViewport({ width: 1920, height: 1080 });
  const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  const status = typeof response?.status === 'function' ? response.status() : response?.status ?? 0;

  const html = await page.content();
  const title = (await page.title()) || '';
  const cleanTitle = sanitizeFilename(title || 'page');

  // --- Prepare folders BEFORE writing any file ---
  let targetFolder = '';
  let pageFolder = '';
  if (baseFolderPath) {
    targetFolder = subFolderName ? path.join(baseFolderPath, sanitizeFilename(subFolderName)) : baseFolderPath;
    pageFolder = path.join(targetFolder, cleanTitle);
    if (!fs.existsSync(pageFolder)) fs.mkdirSync(pageFolder, { recursive: true });
  }

  // Extract visible text + save if requested
  const visibleText = extractVisibleText(html);
  if (downloadText && baseFolderPath) {
    const docxPath = path.join(pageFolder, `${cleanTitle}.docx`);

    // DOCX
    const doc = new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun({ text: visibleText || '' })] })] }],
    });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(docxPath, buffer);

    win && safeSendMessage(win, 'status', `📄 Testo salvato in Word:, ${docxPath}`);
  }

  // Screenshots
  let desktopScreenshotPath = '';
  let mobileScreenshotPath = '';

  if (baseFolderPath && win) {
    desktopScreenshotPath = path.join(pageFolder, `${cleanTitle}_desktop.png`);
    await page.screenshot({ path: desktopScreenshotPath, fullPage: true });
    safeSendMessage(win, 'status', `✅ Screenshot desktop salvato: ${desktopScreenshotPath}`);
  }

  await page.setViewport({ width: 375, height: 667, isMobile: true, hasTouch: true });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

  if (baseFolderPath && win) {
    mobileScreenshotPath = path.join(pageFolder, `${cleanTitle}_mobile.png`);
    await page.screenshot({ path: mobileScreenshotPath, fullPage: true });
    safeSendMessage(win, 'status', `✅ Screenshot mobile salvato: ${mobileScreenshotPath}`);
  }

  // Parse HTML once (from desktop load)
  const $ = cheerio.load(html || '');

  // Media downloading only if requested
  if (downloadMedia && mediaFolder) {
    await downloadAllMediaFromHtml({ html, url, cleanTitle, mediaFolder, win });
  }

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
    headers.push(`${tag} "${text}" (${text.length} caratteri)`);
  });
  const tips = [];
  if (headers.length && !headers[0].startsWith('H1')) tips.push('INFO: Il primo tag di intestazione dovrebbe essere H1');
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
    } catch {}
  });

  const uniqueInternalLinks = [...new Set(internalLinks)];
  const uniqueExternalLinks = [...new Set(externalLinks)];

  const structuredData = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      structuredData.push(JSON.stringify(json));
    } catch {}
  });

  const ogTags = {};
  $('meta[property^="og:"], meta[name^="og:"], meta[name^="twitter:"], meta[property^="twitter:"]').each((_, el) => {
    const prop = $(el).attr('property') || $(el).attr('name');
    const content = $(el).attr('content');
    if (prop && content) ogTags[prop] = content;
  });

  // Analytics detection
  const pageContent = (html || '').toLowerCase();
  const analyticsTools = [];
  if (pageContent.includes('googletagmanager.com/gtm.js') || pageContent.includes('gtag(')) analyticsTools.push('GA4');
  if (pageContent.includes('google-analytics.com/analytics.js') || pageContent.includes("ga('")) analyticsTools.push('Universal Analytics');
  if (pageContent.includes('clarity.ms')) analyticsTools.push('Clarity');
  if (pageContent.includes('matomo.js') || pageContent.includes('piwik.js') || pageContent.includes('matomo') || pageContent.includes('_mtm')) analyticsTools.push('Matomo');
  if (pageContent.includes('hotjar.com') || pageContent.includes('hjsv_')) analyticsTools.push('Hotjar');
  if (pageContent.includes('connect.facebook.net') || pageContent.includes('fbq(')) analyticsTools.push('Facebook Pixel');
  const analyticsSummary = analyticsTools.length ? analyticsTools.join(', ') : 'NESSUNO';

  // Cookie banner
  const cookieBanners = [];
  if (pageContent.includes('cookieyes.com') || html.includes('id="cookieyes"')) cookieBanners.push('CookieYes');
  if (pageContent.includes('consent.cookiebot.com') || html.includes('CookieConsent')) cookieBanners.push('CookieBot');
  if (pageContent.includes('cdn.iubenda.com') || pageContent.includes('iubenda')) cookieBanners.push('Iubenda');
  if (cookieBanners.length === 0) cookieBanners.push('NESSUNO');
  const cookieSummary = cookieBanners.join(', ');

  // CMS detection
  let cms = 'NON RILEVATO';
  if (pageContent.includes('wp-content') || pageContent.includes('wp-includes')) cms = 'WordPress';
  if (pageContent.includes('woocommerce')) cms = 'WooCommerce';
  if (pageContent.includes('prestashop') || pageContent.includes('/modules/')) cms = 'PrestaShop';

  await page.close();

  const csvData = [
    {
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
    },
  ];

  let csvPath = '';
  if (baseFolderPath && win) {
    const csv = await converter.json2csv(csvData, { delimiter: ';', prependHeader: true, trimHeaderFields: true });
    csvPath = path.join(pageFolder, `${cleanTitle}.csv`);
    fs.writeFileSync(csvPath, csv, 'utf8');
    safeSendMessage(win, 'status', `📄 CSV salvato: ${csvPath}`);
  }

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
  const status = typeof response?.status === 'function' ? response.status() : response?.status ?? 0;
  const html = await page.content();
  const title = (await page.title()) || '';
  const cleanTitle = sanitizeFilename(title || 'page');

  // Media se richiesti
  if (downloadMedia && mediaFolder) {
    await downloadAllMediaFromHtml({ html, url, cleanTitle, mediaFolder, win });
  }

  if (!html || !title) {
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
      'Strumenti analitici': '',
      'Cookie banner': '',
      'CMS rilevato': '',
    };
  }

  const $ = cheerio.load(html || '');

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
    headers.push(`${tag} "${text}" (${text.length} caratteri)`);
  });
  const tips = [];
  if (headers.length && !headers[0].startsWith('H1')) tips.push('INFO: Il primo tag di intestazione dovrebbe essere H1');
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
    } catch {}
  });

  const uniqueInternalLinks = [...new Set(internalLinks)];
  const uniqueExternalLinks = [...new Set(externalLinks)];

  const structuredData = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).html() || '{}');
      structuredData.push(JSON.stringify(json));
    } catch {}
  });

  const ogTags = {};
  $('meta[property^="og:"], meta[name^="og:"], meta[name^="twitter:"], meta[property^="twitter:"]').each((_, el) => {
    const prop = $(el).attr('property') || $(el).attr('name');
    const content = $(el).attr('content');
    if (prop && content) ogTags[prop] = content;
  });

  // Analytics
  const pageContent = (html || '').toLowerCase();
  const analyticsTools = [];
  if (pageContent.includes('googletagmanager.com/gtm.js') || pageContent.includes('gtag(')) analyticsTools.push('GA4');
  if (pageContent.includes('google-analytics.com/analytics.js') || pageContent.includes("ga('")) analyticsTools.push('Universal Analytics');
  if (pageContent.includes('clarity.ms')) analyticsTools.push('Clarity');
  if (pageContent.includes('matomo.js') || pageContent.includes('piwik.js') || pageContent.includes('matomo') || pageContent.includes('_mtm')) analyticsTools.push('Matomo');
  if (pageContent.includes('hotjar.com') || pageContent.includes('hjsv_')) analyticsTools.push('Hotjar');
  if (pageContent.includes('connect.facebook.net') || pageContent.includes('fbq(')) analyticsTools.push('Facebook Pixel');
  const analyticsSummary = analyticsTools.length ? analyticsTools.join(', ') : 'NESSUNO';

  // Cookie banner
  const cookieBanners = [];
  if (pageContent.includes('cookieyes.com') || html.includes('id="cookieyes"')) cookieBanners.push('CookieYes');
  if (pageContent.includes('consent.cookiebot.com') || html.includes('CookieConsent')) cookieBanners.push('CookieBot');
  if (pageContent.includes('cdn.iubenda.com') || pageContent.includes('iubenda')) cookieBanners.push('Iubenda');
  if (cookieBanners.length === 0) cookieBanners.push('NESSUNO');
  const cookieSummary = cookieBanners.join(', ');

  // CMS
  let cms = 'NON RILEVATO';
  if (pageContent.includes('wp-content') || pageContent.includes('wp-includes')) cms = 'WordPress';
  if (pageContent.includes('woocommerce')) cms = 'WooCommerce';
  if (pageContent.includes('prestashop') || pageContent.includes('/modules/')) cms = 'PrestaShop';

  await page.close();

  return {
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
}

// ---------- Orchestrators ----------

/**
 * SOLO TESTO: salva PDF/DOCX del testo visibile delle pagine.
 * NESSUN CSV (né per-pagina né globale), NESSUNO screenshot, NESSUN media.
 */
// Sostituisci integralmente questa funzione in ../src/scrapers/backupSite.js
export async function performBackupTextOnly(
  searchString,
  folderPath,
  win,
  headless = true,
  useProxy = false,
  customProxy = ''
) {
  win && safeSendMessage(win, 'reset-logs');
 
  // Base output
  let outputFolderPath = folderPath;
  if (!outputFolderPath) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output'));
    outputFolderPath = path.join(baseOutput, 'backup');
    win && safeSendMessage(win, 'status', `[INFO] i file saranno salvati nella cartella: ${outputFolderPath}`);
  }

  const sanitizedQuery = searchString ? sanitizeFilename(searchString) : 'global';
  outputFolderPath = path.join(outputFolderPath, sanitizedQuery);
  if (!fs.existsSync(outputFolderPath)) fs.mkdirSync(outputFolderPath, { recursive: true });

  try {
    let urlsWithSitemap;
    if (searchString.trim().endsWith('.xml')) {
      urlsWithSitemap = await getUrlsFromSitemap(searchString, win);
    } else {
      const urls = searchString
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u));
      urlsWithSitemap = urls.map((u) => ({ loc: u, sitemap: u }));
      win && safeSendMessage(win, 'status', `[info] Analisi pagine: ${urls.join(', ')}`);
    }
    win && safeSendMessage(win, 'status', `[info] Trovati ${urlsWithSitemap.length} URL.`);

    const proxyToUse = useProxy ? customProxy || null : null;
    const browser = await launchBrowser({ headless, proxy: proxyToUse, defaultViewport: null });

    for (const { loc, sitemap } of urlsWithSitemap) {
      if (stopFlag.value) {
        win && safeSendMessage(win, 'status', "[STOP] Scraping interrotto dall'utente.");
        break;
      }

      try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });
        const response = await page.goto(loc, { waitUntil: 'networkidle2', timeout: 60000 });
        const status = typeof response?.status === 'function' ? response.status() : response?.status ?? 0;

        const html = await page.content();
        const title = (await page.title()) || '';
        const cleanTitle = sanitizeFilename(title || 'page');

        // cartella di pagina
        const sitemapName = path.basename(sitemap, '.xml');
        const targetFolder = sitemap.endsWith('.xml')
          ? path.join(outputFolderPath, sanitizeFilename(sitemapName))
          : outputFolderPath;
        const pageFolder = path.join(targetFolder, cleanTitle);
        if (!fs.existsSync(pageFolder)) fs.mkdirSync(pageFolder, { recursive: true });

        // testo visibile
          const visibleText = String(extractVisibleText(html) || '');
         const safeText = getBodyPlainText(html);
      

        // ---- DOCX ----
        const docxPath = path.join(pageFolder, `${cleanTitle}.docx`);
        const doc = new Document({
          sections: [{ children: [new Paragraph({ children: [new TextRun({ text: safeText })] })] }],
        });
        const docxBuffer = await Packer.toBuffer(doc);       // Buffer
        fs.writeFileSync(docxPath, docxBuffer);

        win && safeSendMessage(win, 'status', `📄 (${status}) Testo salvato in Word:  ${docxPath}`);

        await page.close();
      } catch (err) {
        win && safeSendMessage(win, 'status', `❌ Errore su ${loc}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    await browser.close();

    // Nessun CSV qui
    win && safeSendMessage(win, 'status', '📝 Modalità SOLO TESTO completata (nessun CSV generato).');
    if (win?.webContents) {
      safeSendMessage(win, 'backup-data', []);
      safeSendMessage(win, 'backup-folder', outputFolderPath);
    }
  } catch (err) {
    win && safeSendMessage(win, 'status', `[errore] ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Generale:
 * - fullBackup=true: screenshot + CSV per-pagina (+ opzionale testi PDF/DOCX se downloadText=true) + CSV globale
 * - fullBackup=false: solo analisi per CSV globale (niente screenshot; niente per-pagina; niente testi)
 *   (La modalità "solo testi" è gestita separatamente da performBackupTextOnly)
 */
export async function performBackupSite(
  searchString,
  folderPath,
  win,
  headless = true,
  useProxy = false,
  customProxy = '',
  fullBackup = true,
  downloadMedia = false,
  downloadText = false
) {
  win && safeSendMessage(win, 'reset-logs');

  // Base output
  let outputFolderPath = folderPath;
  if (!outputFolderPath) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output'));
    outputFolderPath = path.join(baseOutput, 'backup');
    win && safeSendMessage(win, 'status', `[INFO] i file saranno salvati nella cartella: ${outputFolderPath}`);
  }

  const sanitizedQuery = searchString ? sanitizeFilename(searchString) : 'global';
  outputFolderPath = path.join(outputFolderPath, sanitizedQuery);
  if (!fs.existsSync(outputFolderPath)) fs.mkdirSync(outputFolderPath, { recursive: true });

  const mediaFolder = path.join(outputFolderPath, 'media');

  try {
    let urlsWithSitemap;
    if (searchString.trim().endsWith('.xml')) {
      urlsWithSitemap = await getUrlsFromSitemap(searchString, win);
    } else {
      const urls = searchString
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean)
        .map((u) => (/^https?:\/\//i.test(u) ? u : 'https://' + u));
      urlsWithSitemap = urls.map((u) => ({ loc: u, sitemap: u }));
      win && safeSendMessage(win, 'status', `[info] Analisi pagine: ${urls.join(', ')}`);
    }
    win && safeSendMessage(win, 'status', `[info] Trovati ${urlsWithSitemap.length} URL.`);

    const proxyToUse = useProxy ? customProxy || null : null;
    const browser = await launchBrowser({ headless, proxy: proxyToUse, defaultViewport: null });

    const allCsvData = [];

    for (const { loc, sitemap } of urlsWithSitemap) {
      if (stopFlag.value) {
        win && safeSendMessage(win, 'status', "[STOP] Scraping interrotto dall'utente.");
        break;
      }

      try {
        const sitemapName = path.basename(sitemap, '.xml');

        if (fullBackup) {
          win && safeSendMessage(win, 'status', `[progress] Backup completo: ${loc}`);
          const row = await screenshotAndAnalyze(
            loc,
            browser,
            outputFolderPath,
            win,
            sitemapName,
            downloadMedia,
            mediaFolder,
            downloadText // salva anche i testi se richiesto (oltre a screenshot e CSV per-pagina)
          );
          allCsvData.push(row);
        } else {
          // Solo dati per CSV globale
          win && safeSendMessage(win, 'status', `[progress] Analisi per CSV globale: ${loc}`);
          const row = await analyzePageForGlobalCsv(loc, browser, downloadMedia, mediaFolder, win);
          allCsvData.push(row);
        }
      } catch (err) {
        win && safeSendMessage(win, 'status', `❌ Errore su ${loc}: ${err.message}`);
      }
    }

    await browser.close();

    // CSV globale (solo quando NON siamo in solo testi; qui siamo in fullBackup/analisi globale)
    const globalCsv = await converter.json2csv(allCsvData, {
      delimiter: ';',
      prependHeader: true,
      trimHeaderFields: true,
    });
    const globalCsvName = `${sanitizeFilename(sanitizedQuery)}+seo_backup.csv`;
    const globalCsvPath = path.join(outputFolderPath, globalCsvName);
    fs.writeFileSync(globalCsvPath, globalCsv, 'utf8');

    win && safeSendMessage(win, 'status', `🧾 CSV globale salvato: ${globalCsvPath}`);
    if (fullBackup) {
      win && safeSendMessage(win, 'status', '🧾 Tutti i report singoli sono stati salvati.');
    }

    // invia dati al renderer
    if (win?.webContents) {
      safeSendMessage(win, 'backup-data', allCsvData);
      safeSendMessage(win, 'backup-folder', outputFolderPath);
    }
  } catch (err) {
    win && safeSendMessage(win, 'status', `[errore] ${err.message}`);
  }
}
