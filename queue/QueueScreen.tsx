import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Maximize, Volume2, VolumeX, Play } from 'lucide-react';
import { playQueueAudio } from './queueAudio'; 

const defaultSettings = {
    layout_clinics_width: 30,
    card_height: 150,
    grid_cols: 2,
    font_clinic: 24,
    font_number: 64,
    color_bg: '#111827',
    color_card: '#1f2937',
    color_text: '#ffffff',
    color_marquee: '#2563eb',
    enable_speech: true
};

export default function QueueScreen({ screenId }: { screenId: string }) {
    const [clinics, setClinics] = useState<any[]>([]);
    const [screenData, setScreenData] = useState<any>(null);
    const [time, setTime] = useState(new Date());
    
    const [isStarted, setIsStarted] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentAlert, setCurrentAlert] = useState<{ text: string, type: string } | null>(null);

    // ✅ Refs for safe access inside Realtime Subscriptions
    const isStartedRef = useRef(isStarted);
    const isMutedRef = useRef(isMuted);
    const clinicsRef = useRef(clinics);
    const screenDataRef = useRef(screenData); // ✅ تم إضافة هذا الـ Ref لحل المشكلة
    const timeoutRef = useRef<any>(null);
    
    // Refs for Video Control
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => { isStartedRef.current = isStarted; }, [isStarted]);
    useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
    useEffect(() => { clinicsRef.current = clinics; }, [clinics]);
    useEffect(() => { screenDataRef.current = screenData; }, [screenData]);

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

        const alertsSub = supabase.channel('alerts_changes_screen')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'q_alerts', filter: `screen_id=eq.${screenId}` }, (payload) => {
                const alert = payload.new;

                // 1. التحكم في الفيديو عن بعد
                if (alert.type === 'video_cmd') {
                    const cmd = alert.message;
                    if (iframeRef.current) {
                        const ytCmd = cmd === 'play' ? 'playVideo' : cmd === 'pause' ? 'pauseVideo' : cmd === 'mute' ? 'mute' : 'unMute';
                        iframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: ytCmd, args: [] }), '*');
                    } else if (videoRef.current) {
                        if (cmd === 'play') videoRef.current.play();
                        if (cmd === 'pause') videoRef.current.pause();
                        if (cmd === 'mute') videoRef.current.muted = true;
                        if (cmd === 'unmute') videoRef.current.muted = false;
                    }
                    return;
                }

                // 2. النداء الصوتي وشريط الإشعارات
                const targetClinic = clinicsRef.current.find(c => c.id === alert.clinic_id);
                if (!targetClinic) return;

                const alertText = alert.type === 'call' 
                    ? `العميل رقم ${alert.message}، التوجه إلى ${targetClinic.name}`
                    : `العميل رقم ${alert.message}، محول إلى ${targetClinic.name}`;

                setCurrentAlert({ text: alertText, type: alert.type });
                
                const currentSettings = screenDataRef.current?.settings || defaultSettings;

                // ✅ التحقق من تشغيل الشاشة + أن خيار النطق غير معطل من الإعدادات
                if (isStartedRef.current && currentSettings.enable_speech !== false) {
                    playQueueAudio(alert.message, targetClinic.audio_code || 'clinic1', targetClinic.name, isMutedRef.current, alert.type);
                }

                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => setCurrentAlert(null), 10000);

            }).subscribe();

        return () => {
            supabase.removeChannel(clinicsSub);
            supabase.removeChannel(alertsSub);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [screenId]);

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
                <button onClick={() => setIsStarted(true)} className="bg-blue-600 px-8 py-4 rounded-2xl font-black text-2xl flex items-center gap-3 hover:bg-blue-700 transition-all hover:scale-105 shadow-[0_0_40px_rgba(37,99,235,0.5)]">
                    <Play className="w-8 h-8" /> بدء تشغيل الشاشة والصوت
                </button>
            </div>
        );
    }

    if (!screenData) return <div className="h-screen bg-gray-900 flex justify-center items-center text-white text-3xl">جاري الاتصال بالنظام...</div>;

    const settings = screenData.settings || defaultSettings;
    const isYoutube = screenData.video_url?.includes('youtube.com') || screenData.video_url?.includes('youtu.be');
    
    // تجهيز رابط اليوتيوب للتحكم عن بعد
    let finalVideoUrl = screenData.video_url;
    if (isYoutube && finalVideoUrl && !finalVideoUrl.includes('enablejsapi=1')) {
        finalVideoUrl += finalVideoUrl.includes('?') ? '&enablejsapi=1' : '?enablejsapi=1';
    }

    return (
        <div className="h-screen w-full flex flex-col overflow-hidden text-right relative" style={{ backgroundColor: settings.color_bg }} dir="rtl">
            
            {/* شريط الإشعارات والنداء (Notification Bar) */}
            <div className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-center p-6 shadow-[0_10px_40px_rgba(0,0,0,0.6)] transition-transform duration-500 transform ${currentAlert ? 'translate-y-0' : '-translate-y-full'} ${currentAlert?.type === 'transfer' ? 'bg-amber-500' : 'bg-emerald-500'}`}>
                <h1 className="text-5xl md:text-7xl font-black text-white tracking-wide text-center leading-tight">
                    {currentAlert?.text}
                </h1>
            </div>

            {/* الجزء العلوي */}
            <header className="h-[10vh] bg-black/40 backdrop-blur-md flex items-center justify-between px-8 shadow-md border-b border-white/10 z-40 relative">
                <h1 className="text-3xl font-black" style={{ color: settings.color_text }}>{screenData.name} - غرب المطار</h1>
                <div className="flex items-center gap-4 text-xl font-bold text-white">
                    <span className="bg-black/50 px-4 py-2 rounded-xl text-3xl font-mono tracking-widest">{time.toLocaleTimeString('ar-EG', { hour12: false })}</span>
                    <button onClick={() => setIsMuted(!isMuted)} className={`p-3 rounded-full transition-colors ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/10 hover:bg-white/20'}`}>
                        {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                    </button>
                    <button onClick={toggleFullScreen} className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                        <Maximize className="w-6 h-6" />
                    </button>
                </div>
            </header>

            {/* الجزء الأوسط */}
            <main className="h-[80vh] flex w-full">
                
                {/* جزء العيادات (المقاسات الديناميكية) */}
                <div 
                    className="p-4 content-start overflow-y-auto overflow-x-hidden border-l border-white/10 custom-scrollbar" 
                    style={{ width: `${settings.layout_clinics_width}%` }}
                >
                    <div className="grid gap-4 w-full" style={{ gridTemplateColumns: `repeat(${settings.grid_cols}, minmax(0, 1fr))` }}>
                        {clinics.map(clinic => (
                            <div 
                                key={clinic.id} 
                                className={`flex flex-col items-center justify-center p-4 rounded-3xl border-4 transition-all shadow-lg overflow-hidden relative`}
                                style={{ 
                                    height: `${settings.card_height}px`,
                                    backgroundColor: clinic.is_active ? settings.color_card : '#374151',
                                    borderColor: clinic.is_active ? `${settings.color_card}80` : '#4b5563',
                                    opacity: clinic.is_active ? 1 : 0.6
                                }}
                            >
                                <h2 className="font-black text-center mb-2 truncate w-full px-2" style={{ fontSize: `${settings.font_clinic}px`, color: settings.color_text }}>
                                    {clinic.name}
                                </h2>
                                <div className="bg-white/95 w-full flex-1 rounded-2xl flex items-center justify-center shadow-inner">
                                    {clinic.is_active ? (
                                        <span className="font-black font-mono text-gray-900" style={{ fontSize: `${settings.font_number}px` }}>
                                            {clinic.current_number}
                                        </span>
                                    ) : (
                                        <span className="text-xl font-bold text-red-500">مغلق</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* جزء الفيديو */}
                <div className="flex-1 bg-black flex items-center justify-center relative overflow-hidden">
                    {finalVideoUrl ? (
                        isYoutube ? (
                            <iframe 
                                ref={iframeRef}
                                src={`${finalVideoUrl}&autoplay=1&mute=1&loop=1&controls=0`} 
                                className="w-full h-full border-0 pointer-events-none"
                                allow="autoplay; encrypted-media"
                            />
                        ) : (
                            <video 
                                ref={videoRef}
                                src={finalVideoUrl} 
                                autoPlay muted loop 
                                className="w-full h-full object-cover" 
                            />
                        )
                    ) : (
                        <div className="flex items-center justify-center text-gray-700 flex-col">
                            <Volume2 className="w-32 h-32 mb-4 opacity-30" />
                            <h2 className="text-3xl font-bold opacity-30">منطقة عرض الفيديو</h2>
                        </div>
                    )}
                </div>
            </main>

            {/* شريط الأخبار */}
            <footer className="h-[10vh] flex items-center overflow-hidden relative" style={{ backgroundColor: settings.color_marquee }}>
                <div className="absolute right-0 top-0 bottom-0 bg-black/20 text-white font-black text-2xl px-8 flex items-center z-10 shadow-[10px_0_20px_rgba(0,0,0,0.5)] border-l border-white/10">أخبار المركز</div>
                <div className="w-full whitespace-nowrap pr-56 overflow-hidden flex items-center h-full">
                    <div className="inline-block animate-[marquee_20s_linear_infinite] text-3xl font-bold" style={{ color: settings.color_text }}>
                        {screenData.marquee_text} &nbsp; • &nbsp; 
                        الأطباء المتواجدون: {clinics.filter(c => c.is_active).map(c => c.doctor_name).join(' - ')}
                    </div>
                </div>
                <style>{`@keyframes marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-100vw); } }`}</style>
            </footer>
        </div>
    );
}
