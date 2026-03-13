import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { ArrowRight, Star, Send, Stethoscope, HeartHandshake, Loader2 } from 'lucide-react';

export default function SurveyPage() {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [content, setContent] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      toast.error('يرجى اختيار التقييم (عدد النجوم)');
      return;
    }
    
    setLoading(true);
    // نستخدم جدول الشكاوى مع تحديد النوع كمقترح/تقييم وتمرير التقييم
    const { error } = await supabase.from('patient_complaints').insert({
      type: 'suggestion',
      rating: rating,
      content: content || `تقييم الخدمة: ${rating} نجوم`,
      name: name || 'زائر غير معروف'
    });

    if (error) {
      toast.error('حدث خطأ أثناء إرسال التقييم');
    } else {
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 text-right" dir="rtl">
        <div className="bg-white p-8 rounded-3xl shadow-xl text-center max-w-md w-full border border-gray-100 animate-in zoom-in-95">
          <HeartHandshake className="w-20 h-20 text-purple-500 mx-auto mb-4 animate-bounce" />
          <h2 className="text-2xl font-black text-gray-800 mb-2">شكراً لتقييمك!</h2>
          <p className="text-gray-500 font-bold mb-8">رأيك يهمنا جداً ويساعدنا على تحسين الخدمات الطبية المقدمة لكم.</p>
          <a href="/" className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition inline-block w-full">
            العودة للرئيسية
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-right font-sans" dir="rtl">
      <div className="bg-purple-600 text-white p-6 shadow-md">
        <a href="/" className="flex items-center gap-2 text-purple-100 hover:text-white mb-4 w-fit">
          <ArrowRight size={20} /> العودة
        </a>
        <h1 className="text-2xl font-black flex items-center gap-2"><HeartHandshake /> استبيان رضا المنتفعين</h1>
        <p className="text-sm mt-2 opacity-90">ساعدنا لنرتقي بمستوى الخدمة من خلال تقييم تجربتك</p>
      </div>

      <div className="max-w-xl mx-auto p-4 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
          
          <div className="text-center pb-6 border-b border-gray-50">
            <h2 className="text-lg font-black text-gray-800 mb-4">ما هو تقييمك العام لزيارتك للمركز؟</h2>
            <div className="flex justify-center gap-2 flex-row-reverse">
              {[5, 4, 3, 2, 1].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star 
                    size={40} 
                    className={`${(hoveredRating || rating) >= star ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} transition-colors`} 
                  />
                </button>
              ))}
            </div>
            <p className="text-xs font-bold text-gray-400 mt-4">اضغط على النجوم للتقييم</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">كيف يمكننا تحسين تجربتك؟ (اختياري)</label>
              <textarea 
                value={content} 
                onChange={(e) => setContent(e.target.value)} 
                placeholder="اكتب ملاحظاتك هنا..." 
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-purple-500 focus:bg-white transition h-32 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">الاسم (اختياري)</label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder="الاسم الثلاثي" 
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-purple-500 focus:bg-white transition text-sm"
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full bg-purple-600 text-white py-4 rounded-2xl font-black flex justify-center items-center gap-2 hover:bg-purple-700 transition shadow-lg shadow-purple-200 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> إرسال التقييم</>}
          </button>

        </form>
      </div>
    </div>
  );
}
