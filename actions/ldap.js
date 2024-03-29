var ldaphelper = require('../utils/ldaphelper');
var config    = require('../config/config.json');
var Promise = require('bluebird');


var changeGroup = function(group, field, users) {
  return new Promise((resolve, reject) => {
    var parameters = {};
    parameters[field] = users;
    var addReplace = group[field] === undefined || group[field] === "" ?'add':'replace';
    if (addReplace == 'add' && users.length == 0) {
      resolve('');
    } else {
      ldaphelper.change(group.dn, group[field] === undefined || group[field] === "" ?'add':'replace', parameters)
        .then(() => resolve('Gruppe ' + group.cn + ' (' + (field=='owner'?'Admin':'Mitglied') + ')'))
        .catch(error => reject('LDAP: Fehler beim Updaten der LDAP Gruppe ' + group.cn + ' (' + field + '): ' + error));
    }
  });
}

var updateGroups = function(currentUser, dn, oldDn, oldUser, member, owner) {
    return new Promise((resolve, reject) => {
      var assignedGroups;
      var assignedAdminGroups;

      if(member) {
          assignedGroups = member;
      } else {
          assignedGroups = [];
      }

      if(owner) {
          assignedAdminGroups = owner;
      } else {
          assignedAdminGroups = [];
      }

      var changedDn = dn != oldDn;
      if ((currentUser.isAdmin || currentUser.isGroupAdmin) && (member !== false || owner !== false)) {
          ldaphelper.fetchGroups(currentUser.ownedGroups)
            .then((groups) => {
              var actions = [];
              groups.forEach((group) => {
                if (group && group.cn) {
                  var updatedMember = ldaphelper.ldapAttributeToArray(group.member),
                      updated = false,
                      updatedAdmin = ldaphelper.ldapAttributeToArray(group.owner);
                  if (member !== false) {
                    // check if member list needs to be updated
                    if (assignedGroups.includes(group.dn)) {
                      if (updatedMember.includes(oldDn)) {
                        if (changedDn) {
                          updated = true;
                          updatedMember[updatedMember.indexOf(oldDn)] = dn;
                        }
                      } else if (!updatedMember.includes(dn)) {
                        updatedMember.push(dn);
                        updated = true;
                      }
                    // no changes except user dn updates if user has no privileges for group
                    } else if (!currentUser.ownedGroups=='all' && !currentUser.ownedGroups.includes(group.dn) && updatedMember.includes(oldDn)) {
                      if (changedDn) {
                        updated = true;
                        updatedMember[updatedMember.indexOf(oldDn)] = dn;
                      }
                    } else {
                      if (updatedMember.includes(oldDn)) {
                        updatedMember.splice(updatedMember.indexOf(oldDn), 1);
                        updated = true;
                      } else if (updatedMember.includes(dn)) {
                        updatedMember.splice(updatedMember.indexOf(dn), 1);
                        updated = true;
                      }
                    }
                    if (updated) {
                      actions.push(changeGroup(group, "member", updatedMember));
                    }
                  }

                  // check if owner list needs to be updated (only for group admins)
                  if (owner !== false) {
                    updated = false;  
                    // check if owner list needs to be updated
                    if (assignedAdminGroups.includes(group.dn)) {
                      if (updatedAdmin.includes(oldDn)) {
                        if (changedDn) {
                          updated = true;
                          updatedAdmin[updatedAdmin.indexOf(oldDn)] = dn;
                        }
                      } else if (!updatedAdmin.includes(dn)) {
                        updatedAdmin.push(dn);
                        updated = true;
                      }
                    // no changes except user dn updates if user has no privileges for group
                    } else if (!currentUser.ownedGroups=='all' && !currentUser.ownedGroups.includes(group.dn) && updatedAdmin.includes(oldDn)) {
                      if (changedDn) {
                        updated = true;
                        updatedAdmin[updatedAdmin.indexOf(oldDn)] = dn;
                      }
                    } else {
                      if (updatedAdmin.includes(oldDn)) {
                        updatedAdmin.splice(updatedAdmin.indexOf(oldDn), 1);
                        updated = true;
                      } else if (updatedAdmin.includes(dn)) {
                        updatedAdmin.splice(updatedAdmin.indexOf(dn), 1);
                        updated = true;
                      }
                    }
                    if (updated) {
                      actions.push(changeGroup(group, "owner", updatedAdmin));
                    }
                  }
                }

              });
              return Promise.all(actions);
            })
            .then(updatedFields => resolve(updatedFields))
            .catch(error => reject(error));
    } else {
      resolve([]);
    }
  });
};

