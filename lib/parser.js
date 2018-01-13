const types = require('./types')

function getTorrent (torrentId, wt) {
  return {
    torrents: [ wt.state.torrentDetail[torrentId] ],
    removed: []
  }
}

function getTorrents (wt) {
  return {
    torrents: Object.values(wt.state.torrents),
    removed: wt.returnRemoved()
  }
}

function getActive (wt) {
  // Active is essentially torrents without totalSize, name, and addedDate...
  // But it doesnt seem to really care having too many arguments...
  return getTorrents(wt)
}

// Main parser
module.exports = function (q, wt) {
  let parsed = {}

  switch (q.method) {
    case 'session-get':
      parsed = JSON.parse(types.getSessionGet()) // Return dummy session data
      break

    case 'session-stats':
      parsed = wt.getStats()
      break

    case 'torrent-get':
      // Get all torrents
      if (!q.arguments.ids) {
        parsed = getTorrents(wt)

      // Recently active
      } else if (q.arguments.ids === 'recently-active') {
        parsed = getActive(wt)

      // Get one specific torrent
      } else if (q.arguments.ids[0]) {
        // ... in some sort of diff view - return all for the moment
        if (q.arguments.fields.length < 15) {
          parsed = getTorrent(q.arguments.ids[0], wt)

        // Full stuff
        } else {
          parsed = getTorrent(q.arguments.ids[0], wt)
        }
      }
      break

    case 'torrent-set':
      if (q.arguments['files-unwanted']) {
        wt.deselect(q.arguments.ids[0], q.arguments['files-unwanted'][0])
      } else if (q.arguments['files-wanted']) {
        wt.select(q.arguments.ids[0], q.arguments['files-wanted'][0])
      }
      break

    case 'torrent-start':
      q.arguments.ids.forEach(wt.resumeTorrent, wt)
      break

    case 'torrent-stop':
      q.arguments.ids.forEach(wt.pauseTorrent, wt)
      break

    case 'torrent-add':
      wt.addNew(q.arguments)
      break

    case 'torrent-remove':
      wt.remove(q.arguments)
      break

    default:
      break
  }

  return {
    arguments: parsed,
    result: wt.getSuccess()
  }
}
