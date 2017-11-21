var express = require('express');
var passport = require('passport');
var ldaphelper = require('../utils/ldaphelper');
var discourse = require('../utils/discoursehelper');
var router = express.Router();
var config    = require('../config/config.json');
var activation = require('../utils/activation');
var mail = require('../utils/mailhelper');
var actions = require('../actions');

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

var title = function(page) {
    return 'habiDAT - ' + page;
}

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

router.get('/', isLoggedIn, function(req, res) {
    if (req.user.isAdmin) {
        res.redirect('/show');
    } else {
        res.redirect('/edit_me');
    }
});

router.get('/edit_me', isLoggedIn, function(req, res) {
    res.render('user/edit_me', {notification: req.flash('notification'), responses: req.flash('responses'), title: title('Daten Ändern')});
});

router.post('/edit_me', isLoggedIn, function(req, res) {
    var user = {
        uid: req.body.uid, 
        dn: req.body.dn,
        givenName: req.body.givenName ,
        surname: req.body.sn,
        project: false,
        email: req.body.mail, 
        password: req.body.userPassword, 
        passwordRepeat: req.body.userPassword2, 
        member: false, 
        owner: false
    };
    actions.user.modify(user).then(function(response) {
        req.login({
            givenName: req.body.givenName,
            sn: req.body.sn,
            mail: req.body.mail,
            userPassword: req.body.userPassword,
            dn: req.body.dn,
            isAdmin: req.user.isAdmin}, function(err) {
            if (!err && !response.status) {
               req.flash('error', 'Fehler beim Ändern der Daten' + err?': ' + err: '');
               res.render('user/edit_me', {message: req.flash('error'), responses: response.responses, title: title('Daten Ändern'), user: {
                 givenName: req.body.givenName,
                 sn: req.body.sn,
                 mail: req.body.mail,
                 userPassword: req.body.userPassword,
                 userPassword2: req.body.userPassword2,
                 uid: req.body.uid
               }});        
            } else {
                req.flash('notification', 'Benutzer*innendaten geändert');
                req.flash('responses', response.responses);
                res.redirect('/edit_me');
            }
        });
    });

    // ldaphelper.updateUser(req.body.dn, {
    //     givenName: req.body.givenName,
    //     sn: req.body.sn,
    //     userPassword: req.body.userPassword,
    //     userPassword2: req.body.userPassword2,
    //     mail: req.body.mail
    // }, false, function(err) {
    //     if (err) {
    //           req.flash('error', 'Error: ' + err);
    //           res.render('user/edit_me', {message: req.flash('error'), title: title('Daten Ändern'), user: {
    //             givenName: req.body.givenName,
    //             sn: req.body.sn,
    //             mail: req.body.mail,
    //             userPassword: req.body.userPassword,
    //             userPassword2: req.body.userPassword2,
    //             dn: req.body.dn
    //           }});
    //     } else {
    //           ldaphelper.fetchGroups(function(groups) {
    //           req.flash('notification', 'Benutzer*innendaten geändert');
    //           req.login({
    //                 givenName: req.body.givenName,
    //                 sn: req.body.sn,
    //                 mail: req.body.mail,
    //                 userPassword: req.body.userPassword,
    //                 dn: req.body.dn,
    //                 isAdmin: req.user.isAdmin
    //               }, function(err) {
    //                     if (err) {
    //                       req.flash('error', 'Error: ' + err);
    //                       res.render('user/edit_me', {message: req.flash('error'), title: title('Daten Ändern'), user: {
    //                         givenName: req.body.givenName,
    //                         sn: req.body.sn,
    //                         mail: req.body.mail,
    //                         userPassword: req.body.userPassword,
    //                         userPassword2: req.body.userPassword2,
    //                         dn: req.body.dn,
    //                       }});
    //                     } else {

    //                        if (config.discourse.enabled) {
    //                             discourse.updateUser({
    //                                 givenName: req.body.givenName,
    //                                 sn: req.body.sn,
    //                                 businessCategory: req.body.businessCategory,
    //                                 mail: req.body.mail,
    //                                 uid: req.body.uid
    //                             }, function(err) {
    //                                 if (err)
    //                                   console.log('Error updating disocurse user: ' + err);
    //                             });
    //                         }                                        
    //                         res.redirect('/edit_me');
    //                     }

    //                 });

    //         })
    //     }
    // })
});

