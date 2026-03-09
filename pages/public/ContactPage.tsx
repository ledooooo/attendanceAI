import React, { useState } from 'react';
import { supabase } from '../../supabaseClient';
import toast from 'react-hot-toast';
import { ArrowRight, MapPin, Phone, Mail, MessageSquare, Send, Loader2 } from 'lucide-react';

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', content: '', type: 'complaint' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('patient_complaints').insert({ ...formData });
    if (error) toast.error('حدث خطأ');
    else { toast.success('تم الإرسال بنجاح للفرز'); setFormData({ name: '', phone: '', content: '', type: 'complaint' }); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl">
      <div className="bg-emerald-600 text-white p-6 shadow-md">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 text-emerald-100 hover:text-white mb-4">
          <ArrowRight size={20} /> العودة
        </button>
        <h1 className="text-2xl font-black flex items-center gap-2"><Phone /> تواصل معنا</h1>
      </div>

      <div className="max-w-3xl mx-auto p-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* معلومات التواصل */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="font-black text-gray-800 text-lg border-b pb-2">بيانات المركز</h2>
          <div className="flex items-start gap-3">
            <MapPin className="text-emerald-500 shrink-0" />
            <div><h3 className="font-bold text-gray-700">العنوان</h3><p className="text-sm text-gray-500">مركز طب أسرة غرب المطار، الإسكندرية</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="text-emerald-500 shrink-0" />
            <div><h3 className="font-bold text-gray-700">الهاتف</h3><p className="text-sm text-gray-500" dir="ltr">03-1234567</p></div>
          </div>
          <div className="flex items-start gap-3">
            <Mail className="text-emerald-500 shrink-0" />
            <div><h3 className="font-bold text-gray-700">البريد الإلكتروني</h3><p className="text-sm text-gray-500">info@westairport.com</p></div>
          </div>
        </div>

        {/* نموذج الشكاوى العام */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="font-black text-gray-800 text-lg border-b pb-2 mb-4 flex items-center gap-2"><MessageSquare size={20}/> صندوق الشكاوى والمقترحات</h2>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm font-bold">
              <div className="flex gap-4">
                  <label className="flex items-center gap-1"><input type="radio" checked={formData.type === 'complaint'} onChange={() => setFormData({...formData, type: 'complaint'})} /> شكوى</label>
                  <label className="flex items-center gap-1"><input type="radio" checked={formData.type === 'suggestion'} onChange={() => setFormData({...formData, type: 'suggestion'})} /> مقترح</label>
              </div>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="الاسم" className="w-full p-3 bg-gray-50 border rounded-xl outline-none" />
              <input type="tel" required value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="رقم الهاتف للتواصل" className="w-full p-3 bg-gray-50 border rounded-xl outline-none" dir="ltr" />
              <textarea required value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="اكتب رسالتك..." className="w-full p-3 bg-gray-50 border rounded-xl outline-none h-32" />
              <button type="submit" disabled={loading} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-black flex justify-center items-center gap-2">
                  {loading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> إرسال</>}
              </button>
          </form>
        </div>
      </div>
    </div>
  );
}
