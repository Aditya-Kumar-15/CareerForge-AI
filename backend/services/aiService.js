const { GoogleGenerativeAI } = require("@google/generative-ai");

// Helper to initialize Gemini Client
function getGenAIModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "your_super_secret_jwt_key_change_in_production" || apiKey.startsWith("your_")) {
    console.warn("GEMINI_API_KEY is not configured or uses a placeholder. AI features will run in mock mode.");
    return null;
  }
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  } catch (err) {
    console.error("Failed to initialize Google Generative AI:", err);
    return null;
  }
}

/**
 * Extracts student skills, projects, certifications, and experience from resume text
 */
async function analyzeResume(rawText) {
  const model = getGenAIModel();
  if (!model) {
    return mockAnalyzeResume(rawText);
  }

  const prompt = `You are a professional resume parser. Extract structured details from the following raw resume text.
Your response MUST be a valid JSON object matching this structure:
{
  "skills": {
    "languages": ["string"],
    "frameworks": ["string"],
    "databases": ["string"],
    "technologies": ["string"]
  },
  "projects": [
    {
      "name": "string",
      "description": "string",
      "technologies": ["string"],
      "role": "string",
      "functionality": "string",
      "technicalAreas": ["string"]
    }
  ],
  "certifications": [
    {
      "name": "string",
      "domain": "string"
    }
  ],
  "experience": [
    {
      "company": "string",
      "role": "string",
      "responsibilities": "string",
      "technologies": ["string"]
    }
  ]
}

STRICT ACCURACY RULES:
1. RESUME EVIDENCE -> EXTRACT. NO RESUME EVIDENCE -> RETURN EMPTY ARRAY [].
2. NEVER invent, hallucinate, or assume fake projects, fake certifications, or fake employment experience.
3. DO NOT classify workshops, college activities, leadership roles (e.g., Joint Secretary, Cultural Club, Student Ambassador), or technical events as Work / Internship Experience. Only extract Work Experience if there is an explicit Employment / Internship section in the resume.
4. For Certifications: Extract actual certifications mentioned in the text (e.g., "Fundamentals of Python — Saylor Academy" -> name: "Fundamentals of Python", domain: "Saylor Academy").
5. Return empty arrays [] for missing sections (e.g., if no projects exist in the resume, return "projects": []).

Raw Resume Text:
${rawText}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini Resume Analysis Error:", err);
    return mockAnalyzeResume(rawText);
  }
}

/**
 * Generates a tailored interview question based on history and category target
 */
async function generateNextQuestion(resumeData, history, config, nextIndex, targetCategory, targetDifficulty) {
  const model = getGenAIModel();
  if (!model) {
    return mockGenerateQuestion(resumeData, history, config, nextIndex, targetCategory, targetDifficulty);
  }

  const prompt = `You are a Senior Technical Interviewer. Generate the next interview question for the candidate.
Candidate Verified Resume Info:
${JSON.stringify(resumeData)}

Interview Configuration:
- Type: ${config.type} (Technical, Project-based, or Mixed)
- Difficulty Selection: ${config.difficulty}
- Mode: ${config.mode}

Interview Progress:
- Question Number: ${nextIndex + 1} of ${config.questionCount}
- Target Category for this question: ${targetCategory}
- Target Difficulty for this question: ${targetDifficulty}

Past Questions & Answers History:
${history.map((q, idx) => `
Q${idx + 1}: ${q.questionText} [Category: ${q.category}, Topic: ${q.topic}]
Student Answer: ${q.answerText}
Evaluation: Accuracy=${q.evaluation.technicalAccuracy}/10, Relevance=${q.evaluation.relevance}/10, Depth=${q.evaluation.depth}/10, Clarity=${q.evaluation.clarity}/10. Score=${q.evaluation.overallScore}/10. Feedback=${q.evaluation.feedback}
`).join('\n')}

Instructions:
1. Generate exactly ONE personalized technical question.
2. If Target Category is 'Projects': Base the question on one of the projects listed in the candidate's resume (e.g. asking about architecture, database design, communications, security, or implementation choices).
3. If Target Category is 'Technical Skills': Ask about a programming language, framework, database, or tool mentioned in their skills list.
4. If Target Category is 'Technologies': Focus on Git, REST APIs, or cloud platforms mentioned in their resume.
5. If Target Category is 'Problem Solving': Present a small technical scenario or challenge related to their listed projects or skills.
6. If Target Category is 'Resume/Experience': Ask about their certifications, college coursework, branch knowledge, or work experience responsibilities.
7. Avoid generic questions (e.g. "What is React?"). Instead, make it contextual: "You used React in your Fake News Detection project. How did you manage state...".
8. If the interview is in 'Adaptive' mode: Look at their last answer's evaluation. If they struggled (score <= 5), make the next question slightly more fundamental or simple. If they did exceptionally well (score >= 8), ask a deeper or more advanced follow-up question.
9. Do NOT ask about technologies that aren't mentioned in the resume.
10. Return a JSON object strictly matching this schema:
{
  "questionText": "string",
  "topic": "string",
  "difficulty": "Easy" | "Medium" | "Hard" | "Expert",
  "category": "string"
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini Question Generation Error:", err);
    return mockGenerateQuestion(resumeData, history, config, nextIndex, targetCategory, targetDifficulty);
  }
}

const { isDuplicateQuestion, normalizeText, extractConceptKey } = require('../utils/questionDeduplicator');

/**
 * Generates all N interview questions at once based on spec guidelines
 */
async function generateAllQuestions(resumeData, config, targetSpecs, historyQuestions = [], otherUserQuestions = []) {
  const model = getGenAIModel();
  if (!model) {
    return mockGenerateAllQuestions(resumeData, config, targetSpecs, historyQuestions, otherUserQuestions);
  }

  const prompt = `You are a Senior Technical Interviewer. Generate a list of personalized technical interview questions for the candidate based on their resume profile.
Candidate Verified Resume Info:
${JSON.stringify(resumeData)}

Interview Configuration:
- Type: ${config.type} (Technical, Project-based, or Mixed)
- Difficulty Selection: ${config.difficulty}
- Mode: ${config.mode}
- Number of Questions: ${config.questionCount}

You MUST generate exactly ${config.questionCount} questions. Here are the target specifications for each question (its category and baseline difficulty):
${targetSpecs.map((s, idx) => `Question #${idx+1}: Category = ${s.category}, Target Difficulty = ${s.difficulty}`).join('\n')}

STRICT MODE & PERSONALIZATION REQUIREMENTS:
1. If Type is 'Technical': Generate technical questions based PRIMARILY on technical skills, programming languages, frameworks, databases, and technologies found in candidate's resume (e.g., ${JSON.stringify(resumeData?.skills || {})}). Do NOT generate any project-specific questions when Technical is selected.
2. If Type is 'Project-based': Questions MUST be directly related to candidate's uploaded projects in resume (e.g., ${JSON.stringify(resumeData?.projects || [])}). Ask about project purpose, architecture, technologies used, why a technology was chosen, implementation details, database schema, APIs, authentication, challenges, solutions, testing, deployment, improvements, and design decisions. Do NOT generate generic non-project questions.
3. If Type is 'Mixed': Generate a 50/50 mix of resume-based technical skill questions and candidate project implementation questions.

STRICT DEDUPLICATION REQUIREMENT:
DO NOT generate any question that matches or is conceptually similar to any of these previously asked questions:
${historyQuestions.slice(0, 100).map((q, idx) => `- ${q}`).join('\n')}

Instructions:
1. Generate exactly ${config.questionCount} completely UNIQUE questions.
2. For each question, strictly match the requested Category and Target Difficulty specifications.
3. Avoid generic questions. For each question, provide 4 options labeled A), B), C), D) and specify the correct option in correctAnswer. Vary the position of the correct answer (A, B, C, or D). Return your response strictly as a JSON object matching this schema:
{
  "questions": [
    {
      "questionText": "string",
      "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
      "correctAnswer": "A) option1",
      "topic": "string",
      "difficulty": "Easy" | "Medium" | "Hard" | "Expert",
      "category": "string"
    }
  ]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const parsed = JSON.parse(result.response.text());
    
    // Perform post-generation deduplication check on AI results
    const uniqueQuestions = [];
    const usedSet = new Set(historyQuestions);
    let rejectedCount = 0;

    const basePool = [];
    for (let i = 0; i < targetSpecs.length; i++) basePool.push(i % 4);
    const positionPool = shuffleArray(basePool);

    if (parsed.questions && Array.isArray(parsed.questions)) {
      parsed.questions.forEach((q, idx) => {
        if (!isDuplicateQuestion(q.questionText, Array.from(usedSet))) {
          usedSet.add(q.questionText);
          // If Gemini did not return options, generate mock options for this question
          if (!q.options || q.options.length < 4) {
            const spec = targetSpecs[idx] || { category: 'Technical Skills', difficulty: 'Medium' };
            const fullQ = mockGenerateQuestion(resumeData, [], config, idx, spec.category, spec.difficulty, positionPool[idx % 4], usedSet);
            q.options = fullQ.options;
            q.correctAnswer = fullQ.correctAnswer;
            q.correctOption = fullQ.correctOption;
          }
          uniqueQuestions.push(q);
        } else {
          rejectedCount++;
          const spec = targetSpecs[idx] || { category: 'Technical Skills', difficulty: 'Medium' };
          const rep = mockGenerateQuestion(resumeData, [], config, idx, spec.category, spec.difficulty, positionPool[idx % 4], usedSet);
          usedSet.add(rep.questionText);
          uniqueQuestions.push(rep);
        }
      });
    }

    while (uniqueQuestions.length < targetSpecs.length) {
      const idx = uniqueQuestions.length;
      const spec = targetSpecs[idx] || { category: 'Technical Skills', difficulty: 'Medium' };
      const rep = mockGenerateQuestion(resumeData, [], config, idx, spec.category, spec.difficulty, positionPool[idx % 4], usedSet);
      usedSet.add(rep.questionText);
      uniqueQuestions.push(rep);
    }

    const validatedQuestions = validateAndCleanProjectQuestions(uniqueQuestions.slice(0, targetSpecs.length), resumeData, config);
    return {
      questions: validatedQuestions,
      debugStats: {
        excludedCount: historyQuestions.length,
        rejectedCount
      }
    };
  } catch (err) {
    console.error("Gemini Multi-Question Generation Error:", err);
    return mockGenerateAllQuestions(resumeData, config, targetSpecs, historyQuestions, otherUserQuestions);
  }
}

function validateAndCleanProjectQuestions(questions, resumeData, config) {
  const userProjects = (resumeData?.projects || [])
    .map(p => (typeof p === 'string' ? p : p?.name))
    .filter(Boolean);

  const usedSet = new Set(questions.map(q => q?.questionText).filter(Boolean));

  return questions.map((q, idx) => {
    if (!q || !q.questionText) return q;

    const matches = q.questionText.match(/project ['"]([^'"]+)['"]/i) || 
                    q.questionText.match(/in ['"]([^'"]+)['"]/i) ||
                    q.questionText.match(/for ['"]([^'"]+)['"]/i);

    if (matches && matches[1]) {
      const refName = matches[1].trim();

      const matchesUserProject = userProjects.some(userProj => {
        const u = userProj.toLowerCase();
        const r = refName.toLowerCase();
        return u === r || u.includes(r) || r.includes(u);
      });

      if (!matchesUserProject && userProjects.length > 0) {
        console.warn(`[PROJECT VALIDATOR] Rejecting unlisted project reference '${refName}' in Q${idx + 1}. Candidate real projects:`, userProjects);
        const spec = { category: q.category || 'Projects', difficulty: q.difficulty || 'Medium' };
        const replacement = generateDynamicProjectQuestion(resumeData, spec, idx, idx % 4, usedSet);
        usedSet.add(replacement.questionText);
        return replacement;
      }
    }

    return q;
  });
}

/**
 * Validates technical questions to ensure they only reference technologies present in the resume.
 * Rejects and replaces any question that requires a technology NOT listed in the resume.
 */
