#!/bin/bash

if [ ! -f config/MANUAL_CONFIG ]
then
  echo "Generating config.json"
  envsubst < config/config.json.sample > config/config.json
fi

./node_modules/nodemon/bin/nodemon.js --legacy-watch app.js --ignore './data/' --ignore './public/' --ignore './views/'
