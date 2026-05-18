import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';

// ─── Password strength rules ───────────────────────────────────
const rules = [
    { label: 'At least 8 characters', test: (p) => p.length >= 8 },
    { label: 'Uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
    { label: 'Number (0-9)',           test: (p) => /[0-9]/.test(p) },
    { label: 'Special character (!@#$...)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

function getStrength(pw) {
    const passed = rules.filter(r => r.test(pw)).length;
    if (passed === 0) return { level: 0, label: '', color: '' };
    if (passed === 1) return { level: 1, label: 'Weak',   color: '#ef4444' };
    if (passed === 2) return { level: 2, label: 'Fair',   color: '#f97316' };
    if (passed === 3) return { level: 3, label: 'Good',   color: '#eab308' };
    return             { level: 4, label: 'Strong', color: '#22c55e' };
}

function PasswordStrength({ password }) {
    if (!password) return null;
    const { level, label, color } = getStrength(password);
    return (
        <div className="mt-3 space-y-2">
            {/* Strength bar */}
            <div className="flex gap-1">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex-1 h-1 rounded-full transition-all duration-300"
                        style={{ background: i <= level ? color : 'rgba(255,255,255,0.08)' }} />
                ))}
            </div>
            {label && <p className="text-xs font-medium" style={{ color }}>{label} password</p>}
            {/* Rules checklist */}
            <div className="space-y-1">
                {rules.map(r => {
                    const ok = r.test(password);
                    return (
                        <div key={r.label} className="flex items-center gap-2">
                            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"
                                style={{ color: ok ? '#22c55e' : 'rgba(255,255,255,0.2)' }}>
                                {ok
                                    ? <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    : <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />}
                            </svg>
                            <span className="text-xs" style={{ color: ok ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)' }}>
                                {r.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Forgot Password Steps ─────────────────────────────────────
// step 0 = enter email, step 1 = enter OTP, step 2 = new password

export default function Home() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Forgot password state
    const [forgotMode, setForgotMode] = useState(false);
    const [fpStep, setFpStep] = useState(0);   // 0=email 1=otp 2=newpw
    const [fpEmail, setFpEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [fpSuccess, setFpSuccess] = useState('');

    const { login, register, user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && user) navigate('/setup');
    }, [user, loading, navigate]);

    // ── Normal auth submit ──────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            if (isLogin) {
                await login(email, password);
            } else {
                const allPassed = rules.every(r => r.test(password));
                if (!allPassed) {
                    setError('Password must be at least 8 characters, include an uppercase letter, a number, and a special character.');
                    setIsLoading(false);
                    return;
                }
                await register(name, email, password);
            }
            navigate('/setup');
        } catch (err) {
            setError(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const switchMode = () => {
        setIsLogin(!isLogin);
        setError('');
        setEmail('');
        setPassword('');
        setName('');
    };

    // ── Forgot password handlers ────────────────────────────────
    const openForgot = () => {
        setForgotMode(true);
        setFpStep(0);
        setFpEmail('');
        setOtp('');
        setNewPassword('');
        setError('');
        setFpSuccess('');
    };

    const closeForgot = () => {
        setForgotMode(false);
        setError('');
        setFpSuccess('');
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await api.post('/auth/forgot-password', { email: fpEmail });
            setFpStep(1);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to send OTP.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await api.post('/auth/verify-otp', { email: fpEmail, otp });
            setFpStep(2);
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid or expired OTP.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        const allPassed = rules.every(r => r.test(newPassword));
        if (!allPassed) { setError('Password must include uppercase, number, and special character.'); return; }
        setIsLoading(true);
        try {
            await api.post('/auth/reset-password', { email: fpEmail, newPassword });
            setFpSuccess('Password reset! You can now log in.');
            setTimeout(() => { closeForgot(); }, 2000);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to reset password.');
        } finally {
            setIsLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Left Panel — Branding */}
            <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-16 relative overflow-hidden border-r border-white/5">
                <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
                    backgroundSize: '40px 40px',
                }} />
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] pointer-events-none"
                    style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />

                <div className="relative z-10 flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#0d1117] rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
                        <img src="/favicon.png" alt="AI-Interview Prep" className="w-full h-full object-cover rounded-xl" />
                    </div>
                    <span className="text-white font-semibold text-lg tracking-tight">AI-Interview Prep</span>
                </div>

                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 rounded-full text-xs text-white/50 mb-8 bg-white/5">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        AI-Powered Interview Practice
                    </div>
                    <h1 className="text-5xl xl:text-6xl font-bold text-white leading-tight mb-6 tracking-tight">
                        Ace your next<br />
                        <span className="text-white/40">interview.</span>
                    </h1>
                    <p className="text-white/40 text-lg leading-relaxed max-w-sm">
                        Practice with realistic voice-driven mock interviews tailored to your role and resume.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-10">
                        {['Voice Responses', 'AI Feedback', 'Skill Analytics', 'Role-Specific'].map((f) => (
                            <span key={f} className="px-4 py-2 border border-white/10 rounded-full text-sm text-white/50 bg-white/5">{f}</span>
                        ))}
                    </div>
                </div>

                <div className="relative z-10 border-l-2 border-white/10 pl-5">
                    <p className="text-white/30 text-sm italic">"Preparation is the key to success."</p>
                    <p className="text-white/20 text-xs mt-1">— Alexander Graham Bell</p>
                </div>
            </div>

            {/* Right Panel */}
            <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 xl:p-16 relative">
                <div className="lg:hidden flex items-center gap-2 mb-12">
                    <div className="w-8 h-8 bg-[#0d1117] rounded-xl flex items-center justify-center border border-white/10">
                        <img src="/favicon.png" alt="AI-Interview Prep" className="w-6 h-6 rounded-lg object-cover" />
                    </div>
                    <span className="text-white font-semibold text-lg">AI-Interview Prep</span>
                </div>

                <div className="w-full max-w-sm">

                    {/* ═══ FORGOT PASSWORD FLOW ═══ */}
                    {forgotMode ? (
                        <>
                            <div className="mb-8">
                                <button onClick={closeForgot} className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                                    </svg>
                                    Back to login
                                </button>

                                {/* Step indicator */}
                                <div className="flex items-center gap-2 mb-6">
                                    {['Email', 'OTP', 'New Password'].map((label, i) => (
                                        <React.Fragment key={i}>
                                            <div className={`flex items-center gap-1.5 text-xs font-medium ${i === fpStep ? 'text-white' : i < fpStep ? 'text-white/40' : 'text-white/20'}`}>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${i === fpStep ? 'border-white bg-white text-black' : i < fpStep ? 'border-white/40 bg-white/10 text-white/40' : 'border-white/15 text-white/20'}`}>
                                                    {i < fpStep ? '✓' : i + 1}
                                                </div>
                                                {label}
                                            </div>
                                            {i < 2 && <div className={`flex-1 h-px ${i < fpStep ? 'bg-white/30' : 'bg-white/10'}`} />}
                                        </React.Fragment>
                                    ))}
                                </div>

                                <h2 className="text-3xl font-bold text-white tracking-tight">
                                    {fpStep === 0 && 'Forgot password'}
                                    {fpStep === 1 && 'Enter OTP'}
                                    {fpStep === 2 && 'New password'}
                                </h2>
                                <p className="text-white/40 mt-2 text-sm">
                                    {fpStep === 0 && 'We\'ll send a 6-digit code to your email.'}
                                    {fpStep === 1 && `Code sent to ${fpEmail}. Check your inbox.`}
                                    {fpStep === 2 && 'Choose a strong new password.'}
                                </p>
                            </div>

                            {/* Error / Success */}
                            {error && (
                                <div className="mb-5 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                                    <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-red-400 text-sm">{error}</p>
                                </div>
                            )}
                            {fpSuccess && (
                                <div className="mb-5 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3">
                                    <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-green-400 text-sm">{fpSuccess}</p>
                                </div>
                            )}

                            {/* Step 0 — Email */}
                            {fpStep === 0 && (
                                <form onSubmit={handleSendOtp} className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">Email Address</label>
                                        <input
                                            type="email" required value={fpEmail}
                                            onChange={e => setFpEmail(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-all duration-200"
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                    <button type="submit" disabled={isLoading}
                                        className="w-full mt-2 bg-white text-black font-semibold py-3.5 rounded-xl transition-all duration-200 hover:bg-white/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                                        {isLoading ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Sending OTP...</> : 'Send OTP'}
                                    </button>
                                </form>
                            )}

                            {/* Step 1 — OTP */}
                            {fpStep === 1 && (
                                <form onSubmit={handleVerifyOtp} className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">6-Digit OTP</label>
                                        <input
                                            type="text" required maxLength={6} value={otp}
                                            onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-all duration-200 tracking-[0.4em] text-center text-lg font-mono"
                                            placeholder="······"
                                        />
                                    </div>
                                    <button type="submit" disabled={isLoading || otp.length !== 6}
                                        className="w-full bg-white text-black font-semibold py-3.5 rounded-xl transition-all duration-200 hover:bg-white/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                                        {isLoading ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Verifying...</> : 'Verify OTP'}
                                    </button>
                                    <button type="button" onClick={() => { setFpStep(0); setError(''); }}
                                        className="w-full py-2 text-white/30 hover:text-white/60 text-sm transition-colors text-center">
                                        Resend OTP
                                    </button>
                                </form>
                            )}

                            {/* Step 2 — New Password */}
                            {fpStep === 2 && (
                                <form onSubmit={handleResetPassword} className="space-y-5">
                                    <div>
                                        <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">New Password</label>
                                        <div className="relative">
                                            <input
                                                type={showNewPassword ? 'text' : 'password'} required value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-all duration-200"
                                                placeholder="Min. 8 characters"
                                            />
                                            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors" tabIndex={-1}>
                                                {showNewPassword ? (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                        <PasswordStrength password={newPassword} />
                                    </div>
                                    <button type="submit" disabled={isLoading || !rules.every(r => r.test(newPassword))}
                                        className="w-full bg-white text-black font-semibold py-3.5 rounded-xl transition-all duration-200 hover:bg-white/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm">
                                        {isLoading ? <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" /> Resetting...</> : 'Reset Password'}
                                    </button>
                                </form>
                            )}
                        </>
                    ) : (

                    /* ═══ LOGIN / REGISTER ═══ */
                    <>
                        <div className="mb-10">
                            <h2 className="text-3xl font-bold text-white tracking-tight">
                                {isLogin ? 'Welcome back' : 'Create account'}
                            </h2>
                            <p className="text-white/40 mt-2 text-sm">
                                {isLogin ? 'Sign in to continue your interview practice.' : 'Start your AI-powered interview journey.'}
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <p className="text-red-400 text-sm">{error}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            {!isLogin && (
                                <div>
                                    <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">Full Name</label>
                                    <input type="text" required value={name} onChange={e => setName(e.target.value)} autoComplete="name"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-all duration-200"
                                        placeholder="John Doe" />
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-medium text-white/50 uppercase tracking-widest mb-2">Email Address</label>
                                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-all duration-200"
                                    placeholder="you@example.com" />
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-xs font-medium text-white/50 uppercase tracking-widest">Password</label>
                                    {isLogin && (
                                        <button type="button" onClick={openForgot}
                                            className="text-xs text-white/40 hover:text-white transition-colors underline underline-offset-2">
                                            Forgot password?
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} required value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        autoComplete={isLogin ? 'current-password' : 'new-password'}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-white text-sm placeholder-white/25 focus:outline-none focus:border-white/30 transition-all duration-200"
                                        placeholder={isLogin ? 'Enter your password' : 'Min. 8 characters'} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors" tabIndex={-1}>
                                        {showPassword ? (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                            </svg>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {!isLogin && <PasswordStrength password={password} />}
                            </div>

                            <button type="submit" disabled={isLoading || (!isLogin && !rules.every(r => r.test(password)))}                                className="w-full mt-2 bg-white text-black font-semibold py-3.5 rounded-xl transition-all duration-200 hover:bg-white/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm tracking-wide">
                                {isLoading ? (
                                    <><div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                    {isLogin ? 'Signing in...' : 'Creating account...'}</>
                                ) : (
                                    <>{isLogin ? 'Sign in' : 'Create account'}
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                    </svg></>
                                )}
                            </button>
                        </form>

                        <div className="flex items-center gap-4 my-8">
                            <div className="flex-1 h-px bg-white/8" />
                            <span className="text-white/20 text-xs">{isLogin ? 'New here?' : 'Have an account?'}</span>
                            <div className="flex-1 h-px bg-white/8" />
                        </div>

                        <button onClick={switchMode}
                            className="w-full py-3.5 border border-white/10 rounded-xl text-sm text-white/50 hover:text-white hover:border-white/25 hover:bg-white/5 transition-all duration-200">
                            {isLogin ? 'Create a new account' : 'Sign in to existing account'}
                        </button>

                        <p className="text-center text-white/20 text-xs mt-8">
                            By continuing, you agree to our{' '}
                            <span className="underline underline-offset-2 cursor-pointer hover:text-white/40 transition-colors">Terms</span>
                            {' '}and{' '}
                            <span className="underline underline-offset-2 cursor-pointer hover:text-white/40 transition-colors">Privacy Policy</span>.
                        </p>
                    </>
                    )}
                </div>
            </div>
        </div>
    );
}
