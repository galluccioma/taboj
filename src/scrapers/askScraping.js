import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
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
  if (win && win.webContents) safeSendMessage(win, 'status', `[ASK] Avvio scraping per: ${searchString}`);
  const page = existingPage || (await browser.newPage());
  if (!existingPage) {
    const url = `https://www.google.com/search?hl=it&gl=it&ie=UTF-8&oe=UTF-8&q=${encodeURIComponent(searchString)}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
  }
  // CAPTCHA
  if (await checkForCaptcha(page)) {
    safeSendMessage(
      win,
      'status',
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
    safeSendMessage(win, 'status', '[ASK] Cookie accettati.');
  }
  try {
    await page.waitForSelector('div.related-question-pair[data-q]', {
      timeout: 5000
    });
  } catch (e) {
    safeSendMessage(win, 'status', `[error] Nessuna domanda trovata per: ${searchString}`);
    return [];
  }
  const results = [];
  const processedQuestions = new Set();
  let lastLength = -1;
  let reachedLimit = false;
  while (results.length < maxToProcess && !reachedLimit) {
    if (stopFlag.value) {
      safeSendMessage(win, 'status', "[STOP] Scraping interrotto dall'utente. Salvataggio dati...");
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
        safeSendMessage(win, 'status', `[process] Domanda #${results.length + 1}: "${q}"`);
        try {
          await container.click();
          await new Promise((resolve) => {
            setTimeout(resolve, 3000);
          });
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
                if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(tagName)) return NodeFilter.FILTER_SKIP;
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
          safeSendMessage(
            win,
            'status',
            `[success] Descrizione trovata: ${description ? `${description.slice(0, 80)}...` : '[vuota]'}`
          );
          results.push({ question: q, description });
          if (results.length >= maxToProcess) {
            reachedLimit = true;
            break;
          }
        } catch (e) {
          safeSendMessage(win, 'status', `[error] Errore nella domanda "${q}": ${e.message}`);
        }
      }
    }
    if (reachedLimit) break;
    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    });
  }
  safeSendMessage(win, 'status', `[ASK] Completato. Trovate ${results.length} domande.`);
  return results;
}

/**
 * Scraping delle "Ricerche Correlate" con logging dettagliato
 */
