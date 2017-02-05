var config    = require('../../config/config.json');
var discourse = require('discourse-sdk');

var client = new discourse(config.discourse.api-url, config.discourse.api-key, config.discourse.username);


var client = ldap.createClient({
  url: config.server.url
});

exports.fetchIsAdmin = function(userDn, done) {