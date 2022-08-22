// Require dotenv as early as possible
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const findOrCreate = require("mongoose-findorcreate");


const app = express();
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

// Use session after express, body-parser group and before mongoose connection
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

/////////////// Run main function and catch error, run async function for mongoose /////////////////
main().catch(err => console.log(err));
async function main() {
  // For local server
  await mongoose.connect('mongodb://localhost:27017/userDB');
// Issue with database not receiving user data after google auth
// Place code between mongoose connection and schema, solution:
  mongoose.set('strictQuery', false);
  // Create schema
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    facebookId: String
});
// add plugin to a mongoose schema just underneath the schema
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);
// Create schema model
const User = new mongoose.model("User", userSchema);

// Passport local configurations
passport.use(User.createStrategy());
// used for local auth, 
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// oauth serializer and deserializer
passport.serializeUser(function(user, done){
    done(null, user.id);
});
passport.deserializeUser(function(id, done){
    User.findById(id, function(err, user){
        done(err, user);
    });
});

// Google oauth
passport.use(new GoogleStrategy({
    clientID:process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    // console.log(profile);
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));
// Facebook oauth
passport.use(new FacebookStrategy({
    clientID: process.env.CLIENT_ID_FB,
    clientSecret: process.env.CLIENT_SECRET_FB,
    callbackURL: "http://localhost:3000/auth/facebook/secrets"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.post("/register", function(req, res){
    User.register({username: req.body.username}, req.body.password, function(err, user){
        if(err){
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function(){
                res.redirect("/secrets");
            });
        }
    });
});

// app.post("/login", function(req, res){
//     const user = new User({
//         username: req.body.username,
//         password: req.body.password
//     });
//     req.login(user, function(err){
//         if(err){
//             console.log(err);
//         } else {
//             passport.authenticate("local")(req, res, function() {
//                 res.render("/secrets");
//             });
//         }
//     });
// });
app.post("/login", passport.authenticate("local"), function(req, res){
    res.redirect("/secrets");
});

app.post("/submit", function(req, res){
const submittedSecret = req.body.secret;
// let specificUserId
// passport.serializeUser(function(user, done) {
//     specificUserId = user._id
//     done(null, user._id);
// });
console.log(req.user);
});

////////////////////////////// End async function main ///////////////////////////////////
};


app.get("/", function(req, res){
    res.render("home");
});
// google auth route
app.get("/auth/google", passport.authenticate('google', {scope: ['profile']})
);
// google return route
app.get('/auth/google/secrets', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });
// facebook auth route
app.get('/auth/facebook', passport.authenticate('facebook'));

app.get('/auth/facebook/secrets',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/secrets');
  });


app.get("/login", function(req, res){
    res.render("login");
});

app.get("/register", function(req, res){
    res.render("register");
});

app.get("/secrets", function(req, res){
    // cache control fix for hitting back button after logging out still renders secrets page
    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');
    if(req.isAuthenticated()){
        res.render("secrets");
    } else {
        res.redirect("login");
    }
});

app.get("/submit", function(req, res){
    if(req.isAuthenticated()){
        res.render("submit");
    } else {
        res.redirect("login");
    }
});

app.get("/logout", function(req, res){
    req.logout(function(err){
        if(err){
            return(err);
        } else {
        res.redirect("/");
        }
    });
});


// Local or Heroku port
let port = process.env.PORT || 3000
app.listen(port, ()=>{
console.log("server running on " + port)})