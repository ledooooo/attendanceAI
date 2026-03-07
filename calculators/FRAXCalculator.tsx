import React, { useState } from 'react';
import { Bone, ArrowRight, BookOpen, Info } from 'lucide-react';

interface Props { onBack?: () => void; }

export default function FRAXCalculator({ onBack }: Props) {
  return (
    <div className="max-w-md mx-auto animate-in fade-in zoom-in-95 pb-10 px-1 text-right" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        {onBack && <button onClick={onBack} className="p-2 bg-white rounded-xl shadow-sm border"><ArrowRight className="w-5 h-5 text-gray-600" /></button>}
        <div className="flex items-center gap-2">
          <div className="p-2 bg-red-100 text-red-700 rounded-xl"><Bone className="w-5 h-5" /></div>
          <h2 className="text-lg font-black text-gray-800">مقياس FRAX للهشاشة</h2>
        </div>
      </div>
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border text-center">
        <p className="text-sm font-bold text-gray-600 mb-4">هذه الحاسبة تتطلب إدخال بيانات كثافة العظام (BMD). جاري تجهيز الواجهة الكاملة...</p>
        <div className="bg-blue-50 p-4 rounded-xl text-[11px] text-blue-800 text-right">
          <p className="font-bold mb-1">المصدر:</p>
          WHO Fracture Risk Assessment Tool (FRAX) - University of Sheffield.
        </div>
      </div>
    </div>
  );
}
