// backend/config/db.js
require('dotenv').config();
const mongoose = require("mongoose");

async function connectDB() {
  try {
    const URI = process.env.MONGO_URI || "mongodb://localhost:27017/simpleChatApp";

    await mongoose.connect(URI); // mongoose v6+ works without extra options

    console.log("MongoDB Connected ✓");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;