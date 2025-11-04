import fs from "fs";
import fetch from "node-fetch";
import { parse } from 'csv-parse/sync';


const API_KEY = "YOUR_API_KEY";

const queries = {
  Informativa: [
    "che cos’è l’intelligenza artificiale", "come funziona il cloud computing", "meteo Roma domani",
    "cos’è la blockchain", "come fare il pane in casa", "storia della Seconda Guerra Mondiale",
    "differenza tra IPv4 e IPv6", "come scrivere un CV efficace", "quali sono i sintomi dell’influenza",
    "tutorial su Photoshop", "come imparare a programmare in Python", "cos’è la dieta chetogenica",
    "come funziona l’energia solare", "tipi di pensione in Italia", "come creare un sito web gratis",
    "guida ai migliori film Netflix", "strategie per migliorare la memoria", "cos’è l’HTML",
    "come funziona un motore a combustione", "cosa significa SEO"
  ],
  Navigazionale: [
    "Facebook login", "Instagram ufficiale", "Amazon Italia", "YouTube", "Corriere della Sera",
    "LinkedIn login", "Wikipedia", "Netflix Italia", "Gmail", "Twitter ufficiale", "eBay Italia",
    "TripAdvisor", "Spotify Italia", "WhatsApp Web", "Apple Store Italia", "TikTok ufficiale",
    "Pinterest login", "Google Maps", "Booking.com", "Telegram ufficiale"
  ],
  Transazionale: [
    "Compra iPhone 15", "Prenota hotel a Firenze", "Scarica WhatsApp per PC", "Acquista AirPods Pro",
    "Iscriviti a Netflix", "Offerte voli Milano – New York", "Abbonamento Spotify Premium",
    "Prenota taxi a Roma", "Comprare biglietti concerto Vasco Rossi", "Scarica Microsoft Office",
    "Iscriviti a Amazon Prime", "Ordina pizza online Roma", "Noleggia auto a Milano", "Comprare libri su Amazon",
    "Prenotare tavolo ristorante Milano", "Acquista biglietti per il cinema", "Prenota volo per Londra",
    "Acquista biglietti per il concerto di Laura Pausini", "Prenota escursione a Pompei", "Acquista biglietti per il parco divertimenti Gardaland"
  ],
  "Comparazione commerciale": [
    "Miglior smartphone 2024", "Confronto iPhone vs Samsung Galaxy", "Miglior smartwatch economico",
    "Confronto tra abbonamenti Netflix e Disney+", "Migliori cuffie wireless 2024",
    "Confronto tra Huawei e Xiaomi", "Miglior aspirapolvere robot",
    "Confronto tra abbonamenti Spotify e Apple Music", "Miglior laptop per studenti",
    "Confronto tra fotocamere Canon e Nikon", "Miglior tablet per bambini",
    "Confronto tra abbonamenti Amazon Prime e Disney+", "Miglior frigorifero per famiglie",
    "Confronto tra modelli di auto elettriche", "Miglior televisore 4K",
    "Confronto tra marche di scarpe da corsa", "Miglior forno a microonde",
    "Confronto tra marche di occhiali da sole", "Miglior macchina da caffè",
    "Confronto tra marche di biciclette elettriche"
  ],
  Locale: [
    "Pizzeria vicino a me", "Farmacia aperta ora Milano", "Hotel economico Roma centro",
    "Supermercato aperto oggi Torino", "Bar con Wi-Fi Napoli", "Ristorante sushi Firenze",
    "Benzinaio più vicino", "Centro estetico Milano", "Dentista a Roma zona Prati",
    "Parcheggio pubblico Venezia", "Cinema vicino a me", "Palestra aperta ora Bologna",
    "Ristorante vegetariano Milano", "Ospedale più vicino", "Parco giochi per bambini Roma",
    "Biblioteca pubblica Torino", "Ufficio postale aperto oggi", "Mercato rionale Milano",
    "Stazione ferroviaria più vicina", "Chiesa aperta domenica"
  ],
  "Domanda/Risposta diretta": [
    "Età di Messi", "Che ore sono a New York", "Quanto dura un volo Roma – Tokyo",
    "Qual è la capitale del Giappone", "Chi ha vinto l’ultimo mondiale", "Quanti abitanti ha Milano",
    "Chi è il presidente italiano", "Quanto pesa un elefante africano", "Qual è il fiume più lungo del mondo",
    "Quando inizia il Black Friday", "Quali sono i pianeti del sistema solare",
    "Quanto costa un biglietto del cinema", "Qual è la valuta in Giappone", "Quanti centimetri in un metro",
    "Che temperatura fa oggi a Milano", "Quando è Natale", "Chi ha scritto “La Divina Commedia”",
    "Come si scrive “acqua” in inglese", "Dove si trova il Colosseo", "Qual è l’animale più veloce"
  ]
};

async function fetchAIOverview(query, tipo) {
  // Step 1: ricerca classica
  const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(query)}&hl=it&gl=it&api_key=${API_KEY}`;
  const res = await fetch(searchUrl);
  const data = await res.json();

  let ai = "no";
  let references = [];

  if (data.ai_overview && data.ai_overview.page_token) {
    ai = "si";
    const pageToken = data.ai_overview.page_token;

    // Step 2: fetch ai_overview
    const overviewUrl = `https://serpapi.com/search.json?engine=google_ai_overview&page_token=${pageToken}&api_key=${API_KEY}`;
    const res2 = await fetch(overviewUrl);
    const overview = await res2.json();

    if (overview.ai_overview && overview.ai_overview.references) {
      references = overview.ai_overview.references.map(r => r.link);
    }
  }

  return { tipo, query, ai, referenze: references.join(" | ") };
}

async function main() {
  const results = [];
  for (const [tipo, qs] of Object.entries(queries)) {
    for (const query of qs) {
      console.log(`⏳ Processing: [${tipo}] ${query}`);
      const row = await fetchAIOverview(query, tipo);
      results.push(row);
    }
  }

  // Salva CSV
  const csv = parse(results, { fields: ["tipo", "query", "ai", "referenze"] });
  fs.writeFileSync("serpapi_ai_overview.csv", csv, "utf8");
  console.log("✅ File salvato: serpapi_ai_overview.csv");
}

main().catch(console.error);
