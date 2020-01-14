var express = require('express');
var passport = require('passport');
var ldaphelper = require('../utils/ldaphelper');
var discourse = require('../utils/discoursehelper');
var router = express.Router();
var config    = require('../config/config.json');
var activation = require('../utils/activation');
var mail = require('../utils/mailhelper');
var actions = require('../actions');
var bodyParser = require('body-parser');

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

var title = function(page) {
    return 'habiDAT - ' + page;
}

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

        res.render('login', { user : req.user , message: error, notification: req.flash('notification'), title: title('Login')});
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

        res.render('login', { user : req.user , message: error, notification: req.flash('notification'), title: title('Login')});
    });

}

router.get('/emailtest', function(req, res) {
    res.render('email/welcome', { user : req.currentUser , title: 'Willkommen!'});
})

errorPage = function(req, res, error) {
    console.log('error: ' + JSON.stringify(error) + "\n" + error.stack);
    res.render('error', { message : JSON.stringify(error), error: error, title: 'Fehler'});
};

router.get('/error', function(req, res) {
    var error = req.flash('error');
    errorPage(req,res,error);
})

router.post('/login', passport.authenticate('ldapauth', {session: true, failureRedirect: '/login',
 failureFlash:true, successReturnToOrRedirect: '/'}));


router.get('/', isLoggedIn, function(req, res) {
    if (req.user.isAdmin || req.user.isGroupAdmin) {
        res.redirect('/show');
    } else {
        res.redirect('/edit_me');
    }
});

router.get('/edit_me', isLoggedIn, function(req, res) {
    ldaphelper.fetchObject(req.user.dn)
        .then((user) => {
            res.render('user/edit_me', {user:user, notification: req.flash('notification'), responses: req.flash('responses'), title: title('Daten Ändern')});
        })
        .catch((error) => {
            req.flash('error', 'Fehler beim Ändern des Profils: ' + error);
            res.redirect('/login');
        });      
});

router.post('/edit_me', isLoggedIn, function(req, res) {
    var user = {
        uid: req.body.uid,
        dn: req.body.dn,
        givenName: req.body.givenName ,
        surname: req.body.sn,
        project: req.body.businessCategory,
        changedUid: false,
        description: false,
        email: req.body.mail,
        password: req.body.userPassword,
        passwordRepeat: req.body.userPassword2,
        language: false,
        member: false,
        owner: false
    };
    actions.user.modify(user, req.user)
        .then((response) => {
            return ldaphelper.fetchObject(user.changedDn)
                .then((changedUser) => {
                    changedUser.isAdmin = req.user.isAdmin;
                    changedUser.isGroupAdmin = req.user.isGroupAdmin;
                    changedUser.ownedGroups = req.user.ownedGroups;
                    req.login(changedUser, function(err) {
                        if (!err && !response.status) {
                            console.log("hub");
                           req.flash('error', 'Fehler beim Ändern der Daten');
                           res.render('user/edit_me', {message: req.flash('error'), responses: response.responses, title: title('Daten Ändern'), user: changedUser});
                        } else {
                            console.log("dup");
                            req.flash('notification', 'Benutzer*innendaten geändert');
                            req.flash('responses', response.responses);
                            res.redirect('/edit_me');
                        }
                    });
            });        
        })
        .catch(error => errorPage(req,res,error));
});

router.get('/passwd/:uid/:token', function(req, res) {
    activation.isTokenValid(req.params.uid, req.params.token, function(valid) {
        if (valid) {
            ldaphelper.getByUID(req.params.uid)
                .then((user) => {
                    res.render('user/passwd', {user: user, token: req.params.token, title: title('Passwort Ändern')});
                })
                .catch((error) => {
                    req.flash('error', 'Fehler beim Setzen des Passworts: ' + error);
                    res.redirect('/login');
                });                
        } else {
            req.flash('error', 'Link zum Ändern des Passworts in ungültig!');
            res.redirect('/login');
        }
    });
});

