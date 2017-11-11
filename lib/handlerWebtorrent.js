const Webtorrent = require('webtorrent')
const fs = require('fs')
const parseTorrent = require('parse-torrent')
const rimraf = require('rimraf')
const translate = require('./translator')

let client = new Webtorrent()

let torrentFolder
let downloadFolder
let webtorrentOpts
let verb
let pathStateFile
let success

const upBacklog = {}

const isAdded = {}
let state = {}
state.paused = {}
state.up = {}
state.up.done = 0
state.dl = {}
state.dl.done = 0
state.unwanted = {}
state.torrents = {}
state.torrentDetail = {}
state.torrentFiles = {}

const removed = []
let checkIntervalToken

function toSize (bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
  return Math.round(bytes / (1024 ** i), 2) + ' ' + sizes[i]
}

function getSuccess () {
  const successCp = success
  success = 'success'
  return successCp
}

function getState () {
  try {
    state = JSON.parse(fs.readFileSync(pathStateFile, 'utf-8'))
    state.up = state.up || {}
    state.dl = state.dl || {}
    state.up.done = state.up.done || 0
    state.dl.done = state.dl.done || 0
    state.paused = state.paused || {}
    state.unwanted = state.unwanted || {}
    state.torrents = state.torrents || {}
    state.torrentDetail = state.torrentDetail || {}
    state.torrentFiles = state.torrentFiles || {}
  } catch (err) {
    console.log('No state file at ' + pathStateFile)
  }
}

function storeState () {
  fs.writeFileSync(pathStateFile, JSON.stringify(state, 0, 2), 'utf-8')
}

function checkInterval () {
  clearTimeout(checkIntervalToken)
  checkIntervalToken = setTimeout(checkInterval, 2 * 1000)

  if (verb) console.log('-------------------')

  // Reset peerlist
  Object.keys(state.torrentDetail).forEach(infoHash => { state.torrentDetail[infoHash].peers = [] })

  client.torrents.forEach(t => {
    if (!t.infoHash) return

    state.torrents[t.infoHash] = translate.wtToTransmissionTorrent(t, state, isAdded[t.infoHash])
    state.torrentDetail[t.infoHash] = translate.wtToTransmissionTorrentDetail(t, state, isAdded[t.infoHash])

    // No metadata yet
    if (!t.name) return

    // Keep track of what's been downloaded in a backlog
    state.dl[t.infoHash] = t.downloaded
    state.up[t.infoHash]  = t.uploaded - (upBacklog[t.infoHash] || 0) + (state.up[t.infoHash] || 0) // eslint-disable-line
    upBacklog[t.infoHash] = t.uploaded

    if (verb) {
      console.log(`${t.name.slice(0, 10)} is complete: ${t.progress}, up: ${toSize(state.up[t.infoHash])}, dl: ${toSize(t.downloaded)}`)
    }
  })

  if (verb) {
    const up = Object.values(state.up).reduce((el, prev) => el + prev)
    const dl = Object.values(state.dl).reduce((el, prev) => el + prev)
    console.log(`Total dl: ${toSize(dl)}, up: ${toSize(up)}`)
  }

  storeState()
}

function returnState () {
  return state
}

function returnRemoved () {
  return removed.splice(0, removed.length)
}

function pauseTorrent (infoHash) {
  if (state.paused[infoHash]) return
  state.paused[infoHash] = true
  checkInterval()
  client.remove(infoHash)
}

function resumeTorrent (infoHash) {
  if (!state.paused[infoHash]) return
  state.paused[infoHash] = false
  checkInterval()

  isAdded[infoHash] = false
  client.add(state.torrentFiles[infoHash], webtorrentOpts, () => {
    isAdded[infoHash] = true
  })
}

function deselectFiles (torrent) {
  if (!torrent.pieces || !torrent.files) {
    return
  }

  const unwanted = state.unwanted[torrent.infoHash]
  if (!unwanted) return

  // BUG: Need to deselect all first - https://github.com/webtorrent/webtorrent/issues/164
  torrent.deselect(0, torrent.pieces.length - 1, false)
  torrent.files
    .sort((a, b) => (a.path > b.path ? 1 : -1))
    .forEach((file, i) => (unwanted.includes(i) ? file.deselect() : file.select()))
}

function writeTorrentfile (infoHash, name, torrentFile) {
  // Overwrite torrent.magnet file for the proper torrent when we have it
  if (state.torrentFiles[infoHash].includes('.torrent.magnet')) {
    rimraf(state.torrentFiles[infoHash], err => console.log(err || 'File deleted'))

    state.torrentFiles[infoHash] = torrentFolder + name + '.torrent'
    fs.writeFileSync(state.torrentFiles[infoHash], torrentFile, 'binary')
  }
}

