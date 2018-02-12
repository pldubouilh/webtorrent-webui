const fs = require('fs-extra')
const parseTorrent = require('parse-torrent')
const rimraf = require('rimraf')
const translate = require('./translator')

let Webtorrent = null

module.exports = HandlerWebtorrent

function HandlerWebtorrent (_torrentFolder, _downloadFolder, _verb, _hybrid) {
  this.torrentFolder = _torrentFolder
  this.downloadFolder = _downloadFolder
  this.verb = _verb

  this.webtorrentOpts = {
    path: _downloadFolder
    // checkLocalData: this.checkLocalData.bind(this)
  }

  this.pathStateFile = _torrentFolder + 'state.json'
  this.success = 'success'

  this.upBacklog = {}
  this.isAdded = {}
  this.removed = []

  console.log('\nWebtorrent' + (_hybrid ? ' hybrid' : '') + ' starting\n  torrent folder : ' + this.torrentFolder + '\n  download folder : ' + this.downloadFolder + '\n')

  Webtorrent = _hybrid ? require('webtorrent-hybrid') : require('webtorrent')
  this.client = new Webtorrent()

  try {
    this.state = JSON.parse(fs.readFileSync(this.pathStateFile, 'utf-8'))
  } catch (err) {
    console.log('No state file at ' + this.pathStateFile)
  }

  this.state = this.state || {}
  this.state.up = this.state.up || {}
  this.state.dl = this.state.dl || {}
  this.state.up.done = this.state.up.done || 0
  this.state.dl.done = this.state.dl.done || 0
  this.state.paused = this.state.paused || {}
  this.state.unwanted = this.state.unwanted || {}
  this.state.torrents = this.state.torrents || {}
  this.state.torrentDetail = this.state.torrentDetail || {}
  this.state.torrentFiles = this.state.torrentFiles || {}
  this.state.lastChecked = this.state.lastChecked || {}
  this.state.done = this.state.done || {}

  this.checkTimeInterval = 2 * 1000
  this.pingCount = 5

  const torrentFiles = fs.readdirSync(this.torrentFolder).filter(file => file.includes('.torrent'))
  torrentFiles.forEach(file => {
    let pt
    try {
      const fileRead = fs.readFileSync(this.torrentFolder + file, file.includes('.torrent.magnet') ? 'utf8' : null)
      pt = parseTorrent(fileRead)
    } catch (error) {
      return console.log('- Invalid torrent at ' + this.torrentFolder + file)
    }

    console.log(`- Adding ${file}`)
    this.state.torrentFiles[pt.infoHash] = this.torrentFolder + file

    // Don't start paused torrents
    if (this.state.paused[pt.infoHash]) return

    this.client.add(pt, this.webtorrentOpts, this.isAddedCb.bind(this))
  }, this)

  // Scan for deleted torrents that might still be in the state file
  const removedTorrentsInfoHash = Object.keys(this.state.torrentFiles).filter(infoHash => !torrentFiles.find(t => this.state.torrentFiles[infoHash].includes(t)))
  removedTorrentsInfoHash.forEach(this.rmTorrentFromState, this)

  setInterval(this.checkInterval.bind(this), this.checkTimeInterval)
}

HandlerWebtorrent.prototype.ping = function (now) {
  this.pingCount = 5
  if (now && typeof now === 'boolean') this.checkInterval.bind(this)()
}

