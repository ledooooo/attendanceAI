import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Send, CheckSquare, Square, Loader2, Mail, Bug } from 'lucide-react';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة لتحليل أيام العمل
const parseWorkDays = (workDays: any): string[] => {
    if (!workDays) return ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];
    if (Array.isArray(workDays)) return workDays;
    if (typeof workDays === 'string') return workDays.split(/[,،]/).map(d => d.trim());
    return [];
};

export default function SendReportsTab() {
    
    // --- State ---
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [sending, setSending] = useState(false);
    
    // Filters
    const [fSpec, setFSpec] = useState('all');
    const [fStatus, setFStatus] = useState('نشط');
    const [fId, setFId] = useState('');
    const [settings, setSettings] = useState<any>(null);

    // Raw Data
    const [rawAttendance, setRawAttendance] = useState<AttendanceRecord[]>([]);
    const [rawLeaves, setRawLeaves] = useState<LeaveRequest[]>([]);

    useEffect(() => { fetchData(); }, [month]); 

    const fetchData = async () => {
        const startOfMonth = `${month}-01`;
        const endOfMonth = `${month}-31`;

        const { data: emps } = await supabase.from('employees').select('*').order('name');
        const { data: sett } = await supabase.from('general_settings').select('*').single();
        const { data: att } = await supabase.from('attendance').select('*').gte('date', startOfMonth).lte('date', endOfMonth);
        const { data: lvs } = await supabase.from('leave_requests').select('*');

        if (emps) setEmployees(emps);
        if (sett) setSettings(sett);
        if (att) setRawAttendance(att);
        if (lvs) setRawLeaves(lvs);
    };

    const filteredEmployees = employees.filter(e => 
        (fSpec === 'all' || e.specialty === fSpec) &&
        (fStatus === 'all' || e.status === fStatus) &&
        (e.employee_id.includes(fId))
    );

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredEmployees.length) setSelectedIds([]);
        else setSelectedIds(filteredEmployees.map(e => e.id));
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(i => i !== id));
        else setSelectedIds([...selectedIds, id]);
    };

    const cleanId = (id: any) => String(id).trim();
    const cleanDate = (date: any) => String(date).substring(0, 10);

    // --- دالة توليد التقرير (التصميم الجديد) ---
    const generateEmailHTML = (emp: Employee, attendance: AttendanceRecord[], leaves: LeaveRequest[], monthStr: string) => {
        const daysInMonth = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
        let rowsHTML = '';
        
        // المتغيرات الإحصائية
        let stats = {
            present: 0,
            absent: 0,
            late: 0,
            leaves: 0,
            totalHours: 0
        };

        const empWorkDays = parseWorkDays(emp.work_days);
        // التاريخ الحالي لتجنب حساب أيام المستقبل كغياب
        const todayStr = new Date().toISOString().slice(0, 10);

        for (let d = 1; d <= daysInMonth; d++) {
            const dayString = String(d).padStart(2, '0');
            const targetDate = `${monthStr}-${dayString}`;
            const dateObj = new Date(targetDate);
            const dayName = DAYS_AR[dateObj.getDay()];
            
            // هل هو يوم عمل لهذا الموظف؟
            const isWorkDay = empWorkDays.includes(dayName);
            // هل التاريخ في المستقبل؟
            const isFuture = targetDate > todayStr;

            // البحث عن البيانات
            const att = attendance.find(a => cleanDate(a.date) === targetDate);
            const leave = leaves.find(l => l.status === 'مقبول' && l.start_date <= targetDate && l.end_date >= targetDate);

            // القيم الافتراضية للصف
            let inTime = '--:--';
            let outTime = '--:--';
            let hours = 0;
            let statusText = '';
            let rowBg = '#ffffff'; // أبيض
            let statusColor = '#374151'; // رمادي غامق

            // 1. منطق الحضور
            if (att) {
                // استخراج الوقت
                const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
                if (times.length > 0) {
                    inTime = times[0];
                    if (times.length > 1) {
                        outTime = times[times.length - 1];
                        // حساب الساعات
                        const [h1, m1] = inTime.split(':').map(Number);
                        const [h2, m2] = outTime.split(':').map(Number);
                        let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
                        if (diff < 0) diff += 24 * 60;
                        hours = parseFloat((diff / 60).toFixed(1));
                    }
                }

                // تحديد الحالة (حضور / تأخير / عمل إضافي)
                if (isWorkDay) {
                    // حساب التأخير (مثال: بعد 8:30 يعتبر تأخير)
                    const [ih, im] = inTime.split(':').map(Number);
                    if (ih > 8 || (ih === 8 && im > 30)) {
                        statusText = 'تأخير';
                        rowBg = '#fffbeb'; // أصفر فاتح
                        statusColor = '#d97706'; // برتقالي
                        stats.late++;
                    } else {
                        statusText = 'حضور';
                        rowBg = '#f0fdf4'; // أخضر فاتح جداً
                        statusColor = '#15803d'; // أخضر
                    }
                } else {
                    statusText = 'عمل إضافي'; // حضر في يوم راحة
                    rowBg = '#eff6ff'; // أزرق فاتح
                    statusColor = '#1d4ed8';
                }

                stats.present++;
                stats.totalHours += hours;

            } 
            // 2. منطق الإجازات
            else if (leave) {
                statusText = `إجازة (${leave.type})`;
                rowBg = '#faf5ff'; // بنفسجي فاتح
                statusColor = '#7e22ce';
                stats.leaves++;
                inTime = 'إجازة';
                outTime = 'إجازة';
            }
            // 3. منطق الغياب والعطلات
            else {
                if (isFuture) {
                    statusText = '-';
                    rowBg = '#ffffff';
                } else if (!isWorkDay) {
                    statusText = 'راحة أسبوعية';
                    rowBg = '#f3f4f6'; // رمادي
                    statusColor = '#6b7280';
                } else {
                    statusText = 'غياب';
                    rowBg = '#fef2f2'; // أحمر فاتح
                    statusColor = '#dc2626'; // أحمر
                    stats.absent++;
                }
            }

            // بناء صف الجدول
            rowsHTML += `
                <tr style="background-color: ${rowBg}; border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">
                        <span style="display:block; font-weight:bold; color:#111;">${targetDate}</span>
                        <span style="font-size:11px; color:#666;">${dayName}</span>
                    </td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; direction: ltr;">${inTime}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; direction: ltr;">${outTime}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; font-weight:bold;">${hours > 0 ? hours + ' س' : '-'}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center; font-weight:bold; color: ${statusColor};">${statusText}</td>
                </tr>
            `;
        }

        // --- قسم الطلبات ---
        const requestsHTML = leaves.length > 0 
            ? leaves.map(l => `
                <li style="margin-bottom: 8px; padding: 10px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong style="color:#334155;">${l.type}</strong>
                        <span style="font-size:12px; background:${l.status==='مقبول'?'#dcfce7':'#fee2e2'}; color:${l.status==='مقبول'?'#15803d':'#991b1b'}; padding:2px 8px; rounded:99px;">${l.status}</span>
                    </div>
                    <div style="font-size:12px; color:#64748b;">من: ${l.start_date} | إلى: ${l.end_date}</div>
                </li>
            `).join('') 
            : '<li style="color:#94a3b8; font-style:italic; padding:10px; text-align:center; background:#f9fafb; border-radius:6px;">لا توجد طلبات مسجلة لهذا الشهر</li>';

        // --- قسم الروابط الهامة ---
        let linksHTML = '';
        if (settings?.links_names && settings?.links_urls) {
            linksHTML = settings.links_names.map((name:string, i:number) => {
                if(!name || !settings.links_urls[i]) return '';
                return `
                    <a href="${settings.links_urls[i]}" target="_blank" style="display: block; margin: 8px 0; padding: 12px; background: #fff; border: 1px solid #2563eb; color: #2563eb; text-decoration: none; font-weight: bold; border-radius: 8px; text-align: center;">
                       🔗 ${name}
                    </a>
                `;
            }).join('');
        }

        // --- القالب النهائي للبريد ---
        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; direction: rtl; }
                    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
                    
                    /* Header */
                    .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px; text-align: center; }
                    .header h1 { margin: 0; font-size: 24px; font-weight: 800; }
                    .header p { margin: 5px 0 0; opacity: 0.9; }
                    
                    /* Employee Info */
                    .emp-info { background: #ecfdf5; padding: 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
                    .emp-details h2 { margin: 0; font-size: 18px; color: #064e3b; }
                    .emp-details p { margin: 4px 0 0; font-size: 14px; color: #065f46; }
                    
                    /* Stats Grid */
                    .stats { padding: 20px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; background: #fff; }
                    .stat-box { background: #f8fafc; padding: 15px 10px; border-radius: 12px; text-align: center; border: 1px solid #e2e8f0; }
                    .stat-val { display: block; font-size: 20px; font-weight: 900; color: #0f172a; margin-bottom: 4px; }
                    .stat-lbl { font-size: 11px; color: #64748b; font-weight: bold; }
                    
                    /* Section Headers */
                    .section-title { padding: 15px 20px; background: #f1f5f9; font-size: 16px; font-weight: 800; color: #334155; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; gap: 8px; }
                    
                    /* Table */
                    .table-container { padding: 0; overflow-x: auto; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th { background: #f8fafc; color: #475569; padding: 12px; text-align: center; border: 1px solid #e5e7eb; font-weight: 800; }
                    
                    /* Footer */
                    .footer { background: #f8fafc; padding: 20px; text-align: center; color: #94a3b8; font-size: 11px; border-top: 1px solid #e2e8f0; }
                </style>
            </head>
            <body>
                <div class="container">
                    
                    <div class="header">
                        <h1>تقرير الحضور والانصراف</h1>
                        <p>${settings?.center_name || 'المركز الطبي'}</p>
                    </div>

                    <div class="emp-info">
                        <div class="emp-details">
                            <h2>${emp.name}</h2>
                            <p>${emp.specialty} | كود: ${emp.employee_id}</p>
                        </div>
                        <div style="background:white; padding:8px 16px; border-radius:8px; font-weight:bold; color:#059669; border:1px solid #a7f3d0;">
                            شهر: ${monthStr}
                        </div>
                    </div>

                    <div class="section-title">📊 ملخص الأداء الشهري</div>
                    <div class="stats">
                        <div class="stat-box">
                            <span class="stat-val" style="color:#16a34a">${stats.present}</span>
                            <span class="stat-lbl">أيام حضور</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-val" style="color:#dc2626">${stats.absent}</span>
                            <span class="stat-lbl">أيام غياب</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-val" style="color:#d97706">${stats.late}</span>
                            <span class="stat-lbl">تأخيرات</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-val" style="color:#9333ea">${stats.leaves}</span>
                            <span class="stat-lbl">إجازات</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-val" style="color:#2563eb">${stats.totalHours.toFixed(1)}</span>
                            <span class="stat-lbl">ساعات عمل</span>
                        </div>
                    </div>

                    <div class="section-title">📅 سجل الحضور اليومي</div>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 25%">التاريخ</th>
                                    <th>الدخول</th>
                                    <th>الخروج</th>
                                    <th>ساعات</th>
                                    <th>الحالة</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHTML}</tbody>
                        </table>
                    </div>

                    <div class="section-title">📝 الطلبات والإجازات</div>
                    <div style="padding: 20px;">
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${requestsHTML}
                        </ul>
                    </div>

                    ${linksHTML ? `
                        <div class="section-title">🔗 روابط هامة</div>
                        <div style="padding: 20px;">
                            ${linksHTML}
                        </div>
                    ` : ''}

                    <div class="footer">
                        تم استخراج هذا التقرير آلياً من نظام إدارة الموارد البشرية.
                        <br/>
                        التاريخ: ${new Date().toLocaleDateString('ar-EG')}
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    // --- دالة الإرسال (Brevo via Vercel) ---
    const sendViaServer = async (toEmail: string, toName: string, subject: string, htmlContent: string) => {
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toEmail, toName, subject, htmlContent })
            });
            const data = await response.json();
            return response.ok ? { success: true } : { success: false, error: data.error };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const handleSendReports = async () => {
        if (selectedIds.length === 0) return alert('اختر موظفاً واحداً على الأقل');
        if (!confirm(`إرسال ${selectedIds.length} تقرير؟`)) return;
        
        setSending(true);
        let successCount = 0;
        let failCount = 0;
        let lastError = '';

        try {
            for (const empId of selectedIds) {
                const emp = employees.find(e => e.id === empId);
                if (!emp || !emp.email) { failCount++; continue; }

                const empAtt = rawAttendance.filter(a => cleanId(a.employee_id) === cleanId(emp.employee_id));
                const empLeaves = rawLeaves.filter(l => cleanId(l.employee_id) === cleanId(emp.employee_id));
                
                const htmlContent = generateEmailHTML(emp, empAtt, empLeaves, month);
                const subject = `تقرير شهر ${month} - ${emp.name}`;

                const result = await sendViaServer(emp.email, emp.name, subject, htmlContent);
                
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                    lastError = result.error || 'Unknown Error';
                }
            }
            alert(`النتيجة:\n✅ تم الإرسال: ${successCount}\n❌ فشل: ${failCount}\n${lastError ? 'آخر خطأ: ' + lastError : ''}`);
        } catch (e: any) {
            alert('خطأ غير متوقع: ' + e.message);
        } finally {
            setSending(false);
            setSelectedIds([]);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Mail className="text-emerald-600"/> إرسال التقارير الشهرية</h2>
            
            <div className="bg-white p-6 rounded-[30px] border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input type="month" label="الشهر" value={month} onChange={setMonth} />
                <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
                <Select label="الحالة" options={['all', 'نشط', 'موقوف']} value={fStatus} onChange={setFStatus} />
                <Input label="كود الموظف" value={fId} onChange={setFId} placeholder="بحث..." />
            </div>

            <div className="bg-white rounded-[30px] border shadow-sm overflow-hidden min-h-[400px] mb-20">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <button onClick={toggleSelectAll} className="flex items-center gap-2 font-bold text-gray-600 hover:text-emerald-600">
                        {selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0 ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>} تحديد الكل ({filteredEmployees.length})
                    </button>
                    <div className="text-sm font-bold text-gray-500 pt-1">محدد: {selectedIds.length}</div>
                </div>
                <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-sm text-right min-w-[600px]">
                        <thead className="bg-gray-100 font-black text-gray-600 sticky top-0">
                            <tr><th className="p-4 w-10"></th><th className="p-4">الكود</th><th className="p-4">الاسم</th><th className="p-4">البريد</th><th className="p-4 text-center">أيام العمل</th></tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className={`border-b hover:bg-emerald-50 cursor-pointer ${selectedIds.includes(emp.id)?'bg-emerald-50':''}`} onClick={()=>toggleSelect(emp.id)}>
                                    <td className="p-4">{selectedIds.includes(emp.id)?<CheckSquare className="w-5 h-5 text-emerald-600"/>:<Square className="w-5 h-5 text-gray-300"/>}</td>
                                    <td className="p-4 font-mono font-bold">{emp.employee_id}</td>
                                    <td className="p-4 font-bold">{emp.name}</td>
                                    <td className="p-4 text-xs font-mono text-gray-500">{emp.email||'-'}</td>
                                    <td className="p-4 text-center text-xs">{parseWorkDays(emp.work_days).length} أيام</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="fixed bottom-8 left-8 z-50">
                <button onClick={handleSendReports} disabled={sending || selectedIds.length === 0} className="bg-emerald-800 text-white px-8 py-4 rounded-2xl font-black shadow-2xl hover:bg-emerald-900 transition-all flex items-center gap-3 disabled:bg-gray-400">
                    {sending ? <Loader2 className="w-6 h-6 animate-spin"/> : <Send className="w-6 h-6"/>}
                    {sending ? 'جاري الإرسال...' : `إرسال (${selectedIds.length})`}
                </button>
            </div>
        </div>
    );
}
