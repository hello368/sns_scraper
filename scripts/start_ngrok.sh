#!/bin/bash
# Start ngrok outside Hermes process manager control
kill $(pgrep -f "ngrok start --all") 2>/dev/null
sleep 1
nohup ngrok start --all --log=stdout > /tmp/ngrok.log 2>&1 &
echo "ngrok PID: $!"
sleep 3
# Verify
if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    echo "ngrok tunnels UP"
    curl -s http://localhost:4040/api/tunnels | python3 -c "import sys,json; d=json.load(sys.stdin); [print(t['public_url']) for t in d['tunnels']]"
else
    echo "ngrok FAILED" >&2
    exit 1
fi
