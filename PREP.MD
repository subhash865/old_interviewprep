# AI Interview Preparation System - Complete Project Flow Documentation

## 🎯 Project Overview

This is an **AI-Powered Interview Preparation System** that conducts mock behavioral and technical interviews. It analyzes your resume against a job description, generates context-aware questions using AI, evaluates your spoken answers, and provides fairness audits.

**Key Features:**
- Resume & JD Processing via Llama 3
- Dynamic question generation with DeepSeek-R1
- Voice answer capture and transcription via Whisper
- Multi-criteria evaluation with detailed feedback
- Fairness auditing with Mistral 7B
- Analytics dashboard with progression tracking

---

## 🏗️ System Architecture

### **Technology Stack**

**Frontend:**
- React 18
- Vite (build tool)
- Tailwind CSS V4
- Lucide React (icons)
- React Router (navigation)

**Backend:**
- Node.js
- Express.js
- Axios (HTTP requests)
- Multer (file uploads)
- JWT (authentication)
- bcryptjs (password hashing)
- Express Rate Limit

**Database:**
- MongoDB (via Mongoose ORM)
- Prisma Configuration

**AI/LLM Services:**
- DeepSeek-R1 (reasoning & evaluation)
- Mistral 7B (fairness auditing)
- Whisper (speech-to-text)
- Llama 3 8B (skill extraction)

**Infrastructure:**
- Docker Compose (MongoDB container)
- Deployment ready for Render/Vercel

---

## 📋 Detailed Step-by-Step Flow

### **Phase 1: User Authentication**

```
User arrives at home page
    ↓
User registers (email, name, password) via POST /api/auth/register
    ↓
Backend hashes password with bcryptjs & stores in MongoDB
    ↓
User logs in via POST /api/auth/login
    ↓
Backend verifies credentials & generates JWT token
    ↓
Frontend stores JWT in localStorage for future API requests
    ↓
User authenticated and ready to setup interview
```

**Backend Implementation:**
- Route: `POST /api/auth/register` - Creates new user account
- Route: `POST /api/auth/login` - Validates credentials, returns JWT token
- Middleware: `authenticateToken` - Validates JWT on protected routes
- Security: Rate limiting (100 requests per 15 minutes), CORS enabled

---

### **Phase 2: Interview Setup**

```
User clicks "Setup Interview" (Protected Route - requires JWT)
    ↓
User uploads:
  • Resume (PDF file)
  • Job Role (text input)
  • Job Description (text description)
    ↓
Frontend sends multipart/form-data to POST /api/interview/start
    ↓
Backend processes in sequence:
  
  Step 1: Resume Parser Service
  ├─ Receives PDF file from request
  ├─ Reads file buffer
  ├─ Extracts text using pdf-parse library
  ├─ Returns structured resume text
  └─ Deletes temporary file
  
  Step 2: JD Processor Service
  ├─ Receives raw job description text
  ├─ Cleans formatting and standardizes text
  ├─ Removes noise and duplicates
  └─ Returns cleaned JD text
  
  Step 3: Skill Matcher Service
  ├─ Calls Llama 3 8B LLM via Groq API
  ├─ Sends: "Extract key skills from resume and JD"
  ├─ Receives: Skills list for each
  ├─ Compares skills between resume and JD
  ├─ Calculates match percentage (0-100)
  ├─ Returns: skillsMatch object { skill: matchScore }
  └─ Identifies skill gaps
    ↓
Backend creates Session document in MongoDB:
  {
    _id: ObjectId (unique session ID),
    userId: ObjectId (reference to user),
    jobRole: "Software Engineer",
    jdText: "[cleaned job description]",
    resumeText: "[extracted resume text]",
    skillsMatch: { 
      "Node.js": 85,
      "React": 90,
      "MongoDB": 70,
      "Docker": 45 
    },
    yoe: 5 (years of experience),
    mode: "interview",
    createdAt: [timestamp],
    completedAt: null
  }
    ↓
Response sent to frontend with:
  ├─ sessionId (for future API calls)
  └─ skillsMatch (shows user their strength areas)
    ↓
Frontend redirects to Interview Room
```

