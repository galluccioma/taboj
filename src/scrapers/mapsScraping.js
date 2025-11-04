import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import cheerio from 'cheerio';
import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import removeDuplicates from '../utils/removeDuplicates';
import { stopFlag, launchBrowser } from '../utils/config';
import { safeSendMessage } from '../utils/safeWindow';

puppeteer.use(StealthPlugin());
stopFlag.value = false;

// Funzione per estrarre la mail dal sito web
function extractMail(html) {
  const $ = cheerio.load(html);
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  let email = null;
  $('body *').each((_, el) => {
    const text = $(el).text();
    const matches = text.match(emailRegex);
    if (matches && matches.length > 0) {
      [email] = matches;
      return false;
    }
    return true;
  });
  return email;
}

// Funzione per estrarre la partita iva dal sito
function extractPiva(html) {
  const $ = cheerio.load(html);
  const pivaRegex = /\b\d{11}\b/g;
  let piva = null;
  $('body *').each((_, el) => {
    const text = $(el).text();
    const matches = text.match(pivaRegex);
    if (matches && matches.length > 0) {
      [piva] = matches;
      return false;
    }
    return true;
  });
  return piva;
}

// Funzione che chiama l'API checkVatService per verificare la correttezza della partita iva
  async function checkVat(piva) {
    const cleanedPiva = piva.replace(/\D/g, '');
  if (cleanedPiva.length !== 11) return null;

  const url = 'http://ec.europa.eu/taxation_customs/vies/services/checkVatService';
  const soapBody = `
  <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:ec.europa.eu:taxud:vies:services:checkVat:types">
     <soapenv:Header/>
     <soapenv:Body>
        <urn:checkVat>
           <urn:countryCode>IT</urn:countryCode>
           <urn:vatNumber>${cleanedPiva}</urn:vatNumber>
        </urn:checkVat>
     </soapenv:Body>
  </soapenv:Envelope>`;

  try {
    const response = await axios.post(url, soapBody, {
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: ''
      },
      timeout: 15000
    });

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      ignoreDeclaration: true
    });

    const jsonObj = parser.parse(response.data);
    const responseData = jsonObj['env:Envelope']?.['env:Body']?.['ns2:checkVatResponse'];

    if (!responseData) {
      console.warn(`[!] Nessuna risposta valida da VIES per: ${cleanedPiva}`);
      return null;
    }

    return {
      countryCode: responseData['ns2:countryCode'],
      vatNumber: responseData['ns2:vatNumber'],
      requestDate: responseData['ns2:requestDate'],
      valid: responseData['ns2:valid'] === 'true',
      name: responseData['ns2:name'],
      address: responseData['ns2:address']?.trim().replace(/\n/g, ', ')
    };
  } catch (e) {
    console.error(`[x] Errore nella verifica VIES per P.IVA ${piva}:`, e.message || e);
    return null;
  }
}

