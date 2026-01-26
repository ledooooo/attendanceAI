import React from 'react';
import { FileText, Plane, MapPin, Briefcase, BookOpen, Stethoscope, FileBadge, Clock, Heart, Baby } from 'lucide-react';
import { Employee } from '../types';
import { getBirthDataFromNationalID, addDuration } from '../utils/helpers'; // تأكد من المسار الصحيح

export interface TemplateField {
  key: string;
  label: string;
  type: 'text' | 'date' | 'number' | 'select'; // أضفنا select
  placeholder?: string;
  options?: string[]; // للخيارات
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
  // ... (النماذج السابقة: إجازة اعتيادية، عارضة، خط سير، مأمورية - اتركهم كما هم) ...

  // 1. طلب جزء من الوقت (تاريخ النهاية أوتوماتيك)
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
        const endDate = addDuration(data.startDate, 1, 'years'); // حساب سنة تلقائياً
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
            </div>
        );
    }
  },

  // 2. طلب إجازة رعاية أسرة (مفتوحة المدة)
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
            </div>
        );
    }
  },

  // 3. طلب إجازة وضع (4 أشهر أوتوماتيك)
  {
    id: 'maternity_leave',
    title: 'طلب إجازة وضع',
    category: 'إجازات خاصة',
    icon: <Baby className="w-6 h-6 text-rose-500"/>,
    fields: [
      { key: 'deliveryDate', label: 'تاريخ الوضع (الولادة)', type: 'date' },
    ],
    content: (emp, data) => {
        // حساب 4 أشهر (تقريبياً 120 يوم أو 4 شهور تقويمية)
        // القانون المصري: 4 أشهر (تعديل المادة 52 من قانون الخدمة المدنية)
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
            </div>
        );
    }
  },

  // 4. إجازة امتحان
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
      </div>
    )
  },

  // 5. بيان حالة وظيفية (محدث بالحقول الجديدة)
  {
    id: 'job_status',
    title: 'بيان حالة وظيفية',
    category: 'إدارية',
    icon: <FileBadge className="w-6 h-6 text-gray-700"/>,
    fields: [], // لا يحتاج إدخال، البيانات تسحب من الموظف
    content: (emp, data) => {
        // استخراج تاريخ الميلاد
        const { birthDate } = getBirthDataFromNationalID(emp.national_id);
        
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
                            <td className="p-3 font-mono">{birthDate}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الحالة الاجتماعية</td>
                            <td className="p-3">{emp.marital_status || '-----'}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">المؤهــــــل</td>
                            <td className="p-3">{emp.qualification || '-----'}</td>
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
                            <td className="p-3">{emp.address || '-----'}</td>
                        </tr>
                        <tr className="border border-black">
                            <td className="p-3 bg-gray-100 font-bold w-1/3 border-l border-black">الجزاءات</td>
                            <td className="p-3 text-red-600 font-bold">{emp.penalties || 'لا يوجد'}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-8 text-sm text-justify leading-relaxed">
                    <p>تشهد إدارة شئون العاملين بالمركز بصحة البيانات عالية، وقد أعطي هذا البيان بناءً على طلب المذكور لتقديمه إلى من يهمه الأمر دون أدنى مسئولية على المركز تجاه حقوق الغير.</p>
                </div>
            </div>
        );
    }
  },
  
  // ... (نماذج التأمين الصحي والدورة التدريبية التي أضفناها سابقاً) ...
];
