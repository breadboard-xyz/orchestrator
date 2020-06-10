TOKEN=`cat /run/secrets/doctl/token`
export DIGITALOCEAN_ACCESS_TOKEN=TOKEN
doctl auth init

node ./build/lib/index.js