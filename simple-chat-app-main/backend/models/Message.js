const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  senderId: String,
  receiverId: String,
  groupId: String,
  text: String,
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Message", messageSchema);
