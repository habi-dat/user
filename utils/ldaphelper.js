var ldap = require('ldapjs');
var ssha = require('openldap_ssha');
var config    = require('../config/config.json').ldap;
var discourse = require('./discoursehelper');
var mail = require('./mailhelper');
var client = ldap.createClient({
  url: config.server.url
});
client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
    if (err) {
        console.log('Error connecting LDAP: ' + err);
    }
});


var passwordValid = function(password) {

    console.log("Passwort: " + password + " match: " +password.match('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*_=+-]).{8,30}$'));

    return password.match('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*_=+-]).{8,30}$') != null;
}

exports.fetchIsAdmin = function(userDn, done) {
    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });

    var opts = {
    };

    var admin = null;

    client.search('cn=admin,ou=groups,'+config.server.base, opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('groupentry: '+ JSON.stringify(entry.object));
            console.log('isAdmingroup: ' + JSON.stringify(entry.object.member));
            if (entry.object.member && entry.object.member.indexOf(userDn) > -1){
                admin = true;
            } else {
                admin = false;
            }

        });
          res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            console.error('error: ' + err.message);
        });
        res.on('end', function(result) {
            console.log('status: ' + result.status);
            done(admin);
        });
    });
    
};

exports.fetchGroups = function(done) {
/*    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });*/

    var opts = {
        scope: 'sub'
    };
    
    var entries = [];

    client.search('ou=groups,'+config.server.base, opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('groupentry: '+ JSON.stringify(entry.object));
            //console.log(JSON.stringify(entry.object.member));
            entries.push(entry.object);
        });
          res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            done(null, 'Error fetching LDAP groups: ' + err.message);
        });
        res.on('end', function(result) {
            console.log('status: ' + result.status);
            entries.sort(function(a, b){
                if (a.cn) {
                    return a.cn.localeCompare(b.cn);
                }
                return 0;
            });
            done(entries);
        });
    });
};

exports.fetchOwnedGroups = function(currentUser, done) {
    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });

    var opts = {
        scope: 'sub'
    };
    
    var entries = [];

    client.search('ou=groups,'+config.server.base, opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('groupentry: '+ JSON.stringify(entry.object));
            //console.log(JSON.stringify(entry.object.member));
            if (currentUser.isAdmin || (entry.object.owner && entry.object.owner.indexOf(currentUser.dn) > -1)) {
                entries.push(entry.object);
            }
        });
          res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            done(null, 'Error fetching LDAP groups: ' + err.message);
        });
        res.on('end', function(result) {
            console.log('status: ' + result.status);
            done(entries);
        });
    });
};

exports.fetchUsers = function(done) {
    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });

    var opts = {
        scope: 'sub'
    };
    
    var entries = [];

    client.search('ou=users,'+config.server.base, opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('userentry: '+ JSON.stringify(entry.object));
            entries.push(entry.object);
        });
          res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            console.error('error: ' + err.message);
        });
        res.on('end', function(result) {
            console.log('status: ' + result.status);
            done(entries);
        });
    });
};

exports.fetchObject = function(dn, done) {
    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });

    var opts = {
    };
    
    var entries = [];

    client.search(dn, opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('userentry: '+ JSON.stringify(entry.object));
            done(entry.object)
        });
          res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            console.error('error: ' + err.message);
        });
        res.on('end', function(result) {
            console.log('status: ' + result.status);
        });
    });
};



exports.getByEmail = function(mail, done) {
    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });

    var opts = {
      filter: '(mail=' + mail + '*)',
      scope: 'sub'
    };
    
    var entries = [];

    client.search('ou=users,'+config.server.base, opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('userentry: '+ JSON.stringify(entry.object));
            if (entry.object.cn && entry.object.mail && entry.object.mail.toLowerCase() === mail.toLowerCase())
                entries.push(entry.object)
        });
        res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            console.error('error: ' + err.message);
        });
        res.on('end', function(result) {
            if (entries.length == 0) {
                done(null, "Kein*e Benutzer*in mit dieser E-Mail Adresse gefunden")
            } else if (entries.length > 1) {+
                done(null, "Mehrere Benutzer*innen mit dieser E-Mail Adresse gefunden")
            } else {
                done(entries[0]);
            }
            console.log('status: ' + result.status);
        });
    });
};

