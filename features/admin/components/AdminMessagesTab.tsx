import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, InternalMessage } from '../../../types';
import { Search, User, ChevronLeft, MessageSquare, Wifi, Clock } from 'lucide-react';
import StaffMessages from '../../staff/components/StaffMessages';

interface Conversation {
  employee: Employee;
  lastMessage: InternalMessage | null;
  unreadCount: number;
}

// دالة مساعدة لتنسيق الوقت النسبي
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
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ 1. حالة المتواجدين الآن (Realtime)
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]); // نخزن IDs فقط

  // ✅ 2. جلب وتتبع المتواجدين الآن
  useEffect(() => {
    const channel = supabase.channel('online_users_room');
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        // نستخرج الـ user_id للمتصلين (لأننا نستخدم user.id كـ key في OnlineTracker)
        // ولكننا نحتاج لربطه بـ employee_id.
        // الحل الأبسط: سنفترض أن OnlineTracker يرسل employee_id أو سنعتمد على last_seen الحديث جداً كبديل
        // الأفضل: OnlineTracker يرسل employee_id في الـ payload. 
        // سنفترض هنا أن الـ payload يحتوي على employee_id أو name مطابق.
        
        // إذا كان OnlineTracker يرسل user_id فقط، سنحتاج لطريقة للربط.
        // للتبسيط الآن، سنعتمد على تحديث last_seen في قاعدة البيانات كـ "شبه realtime" 
        // أو سنستخدم الـ Realtime Presence إذا كان الاسم متطابقاً.
        
        const users = Object.values(newState).map((u: any) => u[0]);
        // سنخزن الأسماء أو المعرفات المتصلة
        const onlineIds = users.map(u => u.name); // سنفترض أن الاسم هو الرابط
        // أو الأفضل البحث في employees عن الاسم المطابق
        const activeEmps = employees.filter(e => users.some(u => u.name === e.name)).map(e => e.employee_id);
        setOnlineUsers(activeEmps);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [employees]);

  // ✅ 3. حساب آخر 5 موظفين ظهوراً (غير المتصلين حالياً)
  const lastSeenEmployees = useMemo(() => {
      return employees
        .filter(e => !onlineUsers.includes(e.employee_id) && e.last_seen) // استبعاد المتصلين
        .sort((a, b) => new Date(b.last_seen!).getTime() - new Date(a.last_seen!).getTime()) // الأحدث أولاً
        .slice(0, 5); // أول 5 فقط
  }, [employees, onlineUsers]);


  // جلب الرسائل
  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or('from_user.eq.admin,to_user.eq.admin')
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
      .channel('admin_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
         if (payload.new.to_user === 'admin' || payload.new.from_user === 'admin') {
             fetchMessages(); 
         }
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, [employees]); 

  const processConversations = (msgs: InternalMessage[]) => {
    const convMap = new Map<string, Conversation>();

    employees.forEach(emp => {
      convMap.set(emp.employee_id, {
        employee: emp,
        lastMessage: null,
        unreadCount: 0
      });
    });

    msgs.forEach(msg => {
      const otherPartyId = msg.from_user === 'admin' ? msg.to_user : msg.from_user;
      
      const conv = convMap.get(otherPartyId);
      if (conv) {
        if (!conv.lastMessage) {
          conv.lastMessage = msg;
        }
        if (!msg.is_read && msg.to_user === 'admin') {
          conv.unreadCount++;
        }
      }
    });

    const sorted = Array.from(convMap.values()).sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return timeB - timeA;
    });

    // نعرض فقط من لديهم رسائل أو نبحث عنهم
    const activeConversations = sorted.filter(c => c.lastMessage !== null || searchTerm);
    setConversations(activeConversations);
  };

  const selectedConversation = conversations.find(c => c.employee.employee_id === selectedEmpId);
  
  const currentMessages = useMemo(() => {
    if (!selectedEmpId) return [];
    return allMessages.filter(m => 
      m.from_user === selectedEmpId || m.to_user === selectedEmpId
    );
  }, [allMessages, selectedEmpId]);

  const filteredList = conversations.filter(c => 
    c.employee.name.includes(searchTerm) || c.employee.employee_id.includes(searchTerm)
  );

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] gap-4 animate-in fade-in">
      
      {/* القائمة الجانبية */}
      <div className={`md:w-1/3 w-full bg-white rounded-[30px] border shadow-sm flex flex-col overflow-hidden ${selectedEmpId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* ترويسة البحث */}
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

        {/* ✅ شريط الحالة (الأونلاين + آخر ظهور) */}
        <div className="px-4 py-3 bg-white border-b overflow-x-auto flex gap-3 no-scrollbar">
            {/* المتواجدون الآن */}
            {onlineUsers.map(empId => {
                const emp = employees.find(e => e.employee_id === empId);
                if (!emp) return null;
                return (
                    <div key={empId} onClick={() => setSelectedEmpId(empId)} className="flex flex-col items-center gap-1 cursor-pointer min-w-[60px]">
                        <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-gray-100 p-0.5 border-2 border-green-500">
                                {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full rounded-full object-cover" alt=""/> : <User className="w-full h-full text-gray-400 p-1"/>}
                            </div>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                        </div>
                        <span className="text-[10px] font-bold text-gray-700 truncate w-14 text-center">{emp.name.split(' ')[0]}</span>
                    </div>
                );
            })}

            {/* آخر ظهور (الغير متصلين) */}
            {lastSeenEmployees.map(emp => (
                <div key={emp.id} onClick={() => setSelectedEmpId(emp.employee_id)} className="flex flex-col items-center gap-1 cursor-pointer min-w-[60px] opacity-70 hover:opacity-100 transition-opacity">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gray-100 p-0.5 border-2 border-gray-200">
                            {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full rounded-full object-cover" alt=""/> : <User className="w-full h-full text-gray-400 p-1"/>}
                        </div>
                        <span className="absolute bottom-0 right-0 bg-gray-100 text-[8px] font-bold text-gray-500 px-1 rounded-full border border-gray-200 shadow-sm whitespace-nowrap">
                            {formatRelativeTime(emp.last_seen)}
                        </span>
                    </div>
                    <span className="text-[10px] text-gray-500 truncate w-14 text-center">{emp.name.split(' ')[0]}</span>
                </div>
            ))}
        </div>

        {/* قائمة المحادثات */}
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
                    onClick={() => setSelectedEmpId(conv.employee.employee_id)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 hover:bg-gray-50 ${selectedEmpId === conv.employee.employee_id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'border border-transparent'}`}
                >
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                            {conv.employee.photo_url ? (
                            <img src={conv.employee.photo_url} alt="" className="w-full h-full object-cover"/>
                            ) : (
                            <User className="w-5 h-5 text-gray-500"/>
                            )}
                        </div>
                        {/* مؤشر الحالة */}
                        {isOnline && (
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                        )}
                        {conv.unreadCount > 0 && (
                            <div className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                            {conv.unreadCount}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                            <h4 className={`text-sm font-bold truncate ${selectedEmpId === conv.employee.employee_id ? 'text-blue-700' : 'text-gray-800'}`}>
                            {conv.employee.name}
                            </h4>
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                                {conv.lastMessage ? new Date(conv.lastMessage.created_at).toLocaleDateString('ar-EG', {month: 'short', day: 'numeric'}) : 
                                 formatRelativeTime(conv.employee.last_seen) // عرض آخر ظهور إذا لم تكن هناك رسالة
                                }
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate font-medium flex items-center gap-1">
                            {conv.lastMessage ? (
                                <>
                                    {conv.lastMessage.from_user === 'admin' && <span className="text-blue-500">أنت: </span>}
                                    {(conv.lastMessage as any).message || 'مرفق'}
                                </>
                            ) : (
                                <span className="italic opacity-50">ابدأ محادثة جديدة</span>
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
      <div className={`md:w-2/3 w-full bg-white rounded-[30px] border shadow-sm overflow-hidden flex flex-col ${!selectedEmpId ? 'hidden md:flex' : 'flex'}`}>
        {selectedConversation ? (
          <>
            <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedEmpId(null)} className="md:hidden p-2 bg-white rounded-full shadow-sm">
                        <ChevronLeft className="w-5 h-5"/>
                    </button>
                    
                    <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden">
                            {selectedConversation.employee.photo_url ? 
                                <img src={selectedConversation.employee.photo_url} className="w-full h-full object-cover"/> : 
                                <User className="w-full h-full p-2 text-gray-500"/>
                            }
                        </div>
                        {onlineUsers.includes(selectedConversation.employee.employee_id) && 
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
                        }
                    </div>

                    <div>
                        <h3 className="font-bold text-gray-800 text-sm">{selectedConversation.employee.name}</h3>
                        <p className="text-[10px] text-gray-500 flex items-center gap-1">
                            {onlineUsers.includes(selectedConversation.employee.employee_id) ? 
                                <span className="text-green-600 font-bold">متصل الآن</span> : 
                                <span className="flex items-center gap-1"><Clock className="w-3 h-3"/> آخر ظهور: {formatRelativeTime(selectedConversation.employee.last_seen)}</span>
                            }
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 h-full bg-[#f0f2f5]">
               <StaffMessages 
                  messages={currentMessages}
                  employee={selectedConversation.employee}
                  currentUserId="admin"
               />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/50">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400"/>
            </div>
            <p className="text-lg font-bold text-gray-500">اختر موظفاً لبدء المحادثة</p>
            <p className="text-xs text-gray-400 mt-2">يمكنك رؤية المتواجدين في الشريط العلوي</p>
          </div>
        )}
      </div>

    </div>
  );
}
