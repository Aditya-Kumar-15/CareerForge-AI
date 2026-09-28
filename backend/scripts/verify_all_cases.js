const http = require('http');
const mongoose = require('mongoose');

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
  console.log('=== STARTING DUAL OTP VERIFICATION TESTS ===\n');

  // Connect directly to Mongo to check DB state
  dotenv = require('dotenv');
  dotenv.config({ path: __dirname + '/../.env' });
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal');
  const Student = require('../models/Student');
  const PendingVerification = require('../models/PendingVerification');

  // Cleanup test emails/phones before running
  await Student.deleteMany({ $or: [{ email: /test_dual_/ }, { originalEmail: /test_dual_/ }, { rollNo: /TEST-A-/ }, { phone: /987650000/ }] });
  await PendingVerification.deleteMany({ $or: [{ email: /test_dual_/ }, { originalEmail: /test_dual_/ }, { rollNo: /TEST-A-/ }, { phone: /987650000/ }] });

  console.log('1. Testing Request OTP (Valid Registration Data)...');
  const userA = {
    name: 'Dual Test Candidate A',
    rollNo: 'TEST-A-101',
    email: 'test_dual_a@example.com',
    department: 'Computer Science',
    year: 3,
    college: 'Engineering Institute',
    phone: '9876500001',
    password: 'Password@123'
  };

  const reqA = await makeRequest('POST', '/api/auth/signup/request-otp', userA);
  console.log(` -> Status: ${reqA.status}`, reqA.body.message);
  if (reqA.status !== 200) throw new Error('Request OTP failed');
  const tokenA = reqA.body.verificationToken;

  console.log('\n2. Testing Wrong Email OTP + Correct Mobile OTP -> Account NOT created...');
  const res2 = await makeRequest('POST', '/api/auth/signup/verify-otp', {
    verificationToken: tokenA,
    emailOtp: '000000',
    mobileOtp: '654321'
  });
  console.log(` -> Status: ${res2.status}, Message: ${res2.body.message}`);
  const dbUser2 = await Student.findOne({ email: userA.email });
  console.log(` -> DB Student Exists: ${!!dbUser2} (Expected: false)`);

  console.log('\n3. Testing Correct Email OTP + Wrong Mobile OTP -> Account NOT created...');
  const res3 = await makeRequest('POST', '/api/auth/signup/verify-otp', {
    verificationToken: tokenA,
    emailOtp: '654321',
    mobileOtp: '000000'
  });
  console.log(` -> Status: ${res3.status}, Message: ${res3.body.message}`);
  const dbUser3 = await Student.findOne({ email: userA.email });
  console.log(` -> DB Student Exists: ${!!dbUser3} (Expected: false)`);

  console.log('\n4. Testing Both OTPs Wrong -> Account NOT created...');
  const res4 = await makeRequest('POST', '/api/auth/signup/verify-otp', {
    verificationToken: tokenA,
    emailOtp: '111111',
    mobileOtp: '222222'
  });
  console.log(` -> Status: ${res4.status}, Message: ${res4.body.message}`);
  const dbUser4 = await Student.findOne({ email: userA.email });
  console.log(` -> DB Student Exists: ${!!dbUser4} (Expected: false)`);

  console.log('\n5. Testing Correct Email OTP + Correct Mobile OTP -> Account Created Successfully...');
  const res5 = await makeRequest('POST', '/api/auth/signup/verify-otp', {
    verificationToken: tokenA,
    emailOtp: '654321',
    mobileOtp: '654321'
  });
  console.log(` -> Status: ${res5.status}, Message: ${res5.body.message}`);
  const dbUser5 = await Student.findOne({ email: userA.email });
  console.log(` -> DB Student Created: ${!!dbUser5}`);
  if (dbUser5) {
    console.log(`    isEmailVerified: ${dbUser5.isEmailVerified}, isPhoneVerified: ${dbUser5.isPhoneVerified}`);
  }

  console.log('\n6. Testing Duplicate Registration Prevention (Email & Mobile)...');
  const reqDupEmail = await makeRequest('POST', '/api/auth/signup/request-otp', {
    ...userA,
    rollNo: 'TEST-A-102',
    phone: '9876500002'
  });
  console.log(` -> Duplicate Email Attempt Status: ${reqDupEmail.status}, Message: ${reqDupEmail.body.message}`);

  const reqDupPhone = await makeRequest('POST', '/api/auth/signup/request-otp', {
    ...userA,
    email: 'test_dual_b@example.com',
    rollNo: 'TEST-A-103'
  });
  console.log(` -> Duplicate Mobile Attempt Status: ${reqDupPhone.status}, Message: ${reqDupPhone.body.message}`);

  console.log('\n7. Testing Sign-In with Verified Account...');
  const resLogin = await makeRequest('POST', '/api/auth/signin', {
    identifier: userA.email,
    password: userA.password
  });
  console.log(` -> Sign-In Status: ${resLogin.status}, Success User: ${resLogin.body.user ? resLogin.body.user.name : null}`);

  console.log('\n8. Testing Unregistered / Unverified Email Sign-In...');
  const resUnverifiedLogin = await makeRequest('POST', '/api/auth/signin', {
    identifier: 'unregistered_dual_user@example.com',
    password: 'Password@123'
  });
  console.log(` -> Unregistered Sign-In Status: ${resUnverifiedLogin.status}, Message: ${resUnverifiedLogin.body.message}`);

  await mongoose.disconnect();
  console.log('\n=== ALL DUAL OTP VERIFICATION TESTS COMPLETED ===');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
