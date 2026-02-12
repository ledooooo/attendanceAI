import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, InternalMessage } from '../../../types';
import { Search, User, ChevronLeft, MessageSquare, Wifi, Clock, Users, Send, Check, CheckCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Conversation {
  employee: Employee;
  lastMessage: InternalMessage | null;
  unreadCount: number;
}

const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  
    if (diffInMinutes < 1) return 'الآن';
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    if (diffInMinutes < 1440) return `منذ ${Math.floor(diffInMinutes / 60)} ساعة`;
    return date.toLocaleDateString('ar-EG');
};

export default function AdminMessagesTab({ employees }: { employees: Employee[] }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  
  // 'general' = شات عام، 'group' = شات الإدارة، أو ID الموظف
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  
  const [allMessages, setAllMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // 1. تتبع المتواجدين
  useEffect(() => {
    const channel = supabase.channel('online_users_room');
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users = Object.values(newState).map((u: any) => u[0]);
        // نفترض الربط بالاسم كما في السابق
        const activeEmps = employees.filter(e => users.some(u => u.name === e.name)).map(e => e.employee_id);
        setOnlineUsers(activeEmps);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [employees]);

  // 2. جلب الرسائل
  const fetchMessages = async () => {
    setLoading(true);
    // المدير يرى:
    // 1. الرسائل المرسلة منه أو إليه (شات فردي)
    // 2. رسائل الجروب العام
    // 3. رسائل جروب الإدارة
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or('from_user.eq.admin,to_user.eq.admin,to_user.eq.general_group,to_user.eq.group_managers')
      .order('created_at', { ascending: false });

    if (data) {
      setAllMessages(data as InternalMessage[]);
      processConversations(data as InternalMessage[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    const subscription = supabase
      .channel('admin_messages_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
         const newMsg = payload.new;
         // تحديث إذا كانت الرسالة تعني المدير
         if (newMsg.to_user === 'admin' || newMsg.from_user === 'admin' || 
             newMsg.to_user === 'general_group' || newMsg.to_user === 'group_managers') {
             setAllMessages(prev => [newMsg as InternalMessage, ...prev]);
             // نعيد معالجة المحادثات لتحديث آخر رسالة
             fetchMessages(); 
         }
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []); 

  // 3. معالجة المحادثات (للقائمة الجانبية)
  const processConversations = (msgs: InternalMessage[]) => {
    const convMap = new Map<string, Conversation>();

    // ✅ الخطوة الأهم: إضافة جميع الموظفين للخريطة مبدئياً
    employees.forEach(emp => {
      convMap.set(emp.employee_id, {
        employee: emp,
        lastMessage: null,
        unreadCount: 0
      });
    });

    // تحديث البيانات بناءً على الرسائل الموجودة
    msgs.forEach(msg => {
      if (msg.to_user === 'general_group' || msg.to_user === 'group_managers') return;

      const otherPartyId = msg.from_user === 'admin' ? msg.to_user : msg.from_user;
      const conv = convMap.get(otherPartyId);
      
      if (conv) {
        if (!conv.lastMessage) conv.lastMessage = msg;
        if (!msg.is_read && msg.to_user === 'admin') conv.unreadCount++;
      }
    });

    // ترتيب المحادثات: الأحدث أولاً، ثم الأبجدي لمن ليس لديهم رسائل
    const sorted = Array.from(convMap.values()).sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      
      if (timeB !== timeA) {
          return timeB - timeA; // الأحدث وقتاً أولاً
      }
      
      // إذا تساوى الوقت (كلاهما 0)، رتب أبجدياً
      return a.employee.name.localeCompare(b.employee.name);
    });

    // ✅ تم إزالة الفلتر الذي كان يخفي الموظفين بدون رسائل
    setConversations(sorted);
  };

  // 4. فلترة رسائل الشات المفتوح
  const currentChatMessages = useMemo(() => {
    if (!selectedChatId) return [];
    if (selectedChatId === 'general') return allMessages.filter(m => m.to_user === 'general_group');
    if (selectedChatId === 'group') return allMessages.filter(m => m.to_user === 'group_managers');
    
    return allMessages.filter(m => 
      (m.from_user === 'admin' && m.to_user === selectedChatId) || 
      (m.from_user === selectedChatId && m.to_user === 'admin')
    );
  }, [allMessages, selectedChatId]);

  // 5. التمرير لأسفل
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChatMessages, selectedChatId]);

  // 6. الإرسال
  const handleSend = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMessage.trim() || !selectedChatId) return;
      setSending(true);

      const isGeneral = selectedChatId === 'general';
      const isGroup = selectedChatId === 'group';
      const toUser = isGeneral ? 'general_group' : isGroup ? 'group_managers' : selectedChatId;

      const payload = {
          from_user: 'admin',
          to_user: toUser,
          content: newMessage,
          is_read: (isGeneral || isGroup) ? true : false
      };

      const { error } = await supabase.from('messages').insert(payload);

      if (!error) {
          setNewMessage('');
          // إرسال الإشعارات
          try {
              let targetIds: string[] = [];
              let title = '';
              
              if (isGeneral) {
                  targetIds = employees.map(e => e.id).filter(Boolean) as string[];
                  title = '📣 رسالة عامة من المدير';
              } else if (isGroup) {
                  targetIds = employees
                    .filter(e => ['admin', 'head_of_dept', 'quality_manager'].includes(e.role))
                    .map(e => e.id).filter(Boolean) as string[];
                  title = '👥 رسالة لإدارة المركز';
              } else {
                  const target = employees.find(e => e.employee_id === selectedChatId);
                  if (target?.id) targetIds = [target.id];
                  title = '💬 رسالة من المدير';
              }

              if (targetIds.length > 0) {
                  await supabase.functions.invoke('send-push-notification', {
                      body: {
                          userIds: targetIds,
                          title: title,
                          body: newMessage.substring(0, 50),
                          url: '/messages'
                      }
                  });
              }
          } catch (e) { console.error(e); }
      } else {
          toast.error('فشل الإرسال');
      }
      setSending(false);
  };

  const getActiveChatName = () => {
      if (selectedChatId === 'general') return 'نقاش عام للجميع';
      if (selectedChatId === 'group') return 'غرفة الإدارة';
      return conversations.find(c => c.employee.employee_id === selectedChatId)?.employee.name || 'مستخدم';
  };

  const filteredList = conversations.filter(c => 
    c.employee.name.includes(searchTerm) || c.employee.employee_id.includes(searchTerm)
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] gap-4 animate-in fade-in">
      
      {/* القائمة الجانبية */}
      <div className={`md:w-1/3 w-full bg-white rounded-[30px] border shadow-sm flex flex-col overflow-hidden ${selectedChatId ? 'hidden md:flex' : 'flex'}`}>
        
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-black text-gray-800 mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600"/> المحادثات
          </h3>
          <div className="relative">
            <Search className="absolute right-3 top-3 w-4 h-4 text-gray-400"/>
            <input 
              type="text" 
              placeholder="بحث عن موظف..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border text-sm outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* الغرف الثابتة */}
        <div className="p-2 border-b space-y-1">
             <button onClick={() => setSelectedChatId('general')} className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${selectedChatId === 'general' ? 'bg-emerald-600 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}>
                <div className={`p-2 rounded-full ${selectedChatId === 'general' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-600'}`}><Users className="w-4 h-4"/></div>
                <div className="text-right flex-1"><h4 className="font-bold text-xs">نقاش عام</h4></div>
            </button>
            <button onClick={() => setSelectedChatId('group')} className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${selectedChatId === 'group' ? 'bg-indigo-600 text-white' : 'bg-gray-50 hover:bg-gray-100 text-gray-700'}`}>
                <div className={`p-2 rounded-full ${selectedChatId === 'group' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-600'}`}><Users className="w-4 h-4"/></div>
                <div className="text-right flex-1"><h4 className="font-bold text-xs">غرفة الإدارة</h4></div>
            </button>
        </div>

        {/* قائمة الموظفين */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {loading ? (
            <div className="text-center py-10 text-gray-400">جاري التحميل...</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">لا توجد نتائج</div>
          ) : (
            filteredList.map((conv) => {
              const isOnline = onlineUsers.includes(conv.employee.employee_id);
              return (
                <div 
                    key={conv.employee.id}
                    onClick={() => setSelectedChatId(conv.employee.employee_id)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 hover:bg-gray-50 ${selectedChatId === conv.employee.employee_id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'border border-transparent'}`}
                >
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {conv.employee.photo_url ? (
                            <img src={conv.employee.photo_url} alt="" className="w-full h-full object-cover"/>
                            ) : (
                            <User className="w-5 h-5 text-gray-500"/>
                            )}
                        </div>
                        {isOnline && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>}
                        {conv.unreadCount > 0 && <div className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">{conv.unreadCount}</div>}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                            <h4 className={`text-sm font-bold truncate ${selectedChatId === conv.employee.employee_id ? 'text-blue-700' : 'text-gray-800'}`}>{conv.employee.name}</h4>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                {conv.lastMessage ? new Date(conv.lastMessage.created_at).toLocaleDateString('ar-EG', {month: 'short', day: 'numeric'}) : ''}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate font-medium flex items-center gap-1">
                            {conv.lastMessage ? (
                                <>
                                    {conv.lastMessage.from_user === 'admin' && <span className="text-blue-500">أنت: </span>}
                                    {(conv.lastMessage as any).content || 'مرفق'}
                                </>
                            ) : (
                                <span className="italic opacity-50 text-[10px]">انقر لبدء محادثة</span>
                            )}
                        </p>
                    </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* منطقة الشات */}
      <div className={`md:w-2/3 w-full bg-white rounded-[30px] border shadow-sm overflow-hidden flex flex-col ${!selectedChatId ? 'hidden md:flex' : 'flex'}`}>
        {selectedChatId ? (
          <>
            <div className="p-3 bg-gray-50 border-b flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedChatId(null)} className="md:hidden p-2 bg-white rounded-full shadow-sm"><ChevronLeft className="w-5 h-5"/></button>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm ${selectedChatId === 'general' ? 'bg-emerald-100 text-emerald-600' : selectedChatId === 'group' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
                        {(selectedChatId === 'group' || selectedChatId === 'general') ? <Users className="w-5 h-5"/> : <User className="w-5 h-5"/>}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-sm">{getActiveChatName()}</h3>
                        {selectedChatId !== 'general' && selectedChatId !== 'group' && onlineUsers.includes(selectedChatId) && (
                            <span className="text-[10px] text-green-600 font-bold flex items-center gap-1">● متصل الآن</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f0f2f5] flex flex-col-reverse custom-scrollbar">
                {currentChatMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-50"><p>ابدأ المحادثة الآن!</p></div>
                ) : (
                    currentChatMessages.map(msg => {
                        const isMe = msg.from_user === 'admin';
                        const senderName = !isMe && (selectedChatId === 'group' || selectedChatId === 'general') 
                            ? employees.find(e => e.employee_id === msg.from_user)?.name || 'موظف'
                            : null;

                        return (
                            <div key={msg.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    {senderName && <span className="text-[10px] text-gray-500 mb-1 ml-1">{senderName}</span>}
                                    <div className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'}`}>
                                        {msg.content || msg.message}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1 px-1">
                                        <span className="text-[9px] text-gray-400 font-bold">{new Date(msg.created_at).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</span>
                                        {isMe && selectedChatId !== 'group' && selectedChatId !== 'general' && (
                                            msg.is_read ? <CheckCheck className="w-3 h-3 text-blue-500"/> : <Check className="w-3 h-3 text-gray-400"/>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-3 bg-white border-t flex gap-2 items-center">
                <input 
                    type="text" 
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="اكتب رسالتك..." 
                    className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl border-none outline-none focus:ring-2 focus:ring-blue-200 text-sm font-bold"
                />
                <button disabled={!newMessage.trim() || sending} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-colors shadow-lg shadow-blue-200">
                    {sending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-5 h-5 rtl:rotate-180"/>}
                </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/50">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20"/>
            <p className="font-bold text-gray-400">اختر محادثة للبدء</p>
          </div>
        )}
      </div>

    </div>
  );
}
