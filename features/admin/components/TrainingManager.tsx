import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Plus, Save, Trash2, BookOpen, MapPin, Layers, 
    Loader2, Image as ImageIcon, Video, X, UserPlus, Search, CheckCircle, FileText, Upload, Users, Eye
} from 'lucide-react';
import { Input, Select } from '../../../components/ui/FormElements';
import toast from 'react-hot-toast';
import { Employee } from '../../../../types';

export default function TrainingManager() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'create' | 'records'>('create');

    // --- State ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState<any>(null); // لعرض قائمة المجتازين
    const [uploading, setUploading] = useState<number | null>(null);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [recordSearch, setRecordSearch] = useState('');

    const initialFormState = {
        title: '', type: 'internal', location: '', training_date: '', is_mandatory: 'false', points: 10,
        slides: [{ title: 'مقدمة', content: '', mediaUrl: '', mediaType: 'none' }] 
    };
    const [createForm, setCreateForm] = useState(initialFormState);

    const [assignForm, setAssignForm] = useState({
        employee_id: '',
        manual_title: '',
        manual_date: new Date().toISOString().split('T')[0],
        manual_location: 'داخل المركز',
        type: 'internal'
    });

    // --- Queries ---

    // 1. جلب الدورات (LMS)
    const { data: trainings = [] } = useQuery({
        queryKey: ['admin_trainings'],
        queryFn: async () => {
            // نجلب عدد المجتازين مع الدورة
            const { data, error } = await supabase
                .from('trainings')
                .select('*, employee_trainings(count)')
                .eq('employee_trainings.status', 'completed')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            // تصحيح الرقم (Count returns array of objects, we need length or the count value)
            return data.map((t: any) => ({
                ...t,
                completed_count: t.employee_trainings[0]?.count || 0
            }));
        }
    });

    // 2. جلب الموظفين
    const { data: employees = [] } = useQuery({
        queryKey: ['admin_employees_list'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('id, name, employee_id, specialty').eq('status', 'نشط').order('name');
            return data as Employee[];
        }
    });

    // 3. جلب السجل الموحد (الكل)
    const { data: allRecords = [] } = useQuery({
        queryKey: ['all_training_records'],
        queryFn: async () => {
            // نجلب السجلات اليدوية + سجلات LMS المكتملة
            const { data, error } = await supabase
                .from('employee_trainings')
                .select(`
                    *,
                    employees (name, specialty, employee_id),
                    trainings (title)
                `)
                .order('created_at', { ascending: false });

            if (error) { console.error(error); return []; }
            return data;
        }
    });

    // 4. جلب تفاصيل المجتازين لدورة محددة (للمودال)
    const { data: specificTrainingStats = [], isLoading: loadingStats } = useQuery({
        queryKey: ['training_stats', showStatsModal?.id],
        queryFn: async () => {
            if (!showStatsModal) return [];
            const { data, error } = await supabase
                .from('employee_trainings')
                .select(`
                    completed_at,
                    employees (name, specialty, employee_id)
                `)
                .eq('training_id', showStatsModal.id)
                .eq('status', 'completed');
            
            if (error) throw error;
            return data;
        },
        enabled: !!showStatsModal
    });

    // --- Mutations ---

    // إنشاء دورة LMS
    const createMutation = useMutation({
        mutationFn: async (newTraining: any) => {
            const payload = {
                ...newTraining,
                points: Number(newTraining.points),
                is_mandatory: newTraining.is_mandatory === 'true',
                training_date: newTraining.training_date ? newTraining.training_date : null
            };
            const { error } = await supabase.from('trainings').insert([payload]);
            if (error) throw error;
            
            // إشعار
            const { data: allStaff } = await supabase.from('employees').select('employee_id').eq('status', 'نشط');
            if (allStaff?.length) {
                const notifs = allStaff.map(emp => ({
                    user_id: emp.employee_id,
                    title: payload.is_mandatory ? '🚨 تدريب إلزامي' : '📚 تدريب جديد',
                    message: `تم إضافة: ${payload.title}`,
                    type: 'training', is_read: false
                }));
                await supabase.from('notifications').insert(notifs);
            }
        },
        onSuccess: () => {
            toast.success('تم النشر');
            setShowCreateModal(false);
            setCreateForm(initialFormState);
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // تسجيل يدوي
    const assignMutation = useMutation({
        mutationFn: async (data: any) => {
            // نستخدم الجدول الموحد مع تحديد النوع 'manual'
            const { error } = await supabase.from('employee_trainings').insert([{
                employee_id: data.employee_id,
                training_id: null, // لا يوجد كورس مرتبط
                status: 'completed',
                type: 'manual',
                manual_title: data.manual_title,
                manual_date: data.manual_date,
                manual_location: data.manual_location
            }]);
            
            if (error) throw error;

            await supabase.from('notifications').insert({
                user_id: data.employee_id,
                title: '✅ تسجيل تدريب',
                message: `تم توثيق التدريب: ${data.manual_title}`,
                type: 'info', is_read: false
            });
        },
        onSuccess: () => {
            toast.success('تم الحفظ');
            setShowAssignModal(false);
            setAssignForm({ ...assignForm, employee_id: '', manual_title: '' });
            queryClient.invalidateQueries({ queryKey: ['all_training_records'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // حذف دورة LMS
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await supabase.from('trainings').delete().eq('id', id);
        },
        onSuccess: () => {
            toast.success('تم الحذف');
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        }
    });

    // --- Helpers (FileUpload, Slides) ---
    // (نفس دوال الرفع السابقة - لم تتغير)
    const handleFileUpload = async (event: any, index: number) => {
        const file = event.target.files[0];
        if (!file) return;
        setUploading(index);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error } = await supabase.storage.from('training-media').upload(fileName, file);
            if (error) throw error;
            const { data } = supabase.storage.from('training-media').getPublicUrl(fileName);
            const type = file.type.startsWith('video') ? 'video' : 'image';
            const newSlides = [...createForm.slides];
            // @ts-ignore
            newSlides[index].mediaUrl = data.publicUrl;
            // @ts-ignore
            newSlides[index].mediaType = type;
            setCreateForm({ ...createForm, slides: newSlides });
            toast.success('تم الرفع');
        } catch (error: any) { toast.error('فشل الرفع'); } finally { setUploading(null); }
    };

    const slideActions = {
        add: () => setCreateForm({ ...createForm, slides: [...createForm.slides, { title: '', content: '', mediaUrl: '', mediaType: 'none' }] }),
        remove: (idx: number) => createForm.slides.length > 1 && setCreateForm({ ...createForm, slides: createForm.slides.filter((_, i) => i !== idx) }),
        update: (idx: number, field: string, val: string) => {
            const newSlides: any = [...createForm.slides];
            newSlides[idx][field] = val;
            setCreateForm({ ...createForm, slides: newSlides });
        },
        removeMedia: (idx: number) => {
            const newSlides: any = [...createForm.slides];
            newSlides[idx].mediaUrl = '';
            newSlides[idx].mediaType = 'none';
            setCreateForm({ ...createForm, slides: newSlides });
        }
    };

    // --- Filters ---
    const filteredEmployees = useMemo(() => employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.employee_id.includes(searchTerm)), [employees, searchTerm]);
    
    // فلترة السجل الموحد
    const filteredRecords = useMemo(() => allRecords.filter((rec: any) => {
        const empName = rec.employees?.name || '';
        // العنوان إما من الكورس (LMS) أو المدخل اليدوي
        const title = rec.trainings?.title || rec.manual_title || '';
        return empName.toLowerCase().includes(recordSearch.toLowerCase()) || title.toLowerCase().includes(recordSearch.toLowerCase());
    }), [allRecords, recordSearch]);

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* Tabs */}
            <div className="flex bg-white p-1.5 rounded-2xl border shadow-sm w-fit gap-1">
                <button onClick={() => setActiveTab('create')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>المحتوى (LMS)</button>
                <button onClick={() => setActiveTab('records')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'records' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>السجل الشامل</button>
            </div>

            {/* TAB 1: LMS COURSES */}
            {activeTab === 'create' && (
                <>
                    <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50">
                        <div><h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><BookOpen className="w-6 h-6 text-indigo-600"/> الدورات التفاعلية</h2><p className="text-gray-500 text-sm mt-1">إدارة المحتوى التعليمي في التطبيق</p></div>
                        <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200"><Plus className="w-5 h-5"/> دورة جديدة</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trainings.map((t: any) => (
                            <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden hover:shadow-md transition-all group">
                                <div className={`absolute top-0 right-0 left-0 h-1.5 ${t.type === 'online' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                                <div className="flex justify-between items-start mt-2">
                                    <div><h3 className="font-bold text-gray-800 mb-1 line-clamp-1">{t.title}</h3><p className="text-xs text-gray-500 font-bold flex items-center gap-1"><MapPin className="w-3 h-3"/> {t.location || 'Online'}</p></div>
                                    {t.is_mandatory && <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-1 rounded-full border border-red-100">إجباري</span>}
                                </div>
                                <div className="mt-4 flex justify-between items-center border-t border-gray-50 pt-3">
                                    {/* زر عرض المجتازين */}
                                    <button 
                                        onClick={() => setShowStatsModal(t)}
                                        className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1.5 rounded-lg flex items-center gap-1 hover:bg-green-100 transition-colors"
                                    >
                                        <Users className="w-3 h-3"/> {t.completed_count || 0} اجتازوا
                                    </button>
                                    <button onClick={() => deleteMutation.mutate(t.id)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* TAB 2: UNIFIED RECORDS */}
            {activeTab === 'records' && (
                <>
                    <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50">
                        <div><h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><FileText className="w-6 h-6 text-green-600"/> السجل الشامل</h2><p className="text-gray-500 text-sm mt-1">يشمل الدورات التفاعلية والشهادات المسجلة يدوياً</p></div>
                        <button onClick={() => setShowAssignModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-200"><UserPlus className="w-5 h-5"/> تسجيل يدوي</button>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border shadow-sm flex gap-4">
                        <div className="relative flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input value={recordSearch} onChange={e => setRecordSearch(e.target.value)} placeholder="بحث باسم الموظف أو التدريب..." className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"/></div>
                    </div>
                    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 font-bold border-b text-gray-700">
                                <tr><th className="p-4">الموظف</th><th className="p-4">التخصص</th><th className="p-4">اسم التدريب</th><th className="p-4">التاريخ</th><th className="p-4">النوع</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredRecords.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا توجد سجلات</td></tr> : filteredRecords.map((rec: any) => (
                                    <tr key={rec.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{rec.employees?.name}</td>
                                        <td className="p-4 text-xs text-gray-500">{rec.employees?.specialty}</td>
                                        <td className="p-4 font-bold text-indigo-700">
                                            {rec.trainings?.title || rec.manual_title}
                                        </td>
                                        <td className="p-4 font-mono text-xs">
                                            {new Date(rec.manual_date || rec.completed_at).toLocaleDateString('ar-EG')}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${rec.type === 'manual' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>
                                                {rec.type === 'manual' ? 'يدوي/خارجي' : 'LMS/تفاعلي'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* --- MODALS --- */}

            {/* Modal 3: Show Stats (من اجتاز الدورة) */}
            {showStatsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-black text-lg text-gray-800">قائمة المجتازين: {showStatsModal.title}</h3>
                            <button onClick={() => setShowStatsModal(null)}><X className="w-5 h-5 text-gray-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {loadingStats ? <div className="text-center p-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600"/></div> : 
                             specificTrainingStats.length === 0 ? <p className="text-center text-gray-400 py-4">لم يجتز أحد هذا التدريب بعد.</p> : (
                                <table className="w-full text-sm text-right">
                                    <thead className="text-gray-500 font-bold border-b"><tr><th className="pb-2">الاسم</th><th className="pb-2">التاريخ</th></tr></thead>
                                    <tbody className="divide-y">
                                        {specificTrainingStats.map((stat: any, idx: number) => (
                                            <tr key={idx}>
                                                <td className="py-3 font-bold text-gray-800">{stat.employees?.name} <span className="text-[10px] text-gray-400 block">{stat.employees?.specialty}</span></td>
                                                <td className="py-3 font-mono text-xs text-green-600">{new Date(stat.completed_at).toLocaleDateString('ar-EG')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 1: Create (نفس السابق) */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b flex justify-between items-center shrink-0">
                            <h3 className="font-black text-xl text-gray-800">إضافة دورة تفاعلية</h3>
                            <button onClick={() => setShowCreateModal(false)}><X className="w-6 h-6 text-gray-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="العنوان" value={createForm.title} onChange={v => setCreateForm({...createForm, title: v})} required />
                                <Select label="النوع" options={['internal', 'external', 'online']} value={createForm.type} onChange={v => setCreateForm({...createForm, type: v})} />
                                {createForm.type !== 'online' && <Input label="المكان" value={createForm.location} onChange={v => setCreateForm({...createForm, location: v})} />}
                                <Select label="إلزامي؟" options={['true', 'false']} value={createForm.is_mandatory} onChange={v => setCreateForm({...createForm, is_mandatory: v})} />
                                <Input label="النقاط" type="number" value={createForm.points} onChange={v => setCreateForm({...createForm, points: Number(v)})} />
                            </div>
                            
                            <div className="bg-gray-50 p-4 rounded-2xl border border-dashed">
                                {createForm.slides.map((slide, idx) => (
                                    <div key={idx} className="bg-white p-4 mb-4 rounded-xl border shadow-sm relative">
                                        <div className="absolute top-2 left-2 flex gap-2">
                                            <button onClick={() => slideActions.remove(idx)} className="text-red-500 bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                        <span className="text-xs font-black text-gray-400 mb-2 block">شريحة #{idx+1}</span>
                                        <input placeholder="عنوان الشريحة" className="w-full font-bold mb-2 border-b outline-none" value={slide.title} onChange={e => slideActions.update(idx, 'title', e.target.value)} />
                                        
                                        <div className="flex gap-4">
                                            <div className="w-40 h-40 bg-gray-100 rounded-2xl flex items-center justify-center relative overflow-hidden border">
                                                {slide.mediaUrl ? (
                                                    <>
                                                        {slide.mediaType === 'video' ? <video src={slide.mediaUrl} className="w-full h-full object-cover"/> : <img src={slide.mediaUrl} className="w-full h-full object-cover" alt=""/>}
                                                        <button onClick={() => slideActions.removeMedia(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full"><X className="w-3 h-3"/></button>
                                                    </>
                                                ) : (
                                                    <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center p-1">
                                                        {uploading === idx ? <Loader2 className="animate-spin w-6 h-6"/> : <Upload className="w-6 h-6"/>}
                                                        <span className="mt-1">رفع</span>
                                                        <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileUpload(e, idx)} disabled={uploading !== null}/>
                                                    </label>
                                                )}
                                            </div>
                                            <textarea placeholder="المحتوى..." className="flex-1 bg-gray-50 p-2 rounded-xl outline-none border resize-none" value={slide.content} onChange={e => slideActions.update(idx, 'content', e.target.value)} />
                                        </div>
                                    </div>
                                ))}
                                <button onClick={slideActions.add} className="w-full bg-white border-2 border-dashed border-indigo-200 text-indigo-600 py-2 rounded-xl font-bold">+ شريحة</button>
                            </div>
                        </div>
                        <div className="p-6 border-t flex gap-4">
                            <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-gray-100">إلغاء</button>
                            <button onClick={() => createMutation.mutate(createForm)} disabled={createMutation.isPending || uploading !== null} className="flex-[2] bg-indigo-600 text-white py-3 rounded-xl font-bold shadow-lg">
                                {createMutation.isPending ? 'جاري النشر...' : 'نشر الدورة'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal 2: Assign Training (Manual) */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden zoom-in-95">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-black text-lg text-gray-800 flex items-center gap-2"><UserPlus className="w-5 h-5 text-green-600"/> تسجيل تدريب يدوي</h3>
                            <button onClick={() => setShowAssignModal(false)}><X className="w-5 h-5 text-gray-400"/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">اختر الموظف</label>
                                <input placeholder="ابحث بالاسم..." className="w-full p-2 rounded-xl border bg-gray-50 mb-2 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                <select className="w-full p-3 rounded-xl border bg-white font-bold" value={assignForm.employee_id} onChange={e => setAssignForm({...assignForm, employee_id: e.target.value})}>
                                    <option value="">-- اختر من القائمة --</option>
                                    {filteredEmployees.map(e => <option key={e.id} value={e.employee_id}>{e.name} ({e.specialty})</option>)}
                                </select>
                            </div>
                            <Input label="اسم الدورة / التدريب" value={assignForm.manual_title} onChange={v => setAssignForm({...assignForm, manual_title: v})} required />
                            <div className="grid grid-cols-2 gap-3">
                                <Input type="date" label="التاريخ" value={assignForm.manual_date} onChange={v => setAssignForm({...assignForm, manual_date: v})} />
                                <Select label="النوع" options={['internal', 'external']} value={assignForm.type} onChange={v => setAssignForm({...assignForm, type: v})} />
                            </div>
                            <Input label="المكان" value={assignForm.manual_location} onChange={v => setAssignForm({...assignForm, manual_location: v})} />
                            <button onClick={() => assignMutation.mutate(assignForm)} disabled={assignMutation.isPending || !assignForm.employee_id || !assignForm.manual_title} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50 mt-4">
                                {assignMutation.isPending ? 'جاري الحفظ...' : 'حفظ السجل'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
