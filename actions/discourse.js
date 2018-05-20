var config    = require('../config/config.json');
var discourse = require('discourse-api');
var Promise = require("bluebird");	
var request = require('request');
var fs = require('fs');
var client = new discourse(config.discourse.APIURL, config.discourse.APIKEY, config.discourse.USERNAME);

Array.prototype.insensitiveIndexOf = function (searchElement, fromIndex) {
    return this.map(function (value) {
        return value.toLowerCase();
    }).indexOf(searchElement.toLowerCase(), fromIndex);
};

Array.prototype.clean = function(deleteValue) {
  return this.filter(function(n){ return n != deleteValue });
};


var addToGroup = function(group, uid, owner) {
	return new Promise((resolve, reject) => {
		var url;
		var ownerText = '';
		if (owner) {
			url = 'admin/groups/' + group.id + '/owners.json';
			ownerText = '(owner)';
		} else {
			url = 'groups/' + group.id + '/members.json';
		}
		put(url, {usernames: uid})
			.then(() => resolve())
			.catch(() => resolve());		
	});
}

var removeFromGroup = function(group, uid, owner) {
	return new Promise((resolve, reject) => {
		var url;
		var ownerText = '';
		if (owner) {
			url = 'admin/groups/' + group.id + '/owners.json';
			ownerText = ', owner';
		} else {
			url = 'groups/' + group.id + '/members.json';
		}
		del(url, {username:uid})
			.then(() => resolve())
			.catch(() => resolve());
	});
}

var put = function(url, parameters) {
	return new Promise((resolve, reject) => {
		console.log('PUT URL: ' + url + ', parameters: ' + JSON.stringify(parameters));
        client.put(url, parameters, function(error, body, httpCode) {
        	if (body instanceof Object) {
           		console.log('PUT response: HTTP(' + httpCode + '), body: ' + JSON.stringify(body));
        	} else {
           		console.log('PUT response: HTTP(' + httpCode + '), body: ' + body);
           	}
        	if (error || httpCode != "200" || body && body.success == false) {
                reject('HTTP(' + httpCode + ') URL: ' + url + ', Parameters: ' + JSON.stringify(parameters) + ', Error: ' +  error + ', Body: ' + body);  
            } else {
            	resolve();
            }
        });			    	
    });			    		
}

var get = function(url, parameters)  {
	return new Promise((resolve, reject) => {
		console.log('GET URL: ' + url + ', parameters: ' + JSON.stringify(parameters));
        client.get(url, parameters, function (error, body, httpCode) {
        	if (body instanceof Object) {
           		console.log('GET response: HTTP(' + httpCode + '), body: ' + JSON.stringify(body));
        	} else {
           		console.log('GET response: HTTP(' + httpCode + '), body: ' + body);
           	}
    		if (httpCode == "200") {
    			resolve(JSON.parse(body));
    		} else {
    			reject('HTTP(' + httpCode + ') URL: ' + url + ', Parameters: ' + JSON.stringify(parameters) + ', Error: ' +  error + ', Body: ' + body);  
    		}	
    	});
	});
}

var post = function(url, parameters)  {
	return new Promise((resolve, reject) => {
		console.log('POST URL: ' + url + ', parameters: ' + JSON.stringify(parameters));
        client.post(url, parameters, function (error, body, httpCode) {
        	if (body instanceof Object) {
           		console.log('POST response: HTTP(' + httpCode + '), body: ' + JSON.stringify(body));
        	} else {
           		console.log('POST response: HTTP(' + httpCode + '), body: ' + body);
           	}
    		if (httpCode == "200") {
    			resolve(JSON.parse(body));
    		} else {
    			reject('HTTP(' + httpCode + ') URL: ' + url + ', Parameters: ' + JSON.stringify(parameters) + ', Error: ' +  error + ', Body: ' + JSON.stringify(body));  
    		}	
    	});
	});
};

