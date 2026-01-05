import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, EOMCycle, EOMNominee, getBirthDateFromNationalID } from '../../../types';
import { 
  Trophy, Users, CalendarHeart, Cake, AlertCircle, 
  Send, BarChart3, StopCircle, Filter, Search
} from 'lucide-react';

interface EnrichedNominee extends EOMNominee {
    employee_name?: string;
    photo_url?: string;
}

export default function MotivationTab({ employees }: { employees: Employee[] }) {
    const [cycle, setCycle] = useState<EOMCycle | null>(null);
    const [nominees, setNominees] = useState<EnrichedNominee[]>([]);
    const [upcomingBirthdays, setUpcomingBirthdays] = useState<any[]>([]);
    const [totalVotes, setTotalVotes] = useState(0);
    
    // ✅ جعل الحالة الافتراضية هي "نشط"
    const [statusFilter, setStatusFilter] = useState<string>('active');
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchEOMStatus();
    }, [employees]);

    // ✅ تحديث القائمة عند تغيير الفلتر أو البحث أو بيانات الموظفين
    useEffect(() => {
        processBirthdays();
    }, [employees, statusFilter, searchTerm]);

    const processBirthdays = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30);

        const list = employees
            .filter(emp => {
                // ✅ منطق الفلترة: إذا كان 'all' يظهر الكل، غير ذلك يطابق الحالة المختارة
                const matchStatus = statusFilter === 'all' || emp.status === statusFilter;
                const matchSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
                return matchStatus && matchSearch;
            })
            .map(emp => {
                const birthDate = getBirthDateFromNationalID(emp.national_id);
                if (!birthDate) return null;

                let currentYearBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                if (currentYearBirthday < today) currentYearBirthday.setFullYear(today.getFullYear() + 1);

                if (currentYearBirthday <= nextMonth) {
                    const diffDays = Math.ceil((currentYearBirthday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        ...emp,
                        daysRemaining: diffDays,
                        formattedDate: `${birthDate.getDate()} / ${birthDate.getMonth() + 1}`
                    };
                }
                return null;
            })
            .filter(Boolean)
            .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);

        setUpcomingBirthdays(list);
    };

    const fetchEOMStatus = async () => {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const { data: cyc } = await supabase.from('eom_cycles')
            .select('*').eq('month', currentMonth).maybeSingle();

        if (cyc) {
            setCycle(cyc);
            const { data: noms } = await supabase.from('eom_nominees')
                .select('*').eq('cycle_id', cyc.id);

            if (noms) {
                const total = noms.reduce((sum, n) => sum + (n.votes_count || 0), 0);
                setTotalVotes(total);
                
                const enriched = noms.map(n => ({
                    ...n,
                    employee_name: employees.find(e => e.employee_id === n.employee_id)?.name,
                    photo_url: employees.find(e => e.employee_id === n.employee_id)?.photo_url
                }));
                setNominees(enriched.sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0)));
            }
        }
    };

    const handleEndVoting = async () => {
        if (!cycle || nominees.length === 0) return;
        if (!confirm('هل أنت متأكد من إغلاق التصويت وإعلان الفائز؟')) return;

        const winner = nominees[0];
        const { error } = await supabase.from('eom_cycles')
            .update({ status: 'announced', winner_id: winner.employee_id })
            .eq('id', cycle.id);

        if (!error) {
            alert('تم إنهاء التصويت بنجاح');
            fetchEOMStatus();
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-right" dir="rtl">
            
            {/* قسم متابعة التصويت */}
            <div className="bg-white rounded-[35px] p-8 shadow-sm border border-indigo-100">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                            <BarChart3 className="text-indigo-600 w-8 h-8"/> متابعة نتائج التصويت
                        </h3>
                        <p className="text-gray-500 font-bold mt-1">إجمالي المشاركين: {totalVotes} صوت</p>
                    </div>
                    {cycle?.status === 'voting' && (
                        <button onClick={handleEndVoting} className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-red-100 transition-colors">
                            <StopCircle className="w-5 h-5"/> إنهاء وإعلان النتائج
                        </button>
                    )}
                </div>

                <div className="space-y-6">
                    {nominees.map((nom, index) => {
                        const percentage = totalVotes > 0 ? Math.round((nom.votes_count / totalVotes) * 100) : 0;
                        return (
                            <div key={nom.id} className="relative">
                                <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black ${index === 0 ? 'bg-yellow-400 text-white shadow-lg shadow-yellow-100' : 'bg-gray-100 text-gray-400'}`}>
                                            {index + 1}
                                        </div>
                                        <span className="font-bold text-gray-700">{nom.employee_name}</span>
                                    </div>
                                    <span className="text-indigo-600 font-black">{nom.votes_count} صوت ({percentage}%)</span>
                                </div>
                                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden border border-gray-50">
                                    <div 
                                        className={`h-full transition-all duration-1000 ${index === 0 ? 'bg-indigo-600' : 'bg-indigo-300'}`}
                                        style={{ width: `${percentage}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* قسم أعياد الميلاد مع الفلترة */}
            <div className="bg-white rounded-[35px] p-8 shadow-sm border border-pink-100">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-8">
                    <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <Cake className="text-pink-600 w-8 h-8"/> أعياد الميلاد (30 يوم قادم)
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        {/* البحث */}
                        <div className="relative flex-1 min-w-[200px]">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" 
                                placeholder="بحث بالاسم..." 
                                className="w-full pr-10 pl-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-200"
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {/* فلتر الحالة */}
                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-100">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select 
                                className="bg-transparent text-sm font-bold text-gray-600 outline-none cursor-pointer"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="active">عرض الموظفين النشطين</option>
                                <option value="on_leave">خارج المركز</option>
                                <option value="suspended">موقوف</option>
                                <option value="all">عرض الكل (بدون فلترة)</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {upcomingBirthdays.length > 0 ? upcomingBirthdays.map((emp) => (
                        <div key={emp.id} className={`p-4 rounded-3xl border flex justify-between items-center transition-all ${emp.daysRemaining === 0 ? 'bg-red-50 border-red-100 shadow-sm' : 'bg-gray-50/50 border-gray-100'}`}>
                            <div className="flex items-center gap-4">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center overflow-hidden">
                                        {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover"/> : <Users className="text-gray-300"/>}
                                    </div>
                                    <div className={`absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full border-2 border-white ${emp.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}></div>
                                </div>
                                <div>
                                    <p className="font-black text-gray-800 text-sm">{emp.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-[10px] text-pink-600 font-bold">{emp.formattedDate}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${emp.daysRemaining === 0 ? 'bg-red-500 text-white animate-pulse' : 'bg-white text-gray-500 border'}`}>
                                            {emp.daysRemaining === 0 ? 'اليوم! 🎉' : `بعد ${emp.daysRemaining} يوم`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button className="p-2.5 bg-white text-gray-400 rounded-xl hover:text-pink-600 border border-gray-100 transition-colors shadow-sm">
                                <Send className="w-4 h-4"/>
                            </button>
                        </div>
                    )) : (
                        <div className="col-span-full py-12 text-center bg-gray-50 rounded-[30px] border border-dashed border-gray-200">
                            <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500 font-bold">لا يوجد موظفون بهذه الحالة حالياً</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
