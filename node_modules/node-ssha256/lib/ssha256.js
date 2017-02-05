var crypto = require('crypto');
var buffer = require('buffer');

function sha256(message) {
	return crypto.createHash('sha256').update(message).digest('hex');
}
function hex2asc(pStr) {
	tempstr = '';
	for (b = 0; b < pStr.length; b = b + 2) {
		tempstr = tempstr + String.fromCharCode(parseInt(pStr.substr(b, 2), 16));
	}
	return tempstr;
}

function asc2hex(pStr) {
	tempstr = '';
	for (a = 0; a < pStr.length; a = a + 1) {
		tempstr = tempstr + pStr.charCodeAt(a).toString(16);
	}
	return tempstr;
}
function getSalt(hash) {
	var hexSalt = hash.substr(64,hash.length-64);
	return hex2asc(hexSalt);
}
function check(hash, pw) {
	hash = new Buffer(hash.substr(9,hash.length-9), 'base64').toString('hex');
	var saltedPw = pw+getSalt(hash);
	hashOnly = hash.substr(0,64);
	return hashOnly==sha256(saltedPw);
}
function create(pw) {
	var salt = sha256(new Date().getTime().toString()).substr(0,4);
	return '{SSHA256}'+new Buffer(sha256(pw+salt)+asc2hex(salt),'hex').toString('base64');	
}

exports.check = check;
exports.create = create;