HandlerWebtorrent.prototype.checkInterval = function () {
  if (!this.pingCount) return
  this.pingCount -= 1

  if (this.verb) console.log('\r\n# ' + new Date())

  // Reset peerlist
  Object.keys(this.state.torrentDetail).forEach(infoHash => { this.state.torrentDetail[infoHash].peers = [] })

  this.client.torrents.forEach(t => {
    if (!t.infoHash) return

    translate.wtToTransmissionTorrent.bind(this, t)()
    translate.wtToTransmissionTorrentDetail.bind(this, t)()

    // No metadata yet
    if (!t.name) return

    // Keep track of what's been downloaded in a backlog
    this.state.dl[t.infoHash] = t.downloaded
    this.state.up[t.infoHash] = t.uploaded - (this.upBacklog[t.infoHash] || 0) + (this.state.up[t.infoHash] || 0) // eslint-disable-line
    this.upBacklog[t.infoHash] = t.uploaded

    if (t.progress === 1) {
      this.state.done[t.infoHash] = true
      this.state.lastChecked[t.infoHash] = new Date().getTime()
    }

    if (this.verb) {
      console.log(`${t.name.slice(0, 10)} is complete: ${t.progress}, up: ${toSizeString(this.state.up[t.infoHash])}, dl: ${toSizeString(t.downloaded)}`)
    }
  })

  if (this.verb) {
    const up = Object.values(this.state.up).reduce((el, prev) => el + prev)
    const dl = Object.values(this.state.dl).reduce((el, prev) => el + prev)
    console.log(`Total dl: ${toSizeString(dl)}, up: ${toSizeString(up)}`)
  }

  this.storeState()
}

HandlerWebtorrent.prototype.isAddedCb = function (t) {
  console.log(`+ Added ${t.name}`)
  this.isAdded[t.infoHash] = true

  t.on('upload', this.ping)
  t.on('download', this.ping)

  this.deselectFiles(t)

  // Write torrent file, overwrite torrent.magnet file for the proper torrent when we have it
  if (this.state.torrentFiles[t.infoHash].includes('.torrent.magnet')) {
    rimraf(this.state.torrentFiles[t.infoHash], err => console.log(err || 'File deleted'))

    this.state.torrentFiles[t.infoHash] = this.torrentFolder + t.name + '.torrent'
    fs.writeFile(this.state.torrentFiles[t.infoHash], t.torrentFile, 'binary', printIfErr)
  }
}

HandlerWebtorrent.prototype.checkLocalData = async function (torrent, cb) {
  const isOver = !!this.state.done[torrent.infoHash]
  if (!isOver) return cb(null, false)

  for (let file of torrent.files) {
    try {
      const stat = await fs.stat(this.downloadFolder + file.path)
      if (stat.mtime.getTime() > this.state.lastChecked[torrent.infoHash]) {
        return cb(null, false)
      }
    } catch (e) { return cb(e) }
  }

  cb(null, true)
}

HandlerWebtorrent.prototype.addNew = function (args) {
  let pt

  // Magnets are in filename, Torrent files in metainfo
  const torrent = args.filename || Buffer.from(args.metainfo, 'base64')
  try {
    pt = parseTorrent(torrent)
  } catch (error) {
    this.success = "Can't parse torrent received"
    return console.log(this.success)
  }

  if (Object.keys(this.state.dl).includes(pt.infoHash)) {
    this.success = "Can't add a torrent we already have"
    return console.log(this.success)
  }

  this.isAdded[pt.infoHash] = false

  // Write torrent file or just the magnet link if we only have that
  const path = this.torrentFolder + (pt.name || pt.infoHash) + (pt.torrentFile ? '.torrent' : '.torrent.magnet')
  this.state.torrentFiles[pt.infoHash] = path
  fs.writeFile(path, pt.torrentFile || args.filename, pt.torrentFile ? 'binary' : 'utf8', printIfErr)

  this.client.add(pt, this.webtorrentOpts, this.isAddedCb.bind(this))

  // Detect stalled torrent
  setTimeout(() => {
    if (!this.isAdded[pt.infoHash]) {
      console.log('\n\n Detected stalled torrent, try rebooting the app. \n\n')
      // console.log('Trying to reboot stalled torrent')
      // client.destroy(() => {
      //   client = new Webtorrent()
      //   readLocalTorrents() // eslint-disable-line
      // })
    }
  }, 60 * 1000)
}

