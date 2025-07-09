import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

import { ipcMain } from 'electron';
import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
import { stopFlag, launchBrowser } from '../utils/config';

puppeteer.use(StealthPlugin());

stopFlag.value = false; // to reset

// --- FAQ scraping logic ---

export async function checkForCaptcha(page) {
  const captchaSelector = '#captcha, iframe[src*="captcha"], div.g-recaptcha';
  try {
    await page.waitForSelector(captchaSelector, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function scrapePeopleAlsoAsk(searchString, browser, win, existingPage = null) {
  const page = existingPage || (await browser.newPage());
  if (!existingPage) {
    const url = `https://www.google.com/search?hl=it&gl=it&ie=UTF-8&oe=UTF-8&q=${encodeURIComponent(searchString)}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
  }
  // CAPTCHA
  if (await checkForCaptcha(page)) {
    win.webContents.send(
      'user-action-required',
      "[!] CAPTCHA rilevato! Risolvilo manualmente nel browser, poi clicca 'Continua' per proseguire."
    );
    // Do NOT close the page; return it for reuse
    return { captcha: true, page };
  }
  // Accetta i cookie, se presenti
  const acceptAllButton = await page.$('button[aria-label="Accept all"], button[aria-label="Accetta tutto"], #L2AGLb');
  if (acceptAllButton) {
    await acceptAllButton.click();
    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    });
  }
  await page.waitForSelector('div.related-question-pair[data-q]', {
    timeout: 5000
  });
  const results = [];
  const processedQuestions = new Set();
  const maxToProcess = 50;
  let lastLength = -1;
  while (results.length < maxToProcess) {
    if (stopFlag.value) {
      win.webContents.send('status', "[STOP] Scraping interrotto dall'utente. Salvataggio dati...");
      break;
    }
    const faqContainers = await page.$$('div.related-question-pair[data-q]');
    if (faqContainers.length === lastLength) break;
    lastLength = faqContainers.length;
    for (let i = 0; i < faqContainers.length; i++) {
      const container = faqContainers[i];
      const question = await container.evaluate((el) => el.getAttribute('data-q'));
      if (processedQuestions.has(question)) continue;
      processedQuestions.add(question);
      win.webContents.send('status', `\n[process] Domanda #${results.length + 1}: "${question}"`);
      try {
        await container.click();
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const description = await page.evaluate((question) => {
          const pairNode = Array.from(document.querySelectorAll('div.related-question-pair[data-q]')).find(
            (el) => el.getAttribute('data-q') === question
          );
          if (!pairNode) return '';
          const parent = pairNode.parentElement;
          if (!parent) return '';
          const walker = document.createNodeIterator(parent, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
              const tagName = node.parentElement?.tagName;
              if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tagName)) return NodeFilter.FILTER_SKIP;
              return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
          });
          let node,
            text = '';
          while ((node = walker.nextNode())) {
            text += node.nodeValue.trim() + ' ';
          }
          return text.trim();
        }, question);
        win.webContents.send(
          'status',
          `[success] Descrizione trovata: ${description ? description.slice(0, 80) + '...' : '[vuota]'}`
        );
        results.push({ question, description });
        if (results.length >= maxToProcess) break;
      } catch (e) {
        win.webContents.send('status', `[error] Errore nella domanda "${question}": ${e.message}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return results;
}

export async function performFaqScraping(searchString, folderPath, win, headless, useProxy = false, customProxy = '') {
  win.webContents.send('reset-logs');
  stopFlag.value = false; // Reset stop flag at the start
  // Use base output folder if none provided
  if (!folderPath) {
    const baseOutput = global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output');
    folderPath = path.join(baseOutput, 'faq');
    win.webContents.send('status', `[INFO] i file saranno salvati nella cartella: ${folderPath}`);
  }
  const searchQueries = searchString
    .split(',')
    .map((q) => q.trim())
    .filter(Boolean);

  let allData = [];
  let startTime = new Date();

  await searchQueries.reduce(async (prevPromise, query) => {
    await prevPromise;
    if (stopFlag.value) {
      win.webContents.send('status', "[STOP] Scraping interrotto dall'utente. Salvataggio dati...");
      return;
    }
    let retry = true;
    let page = null;
    while (retry) {
      try {
        win.webContents.send('status', `\n🔍 Sto cercando: ${query}`);
        let proxyToUse = null;
        if (useProxy) {
          proxyToUse = customProxy;
          win.webContents.send('status', `🧭 Proxy in uso: ${proxyToUse}`);
        }
        const browser = await launchBrowser({ headless, proxy: proxyToUse });
        const result = await scrapePeopleAlsoAsk(query, browser, win, page);
        if (result && result.captcha) {
          // Wait for user confirmation from frontend
          await new Promise((resolve) => {
            ipcMain.once('user-action-confirmed', () => resolve());
          });
          // After confirmation, retry the same query with the same page
          page = result.page;
        } else {
          allData = allData.concat(result.map((d) => ({ ...d, searchQuery: query })));
          retry = false;
          if (result && result.page) await result.page.close();
        }
        await browser.close();
      } catch (err) {
        win.webContents.send('status', `[errore] Errore nella ricerca: ${query} - ${err.message}`);
        retry = false;
        if (page) await page.close();
      }
    }
  }, Promise.resolve());

  await saveFaqData(allData, startTime, folderPath, win, searchString);
}

export function askUserToSolveCaptcha() {
  return new Promise((resolve) => {
    // For Electron, you may want to show a dialog or just wait for user action in the browser
    // Here, we just resolve after a short delay for demo
    setTimeout(resolve, 10000); // Wait 10 seconds for manual captcha
  });
}

function sanitizeFilename(str) {
  return str
    .replace(/[^a-z0-9_\- ]/gi, '')
    .replace(/\s+/g, '_')
    .slice(0, 100);
}

export async function saveFaqData(data, startTime, folderPath, win, searchString) {
  if (data.length === 0) {
    win.webContents.send('status', '[!] Nessun dato da salvare.');
    return;
  }
  const csv = await converter.json2csv(data);
  const sanitizedQuery = searchString ? sanitizeFilename(searchString) : 'query';
  const filename = `people_also_ask-${sanitizedQuery}.csv`;
  // Ensure the folder exists before writing
  fs.mkdirSync(folderPath, { recursive: true });
  fs.writeFileSync(path.join(folderPath, filename), csv, 'utf-8');
  win.webContents.send('status', `[+] Record salvati nel file CSV (${filename})`);
  win.webContents.send(
    'status',
    `[success] Scritti ${data.length} record in ${(Date.now() - startTime.getTime()) / 1000}s`
  );
}
