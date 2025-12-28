import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Send, CheckSquare, Square, Loader2, Mail } from 'lucide-react';

export default function SendReportsTab() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [sending, setSending] = useState(false);
    
    // فلاتر
    const [fSpec, setFSpec] = useState('all');
    const [fStatus, setFStatus] = useState('نشط');
    const [fId, setFId] = useState('');
    const [settings, setSettings] = useState<any>(null);

    useEffect(() => { fetchData(); }, []);

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

    // --- توليد HTML ---
    const generateEmailHTML = (emp: Employee, attendance: AttendanceRecord[], leaves: LeaveRequest[], monthStr: string) => {
        const daysInMonth = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
        let rowsHTML = '';
        let totalPresent=0, totalAbsent=0, totalLate=0, totalLeaves=0, totalHours=0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dayString = String(d).padStart(2, '0');
            const dayDate = `${monthStr}-${dayString}`;
            const dateObj = new Date(dayDate);
            const isFriday = dateObj.getDay() === 5;
            
            // Trim Data
            const att = attendance.find(a => String(a.date).trim() === dayDate);
            const leave = leaves.find(l => l.status === 'مقبول' && l.start_date <= dayDate && l.end_date >= dayDate);

            let status = 'غياب', inTime = '--:--', outTime = '--:--', workHours = 0, rowColor = '#fff1f2';

            if (att) {
                status = 'حضور'; rowColor = '#f0fdf4';
                const times = att.times.replace(/\s+/g, ' ').trim().split(' ').filter(t => t.includes(':'));
                if (times.length > 0) inTime = times[0].slice(0, 5);
                if (times.length > 1) outTime = times[times.length - 1].slice(0, 5);
                if (inTime !== '--:--' && outTime !== '--:--') {
                    const [h1, m1] = inTime.split(':').map(Number);
                    const [h2, m2] = outTime.split(':').map(Number);
                    let diffMs = new Date(0,0,0,h2,m2).getTime() - new Date(0,0,0,h1,m1).getTime();
                    if (diffMs < 0) diffMs += 86400000;
                    workHours = parseFloat((diffMs / 3600000).toFixed(2));
                }
                const [ih, im] = inTime.split(':').map(Number);
                if (!isNaN(ih) && (ih > 8 || (ih === 8 && im > 30))) totalLate++;
                totalPresent++; totalHours += workHours;
            } else if (leave) {
                status = `إجازة (${leave.type})`; rowColor = '#fff7ed'; totalLeaves++;
            } else if (isFriday) {
                status = 'عطلة أسبوعية'; rowColor = '#f9fafb';
            } else {
                totalAbsent++;
            }
            rowsHTML += `<tr style="background-color:${rowColor};border-bottom:1px solid #e5e7eb;"><td style="padding:10px;border:1px solid #e5e7eb;">${dayDate}</td><td style="padding:10px;border:1px solid #e5e7eb;">${inTime}</td><td style="padding:10px;border:1px solid #e5e7eb;font-weight:bold;">${status}</td><td style="padding:10px;border:1px solid #e5e7eb;">${outTime}</td><td style="padding:10px;border:1px solid #e5e7eb;">${workHours>0?workHours+' س':'-'}</td></tr>`;
        }

        const requestsHTML = leaves.map(l => `<li style="margin-bottom:8px;padding:10px;background:#f8fafc;border-radius:6px;border-right:3px solid ${l.status==='مقبول'?'#22c55e':'#ef4444'};"><div style="display:flex;justify-content:space-between;"><strong>${l.type}</strong><span style="font-size:12px;background:${l.status==='مقبول'?'#dcfce7':'#fee2e2'};color:${l.status==='مقبول'?'#15803d':'#991b1b'};padding:2px 6px;rounded:4px;">${l.status}</span></div><div style="font-size:12px;color:#64748b;margin-top:4px;">من ${l.start_date} إلى ${l.end_date}</div></li>`).join('') || '<li style="color:#94a3b8;font-style:italic;">لا توجد طلبات</li>';

        let linksHTML = '';
        if (settings?.links_names && settings?.links_urls) {
            linksHTML = settings.links_names.map((name:string, i:number) => {
                if(!name || !settings.links_urls[i]) return '';
                return `<a href="${settings.links_urls[i]}" target="_blank" style="display:block;margin:8px 0;padding:12px;background:#ecfdf5;color:#047857;text-decoration:none;font-weight:bold;border-radius:8px;text-align:center;border:1px solid #6ee7b7;">🔗 ${name}</a>`
            }).join('');
        }

        return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><style>body{font-family:'Cairo',sans-serif;background-color:#f1f5f9;margin:0;padding:0}.container{max-width:650px;margin:20px auto;background:white;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#059669;color:white;padding:30px;text-align:center}.section{padding:25px;border-bottom:1px solid #f1f5f9}.section-title{font-size:18px;font-weight:bold;color:#0f766e;margin-bottom:15px;border-right:4px solid #0d9488;padding-right:12px}table{width:100%;border-collapse:collapse;font-size:13px;text-align:center}th{background:#f1f5f9;padding:12px}.stat-box{padding:10px;border-radius:8px;text-align:center;font-weight:bold}</style></head><body><div class="container"><div class="header"><h2 style="margin:0">تقرير ${monthStr}</h2><p>${emp.name}</p><p style="font-size:12px">${settings?.center_name||''}</p></div><div class="section"><div class="section-title">ملخص الأداء</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px"><div class="stat-box" style="background:#ecfdf5;color:#065f46">${totalPresent} حضور</div><div class="stat-box" style="background:#fef2f2;color:#991b1b">${totalAbsent} غياب</div><div class="stat-box" style="background:#fff7ed;color:#9a3412">${totalLeaves} إجازة</div><div class="stat-box" style="background:#eff6ff;color:#1e40af">${totalHours.toFixed(1)} س</div></div><div style="text-align:center;margin-top:10px;font-size:12px">تأخيرات: ${totalLate}</div></div><div class="section"><div class="section-title">السجل اليومي</div><div style="overflow-x:auto"><table><thead><tr><th>التاريخ</th><th>دخول</th><th>الحالة</th><th>خروج</th><th>ساعات</th></tr></thead><tbody>${rowsHTML}</tbody></table></div></div><div class="section"><div class="section-title">الطلبات</div><ul style="list-style:none;padding:0">${requestsHTML}</ul></div>${linksHTML ? `<div class="section"><div class="section-title">روابط هامة</div>${linksHTML}</div>` : ''}</div></body></html>`;
    };

    // --- الاتصال بالخادم الآمن ---
    const sendReport = async (toEmail: string, toName: string, subject: string, htmlContent: string) => {
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toEmail, toName, subject, htmlContent })
            });
            const data = await response.json();
            if (!response.ok) {
                console.error('Server Error:', data);
                // هذا التنبيه سيظهر لك سبب الخطأ الحقيقي القادم من Brevo
                alert(`فشل الإرسال لـ ${toName}:\n${data.error}\n${JSON.stringify(data.details)}`);
                return false;
            }
            return true;
        } catch (error: any) {
            console.error('Fetch Error:', error);
            alert(`خطأ في الاتصال: ${error.message}`);
            return false;
        }
    };

    const handleSendReports = async () => {
        if (selectedIds.length === 0) return alert('اختر موظفاً واحداً على الأقل');
        if (!confirm(`إرسال ${selectedIds.length} تقرير؟`)) return;
        
        setSending(true);
        let successCount = 0;
        let failCount = 0;

        try {
            const startOfMonth = `${month}-01`;
            const endOfMonth = `${month}-31`;

            const { data: allAttendance } = await supabase.from('attendance').select('*').gte('date', startOfMonth).lte('date', endOfMonth);
            const { data: allLeaves } = await supabase.from('leave_requests').select('*');

            for (const empId of selectedIds) {
                const emp = employees.find(e => e.id === empId);
                if (!emp || !emp.email) { failCount++; continue; }

                const empAtt = allAttendance?.filter(a => String(a.employee_id).trim() === String(emp.employee_id).trim()) || [];
                const empLeaves = allLeaves?.filter(l => String(l.employee_id).trim() === String(emp.employee_id).trim()) || [];

                const htmlContent = generateEmailHTML(emp, empAtt, empLeaves, month);
                const subject = `تقرير شهر ${month} - ${emp.name}`;

                const sent = await sendReport(emp.email, emp.name, subject, htmlContent);
                if (sent) successCount++; else failCount++;
            }
            alert(`التقرير:\n✅ تم الإرسال: ${successCount}\n❌ فشل: ${failCount}`);
        } catch (e: any) {
            alert('خطأ: ' + e.message);
        } finally {
            setSending(false);
            setSelectedIds([]);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Mail className="text-emerald-600"/> إرسال التقارير (Brevo API)</h2>
            
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
                    <div className="text-sm font-bold text-gray-500">محدد: {selectedIds.length}</div>
                </div>
                <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 font-black text-gray-600 sticky top-0">
                            <tr><th className="p-4 w-10"></th><th className="p-4">الكود</th><th className="p-4">الاسم</th><th className="p-4">البريد</th><th className="p-4 text-center">الحالة</th></tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className={`border-b hover:bg-emerald-50 cursor-pointer ${selectedIds.includes(emp.id)?'bg-emerald-50':''}`} onClick={()=>toggleSelect(emp.id)}>
                                    <td className="p-4">{selectedIds.includes(emp.id)?<CheckSquare className="w-5 h-5 text-emerald-600"/>:<Square className="w-5 h-5 text-gray-300"/>}</td>
                                    <td className="p-4 font-mono font-bold">{emp.employee_id}</td>
                                    <td className="p-4 font-bold">{emp.name}</td>
                                    <td className="p-4 text-xs font-mono text-gray-500">{emp.email||'-'}</td>
                                    <td className="p-4 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${emp.status==='نشط'?'bg-green-100 text-green-700':'bg-red-100 text-red-700'}`}>{emp.status}</span></td>
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
