import React, { useState, useEffect } from 'react';
import { Send, User, Reply, Inbox, ArrowUpRight, ArrowDownLeft, Check, CheckCheck } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee, InternalMessage } from '../../../types';

interface Props {
    messages: InternalMessage[];
    employee: Employee;
    currentUserId: string; // 'admin' or employee_id
}

export default function StaffMessages({ messages, employee, currentUserId }: Props) {
    const [newMessage, setNewMessage] = useState('');
    const [filter, setFilter] = useState<'all' | 'inbox' | 'sent'>('all');
    const [localMessages, setLocalMessages] = useState<InternalMessage[]>(messages);
    const [sending, setSending] = useState(false);

    // تحديث الرسائل عند تغير الـ props
    useEffect(() => {
        setLocalMessages(messages);
    }, [messages]);

    // تعليم الرسائل كمقروءة عند فتحها
    useEffect(() => {
        const markAsRead = async () => {
            const unreadIds = localMessages
                .filter(m => !m.is_read && m.to_user === (currentUserId === 'admin' ? 'admin' : employee.employee_id))
                .map(m => m.id);

            if (unreadIds.length > 0) {
                await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
                // تحديث الحالة محلياً
                setLocalMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));
            }
        };
        markAsRead();
    }, [localMessages, currentUserId, employee]);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        setSending(true);

        const fromUser = currentUserId === 'admin' ? 'admin' : employee.employee_id;
        const toUser = currentUserId === 'admin' ? employee.employee_id : 'admin';

        const payload = {
            from_user: fromUser,
            to_user: toUser,
            message: newMessage,
            is_read: false
        };

        const { data, error } = await supabase.from('messages').insert(payload).select().single();

        if (!error && data) {
            setLocalMessages([data, ...localMessages]);
            setNewMessage('');
        } else {
            alert('فشل الإرسال: ' + error?.message);
        }
        setSending(false);
    };

    const filteredMessages = localMessages.filter(m => {
        const isInbox = m.to_user === (currentUserId === 'admin' ? 'admin' : employee.employee_id);
        const isSent = m.from_user === (currentUserId === 'admin' ? 'admin' : employee.employee_id);
        
        if (filter === 'inbox') return isInbox;
        if (filter === 'sent') return isSent;
        return true; // all
    });

    return (
        <div className="h-[600px] flex flex-col bg-white rounded-[30px] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500">
            {/* Header */}
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-sm border-2 border-white ${currentUserId === 'admin' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                            {currentUserId === 'admin' ? employee.name.charAt(0) : 'A'}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div>
                        <h4 className="font-black text-gray-800 text-lg">
                            {currentUserId === 'admin' ? employee.name : 'الإدارة'}
                        </h4>
                        <p className="text-xs text-gray-500 font-bold flex items-center gap-1">
                            {currentUserId === 'admin' ? employee.specialty : 'الدعم الفني والإداري'}
                        </p>
                    </div>
                </div>
                
                {/* Filters */}
                <div className="flex bg-white rounded-xl p-1 border shadow-sm">
                    <button onClick={() => setFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>الكل</button>
                    <button onClick={() => setFilter('inbox')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'inbox' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>وارد</button>
                    <button onClick={() => setFilter('sent')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'sent' ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>صادر</button>
                </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-gray-50/30 flex flex-col-reverse">
                {filteredMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-300">
                        <Inbox className="w-16 h-16 mb-2 opacity-50"/>
                        <p className="font-bold">لا توجد رسائل</p>
                    </div>
                ) : (
                    filteredMessages.map(msg => {
                        const isMe = msg.from_user === (currentUserId === 'admin' ? 'admin' : employee.employee_id);
                        return (
                            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    <div className={`p-4 rounded-2xl shadow-sm relative text-sm font-medium leading-relaxed ${
                                        isMe 
                                        ? 'bg-blue-600 text-white rounded-br-none' 
                                        : 'bg-white border border-gray-100 text-gray-700 rounded-bl-none'
                                    }`}>
                                        {msg.message}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 px-1">
                                        <span className="text-[10px] font-bold text-gray-400">
                                            {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {isMe && (
                                            msg.is_read ? <CheckCheck className="w-3 h-3 text-blue-500"/> : <Check className="w-3 h-3 text-gray-300"/>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 bg-white border-t flex gap-3 items-center">
                <div className="relative flex-1">
                    <input 
                        type="text" 
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        placeholder="اكتب رسالتك هنا..." 
                        className="w-full pl-4 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-100 outline-none font-bold text-gray-700 placeholder-gray-400 transition-all"
                    />
                </div>
                <button 
                    type="submit" 
                    disabled={!newMessage.trim() || sending} 
                    className="bg-blue-600 text-white p-3.5 rounded-2xl hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-all shadow-lg hover:shadow-blue-200 active:scale-95"
                >
                    <Send className={`w-5 h-5 rtl:rotate-180 ${sending ? 'animate-pulse' : ''}`}/>
                </button>
            </form>
        </div>
    );
}
