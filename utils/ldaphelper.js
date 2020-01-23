var ldap = require('ldapjs');
var ssha = require('openldap_ssha');
var config    = require('../config/config.json').ldap;
var discourse = require('./discoursehelper');
var mail = require('./mailhelper');

var Promise = require("bluebird");
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

exports.fetchIsAdmin = function(userDn) {
    return new Promise((resolve, reject) => {

        var opts = {
        };

        var admin = null;

        client.search('cn=admin,ou=groups,'+config.server.base, opts, function(err, res) {
            res.on('searchEntry', function(entry) {
                if (entry.object.member && entry.object.member.indexOf(userDn) > -1){
                    admin = true;
                } else {
                    admin = false;
                }
            });
            res.on('error', function(err) {
                reject('isAdmin error: ' + err.message);
            });
            res.on('end', function(result) {
                resolve(admin);
            });
        });
    })

};

exports.fetchGroups = function(ownedGroups) {

    return new Promise((resolve, reject) => {


        var opts = {
            scope: 'sub'
        };

        var entries = [];

        client.search('ou=groups,'+config.server.base, opts, function(err, res) {
            res.on('searchEntry', function(entry) {
                if (ownedGroups && (ownedGroups == 'all' || ownedGroups.includes(entry.object.dn))) {
                    entries.push(entry.object);
                }                
            });
            res.on('error', function(err) {
                reject('Error fetching groups: ' + err.message);
            });
            res.on('end', function(result) {
                entries.sort(function(a, b){
                    if (a.cn) {
                        return a.cn.localeCompare(b.cn);
                    }
                    return 0;
                });
                resolve(entries);
            });
        });

    });

};

exports.populateUserGroups = function(user) {

    return new Promise((resolve, reject) => {


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
            res.on('error', function(err) {
                reject('Error populating user groups: ' + err.message);
            });
            res.on('end', function(result) {
                user.member = [];
                user.owner = [];
                entries.forEach((group) => {
                    if (group.owner && group.owner.includes(user.dn)) {
                        user.owner.push(group.dn);
                    }
                    if (group.member && group.member.includes(user.dn)) {
                        user.member.push(group.dn);
                    }
                });
                resolve(user);
            });
        });
    });
};


exports.fetchOwnedGroups = function(currentUser) {
    return new Promise((resolve, reject) => {

        var opts = {
            scope: 'sub'
        };

        var owner = [];
        var member = [];

        client.search('ou=groups,'+config.server.base, opts, function(err, res) {
            res.on('searchEntry', function(entry) {
                //console.log('groupentry: '+ JSON.stringify(entry.object));
                //console.log(JSON.stringify(entry.object.member));
                if (currentUser.isAdmin || (entry.object.owner && entry.object.owner.indexOf(currentUser.dn) > -1)) {
                    owner.push(entry.object);
                }
                if (entry.object.member && entry.object.owner.indexOf(currentUser.dn) > -1) {
                    member.push(entry.object);
                }
            });
            res.on('error', function(err) {
                reject('Error fetching users owned groups: ' + err.message);
            });
            res.on('end', function(result) {
                resolve({owner: owner, member: member});
            });
        });
    });
};

exports.fetchUsers = function() {
    return new Promise((resolve, reject) => {

        var opts = {
            scope: 'sub'
        };

        var entries = [];

        client.search('ou=users,'+config.server.base, opts, function(err, res) {
            res.on('searchEntry', function(entry) {
                //console.log('userentry: '+ JSON.stringify(entry.object));
                entries.push(entry.object);
            });
            res.on('error', function(err) {
                reject('Error fetching users: ' + err.message);
            });
            res.on('end', function(result) {
                resolve(entries);
            });
        });
    });
};

exports.fetchObject = function(dn) {
    return new Promise((resolve, reject) => {

        var opts = {
        };

        var entries = [];

        client.search(dn, opts, function(err, res) {
            res.on('searchEntry', function(entry) {
                resolve(entry.object)
            });
            res.on('error', function(err) {
                reject('Error fetching object ' + dn + ': ' + err.message);
            });
            res.on('end', function(result) {
                reject('LDAP object not found: ' + dn);
            });
        });
    });
};

exports.fetchUser = function(dn) {
    return exports.fetchObject(dn)
        .then((user) => {
            return exports.populateUserGroups(user);
        })
};


