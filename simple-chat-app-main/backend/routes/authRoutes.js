// authRoutes.js (existing)
const express = require("express");
const { signup, login } = require("../controllers/authController");
const User = require("../models/User");
const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);

// add this:
router.get("/users", async (req,res) => {
  try {
    const users = await User.find({}, { password:0 }); // hide password
    res.json(users);
  } catch(err){ res.status(500).json({ error: "Server error" }); }
});

module.exports = router;
