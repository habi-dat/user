/*jshint esversion: 6 */

var express = require('express');
var passport = require('passport');
var ldaphelper = require('../utils/ldaphelper');
var discourse = require('../utils/discoursehelper');
var router = express.Router();
var config    = require('../config/config.json');
var activation = require('../utils/activation');
var nextcloud = require('../utils/nextcloud');
var mail = require('../utils/mailhelper');
var imap = require('../utils/imap');
var actions = require('../actions');
var bodyParser = require('body-parser');
var Promise = require("bluebird");

var isLoggedIn = function(req, res, next) {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated()) {
        next();
    } else {
        //  if they aren't redirect them to the home page
        req.session.returnTo = req.url;
        return res.redirect('/login');
    }
};

var isLoggedInAdmin = function(req, res, next) {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated() && req.user.isAdmin) {
        next();
    } else {
        //  if they aren't redirect them to the home page
        req.session.returnTo = req.url;
        return res.redirect('/login');
    }
};

var isLoggedInGroupAdmin = function(req, res, next) {
    // if user is authenticated in the session, carry on
    if (req.isAuthenticated() && req.user.isGroupAdmin) {
        next();
    } else {
        //  if they aren't redirect them to the home page
        req.session.returnTo = req.url;
        return res.redirect('/login');
    }
};

var getTitle = function(page) {
    return config.settings.general.title + ' - ' + page;
};

if (config.saml.enabled) {

    router.get('/login',
        passport.authenticate('saml',{session: true, failureRedirect: '/login', failureFlash:true, successReturnToOrRedirect: '/'})
    );

    router.get('/logout', isLoggedIn, function(req, res) {
        global.samlStrategy.logout(req, function(err, request){
            if(!err){
                //redirect to the IdP Logout URL
                res.redirect(request);
            }
        });
    });

    router.post('/saml/consume',
        bodyParser.urlencoded({ extended: false }),
        passport.authenticate('saml', {session: true, failureRedirect: '/login', failureFlash:true, successReturnToOrRedirect: '/'})
    );

    router.get('/saml/consume',
        //bodyParser.urlencoded({ extended: false }),
        passport.authenticate('saml', {session: true, failureRedirect: '/login', failureFlash:true, successReturnToOrRedirect: '/'}),
        function(req,res){
          res.redirect('/');
        }

    );

    router.get('/logindirect', function(req, res) {

        var errorText;
        var error = req.flash('error');
        if (error instanceof Array) {
            errorText = error[0];
        } else {
            errorText = error;
        }

        res.render('login', { user : req.user , message: error, notification: req.flash('notification'), title: getTitle('Login')});
    });

} else {

    router.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/login');
    });


    router.get('/login', function(req, res) {

        var errorText;
        var error = req.flash('error');
        if (error instanceof Array) {
            errorText = error[0];
        } else {
            errorText = error;
        }

        res.render('login', { user : req.user , message: error, notification: req.flash('notification'), title: getTitle('Login')});
    });
}

router.get('/emailtest', function(req, res) {
    res.render('email/welcome', { user: {givenName:'Florian', cn: 'Florian Humer'}, title: 'Hallo ' + 'Florian' + '!', longTitle: 'Willkommen bei ' + config.settings.general.title + '!'});
});

errorPage = function(req, res, error) {
    console.log('error: ' + JSON.stringify(error) + "\n" + error.stack);
    res.render('error', { message : JSON.stringify(error), error: error, title: 'Fehler'});
};

router.get('/error', function(req, res) {
    var error = req.flash('error');
    errorPage(req,res,error);
});

router.post('/login', passport.authenticate('ldapauth', {session: true, failureRedirect: '/login', failureFlash:true, successReturnToOrRedirect: '/'}));


router.get('/', isLoggedIn, function(req, res) {
    if (req.user.isAdmin || req.user.isGroupAdmin) {
        res.redirect('/show');
    } else {
        res.redirect('/edit_me');
    }
});

