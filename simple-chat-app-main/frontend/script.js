/* ============================================================
   FRONTEND MAIN SCRIPT (signup/login + chat + groups + upload)
   UPDATED + FIXED VERSION (Full File)
   WITH addMemberToGroupPrompt() + BUTTON BINDING
============================================================ */
if (window.location.protocol === 'file:') {
  alert('This app requires the backend server. Please run "cd simple-chat-app-main/backend && npm start" and access at http://localhost:5000/chat.html');
}

/* ---------------------------
   CONFIG
---------------------------- */
const API = "http://localhost:5000/api"; // backend base (includes /api)

/* ============================================================
   SAFE TEXT SETTER
============================================================ */
function setTextIfExists(id, text, color) {
  const el = document.getElementById(id);
  if (!el) return false;
  if (color) el.style.color = color;
  el.innerText = text;
  return true;
}

/* ============================================================
   AUTH FUNCTIONS (SIGNUP + LOGIN)
============================================================ */

async function signup() {
  const nameEl = document.getElementById("su_name");
  const emailEl = document.getElementById("su_email");
  const passEl = document.getElementById("su_password");

  const name = nameEl ? nameEl.value.trim() : "";
  const email = emailEl ? emailEl.value.trim() : "";
  const password = passEl ? passEl.value : "";

  if (!name || !email || !password) {
    setTextIfExists('signupMsg', 'Please fill all fields', '#c44');
    return;
  }

  try {
    const res = await fetch(`${API}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password })
    });

    const data = await (res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text());

    if (!res.ok) {
      const errMsg = (data && data.message) ? data.message : (typeof data === 'string' ? data : 'Signup failed');
      setTextIfExists('signupMsg', errMsg, '#c44');
      return;
    }

    setTextIfExists('signupMsg', 'Account created! Redirecting...', 'green');

    const user = data.user || (data && data._id ? data : null);
    if (user) sessionStorage.setItem('chat_user', JSON.stringify(user));

    setTimeout(() => { window.location.href = 'login.html'; }, 900);
  } catch (err) {
    console.error('signup error', err);
    setTextIfExists('signupMsg', 'Network error. Is backend running?', '#c44');
  }
}

async function login() {
  const emailEl = document.getElementById("li_email");
  const passEl = document.getElementById("li_password");

  const email = emailEl ? emailEl.value.trim() : "";
  const password = passEl ? passEl.value : "";

  if (!email || !password) {
    setTextIfExists('loginMsg', 'Enter email & password', '#c44');
    return;
  }

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await (res.headers.get('content-type')?.includes('application/json') ? res.json() : res.text());

    if (!res.ok) {
      const errMsg = (data && data.message) ? data.message : (typeof data === 'string' ? data : 'Login failed');
      setTextIfExists('loginMsg', errMsg, '#c44');
      return;
    }

    const user = (data && data.user) ? data.user : (data && data._id ? data : null);
    if (user) sessionStorage.setItem('chat_user', JSON.stringify(user));
    if (data && data.token) sessionStorage.setItem('chat_token', data.token);

    setTextIfExists('loginMsg', 'Login successful! Redirecting...', 'green');
    setTimeout(() => { window.location.href = 'chat.html'; }, 700);
  } catch (err) {
    console.error('login error', err);
    setTextIfExists('loginMsg', 'Network error. Is backend running?', '#c44');
  }
}

window.signup = signup;
window.login = login;

/* ============================================================
   CHAT + GROUPS + UPLOADS
============================================================ */

let socket = null;
let myself = null;
let currentChat = { type: null, id: null, name: null };
let usersCache = [];
let groupsCache = [];
let unreadCounts = {};

/* Ensure user exists or redirect */
function ensureUser() {
  const s = sessionStorage.getItem("chat_user");
  if (s) {
    try { myself = JSON.parse(s); } catch (e) { myself = null; }
  }
  if (!myself) {
    window.location.href = "login.html";
    return false;
  }

  setTextIfExists("profileName", myself.name || '');
  setTextIfExists("profileEmail", myself.email || '');

  const avatar = document.getElementById("myAvatar");
  if (avatar && myself.name) avatar.innerText = myself.name.charAt(0).toUpperCase();

  return true;
}

/* On DOM Ready */
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', login);

  const signupBtn = document.getElementById('signupBtn');
  if (signupBtn) signupBtn.addEventListener('click', signup);

  const path = window.location.pathname || '';
  if (path.includes('chat.html')) {
    const ok = ensureUser();
    if (!ok) return;
    bindUi();
    initSocket();
    loadUsers();
    loadGroups();
  }
});

/* ============================================================
   BIND ALL CHAT UI BUTTONS
============================================================ */
function bindUi() {
  const sendBtn = document.getElementById("sendBtn");
  if (sendBtn) sendBtn.addEventListener("click", sendMessage);

  const msgInput = document.getElementById("msg");
  if (msgInput) msgInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  const addContactBtn = document.getElementById("addContactBtn");
  if (addContactBtn) addContactBtn.addEventListener("click", addContactPrompt);

  const addGroupBtn = document.getElementById("addGroupBtn");
  if (addGroupBtn) addGroupBtn.addEventListener("click", showGroupModal);

  const createGroupBtn = document.getElementById("createGroupBtn");
  if (createGroupBtn) createGroupBtn.addEventListener("click", createGroup);

  const cancelGroupBtn = document.getElementById("cancelGroupBtn");
  if (cancelGroupBtn) cancelGroupBtn.addEventListener("click", hideGroupModal);

  const userSearch = document.getElementById("userSearch");
  if (userSearch) userSearch.addEventListener("input", filterUserList);

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", () => {
    if (socket) socket.emit('userOffline', { userId: myself._id });
    sessionStorage.clear();
    location.href = 'login.html';
  });

  const attachBtn = document.getElementById("attachBtn");
  if (attachBtn) attachBtn.addEventListener("click", () => {
    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.click();
  });

  const fileInput = document.getElementById("fileInput");
  if (fileInput) fileInput.addEventListener("change", uploadFileAndSend);

  const fileSendBtn = document.getElementById("fileSendBtn");
  if (fileSendBtn) fileSendBtn.addEventListener("click", uploadFileAndSend);

  /* Invite Button */
  const inviteBtn = document.getElementById("inviteBtn");
  if (inviteBtn) inviteBtn.addEventListener("click", inviteFriend);
}

/* ============================================================
   ADD MEMBER TO GROUP
============================================================ */

/* ============================================================
   SOCKET.IO INIT
============================================================ */
function initSocket() {
  try {
    if (typeof io === 'function') {
      socket = io("http://localhost:5000");

      socket.on("connect", () => {
        console.log("socket connected", socket.id);
        socket.emit('userOnline', { userId: myself._id });
      });

      socket.on("receiveMessage", (msg) => {
        console.log("receiveMessage received:", msg);
        if (currentChat.type === "private" && msg.senderId === currentChat.id) {
          console.log("Appending incoming private message to UI");
          appendMessageToUI(msg, true);
        } else if (msg.senderId !== myself._id) {
          console.log("Incrementing unread for", msg.senderId);
          // New message from someone else
          unreadCounts[msg.senderId] = (unreadCounts[msg.senderId] || 0) + 1;
          updateContactHighlight(msg.senderId);
        } else {
          console.log("Ignoring own message or not current chat");
        }
      });

      socket.on("new-group-message", (msg) => {
        console.log("new-group-message received:", msg);
        if (msg.from === myself._id) {
          console.log("Ignoring own group message");
          return;
        }
        if (currentChat.type === "group" && msg.groupId === currentChat.id) {
          console.log("Appending incoming group message to UI");
          appendMessageToUI(msg, true);
        } else {
          console.log("Ignoring group message, not current group");
        }
      });

      socket.on("group-created", (group) => {
        console.log("group-created received:", group);
        if (group.members.includes(myself._id)) {
          console.log("Adding group to cache from socket event:", group._id);
          groupsCache.push(group);
          renderGroupsList(groupsCache);
        }
      });

      socket.on("disconnect", () => console.log("socket disconnected"));
    } else {
      console.error("Socket.IO not loaded");
    }
  } catch (err) {
    console.error("Socket init failed", err);
  }
}

/* ============================================================
   LOAD USERS
============================================================ */
async function loadUsers() {
  try {
    const res = await fetch(`${API}/contacts`);
    if (res.ok) {
      const contacts = await res.json();
      usersCache = contacts.map(u => ({ _id: u.id, name: u.name, email: u.username }));
      usersCache = usersCache.filter((u) => u._id !== myself._id);
      renderUsersList(usersCache);
      return;
    }
  } catch (err) {
    console.warn('loadUsers failed', err);
  }

  usersCache = [{ _id: "demo1", name: "Demo", email: "demo@local" }];
  renderUsersList(usersCache);
}

/* ============================================================
    LOAD GROUPS
=========================================================== */
async function loadGroups() {
  try {
    const res = await fetch(`${API}/groups?member=${myself._id}`);
    if (res.ok) {
      groupsCache = await res.json();
      renderGroupsList(groupsCache);
      return;
    }
  } catch (err) {
    console.warn('loadGroups failed', err);
  }

  groupsCache = [];
  renderGroupsList(groupsCache);
}

function renderUsersList(users) {
  const list = document.getElementById("contactsList");
  if (!list) return;
  list.innerHTML = "";
  users.forEach((u) => {
    const item = document.createElement("div");
    item.className = "item";
    item.dataset.id = u._id;

    const unread = unreadCounts[u._id] || 0;
    const badge = unread > 0 ? `<span class="unread-badge">${unread}</span>` : '';

    item.innerHTML = `
      <div class="user-avatar">${u.name.charAt(0)}</div>
      <div class="meta">
        <div class="name">${u.name}${badge}</div>
        <div class="sub">${u.email || ""}</div>
      </div>
    `;

    if (unread > 0) item.classList.add("has-unread");

    item.addEventListener("click", () => openChatWith(u, item));
    list.appendChild(item);
  });
}

function renderGroupsList(groups) {
  const list = document.getElementById("groupsList");
  if (!list) return;
  list.innerHTML = "";
  groups.forEach((g) => {
    const item = document.createElement("div");
    item.className = "item";
    item.dataset.id = g._id;

    item.innerHTML = `
      <div class="user-avatar">👥</div>
      <div class="meta">
        <div class="name">${g.name}</div>
        <div class="sub">${g.members.length} members</div>
      </div>
    `;

    item.addEventListener("click", () => openGroupChat(g, item));
    list.appendChild(item);
  });
}

function filterUserList(e) {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll(".items-list .item").forEach((it) => {
    it.style.display = it.innerText.toLowerCase().includes(q) ? "" : "none";
  });
}

function updateContactHighlight(userId) {
  const item = document.querySelector(`.items-list .item[data-id="${userId}"]`);
  if (!item) return;

  const unread = unreadCounts[userId] || 0;
  const badge = item.querySelector('.unread-badge');
  if (unread > 0) {
    if (!badge) {
      const nameEl = item.querySelector('.name');
      if (nameEl) {
        const span = document.createElement('span');
        span.className = 'unread-badge';
        span.textContent = unread;
        nameEl.appendChild(span);
      }
    } else {
      badge.textContent = unread;
    }
    item.classList.add('has-unread');
  } else {
    if (badge) badge.remove();
    item.classList.remove('has-unread');
  }
}

/* ============================================================
   GROUPS
============================================================ */


/* ============================================================
   CREATE GROUP
============================================================ */

/* ============================================================
   OPEN PRIVATE CHAT
============================================================ */
function openChatWith(userObj, itemNode) {
  setTextIfExists("chatTitle", userObj.name);
  setTextIfExists("chatSubtitle", userObj.email);

  const chatAvatar = document.getElementById("chatAvatar");
  if (chatAvatar) chatAvatar.innerText = userObj.name.charAt(0).toUpperCase();

  currentChat = { type: "private", id: userObj._id, name: userObj.name };

  // Reset unread count
  delete unreadCounts[userObj._id];
  updateContactHighlight(userObj._id);

  document.querySelectorAll(".items-list .item").forEach((c) => c.classList.remove("active"));
  itemNode.classList.add("active");

  loadChatHistory(myself._id, userObj._id);

  if (socket) {
    const room = [myself._id, userObj._id].sort().join("_");
    console.log("Joining private room:", room);
    socket.emit("joinRoom", { room });
  }
}

/* ============================================================
    OPEN GROUP CHAT
=========================================================== */
function openGroupChat(groupObj, itemNode) {
  setTextIfExists("chatTitle", groupObj.name);
  setTextIfExists("chatSubtitle", `${groupObj.members.length} members`);

  const chatAvatar = document.getElementById("chatAvatar");
  if (chatAvatar) chatAvatar.innerText = "👥";

  currentChat = { type: "group", id: groupObj._id, name: groupObj.name };

  document.querySelectorAll(".items-list .item").forEach((c) => c.classList.remove("active"));
  itemNode.classList.add("active");

  loadGroupHistory(groupObj._id);

  if (socket) {
    console.log("Joining group:", groupObj._id);
    socket.emit("join-group", groupObj._id);
  }
}

/* ============================================================
   OPEN GROUP CHAT
============================================================ */

/* ============================================================
   LOAD PRIVATE CHAT HISTORY
============================================================ */
async function loadChatHistory(myId, otherId) {
  const messagesEl = document.getElementById("messages");
  messagesEl.innerHTML = "<div class='empty-state'>Loading…</div>";

  try {
    const res = await fetch(`${API}/messages/${myId}/${otherId}`);
    const msgs = await res.json();
    messagesEl.innerHTML = "";
    msgs.forEach((m) => appendMessageToUI(m, m.senderId !== myId));
  } catch (e) {
    messagesEl.innerHTML = "<div class='empty-state'>Unable to load messages</div>";
  }
}

/* ============================================================
    LOAD GROUP CHAT HISTORY
=========================================================== */
async function loadGroupHistory(groupId) {
  const messagesEl = document.getElementById("messages");
  messagesEl.innerHTML = "<div class='empty-state'>Loading…</div>";

  try {
    const res = await fetch(`${API}/groups/${groupId}/messages`);
    const msgs = await res.json();
    messagesEl.innerHTML = "";
    msgs.forEach((m) => appendMessageToUI(m, m.from !== myself._id));
  } catch (e) {
    messagesEl.innerHTML = "<div class='empty-state'>Unable to load messages</div>";
  }
}

/* ============================================================
   SEND TEXT MESSAGE
============================================================ */
async function sendMessage() {
  const input = document.getElementById("msg");
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();
  input.value = "";

  if (currentChat.type === "group") {
    const payload = {
      groupId: currentChat.id,
      from: myself._id,
      text
    };

    console.log("Sending group message:", payload);
    appendMessageToUI({ ...payload, from: myself._id, time: new Date().toISOString() }, false);

    try {
      const res = await fetch(`${API}/groups/${currentChat.id}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const saved = await res.json();
      console.log("Group message saved:", saved);

      if (socket && saved) {
        console.log("Emitting send-group-message:", saved.msg);
        socket.emit("send-group-message", saved.msg);
      }
    } catch (error) {
      console.error("Send group failed", error);
    }
  } else {
    const payload = {
      senderId: myself._id,
      receiverId: currentChat.id,
      text
    };

    console.log("Sending private message:", payload);
    appendMessageToUI({ ...payload, timestamp: Date.now() }, false);

    try {
      const res = await fetch(`${API}/messages/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const saved = await res.json();
      console.log("Private message saved:", saved);

      if (socket && saved) {
        saved.room = [saved.senderId, saved.receiverId].sort().join("_");
        console.log("Emitting sendMessage with room:", saved.room, saved);
        socket.emit("sendMessage", saved);
      }
    } catch (error) {
      console.error("Send failed", error);
    }
  }
}

/* ============================================================
   APPEND MESSAGE TO UI
============================================================ */
function appendMessageToUI(msg, incoming = true) {
  const container = document.getElementById("messages");
  if (!container) return;

  if (container.querySelector(".empty-state")) container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "msg " + (incoming ? "incoming" : "outgoing");

  if (msg.text) {
    const p = document.createElement("div");
    p.innerText = msg.text;
    wrap.appendChild(p);
  }

  if (msg.fileUrl) {
    const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(msg.fileName || '');
    if (isImage) {
      const img = document.createElement('img');
      img.src = msg.fileUrl.startsWith('/') ? window.location.origin + msg.fileUrl : msg.fileUrl;
      img.style.maxWidth = '200px';
      img.style.maxHeight = '200px';
      img.style.borderRadius = '8px';
      img.style.cursor = 'pointer';
      img.onclick = () => window.open(img.src, '_blank');
      wrap.appendChild(img);
      if (msg.fileName) {
        const nameDiv = document.createElement('div');
        nameDiv.innerText = msg.fileName;
        nameDiv.style.fontSize = '12px';
        nameDiv.style.color = 'var(--muted)';
        nameDiv.style.marginTop = '4px';
        wrap.appendChild(nameDiv);
      }
    } else {
      const a = document.createElement('a');
      a.href = msg.fileUrl.startsWith('/') ? window.location.origin + msg.fileUrl : msg.fileUrl;
      a.target = '_blank';
      a.innerText = msg.fileName || 'Attachment';
      wrap.appendChild(a);
    }
  }

  const time = document.createElement("div");
  time.className = "time";
  time.innerText = new Date(msg.timestamp || Date.now()).toLocaleTimeString();
  wrap.appendChild(time);

  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

/* ============================================================
   ⭐ UPDATED UPLOAD FUNCTION (WITH CAPTION)
============================================================ */
async function uploadFileAndSend() {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0)
    return alert('Choose a file first');

  const f = fileInput.files[0];
  const caption = prompt('Add a caption (optional):') || '';

  const fd = new FormData();
  fd.append('file', f);
  fd.append('uploadedBy', myself._id);

  try {
    const uploadUrl = `${API.replace('/api','')}/api/upload`;
    const resp = await fetch(uploadUrl, { method: 'POST', body: fd });
    const data = await resp.json();

    if (!resp.ok) return alert(data.message || 'Upload failed');

    if (currentChat.type === "group") {
      const payload = {
        from: myself._id,
        text: caption || '',
        fileId: data.fileId
      };

      const r = await fetch(`${API}/groups/${currentChat.id}/message`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });

      const saved = await r.json();

      appendMessageToUI(saved.msg, false);

      if (socket && saved) {
        socket.emit('send-group-message', saved.msg);
      }
    } else {
      const payload = {
        senderId: myself._id,
        receiverId: currentChat.id,
        text: caption || '',
        fileId: data.fileId
      };

      const r = await fetch(`${API}/messages/send`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });

      const saved = await r.json();

      appendMessageToUI(saved, false);

      if (socket && saved) {
        saved.room = [saved.senderId, saved.receiverId].sort().join('_');
        socket.emit('sendMessage', saved);
      }
    }

  } catch (e) {
    console.error(e);
    alert('Upload/send failed');
  } finally {
    if (fileInput) fileInput.value = '';
  }
}

/* ============================================================
   ADD CONTACT
============================================================ */
function addContactPrompt() {
  const name = prompt("Contact name:");
  if (!name) return;
  const id = "c_" + Date.now();
  usersCache.unshift({
    _id: id,
    name,
    email: name.replace(/\s/g, "").toLowerCase() + "@local"
  });
  renderUsersList(usersCache);
}
/* ============================================================
    GROUP MODAL
=========================================================== */
function showGroupModal() {
  const modal = document.getElementById("groupModal");
  const checkboxesDiv = document.getElementById("contactsCheckboxes");
  checkboxesDiv.innerHTML = "<p style='margin: 0 0 10px 0; font-weight: 600; color: var(--muted);'>Select members:</p>";

  usersCache.forEach(user => {
    const div = document.createElement("div");
    div.className = "checkbox-item";
    div.innerHTML = `
      <input type="checkbox" id="user_${user._id}" value="${user._id}">
      <label for="user_${user._id}">${user.name}</label>
    `;
    checkboxesDiv.appendChild(div);
  });

  modal.style.display = "block";
}

function hideGroupModal() {
  const modal = document.getElementById("groupModal");
  modal.style.display = "none";
  document.getElementById("groupName").value = "";
  // Uncheck all
  document.querySelectorAll("#contactsCheckboxes input").forEach(cb => cb.checked = false);
}

async function createGroup() {
  const name = document.getElementById("groupName").value.trim();
  if (!name) return alert("Enter group name");

  const selected = Array.from(document.querySelectorAll("#contactsCheckboxes input:checked")).map(cb => cb.value);
  if (selected.length === 0) return alert("Select at least one member");

  selected.push(myself._id); // include creator

  try {
    const res = await fetch(`${API}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, members: selected, createdBy: myself._id })
    });

    const data = await res.json();
    if (res.ok) {
      console.log("Group created successfully, adding locally:", data.group._id);
      groupsCache.push(data.group);
      renderGroupsList(groupsCache);
      hideGroupModal();
      if (socket) socket.emit("group-created", data.group);
    } else {
      alert(data.message || "Failed to create group");
    }
  } catch (err) {
    console.error("Create group failed", err);
    alert("Error creating group");
  }
}

/* ============================================================
   INVITE FRIEND
============================================================ */
function inviteFriend() {
  if (!myself) return alert("Not signed in!");

  const base = window.location.origin + "/signup.html";
  const inviteToken = encodeURIComponent(myself.email || myself._id);
  const inviteLink = `${base}?ref=${inviteToken}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(inviteLink)
      .then(() => alert("Invite link copied!\nShare it with your friends."))
      .catch(() => prompt("Copy and share this link:", inviteLink));
  } else {
    prompt("Copy and share this link:", inviteLink);
  }
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    if (socket && socket.emit) socket.emit('userOffline', { userId: myself._id });
    sessionStorage.clear();
    window.location.href = 'login.html';
  });
}


/* ============================================================
   END
============================================================ */
