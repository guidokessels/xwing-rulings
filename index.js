const puppeteer = require("puppeteer");
const jsonfile = require("jsonfile");
const marked = require("marked");
const fs = require("fs");

const THREAD_URL = `https://community.fantasyflightgames.com/topic/277390-x-wing-official-rulings/`;

async function start() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"]
  });
  const page = await browser.newPage();
  let results = [];
  let pageNumber = 1;

  console.log("Fetching questions");
  await page.goto(`${THREAD_URL}?page=${pageNumber}`);

  const maxPages = await page.evaluate(() => {
    // "Page 1 of 2" => 2
    const pageOneOfMany = document.querySelector(".ipsPagination_pageJump")
      .innerText;
    return parseInt(pageOneOfMany.replace("Page 1 of ", "").trim(), 10);
  });
  console.log("Amount of pages:", maxPages);

  while (pageNumber <= maxPages) {
    console.log(`Scraping page ${pageNumber}/${maxPages}`);

    const items = await page.evaluate(() => {
      const comments = Array.from(
        document.querySelectorAll("[data-role=commentContent]")
      );
      return comments
        .filter(n => n.innerText.indexOf("A:") > -1)
        .map(n => {
          const [question, answer] = n.innerText.split("A:");
          return {
            question: question
              .replace("Q:", "")
              .trim()
              .replace(/\n/g, ""),
            answer: answer.trim().replace(/<([a-z ]*)>/g, (_, match) => {
              return (
                "[" +
                match
                  .toLowerCase()
                  .split(" ")
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(" ") +
                "]"
              );
            })
          };
        });
    });

    console.log(` Found ${items.length} questions`);

    results = results.concat(items);

    pageNumber++;
    await page.goto(`${THREAD_URL}?page=${pageNumber}`);
  }

  await browser.close();

  console.log("Saving JSON");
  jsonfile.writeFileSync("docs/xwing-rulings.json", results, { spaces: 2 });
  console.log("Done");

  console.log("Creating Markdown");
  const today = new Date().toGMTString();
  const header = `# X-Wing Official Rulings
Last updated: ${today}

This page is generated from the [Official Rulings thread](https://community.fantasyflightgames.com/topic/277390-x-wing-official-rulings/) at the FantasyFlightGames Community Forum. That is an official source for game rulings, in addition to all documents on the [X-Wing Second Edition website](https://www.fantasyflightgames.com/en/products/x-wing-second-edition/#/support-section).



`;
  const toc = results
    .map((i, index) => `* [${i.question}](#${index})`)
    .join("\n");
  const formatted = results.map(
    (i, index) => `
### _Question:_ ${i.question}
<a name="${index}"></a>

_Answer:_ ${i.answer}

`
  );

  const markdown = [header /*,toc*/, ...formatted].join("\n");
  fs.writeFileSync("docs/xwing-rulings.md", markdown);
  console.log("Done");

  console.log("Writing HTML");
  const head = `<head>
  <title>X-Wing Rulings (updated: ${today})</title>
  <link rel="stylesheet" href="https://sindresorhus.com/github-markdown-css/github-markdown.css">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>`;
  const html = marked(markdown, { gfm: true, breaks: true });
  const body = `<body><div class="markdown-body" style="max-width: 960px; margin: 20px auto;">${html}</div></body>`;
  const htmlWithCSS = `<html>${head}${body}</html>`;
  fs.writeFileSync("docs/index.html", htmlWithCSS);
}

start();
