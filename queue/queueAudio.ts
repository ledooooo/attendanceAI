export const playQueueAudio = async (
    number: string | number,
    clinicAudioCode: string,
    clinicName: string,
    isMuted: boolean,
    type: 'call' | 'transfer' = 'call'
) => {
    // 1. الخروج إذا كان الصوت مكتوماً
    if (isMuted) return;

    // 2. تحديد المسار الأساسي (مجلد public/sound)
    const BASE_URL = '/sound/';

    // 3. ترتيب الملفات الصوتية المطلوبة
    const urls = type === 'call'
        ? [`${BASE_URL}ring.mp3`, `${BASE_URL}${number}.mp3`, `${BASE_URL}${clinicAudioCode}.mp3`]
        : [`${BASE_URL}emergency.mp3`, `${BASE_URL}${number}.mp3`, `${BASE_URL}${clinicAudioCode}.mp3`];

    // 4. النص الاحتياطي للنطق الآلي
    const fallbackText = type === 'call'
        ? `العميل رقم ${number}، التوجه إلى ${clinicName}`
        : `العميل رقم ${number}، محول إلى ${clinicName}`;

    let hasError = false;

    // 5. محاولة تشغيل الملفات بالترتيب
    for (const url of urls) {
        try {
            await new Promise<void>((resolve, reject) => {
                const audio = new Audio(url);
                
                // الانتقال للملف التالي عند انتهاء الحالي
                audio.onended = () => resolve();
                
                // في حالة فشل الملف (غير موجود، صيغة غير مدعومة)
                audio.onerror = () => {
                    console.error(`❌ الملف الصوتي غير موجود أو تالف: ${url}`);
                    reject(new Error(`File not found: ${url}`));
                };
                
                // تشغيل
                audio.play().catch((err) => {
                    console.error(`❌ المتصفح منع التشغيل للملف: ${url}`, err);
                    reject(err);
                });
            });
        } catch (error) {
            hasError = true;
            break; // الخروج من حلقة التشغيل فور فشل أي ملف
        }
    }

    // 6. إذا فشل أي ملف من الملفات الحقيقية، قم بتشغيل الـ TTS فوراً
    if (hasError) {
        console.warn("⚠️ تم التحويل إلى النطق الآلي (TTS) بسبب غياب أحد الملفات الصوتية");
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); 
            const utterance = new SpeechSynthesisUtterance(fallbackText);
            utterance.lang = 'ar-SA';
            utterance.rate = 0.85;
            window.speechSynthesis.speak(utterance);
        }
    }
};
