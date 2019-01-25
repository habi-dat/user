var mysql       = require('mysql');
var config      = require('../config/config.json');
var Promise   = require("bluebird");

Promise.promisifyAll(require("mysql/lib/Connection").prototype);

var connectDb = function() {
  var connection = mysql.createConnection(config.nextcloud.db);

  return connection.connectAsync().then(()=>{
    return connection;
  });

};

// only if uid or dn changed: change uid and dn in LDAP mapping
var modifyUser = function(user) {
    var cn = user.givenName + ' ' + user.surname;
    var dn = 'cn=' + cn.toLowerCase() + ',ou=users,'+ config.ldap.server.base;
    var changedDn = (user.surname != false || user.givenName != false) && dn.toLowerCase() != user.dn.toLowerCase();

  if (changedDn || user.changedUid != false && user.changedUid != "" && user.changedUid != user.uid) {
    return connectDb()
      .then((connection) => {
            var statement;

            if (changedDn) {
          statement = "update " + config.nextcloud.db.prefix + "_ldap_user_mapping set directory_uuid='" + user.changedUid + "', ldap_dn='" + dn + "' where ldap_dn='" + user.dn.toLowerCase() + "'";
        } else {
          statement = "update " + config.nextcloud.db.prefix + "_ldap_user_mapping set directory_uuid='" + user.changedUid + "' where ldap_dn='" + user.dn.toLowerCase() + "'";
        }
        return connection.queryAsync(statement).then((results) => {
          return connection.endAsync().then(() => {
            return results;
          });
        }, (error) => {
          connection.end();
          throw error;
        });
      })
      .then((results) => {
        return {status : true, message: "NEXTCLOUD: Benutzer*innen-UID Zuordnung upgedated (" + results.changedRows + ")"};
      })
      .catch((error) => {
        return {status: false, message: "NEXTCLOUD: Update der Benutzer*innen-UID fehlgeschlagen: " + error};
      });
  } else {
    return Promise.resolve({status: true, message: null});
  }
};

exports.register = function(hooks) {
  hooks.user.modify.post.push(modifyUser);
};