// Funzione per estrarre il fatturato da ufficiocamerale.it tramite ricerca Google
async function extractFatturato(pivaNumber, browser) {
  try {
    const searchPage = await browser.newPage();
    await searchPage.goto(`https://www.google.com/search?q=${pivaNumber}`, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Accept cookies if present
    const acceptBtn = await searchPage.$('button[aria-label="Accept all"], button[aria-label="Accetta tutto"], #L2AGLb');
    if (acceptBtn) { 
      try { 
        await acceptBtn.click(); 
      } catch (e) {
        // Ignore click errors
      } 
    }
    await new Promise(resolve => {
      setTimeout(resolve, 2000);
    });

    // Try to find the ufficiocamerale.it link robustly
    let ufficioLink = null;
    // 1. Try to get from <a> tags
    const links = await searchPage.$$eval('a', as => as.map(a => a.href));
    ufficioLink = links.find(href => href.includes('ufficiocamerale.it') && href.match(/\d{11}/));
    // 2. If not found, try to get from visible text
    if (!ufficioLink) {
      ufficioLink = await searchPage.$$eval('a', as => {
        for (const a of as) {
          if (a.innerText && a.innerText.includes('ufficiocamerale.it')) return a.href;
        }
        return null;
      });
    }
    // 3. Fallback: construct the URL directly
    if (!ufficioLink) {
      ufficioLink = `https://www.ufficiocamerale.it/ricerca?partitaiva=${pivaNumber}`;
    }

    // Try to open the link and extract Fatturato
    if (ufficioLink) {
      await searchPage.goto(ufficioLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await new Promise(resolve => {
        setTimeout(resolve, 2000);
      });
      const fatturato = await searchPage.$$eval('li.list-group-item', els => {
        for (const el of els) {
          const text = el.innerText;
          if (text.includes('Fatturato:')) {
            const match = text.match(/Fatturato:\s*€\s*([\d.,]+)/);
            return match ? match[1] : null;
          }
        }
        return null;
      });
      await searchPage.close();
      return fatturato;
    }
    await searchPage.close();
    return null;
  } catch (e) {
    // Return null on any error
    return null;
  }
}

// Funzione di Scraping schede Google Maps
export async function scrapeGoogleMaps(searchString, browser, win) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const page = await browser.newPage();
  let scrapeData = [];

  const url = `https://www.google.com/localservices/prolist?hl=en-GB&gl=it&ssta=1&q=${encodeURIComponent(
    searchString
  )}&oq=${encodeURIComponent(searchString)}&src=2`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  if (stopFlag.value) { await page.close(); return scrapeData; }

  const acceptAllButton = await page.$('button[aria-label="Accept all"], button[aria-label="Accetta tutto"], #L2AGLb');
  if (acceptAllButton) {
    await acceptAllButton.click();
    await delay(3000);
    if (stopFlag.value) { await page.close(); return scrapeData; }
  }

  let totalResults = 'UNKNOWN';
  try {
    const resultsText = await page.$eval('[aria-label*="results"]', (el) => el.textContent || '');
    const match = resultsText.match(/of\s+(\d+)/i);
    if (match) totalResults = match[1];
  } catch (_) {}

  safeSendMessage(win, 'status', `📊 Risultati totali stimati: ${totalResults}`);

  const getPageData = async () => {
    const cards = await page.$$('div[data-test-id="organic-list-card"]');
    for (const [index, card] of cards.entries()) {
      if (stopFlag.value) break;
      try {
        const button = await card.$('div[role="button"] > div:first-of-type');
        if (button) {
          await button.click();
          if (stopFlag.value) break;
          await page.waitForSelector('.tZPcob', { timeout: 8000 }).catch(() => {});
          await delay(1500);
          if (stopFlag.value) break;

          const name = await page.$eval('.tZPcob', (el) => el.innerText).catch(() => 'NONE');
          if (stopFlag.value) break;
          const phone = await page
            .$eval('[data-phone-number][role="button"][class*=" "] div:last-of-type', (el) => el.innerHTML)
            .catch(() => 'NONE');
          if (stopFlag.value) break;
          const website = await page.$eval('.iPF7ob > div:last-of-type', (el) => el.innerHTML).catch(() => 'NONE');
          if (stopFlag.value) break;
          const address = await page.$eval('.fccl3c', (el) => el.innerText).catch(() => 'NONE');
          if (stopFlag.value) break;
          const rating = await page.$eval('.pNFZHb .rGaJuf', (el) => el.innerHTML).catch(() => 'NONE');
          if (stopFlag.value) break;
          const ratingNumber = await page
            .$eval('.QwSaG .leIgTe', (el) => el.innerHTML.replace(/\(|\)/g, ''))
            .catch(() => 'NONE');
          if (stopFlag.value) break;

          let mail = null;
          let piva = null;
          let ragioneSociale = null;
          let fatturato = null;

          if (website && website !== 'Nessun Sito') {
            try {
              const websiteURL = website.startsWith('http') ? website : `https://${website}`;
              const response = await axios.get(websiteURL, { timeout: 12000 });
              if (stopFlag.value) break;
              const html = response.data;
              mail = extractMail(html);
              piva = extractPiva(html);
              if (piva && /^\d{11}$/.test(piva)) {
                safeSendMessage(win, 'status', `🔍 Verifica VIES per P.IVA: ${piva}`);
                await delay(2000); // Importante: evita blocchi dal server
                if (stopFlag.value) break;
                const vatData = await checkVat(piva);
                if (stopFlag.value) break;
                if (vatData) {
                  ragioneSociale = vatData.name;
                } else {
                  safeSendMessage(win, 'status', `[!] Dati VIES non trovati per ${piva}`);
                }
                fatturato = await extractFatturato(piva, browser);
                if (stopFlag.value) break;
                safeSendMessage(win, 'status', `💸 scraping FATTURATO per P.IVA: ${piva}`);
              }
            } catch (_) { if (stopFlag.value) break; }
          }

          scrapeData.push({
            name,
            address,
            phone,
            website,
            rating,
            ratingNumber,
            mail,
            piva,
            ragioneSociale,
            fatturato,
          });
          safeSendMessage(win, 'status', `[+] (${index + 1}/${cards.length}) ${name}`);
          await delay(1000);
          if (stopFlag.value) break;
        }
      } catch (err) {
        safeSendMessage(win, 'status', `[x] Errore card ${index + 1}: ${err.message}`);
        if (stopFlag.value) break;
      }
    }
    if (stopFlag.value) return;
    const nextButton = await page.$('button[aria-label="Next"]');
    if (nextButton) {
      try {
        await nextButton.click();
        await delay(7000);
        if (stopFlag.value) return;
        await getPageData();
      } catch (err) {
        safeSendMessage(win, 'status', `[!] Errore clic pagina successiva: ${err.message}`);
        if (stopFlag.value) return;
      }
    }
  };

  await getPageData();
  await page.close();
  return scrapeData;
}

// Funzione per salvare i risultati nel CSV
export async function saveMapsData(data, startTime, folderPath, win, searchQueries) {
  if (data.length === 0) {
    safeSendMessage(win, 'status', '[!] Nessun dato da salvare.');
    return;
  }
  const csv = await converter.json2csv(data);
  let queriesStr = searchQueries
    .join('_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '');
  if (queriesStr.length > 40) queriesStr = `${queriesStr.slice(0, 40)}...`;
  const filename = `maps_output-${queriesStr}-${Date.now()}.csv`;
  fs.writeFileSync(path.join(folderPath, filename), csv, 'utf-8');
  safeSendMessage(win, 'status', `[+] Record salvati nel file CSV (${filename})`);
  safeSendMessage(win,
    'status',
    `[success] Scritti ${data.length} record in ${(Date.now() - startTime.getTime()) / 1000}s`
  );
}

// Funzione di Scraping che chiama le altre funzioni
export async function performMapsScraping(searchString, folderPath, win, headless, useProxy, customProxy) {
  stopFlag.value = false; // Reset stop flag at the start
  if (!folderPath) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output'));
    folderPath = path.join(baseOutput, 'maps');
    safeSendMessage(win, 'status', `[INFO] i file saranno salvati nella cartella: ${folderPath}`);  }
  const searchQueries = searchString.split(',').map(q => q.trim()).filter(Boolean);
  let allData = [];
  let stopped = false;
  let browser = null;

  try {
    for (const query of searchQueries) {
      if (stopFlag.value) break;
      try {
        safeSendMessage(win, 'status', `🔍 Cercando: ${query}`);
        const proxy = useProxy ? customProxy : null;
        browser = await launchBrowser({ headless, proxy });
        if (stopFlag.value) { await browser.close(); break; }
        const data = await scrapeGoogleMaps(query, browser, win);
        await browser.close();
        browser = null;
        allData.push(...data.map(d => ({ ...d, searchQuery: query })));
        if (stopFlag.value) break;
      } catch (error) {
        if (browser) { await browser.close(); browser = null; }
        safeSendMessage(win, 'status', `Errore durante la ricerca "${query}": ${error.message}`);
        if (stopFlag.value) break;
      }
    }
  } finally {
    if (browser) { await browser.close(); browser = null; }
    // Salva subito il CSV se interrotto
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    const before = allData.length;
    allData = removeDuplicates(allData);
    const after = allData.length;
    const removed = before - after;
    safeSendMessage(win, 'status', `[info] Rimossi ${removed} duplicati.`);
    await saveMapsData(allData, new Date(), folderPath, win, searchQueries);
    if (stopFlag.value) {
      safeSendMessage(win, 'status', '[💾] Dati salvati dopo interruzione.');
    } else {
      safeSendMessage(win, 'status', '[✅] Dati salvati con successo.');
    }
    stopFlag.value = false; // Reset after use
  }
}