var createUser = function(user, currentUser) {
  return new Promise((resolve, reject) => {
    var entry = {
        cn: user.cn,
        ou: user.ou,
        sn: 'none',
        givenName: 'none',
        mail: user.mail,
        preferredLanguage: user.language,
        userPassword: user.password,
        description: user.description
    };
    if (user.l && user.l != '') {
      entry.l = user.l;
    }

    var uid = user.changedUid;
    if (!uid) {
      uid = user.cn.toLowerCase()
                  .replace('ä', 'ae')
                  .replace('ö', 'oe')
                  .replace('ü', 'ue')
                  .replace('ß', 'ss')
                  .replace(' ', '_')
                  .replace(/[\W]+/g,"")
                  .substr(0,35);
    }
    ldaphelper.fetchObject(user.ou)
      .then(group => {
        entry.title = group.o;
        return;
      })
      .then(() => ldaphelper.getByUID(uid))
      .then((LDAPuser) => {
        if (LDAPuser != null) {
            if (user.changedUid) {
              throw "User ID bereits vergeben";
            } else {
              return ldaphelper.findUniqueUID(uid, 2)
                then((uniqueUID) => {
                  uid = uniqueUID;
                  entry.uid = uniqueUID;
                  user.uid = uniqueUID;
                  return ldaphelper.encryptAndAddUser(entry);
                })
            }
        } else {
          entry.uid = uid;
          user.uid = uid;
          return ldaphelper.encryptAndAddUser(entry);
        }
      })
      .then(() => {
        var cn = user.cn;
        var dn = 'cn=' + cn + ',ou=users,' + config.ldap.server.base;
        user.dn = dn;
        return updateGroups(currentUser, dn, dn, null, user.member, user.owner);
      })
      .then(() => {
        resolve({status: true, message: "LDAP: Benutzer*in " + entry.cn + " im LDAP erstellt"});
      })
      .catch((error) => {
        resolve({status: false, message: "LDAP: Fehler beim Erstellen der*des Benutzer*in: " + error});
      });
  });
};

var modifyUser = function(user, currentUser) {

  return new Promise((resolve, reject) => {


  var updatedFields = [];

  var changedDnAction, fieldActions = [];
  var oldDn = user.dn;
  user.changedDn = oldDn;
  ldaphelper.fetchObject(oldDn)
    .then((oldUser) => {

      var actions = [];

      var cn = user.cn, dn;
      if (cn != false) {
        dn = 'cn=' + cn + ',ou=users,'+ config.ldap.server.base;
      } else {
        dn = user.dn;;
      }

      var changedDn = user.cn != false && dn != oldDn;

      if (changedDn) {
        changedDnAction = ldaphelper.updateDN(oldDn, dn);
        updatedFields.push('DN');
        user.dn = dn;
      }

      if (user.cn != false && cn != oldUser.cn) {
        fieldActions.push(ldaphelper.change(dn, 'replace', {cn : cn}));
        updatedFields.push('Name');
      }

      if (user.changedUid && user.changedUid !== "" && user.changedUid !== user.uid) {
        fieldActions.push(ldaphelper.change(dn, 'replace', {uid : user.changedUid}));
        updatedFields.push('User ID');
      }

      if(user.description != false && user.description != oldUser.description) {
        fieldActions.push(ldaphelper.change(dn, 'replace', {description : user.description}));
        updatedFields.push('Speicherplatz');
      }

      if(user.ou != false && user.ou != oldUser.ou) {
        fieldActions.push(ldaphelper.change(dn, 'replace', {ou : user.ou}));
        fieldActions.push(ldaphelper.fetchObject(user.ou).then(group => ldaphelper.change(dn, 'replace', {title : group.o})));
        updatedFields.push('Zugehörigkeit');
      }

      if(user.l != false && user.l != oldUser.l) {
        fieldActions.push(ldaphelper.change(dn, 'replace', {l : user.l}));
        updatedFields.push('Ort');
      }

      if(user.language != false && user.language != oldUser.preferredLanguage) {
        fieldActions.push(ldaphelper.change(dn, 'replace', {preferredLanguage : user.language}));
        updatedFields.push('Sprache');
      }

      if(user.mail != false && user.mail != oldUser.mail) {
        fieldActions.push(ldaphelper.change(dn, 'replace', {mail : user.mail}));
        updatedFields.push('E-Mail');
      }

      user.changedDn = dn;
      var doUpdate = updateGroups(currentUser, dn, oldDn, oldUser, user.member, user.owner)
          .then((updatedGroups) => {
            updatedFields = updatedFields.concat(updatedGroups);
            if (changedDn) {
              return changedDnAction;
            } else {
              return;
            }

          })
          .then(() => {
            return Promise.all(fieldActions);
          })


      if (user.password != false && user.password && user.password != oldUser.userPassword) {
        return ldaphelper.hashPassword(user.password)
          .then((hash) => {
            fieldActions.push(ldaphelper.change(dn, 'replace', {userPassword : hash}));
            updatedFields.push('Passwort');
            return doUpdate;
          });
      } else {
        return doUpdate;
      }

    })
    .then(() => {
      resolve({status: true, message: 'LDAP: Benutzer*in upgedated (' + updatedFields.join(', ') + ')'});
    })
    .catch((error) => {
      resolve({status: false, message: "LDAP: Fehler beim Update der*des Benutzer*in: " + error + error.stack});
    })
  })
};

