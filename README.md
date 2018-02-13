Webtorrent Web UI
=============

[![Build Status](https://travis-ci.org/pldubouilh/webtorrent-webui.svg?branch=master)](https://travis-ci.org/pldubouilh/webtorrent-webui)

![screenshot](https://i.imgur.com/ZyW6Sp4.png)

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

Checkout the [docker folder](https://github.com/pldubouilh/webtorrent-webui/tree/master/docker) for an example docker image running with OpenVPN.

A version of webtorrent-webui fueled by webtorrent-hybrid is also available ! Checkout [webtorrent-webui-hybrid](https://github.com/pldubouilh/webtorrent-webui-hybrid).

### Todo:
  - [x] Modernize UI: drag'n'drop torrents, paste magnetlinks...
  - [x] Rename things properly
  - [x] Spin file server with downloaded files
  - [x] Tests
  - [ ] Use sass, revert hardcoded CSS
