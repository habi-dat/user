var jsonfile = require('jsonfile');
var path = require('path');

var activationStoreFile = path.join(__dirname, '../data/activationStore.json');

exports.createAndSaveToken = function(uid, done) {

	//create random 16 character token
	var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	    var token = '';
	    for (var i = 64; i > 0; --i) {
	      token += chars[Math.round(Math.random() * (chars.length - 1))];
	    }
	 
	// create expiration date
	var expires = new Date();
	expires.setHours(expires.getHours() + 48);
	 
	token = {
	  token: token,
	  expires: expires
	};

	var activationStore = {};
	jsonfile.readFile(activationStoreFile, function(err, obj) {
  		if (!err) {
  			activationStore = obj;
  		}
  		activationStore[uid] = token;

  		jsonfile.writeFile(activationStoreFile, activationStore, function (err) {
  			console.error(err);
  			done(token, err);
		})
	});
};

exports.isTokenValid = function(uid, givenToken, done) {

	var activationStore = {};
	jsonfile.readFile(activationStoreFile, function(err, obj) {
  		if (err) {
  			console.error(err);
  			done(false)
  		} else {
	  		activationStore = obj;

	  		var token = activationStore[uid];
	  		if (token) {
	  			if (token.expires < new Date()) {
	  				delete activationStore[uid];
			  		jsonfile.writeFile(activationStoreFile, activationStore, function (err) {
			  			console.error(err);
			  			done(false);
					});
	  			} else if (token.token == givenToken) {
	  				done(true);
	  			} else {
	  				done(false);
	  			}
	  		} else {
	  			done(false);
	  		}

  		}
	});
};


exports.deleteToken = function(uid, done) {

	var activationStore = {};
	jsonfile.readFile(activationStoreFile, function(err, obj) {
  		if (err) {
  			console.error(err);
  			done(err)
  		} else {
	  		activationStore = obj;

	  		var token = activationStore[uid];
	  		if (token) {
  				delete activationStore[uid];
		  		jsonfile.writeFile(activationStoreFile, activationStore, function (err) {
		  			console.error(err);
		  			done(err);
				});
	  		}
  		}
	});
};