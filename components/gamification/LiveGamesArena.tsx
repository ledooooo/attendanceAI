import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
    Swords, UserX, Trophy, Users, Clock,
    Play, X, CheckCircle2, BrainCircuit, Loader2, Trash2, Timer, Hand, Grid3x3, Bus,
    Link2, Share2, Sparkles, RefreshCw, Bell, BellOff, Smartphone,
    Send, Wifi, WifiOff, ChevronDown, ChevronUp
} from 'lucide-react';
import Connect4Game from './games/Connect4Game';
import XOGame from './games/XOGame';
import StopTheBusGame from './games/StopTheBusGame';
import ChessGame from './games/ChessGame';
import HangmanGame from './games/HangmanGame';
import BottleMatchGame from './games/BottleMatchGame';
import PuzzleGame from './games/PuzzleGame';
import MemoryGame from './games/MemoryGame';

// ─── Beautiful Avatars ────────────────────────────────────────────────────────
const AVATAR_STYLES = [
    { bg: 'from-rose-400 to-pink-600',     ring: 'ring-pink-300'   },
    { bg: 'from-violet-400 to-purple-600', ring: 'ring-purple-300' },
    { bg: 'from-blue-400 to-cyan-500',     ring: 'ring-cyan-300'   },
    { bg: 'from-amber-400 to-orange-500',  ring: 'ring-orange-300' },
    { bg: 'from-emerald-400 to-teal-500',  ring: 'ring-teal-300'   },
    { bg: 'from-indigo-400 to-blue-600',   ring: 'ring-blue-300'   },
];

const ALIASES = [
    { name: 'طبيب غامض',      emoji: '🕵️',  bg: 'from-slate-600 to-gray-800',    ring: 'ring-gray-400'   },
    { name: 'ممرض نينجا',     emoji: '🥷',  bg: 'from-gray-700 to-slate-900',    ring: 'ring-slate-400'  },
    { name: 'شبح المعمل',     emoji: '👻',  bg: 'from-blue-800 to-indigo-900',   ring: 'ring-indigo-400' },
    { name: 'ساحر الأدوية',   emoji: '🧙',  bg: 'from-purple-700 to-violet-900', ring: 'ring-purple-400' },
    { name: 'بطلة الطوارئ',   emoji: '🦸',  bg: 'from-rose-500 to-red-700',      ring: 'ring-red-400'    },
    { name: 'صقر الجودة',     emoji: '🦅',  bg: 'from-amber-600 to-yellow-700',  ring: 'ring-amber-400'  },
    { name: 'دينامو الاستقبال',emoji: '⚡', bg: 'from-yellow-400 to-amber-600',  ring: 'ring-yellow-400' },
    { name: 'قناص الملفات',   emoji: '🎯',  bg: 'from-emerald-600 to-green-800', ring: 'ring-green-400'  },
    { name: 'روبوت الطوارئ',  emoji: '🤖',  bg: 'from-cyan-500 to-blue-700',     ring: 'ring-cyan-400'   },
    { name: 'فارس الصحة',     emoji: '🛡️', bg: 'from-teal-500 to-emerald-700',  ring: 'ring-teal-400'   },
    { name: 'نجم التشخيص',    emoji: '🌟',  bg: 'from-pink-500 to-rose-700',     ring: 'ring-pink-400'   },
    { name: 'حكيم السرير',    emoji: '🧠',  bg: 'from-indigo-500 to-purple-700', ring: 'ring-purple-300' },
];

const GAME_TYPES = [
    { key: 'xo',         label: 'XO',               icon: '✕⭕',  desc: 'إكس أو الكلاسيكية',  color: 'from-indigo-500 to-violet-600', minPlayers: 2, maxPlayers: 2  },
    { key: 'connect4',   label: 'Connect 4',         icon: '🔴🟡', desc: 'أربعة في صف',        color: 'from-blue-500 to-cyan-600',    minPlayers: 2, maxPlayers: 2  },
    { key: 'chess',      label: 'شطرنج',             icon: '♟️',   desc: 'شطرنج كلاسيكي',      color: 'from-amber-500 to-orange-600', minPlayers: 2, maxPlayers: 2  },
    { key: 'hangman',    label: 'المشنقة',           icon: '🪢',   desc: 'خمّن الكلمة الطبية', color: 'from-rose-500 to-pink-700',    minPlayers: 2, maxPlayers: 8  },
    { key: 'bottlematch',label: 'ترتيب الزجاجات',   icon: '🍾',   desc: 'رتّب الألوان السرية', color: 'from-cyan-500 to-indigo-600',  minPlayers: 2, maxPlayers: 6  },
    { key: 'puzzle',     label: 'لعبة الأرقام',     icon: '🔢',   desc: 'رتّب 1 إلى 15',       color: 'from-amber-600 to-orange-700', minPlayers: 2, maxPlayers: 6  },
    { key: 'memory',     label: 'لعبة الذاكرة',     icon: '🧠',   desc: 'اقلب وطابق البطاقات', color: 'from-indigo-600 to-violet-700', minPlayers: 2, maxPlayers: 2  },
    { key: 'stopthebus', label: 'أتوبيس كومبليت',   icon: '🚌',   desc: 'كلمات بنفس الحرف',   color: 'from-violet-500 to-purple-700', minPlayers: 2, maxPlayers: 10 },
];

const BASE_URL = 'https://gharb-alpha.vercel.app';

function getRoomLink(matchId: string) {
    return `${BASE_URL}${window.location.pathname}#room=${matchId}`;
}

// ─── Push Notifications ───────────────────────────────────────────────────────
const VAPID_PUBLIC_KEY = 'BIkRpd6ma443zGKy3FqGVxXMT4JyARFx36pcc-NAYVdPiB1WTEw9m6XKJq4OXO70Vnyh0zYnE_NkjK3p3VZIINw';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

async function subscribeToPush(userId: string): Promise<boolean> {
    try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
        if (Notification.permission === 'denied') return false;
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return false;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (sub) {
            // Check if already saved for this user
            const { data } = await supabase.from('push_subscriptions')
                .select('id').eq('endpoint', sub.endpoint).eq('user_id', userId).maybeSingle();
            if (data) return true;
            await sub.unsubscribe();
        }
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await supabase.from('push_subscriptions').delete().eq('user_id', userId);
        await supabase.from('push_subscriptions').insert({
            user_id: userId,
            subscription_data: JSON.stringify(sub.toJSON()),
            endpoint: sub.endpoint,
            device_info: JSON.stringify({ userAgent: navigator.userAgent }),
            updated_at: new Date().toISOString(),
        });
        return true;
    } catch { return false; }
}

async function sendPushToUser(userId: string, title: string, body: string, url = '/') {
    try {
        await supabase.functions.invoke('send-push-notification', {
            body: { userId, title, body, url },
        });
    } catch { /* silent */ }
}

// ─── Share Room ───────────────────────────────────────────────────────────────
async function shareRoom(matchId: string, gameLabel: string) {
    const link = getRoomLink(matchId);
    const text = `تحداني في لعبة ${gameLabel}! انضم الآن 🎮`;

    // Try native share (mobile)
    if (navigator.share) {
        try {
            await navigator.share({ title: 'تحدي الصالة', text, url: link });
            return;
        } catch { /* fallback */ }
    }

    // Copy to clipboard
    try {
        await navigator.clipboard.writeText(`${text}\n${link}`);
        toast.success('تم نسخ رابط الغرفة! أرسله لزميلك 🔗', { icon: '📋', duration: 3000 });
    } catch {
        // Final fallback
        const el = document.createElement('textarea');
        el.value = `${text}\n${link}`;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
        toast.success('تم نسخ الرابط! 📋');
    }
}