router.post('/user/passwd', function(req, res) {
    activation.isTokenValid(req.body.uid, req.body.token, function(valid) {
        if (valid) {
            actions.user.modify({
                dn: req.body.dn,
                uid: req.body.uid,
                givenName: false,
                surname: false,
                project: false,
                email: false,
                description: false,
                changedUid: false,
                password: req.body.userPassword,
                passwordRepeat: req.body.userPassword2,
                language: false,
                member: false,
                owner: false
            }).then((response) => {
                if (!response.status) {
                    req.flash('error', 'Fehler beim Setzen des Passworts');
                    return ldaphelper.getByUID(req.body.uid)
                        .then((user) => {
                            res.render('user/passwd', {message: req.flash('error'), responses: response.responses, user: user, token: req.params.token, title: title('Passwort Ändern')});
                        });
                } else {
                    activation.deleteToken(req.body.uid, function(err) {
                        if (err) {
                            req.flash('error', 'Passwort geändert, Fehler bei Löschen des Tokens, bitte die Admin*as kontaktieren: ' + err);
                        } else {
                            req.flash('notification', 'Passwort geändert');
                        }
                        req.flash('responses', response.responses);
                        res.redirect('/login');
                    });
                }
            })
            .catch((error) => {
                req.flash('error', 'Fehler beim Setzen des Passworts: ' + error);
                res.redirect('/login');
            });
        } else {
            req.flash('error', 'Token zum Ändern des Passworts in ungültig oder abgelaufen!');
            res.redirect('login');
        }
    });
});

router.get('/lostpasswd', function(req, res) {
    res.render('user/lostpasswd', {title: title('Passwort Vergessen')});
});

router.post('/user/lostpasswd', function(req, res) {
    ldaphelper.getByEmail(req.body.mail)
        .then((user) => {
            mail.sendPasswordResetEmail(user, function(err) {
                if (err) {
                    req.flash('error', 'Link zum Ändern des Passworts konnte nicht verschickt werden: ' + err);
                } else {
                    req.flash('notification', 'Link zum Ändern des Passworts wurde per E-Mail verschickt');
                }
                res.redirect('/lostpasswd');
            });
        })
        .catch((error) => {
            req.flash('error', 'E-Mailadresse nicht gefunden');
            res.redirect('/lostpasswd');
        });
});



router.get('/ping', function(req, res){
    res.status(200).send("pong!");
});

router.get('/show', isLoggedInGroupAdmin, function(req,res){
    ldaphelper.fetchUsers()
        .then((users) => {
            ldaphelper.fetchGroups(req.user.ownedGroups)
                .then((groups) => {
                    res.render('show', {users: users, groups: groups, error: req.flash('error'), notification: req.flash('notification'), responses: req.flash('responses'), title: title('Benutzer <-> Gruppen')});
                });
        })
        .catch((error) => {
            req.flash('error', error);
            res.redirect('/error');
        });
});

router.get('/show_cat', isLoggedInAdmin, function(req,res){
    ldaphelper.fetchGroups(req.user.ownedGroups)
        .then((groups) => {
            //console.log('users: ' + JSON.stringify(users));
            discourse.getCategories(function (err, categories) {
                if (err) req.flash('notification', err);
                res.render('show_cat', {groups: groups, categories: categories, error: req.flash('error'), notification: req.flash('notification'), responses: req.flash('responses'), title: title('Gruppen <-> Kategorien')});

            });
        })
        .catch((error) => {
            req.flash('error', error);
            res.redirect('/error');
        });
});

router.get('/user/add', isLoggedInGroupAdmin, function(req, res) {
    ldaphelper.fetchGroups(req.user.ownedGroups)
        .then((groups) => {
            res.render('user/add', { groups: groups, title: title('Benutzer*in Anlegen') });
        }).catch(error => errorPage(req,res,error));
});

