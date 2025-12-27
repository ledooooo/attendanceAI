import React from 'react';
import { LeaveRequest } from '../../../types';
import { List } from 'lucide-react';

export default function StaffRequestsHistory({ requests }: { requests: LeaveRequest[] }) {
    return (
        <div className="space-y-6 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><List className="text-emerald-600 w-7 h-7" /> سجل طلباتي</h3>
            <div className="grid gap-4">
                {requests.map(r => (
                    <div key={r.id} className="p-6 bg-white border rounded-3xl flex justify-between items-center shadow-sm hover:bg-gray-50 transition-colors">
                        <div>
                            <h4 className="font-black text-lg text-gray-800">{r.type}</h4>
                            <p className="text-sm text-gray-400">من {r.start_date} إلى {r.end_date}</p>
                            {r.notes && <p className="text-xs text-gray-500 mt-1">ملاحظات: {r.notes}</p>}
                        </div>
                        <div className={`px-4 py-2 rounded-xl text-xs font-black ${r.status === 'مقبول' ? 'bg-green-600 text-white' : r.status === 'مرفوض' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
                            {r.status}
                        </div>
                    </div>
                ))}
                {requests.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد طلبات سابقة</p>}
            </div>
        </div>
    );
}