**Key Files Involved:**
- Route: [backend/src/routes/interviewRoutes.js](backend/src/routes/interviewRoutes.js)
- Service: [backend/src/services/resumeService.js](backend/src/services/resumeService.js) - PDF parsing
- Service: [backend/src/services/jdService.js](backend/src/services/jdService.js) - JD cleaning
- Service: [backend/src/services/matchingService.js](backend/src/services/matchingService.js) - Skill matching
- Model: [backend/src/models/Session.js](backend/src/models/Session.js) - Session schema

---

### **Phase 3: Interview Question Generation**

```
User enters Interview Room with sessionId URL parameter
    ↓
Frontend displays previous scores and interview stats
    ↓
User clicks "Get Next Question" button
    ↓
Frontend sends POST /api/interview/:sessionId/question
  ├─ Headers: Authorization: Bearer [JWT token]
  └─ Body: { difficulty: "Intermediate" } (optional)
    ↓
Backend authenticates user (verifies JWT and sessionId ownership)
    ↓
Backend prepares context:
  1. Fetches current session from MongoDB
     ├─ Retrieves resumeText
     ├─ Retrieves jdText
     └─ Validates user owns this session
  
  2. Fetches all previous questions for this session
     └─ Creates list of question texts to avoid duplicates
    ↓
Question Generator Service calls DeepSeek-R1:
  
  System Prompt:
  "You are an expert technical interviewer specializing in 
   [job role]. Generate ONE challenging interview question 
   based on the resume and job description provided."
  
  User Prompt:
  "Resume: [extracted resume text]
   Job Description: [cleaned JD]
   Previous Questions: [list of existing questions]
   Difficulty: [Easy/Intermediate/Hard]"
    ↓
DeepSeek-R1 responds with:
  ├─ question: "Based on your resume showing Node.js experience 
                and this role requiring microservices design, 
                walk me through how you'd architect a scalable 
                multi-tenant SaaS system."
  ├─ difficulty: "Hard"
  └─ reasoning: "[optional context about question relevance]"
    ↓
Backend creates Question document:
  {
    _id: ObjectId (question ID),
    sessionId: ObjectId (reference),
    text: "[generated question]",
    difficulty: "Hard",
    createdAt: [timestamp]
  }
    ↓
Response sent to frontend with:
  ├─ questionId (for answer submission)
  ├─ question text
  ├─ difficulty level
  └─ reasoning
    ↓
Frontend displays question on screen
    ↓
User reads question and prepares answer
```

**Key Files Involved:**
- Service: [backend/src/services/questionService.js](backend/src/services/questionService.js) - Question generation
- Orchestrator: [backend/src/llm/orchestrator.js](backend/src/llm/orchestrator.js) - LLM API calls
- Model: [backend/src/models/Question.js](backend/src/models/Question.js) - Question schema

---

### **Phase 4: Audio Recording & Transcription**

```
User sees question displayed on screen
    ↓
User clicks "Start Recording" button
    ↓
Frontend requests microphone permission from browser
    ↓
Browser Web Audio API starts capturing audio stream
    ↓
User speaks their answer (browser records in real-time)
    ↓
Waveform visualization updates as user speaks
    ↓
User clicks "Stop Recording" button
    ↓
Frontend processes recorded audio:
  ├─ Converts Web Audio PCM data to WebM/MP3 format
  ├─ Creates Blob object from audio data
  └─ Prepares for upload
    ↓
User clicks "Submit Answer" button
    ↓
Frontend sends POST /api/interview/:sessionId/answer/:questionId
  ├─ Method: multipart/form-data
  ├─ Headers: Authorization: Bearer [JWT token]
  └─ Body: { audio: [WebM/MP3 file blob] }
    ↓
Backend receives file upload
    ↓
Multer middleware processes upload:
  ├─ Validates file size
  ├─ Stores temporarily in uploads/ directory
  └─ Assigns temporary filename
    ↓
Audio Transcriber Service:
  
  1. Reads audio file from disk
  2. Sends to Whisper API via Groq:
     
     API Call: POST https://api.groq.com/openai/v1/audio/transcriptions
     ├─ model: "whisper-large-v3"
     ├─ file: [audio bytes]
     └─ language: "en"
  
  3. Receives back text transcript:
     "So the way I would approach this is first I would analyze 
      the requirements carefully. Then I would identify the key 
      components needed for a microservices architecture..."
  
  4. Cleans up audio file from disk
    ↓
Backend creates Answer document:
  {
    _id: ObjectId (answer ID),
    questionId: ObjectId (reference),
    sessionId: ObjectId (reference),
    transcript: "[transcribed text]",
    audioTranscriptionModel: "whisper-large-v3",
    createdAt: [timestamp]
  }
    ↓
Frontend shows "Processing..." indicator
```

