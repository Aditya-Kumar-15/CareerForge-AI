const dotenv = require('dotenv');
const aiService = require('../services/aiService');

dotenv.config();

const test = async () => {
  console.log("Testing AI Service integration...");
  
  // Test 1: Resume Analysis
  console.log("\n1. Testing Resume Extraction...");
  const rawText = "John Doe. Web Developer. Skills: Python, React, MongoDB. Projects: Ecommerce system using MERN stack. Certification: AWS Certified.";
  const extraction = await aiService.analyzeResume(rawText);
  console.log("Extracted Data:", JSON.stringify(extraction, null, 2));
  
  // Test 2: Next Question
  console.log("\n2. Testing Next Question Generation...");
  const config = { type: 'Mixed', difficulty: 'Adaptive', questionCount: 10, mode: 'Text' };
  const questionSpec = await aiService.generateNextQuestion(extraction, [], config, 0, 'Technical Skills', 'Easy');
  console.log("Generated Question:", JSON.stringify(questionSpec, null, 2));

  // Test 3: Grade Answer
  console.log("\n3. Testing Answer Evaluation...");
  const evalResult = await aiService.evaluateAnswer(
    questionSpec.questionText,
    questionSpec.topic,
    "Python is a high-level general purpose programming language used extensively in data science and web development.",
    extraction
  );
  console.log("Evaluation Result:", JSON.stringify(evalResult, null, 2));

  // Test 4: Final Report
  console.log("\n4. Testing Final Report Aggregation...");
  const sessionMock = {
    config,
    questions: [
      {
        questionText: questionSpec.questionText,
        category: questionSpec.category,
        difficulty: questionSpec.difficulty,
        topic: questionSpec.topic,
        answerText: "Python is a high-level general purpose programming language.",
        evaluation: evalResult
      }
    ]
  };
  const report = await aiService.generateFinalReport(extraction, sessionMock);
  console.log("Final Report Summary:", JSON.stringify(report, null, 2));

  console.log("\nAI Service Verification finished.");
  process.exit(0);
};

test();
