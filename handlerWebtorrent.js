const Webtorrent = require('webtorrent')
const fs = require('fs')
const parseTorrent = require('parse-torrent')
const rimraf = require('rimraf')
const translate = require('./translator')

const client = new Webtorrent()

let torrentFolder
let downloadFolder
let webtorrentOpts
let verb
let pathStateFile

const upBacklog = {}

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

let removed = []
let checkIntervalToken

function toSize(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
  return Math.round(bytes / (1024**i), 2) + ' ' + sizes[i]
}

function getState() {
  try {
    state = JSON.parse( fs.readFileSync(pathStateFile, 'utf-8') )
    state.up = state.up || {}
    state.dl = state.dl || {}
    state.up.done = state.up.done || 0
    state.dl.done = state.dl.done || 0
    state.paused  = state.paused  || {}
    state.unwanted = state.unwanted || {}
    state.torrents = state.torrents || {}
    state.torrentDetail = state.torrentDetail || {}
    state.torrentFiles  = state.torrentFiles  || {}
  } catch (err) {
    console.log('No state file at ' + pathStateFile)
  }
}

function storeState() {
  fs.writeFileSync(pathStateFile, JSON.stringify(state, 0, 2), 'utf-8')
}

function checkInterval() {
  clearTimeout(checkIntervalToken)
  checkIntervalToken = setTimeout( checkInterval, 5*1000 )

  if (verb) console.log( '-------------------' )

  client.torrents.forEach( t => {
    state.torrents[t.infoHash] = translate.wtToTransmissionTorrent(t, state)
    state.torrentDetail[t.infoHash] = translate.wtToTransmissionTorrentDetail(t, state)

    // No metadata yet
    if (!t.name) return

    // Keep track of what's been downloaded in a backlog
    state.dl[t.infoHash]  = t.downloaded
    state.up[t.infoHash] =  t.uploaded - (upBacklog[t.infoHash] || 0) + (state.up[t.infoHash] || 0) // eslint-disable-line
    upBacklog[t.infoHash] =  t.uploaded

    if (verb) {
      console.log(`${t.name.slice(0, 10)} is complete: ${t.progress}, up: ${toSize(state.up[t.infoHash])}, dl: ${toSize(t.downloaded)}`)
    }
  })

  const up = Object.values(state.up).reduce( (el, prev) => el + prev )
  const dl = Object.values(state.dl).reduce( (el, prev) => el + prev )

  if (verb) console.log(`Total dl: ${toSize(dl)}, up: ${toSize(up)}`)
  storeState()
}


function returnState() {
  checkInterval()
  return Object.assign({}, state)
}

function returnRemoved() {
  const toReturn = removed
  removed = []
  return toReturn
}

function pauseTorrent(infoHash) {
  if (state.paused[infoHash]) return
  state.paused[infoHash] = true
  checkInterval()
  client.remove(infoHash)
}

function resumeTorrent(infoHash) {
  if (!state.paused[infoHash]) return
  state.paused[infoHash] = false
  checkInterval()
  client.add( state.torrentFiles[infoHash] )
}

function deselectFiles(torrent) {
  if (!torrent.pieces || !torrent.files) {
    return
  }

  const unwanted = state.unwanted[torrent.infoHash]
  if (!unwanted) return

  // BUG: Need to deselect all first - https://github.com/webtorrent/webtorrent/issues/164
  torrent.deselect(0, torrent.pieces.length - 1, false)
  torrent.files.forEach( (file, i) => (unwanted.includes(i) ? file.deselect() : file.select()) )
}

