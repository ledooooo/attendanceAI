import React, { useEffect, useState, useMemo } from 'react';
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
    const [totalVotes, setTotalVotes] = useState(0);
    
    // حالات الفلترة
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // استخراج الحالات الفريدة مع تنظيفها
    const availableStatuses = useMemo(() => {
        const statuses = Array.from(new Set(employees.map(emp => emp.status?.trim()).filter(Boolean)));
        return statuses;
    }, [employees]);

    // تعيين الحالة الافتراضية بذكاء أكبر
    useEffect(() => {
        if (statusFilter === 'all' && availableStatuses.length > 0) {
            const activeKey = availableStatuses.find(s => 
                s?.toLowerCase() === 'active' || s === 'نشط' || s === 'قوة فعلية'
            );
            if (activeKey) setStatusFilter(activeKey);
        }
    }, [availableStatuses]);

    // معالجة أعياد الميلاد
    const filteredBirthdays = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextMonth = new Date();
        nextMonth.setDate(today.getDate() + 30);

        return employees
            .filter(emp => {
                const matchStatus = statusFilter === 'all' || emp.status?.trim() === statusFilter;
                const matchSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase());
                return matchStatus && matchSearch;
            })
            .map(emp => {
                const birthDate = getBirthDateFromNationalID(emp.national_id);
                if (!birthDate) return null;

                let bDay = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
                if (bDay < today) bDay.setFullYear(today.getFullYear() + 1);

                if (bDay <= nextMonth) {
                    const diff = Math.ceil((bDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                    return {
                        ...emp,
                        daysRemaining: diff,
                        formattedDate: `${birthDate.getDate()} / ${birthDate.getMonth() + 1}`
                    };
                }
                return null;
            })
            .filter((item): item is any => item !== null)
            .sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [employees, statusFilter, searchTerm]);

    useEffect(() => {
        fetchEOMStatus();
    }, [employees]);

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
                    employee_name: employees.find(e => e.employee_id === n.employee_id)?.name || "موظف سابق",
                    photo_url: employees.find(e => e.employee_id === n.employee_id)?.photo_url
                }));
                setNominees(enriched.sort((a, b) => (b.votes_count || 0) - (a.votes_count || 0)));
            }
        }
    };

    const handleEndVoting = async () => {
        if (!cycle || nominees.length === 0) return;
        if (!confirm('هل أنت متأكد من إنهاء التصويت وإعلان الفائز؟')) return;
        
        const winner = nominees[0];
        const { error } = await supabase.from('eom_cycles')
            .update({ status: 'announced', winner_id: winner.employee_id })
            .eq('id', cycle.id);
            
        if (!error) {
            alert('تم إنهاء التصويت بنجاح!');
            fetchEOMStatus();
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 text-right pb-10" dir="rtl">
            
            {/* قسم التصويت - رسم بياني بسيط */}
            <div className="bg-white rounded-[35px] p-8 shadow-sm border border-indigo-50">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                            <Trophy className="text-amber-500 w-8 h-8 animate-bounce"/> نتائج تصويت موظف الشهر
                        </h3>
                        <p className="text-gray-500 font-bold mt-1">إجمالي الأصوات المجمعة: {totalVotes}</p>
                    </div>
                    {cycle?.status === 'voting' && (
                        <button onClick={handleEndVoting} className="bg-red-600 text-white px-6 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-red-700 shadow-lg shadow-red-100 transition-all active:scale-95">
                            <StopCircle className="w-5 h-5"/> إنهاء التصويت الآن
                        </button>
                    )}
                </div>

                <div className="space-y-5">
                    {nominees.map((nom, index) => {
                        const percentage = totalVotes > 0 ? Math.round((nom.votes_count / totalVotes) * 100) : 0;
                        return (
                            <div key={nom.id} className="group">
                                <div className="flex justify-between items-center mb-2 px-1">
                                    <span className="font-black text-gray-700 flex items-center gap-2">
                                        <span className={`w-6 h-6 flex items-center justify-center rounded-full text-[10px] ${index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {index + 1}
                                        </span>
                                        {nom.employee_name}
                                    </span>
                                    <span className="text-indigo-600 font-black text-sm">{nom.votes_count} صوت ({percentage}%)</span>
                                </div>
                                <div className="w-full bg-gray-50 h-4 rounded-full overflow-hidden border border-gray-100">
                                    <div 
                                        className={`h-full transition-all duration-1000 ease-out shadow-sm ${index === 0 ? 'bg-gradient-to-l from-indigo-600 to-indigo-400' : 'bg-indigo-200'}`} 
                                        style={{ width: `${percentage}%` }} 
                                    />
                                </div>
                            </div>
                        );
                    })}
                    {nominees.length === 0 && (
                        <p className="text-center py-6 text-gray-400 font-bold italic">لا يوجد تصويت نشط حالياً</p>
                    )}
                </div>
            </div>

            {/* قسم أعياد الميلاد */}
            <div className="bg-white rounded-[35px] p-8 shadow-sm border border-pink-50">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 mb-8">
                    <h3 className="text-2xl font-black text-gray-800 flex items-center gap-3">
                        <CalendarHeart className="text-pink-500 w-8 h-8"/> مناسبات قادمة (30 يوم)
                    </h3>
                    
                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 min-w-[180px]">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="text" placeholder="ابحث عن اسم..." 
                                className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-pink-100 transition-all"
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2.5 rounded-2xl">
                            <Filter className="w-4 h-4 text-gray-400" />
                            <select 
                                className="bg-transparent text-xs font-black text-gray-600 outline-none cursor-pointer pr-1"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="all">جميع الموظفين</option>
                                {availableStatuses.map(status => (
                                    <option key={status} value={status}>
                                        {status === 'active' || status === 'نشط' ? '🟢 القوة الفعلية' : status}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredBirthdays.map((emp) => (
                        <div key={emp.id} className={`group p-4 rounded-[25px] border transition-all duration-300 hover:shadow-md ${emp.daysRemaining === 0 ? 'bg-gradient-to-br from-pink-50 to-white border-pink-200 animate-pulse' : 'bg-white border-gray-100'}`}>
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shadow-inner relative">
                                    {emp.photo_url ? (
                                        <img src={emp.photo_url} className="w-full h-full object-cover transition-transform group-hover:scale-110"/>
                                    ) : (
                                        <Users className="text-gray-300 w-6 h-6"/>
                                    )}
                                    {emp.daysRemaining === 0 && <div className="absolute inset-0 bg-pink-500/10 animate-ping"/>}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-black text-gray-800 text-sm truncate">{emp.name}</p>
                                    <p className={`text-[10px] font-black mt-0.5 ${emp.daysRemaining === 0 ? 'text-pink-600' : 'text-gray-400'}`}>
                                        {emp.formattedDate} — {emp.daysRemaining === 0 ? 'يحتفل اليوم! 🎉' : `بعد ${emp.daysRemaining} يوم`}
                                    </p>
                                </div>
                                <button className="p-3 bg-pink-50 text-pink-600 rounded-xl hover:bg-pink-600 hover:text-white transition-all active:scale-90">
                                    <Send className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                    {filteredBirthdays.length === 0 && (
                        <div className="col-span-full py-16 text-center">
                            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-dashed border-gray-200">
                                <Cake className="text-gray-200 w-10 h-10"/>
                            </div>
                            <p className="text-gray-400 font-bold">لا توجد أعياد ميلاد مسجلة في هذه الفترة</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