exports.getByUID = function(uid, done) {
    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });

    var opts = {
      filter: '(uid=' + uid + ')',
      scope: 'sub'
    };
    
    var entries = [];

    client.search('ou=users,'+config.server.base, opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('userentry: '+ JSON.stringify(entry.object));
            entries.push(entry.object)
        });
        res.on('searchReference', function(referral) {
            console.log('referral: ' + referral.uris.join());
        });
        res.on('error', function(err) {
            console.error('error: ' + err.message);
        });
        res.on('end', function(result) {
            if (entries.length == 0) {
                done(null, "Kein*e Benutzer*in mit dieser User ID gefunden")
            } else if (entries.length > 1) {+
                done(null, "Mehrere Benutzer*innen mit dieser User ID gefunden")
            } else {
                done(entries[0]);
            }
            console.log('status: ' + result.status);
        });
    });
};

exports.findUniqueUID = function(uid, number, done) {
    var uniqueUID = uid;
    uniqueUID = uid + '_' + number;

    console.log('try uid: ' + uniqueUID);
    exports.getByUID(uniqueUID, function(user, err) {
        if (user == null) {
            console.log('found unique UID: ' + uniqueUID);
            done(uniqueUID);
        } else {
            exports.findUniqueUID(uid, number+1, done);
        }
    });    
};

exports.encryptAndAddUser = function(entry, done) {

    entry.objectClass = ['inetOrgPerson','posixAccount','top'];
    entry.gidNumber = 500;
    entry.homeDirectory = 'home/users/'+entry.uid;
    entry.uidNumber = Date.now();

    ssha.ssha_pass(entry.userPassword, function(err, hash) {
        if (err) {
            return done(err);
        } 

        entry.userPassword = hash;

        client.add('cn=' + entry.cn + ',ou=users,'+config.server.base, entry, function(err) {
            if (err) {
                done(err);
            } else {
                done();
            }
        });
    })
};

exports.change = function (dn, operation, modification) {
    return new Promise((resolve, reject) => {
        var change = new ldap.Change( {
            operation: operation,
            modification: modification
        });

        client.modify(dn, change, function(err ) {
            if (err) {
                console.log('error in group modify: ' + err);
                reject( err);
            } else  {
                resolve();
            }
        });    
    });
};

exports.updateDN = function(oldDN, newDN) {
    return new Promise((resolve, reject) => {
        client.modifyDN(oldDN, newDN, function(err) {
            if (err) {
                reject( err);
            } else{
                resolve();
            }
        })
    });
};

exports.hashPassword = function(password) {
    return new Promise((resolve, reject) => {
        ssha.ssha_pass(password, function(err, hash) {
            if (err) {
                reject(err);
            } else {
                resolve(hash);
            }

        });
    });
};

exports.updatePassword = function(uid, userPassword, userPassword2, done) {


    if (userPassword != userPassword2) {
        return done("Passwörter sind unterschiedlich");
    } else if (userPassword && !passwordValid(userPassword)) {
        return done("Passwort muss den Vorgaben entsprechen");
    }

    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    }); 

    exports.getByUID(uid, function(user, err) {
        if (err || !user) {
            return done(err);
        }


        ssha.ssha_pass(userPassword, function(err, hash) {

            if (err) {
                return done(err);
            }

            console.log("new password: " + userPassword + ' hash: ' + hash + ' for cn: ' + user.cn);
            var change = new ldap.Change( {
                operation: 'replace',
                modification: {
                    userPassword: hash
                }
            });
            client.modify('cn=' +user.cn + ',ou=users,'+config.server.base, change, function(err) {
                if (err) {
                    return done(err);
                } else {
                    return done();
                }
            })
        });

    });
};


exports.remove = function(dn) {
    return new Promise((resolve, reject) => {
        client.del(dn, function(err) {
            if(err) {
                reject(err);
            } else {
                resolve();
            }
        });        
    })
};

exports.add = function(dn, entry) {
    return new Promise((resolve, reject) => {    
        client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
            if (err) {
                console.log('Error connecting LDAP: ' + err);
            }
            else {
                client.add(dn, entry, function(err) {
                    if(err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });                    
            }
        });       
    });
}



