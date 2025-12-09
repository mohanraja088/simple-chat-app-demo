// backend/controllers/messageController.js
const Message = require('../models/Message'); // ensure your Message model exists
const User = require('../models/User'); // to populate senderName optionally (if you want)

exports.sendMessage = async (req, res) => {
  try {
    const { senderId, receiverId, groupId, text, fileId } = req.body;
    console.log('sendMessage called with:', { senderId, receiverId, groupId, text, fileId });
    if (!senderId) return res.status(400).json({ message: 'senderId required' });

    const msg = new Message({
      senderId,
      receiverId: receiverId || null,
      groupId: groupId || null,
      text: text || null,
      fileId: fileId || null,
      timestamp: new Date()
    });

    const saved = await msg.save();
    console.log('Message saved to DB:', saved._id, saved.text);

    // Populate file if exists
    await saved.populate('fileId');
    let result = saved.toObject();
    if (saved.fileId) {
      result.fileUrl = `/uploads/${saved.fileId.filename}`;
      result.fileName = saved.fileId.originalName;
    }

    // Optionally add senderName to returned object
    try {
      const user = await User.findById(saved.senderId).lean();
      if (user) result.senderName = user.name;
    } catch (e) { /* ignore */ }

    console.log('sendMessage response:', result._id);
    res.status(201).json(result);
  } catch (err) {
    console.error('sendMessage error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getPrivateMessages = async (req, res) => {
  try {
    const { from, to } = req.params; // earlier route used /messages/:myId/:otherId
    const myId = from || req.params.myId;
    const otherId = to || req.params.otherId;
    console.log('getPrivateMessages called with myId:', myId, 'otherId:', otherId);

    if (!myId || !otherId) return res.status(400).json([]);

    const msgs = await Message.find({
      $or: [
        { senderId: myId, receiverId: otherId },
        { senderId: otherId, receiverId: myId }
      ]
    }).populate('fileId').sort({ timestamp: 1 }).lean();
    console.log('Retrieved messages count:', msgs.length);

    // Transform to include fileUrl and fileName
    const transformed = msgs.map(msg => {
      let result = { ...msg };
      if (msg.fileId) {
        result.fileUrl = `/uploads/${msg.fileId.filename}`;
        result.fileName = msg.fileId.originalName;
      }
      return result;
    });

    console.log('getPrivateMessages response count:', transformed.length);
    res.json(transformed);
  } catch (err) {
    console.error('getPrivateMessages error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

