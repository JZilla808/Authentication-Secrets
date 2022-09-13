require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

// Server setup
const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: false,
  })
);

// Setup Sessions
app.use(passport.initialize());
app.use(passport.session());

// Connect to MongoDB Atlas
const MONGO_URI = process.env.MONGO_HOST || "";

mongoose
  .connect(MONGO_URI, { retryWrites: true, w: "majority" })
  .then(() => {
    console.log("MongoDB Atlas connected");
  })
  .catch((err) => {
    console.log(err);
  });

// Create a mongoose schema
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secret: String,
});

// Add passport-local-mongoose to the schema
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

// Encrypt the password field
// const secret = process.env.MONGO_SECRET;
// userSchema.plugin(encrypt, { secret: secret, encryptedFields: ["password"] });

// Create a mongoose model
const User = mongoose.model("User", userSchema);

// Create a passport-local strategy
passport.use(User.createStrategy());

// Serialize and deserialize the user
passport.serializeUser(function (user, cb) {
  process.nextTick(function () {
    cb(null, { id: user.id, username: user.username, name: user.displayName });
  });
});

passport.deserializeUser(function (user, cb) {
  process.nextTick(function () {
    return cb(null, user);
  });
});

// Create a passport-google strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:8888/auth/google/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);

      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

// Create a passport-facebook strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: "http://localhost:8888/auth/facebook/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);

      User.findOrCreate({ facebookId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

// Create a get route for the home page
app.get("/", (req, res) => {
  res.render("home");
});

// Create a get route for the login page
app
  .route("/login")
  .get((req, res, next) => {
    res.render("login");
  })
  .post(passport.authenticate("local"), (req, res) => {
    const user = new User({
      username: req.body.username,
      password: req.body.password,
    });

    req.login(user, (err) => {
      if (err) {
        console.log(err);
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/secrets");
        });
      }
    });
  });

// Create a route for the register page
app
  .route("/register")
  .get((req, res) => {
    res.render("register");
  })
  .post((req, res) => {
    User.register(
      { username: req.body.username },
      req.body.password,
      (err, user) => {
        if (err) {
          console.log(err);
          res.redirect("/register");
        } else {
          passport.authenticate("local")(req, res, () => {
            res.redirect("/secrets");
          });
        }
      }
    );
  });

// Create a route for Google OAuth 2.0
app
  .route("/auth/google")
  .get(passport.authenticate("google", { scope: ["profile"] }));

// Create a route for OAuth callback
app
  .route("/auth/google/secrets")
  .get(
    passport.authenticate("google", { failureRedirect: "/login" }),
    function (req, res) {
      // Successful authentication, redirect to secrets.
      res.redirect("/secrets");
    }
  );

// Create a route for Facebook OAuth 2.0
app
  .route("/auth/facebook")
  .get(passport.authenticate("facebook", { scope: "public_profile" }));

// Create a route for Facebook OAuth callback
app
  .route("/auth/facebook/secrets")
  .get(
    passport.authenticate("facebook", { failureRedirect: "/login" }),
    function (req, res) {
      // Successful authentication, redirect to secrets.
      res.redirect("/secrets");
    }
  );

// Create a route for the secrets page
app.route("/secrets").get((req, res) => {
  User.find({ secret: { $ne: null } }, (err, foundUsers) => {
    if (err) {
      console.log(err);
    } else {
      if (foundUsers) {
        res.render("secrets", { usersWithSecrets: foundUsers });
      }
    }
  });
});

// Create a route for the submit page
app
  .route("/submit")
  .get((req, res) => {
    res.set(
      "Cache-Control",
      "no-cache, private, no-store, must-revalidate, max-stal  e=0, post-check=0, pre-check=0"
    );

    if (req.isAuthenticated()) {
      res.render("submit");
    } else {
      res.redirect("/login");
    }
  })

  .post((req, res) => {
    const submittedSecret = req.body.secret;
    User.findById(req.user.id, (err, foundUser) => {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          foundUser.secret = submittedSecret;
          foundUser.save((err) => {
            if (err) {
              console.log(err);
            } else {
              res.redirect("/secrets");
            }
          });
        } else {
          console.log("User not found");
        }
      }
    });
  });

// Create a route for the logout page

app.route("/logout").get((req, res) => {
  req.logout((err) => {
    if (err) {
      return err;
    }
  });
  res.redirect("/");
});

// Setup PORT for Heroku and localhost
const PORT = process.env.PORT || 8888;

// Start server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
