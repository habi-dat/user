var Promise = require('bluebird');

var passwordValid = function(password) {

    // console.log("Passwort: " + password + " match: " +password.match('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*_=+-]).{8,30}$'));

    return password.match('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*_=+-]).{8,30}$') != null;
}

var includesAll = function(array1, array2) {
  return array2.every((element) => {return array1.includes(element)});
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

var validateUser = async function(user, currentUser) {

  var errorTexts = [];

  errorTexts = errorTexts.concat(validateGroups(user.member, currentUser.ownedGroups));

  if (!currentUser.isAdmin && user.owner && user.owner.length > 0) {
    errorTexts.push('Nur Admins können Gruppenadministrator*innenrechte vergeben');
  }  

  if (user.givenName != false) {
    if (user.givenName == null || user.givenName == "") {
      errorTexts.push("Vorname fehlt");
    }
  }

  if (user.surname != false) {
    if (user.surname == null || user.surname == "") {
      errorTexts.push("Nachname fehlt");
    }
  }

  if (user.project != false) {
    if (user.project == null || user.project == "") {
      errorTexts.push("Projekt fehlt");
    }
  }

  if (!user.uid && (!user.password || user.password == "")) {
    errorTexts.push("Passwort fehlt");
  }

  if (user.password && user.password != user.passwordRepeat) {
    errorTexts.push("Passwörter sind unterschiedlich");
  }

  if (user.activation != true && user.password && !passwordValid(user.password)) {
    errorTexts.push("Passwort muss den Vorgaben entsprechen");
  }

  if (errorTexts.length > 0) {
    var errorText = "Validierung: Benutzer*innendaten ungültig: ";
    errorTexts.every(function(text, index) {
      if (index != 0) {
        errorText += ", ";
      }
      errorText += text;
    });
    return {status: false, message: errorText};
  } else {
    return {status: true, message: "Validierung: Benutzer*innendaten gültig"};
  }
};

var validateRemoveUser = async function(user, currentUser) {

  var errorTexts = [];

  if (!includesAll(currentUser.ownedGroups, user.member)) {
    console.log('owned: ' + JSON.stringify(currentUser.ownedGroups));
    console.log('member: ' + JSON.stringify(user.member));
    errorTexts.push('Benutzer*in existiert in anderen von dir nicht verwalteten Gruppen, alternativ kannst du die Gruppenrechte entziehen');
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

  if (group.name != false) {
    if (group.name == null || group.name == "") {
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

exports.register = function(hooks) {
  hooks.user.create.validate.push(validateUser);
  hooks.user.modify.validate.push(validateUser);
  hooks.user.remove.validate.push(validateRemoveUser)
  hooks.group.create.validate.push(validateGroup);
  hooks.group.modify.validate.push(validateGroup);
};