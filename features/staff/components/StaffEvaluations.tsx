import React, { useState } from 'react';
import { Evaluation } from '../../../types';
import { Award, CalendarSearch } from 'lucide-react';

export default function StaffEvaluations({ evals }: { evals: Evaluation[] }) {
    const [filterMonth, setFilterMonth] = useState('');

    const filteredEvals = evals.filter(ev => !filterMonth || ev.month === filterMonth);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500 text-right">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Award className="text-emerald-600 w-7 h-7" /> أرشيف التقييمات</h3>
                <div className="flex items-center gap-2">
                    <CalendarSearch className="w-5 h-5 text-gray-400"/>
                    <input 
                        type="month" 
                        value={filterMonth} 
                        onChange={(e) => setFilterMonth(e.target.value)} 
                        className="p-2 border rounded-xl text-sm font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500" 
                    />
                </div>
            </div>

            <div className="grid gap-6">
                {filteredEvals.map(ev => (
                    <div key={ev.id} className="p-8 bg-white border rounded-[30px] shadow-sm hover:shadow-lg transition-all border-r-8 border-r-emerald-500">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-black text-xl text-emerald-800 flex items-center gap-2">
                                <span className="bg-emerald-100 px-3 py-1 rounded-lg text-sm">شهر {ev.month}</span>
                            </h4>
                            <div className="flex flex-col items-end">
                                <span className="text-4xl font-black text-emerald-600">{ev.total_score}%</span>
                                <span className="text-[10px] text-gray-400 font-bold">الدرجة النهائية</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-600 mb-4">
                            <div className="bg-gray-50 p-3 rounded-xl border text-center"><span className="block font-bold text-gray-400 mb-1">الحضور</span><span className="font-black text-lg">{ev.score_attendance}</span></div>
                            <div className="bg-gray-50 p-3 rounded-xl border text-center"><span className="block font-bold text-gray-400 mb-1">المظهر</span><span className="font-black text-lg">{ev.score_appearance}</span></div>
                            <div className="bg-gray-50 p-3 rounded-xl border text-center"><span className="block font-bold text-gray-400 mb-1">الجودة</span><span className="font-black text-lg">{ev.score_quality}</span></div>
                            <div className="bg-gray-50 p-3 rounded-xl border text-center"><span className="block font-bold text-gray-400 mb-1">المهام</span><span className="font-black text-lg">{ev.score_tasks}</span></div>
                        </div>
                        {ev.notes && <p className="text-sm text-gray-600 border-t pt-4 mt-4 bg-gray-50/50 p-4 rounded-xl"><b>ملاحظات الإدارة:</b> {ev.notes}</p>}
                    </div>
                ))}
                {filteredEvals.length === 0 && <p className="text-center text-gray-400 py-10 border-2 border-dashed rounded-3xl">لا توجد تقييمات لهذا الشهر</p>}
            </div>
        </div>
    );
}