import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { stopFlag, launchBrowser } from '../utils/config';
import { safeSendMessage, sanitizeFilename } from '../utils/safeWindow.js';

puppeteer.use(StealthPlugin());

stopFlag.value = false; // to reset

// --- FAQ scraping logic ---

/**
 * Esegue scraping delle domande "People Also Ask" da Google
 * Logga ogni step, errore e risultato tramite win.webContents.send('status', ...)
 */
export async function checkForCaptcha(page) {
  const captchaSelector = '#captcha, iframe[src*="captcha"], div.g-recaptcha';
  try {
    await page.waitForSelector(captchaSelector, { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Scraping "People Also Ask" con logging dettagliato
 */
export async function scrapePeopleAlsoAsk(searchString, browser, win, existingPage = null, maxToProcess = 50) {
  if (win && win.webContents) safeSendMessage(win, `[ASK] Avvio scraping per: ${searchString}`);
  const page = existingPage || (await browser.newPage());
  if (!existingPage) {
    const url = `https://www.google.com/search?hl=it&gl=it&ie=UTF-8&oe=UTF-8&q=${encodeURIComponent(searchString)}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
  }
  // CAPTCHA
  if (await checkForCaptcha(page)) {
    safeSendMessage(win,
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
    safeSendMessage(win, '[ASK] Cookie accettati.');
  }
  try {
    await page.waitForSelector('div.related-question-pair[data-q]', {
      timeout: 5000
    });
  } catch (e) {
    safeSendMessage(win, `[error] Nessuna domanda trovata per: ${searchString}`);
    return [];
  }
  const results = [];
  const processedQuestions = new Set();
  let lastLength = -1;
  let reachedLimit = false;
  while (results.length < maxToProcess && !reachedLimit) {
    if (stopFlag.value) {
      safeSendMessage(win, "[STOP] Scraping interrotto dall'utente. Salvataggio dati...");
      break;
    }
    const faqContainers = await page.$$('div.related-question-pair[data-q]');
    if (faqContainers.length === lastLength) break;
    lastLength = faqContainers.length;
    for (let i = 0; i < faqContainers.length; i += 1) {
      const container = faqContainers[i];
      const q = await container.evaluate((el) => el.getAttribute('data-q'));
      if (processedQuestions.has(q)) {
        // skip
      } else {
        processedQuestions.add(q);
        safeSendMessage(win, `[process] Domanda #${results.length + 1}: "${q}"`);
        try {
          await container.click();
          await new Promise((resolve) => { setTimeout(resolve, 3000); });
          const description = await page.evaluate((questionText) => {
            const pairNode = Array.from(document.querySelectorAll('div.related-question-pair[data-q]')).find(
              (el) => el.getAttribute('data-q') === questionText
            );
            if (!pairNode) return '';
            const parent = pairNode.parentElement;
            if (!parent) return '';
            const walker = document.createNodeIterator(parent, NodeFilter.SHOW_TEXT, {
              acceptNode: (node) => {
                const tagName = node.parentElement?.tagName;
                if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(tagName)) return NodeFilter.FILTER_SKIP;
                return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
              }
            });
            let text = '';
            let n;
            while ((n = walker.nextNode())) {
              text += `${n.nodeValue.trim()} `;
            }
            return text.trim();
          }, q);
          safeSendMessage(win,
            `[success] Descrizione trovata: ${description ? `${description.slice(0, 80)}...` : '[vuota]'}`
          );
          results.push({ question: q, description });
          if (results.length >= maxToProcess) {
            reachedLimit = true;
            break;
          }
        } catch (e) {
          safeSendMessage(win, `[error] Errore nella domanda "${q}": ${e.message}`);
        }
      }
    }
    if (reachedLimit) break;
    await new Promise((resolve) => { setTimeout(resolve, 3000); });
  }
  safeSendMessage(win, `[ASK] Completato. Trovate ${results.length} domande.`);
  return results;
}

/**
 * Scraping delle "Ricerche Correlate" con logging dettagliato
 */
async function scrapeRelatedSearches(searchString, browser, win, maxToProcess = 10) {
  if (win && win.webContents) safeSendMessage(win, `[RICERCHE CORRELATE] Avvio scraping per: ${searchString}`);
  const page = await browser.newPage();
  const url = `https://www.google.com/search?hl=it&gl=it&ie=UTF-8&oe=UTF-8&q=${encodeURIComponent(searchString)}`;
  await page.goto(url, { waitUntil: 'networkidle2' });
  // Accept cookies if present
  const acceptAllButton = await page.$('button[aria-label="Accept all"], button[aria-label="Accetta tutto"], #L2AGLb');
  if (acceptAllButton) {
    await acceptAllButton.click();
    await new Promise((resolve) => setTimeout(resolve, 3000));
    safeSendMessage(win, '[RICERCHE CORRELATE] Cookie accettati.');
  }
  try {
    await page.waitForSelector('div#search', { timeout: 5000 });
  } catch (e) {
    safeSendMessage(win, `[error] Nessun risultato SERP per: ${searchString}`);
    await page.close();
    return [];
  }
  const related = await page.evaluate((max) => {
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
      if (results.length >= max) break;
    }
    // Fallback: if nothing found, just return all <span><b>...</b></span> texts
    if (results.length === 0) {
      return allB.map(b => ({ related: b.textContent.trim() })).slice(0, max);
    }
    return results;
  }, maxToProcess);
  safeSendMessage(win, `[RICERCHE CORRELATE] Completato. Trovate ${related.length} ricerche correlate.`);
  await page.close();
  return related;
}