async function scrapeRelatedSearches(searchString, browser, win, maxToProcess = 10, existingPage = null) {
  if (win && win.webContents)
    safeSendMessage(win, 'status', `[RICERCHE CORRELATE] Avvio scraping per: ${searchString}`);

  const page = existingPage || (await browser.newPage());
  if (!existingPage) {
    const url = `https://www.google.com/search?hl=it&gl=it&q=${encodeURIComponent(searchString)}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
  }

  try {
    await page.waitForSelector('div#search', { timeout: 5000 });
  } catch (e) {
    safeSendMessage(win, 'status', `[error] Nessun risultato SERP per: ${searchString}`);
    if (!existingPage) await page.close();
    return [];
  }

  const related = await page.evaluate((max) => {
    const label = Array.from(document.querySelectorAll('span')).find(
      (el) => el.textContent && el.textContent.trim().toLowerCase() === 'ricerche correlate'
    );
    if (!label) return [];
    let container = label.closest('div');
    while (container && container.querySelectorAll('span b').length < 2) {
      container = container.parentElement;
    }
    if (!container) return [];
    const allB = Array.from(container.querySelectorAll('span b'));
    let foundLabel = false;
    const results = [];
    for (const b of allB) {
      if (!foundLabel) {
        if (b.closest('span') && b.closest('span').textContent.trim().toLowerCase() === 'ricerche correlate') {
          foundLabel = true;
        }
        continue;
      }
      results.push({ related: b.textContent.trim() });
      if (results.length >= max) break;
    }
    if (results.length === 0) {
      return allB.map((b) => ({ related: b.textContent.trim() })).slice(0, max);
    }
    return results;
  }, maxToProcess);

  safeSendMessage(win, 'status', `[RICERCHE CORRELATE] Completato. Trovate ${related.length} ricerche correlate.`);
  if (!existingPage) await page.close();
  return related;
}


/**
 * Scraping GEO risposte AI
 */
async function scrapeRelatedLinks(searchString, browser, win, maxToProcess = 20, existingPage = null) {
  if (win && win.webContents) safeSendMessage(win, 'status', `[GEO LINKS] Avvio scraping per: ${searchString}`);

  const page = existingPage || (await browser.newPage());
  if (!existingPage) {
    const url = `https://www.google.com/search?hl=it&gl=it&q=${encodeURIComponent(searchString)}`;
    await page.goto(url, { waitUntil: 'networkidle2' });
  }

  try {
    await page.waitForSelector('ul[jsname="Z3saHd"] li', { timeout: 5000 });
  } catch (e) {
    safeSendMessage(win, 'status', `[error] Nessun link correlato trovato per: ${searchString}`);
    if (!existingPage) await page.close();
    return [];
  }

  const links = await page.evaluate((max) => {
    const items = Array.from(document.querySelectorAll('ul[jsname="Z3saHd"] li'));
    const results = [];
    for (const li of items) {
      const a = li.querySelector('a');
      if (!a) continue;
      const title = li.querySelector('.mNme1d')?.textContent?.trim() || a.getAttribute('aria-label') || '';
      const description = li.querySelector('.gxZfx')?.textContent?.trim() || '';
      const url = a.href;
      results.push({ title, description, url });
      if (results.length >= max) break;
    }
    return results;
  }, maxToProcess);

  safeSendMessage(win, 'status', `[LINK CORRELATI] Completato. Trovati ${links.length} link.`);
  if (!existingPage) await page.close();
  return links;
}


/**
 * Funzione principale per scraping FAQ/Ask/Ricerche Correlate con logging dettagliato
 */
