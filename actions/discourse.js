/*jshint esversion: 6 */
var config    = require('../config/config.json');
var discourse = require('../utils/discoursehelper');
var ldaphelper = require('../utils/ldaphelper');
var crypto = require('crypto');
var request = require('request-promise');
var querystring = require("querystring");
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

var syncSso = function(user, currentUser) {
  return ldaphelper.fetchUser(user.dn)
    .then(user => {
      return ldaphelper.groupDnToO(user.ou)
          .then(title => {
            var groups = user.member.map(group => { return ldaphelper.dnToCn(group);});
            var hmac = crypto.createHmac("sha256", config.discourse.SSOSECRET);
            var params = {
              external_id: user.uid,
              email: user.mail,
              username: user.uid,
              name: user.cn,
              title: title,
              groups: groups.join(',')
            }
            var payload = new Buffer(querystring.stringify(params) , 'utf8').toString("base64");
            hmac.update(payload);  
            var postParams = {
                'sso': payload,
                'sig': hmac.digest('hex')
              }  
            return discourse.post('admin/users/sync_sso', postParams)
              .then(() => { return {status: true, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' synchronisiert'};})
              .catch(error =>  { return {status: false, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' konnte nicht synchronisiert werden: ' + error};});
          })
    })
    .catch(error =>  { return {status: false, message: 'DISCOURSE: Benutzer*in ' + user.uid + ' in LDAP nicht gefunden: ' + error};});
   
}

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
    hooks.user.create.post.push(syncSso);
    hooks.user.modify.post.push(syncSso);
    hooks.user.remove.post.push(removeUser);

    hooks.group.create.post.push(createGroup);
    hooks.group.modify.post.push(modifyGroup);
    hooks.group.remove.post.push(removeGroup);

    hooks.category.create.on.push(createCategory);
    hooks.category.modify.on.push(modifyCategory);
    hooks.category.remove.on.push(removeCategory);
  }

};