import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Maximize, Volume2, VolumeX, Play } from 'lucide-react';
// ✅ تم تصحيح المسار ليقرأ من نفس المجلد
import { playQueueAudio } from './queueAudio'; 

export default function QueueScreen({ screenId }: { screenId: string }) {
    const [clinics, setClinics] = useState<any[]>([]);
    const [screenData, setScreenData] = useState<any>(null);
    const [time, setTime] = useState(new Date());
    
    const [isStarted, setIsStarted] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentAlert, setCurrentAlert] = useState<{ text: string, type: string } | null>(null);

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!screenId) return;

        const fetchData = async () => {
            const { data: screen } = await supabase.from('q_screens').select('*').eq('id', screenId).single();
            const { data: clincsData } = await supabase.from('q_clinics').select('*').eq('screen_id', screenId).order('name');
            setScreenData(screen);
            setClinics(clincsData || []);
        };
        fetchData();

        const clinicsSub = supabase.channel('clinics_changes_screen')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'q_clinics', filter: `screen_id=eq.${screenId}` }, (payload) => {
                setClinics(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
            }).subscribe();

        // ✅ الاستماع للنداءات (هنا يظهر الشريط وينطق الصوت)
        const alertsSub = supabase.channel('alerts_changes_screen')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'q_alerts', filter: `screen_id=eq.${screenId}` }, (payload) => {
                const alert = payload.new;
                const targetClinic = clinics.find(c => c.id === alert.clinic_id);
                if (!targetClinic) return;

                const alertText = alert.type === 'call' 
                    ? `العميل رقم ${alert.message}، التوجه إلى ${targetClinic.name}`
                    : `العميل رقم ${alert.message}، محول إلى ${targetClinic.name}`;

                // 1. إظهار الشريط العلوي
                setCurrentAlert({ text: alertText, type: alert.type });
                
                // 2. تشغيل الصوت المتتابع أو النطق الآلي TTS
                if (isStarted) {
                    playQueueAudio(alert.message, targetClinic.audio_code || 'clinic1', targetClinic.name, isMuted, alert.type);
                }

                // إخفاء الشريط بعد 10 ثواني
                setTimeout(() => setCurrentAlert(null), 10000);
            }).subscribe();

        return () => {
            supabase.removeChannel(clinicsSub);
            supabase.removeChannel(alertsSub);
        };
    }, [screenId, clinics, isStarted, isMuted]);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(e => e);
        else document.exitFullscreen();
    };

    if (!isStarted) {
        return (
            <div className="h-screen bg-gray-900 flex flex-col justify-center items-center text-white gap-6">
                <Volume2 className="w-24 h-24 text-blue-500 animate-pulse" />
                <h1 className="text-4xl font-black">جاهز لبدء العرض</h1>
                <p className="text-gray-400">يجب بدء التشغيل يدوياً للسماح للمتصفح بتشغيل الصوتيات</p>
                <button onClick={() => setIsStarted(true)} className="bg-blue-600 px-8 py-4 rounded-2xl font-black text-2xl flex items-center gap-3 hover:bg-blue-700 transition-all hover:scale-105">
                    <Play className="w-8 h-8" /> بدء تشغيل الشاشة والصوت
                </button>
            </div>
        );
    }

    if (!screenData) return <div className="h-screen bg-gray-900 flex justify-center items-center text-white text-3xl">جاري الاتصال...</div>;

    return (
        <div className="h-screen w-full bg-gray-900 flex flex-col overflow-hidden text-right relative" dir="rtl">
            
            {/* ✅ هذا هو شريط النداء الكبير المنزلق (Notification Bar) */}
            <div className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-center p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] transition-transform duration-500 transform ${currentAlert ? 'translate-y-0' : '-translate-y-full'} ${currentAlert?.type === 'transfer' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                <h1 className="text-5xl md:text-7xl font-black text-white tracking-wide text-center leading-tight">
                    {currentAlert?.text}
                </h1>
            </div>

            {/* الجزء العلوي 10% */}
            <header className="h-[10vh] bg-gradient-to-l from-gray-900 to-blue-900 flex items-center justify-between px-8 shadow-md border-b border-gray-800 z-40 relative">
                <h1 className="text-3xl font-black text-white">{screenData.name} - غرب المطار</h1>
                <div className="flex items-center gap-4 text-xl font-bold text-indigo-100">
                    <span className="bg-black/30 px-4 py-2 rounded-xl text-3xl text-white font-mono tracking-widest">{time.toLocaleTimeString('ar-EG', { hour12: false })}</span>
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                        {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                    <button onClick={toggleFullScreen} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white">
                        <Maximize className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* الجزء الأوسط 80% */}
            <main className="h-[80vh] flex w-full">
                {/* جزء العيادات 30% */}
                <div className="w-[30%] bg-gray-800 p-4 grid grid-cols-2 gap-4 content-start overflow-hidden border-l border-gray-700">
                    {clinics.map(clinic => (
                        <div key={clinic.id} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-colors ${clinic.is_active ? 'bg-gradient-to-br from-indigo-700 to-blue-800 border-blue-500 shadow-lg' : 'bg-gray-800 border-gray-700 opacity-50'}`}>
                            <h2 className="text-lg md:text-xl font-black text-blue-100 mb-2 text-center leading-tight">{clinic.name}</h2>
                            <div className="bg-white text-blue-900 w-full py-4 rounded-xl flex items-center justify-center shadow-inner">
                                {clinic.is_active ? (
                                    <span className="text-5xl md:text-6xl font-black font-mono">{clinic.current_number}</span>
                                ) : (
                                    <span className="text-xl font-bold text-red-500">مغلق</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* جزء الفيديو 70% */}
                <div className="w-[70%] bg-black flex items-center justify-center relative overflow-hidden">
                    {screenData.video_url ? (
                        <iframe 
                            src={`${screenData.video_url}?autoplay=1&mute=1&loop=1&controls=0`} 
                            className="w-full h-full border-0 pointer-events-none"
                            allow="autoplay; encrypted-media"
                        />
                    ) : (
                        <div className="flex items-center justify-center text-gray-700 flex-col">
                            <Volume2 className="w-32 h-32 mb-4 opacity-30" />
                            <h2 className="text-3xl font-bold opacity-30">منطقة عرض الفيديو</h2>
                        </div>
                    )}
                </div>
            </main>

            {/* شريط الأخبار 10% */}
            <footer className="h-[10vh] bg-blue-600 flex items-center overflow-hidden border-t border-blue-500 relative">
                <div className="absolute right-0 top-0 bottom-0 bg-blue-800 text-white font-black text-2xl px-6 flex items-center z-10 shadow-[10px_0_20px_rgba(0,0,0,0.5)]">أخبار المركز</div>
                <div className="w-full whitespace-nowrap pr-48 overflow-hidden flex items-center h-full">
                    <div className="inline-block animate-[marquee_20s_linear_infinite] text-3xl font-bold text-white">
                        {screenData.marquee_text} &nbsp; • &nbsp; 
                        الأطباء المتواجدون: {clinics.filter(c => c.is_active).map(c => c.doctor_name).join(' - ')}
                    </div>
                </div>
                <style>{`@keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100vw); } }`}</style>
            </footer>
        </div>
    );
}
