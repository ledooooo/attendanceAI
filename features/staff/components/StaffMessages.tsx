import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Inbox, Check, CheckCheck, Loader2, Users, User, ArrowRight, Bell, MessageSquare } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import { Employee, InternalMessage } from '../../../types';
import toast from 'react-hot-toast';

interface Props {
    messages?: InternalMessage[]; 
    employee: Employee;
    currentUserId: string;
}

const PRIVILEGED_ROLES = ['admin', 'head_of_dept', 'quality_manager'];

export default function StaffMessages({ employee }: Props) {
    const [newMessage, setNewMessage] = useState('');
    const [localMessages, setLocalMessages] = useState<InternalMessage[]>([]);
    const [contacts, setContacts] = useState<Employee[]>([]);
    
    // حالة لتحديد المحادثة النشطة: 
    // null = شاشة اختيار جهة الاتصال
    // 'general' = شات جماعي للجميع
    // 'group' = شات الإدارة
    // 'employee_id' = شات فردي
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const isPrivileged = PRIVILEGED_ROLES.includes(employee.role);
    const myId = employee.employee_id;

    // 1. جلب جهات الاتصال
    useEffect(() => {
        const fetchContacts = async () => {
            let query = supabase.from('employees').select('*').eq('status', 'نشط').neq('employee_id', myId);

            if (employee.role === 'admin') {
                // المدير يرى الجميع
            } else {
                // الموظف العادي يرى الإدارة ورؤساء الأقسام ومسؤول الجودة
                query = query.in('role', PRIVILEGED_ROLES);
            }

            const { data } = await query;
            if (data) setContacts(data as Employee[]);
        };
        fetchContacts();
    }, [employee.role, myId]);

    // 2. جلب الرسائل (الخاصة، العامة، وإدارة)
    const fetchMessages = async () => {
        setLoading(true);
        let query = supabase.from('messages').select('*').order('created_at', { ascending: false });

        let queryStr = `from_user.eq.${myId},to_user.eq.${myId},to_user.eq.general_group`;
        if (isPrivileged) {
            queryStr += `,to_user.eq.group_managers`;
        }
        
        query = query.or(queryStr);

        const { data } = await query;
        if (data) setLocalMessages(data as any);
        setLoading(false);
    };

    useEffect(() => {
        fetchMessages();
    }, [myId, isPrivileged]);

    // 3. الاشتراك اللحظي (Real-time)
    useEffect(() => {
        const channel = supabase
            .channel('staff_messages_channel')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const newMsg = payload.new as InternalMessage;
                    if (
                        newMsg.to_user === myId || 
                        newMsg.from_user === myId || 
                        newMsg.to_user === 'general_group' ||
                        (newMsg.to_user === 'group_managers' && isPrivileged)
                    ) {
                        setLocalMessages((prev) => [newMsg, ...prev]);
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [myId, isPrivileged]);

    // 4. التمرير لأسفل عند فتح شات
    useEffect(() => {
        if (activeChatId) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [localMessages, activeChatId]);

    // تحديد الرسائل كمقروءة للشات الفردي
    useEffect(() => {
        if (activeChatId && activeChatId !== 'group' && activeChatId !== 'general') {
            const markAsRead = async () => {
                const unreadIds = localMessages
                    .filter(m => !m.is_read && m.to_user === myId && m.from_user === activeChatId)
                    .map(m => m.id);

                if (unreadIds.length > 0) {
                    await supabase.from('messages').update({ is_read: true }).in('id', unreadIds);
                    setLocalMessages(prev => prev.map(m => unreadIds.includes(m.id) ? { ...m, is_read: true } : m));
                }
            };
            markAsRead();
        }
    }, [activeChatId, localMessages, myId]);

    // 5. فلترة الرسائل النشطة
    const activeMessages = useMemo(() => {
        if (!activeChatId) return [];
        
        if (activeChatId === 'general') {
            return localMessages.filter(m => m.to_user === 'general_group');
        } else if (activeChatId === 'group') {
            return localMessages.filter(m => m.to_user === 'group_managers');
        } else {
            return localMessages.filter(m => 
                (m.from_user === myId && m.to_user === activeChatId) || 
                (m.from_user === activeChatId && m.to_user === myId)
            );
        }
    }, [localMessages, activeChatId, myId]);

    // 6. دالة الإرسال مع الإشعارات المتكاملة (In-App + Push)
    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeChatId) return;
        setSending(true);

        const isGeneral = activeChatId === 'general';
        const isGroup = activeChatId === 'group';
        const msgContent = newMessage;

        const toUserStr = isGeneral ? 'general_group' : isGroup ? 'group_managers' : activeChatId;

        const payload = {
            from_user: myId,
            to_user: toUserStr,
            content: msgContent,
            is_read: (isGroup || isGeneral) ? true : false
        };

        const { error } = await supabase.from('messages').insert(payload);

        if (!error) {
            setNewMessage('');
            
            // --- إرسال الإشعارات ---
            try {
                let targetEmps: any[] = [];
                let notifTitle = '';

                if (isGeneral) {
                    const { data } = await supabase.from('employees').select('id, employee_id').eq('status', 'نشط').neq('employee_id', myId);
                    targetEmps = data || [];
                    notifTitle = `📣 نقاش عام: ${employee.name}`;
                } else if (isGroup) {
                    const { data } = await supabase.from('employees').select('id, employee_id').eq('status', 'نشط').in('role', PRIVILEGED_ROLES).neq('employee_id', myId);
                    targetEmps = data || [];
                    notifTitle = `👥 الإدارة: ${employee.name}`;
                } else {
                    const target = contacts.find(c => c.employee_id === activeChatId);
                    if (target) targetEmps = [target];
                    notifTitle = `💬 رسالة من: ${employee.name}`;
                }

                if (targetEmps.length > 0) {
                    // 1. إدراج إشعارات داخل التطبيق (جرس التنبيهات)
                    const appNotifs = targetEmps.map(emp => ({
                        user_id: emp.employee_id,
                        title: notifTitle,
                        message: msgContent.substring(0, 60),
                        type: 'message',
                        is_read: false
                    }));
                    await supabase.from('notifications').insert(appNotifs);

                    // 2. إرسال Push Notifications (خارج التطبيق)
                    const pushTargetIds = targetEmps.map(emp => emp.id).filter(Boolean);
                    if (pushTargetIds.length > 0) {
                        await supabase.functions.invoke('send-push-notification', {
                            body: {
                                userIds: pushTargetIds,
                                title: notifTitle,
                                body: msgContent.substring(0, 50),
                                url: '/messages'
                            }
                        });
                    }
                }
            } catch (err) {
                console.error("Notifications Error:", err);
            }
            
        } else {
            toast.error('فشل الإرسال: ' + error.message);
        }
        setSending(false);
    };

    const getUnreadCount = (senderId: string) => {
        return localMessages.filter(m => !m.is_read && m.to_user === myId && m.from_user === senderId).length;
    };

    const activeContactName = activeChatId === 'general' ? 'نقاش عام للجميع' 
        : activeChatId === 'group' ? 'غرفة الإدارة' 
        : contacts.find(c => c.employee_id === activeChatId)?.name || 'مستخدم';

    return (
        <div className="h-[650px] flex bg-white rounded-[30px] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in duration-500 relative">
            
            {/* القائمة الجانبية (جهات الاتصال) */}
            <div className={`w-full md:w-1/3 bg-gray-50 border-l border-gray-100 flex flex-col transition-transform ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-5 border-b border-gray-200 bg-white">
                    <h3 className="font-black text-gray-800 text-lg flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-blue-600"/> المراسلات
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                    
                    {/* الغرفة العامة للجميع */}
                    <button 
                        onClick={() => setActiveChatId('general')}
                        className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all mb-2 ${activeChatId === 'general' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-white border border-gray-100 hover:bg-emerald-50 hover:border-emerald-200 text-gray-700'}`}
                    >
                        <div className={`p-2 rounded-full ${activeChatId === 'general' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-600'}`}>
                            <Users className="w-5 h-5"/>
                        </div>
                        <div className="text-right flex-1">
                            <h4 className="font-bold text-sm">نقاش عام</h4>
                            <p className={`text-[10px] font-medium mt-0.5 ${activeChatId === 'general' ? 'text-emerald-100' : 'text-gray-400'}`}>الجميع متواجد هنا</p>
                        </div>
                    </button>

                    {/* غرفة الإدارة (تظهر لأصحاب الصلاحيات فقط) */}
                    {isPrivileged && (
                        <button 
                            onClick={() => setActiveChatId('group')}
                            className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all ${activeChatId === 'group' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 text-gray-700'}`}
                        >
                            <div className={`p-2 rounded-full ${activeChatId === 'group' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}>
                                <Users className="w-5 h-5"/>
                            </div>
                            <div className="text-right flex-1">
                                <h4 className="font-bold text-sm">غرفة الإدارة</h4>
                                <p className={`text-[10px] font-medium mt-0.5 ${activeChatId === 'group' ? 'text-indigo-100' : 'text-gray-400'}`}>خاص بالإدارة ورؤساء الأقسام</p>
                            </div>
                        </button>
                    )}

                    {/* قائمة الأفراد */}
                    <div className="pt-2 pb-1 px-2">
                        <span className="text-xs font-black text-gray-400 uppercase tracking-wider">
                            {employee.role === 'admin' ? 'جميع الموظفين' : 'الإدارة ورؤساء الأقسام'}
                        </span>
                    </div>

                    {contacts.length === 0 ? (
                        <p className="text-center text-xs text-gray-400 py-4">لا توجد جهات اتصال متاحة</p>
                    ) : (
                        contacts.map(contact => {
                            const unread = getUnreadCount(contact.employee_id);
                            const isActive = activeChatId === contact.employee_id;
                            return (
                                <button 
                                    key={contact.id}
                                    onClick={() => setActiveChatId(contact.employee_id)}
                                    className={`w-full p-3 rounded-2xl flex items-center gap-3 transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border border-gray-100 hover:bg-blue-50 text-gray-700'}`}
                                >
                                    <div className="relative">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                            {contact.name.charAt(0)}
                                        </div>
                                        {unread > 0 && (
                                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                                                {unread}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-right flex-1 overflow-hidden">
                                        <h4 className="font-bold text-sm truncate">{contact.name}</h4>
                                        <p className={`text-[10px] font-medium truncate mt-0.5 ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>{contact.specialty}</p>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* نافذة الدردشة */}
            <div className={`flex-1 flex flex-col bg-white ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
                
                {!activeChatId ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <MessageSquare className="w-20 h-20 mb-4 opacity-20"/>
                        <p className="font-bold text-lg text-gray-300">اختر محادثة للبدء</p>
                    </div>
                ) : (
                    <>
                        {/* Header Chat */}
                        <div className="p-4 bg-white border-b border-gray-100 flex items-center gap-3 shrink-0 shadow-sm z-10">
                            <button onClick={() => setActiveChatId(null)} className="md:hidden p-2 bg-gray-50 rounded-full text-gray-600 hover:bg-gray-200">
                                <ArrowRight className="w-5 h-5"/>
                            </button>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${activeChatId === 'general' ? 'bg-emerald-100 text-emerald-600' : activeChatId === 'group' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                                {(activeChatId === 'group' || activeChatId === 'general') ? <Users className="w-5 h-5"/> : <User className="w-5 h-5"/>}
                            </div>
                            <div>
                                <h4 className="font-black text-gray-800 text-base">{activeContactName}</h4>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar bg-slate-50 flex flex-col-reverse">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2"/>
                                </div>
                            ) : activeMessages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50">
                                    <p className="font-bold">ابدأ المحادثة الآن!</p>
                                </div>
                            ) : (
                                activeMessages.map(msg => {
                                    const isMe = msg.from_user === myId;
                                    // إذا كان شات جماعي/عام، نود إظهار اسم المرسل بجوار رسالته (إذا لم أكن أنا)
                                    const senderName = !isMe && (activeChatId === 'group' || activeChatId === 'general')
                                        ? contacts.find(c => c.employee_id === msg.from_user)?.name || 'زميل'
                                        : null;

                                    return (
                                        <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                                
                                                {senderName && (
                                                    <span className="text-[10px] font-black text-gray-500 mb-1 ml-2">{senderName}</span>
                                                )}

                                                <div className={`p-4 rounded-2xl shadow-sm relative text-sm font-medium leading-relaxed ${
                                                    isMe 
                                                    ? 'bg-blue-600 text-white rounded-br-sm' 
                                                    : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
                                                }`}>
                                                    {msg.content || msg.message || <span className="italic opacity-50">...</span>} 
                                                </div>
                                                
                                                <div className="flex items-center gap-1 mt-1 px-1">
                                                    <span className="text-[9px] font-bold text-gray-400">
                                                        {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isMe && activeChatId !== 'group' && activeChatId !== 'general' && (
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
                        <form onSubmit={handleSend} className="p-3 md:p-4 bg-white border-t border-gray-100 flex gap-2 items-center">
                            <input 
                                type="text" 
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="اكتب رسالتك هنا..." 
                                className="flex-1 pl-4 pr-4 py-3 md:py-4 bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-blue-200 outline-none font-bold text-gray-700 placeholder-gray-400 transition-all text-sm"
                            />
                            <button 
                                type="submit" 
                                disabled={!newMessage.trim() || sending} 
                                className={`p-3 md:p-4 rounded-2xl text-white transition-all shadow-lg active:scale-95 flex items-center justify-center
                                    ${!newMessage.trim() || sending ? 'bg-gray-300 shadow-none' : activeChatId === 'general' ? 'bg-emerald-600 hover:bg-emerald-700' : activeChatId === 'group' ? 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-indigo-200' : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200'}
                                `}
                            >
                                {sending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5 rtl:rotate-180"/>}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
