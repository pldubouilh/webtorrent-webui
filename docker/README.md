Simple example docker image to run webtorrent-web-ui. Only exposes the UI port to 127.0.0.1, and allows to use openvpn beforehand if a file has been set in vpn-conf.

If you don't want to use a VPN, just keep the folder as is, the dummy file will be copied to the image, and openvpn will fail starting.

Build with
```
docker build --tag wt  .
```

And run with
```
docker run -d --cap-add=NET_ADMIN --device=/dev/net/tun -p 127.0.0.1:9081:9081 -v ~/Downloads:/data -v ~/.torrent_folder:/tf wt
```

* The --cap-add and --device options are only needed for openvpn
* The two mountpoints with -v are basically mountpoints from your filesyste
