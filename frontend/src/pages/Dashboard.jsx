import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtTime = (secs) => {
    if (!secs || secs < 60) return `${secs || 0}s`;
    const m = Math.floor(secs / 60), s = secs % 60;
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m${s > 0 ? ` ${s}s` : ''}`;
};

const DIFF_STYLE = {
    Easy: 'text-green-400 bg-green-400/10 border-green-400/20',
    Medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    'Medium-Hard': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    Hard: 'text-red-400 bg-red-400/10 border-red-400/20',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, sub, icon }) {
    return (
        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5 hover:bg-white/[0.05] transition-colors">
            <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{icon}</span>
            </div>
            <p className="text-white/30 text-xs font-medium mb-0.5">{label}</p>
            <p className="text-2xl font-bold text-white tracking-tight">{value ?? '—'}</p>
            {sub && <p className="text-white/20 text-xs mt-1">{sub}</p>}
        </div>
    );
}

function SectionHeader({ emoji, title, sub }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
                <span>{emoji}</span>
                <h2 className="text-base font-bold text-white">{title}</h2>
            </div>
            {sub && <span className="text-xs text-white/30">{sub}</span>}
        </div>
    );
}

function ProgressBar({ label, value, max = 10, color = 'bg-white/40', right }) {
    const pct = Math.min((value / max) * 100, 100);
    return (
        <div>
            <div className="flex justify-between text-xs mb-1.5">
                <span className="text-white/50">{label}</span>
                <span className="text-white/60 font-medium">{right || `${value}/${max}`}</span>
            </div>
            <div className="w-full bg-white/6 rounded-full h-1.5 overflow-hidden">
                <div className={`h-1.5 rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function ScoreChart({ trend }) {
    if (!trend || trend.length === 0) return (
        <div className="h-40 flex items-center justify-center text-white/20 text-sm">No data yet</div>
    );
    const maxScore = 10;
    const modeColor = { interview: 'bg-blue-400/50', dsa: 'bg-green-400/50', mcq: 'bg-purple-400/50', 'voice-concepts': 'bg-yellow-400/50' };

    return (
        <div className="h-40 flex items-end gap-1.5">
            {trend.slice(-20).map((t, i) => {
                const h = (t.score / maxScore) * 100;
                const color = modeColor[t.mode] || 'bg-white/30';
                return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                        <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1 z-10 whitespace-nowrap text-[10px] text-white/70 pointer-events-none">
                            {t.score}/10 · {t.mode}
                        </div>
                        <div className="w-full bg-white/5 rounded-t relative" style={{ height: '100%' }}>
                            <div className={`absolute bottom-0 w-full ${color} group-hover:brightness-125 rounded-t transition-all duration-500`} style={{ height: `${h}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('overview'); // overview | dsa | concepts | interview | history
    const navigate = useNavigate();

    const [historyData, setHistoryData] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [selectedSessionId, setSelectedSessionId] = useState(null);
    const [sessionDetails, setSessionDetails] = useState(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [historyFilter, setHistoryFilter] = useState('all'); // all, interview, dsa, mcq, voice-concepts
    const [isFullscreen, setIsFullscreen] = useState(false);

    const getRankBadge = (answered) => {
        if (answered >= 100) return { label: 'Legend', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
        if (answered >= 50) return { label: 'Advanced', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
        if (answered >= 20) return { label: 'Intermediate', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
        if (answered > 0) return { label: 'Beginner', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
        return { label: 'Novice', color: 'bg-white/10 text-white/50 border-white/20' };
    };

    const downloadSessionReport = () => {
        if (!sessionDetails) return;
        const s = sessionDetails.session;
        let text = `AI-Interview Prep Session Report\n`;
        text += `Mode: ${s.mode}\nDate: ${formatDate(s.createdAt)}\nRole: ${s.jobRole || 'General'}\n`;
        text += `-------------------------------------------------\n\n`;
        
        sessionDetails.details.forEach((item, i) => {
            text += `Question ${i + 1}: ${item.question?.text || 'Unknown'}\n`;
            text += `Your Answer: ${item.answer?.transcript || 'No answer provided'}\n\n`;
            if (item.evaluation) {
                text += `Feedback: ${item.evaluation.generalFeedback}\n`;
                text += `Scores - Tech: ${item.evaluation.scoreTech}/10 | Relevance: ${item.evaluation.scoreRelevance}/10 | Depth: ${item.evaluation.scoreDepth}/10 | Clarity: ${item.evaluation.scoreClarity}/10\n`;
            } else {
                text += `Evaluation: Not available\n`;
            }
            text += `\n-------------------------------------------------\n\n`;
        });

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-report-${s.mode}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    useEffect(() => { fetchDashboard(); fetchHistory(); }, []);

    useEffect(() => {
        const handleEsc = (e) => { if (e.key === 'Escape') setIsFullscreen(false); };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const fetchDashboard = async () => {
        try {
            const res = await api.get('/analytics/dashboard');
            setData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async () => {
        try {
            setHistoryLoading(true);
            const res = await api.get('/interview/history');
            setHistoryData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadSessionDetails = async (id) => {
        try {
            setSelectedSessionId(id);
            setLoadingDetails(true);
            const res = await api.get(`/interview/history/${id}`);
            setSessionDetails(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDetails(false);
        }
    };

    const deleteSession = async (id, e) => {
        if (e) e.stopPropagation(); // prevent clicking the folder button
        const confirmDelete = window.confirm('Are you sure you want to delete this session? This action cannot be undone.');
        if (!confirmDelete) return;

        try {
            await api.delete(`/interview/history/${id}`);
            // Remove from the local list
            setHistoryData(prev => prev.filter(s => s._id !== id));
            if (selectedSessionId === id) {
                setSelectedSessionId(null);
                setSessionDetails(null);
            }
        } catch (err) {
            console.error(err);
            alert('Failed to delete session.');
        }
    };

    const formatDate = (dateString) => {
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    };

    if (loading) return (
        <div className="min-h-[60vh] flex flex-col justify-center items-center gap-4">
            <div className="w-8 h-8 border-2 border-white/10 border-t-white/60 rounded-full animate-spin" />
            <p className="text-white/30 text-sm">Loading analytics...</p>
        </div>
    );

    const hasAnyData = data && (data.totalAnswered > 0 || data.dsa?.totalAttempted > 0 || data.concepts?.mcqTotal > 0);

    if (!hasAnyData) return (
        <div className="max-w-md mx-auto mt-20 text-center" style={{ fontFamily: "'Inter', sans-serif" }}>
            <div className="text-5xl mb-6">📊</div>
            <h2 className="text-xl font-bold text-white mb-2">No data yet</h2>
            <p className="text-white/30 text-sm leading-relaxed mb-8">
                Complete a Mock Interview, Core Concepts quiz, or DSA session to see your analytics here.
            </p>
            <button onClick={() => navigate('/setup')} className="bg-white text-black text-sm font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-all">
                Start a Session →
            </button>
        </div>
    );

    const { interview, dsa, concepts, trend, totalTimeSeconds, overallAvg } = data;

    return (
        <>
        <div className="max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
            {/* Header */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 border border-white/10 rounded-full text-xs text-white/40 mb-4 bg-white/5">
                    <span className="w-1.5 h-1.5 bg-white/60 rounded-full" />
                    Analytics
                </div>
                <div className="flex items-end justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h1 className="text-3xl font-bold text-white tracking-tight">Performance Dashboard</h1>
                            {data && (
                                <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full border ${getRankBadge(data.questionsAnswered).color}`}>
                                    {getRankBadge(data.questionsAnswered).label} Rank
                                </span>
                            )}
                        </div>
                        <p className="text-white/30 text-sm">All your practice data in one place.</p>
                    </div>
                    <button onClick={fetchDashboard} className="text-xs text-white/30 hover:text-white flex items-center gap-1.5 border border-white/8 hover:border-white/20 px-3 py-2 rounded-xl transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Top stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Stat label="Total Answered" value={data.questionsAnswered} icon="🎯" sub="across all modes" />
                <Stat label="Overall Avg." value={overallAvg ? `${overallAvg}/10` : '—'} icon="⭐" sub="all submissions" />
                <Stat label="Total Practice Time" value={fmtTime(totalTimeSeconds)} icon="⏱️" sub="timed sessions" />
                <Stat label="Sessions" value={data.sessionsCompleted} icon="🗂️" sub="all modes" />
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 p-1 bg-white/5 border border-white/8 rounded-xl w-fit mb-6 overflow-x-auto max-w-full">
                {[
                    { id: 'overview', label: '📊 Overview' },
                    { id: 'dsa', label: '💻 DSA' },
                    { id: 'concepts', label: '📚 Concepts' },
                    { id: 'interview', label: '🎙️ Interview' },
                    { id: 'history', label: '🗂️ History' },
                ].map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm transition-all duration-150 font-medium ${tab === t.id ? 'bg-white text-black' : 'text-white/40 hover:text-white'}`}
                    >{t.label}</button>
                ))}
            </div>

            {/* ── Overview Tab ───────────────────────────────────────────────── */}
            {tab === 'overview' && (
                <div className="space-y-6">
                    {/* Score trend chart */}
                    <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                        <SectionHeader emoji="📈" title="Score Trend" sub="Last 20 submissions" />
                        <ScoreChart trend={trend} />
                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 mt-4">
                            {[['interview', 'bg-blue-400/50', '🎙️ Interview'], ['dsa', 'bg-green-400/50', '💻 DSA'], ['mcq', 'bg-purple-400/50', '📝 MCQ'], ['voice-concepts', 'bg-yellow-400/50', '🎤 Concepts Voice']].map(([k, c, l]) => (
                                <div key={k} className="flex items-center gap-1.5 text-xs text-white/30">
                                    <div className={`w-2.5 h-2.5 rounded-sm ${c}`} />{l}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mode summary cards */}
                    <div className="grid md:grid-cols-3 gap-4">
                        {/* DSA card */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                            <div className="text-lg mb-2">💻</div>
                            <h3 className="text-sm font-bold text-white mb-3">DSA Practice</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs"><span className="text-white/40">Attempted</span><span className="text-white font-semibold">{dsa.totalAttempted}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-white/40">Pass Rate</span><span className={`font-semibold ${dsa.passRate >= 70 ? 'text-green-400' : dsa.passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{dsa.passRate}%</span></div>
                                <div className="flex justify-between text-xs"><span className="text-white/40">Avg Score</span><span className="text-white font-semibold">{dsa.avgScore}/10</span></div>
                            </div>
                            <button onClick={() => setTab('dsa')} className="text-xs text-white/30 hover:text-white mt-3 transition-colors">View details →</button>
                        </div>

                        {/* MCQ card */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                            <div className="text-lg mb-2">📝</div>
                            <h3 className="text-sm font-bold text-white mb-3">Core Concepts (MCQ)</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs"><span className="text-white/40">Attempted</span><span className="text-white font-semibold">{concepts.mcqTotal}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-white/40">Accuracy</span><span className={`font-semibold ${concepts.mcqAccuracy >= 70 ? 'text-green-400' : concepts.mcqAccuracy >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>{concepts.mcqAccuracy}%</span></div>
                                <div className="flex justify-between text-xs"><span className="text-white/40">Correct</span><span className="text-white font-semibold">{concepts.mcqCorrect}/{concepts.mcqTotal}</span></div>
                            </div>
                            <button onClick={() => setTab('concepts')} className="text-xs text-white/30 hover:text-white mt-3 transition-colors">View details →</button>
                        </div>

                        {/* Interview card */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-5">
                            <div className="text-lg mb-2">🎙️</div>
                            <h3 className="text-sm font-bold text-white mb-3">Mock Interview</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs"><span className="text-white/40">Sessions</span><span className="text-white font-semibold">{interview.sessionsCompleted}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-white/40">Answered</span><span className="text-white font-semibold">{interview.questionsAnswered}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-white/40">Tech Avg.</span><span className="text-white font-semibold">{interview.averages?.tech || '—'}</span></div>
                            </div>
                            <button onClick={() => setTab('interview')} className="text-xs text-white/30 hover:text-white mt-3 transition-colors">View details →</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DSA Tab ────────────────────────────────────────────────────── */}
            {tab === 'dsa' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Stat label="Problems Attempted" value={dsa.totalAttempted} icon="💻" />
                        <Stat label="Passed" value={dsa.totalPassed} icon="✅" sub={`${dsa.passRate}% pass rate`} />
                        <Stat label="Avg Score" value={`${dsa.avgScore}/10`} icon="⭐" />
                        <Stat label="Failed" value={dsa.totalAttempted - dsa.totalPassed} icon="❌" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* By difficulty */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                            <SectionHeader emoji="🎯" title="By Difficulty" />
                            <div className="space-y-4">
                                {Object.entries(dsa.byDifficulty).filter(([, v]) => v > 0).map(([diff, total]) => {
                                    const passed = dsa.byDifficultyPassed[diff] || 0;
                                    const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
                                    return (
                                        <div key={diff}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${DIFF_STYLE[diff]}`}>{diff}</span>
                                                </div>
                                                <span className="text-xs text-white/50">{passed}/{total} passed · {rate}%</span>
                                            </div>
                                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                <div className={`h-1.5 rounded-full transition-all duration-700 ${rate >= 70 ? 'bg-green-400/60' : rate >= 50 ? 'bg-yellow-400/60' : 'bg-red-400/60'}`} style={{ width: `${rate}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {Object.values(dsa.byDifficulty).every(v => v === 0) && (
                                    <p className="text-white/20 text-sm text-center py-4">No DSA submissions yet</p>
                                )}
                            </div>
                        </div>

                        {/* Top topics */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                            <SectionHeader emoji="🏷️" title="Practiced Topics" />
                            {dsa.topTopics?.length > 0 ? (
                                <div className="space-y-3">
                                    {dsa.topTopics.map(({ topic, count }) => (
                                        <ProgressBar key={topic} label={topic} value={count} max={Math.max(...dsa.topTopics.map(t => t.count), 1)} right={`${count} problems`} color="bg-green-400/40" />
                                    ))}
                                </div>
                            ) : <p className="text-white/20 text-sm text-center py-4">No topic data yet</p>}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Concepts Tab ───────────────────────────────────────────────── */}
            {tab === 'concepts' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Stat label="MCQ Attempted" value={concepts.mcqTotal} icon="📝" />
                        <Stat label="MCQ Accuracy" value={`${concepts.mcqAccuracy}%`} icon="🎯" sub={`${concepts.mcqCorrect} correct`} />
                        <Stat label="Voice Answers" value={concepts.voiceTotal} icon="🎤" />
                        <Stat label="Voice Avg." value={`${concepts.voiceAvgScore}/10`} icon="⭐" />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        {/* MCQ Accuracy bar */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                            <SectionHeader emoji="📊" title="MCQ Accuracy" sub={`${concepts.mcqCorrect} of ${concepts.mcqTotal}`} />
                            <div className="flex items-center justify-center mb-4">
                                <div className="relative w-28 h-28">
                                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                                        <circle cx="50" cy="50" r="40" fill="none"
                                            stroke={concepts.mcqAccuracy >= 70 ? '#4ade80' : concepts.mcqAccuracy >= 50 ? '#facc15' : '#f87171'}
                                            strokeWidth="10" strokeLinecap="round"
                                            strokeDasharray={`${(concepts.mcqAccuracy / 100) * 251} 251`}
                                            style={{ transition: 'stroke-dasharray 1s ease' }}
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-2xl font-bold text-white">{concepts.mcqAccuracy}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-center gap-6 text-xs">
                                <div className="text-center"><div className="text-green-400 font-bold text-lg">{concepts.mcqCorrect}</div><div className="text-white/30">Correct</div></div>
                                <div className="text-center"><div className="text-red-400 font-bold text-lg">{concepts.mcqTotal - concepts.mcqCorrect}</div><div className="text-white/30">Wrong</div></div>
                            </div>
                        </div>

                        {/* Weak topics */}
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                            <SectionHeader emoji="⚠️" title="Weak Topics" sub="needs improvement" />
                            {concepts.weakTopics?.length > 0 ? (
                                <div className="space-y-3">
                                    {concepts.weakTopics.map(({ topic, accuracy, total }) => (
                                        <div key={topic}>
                                            <div className="flex justify-between text-xs mb-1.5">
                                                <span className="text-white/50">{topic}</span>
                                                <span className="text-red-400 font-medium">{accuracy}% · {total} questions</span>
                                            </div>
                                            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-1.5 rounded-full bg-red-400/50 transition-all duration-700" style={{ width: `${accuracy}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6">
                                    <div className="text-2xl mb-2">🎉</div>
                                    <p className="text-white/30 text-sm">{concepts.mcqTotal > 0 ? 'No weak topics — great job!' : 'Complete some MCQs to see weak areas'}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Top topics practiced */}
                    {concepts.topTopics?.length > 0 && (
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                            <SectionHeader emoji="🏷️" title="Most Practiced Topics" />
                            <div className="grid md:grid-cols-2 gap-x-8 gap-y-3">
                                {concepts.topTopics.map(({ topic, count }) => (
                                    <ProgressBar key={topic} label={topic} value={count} max={Math.max(...concepts.topTopics.map(t => t.count), 1)} right={`${count}×`} color="bg-purple-400/40" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Interview Tab ──────────────────────────────────────────────── */}
            {tab === 'interview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <Stat label="Sessions" value={interview.sessionsCompleted} icon="🗂️" />
                        <Stat label="Questions Answered" value={interview.questionsAnswered} icon="❓" />
                        <Stat label="Avg Score" value={interview.averages ? `${interview.averages.tech}/10` : '—'} icon="⭐" sub="technical" />
                    </div>

                    {interview.averages && (
                        <div className="bg-white/[0.03] border border-white/8 rounded-2xl p-6">
                            <SectionHeader emoji="📊" title="Skill Breakdown" />
                            <div className="space-y-5">
                                <ProgressBar label="Technical Accuracy" value={parseFloat(interview.averages.tech)} max={10} color="bg-blue-400/50" right={`${interview.averages.tech}/10`} />
                                <ProgressBar label="Answer Relevance" value={parseFloat(interview.averages.relevance)} max={10} color="bg-purple-400/50" right={`${interview.averages.relevance}/10`} />
                                <ProgressBar label="Depth & Detail" value={parseFloat(interview.averages.depth)} max={10} color="bg-indigo-400/50" right={`${interview.averages.depth}/10`} />
                            </div>
                        </div>
                    )}

                    {!interview.averages && (
                        <div className="text-center py-12">
                            <div className="text-3xl mb-3">🎙️</div>
                            <p className="text-white/30 text-sm">Complete a Mock Interview to see skill analytics here.</p>
                            <button onClick={() => navigate('/setup')} className="mt-4 bg-white text-black text-xs font-semibold px-5 py-2.5 rounded-xl hover:bg-white/90 transition-all">Start Interview →</button>
                        </div>
                    )}
                </div>
            )}

            {/* ── History Tab ──────────────────────────────────────────────── */}
            {tab === 'history' && (
                <div className="w-full min-h-[500px] h-[600px] flex gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {/* Sidebar: List of Sessions */}
                    <div className="w-1/3 flex flex-col bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden">
                        <div className="p-5 border-b border-white/8 bg-white/5">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    🗂️ Interview Folders
                                </h2>
                            </div>
                            <p className="text-white/40 text-xs mt-1 mb-4">Your past practice sessions</p>
                            
                            <div className="flex bg-[#0a0a0a] p-1 rounded-lg border border-white/5">
                                {['all', 'interview', 'dsa'].map(f => (
                                    <button 
                                        key={f}
                                        onClick={() => setHistoryFilter(f)}
                                        className={`flex-1 text-[11px] font-medium py-1.5 rounded-md capitalize transition-all ${historyFilter === f ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70'}`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                            {historyLoading ? (
                                <p className="text-white/40 text-sm text-center py-4">Loading sessions...</p>
                            ) : historyData.length === 0 ? (
                                <p className="text-white/40 text-sm text-center py-4">No past sessions found.</p>
                            ) : historyData.filter(s => historyFilter === 'all' || s.mode === historyFilter).length === 0 ? (
                                <p className="text-white/40 text-sm text-center py-4">No sessions found for this filter.</p>
                            ) : (
                                historyData.filter(s => historyFilter === 'all' || s.mode === historyFilter).map((session) => {
                                    const isSelected = selectedSessionId === session._id;
                                    return (
                                        <div key={session._id} className="relative group">
                                            <button
                                                onClick={() => loadSessionDetails(session._id)}
                                                className={`w-full text-left p-4 rounded-xl transition-all ${isSelected
                                                        ? 'bg-blue-500/20 border border-blue-500/50 pr-10'
                                                        : 'bg-white/5 border border-white/5 hover:bg-white/10 pr-10'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="font-semibold text-sm text-white capitalize">
                                                        {session.mode} Session
                                                    </span>
                                                    <span className="text-[10px] text-white/40 bg-white/5 px-2 py-0.5 rounded-full">
                                                        {formatDate(session.createdAt)}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-white/60 line-clamp-1 mt-1 break-all">
                                                    Role: {session.jobRole || 'General'}
                                                </div>
                                            </button>
                                            <button 
                                                onClick={(e) => deleteSession(session._id, e)} 
                                                title="Delete Session"
                                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-red-400 hover:bg-red-400/20 transition-all ${isSelected ? 'opacity-100 block' : 'opacity-0 hidden group-hover:opacity-100 group-hover:block'}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Main Content: Session Details */}
                    <div className="w-2/3 bg-white/[0.02] border border-white/8 rounded-2xl flex flex-col overflow-hidden relative">
                        {selectedSessionId && loadingDetails ? (
                            <div className="absolute inset-0 bg-[#0a0a0a]/50 backdrop-blur-sm z-10 flex flex-col justify-center items-center">
                                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                                <p className="text-white/40 text-sm">Loading details...</p>
                            </div>
                        ) : null}

                        {!selectedSessionId ? (
                            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 text-white/30">
                                <div className="text-4xl mb-4 opacity-50">📂</div>
                                <p>Select a session folder from the left<br />to view questions and feedback.</p>
                            </div>
                        ) : sessionDetails ? (
                            <>
                                <div className="p-6 border-b border-white/8 bg-white/5 sticky top-0 z-0 flex items-start justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white mb-2 capitalize">
                                            {sessionDetails.session.mode} Session Overview
                                        </h2>
                                        <div className="flex flex-wrap gap-3 text-sm">
                                            <span className="text-white/60 bg-white/5 px-3 py-1 rounded-lg">
                                                Role: <strong className="text-white">{sessionDetails.session.jobRole || 'General'}</strong>
                                            </span>
                                            <span className="text-white/60 bg-white/5 px-3 py-1 rounded-lg">
                                                Date: <strong className="text-white">{formatDate(sessionDetails.session.createdAt)}</strong>
                                            </span>
                                            {sessionDetails.session.yoe > 0 && (
                                                <span className="text-white/60 bg-white/5 px-3 py-1 rounded-lg">
                                                    Experience: <strong className="text-white">{sessionDetails.session.yoe} years</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setIsFullscreen(true)}
                                            title="View Fullscreen"
                                            className="p-2 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V5a1 1 0 011-1h3M4 16v3a1 1 0 001 1h3m10-11V5a1 1 0 00-1-1h-3m4 11v3a1 1 0 01-1 1h-3" />
                                            </svg>
                                        </button>
                                        <button 
                                            onClick={downloadSessionReport}
                                            className="text-[11px] bg-white text-black font-semibold px-4 py-2 rounded-xl hover:bg-white/90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(255,255,255,0.15)]"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Export Report
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                                    {sessionDetails.details.length === 0 ? (
                                        <p className="text-white/40 text-center py-10">No questions answered in this session.</p>
                                    ) : (
                                        sessionDetails.details.map((item, index) => (
                                            <div key={item.question?._id || index} className="bg-white/5 border border-white/10 rounded-2xl p-5 relative overflow-hidden">
                                                {/* Question Area */}
                                                <div className="mb-4">
                                                    <div className="flex items-center gap-2 mb-2 text-white/40 text-xs font-semibold uppercase tracking-wider">
                                                        <span>Question {index + 1}</span>
                                                        {item.question?.difficulty && (
                                                            <span className={`px-2 py-0.5 rounded-full border ${item.question.difficulty === 'Easy' ? 'text-green-400 border-green-400/20 bg-green-400/10' :
                                                                    item.question.difficulty === 'Medium' ? 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10' :
                                                                        'text-red-400 border-red-400/20 bg-red-400/10'
                                                                }`}>
                                                                {item.question.difficulty}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-white text-base leading-relaxed font-medium">
                                                        {item.question?.text || "Unknown Question"}
                                                    </p>
                                                </div>

                                                {/* User's Answer */}
                                                <div className="bg-[#0a0a0a]/50 p-4 rounded-xl border border-white/5 mb-4">
                                                    <span className="text-xs text-white/30 uppercase font-semibold mb-2 block tracking-wider flex items-center gap-1.5"><span className="text-blue-400">🎤</span> Your Answer</span>
                                                    <p className="text-white/80 text-sm leading-relaxed">
                                                        {item.answer?.transcript || <span className="text-white/20 italic">No answer provided / Audio skip</span>}
                                                    </p>
                                                </div>

                                                {/* Feedback / Evaluation */}
                                                {item.evaluation ? (
                                                    <div className="bg-blue-400/5 border border-blue-400/10 rounded-xl p-4">
                                                        <span className="text-xs text-blue-400/60 uppercase font-semibold mb-3 block tracking-wider flex items-center gap-1.5"><span>💡</span> Evaluation Feedback</span>

                                                        <p className="text-white/90 text-sm leading-relaxed mb-4">
                                                            {item.evaluation.generalFeedback}
                                                        </p>

                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                            {[
                                                                { label: 'Technical', val: item.evaluation.scoreTech, max: 10 },
                                                                { label: 'Relevance', val: item.evaluation.scoreRelevance, max: 10 },
                                                                { label: 'Depth', val: item.evaluation.scoreDepth, max: 10 },
                                                                { label: 'Clarity', val: item.evaluation.scoreClarity, max: 10 }
                                                            ].map(score => (
                                                                <div key={score.label} className="bg-white/5 p-2 rounded-lg text-center">
                                                                    <div className="text-[10px] text-white/40 mb-1">{score.label}</div>
                                                                    <div className="font-bold text-white text-sm">
                                                                        {score.val}<span className="text-white/30 text-[10px]">/{score.max}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-yellow-400/50 bg-yellow-400/5 p-3 rounded-lg border border-yellow-400/10">
                                                        No evaluation available for this answer.
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            )}
        </div>

        {/* ── Expanded Session Modal ─────────────────────────────────────── */}
        {isFullscreen && sessionDetails && (
            <div
                className="fixed inset-0 z-[100] flex items-center justify-center p-6"
                style={{ fontFamily: "'Inter', sans-serif" }}
                onClick={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false); }}
            >
                <style>{`
                    @keyframes modalSlideIn {
                        from { opacity: 0; transform: translateY(16px) scale(0.98); }
                        to   { opacity: 1; transform: translateY(0) scale(1); }
                    }
                    .modal-scrollbar::-webkit-scrollbar { width: 5px; }
                    .modal-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .modal-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
                `}</style>

                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsFullscreen(false)} />

                {/* Modal panel */}
                <div
                    className="relative z-10 w-full max-w-4xl max-h-[88vh] bg-[#0f0f12] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                    style={{ animation: 'modalSlideIn 0.22s cubic-bezier(0.16,1,0.3,1)' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-7 py-5 border-b border-white/8 shrink-0">
                        <div className="flex items-center gap-3 flex-wrap">
                            <h2 className="text-white font-bold text-lg capitalize">
                                {sessionDetails.session.mode} Session
                            </h2>
                            <span className="text-xs text-white/30 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                                {sessionDetails.session.jobRole || 'General'}
                            </span>
                            <span className="text-xs text-white/25">
                                {formatDate(sessionDetails.session.createdAt)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-white/30 mr-2">{sessionDetails.details.length} question{sessionDetails.details.length !== 1 ? 's' : ''}</span>
                            <button
                                onClick={downloadSessionReport}
                                title="Export Report"
                                className="text-[11px] border border-white/10 text-white/50 hover:text-white hover:border-white/30 hover:bg-white/5 px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Export
                            </button>
                            <button
                                onClick={() => setIsFullscreen(false)}
                                title="Close"
                                className="w-8 h-8 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/30 hover:bg-white/5 transition-all flex items-center justify-center"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Scrollable Q&A content */}
                    <div className="flex-1 overflow-y-auto modal-scrollbar px-7 py-6 space-y-6">
                        {sessionDetails.details.length === 0 ? (
                            <div className="text-center py-16 text-white/30">
                                <div className="text-4xl mb-3">📭</div>
                                <p>No questions answered in this session.</p>
                            </div>
                        ) : (
                            sessionDetails.details.map((item, index) => (
                                <div
                                    key={item.question?._id || index}
                                    className="bg-white/[0.03] border border-white/8 rounded-2xl overflow-hidden"
                                    style={{ animation: `modalSlideIn 0.3s cubic-bezier(0.16,1,0.3,1) ${index * 0.06}s both` }}
                                >
                                    {/* Question header bar */}
                                    <div className="px-5 py-3.5 border-b border-white/6 flex items-center justify-between bg-white/[0.025]">
                                        <div className="flex items-center gap-2.5">
                                            <span className="w-6 h-6 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-bold text-white/60">
                                                {index + 1}
                                            </span>
                                            <span className="text-xs text-white/40 uppercase tracking-widest font-semibold">Question</span>
                                        </div>
                                        {item.question?.difficulty && (
                                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                                                item.question.difficulty === 'Easy' ? 'text-green-400 border-green-400/20 bg-green-400/10' :
                                                item.question.difficulty === 'Medium' ? 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10' :
                                                'text-red-400 border-red-400/20 bg-red-400/10'
                                            }`}>{item.question.difficulty}</span>
                                        )}
                                    </div>

                                    <div className="p-5 space-y-4">
                                        {/* Question text */}
                                        <p className="text-white text-base font-semibold leading-relaxed">
                                            {item.question?.text || 'Unknown Question'}
                                        </p>

                                        {/* Answer */}
                                        <div className="bg-[#0a0a0a] rounded-xl border border-white/6 p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-blue-400 text-sm">🎤</span>
                                                <span className="text-xs text-white/40 uppercase tracking-widest font-semibold">Your Answer</span>
                                            </div>
                                            <p className="text-white/75 text-sm leading-relaxed">
                                                {item.answer?.transcript || <span className="text-white/25 italic">No answer provided / Audio skip</span>}
                                            </p>
                                        </div>

                                        {/* Evaluation */}
                                        {item.evaluation ? (
                                            <div className="bg-blue-400/5 border border-blue-400/10 rounded-xl p-4">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-sm">💡</span>
                                                    <span className="text-xs text-blue-400/70 uppercase tracking-widest font-semibold">AI Feedback</span>
                                                </div>
                                                <p className="text-white/80 text-sm leading-relaxed mb-4">
                                                    {item.evaluation.generalFeedback}
                                                </p>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[
                                                        { label: 'Technical', val: item.evaluation.scoreTech, color: 'text-blue-400' },
                                                        { label: 'Relevance', val: item.evaluation.scoreRelevance, color: 'text-purple-400' },
                                                        { label: 'Depth', val: item.evaluation.scoreDepth, color: 'text-indigo-400' },
                                                        { label: 'Clarity', val: item.evaluation.scoreClarity, color: 'text-cyan-400' },
                                                    ].map(score => (
                                                        <div key={score.label} className="bg-white/5 rounded-xl p-3 text-center border border-white/6">
                                                            <div className={`text-xl font-bold ${score.color}`}>
                                                                {score.val}<span className="text-xs text-white/30">/10</span>
                                                            </div>
                                                            <div className="text-[10px] text-white/40 mt-1">{score.label}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-yellow-400/50 bg-yellow-400/5 p-3 rounded-lg border border-yellow-400/10">
                                                No evaluation available for this answer.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className="px-7 py-3.5 border-t border-white/6 shrink-0 flex items-center justify-between bg-white/[0.015]">
                        <span className="text-xs text-white/20">Click outside or press <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/35 text-[10px]">Esc</kbd> to close</span>
                        <span className="text-xs text-white/20">{sessionDetails.details.length} question{sessionDetails.details.length !== 1 ? 's' : ''} reviewed</span>
                    </div>
                </div>
            </div>
        )}
    </>
    );
}
