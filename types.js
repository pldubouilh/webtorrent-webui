const sessionGet = '{"alt-speed-down":2048,"alt-speed-enabled":false,"alt-speed-time-begin":540,"alt-speed-time-day":127,"alt-speed-time-enabled":false,"alt-speed-time-end":1020,"alt-speed-up":99999,"blocklist-enabled":false,"blocklist-size":0,"blocklist-url":"http://www.example.com/blocklist","cache-size-mb":4,"config-dir":"/root/.config/transmission-daemon","dht-enabled":true,"download-dir":"/root/downloads","download-dir-free-space":152782405632,"download-queue-enabled":true,"download-queue-size":5,"encryption":"preferred","idle-seeding-limit":30,"idle-seeding-limit-enabled":false,"incomplete-dir":"/root/downloads","incomplete-dir-enabled":false,"lpd-enabled":false,"peer-limit-global":200,"peer-limit-per-torrent":50,"peer-port":51413,"peer-port-random-on-start":false,"pex-enabled":true,"port-forwarding-enabled":true,"queue-stalled-enabled":true,"queue-stalled-minutes":30,"rename-partial-files":true,"rpc-version":15,"rpc-version-minimum":1,"script-torrent-done-enabled":false,"script-torrent-done-filename":"","seed-queue-enabled":false,"seed-queue-size":10,"seedRatioLimit":153000,"seedRatioLimited":false,"speed-limit-down":100,"speed-limit-down-enabled":false,"speed-limit-up":100,"speed-limit-up-enabled":false,"start-added-torrents":true,"trash-original-torrent-files":false,"units":{"memory-bytes":1024,"memory-units":["KiB","MiB","GiB","TiB"],"size-bytes":1000,"size-units":["kB","MB","GB","TB"],"speed-bytes":1000,"speed-units":["kB/s","MB/s","GB/s","TB/s"]},"utp-enabled":true,"version":"2.92 (14714)"}'

const sessionStats = '{"activeTorrentCount":6,"pausedTorrentCount":1,"torrentCount":7,"uploadSpeed":99999,"downloadSpeed":5,"cumulative-stats":{"downloadedBytes":987654321,"filesAdded":987654321,"secondsActive":987654321,"sessionCount":987654321,"uploadedBytes":987654321},"current-stats":{"downloadedBytes":987654321,"filesAdded":1,"secondsActive":987654321,"sessionCount":1,"uploadedBytes":987654321}}'

const recentlyActive = {
  removed: [],
  torrents: [], // torrents are torrents from below, minus: addedDate, totalSize, name
}

const peer = {
  address: '22.22.22.22',
  clientIsChoked: true,
  clientIsInterested: false,
  clientName: 'Webtorrent 0.99',
  flagStr: 'TE',
  isDownloadingFrom: false,
  isEncrypted: true,
  isIncoming: false,
  isUTP: true,
  isUploadingTo: false,
  peerIsChoked: true,
  peerIsInterested: false,
  port: 22222,
  progress: 0,
  rateToClient: 0,
  rateToPeer: 0,
}

const tracker = {
  id: 0,
  tier: 0,
  announce: 'udp://super.tracker.org:1234',
  scrape: 'udp://super.tracker.org:1234',
}

const trackerDetail = {
  announce: 'udp://super.tracker.org:1234',
  announceState: 1,
  downloadCount: 11,
  hasAnnounced: true,
  hasScraped: true,
  host: 'udp://super.tracker.org:1234',
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
  scrape: 'udp://super.tracker.org:1234',
  scrapeState: 1,
  seederCount: 8,
  tier: 0,
}

const torrent = {
  addedDate: 1479579099,
  downloadDir: '/root/downloads',
  error: 0,
  errorString: '',
  eta: -1,
  id: 1,
  isFinished: false,
  isStalled: false,
  leftUntilDone: 0,
  metadataPercentComplete: 0,
  peersConnected: 0,
  peersGettingFromUs: 0,
  peersSendingToUs: 0,
  percentDone: 0,
  queuePosition: 0,
  rateDownload: 0,
  rateUpload: 0,
  recheckProgress: 0,
  seedRatioLimit: 55,
  seedRatioMode: 2,
  sizeWhenDone: 0,
  status: 4, // 0:pause, 1: queuesforverif, 2: veriflocal, 3:queuedDL, 4: dl, 5:queueSeed, 6: seed
  totalSize: 0,
  uploadRatio: 0,
  uploadedEver: 0,
  webseedsSendingToUs: 0,
  name: 'Books',
  trackers: [],
}

const torrentDetail = {
  activityDate: 1499751086,
  comment: '',
  corruptEver: 0,
  creator: '',
  dateCreated: 0,
  desiredAvailable: 0,
  downloadedEver: 832212,
  fileStats: [{
    bytesCompleted: 398534,
    priority: 0,
    wanted: true,
  }],
  files: [{
    bytesCompleted: 398534,
    length: 398534,
    name: 'Book, leaves and stuff',
  }],
  hashString: '1220123e74d01506447d548b7c2982ff47af82420',
  haveUnchecked: 0,
  haveValid: 832212,
  id: 1,
  isPrivate: false,
  peers: [],
  pieceCount: 51,
  pieceSize: 16384,
  startDate: 1499273528,
  trackerStats: [],
}

function clone(elt) {
  return JSON.parse(JSON.stringify(elt))
}

module.exports = {
  getSessionGet: () => sessionGet,
  getSessionStats: () => sessionStats,
  getRecentlyActive: () => clone(recentlyActive),
  getPeer: () => clone(peer),
  getTorrent: () => clone(torrent),
  getTracker: () => clone(tracker),
  getTorrentDetail: () => clone(torrentDetail),
  getTrackerDetail: () => clone(trackerDetail),
}
