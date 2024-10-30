const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const TokenBlacklist = require('../models/tokenBlacklist');

const protect = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: '未授權訪問' });
    }

    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token 已失效，請重新登入' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ message: '用戶不存在' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: '未授權訪問', error: error.message });
  }
};

module.exports = { protect };