function validateAndCleanTechnicalQuestions(questions, resumeData, config) {
  // Only apply strict validation for Technical and Mixed modes
  if (!config || config.type === 'Project-based') {
    return questions;
  }

  // Build the set of allowed technology names from the resume (lowercase)
  const resumeLangs  = (resumeData?.skills?.languages   || []).map(s => s.toLowerCase());
  const resumeFworks = (resumeData?.skills?.frameworks  || []).map(s => s.toLowerCase());
  const resumeDbs    = (resumeData?.skills?.databases   || []).map(s => s.toLowerCase());
  const resumeTechs  = (resumeData?.skills?.technologies|| []).map(s => s.toLowerCase());
  const resumeProjects = (resumeData?.projects || []).map(p => (typeof p === 'string' ? p : (p?.name || '')).toLowerCase());

  const allAllowed = new Set([...resumeLangs, ...resumeFworks, ...resumeDbs, ...resumeTechs, ...resumeProjects]);

  // Technologies that flag off-resume questions when they appear and are NOT in resume
  const genericForbidden = [
    'mongodb', 'postgresql', 'mysql', 'sqlite', 'redis', 'firebase', 'cassandra',
    'react', 'angular', 'vue', 'next.js', 'express', 'node.js', 'django', 'flask', 'spring boot', 'spring',
    'docker', 'kubernetes', 'graphql', 'jwt', 'oauth', 'soap',
    'cors', 'deadlock', 'thrashing', 'operating system', 'microservices', 'kafka', 'rabbitmq',
    'fastapi', 'nestjs', 'laravel', 'rails', 'serverless', 'terraform', 'ansible',
    'typescript', 'kotlin', 'swift', 'rust', 'go', 'perl', 'scala', 'elixir'
  ];

  const usedSet = new Set(questions.map(q => q?.questionText).filter(Boolean));
  let replacedCount = 0;

  const validated = questions.map((q, idx) => {
    if (!q || !q.questionText) return q;

    const qText = q.questionText.toLowerCase();

    // Check if the question explicitly references any forbidden technology NOT in the resume
    for (const forbidden of genericForbidden) {
      const escapedForbidden = forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedForbidden}\\b`, 'i');
      if (regex.test(qText) && !allAllowed.has(forbidden)) {
        console.warn(`[TECH VALIDATOR] Q${idx + 1} references '${forbidden}' which is NOT in the resume. Replacing.`);
        const spec = { category: q.category || 'Technical Skills', difficulty: q.difficulty || 'Medium' };
        const replacement = mockGenerateQuestion(resumeData, [], config, idx + 200, spec.category, spec.difficulty, idx % 4, usedSet);
        usedSet.add(replacement.questionText);
        replacedCount++;
        return replacement;
      }
    }

    return q;
  });

  if (replacedCount > 0) {
    console.log(`[TECH VALIDATOR] Replaced ${replacedCount} off-resume question(s).`);
  }

  return validated;
}

function mockGenerateAllQuestions(resumeData, config, targetSpecs, historyQuestions = [], otherUserQuestions = []) {
  console.log(`Using Upgraded AI Question Generator (${config.type} Mode, ${config.difficulty} Difficulty, ${targetSpecs.length} Questions)`);
  
  const count = targetSpecs.length;
  const basePool = [];
  for (let i = 0; i < count; i++) {
    basePool.push(i % 4);
  }
  const positionPool = shuffleArray(basePool);

  const usedSet = new Set(historyQuestions);
  const combinedExcluded = new Set([...historyQuestions, ...otherUserQuestions]);
  let rejectedCount = 0;

  const questions = targetSpecs.map((spec, idx) => {
    const targetPos = positionPool[idx];
    let selectedQuestion = null;

    // 1. Try finding a question that is unique for this user AND different from other users
    for (let attempt = 0; attempt < 50; attempt++) {
      const candidateSeed = (idx * 17 + attempt * 11 + Math.floor(Math.random() * 50)) % 1000;
      const candidate = mockGenerateQuestion(resumeData, [], config, candidateSeed, spec.category, spec.difficulty, targetPos, combinedExcluded);
      
      if (!isDuplicateQuestion(candidate.questionText, Array.from(combinedExcluded))) {
        selectedQuestion = candidate;
        usedSet.add(candidate.questionText);
        combinedExcluded.add(candidate.questionText);
        break;
      } else {
        rejectedCount++;
      }
    }

    // 2. Dynamic aspect synthesis: Generate fresh personalized question aspect avoiding BOTH candidate history & other users
    if (!selectedQuestion) {
      const dynamicCand = generateDynamicSynthesizedQuestion(resumeData, spec, idx, targetPos, combinedExcluded, config?.type);
      if (!isDuplicateQuestion(dynamicCand.questionText, Array.from(combinedExcluded))) {
        selectedQuestion = dynamicCand;
        usedSet.add(dynamicCand.questionText);
        combinedExcluded.add(dynamicCand.questionText);
      }
    }

    // 3. Fallback: If combinedExcluded is totally saturated, strictly enforce THIS user's history uniqueness
    if (!selectedQuestion) {
      for (let attempt = 0; attempt < 50; attempt++) {
        const candidateSeed = (idx * 19 + attempt * 13) % 1000;
        const candidate = mockGenerateQuestion(resumeData, [], config, candidateSeed, spec.category, spec.difficulty, targetPos, usedSet);
        if (!isDuplicateQuestion(candidate.questionText, Array.from(usedSet))) {
          selectedQuestion = candidate;
          usedSet.add(candidate.questionText);
          combinedExcluded.add(candidate.questionText);
          break;
        }
      }
    }

    // 4. Ultimate fallback if even candidate history pool exhausted
    if (!selectedQuestion) {
      selectedQuestion = generateDynamicSynthesizedQuestion(resumeData, spec, idx, targetPos, usedSet, config?.type);
      usedSet.add(selectedQuestion.questionText);
      combinedExcluded.add(selectedQuestion.questionText);
    }

    return selectedQuestion;
  });

  const validatedQuestions = validateAndCleanTechnicalQuestions(
    validateAndCleanProjectQuestions(questions, resumeData, config),
    resumeData, config
  );


  const posSeq = validatedQuestions.map((q, i) => {
    const optLetter = q.correctAnswer ? q.correctAnswer.charAt(0) : '?';
    return `Q${i + 1}:${optLetter}`;
  }).join(' ');
  
  console.log(`[TEST LOG] Generated ${count} questions (${config.type} / ${config.difficulty}) position sequence: ${posSeq}`);

  return {
    questions: validatedQuestions,
    debugStats: {
      excludedCount: historyQuestions.length,
      rejectedCount
    }
  };
}

function generateDynamicTechnicalQuestion(resumeData, spec, index, targetPos, usedSet) {
  // STRICTLY use only skills present in the resume — no generic fallbacks
  const langs  = (resumeData?.skills?.languages   || []).filter(Boolean);
  const fworks = (resumeData?.skills?.frameworks  || []).filter(Boolean);
  const dbs    = (resumeData?.skills?.databases   || []).filter(Boolean);
  const techs  = (resumeData?.skills?.technologies|| []).filter(Boolean);

  const allSkills = [...langs, ...fworks, ...dbs, ...techs];
  if (allSkills.length === 0) {
    return {
      questionText: `What is the primary benefit of writing clean, modular code in software development?`,
      topic: 'Software Engineering',
      category: spec.category || 'Technical Skills',
      difficulty: spec.difficulty || 'Medium',
      options: ['A) Easier maintenance and readability', 'B) Faster CPU clock speed', 'C) Automatic deployment to production', 'D) Elimination of unit tests'],
      correctAnswer: 'A) Easier maintenance and readability',
      correctOption: 'A) Easier maintenance and readability'
    };
  }

  const lang  = langs.length  ? langs [index % langs.length]  : null;
  const fwork = fworks.length ? fworks[index % fworks.length] : null;
  const db    = dbs.length    ? dbs   [index % dbs.length]    : null;
  const tech  = techs.length  ? techs [index % techs.length]  : null;

  // Build templates using ONLY resume skills that are available
  const techTemplates = [];

  if (lang) {
    techTemplates.push({ topic: `${lang} Syntax & Async`, qText: `When building applications using ${lang}, which mechanism best handles asynchronous non-blocking operation execution?`, correctText: `Using async/await syntax, Promises, or event-loop callback execution`, wrongTexts: [`Synchronous infinite busy-wait loops`, `Disabling event loop scheduling`, `Executing raw binary shell scripts`] });
    techTemplates.push({ topic: `${lang} Error Handling`, qText: `In ${lang}, what is the primary purpose of wrapping complex logic in try/catch exception blocks?`, correctText: `To handle runtime errors gracefully without crashing the application process`, wrongTexts: [`To increase CPU clock execution speed`, `To bypass compiler type checks`, `To convert strings into machine byte arrays`] });
    techTemplates.push({ topic: `${lang} Memory Management`, qText: `In ${lang}, what mechanism prevents memory leaks when dynamic objects are no longer referenced?`, correctText: `Automatic garbage collection or reference count cleanup`, wrongTexts: [`Increasing virtual page swapping`, `Disabling heap allocation`, `Ignoring memory usage spikes`] });
  }
  if (db) {
    techTemplates.push({ topic: `${db} Query Performance`, qText: `In database management using ${db}, how do you optimize search query performance on large collections/tables?`, correctText: `Creating indexes on frequently queried fields and selecting only necessary fields`, wrongTexts: [`Performing unindexed full collection scans on every request`, `Deleting primary key constraints`, `Disabling database logging`] });
    techTemplates.push({ topic: `${db} Data Integrity`, qText: `When designing tables or collections in ${db}, how do you ensure entity uniqueness and prevent duplicate records?`, correctText: `Enforcing unique schema constraints, primary keys, and index rules`, wrongTexts: [`Disabling database validation checks`, `Allowing arbitrary unformatted values`, `Removing database indexes`] });
    techTemplates.push({ topic: `${db} Transactions`, qText: `In database operations using ${db}, how do you guarantee atomicity across multi-step write operations?`, correctText: `Executing operations inside a database transaction session with commit/rollback support`, wrongTexts: [`Running writes in un-sequenced background threads`, `Ignoring write errors`, `Deleting primary keys prior to updating`] });
  }
  if (fwork) {
    techTemplates.push({ topic: `${fwork} Lifecycle & Data Fetching`, qText: `When developing frontend/backend components with ${fwork}, what is the recommended approach for fetching initial external data?`, correctText: `Using asynchronous API fetch calls inside lifecycle hooks or middleware controllers`, wrongTexts: [`Executing fetch calls directly inside static render returns`, `Performing data fetching inside CSS stylesheets`, `Reloading browser windows repeatedly`] });
    techTemplates.push({ topic: `${fwork} State & Routing`, qText: `In web architecture utilizing ${fwork}, how is state or context passed across nested component trees?`, correctText: `Via structured props, centralized state stores, or context providers`, wrongTexts: [`Attaching variables to global window DOM properties`, `Refreshing pages on every state change`, `Storing state in raw cookie strings`] });
  }
  if (tech) {
    techTemplates.push({ topic: `${tech} Configuration`, qText: `When integrating ${tech} into your development environment, what is the best practice for storing sensitive credentials?`, correctText: `Storing secrets in environment variables outside version control repositories`, wrongTexts: [`Hardcoding API keys in public code commits`, `Embedding passwords directly in HTML tags`, `Disabling environment configuration`] });
  }

  // Fallback dynamic synthesis using resume skills
  const usedArray = Array.from(usedSet);
  let selectedAspect = null;

  // First: try all static templates in rotation
  for (let i = 0; i < techTemplates.length; i++) {
    const candidate = techTemplates[(index + i) % techTemplates.length];
    if (!isDuplicateQuestion(candidate.qText, usedArray)) {
      selectedAspect = candidate;
      break;
    }
  }

  // Second: if all static templates exhausted, generate dynamic aspects from ALL skill×concept combos
  if (!selectedAspect) {
    // Large set of concept aspects — no two will be identical for different skill+concept pairs
    const aspectConcepts = [
      { aspect: 'unit testing and test automation', qPart: 'how do you write unit tests and automate test suites', correctPart: 'Using test frameworks to write assertions, mock dependencies, and run automated regression suites' },
      { aspect: 'code review and collaboration practices', qPart: 'how do you conduct code reviews in a team environment', correctPart: 'Using pull request reviews, inline comments, and automated linting to maintain code quality' },
      { aspect: 'debugging and error diagnosis', qPart: 'what strategy do you use to systematically debug a failing production component', correctPart: 'Reproducing the error locally, checking logs, adding instrumentation, and isolating the failing unit' },
      { aspect: 'version control workflow', qPart: 'how do you structure your version control workflow across feature development', correctPart: 'Using feature branches, descriptive commits, pull requests, and merge strategies to keep history clean' },
      { aspect: 'code modularity and reusability', qPart: 'how do you structure code to maximise reusability and avoid duplication', correctPart: 'Extracting shared logic into utility functions or modules with well-defined interfaces' },
      { aspect: 'input validation and sanitisation', qPart: 'how do you ensure user input is validated and sanitised before processing', correctPart: 'Applying schema validation, type checks, and allowlisting before executing any business logic' },
      { aspect: 'performance optimisation', qPart: 'how do you identify and resolve performance bottlenecks in a production system', correctPart: 'Profiling the application, identifying hot paths, and applying targeted optimisations such as caching or query tuning' },
      { aspect: 'logging and observability', qPart: 'how do you implement logging to enable production observability', correctPart: 'Emitting structured logs at appropriate severity levels and correlating events with request IDs' },
      { aspect: 'documentation practices', qPart: 'how do you document code and APIs for other developers', correctPart: 'Writing inline comments, README files, and API specifications so teammates can understand and consume the code' },
      { aspect: 'dependency management', qPart: 'how do you manage and update third-party library dependencies', correctPart: 'Locking dependency versions, auditing for security vulnerabilities, and testing upgrades in isolation' },
      { aspect: 'concurrency and race conditions', qPart: 'how do you handle concurrent operations to prevent race conditions in shared state', correctPart: 'Using synchronisation primitives, atomic operations, or immutable data structures to safely coordinate concurrent access' },
      { aspect: 'configuration management', qPart: 'how do you manage environment-specific configuration across development and production', correctPart: 'Storing configuration in environment variables and using deployment-specific config files outside version control' },
      { aspect: 'refactoring strategies', qPart: 'how do you approach refactoring legacy code without introducing regressions', correctPart: 'Adding test coverage first, refactoring in small increments, and verifying behaviour through automated tests after each change' },
      { aspect: 'security best practices', qPart: 'what security practices do you apply when developing a new feature', correctPart: 'Validating input, using parameterised queries, applying least-privilege principles, and reviewing for common vulnerabilities' },
      { aspect: 'deployment and release management', qPart: 'how do you ensure a safe deployment of new code to production', correctPart: 'Using CI/CD pipelines, staged rollouts, feature flags, and rollback strategies to minimise deployment risk' }
    ];

    // Try ALL skill × concept combinations until a non-duplicate is found
    const allSkillsForFallback = [...langs, ...fworks, ...dbs, ...techs];
    let found = false;
    outerLoop:
    for (let ai = 0; ai < aspectConcepts.length; ai++) {
      const ac = aspectConcepts[(index + ai) % aspectConcepts.length];
      for (let si = 0; si < allSkillsForFallback.length; si++) {
        const skill = allSkillsForFallback[(index + si) % allSkillsForFallback.length];
        const candidate = {
          topic: `${skill} — ${ac.aspect}`,
          qText: `In ${skill}, ${ac.qPart} to ensure maintainable and reliable software?`,
          correctText: ac.correctPart,
          wrongTexts: [
            `By skipping all tests and deploying directly to production`,
            `By hardcoding all values and disabling error reporting`,
            `By ignoring code review feedback and bypassing CI checks`
          ]
        };
        if (!isDuplicateQuestion(candidate.qText, usedArray)) {
          selectedAspect = candidate;
          found = true;
          break outerLoop;
        }
      }
    }

    // Absolute last resort: generate a unique generic question using a counter
    if (!found) {
      const fallbackSkill = allSkillsForFallback[0] || 'Software Engineering';
      const uniqueSuffix = (index + usedArray.length) % 9999;
      selectedAspect = {
        topic: `${fallbackSkill} Engineering Practice`,
        qText: `In software development using ${fallbackSkill}, which engineering practice most directly improves long-term code maintainability (scenario ${uniqueSuffix})?`,
        correctText: `Applying consistent naming conventions, modular design, and thorough automated test coverage`,
        wrongTexts: [
          `Minimising code comments to keep files short`,
          `Duplicating logic across modules for performance`,
          `Avoiding version control to simplify the workflow`
        ]
      };
    }
  }

  const wrongOptions = [...selectedAspect.wrongTexts];
  wrongOptions.splice(targetPos % 4, 0, selectedAspect.correctText);
  const letter = String.fromCharCode(65 + (targetPos % 4));
  const options = wrongOptions.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`);
  const correctAnswer = `${letter}) ${selectedAspect.correctText}`;

  return {
    questionText: selectedAspect.qText,
    topic: selectedAspect.topic,
    category: spec.category || 'Technical Skills',
    difficulty: spec.difficulty || 'Medium',
    options,
    correctAnswer,
    correctOption: correctAnswer
  };
}




function generateDynamicProjectQuestion(resumeData, spec, index, targetPos, usedSet) {
  const projs = resumeData?.projects?.length ? resumeData.projects : [];

  if (!projs.length) {
    // No real projects available — fall back to a technical question instead
    return generateDynamicTechnicalQuestion(resumeData, spec, index, targetPos, usedSet);
  }

  const proj = projs[index % projs.length] || projs[0];
  const pName = proj.name || 'Project';
  // Use the project's own technologies; if missing, fall back to resume skills (NOT generic list)
  const resumeAllSkills = [
    ...(resumeData?.skills?.languages   || []),
    ...(resumeData?.skills?.frameworks  || []),
    ...(resumeData?.skills?.databases   || []),
    ...(resumeData?.skills?.technologies|| [])
  ].filter(Boolean);
  const pTechs = (proj.technologies && proj.technologies.length > 0) ? proj.technologies : resumeAllSkills;
  const mainTech = pTechs.length ? (pTechs[index % pTechs.length] || pTechs[0]) : 'the chosen technology';


  const projectTemplates = [
    {
      topic: `${pName} Authentication`,
      qText: `In your project '${pName}', which technique was implemented to protect sensitive user endpoints from unauthorized access?`,
      correctText: `Using JSON Web Tokens (JWT) or HTTP-only cookies paired with authorization middleware`,
      wrongTexts: [`Storing unencrypted passwords in client LocalStorage`, `Disabling HTTPS transport security`, `Hardcoding admin credentials in HTML markup`]
    },
    {
      topic: `${pName} Database Indexing`,
      qText: `When managing project data in '${pName}' using ${mainTech}, how did you optimize search query performance on large collections?`,
      correctText: `Creating database indexes on frequently searched fields and projecting necessary fields only`,
      wrongTexts: [`Performing unindexed full table scans on every incoming request`, `Deleting primary key constraints`, `Storing record data in flat text files`]
    },
    {
      topic: `${pName} State & Data Flow`,
      qText: `In your project '${pName}', how did you manage application component state across dynamic UI views?`,
      correctText: `Using structured props passing, React Context, or a centralized state store`,
      wrongTexts: [`Writing state directly to global window DOM properties`, `Refreshing the browser tab on every user interaction`, `Storing state variables in raw cookie headers`]
    },
    {
      topic: `${pName} Error Handling`,
      qText: `In '${pName}', how did you implement error handling for asynchronous backend requests?`,
      correctText: `Wrapping async controller functions in try/catch blocks and returning structured JSON error responses`,
      wrongTexts: [`Ignoring backend errors and returning empty 200 OK responses`, `Terminating the web server process on invalid requests`, `Exposing raw database stack traces`]
    },
    {
      topic: `${pName} API Architecture`,
      qText: `In your project '${pName}', how did client components communicate with the backend server?`,
      correctText: `Via asynchronous HTTP fetch/axios calls to RESTful JSON API endpoints`,
      wrongTexts: [`Using low-level raw UDP socket packets`, `Downloading static text files for every state change`, `Communicating through browser local memory only`]
    },
    {
      topic: `${pName} Caching Strategy`,
      qText: `If query throughput on your project '${pName}' scales significantly, which strategy best reduces database load?`,
      correctText: `Implementing an in-memory caching layer (such as Redis) for frequent read queries`,
      wrongTexts: [`Disabling database query caching entirely`, `Hardcoding static response arrays in client scripts`, `Increasing database polling intervals`]
    },
    {
      topic: `${pName} Rate Limiting`,
      qText: `How do you protect backend routes in '${pName}' from automated brute-force attacks?`,
      correctText: `Applying HTTP rate-limiting middleware to cap consecutive requests per client IP`,
      wrongTexts: [`Disabling CORS headers`, `Storing plaintext passwords in browser cookies`, `Removing user authentication checks`]
    },
    {
      topic: `${pName} Input Validation`,
      qText: `How were user inputs sanitized in '${pName}' before executing database query logic?`,
      correctText: `Using strict schema validation libraries and parameterized database queries`,
      wrongTexts: [`Concatenating raw input strings directly into database commands`, `Disabling all form validation`, `Processing unvalidated string payloads`]
    },
    {
      topic: `${pName} Session Expiration`,
      qText: `In '${pName}', how are user authentication sessions invalidated upon user logout?`,
      correctText: `Clearing authorization tokens and destroying active server session records`,
      wrongTexts: [`Leaving session tokens active indefinitely`, `Deleting user account records from the database`, `Restarting the web server process`]
    },
    {
      topic: `${pName} Database Schema`,
      qText: `In database design for '${pName}', how did you model relationships between records?`,
      correctText: `Using foreign key references or embedded sub-documents based on data access patterns`,
      wrongTexts: [`Storing all system data in a single CSV file`, `Duplicating all tables across every database`, `Disabling relational constraints`]
    },
    {
      topic: `${pName} Tech Stack Justification`,
      qText: `In your project '${pName}', why was ${mainTech} selected as part of the core technology stack?`,
      correctText: `Due to its technical performance, schema flexibility, and seamless integration with application requirements`,
      wrongTexts: [`Because it requires no server memory or disk storage`, `Because it bypasses database security permissions`, `It was selected randomly without evaluating project requirements`]
    },
    {
      topic: `${pName} Automated Testing`,
      qText: `When preparing your project '${pName}' for production deployment, how did you verify API route reliability?`,
      correctText: `Writing automated integration test suites and validating HTTP response status codes`,
      wrongTexts: [`Deleting unit test cases before deployment`, `Manually inspecting binary byte code`, `Disabling backend logging`]
    },
    {
      topic: `${pName} Challenges & Trade-offs`,
      qText: `What key technical challenge did you encounter during the development of '${pName}', and how was it solved?`,
      correctText: `Optimizing query latency by tuning database indexes and streamlining response payloads`,
      wrongTexts: [`Bypassing security checks`, `Hardcoding temporary values in production`, `Ignoring system error trace logs`]
    },
    {
      topic: `${pName} System Scalability`,
      qText: `How can the architecture of '${pName}' be scaled horizontally to accommodate high concurrent user load?`,
      correctText: `By running stateless application instances behind a load balancer with a shared database cluster`,
      wrongTexts: [`Increasing client browser page refresh rates`, `Disabling CORS security headers`, `Running the database inside client memory`]
    }
  ];

  let selectedAspect = null;
  const usedArray = Array.from(usedSet);

  for (let i = 0; i < projectTemplates.length; i++) {
    const candidate = projectTemplates[(index + i) % projectTemplates.length];
    if (!isDuplicateQuestion(candidate.qText, usedArray)) {
      selectedAspect = candidate;
      break;
    }
  }

  if (!selectedAspect) {
    const seqNum = index + usedArray.length + 1;
    const aspectTypes = [
      "performance profiling",
      "automated integration testing",
      "microservice decoupling",
      "monitoring & metric logging",
      "zero-downtime deployment",
      "data migration integrity",
      "payload compression",
      "horizontal scaling"
    ];
    const aspect = aspectTypes[seqNum % aspectTypes.length];
    
    selectedAspect = {
      topic: `${pName} ${aspect}`,
      qText: `In your project '${pName}', how did your technical team address ${aspect} during system evolution?`,
      correctText: `By establishing structured engineering guidelines, modular code practices, and automated validation tests`,
      wrongTexts: [
        `By disabling all backend error logging`,
        `By hardcoding static values in production databases`,
        `By bypassing code review and testing stages`
      ]
    };
  }

  const wrongOptions = [...selectedAspect.wrongTexts];
  wrongOptions.splice(targetPos % 4, 0, selectedAspect.correctText);
  const letter = String.fromCharCode(65 + (targetPos % 4));

  const options = wrongOptions.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`);
  const correctAnswer = `${letter}) ${selectedAspect.correctText}`;

  return {
    questionText: selectedAspect.qText,
    topic: selectedAspect.topic,
    category: spec.category || "Projects",
    difficulty: spec.difficulty || "Medium",
    options,
    correctAnswer,
    correctOption: correctAnswer
  };
}

function generateDynamicSynthesizedQuestion(resumeData, spec, index, targetPos, usedSet, modeType = 'Mixed') {
  if (modeType === 'Technical') {
    return generateDynamicTechnicalQuestion(resumeData, spec, index, targetPos, usedSet);
  } else if (modeType === 'Project-based') {
    return generateDynamicProjectQuestion(resumeData, spec, index, targetPos, usedSet);
  } else {
    const isProjectCat = spec.category && (
      spec.category.includes('Project') || 
      spec.category.includes('Architecture') || 
      spec.category.includes('Database Design') || 
      spec.category.includes('Security') || 
      spec.category.includes('API') || 
      spec.category.includes('Deployment')
    );
    if (isProjectCat || (index % 2 === 1)) {
      return generateDynamicProjectQuestion(resumeData, spec, index, targetPos, usedSet);
    } else {
      return generateDynamicTechnicalQuestion(resumeData, spec, index, targetPos, usedSet);
    }
  }
}

/**
 * Evaluates the candidate response to a question
 */
async function evaluateAnswer(questionText, topic, candidateAnswer, resumeData) {
  const model = getGenAIModel();
  if (!model) {
    return mockEvaluateAnswer(questionText, topic, candidateAnswer);
  }

  const prompt = `You are a Technical Interview Evaluator. Evaluate the candidate's response to the following question.
Question: ${questionText}
Topic: ${topic}
Candidate Answer: ${candidateAnswer}
Candidate Profile: ${JSON.stringify(resumeData)}

Evaluate the response on a scale of 0 to 10 for:
1. Technical Accuracy: Is the answer factually correct?
2. Relevance: Does the answer address the question?
3. Technical Depth: Does it go beyond basic definitions to show deeper conceptual/practical understanding?
4. Clarity: Is the explanation clear and structured?

Compute the Overall Score as the average of the four parameters.
Provide a constructive feedback string (2-3 sentences max) explaining what they did well and what key technical details were missing or could be improved.
Return your response STRICTLY as a JSON object matching this schema:
{
  "technicalAccuracy": <number 0 to 10>,
  "relevance": <number 0 to 10>,
  "depth": <number 0 to 10>,
  "clarity": <number 0 to 10>,
  "overallScore": <number 0 to 10>,
  "feedback": "string feedback"
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const text = result.response.text();
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini Answer Evaluation Error:", err);
    return mockEvaluateAnswer(questionText, topic, candidateAnswer);
  }
}

