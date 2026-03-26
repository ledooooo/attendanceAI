import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import { 
    MonitorUp, Plus, Minus, RotateCcw, Power, PowerOff, 
    BellRing, ArrowLeftRight, Volume2, VolumeX, Megaphone, 
    PlaySquare, Siren, MessageSquare, Send, X, Mic
} from 'lucide-react';
import { playQueueAudio } from './queueAudio'; 

export default function QueueControl({ isAdmin = false }: { isAdmin?: boolean }) {
    const [clinics, setClinics] = useState<any[]>([]);
    const [selectedClinic, setSelectedClinic] = useState<any>(null);
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [customNumber, setCustomNumber] = useState('');
    const [isMuted, setIsMuted] = useState(false);

    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [modalData, setModalData] = useState<any>({});

    // 🎙️ مراجع (Refs) وحالات خاصة بالميكروفون اللاسلكي
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => { fetchClinics(); }, []);

    const fetchClinics = async () => {
        const { data } = await supabase.from('q_clinics').select('*, q_screens(name)').order('name');
        setClinics(data || []);
    };

    useEffect(() => {
        const sub = supabase.channel('clinic_alerts_control')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'q_alerts' }, (payload) => {
                const alert = payload.new;
                if (isAdmin && alert.type === 'admin_message') {
                    toast(`رسالة للمدير: ${alert.message}`, { duration: 10000, icon: '👨‍💼' });
                    return;
                }
                if (!selectedClinic) return;
                if (alert.clinic_id === selectedClinic.id) {
                    if (alert.type === 'transfer') toast.success(`تم تحويل المريض رقم ${alert.message} إليك!`, { duration: 8000, icon: '🔄' });
                    else if (alert.type === 'message') toast(`رسالة واردة: ${alert.message}`, { duration: 10000, icon: '📩' });
                }
            }).subscribe();
        return () => { supabase.removeChannel(sub); };
    }, [selectedClinic, isAdmin]);

    const handleLogin = () => {
        if (!selectedClinic) return toast.error('اختر العيادة أولاً');
        if (isAdmin || password === selectedClinic.password) {
            setIsAuthenticated(true);
            toast.success(`تم الدخول للتحكم في: ${selectedClinic.name}`);
        } else toast.error('الرقم السري غير صحيح');
    };

    const triggerAlert = async (type: string, message: string, targetClinicId?: string) => {
        const targetClinic = targetClinicId ? clinics.find(c => c.id === targetClinicId) : selectedClinic;
        await supabase.from('q_alerts').insert({
            screen_id: targetClinic?.screen_id || (selectedClinic?.screen_id || null),
            clinic_id: targetClinic?.id || null, message: message, type: type
        });
        toast.success('تم الإرسال بنجاح');
        setActiveModal(null);
    };

    const updateNumber = async (newNumber: number) => {
        if (!selectedClinic) return;
        const { error } = await supabase.from('q_clinics').update({ current_number: newNumber, last_called_at: new Date() }).eq('id', selectedClinic.id);
        if (!error) {
            setSelectedClinic({ ...selectedClinic, current_number: newNumber });
            playQueueAudio(newNumber, selectedClinic.audio_code || 'clinic1', selectedClinic.name, isMuted, 'call');
            await supabase.from('q_alerts').insert({ screen_id: selectedClinic.screen_id, clinic_id: selectedClinic.id, message: String(newNumber), type: 'call' });
        }
    };

    const toggleStatus = async () => {
        if (!selectedClinic) return;
        const newStatus = !selectedClinic.is_active;
        await supabase.from('q_clinics').update({ is_active: newStatus }).eq('id', selectedClinic.id);
        setSelectedClinic({ ...selectedClinic, is_active: newStatus });
    };

    // 🎙️ دوال الميكروفون والبث الحي
    const startRecording = async () => {
        if (!selectedClinic?.screen_id) return toast.error('لا توجد شاشة مرتبطة بهذه العيادة لبث الصوت');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            
            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current);
                const reader = new FileReader();
                reader.readAsDataURL(audioBlob);
                reader.onloadend = async () => {
                    const base64Audio = reader.result;
                    // إرسال الصوت لحظياً في الهواء (Broadcast) بدون تخزينه في قاعدة البيانات
                    await supabase.channel(`screen_broadcast_${selectedClinic.screen_id}`)
                        .send({ type: 'broadcast', event: 'live_audio', payload: { audio: base64Audio } });
                };
                stream.getTracks().forEach(track => track.stop()); // إغلاق المايك
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err) {
            toast.error('لم يتم العثور على ميكروفون، أو أنك لم توافق على الصلاحية');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-right" dir="rtl">
                <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6"><MonitorUp className="w-8 h-8" /></div>
                    <h2 className="text-2xl font-black text-center text-gray-800 mb-6">لوحة تحكم النداء</h2>
                    <div className="space-y-4">
                        <select className="w-full p-3 rounded-xl border bg-gray-50 font-bold" onChange={(e) => setSelectedClinic(clinics.find(c => c.id === e.target.value))}>
                            <option value="">-- اختر العيادة المراد التحكم بها --</option>
                            {clinics.map(c => <option key={c.id} value={c.id}>{c.name} - {c.q_screens?.name}</option>)}
                        </select>
                        {!isAdmin && <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-center text-2xl tracking-widest" placeholder="الرقم السري للعيادة" />}
                        <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 active:scale-95 transition-all">
                            دخول {isAdmin && '(صلاحية مدير)'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:p-6 text-right pb-20 relative select-none" dir="rtl">
            <div className="max-w-lg mx-auto space-y-4">
                
                <div className="bg-white p-4 rounded-3xl shadow-sm border flex justify-between items-center">
                    <div>
                        {isAdmin ? (
                            <select className="p-2 border border-gray-200 rounded-xl text-sm font-black bg-gray-50 text-indigo-700" value={selectedClinic?.id} onChange={(e) => setSelectedClinic(clinics.find(c => c.id === e.target.value))}>
                                {clinics.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        ) : <h2 className="font-black text-indigo-700 text-lg">{selectedClinic?.name}</h2>}
                        <p className="text-xs text-gray-500 font-bold mt-1 px-2">شاشة: {selectedClinic?.q_screens?.name}</p>
                    </div>
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-2 rounded-xl transition-colors ${isMuted ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                        {isMuted ? <VolumeX className="w-5 h-5"/> : <Volume2 className="w-5 h-5"/>}
                    </button>
                </div>

                <div className={`p-8 rounded-3xl text-center border-4 transition-all shadow-lg ${selectedClinic?.is_active ? 'bg-gradient-to-b from-blue-600 to-indigo-800 border-blue-400 text-white' : 'bg-gray-200 border-gray-300 text-gray-500'}`}>
                    <p className="text-sm font-bold mb-2 opacity-80">الرقم الحالي</p>
                    <h1 className="text-8xl font-black font-mono tracking-tighter leading-none mb-2">{selectedClinic?.current_number}</h1>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => updateNumber(selectedClinic.current_number + 1)} disabled={!selectedClinic?.is_active} className="bg-green-500 text-white p-4 rounded-2xl font-black text-xl shadow-md hover:bg-green-600 active:scale-95 flex flex-col items-center gap-2"><Plus className="w-8 h-8" /> التالي</button>
                    <button onClick={() => updateNumber(selectedClinic.current_number - 1)} disabled={!selectedClinic?.is_active || selectedClinic.current_number === 0} className="bg-rose-500 text-white p-4 rounded-2xl font-black text-xl shadow-md hover:bg-rose-600 active:scale-95 flex flex-col items-center gap-2"><Minus className="w-8 h-8" /> السابق</button>
                </div>

                <div className="flex gap-2">
                    <input type="number" value={customNumber} onChange={e=>setCustomNumber(e.target.value)} placeholder="نداء لرقم مخصص..." className="flex-1 p-3 border rounded-2xl font-bold text-center shadow-sm" />
                    <button onClick={() => { updateNumber(Number(customNumber)); setCustomNumber(''); }} className="bg-indigo-600 text-white px-6 rounded-2xl font-bold shadow-sm active:scale-95">نداء</button>
                </div>

                {/* 🎙️ زر اللاسلكي المباشر */}
                <button 
                    onPointerDown={startRecording}
                    onPointerUp={stopRecording}
                    onPointerLeave={stopRecording}
                    className={`w-full p-4 rounded-2xl shadow-lg border-4 font-black flex flex-col items-center justify-center gap-2 text-lg transition-all touch-none select-none ${isRecording ? 'bg-red-600 border-red-400 text-white animate-pulse scale-95' : 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'}`}
                >
                    <Mic className={`w-8 h-8 ${isRecording ? 'animate-bounce' : ''}`}/> 
                    {isRecording ? 'جاري البث الحي للشاشة... (أفلت للإرسال)' : 'اضغط باستمرار للتحدث المباشر 🎙️'}
                </button>

                <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => triggerAlert('call', selectedClinic.current_number)} className="bg-white p-3 rounded-2xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-2 text-xs hover:bg-gray-50"><BellRing className="w-6 h-6 text-amber-500"/> تكرار النداء</button>
                    <button onClick={() => setActiveModal('transfer')} className="bg-white p-3 rounded-2xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-2 text-xs hover:bg-gray-50"><ArrowLeftRight className="w-6 h-6 text-blue-500"/> تحويل مريض</button>
                    <button onClick={() => setActiveModal('name')} className="bg-white p-3 rounded-2xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-2 text-xs hover:bg-gray-50"><Megaphone className="w-6 h-6 text-pink-500"/> إذاعة اسم</button>
                    <button onClick={() => setActiveModal('record')} className="bg-white p-3 rounded-2xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-2 text-xs hover:bg-gray-50"><PlaySquare className="w-6 h-6 text-purple-500"/> تشغيل ريكورد</button>
                    <button onClick={() => setActiveModal('alarm')} className="bg-white p-3 rounded-2xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-2 text-xs hover:bg-gray-50"><Siren className="w-6 h-6 text-red-500"/> إنذار</button>
                    <button onClick={() => setActiveModal('message')} className="bg-white p-3 rounded-2xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-2 text-xs hover:bg-gray-50"><MessageSquare className="w-6 h-6 text-emerald-500"/> رسالة</button>
                    <button onClick={() => { if(confirm('تأكيد التصفير؟')) updateNumber(0); }} className="col-span-1 bg-white p-3 rounded-2xl shadow-sm border font-bold text-gray-700 flex flex-col items-center gap-2 text-xs hover:bg-gray-50"><RotateCcw className="w-6 h-6 text-gray-400"/> تصفير</button>
                    <button onClick={toggleStatus} className={`col-span-2 p-3 rounded-2xl shadow-sm border font-bold flex items-center justify-center gap-2 text-sm ${selectedClinic?.is_active ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                        {selectedClinic?.is_active ? <PowerOff className="w-5 h-5"/> : <Power className="w-5 h-5"/>}
                        {selectedClinic?.is_active ? 'إيقاف استقبال العيادة' : 'تفعيل العيادة'}
                    </button>
                </div>
            </div>

            {/* Modal Overlay Code is exactly the same as before */}
            {activeModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
                        <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-1 bg-gray-100 hover:bg-gray-200 rounded-full"><X className="w-5 h-5 text-gray-600"/></button>
                        
                        {activeModal === 'transfer' && (
                            <div className="space-y-4 pt-4">
                                <h3 className="font-black text-lg text-blue-600 flex items-center gap-2"><ArrowLeftRight/> تحويل المريض الحالي</h3>
                                <select className="w-full p-3 border rounded-xl font-bold" onChange={e => setModalData({ targetId: e.target.value })}>
                                    <option value="">-- اختر العيادة المحول إليها --</option>
                                    {clinics.filter(c => c.id !== selectedClinic.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <button onClick={() => triggerAlert('transfer', String(selectedClinic.current_number), modalData.targetId)} className="w-full bg-blue-600 text-white font-bold p-3 rounded-xl">تنفيذ التحويل</button>
                            </div>
                        )}

                        {activeModal === 'name' && (
                            <div className="space-y-4 pt-4">
                                <h3 className="font-black text-lg text-pink-600 flex items-center gap-2"><Megaphone/> إذاعة اسم عميل (نطق آلي)</h3>
                                <input type="text" placeholder="اكتب اسم العميل ثلاثي..." className="w-full p-3 border rounded-xl font-bold" onChange={e => setModalData({ text: e.target.value })} />
                                <button onClick={() => triggerAlert('custom_speech', modalData.text)} className="w-full bg-pink-600 text-white font-bold p-3 rounded-xl">نطق الاسم الآن</button>
                            </div>
                        )}

                        {activeModal === 'record' && (
                            <div className="space-y-4 pt-4">
                                <h3 className="font-black text-lg text-purple-600 flex items-center gap-2"><PlaySquare/> تشغيل ريكورد مخصص</h3>
                                <select className="w-full p-3 border rounded-xl font-bold" onChange={e => setModalData({ recordId: e.target.value })}>
                                    <option value="">-- اختر الريكورد --</option>
                                    {[...Array(20)].map((_, i) => <option key={i+1} value={i+1}>ريكورد رقم {i+1} (record{i+1}.mp3)</option>)}
                                </select>
                                <button onClick={() => triggerAlert('record', modalData.recordId)} className="w-full bg-purple-600 text-white font-bold p-3 rounded-xl">تشغيل الريكورد بالشاشة</button>
                            </div>
                        )}

                        {activeModal === 'alarm' && (
                            <div className="space-y-4 pt-4">
                                <h3 className="font-black text-lg text-red-600 flex items-center gap-2"><Siren/> إرسال إنذار طوارئ للشاشة</h3>
                                <select className="w-full p-3 border border-red-200 rounded-xl font-bold bg-red-50 text-red-700" onChange={e => setModalData({ text: e.target.value })}>
                                    <option value="">-- اختر نوع الإنذار --</option>
                                    <option value="حريق، يرجى التوجه لمخارج الطوارئ">حريق</option>
                                    <option value="تسرب غاز، يرجى إخلاء المكان">تسرب غاز</option>
                                    <option value="عطل كهربائي، يرجى الهدوء">عطل كهربائي</option>
                                    <option value="يرجى التوجه فوراً لنقطة التجمع">إخلاء لنقطة التجمع</option>
                                </select>
                                <button onClick={() => triggerAlert('alarm', modalData.text)} className="w-full bg-red-600 text-white font-black p-3 rounded-xl">إطلاق الإنذار 🚨</button>
                            </div>
                        )}

                        {activeModal === 'message' && (
                            <div className="space-y-4 pt-4">
                                <h3 className="font-black text-lg text-emerald-600 flex items-center gap-2"><MessageSquare/> إرسال رسالة نصية</h3>
                                <select className="w-full p-3 border rounded-xl font-bold" onChange={e => setModalData({ ...modalData, targetId: e.target.value })}>
                                    <option value="">-- اختر المستلم --</option>
                                    <option value="admin">لوحة تحكم المدير</option>
                                    {clinics.map(c => <option key={c.id} value={c.id}>لوحة تحكم: {c.name}</option>)}
                                </select>
                                <textarea placeholder="اكتب رسالتك هنا..." className="w-full p-3 border rounded-xl font-bold resize-none h-24" onChange={e => setModalData({ ...modalData, text: e.target.value })}></textarea>
                                <button onClick={() => triggerAlert(modalData.targetId === 'admin' ? 'admin_message' : 'message', modalData.text, modalData.targetId !== 'admin' ? modalData.targetId : undefined)} className="w-full bg-emerald-600 text-white font-bold p-3 rounded-xl flex items-center justify-center gap-2">
                                    إرسال <Send className="w-4 h-4"/>
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            )}
        </div>
    );
}
