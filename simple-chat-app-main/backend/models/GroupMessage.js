const mongoose = require('mongoose');

const groupMessageSchema = new mongoose.Schema({
  groupId: { type: String, required: true },
  from: { type: String, required: true },
  text: { type: String, required: true },
  fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'File' },
  time: { type: String, required: true }
});

module.exports = mongoose.model('GroupMessage', groupMessageSchema);