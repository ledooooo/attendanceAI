// ===================================================================
// SHARED TYPES & INTERFACES FOR ARCADE GAMES
// ===================================================================

// ===================================================================
// QUESTION TYPES
// ===================================================================

export interface Question {
    question: string;
    options: string[];
    correct_index: number;
    correct_answer?: string;
    explanation?: string;
    hint?: string;
    image_url?: string;
    source: 'ai' | 'local';
    provider: string;
    difficulty: string;
    specialty: string;
    language: string;
    is_medical_approved: boolean;
    topic?: string;
    references?: string[];
    created_at?: string;
}

export interface QuestionConfig {
    specialty: string;
    language: 'ar' | 'en' | 'both';
    difficulty: 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';
    question_length: 'very_short' | 'short' | 'medium' | 'long';
    has_hint: boolean;
    question_type: 'text' | 'image' | 'both';
    medical_approval_required: boolean;
    question_count?: number;
    exclude_topics?: string[];
    include_topics?: string[];
}

// ===================================================================
// SPECIALTIES (Primary Healthcare Sector)
// ===================================================================

export const SPECIALTIES_LIST = [
    { key: 'الكل', label: 'الكل', labelEn: 'All', keywords: ['general', 'صحة', 'health'] },
    { key: 'طبيب أسنان', label: 'طبيب أسنان', labelEn: 'Dentist', keywords: ['dentistry', 'dental', 'أسنان'] },
    { key: 'طبيب بشرى', label: 'طبيب بشرى', labelEn: 'Family Medicine', keywords: ['medicine', 'طب', 'بشري'] },
    { key: 'مراقب صحى', label: 'مراقب صحى', labelEn: 'Public Health', keywords: ['public health', 'صحة عامة'] },
    { key: 'فنى اسنان', label: 'فنى أسنان', labelEn: 'Dental Technician', keywords: ['dental tech', 'تركيبات'] },
    { key: 'إدارى', label: 'إدارى', labelEn: 'Admin', keywords: ['administration', 'إدارة'] },
    { key: 'رائدة ريفية', label: 'رائدة ريفية', labelEn: 'Rural Health', keywords: ['rural', 'ريفية'] },
    { key: 'فنى معمل', label: 'فنى معمل', labelEn: 'Lab Technician', keywords: ['laboratory', 'معمل', 'تحاليل'] },
    { key: 'تمريض', label: 'تمريض', labelEn: 'Nursing', keywords: ['nursing', 'تمريض', 'رعاية'] },
    { key: 'علاج طبيعى', label: 'علاج طبيعى', labelEn: 'Physical Therapy', keywords: ['physical therapy', 'علاج طبيعي'] },
    { key: 'صيدلة', label: 'صيدلة', labelEn: 'Pharmacy', keywords: ['pharmacy', 'صيدلة', 'أدوية'] },
    { key: 'كاتب', label: 'كاتب', labelEn: 'Secretary', keywords: ['secretarial', 'كتابة'] },
    { key: 'فنى احصاء', label: 'فنى إحصاء', labelEn: 'Statistics', keywords: ['statistics', 'إحصاء'] },
    { key: 'معاون', label: 'معاون', labelEn: 'Assistant', keywords: ['assistant', 'معاون'] },
] as const;

// ===================================================================
// DIFFICULTY SETTINGS
// ===================================================================

export const DIFFICULTY_OPTIONS = [
    {
        key: 'very_easy',
        label: 'سهل جداً',
        labelEn: 'Very Easy',
        points: 5,
        time: 8,
        color: 'emerald',
        level: 1
    },
    {
        key: 'easy',
        label: 'سهل',
        labelEn: 'Easy',
        points: 8,
        time: 10,
        color: 'green',
        level: 3
    },
    {
        key: 'medium',
        label: 'متوسط',
        labelEn: 'Medium',
        points: 12,
        time: 15,
        color: 'amber',
        level: 6
    },
    {
        key: 'hard',
        label: 'صعب',
        labelEn: 'Hard',
        points: 18,
        time: 20,
        color: 'orange',
        level: 8
    },
    {
        key: 'very_hard',
        label: 'صعب جداً',
        labelEn: 'Expert',
        points: 25,
        time: 25,
        color: 'red',
        level: 10
    },
] as const;

