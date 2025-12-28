import React, { useState } from 'react';
import { InternalMessage } from '../../../types';
import { Inbox, Send, Filter, User } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationContext';

export default function StaffMessages({ messages }: { messages: InternalMessage[] }) {
    const { employeeProfile } = useAuth();
    const { sendNotification } = useNotifications();
    const [filter, setFilter] = useState<'all' | 'inbox' | 'sent'>('all');
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    // فلترة الرسائل
    const filteredMessages = messages.filter(m => {
        if (filter === 'all') return true;
        if (filter === 'inbox') return m.to_user === employeeProfile?.employee_id || m.to_user === 'all';
        if (filter === 'sent') return m.from_user === employeeProfile?.employee_id;
        return true;
    });

    const handleSend = async () => {
        if (!newMessage.trim()) return;
        setSending(true);
        const { error } = await supabase.from('messages').insert([{
            from_user: employeeProfile?.employee_id,
            to_user: 'admin', // إرسال للمدير دائماً
            content: newMessage,
            read: false
        }]);

        if (!error) {
            await sendNotification('admin', 'رسالة جديدة', `رسالة من ${employeeProfile?.name}`);
            setNewMessage('');
            alert('تم إرسال الرسالة للمدير');
            // يفضل عمل refresh هنا أو إضافة الرسالة يدوياً للـ state
        } else {
            alert('فشل الإرسال');
        }
        setSending(false);
    };

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-b pb-4"><Inbox className="text-emerald-600 w-7 h-7" /> مركز الرسائل</h3>
            
            {/* صندوق الإرسال */}
            <div className="bg-gray-50 p-4 rounded-3xl border flex gap-2 items-center">
                <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="اكتب رسالة سريعة للإدارة..." 
                    className="flex-1 p-3 bg-white border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button 
                    onClick={handleSend}
                    disabled={sending}
                    className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-all disabled:bg-gray-400"
                >
                    <Send className="w-5 h-5" />
                </button>
            </div>

            {/* الفلاتر */}
            <div className="flex gap-2">
                <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter==='all' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}>الكل</button>
                <button onClick={() => setFilter('inbox')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter==='inbox' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>الوارد</button>
                <button onClick={() => setFilter('sent')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filter==='sent' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500'}`}>الصادر</button>
            </div>

            {/* القائمة */}
            <div className="space-y-4">
                {filteredMessages.map((m: any) => {
                    const isMe = m.from_user === employeeProfile?.employee_id;
                    return (
                        <div key={m.id} className={`p-5 rounded-3xl border-2 relative ${isMe ? 'bg-purple-50 border-purple-100 mr-10' : 'bg-white border-blue-50 ml-10'}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`p-1.5 rounded-full ${isMe ? 'bg-purple-200 text-purple-700' : 'bg-blue-200 text-blue-700'}`}>
                                    <User className="w-3 h-3"/>
                                </div>
                                <span className={`text-xs font-black ${isMe ? 'text-purple-700' : 'text-blue-700'}`}>
                                    {isMe ? 'أنا' : (m.from_user === 'admin' ? 'الإدارة' : m.from_user)}
                                </span>
                            </div>
                            <p className="text-gray-700 leading-relaxed text-sm font-medium">{m.content}</p>
                            <span className="text-[10px] text-gray-400 font-bold mt-3 block text-left">
                                {new Date(m.created_at).toLocaleString('ar-EG')}
                            </span>
                        </div>
                    );
                })}
                {filteredMessages.length === 0 && <p className="text-center text-gray-400 py-10">لا توجد رسائل</p>}
            </div>
        </div>
    );
}