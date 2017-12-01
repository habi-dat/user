var ldaphelper = require('../utils/ldaphelper');
var config    = require('../config/config.json');
var Promise = require('bluebird');


var changeGroup = function(group, field, users) {
	return new Promise((resolve, reject) => {
		    var parameters = {};
		    parameters[field] = users;
		    var addReplace = group[field] === undefined || group[field] === "" ?'add':'replace';
		    console.log(group.cn + ': ' + field + ': ' + group[field] + ': ' + addReplace);
    		ldaphelper.change(group.dn, group[field] === undefined || group[field] === "" ?'add':'replace', parameters)
    			.then(() => resolve('Gruppe ' + group.cn + ' (' + field + ')'))
    			.catch(error => reject('LDAP: Fehler beim Updaten der LDAP Gruppe ' + group.cn + ' (' + field + '): ' + error));
    	});
}

var updateGroups = function(dn, oldDn, member, owner) {
    return new Promise((resolve, reject) => {
	    var assignedGroups;
	    var assignedAdminGroups;
	    console.log("update groups ");	    

	    if(member) {

	        assignedGroups = JSON.parse(member);
	    } else {
	        assignedGroups = [];
	    }

	    if(owner) {

	        assignedAdminGroups = JSON.parse(owner);
	    } else {
	        assignedAdminGroups = [];
	    }

    	var changedDn = dn != oldDn;
    	if (member != false || owner != false) {
	        ldaphelper.fetchGroups(function(groups) {
	        	var actions = [];
	        	console.log("fetch groups ");
	            for (var i = 0; i < groups.length; i++) {
	            	var group = groups[i];
	            	if (group && group.cn) {
		                var updatedMember = [],
		                    updated = false,
		                    updatedAdmin = [];

		                if (group.member && group.member instanceof Array) 
		                    updatedMember = group.member.slice();
		                else if (group.member != null && group.member != "")
		                    updatedMember.push(group.member);
		     
		                if (group.owner && group.owner instanceof Array) 
		                    updatedAdmin = group.owner.slice();
		                else if (group.owner != null && group.owner != "")
		                    updatedAdmin.push(group.owner);

		                // check if member list needs to be updated
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

		                if (member != false && updated) {
		                	actions.push(changeGroup(group, "member", updatedMember));		                
		                }

		                // check if owner list needs to be updated
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

		                if (owner != false && updated) {
		                	actions.push(changeGroup(group, "owner", updatedAdmin));
		                }    
		            }            
	            }
	            Promise.all(actions)
	            	.then(updatedFields => resolve(updatedFields))
	            	.catch(error => reject(error));
	        });
		} else {
			resolve([]);
		}
	});
};

var createUser = async function(user) {

    var entry = {
        cn: user.givenName + " " + user.surname,
        givenName: user.givenName,
        sn: user.surname,
        mail: user.email,
        userPassword: user.password,
        businessCategory: user.project
    };

    var uid = (user.givenName+ '_' + user.surname)
                .toLowerCase()
                .replace('ä', 'ae')
                .replace('ö', 'oe')
                .replace('ü', 'ue')
                .replace('ß', 'ss')
                .replace(' ', '_')
                .replace(/[\W]+/g,"")
                .substr(0,35);

	try {
		var createUser = new Promise((resolve, reject) => {
		    ldaphelper.getByUID(uid, function(LDAPuser) {
		        if (LDAPuser != null) {
		            ldaphelper.findUniqueUID(uid, 2, function(uniqueUID) {
		            	uid = uniqueUID;
		            	entry.uid = uniqueUID;
		            	user.uid = uniqueUID;
		                ldaphelper.encryptAndAddUser(entry, function(err) {
		                	if (err) {
		                		reject("LDAP: Fehler beim Erstellen der*des Benutzer*in im LDAP: " + err);
		                	} else {
		                		resolve();
		                	}
		                });
		            })
		        } else {
		        	entry.uid = uid;
		        	user.uid = uid;
	                ldaphelper.encryptAndAddUser(entry, function(err) {
	                	if (err) {
	                		reject("LDAP: Fehler beim Erstellen der*des Benutzer*in im LDAP: " + err);
	                	} else {
	                		resolve();
	                	}
	                });
		        }
		    });   
		});

		await createUser;
 		var cn = user.givenName + ' ' + user.surname;
		var dn = 'cn=' + cn + ',ou=users,' + config.ldap.server.base;
		await updateGroups(dn, dn, user.member, user.owner);
		return {status: true, message: "LDAP: Benutzer*in " + entry.cn + " im LDAP erstellt"};
	} catch (e) {
	    return {status: false, message: e};
	} 
};

