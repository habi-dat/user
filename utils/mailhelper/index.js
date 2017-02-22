var nodemailer = require('nodemailer');
var activation = require('../activation');
var config = require('../../config/config.json');

exports.sendActivationEmail = function(user, done) {
    activation.createAndSaveToken(user.uid, function(token, err) {
        if (err) {
           done(err);
        } else {

            //console.log('config: ' + JSON.stringify(config));

            console.log('before send');

            var link = config.settings.activation.base_url + '/passwd/' + user.uid + '/'+token.token;

            var transport = nodemailer.createTransport(config.smtp);       


            var mailOptions = {
                from: (config.settings.activation.email_from?config.settings.activation.email_from:'no-reply@habidat.org'),
                to: user.mail,
                subject: 'Aktiviere deinen Account bei habiDAT',
                html: '<h1>Willkommen beim habiDAT!</h1>'+
                      '<p>Dein Account wurde angelegt, bitte klicke auf den folgenden Link um dein Passwort zu wählen: </p>'+
                      '<a href="'+ link +'">' + link + '</a>'+
                      '<p>Für Information zur Benutzung der Plattform bitte <a href="">https://wiki.habidat.org/doku.php?id=benutzer_innenguide</a> klicken</p>'
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
                to: user.mail,
                subject: 'Passwort bei habiDAT zurückgesetzt',
                html: '<h1>Dein Passwort wurde zurückgesetzt</h1>'+
                      '<p>Bitte klicke auf den folgenden Link um dein neues Passwort zu wählen: </p>'+
                      '<a href="'+ link +'">' + link + '</a>'
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