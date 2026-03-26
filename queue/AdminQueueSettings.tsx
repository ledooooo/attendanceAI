import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { 
    Monitor, Stethoscope, Plus, Edit, Trash2, X, Save, 
    Video, Type, Lock, RotateCcw, Loader2, Play, Pause, Volume2, VolumeX, Settings2, Mic, MicOff
} from 'lucide-react';

const defaultSettings = {
    layout_clinics_width: 30,
    card_height: 150,
    grid_cols: 2,
    font_clinic: 24,
    font_number: 64,
    color_bg: '#111827',
    color_card: '#1f2937',
    color_text: '#ffffff',
    color_marquee: '#2563eb',
    enable_speech: true // ✅ تفعيل النطق افتراضياً
};

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

    // ✅ إرسال أمر للتحكم في فيديو الشاشة عن بُعد
    const sendVideoCommand = async (screenId: string, cmd: string) => {
        try {
            await supabase.from('q_alerts').insert({
                screen_id: screenId,
                type: 'video_cmd',
                message: cmd
            });
            toast.success(`تم إرسال أمر (${cmd}) للشاشة`);
        } catch (e) {
            toast.error('فشل إرسال الأمر');
        }
    };

    // Handlers
    const handleEditScreen = (screen: any = null) => {
        setEditingItem(screen ? { ...screen, settings: screen.settings || defaultSettings } : { name: '', password: '', marquee_text: '', video_url: '', settings: defaultSettings });
        setShowScreenModal(true);
    };

    const handleEditClinic = (clinic: any = null) => {
        setEditingItem(clinic || { name: '', doctor_name: '', password: '', audio_code: '', screen_id: screens[0]?.id || '' });
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
                    <p className="text-sm font-bold text-gray-500 mt-1">إدارة الشاشات، المقاسات، الألوان، النطق، وأزرار الفيديو</p>
                </div>
                <button 
                    onClick={() => { if(confirm('هل أنت متأكد من تصفير جميع العدادات لليوم الجديد؟')) resetAllQueuesMutation.mutate(); }}
                    disabled={resetAllQueuesMutation.isPending}
                    className="bg-rose-50 text-rose-600 px-4 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-rose-100 transition-colors shadow-sm"
                >
                    <RotateCcw className={`w-5 h-5 ${resetAllQueuesMutation.isPending ? 'animate-spin' : ''}`} /> 
                    تصفير الأرقام لليوم الجديد
                </button>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-2">
                <button onClick={() => setActiveTab('screens')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${activeTab === 'screens' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border'}`}>
                    <Monitor className="w-5 h-5" /> إدارة الشاشات والمظهر
                </button>
                <button onClick={() => setActiveTab('clinics')} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black transition-all ${activeTab === 'clinics' ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-gray-50 border'}`}>
                    <Stethoscope className="w-5 h-5" /> إدارة العيادات
                </button>
            </div>

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
                            <div key={screen.id} className="bg-gray-50 rounded-3xl p-5 border border-gray-100 hover:shadow-md transition-shadow relative">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-indigo-100 text-indigo-600 p-3 rounded-xl"><Monitor className="w-6 h-6"/></div>
                                        <div>
                                            <h4 className="font-black text-gray-800 text-lg">{screen.name}</h4>
                                            <p className="text-xs font-bold text-gray-500 mt-1 flex items-center gap-1"><Lock className="w-3 h-3"/> {screen.password}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <a href={`/tv-screen?id=${screen.id}`} target="_blank" rel="noreferrer" className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shadow-sm hover:bg-emerald-100 font-bold text-xs flex items-center">فتح الشاشة</a>
                                        <button onClick={() => handleEditScreen(screen)} className="p-2 bg-white text-blue-600 rounded-lg shadow-sm hover:bg-blue-50 border"><Edit className="w-4 h-4"/></button>
                                        <button onClick={() => handleDelete('q_screens', screen.id)} className="p-2 bg-white text-red-600 rounded-lg shadow-sm hover:bg-red-50 border"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                                <div className="space-y-2 text-xs font-bold text-gray-600 bg-white p-3 rounded-xl border mb-4">
                                    <p className="flex items-center gap-2"><Type className="w-4 h-4 text-indigo-400"/> <span className="truncate">{screen.marquee_text}</span></p>
                                    <p className="flex items-center gap-2"><Video className="w-4 h-4 text-pink-400"/> <span className="truncate" dir="ltr">{screen.video_url || 'لا يوجد فيديو'}</span></p>
                                    <p className={`flex items-center gap-2 ${screen.settings?.enable_speech === false ? 'text-red-500' : 'text-emerald-600'}`}>
                                        {screen.settings?.enable_speech === false ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4"/>} 
                                        <span>{screen.settings?.enable_speech === false ? 'النطق معطل' : 'النطق مفعل'}</span>
                                    </p>
                                </div>
                                
                                {/* 🔴 أزرار التحكم عن بعد في الفيديو */}
                                <div className="pt-4 border-t border-gray-200">
                                    <p className="text-[10px] font-black text-gray-500 mb-2 uppercase">التحكم المباشر في فيديو الشاشة</p>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => sendVideoCommand(screen.id, 'play')} className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 flex-1 flex justify-center"><Play className="w-4 h-4"/></button>
                                        <button onClick={() => sendVideoCommand(screen.id, 'pause')} className="p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 flex-1 flex justify-center"><Pause className="w-4 h-4"/></button>
                                        <button onClick={() => sendVideoCommand(screen.id, 'mute')} className="p-2 bg-gray-100 text-gray-600 border rounded-lg hover:bg-gray-200 flex-1 flex justify-center"><VolumeX className="w-4 h-4"/></button>
                                        <button onClick={() => sendVideoCommand(screen.id, 'unmute')} className="p-2 bg-gray-100 text-gray-600 border rounded-lg hover:bg-gray-200 flex-1 flex justify-center"><Volume2 className="w-4 h-4"/></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                                        <button onClick={() => handleEditClinic(clinic)} className="p-1.5 bg-white text-blue-600 rounded-lg shadow-sm border"><Edit className="w-3.5 h-3.5"/></button>
                                        <button onClick={() => handleDelete('q_clinics', clinic.id)} className="p-1.5 bg-white text-red-600 rounded-lg shadow-sm border"><Trash2 className="w-3.5 h-3.5"/></button>
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

            {/* Modal for Screen (إعدادات الشاشة والمقاسات) */}
            {showScreenModal && editingItem && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b bg-gray-50 flex justify-between items-center">
                            <h3 className="font-black text-lg">{editingItem.id ? 'إعدادات الشاشة' : 'إضافة شاشة جديدة'}</h3>
                            <button onClick={() => setShowScreenModal(false)} className="p-1 hover:bg-gray-200 rounded-full"><X className="w-5 h-5"/></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                            
                            <div className="space-y-4">
                                <h4 className="font-black text-indigo-700 border-b pb-2 flex items-center gap-2"><Monitor className="w-4 h-4"/> البيانات الأساسية</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">اسم/مكان الشاشة</label>
                                        <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} placeholder="مثال: شاشة الدور الأول" />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">الرقم السري</label>
                                        <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" value={editingItem.password} onChange={e => setEditingItem({...editingItem, password: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">شريط الأخبار (Marquee)</label>
                                        <textarea className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500 h-20 resize-none" value={editingItem.marquee_text} onChange={e => setEditingItem({...editingItem, marquee_text: e.target.value})} placeholder="النص المتحرك أسفل الشاشة..." />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">رابط الفيديو (YouTube أو رابط مباشر .mp4)</label>
                                        <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500 text-left" dir="ltr" value={editingItem.video_url} onChange={e => setEditingItem({...editingItem, video_url: e.target.value})} placeholder="https://..." />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-black text-rose-600 border-b pb-2 flex items-center gap-2"><Settings2 className="w-4 h-4"/> إعدادات التصميم، الألوان والنطق</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    
                                    {/* ✅ زر تفعيل/إيقاف النطق */}
                                    <div className="col-span-2 flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                                        <div>
                                            <span className="font-bold text-emerald-800 block flex items-center gap-1"><Mic className="w-4 h-4"/> تفعيل النطق الصوتي</span>
                                            <span className="text-[10px] text-emerald-600">سيتم نطق النداء الآلي (صوتيات أو TTS) في هذه الشاشة</span>
                                        </div>
                                        <input type="checkbox" className="w-5 h-5 accent-emerald-600 cursor-pointer" checked={editingItem.settings.enable_speech !== false} onChange={e => setEditingItem({...editingItem, settings: {...editingItem.settings, enable_speech: e.target.checked}})} />
                                    </div>

                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-600 mb-1 flex justify-between">
                                            <span>نسبة عرض كروت العيادات (%)</span>
                                            <span className="text-indigo-600">{editingItem.settings.layout_clinics_width}% عيادات - {100 - editingItem.settings.layout_clinics_width}% فيديو</span>
                                        </label>
                                        <input type="range" min="10" max="90" className="w-full accent-indigo-600 cursor-pointer" value={editingItem.settings.layout_clinics_width} onChange={e => setEditingItem({...editingItem, settings: {...editingItem.settings, layout_clinics_width: Number(e.target.value)}})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">عدد الأعمدة للكروت</label>
                                        <input type="number" min="1" max="6" className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" value={editingItem.settings.grid_cols} onChange={e => setEditingItem({...editingItem, settings: {...editingItem.settings, grid_cols: Number(e.target.value)}})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">طول الكارت (px)</label>
                                        <input type="number" min="80" max="400" className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" value={editingItem.settings.card_height} onChange={e => setEditingItem({...editingItem, settings: {...editingItem.settings, card_height: Number(e.target.value)}})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">مقاس خط العيادة (px)</label>
                                        <input type="number" className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" value={editingItem.settings.font_clinic} onChange={e => setEditingItem({...editingItem, settings: {...editingItem.settings, font_clinic: Number(e.target.value)}})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">مقاس خط الرقم (px)</label>
                                        <input type="number" className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm outline-none focus:border-indigo-500" value={editingItem.settings.font_number} onChange={e => setEditingItem({...editingItem, settings: {...editingItem.settings, font_number: Number(e.target.value)}})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">لون خلفية الشاشة</label>
                                        <input type="color" className="w-full h-12 rounded-xl cursor-pointer" value={editingItem.settings.color_bg} onChange={e => setEditingItem({...editingItem, settings: {...editingItem.settings, color_bg: e.target.value}})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 mb-1">لون الكارت النشط</label>
                                        <input type="color" className="w-full h-12 rounded-xl cursor-pointer" value={editingItem.settings.color_card} onChange={e => setEditingItem({...editingItem, settings: {...editingItem.settings, color_card: e.target.value}})} />
                                    </div>
                                </div>
                            </div>
                            
                            <button onClick={() => saveScreenMutation.mutate(editingItem)} disabled={saveScreenMutation.isPending} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 flex justify-center items-center gap-2">
                                {saveScreenMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} حفظ كافة الإعدادات
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
                                <label className="block text-xs font-bold text-gray-600 mb-1">اسم الطبيب المعالج</label>
                                <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none font-bold text-sm" value={editingItem.doctor_name} onChange={e => setEditingItem({...editingItem, doctor_name: e.target.value})} placeholder="مثال: أحمد محمد" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">كود الملف الصوتي (مثال: clinic1)</label>
                                <input type="text" className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none font-bold text-sm" dir="ltr" value={editingItem.audio_code || ''} onChange={e => setEditingItem({...editingItem, audio_code: e.target.value})} placeholder="clinic1" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">الرقم السري للعيادة</label>
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
