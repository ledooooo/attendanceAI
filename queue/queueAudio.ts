// src/utils/queueAudio.ts

export const playQueueAudio = async (
    number: string | number,
    clinicAudioCode: string,
    clinicName: string,
    isMuted: boolean,
    type: 'call' | 'transfer' = 'call'
) => {
    if (isMuted) return;

    // ⚠️ ضع رابط مجلد sound الخاص بك على جيتهاب هنا
    // تأكد أن الرابط يبدأ بـ raw.githubusercontent.com
    const BASE_URL = 'https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/sound/';

    // تحديد تسلسل الملفات بناءً على نوع النداء
    const urls = type === 'call'
        ? [`${BASE_URL}ring.mp3`, `${BASE_URL}${number}.mp3`, `${BASE_URL}${clinicAudioCode}.mp3`]
        : [`${BASE_URL}emergency.mp3`, `${BASE_URL}${number}.mp3`, `${BASE_URL}${clinicAudioCode}.mp3`];

    // النص الاحتياطي في حال فشل تحميل الصوت
    const fallbackText = type === 'call'
        ? `العميل رقم ${number}، التوجه إلى ${clinicName}`
        : `العميل رقم ${number}، محول إلى ${clinicName}`;

    try {
        // تشغيل الملفات بالتتابع (ملف تلو الآخر)
        for (const url of urls) {
            await new Promise<void>((resolve, reject) => {
                const audio = new Audio(url);
                audio.onended = () => resolve();
                audio.onerror = () => reject(new Error(`Failed to load ${url}`));
                audio.play().catch(reject);
            });
        }
    } catch (error) {
        console.warn("⚠️ فشل تشغيل الملفات الصوتية، جاري تشغيل النطق الآلي (TTS)...", error);
        
        // النطق الآلي كبديل
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // إيقاف أي نطق سابق
            const utterance = new SpeechSynthesisUtterance(fallbackText);
            utterance.lang = 'ar-SA'; // نطق بلكنة عربية
            utterance.rate = 0.85; // سرعة النطق
            window.speechSynthesis.speak(utterance);
        }
    }
};
