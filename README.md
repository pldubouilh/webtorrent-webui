Webtorrent Web UI
=============

![screenshot](https://i.imgur.com/Dduiv0K.png)

A simple-yet-complete web user interface for Webtorrent. Based on the [Transmission](https://transmissionbt.com/) web UI, and of course [Webtorrent](https://webtorrent.io) for the torrenting bit.

```sh
# Install
$ npm i -g webtorrent-webui

# Run
$ webtorrent-webui -h

Webtorrent Web UI
  -h  displays this message
  -t  sets the torrent folder         - default ~/.torrent_folder
  -d  sets the download folder        - default ~/Downloads
  -v  gives a console status msg/sec  - default disabled
  -l  sets the host to listen to      - default 127.0.0.1
  -p  sets the port to listen to      - default 9081
```


Todo:
  - [x] Modernize UI: drag'n'drop torrents, paste magnetlinks...
  - [ ] Rename things properly
  - [x] Option to spin webserver to download files
  - [ ] Use sass, revert hardcoded CSS
  - [ ] Password protect (maybe?)
