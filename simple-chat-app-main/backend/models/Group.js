const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  members: [{ type: String }],
  createdBy: String,
  createdAt: { type: String, required: true }
});

module.exports = mongoose.model('Group', groupSchema);