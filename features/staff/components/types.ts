// ================================================
// 📦 Shared Types & Constants
// ================================================

export const COOLDOWN_HOURS = 5;

export interface ScrambleWord {
    id: string;
    word: string;
    hint: string;
    difficulty: string;
    specialty?: string;
}

export interface QuizQuestion {
    id: string;
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_index: number;
    difficulty: string;
    specialty?: string;
}

export interface DoseScenario {
    id: string;
    scenario: string;
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_index: number;
    explanation: string;
    difficulty: string;
    specialty?: string;
}

export interface GameProps {
    employee: import('../../../../types').Employee;
    diffProfile: DiffProfile;
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

export interface SimpleGameProps {
    onStart: () => Promise<void>;
    onComplete: (points: number, isWin: boolean) => void;
}

// ================================================
// 🧠 Adaptive Difficulty System
// ================================================
export type DiffLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export interface DiffProfile {
    level: DiffLevel;
    label: string;
    emoji: string;
    color: string;
    weights: { easy: number; medium: number; hard: number };
    multiplier: number;
    desc: string;
}

export const DIFF_PROFILES: Record<DiffLevel, DiffProfile> = {
    beginner: {
        level: 'beginner', label: 'مبتدئ', emoji: '🌱',
        color: 'bg-emerald-100 text-emerald-700 border-emerald-300',
        weights: { easy: 70, medium: 30, hard: 0 },
        multiplier: 1.0,
        desc: 'أسئلة سهلة لتبدأ رحلتك!'
    },
    intermediate: {
        level: 'intermediate', label: 'متوسط', emoji: '⚡',
        color: 'bg-blue-100 text-blue-700 border-blue-300',
        weights: { easy: 40, medium: 50, hard: 10 },
        multiplier: 1.1,
        desc: 'مزيج متوازن +10% نقاط'
    },
    advanced: {
        level: 'advanced', label: 'متقدم', emoji: '🔥',
        color: 'bg-orange-100 text-orange-700 border-orange-300',
        weights: { easy: 20, medium: 50, hard: 30 },
        multiplier: 1.2,
        desc: 'تحدي أكبر +20% نقاط'
    },
    elite: {
        level: 'elite', label: 'نخبة', emoji: '👑',
        color: 'bg-purple-100 text-purple-700 border-purple-300',
        weights: { easy: 10, medium: 30, hard: 60 },
        multiplier: 1.3,
        desc: 'للمتميزين فقط +30% نقاط'
    }
};

export function getDiffProfile(totalPoints: number): DiffProfile {
    if (totalPoints >= 5000) return DIFF_PROFILES.elite;
    if (totalPoints >= 2000) return DIFF_PROFILES.advanced;
    if (totalPoints >= 1000) return DIFF_PROFILES.intermediate;
    return DIFF_PROFILES.beginner;
}

export function pickDifficultySet(profile: DiffProfile, count: number): string[] {
    const { easy, medium } = profile.weights;
    const easyN   = Math.round((easy   / 100) * count);
    const mediumN = Math.round((medium / 100) * count);
    const hardN   = count - easyN - mediumN;
    const set = [
        ...Array(Math.max(0, easyN  )).fill('easy'),
        ...Array(Math.max(0, mediumN)).fill('medium'),
        ...Array(Math.max(0, hardN  )).fill('hard'),
    ];
    return set.sort(() => Math.random() - 0.5);
}

export function applyMultiplier(base: number, profile: DiffProfile): number {
    return Math.round(base * profile.multiplier);
}
