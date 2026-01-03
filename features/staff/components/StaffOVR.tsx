import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, OVRReport } from '../../../types';
import { AlertTriangle, Send, FileText, MapPin, Clock, Calendar, Eye, EyeOff, RefreshCcw } from 'lucide-react';

export default function StaffOVR({ employee }: { employee: Employee }) {
    const [loading, setLoading] = useState(false);
    const [myReports, setMyReports] = useState<OVRReport[]>([]);
    const [isAnonymous, setIsAnonymous] = useState(false); // حالة الإرسال المجهول

    const [form, setForm] = useState({
        incident_date: new Date().toISOString().split('T')[0],
        incident_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        location: '',
        description: '',
        action_taken: ''
    });

    useEffect(() => {
        fetchMyReports();
    }, []);
const fetchMyReports = async () => {
    // تأكد أن employee.employee_id يحتوي على قيمة صحيحة (مثلاً "101")
    const { data } = await supabase
        .from('ovr_reports')
        .select('*')
        .eq('reporter_id', employee.employee_id) 
        .order('created_at', { ascending: false });
        
    if (data) setMyReports(data as any);
};

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.from('ovr_reports').insert({
            reporter_id: employee.employee_id,
            reporter_name: employee.name, // سيتم تخزين الاسم في القاعدة ولكن الواجهة ستخفيه إذا كان anonymous
            is_anonymous: isAnonymous,
            ...form,
            status: 'new'
        });

        if (!error) {
            alert('تم إرسال التقرير بنجاح.');
            setForm({ ...form, location: '', description: '', action_taken: '' });
            fetchMyReports(); // تحديث القائمة
        } else {
            alert('حدث خطأ: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            
            {/* نموذج الإرسال */}
            <div className="bg-white p-6 rounded-[30px] border border-red-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6 border-b border-red-50 pb-4">
                    <div className="bg-red-50 p-3 rounded-full">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-gray-800">إبلاغ عن واقعة (OVR)</h3>
                        <p className="text-xs text-gray-500 font-bold">تقرير سري يذهب لمسؤول الجودة مباشرة</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex items-center gap-2 mb-4 bg-gray-50 p-3 rounded-xl">
                        <input 
                            type="checkbox" 
                            id="anon" 
                            checked={isAnonymous} 
                            onChange={e => setIsAnonymous(e.target.checked)}
                            className="w-5 h-5 accent-red-600 cursor-pointer"
                        />
                        <label htmlFor="anon" className="text-sm font-bold text-gray-700 cursor-pointer flex items-center gap-2">
                            {isAnonymous ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                            إرسال كـ "مجهول الهوية" (لن يظهر اسمك عند العرض)
                        </label>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ الواقعة</label>
                            <input type="date" required className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm"
                                value={form.incident_date} onChange={e => setForm({...form, incident_date: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1">وقت الواقعة</label>
                            <input type="time" required className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm"
                                value={form.incident_time} onChange={e => setForm({...form, incident_time: e.target.value})} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">مكان الواقعة</label>
                        <input type="text" required placeholder="مثال: الاستقبال، غرفة 3..." className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm"
                            value={form.location} onChange={e => setForm({...form, location: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">وصف الواقعة</label>
                        <textarea required placeholder="اشرح ما حدث بالتفصيل..." className="w-full p-3 rounded-xl border bg-gray-50 font-medium text-sm h-24"
                            value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1">الإجراء الفوري المتخذ</label>
                        <input type="text" placeholder="ماذا فعلت فور حدوث الواقعة؟" className="w-full p-3 rounded-xl border bg-gray-50 font-medium text-sm"
                            value={form.action_taken} onChange={e => setForm({...form, action_taken: e.target.value})} />
                    </div>

                    <button type="submit" disabled={loading} className="w-full py-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 flex justify-center items-center gap-2">
                        {loading ? 'جاري الإرسال...' : <><Send className="w-5 h-5 rtl:rotate-180"/> إرسال التقرير</>}
                    </button>
                </form>
            </div>

            {/* قائمة تقاريري السابقة */}
            <div className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500"/> تقاريري السابقة
                    </h3>
                    <button onClick={fetchMyReports} className="text-gray-400 hover:text-gray-600"><RefreshCcw className="w-4 h-4"/></button>
                </div>
                
                <div className="space-y-3">
                    {myReports.length === 0 ? (
                        <p className="text-center text-gray-400 py-4 text-sm">لم ترسل أي تقارير بعد</p>
                    ) : (
                        myReports.map(rep => (
                            <div key={rep.id} className="border border-gray-100 rounded-2xl p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-bold text-gray-400">{rep.incident_date}</span>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                                        rep.status === 'new' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                        {rep.status === 'new' ? 'قيد المراجعة' : 'تم الرد'}
                                    </span>
                                </div>
                                <p className="text-sm font-bold text-gray-700 mb-2">{rep.description.substring(0, 60)}...</p>
                                
                                {rep.quality_response && (
                                    <div className="bg-green-50 p-3 rounded-xl text-xs text-green-800 border border-green-100 mt-2">
                                        <span className="font-bold block mb-1">رد الجودة:</span>
                                        {rep.quality_response}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