**Key Files Involved:**
- Service: [backend/src/services/audioService.js](backend/src/services/audioService.js) - Transcription
- Model: [backend/src/models/Answer.js](backend/src/models/Answer.js) - Answer schema

---

### **Phase 5: Answer Evaluation (Two-Stage Process)**

#### **Stage 5A: DeepSeek Evaluation**

```
Evaluator Service receives:
  ├─ questionText: "[the interview question]"
  ├─ answerTranscript: "[user's spoken answer]"
  └─ questionId & sessionId for context
    ↓
Prepares detailed evaluation prompt:
  
  System Prompt:
  "You are a strict, objective, and expert technical interviewer 
   evaluating a candidate's answer. Analyze the user's answer to 
   the provided question.
   
   You MUST provide reasoning for each score before arriving at 
   the score.
   
   Scoring Rubric (0-10 for each):
   - Technical Accuracy: Correctness of concepts and implementations
   - Relevance to the question: How well answer addresses the prompt
   - Depth of knowledge: Level of understanding demonstrated
   - Clarity of explanation: How well the ideas are communicated
   - Structure of the answer: Organization and logical flow
   - Confidence Score: Assessment based on filler words, directness
   
   Output EXACTLY valid JSON with specific structure."
  
  User Prompt:
  "Question: Based on your resume, how would you design a 
             microservices architecture?
   
   Candidate Answer (Transcript):
   So the way I would approach this is first I would analyze 
   the requirements. Then I would identify the key components..."
    ↓
Calls DeepSeek-R1 via Groq API:
  
  API Call: POST https://api.groq.com/openai/v1/chat/completions
  ├─ model: "deepseek-r1-distill-llama-70b"
  ├─ temperature: 0.2 (low for consistent scoring)
  ├─ response_format: { type: "json_object" }
  └─ messages: [system prompt, user prompt]
    ↓
DeepSeek analyzes answer and returns JSON:
  {
    "reasoningTech": "The candidate mentions microservices 
                     separation and load balancing correctly, 
                     showing solid understanding of distributed 
                     systems concepts.",
    "scoreTech": 8,
    
    "reasoningRelevance": "The answer directly addresses the 
                          architectural design question and 
                          mentions relevant patterns.",
    "scoreRelevance": 9,
    
    "reasoningDepth": "While the candidate explains basic concepts, 
                      they don't go deep into trade-offs or failure 
                      scenarios.",
    "scoreDepth": 6,
    
    "reasoningClarity": "Explanation is well-structured and easy 
                        to follow with concrete examples.",
    "scoreClarity": 8,
    
    "reasoningStructure": "Follows a logical progression from 
                          analysis to design to implementation.",
    "scoreStructure": 9,
    
    "reasoningConfidence": "Minimal filler words, speaks with 
                           authority on familiar topics but 
                           hesitates on edge cases.",
    "scoreConfidence": 7,
    
    "generalFeedback": "Strong foundation in microservices concepts. 
                       Focus on explaining trade-offs and failure 
                       handling to demonstrate expert-level thinking. 
                       Consider mentioning circuit breakers, 
                       eventually consistency patterns, and data 
                       partitioning strategies."
  }
    ↓
Backend creates Evaluation document:
  {
    _id: ObjectId (evaluation ID),
    answerId: ObjectId (reference),
    questionId: ObjectId (reference),
    sessionId: ObjectId (reference),
    scoreTech: 8,
    reasoningTech: "[as above]",
    scoreRelevance: 9,
    reasoningRelevance: "[as above]",
    scoreDepth: 6,
    reasoningDepth: "[as above]",
    scoreClarity: 8,
    reasoningClarity: "[as above]",
    scoreStructure: 9,
    reasoningStructure: "[as above]",
    scoreConfidence: 7,
    reasoningConfidence: "[as above]",
    generalFeedback: "[as above]",
    averageScore: (8+9+6+8+9+7)/6 = 7.83,
    evaluatedAt: [timestamp]
  }
    ↓
Evaluation stored in database
```

#### **Stage 5B: Mistral Judge Audit (Fairness Check)**

