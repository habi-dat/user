var Promise = require('bluebird');
var ldaphelper = require('../utils/ldaphelper');
var zxcvbn = require('../public/javascripts/zxcvbn');

var passwordValid = function(password) {

    // console.log("Passwort: " + password + " match: " +password.match('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*_=+-]).{8,30}$'));
    var result = zxcvbn(password);
    if (result.score <=2 ) {
      return false;  
    } else {
      return true;
    }    
}

var validateGroups = function (groups, ownedGroups) {
    var responses = [];    
    if (groups) {
        groups.forEach((group) => {
            if(!ownedGroups.includes(group)) {
                responses.push('Keine Berechtigung für Gruppe ' + group);
            }            
        })
    }
    return responses;
}

var checkEmail = function(mail, uid) {
  if (!mail) {
    return Promise.reject('Keine E-Mailadresse angegeben')    
  } else {
    return ldaphelper.getByEmail(mail)
      .then(users => {
        users = users.filter(user => {return user.uid !== uid});
        if (users.length > 0) {          
          throw 'Benutzer*in mit E-Mailadresse existiert bereits: ' + users.map(user => {return user.cn}).join(', ');
        } else {
          return;
        }        
      })
  }
}

var validateUser = async function(user, currentUser) {

  var errorTexts = [];

  if (currentUser.ownedGroups != 'all') {
    errorTexts = errorTexts.concat(validateGroups(user.member, currentUser.ownedGroups));
  }

  if (user.cn != false) {
    if (user.cn == null || user.cn == "") {
      errorTexts.push("Anzeigename fehlt");
    }
  }

  if (user.ou != false) {
    if (user.ou == null || user.ou == "") {
      errorTexts.push("Zugehörigkeit fehlt");
    }
  }

  if (!user.uid && (!user.password || user.password == "")) {
    errorTexts.push("Passwort fehlt ");
  }

  if (user.mail != false) {
    try {
      await checkEmail(user.mail, user.uid);
    } catch (error) {
      errorTexts.push(error);
    }
  }

  if ( user.password && user.password != user.passwordRepeat) {
    errorTexts.push("Passwörter sind unterschiedlich");
  }

  if ( user.password && !passwordValid(user.password)) {
    errorTexts.push("Passwort ist zu unsicher");
  }

  if (errorTexts.length > 0) {
    var errorText = "Validierung: Benutzer*innendaten ungültig: ";
    errorText = errorTexts.join(', ');
    return {status: false, message: errorText};
  } else {
    return {status: true, message: "Validierung: Benutzer*innendaten gültig"};
  }
};

var validateRemoveUser = async function(user, currentUser) {

  var errorTexts = [];

  var notOwnedGroups = user.member.filter(entry => !currentUser.ownedGroups.includes(entry)).map(entry => ldaphelper.dnToCn(entry));

  if (notOwnedGroups.length > 0) {
    errorTexts.push('Benutzer*in existiert in anderen von dir nicht verwalteten Gruppen (' + notOwnedGroups.join(', ') + '). Falls der Account auch für diese Gruppen gesperrt werden soll, kontaktiere bitte die Gruppenadmin@s der anderen Gruppen. Alternativ zur Löschung kannst du die Gruppenrechte für deine Gruppen entziehen');
  }

  if (errorTexts.length > 0) {
    var errorText = "Validierung: Fehler beim Löschen: ";
    errorTexts.every(function(text, index) {
      if (index != 0) {
        errorText += ", ";
      }
      errorText += text;
    });
    return {status: false, message: errorText};
  } else {
    return {status: true, message: "Validierung: Das Löschen ist möglich"};
  }
};

var validateGroup = async function(group, currentUser) {

  var errorTexts = [];

  if (group.dn && !currentUser.ownedGroups.includes(group.dn)) {
    errorTexts.push('Keine Berechtigung für Gruppe ' + group.dn);
  }

  if (group.cn != false) {
    if (group.cn == null || group.cn == "") {
      errorTexts.push("Gruppenname fehlt");
    }
  }

  if (errorTexts.length > 0) {
    var errorText = "Validierung: Gruppe ungültig: ";
    errorTexts.every(function(text, index) {
      if (index != 0) {
        errorText += ", ";
      }
      errorText += text;
    });
    return {status: false, message: errorText};
  } else {
    return {status: true, message: "Validierung: Gruppe gültig"};
  }
};

var checkErrorTexts = function (successText, errorText, errorTexts) {
  return Promise.resolve()
    .then(() => {
      if (errorTexts.length > 0) {
        return {status: false, message: errorText + errorTexts.join(', ')};
      } else {
        return {status: true, message: successText};
      }      
    })
};

var validateInvite = function(invite, currentUser) {

  var errorTexts = [];
  return checkEmail(invite.mail.toLowerCase())
    .catch(error => {
      errorTexts.push(error);
      return;
    })
    .then(() => checkErrorTexts('Validierung: Einladung gültig', 'Validierung: Fehler bei Einladung: ', errorTexts));
  
};

exports.register = function(hooks) {
  hooks.user.invite.validate.push(validateInvite);
  hooks.user.create.validate.push(validateUser);
  hooks.user.modify.validate.push(validateUser);
  hooks.user.remove.validate.push(validateRemoveUser)
  hooks.group.create.validate.push(validateGroup);
  hooks.group.modify.validate.push(validateGroup);
};