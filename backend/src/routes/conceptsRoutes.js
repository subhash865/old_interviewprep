import express from 'express';
import multer from 'multer';
import os from 'os';
import { authenticateToken } from '../middleware/auth.js';
import { generateConceptQuestion, evaluateMCQAnswer, evaluateConceptAnswer } from '../services/conceptsService.js';
import { transcribeAudio } from '../services/audioService.js';
import ConceptSubmission from '../models/ConceptSubmission.js';

const router = express.Router();
const upload = multer({ dest: os.tmpdir() });

// POST /concepts/question — Generate MCQ or voice question
router.post('/question', authenticateToken, async (req, res) => {
    try {
        const { topic, difficulty, yoe, answerMode = 'mcq', previousQuestions = [] } = req.body;
        if (!topic || !difficulty) {
            return res.status(400).json({ error: 'topic and difficulty are required.' });
        }
        const question = await generateConceptQuestion({
            topic, difficulty, yoe: yoe || 0, answerMode, previousQuestions
        });
        res.json({ ...question, answerMode });
    } catch (error) {
        console.error('[Concepts] Question generation error:', error);
        res.status(500).json({ error: 'Failed to generate concepts question.' });
    }
});

// POST /concepts/answer/mcq — Submit MCQ answer + save submission
router.post('/answer/mcq', authenticateToken, async (req, res) => {
    try {
        const { question, selectedOption, correctAnswer, explanation,
                topic, difficulty, sessionId, timeUsedSeconds, timeLimitSeconds } = req.body;

        if (!selectedOption || !correctAnswer) {
            return res.status(400).json({ error: 'selectedOption and correctAnswer are required.' });
        }

        const result = await evaluateMCQAnswer({ question, selectedOption, correctAnswer, explanation });

        // Save to DB
        await ConceptSubmission.create({
            userId: req.user.userId,
            sessionId: sessionId || null,
            topic: topic || 'General',
            difficulty: difficulty || 'Medium',
            answerMode: 'mcq',
            isCorrect: result.isCorrect,
            score: result.isCorrect ? 10 : 0,
            timeUsedSeconds: timeUsedSeconds || 0,
            timeLimitSeconds: timeLimitSeconds || 0,
        });

        res.json(result);
    } catch (error) {
        console.error('[Concepts] MCQ answer error:', error);
        res.status(500).json({ error: 'Failed to evaluate MCQ answer.' });
    }
});

// POST /concepts/answer/voice — Submit voice answer + save submission
router.post('/answer/voice', authenticateToken, upload.single('audio'), async (req, res) => {
    try {
        const { question, keyPoints, topic, difficulty, sessionId, timeUsedSeconds, timeLimitSeconds } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'Audio file is required.' });
        }

        const transcript = await transcribeAudio(req.file.path);
        
        // Remove the audio file to avoid storing it
        import('fs').then(fs => fs.unlinkSync(req.file.path)).catch(console.error);
        
        const evaluation = await evaluateConceptAnswer({
            question,
            keyPoints: JSON.parse(keyPoints || '[]'),
            transcript
        });

        // Save to DB
        await ConceptSubmission.create({
            userId: req.user.userId,
            sessionId: sessionId || null,
            topic: topic || 'General',
            difficulty: difficulty || 'Medium',
            answerMode: 'voice',
            isCorrect: (evaluation.score || 0) >= 6,
            score: evaluation.score || 0,
            timeUsedSeconds: timeUsedSeconds || 0,
            timeLimitSeconds: timeLimitSeconds || 0,
        });

        res.json({ transcript, ...evaluation });
    } catch (error) {
        console.error('[Concepts] Voice answer error:', error);
        res.status(500).json({ error: 'Failed to evaluate voice answer.' });
    }
});

export default router;