/**
 * Funzione principale per scraping FAQ/Ask/Ricerche Correlate con logging dettagliato
 */
export async function performFaqScraping(searchString, folderPath, win, headless, useProxy = false, customProxy = '', maxToProcess = 50, scrapeTypes = ['ask']) {
  safeSendMessage(win, 'reset-logs');
  stopFlag.value = false;
  let outFolder = folderPath;
  if (!outFolder) {
    const baseOutput = global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output');
    outFolder = path.join(baseOutput, 'faq');
    safeSendMessage(win, `[INFO] i file saranno salvati nella cartella: ${outFolder}`);
  }
  const searchQueries = searchString.split(',').map((q) => q.trim()).filter(Boolean);
  const startTime = new Date();
  fs.mkdirSync(outFolder, { recursive: true });

  for (const type of scrapeTypes) {
    if (stopFlag.value) break;
    for (const query of searchQueries) {
      if (stopFlag.value) {
        safeSendMessage(win, "[STOP] Scraping interrotto dall'utente. Salvataggio dati...");
        break;
      }
      const proxyToUse = useProxy ? customProxy : null;
      const browser = await launchBrowser({ headless, proxy: proxyToUse });
      let data = [];
      let filename = '';
      try {
        if (type === 'ask') {
          safeSendMessage(win, `\n[ASK] Sto cercando: ${query}`);
          data = await scrapePeopleAlsoAsk(query, browser, win, null, maxToProcess);
          filename = `people_also_ask-${sanitizeFilename(query)}.csv`;
        } else if (type === 'ricerche_correlate') {
          safeSendMessage(win, `\n[RICERCHE CORRELATE] Sto cercando: ${query}`);
          data = await scrapeRelatedSearches(query, browser, win, maxToProcess);
          filename = `ricerche_correlate-${sanitizeFilename(query)}.csv`;
        }
        if (data && data.length > 0) {
          const csv = await converter.json2csv(data.map((d) => ({ ...d, searchQuery: query })));
          fs.writeFileSync(path.join(outFolder, filename), csv, 'utf-8');
          safeSendMessage(win, `[+] Record salvati nel file CSV (${filename})`);
        } else {
          safeSendMessage(win, `[!] Nessun dato trovato per ${type} - ${query}`);
        }
      } catch (err) {
        safeSendMessage(win, `[errore] Errore nella ricerca (${type}): ${query} - ${err.message}`);
      } finally {
        await browser.close();
      }
    }
  }
  safeSendMessage(win, `[success] Tutti i task completati in ${(Date.now() - startTime.getTime()) / 1000}s`);
}

export function askUserToSolveCaptcha() {
  return new Promise((resolve) => {
    // For Electron, you may want to show a dialog or just wait for user action in the browser
    // Here, we just resolve after a short delay for demo
    setTimeout(resolve, 10000); // Wait 10 seconds for manual captcha
  });
}

export async function saveFaqData(data, startTime, folderPath, win, searchString) {
  if (data.length === 0) {
    safeSendMessage(win, '[!] Nessun dato da salvare.');
    return;
  }
  const csv = await converter.json2csv(data);
  const sanitizedQuery = searchString ? sanitizeFilename(searchString) : 'query';
  const filename = `people_also_ask-${sanitizedQuery}.csv`;
  // Ensure the folder exists before writing
  fs.mkdirSync(folderPath, { recursive: true });
  fs.writeFileSync(path.join(folderPath, filename), csv, 'utf-8');
  safeSendMessage(win, `[+] Record salvati nel file CSV (${filename})`);
  safeSendMessage(win,
    `[success] Scritti ${data.length} record in ${(Date.now() - startTime.getTime()) / 1000}s`
  );
}
