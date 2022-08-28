require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
const encrypt = require("mongoose-encryption");

// Server setup
const app = express();
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// Connect to MongoDB Atlas
const MONGO_USERNAME = process.env.MONGO_USERNAME || "";
const MONGO_PASSWORD = process.env.MONGO_PASSWORD || "";
const MONGO_URL = `mongodb+srv://${MONGO_USERNAME}:${MONGO_PASSWORD}@cluster0.j4r18xi.mongodb.net/userDB`;

mongoose
  .connect(MONGO_URL, { retryWrites: true, w: "majority" })
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
});

// Encrypt the password field
const secret = process.env.MONGO_SECRET;
userSchema.plugin(encrypt, { secret: secret, encryptedFields: ["password"] });

// Create a mongoose model
const User = mongoose.model("User", userSchema);

// Create a get route
app.get("/", (req, res) => {
  res.render("home");
});

app
  .route("/login")
  .get((req, res) => {
    res.render("login");
  })
  .post((req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    User.findOne({ email: username }, (err, foundUser) => {
      if (err) {
        console.log(err);
      } else {
        if (foundUser) {
          if (foundUser.password === password) {
            console.log(`Successfully logged in: ${username}`);
            res.render("secrets");
          } else {
            console.log("Incorrect password");
            res.send("Incorrect password");
          }
        } else {
          console.log(`User not found: ${username}`);
          res.send("User not found");
        }
      }
    });
  });

app
  .route("/register")
  .get((req, res) => {
    res.render("register");
  })
  //   Test admin account: admin888@gmail.com, password: 88888888
  .post((req, res) => {
    const newUser = new User({
      email: req.body.username,
      password: req.body.password,
    });
    newUser.save((err) => {
      if (err) {
        console.log(err);
      } else {
        console.log(`Successfully added a new user: ${newUser}`);
        res.render("secrets");
      }
    });
  });

// Setup PORT for Heroku and localhost
const PORT = process.env.PORT || 8888;

// Start server
app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
