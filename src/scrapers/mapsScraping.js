import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import cheerio from 'cheerio';
import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
const { ipcMain } = require('electron');

import removeDuplicates from '../utils/removeDuplicates';
import { stopFlag, launchBrowser } from '../utils/config';

puppeteer.use(StealthPlugin());
stopFlag.value = false;

export function extractMail(html) {
  const $ = cheerio.load(html);
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
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

export function extractPiva(html) {
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


export async function saveMapsData(data, startTime, folderPath, win, searchQueries) {
  if (data.length === 0) {
    win.webContents.send('status', '[!] Nessun dato da salvare.');
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
  win.webContents.send('status', `[+] Record salvati nel file CSV (${filename})`);
  win.webContents.send(
    'status',
    `[success] Scritti ${data.length} record in ${(Date.now() - startTime.getTime()) / 1000}s`
  );
}

export async function scrapeGoogleMaps(searchString, browser, win) {
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const page = await browser.newPage();
  let scrapeData = [];

  const url = `https://www.google.com/localservices/prolist?hl=en-GB&gl=it&ssta=1&q=${encodeURIComponent(
    searchString
  )}&oq=${encodeURIComponent(searchString)}&src=2`;

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  const acceptAllButton = await page.$('button[aria-label="Accept all"], button[aria-label="Accetta tutto"], #L2AGLb');
  if (acceptAllButton) {
    await acceptAllButton.click();
    await delay(3000);
  }

  let totalResults = 'UNKNOWN';
  try {
    const resultsText = await page.$eval('[aria-label*="results"]', (el) => el.textContent || '');
    const match = resultsText.match(/of\s+(\d+)/i);
    if (match) totalResults = match[1];
  } catch (_) {}

  win.webContents.send('status', `📊 Risultati totali stimati: ${totalResults}`);

  const getPageData = async () => {
    const cards = await page.$$('div[data-test-id="organic-list-card"]');

    for (const [index, card] of cards.entries()) {
      if (stopFlag.value) break;

      try {
        const button = await card.$('div[role="button"] > div:first-of-type');
        if (button) {
          await button.click();
          await page.waitForSelector('.tZPcob', { timeout: 8000 }).catch(() => {});
          await delay(1500);

          const name = await page.$eval('.tZPcob', (el) => el.innerText).catch(() => 'NONE');
          const phone = await page
            .$eval('[data-phone-number][role="button"][class*=" "] div:last-of-type', (el) => el.innerHTML)
            .catch(() => 'NONE');
          const website = await page.$eval('.iPF7ob > div:last-of-type', (el) => el.innerHTML).catch(() => 'NONE');
          const address = await page.$eval('.fccl3c', (el) => el.innerText).catch(() => 'NONE');
          const rating = await page.$eval('.pNFZHb .rGaJuf', (el) => el.innerHTML).catch(() => 'NONE');
          const ratingNumber = await page
            .$eval('.QwSaG .leIgTe', (el) => el.innerHTML.replace(/\(|\)/g, ''))
            .catch(() => 'NONE');

          let mail = null;
          let piva = null;
          let ragioneSociale = null;

          if (website && website !== 'Nessun Sito') {
            try {
              const websiteURL = website.startsWith('http') ? website : `https://${website}`;
              const response = await axios.get(websiteURL, { timeout: 12000 });
              const html = response.data;
              mail = extractMail(html);
              piva = extractPiva(html);
              if (piva && /^\d{11}$/.test(piva)) {
                win.webContents.send('status', `🔍 Verifica VIES per P.IVA: ${piva}`);
                await delay(2000); // Importante: evita blocchi dal server
                const vatData = await checkVat(piva);
                if (vatData) {
                  ragioneSociale = vatData.name;
                } else {
                  win.webContents.send('status', `[!] Dati VIES non trovati per ${piva}`);
                }
              }
            } catch (_) {}
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
          });
          win.webContents.send('status', `[+] (${index + 1}/${cards.length}) ${name}`);
          await delay(1000);
        }
      } catch (err) {
        win.webContents.send('status', `[x] Errore card ${index + 1}: ${err.message}`);
      }
    }

    const nextButton = await page.$('button[aria-label="Next"]');
    if (nextButton) {
      try {
        await nextButton.click();
        await delay(7000);
        await getPageData();
      } catch (err) {
        win.webContents.send('status', `[!] Errore clic pagina successiva: ${err.message}`);
      }
    }
  };

  await getPageData();
  await page.close();
  return scrapeData;
}

export async function performMapsScraping(searchString, folderPath, win, headless, useProxy, customProxy) {
  stopFlag.value = false; // Reset stop flag at the start
  // Use base output folder if none provided
  if (!folderPath) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output'));
    folderPath = path.join(baseOutput, 'maps');
    win.webContents.send('status', `[INFO] i file saranno salvati nella cartella: ${folderPath}`);  }
  const searchQueries = searchString.split(',').map(q => q.trim()).filter(Boolean);
  let allData = [];
  let stopped = false;

  try {
    for (const query of searchQueries) {
      if (stopFlag.value) {
        win.webContents.send('status', `[🛑] Interrotto prima di iniziare la query: ${query}`);
        stopped = true;
        break;
      }

      try {
        win.webContents.send('status', `🔍 Cercando: ${query}`);
        const proxy = useProxy ? customProxy : null;
        const browser = await launchBrowser({ headless, proxy });

        const data = await scrapeGoogleMaps(query, browser, win);
        await browser.close();

        allData.push(...data.map(d => ({ ...d, searchQuery: query })));

        if (stopFlag.value) {
          win.webContents.send('status', `[🛑] Interruzione richiesta dopo la query: ${query}`);
          stopped = true;
          break;
        }
      } catch (error) {
        win.webContents.send('status', `Errore durante la ricerca "${query}": ${error.message}`);
        if (stopFlag.value) {
          win.webContents.send('status', `[🛑] Interruzione richiesta dopo la query: ${query}`);
          stopped = true;
          break;
        }
      }
    }
  } finally {
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const before = allData.length;
    allData = removeDuplicates(allData);
    const after = allData.length;
    const removed = before - after;
    win.webContents.send('status', `[info] Rimossi ${removed} duplicati.`);

    await saveMapsData(allData, new Date(), folderPath, win, searchQueries);

    if (stopped || stopFlag.value) {
      win.webContents.send('status', '[💾] Dati salvati dopo interruzione.');
    } else {
      win.webContents.send('status', '[✅] Dati salvati con successo.');
    }

    stopFlag.value = false; // Reset after use
  }
}