var modifyUser = async function(user) {

	var updatedFields = [];

	var changedDnAction, fieldActions = [];
	var oldDn = user.dn;


    var fetchObject = new Promise((resolve, reject) => {
	    ldaphelper.fetchObject(oldDn, function(oldUser) {
	    	resolve(oldUser);
	    });
	});

    try{

    	oldUser = await fetchObject;


        var actions = [];

        var cn, dn, givenName = user.givenName, surname = user.surname;
        if (user.givenName === false) {
        	givenName = oldUser.givenName;
        } 
        if (user.surname === false) {
        	surname = oldUser.sn;
        }
       	cn = givenName + ' ' + surname;
       	dn = 'cn=' + cn + ',ou=users,'+ config.ldap.server.base;

        var changedDn = (user.surname != false || user.givenName != false) && dn != oldDn;
        
        if (changedDn) {
        	changedDnAction = ldaphelper.updateDN(oldDn, dn);
            updatedFields.push('DN');		            	
        }

        if ((user.surname != false || user.givenName != false) && cn != oldUser.cn) {
            console.log("new cn: " + cn);
        	fieldActions.push(ldaphelper.change(dn, 'replace', {cn : cn}));
            updatedFields.push('Name');		            	
        }        

        if (user.changedUid != false && user.changedUid !== "" && user.changedUid !== user.uid) {
            console.log("new uid: " + user.changedUid);
        	fieldActions.push(ldaphelper.change(dn, 'replace', {uid : user.changedUid}));
            updatedFields.push('User ID');		            	
        }

        if(user.givenName != false && user.givenName != oldUser.givenName) {
            console.log("new givenName: " + user.givenName);
        	fieldActions.push(ldaphelper.change(dn, 'replace', {givenName : user.givenName}));
            updatedFields.push('Vorname');		            	
        }

        if(user.surname != false && user.surname != oldUser.sn) {
            console.log("new sn: " + user.surname);
        	fieldActions.push(ldaphelper.change(dn, 'replace', {sn : user.surname}));
            updatedFields.push('Nachname');		            			        	
        }

        if(user.project != false && user.project != oldUser.businessCategory) {
            console.log("new businessCategory: " + user.project);
        	fieldActions.push(ldaphelper.change(dn, 'replace', {businessCategory : user.project}));
            updatedFields.push('Projekt');		            	
        }        

        if(user.email != false && user.email != oldUser.mail) {
            console.log("new mail: " + user.email);
        	fieldActions.push(ldaphelper.change(dn, 'replace', {mail : user.email}));
            updatedFields.push('E-Mail');		            			        	
        }

        if (user.password != false && user.password && user.password != oldUser.userPassword) {
        	var hash = await ldaphelper.hashPassword(user.password);
            console.log("new password: " + user.password + ' hash: ' + hash);
        	fieldActions.push(ldaphelper.change(dn, 'replace', {userPassword : hash}));  
            updatedFields.push('Passwort');		            			        	
        }


		updatedFields = updatedFields.concat(await updateGroups(dn, oldDn, user.member, user.owner));    	
		await changedDnAction;
		await Promise.all(fieldActions);
    	return {status: true, message: 'LDAP: Benutzer*in upgedated (' + updatedFields.join(', ') + ')'};
    }catch(error) {
    	return {status: false, message: error};
    }

};

