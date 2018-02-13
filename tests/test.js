const WebTorrent = require('webtorrent')
const Tracker = require('bittorrent-tracker').Server
const fixtures = require('webtorrent-fixtures')
const puppeteer = require('puppeteer')
const fs = require('fs')
const PNG = require('pngjs').PNG
const pixelmatch = require('pixelmatch')
var test = require('tape')
const request = require('request-promise-native')

const masterpieces = './tests/masterpieces/'
const testDir = './tests/testPics/'
const endpoint = 'http://127.0.0.1:9999'
const hostnameTracker = '127.0.0.1'
const portTracker = 8008
let browser

const doTest = async () => {
  browser = await puppeteer.launch({ args: ['--no-sandbox'] })

  test('default page downloaded alice', alice)
  test('expanded view alice torrent', aliceDetails)
  test('test pausing', pause)
  test('test downloading', dl)
  test('test fileserver view', fileserver)

  test.onFinish(() => browser.close())
}

doTest()

function spawnTracker () {
  return new Promise((resolve, reject) => {
    const tracker = new Tracker({ udp: false, ws: false })
    tracker.listen(portTracker, hostnameTracker, () => resolve(tracker))
  })
}

function newClientSeedLeaves () {
  return new Promise((resolve, reject) => {
    const announce = [`http://${hostnameTracker}:${portTracker}/announce`]
    const client = new WebTorrent()
    client.seed(fixtures.leaves.contentPath, { announce }, t => resolve({ client, magnet: t.magnetURI }))
  })
}

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

async function testPageScreenshot (path, file, delay, t, x, y) {
  const page = await browser.newPage()
  page.setViewport({ width: 800, height: 600 })

  await page.goto(endpoint + path)
  await page.waitFor(delay)

  if (x && y) {
    await page.mouse.click(x, y, { clickCount: 2, delay: 100 })
  }

  await page.screenshot({ path: testDir + file })

  const cmp = await compareScreenshots(file)

  t.plan(3)
  t.deepEqual(cmp.masterpiece.width, cmp.img.width, 'image widths are the same')
  t.deepEqual(cmp.masterpiece.height, cmp.img.height, 'image heights are the same')
  t.true(cmp.numDiffPixels < 100, 'image is not too different from masterpiece')
  t.end()
}

async function alice (t) {
  await testPageScreenshot('/', 'alice.png', 1000, t)
}

async function aliceDetails (t) {
  await testPageScreenshot('/', 'aliceDetails.png', 1000, t, 300, 100)
}

async function pause (t) {
  await request.post({ url: endpoint + '/rpc', json: { method: 'torrent-stop', arguments: { 'ids': ['722fe65b2aa26d14f35b4ad627d20236e481d924'] } } })
  await testPageScreenshot('/', 'pause.png', 2000, t)
}

async function dl (t) {
  const tracker = await spawnTracker()
  const { client, magnet } = await newClientSeedLeaves()
  await request.post({ url: endpoint + '/rpc', json: { method: 'torrent-add', arguments: { paused: false, 'download-dir': '', filename: magnet } } })
  await testPageScreenshot('/', 'leaves.png', 8000, t)
  client.destroy()
  tracker.close()
}

async function fileserver (t) {
  await testPageScreenshot('/files', 'fileserver.png', 1000, t)
}
