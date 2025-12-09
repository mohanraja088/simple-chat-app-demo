const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    console.log('No token provided');
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, 'secret123');
    console.log('Token decoded:', decoded);
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log('User not found for token');
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }
    req.user = user;
    next();
  } catch (err) {
    console.log('Token verification failed:', err.message);
    res.status(401).json({ error: 'Invalid token.' });
  }
};

module.exports = authMiddleware;