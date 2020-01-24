var mysql       = require('mysql');
var config      = require('../config/config.json');
var request     = require('request-promise');
var Promise   = require("bluebird");

var connection = mysql.createConnection(config.nextcloud.db);

var query = function(query) {

  return new Promise((resolve, reject) => {
    connection.query(query, function (error, results, fields) {
      if (error) {
        reject(error);
      } else {
        resolve(results);
      }
    });    
  });
};

// only if uid or dn changed: change uid and dn in LDAP mapping
var modifyUser = function(user, currentUser) {
  var cn = user.cn;
  var dn = (user.cn != false?'cn=' + cn.toLowerCase() + ',ou=users,'+ config.ldap.server.base:user.dn);
  var changedDn = user.cn != false && dn.toLowerCase() != user.dn.toLowerCase();

  if (changedDn || user.changedUid && user.changedUid != "" && user.changedUid != user.uid) {
    var statement;

    if (changedDn) {
      statement = "update " + config.nextcloud.db.prefix + "_ldap_user_mapping set directory_uuid='" + user.changedUid + "', ldap_dn='" + dn + "' where ldap_dn='" + user.dn.toLowerCase() + "'";
    } else {
      statement = "update " + config.nextcloud.db.prefix + "_ldap_user_mapping set directory_uuid='" + user.changedUid + "' where ldap_dn='" + user.dn.toLowerCase() + "'";
    }
    return query(statement)
      .then((results) => {
        if (results.changedRows > 0) {
          return {status : true, message: "NEXTCLOUD: Benutzer*innen-UID Zuordnung upgedated (" + results.changedRows + ")"};
        } else {
          return {status: true, message: 'NEXTCLOUD: Benutzer*innen-UID Zuordnung nicht gefunden, überspringe Schritt'};
        }
        
      })
      .catch((error) => {
        return {status: false, message: "NEXTCLOUD: Update der Benutzer*innen-UID fehlgeschlagen: " + error};
      });
  } else {
    return Promise.resolve({status: true, message: null});
  }
};

// only if uid or dn changed: change uid and dn in LDAP mapping
var createUser = function(user, currentUser) {
  var options = {
      uri: config.nextcloud.api.url + '/cloud/users?search=' + user.cn,
      headers: {
          'OCS-APIRequest': 'true'
      }
  };
  return request(options)
    .then(() => {
      return {status : true, message: "NEXTCLOUD: Benutzer*in provisioniert"};
    })
    .catch((error) => {
      return {status: false, message: "NEXTCLOUD: Benutzer*innenprovisionierung fehlgeschlagen: " + error};
    });    
};

exports.register = function(hooks) {
  hooks.user.modify.post.push(modifyUser);
  hooks.user.create.post.push(createUser);
};