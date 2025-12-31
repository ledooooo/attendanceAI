import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, InternalMessage } from '../../../types';
import { Search, User, ChevronLeft, MessageSquare } from 'lucide-react';
import StaffMessages from '../../staff/components/StaffMessages';

interface Conversation {
  employee: Employee;
  lastMessage: InternalMessage | null;
  unreadCount: number;
}

export default function AdminMessagesTab({ employees }: { employees: Employee[] }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // جلب جميع الرسائل المتعلقة بالإدارة
  const fetchMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or('from_user.eq.admin,to_user.eq.admin')
      .order('created_at', { ascending: false });

    if (data) {
      // @ts-ignore: تجاهل أخطاء التوافق المؤقتة
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

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {loading ? (
            <div className="text-center py-10 text-gray-400">جاري التحميل...</div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">لا توجد محادثات سابقة</div>
          ) : (
            filteredList.map((conv) => (
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
                  {conv.unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white">
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
                  <p className="text-xs text-gray-500 truncate font-medium">
                    {conv.lastMessage ? (
                       /* هنا تم الإصلاح: استخدام any لتجنب خطأ content */
                       (conv.lastMessage as any).content || (conv.lastMessage as any).message 
                    ) : (
                       <span className="italic opacity-50">لا توجد رسائل</span>
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
            <div className="md:hidden p-3 bg-gray-50 border-b flex items-center gap-2">
                <button onClick={() => setSelectedEmpId(null)} className="p-2 bg-white rounded-full shadow-sm">
                    <ChevronLeft className="w-5 h-5"/>
                </button>
                <span className="font-bold text-gray-800">{selectedConversation.employee.name}</span>
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
