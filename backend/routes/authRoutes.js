const express = require('express');
const router = express.Router();
const {
  register,
  verifyEmail,
  login,
  logout,
  updateProfile,
  forgotPassword,
  resetPassword,
  resetPasswordToken,
  socialLogin,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/login', login);
router.put('/profile', updateProfile);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/logout', logout);
router.post('/reset-password-token', resetPasswordToken);
router.post('/social-login', socialLogin);

module.exports = router;
