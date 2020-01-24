var mysql       = require('mysql');
var config      = require('../config/config.json');
var request     = require('request-promise');
var xml         = require('xml-js');
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

var externalApps;
var externalAppsTime;

const getExternalAppsByUser = function(externalApps, currentUser) {
  return Promise.resolve()
    .then(() => {
      var externalAppsByUser = externalApps.filter(app => {
        if (app.groups && app.groups.length > 0) {
          if (currentUser && currentUser.memberGroups) {
            var enabled = false;
            app.groups.forEach(group => { 
              if (currentUser.memberGroups.includes(group)) {
                enabled = true;
              }
            })
            return enabled;
          } else {
            return false;
          }
        } else {
          return true;
        }
      })
      return externalAppsByUser.map(app => {
        return { 
          url:  app.redirect?app.url:'/index.php/apps/external/' + app.id,
          redirect: app.redirect,
          icon: app.icon,
          name: app.name,
          originalUrl: app.url
        }
      })      
    })
}

exports.getExternalApps = function(currentUser) {
  if (externalApps && Date.now() - externalAppsTime < 1000*60*60*24) {
    return getExternalAppsByUser(externalApps, currentUser);
  } else {
    return query('select configvalue from ' +  config.nextcloud.db.prefix + "_appconfig where appid='external' and configkey='sites'")
      .then((result) => {
        if (result.length > 0 && result[0].configvalue) {
          var externalAppsObject = JSON.parse(result[0].configvalue);
          externalApps = [];
          Object.keys(externalAppsObject).forEach(key => {
            externalApps.push(externalAppsObject[key]);
          })
          externalAppsTime = Date.now();
          return getExternalAppsByUser(externalApps, currentUser);
        } else {
          externalApps = {};
          externalAppsTime = Date.now();
          return externalApps;
        }        
      })
      .catch(error => {
        console.log('Nextcloud: Error getting external apps: ' + error);
        return {};
      })
  }
}

var enabledApps;
var enabledAppsTime;

const nextcloudApps = {
  files: {
    id: 'files',
    url: '/index.php/apps/files/',
    icon: 'files.svg',
    name: 'Dateien'
  },
  calendar: {
    id: 'calendar',
    url: '/index.php/apps/calendar/',
    icon: 'calendar.svg',
    name: 'Kalender'
  },
  contacts: {
    id: 'contacts',
    url: '/index.php/apps/contacts/',
    icon: 'contacts.svg',
    name: 'Kontakte' 
  },

  mail: {
    id: 'mail',
    url: '/index.php/apps/mail/',
    icon: 'mail.svg',
    name: 'E-Mail'
  },
  gallery: {
    id: 'gallery',
    url: '/index.php/apps/gallery/',
    icon: 'gallery.svg',
    name: 'Galerie'
  },
  tasks: {
    id: 'tasks',
    url: '/index.php/apps/tasks/',
    icon: 'tasks.svg',
    name: 'Aufgaben'
  },
  audioplayer: {
    id: 'audioplayer',
    url: '/index.php/apps/audioplayer/',
    icon: 'audioplayer.svg',
    name: 'Audio-Player'
  },
  spreed: {
    id: 'spreed',
    url: '/index.php/apps/spreed/',
    icon: 'spreed.svg',
    name: 'Talk'
  }
};

exports.getEnabledApps = function() {
  if (enabledApps && Date.now() - enabledAppsTime < 1000*60*60*24) {
    return Promise.resolve(enabledApps);
  } else {  
    var options = {
        uri: config.nextcloud.api.url + '/cloud/apps?filter=enabled',
        headers: {
            'OCS-APIRequest': 'true'
        }
    };
    return request(options)
      .then((responseXML) => {
        var response = xml.xml2js(responseXML, {compact: true});
        enabledApps = response.ocs.data.apps.element.map(app => {return app._text;});
        enabledAppsTime = Date.now();
        enabledApps = enabledApps.map(app => {
          if (nextcloudApps[app]) {
            return nextcloudApps[app];
          }
        }).filter(app => { return app?true:false; });
        return enabledApps;
      })
      .catch((error) => {
        console.log('Nextcloud: Error getting enabled apps: ' + error);
        return [];
      });    
  }
}

var appOrder;
var appOrderTime;

exports.getAppOrder = function() {
  if (appOrder && Date.now() - appOrder < 1000*60*60*24) {
    return Promise.resolve(appOrder);
  } else {
    return  query('select configvalue from ' +  config.nextcloud.db.prefix + "_appconfig where appid='apporder' and configkey='order'")      
      .then((result) => {
        if (result.length > 0 && result[0].configvalue) {
          appOrder = JSON.parse(result[0].configvalue);
          appOrderTime = Date.now();
        } else {
          appOrder = [];
          appOrderTime = Date.now();
        }        
        return appOrder;
      })
      .catch(error => {
        console.log('Nextcloud: Error getting app order: ' + error);
        return {};
      })
  }
};

exports.getMenuEntriesSorted = function (currentUser) {
  return Promise.join(exports.getExternalApps(currentUser), exports.getEnabledApps(), exports.getAppOrder(),
    (externalApps, enabledApps, appOrder) => {
      var combined = enabledApps.concat(externalApps);
      var findIndexOf = function(appOrder, url) {
        var index = appOrder.indexOf(url);
        if (index == -1) {
          appOrder.forEach((app, i) => {
            if (app.includes(url)) {
              index = i;
            }
          })
        }
        return index;
      }
      var combined = combined.sort((a, b) => {
        return findIndexOf(appOrder, a.url) > findIndexOf(appOrder, b.url)?1:-1;
      });
      return combined;
    })
}