// src/types.ts

// تعريف بيانات الموظف
export interface Employee {
  id: string;            // المعرف الفريد في قاعدة البيانات (UUID)
  employee_id: string;   // الكود الوظيفي (مثال: 101)
  name: string;          // الاسم الرباعي
  national_id: string;   // الرقم القومي
  specialty: string;     // التخصص الوظيفي
  status?: string;        // حالة الموظف ('نشط' | 'موقوف' | 'إجازة' | ...)
  join_date?: string;     // تاريخ التعيين (YYYY-MM-DD)
  center_id?: string;    // كود المركز الطبي التابع له
  photo_url?: string;    // رابط الصورة الشخصية
  phone?: string;        // رقم الهاتف
  resignation_date?: string;
  nursing_start_date?: string;
  nursing_end_date?: string;
  nursing_time?: 'morning' | 'evening' | null;
can_manage_statistics?: boolean;
  
  // --- حقول المصادقة ---
  email?: string;        // البريد الإلكتروني
  role?: string;         // الصلاحية ('admin' | 'user' | 'head_of_dept')

  // --- بيانات إضافية ---
  gender?: string;
  grade?: string;
  religion?: string;
  
  // مواعيد العمل
  work_days?: string[];  // أيام العمل (مصفوفة)
  start_time?: string;
  end_time?: string;

  // أرصدة الإجازات
  leave_annual_balance: number; // رصيد الاعتيادي (أصل)
  leave_casual_balance: number; // رصيد العارضة (أصل)
  remaining_annual: number;     // المتبقي اعتيادي
  remaining_casual: number;     // المتبقي عارضة
  leave_sick_balance?: number;         // رصيد مرضي
  leave_morning_perm_balance?: number; // رصيد إذن صباحي
  leave_evening_perm_balance?: number; // رصيد إذن مسائي
  
  total_absence: number;        // إجمالي الغياب
  maternity?: string | boolean;           // إجازة وضع

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
// src/types.ts
export interface Competition {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  current_turn: string; // ID اللاعب الذي عليه الدور
  status: 'active' | 'completed';
  winner_id?: string;
  reward_points: number;
  created_at: string;
  // علاقات (Joins)
  player1?: { name: string; photo_url: string };
  player2?: { name: string; photo_url: string };
}

export interface Question {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  correct_option: string;
  assigned_to: string;
}
export interface ShiftSwapRequest {
  id: string;
  requester_id: string;
  recipient_id: string;
  schedule_date: string;
  status: 'pending_recipient' | 'pending_hod' | 'approved' | 'rejected';
  created_at: string;
  
  // حقول اختيارية للعرض (Join)
  requester_name?: string;
  recipient_name?: string;
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
  status: 'معلق' | 'مقبول' | 'مرفوض' | 'قيد الانتظار' | 'موافقة_رئيس_القسم';
  notes?: string;
  created_at?: string;
  employee_name?: string; // للعرض
  employee_specialty?: string; // ✅ (تمت الإضافة) تخصص الموظف للعرض والفلترة
  employee?: { name: string; specialty: string; department?: string }; // تفاصيل الموظف
  approved_by?: string;   // اسم من قام بالموافقة (رئيس القسم)
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

// تعريف التقييم الشهري
export interface Evaluation {
  id: string;
  employee_id: string;
  month: string;         // YYYY-MM
  year?: number;
  score_appearance?: number;
  score_attendance?: number;
  score_quality?: number;
  score_infection?: number;
  score_training?: number;
  score_records?: number;
  score_tasks?: number;
  // أحياناً يتم استخدام score_1, score_2... بدلاً من الأسماء الوصفية
  score_1?: number;
  score_2?: number;
  score_3?: number;
  score_4?: number;
  
  total_score: number;   
  notes?: string;
}
// في ملف types.ts

// تحديث الـ Employee Role ليشمل مسؤول الجودة
// role?: 'admin' | 'user' | 'head_of_dept' | 'quality_manager';

// واجهة تقرير OVR
export interface OVRReport {
  id: string;
  reporter_id: string;
  reporter_name: string;
  incident_date: string;
  incident_time: string;
  location: string;
  description: string;
  action_taken?: string;
  quality_response?: string;
  status: 'new' | 'reviewed' | 'closed';
  created_at: string;
}
// تعريف الرسائل الداخلية
export interface InternalMessage {
  id: string;
  created_at: string;
  from_user: string;
  to_user: string;
  content: string; 
  is_read: boolean;
  message?: string; // لدعم الكود القديم
}

// تعريف قاعدة الحضور والانصراف
export interface AttendanceRule {
  id: string;
  type: 'in' | 'out'; // حضور أو انصراف
  start_time: string;
  end_time: string;
  name: string; // "حضور مبكر", "تأخير", etc.
  color: string; // "green", "red", "orange", etc.
}

// تعريف جدول النوبتجيات المسائية
export interface EveningSchedule {
  id: string;
  date: string;
  doctors: any[]; // تم تعديله ليقبل مصفوفة كائنات أو نصوص
  notes?: string;
}

// تعريف المركز الطبي
export interface Center {
  id: string;
  name: string;
  password?: string; 
}
// src/types.ts

export interface OVRReport {
  id: string;
  reporter_id: string;
  reporter_name: string;
  incident_date: string;
  incident_time: string;
  location: string;
  description: string;
  action_taken?: string;
  quality_response?: string;
  status: 'new' | 'reviewed' | 'closed';
  created_at: string;
  is_anonymous?: boolean; // ✅ الحقل الجديد
}
// تعريف الإعدادات العامة
export interface GeneralSettings {
  id: string;
  centers: Center[];
  admin_password?: string;
  links_names?: string[];
  links_urls?: string[];
  last_attendance_update?: string;
  center_name?: string;
  // حقول العطلات الجديدة
  holidays_name?: string[];
  holidays_date?: string[];
}

// تعريف الخبر
export interface NewsPost {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  is_pinned?: boolean;
  created_at: string;
  comments?: NewsComment[]; // لربط التعليقات عند العرض
}

// تعريف التعليق
export interface NewsComment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  comment_text: string;
  created_at: string;
}

export interface EOMCycle {
  id: string;
  month: string;
  status: 'voting' | 'completed' | 'announced';
  winner_id?: string;
}

export interface EOMNominee {
  id: string;
  employee_id: string;
  votes_count: number;
  employee_name?: string; // للعرض
  photo_url?: string;
}

// --- دالة مساعدة: استخراج تاريخ الميلاد من الرقم القومي المصري ---
export const getBirthDateFromNationalID = (nid: string): Date | null => {
  if (!nid || nid.length !== 14) return null;
  
  const century = nid[0] === '2' ? 1900 : 2000;
  const year = century + parseInt(nid.substring(1, 3));
  const month = parseInt(nid.substring(3, 5)) - 1; // JS months are 0-11
  const day = parseInt(nid.substring(5, 7));
  
  const date = new Date(year, month, day);
  return isNaN(date.getTime()) ? null : date;
};
