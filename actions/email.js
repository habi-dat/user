var mail = require('../utils/mailhelper');
var activation = require('../utils/activation');
var mailhelper = require('../utils/mailhelper');
 var config    = require('../config/config.json');
var Promise = require('bluebird');

// var activationEmail = function(user, currentUser) {
//     return new Promise((resolve, reject) => {
//     if (user.activation) {
//         mail.sendActivationEmail({uid: user.uid, mail: user.mail, cn: user.cn, language: user.language}, function(err){
//           if (err) {
//               resolve({status: false, message: 'Aktivierungse-mail konnte nicht verschickt werden, bitte die Admin*as kontaktieren: ' + err});
//           } else {
//               resolve({status: true, message: 'E-Mail: Aktivierungse-mail verschickt'});
//           }
//       });
//     } else {
//       resolve({status: true});
//     }
//     });
// };

var sendInvite = function(user, currentUser, req, res) {
  return activation.getTokenByData(user.mail.toLowerCase(), 'mail', 'invite')
    .then(token => activation.refreshToken(currentUser, token.token, 7*24))
    .catch(() => activation.createAndSaveToken(currentUser, {mail: user.mail.toLowerCase(), owner: user.owner, member: user.member}, 7*24, 'invite'))
    .then(token => mailhelper.sendMail(req, res, user.mail, 'invite', { inviteLink: config.settings.activation.base_url+ '/user/invite/accept/' + token.token }))
    .then(() => {
      return { status: true, message: 'E-Mail an ' + user.mail + ' versandt'};
    })
    .catch((error) => {
      return {status: false, message: 'E-Mail konnte nicht versandt werden: ' + error};
    });
}

exports.register = function(hooks) {
  hooks.user.invite.on.push(sendInvite);
};