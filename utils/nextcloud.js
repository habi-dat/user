var mysql       = require('mysql');
var config      = require('../config/config.json');
var request     = require('request-promise');
var Promise   = require("bluebird");

Promise.promisifyAll(require("mysql/lib/Connection").prototype);

var connectDb = function() {
  var connection = mysql.createConnection(config.nextcloud.db);

  return connection.connectAsync().then(()=>{
    return connection;
  });

};

var externalApps;
var externalAppsTime;

exports.getExternalApps = function() {
  if (externalApps && Date.now() - externalAppsTime < 1000*60*60*24) {
    return Promise.resolve(externalApps);
  } else {
    return connectDb()
      .then((connection) => {
        var statement = 'select configvalue from ' +  config.nextcloud.db.prefix + "_appconfig where appid='external' and configkey='sites'";
        return connection.queryAsync(statement);
      })
      .then((result) => {
        if (result.length > 0 && result[0].configvalue) {
          externalApps = JSON.parse(result[0].configvalue);
          externalAppsTime = Date.now();
        } else {
          externalApps = {};
          externalAppsTime = Date.now();
        }        
        return externalApps;
      })
      .catch(error => {
        console.log('Error getting external apps: ' + error);
        return {};
      })
  }
}