var del = function(url, parameters)  {
	return new Promise((resolve, reject) => {
		console.log('DEL URL: ' + url + ', parameters: ' + JSON.stringify(parameters));
        client.delete(url, parameters, function (error, body, httpCode) {
        	if (body instanceof Object) {
           		console.log('DEL response: HTTP(' + httpCode + '), body: ' + JSON.stringify(body));
        	} else {
           		console.log('DEL response: HTTP(' + httpCode + '), body: ' + body);
           	}
    		if (httpCode == "200") {
    			resolve(JSON.parse(body));
    		} else {
    			reject('HTTP(' + httpCode + ') URL: ' + url + ', Parameters: ' + JSON.stringify(parameters) + ', Error: ' +  error + ', Body: ' + body);  
    		}	
    	});
	});
};

// parameter uid (LDAP uid)
// resolves with discourse user
// rejects with error message if user is not found
var getUser = function(uid, fetchEmail = true) {
	return new Promise((resolve, reject) => {
			get('users/'+ uid + '.json', {})
			    	.then(userObject => { 
				    			var user = userObject.user;
						        if (!userObject){
						        	reject('Benutzer*in nicht gefunden');
						        } else {
						        	if (fetchEmail) {
						    			get('users/'+ user.username + '/emails.json', {context: 'admin/users/'+user.id+'/'+uid})
						    				.then((emailObject) => {
						    					console.log('found email for ' + uid + ': ' + emailObject.email);
						    					user.email = emailObject.email;
						    					resolve(user);
						    				})
						    				.catch((error) => reject(error));						        		
						        	} else {
						        		resolve(user);
						        	}
					    		}
					})
					.catch((error) => reject(error));
   		});
};

var getGroupId = function(name) {
	return new Promise((resolve, reject) => {
		get('admin/groups.json', {})
			.then(function(groups) {
				var group = groups.find(function(group) {
					return group.name.toLowerCase() === name.toLowerCase();
				});
				if (group) {
					resolve(group.id);
				} else {
					reject('Gruppe ' + name + ' nicht gefunden');
				}
			});
	});
};

var getNameFromDN = function(dn) {
	return new Promise((resolve, reject) => {
		var name = dn.split(',')[0].replace('cn=', '');
		if (name && name != "") {
			resolve(name);
		} else {
			reject('Gruppenname aus DN nicht lesbar');
		}
	});
};

var getNameFromDNSync = function(dn) {
	return dn.split(',')[0].replace('cn=', '');
};

