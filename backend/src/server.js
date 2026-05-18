import 'dotenv/config'; // ← must be first: loads .env before any other module initializes
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mongoose from 'mongoose';

import { rateLimit } from 'express-rate-limit';

const app = express();
const port = process.env.PORT || 5000;

// Connect to MongoDB
mongoose.connect(process.env.DATABASE_URL)
    .then(() => console.log('Connected to MongoDB via Mongoose'))
    .catch(err => console.error('MongoDB connection error:', err));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

app.use(cors());
app.use(express.json());
app.use('/api', apiLimiter);

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AI Interview Backend Running' });
});

// Import modules
import apiRoutes from './routes/index.js';
app.use('/api', apiRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!', details: err.message });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

export default app;