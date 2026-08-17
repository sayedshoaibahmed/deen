const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.text().includes('AudioReady')) {
      console.log(msg.text());
    }
  });

  console.log('Testing Arabic -> English (Trial 1)');
  await page.goto('http://localhost:3000/listen/arabic');
  await page.waitForSelector('button:has-text("Al-Faatiha")');
  await page.click('button:has-text("Al-Faatiha")');
  await new Promise(r => setTimeout(r, 2000));
  
  await page.goto('http://localhost:3000/listen/english');
  await page.waitForSelector('button:has-text("Al-Faatiha")');
  await page.click('button:has-text("Al-Faatiha")');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing English -> Arabic (Trial 1)');
  await page.goto('http://localhost:3000/listen/arabic');
  await page.waitForSelector('button:has-text("Al-Faatiha")');
  await page.click('button:has-text("Al-Faatiha")');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing Arabic -> English (Trial 2)');
  await page.goto('http://localhost:3000/listen/english');
  await page.waitForSelector('button:has-text("Al-Faatiha")');
  await page.click('button:has-text("Al-Faatiha")');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing English -> Arabic (Trial 2)');
  await page.goto('http://localhost:3000/listen/arabic');
  await page.waitForSelector('button:has-text("Al-Faatiha")');
  await page.click('button:has-text("Al-Faatiha")');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing Arabic -> English (Trial 3)');
  await page.goto('http://localhost:3000/listen/english');
  await page.waitForSelector('button:has-text("Al-Faatiha")');
  await page.click('button:has-text("Al-Faatiha")');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Testing English -> Arabic (Trial 3)');
  await page.goto('http://localhost:3000/listen/arabic');
  await page.waitForSelector('button:has-text("Al-Faatiha")');
  await page.click('button:has-text("Al-Faatiha")');
  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
})();
