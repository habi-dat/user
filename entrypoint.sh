#!/bin/bash
set -e

if [ -z "$HABIDAT_DOMAIN" ] && [ -z "$HABIDAT_USER_SUBDOMAIN" ] && [ -z "$HABIDAT_USER_LDAP_HOST" ] && [ -z "$HABIDAT_USER_LDAP_PORT" ] && [ -z "$HABIDAT_USER_LDAP_BINDDN" ] && [ -z "$HABIDAT_USER_LDAP_BASE" ] && [ -z "$HABIDAT_USER_LDAP_PASSWORD" ]
then
  echo "Generating config.json"
  envsubst < config/config.json.sample > config/config.json
fi

exec "$@"