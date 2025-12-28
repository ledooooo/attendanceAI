import React, { useState } from 'react';
import { LeaveRequest } from '../../../types';
import { List, Filter } from 'lucide-react';

export default function StaffRequestsHistory({ requests }: { requests: LeaveRequest[] }) {
    const [filterType, setFilterType] = useState('الكل');

    // استخراج الأنواع المتاحة من الطلبات الحالية
    const types = ['الكل', ...Array.from(new Set(requests.map(r => r.type)))];

    const filteredRequests = requests.filter(r => filterType === 'الكل' || r.type === filterType);

    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><List className="text-emerald-600 w-7 h-7" /> سجل طلباتي</h3>
                <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-xl border">
                    <Filter className="w-4 h-4 text-gray-400 mr-2"/>
                    <select 
                        value={filterType} 
                        onChange={(e) => setFilterType(e.target.value)} 
                        className="bg-transparent text-sm font-bold text-gray-600 outline-none cursor-pointer"
                    >
                        {types.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid gap-4">
                {filteredRequests.map(r => (
                    <div key={r.id} className="p-6 bg-white border rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center shadow-sm hover:shadow-md transition-all gap-4">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h4 className="font-black text-lg text-gray-800">{r.type}</h4>
                                <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500">{new Date(r.created_at).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <p className="text-sm text-gray-500 font-bold">من {r.start_date} إلى {r.end_date}</p>
                            {r.notes && <p className="text-xs text-gray-400 mt-2 bg-gray-50 p-2 rounded-lg max-w-md">{r.notes}</p>}
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap ${r.status === 'مقبول' ? 'bg-green-100 text-green-700' : r.status === 'مرفوض' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                            {r.status}
                        </div>
                    </div>
                ))}
                {filteredRequests.length === 0 && <p className="text-center text-gray-400 py-10 border-2 border-dashed rounded-3xl">لا توجد طلبات مطابقة</p>}
            </div>
        </div>
    );
}