// data.user user object (LDAP), resolves with data object if user groups in discourse match data.user.owner and data.user.member
// it rejects with array of missing groups or additional groups in discourse
//
// NOTE: owner for now is disabled because the data does not come with the user object
var checkUserGroups = function(data) {
	return new Promise((resolve, reject) => {
		getUser(data.user.uid, false)
			.then(discourseUser => {
				var ldapGroups = [];
				//var ldapOwner = [];
				if (data.user.member) {
					ldapGroups = JSON.parse(data.user.member);
				}
/*				if (data.user.owner) {
					ldapOwner = JSON.parse(data.user.owner);
				}*/

				//console.log('Discourse user: ' + JSON.stringify(discourseUser));

				//console.log('LDAP groups: ' + JSON.stringify(ldapGroups));
				//console.log('LDAP groups (owner): ' + JSON.stringify(ldapOwner));


				// build groups and owner listes out of discourse user object
				var discourseGroups = discourseUser.groups.filter((group) => { return !group.automatic; });
/*				var discourseOwnerIds = discourseUser.group_users.filter((relation) => {return relation.owner; });
				var discourseOwners = [];
				discourseOwnerIds.forEach((relation) => {
					discourseOwner.push(discourseGroups.find((group) => {return group.id === relation.group_id}));
				});
				console.log('Discourse groups: ' + JSON.stringify(discourseGroups));
				console.log('Discourse groups (owner ids): ' + JSON.stringify(discourseOwnerIds));
				console.log('Discourse groups (owner): ' + JSON.stringify(discourseOwners));*/

				// missing groups in discourse
				var missingGroups = [];
				ldapGroups.forEach((member) => {
					var discourseGroup = discourseGroups.find((group) => { return member === 'cn=' + group.name.toLowerCase() + ',ou=groups,' + config.ldap.server.base;});
					if (!discourseGroup) {
						missingGroups.push(getNameFromDNSync(member));
					}
				});

				// excess groups in discourse
				var excessGroups = [];
				discourseGroups.forEach((discourseGroup) => {				
					var member = ldapGroups.find((member) => {return member === 'cn=' + discourseGroup.name.toLowerCase() + ',ou=groups,' + config.ldap.server.base;})
					if (!member) {
						excessGroups.push(discourseGroup.name.toLowerCase());
					}
				});
/*
				// missing owner in discourse
				var missingOwner = [];
				ldapOwner.forEach((owner) => {
					var discourseOwner = discourseOwners.find((group) => { return owner === 'cn=' + group.name.toLowerCase() + ',ou=groups,' + config.ldap.server.base;});
					if (!discourseOwner) {
						missingOwner.push(getNameFromDNSync(owner));
					}
				});

				// excess owner in discourse
				var excessOwner = [];
				discourseOwners.forEach((discourseGroup) => {					
					var owner = ldapOwner.find((owner) => {return owner === 'cn=' + discourseGroup.name.toLowerCase() + ',ou=groups,' + config.ldap.server.base;})
					if (!owner) {
						excessOwner.push(discourseGroup.name.toLowerCase());
					}
				});	*/	

				if (missingGroups.length === 0 && excessGroups.length === 0/* && missingOwner.length === 0 && excessOwner.length === 0*/) {
					resolve(data);
				} else {
					var errorText = 'Discoures Gruppeneinstellungen stimmen nicht überein:';
					if (missingGroups.length > 0) {
						errorText += ' Gruppenzugehörigkeit fehlt: ' + missingGroups.join(', ') + '.';
					}
					if (excessGroups.length > 0) {
						errorText += ' Gruppenzugehörigkeit zu viel: ' + excessGroups.join(', ') + '.';
					}
/*					if (missingOwner.length > 0) {
						errorText += ' Gruppenzugehörigkeit (owner) fehlt: ' + missingOwner.join(', ') + '.';
					}
					if (excessOwner.length > 0) {
						errorText += ' Gruppenzugehörigkeit (owner) zu viel: ' + excessOwner.join(', ') + '.';
					}*/
					 
					reject(errorText);
				}
			}).catch((error) => reject(error));
	});
};


var createUser = async function(user) {
	var enableDisableLocalLogins = function(enable) {
		return new Promise((resolve, reject) => {
		    client.put('admin/site_settings/enable_local_logins', { enable_local_logins:enable }, function(error, bodyELL, httpCode) {
		    	if (error) {
		        	reject(error);
			    } else {
			    	resolve();
			    }
			});
		});
	};

	var createUser = function(user) {
		return new Promise((resolve, reject) => {

	        var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_?!';
	        var uncrackable = '';
	        for (var i = 20; i > 0; --i) {
	          uncrackable += chars[Math.round(Math.random() * (chars.length - 1))];
	        }
	        password = uncrackable;

	    	client.createUser(user.givenName + ' ' + user.surname + ' - ' + user.project, user.email, user.uid, password, true, function(error, body, httpCode) { 
		    	if (error || httpCode != "200" || body && body.success == false) {
		    		reject('Benutzer*in einfügen, Parameter: ' + JSON.stringify({name: user.givenName + ' ' + user.surname + ' - ' + user.project, email: user.email, username: user.uid, password: "versteckt"}) + ': HTTP(' + httpCode + ') Error: ' +  error + ', Body: ' + JSON.stringify(body));  
		   		} else {
	          		if(user.member) {

	                	var assignedGroups = JSON.parse(user.member);
	                	var assignedAdminGroups = JSON.parse(user.owner);

	                	get('admin/groups.json', {})
	                		.then((groups) => {
	                			var actions = [];
					            for (var i = 0; i < groups.length; i++) {
					            	var group = groups[i];

	                				var dn = 'cn=' + group.name.toLowerCase() + ',ou=groups,' + config.ldap.server.base;

	                				if(assignedAdminGroups.insensitiveIndexOf(dn) > -1) {
	                					actions.push(addToGroup(group, user.uid, true));
	                				}
	                				else if (assignedGroups.insensitiveIndexOf(dn) > -1) {
	                					actions.push(addToGroup(group, user.uid, false));
	                				}
	                			}
	                			return Promise.all(actions);
	                		})
	                		.then(() => resolve())
	                		.catch((error) => reject(error));
	                } else {
	                	resolve();
	                }          
		    	}
		    });
		});
	};
	try{
		await enableDisableLocalLogins(true);
		await new Promise(resolve => setTimeout(resolve, 500));		
    	await createUser(user);
    	await new Promise(resolve => setTimeout(resolve, 500));
        await enableDisableLocalLogins(false);
    	return {status: true, message: 'DISCOURSE: Benutzer*in erstellt: ' + user.givenName + ' ' + user.surname};
    }catch(error) {
    	return {status: false, message: 'DISCOURSE: Erstellung von Benutzer*in ' + user.givenName + ' ' + user.surname + ' fehlgeschlagen: ' + error};
    }	
};



