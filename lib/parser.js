const types = require('./types')
const wt = require('./handlerWebtorrent')

function getTorrent (torrentId) {
  return {
    torrents: [ wt.returnState().torrentDetail[torrentId] ],
    removed: []
  }
}

function getTorrents () {
  return {
    torrents: Object.values(wt.returnState().torrents),
    removed: wt.returnRemoved()
  }
}

function getActive () {
  // Active is essentially torrents without totalSize, name, and addedDate...
  // But it doesnt seem to really care having too many arguments...
  return getTorrents()
}

// Main parser
function parse (q) {
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
        parsed = getTorrents()

      // Recently active
      } else if (q.arguments.ids === 'recently-active') {
        parsed = getActive()

      // Get one specific torrent
      } else if (q.arguments.ids[0]) {
        // ... in some sort of diff view - return all for the moment
        if (q.arguments.fields.length < 15) {
          parsed = getTorrent(q.arguments.ids[0])

        // Full stuff
        } else {
          parsed = getTorrent(q.arguments.ids[0])
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
      q.arguments.ids.forEach(wt.resumeTorrent)
      break

    case 'torrent-stop':
      q.arguments.ids.forEach(wt.pauseTorrent)
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

module.exports = {
  start: wt.start,
  parse
}
