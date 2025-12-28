import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Send, CheckSquare, Square, Filter, Loader2, Mail } from 'lucide-react';
import emailjs from '@emailjs/browser';

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

    useEffect(() => {
        emailjs.init(PUBLIC_KEY);
        fetchData();
    }, []);

    const fetchData = async () => {
        const { data: emps } = await supabase.from('employees').select('*').order('name');
        const { data: sett } = await supabase.from('general_settings').select('*').single();
        if (emps) setEmployees(emps);
        if (sett) setSettings(sett);
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

    // --- دالة توليد HTML (تم تحسين منطق البيانات) ---
    const generateEmailHTML = (emp: Employee, attendance: AttendanceRecord[], leaves: LeaveRequest[], monthStr: string) => {
        const daysInMonth = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
        let rowsHTML = '';
        
        // المتغيرات الحسابية
        let totalPresent = 0;
        let totalAbsent = 0;
        let totalLate = 0;
        let totalLeaves = 0;
        let totalHours = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dayString = String(d).padStart(2, '0');
            const dayDate = `${monthStr}-${dayString}`; // YYYY-MM-DD
            const dateObj = new Date(dayDate);
            const isFriday = dateObj.getDay() === 5;
            
            // البحث عن سجل الحضور (مع تنظيف المسافات)
            const att = attendance.find(a => a.date.trim() === dayDate);
            
            // البحث عن الإجازات
            const leave = leaves.find(l => 
                l.status === 'مقبول' && 
                l.start_date <= dayDate && 
                l.end_date >= dayDate
            );

            let status = 'غياب';
            let inTime = '--:--';
            let outTime = '--:--';
            let workHours = 0;
            let rowColor = '#fff0f0'; // أحمر فاتح للغياب

            if (att) {
                // حالة الحضور
                status = 'حضور';
                rowColor = '#f0fff4'; // أخضر فاتح
                
                // معالجة التوقيتات بدقة
                // نفترض أن التوقيتات تأتي "08:00 14:00" أو "08:00:00"
                const times = att.times.replace(/\s+/g, ' ').trim().split(' ').filter(t => t.includes(':'));
                
                if (times.length > 0) {
                    inTime = times[0].slice(0, 5); // نأخذ أول 5 خانات HH:MM
                }
                if (times.length > 1) {
                    outTime = times[times.length - 1].slice(0, 5);
                }

                // حساب ساعات العمل
                if (inTime !== '--:--' && outTime !== '--:--') {
                    const [h1, m1] = inTime.split(':').map(Number);
                    const [h2, m2] = outTime.split(':').map(Number);
                    const d1 = new Date(0, 0, 0, h1, m1);
                    const d2 = new Date(0, 0, 0, h2, m2);
                    let diffMs = d2.getTime() - d1.getTime();
                    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // لو الورديات متداخلة
                    workHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
                }

                // حساب التأخير (بعد 8:30)
                const [ih, im] = inTime.split(':').map(Number);
                if (!isNaN(ih)) {
                     if (ih > 8 || (ih === 8 && im > 30)) totalLate++;
                }

                totalPresent++;
                totalHours += workHours;

            } else if (leave) {
                status = `إجازة (${leave.type})`;
                rowColor = '#fff7ed'; // برتقالي
                totalLeaves++;
            } else if (isFriday) {
                status = 'عطلة أسبوعية';
                rowColor = '#f9fafb';
            } else {
                totalAbsent++;
            }

            rowsHTML += `
                <tr style="background-color: ${rowColor}; border-bottom: 1px solid #ddd;">
                    <td style="padding: 8px; border: 1px solid #eee;">${dayDate}</td>
                    <td style="padding: 8px; border: 1px solid #eee;">${inTime}</td>
                    <td style="padding: 8px; border: 1px solid #eee;">${status}</td>
                    <td style="padding: 8px; border: 1px solid #eee;">${outTime}</td>
                    <td style="padding: 8px; border: 1px solid #eee;">${workHours > 0 ? workHours + ' س' : '-'}</td>
                </tr>
            `;
        }

        const requestsHTML = leaves.map(l => `
            <li style="margin-bottom: 5px; padding: 5px; background: #f8f9fa; border-radius: 4px;">
                <strong>${l.type}</strong> (${l.start_date} إلى ${l.end_date}) - <span style="color: ${l.status==='مقبول'?'green':'red'}">${l.status}</span>
            </li>
        `).join('') || '<li style="color:#aaa">لا توجد طلبات مسجلة</li>';

        let linksHTML = '';
        if (settings?.links_names && settings?.links_urls) {
            linksHTML = settings.links_names.map((name:string, i:number) => {
                if(!name || !settings.links_urls[i]) return '';
                return `
                <a href="${settings.links_urls[i]}" target="_blank" style="display: block; margin: 8px 0; padding: 10px; background: #ecfdf5; color: #059669; text-decoration: none; font-weight: bold; border-radius: 6px; text-align: center; border: 1px solid #a7f3d0;">
                   🔗 ${name}
                </a>
            `}).join('');
        }

        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
                    .container { max-width: 600px; margin: 20px auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
                    .header { background: #059669; color: white; padding: 30px 20px; text-align: center; }
                    .section { padding: 20px; border-bottom: 1px solid #f3f4f6; }
                    .section-title { font-size: 16px; font-weight: bold; color: #059669; margin-bottom: 15px; border-right: 4px solid #059669; padding-right: 10px; }
                    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; color: #374151; border-bottom: 1px dashed #eee; padding-bottom: 4px; }
                    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; margin-bottom: 10px; }
                    .stat-box { padding: 10px; border-radius: 8px; font-weight: bold; font-size: 13px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2 style="margin:0; font-size: 24px;">تقرير شهر ${monthStr}</h2>
                        <p style="margin:10px 0 0; opacity: 0.9;">${emp.name}</p>
                        <p style="margin:5px 0 0; font-size: 12px; opacity: 0.8;">${settings?.center_name || 'المركز الطبي'}</p>
                    </div>

                    <div class="section">
                        <div class="section-title">البيانات الشخصية</div>
                        <div class="info-row"><span>الرقم الوظيفي:</span> <strong>${emp.employee_id}</strong></div>
                        <div class="info-row"><span>الرقم القومي:</span> <strong>${emp.national_id}</strong></div>
                        <div class="info-row"><span>الهاتف:</span> <strong>${emp.phone}</strong></div>
                        <div class="info-row"><span>البريد:</span> <strong>${emp.email}</strong></div>
                        <div class="info-row"><span>المهام الإدارية:</span> <strong>${emp.admin_tasks || '-'}</strong></div>
                    </div>

                    <div class="section">
                        <div class="section-title">ملخص الأداء</div>
                        <div class="stats-grid">
                            <div class="stat-box" style="background:#ecfdf5; color:#065f46">حضور: ${totalPresent}</div>
                            <div class="stat-box" style="background:#fef2f2; color:#991b1b">غياب: ${totalAbsent}</div>
                            <div class="stat-box" style="background:#fff7ed; color:#9a3412">إجازات: ${totalLeaves}</div>
                        </div>
                        <div class="stats-grid" style="margin-bottom:0">
                            <div class="stat-box" style="background:#eff6ff; color:#1e40af">ساعات: ${totalHours.toFixed(1)}</div>
                            <div class="stat-box" style="background:#fdf4ff; color:#86198f">تأخير: ${totalLate}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">سجل الحضور اليومي</div>
                        <div style="overflow-x: auto;">
                            <table>
                                <thead style="background: #f9fafb; color: #4b5563;">
                                    <tr><th>التاريخ</th><th>دخول</th><th>الحالة</th><th>خروج</th><th>ساعات</th></tr>
                                </thead>
                                <tbody>${rowsHTML}</tbody>
                            </table>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">سجل الطلبات</div>
                        <ul style="list-style: none; padding: 0; margin: 0; font-size: 13px;">${requestsHTML}</ul>
                    </div>

                    ${linksHTML ? `
                    <div class="section" style="background: #f0fdf4;">
                        <div class="section-title">روابط هامة للموظفين</div>
                        ${linksHTML}
                    </div>
                    ` : ''}
                </div>
            </body>
            </html>
        `;
    };

    const handleSendReports = async () => {
        if (selectedIds.length === 0) return alert('الرجاء اختيار موظف واحد على الأقل');
        if (!confirm(`سيتم إرسال التقارير إلى ${selectedIds.length} موظف. هل أنت متأكد؟`)) return;

        setSending(true);
        let successCount = 0;
        let failCount = 0;

        try {
            const startOfMonth = `${month}-01`;
            const endOfMonth = `${month}-31`;

            // جلب البيانات مع التأكد من صيغة التاريخ
            const { data: allAttendance } = await supabase.from('attendance')
                .select('*')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

            const { data: allLeaves } = await supabase.from('leave_requests')
                .select('*');

            // --- فحص سريع (Debug) ---
            // هذا التنبيه سيظهر لك لمرة واحدة لتتأكد أن البيانات وصلت
            if (allAttendance && allAttendance.length > 0) {
                 // alert(`DEBUG: تم جلب ${allAttendance.length} سجل بصمة للشهر ${month}`);
            } else {
                 alert(`تنبيه: لم يتم العثور على أي سجلات بصمة للشهر ${month} في قاعدة البيانات! تأكد من وجود بصمات لهذا الشهر.`);
            }

            for (const empId of selectedIds) {
                const emp = employees.find(e => e.id === empId);
                
                if (!emp || !emp.email) {
                    failCount++;
                    continue;
                }

                // الفلترة الدقيقة باستخدام trim للتخلص من أي مسافات زائدة قد تسبب عدم التطابق
                const empAtt = allAttendance?.filter(a => String(a.employee_id).trim() === String(emp.employee_id).trim()) || [];
                const empLeaves = allLeaves?.filter(l => String(l.employee_id).trim() === String(emp.employee_id).trim()) || [];
                
                // تنبيه إذا كان الموظف ليس له حضور رغم وجود بصمات عامة
                // if (empAtt.length === 0) console.warn(`No attendance found for ${emp.name} (ID: ${emp.employee_id})`);

                const htmlContent = generateEmailHTML(emp, empAtt, empLeaves, month);
                const subject = `تقرير شهر ${month} - ${emp.name}`;

                try {
                    await emailjs.send(
                        SERVICE_ID,
                        TEMPLATE_ID,
                        {
                            to_email: emp.email,
                            subject: subject,
                            message: htmlContent
                        },
                        PUBLIC_KEY
                    );
                    successCount++;
                } catch (err: any) {
                    console.error(`Failed to send to ${emp.name}`, err);
                    failCount++;
                }
            }
            alert(`اكتملت العملية:\n✅ تم الإرسال بنجاح: ${successCount}\n❌ فشل الإرسال: ${failCount}`);
        } catch (e: any) {
            alert('حدث خطأ عام: ' + e.message);
        } finally {
            setSending(false);
            setSelectedIds([]);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <Mail className="text-emerald-600"/> إرسال التقارير البريدية
            </h2>

            {/* أدوات التحكم */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input type="month" label="شهر التقرير" value={month} onChange={setMonth} />
                <Select label="فلتر التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
                <Select label="فلتر الحالة" options={['all', 'نشط', 'موقوف']} value={fStatus} onChange={setFStatus} />
                <Input label="بحث بالكود" value={fId} onChange={setFId} placeholder="كود الموظف..." />
            </div>

            {/* جدول الاختيار */}
            <div className="bg-white rounded-[30px] border shadow-sm overflow-hidden min-h-[400px] mb-20">
                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <button onClick={toggleSelectAll} className="flex items-center gap-2 font-bold text-gray-600 hover:text-emerald-600">
                        {selectedIds.length === filteredEmployees.length && filteredEmployees.length > 0 ? <CheckSquare className="w-5 h-5"/> : <Square className="w-5 h-5"/>}
                        تحديد الكل ({filteredEmployees.length})
                    </button>
                    <div className="text-sm font-bold text-gray-500">تم اختيار: {selectedIds.length}</div>
                </div>

                <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 font-black text-gray-600 sticky top-0">
                            <tr>
                                <th className="p-4 w-10"></th>
                                <th className="p-4">الكود</th>
                                <th className="p-4">الاسم</th>
                                <th className="p-4">البريد الإلكتروني</th>
                                <th className="p-4 text-center">الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className={`border-b hover:bg-emerald-50 cursor-pointer transition-colors ${selectedIds.includes(emp.id) ? 'bg-emerald-50' : ''}`} onClick={() => toggleSelect(emp.id)}>
                                    <td className="p-4">
                                        {selectedIds.includes(emp.id) ? <CheckSquare className="w-5 h-5 text-emerald-600"/> : <Square className="w-5 h-5 text-gray-300"/>}
                                    </td>
                                    <td className="p-4 font-mono font-bold">{emp.employee_id}</td>
                                    <td className="p-4 font-bold">{emp.name}</td>
                                    <td className="p-4 text-gray-500 font-mono text-xs">{emp.email || <span className="text-red-400">لا يوجد بريد</span>}</td>
                                    <td className="p-4 text-center">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${emp.status==='نشط'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{emp.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* زر الإرسال العائم */}
            <div className="fixed bottom-8 left-8 z-50">
                <button 
                    onClick={handleSendReports} 
                    disabled={sending || selectedIds.length === 0}
                    className="bg-emerald-800 text-white px-8 py-4 rounded-2xl font-black shadow-2xl hover:bg-emerald-900 transition-all flex items-center gap-3 disabled:bg-gray-400 disabled:shadow-none animate-in slide-in-from-bottom"
                >
                    {sending ? <Loader2 className="w-6 h-6 animate-spin"/> : <Send className="w-6 h-6"/>}
                    {sending ? `جاري الإرسال (${selectedIds.length})...` : `إرسال التقارير (${selectedIds.length})`}
                </button>
            </div>
        </div>
    );
}