```
Judge Service receives:
  ├─ Original question
  ├─ User's transcript
  └─ DeepSeek's evaluation scores & reasoning
    ↓
Prepares fairness audit prompt:
  
  System Prompt:
  "You are a 'Judge AI' (auditor). Your task is to audit the 
   evaluation produced by another AI for fairness, logical 
   consistency, and specificity.
   
   Does the evaluation's reasoning actually justify the scores 
   given? Is the feedback actionable and relevant to the answer?
   
   Evaluate based on:
   1. Suggestion relevance - Are suggestions helpful?
   2. Fairness of scoring - Any biases detected?
   3. Logical consistency - Does reasoning match scores?
   4. Specificity of improvements - Are suggestions concrete?"
  
  User Prompt:
  "Question: [interview question]
   
   Candidate Answer: [transcript]
   
   AI Evaluation to Audit:
   {
     scoreTech: 8,
     reasoningTech: '...',
     scoreRelevance: 9,
     ...
   }"
    ↓
Calls Mistral 7B via Groq API:
  
  API Call: POST https://api.groq.com/openai/v1/chat/completions
  ├─ model: "mixtral-8x7b-32768"
  ├─ temperature: 0.2
  ├─ response_format: { type: "json_object" }
  └─ messages: [system prompt, user prompt]
    ↓
Mistral analyzes evaluation and returns:
  {
    "confidenceScore": 82,
    "isValid": true,
    "suggestedRegeneration": false,
    "auditReasoning": "The evaluation is fair and thorough. 
                      Reasoning clearly justifies the scores. 
                      The scoring appears unbiased. Feedback is 
                      specific and actionable. Minor note: Could 
                      have mentioned API gateway patterns, but 
                      overall comprehensive."
  }
    ↓
Backend creates JudgeAudit document:
  {
    _id: ObjectId (audit ID),
    evaluationId: ObjectId (reference),
    questionId: ObjectId (reference),
    sessionId: ObjectId (reference),
    confidenceScore: 82,
    isValid: true,
    suggestedRegeneration: false,
    auditReasoning: "[as above]",
    auditedAt: [timestamp]
  }
    ↓
Logic: If confidenceScore < 70:
  └─ Flag evaluation for manual review
  └─ Consider regenerating evaluation
```

**Key Files Involved:**
- Service: [backend/src/services/evaluationService.js](backend/src/services/evaluationService.js) - DeepSeek evaluation
- Service: [backend/src/services/judgeService.js](backend/src/services/judgeService.js) - Mistral fairness audit
- Orchestrator: [backend/src/llm/orchestrator.js](backend/src/llm/orchestrator.js) - LLM API calls with retry logic
- Model: [backend/src/models/Evaluation.js](backend/src/models/Evaluation.js) - Evaluation schema
- Model: [backend/src/models/JudgeAudit.js](backend/src/models/JudgeAudit.js) - Audit schema

---

### **Phase 6: Feedback Display to User**

```
Backend sends comprehensive response to frontend:
  {
    transcript: "[what the system heard]",
    scores: {
      tech: 8,
      relevance: 9,
      depth: 6,
      clarity: 8,
      structure: 9,
      confidence: 7
    },
    averageScore: 7.83,
    feedback: "[detailed feedback]",
    judgeAudit: {
      confidenceScore: 82,
      isValid: true,
      auditReasoning: "[fairness assessment]"
    }
  }
    ↓
Frontend displays comprehensive feedback:
  
  1. Transcript Section
     ├─ Shows what the system heard verbatim
     ├─ Highlights transcription accuracy
     └─ Allows user to correct if needed
  
  2. Score Breakdown
     ├─ Technical Accuracy: 8/10 [progress bar]
     ├─ Relevance: 9/10 [progress bar]
     ├─ Depth: 6/10 [progress bar]
     ├─ Clarity: 8/10 [progress bar]
     ├─ Structure: 9/10 [progress bar]
     ├─ Confidence: 7/10 [progress bar]
     └─ Average Score: 7.83/10 [highlighted]
  
  3. Detailed Feedback
     └─ "Strong foundation in microservices concepts. Focus on 
         explaining trade-offs and failure handling..."
  
  4. Judge Audit Badge
     ├─ Shows confidence score (82%)
     ├─ Status: "Valid" (green) or "Needs Review" (red)
     └─ Audit reasoning: "Fair evaluation. Reasoning clearly 
                          justifies scores..."
    ↓
User options:
  ├─ "Next Question" → returns to phase 3
  ├─ "Review Feedback" → expands detailed comments
  ├─ "Skip Question" → moves to next without answer
  └─ "End Interview" → completes session
    ↓
User can continue with more questions or end session
```

