import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
import * as dns from 'dns/promises';
import axios from 'axios';
import { execFile } from 'child_process';
import { stopFlag } from '../utils/config';
const { ipcMain } = require('electron');



async function runLighthouseAudit(url, win) {
  return new Promise((resolve) => {
    win?.webContents.send('status', `[lighthouse] Analisi in corso per: ${url}`);
    const scriptPath = path.join(process.cwd(), 'src', 'scrapers', 'lighthouse_runner.mjs');
    execFile('node', [scriptPath, url], { shell: false }, (error, stdout, stderr) => {
      if (error) {
        win?.webContents.send('status', `[lighthouse] Errore analizzando ${url}: ${error.message}`);
        console.error('[Lighthouse ERROR]', error, stderr);
        resolve(null);
        return;
      }
      try {
        const scores = JSON.parse(stdout);
        win?.webContents.send(
          'status',
          `[lighthouse] ${url} → Performance: ${scores.performance * 100}%, Accessibilità: ${scores.accessibility * 100}%, SEO: ${scores.seo * 100}%, Best Practices: ${scores.bestPractices * 100}%, Media: ${scores.average.toFixed(0)}%`
        );
        resolve(scores);
      } catch (parseErr) {
        win?.webContents.send('status', `[lighthouse] Errore parsing risultati per ${url}: ${parseErr.message}`);
        console.error('[Lighthouse PARSE ERROR]', parseErr, stdout);
        resolve(null);
      }
    });
  });
}



async function getWaybackData(url, win) {
  try {
    const domain = new URL(url).hostname;
    win?.webContents.send('status', `[wayback] Verifica archivio per: ${domain}`);

    const res = await axios.get('https://web.archive.org/cdx/search/cdx', {
      params: {
        url: domain,
        output: 'json',
      },
    });

    const data = res.data;
    const snapshots = data.slice(1);
    const total = snapshots.length;

    if (total === 0) {
      win?.webContents.send('status', `[wayback] Nessun archivio trovato per ${domain}`);
      return { total: 0, firstDate: '', lastDate: '', yearsOnline: 0 };
    }

    const first = snapshots[0][1];
    const last = snapshots[total - 1][1];
    const getYear = (s) => parseInt(s.slice(0, 4), 10);

    const formatDate = (str) => {
      const year = str.slice(0, 4);
      const month = parseInt(str.slice(4, 6), 10) - 1;
      const day = parseInt(str.slice(6, 8), 10);
      return new Date(year, month, day).toLocaleDateString('it-IT', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const result = {
      total,
      firstDate: formatDate(first),
      lastDate: formatDate(last),
      yearsOnline: getYear(last) - getYear(first),
    };

    win?.webContents.send('status', `[wayback] ${total} snapshot trovati (${result.yearsOnline} anni online)`);
    return result;
  } catch (err) {
    win?.webContents.send('status', `[error] Wayback fallito per ${url}: ${err.message}`);
    console.error('[WAYBACK ERROR]', { url, error: err });
    return { total: 0, firstDate: '', lastDate: '', yearsOnline: 0, error: err.message };
  }
}

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_\- ]/gi, '').replace(/\s+/g, '_').slice(0, 100);
}

export async function saveDnsData(data, startTime, folderPath, win, dnsRecordTypes, doAMail, searchString) {
  if (data.length === 0) {
    win.webContents.send('status', '[!] Nessun dato da salvare.');
    return;
  }
  const csv = await converter.json2csv(data);
  // Debug: log CSV header and first row
  const csvLines = csv.split('\n');
  console.log('==== CSV HEADER ====');
  console.log(csvLines[0]);
  if (csvLines.length > 1) {
    console.log('==== CSV FIRST ROW ====');
    console.log(csvLines[1]);
  }
  const sanitizedQuery = searchString ? sanitizeFilename(searchString) : 'query';
  const filename = `dns_output-${sanitizedQuery}-${(Math.random() + 1).toString(36).substring(7)}.csv`;
  fs.writeFileSync(path.join(folderPath, filename), csv, 'utf-8');
  win.webContents.send('status', `[+] Record salvati nel file CSV (${filename})`);
  win.webContents.send(
    'status',
    `[success] Scritti ${data.length} record in ${(Date.now() - startTime.getTime()) / 1000}s`
  );
  win.webContents.send('status', `[log] CSV DNS salvato: ${filename}`);
}

