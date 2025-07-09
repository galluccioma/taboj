# Taboj

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
   ```sh
   yarn
   # or
   npm install
   ```

---

## Usage

- **Development mode:**
  ```sh
  yarn dev
  # or
  npm run dev
  ```
  This will launch the Electron app with hot-reloading for the React frontend.

- **Production build:**
  ```sh
  yarn build
  # or
  npm run build
  ```

- **Package for distribution:**
  ```sh
  yarn dist
  # or
  npm run dist
  ```

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
  ```sh
  yarn lint
  # or
  npm run lint
  ```

---

## Build & Distribution

- **Build for production:**
  ```sh
  yarn build
  # or
  npm run build
  ```

- **Create distributable package:**
  ```sh
  yarn dist
  # or
  npm run dist
  ```

- **Platform-specific builds:**
  - Windows: `yarn dist:win`
  - macOS: `yarn dist:mac`
  - Linux: `yarn dist:linux`

---

## License

MIT

---

If you have any questions or need support, please open an issue or contact the author.