exports.getByEmail = function(mail) {
    return new Promise((resolve, reject) => {

        var opts = {
          filter: '(mail=' + mail + '*)',
          scope: 'sub'
        };

        var entries = [];

        client.search('ou=users,'+config.server.base, opts, function(err, res) {
            res.on('searchEntry', function(entry) {
                if (entry.object.cn && entry.object.mail && entry.object.mail.toLowerCase() === mail.toLowerCase())
                    entries.push(entry.object)
            });
            res.on('error', function(err) {
                reject('Error fetching by e-mail: ' + err.message);
            });
            res.on('end', function(result) {
                if (entries.length == 0) {
                    reject("Kein*e Benutzer*in mit dieser E-Mail Adresse gefunden");
                } else if (entries.length > 1) {+
                    reject("Mehrere Benutzer*innen mit dieser E-Mail Adresse gefunden");
                } else {
                    resolve(entries[0]);
                }
            });
        });
    });
};

exports.getByUID = function(uid) {
    return new Promise((resolve, reject) => {

        var opts = {
          filter: '(uid=' + uid + ')',
          scope: 'sub'
        };

        var entries = [];

        client.search('ou=users,'+config.server.base, opts, function(err, res) {
            res.on('searchEntry', function(entry) {
                entries.push(entry.object)
            });
            res.on('error', function(err) {
                reject('Error fetching user by UID ' + uid + ': ' + err.message);
            });
            res.on('end', function(result) {
                if (entries.length == 0) {
                    resolve(null);
                } else if (entries.length > 1) {+
                    reject("Mehrere Benutzer*innen mit UID " + uid + " gefunden");
                } else {
                    resolve(entries[0]);
                }
            });
        });
    });
};

exports.getByCN = function(cn) {
    return new Promise((resolve, reject) => {

        var opts = {
          filter: '(cn=' + cn + ')',
          scope: 'sub'
        };

        var entries = [];

        client.search('ou=users,'+config.server.base, opts, function(err, res) {
            res.on('searchEntry', function(entry) {
                entries.push(entry.object)
            });
            res.on('error', function(err) {
                reject('Error fetching user by CN ' + cn + ': ' + err.message);
            });
            res.on('end', function(result) {
                if (entries.length == 0) {
                    resolve(null);
                } else if (entries.length > 1) {+
                    reject("Mehrere Benutzer*innen mit CN " + cn + " gefunden");
                } else {
                    resolve(entries[0]);
                }
            });
        });
    });
};
 
exports.findUniqueUID = function(uid, number) {
    var uniqueUID = uid;
    uniqueUID = uid + '_' + number;

    return exports.getByUID(uniqueUID)
        .then((user) => {
            if (user) {
                return exports.findUniqueUID(uid, number+1);                
            } else { 
                return uniqueUID;
            }
            
        });
}; 

exports.encryptAndAddUser = function(entry) {

    return new Promise((resolve, reject) => {

        entry.objectClass = ['inetOrgPerson','posixAccount','top', 'organizationalPerson'];
        entry.gidNumber = 500;
        entry.homeDirectory = 'home/users/'+entry.uid;
        entry.uidNumber = Date.now();

        ssha.ssha_pass(entry.userPassword, function(err, hash) {
            if (err) {
                reject('Fehler beim Passwortverschlüsseln: ' + err);
            }

            entry.userPassword = hash;
            console.log(JSON.stringify(entry));
            client.add('cn=' + entry.cn + ',ou=users,'+config.server.base, entry, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        })
    });
};

exports.change = function (dn, operation, modification) {
    return new Promise((resolve, reject) => {
        var change = new ldap.Change( {
            operation: operation,
            modification: modification
        });

        client.modify(dn, change, function(err ) {
            if (err) {
                reject(err);
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
                reject(err);
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
                reject('Fehler beim Passwortverschlüsseln: ' + err);
            } else {
                resolve(hash);
            }

        });
    });
};

exports.updatePassword = function(uid, userPassword, userPassword2) {

    return Promise.resolve()
        .then(() => {

            if (userPassword != userPassword2) {
                throw "Passwörter sind unterschiedlich";
            } else if (userPassword && !passwordValid(userPassword)) {
                throw "Passwort muss den Vorgaben entsprechen";
            }

            return exports.getByUID(uid)
                .then((user) => {
                    if (!user) {
                        throw "Benutzer*in " + uid + " nicht gefunden";
                    }

                    return hashPassword(userPassword)
                        .then((hash) => {

                            return new Promise((resolve, reject) => {

                                var change = new ldap.Change( {
                                    operation: 'replace',
                                    modification: {
                                        userPassword: hash
                                    }
                                });
                                client.modify('cn=' +user.cn + ',ou=users,'+config.server.base, change, function(err) {
                                    if (err) {
                                        reject(err);
                                    } else {
                                        resolve();
                                    }
                                })                            
                            })                        
                        });
            });
        })
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
        client.add(dn, entry, function(err) {
            if(err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}



