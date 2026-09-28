exports.sendOtpSms = async (phoneNumber, otp) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  const isConfigured = Boolean(accountSid && authToken && fromNumber);

  if (!isConfigured) {
    console.warn(`\n[SMS SERVICE WARNING] Twilio SMS credentials not configured in .env (AccountSID: ${accountSid ? 'present' : 'missing'})`);
    return {
      success: false,
      providerConfigured: false,
      message: 'SMS service provider (Twilio/Gateway) credentials are not configured on the server.'
    };
  }

  try {
    let twilio;
    try {
      twilio = require('twilio');
    } catch (e) {
      return {
        success: false,
        providerConfigured: true,
        error: 'Twilio package is not installed on server.'
      };
    }

    const client = twilio(accountSid, authToken);
    const message = await client.messages.create({
      body: `Your CareerForge AI registration verification OTP code is: ${otp}. Valid for 10 minutes. Do not share.`,
      from: fromNumber,
      to: phoneNumber
    });

    console.log(`[SMS SERVICE SUCCESS] Sent SMS OTP to ${phoneNumber}. Message SID: ${message.sid}`);
    return {
      success: true,
      providerConfigured: true,
      sid: message.sid
    };
  } catch (err) {
    console.error(`[SMS SERVICE ERROR] Failed to send SMS to ${phoneNumber}:`, err.message);
    return {
      success: false,
      providerConfigured: true,
      error: err.message
    };
  }
};
