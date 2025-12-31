import React from 'react';
import { FileText, Calendar, MapPin, Briefcase, GraduationCap, Plane } from 'lucide-react';
import { Employee } from '../types'; // تأكد من مسار الـ types

export const OFFICIAL_TEMPLATES = [
  {
    id: 1,
    title: 'بيان حالة وظيفية',
    category: 'بيانات وظيفية',
    icon: <FileText className="w-6 h-6 text-blue-600" />,
    content: (emp: Employee) => (
      <div className="space-y-6 text-right" dir="rtl">
        <div className="border-2 border-gray-800 p-4 rounded-lg">
          <h4 className="font-bold border-b-2 border-gray-300 pb-2 mb-4">أولاً: البيانات الأساسية</h4>
          <div className="grid grid-cols-2 gap-4 text-sm font-medium">
            <div className="flex gap-2"><span>الاسم رباعي:</span> <span className="font-bold text-gray-800">{emp.name}</span></div>
            <div className="flex gap-2"><span>الرقم القومي:</span> <span className="font-bold font-mono text-gray-800">{emp.national_id || '....................'}</span></div>
            <div className="flex gap-2"><span>المسمى الوظيفي:</span> <span className="font-bold text-gray-800">{emp.job_title || '....................'}</span></div>
            <div className="flex gap-2"><span>تاريخ التعيين/استلام العمل:</span> <span className="font-bold font-mono text-gray-800">{emp.hire_date || '....................'}</span></div>
            <div className="col-span-2 flex gap-2"><span>العنوان:</span> <span className="font-bold text-gray-800">{emp.address || '............................................................'}</span></div>
          </div>
        </div>

        <div className="border-2 border-gray-800 p-4 rounded-lg">
          <h4 className="font-bold border-b-2 border-gray-300 pb-2 mb-4">ثانياً: المهام الإدارية</h4>
          <p className="min-h-[60px] leading-relaxed border-b border-dotted border-gray-400">
             {/* يمكنك وضع المهام هنا إذا كانت موجودة في قاعدة البيانات أو تركها فارغة للكتابة */}
             ......................................................................................................................
          </p>
        </div>

        <div>
          <h4 className="font-bold mb-2">ثالثاً: الجزاءات التأديبية (آخر 6 شهور)</h4>
          <table className="w-full border-collapse border border-gray-800 text-center text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-800 p-2">نوع الجزاء</th>
                <th className="border border-gray-800 p-2">تاريخ القرار</th>
                <th className="border border-gray-800 p-2">السبب</th>
              </tr>
            </thead>
            <tbody>
              {/* جدول فارغ يملأ يدوياً أو برمجياً */}
              <tr>
                <td className="border border-gray-800 p-4"></td>
                <td className="border border-gray-800 p-4"></td>
                <td className="border border-gray-800 p-4"></td>
              </tr>
              <tr>
                <td className="border border-gray-800 p-4"></td>
                <td className="border border-gray-800 p-4"></td>
                <td className="border border-gray-800 p-4"></td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-2">* يتم استخراج هذا البيان بناءً على طلب الموظف لتقديمه إلى من يهمه الأمر دون أدنى مسئولية على المركز.</p>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: 'طلب إجازة عارضة',
    category: 'إجازات',
    icon: <Calendar className="w-6 h-6 text-emerald-600" />,
    content: (emp: Employee) => (
      <div className="space-y-8 text-xl font-medium leading-loose text-right" dir="rtl">
        <p>
          السيد الدكتور / مدير المركز الطبي
          <br />
          <span className="font-bold">تحية طيبة وبعد ،،،</span>
        </p>
        <p>
          أرجو من سيادتكم التكرم بالموافقة على منحي إجازة عارضة لمدة ( <span className="inline-block w-16 border-b border-black text-center">...</span> ) يوم
          <br />
          وذلك اعتباراً من يوم ( <span className="inline-block w-32 border-b border-black text-center">.........</span> ) الموافق <span className="font-mono">..../..../20....</span>
          <br />
          وحتى يوم ( <span className="inline-block w-32 border-b border-black text-center">.........</span> ) الموافق <span className="font-mono">..../..../20....</span>
        </p>
        <p>
          السبب: ...................................................................................
        </p>
        <p className="font-bold mt-8">وتفضلوا بقبول فائق الاحترام ،،،</p>
      </div>
    )
  },
  {
    id: 3,
    title: 'طلب إجازة اعتيادية',
    category: 'إجازات',
    icon: <Calendar className="w-6 h-6 text-orange-600" />,
    content: (emp: Employee) => (
      <div className="space-y-8 text-xl font-medium leading-loose text-right" dir="rtl">
        <p>
          السيد الدكتور / مدير المركز الطبي
          <br />
          <span className="font-bold">تحية طيبة وبعد ،،،</span>
        </p>
        <p>
          أرجو من سيادتكم التكرم بالموافقة على منحي إجازة اعتيادية من رصيد إجازاتي السنوي.
        </p>
        <p>
          المدة المطلوبة: ( <span className="inline-block w-16 border-b border-black text-center">...</span> ) يوم
          <br />
          تبدأ من يوم: ............................ الموافق: <span className="font-mono">..../..../20....</span>
          <br />
          وتنتهي في يوم: ......................... الموافق: <span className="font-mono">..../..../20....</span>
        </p>
        <p className="text-sm text-gray-600 border p-2 rounded">
          * أقر أنا الموقع أدناه بأنني قمت بتسليم كافة الأعمال العالقة بعهدتي للزميل البديل.
        </p>
        <p className="font-bold mt-8">وتفضلوا بقبول فائق الاحترام ،،،</p>
        
        <div className="mt-8 border-t-2 border-gray-300 pt-4 text-base">
          <p className="font-bold underline">توقيع الموظف البديل:</p>
          <p className="mt-2">الاسم: ........................................... التوقيع: ....................</p>
        </div>
      </div>
    )
  },
  {
    id: 4,
    title: 'طلب خط سير',
    category: 'تحركات',
    icon: <MapPin className="w-6 h-6 text-red-600" />,
    content: (emp: Employee) => (
      <div className="space-y-6 text-right" dir="rtl">
        <p className="text-lg">
          السيد الدكتور / مدير المركز الطبي
          <br />
          برجاء التكرم بالموافقة على خط السير التالي للزميل/ة: <span className="font-bold">{emp.name}</span>
          <br />
          بتاريخ: <span className="font-mono">..../..../20....</span>
        </p>

        <table className="w-full border-2 border-gray-800 text-center mt-8">
          <thead>
            <tr className="bg-gray-100 border-b-2 border-gray-800">
              <th className="p-3 border-l border-gray-800 w-1/4">من (الساعة / المكان)</th>
              <th className="p-3 border-l border-gray-800 w-1/4">إلى (الساعة / المكان)</th>
              <th className="p-3 border-l border-gray-800">الغرض من التحرك</th>
              <th className="p-3">التوقيع / الختم</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3].map((row) => (
              <tr key={row} className="border-b border-gray-800 h-24">
                <td className="border-l border-gray-800 align-top p-2 text-right">
                    <div className="mb-2">المكان: ....................</div>
                    <div>الساعة: ...................</div>
                </td>
                <td className="border-l border-gray-800 align-top p-2 text-right">
                    <div className="mb-2">المكان: ....................</div>
                    <div>الساعة: ...................</div>
                </td>
                <td className="border-l border-gray-800"></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  },
  {
    id: 5,
    title: 'طلب مأمورية',
    category: 'تحركات',
    icon: <Briefcase className="w-6 h-6 text-purple-600" />,
    content: (emp: Employee) => (
      <div className="space-y-8 text-xl font-medium leading-loose text-right" dir="rtl">
        <p>
          السيد الدكتور / مدير المركز الطبي
          <br />
          <span className="font-bold">تحية طيبة وبعد ،،،</span>
        </p>
        <p>
          نحيط سيادتكم علماً بأنه نظراً لحاجة العمل، يلزم تكليف السيد/ة: <span className="font-bold">{emp.name}</span>
          <br />
          للقيام بمأمورية رسمية إلى:
        </p>
        <div className="border-2 border-dashed border-gray-400 p-6 rounded-lg bg-gray-50 my-6 text-center">
            <span className="text-2xl font-bold">جهة المأمورية: ..............................................................</span>
        </div>
        <p>
          وذلك يوم ( <span className="inline-block w-32 border-b border-black text-center">.........</span> ) الموافق <span className="font-mono">..../..../20....</span>
          <br />
          الغرض من المأمورية: ...........................................................................
          <br />
          ......................................................................................................................
        </p>
        <p className="font-bold mt-8">وتفضلوا بقبول فائق الاحترام ،،،</p>
      </div>
    )
  },
  {
    id: 6,
    title: 'طلب التحاق بدورة تدريبية',
    category: 'تدريب',
    icon: <GraduationCap className="w-6 h-6 text-indigo-600" />,
    content: (emp: Employee) => (
      <div className="space-y-8 text-xl font-medium leading-loose text-right" dir="rtl">
        <p>
          السيد الدكتور / مدير المركز الطبي
          <br />
          <span className="font-bold">تحية طيبة وبعد ،،،</span>
        </p>
        <p>
          أرغب في الحصول على موافقتكم للترشح وحضور الدورة التدريبية بعنوان:
        </p>
        <div className="border-2 border-gray-800 p-4 rounded-lg my-4 bg-gray-50">
           <p className="mb-4 font-bold text-center text-2xl">..........................................................................</p>
           <p className="text-base text-gray-500 text-center">(اسم الدورة التدريبية)</p>
        </div>
        <p>
          الجهة المنظمة: ...................................................................................
          <br />
          الفترة من: <span className="font-mono">..../..../20....</span> إلى: <span className="font-mono">..../..../20....</span>
        </p>
        <p className="text-lg">
          وأتعهد بتقديم ما يفيد اجتياز الدورة أو الحضور فور الانتهاء منها.
        </p>
        <p className="font-bold mt-8">وتفضلوا بقبول فائق الاحترام ،،،</p>
      </div>
    )
  }
];
