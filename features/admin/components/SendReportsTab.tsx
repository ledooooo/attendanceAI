import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Send, CheckSquare, Square, Loader2, Mail } from 'lucide-react';
import emailjs from '@emailjs/browser';

export default function SendReportsTab() {
    // --- بيانات الاعتماد الخاصة بك ---
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

    // --- دالة توليد HTML (تم تحسين دقة البيانات) ---
    const generateEmailHTML = (emp: Employee, attendance: AttendanceRecord[], leaves: LeaveRequest[], monthStr: string) => {
        const daysInMonth = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
        let rowsHTML = '';
        
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
            
            // المطابقة الدقيقة: إزالة المسافات ومقارنة النصوص
            const att = attendance.find(a => String(a.date).trim() === dayDate);
            
            const leave = leaves.find(l => 
                l.status === 'مقبول' && 
                l.start_date <= dayDate && 
                l.end_date >= dayDate
            );

            let status = 'غياب';
            let inTime = '--:--';
            let outTime = '--:--';
            let workHours = 0;
            let rowColor = '#fff1f2'; // أحمر فاتح جداً

            if (att) {
                status = 'حضور';
                rowColor = '#f0fdf4'; // أخضر فاتح
                
                // معالجة التوقيتات: تنظيف النص من المسافات الزائدة واستخراج الأوقات
                // يدعم الصيغ: "08:00 14:00" أو "08:00:00" أو مسافات متعددة
                const times = att.times.replace(/\s+/g, ' ').trim().split(' ').filter(t => t.includes(':'));
                
                if (times.length > 0) {
                    inTime = times[0].slice(0, 5); // HH:MM
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
                    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
                    workHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
                }

                // حساب التأخير (بعد 8:15 مثلاً أو حسب الإعدادات، هنا افتراضياً 8:30)
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
                rowColor = '#f9fafb'; // رمادي
            } else {
                totalAbsent++;
            }

            rowsHTML += `
                <tr style="background-color: ${rowColor}; border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 10px; border: 1px solid #e5e7eb;">${dayDate}</td>
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
        `).join('') || '<li style="color:#94a3b8; font-style:italic;">لا توجد طلبات أو تحركات مسجلة</li>';

        // قسم الروابط الهامة
        let linksHTML = '';
        if (settings?.links_names && settings?.links_urls) {
            linksHTML = settings.links_names.map((name:string, i:number) => {
                if(!name || !settings.links_urls[i]) return '';
                return `
                <a href="${settings.links_urls[i]}" target="_blank" style="display: block; margin: 8px 0; padding: 12px; background: #ecfdf5; color: #047857; text-decoration: none; font-weight: bold; border-radius: 8px; text-align: center; border: 1px solid #6ee7b7; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                   🔗 ${name}
                </a>
            `}).join('');
        }

        // --- هيكل الإيميل النهائي ---
        return `
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap');
                    body { font-family: 'Cairo', sans-serif; background-color: #f1f5f9; margin: 0; padding: 0; }
                    .container { max-width: 650px; margin: 20px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
                    .header { background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 30px 20px; text-align: center; }
                    .section { padding: 25px; border-bottom: 1px solid #f1f5f9; }
                    .section-title { font-size: 18px; font-weight: 800; color: #0f766e; margin-bottom: 15px; border-right: 4px solid #0d9488; padding-right: 12px; display:inline-block; }
                    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 14px; }
                    .info-item { background: #f8fafc; padding: 8px 12px; border-radius: 6px; }
                    .stats-container { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
                    .stat-card { flex: 1; min-width: 100px; padding: 15px; border-radius: 10px; text-align: center; }
                    .stat-val { font-size: 20px; font-weight: 900; display: block; margin-bottom: 4px; }
                    .stat-label { font-size: 12px; font-weight: bold; opacity: 0.9; }
                    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: center; }
                    th { background: #f1f5f9; color: #475569; padding: 12px; font-weight: 800; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h2 style="margin:0; font-size: 24px; font-weight: 900;">تقرير الأداء الشهري</h2>
                        <p style="margin:8px 0 0; opacity: 0.9; font-size: 16px;">${monthStr}</p>
                        <p style="margin:4px 0 0; font-size: 13px; opacity: 0.8;">${settings?.center_name || 'المركز الطبي'}</p>
                    </div>

                    <div class="section">
                        <div class="section-title">بيانات الموظف</div>
                        <div class="info-grid">
                            <div class="info-item">👤 <strong>الاسم:</strong> ${emp.name}</div>
                            <div class="info-item">🆔 <strong>الكود:</strong> ${emp.employee_id}</div>
                            <div class="info-item">💼 <strong>التخصص:</strong> ${emp.specialty}</div>
                            <div class="info-item">🪪 <strong>الرقم القومي:</strong> ${emp.national_id}</div>
                            <div class="info-item">📱 <strong>الهاتف:</strong> ${emp.phone}</div>
                            <div class="info-item">📋 <strong>المهام:</strong> ${emp.admin_tasks || 'غير محدد'}</div>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">إحصائيات العمل</div>
                        <div class="stats-container">
                            <div class="stat-card" style="background:#ecfdf5; color:#065f46">
                                <span class="stat-val">${totalPresent}</span>
                                <span class="stat-label">يوم حضور</span>
                            </div>
                            <div class="stat-card" style="background:#fef2f2; color:#991b1b">
                                <span class="stat-val">${totalAbsent}</span>
                                <span class="stat-label">يوم غياب</span>
                            </div>
                            <div class="stat-card" style="background:#fff7ed; color:#9a3412">
                                <span class="stat-val">${totalLeaves}</span>
                                <span class="stat-label">إجازة</span>
                            </div>
                            <div class="stat-card" style="background:#eff6ff; color:#1e40af">
                                <span class="stat-val">${totalHours.toFixed(1)}</span>
                                <span class="stat-label">ساعة عمل</span>
                            </div>
                        </div>
                         <div style="margin-top:10px; text-align:center; font-size:12px; color:#64748b;">
                            عدد مرات التأخير: <strong style="color:#dc2626">${totalLate}</strong>
                         </div>
                    </div>

                    <div class="section">
                        <div class="section-title">سجل الحضور والانصراف</div>
                        <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table>
                                <thead>
                                    <tr><th>التاريخ</th><th>دخول</th><th>الحالة</th><th>خروج</th><th>ساعات</th></tr>
                                </thead>
                                <tbody>${rowsHTML}</tbody>
                            </table>
                        </div>
                    </div>

                    <div class="section">
                        <div class="section-title">الطلبات والتحركات</div>
                        <ul style="list-style: none; padding: 0; margin: 0;">${requestsHTML}</ul>
                    </div>

                    ${linksHTML ? `
                    <div class="section" style="background: #f0fdf4;">
                        <div class="section-title">روابط وخدمات هامة</div>
                        ${linksHTML}
                    </div>
                    ` : ''}

                    <div style="text-align: center; padding: 20px; color: #94a3b8; font-size: 11px; background:#f8fafc;">
                        تم استخراج هذا التقرير من النظام الذكي لإدارة الموارد البشرية.<br>
                        يرجى مراجعة إدارة الموارد البشرية في حال وجود استفسارات.
                    </div>
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

            // جلب البيانات دفعة واحدة للشهر المحدد
            const { data: allAttendance } = await supabase.from('attendance')
                .select('*').gte('date', startOfMonth).lte('date', endOfMonth);

            const { data: allLeaves } = await supabase.from('leave_requests')
                .select('*'); // جلب كل الطلبات لتصفيتها لاحقاً

            for (const empId of selectedIds) {
                const emp = employees.find(e => e.id === empId);
                
                if (!emp || !emp.email) {
                    failCount++;
                    continue;
                }

                // المطابقة الدقيقة: تحويل الـ IDs لنصوص وتنظيف المسافات
                const empAtt = allAttendance?.filter(a => String(a.employee_id).trim() === String(emp.employee_id).trim()) || [];
                const empLeaves = allLeaves?.filter(l => String(l.employee_id).trim() === String(emp.employee_id).trim()) || [];
                
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
            alert(`التقرير النهائي:\n✅ تم الإرسال: ${successCount}\n❌ فشل: ${failCount}`);
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

            <div className="bg-white p-6 rounded-[30px] border shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input type="month" label="شهر التقرير" value={month} onChange={setMonth} />
                <Select label="فلتر التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
                <Select label="فلتر الحالة" options={['all', 'نشط', 'موقوف']} value={fStatus} onChange={setFStatus} />
                <Input label="بحث بالكود" value={fId} onChange={setFId} placeholder="كود الموظف..." />
            </div>

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
