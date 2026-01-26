import React from 'react';
import { FileText, Plane, MapPin, Briefcase, BookOpen, Stethoscope, FileBadge, Clock, Heart, Baby } from 'lucide-react';
import { Employee } from '../types';

// --- دوال مساعدة للحسابات التلقائية ---

// 1. استخراج تاريخ الميلاد من الرقم القومي المصري
const getBirthDateFromID = (nid: string | undefined) => {
    if (!nid || nid.length !== 14) return 'غير متوفر';
    const century = nid[0] === '2' ? '19' : '20';
    const year = nid.substring(1, 3);
    const month = nid.substring(3, 5);
    const day = nid.substring(5, 7);
    return `${year}-${month}-${day} (مواليد ${century}${year})`;
};

// 2. إضافة مدة زمنية للتاريخ
const addDuration = (dateStr: string, amount: number, unit: 'months' | 'years') => {
    if (!dateStr) return '.....';
    const date = new Date(dateStr);
    if (unit === 'months') date.setMonth(date.getMonth() + amount);
    if (unit === 'years') date.setFullYear(date.getFullYear() + amount);
    date.setDate(date.getDate() - 1); // إنقاص يوم واحد لضبط الفترة
    return date.toISOString().split('T')[0];
};

// --- التعريفات ---

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

// --- مصفوفة القوالب (الكل) ---

