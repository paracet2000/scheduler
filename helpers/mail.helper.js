const nodemailer = require('nodemailer');

// TODO: Switch to Gmail SMTP later (use App Password + verified sender).
const useEthereal = String(process.env.USE_ETHEREAL || '').toLowerCase() === 'true';

const mailConfig = {
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || process.env.MAIL_USER,
    pass: process.env.EMAIL_PASS || process.env.MAIL_PASS
  },
  from: process.env.MAIL_FROM || process.env.EMAIL_USER || process.env.MAIL_USER
};

let transporterPromise;
let etherealAccount;

const getTransporter = async () => {
  if (transporterPromise) return transporterPromise;

  transporterPromise = (async () => {
    if (useEthereal) {
      etherealAccount = await nodemailer.createTestAccount();
      console.log('Ethereal account:', {
        user: etherealAccount.user,
        pass: `***${etherealAccount.pass.slice(-4)} (len:${etherealAccount.pass.length})`,
        smtp: etherealAccount.smtp
      });

      return nodemailer.createTransport({
        host: etherealAccount.smtp.host,
        port: etherealAccount.smtp.port,
        secure: etherealAccount.smtp.secure,
        auth: {
          user: etherealAccount.user,
          pass: etherealAccount.pass
        }
      });
    }

    const maskedPass = mailConfig.auth.pass
      ? `***${mailConfig.auth.pass.slice(-4)} (len:${mailConfig.auth.pass.length})`
      : '';

    console.log('Mail config:', {
      host: mailConfig.host,
      port: mailConfig.port,
      user: mailConfig.auth.user,
      pass: maskedPass,
      from: mailConfig.from
    });

    return nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.port === 465,
      auth: {
        user: mailConfig.auth.user,
        pass: mailConfig.auth.pass
      }
    });
  })();

  return transporterPromise;
};

exports.sendVerifyEmail = async (to, link) => {
  const transporter = await getTransporter();
  const fromAddress = useEthereal && etherealAccount
    ? `"Shift Scheduler" <${etherealAccount.user}>`
    : `"Shift Scheduler" <${mailConfig.from}>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject: 'Confirm your email',
    html: `
      <div style="margin:0;padding:0;background:#f6f8fb;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f6f8fb;padding:32px 0;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background:#ffffff;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,0.08);overflow:hidden;">
                <tr>
                  <td style="background:#0f172a;color:#ffffff;padding:24px 32px;">
                    <div style="font-size:18px;letter-spacing:0.5px;font-weight:600;">Shift Scheduler</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:28px 32px;color:#0f172a;">
                    <h2 style="margin:0 0 12px;font-size:22px;">Confirm your email</h2>
                    <p style="margin:0 0 18px;color:#475569;line-height:1.6;">
                      Thanks for signing up! Please confirm your email address to activate your account.
                    </p>
                    <a href="${link}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600;">
                      Verify Email
                    </a>
                    <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">
                      If the button doesn’t work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:8px 0 0;word-break:break-all;">
                      <a href="${link}" style="color:#2563eb;text-decoration:none;">${link}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#f8fafc;padding:16px 32px;color:#64748b;font-size:12px;">
                    If you didn’t create this account, you can safely ignore this email.
                  </td>
                </tr>
              </table>
              <div style="margin-top:16px;color:#94a3b8;font-size:12px;">© ${new Date().getFullYear()} Shift Scheduler</div>
            </td>
          </tr>
        </table>
      </div>
    `
  });

  if (useEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('Ethereal preview URL:', previewUrl);
  }
};

exports.sendChangeRequestEmail = async (to, subject, html) => {
  const transporter = await getTransporter();
  const fromAddress = useEthereal && etherealAccount
    ? `"Shift Scheduler" <${etherealAccount.user}>`
    : `"Shift Scheduler" <${mailConfig.from}>`;

  const info = await transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    html
  });

  if (useEthereal) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log('Ethereal preview URL:', previewUrl);
  }
};
