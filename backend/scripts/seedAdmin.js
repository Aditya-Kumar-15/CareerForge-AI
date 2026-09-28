const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const Student = require('../models/Student');

dotenv.config({ path: '../.env' }); // Look in parent backend dir

const seedAdmin = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal';
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB Connected for Seeding...');

    // Force clear/re-create to update schema with required college attribute
    await Student.deleteOne({ email: 'admin@college.edu' });
    await Student.deleteOne({ rollNo: 'ADMIN01' });

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('adminpassword', salt);

    const admin = new Student({
      name: 'Admin User',
      rollNo: 'ADMIN01',
      email: 'admin@college.edu',
      department: 'Administration',
      year: 4,
      college: 'System Administration',
      phone: '0000000000',
      password: hashedPassword,
      role: 'admin'
    });

    await admin.save();
    console.log('Admin account successfully seeded!');
    console.log('Credentials:');
    console.log('  Email / Roll Number: admin@college.edu or ADMIN01');
    console.log('  Password: adminpassword');
    process.exit(0);
  } catch (error) {
    console.error(`Seeding failed: ${error.message}`);
    process.exit(1);
  }
};

seedAdmin();
