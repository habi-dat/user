var express = require('express');
var passport = require('passport');
var ldaphelper = require('../utils/ldaphelper');
var discourse = require('../utils/discoursehelper');
var router = express.Router();
var config    = require('../config/config.json');

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

router.get('/login', function(req, res) {
    res.render('login', { user : req.user , message: req.flash('error')[0]});
});

router.get('/', isLoggedIn, function(req, res) {
    if (req.user.isAdmin) {
        res.redirect('/show');
    } else {
        res.redirect('/edit_me');
    }
});

router.get('/edit_me', isLoggedIn, function(req, res) {
    res.render('user/edit_me', {notification: req.flash('notification')});
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
              res.render('user/edit_me', {message: req.flash('error'), user: {
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
                          res.render('user/edit_me', {message: req.flash('error'), user: {
                            givenName: req.body.givenName,
                            sn: req.body.sn,
                            mail: req.body.mail,
                            userPassword: req.body.userPassword,
                            userPassword2: req.body.userPassword2,
                            dn: req.body.dn,
                          }});
                        } else {
                          res.redirect('/edit_me');
                        }

                    });

            })
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
            //console.log('users: ' + JSON.stringify(users));
            res.render('show', {users: users, groups: groups, notification: req.flash('notification')});
        });
    });
});

router.get('/user/add', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchGroups(function(groups) {
        res.render('user/add', { groups: groups });
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
        adminGroups: req.body.admingroups
    }, req.user,  function(err) {
        if (err) {
            req.flash('error', 'Error: ' + err);
            ldaphelper.fetchGroups( function(groups) {
              res.render('user/add', {message: req.flash('error'), groups:groups, user: {
                givenName: req.body.givenName,
                sn: req.body.sn,
                mail: req.body.mail
              }});
            })
        } else {
            if (config.discourse.enabled) {
                discourse.createUser({
                    givenName: req.body.givenName,
                    sn: req.body.sn,
                    userPassword: req.body.userPassword,
                    userPassword2: req.body.userPassword2,
                    mail: req.body.mail,
                    groups: req.body.groups,
                    adminGroups: req.body.admingroups
                }, function(err) {
                    if (err)
                      console.log('Error creating disocurse user: ' + err);
                });
            }
            req.flash('notification', 'Benutzer*in ' + req.body.givenName + ' ' + req.body.sn + ' angelegt');
            res.redirect('/show');
        }
    })
    console.log('givenName:' + req.body.givenName);
    console.log('sn:' + req.body.sn);
    console.log('userPassword:' + req.body.userPassword);
    console.log('mail:' + req.body.mail);
    console.log('groups:' + req.body.groups);
});

router.get('/user/edit/:id', isLoggedInAdmin, function(req, res) {
    console.log('admin: ' + req.user.isAdmin);
    ldaphelper.fetchGroups( function(groups) {
        ldaphelper.fetchObject(req.params.id, function(user) {
            res.render('user/edit', { groups: groups, user:user});
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
        adminGroups: req.body.admingroups
    }, true, function(err) {
        if (err) {
            req.flash('error', 'Error: ' + err);
            ldaphelper.fetchGroups(function(groups) {
              res.render('user/edit', {message: req.flash('error'), groups:groups, user: {
                givenName: req.body.givenName,
                sn: req.body.sn,
                mail: req.body.mail,
                userPassword: req.body.userPassword,
                userPassword2: req.body.userPassword2,
                dn: req.body.dn
              }});
            })
        } else {
            req.flash('notification', 'Benutzer*in ' + req.body.givenName + ' ' + req.body.sn + ' geändert');
            res.redirect('/show');
        }
    })
});

router.get('/user/delete/:id', isLoggedInAdmin, function(req, res) {
    console.log('deleting user ' + req.params.id);
    ldaphelper.deleteUser(req.params.id, function(err) {
        if (err) {
            req.flash('error', 'Fehler beim Löschen von ' + req.params.id + ': ' + err);
        }
        req.flash('notification', 'Benutzer*in ' + req.params.id + ' gelöscht');        
        res.redirect('/show');
    });
});

router.get('/group/edit/:id', isLoggedInAdmin, function(req, res) {
    ldaphelper.fetchObject(req.params.id, function(group) {
        res.render('group/edit', { group:group});
    });
});

router.get('/group/add', isLoggedInAdmin, function(req, res) {
    res.render('group/add', { });
});

router.post('/group/add', isLoggedInAdmin, function(req, res) {
    ldaphelper.addGroup({
        cn: req.body.cn,
        description: req.body.description
    }, function(err) {
        if (err) {
            req.flash('error', 'Error: ' + err);
              res.render('group/add', {message: req.flash('error'),group: {
                cn: req.body.cn,
                description: req.body.description
              }});
        } else {
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
              res.render('group/edit', {message: req.flash('error'),group: {
                cn: req.body.cn,
                description: req.body.description,
                dn: req.body.dn
              }});
        } else {
            req.flash('notification', 'Gruppe ' + req.body.cn + ' geändert');               
            res.redirect('/show');
        }
    })
    console.log('cn:' + req.body.cn);
    console.log('description:' + req.body.description);
});

router.get('/group/delete/:id', isLoggedInAdmin, function(req, res) {
    console.log('deleting group ' + req.params.id);
    ldaphelper.deleteGroup(req.params.id, function(err) {
        if (err) {
            req.flash('error', 'Fehler beim Löschen von ' + req.params.id + ': ' + err);
        }
        req.flash('notification', 'Gruppe ' + req.params.cn + ' gelöscht');           
        res.redirect('/show');
    });
});

module.exports = router;