import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { 
    Monitor, Stethoscope, Plus, Edit, Trash2, X, Save, 
    Video, Type, Lock, RotateCcw, Loader2
} from 'lucide-react';

export default function AdminQueueSettings() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'screens' | 'clinics'>('screens');
    
    // Modal States
    const [showScreenModal, setShowScreenModal] = useState(false);
    const [showClinicModal, setShowClinicModal] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null);

    // Fetch Data
    const { data: screens = [], isLoading: loadingScreens } = useQuery({
        queryKey: ['q_screens'],
        queryFn: async () => {
            const { data } = await supabase.from('q_screens').select('*').order('created_at');
            return data || [];
        }
    });

    const { data: clinics = [], isLoading: loadingClinics } = useQuery({
        queryKey: ['q_clinics_admin'],
        queryFn: async () => {
            const { data } = await supabase.from('q_clinics').select('*, q_screens(name)').order('name');
            return data || [];
        }
    });

    // Mutations
    const saveScreenMutation = useMutation({
        mutationFn: async (screenData: any) => {
            if (screenData.id) {
                const { error } = await supabase.from('q_screens').update(screenData).eq('id', screenData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('q_screens').insert([screenData]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success('تم حفظ بيانات الشاشة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['q_screens'] });
            setShowScreenModal(false);
        }
    });

    const saveClinicMutation = useMutation({
        mutationFn: async (clinicData: any) => {
            if (clinicData.id) {
                const { error } = await supabase.from('q_clinics').update(clinicData).eq('id', clinicData.id);
                if (error) throw error;
            } else {
                const { error } = await supabase.from('q_clinics').insert([clinicData]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success('تم حفظ بيانات العيادة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['q_clinics_admin'] });
            setShowClinicModal(false);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async ({ table, id }: { table: string, id: string }) => {
            const { error } = await supabase.from(table).delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم الحذف بنجاح');
            queryClient.invalidateQueries({ queryKey: ['q_screens'] });
            queryClient.invalidateQueries({ queryKey: ['q_clinics_admin'] });
        }
    });

    const resetAllQueuesMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.from('q_clinics').update({ current_number: 0 });
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم تصفير جميع أرقام العيادات بنجاح');
            queryClient.invalidateQueries({ queryKey: ['q_clinics_admin'] });
        }
    });

    // Handlers
    const handleEditScreen = (screen: any = null) => {
        setEditingItem(screen || { name: '', password: '', marquee_text: '', video_url: '' });
        setShowScreenModal(true);
    };

    const handleEditClinic = (clinic: any = null) => {
        setEditingItem(clinic || { name: '', doctor_name: '', password: '', screen_id: screens[0]?.id || '' });
        setShowClinicModal(true);
    };

    const handleDelete = (table: string, id: string) => {
        if (confirm('هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذا الإجراء.')) {
            deleteMutation.mutate({ table, id });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in text-right" dir="rtl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div>
                    <h2 className="text-2xl font-black text-gray-800">إعدادات نظام النداء الآلي</h2>
                    <p className="text-sm font-bold text-gray-500 mt-1">إدارة الشاشات، العيادات، والأرقام السرية</p>
                </div>
                <button 
                    onClick={() => { if(confirm('هل أنت متأكد من تصفير جميع العدادات لليوم الجديد؟')) resetAllQueuesMutation.mutate(); }}
                    disabled={resetAllQueuesMutation.isPending}
                    className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-100 transition-colors"
                >
                    <RotateCcw className={`w-5 h-5 ${resetAllQueuesMutation.isPending ? 'animate-spin' : ''}`} /> 
                    تصفير الأرقام لليوم الجديد
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-3 overflow-x-auto pb-2">
                <button onClick={() => setActiveTab('screens')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${activeTab === 'screens' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border'}`}>
                    <Monitor className="w-5 h-5" /> إدارة الشاشات
                </button>
                <button onClick={() => setActiveTab('clinics')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${activeTab === 'clinics' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border'}`}>
                    <Stethoscope className="w-5 h-5" /> إدارة العيادات
                </button>
            </div>

            {/* Screens Content */}
            {activeTab === 'screens' && (
                <div className="bg-white rounded-3xl shadow-sm border p-6 animate-in slide-in-from-right-4">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-gray-800">الشاشات المسجلة ({screens.length})</h3>
                        <button onClick={() => handleEditScreen()} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700">
                            <Plus className="w-4 h-4"/> شاشة جديدة
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {screens.map((screen: any) => (
                            <div key={screen.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow relative group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-100 text-indigo-600 p-3 rounded-xl"><Monitor className="w-6 h-6"/></div>
                                        <div>
                                            <h4 className="font-black text-gray-800 text-lg">{screen.name}</h4>
                                            <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1"><Lock className="w-3 h-3"/> {screen.password}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a href={`/tv-screen?id=${screen.id}`} target="_blank" rel="noreferrer" className="p-2 bg-white text-emerald-600 rounded-lg shadow-sm hover:bg-emerald-50 text-xs font-bold flex items-center gap-1">شاشات العرض</a>
                                        <button onClick={() => handleEditScreen(screen)} className="p-2 bg-white text-blue-600 rounded-lg shadow-sm hover:bg-blue-50"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete('q_screens', screen.id)} className="p-2 bg-white text-red-600 rounded-lg shadow-sm hover:bg-red-50"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <div className="space-y-2 text-xs font-bold text-gray-600 bg-white p-3 rounded-xl border">
                                    <p className="flex items-center gap-2"><Type className="w-4 h-4 text-indigo-400"/> <span className="truncate">{screen.marquee_text}</span></p>
                                    <p className="flex items-center gap-2"><Video className="w-4 h-4 text-pink-400"/> <span className="truncate">{screen.video_url || 'لا يوجد فيديو'}</span></p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Clinics Content */}
            {activeTab === 'clinics' && (
                <div className="bg-white rounded-3xl shadow-sm border p-6 animate-in slide-in-from-left-4">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-black text-gray-800">العيادات المسجلة ({clinics.length})</h3>
                        <button onClick={() => handleEditClinic()} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700">
                            <Plus className="w-4 h-4"/> عيادة جديدة
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {clinics.map((clinic: any) => (
                            <div key={clinic.id} className="bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow relative group">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 text-blue-600 p-3 rounded-xl"><Stethoscope className="w-6 h-6"/></div>
                                        <div>
                                            <h4 className="font-black text-gray-800 text-base leading-tight">{clinic.name}</h4>
                                            <p className="text-[10px] font-bold text-gray-500 mt-1 bg-gray-200 px-2 py-0.5 rounded-full inline-block">د. {clinic.doctor_name || 'غير محدد'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleEditClinic(clinic)} className="p-1.5 bg-white text-blue-600 rounded-lg shadow-sm hover:bg-blue-50"><Edit className="w-3.5 h-3.5"/></button>
                                        <button onClick={() => handleDelete('q_clinics', clinic.id)} className="p-1.5 bg-white text-red-600 rounded-lg shadow-sm hover:bg-red-50"><Trash2 className="w-3.5 h-3.5"/></button>
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between text-xs font-bold border-t pt-3">
                                    <span className="text-gray-500 flex items-center gap-1"><Monitor className="w-3.5 h-3.5"/> {clinic.q_screens?.name}</span>
                                    <span className="text-indigo-600 flex items-center gap-1"><Lock className="w-3.5 h-3.5"/> {clinic.password}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal for Screen */}
            {showScreenModal && editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-black text-lg">{editingItem.id ? 'تعديل شاشة' : 'إضافة شاشة جديدة'}</h3>
                            <button onClick={() => setShowScreenModal(false)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">اسم/مكان الشاشة</label>
                                <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-indigo-500 outline-none font-bold text-sm" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="مثال: شاشة الدور الأول" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">الرقم السري للشاشة (للتحكم العام)</label>
                                <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-indigo-500 outline-none font-bold text-sm" value={editingItem.password} onChange={e => setEditingItem({...editingItem, password: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">شريط الأخبار (Marquee)</label>
                                <textarea className="w-full p-3 rounded-xl border bg-gray-50 focus:border-indigo-500 outline-none font-bold text-sm resize-none h-20" value={editingItem.marquee_text} onChange={e => setEditingItem({...editingItem, marquee_text: e.target.value})} placeholder="النص المتحرك أسفل الشاشة..." />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">رابط الفيديو (YouTube أو مباشر)</label>
                                <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-indigo-500 outline-none font-bold text-sm text-left" dir="ltr" value={editingItem.video_url} onChange={e => setEditingItem({...editingItem, video_url: e.target.value})} placeholder="https://www.youtube.com/embed/..." />
                            </div>
                            <button onClick={() => saveScreenMutation.mutate(editingItem)} disabled={saveScreenMutation.isPending} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 flex justify-center items-center gap-2">
                                {saveScreenMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ التغييرات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for Clinic */}
            {showClinicModal && editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95">
                        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-black text-lg">{editingItem.id ? 'تعديل عيادة' : 'إضافة عيادة جديدة'}</h3>
                            <button onClick={() => setShowClinicModal(false)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">الشاشة المرتبطة</label>
                                <select className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none font-bold text-sm" value={editingItem.screen_id} onChange={e => setEditingItem({...editingItem, screen_id: e.target.value})}>
                                    {screens.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">اسم العيادة / القسم</label>
                                <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none font-bold text-sm" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="مثال: عيادة الأسنان 1" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">اسم الطبيب المعالج (يظهر في شريط الأخبار)</label>
                                <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none font-bold text-sm" value={editingItem.doctor_name} onChange={e => setEditingItem({...editingItem, doctor_name: e.target.value})} placeholder="مثال: أحمد محمد" />
                            </div>
                            <div>
    <label className="block text-xs font-bold text-gray-600 mb-1">كود الملف الصوتي (مثال: clinic1)</label>
    <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none font-bold text-sm" dir="ltr" value={editingItem.audio_code || ''} onChange={e => setEditingItem({...editingItem, audio_code: e.target.value})} placeholder="clinic1" />
</div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">الرقم السري (للممرض/ة للتحكم في الأرقام)</label>
                                <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none font-bold text-sm tracking-widest text-center text-xl" dir="ltr" value={editingItem.password} onChange={e => setEditingItem({...editingItem, password: e.target.value})} placeholder="****" />
                            </div>
                            <button onClick={() => saveClinicMutation.mutate(editingItem)} disabled={saveClinicMutation.isPending} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-blue-700 flex justify-center items-center gap-2">
                                {saveClinicMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ التغييرات
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
