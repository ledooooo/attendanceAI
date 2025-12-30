import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, AttendanceRecord, LeaveRequest } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { Send, CheckSquare, Square, Loader2, Mail, Bug } from 'lucide-react';

// مصفوفة أيام الأسبوع
const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

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

    // --- HTML Generator ---
    const generateEmailHTML = (emp: Employee, attendance: AttendanceRecord[], leaves: LeaveRequest[], monthStr: string) => {
        const daysInMonth = new Date(parseInt(monthStr.split('-')[0]), parseInt(monthStr.split('-')[1]), 0).getDate();
        let rowsHTML = '';
        let totalPresent=0, totalAbsent=0, totalLate=0, totalLeaves=0, totalHours=0;

        for (let d = 1; d <= daysInMonth; d++) {
            const dayString = String(d).padStart(2, '0');
            const targetDate = `${monthStr}-${dayString}`;
            const dateObj = new Date(targetDate);
            const isFriday = dateObj.getDay() === 5;
            
            const att = attendance.find(a => cleanDate(a.date) === targetDate);
            const leave = leaves.find(l => l.status === 'مقبول' && l.start_date <= targetDate && l.end_date >= targetDate);

            let status = 'غياب', inTime = '--:--', outTime = '--:--', workHours = 0, rowColor = '#fff1f2';

            if (att) {
                status = 'حضور'; rowColor = '#f0fdf4';
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
            rowsHTML += `<tr style="background-color:${rowColor};border-bottom:1px solid #e5e7eb;"><td style="padding:10px;border:1px solid #e5e7eb;">${targetDate}</td><td style="padding:10px;border:1px solid #e5e7eb;">${inTime}</td><td style="padding:10px;border:1px solid #e5e7eb;font-weight:bold;">${status}</td><td style="padding:10px;border:1px solid #e5e7eb;">${outTime}</td><td style="padding:10px;border:1px solid #e5e7eb;">${workHours>0?workHours+' س':'-'}</td></tr>`;
        }

        return `<!DOCTYPE html><html dir="rtl" lang="ar"><body><div style="font-family:sans-serif;max-width:600px;margin:auto;">
            <h2 style="text-align:center;color:#059669;">تقرير شهر ${monthStr}</h2>
            <p><strong>الموظف:</strong> ${emp.name}</p>
            <div style="background:#f3f4f6;padding:15px;margin-bottom:20px;border-radius:8px;">
                <p><strong>أيام الحضور:</strong> ${totalPresent} | <strong>الغياب:</strong> ${totalAbsent} | <strong>ساعات العمل:</strong> ${totalHours.toFixed(1)}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;text-align:center;">
                <thead><tr style="background:#e5e7eb;"><th>التاريخ</th><th>دخول</th><th>خروج</th><th>الحالة</th></tr></thead>
                <tbody>${rowsHTML}</tbody>
            </table>
        </div></body></html>`;
    };

    // --- دالة الإرسال عبر السيرفر (Brevo API Only) ---
    const sendViaServer = async (toEmail: string, toName: string, subject: string, htmlContent: string) => {
        try {
            console.log(`Sending to ${toEmail} via /api/send-email...`); // Debug Log
            
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toEmail, toName, subject, htmlContent })
            });

            // التحقق من أن الاستجابة هي JSON
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("Server response is not JSON. Check Vercel logs.");
            }

            const data = await response.json();
            
            if (!response.ok) {
                console.error("Brevo Server Error:", data);
                return { success: false, error: data.error || 'Unknown server error' };
            }
            return { success: true };
        } catch (error: any) {
            console.error("Network/Client Error:", error);
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
                const subject = `تقرير شهر ${month} - ${emp.name}`;

                // استدعاء دالة السيرفر
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

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2"><Mail className="text-emerald-600"/> إرسال التقارير (Brevo)</h2>
            
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
                                    <td className="p-4 text-center text-xs">
                                        {emp.work_days && emp.work_days.length > 0 ? (emp.work_days.length < 5 ? 'جزئي' : 'كامل') : 'افتراضي'}
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
                    {sending ? 'جاري الإرسال (Brevo)...' : `إرسال (${selectedIds.length})`}
                </button>
            </div>
        </div>
    );
}