// ─── Avatar Components ────────────────────────────────────────────────────────
const AvatarDisplay = ({ avatar, className = '', size = 'md' }: {
    avatar: string; className?: string; size?: 'sm' | 'md' | 'lg';
}) => {
    const sizeClass = size === 'sm' ? 'w-8 h-8 text-lg' : size === 'lg' ? 'w-14 h-14 text-3xl' : 'w-10 h-10 text-xl';
    if (avatar?.startsWith('http'))
        return <img src={avatar} alt="avatar" className={`${sizeClass} rounded-full object-cover ${className}`}/>;
    return (
        <div className={`${sizeClass} rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center ${className}`}>
            <span>{avatar || '👤'}</span>
        </div>
    );
};

function AliasCard({ alias, selected, onClick }: {
    alias: typeof ALIASES[0]; selected: boolean; onClick: () => void;
}) {
    return (
        <button onClick={onClick}
            className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                selected ? 'border-indigo-500 bg-indigo-50 scale-105 shadow-lg' : 'border-gray-100 hover:border-indigo-200 hover:bg-gray-50'
            }`}>
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${alias.bg} flex items-center justify-center shadow-md`}>
                <span className="text-2xl">{alias.emoji}</span>
            </div>
            <span className="text-[11px] font-black text-gray-700 text-center leading-tight">{alias.name}</span>
            {selected && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-[10px] font-black">✓</span>
                </div>
            )}
        </button>
    );
}

function RealAvatar({ employee, size = 'md' }: { employee: Employee; size?: 'sm' | 'md' | 'lg' }) {
    const sizeMap = { sm: 'w-8 h-8 text-base', md: 'w-10 h-10 text-xl', lg: 'w-14 h-14 text-3xl' };
    const cls = sizeMap[size];
    const initials = employee.name?.split(' ').slice(0, 2).map(n => n[0]).join('') || '؟';
    const styleIdx = employee.employee_id.charCodeAt(0) % AVATAR_STYLES.length;
    const style = AVATAR_STYLES[styleIdx];
    if (employee.photo_url)
        return <img src={employee.photo_url} alt="avatar" className={`${cls} rounded-full object-cover ring-2 ${style.ring}`}/>;
    return (
        <div className={`${cls} rounded-full bg-gradient-to-br ${style.bg} flex items-center justify-center ring-2 ${style.ring} shadow-sm`}>
            <span className="text-white font-black text-sm">{initials}</span>
        </div>
    );
}

// ─── Question helpers ─────────────────────────────────────────────────────────
const getSpecialtyVariations = (spec: string) => {
    if (!spec) return ['الكل'];
    const s = spec.toLowerCase();
    if (s.includes('بشر') || s.includes('عام')) return ['بشري', 'طبيب بشرى', 'طبيب عام'];
    if (s.includes('سنان') || s.includes('أسنان')) return ['أسنان', 'اسنان', 'طبيب أسنان', 'فنى اسنان'];
    if (s.includes('تمريض') || s.includes('ممرض')) return ['تمريض', 'ممرض', 'ممرضة', 'اخصائى تمريض'];
    if (s.includes('صيدل')) return ['صيدلة', 'صيدلي', 'صيدلاني'];
    if (s.includes('معمل') || s.includes('مختبر')) return ['معمل', 'فني معمل', 'مختبر'];
    if (s.includes('جود')) return ['جودة', 'الجودة'];
    return [spec, 'الكل'];
};

const normalizeQuestion = (rawQ: any) => {
    let questionText = rawQ.question || rawQ.question_text || '';
    if (rawQ.scenario) questionText = `${rawQ.scenario} - ${questionText}`;
    let opts: string[] = [], correctAns = '';
    if (rawQ.source === 'standard_quiz') {
        try {
            let parsed = rawQ.options;
            if (typeof parsed === 'string') { if (parsed.startsWith('"')) parsed = JSON.parse(parsed); if (typeof parsed === 'string') parsed = JSON.parse(parsed); }
            opts = Array.isArray(parsed) ? parsed : [];
        } catch { opts = []; }
        correctAns = rawQ.correct_answer;
    } else {
        opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d].filter(o => o && String(o).trim() !== '' && o !== 'null');
        if (rawQ.correct_index !== undefined && rawQ.correct_index !== null) correctAns = opts[rawQ.correct_index];
        else {
            const letter = String(rawQ.correct_option || rawQ.correct_answer || '').trim().toLowerCase();
            correctAns = ['a','b','c','d'].includes(letter) ? rawQ[`option_${letter}`] : letter;
        }
    }
    if (!correctAns || opts.length < 2) return null;
    return { id: rawQ.id, questionText, options: opts, correctAnswer: String(correctAns).trim().toLowerCase() };
};

const fetchUnifiedQuestion = async (employee: Employee, difficulty?: string) => {
    const variations = getSpecialtyVariations(employee.specialty);
    const orFilter = variations.map(v => `specialty.ilike.%${v}%`).join(',');
    let pool: any[] = [];
    const [r1, r2, r3] = await Promise.all([
        supabase.from('arcade_quiz_questions').select('*').or(orFilter),
        supabase.from('arcade_dose_scenarios').select('*').or(orFilter),
        supabase.from('quiz_questions').select('*').or(orFilter),
    ]);
    if (r1.data) pool.push(...r1.data.map(q => ({ ...q, source: 'arcade_quiz' })));
    if (r2.data) pool.push(...r2.data.map(q => ({ ...q, source: 'arcade_dose' })));
    if (r3.data) pool.push(...r3.data.map(q => ({ ...q, source: 'standard_quiz' })));
    if (pool.length === 0) {
        const { data } = await supabase.from('arcade_quiz_questions').select('*').limit(30);
        if (data) pool = data.map(q => ({ ...q, source: 'arcade_quiz' }));
    }
    if (difficulty) {
        const dp = pool.filter(q => q.difficulty === difficulty || (q.source === 'standard_quiz' && difficulty === 'medium'));
        if (dp.length > 0) pool = dp;
    }
    if (pool.length === 0) return null;
    for (let i = 0; i < 5; i++) {
        const n = normalizeQuestion(pool[Math.floor(Math.random() * pool.length)]);
        if (n) return n;
    }
    return null;
};

// ─── Push Notification Toggle Button ─────────────────────────────────────────
function PushToggle({ userId }: { userId: string }) {
    const [status, setStatus] = useState<'idle' | 'loading' | 'granted' | 'denied'>('idle');

    useEffect(() => {
        if ('Notification' in window) {
            if (Notification.permission === 'granted') setStatus('granted');
            else if (Notification.permission === 'denied') setStatus('denied');
        }
    }, []);

    const handleActivate = async () => {
        setStatus('loading');
        const ok = await subscribeToPush(userId);
        setStatus(ok ? 'granted' : 'denied');
        if (ok) toast.success('تم تفعيل الإشعارات! ستصلك إشعارات عند انضمام أحد لغرفتك 🔔');
        else toast.error('لم يتم تفعيل الإشعارات. تأكد من السماح بها في المتصفح.');
    };

    if (status === 'granted') return (
        <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-xl text-[11px] font-black">
            <Bell className="w-3.5 h-3.5"/> الإشعارات مفعّلة
        </div>
    );

    if (status === 'denied') return (
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-500 px-3 py-1.5 rounded-xl text-[11px] font-black">
            <BellOff className="w-3.5 h-3.5"/> مرفوض
        </div>
    );

    return (
        <button onClick={handleActivate} disabled={status === 'loading'}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl text-[11px] font-black transition-all active:scale-95 shadow-sm">
            {status === 'loading' ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Smartphone className="w-3.5 h-3.5"/>}
            تفعيل الإشعارات
        </button>
    );
}

// ─── Admin Online Users Panel ─────────────────────────────────────────────────
// Shows employees whose last_seen is within the last 5 minutes,
// lets the admin pick one (or all) and send a room-invite notification.
interface OnlineEmployee {
    employee_id: string;
    name: string;
    specialty: string | null;
    photo_url: string | null;
    last_seen: string | null;
}

