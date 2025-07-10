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

export async function scrapePeopleAlsoAsk(searchString, browser, win, existingPage = null, maxToProcess = 50) {
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
  let lastLength = -1;
  let reachedLimit = false;
  while (results.length < maxToProcess && !reachedLimit) {
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
        if (results.length >= maxToProcess) {
          reachedLimit = true;
          break;
        }
      } catch (e) {
        win.webContents.send('status', `[error] Errore nella domanda "${question}": ${e.message}`);
      }
    }
    if (reachedLimit) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  return results;
}

// --- Add scraping for SERP and Ricerche Correlate ---
async function scrapeRelatedSearches(searchString, browser, win, maxToProcess = 10) {
  const page = await browser.newPage();
  const url = `https://www.google.com/search?hl=it&gl=it&ie=UTF-8&oe=UTF-8&q=${encodeURIComponent(searchString)}`;
  await page.goto(url, { waitUntil: 'networkidle2' });
  // Accept cookies if present
  const acceptAllButton = await page.$('button[aria-label="Accept all"], button[aria-label="Accetta tutto"], #L2AGLb');
  if (acceptAllButton) {
    await acceptAllButton.click();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  await page.waitForSelector('div#search', { timeout: 5000 });
  const related = await page.evaluate((maxToProcess) => {
    // Find the 'Ricerche correlate' label
    const label = Array.from(document.querySelectorAll('span')).find(
      el => el.textContent && el.textContent.trim().toLowerCase() === 'ricerche correlate'
    );
    if (!label) return [];
    // Find the parent container that holds the related searches
    let container = label.closest('div');
    // Traverse up to find a container with many links (heuristic)
    while (container && container.querySelectorAll('span b').length < 2) {
      container = container.parentElement;
    }
    if (!container) return [];
    // Get all <span><b>...</b></span> after the label
    const allB = Array.from(container.querySelectorAll('span b'));
    // Optionally, filter only those after the label in DOM order
    let foundLabel = false;
    const results = [];
    for (const b of allB) {
      // Only start collecting after the label
      if (!foundLabel) {
        if (b.closest('span') && b.closest('span').textContent.trim().toLowerCase() === 'ricerche correlate') {
          foundLabel = true;
        }
        continue;
      }
      results.push({ related: b.textContent.trim() });
      if (results.length >= maxToProcess) break;
    }
    // Fallback: if nothing found, just return all <span><b>...</b></span> texts
    if (results.length === 0) {
      return allB.map(b => ({ related: b.textContent.trim() })).slice(0, maxToProcess);
    }
    return results;
  }, maxToProcess);
  await page.close();
  return related;
}

// --- Refactored performFaqScraping ---
export async function performFaqScraping(searchString, folderPath, win, headless, useProxy = false, customProxy = '', maxToProcess = 50, scrapeTypes = ['ask']) {
  win.webContents.send('reset-logs');
  stopFlag.value = false;
  if (!folderPath) {
    const baseOutput = global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output');
    folderPath = path.join(baseOutput, 'faq');
    win.webContents.send('status', `[INFO] i file saranno salvati nella cartella: ${folderPath}`);
  }
  const searchQueries = searchString.split(',').map((q) => q.trim()).filter(Boolean);
  const startTime = new Date();
  fs.mkdirSync(folderPath, { recursive: true });

  for (const type of scrapeTypes) {
    if (stopFlag.value) break;
    for (const query of searchQueries) {
      if (stopFlag.value) {
        win.webContents.send('status', "[STOP] Scraping interrotto dall'utente. Salvataggio dati...");
        break;
      }
      let proxyToUse = useProxy ? customProxy : null;
      const browser = await launchBrowser({ headless, proxy: proxyToUse });
      let data = [];
      let filename = '';
      try {
        if (type === 'ask') {
          win.webContents.send('status', `\n[ASK] Sto cercando: ${query}`);
          data = await scrapePeopleAlsoAsk(query, browser, win, null, maxToProcess);
          filename = `people_also_ask-${sanitizeFilename(query)}.csv`;
        } else if (type === 'ricerche_correlate') {
          win.webContents.send('status', `\n[RICERCHE CORRELATE] Sto cercando: ${query}`);
          data = await scrapeRelatedSearches(query, browser, win, maxToProcess);
          filename = `ricerche_correlate-${sanitizeFilename(query)}.csv`;
        }
        if (data && data.length > 0) {
          const csv = await converter.json2csv(data.map((d) => ({ ...d, searchQuery: query })));
          fs.writeFileSync(path.join(folderPath, filename), csv, 'utf-8');
          win.webContents.send('status', `[+] Record salvati nel file CSV (${filename})`);
        } else {
          win.webContents.send('status', `[!] Nessun dato trovato per ${type} - ${query}`);
        }
      } catch (err) {
        win.webContents.send('status', `[errore] Errore nella ricerca (${type}): ${query} - ${err.message}`);
      } finally {
        await browser.close();
      }
    }
  }
  win.webContents.send('status', `[success] Tutti i task completati in ${(Date.now() - startTime.getTime()) / 1000}s`);
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
