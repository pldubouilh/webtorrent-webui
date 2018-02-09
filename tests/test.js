const puppeteer = require('puppeteer')
const fs = require('fs')
const PNG = require('pngjs').PNG
const pixelmatch = require('pixelmatch')
var test = require('tape')

const masterpieces = './tests/masterpieces/'
const testDir = './tests/testPics/'

function compareScreenshots (fileName) {
  return new Promise((resolve, reject) => {
    const img = fs.createReadStream(`${testDir}${fileName}`).pipe(new PNG()).on('parsed', doneReading)
    const masterpiece = fs.createReadStream(`${masterpieces}${fileName}`).pipe(new PNG()).on('parsed', doneReading)

    let filesRead = 0
    function doneReading () {
      if (++filesRead < 2) return

      // Do the visual diff.
      const diff = new PNG({ width: img.width, height: masterpiece.height })
      const numDiffPixels = pixelmatch(img.data, masterpiece.data, diff.data, img.width, img.height, { threshold: 0.1 })

      resolve({ img, masterpiece, numDiffPixels })
    }
  })
}

test('default page downloaded alice', async function (t) {
  t.plan(3)

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] })
  const page = await browser.newPage()
  const file = 'alice.png'

  page.setViewport({ width: 800, height: 600 })

  await page.goto(`http://127.0.0.1:9999`)
  await page.waitFor(2000)
  await page.screenshot({ path: testDir + file })

  await browser.close()

  const cmp = await compareScreenshots(file)

  t.deepEqual(cmp.masterpiece.width, cmp.img.width, 'image widths are the same')
  t.deepEqual(cmp.masterpiece.height, cmp.img.height, 'image heights are the same')
  t.true(cmp.numDiffPixels < 100, 'image is not too different from masterpiece')
  t.end()
})
