import nodemailer from 'nodemailer';

// Singleton Secure Transporter (Explicit SSL/TLS encryption for SonarQube / SMTP compliance)
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Uses SSL/TLS
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASS,
  },
  tls: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2',
  },
});

export const sendWelcomeEmail = async (options) => {
  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #4A90E2; text-align: center;">Welcome to TaskFlow!</h2>
      <p>Hello <strong>${options.name}</strong>,</p>
      <p>Your team administrator has created an account for you. Use these initial credentials to log into your workspace profile:</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #4A90E2; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>System Username / Email:</strong> ${options.email}</p>
        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> <code style="background: #eef; padding: 2px 6px; border-radius: 4px;">${options.plainPassword}</code></p>
      </div>

      <p style="color: #e65100; font-weight: bold;">⚠️ Safety First: Please change this password immediately in your account dashboard after logging in.</p>
      <p>Best regards,<br>The TaskFlow Engineering Team</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `Taskflow <${process.env.GMAIL_USER}>`,
      to: options.email,
      subject: 'Welcome to TaskFlow - Your Account Credentials',
      html: htmlMessage,
    });
  } catch (error) {
    console.error('Error in sending Welcome Mail:', error);
    throw new Error('Failed to send welcome email.', { cause: error });
  }
};

export const sendPasswordResetEmail = async (options) => {
  const htmlMessage = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #D32F2F; text-align: center;">Password Reset Request</h2>
      <p>Hello <strong>${options.name}</strong>,</p>
      <p>We received a request to reset the password for your account. Click the button below to choose a new password:</p>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${options.resetUrl}" style="background-color: #D32F2F; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset My Password</a>
      </div>

      <p>If the button doesn't work, copy and paste this link into your browser window:</p>
      <p style="word-break: break-all; color: #555; background: #f5f5f5; padding: 10px; border-radius: 4px;">${options.resetUrl}</p>

      <p style="color: #777; font-size: 13px;">⚠️ Note: This reset link is highly secure and will expire in <strong>10 minutes</strong>. If you did not make this request, please safely ignore this email.</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"TaskFlow Security" <${process.env.GMAIL_USER}>`,
    to: options.email,
    subject: 'TaskFlow Reset Password Link (Expires in 10 mins)',
    html: htmlMessage,
  });
};
