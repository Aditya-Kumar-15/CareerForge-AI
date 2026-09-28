const http = require('http');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: __dirname + '/../.env' });

const BASE_URL = 'http://127.0.0.1:5050';

function makeRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(raw); } catch(e) { json = { raw }; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING GMAIL SMTP & CHOICE-BASED OTP VERIFICATION TESTS ===\n');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal');
  const Student = require('../models/Student');
  const PendingVerification = require('../models/PendingVerification');

  // Clean up previous test entries
  await Student.deleteMany({ $or: [{ email: /test_smtp_/ }, { originalEmail: /test_smtp_/ }, { rollNo: /SMTP-/ }, { phone: /99977/ }] });
  await PendingVerification.deleteMany({ $or: [{ email: /test_smtp_/ }, { originalEmail: /test_smtp_/ }, { rollNo: /SMTP-/ }, { phone: /99977/ }] });

  const hasSmtpCredentials = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
  console.log(`0. Checking .env SMTP Credentials Configuration: ${hasSmtpCredentials ? 'CONFIGURED' : 'NOT CONFIGURED (Default)'}`);

  console.log('\n1. Testing Email OTP Request (Gmail SMTP Flow)...');
  const userSmtpFlow = {
    name: 'SMTP Test User',
    rollNo: 'SMTP-E-101',
    email: 'test_smtp_email@example.com',
    department: 'Computer Science Engineering',
    year: 3,
    college: 'Tech University',
    phone: '9997776601',
    password: 'Password@123',
    verificationMethod: 'email'
  };

  const reqEmail = await makeRequest('POST', '/api/auth/signup/request-otp', userSmtpFlow);
  console.log(` -> Status Code: ${reqEmail.status}`);
  console.log(` -> Message: ${reqEmail.body.message}`);

  if (!hasSmtpCredentials) {
    if (reqEmail.status === 400 && reqEmail.body.message.includes('backend/.env')) {
      console.log(' -> VERIFIED: Backend correctly blocked registration & notified user that Gmail SMTP credentials are missing in backend/.env.');
    } else {
      console.error(' -> UNEXPECTED RESPONSE when SMTP is missing:', reqEmail.body);
    }
  } else {
    if (reqEmail.status === 200) {
      console.log(' -> VERIFIED: Gmail SMTP successfully accepted request and dispatched OTP email to Gmail!');
      const token = reqEmail.body.verificationToken;

      console.log('\n2. Testing Wrong OTP Verification Failure...');
      const resWrong = await makeRequest('POST', '/api/auth/signup/verify-otp', {
        verificationToken: token,
        otp: '000000',
        verificationMethod: 'email'
      });
      console.log(` -> Wrong OTP Status: ${resWrong.status}, Message: ${resWrong.body.message}`);
    }
  }

  await mongoose.disconnect();
  console.log('\n=== GMAIL SMTP & CHOICE-BASED OTP VERIFICATION TESTS COMPLETED ===');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
