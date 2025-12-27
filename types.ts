// تعريف بيانات الموظف
export interface Employee {
  id: string;            // المعرف الفريد في قاعدة البيانات (UUID)
  employee_id: string;   // الكود الوظيفي (مثال: 101)
  name: string;          // الاسم الرباعي
  national_id: string;   // الرقم القومي
  specialty: string;     // التخصص الوظيفي
  status: 'نشط' | 'موقوف' | 'إجازة'; // حالة الموظف
  join_date: string;     // تاريخ التعيين (YYYY-MM-DD)
  center_id?: string;    // كود المركز الطبي التابع له
  photo_url?: string;    // رابط الصورة الشخصية
  phone?: string;        // رقم الهاتف
  
  // --- حقول المصادقة الجديدة (Auth Refactoring) ---
  email?: string;        // البريد الإلكتروني (لربط حساب Supabase)
  role?: 'admin' | 'user'; // الصلاحية: مدير أو مستخدم عادي

  // --- أرصدة الإجازات (اختياري) ---
  remaining_annual?: number; // رصيد الاعتيادي
  remaining_casual?: number; // رصيد العارضة
}

// تعريف سجل الحضور
export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  times: string; // تخزن الأوقات كسلسلة نصية مفصولة بمسافات (مثال: "08:00 14:00")
}

// تعريف طلب الإجازة
export interface LeaveRequest {
  id: string;
  employee_id: string;
  type: string;          // نوع الإجازة (عارضة، اعتيادية، إلخ)
  start_date: string;
  end_date: string;
  backup_person?: string; // الموظف البديل
  status: 'معلق' | 'مقبول' | 'مرفوض';
  notes?: string;
  created_at: string;
  
  // حقل إضافي للعرض عند عمل Join مع جدول الموظفين
  employee_name?: string; 
}

// تعريف التقييم الشهري
export interface Evaluation {
  id: string;
  employee_id: string;
  month: string;         // شهر التقييم (YYYY-MM)
  score_appearance: number;
  score_attendance: number;
  score_quality: number;
  score_infection: number;
  score_training: number;
  score_records: number;
  score_tasks: number;
  total_score: number;   // المجموع من 100
  notes?: string;
}

// تعريف الرسائل الداخلية
export interface InternalMessage {
  id: string;
  from_user: string;     // كود المرسل (أو 'admin')
  to_user: string;       // كود المستقبل (أو 'all')
  content: string;
  created_at: string;
  read: boolean;
}

// تعريف جدول النوبتجيات المسائية
export interface EveningSchedule {
  id: string;
  date: string;
  doctors: string[];     // قائمة أسماء الأطباء/الموظفين في النوبتجية
  notes?: string;
}

// تعريف المركز الطبي (داخل الإعدادات)
export interface Center {
  id: string;
  name: string;
  password?: string; // (إرث) كلمة مرور المركز للدخول القديم
}

// تعريف الإعدادات العامة
export interface GeneralSettings {
  id: string;
  centers: Center[];     // قائمة المراكز الطبية
  admin_password?: string; // (إرث) كلمة مرور المدير العامة
}