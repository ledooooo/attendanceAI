import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, InternalMessage } from '../../../types';
import { Search, User, ChevronLeft, MessageSquare, Clock, Wifi } from 'lucide-react';
import StaffMessages from '../../staff/components/StaffMessages';

interface Conversation {
  employee: Employee;
  lastMessage: InternalMessage | null;
  unreadCount: number;
}

// دالة تنسيق الوقت (للرسائل وآخر ظهور)
const formatTime = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // إذا كان أقل من 24 ساعة
    if (diff < 24 * 60 * 60 * 1000) {
        return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }
    // إذا كان أمس
    if (diff < 48 * 60 * 60 * 1000) {
        return 'أمس';
    }
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
};

// دالة تنسيق آخر ظهور (نصي)
const formatLastSeenText = (dateString: string | null) => {
    if (!dateString) return 'غير معروف';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  
    if (diffInMinutes < 1) return 'نشط الآن';
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} دقيقة`;
    if (diffInMinutes < 1440) return `منذ ${Math.floor(diffInMinutes / 60)} ساعة`;
    return date.toLocaleDateString('ar-EG', { day:'numeric', month:'short' });
};

export default function AdminMessagesTab({ employees }: { employees: Employee[] }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // ✅ حالة المتواجدين الآن
  const [onlineUserEmails, setOnlineUserEmails] = useState<Set<string>>(new Set());

  // --- 1. الاستماع للمتواجدين (Realtime Presence) ---
  useEffect(() => {
    const channel = supabase.channel('online_users_room');
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const users = Object.values(newState).map((u: any) => u[0]);
        // نفترض أن الربط يتم عبر الايميل كما في OnlineTracker
        // أو يمكن استخدام user_id ومطابقته مع الموظفين
        const emails = new Set(users.map((u: any) => u.email || '')); 
        setOnlineUserEmails(emails);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  // --- 2. حساب آخر 10 موظفين نشاطاً ---
  const recentlyActiveEmployees = useMemo(() => {
      // نسخ المصفوفة لعدم التعديل على الأصل
      return [...employees]
        .sort((a, b) => {
            // الأولوية للمتواجدين حالياً
            const isOnlineA = a.email && onlineUserEmails.has(a.email);
            const isOnlineB = b.email && onlineUserEmails.has(b.email);
            if (isOnlineA && !isOnlineB) return -1;
            if (!isOnlineA && isOnlineB) return 1;

            // ثم الترتيب حسب last_seen
            const timeA = a.last_seen ? new Date(a.last_seen).getTime() : 0;
            const timeB = b.last_seen ? new Date(b.last_seen).getTime() : 0;
            return timeB - timeA;
        })
        .slice(0, 10); // أخذ أول 10 فقط
  }, [employees, onlineUserEmails]);

  // --- 3. جلب الرسائل ---
  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or('from_user.eq.admin,to_user.eq.admin')
      .order('created_at', { ascending: false });

    if (data) {
      // @ts-ignore
      setAllMessages(data);
      // @ts-ignore
      processConversations(data);
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

    const activeConversations = sorted.filter(c => c.lastMessage !== null);
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
        
        <div className="p-4 border-b bg-gray-50 space-y-4">
          <h3 className="font-black text-gray-800 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600"/> المحادثات
          </h3>

          {/* ✅ شريط آخر نشاط (Last Active) */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1">
                <Wifi className="w-3 h-3"/> نشط مؤخراً
            </p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {recentlyActiveEmployees.map(emp => {
                    const isOnline = emp.email && onlineUserEmails.has(emp.email);
                    return (
                        <div 
                            key={emp.id} 
                            onClick={() => setSelectedEmpId(emp.employee_id)}
                            className="flex flex-col items-center cursor-pointer min-w-[50px] group"
                        >
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full p-0.5 border-2 border-transparent group-hover:border-blue-400 transition-all">
                                    <img 
                                        src={emp.photo_url || `https://ui-avatars.com/api/?name=${emp.name}&background=random`} 
                                        className="w-full h-full rounded-full object-cover bg-gray-200" 
                                        alt={emp.name}
                                    />
                                </div>
                                {isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                            </div>
                            <span className="text-[10px] text-gray-600 truncate w-14 text-center mt-1">{emp.name.split(' ')[0]}</span>
                        </div>
                    );
                })}
            </div>
          </div>

          {/* البحث */}
          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400"/>
            <input 
              type="text" 
              placeholder="بحث عن موظف..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border text-sm outline-none focus:border-blue-500 bg-white"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {loading ? (
            <div className="text-center py-10 text-gray-400">جاري التحميل...</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">لا توجد محادثات سابقة</div>
          ) : (
            filteredList.map((conv) => {
                const isOnline = conv.employee.email && onlineUserEmails.has(conv.employee.email);
                
                return (
                  <div 
                    key={conv.employee.id}
                    onClick={() => setSelectedEmpId(conv.employee.employee_id)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 hover:bg-gray-50 ${selectedEmpId === conv.employee.employee_id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'border border-transparent'}`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {conv.employee.photo_url ? (
                          <img src={conv.employee.photo_url} alt="" className="w-full h-full object-cover"/>
                        ) : (
                          <User className="w-6 h-6 text-gray-500"/>
                        )}
                      </div>
                      
                      {/* ✅ مؤشر الحالة */}
                      {isOnline ? (
                          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                      ) : (
                          conv.unreadCount > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">{conv.unreadCount}</div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h4 className={`text-sm font-bold truncate ${selectedEmpId === conv.employee.employee_id ? 'text-blue-700' : 'text-gray-800'}`}>
                          {conv.employee.name}
                        </h4>
                        {/* توقيت الرسالة */}
                        {conv.lastMessage && (
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {formatTime(conv.lastMessage.created_at)}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex justify-between items-center">
                          <p className="text-xs text-gray-500 truncate font-medium max-w-[140px]">
                            {conv.lastMessage ? (
                                (conv.lastMessage as any).content || (conv.lastMessage as any).message 
                            ) : (
                                <span className="italic opacity-50">لا توجد رسائل</span>
                            )}
                          </p>
                          
                          {/* ✅ عرض حالة الاتصال كنص إذا لم يكن متصلاً */}
                          {!isOnline && conv.employee.last_seen && (
                              <span className="text-[9px] text-gray-400 flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {formatLastSeenText(conv.employee.last_seen)}
                              </span>
                          )}
                          {isOnline && <span className="text-[9px] text-green-600 font-bold">متصل</span>}
                      </div>
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
            <div className="p-3 bg-gray-50 border-b flex items-center gap-3">
                {/* زر رجوع للموبايل */}
                <button onClick={() => setSelectedEmpId(null)} className="md:hidden p-2 bg-white rounded-full shadow-sm hover:bg-gray-100">
                    <ChevronLeft className="w-5 h-5"/>
                </button>
                
                {/* هيدر الشات */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <img 
                            src={selectedConversation.employee.photo_url || `https://ui-avatars.com/api/?name=${selectedConversation.employee.name}`} 
                            className="w-10 h-10 rounded-full object-cover bg-gray-200"
                            alt=""
                        />
                        {selectedConversation.employee.email && onlineUserEmails.has(selectedConversation.employee.email) && (
                            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-sm">{selectedConversation.employee.name}</h3>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            {selectedConversation.employee.email && onlineUserEmails.has(selectedConversation.employee.email) ? (
                                <span className="text-green-600 font-bold">نشط الآن</span>
                            ) : (
                                <span>آخر ظهور: {formatLastSeenText(selectedConversation.employee.last_seen)}</span>
                            )}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex-1 h-full">
               <StaffMessages 
                  messages={currentMessages}
                  employee={selectedConversation.employee}
                  currentUserId="admin"
               />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20"/>
            <p className="text-lg font-bold">اختر موظفاً لبدء المحادثة</p>
          </div>
        )}
      </div>

    </div>
  );
}
