import puppeteer from 'puppeteer';
import minimist from 'minimist'
import { sleep } from '../lib/sleep.ts'
import { parseHtml } from '../lib/parse-kudo-text.ts';
import fs from 'fs'
import path from 'path';

interface Kudo {
  text: string
  imageUrl: string | null
  from: string
}

const args = minimist(process.argv.slice(2))
const board = args._[0]
const maxScroll = +(args.max ?? 50)
if (!board) {
  console.error("Please enter a board ID")
  process.exit(1)
}

const browser = await puppeteer.launch({ headless: false });
const page = await browser.newPage();
const width = 1080
const height = 4000
await page.setViewport({ width, height });
await page.goto(`https://www.kudoboard.com/boards/${board}`);

await page.click(".view-board-button");

const kudos: {
  [key: string]: null | Kudo
} = {}

// Get all kudos
const kudoIds = await page.$$eval('.kudo', kudos => kudos.map((kudo: any) => kudo.dataset.itemId as string))
kudoIds.map(id => kudos[id] = null)
console.error(`Found ${kudoIds.length} kudos`)
for (let i = 0; i < maxScroll && Object.values(kudos).findIndex(v => v === null) != -1; i++) {
  const elements = await page.$$('.kudo:not(.stubbed)')
  for (const element of elements) {
    const id: string = await element.evaluate((p: any) => p.dataset.itemId)
    if (kudos[id] != null) {
      continue;
    }
    const text = parseHtml(await element.$eval(".ProseMirror", t => t.innerHTML))
    const from = await element.$eval(".byline", t => t.children[1].textContent.slice(5))
    let imageUrl = null
    const video = await element.$("video")
    if (video === null) {
      const youtube = await element.$(".youtube")
      if (youtube === null) {
        const images = await element.$$(".kudo-image")
        for (const image of images) {
          const kudoImageSrc: string = await image.evaluate((i: any) => i.getAttribute("src"))
          if (kudoImageSrc) imageUrl = kudoImageSrc
        }
        if (images.length > 0 && imageUrl == null) {
          // The image still has its placeholder because we are too high up
          continue
        }
      } else {
        imageUrl = await youtube.evaluate((yt: any) => yt.dataset.url)
      }
    } else {
      imageUrl = await video.evaluate((v: any) => v.dataset.url)
    }
    kudos[id] = {
      text,
      imageUrl,
      from,
    }
  }
  console.error(`${Object.values(kudos).filter(k => k === null).length} kudos left...`)
  await page.mouse.wheel({
    deltaY: height
  })
  // Give time for images to load
  await sleep(2000)
}

const missed = Object.values(kudos).filter(k => k === null).length
if (missed > 0) {
  console.error(`Missed ${missed} kudo(s)`)
}

if (!fs.existsSync('output')) {
  fs.mkdirSync('output')
}
const date = new Date().toISOString().replaceAll(":", "-")
fs.mkdirSync(path.join('output', date))
const filename = path.join('output', date, 'kudo.json')
fs.writeFile(filename, JSON.stringify(kudos, null, 2), (err) => {
  if (err) {
    console.error(err);
    return;
  }
  // File written successfully
  console.error(`Kudos saved to ${filename}`);
});

await browser.close();
