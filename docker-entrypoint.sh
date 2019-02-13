#!/bin/bash
set -e

if [ ! -f config/MANUAL_CONFIG ]
then
  echo "Generating config.json"
  envsubst < config/config.json.sample > config/config.json
fi

exec "$@"