var modifyUser = function(user) {
	return new Promise((resolve, reject) => {
		console.log('begin');
	    get('users/'+ user.uid + '.json', {})
	    	.catch(() => {
	    		resolve({status: true, message: 'DISCOURSE: Benutzer*in noch nicht angelegt, überspringe Aktion'});
	    	})	    
	    	.then(userObject => { 
	    		return new Promise((resolve, reject) => {
	    			var user = userObject.user;
			        if (!userObject){
			        	reject('Benutzer*in nicht gefunden');
			        	//resolve({status: true, message: 'DISCOURSE: Benutzer*in noch nicht angelegt, überspringe Aktion'});
			        } else {
		    			get('users/'+ user.username + '/emails.json', {})
		    				.then((emailObject) => {
		    					user.email = emailObject.email;
		    					resolve(user);
		    				})
		    				.catch((error) => reject(error));
		    		}
	    		});
	    	})
	      	.then(oldUser => { 
	        	console.log('oldDiscourseUser: ' + JSON.stringify(oldUser));
	        	var actions = [];
	        	var updatedFields = [];

		        if (user.email !== false && oldUser.email != user.email) {
		        	actions.push(new Promise((resolve, reject) => { 
		        		put('users/'+ user.uid +'/preferences/email', {email: user.email})
		        			.then((result) => resolve('E-Mail'), (error) => reject(error)); 
		        	}));
		        }  
		        if (user.givenName && user.surname && user.project && oldUser.name != user.givenName + ' ' + user.surname + ' - ' + user.project) {
		        	actions.push(new Promise((resolve, reject) => { 
		        		put('users/'+ user.uid, {name: user.givenName + ' ' + user.surname + ' - ' + user.project})
		        			.then((result) => resolve('Name'), (error) => reject(error)); 
		        	}));			        	
		        }

		        var memberUpdate = new Promise((resolve, _) => {

			        if(user.member) {

			            var assignedGroups = JSON.parse(user.member);
			            var assignedAdminGroups = JSON.parse(user.owner);

			           	get('admin/groups.json', {})
			           		.then(groups => {
			           			var actions = [];
					            for (var i = 0; i < groups.length; i++) {
					            	var group = groups[i];

			        				var dn = 'cn=' + group.name.toLowerCase() + ',ou=groups,' + config.ldap.server.base;

			        				if(assignedAdminGroups.insensitiveIndexOf(dn) > -1) {
			        					actions.push(addToGroup(group, user.uid, true));
			        				}
			        				else if (assignedGroups.insensitiveIndexOf(dn) > -1) {
			        					actions.push(addToGroup(group, user.uid, false));
			        					actions.push(removeFromGroup(group, user.uid, true));
			        				} else {
			        					actions.push(removeFromGroup(group, user.uid, false));                					
			        				}
			        			}
			        			resolve(actions);
			        		})
			        		.catch((error) => reject(error));
			        } else {
			        	resolve([]);
			        }
		        }); 
				memberUpdate.then(memberActions => {
					Promise.all(actions.concat(memberActions))
						.then((updatedFields) => {
							// if UID is changed change it last (to not interfere with other changes)
							if(user.changedUid != false && user.changedUid !== "" && user.changedUid !== user.uid) {								
								return put('users/' + user.uid + '/preferences/username', {new_username: user.changedUid})
									.then(() => {
										updatedFields.push('User ID');
										user.uid=user.changedUid;
										return Promise.resolve(updatedFields);
									});
							} else {
								return updatedFields;
							}
						})
						.then(updatedFields => {
							if (user.member === false && user.owner === false) {
								resolve({status: true, message: 'DISCOURSE: Benutzer*in upgedated: (' + updatedFields.clean(undefined).join(', ') + ')'});								
							} else {
								checkUserGroups({user: user})
									.then(() => {
										resolve({status: true, message: 'DISCOURSE: Benutzer*in upgedated: (' + updatedFields.clean(undefined).join(', ') + ')'});
									})
									.catch((error) => {
								    	resolve({status: false, message: 'DISCOURSE: Ändern von Benutzer*in ' + user.uid + ' fehlgeschlagen: ' +  error});
									});
							}

						})
						.catch((error )=> {						
					    	resolve({status: false, message: 'DISCOURSE: Ändern von Benutzer*in ' + user.uid + ' fehlgeschlagen: ' +  error});
					    });
				})

		    }, error => {
		    	resolve({status: false, message: 'DISCOURSE: Ändern von Benutzer*in ' + user.uid + ' fehlgeschlagen: ' +  error});
		    });
	});
};


