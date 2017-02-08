var ldap = require('ldapjs');
var ssha = require('openldap_ssha');
var config    = require('../../config/config.json').ldap;
var discourse = require('../discoursehelper');
var mail = require('../mailhelper');
var client = ldap.createClient({
  url: config.server.url
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

    client.search('cn=admin,ou=groups,dc=willy-fred,dc=org', opts, function(err, res) {
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
    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });

    var opts = {
        scope: 'sub'
    };
    
    var entries = [];

    client.search('ou=groups,dc=willy-fred,dc=org', opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('groupentry: '+ JSON.stringify(entry.object));
            //console.log(JSON.stringify(entry.object.member));
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

    client.search('ou=groups,dc=willy-fred,dc=org', opts, function(err, res) {
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
            console.error('error: ' + err.message);
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

    client.search('ou=users,dc=willy-fred,dc=org', opts, function(err, res) {
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
      filter: '(mail=' + mail + ')',
      scope: 'sub'
    };
    
    var entries = [];

    client.search('ou=users,dc=willy-fred,dc=org', opts, function(err, res) {
        res.on('searchEntry', function(entry) {
            //console.log('userentry: '+ JSON.stringify(entry.object));
            if (entry.object.cn)
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

    client.search('ou=users,dc=willy-fred,dc=org', opts, function(err, res) {
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
    if (number < 10) {
        uniqueUID = uid.substr(0,14) + number;
    } else if (number < 100) {
        uniqueUID = uid.substr(0,13) + number;
    } else if (number < 1000) {
        uniqueUID = uid.substr(0,12) + number;
    }
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

exports.addUser = function(user, currentUser, done) {

    if(!user.givenName) {
        return done("Vorname fehlt");
    } else if (!user.sn || user.sn == "") {
        return done("Nachname fehlt");
    } else if (!user.businessCategory || user.businessCategory == "") {
        return done("Projekt fehlt");
    } else if (!user.mail || user.mail == "") {
        return done("E-mail Adresse fehlt");
    } else if (!user.userPassword && !user.activation) {
        return done("Passwort fehlt");
    } else if (user.userPassword && user.userPassword != user.userPassword2) {
        return done("Passwörter sind unterschiedlich");
    } else if (user.userPassword && !passwordValid(user.userPassword)) {
        return done("Passwort muss den Vorgaben entsprechen");
    }

    if (user.activation) {
        var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_?!&%$#+-';
        var uncrackable = '';
        for (var i = 20; i > 0; --i) {
          uncrackable += chars[Math.round(Math.random() * (chars.length - 1))];
        }
        user.userPassword = uncrackable;
    }

    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    }); 

    if(user.groups) {

        var assignedGroups = JSON.parse(user.groups);
        var assignedAdminGroups = JSON.parse(user.adminGroups);
        
        var opts = {
            scope: 'sub'
        };

        var cn = user.givenName + ' ' + user.sn;
        var dn = 'cn=' + cn + ',ou=users,dc=willy-fred,dc=org';

       //console.log("groups JSON: "+JSON.stringify(groups));

        exports.fetchGroups(function(groups) {
            groups.forEach(function (group) {
                var updatedMember = [],
                    updatedAdmin = [];

                if (group.member && group.member instanceof Array) 
                    updatedMember = group.member.slice();
                else if (group.member != null)
                    updatedMember.push(group.member);

                if (group.owner && group.owner instanceof Array) 
                    updatedAdmin = group.owner.slice();
                else if (group.woner != null)
                    updatedAdmin.push(group.owner);

                if (assignedGroups.indexOf(group.dn) > -1) {
                    updatedMember.push(dn);
                    var change = new ldap.Change( {
                        operation: 'replace',
                        modification: {
                            member: updatedMember
                        }
                    });

                    client.modify(group.dn, change, function(err ) {
                        if (err) {
                            console.log('error in group modify: ' + err);
                            done(err);
                        }
                    });
                }

                if (assignedAdminGroups.indexOf(group.dn) > -1) {
                    updatedAdmin.push(dn);
                    var change = new ldap.Change( {
                        operation: group.owner == undefined?'add':'replace',
                        modification: {
                            owner: updatedAdmin
                        }
                    });

                    client.modify(group.dn, change, function(err ) {
                        if (err) {
                            console.log('error in group modify: ' + err);
                            done(err);
                        }
                    });
                }
            });
        });
    }

    var encryptAndAdd = function(uniqueUID) {
        var entry = {
            cn: user.givenName + " " + user.sn,
            givenName: user.givenName,
            sn: user.sn,
            mail: user.mail,
            objectclass: ['inetOrgPerson','posixAccount','top'],
            uid: uniqueUID,
            gidNumber: 500,
            homeDirectory: 'home/users/'+uniqueUID,
            uidNumber: Date.now(),
            userPassword: user.userPassword,
            businessCategory: user.businessCategory
        };
        ssha.ssha_pass(entry.userPassword, function(err, hash) {
            if (err)
                done(err);

            entry.userPassword = hash;

            client.add('cn=' + entry.cn + ',ou=users,dc=willy-fred,dc=org', entry, function(err) {
                if (err) {
                    done(err);
                }else {
                    if (user.activation) {
                        mail.sendActivationEmail({uid: uniqueUID, mail: user.mail}, function(err){
                            done(err, uniqueUID);
                        });
                    } else {
                        done(null, uniqueUID);
                    }
                }
            });
        })
    };

    var uid = (user.givenName.substr(0,1)+user.sn)
                .toLowerCase()
                .replace('ä', 'ae')
                .replace('ö', 'oe')
                .replace('ü', 'ue')
                .replace('ß', 'ss')
                .replace(' ', '_')
                .replace(/[\W]+/g,"")
                .substr(0,15);

    exports.getByUID(uid, function(user) {
        if (user != null) {
            exports.findUniqueUID(uid, 2, function(uniqueUID) {
                encryptAndAdd(uniqueUID);
            })
        } else {
            encryptAndAdd(uid);
        }
    });

};

exports.updateUser = function(oldDn, user, admin, done) {

    if(!user.givenName) {
        return done("Vorname fehlt");
    } else if (!user.sn || user.sn == "") {
        return done("Nachname fehlt");
    } else if (admin && (!user.businessCategory || user.businessCategory == "")) {
        return done("Projekt fehlt");
    } else if (!user.mail || user.mail == "") {
        return done("E-mail Adresse fehlt");
    } else if (user.userPassword && user.userPassword != user.userPassword2) {
        return done("Passwörter sind unterschiedlich");
    } else if (user.userPassword && !passwordValid(user.userPassword)) {
        return done("Passwort muss den Vorgaben entsprechen");
    }

    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    }); 


    var assignedGroups;

    if(user.groups) {

        assignedGroups = JSON.parse(user.groups);
    } else {
        assignedGroups = [];
    }

    if(user.adminGroups) {

        assignedAdminGroups = JSON.parse(user.adminGroups);
    } else {
        assignedAdminGroups = [];
    }
    console.log('groups: ' + user.groups);
    console.log('admin groups: ' + user.adminGroups);

    exports.fetchObject(oldDn, function(oldUser) {
        var opts = {
            scope: 'sub'
        };

        var cn = user.givenName + ' ' + user.sn;
        var dn = 'cn=' + cn + ',ou=users,dc=willy-fred,dc=org';
        var changedDn = dn != oldDn;

        console.log("groups JSON: "+JSON.stringify(assignedGroups));

        if (admin) {
            exports.fetchGroups(function(groups) {
                groups.forEach(function (group) {
                    var updatedMember = [],
                        updated,
                        updatedAdmin = [];

                    if (group.member && group.member instanceof Array) 
                        updatedMember = group.member.slice();
                    else if (group.member != null && group.member != "")
                        updatedMember.push(group.member);
         
                    if (group.owner && group.owner instanceof Array) 
                        updatedAdmin = group.owner.slice();
                    else if (group.owner != null && group.owner != "")
                        updatedAdmin.push(group.owner);

                    if (assignedGroups.indexOf(group.dn) > -1) {
                        if (updatedMember.indexOf(oldDn) > -1 ) {
                            if (changedDn) {
                                updated = true;
                                updatedMember[updatedMember.indexOf(oldDn)] = dn;
                            }
                        } else {
                            updatedMember.push(dn);
                            updated = true;
                        }
                    } else {
                        if (updatedMember.indexOf(oldDn) > -1 ) {
                            updatedMember.splice(updatedMember.indexOf(oldDn), 1);
                            updated = true;

                        }
                    }

                    if (updated) {
                        var change = new ldap.Change( {
                            operation: group.member == undefined?'add':'replace',
                            modification: {
                                member: updatedMember
                            }
                        });

                        client.modify(group.dn, change, function(err ) {
                            if (err) {
                                console.log('error in group modify: ' + err);
                                done(err);
                            }
                        });
                    }

                    // check admin groups

                    updated = false;
                    if (assignedAdminGroups.indexOf(group.dn) > -1) {
                        if (updatedAdmin.indexOf(oldDn) > -1 ) {
                            if (changedDn) {
                                updated = true;
                                updatedAdmin[updatedAdmin.indexOf(oldDn)] = dn;
                            }
                        } else {
                            updatedAdmin.push(dn);
                            updated = true;
                        }
                    } else {
                        if (updatedAdmin.indexOf(oldDn) > -1 ) {
                            updatedAdmin.splice(updatedAdmin.indexOf(oldDn), 1);
                            updated = true;

                        }
                    }

                    if (updated) {
                        var change = new ldap.Change( {
                            operation: group.owner == undefined?'add':'replace',
                            modification: {
                                owner: updatedAdmin
                            }
                        });

                        client.modify(group.dn, change, function(err ) {
                            if (err) {
                                console.log('error in group modify: ' + err);
                                done(err);
                            }
                        });
                    }                
                });
            });
        }
        if (changedDn) {
            client.modifyDN(oldDn, dn, function(err) {
                if (err) {
                    done(err);
                }

            })
        }

        if (cn != oldUser.cn) {
            console.log("new cn: " + cn);
            var change = new ldap.Change( {
                operation: 'replace',
                modification: {
                    cn: cn
                }
            });
            client.modify(dn, change, function(err) {
                if (err) {
                    done(err);
                } 
            });
        }

        if(user.givenName != oldUser.givenName) {
            console.log("new givenName: " + user.givenName);
            var change = new ldap.Change( {
                operation: 'replace',
                modification: {
                    givenName: user.givenName
                }
            });
            client.modify(dn, change, function(err) {
                if (err) {
                    done(err);
                } 
            })
        }

        if(user.sn != oldUser.sn) {
            console.log("new sn: " + user.sn);
            var change = new ldap.Change( {
                operation: 'replace',
                modification: {
                    sn: user.sn
                }
            });
            client.modify(dn, change, function(err) {
                if (err) {
                    done(err);
                } 
            })
        }

        if(admin && user.businessCategory != oldUser.businessCategory) {
            console.log("new businessCategory: " + user.businessCategory);
            var change = new ldap.Change( {
                operation: 'replace',
                modification: {
                    businessCategory: user.businessCategory
                }
            });
            client.modify(dn, change, function(err) {
                if (err) {
                    done(err);
                } 
            })
        }        

        if(user.mail != oldUser.mail) {
            console.log("new mail: " + user.mail);
            var change = new ldap.Change( {
                operation: 'replace',
                modification: {
                    mail: user.mail
                }
            });
            client.modify(dn, change, function(err) {
                if (err) {
                    done(err);
                } 
            })
        }

        if (user.userPassword && user.userPassword != oldUser.userPassword) {

            ssha.ssha_pass(user.userPassword, function(err, hash) {

                if (err)
                    done(err);

                console.log("new password: " + user.userPassword + ' hash: ' + hash);
                var change = new ldap.Change( {
                    operation: 'replace',
                    modification: {
                        userPassword: hash
                    }
                });
                client.modify(dn, change, function(err) {
                    if (err) {
                        done(err);
                    } 
                })
            });


        }
        

    });
    

    done();
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
            client.modify('cn=' +user.cn + ',ou=users,dc=willy-fred,dc=org', change, function(err) {
                if (err) {
                    return done(err);
                } else {
                    return done();
                }
            })
        });

    });
};

exports.deleteUser = function(dn, done) {


    if (dn == null) {
        done('Kein*e Benutzer*in angegeben');
    }

    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    });


    // remove group member- and ownerships
    exports.fetchGroups(function(groups) {
        groups.forEach(function (group) {
            var updatedMember = [],
                updated,
                updatedOwner = [];

            if (group.member && group.member instanceof Array) 
                updatedMember = group.member.slice();
            else if (group.member != null && group.member != "")
                updatedMember.push(group.member);
 
            if (group.owner && group.owner instanceof Array) 
                updatedOwner = group.owner.slice();
            else if (group.owner != null && group.owner != "")
                updatedOwner.push(group.owner);

            if (updatedMember.indexOf(dn) > -1) {
                updatedMember.splice(updatedMember.indexOf(dn), 1);
                updated = true;
            }

            if (updated) {
                var change = new ldap.Change( {
                    operation: 'replace',
                    modification: {
                        member: updatedMember
                    }
                });

                client.modify(group.dn, change, function(err ) {
                    if (err) {
                        console.log('error in group modify: ' + err);
                        done(err);
                    }
                });
            }

            if (updatedOwner.indexOf(dn) > -1) {
                updatedOwner.splice(updatedOwner.indexOf(dn), 1);
                updated = true;
            }

            if (updated) {
                var change = new ldap.Change( {
                    operation: 'replace',
                    modification: {
                        owner: updatedOwner
                    }
                });

                client.modify(group.dn, change, function(err ) {
                    if (err) {
                        console.log('error in group modify: ' + err);
                        done(err);
                    }
                });
            }

        });
    });

    // delete user
    client.del(dn, function(err) {
        
        done(err);

    });
};

exports.addGroup = function(group, done) {

    if(!group.cn) {
        done("Gruppenname fehlt");
    } 

    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            console.log('Error connecting LDAP: ' + err);
        }
    }); 

    var entry = {
          cn: group.cn,
          description: group.description,
          objectClass: ['groupOfNames','top'],
          member: "",
          owner: ""
        };

    client.add('cn=' + entry.cn + ',ou=groups,dc=willy-fred,dc=org', entry, function(err) {
        if (err) {
            done(err);
        }else {
            done();
        }
    });

};

