// تعريف بيانات الموظف
export interface Employee {
  id: string;            // المعرف الفريد في قاعدة البيانات (UUID)
  employee_id: string;   // الكود الوظيفي (مثال: 101)
  name: string;          // الاسم الرباعي
  national_id: string;   // الرقم القومي
  specialty: string;     // التخصص الوظيفي
  status: string;        // حالة الموظف ('نشط' | 'موقوف' | 'إجازة' | ...)
  join_date: string;     // تاريخ التعيين (YYYY-MM-DD)
  center_id?: string;    // كود المركز الطبي التابع له
  photo_url?: string;    // رابط الصورة الشخصية
  phone?: string;        // رقم الهاتف
  
  // --- حقول المصادقة ---
  email?: string;        // البريد الإلكتروني
  role?: string;         // الصلاحية ('admin' | 'user')

  // --- بيانات إضافية (التي كانت تسبب الخطأ) ---
  gender?: string;
  grade?: string;
  religion?: string;
  
  // مواعيد العمل
  work_days?: string[];  // أيام العمل (مصفوفة)
  start_time?: string;
  end_time?: string;

  // أرصدة الإجازات
  leave_annual_balance?: number; // رصيد الاعتيادي (أصل)
  leave_casual_balance?: number; // رصيد العارضة (أصل)
  remaining_annual?: number;     // المتبقي اعتيادي
  remaining_casual?: number;     // المتبقي عارضة
  total_absence?: number;        // إجمالي الغياب
  maternity?: boolean;           // إجازة وضع

  // معلومات أخرى
  admin_tasks?: string;
  training_courses?: string;
  notes?: string;
  id_front_url?: string;
  id_back_url?: string;
}

// تعريف سجل الحضور
export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  times: string; // "08:00 14:00"
}

// تعريف الإشعارات
export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// تعريف طلب الإجازة
export interface LeaveRequest {
  id: string;
  employee_id: string;
  type: string;          // نوع الإجازة
  start_date: string;
  end_date: string;
  back_date?: string;    // تاريخ العودة
  backup_person?: string; // الموظف البديل
  status: 'معلق' | 'مقبول' | 'مرفوض';
  notes?: string;
  created_at: string;
  employee_name?: string; // للعرض
}

// تعريف التقييم الشهري
export interface Evaluation {
  id: string;
  employee_id: string;
  month: string;         // YYYY-MM
  year?: number;
  score_appearance: number;
  score_attendance: number;
  score_quality: number;
  score_infection: number;
  score_training: number;
  score_records: number;
  score_tasks: number;
  total_score: number;   
  notes?: string;
}

// تعريف الرسائل الداخلية
export interface InternalMessage {
  id: string;
  from_user: string;     
  to_user: string;       
  message: string;       // لاحظ: الاسم قد يكون message أو content حسب الجدول
  created_at: string;
  is_read: boolean;
}

// تعريف جدول النوبتجيات المسائية
export interface EveningSchedule {
  id: string;
  date: string;
  doctors: string[];     
  notes?: string;
}

// تعريف المركز الطبي
export interface Center {
  id: string;
  name: string;
  password?: string; 
}

// تعريف الإعدادات العامة
export interface GeneralSettings {
  id: string;
  centers: Center[];
  admin_password?: string;
  links_names?: string[];
  links_urls?: string[];
  last_attendance_update?: string;
}