function AdminOnlinePanel({ adminEmployee, currentMatchId, gameLabel }: {
    adminEmployee: Employee;
    currentMatchId: string | null;
    gameLabel: string;
}) {
    const [online, setOnline] = useState<OnlineEmployee[]>([]);
    const [sending, setSending] = useState<Record<string, boolean>>({});
    const [sent, setSent] = useState<Record<string, boolean>>({});
    const [collapsed, setCollapsed] = useState(false);
    const [sendingAll, setSendingAll] = useState(false);

    // Fetch online employees (last_seen within 5 min, exclude self)
    const fetchOnline = async () => {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const { data } = await supabase
            .from('employees')
            .select('employee_id, name, specialty, photo_url, last_seen')
            .gte('last_seen', cutoff)
            .neq('employee_id', String(adminEmployee.employee_id))
            .neq('role', 'admin')
            .order('last_seen', { ascending: false });
        if (data) setOnline(data as OnlineEmployee[]);
    };

    useEffect(() => {
        fetchOnline();
        // Refresh every 30 seconds
        const iv = setInterval(fetchOnline, 30_000);

        // Realtime: watch last_seen changes
        const channel = supabase.channel('online_presence_admin')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'employees',
                filter: `role=neq.admin`,
            }, () => { fetchOnline(); })
            .subscribe();

        return () => { clearInterval(iv); supabase.removeChannel(channel); };
    }, [adminEmployee.employee_id]);

    const sendInvite = async (emp: OnlineEmployee) => {
        if (!currentMatchId) return;
        const link = getRoomLink(currentMatchId);
        setSending(p => ({ ...p, [emp.employee_id]: true }));

        // Insert notification into notifications table
        await supabase.from('notifications').insert({
            user_id: String(emp.employee_id),
            title: `🎮 دعوة لعبة من ${adminEmployee.name?.split(' ')[0] || 'المدير'}`,
            message: `تم دعوتك للانضمام لغرفة ${gameLabel}! اضغط هنا للانضمام 👉 ${link}`,
            type: 'competition',
            is_read: false,
        });

        // Also try push notification
        await sendPushToUser(
            String(emp.employee_id),
            `🎮 دعوة لعبة من ${adminEmployee.name?.split(' ')[0] || 'المدير'}`,
            `انضم لغرفة ${gameLabel} الآن!`,
            link,
        );

        setSending(p => ({ ...p, [emp.employee_id]: false }));
        setSent(p => ({ ...p, [emp.employee_id]: true }));
        toast.success(`تم إرسال الدعوة لـ ${emp.name?.split(' ')[0]} ✅`);
        // Reset sent badge after 10s
        setTimeout(() => setSent(p => ({ ...p, [emp.employee_id]: false })), 10_000);
    };

    const sendToAll = async () => {
        if (!currentMatchId || online.length === 0) return;
        setSendingAll(true);
        await Promise.all(online.map(emp => sendInvite(emp)));
        setSendingAll(false);
        toast.success(`تم إرسال الدعوة لـ ${online.length} موظف أونلاين! 🎉`);
    };

    // Time ago
    const timeAgo = (iso: string | null) => {
        if (!iso) return '';
        const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
        if (secs < 60) return 'الآن';
        if (secs < 3600) return `منذ ${Math.floor(secs / 60)} د`;
        return `منذ ${Math.floor(secs / 3600)} س`;
    };

    // Initials helper
    const initials = (name: string) => name?.split(' ').slice(0, 2).map(n => n[0]).join('') || '؟';
    const styleIdx = (id: string) => id.charCodeAt(0) % AVATAR_STYLES.length;

    return (
        <div className="bg-white rounded-2xl border-2 border-green-200 shadow-sm overflow-hidden">
            {/* Header */}
            <button
                onClick={() => setCollapsed(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white"
            >
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Wifi className="w-4 h-4"/>
                        {online.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-400 text-gray-900 text-[9px] font-black rounded-full flex items-center justify-center">{online.length}</span>
                        )}
                    </div>
                    <span className="font-black text-sm">
                        الموظفون أونلاين الآن
                        {online.length === 0 && <span className="text-green-200 font-bold text-xs mr-1">(لا أحد)</span>}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {currentMatchId && online.length > 0 && !collapsed && (
                        <button
                            onClick={e => { e.stopPropagation(); sendToAll(); }}
                            disabled={sendingAll}
                            className="flex items-center gap-1 bg-white/20 hover:bg-white/30 border border-white/30 text-white px-2.5 py-1 rounded-lg text-[11px] font-black transition-all active:scale-95"
                        >
                            {sendingAll ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>}
                            دعوة الكل
                        </button>
                    )}
                    {collapsed ? <ChevronDown className="w-4 h-4"/> : <ChevronUp className="w-4 h-4"/>}
                </div>
            </button>

            {/* Body */}
            {!collapsed && (
                <div className="p-3">
                    {online.length === 0 ? (
                        <div className="text-center py-5">
                            <WifiOff className="w-8 h-8 text-gray-200 mx-auto mb-2"/>
                            <p className="text-xs font-bold text-gray-400">لا يوجد موظفون متصلون حالياً</p>
                            <p className="text-[10px] text-gray-300 mt-0.5">يتحدث عن آخر 5 دقائق</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                            {online.map(emp => {
                                const isSending = sending[emp.employee_id];
                                const isSent = sent[emp.employee_id];
                                const idx = styleIdx(emp.employee_id);
                                const style = AVATAR_STYLES[idx];
                                return (
                                    <div key={emp.employee_id}
                                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                                        {/* Avatar */}
                                        <div className="relative flex-shrink-0">
                                            {emp.photo_url ? (
                                                <img src={emp.photo_url} alt={emp.name}
                                                    className={`w-9 h-9 rounded-full object-cover ring-2 ${style.ring}`}/>
                                            ) : (
                                                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${style.bg} flex items-center justify-center ring-2 ${style.ring}`}>
                                                    <span className="text-white font-black text-xs">{initials(emp.name)}</span>
                                                </div>
                                            )}
                                            {/* Green dot */}
                                            <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white"/>
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-gray-800 truncate">{emp.name}</p>
                                            <div className="flex items-center gap-1.5">
                                                {emp.specialty && (
                                                    <span className="text-[10px] text-gray-400 font-bold truncate max-w-[90px]">{emp.specialty}</span>
                                                )}
                                                <span className="text-[9px] text-green-500 font-bold">{timeAgo(emp.last_seen)}</span>
                                            </div>
                                        </div>

                                        {/* Invite button */}
                                        <button
                                            onClick={() => sendInvite(emp)}
                                            disabled={isSending || isSent || !currentMatchId}
                                            className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-black text-[11px] transition-all active:scale-95 ${
                                                isSent
                                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                                    : !currentMatchId
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                            }`}
                                        >
                                            {isSending ? (
                                                <Loader2 className="w-3 h-3 animate-spin"/>
                                            ) : isSent ? (
                                                <><CheckCircle2 className="w-3 h-3"/> تم</>
                                            ) : (
                                                <><Send className="w-3 h-3"/> دعوة</>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Hint */}
                    {!currentMatchId && (
                        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2 font-bold text-center">
                            أنشئ غرفة أولاً لتتمكن من إرسال الدعوات
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface LiveGamesArenaProps {
    employee: Employee;
    onClose?: () => void;
    initialRoomId?: string | null;
}

export default function LiveGamesArena({ employee, onClose, initialRoomId }: LiveGamesArenaProps) {
    const queryClient = useQueryClient();

    const [matches, setMatches] = useState<any[]>([]);
    const [currentMatch, setCurrentMatch] = useState<any>(null);
    const [view, setView] = useState<'lobby' | 'game_select' | 'identity_setup' | 'playing' | 'leaderboard'>('lobby');

    const [selectedGameType, setSelectedGameType] = useState<string>('xo');
    const [useAlias, setUseAlias] = useState(false);
    const [selectedAlias, setSelectedAlias] = useState(ALIASES[0]);
    const [joiningMatchId, setJoiningMatchId] = useState<string | null>(null);
    const [joiningGameType, setJoiningGameType] = useState<string>('xo');
    const [loading, setLoading] = useState(false);
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [myStats, setMyStats] = useState<any>(null);

    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [autoDeleteTimeLeft, setAutoDeleteTimeLeft] = useState<number | null>(null);
    const autoDeleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Rematch state ──────────────────────────────────────────────────────────
    const [rematchLoading, setRematchLoading] = useState(false);
    const [rematchOfferedTo, setRematchOfferedTo] = useState<string | null>(null);
    const [rematchRequestFrom, setRematchRequestFrom] = useState<string | null>(null);

    // ── Admin ──────────────────────────────────────────────────────────────────
    const isAdmin = (employee as any).role === 'admin';
    // Track the active waiting room ID so admin can send invites
    const [adminActiveRoomId, setAdminActiveRoomId] = useState<string | null>(null);

    // ── Auto-delete timer ──────────────────────────────────────────────────────
    useEffect(() => {
        if (currentMatch?.status === 'waiting' && currentMatch.created_by === employee.employee_id) {
            const elapsed = Date.now() - new Date(currentMatch.created_at).getTime();
            const remaining = Math.max(0, 3 * 60 * 1000 - elapsed);
            setAutoDeleteTimeLeft(Math.floor(remaining / 1000));
            if (autoDeleteTimerRef.current) clearTimeout(autoDeleteTimerRef.current);
            autoDeleteTimerRef.current = setTimeout(() => handleDeleteMatch(currentMatch.id, true), remaining);
        } else {
            if (autoDeleteTimerRef.current) { clearTimeout(autoDeleteTimerRef.current); autoDeleteTimerRef.current = null; }
            setAutoDeleteTimeLeft(null);
        }
        return () => { if (autoDeleteTimerRef.current) clearTimeout(autoDeleteTimerRef.current); };
    }, [currentMatch?.id, currentMatch?.status]);

    useEffect(() => {
        if (!autoDeleteTimeLeft || autoDeleteTimeLeft <= 0) return;
        const iv = setInterval(() => setAutoDeleteTimeLeft(p => (p && p > 0 ? p - 1 : 0)), 1000);
        return () => clearInterval(iv);
    }, [autoDeleteTimeLeft]);

    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;
        const iv = setInterval(() => setTimeLeft(p => {
            if (p && p <= 1) { clearInterval(iv); handleTimeOut(); return 0; }
            return p ? p - 1 : 0;
        }), 1000);
        return () => clearInterval(iv);
    }, [timeLeft]);

    const handleTimeOut = () => {
        if (currentMatch?.status === 'answering_reward') handleRewardAnswer('TIMEOUT_WRONG_ANSWER');
    };

    // ── Deep link: auto-join room from URL hash ────────────────────────────────
    useEffect(() => {
        if (initialRoomId) {
            setJoiningMatchId(initialRoomId);
            setView('identity_setup');
        }
    }, [initialRoomId]);

    // ── Realtime subscription ──────────────────────────────────────────────────
    useEffect(() => {
        fetchWaitingMatches();
        const channel = supabase.channel('live_arena_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'live_matches' }, payload => {
                if (payload.eventType === 'DELETE') {
                    setMatches(prev => prev.filter(m => m.id !== payload.old.id));
                    if (currentMatch?.id === payload.old.id) { setCurrentMatch(null); setView('lobby'); toast('تم إغلاق الغرفة', { icon: '🚪' }); }
                    return;
                }
                const updated = payload.new;
                if (updated.status === 'waiting') fetchWaitingMatches();
                else setMatches(prev => prev.filter(m => m.id !== updated.id));

                setCurrentMatch((prev: any) => {
                    if (!prev || prev.id !== updated.id) return prev;

                    // Someone joined my waiting room
                    if (prev.status === 'waiting' && updated.status === 'playing' && updated.created_by === employee.employee_id) {
                        toast.success('انضم منافس! اللعبة بدأت 🎮', { icon: '🔥', duration: 4000 });
                        new Audio('/notification.mp3').play().catch(() => {});
                    }

                    if (updated.status === 'answering_reward' && prev.status !== 'answering_reward' && updated.winner_id === employee.employee_id) {
                        setTimeLeft(updated.final_question?.timeLimit || 15);
                    }

                    // Rematch request came in via game_state.rematch_request
                    const remReq = updated.game_state?.rematch_request;
                    if (remReq && remReq.to === employee.employee_id && !remReq.accepted) {
                        setRematchRequestFrom(remReq.from);
                    }
                    // Rematch accepted — auto-create new room
                    if (updated.game_state?.rematch_request?.accepted && updated.game_state?.rematch_new_room_id) {
                        const newRoomId = updated.game_state.rematch_new_room_id;
                        // Both players join the new room
                        handleJoinRematchRoom(newRoomId);
                    }

                    return updated;
                });
            }).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [employee.employee_id, currentMatch?.id]);

    const fetchWaitingMatches = async () => {
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        await supabase.from('live_matches').delete().eq('status', 'waiting').lt('created_at', cutoff);
        const { data } = await supabase.from('live_matches').select('*').eq('status', 'waiting').order('created_at', { ascending: false });
        if (data) setMatches(data);
    };

    const checkCooldown = async () => {
        const { data } = await supabase.from('points_ledger').select('id').eq('employee_id', employee.employee_id)
            .like('reason', '%الألعاب الجماعية%').gte('created_at', new Date(Date.now() - 3600000).toISOString()).limit(1);
        return data && data.length > 0;
    };

    const playWinSound = () => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const notes = [523, 659, 784, 1047, 1319];
            notes.forEach((freq, i) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'triangle';
                osc.frequency.value = freq;
                const t = ctx.currentTime + i * 0.13;
                gain.gain.setValueAtTime(0.001, t);
                gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
                osc.start(t);
                osc.stop(t + 0.5);
            });
        } catch (_) { /* silent */ }
    };

    const fireConfetti = () => {
        const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#f97316', '#ffffff'];
        // Burst from left
        confetti({ particleCount: 100, angle: 60, spread: 65, origin: { x: 0, y: 0.7 }, zIndex: 9999, colors });
        // Burst from right
        confetti({ particleCount: 100, angle: 120, spread: 65, origin: { x: 1, y: 0.7 }, zIndex: 9999, colors });
        // Second wave from center top after 350ms
        setTimeout(() => {
            confetti({ particleCount: 150, angle: 90, spread: 120, origin: { x: 0.5, y: 0.3 }, zIndex: 9999, colors });
        }, 350);
    };

    const grantPoints = async (pts: number) => {
        if (pts <= 0) return;
        const onCooldown = await checkCooldown();
        if (onCooldown) { toast.success('فوز رائع! (النقاط تضاف مرة كل ساعة)', { icon: '🎮' }); return; }
        await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: pts });
        await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: pts, reason: `فوز في الألعاب الجماعية 🏆` });
        toast.success(`🏆 مبروك! تمت إضافة ${pts} نقطة!`, { style: { background: '#22c55e', color: '#fff', fontWeight: 'bold' }, duration: 4000 });
        playWinSound();
        fireConfetti();
    };

    const recordResult = async (result: 'win' | 'loss' | 'draw', game: string, opponentName: string) => {
        await supabase.from('live_game_results').insert({
            employee_id: employee.employee_id,
            employee_name: employee.name,
            game_type: game,
            result,
            opponent_name: opponentName,
            played_at: new Date().toISOString(),
        });
    };

    const fetchLeaderboard = async () => {
        const { data } = await supabase.from('live_game_results').select('employee_id, employee_name, result, game_type')
            .order('played_at', { ascending: false }).limit(500);
        if (!data) return;
        const stats: Record<string, { name: string; wins: number; losses: number; draws: number; games: number }> = {};
        for (const r of data) {
            if (!stats[r.employee_id]) stats[r.employee_id] = { name: r.employee_name, wins: 0, losses: 0, draws: 0, games: 0 };
            stats[r.employee_id].games++;
            if (r.result === 'win')  stats[r.employee_id].wins++;
            if (r.result === 'loss') stats[r.employee_id].losses++;
            if (r.result === 'draw') stats[r.employee_id].draws++;
        }
        const sorted = Object.entries(stats)
            .map(([id, s]) => ({ id, ...s, winRate: s.games > 0 ? Math.round(s.wins / s.games * 100) : 0 }))
            .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
        setLeaderboard(sorted);
        setMyStats(sorted.find(s => s.id === employee.employee_id) ?? null);
    };

    // ── Player info ──────────────────────────────────────────────────────────
    const getMyPlayerInfo = (gameType?: string) => {
        const gt = gameType ?? selectedGameType;
        if (useAlias) {
            return {
                id: employee.employee_id,
                name: selectedAlias.name,
                avatar: selectedAlias.emoji,
                avatarBg: selectedAlias.bg,
                isAlias: true,
                symbol: gt === 'xo' ? 'X' : gt === 'connect4' ? 'R' : gt === 'chess' ? '♔' : undefined,
            };
        }
        const styleIdx = employee.employee_id.charCodeAt(0) % AVATAR_STYLES.length;
        return {
            id: employee.employee_id,
            name: employee.name?.split(' ')[0],
            avatar: employee.photo_url || '👤',
            avatarBg: AVATAR_STYLES[styleIdx].bg,
            isAlias: false,
            symbol: gt === 'xo' ? 'X' : gt === 'connect4' ? 'R' : gt === 'chess' ? '♔' : undefined,
        };
    };

    // ── Create match ──────────────────────────────────────────────────────────
    const handleCreateMatch = async () => {
        setLoading(true);
        const player = getMyPlayerInfo();
        let initialState: any = {};
        if (selectedGameType === 'xo')           initialState = { board: Array(9).fill(null), current_turn: player.id };
        else if (selectedGameType === 'connect4') initialState = { board: Array.from({ length: 6 }, () => Array(7).fill(null)), current_turn: player.id };
        else if (selectedGameType === 'chess') {
            const order = ['R','N','B','Q','K','B','N','R'];
            const b = Array.from({ length: 8 }, () => Array(8).fill(null));
            for (let c = 0; c < 8; c++) {
                b[0][c] = { type: order[c], color: 'b' };
                b[1][c] = { type: 'P',      color: 'b' };
                b[6][c] = { type: 'P',      color: 'w' };
                b[7][c] = { type: order[c], color: 'w' };
            }
            initialState = { board: b, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, enPassant: null, halfmove: 0, moveHistory: [], whiteTime: 300, blackTime: 300, lastMoveAt: Date.now(), currentTurn: player.id, result: 'ongoing', drawOfferedBy: null };
        }
        else if (selectedGameType === 'hangman')     initialState = {};
        else if (selectedGameType === 'bottlematch') initialState = {};
        else if (selectedGameType === 'puzzle')      initialState = {};
        else if (selectedGameType === 'memory')      initialState = {};
        else if (selectedGameType === 'stopthebus')  initialState = { letter: '', startedAt: 0, allAnswers: [], voteRound: 1 };

        const { data, error } = await supabase.from('live_matches').insert({
            game_type: selectedGameType, status: 'waiting', players: [player],
            game_state: initialState, created_by: employee.employee_id,
        }).select().single();
        setLoading(false);
        if (error) return toast.error('خطأ في الإنشاء');

        // Send push notification to all employees who have subscriptions (optional broadcast)
        // For now, just auto-subscribe creator to push if not yet
        subscribeToPush(String(employee.employee_id));

        setCurrentMatch(data); setView('playing');
        // Admin: track this room id for inviting online employees
        if (isAdmin) setAdminActiveRoomId(data.id);
    };

    // ── Join match ─────────────────────────────────────────────────────────────
    const handleJoinMatch = async () => {
        if (!joiningMatchId) return;
        setLoading(true);
        const { data: match } = await supabase.from('live_matches').select('*').eq('id', joiningMatchId).single();
        if (!match || match.status !== 'waiting') { setLoading(false); return toast.error('الغرفة غير متاحة'); }

        const gt = match.game_type;
        const playerInfo = getMyPlayerInfo(gt);
        const player = {
            ...playerInfo,
            symbol: gt === 'xo' ? 'O' : gt === 'connect4' ? 'Y' : gt === 'chess' ? '♚' : undefined,
        };
        const newStatus = (['stopthebus','hangman','bottlematch','puzzle','memory'].includes(gt)) ? 'waiting' : 'playing';
        const updatedPlayers = [...match.players, player];

        const { data: updated, error } = await supabase.from('live_matches').update({
            players: updatedPlayers, status: newStatus,
        }).eq('id', joiningMatchId).select().single();
        setLoading(false);
        if (error) return toast.error('فشل الانضمام');

        // Notify room creator
        const creator = match.players?.[0];
        if (creator) {
            sendPushToUser(
                String(creator.id),
                '🎮 انضم لاعب جديد!',
                `${playerInfo.name} انضم لغرفتك في لعبة ${GAME_TYPES.find(g => g.key === gt)?.label}!`,
                getRoomLink(match.id),
            );
        }

        setCurrentMatch(updated); setView('playing');
    };

    // ── Join rematch room (after rematch accepted) ────────────────────────────
    const handleJoinRematchRoom = async (roomId: string) => {
        try {
            const { data: match } = await supabase.from('live_matches').select('*').eq('id', roomId).single();
            if (!match) return;
            setCurrentMatch(match);
            setView('playing');
            setRematchOfferedTo(null);
            setRematchRequestFrom(null);
            toast.success('جاري إعادة المباراة! 🔄', { icon: '🎮' });
        } catch { /* silent */ }
    };

    // ── Delete match ──────────────────────────────────────────────────────────
    const handleDeleteMatch = async (matchId: string, isAuto = false) => {
        if (!isAuto) setLoading(true);
        try {
            await supabase.from('live_matches').delete().eq('id', matchId);
            if (isAuto) toast('تم إغلاق الغرفة لعدم انضمام أحد', { icon: '⏳' });
            else toast.success('تم حذف الغرفة');
        } catch { if (!isAuto) toast.error('لم يتم الحذف من السيرفر'); }
        if (currentMatch?.id === matchId) { setCurrentMatch(null); setView('lobby'); }
        setMatches(prev => prev.filter(m => m.id !== matchId));
        if (!isAuto) setLoading(false);
    };

    // ── Reward ────────────────────────────────────────────────────────────────
    const handleRewardSelection = async (difficulty: 'easy' | 'medium' | 'hard', pts: number, timeLimit: number) => {
        setLoading(true);
        const q = await fetchUnifiedQuestion(employee, difficulty);
        if (!q) {
            toast.success(`لا أسئلة — ربحت ${pts} نقطة مباشرة!`);
            await grantPoints(pts);
            await supabase.from('live_matches').update({ status: 'finished' }).eq('id', currentMatch.id);
            setLoading(false); return;
        }
        await supabase.from('live_matches').update({ status: 'answering_reward', final_question: { ...q, rewardPoints: pts, timeLimit } }).eq('id', currentMatch.id);
        setLoading(false);
    };

    const handleRewardAnswer = async (answerText: string) => {
        setLoading(true); setTimeLeft(null);
        const correct = currentMatch.final_question?.correctAnswer || '';
        const sel = answerText.trim().toLowerCase();
        const isCorrect = correct === sel || correct.includes(sel) || sel.includes(correct);
        if (isCorrect) await grantPoints(currentMatch.final_question?.rewardPoints || 0);
        else toast.error(answerText === 'TIMEOUT_WRONG_ANSWER' ? 'انتهى الوقت!' : 'إجابة خاطئة! حظ أوفر');
        await supabase.from('live_matches').update({ status: 'finished' }).eq('id', currentMatch.id);
        setLoading(false);
    };

    // ── REMATCH ───────────────────────────────────────────────────────────────
    const handleRequestRematch = async () => {
        if (!currentMatch) return;
        const opp = currentMatch.players?.find((p: any) => p.id !== employee.employee_id);
        if (!opp) return;

        setRematchLoading(true);
        // Store request in current match's game_state so the opponent sees it via realtime
        await supabase.from('live_matches').update({
            game_state: {
                ...currentMatch.game_state,
                rematch_request: { from: employee.employee_id, to: opp.id, accepted: false },
            },
        }).eq('id', currentMatch.id);

        setRematchOfferedTo(opp.id);
        setRematchLoading(false);

        // Push notification to opponent
        sendPushToUser(
            String(opp.id),
            '🔄 طلب إعادة المباراة!',
            `${employee.name?.split(' ')[0]} يريد إعادة المباراة في لعبة ${GAME_TYPES.find(g => g.key === currentMatch.game_type)?.label}!`,
            window.location.href,
        );

        toast('تم إرسال طلب إعادة المباراة للخصم ⏳', { icon: '🔄' });
    };

    const handleAcceptRematch = async () => {
        if (!currentMatch || !rematchRequestFrom) return;
        setRematchLoading(true);

        const gt = currentMatch.game_type;
        const myInfo = getMyPlayerInfo(gt);
        const oppInfo = currentMatch.players?.find((p: any) => p.id === rematchRequestFrom);
        if (!oppInfo) { setRematchLoading(false); return; }

        // Create new match with same game type & swapped roles
        const firstPlayer = oppInfo; // original requester goes first
        let initialState: any = {};
        if (gt === 'xo')           initialState = { board: Array(9).fill(null), current_turn: firstPlayer.id };
        else if (gt === 'connect4') initialState = { board: Array.from({ length: 6 }, () => Array(7).fill(null)), current_turn: firstPlayer.id };
        else if (gt === 'chess') {
            const order = ['R','N','B','Q','K','B','N','R'];
            const b = Array.from({ length: 8 }, () => Array(8).fill(null));
            for (let c = 0; c < 8; c++) { b[0][c] = { type: order[c], color: 'b' }; b[1][c] = { type: 'P', color: 'b' }; b[6][c] = { type: 'P', color: 'w' }; b[7][c] = { type: order[c], color: 'w' }; }
            initialState = { board: b, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, enPassant: null, halfmove: 0, moveHistory: [], whiteTime: 300, blackTime: 300, lastMoveAt: Date.now(), currentTurn: firstPlayer.id, result: 'ongoing', drawOfferedBy: null };
        }
        else initialState = {};

        const firstPlayerFull = { ...firstPlayer, symbol: gt === 'xo' ? 'X' : gt === 'connect4' ? 'R' : gt === 'chess' ? '♔' : undefined };
        const secondPlayerFull = { ...myInfo, symbol: gt === 'xo' ? 'O' : gt === 'connect4' ? 'Y' : gt === 'chess' ? '♚' : undefined };

        const newStatus = (['stopthebus','hangman','bottlematch','puzzle','memory'].includes(gt)) ? 'waiting' : 'playing';

        const { data: newMatch, error } = await supabase.from('live_matches').insert({
            game_type: gt, status: newStatus,
            players: [firstPlayerFull, secondPlayerFull],
            game_state: initialState,
            created_by: rematchRequestFrom,
        }).select().single();

        if (error || !newMatch) { setRematchLoading(false); return toast.error('خطأ في إنشاء الغرفة'); }

        // Signal both sides via the old match's game_state
        await supabase.from('live_matches').update({
            game_state: {
                ...currentMatch.game_state,
                rematch_request: { from: rematchRequestFrom, to: employee.employee_id, accepted: true },
                rematch_new_room_id: newMatch.id,
            },
        }).eq('id', currentMatch.id);

        setRematchLoading(false);
        // Move myself to new room
        setCurrentMatch(newMatch);
        setRematchRequestFrom(null);
        setRematchOfferedTo(null);
        toast.success('جاري إعادة المباراة! 🎮');
    };

    const handleDeclineRematch = () => {
        setRematchRequestFrom(null);
        toast('رفضت إعادة المباراة', { icon: '❌' });
    };

    const exitMatch = () => {
        setCurrentMatch(null);
        setView('lobby');
        setJoiningMatchId(null);
        setTimeLeft(null);
        setRematchOfferedTo(null);
        setRematchRequestFrom(null);
        setAdminActiveRoomId(null);
    };

    const amIWinner = currentMatch?.winner_id === employee.employee_id;
    const me       = currentMatch?.players?.find((p: any) => p.id === employee.employee_id);
    const opponent = currentMatch?.players?.find((p: any) => p.id !== employee.employee_id);
    const isGameFinished = ['finished'].includes(currentMatch?.status);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <div className="bg-gray-50 min-h-full flex flex-col relative font-sans text-right" dir="rtl">

            {onClose && (
                <button onClick={onClose} className="absolute top-3 left-3 z-50 p-2 bg-black/10 hover:bg-black/20 rounded-full text-gray-700">
                    <X className="w-5 h-5"/>
                </button>
            )}

            {/* ── LOBBY ── */}
            {view === 'lobby' && (
                <div className="p-3 flex-1 space-y-4">

                    {/* Banner + Push toggle */}
                    <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-4 text-white text-center shadow-lg">
                        <div className="flex justify-end mb-2">
                            <PushToggle userId={String(employee.employee_id)}/>
                        </div>
                        <h3 className="text-xl font-black mb-1">تحدى زملائك الآن! 🔥</h3>
                        <p className="text-indigo-100 text-xs mb-4">اختر لعبة وتحدى زميلك أونلاين</p>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {GAME_TYPES.map(g => (
                                <button key={g.key} onClick={() => setSelectedGameType(g.key)}
                                    className={`py-2 px-1 rounded-xl font-black text-xs transition-all border-2 ${selectedGameType === g.key ? 'bg-white text-indigo-700 border-white' : 'bg-white/20 text-white border-white/30 hover:bg-white/30'}`}>
                                    <span className="text-xl block mb-0.5">{g.icon}</span>
                                    <span>{g.label}</span>
                                </button>
                            ))}
                        </div>

                        <button onClick={() => { setJoiningMatchId(null); setView('identity_setup'); }}
                            className="bg-yellow-400 text-indigo-900 px-6 py-3 rounded-xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all w-full text-sm">
                            إنشاء تحدي {GAME_TYPES.find(g => g.key === selectedGameType)?.label} ⚔️
                        </button>
                    </div>

                    {/* Admin: Online employees panel */}
                    {isAdmin && (
                        <AdminOnlinePanel
                            adminEmployee={employee}
                            currentMatchId={adminActiveRoomId}
                            gameLabel={GAME_TYPES.find(g => g.key === selectedGameType)?.label || 'لعبة'}
                        />
                    )}

                    {/* Waiting rooms */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-gray-700 flex items-center gap-2 text-sm">
                                <Users className="w-4 h-4 text-indigo-500"/> غرف الانتظار ({matches.length})
                            </h4>
                            <button onClick={() => { setView('leaderboard'); fetchLeaderboard(); }}
                                className="flex items-center gap-1.5 text-xs font-black text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl hover:bg-amber-100 transition-all">
                                <Trophy className="w-3.5 h-3.5"/> لوحة النتائج
                            </button>
                        </div>
                        {matches.length === 0 ? (
                            <div className="text-center py-8 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                                <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
                                <p className="text-gray-400 font-bold text-sm">لا توجد غرف.. كن الأول!</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {matches.map((m: any) => {
                                    const isMyRoom = m.created_by === employee.employee_id;
                                    const gameInfo = GAME_TYPES.find(g => g.key === m.game_type);
                                    const isBus = m.game_type === 'stopthebus';
                                    const playerCount = m.players?.length ?? 1;
                                    const hostPlayer = m.players?.[0];
                                    return (
                                        <div key={m.id} className={`bg-white p-3 rounded-xl shadow-sm border flex justify-between items-center gap-2 ${isMyRoom ? 'border-indigo-200 bg-indigo-50/50' : 'border-gray-100'}`}>
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${hostPlayer?.avatarBg || 'from-indigo-400 to-violet-600'} flex items-center justify-center text-xl flex-shrink-0 shadow-sm`}>
                                                    {hostPlayer?.avatar?.startsWith('http')
                                                        ? <img src={hostPlayer.avatar} className="w-full h-full object-cover rounded-xl" alt=""/>
                                                        : <span>{hostPlayer?.avatar || '👤'}</span>}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <p className="font-bold text-gray-800 text-sm truncate">{hostPlayer?.name}</p>
                                                        {hostPlayer?.isAlias && <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">🥷 مجهول</span>}
                                                        <span className="bg-indigo-100 text-indigo-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">{gameInfo?.icon} {gameInfo?.label}</span>
                                                        {isMyRoom && <span className="bg-green-100 text-green-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">غرفتك</span>}
                                                        {isBus && <span className="bg-purple-100 text-purple-600 text-[10px] font-black px-1.5 py-0.5 rounded-full">{playerCount} لاعب</span>}
                                                    </div>
                                                    <p className="text-[11px] text-gray-400 font-bold">
                                                        {isBus ? `في انتظار اللاعبين... (${playerCount}/${gameInfo?.maxPlayers})` : 'في انتظار منافس...'}
                                                    </p>
                                                </div>
                                            </div>
                                            {isMyRoom ? (
                                                <div className="flex gap-1.5 flex-shrink-0">
                                                    <button onClick={() => handleDeleteMatch(m.id)} className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100"><Trash2 size={16}/></button>
                                                    <button onClick={() => shareRoom(m.id, gameInfo?.label || '')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"><Share2 size={16}/></button>
                                                    <button onClick={() => { setCurrentMatch(m); setView('playing'); }} className="px-3 py-1.5 bg-indigo-100 text-indigo-600 rounded-lg font-bold text-xs">دخول</button>
                                                </div>
                                            ) : (
                                                <div className="flex gap-1.5 flex-shrink-0">
                                                    <button onClick={() => shareRoom(m.id, gameInfo?.label || '')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"><Share2 size={16}/></button>
                                                    <button onClick={() => { setJoiningMatchId(m.id); setJoiningGameType(m.game_type); setView('identity_setup'); }}
                                                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-md hover:bg-indigo-700">انضمام</button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── IDENTITY SETUP ── */}
            {view === 'identity_setup' && (
                <div className="p-4 flex-1 flex flex-col items-center justify-start max-w-sm mx-auto w-full pt-6">
                    <div className="bg-white p-5 rounded-3xl shadow-xl border border-gray-100 w-full">
                        <div className="text-center mb-4">
                            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                                <Sparkles className="w-7 h-7 text-indigo-500"/>
                            </div>
                            <h3 className="text-xl font-black text-gray-800">اختر هويتك</h3>
                            <p className="text-xs text-gray-400 font-bold mt-1">
                                {joiningMatchId
                                    ? `الانضمام لـ: ${GAME_TYPES.find(g => g.key === joiningGameType)?.label}`
                                    : `إنشاء: ${GAME_TYPES.find(g => g.key === selectedGameType)?.label}`}
                            </p>
                        </div>

                        <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                            <button onClick={() => setUseAlias(false)}
                                className={`flex-1 py-2.5 rounded-lg font-black text-sm transition-all flex items-center justify-center gap-1.5 ${!useAlias ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500'}`}>
                                <span>😊</span> هويتي الحقيقية
                            </button>
                            <button onClick={() => setUseAlias(true)}
                                className={`flex-1 py-2.5 rounded-lg font-black text-sm transition-all flex items-center justify-center gap-1.5 ${useAlias ? 'bg-indigo-600 shadow-sm text-white' : 'text-gray-500'}`}>
                                <span>🥷</span> مجهول
                            </button>
                        </div>

                        {!useAlias ? (
                            <div className="flex items-center gap-3 bg-indigo-50 rounded-2xl p-3 mb-4 border border-indigo-100">
                                <RealAvatar employee={employee} size="lg"/>
                                <div>
                                    <p className="font-black text-gray-800">{employee.name?.split(' ')[0]}</p>
                                    <p className="text-xs text-indigo-500 font-bold">{employee.specialty || 'موظف'}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2 mb-4 max-h-[280px] overflow-y-auto p-0.5">
                                {ALIASES.map(alias => (
                                    <AliasCard key={alias.name} alias={alias} selected={selectedAlias.name === alias.name} onClick={() => setSelectedAlias(alias)}/>
                                ))}
                            </div>
                        )}

                        <button onClick={joiningMatchId ? handleJoinMatch : handleCreateMatch} disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3.5 rounded-2xl font-black text-base shadow-lg hover:scale-105 active:scale-95 transition-all flex justify-center items-center gap-2">
                            {loading ? <Loader2 className="animate-spin w-5 h-5"/> : <><Play fill="currentColor" className="w-4 h-4"/> {joiningMatchId ? 'دخول اللعبة' : 'إنشاء الغرفة'}</>}
                        </button>
                        <button onClick={() => setView('lobby')} className="mt-3 text-gray-400 font-bold text-sm hover:text-gray-600 w-full text-center">إلغاء</button>
                    </div>
                </div>
            )}

            {/* ── PLAYING ── */}
            {view === 'playing' && currentMatch && (
                <div className="flex-1 flex flex-col">

                    {/* Players header */}
                    {!['stopthebus','hangman','bottlematch','puzzle','memory'].includes(currentMatch.game_type) && (
                        <div className="px-3 py-3 flex justify-between items-center border-b border-gray-100 bg-white">
                            <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 transition-all ${currentMatch.game_state?.current_turn === me?.id ? 'border-green-400 bg-green-50 shadow-sm scale-105' : 'border-transparent opacity-60'}`}>
                                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${me?.avatarBg || 'from-indigo-400 to-violet-600'} flex items-center justify-center overflow-hidden flex-shrink-0`}>
                                    {me?.avatar?.startsWith('http') ? <img src={me.avatar} className="w-full h-full object-cover" alt=""/> : <span className="text-lg">{me?.avatar || '👤'}</span>}
                                </div>
                                <div>
                                    <p className="text-xs font-black text-gray-800">أنت</p>
                                    <p className="text-sm font-bold text-green-600">{me?.symbol}</p>
                                </div>
                            </div>
                            <div className="font-black text-gray-300 text-base">VS</div>
                            <div className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border-2 transition-all flex-row-reverse ${currentMatch.game_state?.current_turn === opponent?.id ? 'border-red-400 bg-red-50 shadow-sm scale-105' : 'border-transparent opacity-60'}`}>
                                <div className={`w-9 h-9 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center ${opponent ? `bg-gradient-to-br ${opponent?.avatarBg || 'from-rose-400 to-pink-600'}` : 'bg-gray-100'}`}>
                                    {opponent ? (opponent.avatar?.startsWith('http') ? <img src={opponent.avatar} className="w-full h-full object-cover" alt=""/> : <span className="text-lg">{opponent.avatar || '👤'}</span>) : <Loader2 className="w-4 h-4 animate-spin text-gray-400"/>}
                                </div>
                                <div className="text-left">
                                    <p className="text-xs font-black text-gray-800 truncate max-w-[70px]">{opponent?.name || 'انتظار...'}</p>
                                    <p className="text-sm font-bold text-red-500">{opponent?.symbol || '?'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Game area */}
                    <div className={`flex-1 flex flex-col ${!['stopthebus','hangman','bottlematch','puzzle','memory'].includes(currentMatch.game_type) ? 'items-center justify-center p-3' : ''}`}>

                        {/* WAITING */}
                        {currentMatch.status === 'waiting' && !['stopthebus','hangman','bottlematch','puzzle','memory'].includes(currentMatch.game_type) && (
                            <div className="text-center">
                                <Loader2 className="w-14 h-14 text-indigo-200 animate-spin mx-auto mb-4"/>
                                <h3 className="text-lg font-black text-indigo-900">في انتظار المنافس...</h3>
                                {autoDeleteTimeLeft !== null && (
                                    <p className="text-sm font-bold text-red-500 mt-2">
                                        يُغلق تلقائياً: {Math.floor(autoDeleteTimeLeft/60)}:{String(autoDeleteTimeLeft%60).padStart(2,'0')}
                                    </p>
                                )}
                                {currentMatch.created_by === employee.employee_id && (
                                    <div className="mt-6 flex items-center gap-3 justify-center flex-wrap">
                                        <button onClick={() => shareRoom(currentMatch.id, GAME_TYPES.find(g => g.key === currentMatch.game_type)?.label || '')}
                                            className="bg-green-50 text-green-600 border border-green-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-100 active:scale-95 transition-all text-sm shadow-sm">
                                            <Share2 size={16}/> شارك الرابط
                                        </button>
                                        <button onClick={() => handleDeleteMatch(currentMatch.id)}
                                            className="bg-red-50 text-red-500 border border-red-200 px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 active:scale-95 transition-all text-sm shadow-sm">
                                            <Trash2 size={16}/> إلغاء الغرفة
                                        </button>
                                    </div>
                                )}
                                {/* Admin: invite online employees while waiting */}
                                {isAdmin && currentMatch.status === 'waiting' && (
                                    <div className="mt-4 w-full max-w-sm mx-auto">
                                        <AdminOnlinePanel
                                            adminEmployee={employee}
                                            currentMatchId={currentMatch.id}
                                            gameLabel={GAME_TYPES.find(g => g.key === currentMatch.game_type)?.label || 'لعبة'}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── REMATCH REQUEST BANNER (incoming) ── */}
                        {rematchRequestFrom && isGameFinished && (
                            <div className="mx-3 mb-3 bg-indigo-50 border-2 border-indigo-300 rounded-2xl p-4 animate-in slide-in-from-top">
                                <p className="text-sm font-black text-indigo-800 mb-3 text-center">
                                    🔄 {opponent?.name || 'خصمك'} يطلب إعادة المباراة!
                                </p>
                                <div className="flex gap-2">
                                    <button onClick={handleAcceptRematch} disabled={rematchLoading}
                                        className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all">
                                        {rematchLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <><RefreshCw className="w-4 h-4"/> قبول</>}
                                    </button>
                                    <button onClick={handleDeclineRematch}
                                        className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-black text-sm hover:bg-gray-200 active:scale-95 transition-all">
                                        رفض
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* XO */}
                        {currentMatch.game_type === 'xo' && ['playing','reward_time','answering_reward','finished'].includes(currentMatch.status) && (
                            <XOGame match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints} handleRewardSelection={handleRewardSelection} handleRewardAnswer={handleRewardAnswer} timeLeft={timeLeft} loading={loading}/>
                        )}
                        {/* CONNECT 4 */}
                        {currentMatch.game_type === 'connect4' && (
                            <Connect4Game match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints}/>
                        )}
                        {/* CHESS */}
                        {currentMatch.game_type === 'chess' && (
                            <ChessGame match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints} recordResult={recordResult}/>
                        )}
                        {/* BOTTLE MATCH */}
                        {currentMatch.game_type === 'bottlematch' && (
                            <BottleMatchGame match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints}/>
                        )}
                        {/* PUZZLE */}
                        {currentMatch.game_type === 'puzzle' && (
                            <PuzzleGame match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints}/>
                        )}
                        {/* MEMORY */}
                        {currentMatch.game_type === 'memory' && (
                            <MemoryGame match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints}/>
                        )}
                        {/* HANGMAN */}
                        {currentMatch.game_type === 'hangman' && (
                            <HangmanGame match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints}/>
                        )}
                        {/* STOP THE BUS */}
                        {currentMatch.game_type === 'stopthebus' && (
                            <StopTheBusGame match={currentMatch} employee={employee} onExit={exitMatch} grantPoints={grantPoints}/>
                        )}

                        {/* ── REMATCH / EXIT FOOTER after game ends ── */}
                        {isGameFinished && !rematchRequestFrom && (
                            <div className="mx-3 mt-2 mb-3 space-y-2 animate-in fade-in duration-500">
                                {!rematchOfferedTo ? (
                                    <button onClick={handleRequestRematch} disabled={rematchLoading || !opponent}
                                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white py-3.5 rounded-2xl font-black text-base shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                                        {rematchLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : <><RefreshCw className="w-5 h-5"/> العب مرة ثانية 🔄</>}
                                    </button>
                                ) : (
                                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-3 text-center">
                                        <Loader2 className="w-5 h-5 text-indigo-400 animate-spin mx-auto mb-1"/>
                                        <p className="text-xs font-black text-indigo-700">في انتظار موافقة الخصم...</p>
                                    </div>
                                )}
                                <button onClick={exitMatch}
                                    className="w-full bg-gray-100 text-gray-600 py-2.5 rounded-2xl font-bold text-sm hover:bg-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Users className="w-4 h-4"/> العودة للصالة
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── LEADERBOARD ── */}
            {view === 'leaderboard' && (
                <div className="p-3 flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setView('lobby')} className="p-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all">
                            <X className="w-4 h-4 text-gray-600"/>
                        </button>
                        <div>
                            <h3 className="text-lg font-black text-gray-800">لوحة النتائج 🏆</h3>
                            <p className="text-xs text-gray-400 font-bold">إجمالي نتائج الألعاب الجماعية</p>
                        </div>
                    </div>

                    {myStats && (
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl p-4 shadow-lg">
                            <p className="text-indigo-200 text-xs font-bold mb-1">إحصائياتك</p>
                            <p className="text-xl font-black mb-3">{myStats.name}</p>
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { label: 'انتصار', val: myStats.wins,   color: 'bg-green-400/30'  },
                                    { label: 'خسارة',  val: myStats.losses, color: 'bg-red-400/30'    },
                                    { label: 'تعادل',  val: myStats.draws,  color: 'bg-blue-400/30'   },
                                    { label: 'نسبة%',  val: `${myStats.winRate}%`, color: 'bg-yellow-400/30' },
                                ].map(s => (
                                    <div key={s.label} className={`${s.color} rounded-xl p-2 text-center`}>
                                        <p className="text-lg font-black">{s.val}</p>
                                        <p className="text-[10px] font-bold text-indigo-100">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {leaderboard.length === 0 ? (
                        <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                            <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-2"/>
                            <p className="text-gray-400 font-bold text-sm">لا توجد نتائج بعد</p>
                            <p className="text-gray-300 text-xs mt-1">العب أول مباراة لتظهر هنا!</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {leaderboard.slice(0, 20).map((player, idx) => {
                                const isMe = player.id === employee.employee_id;
                                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null;
                                return (
                                    <div key={player.id} className={`bg-white rounded-xl border-2 p-3 flex items-center gap-3 transition-all ${isMe ? 'border-indigo-300 bg-indigo-50/50' : 'border-gray-100'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0 ${idx < 3 ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                                            {medal ?? <span className="text-xs">#{idx+1}</span>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-black truncate ${isMe ? 'text-indigo-700' : 'text-gray-800'}`}>
                                                {player.name} {isMe && '(أنت)'}
                                            </p>
                                            <p className="text-[10px] text-gray-400 font-bold">{player.games} مباراة</p>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{player.wins}✓</span>
                                            <span className="text-xs font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{player.losses}✗</span>
                                            <span className="text-xs font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{player.winRate}%</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
