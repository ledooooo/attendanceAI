import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../../supabaseClient';
import { Employee } from '../../types';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
    Swords, UserX, Trophy, Users, Clock,
    Play, X, CheckCircle2, BrainCircuit, Loader2, Trash2, Timer, Hand, Grid3x3, Bus,
    Link2, Share2, Sparkles, RefreshCw, Bell, BellOff, Smartphone,
    Send, Wifi, WifiOff, ChevronDown, ChevronUp, Search, Moon, Sun
} from 'lucide-react';
import Connect4Game from './games/Connect4Game';
import XOGame from './games/XOGame';
import StopTheBusGame from './games/StopTheBusGame';
import ChessGame from './games/ChessGame';
import HangmanGame from './games/HangmanGame';
import BottleMatchGame from './games/BottleMatchGame';
import PuzzleGame from './games/PuzzleGame';
import MemoryGame from './games/MemoryGame';
import BeastLevelGame from './games/BeastLevelGame';

// ─── Type Definitions ─────────────────────────────────────────────────────────
type MatchStatus = 'waiting' | 'playing' | 'answering_reward' | 'finished';
type GamePhase = 'setup' | 'betting' | 'playing' | 'ended';
type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

// ─── Beautiful Avatars ────────────────────────────────────────────────────────
const AVATAR_STYLES = [
    { bg: 'from-rose-400 to-pink-600',     ring: 'ring-pink-300'   },
    { bg: 'from-violet-400 to-purple-600', ring: 'ring-purple-300' },
    { bg: 'from-blue-400 to-cyan-500',     ring: 'ring-cyan-300'   },
    { bg: 'from-amber-400 to-orange-500',  ring: 'ring-orange-300' },
    { bg: 'from-emerald-400 to-teal-500',  ring: 'ring-teal-300'   },
    { bg: 'from-indigo-400 to-blue-600',   ring: 'ring-blue-300'   },
];

// ─── Random Alias Names Generator ─────────────────────────────────────────────
const RANDOM_ADJECTIVES = ['الغامض', 'النينجا', 'الشبح', 'الساحر', 'المخفي', 'الأسطوري', 'الخبث', 'المراوغ'];
const RANDOM_NOUNS = ['الطبيب', 'الممرض', 'الفني', 'الجراح', 'الصيدلي', 'المخبري', 'الإداري', 'المنسق'];

const generateRandomName = (): string => {
    const adj = RANDOM_ADJECTIVES[Math.floor(Math.random() * RANDOM_ADJECTIVES.length)];
    const noun = RANDOM_NOUNS[Math.floor(Math.random() * RANDOM_NOUNS.length)];
    return `${adj} ${noun}`;
};

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
    { name: 'نجم التشخيص',    emoji: '🌟',  bg: 'from-pink-500 to-rose-700',     ring: 'ring-pink-400'    },
    { name: 'حكيم السرير',    emoji: '🧠',  bg: 'from-indigo-500 to-purple-700', ring: 'ring-purple-300' },
    { name: 'اسم عشوائي',     emoji: '🎲',  bg: 'from-purple-600 to-pink-600',  ring: 'ring-pink-300'   },
];

const GAME_TYPES = [
    { key: 'xo',          label: 'XO',               icon: '✕⭕',  desc: 'إكس أو الكلاسيكية',   color: 'from-indigo-500 to-violet-600', minPlayers: 2, maxPlayers: 2  },
    { key: 'connect4',    label: 'Connect 4',         icon: '🔴🟡', desc: 'أربعة في صف',         color: 'from-blue-500 to-cyan-600',    minPlayers: 2, maxPlayers: 2  },
    { key: 'chess',       label: 'شطرنج',             icon: '♟️',   desc: 'شطرنج كلاسيكي',       color: 'from-amber-500 to-orange-600', minPlayers: 2, maxPlayers: 2  },
    { key: 'hangman',     label: 'المشنقة',           icon: '🪢',   desc: 'خمّن الكلمة الطبية',  color: 'from-rose-500 to-pink-700',    minPlayers: 2, maxPlayers: 8  },
    { key: 'bottlematch', label: 'ترتيب الزجاجات',   icon: '🍾',   desc: 'رتّب الألوان السرية',  color: 'from-cyan-500 to-indigo-600',  minPlayers: 2, maxPlayers: 6  },
    { key: 'puzzle',      label: 'لعبة الأرقام',     icon: '🔢',   desc: 'رتّب 1 إلى 15',        color: 'from-amber-600 to-orange-700', minPlayers: 2, maxPlayers: 6  },
    { key: 'memory',      label: 'لعبة الذاكرة',     icon: '🧠',   desc: 'اقلب وطابق البطاقات',  color: 'from-indigo-600 to-violet-700', minPlayers: 2, maxPlayers: 2  },
    { key: 'stopthebus',  label: 'أتوبيس كومبليت',   icon: '🚌',   desc: 'كلمات بنفس الحرف',    color: 'from-violet-500 to-purple-700', minPlayers: 2, maxPlayers: 10 },
    { key: 'beastlevel',  label: 'ليفل الوحش', icon: '🦁',   desc: 'أسئلة طبية متدرجة',   color: 'from-red-600 to-orange-600',   minPlayers: 2, maxPlayers: 8  },
];