// ===================================================================
// QUESTION LENGTH OPTIONS
// ===================================================================

export const LENGTH_OPTIONS = [
    { key: 'very_short', label: 'قصير جداً', labelEn: 'Very Short', minWords: 5, maxWords: 15 },
    { key: 'short', label: 'قصير', labelEn: 'Short', minWords: 10, maxWords: 25 },
    { key: 'medium', label: 'متوسط', labelEn: 'Medium', minWords: 20, maxWords: 50 },
    { key: 'long', label: 'طويل', labelEn: 'Long', minWords: 40, maxWords: 100 },
] as const;

// ===================================================================
// DEFAULT CONFIGS
// ===================================================================

export const DEFAULT_QUESTION_CONFIG: QuestionConfig = {
    specialty: 'الكل',
    language: 'ar',
    difficulty: 'medium',
    question_length: 'medium',
    has_hint: false,
    question_type: 'text',
    medical_approval_required: false,
    question_count: 5,
};

// ===================================================================
// HELPER FUNCTIONS
// ===================================================================

export function getSpecialtyLabel(key: string, isEnglish: boolean): string {
    const spec = SPECIALTIES_LIST.find(s => s.key === key);
    if (!spec) return key;
    return isEnglish ? spec.labelEn : spec.label;
}

export function getDifficultyLabel(key: string, isEnglish: boolean): string {
    const diff = DIFFICULTY_OPTIONS.find(d => d.key === key);
    if (!diff) return key;
    return isEnglish ? diff.labelEn : diff.label;
}

export function getDifficultyInfo(key: string) {
    return DIFFICULTY_OPTIONS.find(d => d.key === key) || DIFFICULTY_OPTIONS[2];
}

export function isMedicalSpecialty(specialty: string): boolean {
    const medicalTerms = [
        'صيدلة', 'صيدلي', 'pharmacy',
        'طب', 'bott', 'بشري',
        'أسنان', 'dentist', 'dental',
        'معمل', 'lab', 'laboratory',
        'تمريض', 'nursing',
        'علاج طبيعي', 'therapy',
        'مراقب', 'صحة عامة',
    ];
    return medicalTerms.some(term => specialty.toLowerCase().includes(term.toLowerCase()));
}

// ===================================================================
// DIFFICULTY PROFILE (For Multi-Difficulty Games)
// ===================================================================

export interface DiffProfile {
    emoji: string;
    label: string;
    multiplier: number;
    labelEn: string;
}

export const DIFF_PROFILES: Record<string, DiffProfile> = {
    'very_easy': { emoji: '🟢', label: 'سهل جداً', labelEn: 'Very Easy', multiplier: 0.8 },
    'easy': { emoji: '🟢', label: 'سهل', labelEn: 'Easy', multiplier: 1.0 },
    'medium': { emoji: '🟡', label: 'متوسط', labelEn: 'Medium', multiplier: 1.2 },
    'hard': { emoji: '🟠', label: 'صعب', labelEn: 'Hard', multiplier: 1.5 },
    'very_hard': { emoji: '🔴', label: 'صعب جداً', labelEn: 'Expert', multiplier: 2.0 },
};

export function applyMultiplier(basePoints: number, profile: DiffProfile): number {
    return Math.round(basePoints * profile.multiplier);
}

export function pickDifficultySet(profile: DiffProfile, count: number): string[] {
    const profileOrder = ['very_easy', 'easy', 'medium', 'hard', 'very_hard'];
    const baseIndex = profileOrder.indexOf(Object.keys(DIFF_PROFILES).find(
        key => DIFF_PROFILES[key].multiplier === profile.multiplier
    ) || 'medium');

    const result: string[] = [];
    const middle = Math.floor(count / 2);

    for (let i = 0; i < count; i++) {
        const offset = i - middle;
        const index = Math.max(0, Math.min(profileOrder.length - 1, baseIndex + offset));
        result.push(profileOrder[index]);
    }

    return result.sort(() => Math.random() - 0.5);
}

// ===================================================================
// DOSE SCENARIO TYPE (For Dose Calculator Game)
// ===================================================================

export interface DoseScenario {
    id: number;
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
    is_active?: boolean;
}
