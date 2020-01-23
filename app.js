// dependencies
var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var LdapStrategy = require('passport-ldapauth');
var flash    = require('connect-flash');
var http = require('http');
var ldaphelper = require('./utils/ldaphelper');
var multer = require('multer');
var SamlStrategy = require('passport-saml').Strategy;
var Promise = require("bluebird");
var routes = require('./routes/index');
var moment = require('moment');


var config    = require('./config/config.json');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use('/favicon.ico', express.static('public/img/favicon.png'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(require('express-session')({
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

app.use(multer({dest:'./upload/'}).single('logo'));

app.enable('trust proxy');

var oneDay = 86400000;
app.use('/public', express.static(path.join(__dirname, '/public'),  { maxAge: oneDay,
        setHeaders: (res) => {
            if (config.settings.general.modules.includes('discourse')) {
                res.setHeader('Access-Control-Allow-Origin', 'https://' + config.discourse.subdomain + '.' + config.settings.general.domain);
            }            
        } }));

app.use(function(req,res,next){
    res.locals.session = req.session;
    if (req.user) {
        res.locals.currentUser = req.user;    
        res.locals.currentUser.loggedIn = true;
    } else {
        res.locals.currentUser = { loggedIn: false};
    }
    res.locals.baseUrl = req.protocol+"://"+req.headers.host;
    res.locals.config = config;
    res.locals.moment = moment;
    next();
});

app.use('/', routes);

// passport config
passport.use(new LdapStrategy(config.ldap));

if (config.saml.enabled) {
    global.samlStrategy = new SamlStrategy(config.saml.parameters, 
        function(profile, done) {
            if (config.debug) {
                console.log("DEBUG: SAML profile: " + JSON.stringify(profile));
            }
            ldaphelper.getByUID(profile.nameID)
                .then((user) => {
                    user.nameID = profile.nameID;
                    user.nameIDFormat= profile.nameIDFormat;
                    done(null, user);
                })
                .catch((error) => {
                    done(error)
                });
        });
    passport.use(global.samlStrategy);    
}

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
    if (user.isAdmin == undefined) {
        ldaphelper.fetchIsAdmin(user.dn)
            .then((isAdmin) => {
                user.isAdmin = isAdmin;
                ldaphelper.fetchOwnedGroups(user)
                    .then((groups) => {
                        user.ownedGroups = groups.owner.map((group) => { return group.dn;});
                        user.memberGroups = groups.owner.map((group) => { return group.cn;});  
                        if (user.isAdmin  || groups.owner.length > 0) {
                            user.isGroupAdmin = true;
                        } else {
                            user.isGroupAdmin = false;
                        }
                        done(null, user);
                    })
            })
            .catch((error) => {
                done(error);
            });
    } else {
        done(null, user);
    }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    res.status(err.status || 404);
    res.render('error', {
        message: err.message,
        error: err
    });
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});



module.exports = app;

console.log("starting http server on: 8090");
var httpServer = http.createServer(app);
httpServer.listen(8090);
