const session = '{"alt-speed-down":2048,"alt-speed-enabled":false,"alt-speed-time-begin":540,"alt-speed-time-day":127,"alt-speed-time-enabled":false,"alt-speed-time-end":1020,"alt-speed-up":99999,"blocklist-enabled":false,"blocklist-size":0,"blocklist-url":"http://www.example.com/blocklist","cache-size-mb":4,"config-dir":"/root/.config/transmission-daemon","dht-enabled":true,"download-dir":"/root/downloads","download-dir-free-space":152782405632,"download-queue-enabled":true,"download-queue-size":5,"encryption":"preferred","idle-seeding-limit":30,"idle-seeding-limit-enabled":false,"incomplete-dir":"/root/downloads","incomplete-dir-enabled":false,"lpd-enabled":false,"peer-limit-global":200,"peer-limit-per-torrent":50,"peer-port":51413,"peer-port-random-on-start":false,"pex-enabled":true,"port-forwarding-enabled":true,"queue-stalled-enabled":true,"queue-stalled-minutes":30,"rename-partial-files":true,"rpc-version":15,"rpc-version-minimum":1,"script-torrent-done-enabled":false,"script-torrent-done-filename":"","seed-queue-enabled":false,"seed-queue-size":10,"seedRatioLimit":153000,"seedRatioLimited":false,"speed-limit-down":100,"speed-limit-down-enabled":false,"speed-limit-up":100,"speed-limit-up-enabled":false,"start-added-torrents":true,"trash-original-torrent-files":false,"units":{"memory-bytes":1024,"memory-units":["KiB","MiB","GiB","TiB"],"size-bytes":1000,"size-units":["kB","MB","GB","TB"],"speed-bytes":1000,"speed-units":["kB/s","MB/s","GB/s","TB/s"]},"utp-enabled":true,"version":"2.92 (14714)"}'

function getSession (state) {
  return JSON.parse(session) // dummy session so far
}

function getStats (state) {
  return {
    activeTorrentCount: 0,
    pausedTorrentCount: 0,
    torrentCount: 0,
    uploadSpeed: 0,
    downloadSpeed: 0,
    'cumulative-stats': {
      downloadedBytes: Object.values(state.dl).reduce((el, prev) => el + prev),
      filesAdded: 0,
      secondsActive: 0,
      sessionCount: 0,
      uploadedBytes: Object.values(state.up).reduce((el, prev) => el + prev)
    },
    'current-stats': {
      downloadedBytes: 0,
      filesAdded: 0,
      secondsActive: 0,
      sessionCount: 0,
      uploadedBytes: 0
    }
  }
}

// Quick overview on torrent
function wtToTransmissionTorrent (wt, state, isAdded) {
  const total = Math.floor(wt.downloaded / wt.progress)

  const t = {
    id: wt.infoHash,
    name: wt.name || wt.infoHash,
    recheckProgress: isAdded ? 1 : wt.progress,
    peersConnected: wt.numPeers || 0,
    peersGettingFromUs: wt.numPeers || 0,
    peersSendingToUs: wt.numPeers || 0,
    addedDate: 1479579099,
    downloadDir: wt.path || '/',
    error: 0,
    errorString: '',
    eta: wt.timeRemaining ? Math.floor(wt.timeRemaining / 1000) : 9999999999999,
    isFinished: wt.progress === 1,
    isStalled: false,
    leftUntilDone: Math.floor(total - wt.downloaded),
    metadataPercentComplete: 1,
    percentDone: wt.progress,
    queuePosition: 0,
    rateDownload: state.paused[wt.infoHash] ? 0 : wt.downloadSpeed,
    rateUpload: state.paused[wt.infoHash] ? 0 : wt.uploadSpeed,
    seedRatioLimit: 55,
    seedRatioMode: 2,
    sizeWhenDone: total,
    status: state.paused[wt.infoHash] ? 0 : (!isAdded ? 2 : (wt.progress === 1 ? 6 : 4)), // 0:pause, 1: queuesforverif, 2: veriflocal, 3:queuedDL, 4: dl, 5:queueSeed, 6: seed
    totalSize: total,
    uploadedEver: state.up[wt.infoHash] || wt.uploaded || 0,
    uploadRatio: (state.up[wt.infoHash] || wt.uploaded || 0) / (wt.downloaded || 1),
    webseedsSendingToUs: 0,
    trackers: []
  }

  // If no metadata available
  if (!wt.name || !wt.files || !wt.files.length) {
    t.metadataPercentComplete = 0
  }

  return t
}