exports.updateGroup = function(oldDn, group, done) {

    if(!group.cn) {
        done("Gruppenname fehlt");
    }

    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            done('Error connecting LDAP: ' + err);
        }
    }); 

    exports.fetchObject(oldDn, function(oldGroup) {

        var cn = group.cn;
        var dn = 'cn=' + cn + ',ou=groups,dc=willy-fred,dc=org';
        var changedDn = dn != oldDn;

        if (changedDn) {
            client.modifyDN(oldDn, dn, function(err) {
                if (err) {
                    done(err);
                }
            })
        }

        if (cn != oldGroup.cn) {
            console.log("new cn: " + cn);
            var change = new ldap.Change( {
                operation: 'replace',
                modification: {
                    cn: cn
                }
            });
            client.modify(dn, change, function(err) {
                if (err) {
                    done(err);
                } 
            });
        }

        if(group.description != oldGroup.description) {
            console.log("new description: " + group.description);
            var change = new ldap.Change( {
                operation: 'replace',
                modification: {
                    description: group.description
                }
            });
            client.modify(dn, change, function(err) {
                if (err) {
                    done(err);
                } 
            });
        }
    });

    done();
};

exports.deleteGroup = function(dn, done) {


    if (dn == null || dn == "") {
        done('Keine Gruppe angegeben');
    }

    client.bind(config.server.bindDn, config.server.bindCredentials, function(err) {
        if (err) {
            done('Error connecting LDAP: ' + err);
        }
    });

    // delete group
    client.del(dn, function(err) {
        
        done(err);

    });
};
