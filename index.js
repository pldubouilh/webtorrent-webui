#!/usr/bin/env node
const argv = require('yargs').argv
const restify = require('restify')
const parser = require('./parser')
const fs = require('fs')
const os = require('os')
const path = require('path')

const help = 'Webtorrent Web UI\n\
  -h  displays this message\n\
  -t  sets the torrent folder         - default ~/.torrent_folder\n\
  -d  sets the download folder        - default ~/Downloads\n\
  -v  gives a console status msg/sec  - default disabled \n\
  -l  sets the host to listen to      - default 127.0.0.1\n\
  -p  sets the port to listen to      - default 9081'

function die(msg, code) {
  console.log(msg)
  process.exit(code)
}

function start() {
  let tFolder  = argv.t || (os.homedir() + '/.torrent_folder/')
  let dlFolder = argv.d || (os.homedir() + '/Downloads/')
  const host   = argv.l || '127.0.0.1'
  const port   = argv.p || 9081
  const verb   = !!argv.v

  // Check input
  tFolder = tFolder.endsWith('/') ? tFolder : tFolder + '/'
  dlFolder = dlFolder.endsWith('/') ? dlFolder : dlFolder + '/'

  if (!fs.existsSync(tFolder)) {
    try {
      fs.mkdirSync(tFolder)
    } catch (e) { die("Can't create torrent folder", 1) }
  }

  if (!fs.existsSync(tFolder)) {
    try {
      fs.mkdirSync(tFolder)
    } catch (e) { die("Can't create download folder", 1) }
  }

  const server = restify.createServer()
  server.use(restify.plugins.acceptParser(server.acceptable))
  server.use(restify.plugins.bodyParser())

  // Serve static folder
  server.get(/\/?.*/, restify.plugins.serveStatic({
    directory: path.join(__dirname, '/static'),
    default: 'index.html',
    match: /^((?!index.js).)*$/,
  }))

  // Main endpoint for transmission ui
  server.post('rpc', (req, res, next) => {
    req.query = JSON.parse(req.body.toString('utf8'), 0, 2)
    res.json(parser.parse(req.query))
    return next()
  })

  console.log(`Web server starting on http://${host}:${port}`)

  parser.start(tFolder, dlFolder, verb)
  server.listen(parseInt(port), host)
}

if (argv.h || argv.help) {
  die(help, 0)
} else {
  start()
}
