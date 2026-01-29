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

// دالة مساعدة لتنسيق الوقت
const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);
    
    if (diffInMinutes < 1) return 'الآن';
    if (diffInMinutes < 60) return `منذ ${diffInMinutes} د`;
    if (diffInMinutes < 1440) return `منذ ${Math.floor(diffInMinutes / 60)} س`;
    return date.toLocaleDateString('ar-EG', {month: 'short', day: 'numeric'});
};

export default function AdminMessagesTab({ employees }: { employees: Employee[] }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🟢 حالة للمستخدمين الأونلاين (Realtime)
  const [onlineUsersMap, setOnlineUsersMap] = useState<Set<string>>(new Set());

  // --- 1. إعداد الـ Realtime Presence ---
  useEffect(() => {
    const channel = supabase.channel('online_users_room');
    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        // نستخرج معرفات الموظفين المتواجدين (نفترض أن المفتاح هو user_id أو يتم ربطه بالموظف)
        // هنا سنعتمد على الـ user_id الذي تم إرساله في الـ track
        const onlineIds = new Set<string>();
        Object.values(newState).forEach((users: any) => {
            users.forEach((u: any) => {
                // نحاول مطابقة الاسم أو الإيميل مع الموظفين الموجودين
                // الأفضل لو كنا نرسل employee_id في الـ track، لكن سنبحث بالاسم كحل مؤقت
                const emp = employees.find(e => e.name === u.name || e.employee_id === u.user_id); // تعديل حسب هيكل البيانات
                if (emp) onlineIds.add(emp.employee_id);
            });
        });
        setOnlineUsersMap(onlineIds);
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [employees]);

  // --- 2. جلب الرسائل ---
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

    // ترتيب المحادثات: الأحدث أولاً
    const sorted = Array.from(convMap.values()).sort((a, b) => {
      const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
      const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
      return timeB - timeA;
    });

    const activeConversations = sorted.filter(c => c.lastMessage !== null); // فقط من لديهم رسائل
    setConversations(activeConversations);
  };

  const selectedConversation = conversations.find(c => c.employee.employee_id === selectedEmpId) 
    // Fallback: إذا اخترنا موظف ليس لديه رسائل سابقة (من القائمة العلوية مثلاً)
    || (selectedEmpId ? { employee: employees.find(e => e.employee_id === selectedEmpId)!, lastMessage: null, unreadCount: 0 } : undefined);
  
  const currentMessages = useMemo(() => {
    if (!selectedEmpId) return [];
    return allMessages.filter(m => 
      m.from_user === selectedEmpId || m.to_user === selectedEmpId
    );
  }, [allMessages, selectedEmpId]);

  const filteredList = conversations.filter(c => 
    c.employee.name.includes(searchTerm) || c.employee.employee_id.includes(searchTerm)
  );

  // --- 3. استخراج آخر 5 متصلين (Last Seen) ---
  const lastActiveEmployees = useMemo(() => {
      return [...employees]
        .filter(e => e.last_seen && !onlineUsersMap.has(e.employee_id)) // استبعاد المتواجدين حالياً
        .sort((a, b) => new Date(b.last_seen!).getTime() - new Date(a.last_seen!).getTime())
        .slice(0, 5);
  }, [employees, onlineUsersMap]);

  // --- 4. استخراج المتواجدين حالياً ---
  const onlineEmployeesList = useMemo(() => {
      return employees.filter(e => onlineUsersMap.has(e.employee_id));
  }, [employees, onlineUsersMap]);


  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-140px)] gap-4 animate-in fade-in">
      
      {/* القائمة الجانبية */}
      <div className={`md:w-1/3 w-full bg-white rounded-[30px] border shadow-sm flex flex-col overflow-hidden ${selectedEmpId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* شريط الحالة العلوية (Active Now) */}
        <div className="bg-gray-50 p-4 border-b space-y-3">
            {/* المتواجدون الآن */}
            {onlineEmployeesList.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar no-scrollbar">
                    {onlineEmployeesList.map(emp => (
                        <div key={emp.id} onClick={() => setSelectedEmpId(emp.employee_id)} className="flex flex-col items-center cursor-pointer min-w-[50px]">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-full bg-green-100 p-0.5 border-2 border-green-500">
                                    {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full rounded-full object-cover"/> : <User className="w-full h-full text-green-600 p-1"/>}
                                </div>
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse"></div>
                            </div>
                            <span className="text-[9px] font-bold mt-1 text-gray-700 truncate w-12 text-center">{emp.name.split(' ')[0]}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* آخر ظهور */}
            {lastActiveEmployees.length > 0 && (
                <div>
                    <h4 className="text-[10px] font-bold text-gray-400 mb-2 flex items-center gap-1"><Clock className="w-3 h-3"/> آخر نشاط</h4>
                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar no-scrollbar">
                        {lastActiveEmployees.map(emp => (
                            <div key={emp.id} onClick={() => setSelectedEmpId(emp.employee_id)} className="flex flex-col items-center cursor-pointer min-w-[50px] opacity-70 hover:opacity-100 transition-opacity">
                                <div className="relative">
                                    <div className="w-9 h-9 rounded-full bg-gray-200 border-2 border-gray-300 overflow-hidden">
                                        {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover"/> : <User className="w-full h-full text-gray-400 p-1"/>}
                                    </div>
                                </div>
                                <span className="text-[8px] font-bold mt-1 text-gray-500 truncate w-12 text-center">{emp.name.split(' ')[0]}</span>
                                <span className="text-[8px] text-gray-400">{formatTimeAgo(emp.last_seen)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* البحث والقائمة */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400"/>
            <input 
              type="text" 
              placeholder="بحث في المحادثات..."
              className="w-full pr-9 pl-3 py-2 rounded-xl border bg-gray-50 text-sm outline-none focus:bg-white focus:border-blue-500 transition-colors"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin"/>
                <span className="text-xs">جاري تحميل الرسائل...</span>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">لا توجد محادثات مطابقة</div>
          ) : (
            filteredList.map((conv) => (
              <div 
                key={conv.employee.id}
                onClick={() => setSelectedEmpId(conv.employee.employee_id)}
                className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 hover:bg-gray-50 ${selectedEmpId === conv.employee.employee_id ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'border border-transparent'}`}
              >
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm">
                    {conv.employee.photo_url ? (
                      <img src={conv.employee.photo_url} alt="" className="w-full h-full object-cover"/>
                    ) : (
                      <User className="w-5 h-5 text-gray-400"/>
                    )}
                  </div>
                  {/* نقطة الأونلاين */}
                  {onlineUsersMap.has(conv.employee.employee_id) && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  )}
                  
                  {conv.unreadCount > 0 && (
                    <div className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-bounce">
                      {conv.unreadCount}
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h4 className={`text-sm font-bold truncate ${selectedEmpId === conv.employee.employee_id ? 'text-blue-700' : 'text-gray-800'}`}>
                      {conv.employee.name}
                    </h4>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-gray-400 whitespace-nowrap">
                        {new Date(conv.lastMessage.created_at).toLocaleDateString('ar-EG', {month: 'short', day: 'numeric'})}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate font-medium flex items-center gap-1">
                    {/* إضافة أيقونة للدلالة على من أرسل آخر رسالة */}
                    {conv.lastMessage?.from_user === 'admin' && <span className="text-blue-400 text-[10px]">أنت:</span>}
                    {conv.lastMessage ? (
                        (conv.lastMessage as any).content || (conv.lastMessage as any).message 
                    ) : (
                        <span className="italic opacity-50">ابدأ المحادثة...</span>
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* منطقة الشات */}
      <div className={`md:w-2/3 w-full bg-white rounded-[30px] border shadow-sm overflow-hidden flex flex-col ${!selectedEmpId ? 'hidden md:flex' : 'flex'}`}>
        {selectedConversation ? (
          <>
            {/* هيدر الشات */}
            <div className="p-3 bg-white border-b flex items-center gap-3 shadow-sm z-10">
                <button onClick={() => setSelectedEmpId(null)} className="md:hidden p-2 bg-gray-50 rounded-full hover:bg-gray-100">
                    <ChevronLeft className="w-5 h-5"/>
                </button>
                
                <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                        {selectedConversation.employee.photo_url ? 
                            <img src={selectedConversation.employee.photo_url} className="w-full h-full object-cover"/> : 
                            <User className="w-full h-full p-2 text-gray-400"/>
                        }
                    </div>
                    {onlineUsersMap.has(selectedConversation.employee.employee_id) && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                    )}
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-gray-800 text-sm">{selectedConversation.employee.name}</h3>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                        {onlineUsersMap.has(selectedConversation.employee.employee_id) ? (
                            <span className="text-green-600 font-bold">متصل الآن</span>
                        ) : (
                            <>آخر ظهور: {formatTimeAgo(selectedConversation.employee.last_seen)}</>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex-1 h-full relative">
               <StaffMessages 
                  messages={currentMessages}
                  employee={selectedConversation.employee}
                  currentUserId="admin"
               />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/50">
            <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <MessageSquare className="w-10 h-10 text-gray-300"/>
            </div>
            <p className="text-lg font-bold text-gray-400">اختر موظفاً لبدء المحادثة</p>
            <p className="text-xs text-gray-400 mt-2">يمكنك التواصل مع الموظفين ومتابعة التحديثات هنا</p>
          </div>
        )}
      </div>

    </div>
  );
}