---

### **Phase 7: Analytics & Dashboard**

```
User navigates to Dashboard page
    ↓
Frontend loads protected route and displays loading state
    ↓
Frontend sends GET /api/analytics/dashboard
  ├─ Headers: Authorization: Bearer [JWT token]
  └─ Query params: Optional filters (dateRange, mode, etc.)
    ↓
Backend Analytics Service processes request:
  
  1. Authenticates user via JWT
  
  2. Queries all sessions for this user:
     ```
     SELECT * FROM sessions WHERE userId = [current user]
     ```
  
  3. For each session, fetches:
     ├─ All questions in session
     ├─ All answers submitted
     ├─ All evaluations with scores
     └─ All judge audits
  
  4. Calculates metrics:
     
     a) Overall Statistics
        ├─ totalInterviews: Count of sessions
        ├─ totalQuestions: Count of all questions across sessions
        ├─ totalAnswered: Count of answered questions
        ├─ completionRate: (totalAnswered / totalQuestions) * 100
        └─ overallAverageScore: Mean of all evaluation averages
     
     b) Time-Based Trends
        ├─ By Week: Score progression over last 8 weeks
        ├─ By Month: Performance metrics by month
        └─ Data points: [{ date, avgScore, questionsAttempted }]
     
     c) Performance by Difficulty
        ├─ Easy Mode: { avgScore, attemptCount }
        ├─ Intermediate: { avgScore, attemptCount }
        └─ Hard: { avgScore, attemptCount }
     
     d) Performance by Category
        ├─ System Design: { avgScore, count }
        ├─ Data Structures: { avgScore, count }
        ├─ Behavioral: { avgScore, count }
        └─ [extracted from questions]
     
     e) Improvement Areas (Lowest Scoring)
        ├─ Technical Accuracy Issues
        ├─ Depth of Knowledge Gaps
        ├─ Clarity Problems
        └─ [ranked by score deficit]
     
     f) Strengths (Highest Scoring)
        ├─ Technical Excellence
        ├─ Clear Communication
        └─ [ranked by score]
     
     g) Recent Sessions
        ├─ Last 5 interviews with:
        │  ├─ Date
        │  ├─ Job Role
        │  ├─ Questions Asked
        │  └─ Average Score
        └─ Details for each
    ↓
Response sent with complete analytics object:
  {
    stats: { totalInterviews: 5, averageScore: 7.6, ... },
    weeklyTrend: [
      { week: "Week 1", avgScore: 6.5, attempts: 3 },
      { week: "Week 2", avgScore: 7.2, attempts: 4 },
      { week: "Week 3", avgScore: 8.1, attempts: 5 }
    ],
    byDifficulty: {
      Easy: { avgScore: 8.5, count: 10 },
      Intermediate: { avgScore: 7.6, count: 12 },
      Hard: { avgScore: 6.8, count: 8 }
    },
    improvementAreas: [ ... ],
    strengths: [ ... ],
    recentSessions: [ ... ]
  }
    ↓
Frontend renders dashboard with visualizations:
  
  1. Key Statistics Cards
     ├─ Total Interviews: 5
     ├─ Overall Average: 7.6/10
     ├─ Completion Rate: 92%
     └─ Time Spent: 8h 32m
  
  2. Line Chart (Score Trend Over Time)
     ├─ X-axis: Weeks or Dates
     ├─ Y-axis: Average Scores
     ├─ Shows progression trend
     └─ Color-coded (green for improvement)
  
  3. Bar Chart (Performance by Difficulty)
     ├─ 3 bars: Easy, Intermediate, Hard
     ├─ Heights represent average scores
     └─ Shows user's difficulty progression
  
  4. Radar Chart (Score Components)
     ├─ 6 axes: Tech, Relevance, Depth, Clarity, Structure, Confidence
     ├─ Shows balance across skills
     └─ Identifies weak points visually
  
  5. Top Improvement Areas
     ├─ Ranked list with scores
     ├─ Actionable suggestions
     └─ Links to related questions
  
  6. Recent Interview History
     ├─ Scrollable table
     ├─ Each row: Date, Role, Questions, Score
     └─ Click to view detailed feedback
```

