import fs from 'fs';
import path from 'path';
import https from 'https';
import { createObjectCsvWriter } from 'csv-writer';

// Exported scraping function
async function performMetaAdsScraping(pageId, folderPath, win, headless, useProxy, customProxy, accessToken) {
  if (!pageId || !accessToken) {
    if (win && win.webContents) win.webContents.send('status', 'Page ID e/o Access Token mancanti.');
    return;
  }

  // Use base output folder if none provided
  if (!folderPath) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : process.cwd());
    folderPath = path.join(baseOutput, 'googleads'); // Use 'googleads' folder for Meta Ads too
    if (win && win.webContents) win.webContents.send('status', `[INFO] i file saranno salvati nella cartella: ${folderPath}`);
  }
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const params = new URLSearchParams({
    access_token: accessToken,
    ad_type: 'ALL',
    ad_reached_countries: 'IT',
    fields: [
      'ad_creative_link_descriptions',
      'ad_creative_link_titles',
      'ad_delivery_start_time',
      'ad_delivery_stop_time',
      'ad_snapshot_url',
      'page_id',
      'page_name',
      'publisher_platforms'
    ].join(','),
    limit: '1000',
    search_page_ids: pageId
  });

  const url = `https://graph.facebook.com/v18.0/ads_archive?${params.toString()}`;

  if (win && win.webContents) win.webContents.send('status', `[INFO] Richiesta Meta API per pageId: ${pageId}`);

  // Helper to fetch data
  function fetchAds() {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.data) {
              resolve(json.data);
            } else {
              reject(json.error || { message: 'No data found', raw: json });
            }
          } catch (e) {
            reject({ message: 'Error parsing response', error: e, raw: data });
          }
        });
      }).on('error', (err) => {
        reject({ message: 'Request error', error: err });
      });
    });
  }

  try {
    const ads = await fetchAds();
    if (!ads.length) {
      if (win && win.webContents) win.webContents.send('status', '[!] Nessun annuncio trovato.');
      return;
    }
    // Prepare data for CSV
    const csvData = ads.map(ad => ({
      'ID Annuncio': ad.id || '',
      'Titoli': (ad.ad_creative_link_titles || []).join(' | '),
      'Descrizioni': (ad.ad_creative_link_descriptions || []).join(' | '),
      'Data Inizio': ad.ad_delivery_start_time || '',
      'Data Fine': ad.ad_delivery_stop_time || '',
      'Snapshot URL': ad.ad_snapshot_url || '',
      'ID Pagina': ad.page_id || '',
      'Nome Pagina': ad.page_name || '',
      'Piattaforme': (ad.publisher_platforms || []).join(', ')
    }));

    const nomePagina=ads[0].page_name

    const csvWriter = createObjectCsvWriter({
      path: path.join(folderPath, `meta_ads_${nomePagina}_${Date.now()}.csv`),
      header: [
        { id: 'ID Annuncio', title: 'ID Annuncio' },
        { id: 'Titoli', title: 'Titoli' },
        { id: 'Descrizioni', title: 'Descrizioni' },
        { id: 'Data Inizio', title: 'Data Inizio' },
        { id: 'Data Fine', title: 'Data Fine' },
        { id: 'Snapshot URL', title: 'Snapshot URL' },
        { id: 'ID Pagina', title: 'ID Pagina' },
        { id: 'Nome Pagina', title: 'Nome Pagina' },
        { id: 'Piattaforme', title: 'Piattaforme' }
      ]
    });
    await csvWriter.writeRecords(csvData);
    if (win && win.webContents) win.webContents.send('status', `✅ File CSV salvato in: ${folderPath}`);
  } catch (error) {
    if (win && win.webContents) win.webContents.send('status', `❌ Errore: ${error.message || error}`);
  }
} 

export default performMetaAdsScraping