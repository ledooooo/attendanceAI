import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Send, CheckSquare, Square, Loader2, Mail, Bug } from 'lucide-react';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// دالة مساعدة لتحويل أيام العمل إلى مصفوفة نظيفة
const parseWorkDays = (workDays: any): string[] => {
    if (!workDays) return ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"]; // الافتراضي
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

    // --- HTML Generator (Updated Structure) ---
    const generateEmailHTML = (emp: Employee, attendance: AttendanceRecord[], leaves: LeaveRequest[], monthStr: string) => {
        const daysInMonth = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
        let rowsHTML = '';
        
        // إحصائيات
        let stats = {
            present: 0,
            absent: 0,
            late: 0,
            leaves: 0,
            totalHours: 0,
            overtime: 0
        };

        const empWorkDays = parseWorkDays(emp.work_days);
        const today = new Date().toISOString().slice(0, 10);

        for (let d = 1; d <= daysInMonth; d++) {
            const dayString = String(d).padStart(2, '0');
            const targetDate = `${monthStr}-${dayString}`;
            
            // تخطي الأيام المستقبلية في التقرير
            if (targetDate > today && monthStr === today.slice(0, 7)) continue;

            const dateObj = new Date(targetDate);
            const dayName = DAYS_AR[dateObj.getDay()];
            const isWorkDay = empWorkDays.includes(dayName);
            
            const att = attendance.find(a => cleanDate(a.date) === targetDate);
            const leave = leaves.find(l => l.status === 'مقبول' && l.start_date <= targetDate && l.end_date >= targetDate);

            let statusText = 'غياب';
            let rowColor = '#fee2e2'; // أحمر فاتح للغياب
            let inTime = '--:--';
            let outTime = '--:--';
            let dailyHours = 0;

            // 1. حالة الحضور
            if (att) {
                statusText = 'حضور';
                rowColor = '#ffffff'; // أبيض للطبيعي
                
                const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
                if (times.length > 0) {
                    inTime = times[0];
                    if (times.length > 1) outTime = times[times.length - 1];
                }

                // حساب الساعات
                if (inTime !== '--:--' && outTime !== '--:--') {
                    const [h1, m1] = inTime.split(':').map(Number);
                    const [h2, m2] = outTime.split(':').map(Number);
                    let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
                    if (diff < 0) diff += 24;
                    dailyHours = parseFloat(diff.toFixed(2));
                }

                // حساب التأخير (مثال: بعد 8:15 يعتبر تأخير)
                const [ih, im] = inTime.split(':').map(Number);
                if (isWorkDay && (ih > 8 || (ih === 8 && im > 15))) {
                    statusText = 'تأخير';
                    rowColor = '#fef3c7'; // أصفر
                    stats.late++;
                }

                if (!isWorkDay) {
                    statusText = 'عمل إضافي';
                    rowColor = '#dbeafe'; // أزرق
                    stats.overtime++;
                }

                stats.present++;
                stats.totalHours += dailyHours;

            } 
            // 2. حالة الإجازة
            else if (leave) {
                statusText = `إجازة (${leave.type})`;
                rowColor = '#dcfce7'; // أخضر فاتح
                stats.leaves++;
                inTime = 'إجازة';
                outTime = 'إجازة';
            } 
            // 3. حالة العطلة / الراحة
            else if (!isWorkDay) {
                statusText = 'راحة أسبوعية';
                rowColor = '#f3f4f6'; // رمادي
                inTime = '-';
                outTime = '-';
            } 
            // 4. حالة الغياب الحقيقي
            else {
                stats.absent++;
                // يبقى أحمر وغياب
            }

            rowsHTML += `
                <tr style="background-color:${rowColor}; border-bottom:1px solid #e5e7eb;">
                    <td style="padding:8px; border:1px solid #e5e7eb;">${targetDate} <span style="color:#6b7280; font-size:10px">(${dayName})</span></td>
                    <td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">${inTime}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb; font-weight:bold;">${outTime}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb;">${dailyHours > 0 ? dailyHours + ' س' : '-'}</td>
                    <td style="padding:8px; border:1px solid #e5e7eb; font-size:11px;">${statusText}</td>
                </tr>`;
        }

        const requestsHTML = leaves.length > 0 
            ? leaves.map(l => `<li style="margin-bottom:5px; padding:8px; background:#f9fafb; border-radius:4px; font-size:12px;"><strong>${l.type}:</strong> من ${l.start_date} إلى ${l.end_date} <span style="float:left; background:${l.status==='مقبول'?'#d1fae5':'#fee2e2'}; padding:2px 5px; border-radius:3px;">${l.status}</span></li>`).join('') 
            : '<li style="color:#9ca3af; font-style:italic;">لا توجد طلبات هذا الشهر</li>';

        let linksHTML = '';
        if (settings?.links_names && settings?.links_urls) {
            linksHTML = settings.links_names.map((name:string, i:number) => {
                if(!name || !settings.links_urls[i]) return '';
                return `<a href="${settings.links_urls[i]}" target="_blank" style="display:block; margin-bottom:5px; padding:10px; background:#ecfdf5; color:#065f46; text-decoration:none; font-weight:bold; border-radius:6px; text-align:center; border:1px solid #a7f3d0;">🔗 ${name}</a>`
            }).join('');
        }

        return `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
                .container { max-width: 700px; margin: 20px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb; }
                .header { background: #059669; color: white; padding: 25px; text-align: center; }
                .section { padding: 20px; border-bottom: 1px solid #f3f4f6; }
                .section-title { font-size: 16px; font-weight: bold; color: #047857; margin-bottom: 15px; border-right: 4px solid #10b981; padding-right: 10px; background: #ecfdf5; padding-top:5px; padding-bottom:5px; display:block; }
                table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; }
                th { background: #f9fafb; color: #374151; padding: 10px; font-weight: bold; border: 1px solid #e5e7eb; }
                .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
                .stat-box { padding: 15px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
                .stat-val { font-size: 18px; font-weight: bold; display: block; margin-bottom: 5px; }
                .stat-lbl { font-size: 11px; color: #6b7280; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h2 style="margin:0; font-size:22px;">تقرير شهر ${monthStr}</h2>
                    <p style="margin:5px 0 0; font-size:16px;">${emp.name}</p>
                    <p style="margin:5px 0 0; font-size:12px; opacity:0.8;">${emp.specialty} | كود: ${emp.employee_id}</p>
                    <p style="margin:5px 0 0; font-size:12px; opacity:0.8;">${settings?.center_name || 'المركز الطبي'}</p>
                </div>

                <div class="section">
                    <div class="section-title">ملخص الأداء الشهري</div>
                    <div class="stat-grid">
                        <div class="stat-box" style="background:#f0fdf4; border-color:#bbf7d0;">
                            <span class="stat-val" style="color:#166534">${stats.present}</span>
                            <span class="stat-lbl">أيام الحضور</span>
                        </div>
                        <div class="stat-box" style="background:#fef2f2; border-color:#fecaca;">
                            <span class="stat-val" style="color:#991b1b">${stats.absent}</span>
                            <span class="stat-lbl">أيام الغياب</span>
                        </div>
                        <div class="stat-box" style="background:#eff6ff; border-color:#bfdbfe;">
                            <span class="stat-val" style="color:#1e40af">${stats.totalHours.toFixed(1)}</span>
                            <span class="stat-lbl">ساعات العمل</span>
                        </div>
                        <div class="stat-box" style="background:#fff7ed; border-color:#fed7aa;">
                            <span class="stat-val" style="color:#9a3412">${stats.leaves}</span>
                            <span class="stat-lbl">إجازات</span>
                        </div>
                        <div class="stat-box" style="background:#fffbeb; border-color:#fde68a;">
                            <span class="stat-val" style="color:#b45309">${stats.late}</span>
                            <span class="stat-lbl">مرات تأخير</span>
                        </div>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">سجل الحضور اليومي</div>
                    <div style="overflow-x:auto;">
                        <table>
                            <thead>
                                <tr>
                                    <th>التاريخ</th>
                                    <th>دخول</th>
                                    <th>خروج</th>
                                    <th>ساعات</th>
                                    <th>الحالة</th>
                                </tr>
                            </thead>
                            <tbody>${rowsHTML}</tbody>
                        </table>
                    </div>
                </div>

                <div class="section">
                    <div class="section-title">طلبات وإجازات الموظف</div>
                    <ul style="list-style:none; padding:0; margin:0;">${requestsHTML}</ul>
                </div>

                ${linksHTML ? `<div class="section"><div class="section-title">روابط تهمك</div>${linksHTML}</div>` : ''}
                
                <div style="text-align:center; padding:15px; font-size:10px; color:#9ca3af; background:#f9fafb;">
                    تم إنشاء هذا التقرير آلياً بواسطة نظام الموارد البشرية
                </div>
            </div>
        </body>
        </html>`;
    };

    // --- Send Function (Brevo) ---
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
        if (!confirm(`إرسال ${selectedIds.length} تقرير عبر Brevo؟`)) return;
        
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
                const subject = `تقرير الحضور الشهري - ${month} - ${emp.name}`;

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
