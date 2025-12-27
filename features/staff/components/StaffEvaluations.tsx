import React from 'react';
import { Evaluation } from '../../../types';
import { Award } from 'lucide-react';

export default function StaffEvaluations({ evals }: { evals: Evaluation[] }) {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500 text-right">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Award className="text-emerald-600 w-7 h-7" /> تقييماتي الشهرية</h3>
            <div className="grid gap-6">
                {evals.map(ev => (
                    <div key={ev.id} className="p-8 bg-white border rounded-3xl shadow-sm border-r-8 border-r-emerald-600">
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="font-black text-xl text-emerald-700">شهر: {ev.month}</h4>
                            <div className="text-3xl font-black text-emerald-600">{ev.total_score} <span className="text-sm text-gray-400">/ 100</span></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-500 mb-4">
                            <div className="bg-gray-50 p-2 rounded">الحضور: {ev.score_attendance}</div>
                            <div className="bg-gray-50 p-2 rounded">المظهر: {ev.score_appearance}</div>
                            <div className="bg-gray-50 p-2 rounded">الجودة: {ev.score_quality}</div>
                            <div className="bg-gray-50 p-2 rounded">المهام: {ev.score_tasks}</div>
                        </div>
                        <p className="text-sm text-gray-600 border-t pt-2"><b>ملاحظات الإدارة:</b> {ev.notes || 'لا يوجد'}</p>
                    </div>
                ))}
                {evals.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد تقييمات مسجلة</p>}
            </div>
        </div>
    );
}