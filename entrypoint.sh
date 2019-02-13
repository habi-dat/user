#!/bin/bash
set -e

envsubst < config/config.json.sample > config/config.json

exec "$@"