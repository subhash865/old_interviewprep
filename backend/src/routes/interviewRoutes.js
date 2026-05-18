import express from 'express';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { authenticateToken } from '../middleware/auth.js';
import { parseResumePdf } from '../services/resumeService.js';
import { processJobDescription } from '../services/jdService.js';
import { computeSkillMatch } from '../services/matchingService.js';
import { generateQuestion } from '../services/questionService.js';
import { transcribeAudio } from '../services/audioService.js';
import { evaluateAnswer } from '../services/evaluationService.js';
import { judgeEvaluation } from '../services/judgeService.js';

import Session from '../models/Session.js';
import Question from '../models/Question.js';
import Answer from '../models/Answer.js';
import Evaluation from '../models/Evaluation.js';
import JudgeAudit from '../models/JudgeAudit.js';
import DSASubmission from '../models/DSASubmission.js';
import ConceptSubmission from '../models/ConceptSubmission.js';

const router = express.Router();

// Configure diskStorage to direct files safely into Vercel's allowed scratch space (/tmp)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, os.tmpdir());
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// 1. Initialize Session
router.post('/start', authenticateToken, upload.single('resume'), async (req, res) => {
    try {
        const { jobRole, jdText, yoe, mode } = req.body;
        // For concepts and DSA mode, resume/jd are optional
        const isInterviewMode = !mode || mode === 'interview';

        if (isInterviewMode && (!req.file || !jobRole || !jdText)) {
            return res.status(400).json({ error: 'Missing resume, jobRole, or jdText' });
        }

        let resumeText = '';
        let cleanedJD = '';
        let skillsMatch = {};

        if (req.file) {
            const fileBuffer = fs.readFileSync(req.file.path);
            resumeText = await parseResumePdf(fileBuffer);
            fs.unlinkSync(req.file.path);
        }
        if (jdText) {
            cleanedJD = processJobDescription(jdText);
            if (resumeText) {
                skillsMatch = await computeSkillMatch(resumeText, cleanedJD);
            }
        }

        const session = await Session.create({
            userId: req.user.userId,
            jobRole: jobRole || 'General',
            jdText: cleanedJD,
            resumeText,
            skillsMatch,
            yoe: parseInt(yoe) || 0,
            mode: mode || 'interview',
        });

        res.json({ sessionId: session._id, skillsMatch });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to start session.' });
    }
});

// 2. Request a Question
router.post('/:sessionId/question', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { difficulty } = req.body;

        const session = await Session.findById(sessionId);

        // Mongoose ObjectIds are objects but we check string equality
        if (!session || session.userId.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized or session not found.' });
        }

        const previousQuestionsData = await Question.find({ sessionId });
        const previousQuestions = previousQuestionsData.map(q => q.text);

        const generated = await generateQuestion({
            resumeText: session.resumeText || '',
            jdText: session.jdText || '',
            previousQuestions,
            difficulty: difficulty || 'Intermediate'
        });

        const question = await Question.create({
            sessionId,
            text: generated.question,
            difficulty: generated.difficulty
        });

        // Use _id to safely transport back mapping to frontend id mappings
        res.json({ questionId: question._id, id: question._id, ...generated });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to generate question.' });
    }
});

// 3. Submit Answer Audio
router.post('/:sessionId/answer/:questionId', authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        const { questionId } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file uploaded.' });
        }

        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ error: 'Question not found.' });

        // 1. STT
        const transcript = await transcribeAudio(req.file.path);

        // Remove the audio file so we don't store it on the server
        fs.unlinkSync(req.file.path);

        const answer = await Answer.create({
            questionId,
            transcript
        });

        // 2. Evaluate
        const evalData = await evaluateAnswer(question.text, transcript);

        // 3. Judge the evaluation
        const judgeData = await judgeEvaluation(question.text, transcript, evalData);

        const evaluation = await Evaluation.create({
            answerId: answer._id,
            scoreTech: evalData.scoreTech,
            scoreRelevance: evalData.scoreRelevance,
            scoreDepth: evalData.scoreDepth,
            scoreClarity: evalData.scoreClarity,
            scoreStructure: evalData.scoreStructure,
            scoreConfidence: evalData.scoreConfidence || 0,
            generalFeedback: evalData.generalFeedback
        });

        const audit = await JudgeAudit.create({
            evaluationId: evaluation._id,
            confidenceScore: judgeData.confidenceScore,
            isValid: judgeData.isValid,
            suggestedRegeneration: judgeData.suggestedRegeneration,
            auditReasoning: judgeData.auditReasoning
        });

        res.json({ transcript, evaluation, audit });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process answer.' });
    }
});

