#!/usr/bin/env node
const argv = require('yargs').argv
const fs = require('fs')
const os = require('os')
const path = require('path')
const bodyParser = require('body-parser')
const ecstatic = require('ecstatic')
const parser = require('./lib/parser')

const express = require('express')
const app = express()

const help = `Webtorrent Web UI
   -h  displays this message
   -t  sets the torrent folder         - default ~/.torrent_folder
   -d  sets the download folder        - default ~/Downloads
   -v  gives a console status msg/sec  - default disabled
   -l  sets the host to listen to      - default 127.0.0.1
   -p  sets the port to listen to      - default 9081`

function die (msg, code) {
  console.log(msg)
  process.exit(code)
}

function start () {
  let tFolder = argv.t || (os.homedir() + '/.torrent_folder/')
  let dlFolder = argv.d || (os.homedir() + '/Downloads/')
  const host = argv.l || '127.0.0.1'
  const port = argv.p || 9081
  const verb = !!argv.v

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

  app.get(/files/, ecstatic({
    root: dlFolder,
    baseDir: '/files',
    showdir: true
  }))

  app.get(/\//, express.static(path.join(__dirname, '/static')))

  var jsonParser = bodyParser.json()
  app.post('/rpc/', jsonParser, (req, res, next) => {
    res.json(parser.parse(req.body))
  })

  app.listen(parseInt(port), host, (err) => {
    if (err) die(err, 1)
    parser.start(tFolder, dlFolder, verb)
    console.log(`Starting at http://${host || '127.0.0.1'}:${port}`)
  })
}

if (argv.h || argv.help) {
  die(help, 0)
} else {
  start()
}
