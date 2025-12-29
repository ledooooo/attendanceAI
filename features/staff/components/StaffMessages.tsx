import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Inbox, User, CheckCheck, Mail, Send, Loader2 } from 'lucide-react';
import { useNotifications } from '../../../context/NotificationContext'; // استيراد

interface Props {
    messages: any[];
    employee?: any; // قد يكون undefined إذا كنا في لوحة المدير
    currentUserId?: string; // لتحديد من المرسل (admin أو الموظف)
}

export default function StaffMessages({ messages: initialData, employee, currentUserId = 'user' }: Props) {
    const { sendNotification } = useNotifications(); // استخدام دالة الإشعارات
    const [messages, setMessages] = useState<any[]>(initialData || []);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    
    // حالة الإرسال
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);

    // جلب الرسائل
    const fetchMessages = async () => {
        if (!employee?.employee_id) return;
        const { data } = await supabase
            .from('messages')
            .select('*')
            .or(`to_user.eq.${employee.employee_id},to_user.eq.all,from_user.eq.${employee.employee_id}`) // جلب المرسل والمستقبل
            .order('created_at', { ascending: false });
        
        if(data) setMessages(data);
    };

    useEffect(() => {
        fetchMessages();
    }, [employee]);

    const handleRead = async (msg: any) => {
        if (expandedId === msg.id) { setExpandedId(null); return; }
        setExpandedId(msg.id);
        
        // إذا كنت أنا المستقبل والرسالة لم تقرأ
        const isMyMessage = (currentUserId === 'admin' && msg.to_user === 'admin') || (currentUserId !== 'admin' && msg.to_user === employee.employee_id);
        
        if (!msg.is_read && isMyMessage) {
            await supabase.from('messages').update({ is_read: true }).eq('id', msg.id);
            setMessages(prev => prev.map(m => m.id === msg.id ? {...m, is_read: true} : m));
        }
    };

    // --- دالة إرسال الرسالة ---
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if(!newMessage.trim()) return;
        setSending(true);

        try {
            // تحديد المرسل والمستقبل
            const fromUser = currentUserId === 'admin' ? 'admin' : employee.employee_id;
            const toUser = currentUserId === 'admin' ? employee.employee_id : 'admin';

            // 1. حفظ الرسالة
            const { error } = await supabase.from('messages').insert({
                from_user: fromUser,
                to_user: toUser,
                message: newMessage,
                is_read: false
            });

            if (error) throw error;

            // 2. إرسال الإشعار
            if (currentUserId === 'admin') {
                // المدير يرسل للموظف
                await sendNotification(toUser, 'رسالة جديدة من الإدارة 📩', newMessage.substring(0, 50) + '...');
            } else {
                // الموظف يرسل للمدير
                await sendNotification('admin', `رسالة من ${employee.name}`, newMessage.substring(0, 50) + '...');
            }

            setNewMessage('');
            fetchMessages(); // تحديث القائمة
            
        } catch (err) {
            alert('فشل الإرسال');
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* نموذج الإرسال */}
            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <form onSubmit={handleSend} className="flex gap-2">
                    <input 
                        type="text" 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={currentUserId === 'admin' ? "إرسال رد للموظف..." : "إرسال رسالة للإدارة..."}
                        className="flex-1 p-3 rounded-xl border outline-none focus:border-pink-500 text-sm"
                    />
                    <button 
                        type="submit" 
                        disabled={sending || !newMessage.trim()}
                        className="bg-pink-600 text-white p-3 rounded-xl hover:bg-pink-700 disabled:opacity-50 transition-colors"
                    >
                        {sending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5"/>}
                    </button>
                </form>
            </div>

            <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                    <Mail className="w-6 h-6 text-pink-600"/> المحادثات
                </h3>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {messages.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">لا توجد رسائل</div>
                ) : (
                    messages.map(msg => {
                        const isFromAdmin = msg.from_user === 'admin';
                        const isMe = (currentUserId === 'admin' && isFromAdmin) || (currentUserId !== 'admin' && !isFromAdmin);

                        return (
                            <div 
                                key={msg.id} 
                                onClick={() => handleRead(msg)}
                                className={`group relative border rounded-2xl p-4 transition-all cursor-pointer ${
                                    isMe ? 'bg-blue-50 border-blue-100 mr-8' : 'bg-white border-gray-100 ml-8'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                        isFromAdmin ? 'bg-gray-800 text-white' : 'bg-pink-100 text-pink-600'
                                    }`}>
                                        <User className="w-4 h-4"/>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center mb-1">
                                            <h4 className="font-bold text-xs text-gray-700">
                                                {isFromAdmin ? 'الإدارة' : (employee?.name || msg.from_user)}
                                            </h4>
                                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                {new Date(msg.created_at).toLocaleDateString('ar-EG')}
                                                {msg.is_read && <CheckCheck className="w-3 h-3 text-blue-400"/>}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.message}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
