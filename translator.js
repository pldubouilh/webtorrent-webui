const types = require('./types')

function getStats() {
  const dummyStats = JSON.parse(types.sessionStats)

  // dummyStats['cumulative-stats'].downloadedBytes = state.dl
  // dummyStats['cumulative-stats'].uploadedBytes = state.up
  return dummyStats
}

function wtToTransmissionTorrentDetail(wt, state) {
  const t = types.torrentDetail

  t.hashString = wt.infoHash
  t.id = wt.infoHash

  // If no metadata available
  if (!wt.name || !wt.files) {
    return Object.assign({}, t)
  }

  t.id             = wt.infoHash
  t.comment        = wt.comment
  t.percentDone    = wt.progress
  t.haveValid      = wt.downloaded
  t.pieceSize      = wt.pieceLength
  t.pieceCount     = wt.pieces ? wt.pieces.length : -1
  t.downloadedEver = wt.info   ? wt.info.length   : -1

  t.dateCreated = wt.created ? wt.created.getTime() : 9999999999

  t.fileStats = []
  t.files = []

  // Torrent state
  const unwantedFiles = state.unwanted[wt.infoHash] || []

  const files = wt.files || []
  t.fileStats = files.map((file, i) => ({
    bytesCompleted: file.downloaded,
    priority: 0,
    wanted: (file.progress >= 1) ? true : !unwantedFiles.includes(i),
  }))

  t.files = files.map(file => ({
    bytesCompleted: file.downloaded,
    length: file.length,
    name: file.name,
  }))

  // Can't use that yet
  // const trackers = wt.announce || []
  // t.trackerStats = trackers.map( (tracker, i) => {})

  t.trackerStats = []
  return Object.assign({}, t)
}

function wtToTransmissionTorrent(wt, state) {
  const t = types.torrent

  t.status             = state.paused[wt.infoHash] ? 0 : (wt.progress === 1 ? 6 : 4) // See types for details
  t.id                 = wt.infoHash
  t.peersConnected     = wt.numPeers
  t.peersGettingFromUs = wt.numPeers
  t.peersSendingToUs   = wt.numPeers

  // If no metadata available
  if (!wt.name || !wt.files) {
    t.percentDone = 0
    t.metadataPercentComplete = 0
    t.name = wt.name || wt.infoHash
    return Object.assign({}, t)
  }

  // We have metadata
  t.metadataPercentComplete = 1

  t.name         = wt.name
  t.isFinished   = wt.progress === 1
  t.eta          = wt.timeRemaining ? Math.floor(wt.timeRemaining / 1000) : 9999999999999
  t.downloadDir  = wt.path
  t.percentDone  = wt.progress
  t.rateDownload = state.paused[wt.infoHash] ? 0 : wt.downloadSpeed
  t.rateUpload   = state.paused[wt.infoHash] ? 0 : wt.uploadSpeed
  t.uploadRatio  = Math.floor(state.up[wt.infoHash] / wt.downloaded) || 0
  t.uploadedEver = state.up[wt.infoHash] || wt.uploaded

  // sizeWhenDone - leftUntilDone
  const total     = Math.floor(wt.downloaded / wt.progress)
  t.totalSize     = total
  t.sizeWhenDone  = total
  t.leftUntilDone = Math.floor(total - wt.downloaded)

  // Can't use that yet
  // const trackers = wt.announce || []
  // t.trackers = trackers.map( (tracker, i) => {
  //    return {
  //     id: i,
  //     tier: 0,
  //     announce: tracker,
  //     scrape: tracker,
  //   }
  // })
  t.trackers = []

  return Object.assign({}, t) // Fancy JSON.parse( JSON.stringify(t) ) ...
}

module.exports = {
  getStats,
  wtToTransmissionTorrent,
  wtToTransmissionTorrentDetail,
}