var render = function(req, res, template, title, data = {}, errorMessages = true) {
    data.title = getTitle(title);
    data.titleShort = title;
    if (errorMessages) {
        data.notification = req.flash('notification');
        data.responses = req.flash('responses');
        data.message = req.flash('error');
    }
    return new Promise((resolve, reject) => {
        res.render(template, data);
        resolve();
    });
};

router.get('/edit_me', isLoggedIn, function(req, res) {
    Promise.join(ldaphelper.fetchUser(req.user.dn), ldaphelper.fetchGroups('all'),
        (user, groups) => render(req, res, 'user/form', 'Daten ändern', {action: '/edit_me', user:user, groups:groups}))
        .catch(error => errorPage(req, res, error));
});

var updateCurrentUser = function(req, dn) {
    return ldaphelper.fetchObject(dn)
       .then((changedUser) => {
            changedUser.isAdmin = req.user.isAdmin;
            changedUser.isGroupAdmin = req.user.isGroupAdmin;
            changedUser.ownedGroups = req.user.ownedGroups;
            return new Promise((resolve, reject) => {
                req.login(changedUser, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(changedUser);
                    }
                });
            });
        });
};

var setSessionData = function(req, data) {
    req.session.data = data;
}

var retrieveSessionData = function(req) {
    if (req.session.data) {
        var data = req.session.data;
        delete req.session.data;
        return data;
    } else {
        return;
    }
}

var checkResponseAndRedirect = function(req, res, response, successMsg, errorMsg, target, errorTarget = undefined, data = undefined) {
    return new Promise((resolve, reject) => {
        req.flash('responses', response.responses);
        if (response.status) {
            req.flash('notification', successMsg);
            res.redirect(target);
        } else {
            req.flash('error', errorMsg);
            if (data) {
                setSessionData(req, data);
            }
            res.redirect(errorTarget?errorTarget:target);
        }
        resolve();
    });
};

var errorRedirect = function(req, res, errorMsg, target) {
    return new Promise((resolve, reject) => {
        req.flash('error', errorMsg);
        res.redirect(target);
        resolve();
    });
};


var successRedirect = function(req, res, successMsg, target) {
    return new Promise((resolve, reject) => {
        req.flash('notification', successMsg);
        res.redirect(target);
        resolve();
    });
};

router.post('/edit_me', isLoggedIn, function(req, res) {
    var user = {
        uid: req.body.uid,
        dn: req.body.dn,
        cn: req.body.cn,
        ou: req.body.ou,
        l: req.body.l,
        changedUid: false,
        description: false,
        mail: false,
        password: req.body.password,
        passwordRepeat: req.body.passwordRepeat,
        language: req.body.language,
        member: false,
        owner: false
    };
    actions.user.modify(user, req.user)
        .then((response) => {
            return updateCurrentUser(req, user.changedDn)
                .then(user => checkResponseAndRedirect(req, res, response, 'Benutzer*innendaten geändert', 'Fehler beim Ändern der Daten', '/edit_me'));
        })
        .catch(error => errorPage(req,res,error));
});

router.get('/passwd/:uid/:token', function(req, res) {
    activation.isTokenValid(req.params.token)
        .then((token) => {
            return ldaphelper.getByUID(req.params.uid)
                .then(user => render(req, res, 'user/passwd', 'Passwort Ändern', {user: user, token: req.params.token}));
        })
        .catch(error => errorPage(req,res,error));
});

router.post('/user/passwd', function(req, res) {
    var user = {
                    dn: req.body.dn,
                    uid: req.body.uid,
                    cn: false,
                    l: false,
                    ou: false,
                    mail: false,
                    description: false,
                    changedUid: false,
                    password: req.body.password,
                    passwordRepeat: req.body.passwordRepeat,
                    language: false,
                    member: false,
                    owner: false
                };
    activation.isTokenValid(req.body.token)
        .then((token) => {
            return actions.user.modify(user, { ownedGroups : []})
                .then(response => {
                    if (response.status) {
                        return activation.deleteToken(req.body.token)
                            .then(() => {return response;});
                    } else {
                        return response;
                    }
                })
                .then(response => checkResponseAndRedirect(req, res, response, 'Passwort geändert', 'Fehler beim Ändern des Passworts', '/redirect', '/passwd/' + req.body.uid + '/' + req.body.token));
            })
        .catch(error => errorPage(req, res, 'Fehler beim Ändern des Passworts: ' + error));
});