router.post('/user/add', isLoggedInGroupAdmin, function(req, res) {



    var user = {
        givenName: req.body.givenName ,
        surname: req.body.sn,
        project: req.body.businessCategory,
        description: req.body.description, // quota
        email: req.body.mail,
        password:  req.body.userPassword,
        passwordRepeat: req.body.userPassword2,
        member: JSON.parse(req.body.groups),
        owner: JSON.parse(req.body.admingroups),
        language: req.body.language,
        activation: req.body.activation == 'on'
    };

    if (user.description === "") {
        user.description = "10 GB";
    }


    // if action e-mail is checked generate uncrackable password (works like user is deactived)
    if (req.body.activation) {
        var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_?!&%$#+-';
        var uncrackable = '';
        for (var i = 20; i > 0; --i) {
          uncrackable += chars[Math.round(Math.random() * (chars.length - 1))];
        }
        user.password = uncrackable;
        user.passwordRepeat = uncrackable;
    }

    // create user
    actions.user.create(user, req.user)
        .then((response) => {
            if (!response.status) {
                req.flash('error', 'Fehler beim Anlegen der*des Benutzer*in');

                ldaphelper.fetchGroups(req.user.ownedGroups)
                    .then((groups) => {
                        res.render('user/add', {message: req.flash('error'), responses: response.responses, groups:groups, title: title('Benutzer*in Anlegen'), user: {
                            givenName: req.body.givenName,
                            sn: req.body.sn,
                            mail: req.body.mail,
                            description: req.body.description, // quota
                            businessCategory: req.body.businessCategory
                        }});
                    })
            } else {
                // if user creation succeeded send activation e-mail
                req.flash('notification', 'Benutzer*in ' + req.body.givenName + ' ' + req.body.sn + ' angelegt');
                req.flash('responses', response.responses);
                res.redirect('/show');
            }
        }).catch(error => errorPage(req,res,error));
});

router.get('/user/edit/:id', isLoggedInGroupAdmin, function(req, res) {
    console.log('admin: ' + req.user.isAdmin);
    ldaphelper.fetchGroups(req.user.ownedGroups)
        .then((groups) => {
            ldaphelper.fetchObject(req.params.id)
                .then((user) => {
                    res.render('user/edit', { groups: groups, user:user, title: title('Benutzer*in Bearbeiten')});
                });
        }).catch(error => errorPage(req,res,error));
});

router.post('/user/edit', isLoggedInGroupAdmin, function(req, res) {
    var user = {
        dn: req.body.dn,
        uid: req.body.uid,
        changedUid: req.body.changedUid,
        givenName: req.body.givenName ,
        surname: req.body.sn,
        project: req.body.businessCategory,
        description: req.body.description, // quota
        email: req.body.mail,
        password: req.body.userPassword,
        passwordRepeat: req.body.userPassword2,
        language: req.body.language,
        member: JSON.parse(req.body.groups),
        owner: JSON.parse(req.body.admingroups)
    };

    if (user.description === "") {
        user.description = "10 GB";
    }


    actions.user.modify(user, req.user)
        .then((response) => {
            if (!response.status) {
                req.flash('error', 'Fehler beim Ändern der Daten');
                    return ldaphelper.fetchGroups(req.user.ownedGroups)
                        .then((groups) => {
                            res.render('user/edit', {message: req.flash('error'), responses: response.responses, title: title('Benutzer*in Bearbeiten'), groups: groups, user: {
                                givenName: req.body.givenName,
                                sn: req.body.sn,
                                mail: req.body.mail,
                                description: req.body.description, // quota
                                userPassword: req.body.userPassword,
                                userPassword2: req.body.userPassword2,
                                dn: req.body.dn,
                                uid: req.body.uid,
                                businessCategory: req.body.businessCategory
                            }});
                        });
            } else {
                req.flash('notification', 'Benutzer*in ' + req.body.givenName + ' ' + req.body.sn + ' geändert');
                req.flash('responses', response.responses);
                res.redirect('/show');
            }
        }).catch(error => errorPage(req,res,error));
});

