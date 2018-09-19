var mail = require('../utils/mailhelper');
var Promise = require('bluebird');

var activationEmail = function(user) {
    return new Promise((resolve, reject) => {
		if (user.activation) {
		    mail.sendActivationEmail({uid: user.uid, mail: user.email, givenName: user.givenName, surname: user.surname, language: user.language}, function(err){
			    if (err) {
			        resolve({status: false, message: 'Aktivierungse-mail konnte nicht verschickt werden, bitte die Admin*as kontaktieren: ' + err});
			    } else {
			        resolve({status: true, message: 'E-Mail: Aktivierungse-mail verschickt'});
			    }
			});	
		} else {
			resolve({status: true});
		}
    });
};

exports.register = function(hooks) {
	hooks.user.create.post.push(activationEmail);
};