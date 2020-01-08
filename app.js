// dependencies
var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
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

var routes = require('./routes/index');


var config    = require('./config/config.json');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
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
app.use('/public', express.static(path.join(__dirname, '/public'),  { maxAge: oneDay }));

app.use(function(req,res,next){
    res.locals.session = req.session;
    res.locals.currentUser = req.user;
    res.locals.config = config;
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
            ldaphelper.getByUID(profile.nameID, function(user, err) {
              if (err) {
                return done(err);
              }
              user.nameID = profile.nameID;
              user.nameIDFormat= profile.nameIDFormat;
              return done(null, user);
            });
        });
    passport.use(global.samlStrategy);    
}

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
    if (user.isAdmin == undefined) {
        ldaphelper.fetchIsAdmin(user.dn, function(isAdmin) {
            console.log('fetched admin status: ' + isAdmin);
            user.isAdmin = isAdmin;
            done(null, user);
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
