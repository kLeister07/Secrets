require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const findOrCreate = require("mongoose-findorcreate");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
// Use session after express, body-parser group and before mongoose connection
app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

//27017 -> mongodb için default port
// mongoose.connect("mongodb://localhost/userDB", { useUnifiedTopology: true, useNewUrlParser: true });
  // For mongoDB atlas
//   main().catch(err => console.log(err));
// async function main() {
  /*await*/ mongoose.connect(process.env.MONGODB_ATLAS);
// -K: Issue with database not receiving user data after google auth 
// Place code between mongoose connection and schema, solution:
// mongoose.set('strictQuery', false);

// create schema
const userSchema = new mongoose.Schema({
  email: String,
  username: String,
  password: String,
  googleId: {
      type: String,        
      unique:true        
  },
  facebookId: {
      type: String,
      unique: true
  },
  secret: Array
});
// add plugins to a mongoose schema just underneath the schema
// hash and salt our password and to save our users into our mongodb database
userSchema.plugin(passportLocalMongoose);
// 
userSchema.plugin(findOrCreate);
// requires the model with Passport-Local Mongoose plugged in
const User = new mongoose.model("User", userSchema);
// use static serialize and deserialize of model for passport session support
passport.use(User.createStrategy());
// passport local only configurations
/*
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
*/
//works all strategies ie local, google, etc
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

// Google Auth20
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      // callbackURL: "http://localhost:3000/auth/google/secrets",
      callbackURL: "https://kevin-project-secrets.herokuapp.com/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    (accessToken, refreshToken, profile, cb) => {
      // console.log(profile);
      User.findOrCreate({ googleId: profile.id, username:profile.name.givenName}, (err, user) => {
        return cb(err, user);
      });
    }
  )
);

// Facebook Auth
passport.use(new FacebookStrategy({
  clientID: process.env.CLIENT_ID_FB,
  clientSecret: process.env.CLIENT_SECRET_FB,
  // callbackURL: "http://localhost:3000/auth/facebook/secrets"
  callbackURL: "https://kevin-project-secrets.herokuapp.com/auth/facebook/secrets"
},
function(accessToken, refreshToken, profile, cb) {
  // console.log(profile);
  User.findOrCreate({facebookId: profile.id }, (err, user) => {
    return cb(err, user);
  });
}
));



// Google Auth route
app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));
app.get( '/auth/google/secrets', passport.authenticate( 'google', {
  successRedirect: '/secrets',
  failureRedirect: '/login'
}));
// app.get("/auth/google/secrets", passport.authenticate("google", { failureRedirect: "/login" }), (req, res) => {
//   // Successful authentication, redirect secrets.
//   res.redirect("/secrets");
// });

// Facebook Auth route
app.get('/auth/facebook', passport.authenticate('facebook'));
app.get('/auth/facebook/secrets', passport.authenticate('facebook', { 
  successRedirect: '/secrets',
  failureRedirect: '/login'
}));

// app.get("/secrets", (req, res) => {
//   User.find({ secret: { $ne: null } }, (err, foundUsers) => {
//     if (err) {
//       console.log(err);
//     } else {
//       if (foundUsers) {
//         res.render("secrets", { usersWithSecrets: foundUsers });
//       }
//     }
//   });
// });
// Edit to allow multiple secrets and check auth to access /secrets
app.get("/secrets", (req,res)=>{
  User.find({secret:{$ne:null}}, (err, users)=>{
        // cache control fix for hitting back button after logging out still renders secrets page
        res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stal   e=0, post-check=0, pre-check=0');
// req.isAuthenticated used to secure secrets page for users only
        if(req.isAuthenticated()){
    if(!err){
      if (users){
        res.render("secrets",{usersWithSecrets:users});
      } else {
        console.log(err);
      }
    } else {
      console.log(err);
    }
  } else {
    res.redirect("/login");
  }
  });
});

app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", (req, res) => {
  req.logout(function(err){
    if(err){
        return(err);
    } else {
    res.redirect("/");
    }
});
});

app.post("/register", (req, res) => {
  User.register({ username: req.body.username }, req.body.password, (err, user) => {
    if (err) {
      console.log(err);
      res.redirect("/login");
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/secrets");
      });
    }
  });
});

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, (err) => {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local", {failureRedirect: '/login'})(req, res, () => {
        res.redirect("/secrets");
      });
    }
  });
});

// app.post("/submit", (req, res) => {
//   const submittedSecret = req.body.secret;
//   //req.user -> current user
//   User.findById(req.user._id, (err, foundUser) => {
//     if (err) {
//       console.log(err);
//     } else {
//       if (foundUser) {
//         foundUser.secret = submittedSecret;
//         foundUser.save(() => {
//           res.redirect("/secrets");
//         });
//       }
//     }
//   });
// });
// Edit to allow multiple secrets
app.post("/submit",((req, res)=>{
  if(req.isAuthenticated()){
    User.findById(req.user.id, (err, user)=>{
      user.secret.push(req.body.secret);
      user.save(()=>{
        res.redirect("/secrets");
      });
    });
  } else {
   res.redirect("/login");
  }
}));
//////////////////////////////// end async ///////////////////////////////////////////////// 
// };

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/login", (req, res) => {
  res.render("login");
});

// Local or Heroku port
let port = process.env.PORT || 3000
app.listen(port, ()=>{
console.log("server running on " + port)})