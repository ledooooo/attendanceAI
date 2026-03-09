import React from 'react';
import { ArrowRight, Users, Stethoscope, ShieldCheck, Award } from 'lucide-react';

export default function StaffDirectoryPage() {
  const departments = [
    {
      title: 'الإدارة العليا',
      icon: <ShieldCheck className="text-indigo-500 w-6 h-6" />,
      members: [
        { name: 'د. أحمد محمد', role: 'مدير المركز' },
        { name: 'د. سارة محمود', role: 'نائب المدير والجودة' }
      ]
    },
    {
      title: 'طب الأسرة والممارس العام',
      icon: <Stethoscope className="text-emerald-500 w-6 h-6" />,
      members: [
        { name: 'د. مصطفى كمال', role: 'أخصائي طب الأسرة' },
        { name: 'د. هدى عبد الرحمن', role: 'طبيب ممارس عام' },
        { name: 'د. عمر طارق', role: 'طبيب ممارس عام' }
      ]
    },
    {
      title: 'العيادات التخصصية',
      icon: <Award className="text-rose-500 w-6 h-6" />,
      members: [
        { name: 'د. ياسمين سعيد', role: 'أخصائي طب الأطفال' },
        { name: 'د. كريم حسن', role: 'أخصائي الباطنة' },
        { name: 'د. نورهان علي', role: 'أخصائي النساء والتوليد' },
        { name: 'د. رامي فؤاد', role: 'طبيب أسنان' }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-right font-sans" dir="rtl">
      <div className="bg-indigo-600 text-white p-6 shadow-md">
        <a href="/" className="flex items-center gap-2 text-indigo-100 hover:text-white mb-4 w-fit">
          <ArrowRight size={20} /> العودة للرئيسية
        </a>
        <h1 className="text-2xl font-black flex items-center gap-2"><Users /> الهيكل الإداري والأطباء</h1>
        <p className="text-sm mt-2 opacity-90">تعرف على نخبة الأطباء والإداريين بمركز طب أسرة غرب المطار</p>
      </div>

      <div className="max-w-4xl mx-auto p-4 py-8 space-y-8">
        {departments.map((dept, index) => (
          <div key={index} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 animate-in slide-in-from-bottom-4" style={{animationDelay: `${index * 100}ms`}}>
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-4">
              <div className="p-3 bg-gray-50 rounded-2xl">
                {dept.icon}
              </div>
              <h2 className="text-xl font-black text-gray-800">{dept.title}</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dept.members.map((member, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition border border-transparent hover:border-gray-100">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shrink-0">
                    {member.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-black text-gray-800">{member.name}</h3>
                    <p className="text-xs font-bold text-gray-500 mt-1">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
