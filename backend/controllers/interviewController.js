const Interview = require('../models/Interview');
const Resume = require('../models/Resume');
const QuestionHistory = require('../models/QuestionHistory');
const aiService = require('../services/aiService');
const { normalizeText, extractConceptKey } = require('../utils/questionDeduplicator');

// Map question index to baseline target category and difficulty
function getQuestionSpec(index, totalCount, configType, difficultyConfig) {
  let category = 'Technical Skills';
  
  if (configType === 'Technical') {
    const techCategories = [
      'Technical Skills',
      'Data Structures',
      'DBMS',
      'Computer Networks',
      'Operating Systems',
      'OOP Principles',
      'Software Engineering',
      'Technologies'
    ];
    category = techCategories[index % techCategories.length];
  } else if (configType === 'Project-based') {
    const projectCategories = [
      'Projects',
      'Project Architecture',
      'Tech Stack Decisions',
      'Database Design',
      'Security & Auth',
      'API Communication',
      'Deployment & Challenges'
    ];
    category = projectCategories[index % projectCategories.length];
  } else {
    // Mixed Mode: Strict 50/50 alternating interleaving
    if (index % 2 === 0) {
      const techList = ['Technical Skills', 'Data Structures', 'DBMS', 'Operating Systems', 'Technologies'];
      category = techList[(Math.floor(index / 2)) % techList.length];
    } else {
      const projList = ['Projects', 'Project Architecture', 'Database Design', 'Security & Auth', 'API Communication'];
      category = projList[(Math.floor(index / 2)) % projList.length];
    }
  }

  // Baseline difficulty determination
  let difficulty = 'Medium';
  if (difficultyConfig === 'Adaptive') {
    if (index === 0 || index === 1) difficulty = 'Easy';
    else if (index >= 2 && index <= 5) difficulty = 'Medium';
    else if (index >= 6 && index <= 8) difficulty = 'Hard';
    else difficulty = 'Expert';
  } else {
    difficulty = difficultyConfig; // Easy, Medium, Hard
  }

  return { category, difficulty };
}