router.get('/user/delete/:id', isLoggedInGroupAdmin, function(req, res) {
    ldaphelper.fetchUser(req.params.id)
        .then((user) => {
            return actions.user.remove({
                dn: req.params.id,
                uid: user.uid,
                email: user.mail,
                member: user.member,
                owner: user.owner
            }, req.user).then(function(response) {
                if (!response.status) {
                    req.flash('error', 'Fehler beim Löschen von ' + req.params.id);
                } else {
                    req.flash('notification', 'Benutzer*in ' + req.params.id + ' gelöscht');
                }
                req.flash('responses', response.responses);
                res.redirect('/show');
            });
        }).catch(error => errorPage(req,res,error));
});

router.get('/group/edit/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchObject(req.params.id)
        .then((group) => {
            res.render('group/edit', { group:group, title: title('Gruppe Bearbeiten')});
        }).catch(error => errorPage(req,res,error));
});

router.get('/group/add', isLoggedInAdmin, function(req, res) {
    res.render('group/add', { title: title('Gruppe Anlegen')});
});

router.post('/group/add', isLoggedInAdmin, function(req, res) {
    var group = {
        name: req.body.cn,
        description: req.body.description
    };

    actions.group.create(group, req.user)
        .then((response) => {
            if (!response.status) {
                req.flash('error', 'Fehler beim Anlegen der Gruppe ' + req.body.cn);
                res.render('group/add', {message: req.flash('error'), responses: response.responses, title: title('Gruppe Anlegen'),group: {
                    cn: req.body.cn,
                    description: req.body.description
                }});
            } else {
                req.flash('notification', 'Gruppe ' + req.body.cn + ' angelegt');
                req.flash('responses', response.responses);
                res.redirect('/show');
            }
        }).catch(error => errorPage(req,res,error));
});

router.post('/group/edit', isLoggedInAdmin, function(req, res) {
    var group = {
        dn: req.body.dn,
        name: req.body.cn,
        description: req.body.description
    };

    actions.group.modify(group, req.user)
        .then((response) => {
            if (!response.status) {
                req.flash('error', 'Fehler beim Ändern der Gruppe ' + req.body.cn);
                res.render('group/edit', {message: req.flash('error'), responses: response.responses, title: title('Gruppe Bearbeiten'),group: {
                    dn: req.body.dn,
                    cn: req.body.cn,
                    description: req.body.description
                }});
            } else {
                req.flash('notification', 'Gruppe ' + req.body.cn + ' geändert');
                req.flash('responses', response.responses);
                res.redirect('/show');
            }
        }).catch(error => errorPage(req,res,error));

});

router.get('/group/delete/:id', isLoggedInAdmin, function(req, res) {
    actions.group.remove({ dn: req.params.id }, req.user)
        .then((response) => {
            if (!response.status) {
                req.flash('error', 'Fehler beim Löschen der Gruppe ' + req.params.id);
            } else {
                req.flash('notification', 'Gruppe ' + req.params.id + ' gelöscht');
            }
            req.flash('responses', response.responses);
            res.redirect('/show');
        }).catch(error => errorPage(req,res,error));
});


router.get('/cat/edit/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchGroups(req.user.ownedGroups)
        .then((groups) => {
            discourse.getParentCategories(function(err, parents){
                if (err) {
                    req.flash('notification', err);
                    req.redirect('/show_cat')
                } else {
                    discourse.getCategoryWithParent(req.params.id, function(err, category) {
                        if (err) {
                            req.flash('notification', err);
                            req.redirect('/show_cat')
                        } else {
                            res.render('cat/edit', { category: category, groups: groups, parents: parents, title: title('Kategorie Bearbeiten') });
                        }
                    });

                }
            });
        }).catch(error => errorPage(req,res,error));
});

