import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Send, CheckSquare, Square, Loader2, Mail, Bug } from 'lucide-react';

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// --- دوال مساعدة ---
const normalizeDate = (dateInput: any): string => {
    if (!dateInput) return "";
    // نحاول التعامل مع التاريخ سواء كان كائن Date أو نص
    let d = new Date(dateInput);
    if (isNaN(d.getTime())) {
        // محاولة اصلاح التنسيق اذا كان نصاً وبه مسافات
        const str = String(dateInput).trim();
        d = new Date(str);
    }
    // إرجاع التاريخ بتنسيق YYYY-MM-DD
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return String(dateInput).substring(0, 10); // فشل التحويل، نعيد النص كما هو
};

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

    // Leaves (طلبات الإجازات ليست كثيرة عادة، يمكن جلبها كلها)
    const [rawLeaves, setRawLeaves] = useState<LeaveRequest[]>([]);

    useEffect(() => { fetchData(); }, [month]); 

    const fetchData = async () => {
        const { data: emps } = await supabase.from('employees').select('*').order('name');
        const { data: sett } = await supabase.from('general_settings').select('*').single();
        const { data: lvs } = await supabase.from('leave_requests').select('*'); // الإجازات عددها قليل مقارنة بالحضور

        if (emps) setEmployees(emps);
        if (sett) setSettings(sett);
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

    // --- HTML Generator ---
    const generateEmailHTML = (emp: Employee, attendance: AttendanceRecord[], leaves: LeaveRequest[], monthStr: string) => {
        const [y, m] = monthStr.split('-').map(Number);
        const daysInMonth = new Date(y, m, 0).getDate(); // عدد أيام الشهر
        let rowsHTML = '';
        
        let stats = {
            present: 0,
            absent: 0,
            late: 0,
            leaves: 0,
            totalHours: 0
        };

        const empWorkDays = parseWorkDays(emp.work_days);
        const todayStr = new Date().toISOString().slice(0, 10);

        for (let d = 1; d <= daysInMonth; d++) {
            const dayString = String(d).padStart(2, '0');
            const targetDate = `${monthStr}-${dayString}`;
            
            // تخطي الأيام المستقبلية
            if (targetDate > todayStr) continue;

            const dateObj = new Date(targetDate);
            const dayName = DAYS_AR[dateObj.getDay()];
            const isWorkDay = empWorkDays.includes(dayName);
            
            // المطابقة باستخدام الدالة الموحدة
            const att = attendance.find(a => normalizeDate(a.date) === targetDate);
            const leave = leaves.find(l => l.status === 'مقبول' && normalizeDate(l.start_date) <= targetDate && normalizeDate(l.end_date) >= targetDate);

            let statusText = 'غياب';
            let rowColor = '#fee2e2'; // أحمر فاتح
            let textColor = '#991b1b'; // أحمر غامق
            let inTime = '--:--';
            let outTime = '--:--';
            let dailyHours = 0;

            // 1. حضور
            if (att && att.times && att.times.trim().length > 0) {
                const times = att.times.match(/\d{1,2}:\d{2}/g) || [];
                if (times.length > 0) {
                    inTime = times[0];
                    if (times.length > 1) {
                        outTime = times[times.length - 1];
                        const [h1, m1] = inTime.split(':').map(Number);
                        const [h2, m2] = outTime.split(':').map(Number);
                        let diff = (new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime()) / 3600000;
                        if (diff < 0) diff += 24;
                        dailyHours = parseFloat(diff.toFixed(2));
                    }
                }

                if (isWorkDay) {
                    const [ih, im] = inTime.split(':').map(Number);
                    if (ih > 8 || (ih === 8 && im > 30)) {
                        statusText = 'تأخير';
                        rowColor = '#fffbeb'; textColor = '#b45309';
                        stats.late++;
                    } else {
                        statusText = 'حضور';
                        rowColor = '#ffffff'; textColor = '#166534';
                    }
                } else {
                    statusText = 'إضافي';
                    rowColor = '#eff6ff'; textColor = '#1e40af';
                }
                stats.present++;
                stats.totalHours += dailyHours;

            } 
            // 2. إجازة
            else if (leave) {
                statusText = `إجازة (${leave.type})`;
                rowColor = '#dcfce7'; textColor = '#166534';
                inTime = 'إجازة'; outTime = 'إجازة';
                stats.leaves++;
            } 
            // 3. راحة
            else if (!isWorkDay) {
                statusText = 'راحة';
                rowColor = '#f3f4f6'; textColor = '#6b7280';
                inTime = '-'; outTime = '-';
            } 
            // 4. غياب
            else {
                stats.absent++;
            }

            rowsHTML += `
                <tr style="background-color: ${rowColor}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; border-left: 1px solid #e2e8f0; text-align: right;">
                        <div style="font-weight:bold; color:#1e293b;">${targetDate}</div>
                        <div style="font-size:11px; color:#64748b;">${dayName}</div>
                    </td>
                    <td style="padding: 8px; text-align: center; border-left: 1px solid #e2e8f0; direction:ltr;">${inTime}</td>
                    <td style="padding: 8px; text-align: center; border-left: 1px solid #e2e8f0; direction:ltr;">${outTime}</td>
                    <td style="padding: 8px; text-align: center; border-left: 1px solid #e2e8f0; font-weight:bold;">${dailyHours > 0 ? dailyHours : '-'}</td>
                    <td style="padding: 8px; text-align: center; font-weight:bold; color:${textColor};">${statusText}</td>
                </tr>`;
        }

        const requestsHTML = leaves.length > 0 
            ? leaves.map(l => `<li style="margin-bottom:5px; padding:8px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:12px;"><strong>${l.type}</strong> (${l.status}) من ${l.start_date} إلى ${l.end_date}</li>`).join('') 
            : '<li style="color:#94a3b8; font-style:italic; text-align:center;">لا توجد طلبات</li>';

        let linksHTML = '';
        if (settings?.links_names && settings?.links_urls) {
            linksHTML = settings.links_names.map((name:string, i:number) => {
                if(!name || !settings.links_urls[i]) return '';
                return `<a href="${settings.links_urls[i]}" target="_blank" style="display:block; margin-bottom:5px; padding:10px; background:#f0fdf4; color:#166534; text-decoration:none; font-weight:bold; border:1px solid #bbf7d0; border-radius:6px; text-align:center;">🔗 ${name}</a>`
            }).join('');
        }

        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 20px; direction: rtl; }
                    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
                    .header { background: #059669; color: white; padding: 30px; text-align: center; }
                    .emp-info { background: #ecfdf5; padding: 15px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                    .section { padding: 20px; border-bottom: 4px solid #f1f5f9; }
                    .section-title { font-size: 16px; font-weight: 800; color: #334155; margin-bottom: 15px; border-right: 4px solid #059669; padding-right: 10px; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; }
                    th { background: #f8fafc; color: #475569; padding: 10px; text-align: center; border: 1px solid #e2e8f0; font-weight: 800; }
                    .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; text-align: center; }
                    .stat-box { padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: #fff; }
                    .stat-val { display: block; font-size: 18px; font-weight: 900; margin-bottom: 4px; }
                    .stat-lbl { font-size: 11px; color: #64748b; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1 style="margin:0; font-size:24px;">تقرير شهر ${monthStr}</h1>
                        <p style="margin:5px 0 0; opacity:0.9;">${settings?.center_name || 'المركز الطبي'}</p>
                    </div>
                    <div class="emp-info">
                        <div>
                            <h2 style="margin:0; font-size:18px; color:#064e3b;">${emp.name}</h2>
                            <p style="margin:2px 0 0; font-size:13px; color:#065f46;">${emp.specialty} | كود: ${emp.employee_id}</p>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">📊 ملخص الأداء</div>
                        <div class="stats-grid">
                            <div class="stat-box" style="background:#f0fdf4; color:#166534"><span class="stat-val">${stats.present}</span><span class="stat-lbl">حضور</span></div>
                            <div class="stat-box" style="background:#fef2f2; color:#991b1b"><span class="stat-val">${stats.absent}</span><span class="stat-lbl">غياب</span></div>
                            <div class="stat-box" style="background:#fffbeb; color:#b45309"><span class="stat-val">${stats.late}</span><span class="stat-lbl">تأخير</span></div>
                            <div class="stat-box" style="background:#faf5ff; color:#7e22ce"><span class="stat-val">${stats.leaves}</span><span class="stat-lbl">إجازة</span></div>
                            <div class="stat-box" style="background:#eff6ff; color:#1e40af"><span class="stat-val">${stats.totalHours.toFixed(1)}</span><span class="stat-lbl">ساعات</span></div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">📅 السجل اليومي</div>
                        <div style="overflow-x:auto;">
                            <table>
                                <thead><tr><th style="width:25%">التاريخ</th><th>دخول</th><th>خروج</th><th>ساعات</th><th>الحالة</th></tr></thead>
                                <tbody>${rowsHTML}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="section">
                        <div class="section-title">📝 الطلبات والإجازات</div>
                        <ul style="list-style:none; padding:0; margin:0;">${requestsHTML}</ul>
                    </div>
                    ${linksHTML ? `<div class="section"><div class="section-title">🔗 روابط هامة</div>${linksHTML}</div>` : ''}
                    <div style="padding:20px; text-align:center; font-size:11px; color:#94a3b8; background:#f8fafc;">تم استخراج التقرير آلياً - ${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
            </body>
            </html>
        `;
    };

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
            // حساب أيام الشهر المحدد للجلب الدقيق
            const [y, m] = month.split('-').map(Number);
            const daysInMonth = new Date(y, m, 0).getDate();
            const startOfMonth = `${month}-01`;
            const endOfMonth = `${month}-${daysInMonth}`;

            for (const empId of selectedIds) {
                const emp = employees.find(e => e.id === empId);
                if (!emp || !emp.email) { failCount++; continue; }

                // === التغيير الجذري هنا ===
                // جلب بيانات الحضور لهذا الموظف تحديداً من قاعدة البيانات مباشرة لتجاوز حد الـ 1000 صف
                const { data: empAtt } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', emp.employee_id)
                    .gte('date', startOfMonth)
                    .lte('date', endOfMonth);

                const empLeaves = rawLeaves.filter(l => l.employee_id === emp.employee_id);
                
                // استخدام البيانات التي تم جلبها للتو (empAtt) وليس البيانات العامة
                const htmlContent = generateEmailHTML(emp, empAtt || [], empLeaves, month);
                const subject = `تقرير شهر ${month} - ${emp.name}`;

                const result = await sendViaServer(emp.email, emp.name, subject, htmlContent);
                
                if (result.success) {
                    successCount++;
                } else {
                    failCount++;
                    lastError = result.error || 'Unknown';
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

    // --- زر الفحص (Debug) محدث أيضاً ---
    const handleDebug = async () => {
        if (selectedIds.length === 0) return alert("اختر موظفاً واحداً للفحص");
        const emp = employees.find(e => e.id === selectedIds[0]);
        if (!emp) return;

        const startOfMonth = `${month}-01`;
        const endOfMonth = `${month}-31`;

        // جلب خاص لهذا الموظف للفحص
        const { data: dbAtt } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', emp.employee_id)
            .gte('date', startOfMonth)
            .lte('date', endOfMonth);

        let msg = `فحص الموظف: ${emp.name} (${emp.employee_id})\n`;
        msg += `الفترة: ${month}\n`;
        msg += `عدد السجلات في القاعدة: ${dbAtt?.length || 0}\n`;
        
        if (dbAtt && dbAtt.length > 0) {
            msg += `\nأول سجل: ${dbAtt[0].date} - ${dbAtt[0].times}`;
        } else {
            msg += `\n⚠️ لا توجد سجلات. تأكد من أن كود الموظف في ملف البصمة هو "${emp.employee_id}"`;
        }
        alert(msg);
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
                    <div className="flex gap-2">
                         <button onClick={handleDebug} className="flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors">
                            <Bug className="w-4 h-4"/> فحص البيانات
                        </button>
                        <div className="text-sm font-bold text-gray-500 pt-1">محدد: {selectedIds.length}</div>
                    </div>
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
