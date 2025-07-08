import * as lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const url = process.argv[2];
if (!url) {
  console.error('No URL provided');
  process.exit(1);
}

(async () => {
  const chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  const options = {
    logLevel: 'error',
    output: 'json',
    port: chrome.port,
    emulatedFormFactor: 'mobile',
    throttlingMethod: 'simulate',
  };

  try {
    const runnerResult = await lighthouse.default(url, options);
    const lhr = runnerResult.lhr;
    const scores = {
      performance: lhr.categories.performance?.score ?? 0,
      accessibility: lhr.categories.accessibility?.score ?? 0,
      seo: lhr.categories.seo?.score ?? 0,
      bestPractices: lhr.categories['best-practices']?.score ?? 0,
      average:
        ((lhr.categories.performance?.score ?? 0) +
          (lhr.categories.accessibility?.score ?? 0) +
          (lhr.categories.seo?.score ?? 0) +
          (lhr.categories['best-practices']?.score ?? 0)) /
        4 *
        100,
    };
    console.log(JSON.stringify(scores));
  } catch (err) {
    console.error('[Lighthouse ERROR]', err);
    process.exit(2);
  } finally {
    await chrome.kill();
  }
})(); 