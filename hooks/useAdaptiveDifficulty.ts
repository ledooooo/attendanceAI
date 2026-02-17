// ============================================================
// 🧠 نظام Adaptive Difficulty للألعاب الطبية
// ============================================================
// ضعه في: src/hooks/useAdaptiveDifficulty.ts
// ============================================================

import { useMemo } from 'react';
import { Employee } from '../types';

// ─── أنواع ───────────────────────────────────────────────
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyProfile {
    level:       'beginner' | 'intermediate' | 'advanced' | 'elite';
    label:       string;          // عرض للمستخدم
    emoji:       string;
    weights: {
        easy:    number;          // نسبة % من الأسئلة السهلة
        medium:  number;
        hard:    number;
    };
    pointsMultiplier: number;     // مضاعف النقاط (عدالة الكسب)
    description: string;
}

// ─── حساب الـ percentile من إجمالي النقاط ─────────────────
// TOP 10%  → elite      (نقاط > 500)
// TOP 25%  → advanced   (نقاط 200-500)
// TOP 50%  → intermediate (نقاط 50-200)
// الباقي   → beginner   (نقاط < 50)

function getLevel(totalPoints: number): DifficultyProfile['level'] {
    if (totalPoints >= 500) return 'elite';
    if (totalPoints >= 200) return 'advanced';
    if (totalPoints >= 50)  return 'intermediate';
    return 'beginner';
}

const PROFILES: Record<DifficultyProfile['level'], DifficultyProfile> = {
    beginner: {
        level: 'beginner',
        label: 'مبتدئ',
        emoji: '🌱',
        weights: { easy: 70, medium: 30, hard: 0 },
        pointsMultiplier: 1.0,      // نقاط عادية - الكل يكسب
        description: 'أسئلة سهلة وممتعة لتبدأ رحلتك!'
    },
    intermediate: {
        level: 'intermediate',
        label: 'متوسط',
        emoji: '⚡',
        weights: { easy: 40, medium: 50, hard: 10 },
        pointsMultiplier: 1.2,      // +20% مكافأة للتحدي
        description: 'مزيج متوازن يناسب مستواك'
    },
    advanced: {
        level: 'advanced',
        label: 'متقدم',
        emoji: '🔥',
        weights: { easy: 20, medium: 50, hard: 30 },
        pointsMultiplier: 1.4,      // +40% على النقاط
        description: 'أسئلة أصعب ونقاط أكثر!'
    },
    elite: {
        level: 'elite',
        label: 'نخبة',
        emoji: '👑',
        weights: { easy: 10, medium: 30, hard: 60 },
        pointsMultiplier: 1.7,      // +70% - أنت في القمة!
        description: 'التحدي الحقيقي للمتميزين'
    }
};

// ─── الـ Hook الرئيسي ─────────────────────────────────────
export function useAdaptiveDifficulty(employee: Employee) {
    const profile = useMemo(() => {
        const points = employee.total_points || 0;
        const level  = getLevel(points);
        return PROFILES[level];
    }, [employee.total_points]);

    // اختيار صعوبة سؤال واحد بناءً على الأوزان
    const pickDifficulty = (): Difficulty => {
        const rand = Math.random() * 100;
        const { easy, medium } = profile.weights;
        if (rand < easy)           return 'easy';
        if (rand < easy + medium)  return 'medium';
        return 'hard';
    };

    // اختيار توزيع كامل لـ N أسئلة
    const pickDifficultySet = (count: number): Difficulty[] => {
        const { easy, medium, hard } = profile.weights;
        const easyCount   = Math.round((easy   / 100) * count);
        const mediumCount = Math.round((medium / 100) * count);
        const hardCount   = count - easyCount - mediumCount;

        const set: Difficulty[] = [
            ...Array(Math.max(0, easyCount  )).fill('easy'  ),
            ...Array(Math.max(0, mediumCount)).fill('medium'),
            ...Array(Math.max(0, hardCount  )).fill('hard'  ),
        ];

        // خلط عشوائي
        return set.sort(() => Math.random() - 0.5);
    };

    // حساب النقاط النهائية بعد تطبيق المضاعف + تعويض المستوى الصعب
    const calcFinalPoints = (basePoints: number, difficulty: Difficulty): number => {
        const diffBonus: Record<Difficulty, number> = {
            easy:   1.0,
            medium: 1.2,
            hard:   1.5,
        };
        const raw = basePoints * profile.pointsMultiplier * diffBonus[difficulty];
        return Math.round(raw);
    };

    return {
        profile,
        pickDifficulty,
        pickDifficultySet,
        calcFinalPoints,
    };
}

// ─── مكون عرض شارة المستوى ───────────────────────────────
import React from 'react';

export function DifficultyBadge({ employee }: { employee: Employee }) {
    const { profile } = useAdaptiveDifficulty(employee);

    const colors: Record<DifficultyProfile['level'], string> = {
        beginner:     'bg-emerald-100 text-emerald-700 border-emerald-300',
        intermediate: 'bg-blue-100 text-blue-700 border-blue-300',
        advanced:     'bg-orange-100 text-orange-700 border-orange-300',
        elite:        'bg-purple-100 text-purple-700 border-purple-300',
    };

    return (
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border-2 font-black text-sm ${colors[profile.level]}`}>
            <span className="text-lg">{profile.emoji}</span>
            <div>
                <div>{profile.label}</div>
                <div className="text-xs font-bold opacity-70">{profile.description}</div>
            </div>
            <div className="text-xs font-black opacity-80">
                ×{profile.pointsMultiplier.toFixed(1)} نقاط
            </div>
        </div>
    );
}
