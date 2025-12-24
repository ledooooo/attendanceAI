
export interface GeneralSettings {
  id: string;
  center_name: string;
  admin_name: string;
  phone: string;
  address: string;
  password: string;
  location_url: string;
  specialties: string[];
  leave_types: string[];
  holidays: string[];
  shift_morning_in: string;
  shift_morning_out: string;
  shift_evening_in: string;
  shift_evening_out: string;
  shift_night_in: string;
  shift_night_out: string;
}

export interface Employee {
  id: string;
  employee_id: string;
  name: string;
  national_id: string;
  specialty: string;
  phone: string;
  email: string;
  gender: 'ذكر' | 'أنثى';
  grade: string;
  photo_url: string;
  id_front_url: string;
  id_back_url: string;
  religion: string;
  work_days: string[];
  start_time: string;
  end_time: string;
  leave_annual_balance: number;
  leave_casual_balance: number;
  total_absence: number;
  remaining_annual: number;
  remaining_casual: number;
  admin_tasks: string;
  status: 'نشط' | 'موقوف' | 'إجازة';
  join_date: string;
  center_id: string;
  training_courses: string;
  notes: string;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  type: string;
  start_date: string;
  end_date: string;
  back_date: string; // الحقل الجديد
  backup_person: string;
  status: 'معلق' | 'مقبول' | 'مرفوض';
  notes: string;
  created_at: string;
  employee_name?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  times: string; 
}

export interface EveningSchedule {
  id: string;
  date: string;
  specs: string[];
  doctors: string[];
}

export interface Evaluation {
  id: string;
  month: string;
  employee_id: string;
  scores: number[];
  total_score: number;
  notes: string;
}

export interface InternalMessage {
  id: string;
  created_at: string;
  from_user: string;
  to_user: string;
  content: string;
  notes: string;
}