HandlerWebtorrent.prototype.remove = function (infoHash, rm) {
  if (!this.state.paused[infoHash]) {
    this.client.remove(infoHash)
  }

  // Keep tab of infohash in the removed array
  this.removed.push(infoHash)

  // Delete torrent file and local data if needed
  const filesToRm = [this.state.torrentFiles[infoHash]]
  if (rm) {
    filesToRm.push(this.downloadFolder + this.state.torrents[infoHash].name)
  }

  this.rmTorrentFromState(infoHash)
  filesToRm.forEach(file => rimraf(file, err => console.log(err || 'File deleted')))
}

HandlerWebtorrent.prototype.pauseTorrent = function (infoHash) {
  if (this.state.paused[infoHash]) return
  this.state.paused[infoHash] = true
  this.ping(true)
  this.client.remove(infoHash)
}

HandlerWebtorrent.prototype.resumeTorrent = function (infoHash) {
  if (!this.state.paused[infoHash]) return
  this.state.paused[infoHash] = false
  this.isAdded[infoHash] = false
  this.ping(true)
  this.client.add(this.state.torrentFiles[infoHash], this.webtorrentOpts, this.isAddedCb.bind(this))
}

HandlerWebtorrent.prototype.select = function (infoHash, wanted) {
  const i = this.state.unwanted[infoHash].indexOf(wanted)
  this.state.unwanted[infoHash].splice(i, 1)

  this.storeState()

  if (!this.state.paused[infoHash]) {
    const torrent = this.client.get(infoHash)
    torrent.files[wanted].select()
  }
}

HandlerWebtorrent.prototype.deselect = function (infoHash, unwanted) {
  // Init array and push unwanted items
  this.state.unwanted[infoHash] = this.state.unwanted[infoHash] || []
  this.state.unwanted[infoHash].push(unwanted)

  this.storeState()

  if (!this.state.paused[infoHash]) {
    this.deselectFiles(this.client.get(infoHash))
  }
}

HandlerWebtorrent.prototype.deselectFiles = function (torrent) {
  if (!torrent.pieces || !torrent.files) {
    return
  }

  const unwanted = this.state.unwanted[torrent.infoHash]
  if (!unwanted) return

  // BUG: Need to deselect all first - https://github.com/webtorrent/webtorrent/issues/164
  torrent.deselect(0, torrent.pieces.length - 1, false)
  torrent.files
    .sort((a, b) => (a.path > b.path ? 1 : -1))
    .forEach((file, i) => (unwanted.includes(i) ? file.deselect() : file.select()))
}

HandlerWebtorrent.prototype.rmTorrentFromState = function (infoHash) {
  // Keep stats and remove other info
  this.state.dl.done += this.state.dl[infoHash]
  this.state.up.done += this.state.up[infoHash]

  delete this.state.up[infoHash]
  delete this.state.dl[infoHash]
  delete this.state.paused[infoHash]
  delete this.state.torrentFiles[infoHash]
  delete this.state.torrents[infoHash]
  delete this.state.torrentDetail[infoHash]
}

HandlerWebtorrent.prototype.getStats = function () {
  return translate.getStats(this.state)
}

HandlerWebtorrent.prototype.getSuccess = function () {
  const _success = this.success
  this.success = 'success'
  return _success
}

HandlerWebtorrent.prototype.getRemoved = function () {
  return this.removed.splice(0, this.removed.length)
}

HandlerWebtorrent.prototype.getSession = function () {
  return translate.getSession()
}

HandlerWebtorrent.prototype.storeState = function () {
  fs.writeFile(this.pathStateFile, JSON.stringify(this.state, 0, 2), 'utf-8', printIfErr)
}

function toSizeString (bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  if (bytes === 0) return '0 B'
  const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)))
  return Math.round(bytes / (1024 ** i), 2) + ' ' + sizes[i]
}

function printIfErr (err) {
  if (err) console.error(err)
}
