import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { X, User, Send, Loader2 } from 'lucide-react';

interface Props {
    currentUser: Employee;
    targetDate: string;
    onClose: () => void;
}

export default function ShiftSwapModal({ currentUser, targetDate, onClose }: Props) {
    const [colleagues, setColleagues] = useState<Employee[]>([]);
    const [selectedRecipient, setSelectedRecipient] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // جلب الزملاء في نفس القسم (التخصص)
        const fetchColleagues = async () => {
            const { data } = await supabase
                .from('employees')
                .select('*')
                .eq('specialty', currentUser.specialty) // نفس التخصص
                .neq('employee_id', currentUser.employee_id) // استبعاد النفس
                .eq('status', 'نشط'); // الموظفين النشطين فقط
            
            if (data) setColleagues(data);
        };
        fetchColleagues();
    }, [currentUser]);

    const handleRequest = async () => {
        if (!selectedRecipient) return alert('الرجاء اختيار الطبيب البديل');
        setLoading(true);

        try {
            // 1. إنشاء طلب التحويل
            const { error: reqError } = await supabase.from('shift_swap_requests').insert({
                requester_id: currentUser.employee_id,
                recipient_id: selectedRecipient,
                schedule_date: targetDate,
                status: 'pending_recipient' // الحالة الأولى: انتظار موافقة البديل
            });

            if (reqError) throw reqError;

            // 2. إشعار للطبيب البديل
            await supabase.from('notifications').insert({
                user_id: selectedRecipient,
                title: 'طلب تحويل نوبتجية',
                message: `يرغب د. ${currentUser.name} في تحويل نوبتجية يوم ${targetDate} إليك.`,
                is_read: false
            });

            // 3. إشعار لرئيس القسم (Head of Dept)
            const { data: hods } = await supabase
                .from('employees')
                .select('employee_id')
                .eq('specialty', currentUser.specialty)
                .eq('role', 'head_of_dept');

            if (hods && hods.length > 0) {
                const notifications = hods.map(h => ({
                    user_id: h.employee_id,
                    title: 'طلب تبديل جديد',
                    message: `طلب تحويل من د. ${currentUser.name} إلى زميل آخر ليوم ${targetDate}.`,
                    is_read: false
                }));
                await supabase.from('notifications').insert(notifications);
            }

            // 4. إشعار للمدير (Admin)
            // (اختياري: يمكن تأجيل إشعار المدير لحين موافقة البديل لعدم الإزعاج)
             const { data: admins } = await supabase.from('employees').select('employee_id').eq('role', 'admin');
             if(admins) {
                 await supabase.from('notifications').insert(admins.map(a => ({
                     user_id: a.employee_id,
                     title: 'متابعة النوبتجيات',
                     message: `طلب تحويل نوبتجية في قسم ${currentUser.specialty} ليوم ${targetDate}.`,
                     is_read: false
                 })));
             }

            alert('تم إرسال طلب التحويل بنجاح ✅');
            onClose();

        } catch (error: any) {
            alert('حدث خطأ: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-black text-gray-800">تحويل نوبتجية {targetDate}</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400"/></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <p className="text-sm text-gray-500 font-bold">
                        سيتم إرسال طلب للطبيب البديل، وبعد موافقته يتم اعتماد التغيير من رئيس القسم أو المدير.
                    </p>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-2">اختر الطبيب البديل (نفس التخصص)</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar border rounded-xl p-2">
                            {colleagues.map(col => (
                                <div 
                                    key={col.id} 
                                    onClick={() => setSelectedRecipient(col.employee_id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${
                                        selectedRecipient === col.employee_id 
                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' 
                                        : 'bg-white border-gray-100 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="bg-gray-200 w-8 h-8 rounded-full flex items-center justify-center">
                                        <User className="w-4 h-4 text-gray-600"/>
                                    </div>
                                    <span className="text-sm font-bold text-gray-700">{col.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <button 
                        onClick={handleRequest}
                        disabled={loading || !selectedRecipient}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Send className="w-4 h-4 rtl:rotate-180"/>}
                        إرسال الطلب
                    </button>
                </div>
            </div>
        </div>
    );
}
