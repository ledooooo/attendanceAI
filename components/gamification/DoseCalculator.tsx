import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { Loader2, Calculator, AlertCircle, CheckCircle, XCircle, Globe, Volume2, VolumeX, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface Props {
    difficulty: string;
    points: number;
    onWin: (points: number, diffLabel: string) => void;
    onLose: () => void;
    onBack: () => void;
    employee?: any; // لتحديد التخصص
}

// تعريف نوع السيناريو
interface DoseScenario {
    scenario: string;
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    source: 'ai' | 'local';
    provider?: string;
    language?: string;
    difficulty?: string;
}

// دالة حفظ السيناريو في بنك الأسئلة المحلي
async function saveScenarioToBank(scenario: DoseScenario, specialty: string, difficulty: string) {
    try {
        const { error } = await supabase
            .from('arcade_dose_scenarios')
            .insert({
                scenario: scenario.scenario,
                question: scenario.question,
                option_a: scenario.options[0],
                option_b: scenario.options[1],
                option_c: scenario.options[2],
                option_d: scenario.options[3],
                correct_index: scenario.correct_index,
                explanation: scenario.explanation,
                specialty: specialty,
                difficulty: difficulty,
                language: scenario.language || 'ar',
                is_active: true,
                source: 'ai_generated',
            });
        if (error) console.warn('Failed to save scenario to bank:', error);
    } catch (err) {
        console.warn('Error saving scenario:', err);
    }
}

// دالة جلب سيناريو من AI
async function fetchScenarioFromAI(specialty: string, difficulty: string, language?: string): Promise<DoseScenario> {
    let level = 3;
    switch (difficulty) {
        case 'easy': level = 3; break;
        case 'medium': level = 6; break;
        case 'hard': level = 10; break;
        default: level = 6;
    }
    
    try {
        const { data, error } = await supabase.functions.invoke('generate-beast-question', {
            body: { 
                specialty, 
                level, 
                usedTopics: [],
                language,
                type: 'dose_calculation' // نوع خاص لحساب الجرعات
            },
        });
        
        if (error || !data) throw new Error('AI request failed');
        if (data.error) throw new Error(data.error);
        
        // توقع صيغة خاصة لسيناريوهات الجرعات
        if (!data.scenario && !data.question) throw new Error('Invalid format');
        
        const scenario: DoseScenario = {
            source: 'ai',
            provider: data.provider || 'AI',
            language: data.language || language || 'ar',
            scenario: data.scenario || data.question,
            question: data.question || `ما الجرعة المناسبة لهذا المريض؟`,
            options: data.options || [],
            correct_index: data.correct || 0,
            explanation: data.explanation || '',
        };
        
        // حفظ السيناريو في بنك الأسئلة
        saveScenarioToBank(scenario, specialty, difficulty).catch(console.warn);
        
        return scenario;
    } catch (err) {
        console.warn('AI fallback:', err);
        
        // الرجوع إلى بنك الأسئلة المحلي
        const { data: localScenarios } = await supabase
            .from('arcade_dose_scenarios')
            .select('*')
            .eq('difficulty', difficulty)
            .or(`specialty.ilike.%${specialty}%,specialty.ilike.%الكل%`)
            .limit(30);
        
        if (!localScenarios?.length) throw new Error('No scenarios available');
        
        const random = localScenarios[Math.floor(Math.random() * localScenarios.length)];
        const options = [
            random.option_a, random.option_b, random.option_c, random.option_d
        ].filter(opt => opt && opt.trim() !== '');
        
        return {
            source: 'local',
            language: random.language || 'ar',
            scenario: random.scenario,
            question: random.question,
            options,
            correct_index: random.correct_index,
            explanation: random.explanation,
        };
    }
}

export default function DoseCalculator({ difficulty, points, onWin, onLose, onBack, employee }: Props) {
    const [scenario, setScenario] = useState<DoseScenario | null>(null);
    const [loading, setLoading] = useState(true);
    const [timeLeft, setTimeLeft] = useState(45);
    const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [language, setLanguage] = useState<'auto' | 'ar' | 'en'>('auto');

    // تحديد التخصصات التي تحتاج إنجليزية طبية
    const needsMedicalEnglish = useCallback(() => {
        if (!employee?.specialty) return false;
        const specialty = employee.specialty.toLowerCase();
        const medicalEnglishSpecialties = [
            'بشر', 'بشري', 'طبيب', 'طب',
            'صيدلة', 'صيدلي', 'pharmacy',
            'أسنان', 'اسنان', 'dentistry',
            'معمل', 'مختبر', 'laboratory',
            'أشعة', 'radiology',
            'تخدير', 'anesthesia',
        ];
        return medicalEnglishSpecialties.some(s => specialty.includes(s));
    }, [employee?.specialty]);

    // الحصول على اللغة الفعلية
    const getEffectiveLanguage = useCallback((): 'ar' | 'en' => {
        if (language === 'ar') return 'ar';
        if (language === 'en') return 'en';
        return needsMedicalEnglish() ? 'en' : 'ar';
    }, [language, needsMedicalEnglish]);

    // تشغيل الصوت
    const playSound = useCallback((type: 'win' | 'lose') => {
        if (!soundEnabled) return;
        try {
            const audio = new Audio(type === 'win' ? '/applause.mp3' : '/fail.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch {}
    }, [soundEnabled]);

    // جلب السيناريو
    useEffect(() => {
        const fetchScenario = async () => {
            setLoading(true);
            try {
                const effectiveLang = getEffectiveLanguage();
                const scenarioData = await fetchScenarioFromAI(
                    employee?.specialty || 'طب عام', 
                    difficulty, 
                    effectiveLang
                );
                setScenario(scenarioData);
                
                // ضبط الوقت حسب الصعوبة
                const timeMap: Record<string, number> = { easy: 50, medium: 45, hard: 35 };
                setTimeLeft(timeMap[difficulty] || 45);
            } catch (err) {
                console.error('Failed to fetch scenario:', err);
                toast.error(getEffectiveLanguage() === 'en' 
                    ? 'No scenarios available for this level.' 
                    : 'لا توجد سيناريوهات متاحة لهذا المستوى.');
                onBack();
            } finally {
                setLoading(false);
            }
        };
        fetchScenario();
    }, [difficulty, employee?.specialty, getEffectiveLanguage, onBack]);

    // المؤقت
    useEffect(() => {
        if (!scenario || selectedAnswer !== null || timeLeft <= 0) {
            if (timeLeft <= 0 && selectedAnswer === null) handleAnswer(-1);
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, scenario, selectedAnswer]);

    const handleAnswer = (index: number) => {
        setSelectedAnswer(index);
        
        if (index === scenario?.correct_index) {
            playSound('win');
            confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 }, colors: ['#14b8a6', '#10b981', '#8b5cf6'] });
            setTimeout(() => onWin(points, difficulty), 2800);
        } else {
            playSound('lose');
            setTimeout(() => onLose(), 2800);
        }
    };

    // تنسيق الوقت
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}ث`;
    };

    // الحصول على عرض اللغة
    const getLanguageDisplay = () => {
        if (language === 'ar') return '🇸🇦 عربي';
        if (language === 'en') return '🇬🇧 English';
        return needsMedicalEnglish() ? '🇬🇧 English (Auto)' : '🇸🇦 عربي (Auto)';
    };

    const cycleLanguage = () => {
        const options: ('auto' | 'ar' | 'en')[] = ['auto', 'ar', 'en'];
        const currentIndex = options.indexOf(language);
        const next = options[(currentIndex + 1) % options.length];
        setLanguage(next);
        const langMsg = next === 'auto' ? (needsMedicalEnglish() ? 'English (Auto)' : 'عربي (تلقائي)') : next === 'ar' ? 'عربي' : 'English Medical';
        toast.success(`Language: ${langMsg}`, { icon: '🌐' });
    };

    const isEn = getEffectiveLanguage() === 'en';
    const isEnglishQuestion = scenario?.language === 'en';

    if (loading) {
        return (
            <div className="py-12 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500 mb-3" />
                <p className="text-xs text-gray-500">
                    {isEn ? 'Generating dose calculation scenario...' : 'جاري توليد سيناريو حساب الجرعات...'}
                </p>
            </div>
        );
    }
    
    if (!scenario) return null;

    const options = scenario.options;

    return (
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden animate-in zoom-in-95" dir={isEnglishQuestion ? 'ltr' : 'rtl'}>
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b bg-gradient-to-r from-teal-50 to-emerald-50">
                <div className="flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-teal-600" />
                    <h3 className="font-black text-base text-teal-700">
                        {isEn ? 'Dose Calculator' : 'حساب الجرعات'}
                    </h3>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={cycleLanguage}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white text-teal-600 text-[10px] font-black shadow-sm"
                    >
                        <Globe className="w-3 h-3" />
                        {getLanguageDisplay()}
                    </button>
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className="p-1.5 rounded-lg hover:bg-white/50"
                    >
                        {soundEnabled ? <Volume2 className="w-4 h-4 text-gray-600" /> : <VolumeX className="w-4 h-4 text-gray-400" />}
                    </button>
                    <div className={`font-black text-sm px-3 py-1 rounded-lg ${
                        timeLeft <= 10 ? 'bg-red-100 text-red-600 animate-pulse' : 
                        timeLeft <= 20 ? 'bg-orange-100 text-orange-600' : 
                        'bg-gray-100 text-gray-700'
                    }`}>
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            {/* Scenario Card */}
            <div className="bg-slate-800 text-white p-5 m-4 rounded-xl shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-400 to-emerald-500"></div>
                <div className="flex items-center gap-2 mb-3">
                    {scenario.source === 'ai' && (
                        <span className="text-[9px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> AI
                        </span>
                    )}
                    {scenario.source === 'local' && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                            {isEn ? 'Local' : 'محلي'}
                        </span>
                    )}
                    <span className="text-[9px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                        {isEnglishQuestion ? (isEn ? 'Medical English' : 'إنجليزي طبي') : (isEn ? 'Arabic' : 'عربي')}
                    </span>
                </div>
                <p className="text-[11px] text-teal-300 font-bold mb-1.5 uppercase tracking-wider">
                    {isEn ? 'Clinical Scenario:' : 'السيناريو السريري:'}
                </p>
                <p className="text-sm md:text-base font-bold leading-relaxed">{scenario.scenario}</p>
                <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-yellow-400 font-bold text-sm">❓ {scenario.question}</p>
                </div>
            </div>

            {/* Options Grid */}
            <div className="px-4 pb-4">
                <div className="grid grid-cols-1 gap-2.5">
                    {options.map((opt, idx) => {
                        const isSelected = selectedAnswer === idx;
                        const isCorrect = scenario.correct_index === idx;
                        let btnClass = 'bg-white border-gray-200 text-gray-700 hover:border-teal-400 hover:bg-teal-50';
                        if (selectedAnswer !== null) {
                            if (isCorrect) btnClass = 'bg-green-500 text-white border-green-600 shadow-md';
                            else if (isSelected) btnClass = 'bg-red-500 text-white border-red-600 shadow-md';
                            else btnClass = 'bg-gray-50 border-gray-100 opacity-50';
                        }
                        return (
                            <button
                                key={idx}
                                onClick={() => handleAnswer(idx)}
                                disabled={selectedAnswer !== null}
                                className={`p-3 rounded-xl border-2 font-bold text-sm transition-all active:scale-98 flex items-center justify-between ${btnClass}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                                        selectedAnswer !== null && isCorrect ? 'bg-white text-green-600' :
                                        selectedAnswer !== null && isSelected && !isCorrect ? 'bg-white text-red-600' :
                                        'bg-teal-100 text-teal-600'
                                    }`}>
                                        {String.fromCharCode(65 + idx)}
                                    </div>
                                    <span className="text-right text-sm">{opt}</span>
                                </div>
                                {selectedAnswer !== null && isCorrect && <CheckCircle className="w-5 h-5 flex-shrink-0" />}
                                {selectedAnswer !== null && isSelected && !isCorrect && <XCircle className="w-5 h-5 flex-shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Explanation */}
            {selectedAnswer !== null && (
                <div className="mx-4 mb-4 p-3 bg-cyan-50 rounded-xl border border-cyan-200 animate-in slide-in-from-bottom">
                    <h4 className="text-xs font-bold text-cyan-800 mb-1 flex items-center gap-1">
                        <AlertCircle size={12} /> {isEn ? 'Explanation:' : 'التفسير:'}
                    </h4>
                    <p className="text-sm font-medium text-gray-700 leading-relaxed">{scenario.explanation}</p>
                </div>
            )}

            {/* Back Button */}
            <div className="p-4 pt-0">
                <button
                    onClick={onBack}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
                >
                    {isEn ? '← Back to Games' : '← العودة للألعاب'}
                </button>
            </div>
        </div>
    );
}