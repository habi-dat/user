var nodemailer = require('nodemailer');
var activation = require('./activation');
var config = require('../config/config.json');

var Promise = require("bluebird");
if (config.smtp.authMethod == 'none') {
  config.smtp.auth = undefined;
}

sendMail = function(options) {
  return new Promise((resolve, reject) => {
    nodemailer.createTransport(config.smtp).sendMail(options, (error, info) => {
        if (error) {
            reject(error);
        } else {
            resolve(info);
        }
    });
  });
}

exports.sendActivationEmail = function(user, done) {
    activation.createAndSaveToken(user.uid, function(token, err) {
        if (err) {
           done(err);
        } else {

            //console.log('config: ' + JSON.stringify(config));

            console.log('before send');

            var link = config.settings.activation.base_url + '/passwd/' + user.uid + '/'+token.token;

            var transport = nodemailer.createTransport(config.smtp);
            console.log('after transport');

            var mailOptions = {
                from: (config.settings.activation.email_from?config.settings.activation.email_from:'no-reply@habidat.org'),
                to: user.mail
            }
            if (user.language && user.language == 'de')  {
                mailOptions.subject = config.settings.general.title + ': Aktiviere deinen Account!';
                mailOptions.html = '<h3>Willkommen beim ' + config.settings.general.title + ' '+user.givenName+'!</h3>'+
                      '<p>Dein Account wurde angelegt, bitte klicke auf den folgenden Link um dein Passwort zu wählen: <a href="'+ link +'">' + link + '</a></p>'+
                      '<p>Dein Benutzer*innenname / Loginname ist: "'+ user.givenName + ' ' + user.surname +'"</p>' +
                      '<p>Für Information zur Benutzung der Plattform bitte: <a href="https://wiki.habidat.org/doku.php?id=benutzer_innenguide">HIER</a> klicken</p> ' +
                      '<p>Für den Einstieg in die Plattform: <a href="https://' + config.settings.general.domain + '">' + config.settings.general.domain + '</a></p>' +
                      '<p>Für Einstellungen zu deinem Account oder wennn du dein Passwort vergessen hast: <a href="https://' + config.settings.general.subdomain + '.' + config.settings.general.domain +'">' + config.settings.general.subdomain + '.' + config.settings.general.domain + '</a></p>' +
                      '<p>Und für alle weiteren Fragen: <a href="mailto:' + config.settings.general.contact + '">' + config.settings.general.contact + '</a></p>' +
                      '<p>Viel Spaß!</p>';
            } else {
                mailOptions.subject = config.settings.general.title + ' Cloud: Activate your account';
                mailOptions.html = '<h3>Welcome to the ' + config.settings.general.title + ' cloud '+user.givenName+' ' + user.surname+'!</h3>'+
                      '<p>Your account was created, please click the following link to set your password: <a href="'+ link +'">' + link + '</a></p>'+
                      '<p>Your login user name is: "'+ user.givenName + ' ' + user.surname +'"</p>' +
                      '<p>To access the cloud use: <a href="https://' + config.settings.general.domain + '">' + config.settings.general.domain + '</a></p>' +
                      '<p>For resetting your password use: <a href="https://' + config.settings.general.subdomain + '.' + config.settings.general.domain + '">' + config.settings.general.subdomain + '.' + config.settings.general.domain + '</a></p>' +
                      '<p>If you have any questions, feel free to contact us: <a href="mailto:' + config.settings.general.contact + '">' + config.settings.general.contact + '</a></p>' +                      
                      '<p>Have fun!</p>';
            }

            transport.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.log(error);
                    done(error)
                } else {
                    console.log('Message %s sent: %s', info.messageId, info.response);
                    done (error);
                }
            });
        }
    })
};

var renderHtml = function (res, template, data) {
    return new Promise((resolve, reject) => {
        res.render(template, data, (err, html) => {
          if (err) {
            reject(err);
          } else {
            resolve(html);
          }
        });
    });
};   


exports.sendMail = function(req, res, to, subject, template, data) {
    return renderHtml(res, template, data)
      .then((html) => {
       
          var mailOptions = {
            from: (config.settings.activation.email_from || 'no-reply@habidat.org'),
            to: to,
            subject: subject,
            html: html
          }

          return sendMail(mailOptions);
    })    
    
};

exports.sendPasswordResetEmail = function(req, res, user) {
    return activation.createAndSaveToken(req.user, {uid: user.uid})
      .then((token) => {
          var link = config.settings.activation.base_url + '/passwd/' + user.uid + '/'+token.token;
          return exports.sendMail(req, res, user.mail, config.settings.general.title + ' Passwort wurde zurückgesetzt', 'email/passwd', { passwdLink: link })
    })    
    
};