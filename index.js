const puppeteer = require('puppeteer');
const jsonfile = require('jsonfile');
const fs = require('fs');

const THREAD_URL = `https://community.fantasyflightgames.com/topic/277390-x-wing-official-rulings/`;

async function start() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  let results = [];
  let pageNumber = 1;

  console.log('Fetching questions');
  await page.goto(`${THREAD_URL}?page=${pageNumber}`);

  const maxPages = await page.evaluate(() => {
    // "Page 1 of 2" => 2
    const pageOneOfMany = document.querySelector('.ipsPagination_pageJump').innerText;
    return parseInt(pageOneOfMany.replace('Page 1 of ', '').trim(), 10);
  });
  console.log('Amount of pages:', maxPages);

  while (pageNumber <= maxPages) {
    console.log(`Scraping page ${pageNumber}/${maxPages}`);

    const items = await page.evaluate(() => {
      const comments = Array.from(document.querySelectorAll('[data-role=commentContent]'));
      return comments.filter(n => n.innerText.indexOf('A:') > -1).map(n => {
        const [question, answer] = n.innerText.split('A:');
        return {
          question: question.replace('Q:', '').trim(),
          answer: answer.trim(),
        };
      });
    });

    results = results.concat(items);

    pageNumber++;
    await page.goto(`${THREAD_URL}?page=${pageNumber}`);
  }

  await browser.close();

  console.log('Saving JSON');
  jsonfile.writeFileSync('docs/xwing-rulings.json', results, { spaces: 2 });
  console.log('Done');

  console.log('Creating Markdown');
  const today = new Date().toGMTString();
  const header = `# X-Wing Official Rulings
Last updated: ${today}

This page is generated from the [Official Rulings thread](https://community.fantasyflightgames.com/topic/277390-x-wing-official-rulings/) at the FantasyFlightGames Community Forum. That is an official source for game rulings, in addition to all documents on the [X-Wing Second Edition website](https://www.fantasyflightgames.com/en/products/x-wing-second-edition/#/support-section).



`;
  const toc = results.map((i, index) => `* [${i.question}](#${index})`).join('\n');
  const formatted = results.map(
    (i, index) => `
### _Question:_ ${i.question}
<a name="${index}"></a>

_Answer:_ ${i.answer}

`
  );

  fs.writeFileSync('docs/index.md', [header /*,toc*/, ...formatted].join('\n'));
  console.log('Done');
}

start();