function isAnswerCorrect(userAns, correctAns, options) {
  if (!userAns || !correctAns) return false;
  const cleanUser = userAns.trim();
  const cleanCorrect = correctAns.trim();

  // 1. Direct exact match
  if (cleanUser.toLowerCase() === cleanCorrect.toLowerCase()) return true;

  // 2. Letter prefix extraction (e.g. "A", "A)", or "A.")
  const getLetter = (str) => {
    const m = str.match(/^([A-D])(?:[\)\.\s]|$)/i);
    return m ? m[1].toUpperCase() : null;
  };
  const userLetter = getLetter(cleanUser);
  const correctLetter = getLetter(cleanCorrect);
  if (userLetter && correctLetter && userLetter === correctLetter) return true;

  // 3. Option text extraction without letter prefix
  const stripLetter = (str) => str.replace(/^[A-D][\)\.\s]\s*/i, '').trim().toLowerCase();
  const userText = stripLetter(cleanUser);
  const correctText = stripLetter(cleanCorrect);
  if (userText && correctText && userText === correctText) return true;

  // 4. Options array lookup
  if (options && Array.isArray(options)) {
    const userOpt = options.find(o => o.toLowerCase().trim() === cleanUser.toLowerCase());
    const correctOpt = options.find(o => o.toLowerCase().trim() === cleanCorrect.toLowerCase());
    if (userOpt && correctOpt && userOpt === correctOpt) return true;
  }

  return false;
}

