import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSwipeable } from 'react-swipeable';
import { 
    LogOut, Menu, X, LayoutDashboard, UserCheck, 
    Gift, FileText, Award, Loader2, Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupervisorDashboard() {
    const { user, signOut } = useAuth();
    const queryClient = useQueryClient();
    
    const [activeTab, setActiveTab] = useState('home');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // بيانات استكمال الملف
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [formData, setFormData] = useState({
        national_id: '',
        start_date: '',
        qualification: '',
        specialty: '',
        training_courses: '',
        notes: ''
    });

    // 1. جلب بيانات المشرف الحالي
    const { data: supervisor, isLoading } = useQuery({
        queryKey: ['current_supervisor', user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase
                .from('supervisors')
                .select('*')
                .eq('id', user.id)
                .single();
            
            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    // فتح نافذة الاستكمال إذا لم يكن الملف مكتملاً
    useEffect(() => {
        if (supervisor && !supervisor.profile_completed) {
            setShowCompletionModal(true);
        }
    }, [supervisor]);

    // 2. تحديث بيانات المشرف وإضافة النقاط
    const completeProfileMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            if (!user?.id) throw new Error("User not found");

            // تحديث البيانات في جدول المشرفين وإضافة 150 نقطة
            const newPoints = (supervisor?.total_points || 0) + 150;

            const { error } = await supabase
                .from('supervisors')
                .update({
                    ...data,
                    profile_completed: true,
                    total_points: newPoints
                })
                .eq('id', user.id);

            if (error) throw error;

            // تسجيل النقاط في السجل (Ledger)
            await supabase.from('points_ledger').insert({
                employee_id: user.id, // نستخدم ID المشرف كـ employee_id في السجل
                points: 150,
                reason: 'هدية ترحيبية + استكمال الملف الشخصي 🎉'
            });
        },
        onSuccess: () => {
            toast.success('تم استكمال الملف بنجاح! حصلت على 150 نقطة 🎁', { duration: 5000 });
            setShowCompletionModal(false);
            queryClient.invalidateQueries({ queryKey: ['current_supervisor'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    const swipeHandlers = useSwipeable({
        onSwipedLeft: (eventData) => { if (eventData.initial[0] > window.innerWidth / 2) setIsSidebarOpen(true); },
        onSwipedRight: () => setIsSidebarOpen(false),
        trackMouse: true, delta: 50,
    });

    const menuItems = [
        { id: 'home', label: 'الرئيسية', icon: LayoutDashboard },
        { id: 'reports', label: 'التقارير الإشرافية', icon: FileText },
        { id: 'rewards', label: 'متجر النقاط', icon: Gift },
    ];

    if (isLoading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-purple-600"/></div>;
    }

    return (
        <div {...swipeHandlers} className="h-screen w-full bg-gray-50 flex overflow-hidden font-sans text-right" dir="rtl">
            
            {/* القائمة الجانبية */}
            {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[60] md:hidden" onClick={() => setIsSidebarOpen(false)} />}
            <aside className={`fixed inset-y-0 right-0 z-[70] w-72 bg-white border-l shadow-2xl transform transition-transform duration-300 md:translate-x-0 md:static ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-20 flex items-center justify-between px-6 border-b bg-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="text-3xl">{supervisor?.avatar_url || "👨‍💼"}</div>
                        <div>
                            <h1 className="font-black text-gray-800 text-sm">بوابة الإشراف</h1>
                            <p className="text-[10px] text-gray-500 font-bold">{supervisor?.role_title}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden"><X className="w-6 h-6 text-gray-500"/></button>
                </div>

                <nav className="p-4 space-y-2">
                    {menuItems.map(item => (
                        <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl font-bold transition-all ${activeTab === item.id ? 'bg-purple-600 text-white shadow-md' : 'text-gray-600 hover:bg-purple-50'}`}>
                            <item.icon className="w-5 h-5"/> {item.label}
                        </button>
                    ))}
                </nav>

                <div className="absolute bottom-0 w-full p-4 border-t bg-gray-50">
                    <button onClick={signOut} className="w-full py-3 rounded-xl text-red-500 font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                        <LogOut className="w-5 h-5"/> تسجيل الخروج
                    </button>
                </div>
            </aside>

            {/* المحتوى الرئيسي */}
            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-20 bg-white border-b flex items-center justify-between px-6 shrink-0">
                    <button onClick={() => setIsSidebarOpen(true)} className="md:hidden"><Menu className="w-6 h-6"/></button>
                    <div className="flex items-center gap-4">
                        <div className="bg-yellow-50 text-yellow-600 px-4 py-2 rounded-xl font-black flex items-center gap-2 border border-yellow-100">
                            <Sparkles className="w-4 h-4"/> {supervisor?.total_points || 0} نقطة
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6 bg-gray-50">
                    {activeTab === 'home' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 text-white shadow-lg">
                                <h2 className="text-2xl font-black mb-2">مرحباً بك، {supervisor?.name} 👋</h2>
                                <p className="text-purple-100 font-bold">بوابة الإشراف الخاصة بـ ({supervisor?.organization})</p>
                            </div>
                            <div className="bg-white p-8 rounded-3xl border shadow-sm text-center">
                                <FileText className="w-16 h-16 text-gray-200 mx-auto mb-4"/>
                                <h3 className="text-xl font-black text-gray-600">لوحة التقارير قيد التطوير...</h3>
                                <p className="text-sm text-gray-400 mt-2 font-bold">قريباً ستتمكن من رؤية تقارير مفصلة هنا.</p>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* نافذة استكمال البيانات (تظهر لأول مرة فقط) */}
            {showCompletionModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl p-6 md:p-8 animate-in zoom-in-95">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Award className="w-8 h-8"/>
                            </div>
                            <h2 className="text-xl font-black text-gray-800">خطوة واحدة للبدء!</h2>
                            <p className="text-sm text-gray-500 mt-2 font-bold leading-relaxed">
                                أكمل بياناتك الأساسية الآن واحصل على <span className="text-purple-600 font-black">150 نقطة</span> ترحيبية كهدية مجانية في متجر الجوائز! 🎁
                            </p>
                        </div>

                        <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar p-2">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">الرقم القومي (اختياري)</label>
                                <input type="text" maxLength={14} value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl font-mono text-left" dir="ltr" placeholder="14 رقم"/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">تاريخ استلام العمل بالجهة</label>
                                <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl"/>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">المؤهل الدراسي</label>
                                    <input type="text" value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl"/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">التخصص</label>
                                    <input type="text" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl"/>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">دورات تدريبية حاصل عليها</label>
                                <input type="text" value={formData.training_courses} onChange={e => setFormData({...formData, training_courses: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl" placeholder="مثال: دورة مكافحة العدوى، جودة..."/>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">ملاحظات أخرى</label>
                                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 bg-gray-50 border rounded-xl resize-none h-20"></textarea>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                            <button 
                                onClick={() => completeProfileMutation.mutate(formData)}
                                disabled={completeProfileMutation.isPending}
                                className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-black shadow-lg hover:bg-purple-700 flex justify-center items-center gap-2"
                            >
                                {completeProfileMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : 'حفظ واستلام الهدية 🎁'}
                            </button>
                            <button 
                                onClick={() => setShowCompletionModal(false)}
                                className="px-6 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold hover:bg-gray-200"
                            >
                                تخطي الآن
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
