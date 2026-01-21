import React, { useState, useEffect, useRef } from 'react';
import { Send, Inbox, Check, CheckCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee, InternalMessage } from '../../../types';

interface Props {
    messages: InternalMessage[];
    employee: Employee;
    currentUserId: string;
}

export default function StaffMessages({ messages: initialMessages, employee, currentUserId }: Props) {
    const [newMessage, setNewMessage] = useState('');
    const [filter, setFilter] = useState<'all' | 'inbox' | 'sent'>('all');
    const [localMessages, setLocalMessages] = useState<InternalMessage[]>(initialMessages);
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // دالة لجلب الرسائل من قاعدة البيانات
    const fetchMessages = async () => {
        if (currentUserId === 'admin') {
            setLocalMessages(initialMessages);
            return;
        }

        setLoading(true);
        const myId = employee.employee_id;

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .or(`from_user.eq.${myId},to_user.eq.${myId}`)
            .order('created_at', { ascending: false });

        if (data) {
            setLocalMessages(data as any);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchMessages();
    }, [employee.employee_id, currentUserId, initialMessages]);

    // الاشتراك اللحظي (Real-time)
    useEffect(() => {
        const myId = currentUserId === 'admin' ? 'admin' : employee.employee_id;

        const channel = supabase
            .channel('staff_messages_channel')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `to_user=eq.${myId}`, 
                },
                (payload) => {
                    const newMsg = payload.new as InternalMessage;
                    setLocalMessages((prev) => [newMsg, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId, employee]);

    // تحديد الرسائل كمقروءة
    useEffect(() => {
        const markAsRead = async () => {
            const unreadIds = localMessages
                .filter(m => !m.is_read && m.to_user === (currentUserId === 'admin' ? 'admin' : employee.employee_id))
                .map(m => m.id);

            if (unreadIds.length > 0) {
                await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
                setLocalMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));
            }
        };
        
        if (localMessages.length > 0) {
            markAsRead();
        }
    }, [localMessages.length, currentUserId, employee]);

    // 🚀 دالة الإرسال (تم التعديل لإرسال الإشعار)
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;
        setSending(true);

        const fromUser = currentUserId === 'admin' ? 'admin' : employee.employee_id;
        const toUser = currentUserId === 'admin' ? employee.employee_id : 'admin';
        const msgContent = newMessage; // نحتفظ بالنص لاستخدامه في الإشعار

        const payload = {
            from_user: fromUser,
            to_user: toUser,
            content: msgContent, 
            is_read: false
        };

        const { data, error } = await supabase.from('messages').insert(payload).select().single();

        if (!error && data) {
            setLocalMessages([data as any, ...localMessages]);
            setNewMessage('');

            // 🔥🔥🔥 الإضافة الجديدة: إرسال تنبيه للموظف 🔥🔥🔥
            // الشرط: إذا كان المرسل هو الأدمن، نرسل إشعاراً للموظف
            if (currentUserId === 'admin') {
                console.log("🔔 محاولة إرسال إشعار للموظف:", employee.name);
                
                // نستخدم employee.id (UUID) لأنه المربوط بجدول الاشتراكات
                if (employee.id) {
                    supabase.functions.invoke('send-push-notification', {
                        body: {
                            userId: employee.id, // الـ UUID للموظف
                            title: 'رسالة جديدة من الإدارة',
                            body: msgContent.substring(0, 50) + (msgContent.length > 50 ? '...' : ''),
                            url: '/messages'
                        }
                    }).then(({ error }) => {
                        if (error) console.error("❌ فشل إرسال الإشعار:", error);
                        else console.log("✅ تم إرسال الإشعار بنجاح");
                    });
                } else {
                    console.warn("⚠️ لا يوجد UUID للموظف، لن يتم إرسال الإشعار");
                }
            }
            // 🔥🔥🔥 نهاية الإضافة 🔥🔥🔥

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
        return true; 
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
                
                <div className="flex bg-white rounded-xl p-1 border shadow-sm">
                    <button onClick={() => setFilter('all')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'all' ? 'bg-gray-800 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>الكل</button>
                    <button onClick={() => setFilter('inbox')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'inbox' ? 'bg-blue-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>وارد</button>
                    <button onClick={() => setFilter('sent')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filter === 'sent' ? 'bg-green-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>صادر</button>
                </div>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar bg-gray-50/30 flex flex-col-reverse">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin mb-2"/>
                        <p>جاري تحميل الرسائل...</p>
                    </div>
                ) : filteredMessages.length === 0 ? (
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
                                        {msg.content || msg.message || <span className="italic opacity-50">...</span>} 
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
                <div ref={messagesEndRef} />
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
