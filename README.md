# Taboj

**Taboj** è il compagno perfetto per le agenzie di marketing: un'applicazione desktop costruita con Electron, React e TypeScript, progettata per automatizzare e semplificare una varietà di attività di estrazione e analisi dati dal web. Offre un'interfaccia intuitiva per estrarre dati da Google Maps, record DNS, domande "People Also Ask" di Google e per eseguire backup completi di siti web e audit SEO.

## Indice

- [Funzionalità](#funzionalità)
- [Installazione](#installazione)
- [Utilizzo](#utilizzo)
- [Moduli di Scraping](#moduli-di-scraping)
  - [Google Maps Scraper](#google-maps-scraper)
  - [DNS Scraper](#dns-scraper)
  - [People Also Ask (FAQ) Scraper](#people-also-ask-faq-scraper)
  - [Backup Sito & Audit SEO](#backup-sito--audit-seo)
- [Impostazioni & Personalizzazione](#impostazioni--personalizzazione)
- [Sviluppo](#sviluppo)
- [Build & Distribuzione](#build--distribuzione)
- [Licenza](#licenza)

---

## Funzionalità

- **Google Maps Scraper**: Estrae dettagli aziendali (nome, indirizzo, telefono, sito web, valutazioni, email, partita IVA, ragione sociale) dai risultati di ricerca di Google Maps.
- **DNS Scraper**: Raccoglie record DNS, stato HTTP/SSL e può eseguire controlli Lighthouse e Wayback Machine per i domini.
- **People Also Ask Scraper**: Raccoglie domande e risposte "People Also Ask" dai risultati di ricerca Google per le query fornite.
- **Backup Sito & Audit SEO**: Scarica pagine web (da sitemap o lista), cattura screenshot, analizza i metadati SEO, rileva banner analytics/cookie/CMS e salva tutti i dati in formato CSV.
- **Google Ads e Meta Scraper**: Raccoglie tutte le informazioni da Google Transparency e Meta Ad Library per gli utenti forniti.
- **Supporto Proxy**: Utilizzo opzionale di proxy per tutti gli scraper basati su Puppeteer.
- **Navigazione Headless/Non-headless**: Scegli tra automazione browser visibile o in background.
- **Esportazione CSV**: Tutti i moduli esportano i risultati in file CSV per un'analisi semplice.
- **Interfaccia Intuitiva**: UI moderna e reattiva con aggiornamenti di stato in tempo reale.

---

## Installazione

1. **Clona il repository:**
   ```sh
   git clone https://github.com/yourusername/taboj.git
   cd taboj
   ```

2. **Installa le dipendenze:**
   Installa le dipendenze del progetto utilizzando il tuo gestore di pacchetti preferito per progetti Node.js.

---

## Utilizzo

- **Modalità sviluppo:**
  Avvia l'applicazione in modalità sviluppo utilizzando il comando appropriato per il tuo ambiente Node.js. Questo avvierà l'app Electron con hot-reloading per il frontend React.

- **Build di produzione:**
  Esegui la build di produzione utilizzando il comando adatto al tuo ambiente.

- **Pacchetto per la distribuzione:**
  Crea il pacchetto distribuibile con il comando previsto dal tuo ambiente di sviluppo.

---

## Moduli di Scraping

### Google Maps Scraper

- **Scopo:** Estrae le attività da Google Maps in base alle query di ricerca.
- **Dati Raccolti:** Nome, indirizzo, telefono, sito web, valutazioni, numero di recensioni, email (dal sito), partita IVA, ragione sociale (tramite VIES), ecc.
- **Come funziona:** Usa Puppeteer con plugin stealth per navigare Google Maps, cliccare sulle schede aziendali ed estrarre i dettagli. Per ogni sito aziendale, recupera la homepage per estrarre email e partita IVA, e valida la partita IVA tramite il servizio VIES.
- **Output:** File CSV con tutti i dati aziendali estratti.

### DNS Scraper

- **Scopo:** Raccoglie record DNS e stato web per una lista di domini.
- **Dati Raccolti:** Record A, MX, TXT, CNAME, NS, AAAA e altri; stato HTTP; stato SSL; record A per il sottodominio mail; dati opzionali Lighthouse e Wayback Machine.
- **Come funziona:** Usa Node.js DNS e Axios per le interrogazioni, e può eseguire audit Lighthouse e controlli Wayback Machine per dati storici.
- **Output:** File CSV con tutti i dati DNS e di stato web.

### People Also Ask (FAQ) Scraper

- **Scopo:** Raccoglie domande "People Also Ask" e le relative risposte dai risultati di ricerca Google.
- **Dati Raccolti:** Domanda, risposta/descrizione e la query di ricerca originale.
- **Come funziona:** Usa Puppeteer per cercare su Google, espandere le domande "People Also Ask" ed estrarre il testo. Gestisce automaticamente CAPTCHA e consenso cookie.
- **Output:** File CSV con tutte le domande e risposte.

### Backup Sito & Audit SEO

- **Scopo:** Scarica e analizza pagine web per SEO e backup.
- **Dati Raccolti:** Screenshot (desktop & mobile), meta title/description, robots, keywords, header, immagini, link interni/esterni, dati strutturati, social tag, rilevamento analytics/cookie banner/CMS.
- **Come funziona:** Accetta una URL sitemap o una lista di URL, usa Puppeteer per visitare ogni pagina, cattura screenshot, analizza l'HTML per dati SEO, scarica media (opzionale) e salva report CSV per pagina e globali.
- **Output:** Cartella con screenshot, CSV per pagina e un CSV riepilogativo globale.

---

## Impostazioni & Personalizzazione

- **Proxy:** Puoi abilitare l'uso di proxy e specificare un proxy personalizzato per tutti gli scraper basati su Puppeteer.
- **Modalità Headless:** Scegli se i browser devono funzionare in background o visibilmente.
- **Cartella di Output:** Di default, i risultati sono salvati nella cartella `output/`, ma puoi specificare una cartella personalizzata.
- **Opzioni Avanzate:** Ogni modulo può avere opzioni aggiuntive (es. quali record DNS controllare, se eseguire Lighthouse/Wayback, ecc.).

---

## Sviluppo

- **Struttura del Codice:**
  - `src/scrapers/`: Tutta la logica di scraping (Maps, DNS, Ask, Backup).
  - `src/components/`: Componenti UI React.
  - `src/views/`: Viste principali per ogni scraper.
  - `electron/`: Script principali e preload di Electron.
  - `src/utils/`: Utility e configurazioni condivise.

- **Tecnologie Principali:**
  - React, TypeScript, Electron, Puppeteer, Cheerio, Axios, json-2-csv, fast-xml-parser, Lighthouse, TailwindCSS.

- **Linting:**
  Esegui il linting del codice con il comando adatto al tuo ambiente di sviluppo Node.js.

---

## Build & Distribuzione

- **Build per produzione:**
  Esegui la build di produzione con il comando appropriato per il tuo ambiente.

- **Crea pacchetto distribuibile:**
  Crea il pacchetto distribuibile con il comando previsto dal tuo ambiente.

- **Build specifiche per piattaforma:**
  Utilizza i comandi previsti dal tuo ambiente per creare build per Windows, macOS o Linux.

---

## Licenza

MIT

---

Per domande o supporto, apri una issue o contatta l'autore.

---

# English version

**Taboj** is your perfect marketing agency companion: a desktop application built with Electron, React, and TypeScript, designed to automate and simplify a variety of web data extraction and analysis tasks. It provides a user-friendly interface for scraping Google Maps business data, DNS records, Google "People Also Ask" questions, and for performing comprehensive website backups and SEO audits.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Scraping Modules](#scraping-modules)
  - [Google Maps Scraper](#google-maps-scraper)
  - [DNS Scraper](#dns-scraper)
  - [People Also Ask (FAQ) Scraper](#people-also-ask-faq-scraper)
  - [Site Backup & SEO Audit](#site-backup--seo-audit)
- [Settings & Customization](#settings--customization)
- [Development](#development)
- [Build & Distribution](#build--distribution)
- [License](#license)

---

## Features

- **Google Maps Scraper**: Extracts business details (name, address, phone, website, ratings, email, VAT, company name) from Google Maps search results.
- **DNS Scraper**: Collects DNS records, HTTP/SSL status, and can run Lighthouse and Wayback Machine checks for domains.
- **People Also Ask Scraper**: Gathers "People Also Ask" questions and answers from Google search results for given queries.
- **Site Backup & SEO Audit**: Downloads website pages (from sitemap or list), takes screenshots, analyzes SEO metadata, detects analytics/cookie banners/CMS, and saves all data in CSV format.
- **Google Ads and Meta Scraper**: Gathers all info from Google Transparency and Meta Ad Library given users.
- **Proxy Support**: Optional proxy usage for all Puppeteer-based scrapers.
- **Headless/Non-headless Browsing**: Choose between visible or background browser automation.
- **CSV Export**: All modules export results as CSV files for easy analysis.
- **User-friendly UI**: Modern, responsive interface with real-time status updates.

---

## Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/taboj.git
   cd taboj
   ```

2. **Install dependencies:**
   Install the project dependencies using your preferred Node.js package manager.

---

## Usage

- **Development mode:**
  Start the application in development mode using the appropriate command for your Node.js environment. This will launch the Electron app with hot-reloading for the React frontend.

- **Production build:**
  Run the production build using the command suitable for your environment.

- **Package for distribution:**
  Create the distributable package with the command provided by your development environment.

---

## Scraping Modules

### Google Maps Scraper

- **Purpose:** Extracts business listings from Google Maps based on search queries.
- **Data Collected:** Name, address, phone, website, ratings, number of reviews, email (from website), VAT number, company name (via VIES), etc.
- **How it works:** Uses Puppeteer with stealth plugins to navigate Google Maps, click on business cards, and extract details. For each business website, it fetches the homepage to extract email and VAT, and validates VAT via the VIES service.
- **Output:** CSV file with all extracted business data.

### DNS Scraper

- **Purpose:** Collects DNS records and web status for a list of domains.
- **Data Collected:** A, MX, TXT, CNAME, NS, AAAA, and other DNS records; HTTP status; SSL status; A record for mail subdomain; optional Lighthouse and Wayback Machine data.
- **How it works:** Uses Node.js DNS and Axios for lookups, and can run Lighthouse audits and Wayback Machine checks for historical data.
- **Output:** CSV file with all DNS and web status data.

### People Also Ask (FAQ) Scraper

- **Purpose:** Gathers "People Also Ask" questions and their answers from Google search results.
- **Data Collected:** Question, answer/description, and the original search query.
- **How it works:** Uses Puppeteer to search Google, expand "People Also Ask" questions, and extract the text. Handles CAPTCHA and cookie consent automatically.
- **Output:** CSV file with all questions and answers.

### Site Backup & SEO Audit

- **Purpose:** Downloads and analyzes website pages for SEO and backup purposes.
- **Data Collected:** Screenshots (desktop & mobile), meta title/description, robots, keywords, headers, images, internal/external links, structured data, social tags, analytics/cookie banners/CMS detection.
- **How it works:** Accepts a sitemap URL or list of URLs, uses Puppeteer to visit each page, takes screenshots, parses HTML for SEO data, downloads media (optional), and saves per-page and global CSV reports.
- **Output:** Folder with screenshots, per-page CSVs, and a global CSV summary.

---

## Settings & Customization

- **Proxy:** You can enable proxy usage and specify a custom proxy for all Puppeteer-based scrapers.
- **Headless Mode:** Choose whether browsers run in the background or visibly.
- **Output Folder:** By default, results are saved in an `output/` directory, but you can specify a custom folder.
- **Advanced Options:** Each module may have additional options (e.g., which DNS records to check, whether to run Lighthouse/Wayback, etc.).

---

## Development

- **Code Structure:**
  - `src/scrapers/`: Contains all scraping logic (Maps, DNS, Ask, Backup).
  - `src/components/`: React UI components.
  - `src/views/`: Main views for each scraper.
  - `electron/`: Electron main and preload scripts.
  - `src/utils/`: Shared utilities and config.

- **Main Technologies:**
  - React, TypeScript, Electron, Puppeteer, Cheerio, Axios, json-2-csv, fast-xml-parser, Lighthouse, TailwindCSS.

- **Run Linting:**
  Run code linting with the command suitable for your Node.js development environment.

---

## Build & Distribution

- **Build for production:**
  Run the production build with the appropriate command for your environment.

- **Create distributable package:**
  Create the distributable package with the command provided by your environment.

- **Platform-specific builds:**
  Use the commands provided by your environment to create builds for Windows, macOS, or Linux.

---

## License

MIT

---

If you have any questions or need support, please open an issue or contact the author.
