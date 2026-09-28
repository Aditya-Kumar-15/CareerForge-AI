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
  console.log('=== STARTING DIRECT REGISTRATION TESTS (NO OTP) ===\n');

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal');
  const Student = require('../models/Student');

  // Clean up test user
  await Student.deleteMany({ $or: [{ email: 'direct_user@example.com' }, { rollNo: 'DIRECT-101' }, { phone: '9991112233' }] });

  console.log('1. Testing Direct Signup (POST /api/auth/signup)...');
  const user = {
    name: 'Direct Registration User',
    rollNo: 'DIRECT-101',
    email: 'direct_user@example.com',
    department: 'Computer Science Engineering',
    year: 3,
    college: 'Tech University',
    phone: '9991112233',
    password: 'Password@123'
  };

  const resSignup = await makeRequest('POST', '/api/auth/signup', user);
  console.log(` -> Signup Status: ${resSignup.status}, Message: ${resSignup.body.message}`);

  const dbUser = await Student.findOne({ email: user.email });
  console.log(` -> DB Student Created: ${!!dbUser}`);

  console.log('\n2. Testing Sign-In with Created Account...');
  const resLogin = await makeRequest('POST', '/api/auth/signin', {
    identifier: user.email,
    password: user.password
  });
  console.log(` -> Sign-In Status: ${resLogin.status}, User Name: ${resLogin.body.user ? resLogin.body.user.name : null}`);

  await mongoose.disconnect();
  console.log('\n=== DIRECT REGISTRATION TESTS COMPLETED SUCCESSFULLY ===');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
