import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import User from '../models/User.js';

const router = express.Router();

// ─── Nodemailer transporter ────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_EMAIL,
        pass: process.env.SMTP_PASSWORD,
    },
});

// ─── Register ──────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.send("User already exists");

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ email, passwordHash: hashedPassword, name });

        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
        const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
    } catch (error) {
        console.error('Registration Route Error:', error);
        res.status(500).json({ error: 'Registration failed', details: error.message });
    }
});

// ─── Login ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
        const token = jwt.sign({ userId: user._id.toString() }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// ─── Forgot Password → Send OTP ────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ error: 'No account found with this email' });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        user.otpCode = otp;
        user.otpExpiry = expiry;
        user.otpVerified = false;
        await user.save();

        // Send email
        await transporter.sendMail({
            from: `"AI Interview Prep" <${process.env.SMTP_EMAIL}>`,
            to: email,
            subject: 'Your Password Reset OTP',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 40px; border-radius: 12px; border: 1px solid #ffffff15;">
                    <h2 style="color: #fff; margin-bottom: 8px;">Password Reset</h2>
                    <p style="color: #ffffff60; margin-bottom: 32px;">Use the OTP below to reset your password. It expires in <strong style="color:#fff">10 minutes</strong>.</p>
                    <div style="background: #ffffff0d; border: 1px solid #ffffff1a; border-radius: 10px; padding: 24px; text-align: center; letter-spacing: 12px; font-size: 36px; font-weight: bold; color: #fff;">
                        ${otp}
                    </div>
                    <p style="color: #ffffff30; font-size: 12px; margin-top: 24px;">If you didn't request this, ignore this email.</p>
                </div>
            `,
        });

        res.json({ message: 'OTP sent to your email' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Failed to send OTP. Check SMTP config.' });
    }
});

// ─── Verify OTP ────────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

        const user = await User.findOne({ email });
        if (!user || !user.otpCode) return res.status(400).json({ error: 'No OTP requested for this email' });

        if (new Date() > user.otpExpiry) return res.status(400).json({ error: 'OTP has expired. Request a new one.' });
        if (user.otpCode !== otp) return res.status(400).json({ error: 'Invalid OTP' });

        user.otpVerified = true;
        await user.save();

        res.json({ message: 'OTP verified successfully' });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'OTP verification failed' });
    }
});

// ─── Reset Password ────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password required' });
        if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

        const user = await User.findOne({ email });
        if (!user || !user.otpVerified) return res.status(403).json({ error: 'OTP not verified. Complete verification first.' });

        user.passwordHash = await bcrypt.hash(newPassword, 10);
        user.otpCode = undefined;
        user.otpExpiry = undefined;
        user.otpVerified = false;
        await user.save();

        res.json({ message: 'Password reset successfully. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Password reset failed' });
    }
});

export default router;