router.get('/lostpasswd', function(req, res) {
    render(req, res, 'user/lostpasswd', 'Passwort Vergessen');
});

router.post('/user/lostpasswd', function(req, res) {
    ldaphelper.getByEmail(req.body.mail)
        .then((user) => {
            mail.sendPasswordResetEmail(req, res, user)
                .then(info =>  successRedirect(req, res, 'Link zum Ändern des Passworts wurde per E-Mail verschickt', '/lostpasswd'))
                .catch(error => errorRedirect(req, res, 'Link zum Ändern des Passworts konnte nicht verschickt werden: ' + error, '/lostpasswd'));
        })
        .catch(error => errorRedirect(req, res, 'E-Mailadresse nicht gefunden: ' + error, '/lostpasswd'));
});


router.get('/ping', function(req, res){
    res.status(200).send("pong!");
});

router.get('/appmenu/:from', function(req, res){
    if (config.settings.general.modules.includes('discourse')) {
        res.setHeader('Access-Control-Allow-Origin', 'https://' + config.discourse.subdomain + '.' + config.settings.general.domain);
    }
    nextcloud.getMenuEntriesSorted(req.user)
        .then(menuEntries => render(req, res, 'appmenu/menu', '', {menuEntries: menuEntries, fromUrl: req.params.from}))
        .catch(error => errorPage(req, res, error));

});


router.get('/show', isLoggedInGroupAdmin, function(req,res){
    Promise.join(ldaphelper.fetchUsers(), ldaphelper.fetchGroups('all'),
        (users, groups) => render(req, res, 'show', 'Benutzer*innen / Gruppen', {users: users, groups: groups}))
        .catch(error => errorPage(req, res, error));
});

router.get('/show_cat', isLoggedInAdmin, function(req,res){
    Promise.join(ldaphelper.fetchGroups(req.user.ownedGroups), discourse.getCategories(),
        (groups, categories) => render(req,res,'show_cat', 'Gruppen / Kategorien',  {groups: groups, categories: categories}))
        .catch(error => errorPage(req, res, error));
});

router.get('/invites', isLoggedInGroupAdmin, function(req,res){
    Promise.join(activation.getInvites(), ldaphelper.fetchGroups(req.user.ownedGroups),
        (invites, groups) => render(req, res, 'invites', 'Offene Einladungen', {invites: invites, groups: groups}))
        .catch(error => errorPage(req, res, error));
});


router.get('/user/invite', isLoggedInGroupAdmin, function(req, res) {
    ldaphelper.fetchGroups(req.user.ownedGroups)
        .then(groups => render(req, res, 'user/invite', 'Benutzer*in einladen', {groups: groups, user: retrieveSessionData(req)}))
        .catch(error => errorPage(req,res,error));
});

router.get('/user/invite/delete/:token', isLoggedInGroupAdmin, function(req, res) {
    activation.deleteToken(req.params.token)
        .then(() => successRedirect(req, res, 'Einladung gelöscht', '/invites'))
        .catch(error => errorRedirect(req, res, 'Einladung konnte nicht gelöscht werden: ' + error, '/invites'));
});

router.get('/user/invite/repeat/:token', isLoggedInGroupAdmin, function(req, res) {
    activation.getToken(req.params.token)
        .then(() =>  activation.refreshToken(req.user, req.params.token, 7*24))
        .then(token => mail.sendMail(req, res, token.data.mail,'invite', { inviteLink: config.settings.activation.base_url+ '/user/invite/accept/' + token.token}))
        .then(() => successRedirect(req, res, 'Einladung erneut versendet', '/invites'))
        .catch(error => errorRedirect(req, res, 'Fehler beim Senden der Einladung: ' + error, '/invites'));
});

router.get('/user/invite/accept/:token', function(req, res) {
    Promise.join(activation.isTokenValid(req.params.token), ldaphelper.fetchGroups('all'),
        (token, groups) => render(req, res, 'user/accept', 'Account anlegen', { token: token, user: retrieveSessionData(req), groups: groups}))
        .catch(error => errorPage(req,res,'Fehler beim Anlegen des Accounts: ' + error));
});