var removeUser = function(user, currentUser) {
  return new Promise((resolve, reject) => {

    if (user.dn == null) {
        resolve({status: false, message: 'LDAP: Kein*e Benutzer*in angegeben'});
    }
    updateGroups(currentUser, user.dn, user.dn, null, null, null)
      .then((updatedGroups) => {
        ldaphelper.remove(user.dn)
          .then(() => {

            var updatedGroupsText = 'keine';
            if (updatedGroups.length > 0) {
              updatedGroupsText = updatedGroups.join(', ');
            }
            resolve({status: true, message: 'LDAP: Benutzer*in gelöscht: ' + user.dn + ', Benutzer*in aus folgenden Gruppen ausgetragen: ' + updatedGroupsText});
          });
      })
      .catch((error)  => {
        resolve({status: false, message: 'LDAP: Fehler beim Löschen der*des Benutzer*in ' + user.dn + ': ' + error});
      });
  });
};

var createGroup = function(group, currentUser) {
  return new Promise((resolve, reject) => {
    var member =  JSON.parse(group.member);
    if (member.length === 0) {
      member = '';
    }
    var entry = {
      cn: group.cn,
      o: group.o,
      description: group.description,
      objectClass: ['groupOfNames','top'],
      member: member,
      owner: ""
    };
    ldaphelper.add('cn=' + group.cn + ',ou=groups,' + config.ldap.server.base, entry)
      .then(() => {
        currentUser.ownedGroups.push('cn=' + group.cn + ',ou=groups,' + config.ldap.server.base);
        resolve({status: true, message: 'LDAP: Gruppe angelegt: ' + group.cn});
      })
      .catch((error) => {
        resolve({status: false, message: 'LDAP: Fehler beim Erstellen der Gruppe ' + group.cn + ': ' + error});
      });
  })
}

var modifyGroup = function(group, currentUser) {
  return new Promise((resolve, reject) => {
    var updatedFields = [];
    var oldDn = group.dn;
    var cn = group.cn;
    var dn = 'cn=' + cn + ',ou=groups,'+ config.ldap.server.base;
    var changedDn = (group.cn != false) && dn != oldDn;

    ldaphelper.fetchObject(oldDn)
      .then((oldGroup) => {

        var actions = [];

        var nextStep;
        if (changedDn) {
          updatedFields.push('DN');
          nextStep = ldaphelper.updateDN(oldDn, dn);
          currentUser.ownedGroups.push(dn);
        } else {
          nextStep = Promise.resolve();
        }
        nextStep
          .then(() => {
            if (group.cn != false && cn != oldGroup.cn) {
              actions.push(ldaphelper.change(dn, 'replace', {cn : cn}));
              updatedFields.push('Interner Name');
            }

            if (group.o != false && group.o != oldGroup.o) {
              actions.push(ldaphelper.change(dn, 'replace', {o : group.o}));
              updatedFields.push('Anzeigename');
            }

            if(group.description != false && group.description != oldGroup.description) {
              actions.push(ldaphelper.change(dn, 'replace', {description : group.description}));
              updatedFields.push('Beschreibung');
            }

            if(group.member != false) {
              var diff = false;
              var member = JSON.parse(group.member);
              if (oldGroup.member) {
                 	if (oldGroup.member instanceof Array) {
        						oldGroup.member.forEach(u => {
        				          	diff = diff || !member.includes(u);
        				        })
                 	} else {
                 		diff = diff || !member.includes(oldGroup.member);
                 	}
              }
              member.forEach(u => {
              	diff = diff || !oldGroup.member.includes(u);
              })
              if (diff) {
              	if (member.length == 0) {
              		member = "";
              	}
              	actions.push(ldaphelper.change(dn, 'replace', {member : member}));
              	updatedFields.push('Mitglieder');
              }

            }
            return Promise.all(actions);
          })
      })
      .then(() => {
        resolve({status: true, message: 'LDAP: Gruppe upgedated (' + updatedFields.join(', ') + ')'});
      })
      .catch((error) => {
        resolve({status: false, message: 'LDAP: Fehler beim updaten der Gruppe: ' + error});
      })
  })
};

var removeGroup = function(group) {
  return new Promise((resolve, reject) => {

    if (group.dn == null) {
        resolve({status: false, message: 'LDAP: Keine Gruppe angegeben'});
    }
    ldaphelper.remove(group.dn)
      .then(() => {
        resolve({status: true, message: 'LDAP: Gruppe gelöscht: ' + group.dn});
      })
      .catch((error) => {
        resolve({status: false, message: 'LDAP: Fehler beim Löschen der Gruppe ' + group.dn + ': ' + error});
      });
  });
};

exports.register = function(hooks) {
  hooks.user.create.on.push(createUser);
  hooks.user.modify.on.push(modifyUser);
  hooks.user.remove.on.push(removeUser);

  hooks.group.create.on.push(createGroup);
  hooks.group.modify.on.push(modifyGroup);
  hooks.group.remove.on.push(removeGroup);
};