router.get('/passwd/:uid/:token', function(req, res) {
    activation.isTokenValid(req.params.uid, req.params.token, function(valid) {
        if (valid) {
            ldaphelper.getByUID(req.params.uid, function(user) {
                res.render('user/passwd', {user: user, token: req.params.token, title: title('Passwort Ändern')});
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
            var response = actions.user.modify({
                uid: req.body.uid, 
                givenName: false,
                surname: false,
                project: false,
                email: false, 
                password: req.body.userPassword, 
                passwordRepeat: req.body.userPassword2, 
                member: false, 
                owner: false
            });
            if (!response.status) {
                req.flash('error', 'Fehler beim Setzen des Passworts');
                ldaphelper.getByUID(req.body.uid, function(user) {
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
    ldaphelper.getByEmail(req.body.mail, function(user, err) {
        if (err || !user) {
            console.log('Error sending activation mail: ' + err);
            req.flash('error', 'E-Mailadresse nicht gefunden');
            res.redirect('/login');
        } else {
            mail.sendPasswordResetEmail(user, function(err) {
                if (err) {
                    req.flash('error', 'Link zum Ändern des Passworts konnte nicht verschickt werden: ' + err);
                } else {
                    req.flash('notification', 'Link zum Ändern des Passworts wurde per E-Mail verschickt');
                }
                res.redirect('/login');                
            });
        }
    })
});

router.post('/login', passport.authenticate('ldapauth', {session: true, failureRedirect: '/login',
 failureFlash:true, successReturnToOrRedirect: '/'}));

router.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/login');
});

router.get('/ping', function(req, res){
    res.status(200).send("pong!");
});

router.get('/show', isLoggedInAdmin, function(req,res){
    ldaphelper.fetchUsers(function(users) {
        ldaphelper.fetchGroups(function(groups) {
            res.render('show', {users: users, groups: groups, error: req.flash('error'), notification: req.flash('notification'), responses: req.flash('responses'), title: title('Benutzer <-> Gruppen')});

        });
    });
});

router.get('/show_cat', isLoggedInAdmin, function(req,res){
    ldaphelper.fetchGroups(function(groups) {
        //console.log('users: ' + JSON.stringify(users));
        discourse.getCategories(function (err, categories) {
            if (err) req.flash('notification', err);
            res.render('show_cat', {groups: groups, categories: categories, error: req.flash('error'), notification: req.flash('notification'), responses: req.flash('responses'), title: title('Gruppen <-> Kategorien')});

        });
    });
});

router.get('/user/add', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchGroups(function(groups) {
        res.render('user/add', { groups: groups, title: title('Benutzer*in Anlegen') });
    });
});

router.post('/user/add', isLoggedInAdmin, function(req, res) {

    var user = {
        givenName: req.body.givenName ,
        surname: req.body.sn,
        project: req.body.businessCategory,
        email: req.body.mail, 
        password:  req.body.userPassword, 
        passwordRepeat: req.body.userPassword2, 
        member: req.body.groups, 
        owner: req.body.admingroups,
        activation: req.body.activation == 'on'
    };

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
    actions.user.create(user).then(function(response) {
        console.log('error :' + JSON.stringify(response));
        if (!response.status) {
            req.flash('error', 'Fehler beim Anlegen der*des Benutzer*in');

            ldaphelper.fetchGroups( function(groups) {
              res.render('user/add', {message: req.flash('error'), responses: response.responses, groups:groups, title: title('Benutzer*in Anlegen'), user: {
                givenName: req.body.givenName,
                sn: req.body.sn,
                mail: req.body.mail,
                businessCategory: req.body.businessCategory
              }});
            })
        } else {
            // if user creation succeeded send activation e-mail
            req.flash('notification', 'Benutzer*in ' + req.body.givenName + ' ' + req.body.sn + ' angelegt');
            req.flash('responses', response.responses);
            res.redirect('/show');
        }
    });
});

router.get('/user/edit/:id', isLoggedInAdmin, function(req, res) {
    console.log('admin: ' + req.user.isAdmin);
    ldaphelper.fetchGroups( function(groups) {
        ldaphelper.fetchObject(req.params.id, function(user) {
            res.render('user/edit', { groups: groups, user:user, title: title('Benutzer*in Bearbeiten')});
        });
    });
});

router.post('/user/edit', isLoggedInAdmin, function(req, res) {

    actions.user.modify({
        dn: req.body.dn,
        uid: req.body.uid, 
        givenName: req.body.givenName ,
        surname: req.body.sn,
        project: req.body.businessCategory,
        email: req.body.mail, 
        password: req.body.userPassword, 
        passwordRepeat: req.body.userPassword2, 
        member: req.body.groups, 
        owner: req.body.admingroups
    }).then(function(response) {
        if (!response.status) {
            req.flash('error', 'Fehler beim Ändern der Daten');
            ldaphelper.fetchGroups(function(groups) {        
                res.render('user/edit', {message: req.flash('error'), responses: response.responses, title: title('Benutzer*in Bearbeiten'), groups: groups, user: {
                    givenName: req.body.givenName,
                    sn: req.body.sn,
                    mail: req.body.mail,
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
    });
});

router.get('/user/delete/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchObject(req.params.id, function(user) {
        actions.user.remove({
            dn: req.params.id,
            uid: user.uid,
            email: user.mail
        }).then(function(response) {
            if (!response.status) {
                req.flash('error', 'Fehler beim Löschen von ' + req.params.id);
            } else {
                req.flash('notification', 'Benutzer*in ' + req.params.id + ' gelöscht');
            }
            req.flash('responses', response.responses);
            res.redirect('/show');       
        });
    });
});

router.get('/group/edit/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchObject(req.params.id, function(group) {
        res.render('group/edit', { group:group, title: title('Gruppe Bearbeiten')});
    });
});

router.get('/group/add', isLoggedInAdmin, function(req, res) {
    res.render('group/add', { title: title('Gruppe Anlegen')});
});

router.post('/group/add', isLoggedInAdmin, function(req, res) {
    var group = {
        name: req.body.cn,
        description: req.body.description
    };

    actions.group.create(group).then(function(response) {
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
    });
});

router.post('/group/edit', isLoggedInAdmin, function(req, res) {
    var group = {
        dn: req.body.dn,
        name: req.body.cn,
        description: req.body.description
    };

    actions.group.modify(group).then(function(response) {
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
    });

});

router.get('/group/delete/:id', isLoggedInAdmin, function(req, res) {
    actions.group.remove({
        dn: req.params.id
    }).then(function(response) {
        if (!response.status) {
            req.flash('error', 'Fehler beim Löschen der Gruppe ' + req.params.id);
        } else {
            req.flash('notification', 'Gruppe ' + req.params.id + ' gelöscht');
        }
        req.flash('responses', response.responses);
        res.redirect('/show');       
    });

});


router.get('/cat/edit/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchGroups(function(groups) {
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

    });
});

router.get('/cat/add', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchGroups(function(groups) {
        discourse.getParentCategories(function(err, parents){
            if (err) {
                req.flash('notification', err);
                req.redirect('/show_cat')
            } else {
                res.render('cat/add', { groups: groups, parents: parents, title: title('Kategorie Anlegen') });
            }
        });

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

    actions.category.create(category).then(function(response) {
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
        logo: req.file,
        groups: JSON.parse(req.body.groups)
    };

    actions.category.modify(category).then(function(response) {
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
    });
});

router.get('/cat/delete/:id', isLoggedInAdmin, function(req, res) {
    actions.category.remove({
        id: req.params.id
    }).then(function(response) {
        if (!response.status) {
            req.flash('error', 'Fehler beim Löschen der Kategorie ' + req.params.id);
        } else {
            req.flash('notification', 'Kategorie ' + req.params.id + ' gelöscht');
        }
        req.flash('responses', response.responses);
        res.redirect('/show_cat');       
    });

});

module.exports = router;