// 4. Fetch User Sessions (History)
router.get('/history', authenticateToken, async (req, res) => {
    try {
        const sessions = await Session.find({ userId: req.user.userId })
            .sort({ createdAt: -1 })
            .select('-resumeText -jdText') // exclude heavy text fields
            .lean();

        // Filter out empty sessions (sessions where user didn't actually answer/submit anything)
        const sessionIds = sessions.map(s => s._id);
        const questions = await Question.find({ sessionId: { $in: sessionIds } }).lean();
        const answers = await Answer.find({ questionId: { $in: questions.map(q => q._id) } }).lean();
        const dsaSubs = await DSASubmission.find({ sessionId: { $in: sessionIds } }).lean();
        const conceptSubs = await ConceptSubmission.find({ sessionId: { $in: sessionIds } }).lean();

        const validSessionIds = new Set();
        answers.forEach(a => {
            const q = questions.find(q => q._id.toString() === a.questionId.toString());
            if (q) validSessionIds.add(q.sessionId.toString());
        });
        dsaSubs.forEach(s => s.sessionId && validSessionIds.add(s.sessionId.toString()));
        conceptSubs.forEach(s => s.sessionId && validSessionIds.add(s.sessionId.toString()));

        const filteredSessions = sessions.filter(s => validSessionIds.has(s._id.toString()));

        res.json(filteredSessions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch history.' });
    }
});

// 5. Fetch Specific Session Details
router.get('/history/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findById(sessionId);

        if (!session || session.userId.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized or session not found.' });
        }

        let details = [];

        if (session.mode === 'dsa') {
            const subs = await DSASubmission.find({ sessionId }).lean();
            details = subs.map(sub => ({
                question: { text: sub.problemTitle, difficulty: sub.difficulty },
                answer: { transcript: `Submitted ${sub.language} code in ${sub.timeUsedSeconds}s.` },
                evaluation: {
                    generalFeedback: `Passed ${sub.passedCount} out of ${sub.totalCount} test cases.`,
                    scoreTech: sub.score, scoreRelevance: sub.score, scoreDepth: sub.score, scoreClarity: sub.score
                }
            }));
        } else if (session.mode === 'concepts') {
            const subs = await ConceptSubmission.find({ sessionId }).lean();
            details = subs.map(sub => ({
                question: { text: `Topic: ${sub.topic}`, difficulty: sub.difficulty },
                answer: { transcript: `Answered via ${sub.answerMode}. Time used: ${sub.timeUsedSeconds}s.` },
                evaluation: {
                    generalFeedback: sub.isCorrect ? 'Correct / Passed evaluation.' : 'Incorrect / Failed evaluation.',
                    scoreTech: sub.score, scoreRelevance: sub.score, scoreDepth: sub.score, scoreClarity: sub.score
                }
            }));
        } else {
            // standard interview mode
            const questions = await Question.find({ sessionId }).lean();
            const qIds = questions.map(q => q._id);
            const answers = await Answer.find({ questionId: { $in: qIds } }).lean();
            const aIds = answers.map(a => a._id);
            const evaluations = await Evaluation.find({ answerId: { $in: aIds } }).lean();

            details = questions.map(q => {
                const ans = answers.find(a => a.questionId.toString() === q._id.toString());
                const ev = ans ? evaluations.find(e => e.answerId.toString() === ans._id.toString()) : null;
                return {
                    question: q,
                    answer: ans || null,
                    evaluation: ev || null
                };
            });
        }

        res.json({ session, details });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch session details.' });
    }
});

// 6. Delete Specific Session
router.delete('/history/:sessionId', authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await Session.findById(sessionId);

        if (!session || session.userId.toString() !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized or session not found.' });
        }

        // Delete all associated models to keep the DB clean
        const questions = await Question.find({ sessionId }).lean();
        const qIds = questions.map(q => q._id);

        const answers = await Answer.find({ questionId: { $in: qIds } }).lean();
        const aIds = answers.map(a => a._id);

        // Delete evaluations mapped to these answers
        await Evaluation.deleteMany({ answerId: { $in: aIds } });

        // Delete answers
        await Answer.deleteMany({ questionId: { $in: qIds } });

        // Delete questions
        await Question.deleteMany({ sessionId });

        // Delete the session document itself
        await Session.findByIdAndDelete(sessionId);

        res.json({ message: 'Session deleted successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to delete session.' });
    }
});

export default router;