// data/templatesData.tsx
import React from 'react';
import { FileText, Briefcase, AlertTriangle, Plane } from 'lucide-react';
import { Employee } from '../types';

export const TEMPLATES_DATA = [
  {
    id: 'salary_cert',
    title: 'شهادة مفردات مرتب',
    category: 'ماليات',
    icon: <FileText className="w-6 h-6 text-green-600"/>,
    content: (emp: Employee) => (
      <div>
        <p>تشهد إدارة مركز غرب المطار بأن السيد/ <strong>{emp.name}</strong>،</p>
        <p>والذي يعمل بوظيفة <strong>{emp.specialty}</strong> (الدرجة: {emp.grade || '---'})،</p>
        <p>يعمل لدينا ويتقاضى راتباً شهرياً مفصلاً كالتالي:</p>
        <table className="w-full mt-8 border-collapse border border-black text-center">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2">الأساسي</th>
              <th className="border border-black p-2">الحوافز</th>
              <th className="border border-black p-2">البدلات</th>
              <th className="border border-black p-2">الاستقطاعات</th>
              <th className="border border-black p-2">الصافي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-4">----</td>
              <td className="border border-black p-4">----</td>
              <td className="border border-black p-4">----</td>
              <td className="border border-black p-4">----</td>
              <td className="border border-black p-4">----</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-8">وهذه شهادة منا بذلك لتقديمها إلى من يهمه الأمر دون أدنى مسئولية على المركز.</p>
      </div>
    )
  },
  {
    id: 'vacation_request',
    title: 'طلب إجازة اعتيادية',
    category: 'إجازات',
    icon: <Plane className="w-6 h-6 text-blue-600"/>,
    content: (emp: Employee) => (
      <div>
        <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
        <p className="mt-4">تحية طيبة وبعد،،</p>
        <p className="mt-4">أرجو التكرم بالموافقة على منحي إجازة اعتيادية لمدة ( ........... ) يوماً،</p>
        <p>وذلك اعتباراً من يوم .................... الموافق ..../..../2026</p>
        <p>وحتى يوم .................... الموافق ..../..../2026.</p>
        <p className="mt-8">علماً بأن رصيد إجازاتي الاعتيادية الحالي يسمح بذلك ({emp.remaining_annual} يوم).</p>
        <p className="mt-8 font-bold text-left pl-12">مقدم الطلب</p>
        <p className="text-left pl-12">{emp.name}</p>
      </div>
    )
  },
  {
    id: 'penalty_decision',
    title: 'قرار جزاء إداري',
    category: 'شئون قانونية',
    icon: <AlertTriangle className="w-6 h-6 text-red-600"/>,
    content: (emp: Employee) => (
      <div>
        <p>بناءً على المذكرة المقدمة من ........................... بتاريخ ..../..../2026،</p>
        <p>وبشأن المخالفة المنسوبة للسيد/ <strong>{emp.name}</strong>،</p>
        <p>والمتمثلة في: ............................................................................</p>
        <h3 className="text-center font-bold text-xl my-6 border-y-2 border-black py-2 w-fit mx-auto px-8">قررنا الآتي</h3>
        <p><strong>أولاً:</strong> مجازاة المذكور بخصم ( ........... ) أيام من راتبه.</p>
        <p><strong>ثانياً:</strong> يتم تنفيذ القرار فوراً وإخطار شئون العاملين والحسابات.</p>
        <p><strong>ثالثاً:</strong> يُحفظ القرار في ملف خدمة الموظف.</p>
      </div>
    )
  },
  // يمكنك إضافة مئات القوالب هنا بسهولة
];
