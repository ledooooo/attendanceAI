import React from 'react';
import { Syringe, ArrowRight, CheckCircle } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function VaccinesSchedule({ onBack }: Props) {
  const schedule = [
    { age: 'عند الولادة (خلال 24 ساعة)', vac: 'الالتهاب الكبدي (B) - الجرعة الصفرية', type: 'حقن (عضل)' },
    { age: 'عند الولادة (أول أيام)', vac: 'تطعيم شلل الأطفال (سابين)', type: 'نقط بالفم (جرعة صفرية)' },
    { age: 'عند الولادة (حتى 40 يوم)', vac: 'تطعيم الدرن (BCG)', type: 'حقن (في الجلد - كتف أيسر)' },
    { age: 'شهرين', vac: 'تطعيم شلل الأطفال (سابين)', type: 'نقط بالفم' },
    { age: 'شهرين', vac: 'التطعيم الخماسي + شلل أطفال (سولك)', type: 'حقن (عضل)' },
    { age: '4 شهور', vac: 'تطعيم شلل الأطفال (سابين)', type: 'نقط بالفم' },
    { age: '4 شهور', vac: 'التطعيم الخماسي + شلل أطفال (سولك)', type: 'حقن (عضل)' },
    { age: '6 شهور', vac: 'تطعيم شلل الأطفال (سابين)', type: 'نقط بالفم' },
    { age: '6 شهور', vac: 'التطعيم الخماسي + شلل أطفال (سولك)', type: 'حقن (عضل)' },
    { age: '9 شهور', vac: 'تطعيم شلل الأطفال (سابين)', type: 'نقط بالفم' },
    { age: '12 شهر (سنة)', vac: 'تطعيم شلل الأطفال (سابين)', type: 'نقط بالفم' },
    { age: '12 شهر (سنة)', vac: 'تطعيم MMR (حصبة ونكاف)', type: 'حقن (تحت الجلد - كتف أيمن)' },
    { age: '18 شهر (سنة ونصف)', vac: 'تطعيم شلل الأطفال (سابين)', type: 'نقط بالفم' },
    { age: '18 شهر (سنة ونصف)', vac: 'تطعيم MMR (جرعة ثانية)', type: 'حقن (تحت الجلد)' },
    { age: '18 شهر (سنة ونصف)', vac: 'التطعيم الثلاثي (دفتيريا/تيتانوس/سعال)', type: 'حقن (عضل)' },
  ];

  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center gap-3 mb-6">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-cyan-100 text-cyan-600 rounded-xl"><Syringe className="w-5 h-5" /></div>
          <h2 className="text-xl font-black text-gray-800">جدول التطعيمات الإجبارية</h2>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-10 w-0.5 h-full bg-cyan-100"></div>
        
        <div className="space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-2">
          {schedule.map((item, i) => (
            <div key={i} className="relative flex gap-4 items-start">
               <div className="z-10 flex flex-col items-center shrink-0 w-14">
                  <div className="w-12 h-12 bg-cyan-500 rounded-xl border-2 border-white shadow-md flex items-center justify-center text-center">
                      <span className="text-white text-[9px] font-black leading-tight px-1">{item.age.split(' ')[0]}<br/>{item.age.split(' ')[1] || ''}</span>
                  </div>
               </div>
               <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex-1 hover:bg-cyan-50/50 hover:border-cyan-200 transition-colors group">
                  <div className="flex items-start gap-2">
                     <CheckCircle className="w-4 h-4 text-cyan-500 mt-0.5 shrink-0"/>
                     <div>
                       <h3 className="font-bold text-gray-800 text-xs leading-relaxed group-hover:text-cyan-800">{item.vac}</h3>
                       <p className="text-[10px] text-gray-500 font-bold mt-2 bg-white inline-block px-2 py-1 rounded-md border border-gray-100">{item.type}</p>
                     </div>
                  </div>
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