function getStandardCategoryBucket(rawCategory) {
  if (!rawCategory) return 'Technical';
  const cat = rawCategory.toLowerCase();
  
  if (cat.includes('project') || cat.includes('architecture') || cat.includes('tech stack') || cat.includes('database design') || cat.includes('security') || cat.includes('api') || cat.includes('deployment')) {
    return 'Project';
  }
  if (cat.includes('problem') || cat.includes('algo') || cat.includes('coding') || cat.includes('logic')) {
    return 'Problem Solving';
  }
  if (cat.includes('comm') || cat.includes('resume') || cat.includes('exp') || cat.includes('behavioral') || cat.includes('integrity')) {
    return 'Communication';
  }
  // Default for Technical Skills, DBMS, OS, Data Structures, Technologies, OOP, etc.
  return 'Technical';
}

function buildPerformanceAnalysis(resumeData, interviewSession) {
  const questions = interviewSession.questions || [];
  
  const questionAnalyses = questions.map((q, idx) => {
    const userAns = (q.answerText || '').trim();
    const correctAns = (q.correctAnswer || q.correctOption || '').trim();
    const isCorrect = isAnswerCorrect(userAns, correctAns, q.options);
    const concept = q.topic || q.category || 'General Concept';

    let explanation = '';
    let conceptToImprove = null;
    let recommendation = null;

    if (isCorrect) {
      explanation = `You correctly understood how ${concept} works.`;
    } else {
      explanation = `The correct answer is "${correctAns}". You selected "${userAns || 'No Answer'}".`;
      conceptToImprove = `${concept} concepts and principles.`;
      recommendation = `Review ${concept} fundamentals and practice hands-on exercises.`;
    }

    return {
      questionNumber: idx + 1,
      questionText: q.questionText,
      concept,
      category: q.category || 'Technical',
      difficulty: q.difficulty || 'Medium',
      options: q.options || [],
      userAnswer: userAns || '[No Answer Selected]',
      correctAnswer: correctAns,
      isCorrect,
      explanation,
      conceptToImprove,
      recommendation
    };
  });

  const totalQuestions = questionAnalyses.length;
  const correctCount = questionAnalyses.filter(q => q.isCorrect).length;
  const wrongCount = totalQuestions - correctCount;
  const overallScorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Difficulty stats
  const difficultyStats = {
    Easy: { correct: 0, total: 0 },
    Medium: { correct: 0, total: 0 },
    Hard: { correct: 0, total: 0 },
    Expert: { correct: 0, total: 0 }
  };

  questionAnalyses.forEach(q => {
    const diff = q.difficulty || 'Medium';
    if (!difficultyStats[diff]) difficultyStats[diff] = { correct: 0, total: 0 };
    difficultyStats[diff].total += 1;
    if (q.isCorrect) difficultyStats[diff].correct += 1;
  });

  // Group Strong Concepts (unique concepts where user answered correctly)
  const strongConceptMap = new Map();
  questionAnalyses.filter(q => q.isCorrect).forEach(q => {
    if (!strongConceptMap.has(q.concept)) {
      strongConceptMap.set(q.concept, {
        concept: q.concept,
        questionNumbers: [q.questionNumber],
        explanation: `You correctly understood ${q.concept} concepts.`
      });
    } else {
      strongConceptMap.get(q.concept).questionNumbers.push(q.questionNumber);
    }
  });
  const strongConcepts = Array.from(strongConceptMap.values());

  // Group Weak Concepts (where user answered INCORRECTLY)
  const weakConceptMap = new Map();
  questionAnalyses.filter(q => !q.isCorrect).forEach(q => {
    if (!weakConceptMap.has(q.concept)) {
      weakConceptMap.set(q.concept, {
        concept: q.concept,
        wrongQuestionNumbers: [q.questionNumber],
        whatToImprove: `Understanding core principles and practical applications of ${q.concept}.`,
        recommendation: `Practice ${q.concept} exercises, code scenarios, and review key documentation.`
      });
    } else {
      weakConceptMap.get(q.concept).wrongQuestionNumbers.push(q.questionNumber);
    }
  });
  const weakConcepts = Array.from(weakConceptMap.values());

  // Category scores calculated STRICTLY from actual questions in each category
  const categoryBucketStats = {
    Technical: { correct: 0, total: 0 },
    Project: { correct: 0, total: 0 },
    'Problem Solving': { correct: 0, total: 0 },
    Communication: { correct: 0, total: 0 }
  };

  questionAnalyses.forEach(q => {
    const bucket = getStandardCategoryBucket(q.category);
    categoryBucketStats[bucket].total += 1;
    if (q.isCorrect) {
      categoryBucketStats[bucket].correct += 1;
    }
  });

  const categoryScores = {};
  Object.keys(categoryBucketStats).forEach(key => {
    const stat = categoryBucketStats[key];
    const pct = stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : null;
    categoryScores[key] = {
      correct: stat.correct,
      total: stat.total,
      percentage: pct
    };
  });

  // Provide direct backwards compatibility properties
  categoryScores.technicalKnowledge = categoryScores.Technical.percentage;
  categoryScores.projectKnowledge = categoryScores.Project.percentage;
  categoryScores.problemSolving = categoryScores['Problem Solving'].percentage;
  categoryScores.communication = categoryScores.Communication.percentage;

  // Skill gaps and recommendations for backwards compatibility
  const skillGaps = [];
  strongConcepts.forEach(s => skillGaps.push({ skill: s.concept, status: 'Strong' }));
  weakConcepts.forEach(w => skillGaps.push({ skill: w.concept, status: 'Weak' }));

  const recommendations = weakConcepts.map(w => ({
    topic: w.concept,
    practice: w.recommendation
  }));

  return {
    overallScore: overallScorePercent,
    totalQuestions,
    correctCount,
    wrongCount,
    difficultyStats,
    strongConcepts,
    weakConcepts,
    questionAnalyses,
    categoryScores,
    skillGaps,
    recommendations
  };
}

/**
 * Generates final report, category summary, skill gaps, and custom study recommendations
 */