router.post('/user/invite/accept',  function(req, res) {
    activation.isTokenValid(req.body.token)
        .then((token) => {
            var user = {
                changedUid : req.body.changedUid,
                uid: req.body.uid,
                dn: req.body.dn,
                cn: req.body.cn,
                ou: req.body.ou,
                l: req.body.l,
                changedUid: false,
                description: false,
                mail: false,
                password: req.body.password,
                passwordRepeat: req.body.passwordRepeat,
                language: req.body.language,
                member: false,
                owner: false
            };
            var user = req.body;
            user.member = token.data.member;
            user.owner = token.data.owner;
            user.mail = token.data.mail;
            user.description = config.nextcloud.defaultQuota || '1 GB';
            return actions.user.create(user, { ownedGroups: 'all', isAdmin: true})
                .then(response => {
                    if (response.status) {
                        return activation.deleteToken(req.body.token)
                            .then(() => {return response;});
                    } else {
                        return response;
                    }
                })
                .then(response => checkResponseAndRedirect(req, res, response, 'Account ' + req.body.cn + ' angelegt', 'Fehler beim Anlegen des Accounts', '/redirect', '/user/invite/accept/' + req.body.token, user))
                .catch(error => errorPage(req,res,error));
        })
});

router.get('/redirect', function(req, res) {
    render(req, res, 'redirect', 'Weiterleitung...', {})
            .catch(error => errorPage(req, res, error));
});

router.post('/user/invite', isLoggedInGroupAdmin, function(req, res) {
    var user = req.body;
    user.member = JSON.parse(user.member);
    user.owner = JSON.parse(user.owner);

    actions.user.invite(user, req.user, req, res)
        .then(response => checkResponseAndRedirect(req, res, response, 'Benutzer*in ' + req.body.mail + ' eingeladen', 'Fehler beim Einladen der*des Benutzer*in', '/invites', '/user/invite', user))
        .catch(error => errorPage(req,res,error));
});

router.get('/user/add', isLoggedInGroupAdmin, function(req, res) {
    ldaphelper.fetchGroups(req.user.ownedGroups)
        .then(groups => render(req, res, 'user/form', 'Benutzer*in anlegen', {action: '/user/add', groups: groups, user: retrieveSessionData(req)}))
        .catch(error => errorPage(req,res,error));
});

router.get('/user/available/cn/:cn/:token', function(req, res) {
    activation.isTokenValid(req.params.token)
        .then(token => ldaphelper.getByCN(req.params.cn))
        .then(user => {
            if (user) {
                res.json({available: false});
            } else {
                res.json({available: true});
            }
        })
        .catch(error => { res.json({error: error})});
});

router.get('/user/available/cn/:cn', isLoggedInGroupAdmin, function(req, res) {
    ldaphelper.getByCN(req.params.cn)
        .then((user) => {
            if (user) {
                res.json({available: false});
            } else {
                res.json({available: true});
            }
        })
        .catch(error => { res.json({error: error})});
});


router.get('/user/available/uid/:uid/:token', function(req, res) {
    activation.isTokenValid(req.params.token)
        .then(token => ldaphelper.getByUID(req.params.uid))
        .then(user => {
            if (user) {
                res.json({available: false});
            } else {
                res.json({available: true});
            }
        })
        .catch(error => { res.json({error: error})});
});

router.get('/user/available/uid/:uid', isLoggedInGroupAdmin, function(req, res) {
    ldaphelper.getByUID(req.params.uid)
        .then((user) => {
            if (user) {
                res.json({available: false});
            } else {
                res.json({available: true});
            }
        })
        .catch(error => { res.json({error: error})});
});


