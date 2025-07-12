import converter from 'json-2-csv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { execFile } from 'child_process';
import { stopFlag } from '../utils/config';




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
  const filename = `dns_output-${sanitizedQuery}-${Date.now()}.csv`;
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
  let outputFolder = folderPath;
  if (!outputFolder) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : path.join(process.cwd(), 'output'));
    outputFolder = path.join(baseOutput, 'dns');
    win.webContents.send('status', `[INFO] i file saranno salvati nella cartella: ${outputFolder}`);
  }

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

      win.webContents.send('status', `\n🔍 Analisi DNS/Lighthouse/Wayback per: ${domain}`);
      const record = { domain };

      // HTTP Status and SSL Status
      try {
        const httpsUrl = `https://${domain}`;
        let httpStatus = null;
        let sslStatus = 'NO SSL';
        try {
          const { status } = await axios.get(httpsUrl, { timeout: 10000, validateStatus: () => true });
          httpStatus = status;
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
        win.webContents.send('status', `[success] HTTP Status: ${httpStatus}, SSL Status: ${sslStatus}`);
      } catch (err) {
        record.http_status = 'ERROR';
        record.ssl_status = 'ERROR';
        win.webContents.send('status', `[error] HTTP/SSL fallito per ${domain}: ${err.message}`);
      }

      // Wayback se richiesto
      if (doWayback) {
        win.webContents.send('status', `[wayback] Avvio ricerca Wayback Machine per: ${domain}`);
        try {
          const waybackResult = await getWaybackData(`https://${domain}`, win);
          record.wayback_snapshots = waybackResult.total;
          record.wayback_first_date = waybackResult.firstDate;
          record.wayback_last_date = waybackResult.lastDate;
          record.wayback_years_online = waybackResult.yearsOnline;
          win.webContents.send('status', `[success] Wayback: ${waybackResult.total} snapshot, ${waybackResult.yearsOnline} anni online`);
        } catch (err) {
          win.webContents.send('status', `[error] Wayback fallito per ${domain}: ${err.message}`);
        }
      }

      // Lighthouse se richiesto
      if (doLighthouse) {
        win.webContents.send('status', `[lighthouse] Avvio analisi Lighthouse per: ${domain}`);
        if (process.env.NODE_ENV === 'production') {
          win.webContents.send('status', '[info] Lighthouse skipped in production build.');
        } else {
          try {
            const lighthouseResult = await runLighthouseAudit(`https://${domain}`, win);
            if (lighthouseResult) {
              record.performance = lighthouseResult.performance;
              record.accessibility = lighthouseResult.accessibility;
              record.seo = lighthouseResult.seo;
              record.bestPractices = lighthouseResult.bestPractices;
              record.lighthouse_average = lighthouseResult.average;
              win.webContents.send('status', `[success] Lighthouse: Performance ${lighthouseResult.performance}, Accessibilità ${lighthouseResult.accessibility}, SEO ${lighthouseResult.seo}, Best Practices ${lighthouseResult.bestPractices}, Media ${lighthouseResult.average}`);
            } else {
              win.webContents.send('status', `[warn] Lighthouse non ha restituito risultati per ${domain}`);
            }
          } catch (err) {
            win.webContents.send('status', `[error] Lighthouse fallito per ${domain}: ${err.message}`);
          }
        }
      }

      allData.push(record);
    })
  );

  if (!fs.existsSync(outputFolder)) fs.mkdirSync(outputFolder, { recursive: true });

  await saveDnsData(allData, startTime, outputFolder, win, [], false, searchString);
  // Restituisce i dati raccolti come array
  return allData;
}
