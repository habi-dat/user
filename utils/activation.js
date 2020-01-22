var jsonfile = require('jsonfile');
var path = require('path');
var config    = require('../config/config.json');
var moment = require('moment');

var Promise = require("bluebird");

var activationStoreFile = path.join(__dirname, '../data/activationStore.json');

var readStore = function() {
  return new Promise((resolve, reject) => {
    jsonfile.readFile(activationStoreFile, function(err, obj) {
      if (!err) {
        resolve(obj);
      } else {
        resolve({});
      }
    })
  });
}

var saveStore = function (activationStore) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(activationStoreFile, activationStore, function (err) {
      if (!err) {
        resolve(activationStore);
      } else {
        reject(err);
      }
    })
  })
}

exports.createAndSaveToken = function(currentUser, data, validPeriod = 7*24, type=undefined) {

  return readStore()
    .then((store) => {
      //create random 64 character token
      var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
      var token = '';
      for (var i = 64; i > 0; --i) {
        token += chars[Math.round(Math.random() * (chars.length - 1))];
      }

      // create expiration date
      var expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + validPeriod);    

      store[token] = {
        created: Date.now(),
        expires: expiresAt,
        data: data,
        type: type,
        token: token
      }
      if (currentUser && currentUser.uid) {
        store[token].currentUser = 
          {
            uid: currentUser.uid,
            dn: currentUser.dn,
            cn: currentUser.cn
          };
      }
      return saveStore(store)
        .then((store) => {
          return store[token];
        });
    })
};


exports.refreshToken = function(currentUser, token, validPeriod = 7*24) {

  return readStore()
    .then((store) => {
      if (!store[token]) {
        throw "Token nicht gefunden";
      } else {
        store[token].expires = new Date();
        store[token].expires.setHours(store[token].expires.getHours() + validPeriod); 
        store[token].currentUser = {
            uid: currentUser.uid,
            dn: currentUser.dn,
            cn: currentUser.cn
          };
        store[token].created = Date.now();

        return saveStore(store)
          .then((store) => {
            return store[token];
          });        
      }
      
    })
};

exports.getInvites = function(currentUser) {
  return readStore()
    .then(store => { 
      var invites = [];
      Object.keys(store).map(token => {
        if (store[token].type && store[token].type == 'invite') {
          invites.push(store[token]);
        }
      })
      return invites;
    });
}

exports.isTokenValid = function(token) {

  return readStore()
    .then((store) => { 
      if (store[token]) {
        if (moment(store[token].expires).isAfter(moment())) {
          return store[token];  
        } else {
          throw "Token abgelaufen";
        }
      } else {
        throw "Token nicht gefunden"
      }
    });
};



exports.getTokenByData = function(value, path, type=undefined) {

  return readStore()
    .then((store) => { 
      var foundToken = Object.keys(store).find((token) => {
        if ((!type || store[token].type == type) && store[token].data[path] == value) {
          return true;
        } else {
          return false;
        }
      })
      if (foundToken) {
        return store[foundToken];          
      } else {
        throw "Token nicht gefunden"
      }
    });
};

exports.deleteToken = function(token) {

  return readStore()
    .then((store) => { 
      if (store[token]) {
        delete store[token];
        return saveStore(store);  
      } else {
        throw "Token nicht gefunden"
      }
    });
};

exports.getToken = function(token) {

  return readStore()
    .then((store) => { 
      if (store[token]) {
        return store[token];
      } else {
        throw "Token nicht gefunden"
      }
    });
};