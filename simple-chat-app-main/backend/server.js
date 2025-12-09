// server.js
require('dotenv').config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const { nanoid } = require('nanoid');
const connectDB = require("./config/db");

// Routes
const authRoutes = require("./routes/authRoutes");
const messageRoutes = require("./routes/messageRoutes");
const uploadRoutes = require("./routes/uploadRoutes");

// Models
const User = require("./models/User");
const GroupMessage = require("./models/GroupMessage");
const Group = require("./models/Group");
const File = require("./models/File");

const app = express();

/* ---------------------------------------------
   CORS + Private Network Handling (NEW VERSION)
---------------------------------------------- */

// Simple default CORS for development
app.use(cors({ origin: true, credentials: true }));

// Parse JSON requests
app.use(express.json());

// Generic middleware to set CORS + Private Network headers
app.use((req, res, next) => {
  const origin = req.header("Origin") || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Private Network Access support (Chrome)
  if (req.method === "OPTIONS") {
    if (req.headers["access-control-request-private-network"]) {
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    return res.sendStatus(200);
  }

  next();
});

/* ---------------------------------------------
   Connect to MongoDB
---------------------------------------------- */
connectDB();

/* ---------------------------------------------
   API Routes
---------------------------------------------- */

// Auth
app.use("/api/auth", authRoutes);

// Messages
app.use("/api/messages", messageRoutes);

// Uploads
app.use("/api/upload", uploadRoutes);

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const users = await User.find({}, 'name username').lean();
    const contacts = users.map(u => ({
      id: u._id.toString(),
      name: u.name || u.username,
      username: u.username
    })).filter(u => u.name);
    res.json(contacts);
  } catch (err) {
    console.error('GET /api/contacts error', err);
    res.status(500).json({ ok: false, message: 'server error' });
  }
});

// Groups
app.post('/api/groups', async (req, res) => {
  try {
    const { name, members, createdBy } = req.body || {};
    if (!name || !Array.isArray(members)) return res.status(400).json({ ok: false, message: 'name and members[] required' });

    const cleaned = [...new Set(members.map(m => String(m).trim()).filter(Boolean))].slice(0, 10);
    if (cleaned.length === 0) return res.status(400).json({ ok: false, message: 'at least 1 member required' });

    const doc = {
      _id: nanoid(),
      name: String(name).trim(),
      members: cleaned,
      createdBy: createdBy ? String(createdBy) : null,
      createdAt: new Date().toISOString()
    };

    const group = await Group.create(doc);
    res.status(201).json({ ok: true, group });
  } catch (err) {
    console.error('POST /api/groups error', err);
    res.status(500).json({ ok: false, message: 'server error' });
  }
});

app.get('/api/groups', async (req, res) => {
  try {
    const { member } = req.query;
    const q = member ? { members: member } : {};
    const arr = await Group.find(q).sort({ createdAt: -1 }).lean();
    res.json(arr);
  } catch (err) {
    console.error('GET /api/groups error', err);
    res.status(500).json({ ok: false, message: 'server error' });
  }
});

app.delete('/api/groups/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, message: 'id required' });
    const result = await Group.deleteOne({ _id: id });
    if (result.deletedCount === 1) return res.json({ ok: true });
    return res.status(404).json({ ok: false, message: 'group not found' });
  } catch (err) {
    console.error('DELETE /api/groups/:id error', err);
    res.status(500).json({ ok: false, message: 'server error' });
  }
});

// Group messages
app.post('/api/groups/:id/message', async (req, res) => {
  try {
    const id = req.params.id;
    const { from, text, fileId } = req.body || {};
    if (!id || !from) return res.status(400).json({ ok: false, message: 'id,from required' });
    if (!text && !fileId) return res.status(400).json({ ok: false, message: 'text or fileId required' });

    const g = await Group.findOne({ _id: id });
    if (!g) return res.status(404).json({ ok: false, message: 'group not found' });

    const doc = {
      groupId: id,
      from: String(from),
      text: String(text || ''),
      fileId: fileId || null,
      time: new Date().toISOString()
    };

    const msg = await GroupMessage.create(doc);

    // Populate file if exists
    await msg.populate('fileId');
    let result = { _id: msg._id, ...doc };
    if (msg.fileId) {
      result.fileUrl = `/uploads/${msg.fileId.filename}`;
      result.fileName = msg.fileId.originalName;
    }

    res.status(201).json({ ok: true, msg: result });
  } catch (err) {
    console.error('POST /api/groups/:id/message error', err);
    res.status(500).json({ ok: false, message: 'server error' });
  }
});

app.get('/api/groups/:id/messages', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, message: 'id required' });
    const arr = await GroupMessage.find({ groupId: id }).populate('fileId').sort({ time: 1 }).lean();

    // Transform to include fileUrl and fileName
    const transformed = arr.map(msg => {
      let result = { ...msg };
      if (msg.fileId) {
        result.fileUrl = `/uploads/${msg.fileId.filename}`;
        result.fileName = msg.fileId.originalName;
      }
      return result;
    });

    res.json(transformed);
  } catch (err) {
    console.error('GET /api/groups/:id/messages error', err);
    res.status(500).json({ ok: false, message: 'server error' });
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));


/*
⚠️ IMPORTANT:
You wrote this in server.js:

router.get('/group/:groupId', ...)

This MUST be moved into routes/groupRoutes.js
NOT inside server.js.

I’m leaving it here as a reminder:

// router.get("/group/:groupId", async (req, res) => {
//   try {
//     const msgs = await Message.find({ groupId: req.params.groupId }).sort({ timestamp: 1 }).lean();
//     res.json(msgs);
//   } catch (err) {
//     res.status(500).json({ message: "Server error" });
//   }
// });

*/

/* ---------------------------------------------
   Socket.io Server
---------------------------------------------- */
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // Join private chat rooms
  socket.on("joinRoom", ({ room }) => {
    if (room) {
      socket.join(room);
      console.log(`User joined room: ${room}, socket: ${socket.id}`);
    } else {
      console.log(`joinRoom called without room, socket: ${socket.id}`);
    }
  });

  // Handle sending messages
  socket.on("sendMessage", (msg) => {
    console.log(`sendMessage received:`, msg);
    // Frontend provides room name for private chats
    if (msg.room) {
      io.to(msg.room).emit("receiveMessage", msg);
      console.log(`Emitted receiveMessage to room ${msg.room}`);
      return;
    }

    // Private chat → compute room
    if (msg.senderId && msg.receiverId) {
      const room = [msg.senderId, msg.receiverId].sort().join("_");
      io.to(room).emit("receiveMessage", msg);
      console.log(`Computed room ${room}, emitted receiveMessage`);
      return;
    }

    // Default → broadcast everywhere
    io.emit("receiveMessage", msg);
    console.log(`Broadcasted receiveMessage`);
  });

  // Group chat events
  socket.on("join-group", (groupId) => {
    socket.join(groupId);
    console.log(`User joined group: ${groupId}, socket: ${socket.id}`);
  });

  socket.on("send-group-message", (msg) => {
    console.log(`send-group-message received:`, msg);
    io.to(msg.groupId).emit("new-group-message", msg);
    console.log(`Emitted new-group-message to group ${msg.groupId}`);
  });

  socket.on("group-created", (group) => {
    socket.broadcast.emit("group-created", group);
    console.log(`Broadcasted group-created (excluding sender):`, group);
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
  });
});

/* ---------------------------------------------
    Start Server
---------------------------------------------- */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