**Key Files Involved:**
- Service: [backend/src/services/analyticsService.js](backend/src/services/analyticsService.js) - Metrics calculation
- Routes: [backend/src/routes/analyticsRoutes.js](backend/src/routes/analyticsRoutes.js) - Analytics endpoints
- Page: [frontend/src/pages/Dashboard.jsx](frontend/src/pages/Dashboard.jsx) - Dashboard visualization

---

## 🗄️ MongoDB Data Models

### **User Collection**
```json
{
  "_id": ObjectId,
  "email": "user@example.com",
  "name": "John Doe",
  "passwordHash": "$2a$10$...[bcrypt hash]...",
  "createdAt": 2024-05-12T10:30:00Z,
  "updatedAt": 2024-05-12T10:30:00Z
}
```

### **Session Collection**
```json
{
  "_id": ObjectId("session123"),
  "userId": ObjectId("user456"),
  "jobRole": "Senior Software Engineer",
  "jdText": "[cleaned job description text...]",
  "resumeText": "[extracted resume text...]",
  "skillsMatch": {
    "Node.js": 85,
    "React": 90,
    "MongoDB": 70,
    "Docker": 45,
    "TypeScript": 88
  },
  "yoe": 5,
  "mode": "interview",
  "createdAt": 2024-05-12T10:30:00Z,
  "completedAt": null,
  "status": "in-progress"
}
```

### **Question Collection**
```json
{
  "_id": ObjectId("q789"),
  "sessionId": ObjectId("session123"),
  "text": "Based on your resume showing Node.js experience...",
  "difficulty": "Hard",
  "category": "System Design",
  "createdAt": 2024-05-12T10:35:00Z
}
```

### **Answer Collection**
```json
{
  "_id": ObjectId("a101"),
  "questionId": ObjectId("q789"),
  "sessionId": ObjectId("session123"),
  "transcript": "So the way I would approach this is...",
  "duration": 180,
  "transcriptionModel": "whisper-large-v3",
  "createdAt": 2024-05-12T10:38:00Z
}
```

### **Evaluation Collection**
```json
{
  "_id": ObjectId("eval202"),
  "answerId": ObjectId("a101"),
  "questionId": ObjectId("q789"),
  "sessionId": ObjectId("session123"),
  "scoreTech": 8,
  "reasoningTech": "The candidate mentions microservices...",
  "scoreRelevance": 9,
  "reasoningRelevance": "The answer directly addresses...",
  "scoreDepth": 6,
  "reasoningDepth": "While the candidate explains...",
  "scoreClarity": 8,
  "reasoningClarity": "Explanation is well-structured...",
  "scoreStructure": 9,
  "reasoningStructure": "Follows a logical progression...",
  "scoreConfidence": 7,
  "reasoningConfidence": "Minimal filler words...",
  "averageScore": 7.83,
  "generalFeedback": "Strong foundation in microservices...",
  "evaluatedAt": 2024-05-12T10:40:00Z
}
```

### **JudgeAudit Collection**
```json
{
  "_id": ObjectId("audit303"),
  "evaluationId": ObjectId("eval202"),
  "questionId": ObjectId("q789"),
  "sessionId": ObjectId("session123"),
  "confidenceScore": 82,
  "isValid": true,
  "suggestedRegeneration": false,
  "auditReasoning": "The evaluation is fair and thorough...",
  "auditedAt": 2024-05-12T10:42:00Z
}
```

---

## 🤖 AI Models & LLM Services

### **Model Specifications**

| Service | Model | Purpose | API Provider | Cost |
|---------|-------|---------|---|---|
| **Skill Extraction** | Llama 3 8B | Extract and match skills from resume/JD | Groq | Free tier available |
| **Question Generation** | DeepSeek-R1 | Generate context-aware interview questions | Groq | Free tier available |
| **Answer Transcription** | Whisper (large-v3) | Convert audio to text | Groq | Free tier available |
| **Answer Evaluation** | DeepSeek-R1 | Score answers with detailed reasoning | Groq | Free tier available |
| **Fairness Auditing** | Mistral 8x7B | Verify evaluation fairness and consistency | Groq | Free tier available |

### **LLM Call Architecture**