// 1. Setup new Interview Session
exports.setupInterview = async (req, res) => {
  try {
    const { type, difficulty, questionCount, mode } = req.body;

    // Strict Backend Input Validation
    const validTypes = ['Technical', 'Project-based', 'Mixed'];
    const validDifficulties = ['Easy', 'Medium', 'Hard', 'Adaptive'];
    const validCounts = [10, 15, 20];
    const validModes = ['Text', 'Voice'];

    const selectedType = validTypes.includes(type) ? type : 'Mixed';
    const selectedDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'Adaptive';
    const count = validCounts.includes(parseInt(questionCount)) ? parseInt(questionCount) : 10;
    const selectedMode = validModes.includes(mode) ? mode : 'Text';

    // Check resume presence and verification
    const resume = await Resume.findOne({ studentId: req.user.id });
    if (!resume || !resume.verified) {
      return res.status(400).json({ message: 'Please upload and verify your resume before starting an interview.' });
    }

    const projectsFound = resume.extractedData?.projects?.length || 0;
    const skillsFound = Object.values(resume.extractedData?.skills || {}).flat().length;

    console.log(`\n[INTERVIEW INIT]`);
    console.log(`  userId:              ${req.user.id}`);
    console.log(`  resumeId:            ${resume._id}`);
    console.log(`  interviewType:       ${selectedType}`);
    console.log(`  difficulty:          ${selectedDifficulty}`);
    console.log(`  questionCount:       ${count}`);
    console.log(`  projectsFound:       ${projectsFound}`);
    console.log(`  technicalSkillsFound:${skillsFound}`);

    if (selectedType === 'Project-based' && projectsFound === 0) {
      return res.status(400).json({ message: 'No projects were found in your uploaded resume. Please add a project in the Resume Parser or select a Technical interview.' });
    }

    // Archive any existing active sessions as abandoned so they do not pollute statistics
    await Interview.updateMany(
      { studentId: req.user.id, status: 'active' },
      { status: 'abandoned' }
    );

    // Create interview baseline configuration
    const interview = new Interview({
      studentId: req.user.id,
      resumeId: resume._id,
      config: {
        type: selectedType,
        difficulty: selectedDifficulty,
        questionCount: count,
        mode: selectedMode
      },
      status: 'active',
      currentQuestionIndex: 0,
      questions: []
    });

    // Generate specifications for all questions
    const targetSpecs = [];
    for (let i = 0; i < count; i++) {
      targetSpecs.push(getQuestionSpec(i, count, interview.config.type, interview.config.difficulty));
    }

    // Fetch ALL questions previously asked to THIS candidate (from QuestionHistory & Interview models)
    const mongoose = require('mongoose');
    const studentObjId = mongoose.Types.ObjectId.isValid(req.user.id) ? new mongoose.Types.ObjectId(req.user.id) : req.user.id;

    const historyRecords = await QuestionHistory.find({
      $or: [
        { studentId: req.user.id },
        { studentId: studentObjId }
      ]
    }).select('questionText').exec();

    const pastInterviews = await Interview.find({
      $or: [
        { studentId: req.user.id },
        { studentId: studentObjId }
      ]
    }).select('questions.questionText').exec();

    const userHistoryQuestions = [];
    historyRecords.forEach(r => {
      if (r.questionText) userHistoryQuestions.push(r.questionText);
    });
    pastInterviews.forEach(inv => {
      if (inv.questions) {
        inv.questions.forEach(q => {
          if (q.questionText) userHistoryQuestions.push(q.questionText);
        });
      }
    });

    // Fetch questions asked to OTHER accounts to promote cross-account variation
    const otherRecords = await QuestionHistory.find({
      studentId: { $ne: req.user.id, $ne: studentObjId }
    }).select('questionText').limit(300).exec();
    const otherUserQuestions = otherRecords.map(r => r.questionText);

    const previousUserQuestionsCount = userHistoryQuestions.length;

    // Call AI service to generate all unique questions
    console.log(`  questionGenerationStarted: true`);
    const generatedData = await aiService.generateAllQuestions(
      resume.extractedData,
      interview.config,
      targetSpecs,
      userHistoryQuestions,
      otherUserQuestions
    );
    console.log(`  questionGenerationCompleted: true, count: ${generatedData.questions.length}`);

    // Populate questions list
    generatedData.questions.forEach((q, idx) => {
      const spec = targetSpecs[idx];
      interview.questions.push({
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer || q.correctOption || '',
        correctOption: q.correctOption || q.correctAnswer || '',
        category: q.category || spec.category,
        difficulty: q.difficulty || spec.difficulty,
        topic: q.topic || 'General Details',
        answerText: '',
        startTime: idx === 0 ? new Date() : null,
        evaluation: {
          technicalAccuracy: 0,
          relevance: 0,
          depth: 0,
          clarity: 0,
          overallScore: 0,
          feedback: ''
        }
      });
    });

    await interview.save();

    // Immediately record assigned questions into QuestionHistory collection (Requirement #13)
    const historyDocs = interview.questions.map(q => ({
      studentId: req.user.id,
      interviewId: interview._id,
      questionText: q.questionText,
      normalizedText: normalizeText(q.questionText),
      conceptKey: extractConceptKey(q.questionText),
      category: q.category || 'Technical Skills',
      topic: q.topic || 'General Details',
      difficulty: q.difficulty || 'Medium',
      interviewType: interview.config.type || 'Mixed'
    }));

    try {
      await QuestionHistory.insertMany(historyDocs);
    } catch (hErr) {
      console.error('QuestionHistory insertion warning:', hErr.message);
    }

    // Debug logging as specified in Requirement #19
    const debugStats = generatedData.debugStats || {};
    console.log(`\n=================== [DEBUG DEDUPLICATION] ===================`);
    console.log(`Assessment ID:                       ${interview._id}`);
    console.log(`User ID:                             ${req.user.id}`);
    console.log(`Number of previous questions:        ${previousUserQuestionsCount}`);
    console.log(`Number of excluded questions:        ${debugStats.excludedCount !== undefined ? debugStats.excludedCount : previousUserQuestionsCount}`);
    console.log(`Number of newly generated questions: ${interview.questions.length}`);
    console.log(`Number of duplicate questions rejected: ${debugStats.rejectedCount || 0}`);
    console.log(`Final number of unique questions:    ${interview.questions.length}`);
    console.log(`=============================================================\n`);

    const overallDuration = count * 60;

    res.json({
      message: 'Interview session initialized.',
      interviewId: interview._id,
      config: interview.config,
      currentQuestionIndex: 0,
      overallRemainingSeconds: overallDuration,
      questions: interview.questions.map(q => ({
        questionText: q.questionText,
        options: q.options || [],
        category: q.category,
        difficulty: q.difficulty,
        topic: q.topic,
        answerText: ''
      }))
    });
  } catch (err) {
    console.error('Interview Setup Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 2. Get active interview state
exports.getActiveInterview = async (req, res) => {
  try {
    const interview = await Interview.findOne({ studentId: req.user.id, status: 'active' });
    if (!interview) {
      return res.json({ active: false });
    }

    let idx = interview.currentQuestionIndex;
    let q = interview.questions[idx];

    // Initialize startTime for active question if missing
    if (q && !q.startTime) {
      q.startTime = new Date();
      await interview.save();
    }

    // Calculate overall assessment remaining seconds (totalQuestions x 60)
    const overallDuration = (interview.config.questionCount || 10) * 60;
    const overallElapsed = Math.floor((Date.now() - new Date(interview.createdAt).getTime()) / 1000);
    const overallRemainingSeconds = Math.max(0, overallDuration - overallElapsed);

    // If overall time has expired, signal overall timeout
    if (overallRemainingSeconds <= 0) {
      return res.json({
        active: true,
        terminated: true,
        reason: 'overall_timeout',
        interviewId: interview._id
      });
    }

    res.json({
      active: true,
      interviewId: interview._id,
      config: interview.config,
      currentQuestionIndex: idx,
      overallRemainingSeconds,
      questions: interview.questions.map(q => ({
        questionText: q.questionText,
        options: q.options || [],
        category: q.category,
        difficulty: q.difficulty,
        topic: q.topic,
        answerText: q.answerText || ''
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. Save student answer dynamically
exports.saveAnswer = async (req, res) => {
  try {
    const { questionIndex, answerText } = req.body;
    
    if (questionIndex === undefined) {
      return res.status(400).json({ message: 'Missing questionIndex parameter.' });
    }

    const interview = await Interview.findOne({ studentId: req.user.id, status: 'active' });
    if (!interview) {
      return res.status(404).json({ message: 'No active interview session found.' });
    }

    const idx = parseInt(questionIndex);
    if (idx < 0 || idx >= interview.questions.length) {
      return res.status(400).json({ message: 'Invalid question index.' });
    }

    // Save response to DB
    if (answerText !== undefined) {
      interview.questions[idx].answerText = (answerText || '').trim();
    }

    // Update active question pointer & start time
    interview.currentQuestionIndex = idx;
    if (!interview.questions[idx].startTime) {
      interview.questions[idx].startTime = new Date();
    }

    await interview.save();

    // Compute overall remaining time
    const overallDuration = (interview.config.questionCount || 10) * 60;
    const overallElapsed = Math.floor((Date.now() - new Date(interview.createdAt).getTime()) / 1000);
    const overallRemainingSeconds = Math.max(0, overallDuration - overallElapsed);

    res.json({ success: true, overallRemainingSeconds });
  } catch (err) {
    console.error('Save Answer Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 4. Finalize interview, grade all responses, and generate report
exports.finalizeInterview = async (req, res) => {
  try {
    const { lastAnswerText } = req.body;
    const interview = await Interview.findOne({ studentId: req.user.id, status: 'active' });
    if (!interview) {
      return res.status(404).json({ message: 'No active interview session found.' });
    }

    const resume = await Resume.findById(interview.resumeId);
    if (!resume) {
      return res.status(404).json({ message: 'Associated resume details not found.' });
    }

    // Save final response if provided
    if (lastAnswerText !== undefined) {
      const lastIdx = interview.questions.length - 1;
      interview.questions[lastIdx].answerText = (lastAnswerText || '').trim();
    }

    // Grade all answers in parallel and mark correctness
    const evaluationPromises = interview.questions.map(async (q) => {
      const cleanedAns = (q.answerText || '').trim();
      const correctAns = (q.correctAnswer || q.correctOption || '').trim();
      q.isCorrect = aiService.isAnswerCorrect(cleanedAns, correctAns, q.options);

      if (!cleanedAns) {
        q.evaluation = {
          technicalAccuracy: 0,
          relevance: 0,
          depth: 0,
          clarity: 0,
          overallScore: 0,
          feedback: 'No option was selected or the question was left unanswered.'
        };
        return;
      }
      try {
        const evalResult = await aiService.evaluateAnswer(
          q.questionText,
          q.topic,
          q.answerText,
          resume.extractedData,
          correctAns
        );
        q.evaluation = evalResult;
      } catch (err) {
        console.error(`Evaluation error for topic ${q.topic}:`, err);
        q.evaluation = {
          technicalAccuracy: 0,
          relevance: 0,
          depth: 0,
          clarity: 0,
          overallScore: 0,
          feedback: 'Evaluation error occurred during finalization.'
        };
      }
    });

    await Promise.all(evaluationPromises);

    // Call AI service to compile final report
    const finalReport = await aiService.generateFinalReport(
      resume.extractedData,
      interview
    );

    interview.finalReport = finalReport;
    interview.status = 'completed';

    await interview.save();

    res.json({
      success: true,
      interviewId: interview._id,
      message: 'Interview finalized successfully.'
    });
  } catch (err) {
    console.error('Finalize Interview Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// 4. Log tab-switch violations / trigger anti-cheating submits
exports.reportIntegrityWarning = async (req, res) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      { studentId: req.user.id, status: 'active' },
      { $inc: { integrityWarnings: 1 } },
      { new: true }
    );
    if (!interview) {
      return res.status(404).json({ message: 'No active interview session.' });
    }

    // Auto-terminate interview on 3 warnings
    if (interview.integrityWarnings >= 3) {
      interview.status = 'completed';

      // Grade empty text for remainder questions to generate report
      const resume = await Resume.findById(interview.resumeId);
      const remainingCount = interview.config.questionCount - interview.questions.length;
      for (let i = 0; i < remainingCount; i++) {
        interview.questions.push({
          questionText: 'Question skipped due to security breach.',
          category: 'Integrity',
          difficulty: 'Easy',
          topic: 'Security',
          answerText: 'Violation detected.',
          evaluation: { technicalAccuracy: 0, relevance: 0, depth: 0, clarity: 0, overallScore: 0, feedback: 'Breach auto-graded 0.' }
        });
      }

      const finalReport = await aiService.generateFinalReport(
        resume.extractedData,
        interview
      );

      interview.finalReport = finalReport;
      await interview.save();

      return res.json({
        terminated: true,
        warnings: interview.integrityWarnings,
        message: 'Security breach: Interview auto-submitted due to consecutive tab switching.'
      });
    }

    res.json({
      terminated: false,
      warnings: interview.integrityWarnings,
      message: `Integrity warning recorded: focus loss detected. Warning ${interview.integrityWarnings}/3`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. Get student interview history
exports.getInterviewHistory = async (req, res) => {
  try {
    const history = await Interview.find(
      { studentId: req.user.id, status: 'completed' },
      { 'config': 1, 'finalReport.overallScore': 1, 'createdAt': 1 }
    ).sort({ createdAt: -1 });

    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 6. Get detailed report by ID
exports.getInterviewDetails = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview session not found.' });
    }

    // Security: Student can view their own details; Admins can view any details
    if (interview.studentId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access Denied: Cannot view other candidates results.' });
    }

    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 7. Get dashboard summary stats
exports.getDashboardStats = async (req, res) => {
  try {
    const interviews = await Interview.find({ studentId: req.user.id, status: 'completed' });
    const resume = await Resume.findOne({ studentId: req.user.id });

    if (interviews.length === 0) {
      return res.json({
        resumeUploaded: !!resume,
        resumeVerified: resume ? resume.verified : false,
        interviewsCompleted: 0,
        averageScore: 0,
        highestScore: 0,
        questionsAnswered: 0
      });
    }

    const scores = interviews.map(i => i.finalReport.overallScore || 0);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const highestScore = Math.max(...scores);
    const questionsAnswered = interviews.reduce((sum, i) => sum + i.questions.length, 0);


    res.json({
      resumeUploaded: !!resume,
      resumeVerified: resume ? resume.verified : false,
      interviewsCompleted: interviews.length,
      averageScore,
      highestScore,
      questionsAnswered
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
