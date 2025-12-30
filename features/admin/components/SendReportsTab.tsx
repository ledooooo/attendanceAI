import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Send, CheckSquare, Square, Loader2, Mail, Bug } from 'lucide-react';
import emailjs from '@emailjs/browser';

// مصفوفة أيام الأسبوع للمطابقة مع قاعدة البيانات
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export default function SendReportsTab() {
    
    // --- إعدادات EmailJS ---
    const SERVICE_ID = "service_57p7vff"; 
    const TEMPLATE_ID = "template_uumarnn"; 
    const PUBLIC_KEY = "dBVlrOc_xTs91dlxW"; 

    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [sending, setSending] = useState(false);
    
    // فلاتر
    const [fSpec, setFSpec] = useState('all');
    const [fStatus, setFStatus] = useState('نشط');
    const [fId, setFId] = useState('');
    const [settings, setSettings] = useState<any>(null);

    // بيانات خام
    const [rawAttendance, setRawAttendance] = useState<AttendanceRecord[]>([]);
    const [rawLeaves, setRawLeaves] = useState<LeaveRequest[]>([]);

    useEffect(() => {
        emailjs.init(PUBLIC_KEY);
        fetchData();
    }, [month]); 

    const fetchData = async () => {
        const startOfMonth = `${month}-01`;
        const endOfMonth = `${month}-31`;

        const { data: emps } = await supabase.from('employees').select('*').order('name');
        const { data: sett } = await supabase.from('general_settings').select('*').single();
        
        const { data: att } = await supabase.from('attendance')
            .select('*')
            .gte('date', startOfMonth)
            .lte('date', endOfMonth);

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

    // دوال مساعدة
    const cleanId = (id: any) => String(id).trim();
    const cleanDate = (date: any) => String(date).substring(0, 10);

    // --- المنطق الذكي لتوليد HTML ---
    const generateEmailHTML = (emp: Employee, attendance: AttendanceRecord[], leaves: LeaveRequest[], monthStr: string) => {
        const daysInMonth = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
        let rowsHTML = '';
        
        // المتغيرات الإحصائية
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalLate = 0;
        let totalLeaves = 0;
        let totalHours = 0;

        // تحديد أيام العمل الخاصة بالموظف (إذا لم تكن محددة، نفترض السبت-الخميس)
        const workDays = emp.work_days && emp.work_days.length > 0 
            ? emp.work_days 
            : ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس"];

        // هل الموظف دوام جزئي؟ (أقل من 5 أيام عمل في الأسبوع)
        const isPartTime = workDays.length < 5;

        for (let d = 1; d <= daysInMonth; d++) {
            const dayString = String(d).padStart(2, '0');
            const targetDate = `${monthStr}-${dayString}`;
            const dateObj = new Date(targetDate);
            
            // تحديد اسم اليوم بالعربي (السبت، الأحد...)
            const dayNameAr = DAYS_AR[dateObj.getDay()];
            
            // هل هذا اليوم هو يوم عمل للموظف؟
            const isWorkDay = workDays.includes(dayNameAr);

            // البحث عن البيانات
            const att = attendance.find(a => cleanDate(a.date) === targetDate);
            const leave = leaves.find(l => l.status === 'مقبول' && l.start_date <= targetDate && l.end_date >= targetDate);

            // الحالة الافتراضية
            let status = 'غياب';
            let inTime = '--:--';
            let outTime = '--:--';
            let workHours = 0;
            let rowColor = '#fff1f2'; // أحمر فاتح (للغياب)

            // 1. حالة وجود بصمة (الأولوية للبصمة حتى في أيام العطلات)
            if (att) {
                status = isWorkDay ? 'حضور' : 'عمل إضافي/عطلة'; // تمييز العمل في الإجازة
                rowColor = isWorkDay ? '#f0fdf4' : '#e0f2fe'; // أخضر للعمل العادي، أزرق للإضافي
                
                const timeMatches = att.times.match(/\d{1,2}:\d{2}/g);
                if (timeMatches && timeMatches.length > 0) {
                    inTime = timeMatches[0];
                    if (timeMatches.length > 1) outTime = timeMatches[timeMatches.length - 1];
                }

                if (inTime !== '--:--' && outTime !== '--:--') {
                    const [h1, m1] = inTime.split(':').map(Number);
                    const [h2, m2] = outTime.split(':').map(Number);
                    let diffMs = new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime();
                    if (diffMs < 0) diffMs += 86400000;
                    workHours = parseFloat((diffMs / 3600000).toFixed(2));
                }

                // حساب التأخير فقط في أيام العمل الرسمية
                if (isWorkDay) {
                    const [ih, im] = inTime.split(':').map(Number);
                    if (!isNaN(ih) && (ih > 8 || (ih === 8 && im > 30))) totalLate++;
                }

                totalPresent++;
                totalHours += workHours;

            } 
            // 2. حالة وجود إجازة رسمية
            else if (leave) {
                status = `إجازة (${leave.type})`;
                rowColor = '#fff7ed'; // برتقالي
                totalLeaves++;
            } 
            // 3. حالة عدم وجود بصمة + ليس يوم عمل (الراحة الأسبوعية أو أيام عدم التواجد)
            else if (!isWorkDay) {
                status = isPartTime ? 'غير مطالب (جزء من الوقت)' : 'راحة أسبوعية';
                rowColor = '#f9fafb'; // رمادي فاتح
                inTime = '-';
                outTime = '-';
            }
            // 4. حالة غياب (يوم عمل + لا بصمة + لا إجازة)
            else {
                totalAbsent++;
                // يبقى اللون أحمر والحالة "غياب"
            }

            rowsHTML += `
                <tr style="background-color: ${rowColor}; border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">
                        ${targetDate} <br/> 
                        <span style="font-size:10px; color:#666">(${dayNameAr})</span>
                    </td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${inTime}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb; font-weight:bold;">${status}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${outTime}</td>
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${workHours > 0 ? workHours + ' س' : '-'}</td>
                </tr>
            `;
        }

        const requestsHTML = leaves.map(l => `
            <li style="margin-bottom: 8px; padding: 10px; background: #f8fafc; border-radius: 6px; border-right: 3px solid ${l.status==='مقبول'?'#22c55e':'#ef4444'};">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${l.type}</strong>
                    <span style="font-size:12px; background:${l.status==='مقبول'?'#dcfce7':'#fee2e2'}; color:${l.status==='مقبول'?'#15803d':'#991b1b'}; padding:2px 6px; rounded:4px;">${l.status}</span>
                </div>
                <div style="font-size:12px; color:#64748b; margin-top:4px;">من ${l.start_date} إلى ${l.end_date}</div>
            </li>
        `).join('') || '<li style="color:#94a3b8; font-style:italic;">لا توجد طلبات مسجلة</li>';

        let linksHTML = '';
        if (settings?.links_names && settings?.links_urls) {
            linksHTML = settings.links_names.map((name:string, i:number) => {
                if(!name || !settings.links_urls[i]) return '';
                return `
                <a href="${settings.links_urls[i]}" target="_blank" style="display: block; margin: 8px 0; padding: 12px; background: #ecfdf5; color: #047857; text-decoration: none; font-weight: bold; border-radius: 8px; text-align: center; border: 1px solid #6ee7b7;">
                   🔗 ${name}
                </a>
            `}).join('');
        }

        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; }
                    .container { max-width: 650px; margin: 20px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
                    .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px 20px; text-align: center; }
                    .section { padding: 25px; border-bottom: 1px solid #f1f5f9; }
                    .section-title { font-size: 18px; font-weight: 800; color: #0f766e; margin-bottom: 15px; border-right: 4px solid #0d9488; padding-right: 12px; display:inline-block; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; }
                    .info-item { background: #f8fafc; padding: 8px 12px; border-radius: 6px; }
                    .stats-container { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
                    .stat-card { flex: 1; min-width: 100px; padding: 15px; border-radius: 10px; text-align: center; }
                    .stat-val { font-size: 20px; font-weight: 900; display: block; margin-bottom: 4px; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: center; }
                    th { background: #f1f5f9; color: #475569; padding: 12px; font-weight: 800; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2 style="margin:0; font-size: 24px;">تقرير شهر ${monthStr}</h2>
                        <p style="margin:8px 0 0; opacity: 0.9;">${emp.name}</p>
                        <p style="margin:4px 0 0; font-size: 13px; opacity: 0.8;">${settings?.center_name || 'المركز الطبي'}</p>
                    </div>

                    <div class="section">
                        <div class="section-title">إحصائيات العمل</div>
                        <div class="stats-container">
                            <div class="stat-card" style="background:#ecfdf5; color:#065f46"><span class="stat-val">${totalPresent}</span> يوم حضور</div>
                            <div class="stat-card" style="background:#fef2f2; color:#991b1b"><span class="stat-val">${totalAbsent}</span> يوم غياب</div>
                            <div class="stat-card" style="background:#fff7ed; color:#9a3412"><span class="stat-val">${totalLeaves}</span> إجازة</div>
                            <div class="stat-card" style="background:#eff6ff; color:#1e40af"><span class="stat-val">${totalHours.toFixed(1)}</span> ساعة عمل</div>
                        </div>
                         <div style="margin-top:10px; text-align:center; font-size:12px; color:#64748b;">تأخيرات: <strong style="color:#dc2626">${totalLate}</strong></div>
                    </div>

                    <div class="section">
                        <div class="section-title">سجل الحضور والانصراف</div>
                        <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table>
                                <thead><tr><th>التاريخ</th><th>دخول</th><th>الحالة</th><th>خروج</th><th>ساعات</th></tr></thead>
                                <tbody>${rowsHTML}</tbody>
                            </table>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">الطلبات والتحركات</div>
                        <ul style="list-style: none; padding: 0; margin: 0;">${requestsHTML}</ul>
                    </div>

                    ${linksHTML ? `<div class="section" style="background: #f0fdf4;"><div class="section-title">روابط هامة</div>${linksHTML}</div>` : ''}

                    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 11px; background:#f8fafc;">
                        تم استخراج التقرير آلياً.
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    const handleSendReports = async () => {
        if (selectedIds.length === 0) return alert('اختر موظفاً واحداً على الأقل');
        if (!confirm(`إرسال ${selectedIds.length} تقرير؟`)) return;
        
        setSending(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const empId of selectedIds) {
                const emp = employees.find(e => e.id === empId);
                if (!emp || !emp.email) { failCount++; continue; }

                const empAtt = rawAttendance.filter(a => cleanId(a.employee_id) === cleanId(emp.employee_id));
                const empLeaves = rawLeaves.filter(l => cleanId(l.employee_id) === cleanId(emp.employee_id));

                const htmlContent = generateEmailHTML(emp, empAtt, empLeaves, month);
                const subject = `تقرير شهر ${month} - ${emp.name}`;

                try {
                    await emailjs.send(SERVICE_ID, TEMPLATE_ID, {
                        to_email: emp.email,
                        subject: subject,
                        message: htmlContent
                    }, PUBLIC_KEY);
                    successCount++;
                } catch (err: any) {
                    console.error(`EmailJS Error:`, err);
                    failCount++;
                }
            }
            alert(`النتيجة:\n✅ تم الإرسال: ${successCount}\n❌ فشل: ${failCount}`);
        } catch (e: any) {
            alert('خطأ غير متوقع: ' + e.message);
        } finally {
            setSending(false);
            setSelectedIds([]);
        }
    };

    const handleDebug = () => {
        if (selectedIds.length === 0) return alert("اختر موظفاً واحداً للفحص");
        const emp = employees.find(e => e.id === selectedIds[0]);
        if (!emp) return;
        
        const workDays = emp.work_days && emp.work_days.length > 0 
            ? emp.work_days.join('، ') 
            : "الافتراضي (السبت - الخميس)";

        alert(`الموظف: ${emp.name}\nأيام العمل: ${workDays}`);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Mail className="text-emerald-600"/> إرسال التقارير البريدية</h2>
            
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
                         <button onClick={handleDebug} className="text-xs bg-amber-100 text-amber-700 px-3 py-2 rounded-lg font-bold hover:bg-amber-200 flex items-center gap-1 border border-amber-200">
                            <Bug className="w-4 h-4"/> فحص الجدول
                        </button>
                        <div className="text-sm font-bold text-gray-500 pt-2">محدد: {selectedIds.length}</div>
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
                                    <td className="p-4 text-center text-xs">
                                        {emp.work_days && emp.work_days.length > 0 
                                            ? (emp.work_days.length < 5 ? 'جزئي (' + emp.work_days.length + ')' : 'كامل') 
                                            : 'افتراضي'}
                                    </td>
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
