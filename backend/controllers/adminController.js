const Student = require('../models/Student');
const LoginHistory = require('../models/LoginHistory');
const Resume = require('../models/Resume');
const Interview = require('../models/Interview');

// Fetch all registered students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await Student.find({}, '-password');
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch full login audit history
exports.getLoginHistory = async (req, res) => {
  try {
    const history = await LoginHistory.find()
      .populate('studentId', 'name rollNo email department')
      .sort({ loginTime: -1 });
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch candidates database with assessment summary & skills
exports.getCandidates = async (req, res) => {
  try {
    const students = await Student.find({ role: 'student' }, '-password');
    const candidates = [];

    for (const student of students) {
      const resume = await Resume.findOne({ studentId: student._id });
      const interviews = await Interview.find({ studentId: student._id, status: 'completed' });
      
      let avgScore = 0;
      let status = 'No Assessment';
      if (interviews.length > 0) {
        const scores = interviews.map(i => i.finalReport.overallScore || 0);
        avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        
        if (avgScore >= 85) status = 'Excellent';
        else if (avgScore >= 75) status = 'Strong';
        else if (avgScore >= 60) status = 'Good';
        else status = 'Needs Improvement';
      }

      candidates.push({
        _id: student._id,
        name: student.name,
        rollNo: student.rollNo,
        email: student.email,
        department: student.department,
        year: student.year,
        college: student.college || 'N/A',
        resumeUploaded: !!resume,
        resumeVerified: resume ? resume.verified : false,
        skills: resume && resume.extractedData ? resume.extractedData.skills : null,
        averageScore: avgScore,
        assessmentStatus: status,
        interviewsCompleted: interviews.length
      });
    }

    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch detailed candidate overview
exports.getCandidateReport = async (req, res) => {
  try {
    const studentId = req.params.id;
    const student = await Student.findById(studentId, '-password');
    if (!student) {
      return res.status(404).json({ message: 'Candidate not found.' });
    }
    const resume = await Resume.findOne({ studentId });
    const interviews = await Interview.find({ studentId, status: 'completed' }).sort({ createdAt: -1 });

    res.json({
      student,
      resume,
      interviews
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