var removeUser = function(user) {
	return new Promise((resolve, reject) => {
		getUser(user.uid)
	    	.catch(() => {
	    		resolve({status: true, message: 'DISCOURSE: Benutzer*in noch nicht angelegt, überspringe Aktion'});
	    	})				
			.then((discourseUser) => {
				if (!discourseUser) {
		        	throw 'Benutzer*in  ' + user.uid + ' nicht gefunden';
				} else {
					return del('admin/users/' + discourseUser.id + '.json', {context: '/admin/users/' + user.uid});
				}
			})	
			.then(() => {
		        resolve({status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' gelöscht'});
			})
			.catch((error) => {
	            resolve({status: false, message: 'DISCOURSE: Fehler beim Löschen der*des Benutzer*in ' + user.uid + ': ' +  error});
			})
	});
};



var removeGroup = function(group) {
	return new Promise((resolve, reject) => {
		getNameFromDN(group.dn)
		 	.then(name => getGroupId(name))
			.then(id => del('admin/groups/' + id, {}))
			.catch(function(error) {
				resolve({status : true, message: 'DISCOURSE: Gruppe nicht vorhanden'});	
			})
			.then(function () {
				resolve({status: true, message: 'DISCOURSE: Gruppe gelöscht'});
			})
			.catch(function(error) {
				resolve({status: false, message: 'DISCOURSE: Fehler beim Löschen der Gruppe: ' + error});
			});
	});
};

var createGroup = function(group) {
	return new Promise((resolve, reject) => {
		post('admin/groups', {
		    'group[alias_level]': 3,
		    'group[automatic]': false,
		    'group[automatic_membership_email_domains]': "",
		    'group[automatic_membership_retroactive]': false,
		    'group[grant_trust_level]': 0,
		    'group[name]': group.name,
		    'group[primary_group]': false, 
		    'group[title]': "",
		    'group[visible]': true,
		    'group[bio_raw]': group.description
		}).then(function() {
			resolve({status : true, message: 'DISCOURSE: Gruppe ' + group.name + ' erstellt'});
		}, function(error) {
			resolve({status : false, message: 'DISCOURSE: Fehler beim Erstellen der Gruppe ' + group.name + ': ' + error});
		});
	});
};

var modifyGroup = function(group) {
	return new Promise((resolve, reject) => {
		getNameFromDN(group.dn)
		 	.then(name => getGroupId(name))
			.then(id => put('admin/groups/' + id, {
				'group[name]': group.name, 
				'group[bio_raw]': group.description}))
			.then(function () {
				//console.log('DC response: ' + JSON.stringify(response));
				resolve({status: true, message: 'DISCOURSE: Gruppe upgedated'});
			})
			.catch(function(error) {
				resolve({status: false, message: 'DISCOURSE: Fehler beim Update der Gruppe: ' + error});
			});
	});			
};

