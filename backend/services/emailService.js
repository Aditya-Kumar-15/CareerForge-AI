const nodemailer = require('nodemailer');

exports.sendOtpEmail = async (toEmail, otp) => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER ? process.env.SMTP_USER.trim() : '';
  const pass = process.env.SMTP_PASS ? process.env.SMTP_PASS.trim() : '';
  const from = process.env.EMAIL_FROM || (user ? `"CareerForge AI" <${user}>` : '"CareerForge AI" <noreply@careerforge.ai>');

  const isConfigured = Boolean(host && user && pass);

  if (!isConfigured) {
    console.warn(`\n[EMAIL SERVICE NOTICE] Gmail SMTP credentials (SMTP_USER, SMTP_PASS) are not configured in backend/.env`);
    return {
      success: false,
      providerConfigured: false,
      message: 'Gmail SMTP credentials (SMTP_USER, SMTP_PASS) are missing in backend/.env. Please configure your Gmail address and Gmail App Password.'
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465, // true for 465, false for 587
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      }
    });

    const mailOptions = {
      from,
      to: toEmail,
      subject: 'CareerForge AI - Email Verification OTP Code',
      html: `
        <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 550px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
          <h2 style="color: #4f46e5; margin-top: 0;">CareerForge AI Account Verification</h2>
          <p style="font-size: 15px; color: #475569;">Hello,</p>
          <p style="font-size: 15px; color: #475569;">Your 6-digit email verification OTP code for your new CareerForge AI account is:</p>
          <div style="font-size: 34px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; margin: 24px 0; background: #f1f5f9; padding: 16px; text-align: center; border-radius: 8px; border: 1px dashed #6366f1;">
            ${otp}
          </div>
          <p style="font-size: 14px; color: #64748b;">This OTP is valid for <strong>5 minutes</strong>. Do not share this code with anyone.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">CareerForge AI Student Portal &bull; Verification System</p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE SUCCESS] Sent OTP to ${toEmail}. Message ID: ${info.messageId}`);
    return {
      success: true,
      providerConfigured: true,
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[EMAIL SERVICE ERROR] Failed to send email to ${toEmail}:`, err.message);
    return {
      success: false,
      providerConfigured: true,
      error: err.message
    };
  }
};