const BASE_URL = 'https://gharb-alpha.vercel.app';
const BEASTLEVEL_MIN_POINTS = 5000;
const ROOM_CREATION_COOLDOWN = 30000; // 30 seconds
const JOIN_COOLDOWN = 10000; // 10 seconds

function getRoomLink(matchId: string) {
    return `${BASE_URL}${window.location.pathname}#room=${matchId}`;
}

// ─── Utility Functions ────────────────────────────────────────────────────────
const formatTimeLeft = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatTimeAgo = (iso: string | null): string => {
    if (!iso) return '';
    const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return 'الآن';
    if (secs < 3600) return `منذ ${Math.floor(secs / 60)} د`;
    return `منذ ${Math.floor(secs / 3600)} س`;
};

// ─── Clipboard API (Modern) ──────────────────────────────────────────────────
const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
        // Fallback for older browsers
        const el = document.createElement('textarea');
        el.value = text;
        el.style.position = 'fixed';
        el.style.left = '-999999px';
        el.style.top = '-999999px';
        document.body.appendChild(el);
        el.focus();
        el.select();
        const success = document.execCommand('copy');
        document.body.removeChild(el);
        return success;
    } catch {
        return false;
    }
};

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

        // Check existing subscription
        if (sub) {
            const { data, error } = await supabase.from('push_subscriptions')
                .select('id')
                .eq('endpoint', sub.endpoint)
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('Error checking subscription:', error);
            }
            if (data) return true;
            const unsubscribed = await sub.unsubscribe();
            if (!unsubscribed) {
                console.warn('Failed to unsubscribe from old subscription');
            }
        }

        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        // Clean up old subscriptions and insert new one
        await supabase.from('push_subscriptions').delete().eq('user_id', userId);
        const { error: insertError } = await supabase.from('push_subscriptions').insert({
            user_id: userId,
            subscription_data: JSON.stringify(sub.toJSON()),
            endpoint: sub.endpoint,
            device_info: JSON.stringify({ userAgent: navigator.userAgent }),
            updated_at: new Date().toISOString(),
        });

        if (insertError) {
            console.error('Error inserting subscription:', insertError);
            return false;
        }
        return true;
    } catch (error) {
        console.error('Push subscription error:', error);
        return false;
    }
}

async function sendPushToUser(userId: string, title: string, body: string, url = '/') {
    try {
        const { error } = await supabase.functions.invoke('send-push-notification', {
            body: { userId, title, body, url },
        });
        if (error) {
            console.warn('Failed to send push notification:', error);
        }
    } catch (error) {
        console.warn('Push notification failed:', error);
    }
}

// ─── Share Room ───────────────────────────────────────────────────────────────
async function shareRoom(matchId: string, gameLabel: string) {
    const link = getRoomLink(matchId);
    const text = `تحداني في لعبة ${gameLabel}! انضم الآن 🎮`;

    try {
        if (navigator.share) {
            try {
                await navigator.share({ title: 'تحدي الصالة', text, url: link });
                return;
            } catch (shareError) {
                // User cancelled or share failed, continue to clipboard
                console.debug('Share cancelled or failed:', shareError);
            }
        }

        const success = await copyToClipboard(`${text}\n${link}`);
        if (success) {
            toast.success('تم نسخ رابط الغرفة! أرسله لزميلك 🔗', { icon: '📋', duration: 3000 });
        } else {
            toast.error('فشل نسخ الرابط');
        }
    } catch (error) {
        console.error('Share error:', error);
        toast.error('حدث خطأ أثناء المشاركة');
    }
}

