const puppeteer = require('puppeteer')
const fs = require('fs')
const PNG = require('pngjs').PNG
const pixelmatch = require('pixelmatch')
var test = require('tape')
const request = require('request-promise-native')

const masterpieces = './tests/masterpieces/'
const testDir = './tests/testPics/'
let browser

puppeteer.launch({ args: ['--no-sandbox'] }).then(_browser => {
  browser = _browser
  test('default page downloaded alice', alice)
  test('test pausing', pause)
  test.onFinish(() => _browser.close())
})

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

async function testPage (url, file, t) {
  const page = await browser.newPage()
  page.setViewport({ width: 800, height: 600 })

  await page.goto(url)
  await page.waitFor(2000)
  await page.screenshot({ path: testDir + file })

  const cmp = await compareScreenshots(file)

  t.deepEqual(cmp.masterpiece.width, cmp.img.width, 'image widths are the same')
  t.deepEqual(cmp.masterpiece.height, cmp.img.height, 'image heights are the same')
  t.true(cmp.numDiffPixels < 100, 'image is not too different from masterpiece')
}

async function alice (t) {
  t.plan(3)
  await testPage('http://127.0.0.1:9999', 'alice.png', t)
  t.end()
}

async function pause (t) {
  t.plan(3)
  await request.post({ url: 'http://127.0.0.1:9999/rpc', json: { method: 'torrent-stop', arguments: { 'ids': ['722fe65b2aa26d14f35b4ad627d20236e481d924'] } } })
  await testPage('http://127.0.0.1:9999', 'pause.png', t)
  t.end()
}