function addNew (args) {
  let pt

  function cb (t) {
    console.log(`+ Added ${t.name}`)
    isAdded[pt.infoHash] = true

    writeTorrentfile(t.infoHash, t.name, t.torrentFile)
  }

  // Magnets are in filename, Torrent files in metainfo
  const torrent = args.filename || Buffer.from(args.metainfo, 'base64')
  try {
    pt = parseTorrent(torrent)
  } catch (error) {
    success = "Can't parse torrent received"
    return console.log(success)
  }

  if (Object.keys(state.dl).includes(pt.infoHash)) {
    success = "Can't add a torrent we already have"
    return console.log(success)
  }

  isAdded[pt.infoHash] = false

  // Write torrent file
  const path = torrentFolder + (pt.name || pt.infoHash) + (pt.torrentFile ? '.torrent' : '.torrent.magnet')
  state.torrentFiles[pt.infoHash] = path
  fs.writeFileSync(path, pt.torrentFile || args.filename, pt.torrentFile ? 'binary' : 'utf8')

  client.add(pt, webtorrentOpts, cb)

  // Detect stalled torrent
  setTimeout(() => {
    if (!isAdded[pt.infoHash]) {
      console.log('\n\n Detected stalled torrent, try rebooting the app. \n\n')
      // console.log('Trying to reboot stalled torrent')
      // client.destroy(() => {
      //   client = new Webtorrent()
      //   readLocalTorrents() // eslint-disable-line
      // })
    }
  }, 60 * 1000)
}

function rmTorrentFromState (infoHash) {
  // Keep stats and remove other info
  state.dl.done += state.dl[infoHash]
  state.up.done += state.up[infoHash]

  delete state.up[infoHash]
  delete state.dl[infoHash]
  delete state.paused[infoHash]
  delete state.torrentFiles[infoHash]
  delete state.torrents[infoHash]
  delete state.torrentDetail[infoHash]
}

function remove (args) {
  args.ids.forEach(infoHash => {
    if (!state.paused[infoHash]) {
      client.remove(infoHash)
    }

    // Keep tab of infohash in the removed array
    removed.push(infoHash)

    // Delete torrent file and local data if needed
    const filesToRm = [ state.torrentFiles[infoHash] ]
    if (args['delete-local-data']) {
      filesToRm.push(downloadFolder + state.torrents[infoHash].name)
    }

    rmTorrentFromState(infoHash)
    filesToRm.forEach(file => rimraf(file, err => console.log(err || 'File deleted')))
  })
}

function select (infoHash, wanted) {
  const i = state.unwanted[infoHash].indexOf(wanted)
  state.unwanted[infoHash].splice(i, 1)

  storeState()

  if (!state.paused[infoHash]) {
    const torrent = client.get(infoHash)
    torrent.files[wanted].select()
  }
}

function deselect (infoHash, unwanted) {
  // Init array and push unwanted items
  state.unwanted[infoHash] = state.unwanted[infoHash] || []
  state.unwanted[infoHash].push(unwanted)

  storeState()

  if (!state.paused[infoHash]) {
    deselectFiles(client.get(infoHash))
  }
}

function getStats () {
  return translate.getStats(state)
}

function readLocalTorrents () {
  fs.readdir(torrentFolder, (err, files) => {
    if (err || !files) {
      return console.log(err, files)
    }

    files = files.filter(file => file.includes('.torrent'))

    const torrentFound = []

    files.forEach(file => {
      let pt
      try {
        const fileRead = fs.readFileSync(torrentFolder + file, file.includes('.torrent.magnet') ? 'utf8' : null)
        pt = parseTorrent(fileRead)
      } catch (error) {
        return console.log('- Invalid torrent at ' + torrentFolder + file)
      }

      console.log(`- Adding ${file}`)
      torrentFound.push(pt.infoHash)

      state.torrentFiles[pt.infoHash] = torrentFolder + file

      // Don't start paused torrents
      if (state.paused[pt.infoHash]) return

      client.add(pt, webtorrentOpts, t => {
        console.log(`+ Added ${t.name}`)
        isAdded[t.infoHash] = true

        // Write torrent file and select/deselect files
        writeTorrentfile(t.infoHash, t.name, t.torrentFile)
        deselectFiles(t)
      })
    })

    // Scan for deleted torrents that might still be in the state file
    Object.keys(state.torrentFiles).forEach(t => torrentFound.includes(t) || rmTorrentFromState(t))
  })
}

function start (tFolder, dlFolder, v) {
  torrentFolder = tFolder
  downloadFolder = dlFolder
  verb = v
  webtorrentOpts = {
    path: dlFolder
  }

  pathStateFile = torrentFolder + 'state.json'

  console.log(`Webtorrent starting\n  torrent folder : ${torrentFolder}\n  download folder : ${downloadFolder}\n`)
  getState()
  checkInterval()
  readLocalTorrents()
}

module.exports = {
  client,
  start,
  getStats,
  getSuccess,
  returnState,
  returnRemoved,
  addNew,
  remove,
  pauseTorrent,
  resumeTorrent,
  select,
  deselect
}
