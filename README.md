# habi*DAT user module

This app is a module for the habi\*DAT application platform. It acts as a simple overlay to the openLDAP user base and provides hooks to be able to change settings in the other modules of the platform, like Discourse and Nextcloud

## Installation

### Docker
(TBD) use the `Dockerfile` and `dev_entrypoint.sh` script.

### Manual

Check this repository out (there are no releases yet), run

  npm install

and create `config/config.json`.

## Configuration

A configuration file has to be present in `config/config.json`.
See `config/config.json.sample` for a sample configuration file.

Using the sample configuration file, most values can be directly set by using the following environment variables:
  * $HABIDAT_DOMAIN: the domain of your application and email-account
  * $HABIDAT_USER_SUBDOMAINA: used subdomain for web-application
  * SMTP Configuration:
    * $HABIDAT_USER_SMTP_HOST: SMTP host
    * $HABIDAT_USER_SMTP_PORT: SMTP port
  * LDAP Configuration:
  	* $HABIDAT_USER_LDAP_HOST: LDAP host
    * $HABIDAT_USER_LDAP_PORT: LDAP port
    * $HABIDAT_USER_LDAP_BINDDN: LDAP BindDN
    * $HABIDAT_USER_LDAP_BASE: LDAP BaseDN
	  * $HABIDAT_USER_LDAP_PASSWORD: LDAP Password
  * Discourse Configuration:
    * $HABIDAT_DISCOURSE_API_URL
  	* $HABIDAT_DISCOURSE_API_KEY
    * $HABIDAT_DISCOURSE_API_USERNAME
  * Nextcloud Configuration:
    * $HABIDAT_USER_NEXTCLOUD_DB_HOST
    * $HABIDAT_USER_NEXTCLOUD_DB_PORT
    * $HABIDAT_USER_NEXTCLOUD_DB_DATABASE
    * $HABIDAT_USER_NEXTCLOUD_DB_USER
    * $HABIDAT_USER_NEXTCLOUD_DB_PASSWORD

## Development

`dev_entrypoint.sh`

You can user `dev_entrypoint.sh` for development with docker. You need to mount the app directory from the host system to the /app directory of the container (using -v option).