```
Frontend (React)
    ↓
Backend (Node.js/Express)
    ├─ LLM Orchestrator
    │  ├─ Axios HTTP client
    │  ├─ Retry logic (max 3 attempts)
    │  ├─ Timeout handling (20 seconds)
    │  └─ Error recovery
    │
    ├─ API Endpoint: https://api.groq.com/openai/v1
    │  ├─ /chat/completions (for text generation)
    │  └─ /audio/transcriptions (for Whisper)
    │
    └─ Request Format: OpenAI-compatible
       ├─ Headers: Authorization: Bearer [API_KEY]
       ├─ Body: { model, messages, temperature, response_format }
       └─ Response: { choices[0].message.content }
```

### **Temperature Settings**
- Structured outputs (scoring, JSON): `temperature: 0.2` (low randomness)
- Creative tasks (question generation): `temperature: 0.5` (balanced)
- Free text: `temperature: 0.7` (more varied)

---

## 🛣️ API Endpoint Reference

### **Authentication Routes**
```
POST /api/auth/register
├─ Body: { email, name, password }
├─ Response: { userId, token, user }
└─ Status: 201 (Created)

POST /api/auth/login
├─ Body: { email, password }
├─ Response: { userId, token, user }
└─ Status: 200 (OK)
```

### **Interview Routes**
```
POST /api/interview/start
├─ Auth: Required (JWT)
├─ Body: multipart/form-data
│  ├─ resume: File (PDF)
│  ├─ jobRole: String
│  ├─ jdText: String
│  ├─ yoe: Number (optional)
│  └─ mode: String (interview/concepts/dsa)
├─ Response: { sessionId, skillsMatch }
└─ Status: 201

POST /api/interview/:sessionId/question
├─ Auth: Required (JWT)
├─ Params: sessionId (MongoDB ObjectId)
├─ Body: { difficulty: "Easy|Intermediate|Hard" }
├─ Response: { questionId, question, difficulty }
└─ Status: 200

POST /api/interview/:sessionId/answer/:questionId
├─ Auth: Required (JWT)
├─ Params: sessionId, questionId
├─ Body: multipart/form-data
│  └─ audio: File (WebM/MP3)
├─ Response: {
│    transcript,
│    scores: { tech, relevance, depth, clarity, structure, confidence },
│    averageScore,
│    feedback,
│    judgeAudit
│  }
└─ Status: 201
```

### **Analytics Routes**
```
GET /api/analytics/dashboard
├─ Auth: Required (JWT)
├─ Query: Optional filters
├─ Response: {
│    stats,
│    weeklyTrend,
│    byDifficulty,
│    improvementAreas,
│    strengths,
│    recentSessions
│  }
└─ Status: 200
```

---

## 🛣️ Frontend Routes & Pages

| Route | Component | Purpose | Protected |
|-------|-----------|---------|-----------|
| `/` | Home.jsx | Login/Register screen | ❌ |
| `/setup` | SetupInterview.jsx | Upload resume & JD, select mode | ✅ |
| `/interview/:sessionId` | InterviewRoom.jsx | Main interview (Q&A with scoring) | ✅ |
| `/concepts/:sessionId` | ConceptsRoom.jsx | Data structure & algorithm concepts | ✅ |
| `/dsa/:sessionId` | DSARoom.jsx | DSA problem solving practice | ✅ |
| `/dashboard` | Dashboard.jsx | Analytics & progress tracking | ✅ |

---

## 🔐 Security Features

### **Authentication & Authorization**
- JWT (JSON Web Tokens) for stateless authentication
- Tokens stored in browser localStorage
- Verified on every protected route
- Token refresh on expiration

### **Password Security**
- bcryptjs with salt rounds (default: 10)
- Passwords never stored in plain text
- Comparison using constant-time functions

### **Request Security**
- CORS (Cross-Origin Resource Sharing) enabled
- Express rate limiting: 100 requests per 15 minutes per IP
- Input validation on all endpoints
- Error messages don't leak sensitive information

### **File Upload Security**
- Multer validates file types
- Temporary files cleaned after processing
- File size limits enforced
- Stored outside public directory

### **Database Security**
- MongoDB connection via URI with authentication
- Database user with limited permissions
- No sensitive data in client responses

---

## 📊 Complete User Journey

### **Scenario: New User Interview Preparation**

