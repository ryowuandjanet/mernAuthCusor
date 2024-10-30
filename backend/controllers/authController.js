const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const {
  sendVerificationEmail,
  sendResetPasswordEmail,
} = require('../utils/emailService');
const crypto = require('crypto');
const TokenBlacklist = require('../models/tokenBlacklist');

// 生成6位數驗證碼
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 註冊
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 驗證輸入
    if (!email || !password || !name) {
      return res.status(400).json({
        message: '所有欄位都是必填的',
      });
    }

    // 檢查用戶是否已存在
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({
        message: '用戶已存在',
      });
    }

    // 生成驗證碼
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    // 加密密碼
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 創建新用戶
    const user = await User.create({
      email,
      password: hashedPassword,
      name,
      verificationCode,
      verificationCodeExpires,
    });

    // 發送驗證郵件
    try {
      await sendVerificationEmail(email, verificationCode);
      console.log('Verification email sent successfully');
    } catch (emailError) {
      // 如果發送郵件失敗，刪除創建的用戶
      await User.findByIdAndDelete(user._id);
      console.error('Email sending failed:', emailError);
      return res.status(500).json({
        message: '註冊失敗 - 無法發送驗證郵件',
        error: emailError.message,
      });
    }

    res.status(201).json({
      message: '註冊成功，請檢查郵箱進行驗證',
      userId: user._id,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: '註冊失敗',
      error: error.message,
    });
  }
};

// 驗證郵箱
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    const user = await User.findOne({
      email,
      verificationCode: code,
      verificationCodeExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: '驗證碼無效或已過期' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpires = undefined;
    await user.save();

    res.json({ message: '郵箱驗證成功' });
  } catch (error) {
    res.status(500).json({ message: '驗證失敗', error: error.message });
  }
};

// 登入
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: '用戶不存在' });
    }

    if (!user.isVerified) {
      return res.status(400).json({ message: '請先驗證郵箱' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '密碼錯誤' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: '30d',
    });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ message: '登入失敗', error: error.message });
  }
};

// 更新個人資料
const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: '用戶不存在' });
    }

    user.name = req.body.name || user.name;
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }

    const updatedUser = await user.save();

    res.json({
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
    });
  } catch (error) {
    res.status(500).json({ message: '更新失敗', error: error.message });
  }
};

// 忘記密碼
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: '找不到此電子郵件地址的用戶',
      });
    }

    // 生成重設密碼 token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // 儲存 token 到資料庫
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1小時後過期
    await user.save();

    // 發送重設密碼郵件
    await sendResetPasswordEmail(email, resetToken);

    res.json({
      message: '重設密碼郵件已發送',
      debug: {
        // 在開發環境中可以顯示 token
        resetToken: resetToken,
      },
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      message: '發送重設密碼郵件失敗',
      error: error.message,
    });
  }
};

// 重設密碼
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        message: '請提供 token 和新密碼',
      });
    }

    console.log('Received token:', token); // 添加日誌

    // 查找具有有效重設密碼 token 的用戶
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      console.log('No user found with valid token'); // 添加日誌
      return res.status(400).json({
        message: '重設密碼連結無效或已過期',
      });
    }

    // 加密新密碼
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // 清除重設密碼的 token 和過期時間
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.json({
      message: '密碼重設成功',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      message: '重設密碼失敗',
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    // 從請求頭獲取 token
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(400).json({
        message: '未提供 token',
      });
    }

    // 將 token 加入黑名單
    await TokenBlacklist.create({ token });

    res.json({
      message: '登出成功',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      message: '登出失敗',
      error: error.message,
    });
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  updateProfile,
  forgotPassword,
  resetPassword,
  logout,
};
