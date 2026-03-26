import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { 
    MonitorUp, Plus, Minus, RotateCcw, Power, PowerOff, 
    BellRing, Mic, ArrowLeftRight, Volume2, VolumeX
} from 'lucide-react';
import { playQueueAudio } from '../utils/queueAudio';

export default function QueueControl({ isAdmin = false }: { isAdmin?: boolean }) {
    const [clinics, setClinics] = useState<any[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<any>(null);
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(isAdmin);
    const [customNumber, setCustomNumber] = useState('');
    
    // ✅ خيار كتم الصوت للموظف
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        fetchClinics();
    }, []);

    const fetchClinics = async () => {
        const { data } = await supabase.from('q_clinics').select('*, q_screens(name)').order('name');
        setClinics(data || []);
    };

    // ✅ الاستماع لإشعارات التحويلات والرسائل الخاصة بالعيادة الحالية
    useEffect(() => {
        if (!selectedClinic) return;

        const sub = supabase.channel('clinic_alerts_control')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'q_alerts' }, (payload) => {
                const alert = payload.new;
                
                // إذا كان النداء/التحويل لنفس عيادة الموظف
                if (alert.clinic_id === selectedClinic.id) {
                    if (alert.type === 'transfer') {
                        toast.success(`تم تحويل المريض رقم ${alert.message} إليك!`, { duration: 8000, icon: '🔄' });
                    } else if (alert.type === 'message') {
                        toast(`رسالة من الإدارة: ${alert.message}`, { duration: 10000, icon: '📩' });
                    }
                }
            }).subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [selectedClinic]);

    const handleLogin = () => {
        if (!selectedClinic) return toast.error('اختر العيادة أولاً');
        if (password === selectedClinic.password) {
            setIsAuthenticated(true);
            toast.success('تم تسجيل الدخول بنجاح');
        } else {
            toast.error('الرقم السري غير صحيح');
        }
    };

    const triggerAlert = async (type: 'call' | 'transfer', number: number | string) => {
        if (!selectedClinic) return;
        
        // 1. تسجيل النداء في قاعدة البيانات لتشغيله على الشاشة
        await supabase.from('q_alerts').insert({
            screen_id: selectedClinic.screen_id,
            clinic_id: selectedClinic.id,
            message: String(number),
            type: type
        });

        // 2. تشغيله على جهاز الموظف أيضاً (إذا لم يكن مكتوماً)
        playQueueAudio(number, selectedClinic.audio_code || 'clinic1', selectedClinic.name, isMuted, type);
    };

    const updateNumber = async (newNumber: number) => {
        if (!selectedClinic) return;
        
        // تحديث الرقم في العيادة
        const { error } = await supabase.from('q_clinics').update({ current_number: newNumber, last_called_at: new Date() }).eq('id', selectedClinic.id);
        
        if (!error) {
            setSelectedClinic({ ...selectedClinic, current_number: newNumber });
            triggerAlert('call', newNumber); // إطلاق النداء
        }
    };

    const toggleStatus = async () => {
        if (!selectedClinic) return;
        const newStatus = !selectedClinic.is_active;
        await supabase.from('q_clinics').update({ is_active: newStatus }).eq('id', selectedClinic.id);
        setSelectedClinic({ ...selectedClinic, is_active: newStatus });
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-right" dir="rtl">
                {/* كود شاشة تسجيل الدخول كما هو... */}
                <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><MonitorUp className="w-8 h-8" /></div>
                    <h2 className="text-2xl font-black text-center text-gray-800 mb-6">تسجيل دخول العيادة</h2>
                    <div className="space-y-4">
                        <select className="w-full p-3 rounded-xl border bg-gray-50 font-bold" onChange={(e) => setSelectedClinic(clinics.find(c => c.id === e.target.value))}>
                            <option value="">-- اختر العيادة --</option>
                            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-center text-2xl tracking-widest" placeholder="****" />
                        <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all">دخول</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6 text-right pb-20" dir="rtl">
            <div className="max-w-md mx-auto">
                
                <div className="bg-white p-4 rounded-3xl shadow-sm mb-4 border flex justify-between items-center">
                    <div>
                        <h2 className="font-black text-gray-800 text-lg">{selectedClinic?.name}</h2>
                        <p className="text-xs text-gray-500 font-bold">د. {selectedClinic?.doctor_name}</p>
                    </div>
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-xl transition-colors ${isMuted ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                        {isMuted ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
                    </button>
                </div>

                <div className={`p-8 rounded-3xl mb-4 text-center border-4 transition-all shadow-lg ${selectedClinic?.is_active ? 'bg-gradient-to-b from-blue-600 to-indigo-800 border-blue-400 text-white' : 'bg-gray-200 border-gray-300 text-gray-500'}`}>
                    <p className="text-sm font-bold mb-2 opacity-80">الرقم الحالي</p>
                    <h1 className="text-8xl font-black font-mono tracking-tighter leading-none mb-2">
                        {selectedClinic?.current_number}
                    </h1>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={() => updateNumber(selectedClinic.current_number + 1)} disabled={!selectedClinic?.is_active} className="bg-green-500 text-white p-4 rounded-2xl font-black text-xl shadow-md hover:bg-green-600 active:scale-95 flex flex-col items-center gap-2">
                        <Plus className="w-8 h-8" /> التالي
                    </button>
                    <button onClick={() => updateNumber(selectedClinic.current_number - 1)} disabled={!selectedClinic?.is_active || selectedClinic.current_number === 0} className="bg-rose-500 text-white p-4 rounded-2xl font-black text-xl shadow-md hover:bg-rose-600 active:scale-95 flex flex-col items-center gap-2">
                        <Minus className="w-8 h-8" /> السابق
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="col-span-2 md:col-span-3 flex gap-2">
                        <input type="number" value={customNumber} onChange={e=>setCustomNumber(e.target.value)} placeholder="رقم مخصص..." className="flex-1 p-3 border rounded-xl font-bold text-center" />
                        <button onClick={() => { updateNumber(Number(customNumber)); setCustomNumber(''); }} className="bg-indigo-100 text-indigo-700 px-4 rounded-xl font-bold text-sm">نداء للرقم</button>
                    </div>

                    <button onClick={() => triggerAlert('call', selectedClinic.current_number)} className="bg-white p-3 rounded-xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-1 hover:bg-gray-50">
                        <BellRing className="w-5 h-5 text-amber-500"/> تكرار النداء
                    </button>
                    
                    <button onClick={() => { if(confirm('تأكيد التصفير؟')) updateNumber(0); }} className="bg-white p-3 rounded-xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-1 hover:bg-gray-50">
                        <RotateCcw className="w-5 h-5 text-gray-400"/> تصفير (0)
                    </button>

                    <button onClick={toggleStatus} className={`p-3 rounded-xl shadow-sm border font-bold flex flex-col items-center gap-1 ${selectedClinic?.is_active ? 'bg-white text-red-600 hover:bg-red-50' : 'bg-green-100 text-green-700'}`}>
                        {selectedClinic?.is_active ? <PowerOff className="w-5 h-5"/> : <Power className="w-5 h-5"/>}
                        {selectedClinic?.is_active ? 'إيقاف' : 'تفعيل'}
                    </button>

                    <button onClick={() => {
                        const trNum = prompt('أدخل رقم المريض للتحويل:');
                        if (trNum) triggerAlert('transfer', trNum);
                    }} className="col-span-3 bg-teal-50 text-teal-700 p-3 rounded-xl shadow-sm border border-teal-200 font-bold flex flex-col items-center gap-1 hover:bg-teal-100">
                        <ArrowLeftRight className="w-5 h-5"/> إذاعة واستقبال مريض محول (Transfer)
                    </button>
                </div>
            </div>
        </div>
    );
}