var uploadFile = function(file) {

	return new Promise((resolve, reject) => {
		var req = request.post(config.discourse.APIURL + '/uploads.json?synchronous=true&type=composer&api_key=' + config.discourse.APIKEY + '&api_username=' + config.discourse.USERNAME, function(err, resp, body) {
			console.log('upload file response: error: ' + err + ', body: ' + body)
			var bodyParsed = JSON.parse(body);
			if (err || bodyParsed && bodyParsed.errors) {
				reject('HTTP(' + httpCode + ') URL: ' + config.discourse.APIURL + '/uploads.json' + ', Error: ' +  err + ', Body: ' + body);  
			} else {
				resolve(bodyParsed.id);
			}
		});
		var form = req.form();
		fs.rename(file.path, file.destination + file.originalname, function (err) {
			if (err) {
				console.log('ERROR RENAMING FILE: ' + err)
			}
		});
		form.append('files[]', fs.createReadStream(file.destination + file.originalname));
	});

};

var buildCategory = function(category) {
	var post = {
        name: category.name,
        //slug: category.name.replace(/[^A-Z0-9]/ig, "_").toLowerCase(),
        color: category.color.substring(1,7),
        text_color: "FFFFFF",
        parent_category_id: '',
        allow_badges:true,
        sort_order: '',
        topic_featured_link_allowed:true,
        default_view: 'latest',
        default_top_period: 'all',
    }
    if (category.parent && category.parent !== '-1') {
        post.parent_category_id = category.parent;
    }
    if (category.groups && Array.isArray(category.groups)) {
        category.groups.forEach(function(group) {
            post['permissions[' + group +']'] = 1;
        });
    }	
	return Promise.resolve()
    	.then(() => {
    		if (category.logo && category.logo.path && category.logo.path !="") {
    			return uploadFile(category.logo);
    		} else {
    			return;
    		}
    	})
    	.then((logoId) => {
    		if (logoId) {
    			post.uploaded_logo_id = logoId;	
    		} else if (category.delete_image){
    			post.uploaded_logo_id = '';
    		}
    		return post;
    	});
}

var createCategory = function(category) {
	return new Promise((resolve, reject) => {
		buildCategory(category)
	    	.then((catObject) => {
	    		return post('categories', catObject);
	    	})
	    	.then(() => resolve({status:true, message: 'DISCOURSE: Kategorie erstellt'}))
	    	.catch((error) => resolve({status: false, message: 'DISCOURSE: Fehler beim Erstellen der Kategorie: ' + error}));
	});    
};

var modifyCategory = function(category) {
	return new Promise((resolve, reject) => {
		buildCategory(category)
	    	.then((catObject) => {
	    		return put('categories/' + category.id, catObject);
	    	})
	    	.then(() => resolve({status:true, message: 'DISCOURSE: Kategorie geändert'}))
	    	.catch((error) => resolve({status: false, message: 'DISCOURSE: Fehler beim Ändern der Kategorie: ' + error}));
	});
};

var removeCategory = function(category) {
	return new Promise((resolve, reject) => {
		del('categories/'+category.id, {})
			.then(() => resolve({status: true, message: 'DISCOURSE: Kategorie gelöscht'}))
			.catch((error) => resolve({status: false, message: 'DISCOURSE: Fehler beim Löschen der Kategorie: ' + error}));
	});
};



exports.register = function(hooks) {
	// disable user creation since it is now done automatically on first login
	//hooks.user.create.post.push(createUser);
	hooks.user.modify.post.push(modifyUser);
	hooks.user.remove.post.push(removeUser);

	hooks.group.create.post.push(createGroup);
	hooks.group.modify.post.push(modifyGroup);
	hooks.group.remove.post.push(removeGroup);

	hooks.category.create.on.push(createCategory);
	hooks.category.modify.on.push(modifyCategory);
	hooks.category.remove.on.push(removeCategory);
};