import React from 'react';
import { FileText, Plane, MapPin, Briefcase, BookOpen, Stethoscope, FileBadge } from 'lucide-react';
import { Employee } from '../types';

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
  fields: TemplateField[];
  content: (emp: Employee, data: any) => React.ReactNode;
}

export const TEMPLATES_DATA: Template[] = [
  // --- النماذج السابقة ---
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
            <tr><th className="border border-black p-2">رصيد الاعتيادي</th><th className="border border-black p-2">المستهلك</th><th className="border border-black p-2">المتبقي</th></tr>
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
        <table className="w-full mt-8 border-collapse border border-black text-center text-sm">
          <thead className="bg-gray-100">
            <tr><th className="border border-black p-2">رصيد العارضة</th><th className="border border-black p-2">المستهلك</th><th className="border border-black p-2">المتبقي</th></tr>
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
  },

  // --- النماذج الجديدة ---

  // 1. طلب دورة تدريبية
  {
    id: 'training_request',
    title: 'طلب دورة تدريبية',
    category: 'تدريب',
    icon: <BookOpen className="w-6 h-6 text-indigo-600"/>,
    fields: [
      { key: 'courseName', label: 'اسم الدورة التدريبية', type: 'text' },
      { key: 'startDate', label: 'من يوم', type: 'date' },
      { key: 'endDate', label: 'إلى يوم', type: 'date' },
      { key: 'returnDate', label: 'تاريخ العودة للعمل', type: 'date' },
    ],
    content: (emp, data) => (
      <div className="leading-loose">
        <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
        <p className="mt-2">بعد التحية،،،</p>
        <p className="mt-4 text-justify">
          الرجاء من سيادتكم الموافقة على حضور الدورة التدريبية بعنوان: <strong>( {data.courseName || '....................'} )</strong>
        </p>
        <p className="mt-2">
          وذلك في الفترة من يوم الموافق <strong>{data.startDate || '.....'}</strong> إلى يوم الموافق <strong>{data.endDate || '.....'}</strong>.
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
  },

  // 2. جواب تأمين صحي
  {
    id: 'insurance_letter',
    title: 'تحويل للتأمين الصحي',
    category: 'طبية',
    icon: <Stethoscope className="w-6 h-6 text-red-600"/>,
    fields: [
      { key: 'examDate', label: 'تاريخ الكشف', type: 'date' },
      { key: 'returnDate', label: 'تاريخ العودة المتوقع', type: 'date' },
    ],
    content: (emp, data) => (
      <div className="leading-loose">
        <p>السيد الدكتور/ مدير عيادة التأمين الصحي،</p>
        <p className="mt-2">تحية طيبة وبعد،،،</p>
        <p className="mt-4 text-justify">
          نحيط سيادتكم علماً بأن السيد/ <strong>{emp.name}</strong>، والذي يعمل بوظيفة <strong>{emp.specialty}</strong> (الدرجة: {emp.grade || '...'})،
          قد توجه إليكم للكشف الطبي يوم الموافق <strong>{data.examDate || '.....'}</strong>.
        </p>
        <p className="mt-4">
          برجاء توقيع الكشف الطبي عليه وإفادتنا بالتقرير الطبي، على أن تكون العودة إلى العمل يوم الموافق <strong>{data.returnDate || '.....'}</strong> مع الالتزام بإبلاغ جهة العمل بنتيجة الكشف فور انتهائه.
        </p>
        <p className="mt-4 text-center font-bold">وتفضلوا بقبول فائق الاحترام،،</p>

        <div className="mt-12">
          <div className="flex flex-col items-start gap-16">
             <div className="w-full flex justify-between">
                <div>
                    <p><strong>تحريراً في:</strong> {new Date().toLocaleDateString('ar-EG')}</p>
                </div>
                <div className="text-center">
                    <p className="font-bold">مدير المركز</p>
                    <p className="mt-4 text-gray-400">....................</p>
                </div>
             </div>
          </div>
        </div>
      </div>
    )
  },

  // 3. بيان حالة وظيفية
  {
    id: 'job_status',
    title: 'بيان حالة وظيفية',
    category: 'إدارية',
    icon: <FileBadge className="w-6 h-6 text-gray-700"/>,
    fields: [
        // حقول إضافية قد لا تكون موجودة في قاعدة البيانات
        { key: 'maritalStatus', label: 'الحالة الاجتماعية', type: 'text', placeholder: 'أعزب / متزوج...' },
        { key: 'qualification', label: 'المؤهل الدراسي', type: 'text' },
        { key: 'birthDate', label: 'تاريخ الميلاد', type: 'date' },
        { key: 'address', label: 'العنوان', type: 'text' },
        { key: 'penalties', label: 'الجزاءات (إن وجدت)', type: 'text', placeholder: 'لا يوجد / أو اذكر الجزاءات...' },
    ],
    content: (emp, data) => (
      <div>
        <h2 className="text-xl font-black text-center mb-8 border-2 border-black p-2 w-fit mx-auto rounded">بيان حالة وظيفية</h2>
        
        <table className="w-full border-collapse border border-black text-right">
            <tbody>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الاســـــــم</td>
                    <td className="p-3 font-medium">{emp.name}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الوظيفة / التخصص</td>
                    <td className="p-3 font-medium">{emp.specialty}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الرقم القومي</td>
                    <td className="p-3 font-medium font-mono">{emp.national_id || '----------------'}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الكود الوظيفي</td>
                    <td className="p-3 font-medium font-mono">{emp.employee_id}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الحالة الاجتماعية</td>
                    <td className="p-3 font-medium">{data.maritalStatus || '....................'}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">المؤهــــــل</td>
                    <td className="p-3 font-medium">{data.qualification || '....................'}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الدرجة المالية</td>
                    <td className="p-3 font-medium">{emp.grade || '....................'}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">تاريخ الميلاد</td>
                    <td className="p-3 font-medium">{data.birthDate || '....................'}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">تاريخ استلام العمل</td>
                    <td className="p-3 font-medium">{emp.join_date || '....................'}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">العنوان</td>
                    <td className="p-3 font-medium">{data.address || '............................................................'}</td>
                </tr>
                <tr className="border border-black">
                    <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الجزاءات</td>
                    <td className="p-3 font-medium">{data.penalties || 'لا يوجد'}</td>
                </tr>
            </tbody>
        </table>

        <div className="mt-8 text-sm">
            <p>تشهد إدارة شئون العاملين بالمركز بصحة البيانات عالية، وقد أعطي هذا البيان بناءً على طلب المذكور لتقديمه إلى من يهمه الأمر.</p>
        </div>
      </div>
    )
  }
];