router.post('/user/add', isLoggedInGroupAdmin, function(req, res) {
    var user = req.body;

    if (user.member) {
        user.member = JSON.parse(user.member);
    } else {
        user.member = [];
    }

    if (user.owner) {
        user.owner = JSON.parse(user.owner);
    } else {
        user.owner = [];
    }

    user.description = user.description || config.nextcloud.defaultQuota || '1 GB';

    actions.user.create(user, req.user)
        .then(response => checkResponseAndRedirect(req, res, response, 'Benutzer*in ' + req.body.cn + ' angelegt', 'Fehler beim Anlegen der*des Benutzer*in', '/show', '/user/add', user))
        .catch(error => errorPage(req,res,error));
});

router.get('/user/edit/:id', isLoggedInAdmin, function(req, res) {
    Promise.join(ldaphelper.fetchGroups(req.user.ownedGroups), ldaphelper.fetchUser(req.params.id),
        (groups, user) => render(req, res, 'user/form', 'Benutzer*in bearbeiten', {action: '/user/edit', groups: groups, user: retrieveSessionData(req) || user}))
        .catch(error => errorPage(req, res, error));
});

router.get('/user/editgroups/:id', isLoggedInGroupAdmin, function(req, res) {
    Promise.join(ldaphelper.fetchGroups(req.user.ownedGroups), ldaphelper.fetchUser(req.params.id),
        (groups, user) => render(req, res, 'user/form', 'Gruppenzuordnung bearbeiten', {action: '/user/editgroups', groups: groups, user: retrieveSessionData(req) || user}))
        .catch(error => errorPage(req, res, error));
});

router.post('/user/edit', isLoggedInGroupAdmin, function(req, res) {
    var user = req.body;
    if (user.member) {
        user.member = JSON.parse(user.member);
    } else {
        user.member = [];
    }

    if (user.owner) {
        user.owner = JSON.parse(user.owner);
    } else {
        user.owner = [];
    }
    user.description = user.description || config.nextcloud.defaultQuota || '1 GB';


    actions.user.modify(user, req.user)
        .then(response => checkResponseAndRedirect(req, res, response, 'Benutzer*in ' + req.body.cn + ' geändert', 'Fehler beim Ändern der*des Benutzer*in', '/show', '/user/edit/' + user.dn, user))
        .catch(error => errorPage(req,res,error));
});

router.post('/user/editgroups', isLoggedInGroupAdmin, function(req, res) {

    var user = {
        uid: req.body.uid,
        dn: req.body.dn,
        cn: false,
        ou: false,
        l: false,
        description: false,
        mail: false,
        password: false,
        passwordRepeat: false,
        language: false,
        owner: false
    };
    if (req.body.member) {
        user.member = JSON.parse(req.body.member);
    } else {
        user.member = [];
    }

    actions.user.modify(user, req.user)
        .then(response => checkResponseAndRedirect(req, res, response, 'Benutzer*inengruppen ' + req.body.cn + ' geändert', 'Fehler beim Ändern der*des Benutzer*innengruppen', '/show', '/user/editgroups/' + user.dn, user))
        .catch(error => errorPage(req,res,error));
});

router.get('/user/delete/:id', isLoggedInGroupAdmin, function(req, res) {
    ldaphelper.fetchUser(req.params.id)
        .then(user => actions.user.remove(user, req.user))
        .then(response => checkResponseAndRedirect(req, res, response, 'Benutzer*in ' + req.params.id + ' gelöscht', 'Fehler beim Löschen von ' + req.params.id, '/show'))
        .catch(error => errorPage(req,res,error));
});

router.get('/group/edit/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchObject(req.params.id)
        .then(group => render(req, res, 'group/edit', 'Gruppe bearbeiten', {group: retrieveSessionData(req) || group}))
        .catch(error => errorPage(req, res, error));
});

router.get('/group/add', isLoggedInAdmin, function(req, res) {
    render(req, res, 'group/add', 'Gruppe erstellen', {group: retrieveSessionData(req)})
        .catch(error => errorPage(req, res, error));
});

router.post('/group/add', isLoggedInAdmin, function(req, res) {
    actions.group.create(req.body, req.user)
        .then(response => checkResponseAndRedirect(req, res, response, 'Gruppe ' + req.body.cn + ' eingefügt', 'Fehler beim Einfügen der Gruppe ' + req.body.cn, '/show', '/group/add', req.body))
        .catch(error => errorPage(req,res,error));
});

