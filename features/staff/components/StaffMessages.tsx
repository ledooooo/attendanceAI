import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Inbox, User, Clock, CheckCheck, Mail } from 'lucide-react';

export default function StaffMessages({ messages: initialData, employee }: any) {
    const [messages, setMessages] = useState<any[]>(initialData || []);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchMessages = async () => {
        if(!employee?.employee_id) return;
        const { data } = await supabase
            .from('messages')
            .select('*')
            .or(`to_user.eq.${employee.employee_id},to_user.eq.all`)
            .order('created_at', { ascending: false });
        
        if(data) setMessages(data);
    };

    useEffect(() => {
        fetchMessages();
    }, [employee]);

    // قراءة الرسالة
    const handleRead = async (msg: any) => {
        if (expandedId === msg.id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(msg.id);

        // إذا لم تكن مقروءة، علمها كمقروءة (يمكن تطوير هذا الجزء لاحقاً بجدول منفصل للقراءات إذا كانت الرسالة جماعية)
        // حالياً سنفترض أنها رسالة فردية
        if (!msg.is_read && msg.to_user !== 'all') {
            await supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
            // تحديث الحالة محلياً
            setMessages(prev => prev.map(m => m.id === msg.id ? {...m, is_read: true} : m));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Mail className="w-6 h-6 text-pink-600"/> البريد الوارد
                </h3>
                <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-bold">
                    {messages.filter(m => !m.is_read).length} جديد
                </span>
            </div>

            <div className="space-y-3">
                {messages.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">لا توجد رسائل في صندوق الوارد</div>
                ) : (
                    messages.map(msg => (
                        <div 
                            key={msg.id} 
                            onClick={() => handleRead(msg)}
                            className={`group relative border rounded-2xl p-4 transition-all cursor-pointer ${
                                expandedId === msg.id 
                                    ? 'bg-white shadow-md border-pink-200' 
                                    : !msg.is_read 
                                        ? 'bg-pink-50 border-pink-100 hover:bg-pink-100' 
                                        : 'bg-white border-gray-100 hover:bg-gray-50'
                            }`}
                        >
                            {/* Unread Dot */}
                            {!msg.is_read && (
                                <span className="absolute top-4 left-4 w-2.5 h-2.5 bg-pink-600 rounded-full animate-pulse"/>
                            )}

                            <div className="flex items-start gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                    msg.from_user === 'admin' ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-600'
                                }`}>
                                    {msg.from_user === 'admin' ? <User className="w-5 h-5"/> : <User className="w-5 h-5"/>}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <h4 className={`font-bold text-sm ${!msg.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                                            {msg.from_user === 'admin' ? 'الإدارة' : msg.from_user}
                                        </h4>
                                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                            {new Date(msg.created_at).toLocaleDateString('ar-EG')}
                                            {msg.is_read && <CheckCheck className="w-3 h-3 text-blue-400"/>}
                                        </span>
                                    </div>
                                    
                                    <p className={`text-sm ${expandedId === msg.id ? 'text-gray-800 whitespace-pre-wrap' : 'text-gray-500 truncate'}`}>
                                        {msg.message}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
