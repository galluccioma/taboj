import axios from "axios";
import { GoogleAuth } from "google-auth-library";
import { createObjectCsvWriter } from "csv-writer";
import fs from 'fs';
import path from 'path';

// Only support service account key file authentication
async function performGoogleAdsScraping(advertiser, folderPath, win, headless, useProxy, customProxy, keyFilePath) {
  if (!keyFilePath || !fs.existsSync(keyFilePath)) {
    if (win && win.webContents) win.webContents.send('status', `❌ Service account key file required: ${keyFilePath}`);
    return;
  }

  // Use base output folder if none provided
  if (!folderPath) {
    const baseOutput = (global.getBaseOutputFolder ? global.getBaseOutputFolder() : process.cwd());
    folderPath = path.join(baseOutput, 'googleads');
    if (win && win.webContents) win.webContents.send('status', `[INFO] i file saranno salvati nella cartella: ${folderPath}`);
  }
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

  const projectId = "sonic-ivy-465507-t8";

  // Use service account key file for authentication
  const auth = new GoogleAuth({
    keyFile: keyFilePath,
    scopes: ["https://www.googleapis.com/auth/bigquery"]
  });
  const client = await auth.getClient();
  if (win && win.webContents) win.webContents.send('status', `[INFO] Autenticazione tramite service account: ${keyFilePath}`);

  try {
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`;
    const query = `
      SELECT *
      FROM \`bigquery-public-data.google_ads_transparency_center.creative_stats\`
      WHERE advertiser_disclosed_name LIKE '${advertiser}'
      LIMIT 1000
    `;
    const tokens = await client.getAccessToken();
    const response = await axios.post(
      url,
      { query, useLegacySql: false },
      { headers: { Authorization: `Bearer ${tokens.token}` } }
    );
    const jobId = response.data.jobReference.jobId;
    const resultUrl = `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries/${jobId}`;
    const result = await axios.get(resultUrl, {
      headers: { Authorization: `Bearer ${tokens.token}` },
    });
    const rows = result.data.rows || [];
    const simplifiedData = rows.map((row) => {
      const values = row.f.map((item) => item.v);

      const advertiserId = values[0];
      const creativeId = values[1];
      const creativePageUrl = values[2];
      const adFormatType = values[3];
      const advertiserDisclosedName = values[4];
      const advertiserLegalName = values[5];
      const advertiserLocation = values[6];
      const advertiserVerificationStatus = values[7];

      const regionStats = values[8];
      let surfaces = [];
      let ultimaDataFine = "";
      let campagnaAttiva = false;

      try {
        if (Array.isArray(regionStats)) {
          regionStats.forEach((region) => {
            const surface = region?.v?.f?.[0]?.v || "";
            const dataFine = region?.v?.f?.[2]?.v || "";
            surfaces.push(surface);
            if (dataFine) {
              ultimaDataFine = dataFine;
              const oggi = new Date().toISOString().split("T")[0];
              if (dataFine >= oggi) campagnaAttiva = true;
            }
          });
        }
      } catch (e) {
        console.warn("Errore parsing surfaces:", e);
      }

      // Estraggo i criteri di targeting dettagliati in colonne separate
      const audienceInfo = values[9];
      const targetingValues = audienceInfo?.f?.map((entry) => entry.v) || [];

      const targetingCategories = [
        "Affinity Segments",
        "Custom Segments",
        "Detailed Demographics",
        "Life Events",
        "In-market",
        "Your Data",
      ];

      const targetingMap = {};
      targetingCategories.forEach((cat, idx) => {
        targetingMap[cat] = targetingValues[idx] || "N/D";
      });

      const topic = values[10] || "N/D";
      const isGoogleGrant = values[11] === "true" ? "Sì" : "No";

      return {
        "ID Inserzionista": advertiserId,
        "ID Annuncio": creativeId,
        "URL Annuncio": creativePageUrl,
        "Tipo Annuncio": adFormatType,
        "Nome Inserzionista": advertiserDisclosedName,
        "Nome Legale Inserzionista": advertiserLegalName,
        "Località Inserzionista": advertiserLocation,
        "Stato Verifica": advertiserVerificationStatus,
        "Canali di Pubblicazione": surfaces.join(", ") || "N/D",
        "Data Fine Ultima": ultimaDataFine || "N/D",
        "Campagna Attiva": campagnaAttiva ? "Sì" : "No",
        "Categoria / Argomento": topic,
        "Finanziato da Google Grants": isGoogleGrant,
        ...targetingMap,
      };
    });
    const csvWriter = createObjectCsvWriter({
      path: path.join(folderPath, `google_ads-${advertiser}-${Date.now()}.csv`),
      header: [
        { id: "ID Inserzionista", title: "ID Inserzionista" },
        { id: "ID Annuncio", title: "ID Annuncio" },
        { id: "URL Annuncio", title: "URL Annuncio" },
        { id: "Tipo Annuncio", title: "Tipo Annuncio" },
        { id: "Nome Inserzionista", title: "Nome Inserzionista" },
        { id: "Nome Legale Inserzionista", title: "Nome Legale Inserzionista" },
        { id: "Località Inserzionista", title: "Località Inserzionista" },
        { id: "Stato Verifica", title: "Stato Verifica" },
        { id: "Canali di Pubblicazione", title: "Canali di Pubblicazione" },
        { id: "Data Fine Ultima", title: "Data Fine Ultima" },
        { id: "Campagna Attiva", title: "Campagna Attiva" },
        { id: "Categoria / Argomento", title: "Categoria / Argomento" },
        { id: "Finanziato da Google Grants", title: "Finanziato da Google Grants" },
        { id: "Affinity Segments", title: "Affinity Segments" },
        { id: "Custom Segments", title: "Custom Segments" },
        { id: "Detailed Demographics", title: "Detailed Demographics" },
        { id: "Life Events", title: "Life Events" },
        { id: "In-market", title: "In-market" },
        { id: "Your Data", title: "Your Data" },
      ],
    });
    await csvWriter.writeRecords(simplifiedData);
    if (win && win.webContents) win.webContents.send('status', `✅ File CSV salvato in: ${folderPath}`);
  } catch (error) {
    if (win && win.webContents) {
      let details = error.message;
      if (error.response && error.response.data) {
        details = JSON.stringify(error.response.data, null, 2);
      } else if (typeof error === 'object') {
        details = JSON.stringify(error, null, 2);
      }
      win.webContents.send('status', `❌ Errore nella query: ${details}`);
    }
  }
}

export default performGoogleAdsScraping