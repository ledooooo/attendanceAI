import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { 
  ArrowRight, MapPin, Phone, Mail, MessageSquare, 
  Send, Loader2, Share2, Map, Star 
} from 'lucide-react';

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', content: '', type: 'complaint' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('patient_complaints').insert({ ...formData });
    if (error) {
        toast.error('حدث خطأ أثناء الإرسال');
    } else { 
        toast.success('تم الإرسال بنجاح للفرز والمتابعة'); 
        setFormData({ name: '', phone: '', content: '', type: 'complaint' }); 
    }
    setLoading(false);
  };

  // دالة مشاركة التطبيق
  const handleShareApp = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'مركز طب أسرة غرب المطار',
          text: 'تعرف على خدماتنا الطبية واحجز موعدك عبر تطبيقنا الرسمي.',
          url: window.location.origin,
        });
      } else {
        navigator.clipboard.writeText(window.location.origin);
        toast.success('تم نسخ رابط التطبيق للمشاركة');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-right font-sans pb-10" dir="rtl">
      
      {/* الهيدر العلوي */}
      <div className="bg-emerald-600 text-white p-6 shadow-md rounded-b-[2rem]">
        <div className="max-w-5xl mx-auto">
            <button onClick={() => window.history.back()} className="flex items-center gap-2 text-emerald-100 hover:text-white mb-4 transition-colors w-fit">
            <ArrowRight size={20} /> العودة
            </button>
            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl"><Phone size={24} /></div> 
                تواصل معنا
            </h1>
            <p className="text-sm mt-3 opacity-90 font-bold max-w-md">
                نحن هنا لخدمتك والرد على استفساراتك. لا تتردد في التواصل معنا أو ترك مقترحاتك.
            </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 py-8 grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* العمود الأول: معلومات التواصل والخريطة والأزرار السريعة */}
        <div className="lg:col-span-2 space-y-4">
            
            {/* بطاقة البيانات */}
            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 space-y-6">
                <h2 className="font-black text-gray-800 text-lg border-b border-gray-100 pb-3">بيانات المركز</h2>
                
                <div className="flex items-start gap-4">
                    <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600 shrink-0"><MapPin size={20} /></div>
                    <div>
                        <h3 className="font-black text-gray-800 text-sm mb-1">العنوان</h3>
                        <p className="text-xs text-gray-500 font-bold leading-relaxed">ش جمال عبد الناصر بجوار بريد عزية المطار - مطار امبابة - الجيزة</p>
                    </div>
                </div>
                
                <div className="flex items-start gap-4">
                    <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600 shrink-0"><Mail size={20} /></div>
                    <div>
                        <h3 className="font-black text-gray-800 text-sm mb-1">البريد الإلكتروني</h3>
                        <a href="mailto:gharbalmatar@gmail.com" className="text-xs text-emerald-600 font-bold hover:underline" dir="ltr">gharbalmatar@gmail.com</a>
                    </div>
                </div>
            </div>

            {/* الخريطة (Google Maps Iframe) */}
            <div className="bg-white p-2 rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden h-56 relative group">
                <iframe 
                    title="موقع المركز"
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d13812.3!2d31.19!3d30.06!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMzDCsDAzJzM2LjAiTiAzMcKwMTEnMjQuMCJF!5e0!3m2!1sar!2seg!4v1700000000000!5m2!1sar!2seg" 
                    width="100%" 
                    height="100%" 
                    style={{ border: 0, borderRadius: '1.5rem' }} 
                    allowFullScreen={true} 
                    loading="lazy" 
                    referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
                {/* زر فتح في خرائط جوجل للموبايل */}
                <a 
                    href="https://maps.google.com/?q=مطار+امبابة+الجيزة" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute bottom-4 left-4 bg-white text-emerald-700 px-4 py-2 rounded-xl text-xs font-black shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
                >
                    <Map size={14} /> افتح الخريطة
                </a>
            </div>

            {/* الأزرار السريعة (المشاركة والاستبيان) */}
            <div className="grid grid-cols-2 gap-3">
                <button onClick={handleShareApp} className="bg-white border-2 border-emerald-100 text-emerald-700 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 transition-colors shadow-sm">
                    <Share2 size={24} className="mb-1" />
                    <span className="text-xs font-black">شارك التطبيق</span>
                </button>
                <a href="/survey" className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white p-4 rounded-2xl flex flex-col items-center justify-center gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-sm">
                    <Star size={24} className="mb-1 text-yellow-300 fill-yellow-300" />
                    <span className="text-xs font-black">استبيان الرضا</span>
                </a>
            </div>

        </div>

        {/* العمود الثاني: نموذج الشكاوى والمقترحات */}
        <div className="lg:col-span-3">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-md border border-gray-100 h-full">
            
            <div className="flex items-center gap-3 mb-8">
                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600"><MessageSquare size={24}/></div>
                <div>
                    <h2 className="font-black text-gray-800 text-xl">صندوق الشكاوى والمقترحات</h2>
                    <p className="text-xs text-gray-500 font-bold mt-1">تصل رسالتك مباشرة لمدير المركز بسرية تامة.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 text-sm font-bold">
                
                {/* نوع الرسالة */}
                <div className="flex gap-3 bg-gray-50 p-1.5 rounded-2xl border border-gray-100 w-fit">
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, type: 'complaint'})} 
                        className={`px-6 py-2.5 rounded-xl transition-colors ${formData.type === 'complaint' ? 'bg-white text-red-600 shadow-sm border border-red-100' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        تقديم شكوى
                    </button>
                    <button 
                        type="button" 
                        onClick={() => setFormData({...formData, type: 'suggestion'})} 
                        className={`px-6 py-2.5 rounded-xl transition-colors ${formData.type === 'suggestion' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-gray-500 hover:bg-gray-100'}`}
                    >
                        إرسال مقترح
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5">الاسم (اختياري)</label>
                        <input 
                            type="text" 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                            placeholder="الاسم الثلاثي" 
                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-colors" 
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1.5">رقم الهاتف *</label>
                        <input 
                            type="tel" required 
                            value={formData.phone} 
                            onChange={e => setFormData({...formData, phone: e.target.value})} 
                            placeholder="01X XXXX XXXX" 
                            className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-colors text-left" 
                            dir="ltr" 
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-gray-500 mb-1.5">تفاصيل الرسالة *</label>
                    <textarea 
                        required 
                        value={formData.content} 
                        onChange={e => setFormData({...formData, content: e.target.value})} 
                        placeholder="اشرح تفاصيل الشكوى أو المقترح بوضوح..." 
                        className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:border-emerald-500 focus:bg-white transition-colors min-h-[160px] resize-none" 
                    />
                </div>

                <button 
                    type="submit" 
                    disabled={loading || !formData.content || !formData.phone} 
                    className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black flex justify-center items-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <><Send size={18} /> إرسال الرسالة للإدارة</>}
                </button>
            </form>
            
            </div>
        </div>

      </div>
    </div>
  );
}