```
Day 1 - Account Setup
│
├─ User visits http://localhost:5173
├─ Clicks "Sign Up"
├─ Enters email, name, password
├─ Backend hashes password → MongoDB stores user
├─ JWT token issued and stored locally
└─ User logged in ✓

Day 1-3 - Research & Preparation
│
├─ User gathers resume and job description
├─ Clicks "Start Interview"
├─ Uploads resume PDF and JD text
├─ Backend:
│  ├─ Parses resume → extracts text
│  ├─ Cleans JD
│  ├─ Calls Llama 3 → extracts and matches skills
│  └─ Creates session
├─ Dashboard shows skill gaps (e.g., "Docker: 45%")
└─ User now ready for interview ✓

Day 4 - Interview Day
│
├─ User clicks "Start Interview" on dashboard
├─ Question 1 appears: "Design a microservices system..."
├─ User clicks "Record" and speaks answer for 3 minutes
├─ User clicks "Submit"
├─ Backend:
│  ├─ Sends audio to Whisper → transcript received
│  ├─ Calls DeepSeek-R1 → evaluates answer
│  │  └─ Tech: 8/10, Relevance: 9/10, Depth: 6/10, etc.
│  ├─ Calls Mistral 7B → audits evaluation
│  │  └─ Confidence: 82% → Valid ✓
│  └─ Stores all results
├─ Frontend displays feedback
│  ├─ "Your answer scored 7.83/10"
│  ├─ "Strengths: Good system design fundamentals"
│  └─ "Improve: Explain failure scenarios better"
├─ User clicks "Next Question"
├─ Process repeats for 10-15 questions
└─ User finishes interview ✓

Day 5 - Review & Analysis
│
├─ User visits Dashboard
├─ Sees visualizations:
│  ├─ Line chart: Score trend over questions
│  ├─ Bar chart: Performance by difficulty
│  ├─ Radar chart: Skill balance (5 dimensions)
│  └─ "Top improvements": Depth, Clarity, Confidence
├─ User identifies weak areas
├─ User schedules next interview round
└─ Continuous improvement cycle ✓
```

---

## 🚀 Deployment Considerations

### **Environment Variables Required**
```env
# Server
PORT=5000
NODE_ENV=production

# Database
DATABASE_URL=mongodb://admin:password@localhost:27017/interview_db

# Authentication
JWT_SECRET=your_very_long_random_secret_key_here
JWT_EXPIRE=7d

# LLM Configuration
LLM_API_KEY=your_groq_api_key
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL_EXTRACTION=llama3-8b-8192
LLM_MODEL_REASONING=deepseek-r1-distill-llama-70b
LLM_MODEL_JUDGE=mixtral-8x7b-32768

# Speech Recognition
WHISPER_API_KEY=your_groq_api_key
WHISPER_BASE_URL=https://api.groq.com/openai/v1/audio/transcriptions
WHISPER_MODEL=whisper-large-v3

# CORS
FRONTEND_URL=http://localhost:5173
```

### **Docker Setup**
```bash
# Start MongoDB container
docker-compose up -d

# MongoDB accessible at: mongodb://admin:password123@localhost:27017

# Note: For production, use cloud MongoDB (Atlas) instead
```

### **Installation & Running**
```bash
# Backend
cd backend
npm install
npx prisma db push
npm run dev  # Runs on port 5000

# Frontend (in new terminal)
cd frontend
npm install
npm run dev  # Runs on port 5173
```

---

## 📈 Future Enhancement Possibilities

1. **Video Interview Mode**: Record video along with audio
2. **Peer Interviews**: Conduct interviews with other users
3. **Interview Scheduling**: Calendar integration for scheduled practice
4. **Mock Interview Reports**: PDF generation of comprehensive feedback
5. **Personalized Study Plans**: AI-generated study paths based on weaknesses
6. **Team Features**: Coding team practice and collaborative learning
7. **Mobile App**: Native mobile experience for practicing on-the-go
8. **Advanced Analytics**: ML-based performance prediction
9. **Integration with LinkedIn/GitHub**: Auto-populate resume
10. **Real-time Feedback**: Transcript corrections and suggestions during interview

---

## 🎯 Key Innovation: Two-Stage Evaluation System

**Why This Matters:**
- **Single AI Risk**: One AI could have biases or make mistakes
- **Solution**: Two independent AIs evaluate and audit
  1. DeepSeek-R1 scores based on content and quality
  2. Mistral 7B audits the scoring for fairness
- **Result**: Fair, transparent, bias-checked evaluations
- **Confidence Metric**: Shows reliability of each evaluation

---

This comprehensive system represents a modern approach to interview preparation, leveraging cutting-edge AI models while maintaining fairness through multi-stage evaluation.
