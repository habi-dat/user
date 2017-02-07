var config    = require('../../config/config.json');
var discourse = require('discourse-api');

var client = new discourse(config.discourse.APIURL, config.discourse.APIKEY, config.discourse.USERNAME);

exports.createUser = function(user, done) {

	var uid = (user.givenName.substr(0,1)+user.sn).toLowerCase();

	client.createUser(user.givenName + ' ' + user.sn, user.mail, uid, '', true, function(error, body, httpCode) {    
		if (error) {
			console.log("Error creating discoures user: " + error)
			done(error);          
		}
  		console.log('Discourse create user body: ' + JSON.stringify(body) + ', error: ' + JSON.stringify(error) + ' http: ' + httpCode);  

  		if(user.groups) {

        	var assignedGroups = JSON.parse(user.groups);
        	var assignedAdminGroups = JSON.parse(user.adminGroups);

        	client.get('admin/groups.json', {}, function (error, body, httpCode) {
        		if (httpCode == "200") {
        			var groups = JSON.parse(body);

        			groups.forEach(function(group) {

        				var dn = 'cn=' + group.name + ',ou=groups,dc=willy-fred,dc=org';

        				if (assignedGroups.indexOf(dn) > -1) {
        					client.put('groups/' + group.id + '/members.json', { usernames: uid}, function(error, body, httpCode) {
        						console.log('group add member body: ' + body);
        					});
        				}

        				if(assignedAdminGroups.indexOf(dn) > -1) {
        					client.put('groups/' + group.id + '/owners.json', { usernames: uid}, function(error, body, httpCode) {
        						console.log('group add owner body: ' + body);
        					});
        				}
        			});
        		}
    		});
        }

	});
}