const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

exports.sendVerifyEmail = async (to, link) => {
  await transporter.sendMail({
    from: `"Shift Scheduler" <${process.env.MAIL_FROM}>`,
    to,
    subject: 'Confirm your email',
    html: `
      <h3>Email Confirmation</h3>
      <p>Please click the link below to verify your email:</p>
      <a href="${link}">${link}</a>
    `
  });
};
