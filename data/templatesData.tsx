import React from 'react';
import { FileText, Plane, MapPin, Briefcase } from 'lucide-react';
import { Employee } from '../types';

// تعريف نوع الحقل المطلوب ملؤه
export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number';
  placeholder?: string;
}

export interface Template {
  id: string;
  title: string;
  category: string;
  icon: React.ReactNode;
  fields: TemplateField[]; // الحقول التي سيملؤها المستخدم
  content: (emp: Employee, data: any) => React.ReactNode; // دالة المحتوى تأخذ البيانات المدخلة
}

export const TEMPLATES_DATA: Template[] = [
  {
    id: 'regular_vacation',
    title: 'طلب إجازة اعتيادية',
    category: 'إجازات',
    icon: <Plane className="w-6 h-6 text-blue-600"/>,
    fields: [
      { key: 'startDate', label: 'بداية من يوم', type: 'date' },
      { key: 'endDate', label: 'إلى يوم', type: 'date' },
      { key: 'duration', label: 'المدة (أيام)', type: 'number' },
      { key: 'returnDate', label: 'تاريخ العودة للعمل', type: 'date' },
      { key: 'substitute', label: 'اسم القائم بالعمل', type: 'text', placeholder: 'اسم الزميل البديل...' },
    ],
    content: (emp, data) => (
      <div className="leading-loose">
        <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
        <p className="mt-2">بعد التحية،،،</p>
        <p className="mt-4 text-justify">
          الرجاء من سيادتكم الموافقة على منحي إجازة <strong>اعتيادية</strong> بداية من يوم الموافق <strong>{data.startDate || '.....'}</strong> إلى يوم الموافق <strong>{data.endDate || '.....'}</strong> لمدة ( <strong>{data.duration || '..'}</strong> ) أيام.
        </p>
        <p className="mt-2">على أن تكون العودة إلى العمل بتاريخ <strong>{data.returnDate || '.....'}</strong>، وسيقوم بالعمل السيد/ <strong>{data.substitute || '....................'}</strong>.</p>
        
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div>
            <p><strong>مقدم الطلب:</strong> {emp.name}</p>
            <p><strong>الوظيفة:</strong> {emp.specialty}</p>
            <p><strong>تحريراً في:</strong> {new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          <div className="text-center pt-8">
            <p><strong>توقيع مقدم الطلب</strong></p>
            <p className="mt-4 text-gray-400">....................</p>
          </div>
        </div>

        <div className="mt-6 border-t pt-4">
           <p><strong>توقيع القائم بالعمل:</strong> ..............................</p>
        </div>

        {/* جدول الأرصدة */}
        <table className="w-full mt-6 border-collapse border border-black text-center text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black p-2">رصيد الاعتيادي</th>
              <th className="border border-black p-2">المستهلك</th>
              <th className="border border-black p-2">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold">{emp.leave_annual_balance}</td>
              <td className="border border-black p-2 font-bold">{(emp.leave_annual_balance || 0) - (emp.remaining_annual || 0)}</td>
              <td className="border border-black p-2 font-bold">{emp.remaining_annual}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  },
  {
    id: 'casual_vacation',
    title: 'طلب إجازة عارضة',
    category: 'إجازات',
    icon: <FileText className="w-6 h-6 text-orange-600"/>,
    fields: [
      { key: 'startDate', label: 'بداية من يوم', type: 'date' },
      { key: 'endDate', label: 'إلى يوم', type: 'date' },
      { key: 'duration', label: 'المدة (أيام)', type: 'number' },
    ],
    content: (emp, data) => (
      <div className="leading-loose">
        <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
        <p className="mt-2">بعد التحية،،،</p>
        <p className="mt-4 text-justify">
          الرجاء من سيادتكم الموافقة على منحي إجازة <strong>عارضة</strong> بداية من يوم الموافق <strong>{data.startDate || '.....'}</strong> إلى يوم الموافق <strong>{data.endDate || '.....'}</strong> لمدة ( <strong>{data.duration || '..'}</strong> ) أيام، وذلك لظروف طارئة.
        </p>
        
        <div className="grid grid-cols-2 gap-8 mt-8">
          <div>
            <p><strong>مقدم الطلب:</strong> {emp.name}</p>
            <p><strong>الوظيفة:</strong> {emp.specialty}</p>
            <p><strong>تحريراً في:</strong> {new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          <div className="text-center pt-8">
            <p><strong>توقيع مقدم الطلب</strong></p>
            <p className="mt-4 text-gray-400">....................</p>
          </div>
        </div>

        {/* جدول الأرصدة العارضة */}
        <table className="w-full mt-8 border-collapse border border-black text-center text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-black p-2">رصيد العارضة</th>
              <th className="border border-black p-2">المستهلك</th>
              <th className="border border-black p-2">المتبقي</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-black p-2 font-bold">{emp.leave_casual_balance}</td>
              <td className="border border-black p-2 font-bold">{(emp.leave_casual_balance || 0) - (emp.remaining_casual || 0)}</td>
              <td className="border border-black p-2 font-bold">{emp.remaining_casual}</td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  },
  {
    id: 'itinerary_request',
    title: 'طلب خط سير',
    category: 'تحركات',
    icon: <MapPin className="w-6 h-6 text-purple-600"/>,
    fields: [
      { key: 'destination', label: 'إلى جهة', type: 'text' },
      { key: 'purpose', label: 'وذلك بغرض', type: 'text' },
      { key: 'returnTime', label: 'توقيت/تاريخ العودة', type: 'text', placeholder: 'مثال: انتهاء العمل، او الساعة ...' },
    ],
    content: (emp, data) => (
      <div className="leading-loose">
        <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
        <p className="mt-2">بعد التحية،،،</p>
        <p className="mt-4 text-justify">
          الرجاء من سيادتكم الموافقة على خط سير إلى <strong>{data.destination || '....................'}</strong>، وذلك بغرض <strong>{data.purpose || '....................'}</strong>.
        </p>
        <p className="mt-2">على أن تكون العودة إلى العمل: <strong>{data.returnTime || '....................'}</strong>.</p>
        <p className="mt-4 text-center font-bold">ولكم جزيل الشكر،،</p>

        <div className="grid grid-cols-2 gap-8 mt-12">
          <div>
            <p><strong>مقدم الطلب:</strong> {emp.name}</p>
            <p><strong>الوظيفة:</strong> {emp.specialty}</p>
            <p><strong>تحريراً في:</strong> {new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          <div className="text-center pt-8">
            <p><strong>توقيع مقدم الطلب</strong></p>
            <p className="mt-4 text-gray-400">....................</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'mission_request',
    title: 'طلب مأمورية',
    category: 'تحركات',
    icon: <Briefcase className="w-6 h-6 text-emerald-600"/>,
    fields: [
      { key: 'destination', label: 'مأمورية إلى جهة', type: 'text' },
      { key: 'startDate', label: 'من يوم', type: 'date' },
      { key: 'endDate', label: 'إلى يوم', type: 'date' },
      { key: 'returnDate', label: 'تاريخ العودة للعمل', type: 'date' },
    ],
    content: (emp, data) => (
      <div className="leading-loose">
        <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
        <p className="mt-2">بعد التحية،،،</p>
        <p className="mt-4 text-justify">
          الرجاء من سيادتكم الموافقة على القيام بمأمورية إلى جهة <strong>{data.destination || '....................'}</strong>، وذلك اعتباراً من يوم الموافق <strong>{data.startDate || '.....'}</strong> وحتى يوم الموافق <strong>{data.endDate || '.....'}</strong>.
        </p>
        <p className="mt-2">على أن تكون العودة إلى العمل بتاريخ: <strong>{data.returnDate || '....................'}</strong>.</p>
        <p className="mt-4 text-center font-bold">ولكم جزيل الشكر،،</p>

        <div className="grid grid-cols-2 gap-8 mt-12">
          <div>
            <p><strong>مقدم الطلب:</strong> {emp.name}</p>
            <p><strong>الوظيفة:</strong> {emp.specialty}</p>
            <p><strong>تحريراً في:</strong> {new Date().toLocaleDateString('ar-EG')}</p>
          </div>
          <div className="text-center pt-8">
            <p><strong>توقيع مقدم الطلب</strong></p>
            <p className="mt-4 text-gray-400">....................</p>
          </div>
        </div>
      </div>
    )
  }
];
