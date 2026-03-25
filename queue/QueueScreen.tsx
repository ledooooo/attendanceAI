import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabaseClient';
import { Maximize, Volume2 } from 'lucide-react';

export default function QueueScreen({ screenId }: { screenId: string }) {
    const [clinics, setClinics] = useState<any[]>([]);
    const [screenData, setScreenData] = useState<any>(null);
    const [time, setTime] = useState(new Date());
    const audioRef = useRef<HTMLAudioElement>(null);

    // تحديث الوقت كل ثانية
    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (!screenId) return;

        // جلب البيانات الأولية
        const fetchData = async () => {
            const { data: screen } = await supabase.from('q_screens').select('*').eq('id', screenId).single();
            const { data: clincsData } = await supabase.from('q_clinics').select('*').eq('screen_id', screenId).order('name');
            setScreenData(screen);
            setClinics(clincsData || []);
        };
        fetchData();

        // الاستماع للتحديثات اللحظية للعيادات
        const clinicsSub = supabase.channel('clinics_changes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'q_clinics', filter: `screen_id=eq.${screenId}` }, (payload) => {
                setClinics(prev => prev.map(c => c.id === payload.new.id ? payload.new : c));
                // تشغيل صوت النداء عند تغير الرقم
                if (audioRef.current) {
                    audioRef.current.play().catch(e => console.log('Audio play blocked by browser'));
                }
            }).subscribe();

        return () => {
            supabase.removeChannel(clinicsSub);
        };
    }, [screenId]);

    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => console.log(e));
        } else {
            document.exitFullscreen();
        }
    };

    if (!screenData) return <div className="h-screen bg-gray-900 flex justify-center items-center text-white text-3xl">جاري الاتصال بالشاشة...</div>;

    return (
        <div className="h-screen w-full bg-gray-900 flex flex-col overflow-hidden text-right" dir="rtl">
            {/* ملف صوت النداء */}
            <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/ding_dong_board.ogg" preload="auto" />

            {/* الجزء العلوي 10% */}
            <header className="h-[10vh] bg-gradient-to-l from-indigo-900 to-blue-900 flex items-center justify-between px-8 shadow-md border-b border-indigo-700">
                <h1 className="text-3xl font-black text-white">{screenData.name} - مركز طب أسرة غرب المطار</h1>
                <div className="flex items-center gap-6 text-xl font-bold text-indigo-100">
                    <span>{time.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    <span className="bg-black/30 px-4 py-2 rounded-xl text-3xl text-white font-mono">{time.toLocaleTimeString('ar-EG', { hour12: true })}</span>
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
                        <div key={clinic.id} className={`flex flex-col items-center justify-center p-4 rounded-2xl border-4 transition-colors ${clinic.is_active ? 'bg-gradient-to-br from-indigo-600 to-blue-700 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)]' : 'bg-gray-700 border-gray-600 opacity-60'}`}>
                            <h2 className="text-xl font-black text-blue-100 mb-2 text-center leading-tight">{clinic.name}</h2>
                            <div className="bg-white text-blue-900 w-full py-4 rounded-xl flex items-center justify-center shadow-inner">
                                {clinic.is_active ? (
                                    <span className="text-6xl font-black font-mono">{clinic.current_number}</span>
                                ) : (
                                    <span className="text-2xl font-bold text-red-500">مغلق</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* جزء الفيديو 70% */}
                <div className="w-[70%] bg-black flex items-center justify-center relative">
                    <div className="absolute inset-0 flex items-center justify-center text-gray-700 flex-col">
                        <Volume2 className="w-32 h-32 mb-4 opacity-50" />
                        <h2 className="text-3xl font-bold opacity-50">منطقة عرض الفيديو التثقيفي</h2>
                        {/* يمكنك وضع iframe يوتيوب أو فيديو هنا */}
                        {/* <video src="YOUR_VIDEO.mp4" autoPlay loop muted className="w-full h-full object-cover" /> */}
                    </div>
                </div>
            </main>

            {/* الجزء السفلي 10% (شريط الأخبار المتحرك) */}
            <footer className="h-[10vh] bg-blue-600 flex items-center overflow-hidden border-t border-blue-500 relative">
                <div className="absolute right-0 top-0 bottom-0 bg-blue-800 text-white font-black text-2xl px-6 flex items-center z-10 shadow-[10px_0_20px_rgba(0,0,0,0.5)]">
                    أخبار المركز
                </div>
                <div className="w-full whitespace-nowrap pr-48 overflow-hidden flex items-center h-full">
                    <div className="inline-block animate-[marquee_20s_linear_infinite] text-3xl font-bold text-white">
                        {screenData.marquee_text} &nbsp; • &nbsp; 
                        الأطباء المتواجدون اليوم: {clinics.filter(c => c.is_active).map(c => c.doctor_name).join(' - ')}
                    </div>
                </div>
                <style>{`
                    @keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100vw); } }
                `}</style>
            </footer>
        </div>
    );
}
