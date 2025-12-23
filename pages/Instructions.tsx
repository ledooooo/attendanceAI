
import React from 'react';
import { ArrowRight, Terminal, Database, Shield } from 'lucide-react';

interface InstructionsProps {
  onBack: () => void;
}

const Instructions: React.FC<InstructionsProps> = ({ onBack }) => {
  const sqlSchema = `
-- 1. جدول الإعدادات العامة (المراكز)
CREATE TABLE general_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    center_name TEXT NOT NULL,
    admin_name TEXT,
    phone TEXT,
    address TEXT,
    password TEXT NOT NULL,
    location_url TEXT,
    specialties TEXT[],
    leave_types TEXT[],
    holidays TEXT[],
    shift_morning_in TIME,
    shift_morning_out TIME,
    shift_evening_in TIME,
    shift_evening_out TIME,
    shift_night_in TIME,
    shift_night_out TIME
);

-- 2. جدول الموظفين
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    national_id TEXT NOT NULL,
    specialty TEXT,
    phone TEXT,
    email TEXT,
    gender TEXT DEFAULT 'ذكر',
    grade TEXT,
    photo_url TEXT,
    id_front_url TEXT,
    id_back_url TEXT,
    religion TEXT,
    work_days TEXT[],
    start_time TIME,
    end_time TIME,
    leave_annual_balance INTEGER DEFAULT 21,
    leave_casual_balance INTEGER DEFAULT 7,
    total_absence INTEGER DEFAULT 0,
    remaining_annual INTEGER DEFAULT 21,
    remaining_casual INTEGER DEFAULT 7,
    admin_tasks TEXT,
    status TEXT DEFAULT 'نشط',
    join_date DATE,
    center_id UUID REFERENCES general_settings(id),
    training_courses TEXT,
    notes TEXT
);

-- 3. جدول الطلبات والإجازات
CREATE TABLE leave_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT REFERENCES employees(employee_id),
    type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    backup_person TEXT,
    status TEXT DEFAULT 'معلق',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. جدول الحضور والانصراف
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id TEXT REFERENCES employees(employee_id),
    date DATE DEFAULT CURRENT_DATE,
    check_in TIME,
    check_in_status TEXT,
    check_out TIME,
    check_out_status TEXT,
    notes TEXT
);

-- 5. جدول المسائي
CREATE TABLE evening_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    specs TEXT[],
    doctors TEXT[]
);

-- 6. التقييمات الشهرية
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month TEXT NOT NULL,
    employee_id TEXT REFERENCES employees(employee_id),
    scores INTEGER[],
    total_score INTEGER,
    notes TEXT
);

-- 7. الرسائل والتنبيهات
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    from_user TEXT,
    to_user TEXT,
    content TEXT NOT NULL,
    notes TEXT
);

-- بيانات أولية للمركز التجريبي
INSERT INTO general_settings (center_name, admin_name, password, specialties) 
VALUES ('المركز الطبي الرئيسي', 'مدير النظام', '123456', ARRAY['باطنة', 'أطفال', 'جراحة']);
  `.trim();

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-12">
      <button onClick={onBack} className="flex items-center text-blue-600 mb-8 hover:underline">
        <ArrowRight className="w-5 h-5 ml-2" /> العودة للرئيسية
      </button>

      <div className="bg-white p-8 rounded-2xl shadow-sm border space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-4 flex items-center">
            <Terminal className="w-8 h-8 ml-3 text-blue-600" /> تعليمات التشغيل
          </h1>
          <p className="text-gray-600 leading-relaxed">
            للتشغيل الصحيح للنظام، يرجى التأكد من تنفيذ الكود التالي في محرر SQL الخاص بـ Supabase 
            لإنشاء الجداول اللازمة مع مراعاة الصلاحيات (RLS).
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-600 font-bold">
            <Database className="w-5 h-5" /> هيكل قاعدة البيانات (SQL Schema)
          </div>
          <div className="relative group">
            <pre className="bg-gray-900 text-green-400 p-6 rounded-xl overflow-x-auto text-sm font-mono max-h-[500px]">
              {sqlSchema}
            </pre>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(sqlSchema);
                alert('تم النسخ!');
              }}
              className="absolute top-4 left-4 bg-gray-700 text-white px-3 py-1 rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              نسخ الكود
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t">
          <div className="flex gap-4">
             <div className="bg-blue-100 p-3 rounded-full h-fit"><Shield className="text-blue-600" /></div>
             <div>
                <h4 className="font-bold text-lg mb-1">صلاحيات الوصول</h4>
                <p className="text-sm text-gray-500">يجب تفعيل RLS أو تعطيله مؤقتاً للتطوير. تأكد من إعداد سياسات لكل جدول ليتمكن المستخدمون من القراءة والكتابة.</p>
             </div>
          </div>
          <div className="flex gap-4">
             <div className="bg-emerald-100 p-3 rounded-full h-fit"><Terminal className="text-emerald-600" /></div>
             <div>
                <h4 className="font-bold text-lg mb-1">البيانات التجريبية</h4>
                <p className="text-sm text-gray-500">الباسورد الافتراضي للمدير بعد تنفيذ الكود هو <span className="font-mono font-bold">123456</span>.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Instructions;
