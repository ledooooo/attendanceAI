import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { 
    MonitorUp, Plus, Minus, RotateCcw, Power, PowerOff, 
    BellRing, Mic, Send, Edit3, ArrowLeftRight
} from 'lucide-react';

export default function QueueControl({ isAdmin = false }: { isAdmin?: boolean }) {
    const [clinics, setClinics] = useState<any[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<any>(null);
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(isAdmin);
    const [customNumber, setCustomNumber] = useState('');

    useEffect(() => {
        fetchClinics();
    }, []);

    const fetchClinics = async () => {
        const { data } = await supabase.from('q_clinics').select('*, q_screens(name)').order('name');
        setClinics(data || []);
    };

    const handleLogin = () => {
        if (!selectedClinic) return toast.error('اختر العيادة أولاً');
        if (password === selectedClinic.password) {
            setIsAuthenticated(true);
            toast.success('تم تسجيل الدخول للعيادة');
        } else {
            toast.error('الرقم السري للعيادة غير صحيح');
        }
    };

    const updateNumber = async (newNumber: number) => {
        if (!selectedClinic) return;
        const { error } = await supabase.from('q_clinics').update({ current_number: newNumber, last_called_at: new Date() }).eq('id', selectedClinic.id);
        if (!error) {
            setSelectedClinic({ ...selectedClinic, current_number: newNumber });
        } else {
            toast.error('حدث خطأ أثناء التحديث');
        }
    };

    const toggleStatus = async () => {
        if (!selectedClinic) return;
        const newStatus = !selectedClinic.is_active;
        await supabase.from('q_clinics').update({ is_active: newStatus }).eq('id', selectedClinic.id);
        setSelectedClinic({ ...selectedClinic, is_active: newStatus });
        toast.success(newStatus ? 'تم تفعيل العيادة' : 'تم إيقاف العيادة');
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-right" dir="rtl">
                <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <MonitorUp className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-center text-gray-800 mb-6">تسجيل دخول العيادة</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-2">اختر العيادة</label>
                            <select className="w-full p-3 rounded-xl border bg-gray-50 font-bold outline-none focus:border-blue-500" onChange={(e) => setSelectedClinic(clinics.find(c => c.id === e.target.value))}>
                                <option value="">-- اختر العيادة --</option>
                                {clinics.map(c => <option key={c.id} value={c.id}>{c.name} ({c.q_screens.name})</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-600 mb-2">الرقم السري لليوم</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 font-bold outline-none focus:border-blue-500 text-center text-2xl tracking-widest" placeholder="****" />
                        </div>
                        <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                            دخول للوحة التحكم
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6 text-right pb-20" dir="rtl">
            <div className="max-w-md mx-auto">
                
                {/* Header (خاص بالمدير لتغيير العيادة بسهولة) */}
                <div className="bg-white p-4 rounded-3xl shadow-sm mb-4 border flex justify-between items-center">
                    <div>
                        <h2 className="font-black text-gray-800 text-lg">{selectedClinic?.name || 'لوحة تحكم النداء'}</h2>
                        <p className="text-xs text-gray-500 font-bold">الشاشة: {selectedClinic?.q_screens?.name}</p>
                    </div>
                    {isAdmin && (
                        <select className="p-2 border rounded-lg text-xs font-bold" onChange={(e) => setSelectedClinic(clinics.find(c => c.id === e.target.value))}>
                            {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                </div>

                {/* Number Display */}
                <div className={`p-8 rounded-3xl mb-4 text-center border-4 transition-all shadow-lg ${selectedClinic?.is_active ? 'bg-gradient-to-b from-blue-600 to-indigo-800 border-blue-400 text-white' : 'bg-gray-200 border-gray-300 text-gray-500'}`}>
                    <p className="text-sm font-bold mb-2 opacity-80">الرقم الحالي</p>
                    <h1 className="text-8xl font-black font-mono tracking-tighter leading-none mb-2">
                        {selectedClinic?.current_number}
                    </h1>
                    <p className="text-sm font-bold">{selectedClinic?.is_active ? 'العيادة تعمل' : 'العيادة متوقفة'}</p>
                </div>

                {/* Primary Controls */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <button onClick={() => updateNumber(selectedClinic.current_number + 1)} disabled={!selectedClinic?.is_active} className="bg-green-500 text-white p-4 rounded-2xl font-black text-xl shadow-md hover:bg-green-600 active:scale-95 flex flex-col items-center gap-2 disabled:opacity-50">
                        <Plus className="w-8 h-8" /> التالي
                    </button>
                    <button onClick={() => updateNumber(selectedClinic.current_number - 1)} disabled={!selectedClinic?.is_active || selectedClinic.current_number === 0} className="bg-rose-500 text-white p-4 rounded-2xl font-black text-xl shadow-md hover:bg-rose-600 active:scale-95 flex flex-col items-center gap-2 disabled:opacity-50">
                        <Minus className="w-8 h-8" /> السابق
                    </button>
                </div>

                {/* Secondary Controls Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="col-span-2 md:col-span-3 flex gap-2">
                        <input type="number" value={customNumber} onChange={e=>setCustomNumber(e.target.value)} placeholder="رقم مخصص..." className="flex-1 p-3 border rounded-xl font-bold text-center" />
                        <button onClick={() => { updateNumber(Number(customNumber)); setCustomNumber(''); }} className="bg-indigo-100 text-indigo-700 px-4 rounded-xl font-bold text-sm">إدخال</button>
                    </div>

                    <button onClick={() => updateNumber(selectedClinic.current_number)} className="bg-white p-3 rounded-xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-1 hover:bg-gray-50">
                        <BellRing className="w-5 h-5 text-amber-500"/> تكرار النداء
                    </button>
                    
                    <button onClick={() => { if(confirm('تأكيد التصفير؟')) updateNumber(0); }} className="bg-white p-3 rounded-xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-1 hover:bg-gray-50">
                        <RotateCcw className="w-5 h-5 text-gray-400"/> تصفير (0)
                    </button>

                    <button onClick={toggleStatus} className={`p-3 rounded-xl shadow-sm border font-bold flex flex-col items-center gap-1 ${selectedClinic?.is_active ? 'bg-white text-red-600 hover:bg-red-50' : 'bg-green-100 text-green-700'}`}>
                        {selectedClinic?.is_active ? <PowerOff className="w-5 h-5"/> : <Power className="w-5 h-5"/>}
                        {selectedClinic?.is_active ? 'إيقاف مؤقت' : 'تفعيل'}
                    </button>

                    <button onClick={() => toast('سيتم إضافة نافذة كتابة نصية لاحقاً')} className="bg-white p-3 rounded-xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-1 hover:bg-gray-50">
                        <Edit3 className="w-5 h-5 text-blue-500"/> إذاعة نص
                    </button>

                    <button onClick={() => toast('سيتم فتح المايك لاحقاً')} className="bg-white p-3 rounded-xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-1 hover:bg-gray-50">
                        <Mic className="w-5 h-5 text-purple-500"/> إذاعة صوت
                    </button>

                    <button onClick={() => toast('سيتم تحويل المريض')} className="bg-white p-3 rounded-xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-1 hover:bg-gray-50">
                        <ArrowLeftRight className="w-5 h-5 text-teal-500"/> تحويل مريض
                    </button>
                </div>

            </div>
        </div>
    );
}
