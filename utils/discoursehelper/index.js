var config    = require('../../config/config.json');
var discourse = require('discourse-api');

var client = new discourse(config.discourse.APIURL, config.discourse.APIKEY, config.discourse.USERNAME);

exports.createUser = function(user, done) {

    client.put('admin/site_settings/enable_local_logins', { enable_local_logins:true }, function(error, bodyELL, httpCode) {
        console.log('enable_local_logins' + bodyELL);

    	client.createUser(user.givenName + ' ' + user.sn + ' - ' + user.businessCategory, user.mail, user.uid, user.userPassword, true, function(error, body, httpCode) {    
    		if (error) {
    			console.log("Error creating discoures user: " + error)
    			done(error);          
    		}

            // body_parsed = JSON.parse(body);

            // if (body_parsed != null && body_parsed.user_id != null) {
            //     client.put('admin/users/'+ body.user_id+'/deactivate', { }, function(error, bodyDA, httpCode) {
            //         console.log('deactivate user: ' + error);

            //         client.put('admin/users/'+ body.user_id+'/activate', { }, function(error, bodyA, httpCode) {
            //             console.log('activate user: ' + error);
            //         });

            //     });
            // }

      		console.log('Discourse create user body: ' + JSON.stringify(body) + ', error: ' + JSON.stringify(error) + ' http: ' + httpCode);  

            client.put('admin/site_settings/enable_local_logins', { enable_local_logins:false }, function(error, body, httpCode) {
                console.log('enable_local_logins' + body);
            });            

      		if(user.groups) {

            	var assignedGroups = JSON.parse(user.groups);
            	var assignedAdminGroups = JSON.parse(user.adminGroups);


            	client.get('admin/groups.json', {}, function (error, body, httpCode) {
            		if (httpCode == "200") {
            			var groups = JSON.parse(body);

            			groups.forEach(function(group) {

            				var dn = 'cn=' + group.name + ',ou=groups,dc=willy-fred,dc=org';

            				if (assignedGroups.indexOf(dn) > -1) {
            					client.put('groups/' + group.id + '/members.json', { usernames: user.uid}, function(error, body, httpCode) {
            						console.log('group add member body: ' + body);
            					});
            				}

            				if(assignedAdminGroups.indexOf(dn) > -1) {
            					client.put('groups/' + group.id + '/owners.json', { usernames: user.uid}, function(error, body, httpCode) {
            						console.log('group add owner body: ' + body);
            					});
            				}
            			});
            		}
        		});
            }

    	});


    });
};

exports.deleteUser = function(uid, done) {

    client.getUser(uid, function(error, user) {    
        if (error) {
            console.log("Error deleting discoures user: " + error)
            return done(error);          
        }
        client.deleteUser(user.id, uid, function (error, body, httpCode) {
            if (error) {
                done(error);
            } else {
                done();
            }
        });
    });
};

exports.updateUser = function(user, done) {
    client.getUser(user.uid, function(error, oldUser) {    
        if (error) {
            console.log("Error updating discoures user: " + error)
            return done(error);          
        }

        if (oldUser.email != user.mail) {
            client.put('users/'+ user.uid +'/preferences/email', { email: user.mail}, function(error, body, httpCode) {
                console.log('Discourse E-Mail changed, Error: ' + error);
            });
        }

        if (oldUser.name != user.givenName + ' ' + user.sn + ' - ' + user.businessCategory) {
            client.put('users/'+ user.uid, { name: user.givenName + ' ' + user.sn + ' - ' + user.businessCategory}, function(error, body, httpCode) {
                console.log('Discourse Display Name changed, Error: ' + error);
            });
        }
   
        if(user.groups) {

            var assignedGroups = JSON.parse(user.groups);
            var assignedAdminGroups = JSON.parse(user.adminGroups);

            client.get('admin/groups.json', {}, function (error, body, httpCode) {
                if (httpCode == "200") {
                    var groups = JSON.parse(body);

                    groups.forEach(function(group) {

                        var dn = 'cn=' + group.name + ',ou=groups,dc=willy-fred,dc=org';

                        if (assignedGroups.indexOf(dn) > -1) {
                            client.put('groups/' + group.id + '/members.json', { usernames: user.uid}, function(error, body, httpCode) {
                                console.log('group add member body: ' + body);
                            });
                        } else {
                            client.delete('groups/' + group.id + '/members.json', { user_id: oldUser.id}, function(error, body, httpCode) {
                            });
                        }

                        if(assignedAdminGroups.indexOf(dn) > -1) {
                            client.put('groups/' + group.id + '/owners.json', { usernames: user.uid}, function(error, body, httpCode) {
                                console.log('group add owner body: ' + body);
                            });
                        } else {
                            client.delete('groups/' + group.id + '/owners.json', { user_id: oldUser.id}, function(error, body, httpCode) {
                            });                            
                        }
                    });
                }
            });
        }
    });
};

exports.deleteGroup = function(cn, done) {
    client.get('admin/groups.json', {}, function (error, body, httpCode) {
        if (httpCode == "200") {
            var groups = JSON.parse(body);
            groups.forEach(function(group) {
                if (group.name == cn) {
                    client.delete('admin/groups/' + group.id, {}, function(error, body, httpCode) {
                        console.log('deleted group: ' + JSON.stringify(body) + ' httpCode: ' + httpCode);   
                        done(error);                       
                    });                       
                }
            });
        }
    });    
};

exports.createGroup = function(group, done) {
    client.post('admin/groups',
      {
        'group[alias_level]': 3,
        'group[automatic]': false,
        'group[automatic_membership_email_domains]': "",
        'group[automatic_membership_retroactive]': false,
        'group[grant_trust_level]': 0,
        'group[name]': group.cn,
        'group[primary_group]': false,
        'group[title]': "",
        'group[visible]': true


        // 'name': group.cn,
        // 'alias_level': 3,
        // 'automatic': false,
        // 'automatic_membership_email_domains': '',
        // 'automatic_membership_retroactive': false,
        // 'allow_membership_requests': false,        
        // 'grant_trust_level': 0,
        // 'primary_group': false,
        // 'title': '',
        // 'visible': true,
        // 'bio_raw': group.description
      },
      function(error, body, httpCode) {
        console.log('Group ' + group.cn + ' created: ' + JSON.stringify(body) + ' httpCode: ' + httpCode);
        done(error);
      }
    );  
};

exports.updateGroup = function(oldCn, newGroup, done) {

    client.get('admin/groups.json', {}, function (error, body, httpCode) {
        if (httpCode == "200") {
            var groups = JSON.parse(body);
            groups.forEach(function(group) {
                if (group.name == oldCn) {

                    group.name=newGroup.cn;
                    group.bio_raw=newGroup.description;

                    client.put('admin/groups/' + group.id, {group}, function(error, body, httpCode) {
                        console.log('updated group: ' + JSON.stringify(body) + ' httpCode: ' + httpCode);   
                        done(error);                       
                    });                       
                }
            });
        }
    });   
};