// --- DNS scraping logic ---
export async function performDnsScraping(
  searchString,
  folderPath,
  win,
  dnsRecordTypes,
  doAMail,
  doLighthouse,
  doWayback
) {
  // Use base output folder if none provided
  if (!folderPath) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output'));
    folderPath = path.join(baseOutput, 'dns');
    win.webContents.send('status', `[INFO] No folderPath provided, using default: ${folderPath}`);
  }
  // Defensive: ensure dnsRecordTypes is always an array
  if (!Array.isArray(dnsRecordTypes)) {
    if (typeof dnsRecordTypes === 'string') {
      dnsRecordTypes = dnsRecordTypes.split(',').map(s => s.trim()).filter(Boolean);
    } else {
      dnsRecordTypes = [];
    }
  }

  // Debug: log dnsRecordTypes
  console.log('==== DNS SCRAPING START ====');
  console.log('[DEBUG] dnsRecordTypes:', dnsRecordTypes);
  console.log('[DEBUG] doAMail:', doAMail, 'doLighthouse:', doLighthouse, 'doWayback:', doWayback);

  win.webContents.send('reset-logs');
  stopFlag.value = false;

  const domains = searchString
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);

  const startTime = new Date();
  const allData = [];

  await Promise.all(
    domains.map(async (domain) => {
      if (stopFlag.value) {
        win.webContents.send('status', "[STOP] Scraping interrotto dall'utente. Salvataggio dati...");
        return;
      }

      // Debug: log domain being processed
      console.log('==== Processing domain:', domain, '====');

      win.webContents.send('status', `\n🔍 Controllo DNS per: ${domain}`);
      const record = { domain };

      // Pre-populate DNS record types
      dnsRecordTypes.forEach(type => {
        record[type] = null;
      });

      // Pre-populate mail_A if needed
      if (doAMail) {
        record.mail_A = null;
      }

      // Pre-populate Lighthouse fields if needed
      if (doLighthouse) {
        record.performance = null;
        record.accessibility = null;
        record.seo = null;
        record.bestPractices = null;
        record.lighthouse_average = null;
      }

      // Pre-populate Wayback fields if needed
      if (doWayback) {
        record.wayback_snapshots = null;
        record.wayback_first_date = null;
        record.wayback_last_date = null;
        record.wayback_years_online = null;
      }

      // DNS Record Lookup
      await Promise.all(
        dnsRecordTypes.map(async (type) => {
          if (stopFlag.value) return;
          console.log(`[DEBUG] Starting DNS lookup for type: ${type} on domain: ${domain}`);
          try {
            const result = await dns.resolve(domain, type);
            record[type] = JSON.stringify(result);
            win.webContents.send('status', `[success] ${type} trovato per ${domain}: ${JSON.stringify(result)}`);
            console.log(`[DEBUG] DNS result for ${type} on ${domain}:`, result);
          } catch (e) {
            record[type] = null;
            win.webContents.send('status', `[info] Nessun record ${type} per ${domain} (${e.code || e.message})`);
            // Debug: log DNS lookup error
            console.error(`[ERROR] Error resolving ${type} for ${domain}:`, e);
          }
        })
      );

      // HTTP Status and SSL Status
      try {
        const httpsUrl = `https://${domain}`;
        let httpStatus = null;
        let sslStatus = 'NO SSL';
        try {
          const response = await axios.get(httpsUrl, { timeout: 10000, validateStatus: () => true });
          httpStatus = response.status;
          sslStatus = 'VALID';
        } catch (err) {
          if (err.response) {
            httpStatus = err.response.status;
            sslStatus = 'VALID';
          } else if (err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' || err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
            sslStatus = 'INVALID';
          } else if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ECONNABORTED') {
            httpStatus = 'NO RESPONSE';
          }
        }
        record.http_status = httpStatus;
        record.ssl_status = sslStatus;
      } catch (err) {
        record.http_status = 'ERROR';
        record.ssl_status = 'ERROR';
      }

      // A record per mail.domain se richiesto
      if (doAMail) {
        const mailDomain = `mail.${domain}`;
        console.log(`[DEBUG] Starting DNS lookup for mail_A on: ${mailDomain}`);
        try {
          const mailA = await dns.resolve(mailDomain, 'A');
          record.mail_A = JSON.stringify(mailA);
          win.webContents.send('status', `[success] A record trovato per ${mailDomain}: ${JSON.stringify(mailA)}`);
          console.log(`[DEBUG] DNS result for mail_A on ${mailDomain}:`, mailA);
        } catch (e) {
          record.mail_A = null;
          win.webContents.send('status', `[info] Nessun A record per ${mailDomain} (${e.code || e.message})`);
          // Debug: log mail_A lookup error
          console.error(`[ERROR] Error resolving mail_A for ${mailDomain}:`, e);
        }
      }

      // Wayback se richiesto
      if (doWayback) {
        console.log(`[DEBUG] Starting Wayback lookup for: ${domain}`);
        try {
          const waybackResult = await getWaybackData(`https://${domain}`, win);
          record.wayback_snapshots = waybackResult.total;
          record.wayback_first_date = waybackResult.firstDate;
          record.wayback_last_date = waybackResult.lastDate;
          record.wayback_years_online = waybackResult.yearsOnline;
          console.log('[DEBUG] Wayback result:', waybackResult);
        } catch (err) {
          win.webContents.send('status', `[error] Wayback fallito per ${domain}: ${err.message}`);
          // Debug: log Wayback error
          console.error(`[ERROR] Error running Wayback for ${domain}:`, err);
        }
      }

      // Lighthouse se richiesto
      if (doLighthouse) {
        if (process.env.NODE_ENV === 'production') {
          win.webContents.send('status', '[info] Lighthouse skipped in production build.');
          console.log('[INFO] Lighthouse skipped in production build.');
        } else {
          try {
            const lighthouseResult = await runLighthouseAudit(`https://${domain}`, win);
            if (lighthouseResult) {
              record.performance = lighthouseResult.performance;
              record.accessibility = lighthouseResult.accessibility;
              record.seo = lighthouseResult.seo;
              record.bestPractices = lighthouseResult.bestPractices;
              record.lighthouse_average = lighthouseResult.average;
              console.log('[DEBUG] Lighthouse result:', lighthouseResult);
            } else {
              console.log('[WARN] Lighthouse returned null for', domain);
            }
          } catch (err) {
            win.webContents.send('status', `[error] Lighthouse fallito per ${domain}: ${err.message}`);
            // Debug: log Lighthouse error
            console.error(`[ERROR] Error running Lighthouse for ${domain}:`, err);
          }
        }
      }

      // Debug: log final record before pushing
      console.log('==== Final record for', domain, '====');
      console.log(record);

      allData.push(record);
    })
  );

  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  // Debug: log allData before saving
  console.log('==== All data to be saved to CSV ====');
  console.log(allData);

  await saveDnsData(allData, startTime, folderPath, win, dnsRecordTypes, doAMail, searchString);
}