async function generateFinalReport(resumeData, interviewSession) {
  const baseReport = buildPerformanceAnalysis(resumeData, interviewSession);
  const model = getGenAIModel();
  if (!model) {
    return baseReport;
  }

  const prompt = `You are an AI Career Coach and Senior Technical Evaluator. Enrich the following assessment performance report.

Candidate Verified Resume Info:
${JSON.stringify(resumeData || {})}

Exam Performance Data:
- Total Questions: ${baseReport.totalQuestions}
- Correct Answers: ${baseReport.correctCount}
- Wrong Answers: ${baseReport.wrongCount}
- Overall Score: ${baseReport.overallScore}%

Questions & Candidate Answers:
${baseReport.questionAnalyses.map(q => `
Q${q.questionNumber}: ${q.questionText}
Concept: ${q.concept} | Difficulty: ${q.difficulty}
Candidate Answer: ${q.userAnswer}
Correct Answer: ${q.correctAnswer}
Result: ${q.isCorrect ? 'CORRECT' : 'WRONG'}
`).join('\n')}

Weak Concepts Needing Improvement:
${baseReport.weakConcepts.map(w => `- Concept: ${w.concept} (Incorrect Qs: Q${w.wrongQuestionNumbers.join(', Q')})`).join('\n')}

Instructions:
1. Provide a short, constructive explanation for each question in 'questionExplanations' (1-2 sentences explaining why the correct choice is right and why the user's answer was right/wrong).
2. Provide 'whatToImprove' and actionable 'recommendation' for each item in 'weakConceptDetails'.
3. Do NOT invent new questions, user answers, or correct answers. Stored data is the source of truth.

Return your response STRICTLY as a JSON object matching this schema:
{
  "questionExplanations": [
    {
      "questionNumber": <number>,
      "explanation": "string",
      "conceptToImprove": "string or null",
      "recommendation": "string or null"
    }
  ],
  "weakConceptDetails": [
    {
      "concept": "string",
      "whatToImprove": "string",
      "recommendation": "string"
    }
  ]
}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const aiData = JSON.parse(result.response.text());

    if (aiData.questionExplanations && Array.isArray(aiData.questionExplanations)) {
      aiData.questionExplanations.forEach(exp => {
        const target = baseReport.questionAnalyses.find(q => q.questionNumber === exp.questionNumber);
        if (target) {
          target.explanation = exp.explanation || target.explanation;
          target.conceptToImprove = exp.conceptToImprove || target.conceptToImprove;
          target.recommendation = exp.recommendation || target.recommendation;
        }
      });
    }

    if (aiData.weakConceptDetails && Array.isArray(aiData.weakConceptDetails)) {
      aiData.weakConceptDetails.forEach(wDetail => {
        const target = baseReport.weakConcepts.find(w => w.concept.toLowerCase() === wDetail.concept.toLowerCase());
        if (target) {
          target.whatToImprove = wDetail.whatToImprove || target.whatToImprove;
          target.recommendation = wDetail.recommendation || target.recommendation;
        }
      });
    }
  } catch (err) {
    console.error("Gemini Report Generation Error:", err);
  }

  return baseReport;
}

// ==================== MOCK FALLBACKS ====================

function mockAnalyzeResume(rawText) {
  console.log("Using Strict Heuristic Resume Parser.");
  
  if (!rawText || typeof rawText !== 'string') {
    return {
      skills: { languages: [], frameworks: [], databases: [], technologies: [] },
      projects: [],
      certifications: [],
      experience: []
    };
  }

  const skills = {
    languages: [],
    frameworks: [],
    databases: [],
    technologies: []
  };

  const textLower = rawText.toLowerCase();

  // Keyword maps
  const dbKeywords = ["mongodb", "mysql", "postgresql", "sqlite", "oracle", "redis", "dbms", "firebase", "cassandra"];
  const langKeywords = ["python", "javascript", "java", "c++", "typescript", "c#", "ruby", "go", "rust", "php", "html", "css", "sql", "c"];
  const fwKeywords = ["react", "angular", "vue", "express", "spring boot", "django", "flask", "next.js", "nest.js", "bootstrap", "tailwind"];
  const techKeywords = ["git", "aws", "docker", "kubernetes", "rest api", "machine learning", "nlp", "jwt", "graphql", "vs code", "xampp", "data structures", "advanced data structures", "object oriented programming", "oop"];

  dbKeywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i');
    if (regex.test(textLower)) {
      skills.databases.push(kw === "dbms" ? "DBMS" : kw.charAt(0).toUpperCase() + kw.slice(1));
    }
  });

  langKeywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i');
    if (regex.test(textLower)) {
      let displayName = kw.charAt(0).toUpperCase() + kw.slice(1);
      if (kw === "c++") displayName = "C++";
      if (kw === "c") displayName = "C";
      if (kw === "sql") displayName = "SQL";
      if (kw === "html") displayName = "HTML";
      if (kw === "css") displayName = "CSS";
      if (kw === "php") displayName = "PHP";
      skills.languages.push(displayName);
    }
  });

  fwKeywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i');
    if (regex.test(textLower)) {
      skills.frameworks.push(kw === "next.js" ? "Next.js" : kw.charAt(0).toUpperCase() + kw.slice(1));
    }
  });

  techKeywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw.replace('+', '\\+')}\\b`, 'i');
    if (regex.test(textLower)) {
      let displayName = kw.charAt(0).toUpperCase() + kw.slice(1);
      if (kw === "rest api") displayName = "REST APIs";
      if (kw === "vs code") displayName = "VS Code";
      if (kw === "xampp") displayName = "XAMPP";
      if (kw === "data structures") displayName = "Data Structures";
      if (kw === "advanced data structures") displayName = "Advanced Data Structures";
      if (kw === "object oriented programming" || kw === "oop") displayName = "Object Oriented Programming";
      if (kw === "machine learning") displayName = "Machine Learning";
      skills.technologies.push(displayName);
    }
  });

  // Deduplicate skills lists
  skills.languages = Array.from(new Set(skills.languages));
  skills.frameworks = Array.from(new Set(skills.frameworks));
  skills.databases = Array.from(new Set(skills.databases));
  skills.technologies = Array.from(new Set(skills.technologies));

  // --- SECTION COLLECTION & EXTRACTION ---
  const projLines = [];
  const certLines = [];
  const expLines = [];

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();

    // Detect section headers
    if (/^(PROJECTS|PERSONAL PROJECTS|ACADEMIC PROJECTS|KEY PROJECTS)[\s:-]*$/i.test(line) || upper.startsWith('PROJECTS:') || upper === 'PROJECTS') {
      currentSection = 'PROJECTS';
      continue;
    }
    if (/^(CERTIFICATIONS|CERTIFICATES|LICENSES & CERTIFICATIONS|ACCREDITATIONS)[\s:-]*$/i.test(line) || upper.startsWith('CERTIFICATIONS:') || upper === 'CERTIFICATIONS') {
      currentSection = 'CERTIFICATIONS';
      continue;
    }
    if (/^(WORK EXPERIENCE|EMPLOYMENT|EMPLOYMENT HISTORY|INTERNSHIP|INTERNSHIPS|PROFESSIONAL EXPERIENCE)[\s:-]*$/i.test(line) || upper.startsWith('INTERNSHIP:') || upper.startsWith('WORK EXPERIENCE:') || upper === 'INTERNSHIP' || upper === 'EXPERIENCE') {
      currentSection = 'EXPERIENCE';
      continue;
    }
    if (/^(TECHNICAL SKILLS|SKILLS|WORKSHOPS|WORKSHOPS & ACTIVITIES|LEADERSHIP|EDUCATION|ACTIVITIES)[\s:-]*$/i.test(line) || upper.startsWith('TECHNICAL SKILLS:')) {
      currentSection = null;
      continue;
    }

    if (currentSection === 'PROJECTS') {
      projLines.push(line);
    } else if (currentSection === 'CERTIFICATIONS') {
      certLines.push(line);
    } else if (currentSection === 'EXPERIENCE') {
      expLines.push(line);
    } else {
      // Out-of-section keyword fallback checks
      if (/(Saylor Academy|Salesforce Certified|AWS Certified|Google Cloud Certified|Coursera|Udemy|NPTEL|HackerRank|Virtual Internship Certificate)/i.test(line)) {
        if (!certLines.includes(line)) certLines.push(line);
      }
      if (/(Virtual Internship|Software Intern|Web Developer Intern|Backend Developer Intern)/i.test(line)) {
        if (!expLines.includes(line)) expLines.push(line);
      }
    }
  }

  // 1. Process Projects
  const projects = [];
  let currentProj = null;

  const expandedProjLines = [];
  projLines.forEach(pl => {
    // If line has multiple sentences with project separators, split by period
    const parts = pl.split(/(?<=\.)\s+/);
    parts.forEach(p => {
      if (p.trim().length > 0) expandedProjLines.push(p.trim());
    });
  });

  expandedProjLines.forEach(line => {
    let titleText = '';
    let bodyText = '';

    const matchDash = line.match(/^(\d+[\.\)]|[-•*])?\s*([^:–—\-]+)\s*[:–—\-]\s*(.+)$/);
    if (matchDash && matchDash[2]) {
      const potentialTitle = matchDash[2].trim();
      const lower = potentialTitle.toLowerCase();
      if (potentialTitle.length >= 2 && potentialTitle.length <= 50 && !lower.startsWith('tech') && !lower.startsWith('role') && !lower.startsWith('description') && !lower.startsWith('project')) {
        titleText = potentialTitle;
        bodyText = matchDash[3].trim();
      }
    }

    if (!titleText) {
      const matchBullet = line.match(/^(\d+[\.\)]|[-•*])?\s*(.+)$/);
      const cleanLine = matchBullet ? matchBullet[2].trim() : line.trim();
      if (/^(\d+[\.\)]|[-•*])?\s*[A-Za-z0-9\s]{2,50}$/.test(line) && !line.toLowerCase().startsWith('tech') && !line.toLowerCase().startsWith('role')) {
        titleText = cleanLine;
      }
    }

    if (titleText) {
      if (currentProj && currentProj.name) {
        projects.push(currentProj);
      }
      currentProj = {
        name: titleText.replace(/^(\d+[\.\)]|[-•*])\s*/, '').trim(),
        description: bodyText || '',
        role: 'Developer',
        technologies: [],
        technicalAreas: [],
        functionality: bodyText || ''
      };

      if (bodyText) {
        const techMatches = bodyText.match(/(using|built with|developed using|tech stack:?)\s+([A-Za-z0-9\s,\/\.\#\+]+)/i);
        if (techMatches && techMatches[2]) {
          currentProj.technologies = techMatches[2].split(/[,|\/]/).map(t => t.trim()).filter(t => t.length > 0 && t.length < 25);
        }
      }
    } else if (currentProj) {
      if (line.toLowerCase().includes('role:') || line.toLowerCase().includes('role :')) {
        currentProj.role = line.split(/role\s*:\s*/i)[1]?.trim() || currentProj.role;
      } else if (line.toLowerCase().includes('tech') || line.toLowerCase().includes('technologies:')) {
        const techStr = line.split(/:\s*/)[1] || line;
        currentProj.technologies = techStr.split(/[,|\/]/).map(t => t.trim()).filter(t => t.length > 0);
      } else {
        currentProj.description += (currentProj.description ? ' ' : '') + line;
      }
    }
  });
  if (currentProj && currentProj.name) {
    projects.push(currentProj);
  }

  // 2. Process Certifications
  const certifications = [];
  certLines.forEach(rawCert => {
    let name = rawCert;
    let domain = 'Certification';
    if (rawCert.includes('—')) {
      const parts = rawCert.split('—');
      name = parts[0].trim();
      domain = parts[1].trim();
    } else if (rawCert.includes(' - ')) {
      const parts = rawCert.split(' - ');
      name = parts[0].trim();
      domain = parts[1].trim();
    } else if (rawCert.toLowerCase().includes('saylor academy')) {
      domain = 'Saylor Academy';
      name = rawCert.replace(/saylor academy/gi, '').replace(/[-—,\(\)]/g, '').trim();
    } else if (rawCert.toLowerCase().includes('aws')) {
      domain = 'Amazon Web Services (AWS)';
    }

    name = name.replace(/^(\d+[\.\)]|[-•*])\s*/, '').trim();

    if (name && name.length > 3) {
      certifications.push({ name, domain });
    }
  });

  const uniqueCerts = [];
  const certNamesSeen = new Set();
  certifications.forEach(c => {
    const key = c.name.toLowerCase();
    if (!certNamesSeen.has(key)) {
      certNamesSeen.add(key);
      uniqueCerts.push(c);
    }
  });

  // 3. Process Experience / Internships
  const experience = [];
  let currentExp = null;

  expLines.forEach(line => {
    const clean = line.replace(/^(\d+[\.\)]|[-•*])\s*/, '').trim();
    if (!currentExp) {
      let company = 'Amazon Web Services (AWS)';
      let role = clean;
      if (clean.includes('—')) {
        const parts = clean.split('—');
        role = parts[0].trim();
        company = parts[1].trim();
      } else if (clean.includes(' - ')) {
        const parts = clean.split(' - ');
        role = parts[0].trim();
        company = parts[1].trim();
      }
      currentExp = {
        company,
        role,
        responsibilities: '',
        technologies: ['Cloud Computing', 'AWS']
      };
    } else {
      currentExp.responsibilities += (currentExp.responsibilities ? ' ' : '') + clean;
    }
  });

  if (currentExp && currentExp.role) {
    experience.push(currentExp);
  }

  return {
    skills,
    projects,
    certifications: uniqueCerts,
    experience
  };
}

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}



// RESUME-GROUNDED mockGenerateQuestion REPLACEMENT
// This file patches backend/services/aiService.js
// The full new function is below — paste to replace lines 1299-1704

