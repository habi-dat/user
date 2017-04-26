var express = require('express');
var passport = require('passport');
var ldaphelper = require('../utils/ldaphelper');
var discourse = require('../utils/discoursehelper');
var router = express.Router();
var config    = require('../config/config.json');
var activation = require('../utils/activation');
var mail = require('../utils/mailhelper');

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
    res.render('user/edit_me', {notification: req.flash('notification'), title: title('Daten Ändern')});
});

router.post('/user/edit_me', isLoggedIn, function(req, res) {
    ldaphelper.updateUser(req.body.dn, {
        givenName: req.body.givenName,
        sn: req.body.sn,
        userPassword: req.body.userPassword,
        userPassword2: req.body.userPassword2,
        mail: req.body.mail
    }, false, function(err) {
        if (err) {
              req.flash('error', 'Error: ' + err);
              res.render('user/edit_me', {message: req.flash('error'), title: title('Daten Ändern'), user: {
                givenName: req.body.givenName,
                sn: req.body.sn,
                mail: req.body.mail,
                userPassword: req.body.userPassword,
                userPassword2: req.body.userPassword2,
                dn: req.body.dn
              }});
        } else {
              ldaphelper.fetchGroups(function(groups) {
              req.flash('notification', 'Benutzer*innendaten geändert');
              req.login({
                    givenName: req.body.givenName,
                    sn: req.body.sn,
                    mail: req.body.mail,
                    userPassword: req.body.userPassword,
                    dn: req.body.dn,
                    isAdmin: req.user.isAdmin
                  }, function(err) {
                        if (err) {
                          req.flash('error', 'Error: ' + err);
                          res.render('user/edit_me', {message: req.flash('error'), title: title('Daten Ändern'), user: {
                            givenName: req.body.givenName,
                            sn: req.body.sn,
                            mail: req.body.mail,
                            userPassword: req.body.userPassword,
                            userPassword2: req.body.userPassword2,
                            dn: req.body.dn,
                          }});
                        } else {

                           if (config.discourse.enabled) {
                                discourse.updateUser({
                                    givenName: req.body.givenName,
                                    sn: req.body.sn,
                                    businessCategory: req.body.businessCategory,
                                    mail: req.body.mail,
                                    uid: req.body.uid
                                }, function(err) {
                                    if (err)
                                      console.log('Error updating disocurse user: ' + err);
                                });
                            }                                        
                            res.redirect('/edit_me');
                        }

                    });

            })
        }
    })
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
            ldaphelper.updatePassword(
                req.body.uid, 
                req.body.userPassword,
                req.body.userPassword2, function(err) {
                    if (err) {
                        req.flash('error', 'Fehler: ' + err);
                        ldaphelper.getByUID(req.body.uid, function(user) {
                            res.render('user/passwd', {message: req.flash('error'), token: req.body.token, title: title('Passwort Ändern'), user: {
                                uid: req.body.uid,
                                cn: user.cn,
                                userPassword: req.body.userPassword,
                                userPassword2: req.body.userPassword2
                            }});
                        });                        
    
                    } else {
                        activation.deleteToken(req.body.uid, function(err) {
                            if (err) {
                                req.flash('error', 'Fehler: ' + err);
                                ldaphelper.getByUID(req.body.uid, function(user) {
                                    res.render('user/passwd', {message: req.flash('error'), token: req.body.token, title: title('Passwort Ändern'), user: {
                                        uid: req.body.uid,
                                        cn: user.cn,
                                        userPassword: req.body.userPassword,
                                        userPassword2: req.body.userPassword2
                                    }});
                                });  
                            } else {
                                req.flash('notification', 'Passwort geändert');
                                res.redirect('/login');
                            }
                        });
                    }
            });
        } else {
            req.flash('error', 'Token zum Ändern des Passworts in ungültig!');
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
            req.flash('notification', 'Link zum Ändern des Passworts wurde per E-Mail verschickt');
            res.redirect('/login');
        } else {
            mail.sendPasswordResetEmail(user, function(err) {
                if (err) {
                    console.log('Error sending password reset mail: ' + err);
                } 
                req.flash('notification', 'Link zum Ändern des Passworts wurde per E-Mail verschickt');
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
            res.render('show', {users: users, groups: groups, notification: req.flash('notification'), title: title('Benutzer <-> Gruppen')});

        });
    });
});

router.get('/show_cat', isLoggedInAdmin, function(req,res){
    ldaphelper.fetchGroups(function(groups) {
        //console.log('users: ' + JSON.stringify(users));
        discourse.getCategories(function (err, categories) {
            if (err) req.flash('notification', err);
            res.render('show_cat', {groups: groups, categories: categories, notification: req.flash('notification'), title: title('Gruppen <-> Kategorien')});

        });
    });
});

router.get('/user/add', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchGroups(function(groups) {
        res.render('user/add', { groups: groups, title: title('Benutzer*in Anlegen') });
    });
});