var removeUser = async function(user) {
    if (user.dn == null) {
        return {status: false, message: 'LDAP: Kein*e Benutzer*in angegeben'};
    }
    try{
	    var updatedGroups = await updateGroups(user.dn, user.dn, null, null);
    	await ldaphelper.remove(user.dn);
    	var updatedGroupsText = 'keine';
    	if (updatedGroups.length > 0) {
    		updatedGroupsText = updatedGroups.join(', ');
    	}
    	return {status: true, message: 'LDAP: Benutzer*in gelöscht: ' + user.dn + ', Benutzer*in aus folgenden Gruppen ausgetragen: ' + updatedGroupsText};
    }catch(error) {
    	return {status: false, message: 'LDAP: Fehler beim Löschen der*des Benutzer*in ' + user.dn + ': ' + error};
    }	
};

var createGroup = async function(group) {
    var entry = {
          cn: group.name,
          description: group.description,
          objectClass: ['groupOfNames','top'],
          member: "",
          owner: ""
        };
    try {
    	await ldaphelper.add('cn=' + group.name + ',ou=groups,' + config.ldap.server.base, entry);
    	return {status: true, message: 'LDAP: Gruppe angelegt: ' + group.name};
    }catch(error) {
    	return {status: false, message: 'LDAP: Fehler beim Erstellen der Gruppe ' + group.name + ': ' + error};
    }    	
};

var modifyGroup = async function(group) {
	var updatedFields = [];
	var oldDn = group.dn;

    var fetchObject = new Promise((resolve, reject) => {
	    ldaphelper.fetchObject(oldDn, async function(oldGroup) {
	        var opts = {
	            scope: 'sub'
	        };

	        var actions = [];

	        var cn = group.name;
	        var dn = 'cn=' + cn + ',ou=groups,'+ config.ldap.server.base;
	        var changedDn = (group.name != false) && dn != oldDn;

	        if (changedDn) {
	            try{
	            	await ldaphelper.updateDN(oldDn, dn);
		            updatedFields.push('DN');		            	
	            }catch(error) {
	            	throw error;
	            }         	
	        }

	        if (group.name != false && cn != oldGroup.cn) {
	        	actions.push(ldaphelper.change(dn, 'replace', {cn : cn}));
	            updatedFields.push('Name');		            	
	        }

	        if(group.description != false && group.description != oldGroup.description) {
	        	actions.push(ldaphelper.change(dn, 'replace', {description : group.description}));
	            updatedFields.push('Beschreibung');		            	
	        }
	        
	        try{
    			await Promise.all(actions);
    			resolve();
    		}catch(error) {
    			throw "LDAP: Fehler beim Updaten eines Attrubutes: " + error;
    		}
	    });
	});
    try{
    	await fetchObject;
    	return {status: true, message: 'LDAP: Gruppe upgedated (' + updatedFields.join(', ') + ')'};
    }catch(error) {
    	return {status: false, message: error};
    }
};

var removeGroup = async function(group) {
    if (group.dn == null) {
        return {status: false, message: 'LDAP: Keine Gruppe angegeben'};
    }
    try{
    	await ldaphelper.remove(group.dn);
    	return {status: true, message: 'LDAP: Gruppe gelöscht: ' + group.dn};
    }catch(error) {
    	return {status: false, message: 'LDAP: Fehler beim Löschen der Gruppe ' + group.dn + ': ' + error};
    }	
};

exports.register = function(hooks) {
	hooks.user.create.on.push(createUser);
	hooks.user.modify.on.push(modifyUser);
	hooks.user.remove.on.push(removeUser);

	hooks.group.create.on.push(createGroup);
	hooks.group.modify.on.push(modifyGroup);
	hooks.group.remove.on.push(removeGroup);
};