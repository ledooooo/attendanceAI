import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Clock, Activity, ArrowRight } from 'lucide-react';

export default function PatientQueueTracker() {
    const [clinics, setClinics] = useState<any[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<any>(null);
    const [myNumber, setMyNumber] = useState('');
    const [step, setStep] = useState(1);

    useEffect(() => {
        const fetchClinics = async () => {
            const { data } = await supabase.from('q_clinics').select('*').order('name');
            setClinics(data || []);
        };
        fetchClinics();
    }, []);

    useEffect(() => {
        if (!selectedClinic) return;
        
        // استماع لتغير الأرقام في العيادة المختارة
        const sub = supabase.channel('patient_tracker')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'q_clinics', filter: `id=eq.${selectedClinic.id}` }, (payload) => {
                setSelectedClinic(payload.new);
            }).subscribe();

        return () => { supabase.removeChannel(sub); };
    }, [selectedClinic?.id]);

    const remaining = Number(myNumber) - (selectedClinic?.current_number || 0);

    return (
        <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center text-right" dir="rtl">
            <div className="w-full max-w-sm bg-white p-6 rounded-[2rem] shadow-xl border border-gray-100">
                
                {step === 1 && (
                    <div className="animate-in fade-in">
                        <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Activity className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-center mb-2">متابعة الطابور</h2>
                        <p className="text-center text-gray-500 text-sm font-bold mb-6">تابع دورك من هاتفك براحة تامة</p>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">اختر العيادة</label>
                                <select className="w-full p-3 rounded-xl border bg-gray-50 font-bold outline-none" onChange={(e) => setSelectedClinic(clinics.find(c => c.id === e.target.value))}>
                                    <option value="">-- اختر عيادتك --</option>
                                    {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">رقمك في التذكرة</label>
                                <input type="number" value={myNumber} onChange={e => setMyNumber(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 font-bold outline-none text-center text-xl" placeholder="مثال: 15" />
                            </div>
                            <button onClick={() => { if(selectedClinic && myNumber) setStep(2); }} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-md hover:bg-indigo-700 transition-all">
                                متابعة دوري الآن
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && selectedClinic && (
                    <div className="animate-in slide-in-from-right">
                        <button onClick={() => setStep(1)} className="text-gray-400 hover:text-gray-800 mb-4 flex items-center gap-1 text-sm font-bold">
                            <ArrowRight className="w-4 h-4"/> عودة
                        </button>
                        
                        <h3 className="text-center font-black text-xl text-gray-800 mb-6">{selectedClinic.name}</h3>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-indigo-50 p-4 rounded-2xl text-center border border-indigo-100">
                                <p className="text-xs font-bold text-indigo-600 mb-1">الرقم الحالي</p>
                                <p className="text-4xl font-black text-indigo-900 font-mono">{selectedClinic.current_number}</p>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl text-center border border-gray-200">
                                <p className="text-xs font-bold text-gray-500 mb-1">رقمك</p>
                                <p className="text-4xl font-black text-gray-800 font-mono">{myNumber}</p>
                            </div>
                        </div>

                        <div className={`p-6 rounded-3xl text-center shadow-inner ${remaining <= 0 ? 'bg-green-100 text-green-800' : remaining <= 3 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'}`}>
                            <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            {remaining < 0 ? (
                                <h4 className="text-2xl font-black">لقد مر دورك!</h4>
                            ) : remaining === 0 ? (
                                <h4 className="text-3xl font-black">تفضل بالدخول الآن!</h4>
                            ) : (
                                <>
                                    <p className="text-sm font-bold opacity-80 mb-1">متبقي أمامك</p>
                                    <h4 className="text-5xl font-black font-mono leading-none">{remaining}</h4>
                                    <p className="text-sm font-bold opacity-80 mt-1">مرضى</p>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
