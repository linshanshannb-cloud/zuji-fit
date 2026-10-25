#!/bin/bash
# render.sh in.html out.png W H scale
google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --force-device-scale-factor=${5:-3} --window-size=$3,$4 --virtual-time-budget=3000 --allow-file-access-from-files --screenshot="$2" "file://$1" 2>/dev/null
