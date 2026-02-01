import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL, // Your email
    pass: process.env.EMAIL_PASS, // App password
  },
});

export const sendOTP = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL,
    to: email,
    subject: "Your OTP for Login - E-Commerce",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #333; text-align: center; margin-bottom: 20px;">Login Verification</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">Hello,</p>
          <p style="color: #666; font-size: 16px; line-height: 1.5;">You requested to log in to your account. Please use the following OTP to complete your login:</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h1 style="color: #007bff; font-size: 36px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          
          <p style="color: #666; font-size: 14px; line-height: 1.5;">This OTP is valid for <strong>5 minutes</strong>.</p>
          <p style="color: #666; font-size: 14px; line-height: 1.5;">If you didn't request this OTP, please ignore this email or contact support if you have concerns.</p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px; text-align: center;">This is an automated message, please do not reply.</p>
        </div>
      </div>
    `,
    text: `Your OTP for login is ${otp}. It is valid for 5 minutes. If you didn't request this, please ignore this email.`,
  };

  await transporter.sendMail(mailOptions);
};