function addNew(args) {
  let pt

  function cb(t) {
    console.log(`+ Added ${t.name}`)

    // We have meta - rewrite torrent file
    fs.unlinkSync(state.torrentFiles[t.infoHash])
    state.torrentFiles[t.infoHash] = torrentFolder + (t.name) + '.torrent'
    fs.writeFileSync(state.torrentFiles[t.infoHash], t.torrentFile,  'binary')

    // Immediatly stop torrent when we have the metadata
    if (state.paused[pt.infoHash]) {
      checkInterval()
      client.remove(t)
    }
  }

  // Magnets are in filename, Torrent files in metainfo
  const torrent = args.filename || Buffer.from(args.metainfo, 'base64')
  try {
    pt = parseTorrent(torrent)
  } catch (error) {
    return console.log("Can't parse torrent received")
  }

  if ( Object.keys(state.dl).includes(pt.infoHash) ) {
    return console.log("Can't add a torrent we already have")
  }

  client.add(pt, webtorrentOpts, cb)

  // Pause if needed
  state.paused[pt.infoHash] = !!args.paused

  // Write torrent file
  state.torrentFiles[pt.infoHash] = torrentFolder + (pt.name || pt.infoHash) + '.torrent'
  fs.writeFileSync(state.torrentFiles[pt.infoHash], pt.torrentFile, 'binary')
}

function remove(args) {
  args.ids.forEach( infoHash => {
    if (!state.paused[infoHash]) {
      client.remove(infoHash)
    }

    // Keep stats and remove other info
    state.dl.done += state.dl[infoHash]
    state.up.done += state.up[infoHash]

    // Keep tab of infohash in the removed array
    removed.push( infoHash )

    // Delete torrent and magnet file
    const filesToRm = [ state.torrentFiles[infoHash] ]

    // Delete local data if needed
    if ( args['delete-local-data'] ) {
      filesToRm.push( downloadFolder + state.torrents[infoHash].name)
    }

    filesToRm.forEach(file => rimraf(file, err => console.log(err || 'File deleted')))

    delete state.up[infoHash]
    delete state.dl[infoHash]
    delete state.paused[infoHash]
    delete state.torrentFiles[infoHash]
    delete state.torrents[infoHash]
    delete state.torrentDetail[infoHash]
  })
}

function select(infoHash, wanted) {
  const i = state.unwanted[infoHash].indexOf(wanted)
  state.unwanted[infoHash].splice(i, 1)

  storeState()

  if (!state.paused[infoHash]) {
    const torrent = client.get(infoHash)
    torrent.files[wanted].select()
  }
}

function deselect(infoHash, unwanted) {
  // Init array and push unwanted items
  state.unwanted[infoHash] = state.unwanted[infoHash] || []
  state.unwanted[infoHash].push(unwanted)

  storeState()

  if (!state.paused[infoHash]) {
    deselectFiles(client.get(infoHash))
  }
}

function getStats() {
  return translate.getStats(state)
}

// Loop over all the torrents in ./torrents
function start(tFolder, dlFolder, v) {
  torrentFolder = tFolder
  downloadFolder = dlFolder
  verb = v
  webtorrentOpts = {
    path: dlFolder,
  }

  pathStateFile = torrentFolder + 'state.json'

  console.log( `Webtorrent starting\n  torrent folder : ${torrentFolder}\n  download folder : ${downloadFolder}\n`)
  getState()
  checkInterval()

  fs.readdir(torrentFolder, (err, files) => {
    if (err || !files) {
      return console.log(err, files)
    }

    files = files.filter( file => file.includes('.torrent') )

    files.forEach( file => {
      let pt
      try {
        pt = parseTorrent(fs.readFileSync(torrentFolder + file))
      } catch (error) {
        return console.log('- Invalid torrent at ' + torrentFolder + file)
      }

      console.log(`- Adding ${file}`)

      state.torrentFiles[pt.infoHash] = torrentFolder + file

      // Don't start paused torrents
      if (state.paused[pt.infoHash]) return

      client.add(pt, webtorrentOpts, t => {
        console.log(`+ Added ${t.name}`)

        // Deselect previous deselected
        deselectFiles(t)

        // If we had magnet uri, write torrent file
        if (!t.name || !t.files) {
          fs.writeFile(state.torrentFiles[t.infoHash], t.torrentFile, 'binary')
        }
      })
    })
  })
}

module.exports = {
  client,
  start,
  getStats,
  returnState,
  returnRemoved,
  addNew,
  remove,
  pauseTorrent,
  resumeTorrent,
  select,
  deselect,
}
