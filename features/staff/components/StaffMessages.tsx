import React from 'react';
import { InternalMessage } from '../../../types';
import { Inbox } from 'lucide-react';

export default function StaffMessages({ messages }: { messages: InternalMessage[] }) {
    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800"><Inbox className="text-emerald-600 w-7 h-7" /> الرسائل والتنبيهات</h3>
            <div className="space-y-4">
                {messages.map((m: any) => (
                    <div key={m.id} className="p-6 rounded-3xl border-2 bg-white border-blue-50 relative">
                        <p className="text-gray-700 leading-relaxed text-sm">{m.content}</p>
                        <span className="text-[10px] text-gray-400 font-bold mt-2 block border-t pt-2 w-full text-left">
                            {new Date(m.created_at).toLocaleString('ar-EG')}
                        </span>
                    </div>
                ))}
                {messages.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد رسائل جديدة</p>}
            </div>
        </div>
    );
}