router.post('/user/add', isLoggedInAdmin, function(req, res) {
    ldaphelper.addUser({
        givenName: req.body.givenName,
        sn: req.body.sn,
        userPassword: req.body.userPassword,
        userPassword2: req.body.userPassword2,
        mail: req.body.mail,
        groups: req.body.groups,
        adminGroups: req.body.admingroups,
        businessCategory: req.body.businessCategory,
        activation: req.body.activation
    }, req.user,  function(err, uniqueUID) {
        if (err) {
            req.flash('error', 'Error: ' + err);
            ldaphelper.fetchGroups( function(groups) {
              res.render('user/add', {message: req.flash('error'), groups:groups, title: title('Benutzer*in Anlegen'), user: {
                givenName: req.body.givenName,
                sn: req.body.sn,
                mail: req.body.mail,
                businessCategory: req.body.businessCategory
              }});
            })
        } else {
            if (config.discourse.enabled) {
                discourse.createUser({
                    givenName: req.body.givenName,
                    sn: req.body.sn,
                    businessCategory: req.body.businessCategory,
                    mail: req.body.mail,
                    groups: req.body.groups,
                    adminGroups: req.body.admingroups,
                    userPassword: req.body.userPassword,
                    uid: uniqueUID,
                    activation: req.body.activation
                }, function(err) {
                    if (err)
                      console.log('Error creating disocurse user: ' + err);
                });
            }
            req.flash('notification', 'Benutzer*in ' + req.body.givenName + ' ' + req.body.sn + ' angelegt');
            res.redirect('/show');
        }
    })
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
    ldaphelper.updateUser(req.body.dn, {
        givenName: req.body.givenName,
        sn: req.body.sn,
        userPassword: req.body.userPassword,
        userPassword2: req.body.userPassword2,
        mail: req.body.mail,
        groups: req.body.groups,
        adminGroups: req.body.admingroups,
        businessCategory: req.body.businessCategory
    }, true, function(err) {
        if (err) {
            req.flash('error', 'Error: ' + err);
            ldaphelper.fetchGroups(function(groups) {
              res.render('user/edit', {message: req.flash('error'), groups:groups, title: title('Benutzer*in Bearbeiten'), user: {
                givenName: req.body.givenName,
                sn: req.body.sn,
                mail: req.body.mail,
                userPassword: req.body.userPassword,
                userPassword2: req.body.userPassword2,
                dn: req.body.dn,
                uid: req.body.uid,
                businessCategory: req.body.businessCategory
              }});
            })
        } else {
            if (config.discourse.enabled) {
                discourse.updateUser({
                    givenName: req.body.givenName,
                    sn: req.body.sn,
                    businessCategory: req.body.businessCategory,
                    mail: req.body.mail,
                    groups: req.body.groups,
                    adminGroups: req.body.admingroups,
                    userPassword: req.body.userPassword,
                    uid: req.body.uid
                }, function(err) {
                    if (err)
                      console.log('Error updating disocurse user: ' + err);
                });
            }            

            req.flash('notification', 'Benutzer*in ' + req.body.givenName + ' ' + req.body.sn + ' geändert');
            res.redirect('/show');
        }
    })
});

router.get('/user/delete/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchObject(req.params.id, function(user) {
        ldaphelper.deleteUser(req.params.id, function(err) {
            if (err) {
                req.flash('error', 'Fehler beim Löschen von ' + req.params.id + ': ' + err);
            } else {
                if (config.discourse.enabled) {
                    discourse.deleteUser(user.uid, function(err) {
                        if (err)
                          console.log('Error deleting discourse user: ' + err);
                    });            
                }
            }
            req.flash('notification', 'Benutzer*in ' + req.params.id + ' gelöscht');        
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
    ldaphelper.addGroup({
        cn: req.body.cn,
        description: req.body.description
    }, function(err) {
        if (err) {
            req.flash('error', 'Error: ' + err);
              res.render('group/add', {message: req.flash('error'), title: title('Gruppe Anlegen'),group: {
                cn: req.body.cn,
                description: req.body.description
              }});
        } else {

            if (config.discourse.enabled) {
                discourse.createGroup({
                    cn: req.body.cn,
                    description: req.body.description
                }, function(err) {
                    if (err)
                      console.log('Error creating discourse group: ' + err);
                });
            }

            req.flash('notification', 'Gruppe ' + req.body.cn + ' angelegt');            
            res.redirect('/show');
        }
    })
});

router.post('/group/edit', isLoggedInAdmin, function(req, res) {
    ldaphelper.updateGroup(req.body.dn, {
        cn: req.body.cn,
        description: req.body.description
    }, function(err) {
        if (err) {
            req.flash('error', 'Error: ' + err);
              res.render('group/edit', {message: req.flash('error'), title: title('Gruppe Bearbeiten'),group: {
                cn: req.body.cn,
                description: req.body.description,
                dn: req.body.dn
              }});
        } else {

            if (config.discourse.enabled) {
                var oldGroupName = req.body.dn.split(',')[0].replace('cn=', '');
                discourse.updateGroup(oldGroupName, {
                    cn: req.body.cn,
                    description: req.body.description
                }, function(err) {
                    if (err)
                      console.log('Error updating discourse group: ' + err);
                });
            }

            req.flash('notification', 'Gruppe ' + req.body.cn + ' geändert');               
            res.redirect('/show');
        }
    })
});

router.get('/group/delete/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.deleteGroup(req.params.id, function(err) {
        if (err) {
            req.flash('error', 'Fehler beim Löschen von ' + req.params.id + ': ' + err);
        } else {
            if (config.discourse.enabled) {
                var groupName = req.params.id.split(',')[0].replace('cn=', '');
                discourse.deleteGroup(groupName, function(err) {
                    if (err)
                      console.log('Error deleting discourse group: ' + err);
                }); 
            }
        }
        req.flash('notification', 'Gruppe ' + req.params.cn + ' gelöscht');           
        res.redirect('/show');
    });
});

module.exports = router;