router.post('/group/edit', isLoggedInAdmin, function(req, res) {
    actions.group.modify(req.body, req.user)
        .then(response => checkResponseAndRedirect(req, res, response, 'Gruppe ' + req.body.cn + ' geändert', 'Fehler beim Ändern der Gruppe ' + req.body.cn, '/show', '/group/edit/'+req.body.dn, req.body))
        .catch(error => errorPage(req,res,error));
});

router.get('/group/delete/:id', isLoggedInAdmin, function(req, res) {
    actions.group.remove({ dn: req.params.id }, req.user)
        .then(response => checkResponseAndRedirect(req, res, response, 'Gruppe ' + req.params.id  + ' gelöscht', 'Fehler beim Löschen der Gruppe ' + req.params.id, '/show'))
        .catch(error => errorPage(req,res,error));
});


router.get('/cat/edit/:id', isLoggedInAdmin, function(req, res) {
    Promise.join(ldaphelper.fetchGroups(req.user.ownedGroups, true), discourse.getParentCategories(), discourse.getCategoryWithParent(req.params.id),
        (groups, parents, category) => render(req, res, 'cat/edit', 'Kategorie bearbeiten', {category: retrieveSessionData(req) || category, groups: groups, parents: parents}))
        .catch(error => errorPage(req, res, error));
});

router.get('/cat/add', isLoggedInAdmin, function(req, res) {
    Promise.join(ldaphelper.fetchGroups(req.user.ownedGroups, true), discourse.getParentCategories(),
        (groups, parents) => render(req, res, 'cat/add', 'Kategorie erstellen', {category: retrieveSessionData(req), groups: groups, parents: parents}))
        .catch(error => errorPage(req, res, error));
});

router.post('/cat/add', isLoggedInAdmin, function(req, res) {
    var category = req.body;
    category.groups = JSON.parse(category.member);

    actions.category.create(category, req.user)
        .then(response => checkResponseAndRedirect(req, res, response, 'Kategorie ' + req.body.name + ' erstellt', 'Fehler beim Erstellen der Kategorie ' + req.body.name, '/show_cat', '/cat/add', category))
        .catch(error => errorPage(req,res,error));
});

router.post('/cat/edit', isLoggedInAdmin, function(req, res) {

    var category = req.body;
    category.groups = JSON.parse(category.member);

    actions.category.modify(category)
        .then(response => checkResponseAndRedirect(req, res, response, 'Kategorie ' + req.body.name + ' geändert', 'Fehler beim Ändern der Kategorie ' + req.body.name, '/show_cat', '/cat/edit/'+category.id, category))
        .catch(error => errorPage(req,res,error));
});

router.get('/cat/delete/:id', isLoggedInAdmin, function(req, res) {
    actions.category.remove({ id: req.params.id })
        .then(response => checkResponseAndRedirect(req, res, response, 'Kategorie ' + req.params.id  + ' gelöscht', 'Fehler beim Löschen der Kategorie ' + req.params.id, '/show_cat'))
        .catch(error => errorPage(req,res,error));
});

router.get('/email/templates', isLoggedInAdmin, function(req, res) {
	Promise.join(mail.renderEmail(res, 'invite', {inviteLink: '{{inviteLink}}'}, true), mail.renderEmail(res, 'passwd', {passwdLink: '{{passwdLink}}'}, true),
		(inviteEmail, passwdEmail) =>  render(req, res, 'email/templates', 'E-Mailvorlagen bearbeiten', {emails: {invite: inviteEmail, passwd: passwdEmail}}))
        .catch(error => errorPage(req, res, error));
});

router.post('/email/templates', isLoggedInAdmin, function(req, res) {
	mail.saveCustomTemplate(req.body.template, {activated: req.body.activated, subject: req.body.subject, body: req.body.body})
		.then(() => successRedirect(req, res, 'Vorlageneinstellungen gespeichert', '/email/templates'))
        .catch(error => errorRedirect(req, res, 'Fehler beim Speichern der Vorlageneinstellungen: ' + error, '/email/templates'));
});


module.exports = router;