// ─── Sound Effects ────────────────────────────────────────────────────────────
const playSound = (url: string, volume = 0.7): void => {
    try {
        const audio = new Audio(url);
        audio.volume = volume;
        audio.play().catch(() => {
            // Fallback: vibrate if available
            if (navigator.vibrate) {
                navigator.vibrate(100);
            }
        });
    } catch (error) {
        console.warn('Sound playback failed:', error);
    }
};

const playNotificationSound = () => playSound('/notification.mp3');
const playWinSound = () => playSound('https://raw.githubusercontent.com/ledooooo/attendanceAI/main/public/applause.mp3', 0.8);

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
                selected ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 scale-105 shadow-lg' : 'border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}>
            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${alias.bg} flex items-center justify-center shadow-md`}>
                <span className="text-2xl">{alias.emoji}</span>
            </div>
            <span className="text-[11px] font-black text-gray-700 dark:text-gray-200 text-center leading-tight">{alias.name}</span>
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
    const initials = employee.name?.split(' ').slice(0, 2).map(n => n?.[0] ?? '').join('') || '؟';
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
            if (typeof parsed === 'string') {
                if (parsed.startsWith('"')) parsed = JSON.parse(parsed);
                if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            }
            opts = Array.isArray(parsed) ? parsed : [];
        } catch { opts = []; }
        correctAns = rawQ.correct_answer;
    } else {
        opts = [rawQ.option_a, rawQ.option_b, rawQ.option_c, rawQ.option_d].filter(o => o && String(o).trim() !== '' && o !== 'null');
        if (rawQ.correct_index !== undefined && rawQ.correct_index !== null && opts[rawQ.correct_index]) {
            correctAns = opts[rawQ.correct_index];
        } else {
            const letter = String(rawQ.correct_option || rawQ.correct_answer || '').trim().toLowerCase();
            if (['a','b','c','d'].includes(letter) && rawQ[`option_${letter}`]) {
                correctAns = rawQ[`option_${letter}`];
            } else {
                correctAns = letter;
            }
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
        <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-xl text-[11px] font-black">
            <Bell className="w-3.5 h-3.5"/> الإشعارات مفعّلة
        </div>
    );

    if (status === 'denied') return (
        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-500 dark:text-red-400 px-3 py-1.5 rounded-xl text-[11px] font-black">
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

// ─── Connection Status Indicator ─────────────────────────────────────────────
function ConnectionStatusIndicator({ status }: { status: ConnectionStatus }) {
    if (status === 'connected') return null;

    return (
        <div className={`fixed top-0 left-0 right-0 z-[100] px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2 ${
            status === 'reconnecting'
                ? 'bg-yellow-500 text-white animate-pulse'
                : 'bg-red-500 text-white'
        }`}>
            {status === 'reconnecting' ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin"/>
                    جاري إعادة الاتصال...
                </>
            ) : (
                <>
                    <WifiOff className="w-4 h-4"/>
                    انقطع الاتصال بالإنترنت
                </>
            )}
        </div>
    );
}

// ─── Admin Online Users Panel ─────────────────────────────────────────────────
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
    const [searchTerm, setSearchTerm] = useState('');
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const fetchOnline = useCallback(async () => {
        try {
            const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from('employees')
                .select('employee_id, name, specialty, photo_url, last_seen')
                .gte('last_seen', cutoff)
                .neq('employee_id', String(adminEmployee.employee_id))
                .neq('role', 'admin')
                .order('last_seen', { ascending: false });

            if (error) {
                console.error('Error fetching online employees:', error);
                return;
            }
            if (data) setOnline(data as OnlineEmployee[]);
        } catch (error) {
            console.error('Fetch online error:', error);
        }
    }, [adminEmployee.employee_id]);

    useEffect(() => {
        fetchOnline();
        const iv = setInterval(fetchOnline, 30_000);

        // Cleanup previous channel
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        channelRef.current = supabase.channel('online_presence_admin')
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'employees',
                filter: `role=neq.admin`,
            }, () => { fetchOnline(); })
            .subscribe();

        return () => {
            clearInterval(iv);
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [fetchOnline]);

    // Filter online employees based on search term
    const filteredOnline = useMemo(() => {
        if (!searchTerm.trim()) return online;
        const term = searchTerm.toLowerCase();
        return online.filter(emp =>
            emp.name.toLowerCase().includes(term) ||
            emp.specialty?.toLowerCase().includes(term)
        );
    }, [online, searchTerm]);

    const sendInvite = async (emp: OnlineEmployee) => {
        if (!currentMatchId) return;
        const link = getRoomLink(currentMatchId);
        setSending(p => ({ ...p, [emp.employee_id]: true }));

        try {
            await Promise.all([
                supabase.from('notifications').insert({
                    user_id: String(emp.employee_id),
                    title: `🎮 دعوة لعبة من ${adminEmployee.name?.split(' ')[0] || 'المدير'}`,
                    message: `تم دعوتك للانضمام لغرفة ${gameLabel}! اضغط هنا للانضمام 👉 ${link}`,
                    type: 'competition',
                    is_read: false,
                }),
                sendPushToUser(
                    String(emp.employee_id),
                    `🎮 دعوة لعبة من ${adminEmployee.name?.split(' ')[0] || 'المدير'}`,
                    `انضم لغرفة ${gameLabel} الآن!`,
                    link,
                )
            ]);

            setSending(p => ({ ...p, [emp.employee_id]: false }));
            setSent(p => ({ ...p, [emp.employee_id]: true }));
            toast.success(`تم إرسال الدعوة لـ ${emp.name?.split(' ')[0]} ✅`);
            setTimeout(() => setSent(p => ({ ...p, [emp.employee_id]: false })), 10_000);
        } catch (error) {
            console.error('Send invite error:', error);
            setSending(p => ({ ...p, [emp.employee_id]: false }));
            toast.error('فشل إرسال الدعوة');
        }
    };

    const sendToAll = async () => {
        if (!currentMatchId || filteredOnline.length === 0) return;
        setSendingAll(true);
        try {
            await Promise.all(filteredOnline.map(emp => sendInvite(emp)));
            toast.success(`تم إرسال الدعوة لـ ${filteredOnline.length} موظف أونلاين! 🎉`);
        } catch (error) {
            toast.error('حدث خطأ أثناء إرسال الدعوات');
        } finally {
            setSendingAll(false);
        }
    };

    const initials = (name: string) => name?.split(' ').slice(0, 2).map(n => n?.[0] ?? '').join('') || '؟';
    const styleIdx = (id: string) => id.charCodeAt(0) % AVATAR_STYLES.length;

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border-2 border-green-200 dark:border-green-800 shadow-sm overflow-hidden">
            <button
                onClick={() => setCollapsed(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white"
            >
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Wifi className="w-4 h-4"/>
                        {filteredOnline.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-yellow-400 text-gray-900 text-[9px] font-black rounded-full flex items-center justify-center">{filteredOnline.length}</span>
                        )}
                    </div>
                    <span className="font-black text-sm">
                        الموظفون أونلاين الآن
                        {filteredOnline.length === 0 && <span className="text-green-200 font-bold text-xs mr-1">(لا أحد)</span>}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {currentMatchId && filteredOnline.length > 0 && !collapsed && (
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

            {!collapsed && (
                <div className="p-3">
                    {/* Search Input */}
                    <div className="relative mb-3">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                        <input
                            type="text"
                            placeholder="ابحث عن موظف..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pr-9 pl-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    {filteredOnline.length === 0 ? (
                        <div className="text-center py-5">
                            <WifiOff className="w-8 h-8 text-gray-200 dark:text-gray-600 mx-auto mb-2"/>
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500">
                                {searchTerm ? 'لا توجد نتائج' : 'لا يوجد موظفون متصلون حالياً'}
                            </p>
                            <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-0.5">يتحدث عن آخر 5 دقائق</p>
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                            {filteredOnline.map(emp => {
                                const isSending = sending[emp.employee_id];
                                const isSent = sent[emp.employee_id];
                                const idx = styleIdx(emp.employee_id);
                                const style = AVATAR_STYLES[idx];
                                return (
                                    <div key={emp.employee_id}
                                        className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                                        <div className="relative flex-shrink-0">
                                            {emp.photo_url ? (
                                                <img src={emp.photo_url} alt={emp.name}
                                                    className={`w-9 h-9 rounded-full object-cover ring-2 ${style.ring}`}/>
                                            ) : (
                                                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${style.bg} flex items-center justify-center ring-2 ${style.ring}`}>
                                                    <span className="text-white font-black text-xs">{initials(emp.name)}</span>
                                                </div>
                                            )}
                                            <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white"/>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black text-gray-800 dark:text-gray-100 truncate">{emp.name}</p>
                                            <div className="flex items-center gap-1.5">
                                                {emp.specialty && (
                                                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-bold truncate max-w-[90px]">{emp.specialty}</span>
                                                )}
                                                <span className="text-[9px] text-green-500 dark:text-green-400 font-bold">{formatTimeAgo(emp.last_seen)}</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => sendInvite(emp)}
                                            disabled={isSending || isSent || !currentMatchId}
                                            className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-black text-[11px] transition-all active:scale-95 ${
                                                isSent
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-700'
                                                    : !currentMatchId
                                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
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

                    {!currentMatchId && (
                        <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-2.5 py-1.5 mt-2 font-bold text-center">
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

    // ── Dark Mode State ─────────────────────────────────────────────────────────
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // ── Connection Status ───────────────────────────────────────────────────────
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');

    // ── Rate Limiting ──────────────────────────────────────────────────────────
    const [lastCreatedRoom, setLastCreatedRoom] = useState<Date | null>(null);
    const [lastJoinAttempt, setLastJoinAttempt] = useState<Date | null>(null);

    // ── Rematch state ──────────────────────────────────────────────────────────
    const [rematchLoading, setRematchLoading] = useState(false);
    const [rematchOfferedTo, setRematchOfferedTo] = useState<string | null>(null);
    const [rematchRequestFrom, setRematchRequestFrom] = useState<string | null>(null);

    // ── Admin ──────────────────────────────────────────────────────────────────
    const isAdmin = (employee as any).role === 'admin';
    const [adminActiveRoomId, setAdminActiveRoomId] = useState<string | null>(null);

    // ── Rematch lock for race condition prevention ──────────────────────────────
    const [isProcessingRematch, setIsProcessingRematch] = useState(false);

    // ── Dark Mode Effect ────────────────────────────────────────────────────────
    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDarkMode]);

    // ── Connection Status Effect ────────────────────────────────────────────────
    useEffect(() => {
        const handleOnline = () => {
            setConnectionStatus('connected');
            toast.success('تم إعادة الاتصال');
        };
        const handleOffline = () => {
            setConnectionStatus('disconnected');
            toast.error('انقطع الاتصال بالإنترنت');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check initial status
        if (!navigator.onLine) {
            setConnectionStatus('disconnected');
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

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
    }, [currentMatch?.id, currentMatch?.status, employee.employee_id]);

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
                    if (currentMatch?.id === payload.old.id) {
                        setCurrentMatch(null);
                        setView('lobby');
                        toast('تم إغلاق الغرفة', { icon: '🚪' });
                    }
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
                        playNotificationSound();
                    }

                    if (updated.status === 'answering_reward' && prev.status !== 'answering_reward' && updated.winner_id === employee.employee_id) {
                        setTimeLeft(updated.final_question?.timeLimit || 15);
                    }

                    // Rematch request came in via game_state.rematch_request
                    const remReq = updated.game_state?.rematch_request;
                    if (remReq && remReq.to === employee.employee_id && !remReq.accepted) {
                        setRematchRequestFrom(remReq.from);
                        playNotificationSound();
                        toast('🔄 طلب إعادة المباراة!', { icon: '🔄', duration: 5000 });
                    }

                    // Rematch accepted — auto-create new room
                    if (updated.game_state?.rematch_request?.accepted && updated.game_state?.rematch_new_room_id) {
                        const newRoomId = updated.game_state.rematch_new_room_id;
                        handleJoinRematchRoom(newRoomId);
                    }

                    return updated;
                });
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [employee.employee_id, currentMatch?.id]);

    const fetchWaitingMatches = async () => {
        try {
            const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            await supabase.from('live_matches').delete().eq('status', 'waiting').lt('created_at', cutoff);
            const { data } = await supabase.from('live_matches').select('*').eq('status', 'waiting').order('created_at', { ascending: false });
            if (data) setMatches(data);
        } catch (error) {
            console.error('Error fetching matches:', error);
        }
    };

    const checkCooldown = async () => {
        const { data } = await supabase.from('points_ledger').select('id').eq('employee_id', employee.employee_id)
            .like('reason', '%الألعاب الجماعية%').gte('created_at', new Date(Date.now() - 3600000).toISOString()).limit(1);
        return data && data.length > 0;
    };

    const fireConfetti = () => {
        const canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
        document.body.appendChild(canvas);

        const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
        const colors = ['#f59e0b', '#10b981', '#6366f1', '#ec4899', '#f97316', '#fbbf24', '#ffffff'];

        myConfetti({ particleCount: 120, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors, zIndex: 99999 });
        myConfetti({ particleCount: 120, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors, zIndex: 99999 });

        setTimeout(() => {
            myConfetti({ particleCount: 200, angle: 90, spread: 160, origin: { x: 0.5, y: 0.2 }, colors, zIndex: 99999 });
        }, 400);

        setTimeout(() => canvas.remove(), 5000);
    };

    const grantPoints = async (pts: number) => {
        if (pts <= 0) return;
        const onCooldown = await checkCooldown();
        if (onCooldown) { toast.success('فوز رائع! (النقاط تضاف مرة كل ساعة)', { icon: '🎮' }); return; }
        try {
            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: pts });
            await supabase.from('points_ledger').insert({ employee_id: employee.employee_id, points: pts, reason: `فوز في الألعاب الجماعية 🏆` });
            playWinSound();
            fireConfetti();
            toast.success(`🏆 مبروك! تمت إضافة ${pts} نقطة!`, { style: { background: '#22c55e', color: '#fff', fontWeight: 'bold' }, duration: 4000 });
        } catch (error) {
            console.error('Error granting points:', error);
            toast.error('حدث خطأ أثناء إضافة النقاط');
        }
    };

    const recordResult = async (result: 'win' | 'loss' | 'draw', game: string, opponentName: string) => {
        try {
            await supabase.from('live_game_results').insert({
                employee_id: employee.employee_id,
                employee_name: employee.name,
                game_type: game,
                result,
                opponent_name: opponentName,
                played_at: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error recording result:', error);
        }
    };

    const fetchLeaderboard = async () => {
        try {
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
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
        }
    };

    // ── Player info ──────────────────────────────────────────────────────────
    const getMyPlayerInfo = (gameType?: string) => {
        const gt = gameType ?? selectedGameType;
        if (useAlias) {
            return {
                id: employee.employee_id,
                name: selectedAlias.name === 'اسم عشوائي' ? generateRandomName() : selectedAlias.name,
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
        // Rate limiting check
        if (lastCreatedRoom && Date.now() - lastCreatedRoom.getTime() < ROOM_CREATION_COOLDOWN) {
            const remaining = Math.ceil((ROOM_CREATION_COOLDOWN - (Date.now() - lastCreatedRoom.getTime())) / 1000);
            toast.error(`انتظر ${remaining} ثانية قبل إنشاء غرفة جديدة`);
            return;
        }

        // Beast Level points check
        if (selectedGameType === 'beastlevel' && (employee.total_points || 0) < BEASTLEVEL_MIN_POINTS) {
            toast.error(`تحتاج ${BEASTLEVEL_MIN_POINTS.toLocaleString('ar')} نقطة للدخول إلى لعبة من سيربح المليون!`);
            return;
        }

        setLoading(true);
        try {
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
            else if (selectedGameType === 'beastlevel')  initialState = { players: [], currentStep: 0, question: null, questionReady: false, revealedAt: null, stepStartedAt: null, usedTopics: [], phase: 'betting', winnerId: null };

            const { data, error } = await supabase.from('live_matches').insert({
                game_type: selectedGameType, status: 'waiting', players: [player],
                game_state: initialState, created_by: employee.employee_id,
            }).select().single();

            if (error) {
                toast.error('خطأ في الإنشاء');
                setLoading(false);
                return;
            }

            subscribeToPush(String(employee.employee_id));
            setLastCreatedRoom(new Date());
            setCurrentMatch(data);
            setView('playing');
            if (isAdmin) setAdminActiveRoomId(data.id);
        } catch (error) {
            console.error('Create match error:', error);
            toast.error('حدث خطأ غير متوقع');
        } finally {
            setLoading(false);
        }
    };

    // ── Join match ─────────────────────────────────────────────────────────────
    const handleJoinMatch = async () => {
        if (!joiningMatchId) return;

        // Rate limiting check
        if (lastJoinAttempt && Date.now() - lastJoinAttempt.getTime() < JOIN_COOLDOWN) {
            const remaining = Math.ceil((JOIN_COOLDOWN - (Date.now() - lastJoinAttempt.getTime())) / 1000);
            toast.error(`انتظر ${remaining} ثانية قبل الانضمام لغرفة أخرى`);
            return;
        }

        setLoading(true);
        setLastJoinAttempt(new Date());

        try {
            const { data: match, error: fetchError } = await supabase.from('live_matches').select('*').eq('id', joiningMatchId).single();

            if (fetchError || !match) {
                toast.error('الغرفة غير متاحة');
                setLoading(false);
                return;
            }

            if (match.status !== 'waiting') {






