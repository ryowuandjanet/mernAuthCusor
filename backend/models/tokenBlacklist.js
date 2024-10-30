const mongoose = require('mongoose');

const tokenBlacklistSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // 24小時後自動刪除
  },
});

module.exports = mongoose.model('TokenBlacklist', tokenBlacklistSchema);
