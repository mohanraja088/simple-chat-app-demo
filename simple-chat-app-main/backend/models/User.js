const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  name: String,
  email: { type: String, unique: true },
  password: String,
  profilePic: String
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