function mockGenerateQuestion(resumeData, history, config, nextIndex, targetCategory, targetDifficulty, forceTargetPos, usedQuestionTexts = new Set()) {
  // ===================================================================
  // RESUME-GROUNDED QUESTION GENERATOR
  // ALL questions must be traceable to a skill/technology in the resume.
  // NEVER fall back to generic MongoDB/OS/CORS/JWT/PostgreSQL if those
  // items are absent from the current candidate's resume.
  // ===================================================================

  const modeType = config?.type || 'Mixed';
  const requestedDiff = targetDifficulty || config?.difficulty || 'Medium';
  const projs = resumeData?.projects?.length ? resumeData.projects : [];

  // Build the ALLOWED skill set STRICTLY from the resume
  const resumeLangs   = (resumeData?.skills?.languages   || []).filter(Boolean);
  const resumeFworks  = (resumeData?.skills?.frameworks  || []).filter(Boolean);
  const resumeDbs     = (resumeData?.skills?.databases   || []).filter(Boolean);
  const resumeTechs   = (resumeData?.skills?.technologies|| []).filter(Boolean);

  const isProjectCategory = (
    modeType === 'Project-based' ||
    targetCategory === 'Projects' ||
    targetCategory === 'Project Architecture' ||
    targetCategory === 'Database Design' ||
    targetCategory === 'Security & Auth' ||
    targetCategory === 'API Communication' ||
    targetCategory === 'Deployment & Challenges' ||
    targetCategory === 'Tech Stack Decisions'
  );

  // For project-based questions with no real projects -> fall back to technical
  if (!projs.length && isProjectCategory) {
    return generateDynamicTechnicalQuestion(resumeData, { category: targetCategory, difficulty: requestedDiff }, nextIndex, forceTargetPos !== undefined ? forceTargetPos : Math.floor(Math.random() * 4), usedQuestionTexts);
  }

  const project1 = projs.length ? (projs[nextIndex % projs.length] || projs[0]) : null;

  // ---- Skill selectors (only from resume, no generic fallbacks) ----
  const pickLang  = resumeLangs.length  ? resumeLangs [nextIndex % resumeLangs.length]  : null;
  const pickFwork = resumeFworks.length ? resumeFworks[nextIndex % resumeFworks.length] : null;
  const pickDb    = resumeDbs.length    ? resumeDbs   [nextIndex % resumeDbs.length]    : null;
  const pickTech  = resumeTechs.length  ? resumeTechs [nextIndex % resumeTechs.length]  : null;

  // ================================================================
  // BUILD RESUME-SKILL-BASED TECHNICAL QUESTION BANK
  // Every entry uses ONLY skills the candidate actually listed.
  // ================================================================
  const resumeTechPool = [];

  // --- Language-based questions ---
  resumeLangs.forEach((lang) => {
    const langLower = lang.toLowerCase();

    // Universal: error handling
    resumeTechPool.push({
      questionText: `When writing software in ${lang}, what is the primary purpose of using try/catch error-handling blocks?`,
      correctText: `To handle runtime errors gracefully and prevent application crashes`,
      wrongTexts: [`To increase execution speed`, `To clear unused memory variables`, `To compile code into binary`],
      topic: lang, category: 'Technical Skills'
    });
    // Universal: memory / GC
    resumeTechPool.push({
      questionText: `In ${lang}, how does the runtime manage memory for objects that are no longer referenced?`,
      correctText: `Through automatic garbage collection or reference-counting cleanup that reclaims unused heap memory`,
      wrongTexts: [`The programmer must manually free every allocation`, `Memory is never reclaimed until the OS reboots`, `Memory leaks are silently ignored`],
      topic: lang, category: 'Technical Skills'
    });

    if (langLower === 'python') {
      resumeTechPool.push({ questionText: `In Python, which built-in data structure stores key-value pairs and allows O(1) average-case lookup?`, correctText: `Dictionary (dict)`, wrongTexts: [`List`, `Tuple`, `Set`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, what is the difference between a list comprehension and a generator expression?`, correctText: `List comprehensions evaluate eagerly and store all values in memory; generators evaluate lazily and yield values one at a time`, wrongTexts: [`They are identical in memory usage`, `Generator expressions are faster only for small lists`, `List comprehensions cannot be nested`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `Which Python keyword is used to define a function that can pause execution and yield values one at a time?`, correctText: `yield`, wrongTexts: [`async`, `return`, `lambda`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, what does the __init__ method in a class represent?`, correctText: `The constructor method that initialises object attributes when a new instance is created`, wrongTexts: [`A static method for class-level operations`, `A destructor that frees memory`, `A method for string serialization`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, how do you handle multiple exception types in a single except block?`, correctText: `By grouping them in a tuple: except (TypeError, ValueError):`, wrongTexts: [`By using multiple except keywords on the same line`, `By using the catch keyword`, `By nesting if-else inside the except block`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python OOP, what is the purpose of the 'self' parameter in method definitions?`, correctText: `It refers to the current instance of the class, allowing access to instance attributes and methods`, wrongTexts: [`It refers to the class itself, like a static keyword`, `It is optional and rarely used`, `It represents the return value of the method`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, what is a decorator and what is its primary use?`, correctText: `A function that wraps another function to add behaviour (e.g., logging, authentication) without modifying the original function's code`, wrongTexts: [`A CSS styling mechanism for Python UIs`, `A built-in function for string formatting`, `A keyword that defines abstract methods`], topic: 'Python', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Python, what is the difference between mutable and immutable data types? Give one example of each.`, correctText: `Mutable types (e.g., list, dict) can be changed after creation; immutable types (e.g., str, tuple) cannot be modified once created`, wrongTexts: [`All Python data types are mutable`, `Immutable types can be modified using indexing`, `Mutable means read-only`], topic: 'Python', category: 'Technical Skills' });
    }

    if (langLower === 'java') {
      resumeTechPool.push({ questionText: `In Java, what is the difference between an interface and an abstract class?`, correctText: `An interface defines a contract with only abstract methods (Java 8+ allows default methods), while an abstract class can have both abstract and concrete methods with state`, wrongTexts: [`Interfaces can have instance variables; abstract classes cannot`, `Abstract classes support multiple inheritance; interfaces do not`, `There is no practical difference in Java`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, which collection class is backed by a hash table and allows null keys and values?`, correctText: `HashMap`, wrongTexts: [`TreeMap`, `LinkedHashMap`, `Hashtable`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, what keyword prevents a class from being subclassed or a method from being overridden?`, correctText: `final`, wrongTexts: [`static`, `abstract`, `sealed`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java exception handling, what is the difference between checked and unchecked exceptions?`, correctText: `Checked exceptions are verified at compile time and must be caught or declared; unchecked exceptions (RuntimeException subclasses) are not enforced at compile time`, wrongTexts: [`Unchecked exceptions are always fatal`, `Checked exceptions occur only in I/O operations`, `There is no distinction in Java 11+`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, which OOP principle is demonstrated when a child class provides a specific implementation of a method declared in a parent class?`, correctText: `Method Overriding (Runtime Polymorphism)`, wrongTexts: [`Encapsulation`, `Method Overloading`, `Abstraction`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What is the role of the Java Virtual Machine (JVM) in executing Java programs?`, correctText: `It interprets Java bytecode and provides platform independence, memory management, and garbage collection`, wrongTexts: [`It compiles Java source code directly to machine code`, `It only manages network connections`, `It replaces the operating system kernel`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, what is the purpose of the 'static' keyword when applied to a class member?`, correctText: `It makes the member belong to the class itself rather than any instance, so it is shared across all objects`, wrongTexts: [`It makes the member private and inaccessible`, `It prevents the member from being modified`, `It automatically serialises the member to disk`], topic: 'Java', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Java, how does the 'ArrayList' differ from an array?`, correctText: `ArrayList is a resizable collection that automatically grows when elements are added; arrays have a fixed size set at creation`, wrongTexts: [`Arrays are faster for all operations`, `ArrayList can only store strings`, `Arrays and ArrayList are identical in Java`], topic: 'Java', category: 'Technical Skills' });
    }

    if (langLower === 'c') {
      resumeTechPool.push({ questionText: `In C, what is the purpose of a pointer variable?`, correctText: `A pointer stores the memory address of another variable, enabling direct memory access and manipulation`, wrongTexts: [`A pointer is a special type of integer`, `A pointer stores the value of a variable`, `A pointer is used only for function arguments`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what function is used to allocate memory dynamically at runtime on the heap?`, correctText: `malloc() (or calloc() / realloc())`, wrongTexts: [`alloc()`, `new()`, `reserve()`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what is the difference between pass-by-value and pass-by-pointer?`, correctText: `Pass-by-value sends a copy of the variable; pass-by-pointer sends the address so the function can modify the original`, wrongTexts: [`They behave identically`, `Pass-by-pointer is always slower`, `Pass-by-value is only for struct types`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what happens if you forget to call free() on a dynamically allocated memory block?`, correctText: `Memory leak — the allocated memory is not returned to the OS until the program terminates`, wrongTexts: [`The program automatically recycles the memory`, `The compiler raises a linker error`, `The OS immediately reclaims the memory`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What is a segmentation fault in C and what typically causes it?`, correctText: `A runtime error caused by accessing memory outside allocated bounds, such as dereferencing a NULL or dangling pointer`, wrongTexts: [`A compiler warning about unused variables`, `An error caused by an infinite loop`, `A type mismatch between int and float`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what is the role of the 'struct' keyword?`, correctText: `It defines a user-defined composite data type that groups related variables of different types under one name`, wrongTexts: [`It declares a function prototype`, `It allocates dynamic memory`, `It defines a class with methods`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, what is the difference between a stack and a heap memory region?`, correctText: `Stack memory is automatically managed for local variables and function calls; heap memory is manually managed with malloc/free for dynamic allocation`, wrongTexts: [`Stack memory is unlimited; heap is restricted`, `Heap memory is faster than stack memory`, `Stack and heap refer to the same memory region`], topic: 'C', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C, how do arrays and pointers relate to each other?`, correctText: `An array name decays to a pointer to its first element, so pointer arithmetic can be used to traverse array elements`, wrongTexts: [`Arrays and pointers are completely unrelated in C`, `Array indexing is always safer than pointer arithmetic`, `Pointers cannot point to array elements`], topic: 'C', category: 'Technical Skills' });
    }

    if (langLower === 'html') {
      resumeTechPool.push({ questionText: `In HTML, what is the purpose of semantic elements such as <header>, <main>, and <footer>?`, correctText: `They convey the meaning and structure of content to browsers and accessibility tools, improving SEO and readability`, wrongTexts: [`They only change the visual appearance of the page`, `They replace CSS stylesheets`, `They are required to use JavaScript`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In HTML forms, what does the 'action' attribute of a <form> element specify?`, correctText: `The URL to which the form data is submitted when the user clicks the submit button`, wrongTexts: [`The CSS class applied to the form`, `The method used for data encryption`, `The JavaScript function to validate input`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In HTML, which attribute is used to associate a <label> element with its corresponding input field for accessibility?`, correctText: `The 'for' attribute on <label> matching the 'id' attribute of the input`, wrongTexts: [`The 'name' attribute`, `The 'class' attribute`, `The 'aria' attribute`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What is the difference between block-level and inline HTML elements?`, correctText: `Block-level elements (e.g., <div>, <p>) take up the full width and start on a new line; inline elements (e.g., <span>, <a>) occupy only their content width`, wrongTexts: [`Block elements are only used for tables`, `Inline elements cannot contain text`, `There is no visual difference between them`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In HTML, what is the purpose of the <meta charset="UTF-8"> tag?`, correctText: `It declares the character encoding for the HTML document so the browser renders text characters correctly`, wrongTexts: [`It links an external stylesheet`, `It sets the page title in the browser tab`, `It defines the viewport width for mobile devices`], topic: 'HTML', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In HTML, what is the difference between the 'id' and 'class' attributes?`, correctText: `'id' must be unique per page and identifies a single element; 'class' can be shared by multiple elements for shared styling`, wrongTexts: [`'id' applies to multiple elements; 'class' applies to one`, `They are interchangeable attributes`, `'class' is deprecated in HTML5`], topic: 'HTML', category: 'Technical Skills' });
    }

    if (langLower === 'css') {
      resumeTechPool.push({ questionText: `In CSS, what does the box model consist of?`, correctText: `Content, Padding, Border, and Margin — from innermost to outermost`, wrongTexts: [`Header, Body, Footer, and Sidebar`, `Width, Height, Color, and Font`, `Flex, Grid, Float, and Position`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In CSS, what is the difference between 'position: relative' and 'position: absolute'?`, correctText: `Relative moves an element relative to its normal position without removing it from document flow; absolute removes it from flow and positions it relative to the nearest positioned ancestor`, wrongTexts: [`They are identical and produce the same layout`, `Absolute is for mobile only`, `Relative is deprecated in modern CSS`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What CSS property makes a container a Flexbox layout?`, correctText: `display: flex`, wrongTexts: [`flex: 1`, `layout: flex`, `align: flexbox`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In CSS, how do media queries enable responsive design?`, correctText: `They apply different CSS rules based on the device's screen width, resolution, or orientation`, wrongTexts: [`They detect the user's operating system and adjust fonts`, `They load different HTML files for mobile and desktop`, `They compress images automatically`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In CSS specificity, which selector type has the highest specificity?`, correctText: `Inline styles (style="...") have the highest specificity among normal declarations`, wrongTexts: [`Class selectors (.class)`, `Element selectors (div, p)`, `Universal selectors (*)`], topic: 'CSS', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In CSS, what is the purpose of the 'z-index' property?`, correctText: `It controls the stacking order of positioned elements; higher z-index values appear in front of lower ones`, wrongTexts: [`It sets the element's opacity level`, `It controls the element's horizontal alignment`, `It defines the element's font size`], topic: 'CSS', category: 'Technical Skills' });
    }

    if (langLower === 'c++') {
      resumeTechPool.push({ questionText: `In C++, what is the purpose of a constructor and destructor?`, correctText: `A constructor initialises an object when it is created; a destructor releases resources when the object is destroyed`, wrongTexts: [`Constructors are only used for static objects`, `Destructors increase memory usage`, `Both are optional in C++`], topic: 'C++', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C++, what is function overloading?`, correctText: `Defining multiple functions with the same name but different parameter types or counts, resolved at compile time`, wrongTexts: [`Calling the same function from different classes`, `Overriding a virtual function in a derived class`, `Using templates to generate functions`], topic: 'C++', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In C++, what does the 'virtual' keyword enable?`, correctText: `Runtime polymorphism — the correct overridden method in a derived class is called via a base class pointer or reference`, wrongTexts: [`It makes the function run faster`, `It prevents the function from being called`, `It declares the function as a template`], topic: 'C++', category: 'Technical Skills' });
    }

    if (langLower === 'javascript') {
      resumeTechPool.push({ questionText: `In JavaScript, what is the difference between 'let', 'const', and 'var'?`, correctText: `'var' is function-scoped and hoisted; 'let' and 'const' are block-scoped — 'let' allows reassignment while 'const' does not`, wrongTexts: [`They are completely interchangeable`, `'const' prevents the object from being modified`, `'var' is block-scoped in strict mode`], topic: 'JavaScript', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In JavaScript, what does the 'async/await' syntax do?`, correctText: `It allows writing asynchronous code in a synchronous style by pausing execution at 'await' until a Promise resolves`, wrongTexts: [`It creates multithreaded workers`, `It synchronously blocks the event loop`, `It replaces callbacks and Promises entirely`], topic: 'JavaScript', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In JavaScript, what is the difference between '==' and '==='?`, correctText: `'==' performs type coercion before comparing; '===' (strict equality) requires both value and type to match`, wrongTexts: [`They are identical operators`, `'===' only works with numbers`, `'==' is deprecated in modern JavaScript`], topic: 'JavaScript', category: 'Technical Skills' });
    }

    if (langLower === 'sql') {
      resumeTechPool.push({ questionText: `In SQL, what is the difference between INNER JOIN and LEFT JOIN?`, correctText: `INNER JOIN returns only matching rows from both tables; LEFT JOIN returns all rows from the left table plus matching rows from the right (NULL if no match)`, wrongTexts: [`They produce identical result sets`, `LEFT JOIN is deprecated`, `INNER JOIN includes unmatched rows from both tables`], topic: 'SQL', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In SQL, what is the purpose of the GROUP BY clause?`, correctText: `It groups rows that share the same values in specified columns so aggregate functions (COUNT, SUM, AVG) can be applied per group`, wrongTexts: [`It sorts the result set alphabetically`, `It filters rows like the WHERE clause`, `It joins two tables on a common column`], topic: 'SQL', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In SQL, what does the HAVING clause do, and how does it differ from WHERE?`, correctText: `HAVING filters groups after GROUP BY aggregation; WHERE filters individual rows before aggregation`, wrongTexts: [`HAVING and WHERE are interchangeable`, `WHERE filters after GROUP BY`, `HAVING replaces the GROUP BY clause`], topic: 'SQL', category: 'Technical Skills' });
    }
  }); // end resumeLangs.forEach

  // --- Framework-based questions ---
  resumeFworks.forEach((fw) => {
    const fwLower = fw.toLowerCase();

    resumeTechPool.push({
      questionText: `When developing with ${fw}, what is the recommended approach for fetching external data on component or module initialisation?`,
      correctText: `Using asynchronous API calls inside lifecycle hooks or controller middleware`,
      wrongTexts: [`Fetching data inside CSS stylesheets`, `Reloading the page on every render`, `Hardcoding data in the component template`],
      topic: fw, category: 'Technical Skills'
    });

    if (fwLower === 'react') {
      resumeTechPool.push({ questionText: `In React, what is the purpose of the 'useState' hook?`, correctText: `It declares a stateful variable and a setter function that triggers a re-render when the state changes`, wrongTexts: [`It fetches data from an API`, `It handles routing between pages`, `It applies CSS styles dynamically`], topic: 'React', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In React, how do you pass data from a parent component to a child component?`, correctText: `Through props — the parent includes the data as an attribute on the child component's JSX element`, wrongTexts: [`Through global window variables`, `By directly modifying the child's state`, `Through the browser's localStorage`], topic: 'React', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In React, what problem does the 'useEffect' hook solve?`, correctText: `It lets you perform side effects (data fetching, subscriptions, DOM manipulation) after a component renders`, wrongTexts: [`It prevents re-renders`, `It defines global CSS styles`, `It creates new React contexts`], topic: 'React', category: 'Technical Skills' });
    }
    if (fwLower === 'django' || fwLower === 'flask') {
      resumeTechPool.push({ questionText: `In ${fw}, how are URL routes mapped to view functions?`, correctText: `Through URL configuration patterns that associate URL paths with handler functions or class-based views`, wrongTexts: [`Through CSS file imports`, `Through database schema definitions`, `Through frontend JavaScript routing`], topic: fw, category: 'Technical Skills' });
    }
    if (fwLower === 'express' || fwLower.includes('node')) {
      resumeTechPool.push({ questionText: `In ${fw}, what is the role of middleware functions in the request-response cycle?`, correctText: `Middleware functions execute between receiving a request and sending a response, handling tasks like authentication, logging, and body parsing`, wrongTexts: [`Middleware only handles database connections`, `Middleware replaces route handlers`, `Middleware is executed only on errors`], topic: fw, category: 'Technical Skills' });
    }
    if (fwLower === 'bootstrap') {
      resumeTechPool.push({ questionText: `In Bootstrap, how does the grid system create responsive layouts?`, correctText: `Using a 12-column fluid grid with breakpoint-specific column classes (e.g., col-md-6) that rearrange at different screen widths`, wrongTexts: [`Through custom CSS variables only`, `By loading separate HTML files per device`, `Using JavaScript animations`], topic: 'Bootstrap', category: 'Technical Skills' });
    }
    if (fwLower === 'tailwind') {
      resumeTechPool.push({ questionText: `In Tailwind CSS, how do you apply responsive styles to an element?`, correctText: `Using breakpoint prefix classes such as 'md:text-lg' or 'lg:flex' that activate at specified screen widths`, wrongTexts: [`Writing separate CSS files for each screen size`, `Using JavaScript media query listeners`, `Adding inline style attributes`], topic: 'Tailwind', category: 'Technical Skills' });
    }
  });

  // --- Database-based questions ---
  resumeDbs.forEach((db) => {
    const dbLower = db.toLowerCase();
    resumeTechPool.push({ questionText: `In ${db}, which technique is most effective for accelerating search query performance on large datasets?`, correctText: `Creating indexes on frequently queried fields and projecting only required fields`, wrongTexts: [`Performing full collection/table scans on every request`, `Removing primary key constraints`, `Disabling query caching`], topic: db, category: 'DBMS' });
    resumeTechPool.push({ questionText: `In ${db}, how do you ensure entity uniqueness and prevent duplicate records?`, correctText: `Enforcing unique constraints, primary keys, or unique index rules on the relevant fields`, wrongTexts: [`Allowing all inserts and handling duplicates in the application layer`, `Removing all schema validation`, `Storing records in flat text files`], topic: db, category: 'DBMS' });
    if (dbLower === 'mongodb') {
      resumeTechPool.push({ questionText: `In MongoDB, what is the difference between embedding documents and referencing documents?`, correctText: `Embedding stores related data in the same document for fast reads; referencing stores a link (ObjectId) to another document, better for large or frequently updated data`, wrongTexts: [`They are identical in performance`, `Referencing is always faster than embedding`, `Embedding is only for arrays of strings`], topic: 'MongoDB', category: 'DBMS' });
      resumeTechPool.push({ questionText: `In MongoDB, what is the purpose of an index?`, correctText: `An index is a data structure that improves query speed by allowing MongoDB to find documents without scanning every document in the collection`, wrongTexts: [`Indexes store backup copies of collections`, `Indexes replace the need for a schema`, `Indexes are only used for sorting`], topic: 'MongoDB', category: 'DBMS' });
    }
    if (dbLower === 'mysql' || dbLower === 'postgresql') {
      resumeTechPool.push({ questionText: `In ${db}, what is the purpose of a foreign key constraint?`, correctText: `It enforces referential integrity by ensuring a column value in one table matches a primary key in another table`, wrongTexts: [`It speeds up SELECT queries`, `It prevents NULL values in a column`, `It encrypts sensitive column data`], topic: db, category: 'DBMS' });
      resumeTechPool.push({ questionText: `In ${db}, what is a database transaction and what does ACID stand for?`, correctText: `A transaction is a unit of work that must complete fully or not at all; ACID stands for Atomicity, Consistency, Isolation, Durability`, wrongTexts: [`A transaction is just a SELECT query`, `ACID stands for Asynchronous Concurrent I/O Dispatcher`, `Transactions are only needed for DELETE operations`], topic: db, category: 'DBMS' });
    }
    if (dbLower === 'firebase') {
      resumeTechPool.push({ questionText: `In Firebase Realtime Database, how does data synchronisation work between clients?`, correctText: `Data is stored as JSON and synchronised in real-time to all connected clients whenever it changes`, wrongTexts: [`Clients must poll the server every 5 seconds`, `Data is sent only on page refresh`, `Firebase uses SOAP XML for synchronisation`], topic: 'Firebase', category: 'DBMS' });
    }
    if (dbLower === 'sqlite') {
      resumeTechPool.push({ questionText: `What makes SQLite different from client-server database systems like MySQL?`, correctText: `SQLite is a serverless, file-based database that runs in-process with the application, requiring no separate server setup`, wrongTexts: [`SQLite requires a dedicated server process`, `SQLite supports unlimited concurrent writes`, `SQLite stores data in JSON files`], topic: 'SQLite', category: 'DBMS' });
    }
  });

  // --- Technology-based questions ---
  resumeTechs.forEach((tech) => {
    const techLower = tech.toLowerCase();

    resumeTechPool.push({
      questionText: `When integrating ${tech} into your development workflow, what is the best practice for storing sensitive configuration credentials?`,
      correctText: `Storing secrets in environment variables (.env files) outside version control repositories`,
      wrongTexts: [`Hardcoding API keys in public source code commits`, `Embedding passwords in HTML template files`, `Storing credentials in browser localStorage`],
      topic: tech, category: 'Technologies'
    });

    if (techLower === 'git' || techLower === 'github') {
      resumeTechPool.push({ questionText: `In Git version control, what is the standard workflow for integrating a feature branch into the main production branch?`, correctText: `Creating a Pull Request (PR), performing a code review, and merging after approval`, wrongTexts: [`Force pushing the feature branch directly to main`, `Deleting the repository and re-cloning`, `Overwriting local changes without committing`], topic: tech, category: 'Technologies' });
      resumeTechPool.push({ questionText: `In Git, what is the purpose of the 'git stash' command?`, correctText: `It temporarily saves uncommitted changes so you can switch branches without committing incomplete work`, wrongTexts: [`It permanently deletes uncommitted changes`, `It pushes changes to a remote branch`, `It merges two branches together`], topic: tech, category: 'Technologies' });
      resumeTechPool.push({ questionText: `What is a Git branch and why is it used in collaborative development?`, correctText: `A branch is a lightweight movable pointer to a commit that lets developers work on features or fixes in isolation without affecting the main codebase`, wrongTexts: [`A branch is a copy of the entire repository`, `Branches are only used for backup purposes`, `Branches eliminate the need for commits`], topic: tech, category: 'Technologies' });
      resumeTechPool.push({ questionText: `In Git, what does 'git rebase' do, and how does it differ from 'git merge'?`, correctText: `Rebase replays commits from one branch on top of another creating a linear history; merge creates a merge commit preserving branch history`, wrongTexts: [`Rebase deletes remote branches`, `Merge is faster than rebase in all cases`, `They produce identical commit histories`], topic: tech, category: 'Technologies' });
      resumeTechPool.push({ questionText: `In Git, what is the difference between 'git fetch' and 'git pull'?`, correctText: `'git fetch' downloads remote changes without merging; 'git pull' fetches and automatically merges the remote branch into the current local branch`, wrongTexts: [`They are identical commands`, `'git pull' only downloads code; 'git fetch' merges it`, `'git fetch' deletes local branches`], topic: tech, category: 'Technologies' });
    }

    if (techLower === 'aws') {
      resumeTechPool.push({ questionText: `In AWS, what is the primary purpose of Amazon S3?`, correctText: `Scalable object storage for files, backups, static website hosting, and data archiving`, wrongTexts: [`Running virtual machines`, `Managing relational databases`, `Setting up a content delivery network`], topic: 'AWS', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In AWS, what does EC2 provide?`, correctText: `On-demand virtual server instances (compute) that can be configured with different OS, CPU, and memory`, wrongTexts: [`A managed NoSQL database service`, `A DNS routing service`, `An email delivery platform`], topic: 'AWS', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In AWS cloud computing, what is the shared responsibility model?`, correctText: `AWS is responsible for the security OF the cloud (hardware, infrastructure); customers are responsible for security IN the cloud (data, IAM, app config)`, wrongTexts: [`AWS manages all customer application code and data`, `Customers manage the physical data centre hardware`, `Both parties have no security responsibilities`], topic: 'AWS', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In AWS, what is an IAM role and why is it used?`, correctText: `An IAM role grants specific permissions to AWS services or users without sharing long-term credentials, following the principle of least privilege`, wrongTexts: [`An IAM role is a type of EC2 instance`, `IAM roles store application database credentials`, `IAM roles replace virtual private clouds`], topic: 'AWS', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In AWS, what is the difference between vertical and horizontal scaling?`, correctText: `Vertical scaling increases the capacity of a single server (more CPU/RAM); horizontal scaling adds more server instances to distribute load`, wrongTexts: [`They are the same concept`, `Horizontal scaling increases a single server's CPU`, `Vertical scaling adds more servers`], topic: 'AWS', category: 'Technologies' });
    }

    if (techLower === 'machine learning') {
      resumeTechPool.push({ questionText: `In Machine Learning, what is the difference between supervised and unsupervised learning?`, correctText: `Supervised learning trains models on labelled data with known outputs; unsupervised learning finds patterns in unlabelled data without predefined answers`, wrongTexts: [`Supervised learning uses more data`, `Unsupervised learning always produces more accurate models`, `There is no practical difference`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Machine Learning, what is overfitting and how can it be prevented?`, correctText: `Overfitting occurs when a model learns training data too closely and fails to generalise; it can be prevented by regularisation, cross-validation, or using more diverse training data`, wrongTexts: [`Overfitting means the model underfits the training data`, `It is solved by increasing the number of features`, `Overfitting only occurs in unsupervised models`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Machine Learning classification, what does the term 'precision' measure?`, correctText: `The proportion of predicted positives that are actually positive: TP / (TP + FP)`, wrongTexts: [`The proportion of actual positives correctly identified (that is recall)`, `The overall accuracy of the model`, `The number of training epochs`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What is the role of a training set and a test set in a Machine Learning workflow?`, correctText: `The training set is used to fit the model; the test set is held out to evaluate how well the model generalises to unseen data`, wrongTexts: [`Both sets are used simultaneously during training`, `The test set is used to tune hyperparameters`, `The training set is always smaller than the test set`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `In Machine Learning, what is the purpose of feature scaling (e.g., normalisation or standardisation)?`, correctText: `It ensures that features with large numeric ranges do not dominate gradient descent or distance-based algorithms, leading to faster and more stable convergence`, wrongTexts: [`It removes outliers from the dataset`, `It converts categorical variables to numbers`, `It is only needed for neural networks`], topic: 'Machine Learning', category: 'Technical Skills' });
      resumeTechPool.push({ questionText: `What does a confusion matrix show in a Machine Learning classification task?`, correctText: `It shows the counts of True Positives, True Negatives, False Positives, and False Negatives, providing a detailed view of classification performance`, wrongTexts: [`It displays the model's weight parameters`, `It shows the training loss curve over epochs`, `It visualises the feature importance rankings`], topic: 'Machine Learning', category: 'Technical Skills' });
    }

    if (techLower === 'docker') {
      resumeTechPool.push({ questionText: `In Docker, what is the difference between a Docker image and a Docker container?`, correctText: `An image is a read-only template; a container is a running instance of that image`, wrongTexts: [`Images run code while containers store it`, `They are the same thing`, `Containers are stored on disk; images run in memory`], topic: 'Docker', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In Docker, what is the purpose of a Dockerfile?`, correctText: `A text file with instructions that Docker uses to automatically build a container image layer by layer`, wrongTexts: [`A configuration file for Docker network routing`, `A script to install Docker on a server`, `A log file generated during container runtime`], topic: 'Docker', category: 'Technologies' });
    }

    if (techLower === 'rest api' || techLower === 'rest apis') {
      resumeTechPool.push({ questionText: `In REST API design, which HTTP method is explicitly defined as idempotent for updating or replacing an existing resource?`, correctText: `PUT`, wrongTexts: [`POST`, `GET`, `PATCH`], topic: 'REST APIs', category: 'Technologies' });
      resumeTechPool.push({ questionText: `In REST API architecture, what does the term 'stateless' mean?`, correctText: `Each request from the client must contain all information needed to process it; the server does not store session state between requests`, wrongTexts: [`The server stores all client session data in memory`, `The API requires cookies on every request`, `Stateless means the API has no authentication`], topic: 'REST APIs', category: 'Technologies' });
    }
  }); // end resumeTechs.forEach

  // --- Project-based question pools ---
  const easyProject = project1 ? [
    { questionText: `In your resume project '${project1.name}', what is the core purpose and functionality of the system?`, correctText: `${project1.functionality || 'Providing user services, data tracking, and record management'}`, wrongTexts: [`Serving only static HTML documents`, `Compiling C++ binaries`, `Operating hardware sensors`], topic: project1.name, category: 'Projects' },
    { questionText: `Which main technology was used in building your resume project '${project1.name}'?`, correctText: `${(project1.technologies && project1.technologies[0]) || pickLang || pickFwork || 'The primary technology listed in the resume'}`, wrongTexts: [`Legacy Fortran compiler`, `Assembly language runtime`, `Hardcoded static HTML files`], topic: project1.name, category: 'Tech Stack Decisions' },
    { questionText: `What user role or development responsibility did you perform while working on '${project1.name}'?`, correctText: `${project1.role || 'Designing backend logic, UI components, and data integrations'}`, wrongTexts: [`Graphic logo designing only`, `Manual paper documentation printing`, `Hardware network cabling`], topic: project1.name, category: 'Projects' }
  ] : [];

  const mediumProject = project1 ? [
    { questionText: `In your resume project '${project1.name}', how does the system handle user input before processing it?`, correctText: `By applying validation checks and sanitisation before executing any business logic or data queries`, wrongTexts: [`Trusting all raw client string input without checking`, `Clearing database records on invalid input`, `Disabling HTTP error response codes`], topic: project1.name, category: 'Project Architecture' },
    { questionText: `When designing '${project1.name}', how did you structure data storage to avoid redundancy?`, correctText: `Using structured schemas with references or embedded sub-documents based on data access patterns`, wrongTexts: [`Storing all records in a single unformatted text file`, `Duplicating data across every user row`, `Disabling unique constraints`], topic: project1.name, category: 'Database Design' },
    { questionText: `In '${project1.name}', how does the client communicate with the backend service?`, correctText: `Via asynchronous HTTP fetch/axios requests to REST API endpoints`, wrongTexts: [`Using low-level UDP datagram packets`, `Through manual file downloads`, `Via browser cookies only`], topic: project1.name, category: 'API Communication' },
    { questionText: `What key technical challenge did you encounter during the development of '${project1.name}', and how was it solved?`, correctText: `Identifying and resolving a performance or logic issue through debugging, code review, and iterative testing`, wrongTexts: [`Bypassing security checks`, `Hardcoding temporary values in production`, `Ignoring system error trace logs`], topic: project1.name, category: 'Deployment & Challenges' }
  ] : [];

  const hardProject = project1 ? [
    { questionText: `In your resume project '${project1.name}', what security measure protects the system from unauthorised access?`, correctText: `Implementing authentication and authorisation checks (e.g., token-based auth, role checks) on sensitive routes`, wrongTexts: [`Storing plain-text passwords in localStorage`, `Disabling all error messages`, `Hardcoding admin credentials in source code`], topic: project1.name, category: 'Security & Auth' },
    { questionText: `If traffic on '${project1.name}' increased by 10x, what architectural optimisation would best prevent query bottlenecks?`, correctText: `Deploying an in-memory caching layer and optimising frequently queried data structures or indexes`, wrongTexts: [`Disabling database indexes`, `Increasing client polling rates`, `Compressing only static CSS files`], topic: project1.name, category: 'Project Architecture' },
    { questionText: `When deploying updates for '${project1.name}', how do you ensure backward compatibility with existing data?`, correctText: `Using backward-compatible schema migrations and staged deployment strategies`, wrongTexts: [`Dropping all production tables during peak traffic hours`, `Editing raw code files directly on live servers`, `Deleting all database backup snapshots`], topic: project1.name, category: 'Deployment & Challenges' }
  ] : [];

  // ================================================================
  // SELECT THE APPROPRIATE CANDIDATE POOL
  // ================================================================
  let candidatePool = [];

  if (modeType === 'Technical') {
    candidatePool = resumeTechPool;
  } else if (modeType === 'Project-based') {
    if (requestedDiff === 'Easy') candidatePool = easyProject;
    else if (requestedDiff === 'Hard') candidatePool = hardProject;
    else candidatePool = mediumProject.concat(easyProject);
  } else {
    // Mixed Mode
    if (isProjectCategory) {
      if (requestedDiff === 'Easy') candidatePool = easyProject;
      else if (requestedDiff === 'Hard') candidatePool = hardProject;
      else candidatePool = mediumProject.concat(easyProject);
    } else {
      candidatePool = resumeTechPool;
    }
  }

  // If no skill-specific questions could be built (e.g., zero skills in resume), use dynamic synthesis
  if (candidatePool.length === 0) {
    return generateDynamicSynthesizedQuestion(resumeData, { category: targetCategory, difficulty: requestedDiff }, nextIndex, forceTargetPos !== undefined ? forceTargetPos : Math.floor(Math.random() * 4), usedQuestionTexts, modeType);
  }

  // ================================================================
  // FILTER OUT ALREADY-USED QUESTIONS
  // ================================================================
  const freshItems = candidatePool.filter(item => !isDuplicateQuestion(item.questionText, Array.from(usedQuestionTexts)));

  let rawItem = null;
  if (freshItems.length > 0) {
    rawItem = freshItems[nextIndex % freshItems.length];
  } else {
    // Pool exhausted — synthesise a fresh aspect from resume skills
    return generateDynamicSynthesizedQuestion(resumeData, { category: targetCategory, difficulty: requestedDiff }, nextIndex, forceTargetPos !== undefined ? forceTargetPos : Math.floor(Math.random() * 4), usedQuestionTexts, modeType);
  }

  // ================================================================
  // BUILD MCQ ANSWER OPTIONS
  // ================================================================
  const targetPos = forceTargetPos !== undefined ? forceTargetPos : Math.floor(Math.random() * 4);
  const wrongShuffled = shuffleArray(rawItem.wrongTexts || []);

  const finalChoiceTexts = [];
  let wrongIdx = 0;
  for (let p = 0; p < 4; p++) {
    if (p === targetPos) {
      finalChoiceTexts.push(rawItem.correctText);
    } else {
      finalChoiceTexts.push(wrongShuffled[wrongIdx++] || 'N/A');
    }
  }

  const options = finalChoiceTexts.map((text, i) => `${String.fromCharCode(65 + i)}) ${text}`);
  const correctAnswer = options[targetPos];

  return {
    questionText: rawItem.questionText,
    options,
    correctAnswer,
    correctOption: correctAnswer,
    topic: rawItem.topic || 'Technical',
    difficulty: requestedDiff,
    category: rawItem.category || targetCategory
  };
}



function mockEvaluateAnswer(questionText, topic, candidateAnswer, correctAnswer) {
  console.log("Checking candidate answer against correctAnswer:", correctAnswer);
  const cleanAnswer = (candidateAnswer || "").trim();
  const targetCorrect = (correctAnswer || "").trim();

  let score = 0;
  let feedback = "No option was selected or response was unanswered.";

  if (cleanAnswer.length > 0) {
    if (targetCorrect && cleanAnswer === targetCorrect) {
      score = 10.0;
      feedback = `Correct choice! You selected "${cleanAnswer}".`;
    } else if (targetCorrect) {
      score = 0.0;
      feedback = `Incorrect choice. You selected "${cleanAnswer}". The correct answer is "${targetCorrect}".`;
    } else {
      score = 10.0;
      feedback = `Selected option: "${cleanAnswer}". Answer recorded.`;
    }
  }

  return {
    technicalAccuracy: score,
    relevance: score,
    depth: score,
    clarity: score,
    overallScore: score,
    feedback
  };
}

function mockGenerateFinalReport(resumeData, interviewSession) {
  console.log("Using Performance Analysis Report Generator.");
  return buildPerformanceAnalysis(resumeData, interviewSession);
}

module.exports = {
  analyzeResume,
  generateNextQuestion,
  generateAllQuestions,
  evaluateAnswer,
  generateFinalReport,
  isAnswerCorrect,
  buildPerformanceAnalysis,
  mockGenerateAllQuestions,
  mockGenerateQuestion
};
