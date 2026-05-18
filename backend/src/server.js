import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import { connectDB } from './db.js';  // ← add this

import apiRoutes from './routes/index.js';

const app = express();

// ✅ Connect before every request (uses cached connection)
app.use(async (req, res, next) => {
    try {
        await connectDB();
        next();
    } catch (err) {
        console.error('MongoDB connection failed:', err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

app.use(cors());
app.use(express.json());
app.use('/api', apiLimiter);

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AI Interview Backend Running' });
});

app.use('/api', apiRoutes);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

if (!process.env.VERCEL) {
    const port = process.env.PORT || 5000;
    app.listen(port, () => console.log(`Server running on port ${port}`));
}

export default app;