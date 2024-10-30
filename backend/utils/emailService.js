const nodemailer = require('nodemailer');
const { google } = require('googleapis');

// 驗證環境變數
const validateEnvVariables = () => {
  const required = [
    'GMAIL_USER',
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET',
    'GMAIL_REFRESH_TOKEN',
  ];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }
};

// 創建 OAuth2 客戶端
const createOAuth2Client = () => {
  validateEnvVariables();

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground',
  );

  oauth2Client.setCredentials({
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
  });

  return oauth2Client;
};

// 創建郵件傳輸器
const createTransporter = async () => {
  try {
    const oauth2Client = createOAuth2Client();
    const accessToken = await oauth2Client.getAccessToken();

    if (!accessToken.token) {
      throw new Error('Failed to get access token');
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: process.env.GMAIL_USER,
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        refreshToken: process.env.GMAIL_REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });

    // 驗證傳輸器配置
    await transporter.verify();
    console.log('Email transporter verified successfully');
    return transporter;
  } catch (error) {
    console.error('Transporter creation error:', error);
    throw new Error(`Failed to create email transporter: ${error.message}`);
  }
};

const sendResetPasswordEmail = async (email, token) => {
  try {
    const transporter = await createTransporter();

    // 修改為後端 API 端點
    const resetLink = `http://localhost:5000/reset-password.html?token=${token}`;

    const mailOptions = {
      from: `"Authentication System" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '重設密碼請求',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">重設密碼</h2>
          <p>您好，</p>
          <p>您的重設密碼 Token 是：</p>
          <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 16px; margin: 20px 0;">
            <code>${token}</code>
          </div>
          <p>請使用此 token 和新密碼發送 POST 請求到：</p>
          <p>${resetLink}</p>
          <p>請求格式：</p>
          <pre style="background-color: #f5f5f5; padding: 10px;">
{
    "token": "${token}",
    "password": "your_new_password"
}
          </pre>
          <p>此 token 將在1小時後過期。</p>
          <p>如果這不是您的操作，請忽略此郵件。</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Reset password email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Reset password email error:', error);
    throw new Error(`Failed to send reset password email: ${error.message}`);
  }
};

const sendVerificationEmail = async (email, code) => {
  try {
    const transporter = await createTransporter();

    const mailOptions = {
      from: `"Authentication System" <${process.env.GMAIL_USER}>`,
      to: email,
      subject: '電子郵件驗證碼',
      html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">電子郵件驗證</h2>
                    <p>您好，</p>
                    <p>您的驗證碼是：</p>
                    <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; margin: 20px 0;">
                        ${code}
                    </div>
                    <p>此驗證碼將在10分鐘後過期。</p>
                    <p>如果這不是您的操作，請忽略此郵件。</p>
                </div>
            `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};

module.exports = {
  sendVerificationEmail,
  sendResetPasswordEmail,
};
