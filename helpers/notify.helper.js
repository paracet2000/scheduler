const log = require('./log.helper');

let twilioClient;

const getTwilioClient = () => {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  // lazy require to avoid crash if module isn't installed
  // eslint-disable-next-line global-require
  const twilio = require('twilio');
  twilioClient = twilio(sid, token);
  return twilioClient;
};

exports.sendSms = async (to, message) => {
  const from = process.env.TWILIO_FROM;
  if (!to || !from) {
    log.info('SMS skipped (missing to/from)');
    return null;
  }

  const client = getTwilioClient();
  if (!client) {
    log.info('SMS skipped (missing Twilio credentials)');
    return null;
  }

  try {
    const res = await client.messages.create({ to, from, body: message });
    return res;
  } catch (err) {
    log.error('SMS send failed', { message: err.message });
    return null;
  }
};
