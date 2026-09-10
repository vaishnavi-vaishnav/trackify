const nodemailer = require("nodemailer");

// Create email transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/**
 * Send activation link email to employee
 */
const sendActivationEmail = async (email, employeeId, employeeName, activationLink) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || "noreply@trackify.app",
      to: email,
      subject: "Trackify Account Activation - Action Required",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #333; margin-top: 0;">Welcome to Trackify! 👋</h2>

            <p style="color: #666; font-size: 16px;">Hi <strong>${employeeName}</strong>,</p>

            <p style="color: #666; font-size: 16px;">
              Your Trackify account has been created. To get started, please activate your account using the link below.
            </p>

            <div style="margin: 30px 0; text-align: center;">
              <a href="${activationLink}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Activate Account
              </a>
            </div>

            <div style="background-color: #fff3cd; padding: 15px; border-left: 4px solid #ffc107; margin: 20px 0;">
              <p style="margin: 0; color: #856404;">
                <strong>Employee ID:</strong> ${employeeId}<br>
                <strong>Note:</strong> This link expires in 24 hours
              </p>
            </div>

            <p style="color: #999; font-size: 14px; margin-top: 20px;">
              Or copy and paste this link in your browser:
              <br>
              <code style="background-color: #f1f1f1; padding: 5px; display: block; margin-top: 5px; word-break: break-all;">
                ${activationLink}
              </code>
            </p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="color: #999; font-size: 12px;">
              If you didn't request this, please ignore this email or contact support.
            </p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Activation email sent:", info.response);
    return { success: true, message: "Activation email sent successfully" };
  } catch (error) {
    console.error("❌ Error sending email:", error.message);
    throw new Error(`Failed to send activation email: ${error.message}`);
  }
};

module.exports = {
  sendActivationEmail,
};