router.get('/cat/add', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchGroups(req.user.ownedGroups)
        .then((groups) => {
            discourse.getParentCategories(function(err, parents){
                if (err) {
                    req.flash('notification', err);
                    req.redirect('/show_cat')
                } else {
                    res.render('cat/add', { groups: groups, parents: parents, title: title('Kategorie Anlegen') });
                }
            });
        }).catch((error) => {
            req.flash('error', error);                        
            res.redirect('/error');
        });
});

router.post('/cat/add', isLoggedInAdmin, function(req, res) {
    console.log('create cat body: ' + JSON.stringify(req.body));
    console.log('create cat file: ' + JSON.stringify(req.file));

    var category = {
        name: req.body.name,
        color: req.body.color,
        parent: req.body.parent,
        logo: req.file,
        groups: JSON.parse(req.body.groups)
    };

    actions.category.create(category)
        .then((response) => {
            if (!response.status) {
                req.flash('error', 'Fehler beim Erstellen der Kategorie ' + req.body.name);
                ldaphelper.fetchGroups(function(groups) {
                    discourse.getParentCategories(function(err, parents){
                        if (err) {
                            req.flash('notification', 'Fehler beim Abrufen der Elternekategorien: ' + err);
                            req.redirect('/show_cat')
                        } else {
                            res.render('cat/add', { category: {name:req.body.name, color:req.body.color, parent:req.body.parent, groups:req.body.groups}, groups: groups, message: req.flash('error'), responses: response.responses, parents: parents, title: title('Kategorie Anlegen') });
                        }
                    });
                });

            } else {
                req.flash('responses', response.responses);
                req.flash('notification', 'Kategorie ' + req.body.name + ' angelegt');
                res.redirect('/show_cat');
            }
        }).catch((error) => {
            req.flash('error', error);                        
            res.redirect('/error');
        });
});

router.post('/cat/edit', isLoggedInAdmin, function(req, res) {
    console.log('modify cat body: ' + JSON.stringify(req.body));
    console.log('modify cat file: ' + JSON.stringify(req.file));

    var category = {
        id: req.body.id,
        name: req.body.name,
        color: req.body.color,
        parent: req.body.parent,
        delete_image: req.body.delete_image,
        logo: req.file,
        groups: JSON.parse(req.body.groups)
    };

    actions.category.modify(category)
        .then((response) => {
            if (!response.status) {
                req.flash('error', 'Fehler beim Ändern der Kategorie ' + req.body.name);
                ldaphelper.fetchGroups(function(groups) {
                    discourse.getParentCategories(function(err, parents){
                        if (err) {
                            req.flash('notification', 'Fehler beim Abrufen der Elternekategorien: ' + err);
                            req.redirect('/show_cat')
                        } else {
                            res.render('cat/edit', { category: {name:req.body.name, color:req.body.color, parent:req.body.parent, groups:req.body.groups}, groups: groups, message: req.flash('error'), responses: response.responses, parents: parents, title: title('Kategorie Anlegen') });
                        }
                    });
                });

            } else {
                req.flash('responses', response.responses);
                req.flash('notification', 'Kategorie ' + req.body.name + ' geändert');
                res.redirect('/show_cat');
            }
        }).catch((error) => {
            req.flash('error', error);                        
            res.redirect('/error');
        });
});

router.get('/cat/delete/:id', isLoggedInAdmin, function(req, res) {
    actions.category.remove({ id: req.params.id })
        .then((response) => {
            if (!response.status) {
                req.flash('error', 'Fehler beim Löschen der Kategorie ' + req.params.id);
            } else {
                req.flash('notification', 'Kategorie ' + req.params.id + ' gelöscht');
            }
            req.flash('responses', response.responses);
            res.redirect('/show_cat');
        }).catch((error) => {
            req.flash('error', error);                        
            res.redirect('/error');
        });
});

module.exports = router;