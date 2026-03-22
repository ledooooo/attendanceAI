import React from 'react';
import { ArrowRight, FileText, BadgeCheck } from 'lucide-react';

export default function Prices() {
  const services = [
    { name: 'كشف طب الأسرة', price: '50 ج.م' },
    { name: 'كشف أخصائي', price: '80 ج.م' },
    { name: 'جلسة استنشاق (نيبولايزر)', price: '20 ج.م' },
    { name: 'قياس سكر عشوائي', price: '15 ج.م' },
    { name: 'رسم قلب (ECG)', price: '40 ج.م' },
    { name: 'غيار على جرح (بسيط)', price: '30 ج.م' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl">
      <div className="bg-blue-600 text-white p-6 shadow-md">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 text-blue-100 hover:text-white mb-4">
          <ArrowRight size={20} /> العودة
        </button>
        <h1 className="text-2xl font-black flex items-center gap-2"><FileText /> لائحة أسعار الخدمات</h1>
        <p className="text-sm mt-2 opacity-90">أسعار الخدمات الطبية المقدمة بمركز طب أسرة غرب المطار</p>
      </div>

      <div className="max-w-3xl mx-auto p-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {services.map((service, index) => (
            <div key={index} className="flex justify-between items-center p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <BadgeCheck className="text-emerald-500 w-5 h-5" />
                <span className="font-bold text-gray-800">{service.name}</span>
              </div>
              <span className="font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{service.price}</span>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-6 font-bold">الأسعار قابلة للتحديث بناءً على اللوائح الوزارية المعتمدة.</p>
      </div>
    </div>
  );
}
