echo "\n\n++++++++++ Checking IP ++++++++++ "
curl -s ifconfig.co
sleep 5

echo "\n\n++++++++++ Startig up VPN ++++++++++ "
openvpn vpn.conf &
sleep 10

echo "\n\n++++++++++ Re checking IP ++++++++++ "
curl -s ifconfig.co

echo "\n\n++++++++++ Starting torrent engine ++++++++++ "
webtorrent-webui -l 0.0.0.0 -t /tf -d /data