export async function performFaqScraping(
  searchString,
  folderPath,
  win,
  headless,
  useProxy = false,
  customProxy = '',
  maxToProcess = 50,
  delayBetweenQueries = 5000
) {
  safeSendMessage(win, 'status', 'reset-logs');
  stopFlag.value = false;

  let outFolder = folderPath;
  if (!outFolder) {
    const baseOutput = global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output');
    outFolder = path.join(baseOutput, 'faq');
    safeSendMessage(win, 'status', `[INFO] I file saranno salvati nella cartella: ${outFolder}`);
  }

  const searchQueries = searchString.split(',').map((q) => q.trim()).filter(Boolean);
  fs.mkdirSync(outFolder, { recursive: true });

  const proxyToUse = useProxy ? customProxy : null;
  const allData = [];

  for (const query of searchQueries) {
    if (stopFlag.value) {
      safeSendMessage(win, 'status', "[STOP] Scraping interrotto dall'utente.");
      break;
    }

    safeSendMessage(win, 'status', `\n[INFO] Avvio scraping completo per: ${query}`);
    const browser = await launchBrowser({ headless, proxy: proxyToUse });

    try {
      const page = await browser.newPage();

      // Vai alla pagina di ricerca di Google
      const url = `https://www.google.com/search?hl=it&gl=it&q=${encodeURIComponent(query)}`;
      await page.goto(url, { waitUntil: 'networkidle2' });

      // --- Accetta cookie se presenti ---
      try {
        const acceptAllButton = await page.$('button[aria-label="Accept all"], button[aria-label="Accetta tutto"], #L2AGLb');
        if (acceptAllButton) {
          await acceptAllButton.click();
          await new Promise((resolve) => setTimeout(resolve, 3000));
          safeSendMessage(win, 'status', '[INFO] Cookie accettati.');
        }
      } catch (err) {
        safeSendMessage(win, 'status', `[WARN] Errore accettando cookie: ${err.message}`);
      }

      // --- People Also Ask ---
      try {
        const askResult = await scrapePeopleAlsoAsk(query, browser, win, page, maxToProcess);
        if (askResult.captcha) {
          safeSendMessage(win, 'status', `[!] CAPTCHA rilevato per "${query}". Attendere soluzione manuale...`);
          await askUserToSolveCaptcha();
        }
        if (askResult.length > 0) {
          askResult.forEach((d) => allData.push({ ...d, searchQuery: query, type: 'ask', status: 'trovato' }));
        } else {
          allData.push({ searchQuery: query, type: 'ask', status: 'non trovato' });
        }
      } catch (err) {
        safeSendMessage(win, 'status', `[errore] ASK fallito per "${query}": ${err.message}`);
        allData.push({ searchQuery: query, type: 'ask', status: 'non trovato' });
      }

      // --- Ricerche Correlate ---
      try {
        const relatedResult = await scrapeRelatedSearches(query, browser, win, maxToProcess, page);
        if (relatedResult.length > 0) {
          relatedResult.forEach((d) =>
            allData.push({ ...d, searchQuery: query, type: 'ricerche_correlate', status: 'trovato' })
          );
        } else {
          allData.push({ searchQuery: query, type: 'ricerche_correlate', status: 'non trovato' });
        }
      } catch (err) {
        safeSendMessage(win, 'status', `[errore] Ricerche Correlate fallite per "${query}": ${err.message}`);
        allData.push({ searchQuery: query, type: 'ricerche_correlate', status: 'non trovato' });
      }

      // --- Link Correlati / GEO ---
      try {
        const geoResult = await scrapeRelatedLinks(query, browser, win, maxToProcess, page);
        if (geoResult.length > 0) {
          geoResult.forEach((d) =>
            allData.push({ ...d, searchQuery: query, type: 'geo_link', status: 'trovato' })
          );
        } else {
          allData.push({ searchQuery: query, type: 'geo_link', status: 'non trovato' });
        }
      } catch (err) {
        safeSendMessage(win, 'status', `[errore] GEO/Link falliti per "${query}": ${err.message}`);
        allData.push({ searchQuery: query, type: 'geo_link', status: 'non trovato' });
      }

      await page.close();
    } catch (err) {
      safeSendMessage(win, 'status', `[errore] Errore generico nella query "${query}": ${err.message}`);
    } finally {
      await browser.close();
      
    }

    if (delayBetweenQueries > 0) {
      safeSendMessage(win, 'status', `[INFO] Pausa di ${delayBetweenQueries / 1000}s prima della prossima query...`);
      await new Promise((resolve) => setTimeout(resolve, delayBetweenQueries));
    }
  }

  // --- Salvataggio CSV finale ---
  if (allData.length > 0) {
    const csv = await converter.json2csv(allData);
    const filename = `faq_all_queries.csv`;
    fs.writeFileSync(path.join(outFolder, filename), csv, 'utf-8');
    safeSendMessage(win, 'status', `[✅] Tutti i dati salvati nel file CSV (${filename})`);
  } else {
    safeSendMessage(win, 'status', `[!] Nessun dato da salvare.`);
  }
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
    safeSendMessage(win, 'status', '[!] Nessun dato da salvare.');
    return;
  }
  const csv = await converter.json2csv(data);
  const sanitizedQuery = searchString ? sanitizeFilename(searchString) : 'query';
  const filename = `people_also_ask-${sanitizedQuery}.csv`;
  // Ensure the folder exists before writing
  fs.mkdirSync(folderPath, { recursive: true });
  fs.writeFileSync(path.join(folderPath, filename), csv, 'utf-8');
  safeSendMessage(win, 'status', `[+] Record salvati nel file CSV (${filename})`);
  safeSendMessage(
    win,
    'status',
    `[success] Scritti ${data.length} record in ${(Date.now() - startTime.getTime()) / 1000}s`
  );
}
