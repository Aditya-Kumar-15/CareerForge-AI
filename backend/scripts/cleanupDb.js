const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Interview = require('../models/Interview');

dotenv.config();

const clean = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/college_portal';
  try {
    await mongoose.connect(mongoUri);
    console.log('Database Connected for Cleanup.');

    // Delete all interviews for Aditya so they can start fresh
    const result = await Interview.deleteMany({ studentId: '6a7b337c84056450660a5206' });
    console.log(`Successfully deleted ${result.deletedCount} past interview records.`);

    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
};

clean();
