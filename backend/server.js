const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const path = require('path');
const passport = require('./config/passport');
const session = require('express-session');

dotenv.config();

const app = express();

// 連接數據庫
connectDB();

// Middleware
app.use(express.json());

// 添加靜態文件服務
app.use(express.static(path.join(__dirname, 'public')));

// 設置 session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    resave: false,
    saveUninitialized: false,
  }),
);

// 初始化 Passport
app.use(passport.initialize());
app.use(passport.session());

// 添加社交登入路由
app.use('/api/auth', require('./routes/socialAuthRoutes'));

// Routes
app.use('/api/auth', authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
