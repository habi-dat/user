/*jshint esversion: 6 */
var config    = require('../config/config.json');
var discourse = require('../utils/discoursehelper');
var ldaphelper = require('../utils/ldaphelper');
var crypto = require('crypto');
var Promise = require("bluebird");

var fs = require('fs');

// parameter uid (LDAP uid)
// resolves with discourse user
// rejects with error message if user is not found
var getUser = function(uid, fetchEmail = false) {
  return discourse.get('users/'+ uid + '.json')
    .catch(error => {
      return discourse.get('u/by-external/'+ uid + '.json')
    })
    .then(response => {
      console.log(response.user);
      if (fetchEmail) {
        return discourse.get('users/'+ response.user.username + '/emails.json', {context: 'admin/users/'+response.user.id+'/'+response.user.username})
          .then(emailObject => {
            response.user.email = emailObject.email;
            return response.user;
          });
      } else {
        return response.user;
      }
    })
};

var getGroupId = function(name) {
  return discourse.get('groups/' + name + '.json', {})
      .then(function(result) {
        return result.group.id;
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


var createUser = function(user, currentUser) {
  return ldaphelper.groupDnToO(user.ou)
    .then(title => discourse.createUser(user.cn, user.mail, user.password?user.password:crypto.randomBytes(20).toString('hex'), user.uid, title || '-'))
    .then(discourseUser => {
      var groups = user.member.map(group => { return ldaphelper.dnToCn(group);});
      return Promise.all(groups.map(group => {
          return getGroupId(group)
            .then(addGroupId => discourse.addGroupMembers(addGroupId, [user.uid]))
            .catch(error => { return;});
        }))      
    })
    .then(() => { return {status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' erstellt und zu Gruppen ' + user.member.join(',') + ' hinzugefügt'};})
    .catch(error =>  { return {status: false, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' konnte nicht erstellt werden: ' + error};})
}

var modifyUser = function(user, currentUser) {
  return getUser(user.uid, false)
    .then(discourseUser => {
      if (discourseUser.last_seen_at === null) {
          // if user has not logged in recreate user to also update email and prevent account highjacking or mismatching on first login
          return discourse.del('admin/users/' + discourseUser.id + '.json', {context: '/admin/users/' + discourseUser.id + '/' + discourseUser.username})            
            .then(() => createUser(user, currentUser))
            .then(result => {
               if (result.status) {
                  return {status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' neu erstellt'};
               } else {
                  return result;
               }
            })
      }
      else {
        return discourse.post('admin/users/' + discourseUser.id + '/log_out', {})
          .then(() => ldaphelper.groupDnToO(user.ou))
          .then(title => discourse.modifyUser(user.cn, user.uid, title || '-'))
          .then(() => {
            if (user.member != false) {
              return ldaphelper.fetchUser(user.dn)
                .then(ldapUser => {
                  // map to group cn
                  var newGroups = ldapUser.member.map(group => { return ldaphelper.dnToCn(group);});
                  // filter discourse internal groups
                  var oldGroupsFiltered = discourseUser.groups.filter(group => {return !group.automatic;});
                  // map to group name
                  var oldGroups = oldGroupsFiltered.map(group => { return group.name });

                  addGroups = newGroups.filter(member => {
                    return !oldGroups.includes(member);
                  })
                  removeGroups = oldGroups.filter(member => {
                    return !newGroups.includes(member);
                  })
                  return Promise.all(addGroups.map(addGroup => {
                      return getGroupId(addGroup)
                        .then(addGroupId => discourse.addGroupMembers(addGroupId, [user.uid]))
                        .catch(error => { return;});
                    }))
                    .then(() => Promise.all(removeGroups.map(removeGroup => {
                      return getGroupId(removeGroup)
                            .then(removeGroupId => discourse.removeGroupMembers(removeGroupId, [user.uid]))
                            .catch(error => { return;});
                    })))

                })
                .then(() => { return {status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' upgedated und ausgeloggt'};})
            } else {
              return {status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' upgedated und ausgeloggt'};
            }
          })
          .catch(error => { return {status: false, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' konnte nicht upgedated oder ausgeloggt werden: ' + error};})         
      }
    })    
    .catch(error => { return {status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' nicht gefunden, Schritt wird übersprungen'};});
};


var removeUser = function(user, currentUser) {
  return getUser(user.uid, false)
      .then(discourseUser => discourse.del('admin/users/' + discourseUser.id + '.json', {context: '/admin/users/' + discourseUser.id + '/' + discourseUser.username})
        .then(() => { return {status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' gelöscht'}; })
        .catch(error => discourse.put('admin/users/' + discourseUser.id + '/suspend', {suspend_until: '3018-01-01', reason: 'Gelöscht durch User Tool'})
          .then(() => { return {status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' konnte nicht gelöscht werden und wurde deshalb deaktiviert'};})
          .catch(error => {return {status: false, message: 'DISCOURSE: Fehler beim Löschen oder Deaktivieren der*des Benutzer*in ' + user.uid + ': ' +  error}; })
        )
      )
      .catch(error => {console.log(error); return {status: true, message: 'DISCOURSE: Überspringe Schritt, Benutzer*in ' + user.uid + ' nicht gefunden' }; });
};



var removeGroup = function(group, currentUser) {
  return getNameFromDN(group.dn)
      .then(name => getGroupId(name)
        .then(id => discourse.del('admin/groups/' + id + '.json', {}))
        .then(() => {  return {status: true, message: 'DISCOURSE: Gruppe gelöscht'}; })
        .catch(error => { return {status: false, message: 'DISCOURSE: Fehler beim Löschen der Gruppe: ' + error}; })
      )
      .catch(error =>  { return {status : true, message: 'DISCOURSE: Gruppe nicht vorhanden: ' + error}; });
};

var createGroup = function(group, currentUser) {
	return ldaphelper.dnToUid(JSON.parse(group.member))
		.then(uids => discourse.post('admin/groups', {
	        'group[alias_level]': 3,
	        'group[automatic]': false,
	        'group[automatic_membership_email_domains]': "",
	        'group[automatic_membership_retroactive]': false,
	        'group[mentionable_level]': 3,
	        'group[messageable_level]': 3,
	        'group[grant_trust_level]': 0,
	        'group[name]': group.cn,
	        'group[full_name]': group.o,
	        'group[primary_group]': false,
	        'group[title]': "",
	        'group[visible]': true,
	        'group[bio_raw]': group.description,
	        'group[usernames]': uids.join(',')
	    }))
	    .then(() => { return {status : true, message: 'DISCOURSE: Gruppe ' + group.cn + ' erstellt'}; })
	    .catch(error => { return {status : false, message: 'DISCOURSE: Fehler beim Erstellen der Gruppe ' + group.cn + ': ' + error}; });
};

var modifyGroup = function(group, currentUser) {
  	return getNameFromDN(group.dn)
    	.then(name => getGroupId(name)
		      	.then(id => {
		      		return discourse.put('groups/' + id + '.json', {
				        	'group[name]': group.cn,
				        	'group[full_name]': group.o,
				        	'group[bio_raw]': group.description
			      		})
			      		.then(() => Promise.join(ldaphelper.dnToUid(JSON.parse(group.member)), discourse.getGroupMembers(name),
			      			(newMembers, oldMembers) => {
			      				addMembers = newMembers.filter(member => {
			      					return !oldMembers.includes(member);
			      				})
			      				removeMembers = oldMembers.filter(member => {
			      					return !newMembers.includes(member);
			      				})
			      				return discourse.addGroupMembers(id, addMembers)
			      					.then(discourse.removeGroupMembers(id, removeMembers));
			      			})
			      		);
			    })
		      	.then(() => { return {status: true, message: 'DISCOURSE: Gruppe upgedated'}; })
		      	.catch(error => { return {status: false, message: 'DISCOURSE: Fehler beim Update der Gruppe: ' + error}; })
    )
    .catch(error => { return {status: true, message: 'DISCOURSE: Gruppe nicht gefunden, überspringe Schritt'}; });
};

// var uploadFile = function(file) {

//   return new Promise((resolve, reject) => {
//     var req = request.discourse.post(config.discourse.APIURL + '/uploads.json?synchronous=true&type=composer&api_key=' + config.discourse.APIKEY + '&api_username=' + config.discourse.USERNAME, function(err, resp, body) {
//       console.log('upload file response: error: ' + err + ', body: ' + body)
//       var bodyParsed = JSON.parse(body);
//       if (err || bodyParsed && bodyParsed.errors) {
//         reject('HTTP(' + httpCode + ') URL: ' + config.discourse.APIURL + '/uploads.json' + ', Error: ' +  err + ', Body: ' + body);
//       } else {
//         resolve(bodyParsed.id);
//       }
//     });
//     var form = req.form();
//     fs.rename(file.path, file.destination + file.originalname, function (err) {
//       if (err) {
//         console.log('ERROR RENAMING FILE: ' + err)
//       }
//     });
//     form.append('files[]', fs.createReadStream(file.destination + file.originalname));
//   });

// };

var buildCategory = function(category) {
  return new Promise((resolve, reject) => {

    var post = {
        name: category.name,
        color: category.color.substring(1,7),
        text_color: "FFFFFF",
        parent_category_id: '',
        allow_badges:true,
        sort_order: '',
        topic_featured_link_allowed:true,
        default_view: 'latest',
        default_top_period: 'all'
    };
    if (category.parent && category.parent !== '-1') {
        post.parent_category_id = category.parent;
    }
    if (category.groups && Array.isArray(category.groups)) {
        category.groups.forEach(function(group) {
            post['permissions[' + group +']'] = 1;
        });
    }

    resolve(post);

  });

};

  var buildCategoryUpdate = function(category) {
  return new Promise((resolve, reject) => {

    var post = {
        name: category.name,
        text_color: "FFFFFF",
        color: category.color.substring(1,7),
        parent_category_id: ''
    };
    if (category.parent && category.parent !== '-1') {
        post.parent_category_id = category.parent;
    }
    if (category.groups && Array.isArray(category.groups)) {
        category.groups.forEach(function(group) {
            post['permissions[' + group +']'] = 1;
        });
    }

    resolve(post);

  });
  // return Promise.resolve()
  //     .then(() => {
  //       if (category.logo && category.logo.path && category.logo.path !="") {
  //         return uploadFile(category.logo);
  //       } else {
  //         return;
  //       }
  //     })
  //     .then((logoId) => {
  //       if (logoId) {
  //         discourse.post.uploaded_logo_id = logoId;
  //       } else if (category.delete_image){
  //         discourse.post.uploaded_logo_id = '';
  //       }
  //       return discourse.post;
  //     });
};

var createCategory = function(category, currentUser) {
  return buildCategory(category)
    .then(catObject => discourse.post('categories', catObject))
    .then(() => { return {status:true, message: 'DISCOURSE: Kategorie erstellt'}; })
    .catch(error => { return {status: false, message: 'DISCOURSE: Fehler beim Erstellen der Kategorie: ' + error}; });
};

var modifyCategory = function(category, currentUser) {
  return buildCategoryUpdate(category)
    .then(catObject => discourse.put('categories/'+category.id, catObject))
    .then(() => { return {status:true, message: 'DISCOURSE: Kategorie geändert'}; })
    .catch(error => { return {status: false, message: 'DISCOURSE: Fehler beim Ändern der Kategorie: ' + error}; });
};

var removeCategory = function(category, currentUser) {
  return discourse.del('categories/'+category.id, {})
    .then(() => { return {status: true, message: 'DISCOURSE: Kategorie gelöscht'}; })
    .catch(error => { return {status: false, message: 'DISCOURSE: Fehler beim Löschen der Kategorie: ' + error}; });
};

exports.register = function(hooks) {
  // disable user creation since it is now done automatically on first login
  //hooks.user.create.discourse.post.push(createUser);
  if (config.settings.general.modules.includes('discourse') && config.discourse.APIURL && config.discourse.APIKEY && config.discourse.USERNAME) {
    hooks.user.create.post.push(createUser);
    hooks.user.modify.post.push(modifyUser);
    hooks.user.remove.post.push(removeUser);

    hooks.group.create.post.push(createGroup);
    hooks.group.modify.post.push(modifyGroup);
    hooks.group.remove.post.push(removeGroup);

    hooks.category.create.on.push(createCategory);
    hooks.category.modify.on.push(modifyCategory);
    hooks.category.remove.on.push(removeCategory);
  }

};