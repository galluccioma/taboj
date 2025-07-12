import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { InferenceClient } from "@huggingface/inference";

const HF_TOKEN = "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";
const client = new InferenceClient(HF_TOKEN);

const csv = fs.readFileSync('./tools/da analizzare.csv', 'utf8');
const records = parse(csv, { columns: true, skip_empty_lines: true });

function analyzeCampaigns(ads) {
  if (!ads || !Array.isArray(ads) || ads.length === 0) {
    return {
      total: 0,
      active: 0,
      lastEndDate: null,
    };
  }
  const activeCampaigns = ads.filter(ad => {
    const val = (ad['Campagna Attiva'] || '').toLowerCase();
    return val === 'si' || val === 'yes';
  });
  const endedCampaigns = ads.filter(ad => {
    const val = (ad['Campagna Attiva'] || '').toLowerCase();
    return val !== 'si' && val !== 'yes';
  });
  // Trova la data di fine più recente tra le campagne non attive
  let lastEndDate = null;
  for (const ad of endedCampaigns) {
    const dateStr = ad['Data Fine Ultima'];
    if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      if (!lastEndDate || dateStr > lastEndDate) lastEndDate = dateStr;
    }
  }
  return {
    total: ads.length,
    active: activeCampaigns.length,
    lastEndDate,
  };
}

async function analyzeBusiness(business) {
  // Parse JSON fields
  let metaAds = [];
  let googleAds = [];
  let dns = [];
  try { metaAds = JSON.parse(business.metaAds); } catch {}
  try { googleAds = JSON.parse(business.googleAds); } catch {}
  try { dns = JSON.parse(business.dns); } catch {}
  const dnsData = dns[0] || {};

  // Check completeness
  const missing = [];
  ['website', 'mail', 'piva', 'ragioneSociale', 'fatturato'].forEach(field => {
    if (!business[field] || business[field] === 'NONE' || business[field] === '') missing.push(field);
  });

  // Analisi campagne
  const googleStats = analyzeCampaigns(googleAds);
  const metaStats = analyzeCampaigns(metaAds);

  // Build prompt for AI
  const prompt = `
Analizza la presenza online di questa azienda e genera un report tecnico dettagliato.
- Nome: ${business.noname}
- Sito: ${business.website}
- Mail: ${business.mail}
- P.IVA: ${business.piva}
- Ragione sociale: ${business.ragioneSociale}
- Fatturato: ${business.fatturato}
- Campagne Google Ads: totali ${googleStats.total}, attive ${googleStats.active}, ultima campagna terminata il: ${googleStats.lastEndDate || 'N/A'}
- Campagne Meta Ads: totali ${metaStats.total}, attive ${metaStats.active}, ultima campagna terminata il: ${metaStats.lastEndDate || 'N/A'}
- Lighthouse: performance ${dnsData.performance}, seo ${dnsData.seo}, accessibility ${dnsData.accessibility}, bestPractices ${dnsData.bestPractices}, media ${dnsData.lighthouse_average}
- Wayback: primi dati ${dnsData.wayback_first_date}, ultimi dati ${dnsData.wayback_last_date}, anni online ${dnsData.wayback_years_online}, snapshot totali ${dnsData.wayback_snapshots}
- Campi mancanti: ${missing.join(', ') || 'nessuno'}

Fornisci una valutazione tecnica della presenza online, punti di forza, debolezza e suggerimenti di miglioramento.
  `.trim();

  const chatCompletion = await client.chatCompletion({
    provider: "novita",
    model: "meta-llama/Llama-3.2-3B-Instruct",
    messages: [{ role: "user", content: prompt }]
  });

  // Solo la risposta AI
  return chatCompletion.choices[0].message.content;
}

(async () => {
  // Ricava la cartella e il nome base del CSV
  const csvPath = './tools/da analizzare.csv';
  const folder = require('path').dirname(csvPath);
  const baseName = require('path').basename(csvPath, require('path').extname(csvPath));
  // Per ogni business, salva un file separato con suffisso _ai.txt
  let idx = 0;
  for (const business of records) {
    const report = await analyzeBusiness(business);
    const outPath = require('path').join(folder, `${baseName}_${idx}_ai.txt`);
    fs.writeFileSync(outPath, `--- Report per ${business.noname} ---\n${report}\n`, 'utf8');
    console.log(`Report AI salvato in ${outPath}`);
    idx++;
  }
})(); 