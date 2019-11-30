const argv = require('yargs').argv
const fs = require('fs')
const os = require('os')
const path = require('path')

let help = `Webtorrent Web UI
   -h  displays this message
   -t  sets the torrent folder          - default ~/.torrent_folder
   -d  sets the download folder         - default ~/Downloads
   -v  gives a console status msg/sec   - default disabled
   -l  sets the host to listen to       - default 127.0.0.1
   -p  sets the port to listen to       - default 9081
   -a  sets the DHT listen UDP port     - default 7000
   -o  sets the Torrent listen TCP port - default 7000`

function die (msg, code) {
  console.log(msg)
  process.exit(code)
}

module.exports = function start (hybrid) {
  if (hybrid) {
    help = help + '\r\nThis hybrid version runs webtorrent-hybrid'
  }

  if (argv.h || argv.help) { return die(help, 0) }

  let tFolder = argv.t || (os.homedir() + '/.torrent_folder/')
  let dlFolder = argv.d || (os.homedir() + '/Downloads/')
  const host = !argv.l ? ['127.0.0.1'] : typeof argv.l === 'string' ? [argv.l] : argv.l
  const port = argv.p ? parseInt(argv.p) : 9081
  const verb = !!argv.v
  const dhtPort = argv.a ? parseInt(argv.a) : 7000
  const torrentPort = argv.o ? parseInt(argv.o) : 7000

  // Check input
  tFolder = tFolder.endsWith('/') ? tFolder : tFolder + '/'
  dlFolder = dlFolder.endsWith('/') ? dlFolder : dlFolder + '/'

  if (!fs.existsSync(tFolder)) {
    try {
      fs.mkdirSync(tFolder)
    } catch (e) { die("Can't create torrent folder", 1) }
  }

  if (!fs.existsSync(dlFolder)) {
    try {
      fs.mkdirSync(dlFolder)
    } catch (e) { die("Can't create download folder", 1) }
  }

  const bodyParser = require('body-parser')
  const ecstatic = require('ecstatic')
  const express = require('express')
  const app = express()
  const parser = require('./lib/parser')
  const HandlerWebtorrent = require('./lib/handlerWebtorrent')
  let handler

  app.all('*', (req, res, next) => {
    if (host.includes(req.hostname)) {
      next()
    } else {
      res.writeHead(403, { 'Connection': 'close' })
      res.end()
    }
  })

  app.get(/files/, ecstatic({
    root: dlFolder,
    baseDir: '/files',
    showdir: true
  }))

  app.get(/\//, express.static(path.join(__dirname, '/static')))

  var jsonParser = bodyParser.json()
  app.post('/rpc/', jsonParser, (req, res, next) => {
    res.json(parser(req.body, handler))
  })

  app.listen(port, host, (err) => {
    if (err) die(err, 1)

    console.log(`Starting at ${host.map(t => '\r\n  http://' + t + ':' + port)}`)
    handler = new HandlerWebtorrent(tFolder, dlFolder, verb, hybrid, dhtPort, torrentPort)
  })

  process.on('SIGTERM', function () {
    handler.destroy(() => process.exit(0))
  })
}