export const TEMPLATES_DATA: Template[] = [
  // 1. طلب إجازة اعتيادية
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
        <div className="mt-8 flex justify-between font-bold text-center">
            <div>شئون العاملين<br/><br/>................</div>
            <div>مدير المركز<br/><br/>................</div>
        </div>
      </div>
    )
  },

  // 2. طلب إجازة عارضة
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
        <div className="mt-8 flex justify-between font-bold text-center">
            <div>شئون العاملين<br/><br/>................</div>
            <div>مدير المركز<br/><br/>................</div>
        </div>
      </div>
    )
  },

  // 3. طلب خط سير
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
        <div className="mt-8 flex justify-between font-bold text-center">
            <div>شئون العاملين<br/><br/>................</div>
            <div>مدير المركز<br/><br/>................</div>
        </div>
      </div>
    )
  },

  // 4. طلب مأمورية
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
        <div className="mt-8 flex justify-between font-bold text-center">
            <div>شئون العاملين<br/><br/>................</div>
            <div>مدير المركز<br/><br/>................</div>
        </div>
      </div>
    )
  },

  // 5. طلب دورة تدريبية
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
        <div className="mt-8 flex justify-between font-bold text-center">
            <div>شئون العاملين<br/><br/>................</div>
            <div>مدير المركز<br/><br/>................</div>
        </div>
      </div>
    )
  },

  // 6. جواب تأمين صحي
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

  // 7. طلب جزء من الوقت
  {
    id: 'part_time_request',
    title: 'طلب عمل جزء من الوقت',
    category: 'إجازات خاصة',
    icon: <Clock className="w-6 h-6 text-purple-600"/>,
    fields: [
      { key: 'startDate', label: 'بداية من تاريخ', type: 'date' },
      { key: 'workDays', label: 'أيام العمل المطلوبة', type: 'text', placeholder: 'مثال: السبت - الاثنين - الأربعاء' },
    ],
    content: (emp, data) => {
        const endDate = addDuration(data.startDate, 1, 'years');
        return (
            <div className="leading-loose">
                <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
                <p className="mt-2">بعد التحية،،،</p>
                <p className="mt-4 text-justify">
                    الرجاء من سيادتكم الموافقة على منحي إجازة <strong>عمل جزء من الوقت</strong> (بنسبة 60% من الأجر والعمل).
                </p>
                <p className="mt-2">
                    وذلك لمدة <strong>عام كامل</strong> يبدأ من تاريخ <strong>{data.startDate || '.....'}</strong> وينتهي في تاريخ <strong>{endDate}</strong>.
                </p>
                <p className="mt-2">
                    على أن تكون أيام العمل هي: <strong>( {data.workDays || '....................'} )</strong>.
                </p>
                <p className="mt-6 text-center font-bold">ولكم جزيل الشكر،،</p>

                <div className="grid grid-cols-2 gap-8 mt-12">
                    <div>
                        <p><strong>مقدم الطلب:</strong> {emp.name}</p>
                        <p><strong>الوظيفة:</strong> {emp.specialty}</p>
                    </div>
                    <div className="text-center pt-8">
                        <p><strong>توقيع مقدم الطلب</strong></p>
                        <p className="mt-4">....................</p>
                    </div>
                </div>
                <div className="mt-8 flex justify-between font-bold text-center">
                    <div>شئون العاملين<br/><br/>................</div>
                    <div>مدير المركز<br/><br/>................</div>
                </div>
            </div>
        );
    }
  },

  // 8. طلب إجازة رعاية أسرة
  {
    id: 'family_care',
    title: 'طلب إجازة رعاية أسرة',
    category: 'إجازات خاصة',
    icon: <Heart className="w-6 h-6 text-pink-600"/>,
    fields: [
      { key: 'startDate', label: 'بداية من تاريخ', type: 'date' },
      { key: 'duration', label: 'المدة (عدد السنوات)', type: 'number', placeholder: '1' },
    ],
    content: (emp, data) => {
        const years = data.duration || 1;
        const endDate = addDuration(data.startDate, years, 'years');
        return (
            <div className="leading-loose">
                <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
                <p className="mt-2">بعد التحية،،،</p>
                <p className="mt-4 text-justify">
                    الرجاء من سيادتكم الموافقة على منحي إجازة خاصة بدون أجر <strong>(لرعاية الأسرة)</strong>.
                </p>
                <p className="mt-2">
                    وذلك لمدة ( <strong>{years}</strong> ) سنة/سنوات، تبدأ من تاريخ <strong>{data.startDate || '.....'}</strong> وتنتهي في تاريخ <strong>{endDate}</strong>.
                </p>
                <p className="mt-6 text-center font-bold">ولكم جزيل الشكر،،</p>
                <div className="mt-12 text-left px-8">
                    <p><strong>مقدم الطلب:</strong> {emp.name}</p>
                    <p><strong>التوقيع:</strong> ....................</p>
                </div>
                <div className="mt-8 flex justify-between font-bold text-center">
                    <div>شئون العاملين<br/><br/>................</div>
                    <div>مدير المركز<br/><br/>................</div>
                </div>
            </div>
        );
    }
  },

  // 9. طلب إجازة وضع
  {
    id: 'maternity_leave',
    title: 'طلب إجازة وضع',
    category: 'إجازات خاصة',
    icon: <Baby className="w-6 h-6 text-rose-500"/>,
    fields: [
      { key: 'deliveryDate', label: 'تاريخ الوضع (الولادة)', type: 'date' },
    ],
    content: (emp, data) => {
        const returnDate = addDuration(data.deliveryDate, 4, 'months');
        return (
            <div className="leading-loose">
                <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
                <p className="mt-2">بعد التحية،،،</p>
                <p className="mt-4 text-justify">
                    أتقدم لسيادتكم بطلب الموافقة على منحي <strong>إجازة وضع</strong> لمدة أربعة أشهر بأجر كامل.
                </p>
                <p className="mt-2">
                    حيث أنني قد وضعت مولودي بتاريخ <strong>{data.deliveryDate || '.....'}</strong>، ومرفق لسيادتكم أصل شهادة الميلاد/إخطار الولادة.
                </p>
                <p className="mt-2">
                    على أن تكون العودة إلى العمل بتاريخ: <strong>{returnDate}</strong>.
                </p>
                <p className="mt-6 text-center font-bold">ولكم جزيل الشكر،،</p>
                <div className="mt-12 text-left px-8">
                    <p><strong>مقدمة الطلب:</strong> {emp.name}</p>
                    <p><strong>التوقيع:</strong> ....................</p>
                </div>
                <div className="mt-8 flex justify-between font-bold text-center">
                    <div>شئون العاملين<br/><br/>................</div>
                    <div>مدير المركز<br/><br/>................</div>
                </div>
            </div>
        );
    }
  },

  // 10. إجازة امتحان
  {
    id: 'exam_leave',
    title: 'طلب إجازة أداء امتحان',
    category: 'إجازات',
    icon: <BookOpen className="w-6 h-6 text-blue-800"/>,
    fields: [
      { key: 'examName', label: 'اسم الامتحان / الشهادة', type: 'text' },
      { key: 'examDate', label: 'تاريخ الامتحان', type: 'date' },
      { key: 'duration', label: 'عدد الأيام المطلوبة', type: 'number' },
      { key: 'returnDate', label: 'تاريخ العودة للعمل', type: 'date' },
    ],
    content: (emp, data) => (
      <div className="leading-loose">
        <p>السيد الدكتور/ مدير مركز غرب المطار،</p>
        <p className="mt-2">بعد التحية،،،</p>
        <p className="mt-4 text-justify">
            الرجاء الموافقة على منحي إجازة لأداء امتحان <strong>( {data.examName || '....................'} )</strong>.
        </p>
        <p className="mt-2">
            وذلك بتاريخ <strong>{data.examDate || '.....'}</strong> ولمدة ( <strong>{data.duration || '1'}</strong> ) أيام.
        </p>
        <p className="mt-2">على أن تكون العودة إلى العمل بتاريخ: <strong>{data.returnDate || '....................'}</strong>.</p>
        <p className="mt-6 text-center font-bold">ولكم جزيل الشكر،،</p>
        <div className="mt-8">
            <p><strong>مقدم الطلب:</strong> {emp.name}</p>
            <p className="mt-4"><strong>التوقيع:</strong> ....................</p>
        </div>
        <div className="mt-8 flex justify-between font-bold text-center">
            <div>شئون العاملين<br/><br/>................</div>
            <div>مدير المركز<br/><br/>................</div>
        </div>
      </div>
    )
  },

  // 11. بيان حالة وظيفية
  {
    id: 'job_status',
    title: 'بيان حالة وظيفية',
    category: 'إدارية',
    icon: <FileBadge className="w-6 h-6 text-gray-700"/>,
    fields: [
        // حقول اختيارية لملئها يدوياً إذا لم تكن موجودة في قاعدة البيانات
        { key: 'maritalStatus', label: 'الحالة الاجتماعية', type: 'text', placeholder: 'مثال: متزوج' },
        { key: 'qualification', label: 'المؤهل الدراسي', type: 'text' },
        { key: 'address', label: 'العنوان', type: 'text' },
        { key: 'penalties', label: 'الجزاءات', type: 'text', placeholder: 'لا يوجد' },
    ],
    content: (emp, data) => {
        const birthDateStr = getBirthDateFromID(emp.national_id);
        
        return (
            <div>
                <h2 className="text-xl font-black text-center mb-8 border-2 border-black p-2 w-fit mx-auto rounded bg-gray-50">بيان حالة وظيفية</h2>
                
                <table className="w-full border-collapse border border-black text-right text-base">
                    <tbody>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الاســـــــم</td>
                            <td className="p-3 font-bold">{emp.name}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الوظيفة / التخصص</td>
                            <td className="p-3">{emp.specialty}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الرقم القومي</td>
                            <td className="p-3 font-mono font-bold">{emp.national_id || '----------------'}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الكود الوظيفي</td>
                            <td className="p-3 font-mono">{emp.employee_id}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">تاريخ الميلاد</td>
                            <td className="p-3 font-mono">{birthDateStr}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الحالة الاجتماعية</td>
                            {/* الأولوية للبيانات المدخلة في الفورم، ثم البيانات في قاعدة البيانات */}
                            <td className="p-3">{data.maritalStatus || emp.marital_status || '-----'}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">المؤهــــــل</td>
                            <td className="p-3">{data.qualification || emp.qualification || '-----'}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الدرجة المالية</td>
                            <td className="p-3">{emp.grade || '-----'}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">تاريخ استلام العمل</td>
                            <td className="p-3 font-mono">{emp.join_date || '-----'}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">العنوان</td>
                            <td className="p-3">{data.address || emp.address || '-----'}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الجزاءات</td>
                            <td className="p-3 text-red-600 font-bold">{data.penalties || emp.penalties || 'لا يوجد'}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-8 text-sm text-justify leading-relaxed">
                    <p>تشهد إدارة شئون العاملين بالمركز بصحة البيانات عالية، وقد أعطي هذا البيان بناءً على طلب المذكور لتقديمه إلى من يهمه الأمر دون أدنى مسئولية على المركز تجاه حقوق الغير.</p>
                </div>
                
                <div className="mt-8 flex justify-between font-bold text-center">
                    <div>شئون العاملين<br/><br/>................</div>
                    <div>مدير المركز<br/><br/>................</div>
                </div>
            </div>
        );
    }
  },
];
