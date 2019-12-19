var nodemailer = require('nodemailer');
var activation = require('./activation');
var config = require('../config/config.json');

if (config.smtp.auth.user == 'none') {
  config.smtp.auth.user = null;
}

if (config.smtp.auth.pass == 'none') {
  config.smtp.auth.pass = null;
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
                mailOptions.subject = config.general.site_title + ': Aktiviere deinen Account!';
                mailOptions.html = '<h3>Willkommen beim ' + config.general.site_title + ' '+user.givenName+'!</h3>'+
                      '<p>Dein Account wurde angelegt, bitte klicke auf den folgenden Link um dein Passwort zu wählen: <a href="'+ link +'">' + link + '</a></p>'+
                      '<p>Dein Benutzer*innenname / Loginname ist: "'+ user.givenName + ' ' + user.surname +'"</p>' +
                      '<p>Für Information zur Benutzung der Plattform bitte: <a href="https://wiki.habidat.org/doku.php?id=benutzer_innenguide">HIER</a> klicken</p> ' +
                      '<p>Für den Einstieg in die Plattform: <a href="https://' + config.general.domain + '">' + config.general.domain + '</a></p>' +
                      '<p>Für Einstellungen zu deinem Account oder wennn du dein Passwort vergessen hast: <a href="https://' config.general.subdomain + '.' + config.general.domain '">' + config.general.subdomain + '.' + config.general.domain + '</a></p>' +
                      '<p>Und für alle weiteren Fragen: <a href="mailto:' + config.general.contact + '">' + config.general.contact + '</a></p>' +
                      '<p>Viel Spaß!</p>';
            } else {
                mailOptions.subject = config.general.site_title + ' Cloud: Activate your account';
                mailOptions.html = '<h3>Welcome to the ' + config.general.site_title + ' cloud '+user.givenName+' ' + user.surname+'!</h3>'+
                      '<p>Your account was created, please click the following link to set your password: <a href="'+ link +'">' + link + '</a></p>'+
                      '<p>Your login user name is: "'+ user.givenName + ' ' + user.surname +'"</p>' +
                      '<p>To access the cloud use: <a href="https://' + config.general.domain + '">' + config.general.domain + '</a></p>' +
                      '<p>For resetting your password use: <a href="https://' config.general.subdomain + '.' + config.general.domain '">' + config.general.subdomain + '.' + config.general.domain + '</a></p>' +
                      '<p>If you have any questions, feel free to contact us: <a href="mailto:' + config.general.contact + '">' + config.general.contact + '</a></p>' +                      
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

exports.sendPasswordResetEmail = function(user, done) {
    activation.createAndSaveToken(user.uid, function(token, err) {
        if (err) {
           done(err);
        } else {


            var link = config.settings.activation.base_url + '/passwd/' + user.uid + '/'+token.token;

            var transport = nodemailer.createTransport(config.smtp);


            var mailOptions = {
                from: (config.settings.activation.email_from?config.settings.activation.email_from:'no-reply@habidat.org'),
                to: user.mail
            }

            if (user.preferredLanguage && user.preferredLanguage == 'en')  {
                mailOptions.subject = 'Your password at ' + config.general.site_title + ' was resetted';
                mailOptions.html = '<h3>Your password was resetted</h3>'+
                      '<p>Please follow the link to set a new password: </p>'+
                      '<a href="'+ link +'">' + link + '</a>';
            } else {
                mailOptions.subject = 'Dein Passwort bei ' + config.general.site_title + ' wurde zurückgesetzt';
                mailOptions.html = '<h3>Dein Passwort wurde zurückgesetzt</h3>'+
                      '<p>Bitte klicke auf den folgenden Link um dein neues Passwort zu wählen: </p>'+
                      '<a href="'+ link +'">' + link + '</a>';
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