// Larger overview on the torrent, its trackers, its peers...
function wtToTransmissionTorrentDetail (wt, state) {
  const t = {
    hashString: wt.infoHash,
    id: wt.infoHash,
    comment: wt.comment || '',
    percentDone: wt.progress || 0,
    haveValid: wt.downloaded || 0,
    pieceSize: wt.pieceLength || 0,
    pieceCount: wt.pieces ? wt.pieces.length : -1,
    downloadedEver: wt.info ? wt.downloaded : -1,
    activityDate: 1499751086,
    corruptEver: 0,
    creator: '',
    dateCreated: 0,
    desiredAvailable: 1,
    fileStats: [], // { bytesCompleted, priority, wanted }
    files: [], // { bytesCompleted, length, name }
    haveUnchecked: 0,
    isPrivate: false,
    peers: [],
    startDate: 0,
    trackerStats: []
  }

  const unwantedFiles = state.unwanted[wt.infoHash] || []
  const files = wt.files ? wt.files.sort((a, b) => (a.path > b.path ? 1 : -1)) : []

  files.forEach((file, i) => {
    t.files.push({
      bytesCompleted: Math.min(file.length, file.downloaded), // download can be higher than the actual length
      length: file.length,
      name: file.name
    })

    t.fileStats.push({
      bytesCompleted: file.downloaded,
      priority: 0,
      wanted: (file.progress >= 1) ? true : !unwantedFiles.includes(i)
    })
  })

  const trackers = wt.announce || []
  t.trackerStats = trackers.map(trackerName => {
    return {
      announce: trackerName,
      scrape: trackerName,
      host: trackerName,
      announceState: 1,
      downloadCount: 11,
      hasAnnounced: true,
      hasScraped: true,
      id: 0,
      isBackup: false,
      lastAnnouncePeerCount: 11,
      lastAnnounceResult: 'Success',
      lastAnnounceStartTime: 1500806166,
      lastAnnounceSucceeded: true,
      lastAnnounceTime: 1500806166,
      lastAnnounceTimedOut: false,
      lastScrapeResult: 'Could not connect to tracker',
      lastScrapeStartTime: 1500806150,
      lastScrapeSucceeded: true,
      lastScrapeTime: 1500806166,
      lastScrapeTimedOut: 0,
      leecherCount: 3,
      nextAnnounceTime: 1500807921,
      nextScrapeTime: 1500807970,
      scrapeState: 1,
      seederCount: 8,
      tier: 0
    }
  })

  const wires = wt.wires || []
  t.peers = wires
    .map(wire => {
      if (!wire.remoteAddress) return
      return {
        address: wire.remoteAddress,
        progress: wire.isSeeder ? 1 : 0.5,
        rateToClient: wire.downloadSpeed(),
        rateToPeer: wire.uploadSpeed(),
        clientIsChoked: true,
        clientIsInterested: false,
        clientName: 'Torrent',
        flagStr: 'TE',
        isDownloadingFrom: false,
        isEncrypted: false,
        isIncoming: false,
        isUTP: false,
        isUploadingTo: false,
        peerIsChoked: true,
        peerIsInterested: false,
        port: 22222
      }
    })
    .sort((a, b) => ((a.rateToPeer < b.rateToPeer) || (a.rateToClient < b.rateToClient)) ? 1 : -1)

  return t
}

module.exports = {
  getStats,
  getSession,
  wtToTransmissionTorrent,
  wtToTransmissionTorrentDetail
}
