import React, { useState, useMemo } from 'react';
import { supabase } from '../../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Plus, Save, Trash2, BookOpen, MapPin, Layers, 
    Loader2, Image as ImageIcon, Video, X, UserPlus, Search, CheckCircle, FileText, Link as LinkIcon, Upload
} from 'lucide-react';
import { Input, Select } from '../../../../components/ui/FormElements';
import toast from 'react-hot-toast';
import { Employee } from '../../../../types';

export default function TrainingManager() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'create' | 'records'>('create');

    // --- State: Create Training ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null);
    const initialFormState = {
        title: '', type: 'internal', location: '', training_date: '', is_mandatory: 'false', points: 10,
        slides: [{ title: 'مقدمة', content: '', mediaUrl: '', mediaType: 'none' }] 
    };
    const [createForm, setCreateForm] = useState(initialFormState);

    // --- State: Assign Training ---
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [assignForm, setAssignForm] = useState({
        employee_id: '',
        training_name: '',
        training_date: new Date().toISOString().split('T')[0],
        location: 'داخل المركز',
        type: 'internal'
    });

    // --- State: Records Filter ---
    const [recordSearch, setRecordSearch] = useState('');

    // --- Queries ---
    const { data: trainings = [] } = useQuery({
        queryKey: ['admin_trainings'],
        queryFn: async () => {
            const { data } = await supabase.from('trainings').select('*').order('created_at', { ascending: false });
            return data;
        }
    });

    const { data: employees = [] } = useQuery({
        queryKey: ['admin_employees_list'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('id, name, employee_id, specialty, status').eq('status', 'نشط').order('name');
            return data as Employee[];
        }
    });

    const { data: trainingLogs = [] } = useQuery({
        queryKey: ['training_logs'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('training_logs')
                .select('*, employees(name, specialty)')
                .order('training_date', { ascending: false });
            if (error) { console.error("Error logs:", error); return []; }
            return data;
        }
    });

    // --- Mutations ---
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

            const { data: allStaff } = await supabase.from('employees').select('employee_id').eq('status', 'نشط');
            if (allStaff?.length) {
                const notifs = allStaff.map(emp => ({
                    user_id: emp.employee_id,
                    title: payload.is_mandatory ? '🚨 تدريب إلزامي جديد' : '📚 تدريب جديد متاح',
                    message: `تم إضافة تدريب بعنوان "${payload.title}".`,
                    type: 'training', is_read: false
                }));
                await supabase.from('notifications').insert(notifs);
            }
        },
        onSuccess: () => {
            toast.success('تم النشر وإرسال الإشعارات');
            setShowCreateModal(false);
            setCreateForm(initialFormState);
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        },
        onError: (err: any) => toast.error('حدث خطأ: ' + err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase.from('trainings').delete().eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم الحذف');
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        }
    });

    const assignMutation = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await supabase.from('training_logs').insert([data]);
            if (error) throw error;
            await supabase.from('notifications').insert({
                user_id: data.employee_id,
                title: '✅ تم تسجيل تدريب',
                message: `تم توثيق حصولك على تدريب: ${data.training_name}`,
                type: 'info', is_read: false
            });
        },
        onSuccess: () => {
            toast.success('تم حفظ السجل');
            setShowAssignModal(false);
            setAssignForm({ ...assignForm, employee_id: '', training_name: '' });
            queryClient.invalidateQueries({ queryKey: ['training_logs'] });
        },
        onError: (err: any) => toast.error('فشل الحفظ: ' + err.message)
    });

    // --- Helpers ---
    const handleFileUpload = async (event: any, index: number) => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) return toast.error("حجم الملف كبير جداً");

        setUploading(index);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${fileName}`; // تبسيط المسار

            // 1. محاولة الرفع
            const { error: uploadError } = await supabase.storage.from('training-media').upload(filePath, file);
            
            if (uploadError) {
                console.error("Upload Error Details:", uploadError); // للفحص
                throw new Error(uploadError.message === "The resource was not found" ? "تأكد من إنشاء Bucket باسم training-media" : uploadError.message);
            }

            const { data: { publicUrl } } = supabase.storage.from('training-media').getPublicUrl(filePath);
            const type = file.type.startsWith('video') ? 'video' : 'image';

            const newSlides = [...createForm.slides];
            // @ts-ignore
            newSlides[index].mediaUrl = publicUrl;
            // @ts-ignore
            newSlides[index].mediaType = type;
            setCreateForm({ ...createForm, slides: newSlides });
            toast.success('تم الرفع');
        } catch (error: any) {
            toast.error('فشل الرفع: ' + error.message);
        } finally {
            setUploading(null);
        }
    };

    const handleExternalLink = (val: string, index: number) => {
        const newSlides: any = [...createForm.slides];
        newSlides[index].mediaUrl = val;
        // تخمين النوع
        if (val.includes('youtube') || val.includes('youtu.be') || val.endsWith('.mp4')) newSlides[index].mediaType = 'video';
        else newSlides[index].mediaType = 'image';
        setCreateForm({ ...createForm, slides: newSlides });
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

    const filteredEmployees = useMemo(() => employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.employee_id.includes(searchTerm)), [employees, searchTerm]);
    const filteredLogs = useMemo(() => trainingLogs.filter((log: any) => {
        const empName = log.employees?.name || '';
        return empName.toLowerCase().includes(recordSearch.toLowerCase()) || log.training_name.includes(recordSearch);
    }), [trainingLogs, recordSearch]);

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            <div className="flex bg-white p-1.5 rounded-2xl border shadow-sm w-fit gap-1">
                <button onClick={() => setActiveTab('create')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>المحتوى التعليمي (LMS)</button>
                <button onClick={() => setActiveTab('records')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'records' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>سجلات التدريب الفردية</button>
            </div>

            {activeTab === 'create' && (
                <>
                    <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50">
                        <div><h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><BookOpen className="w-6 h-6 text-indigo-600"/> الدورات التفاعلية</h2><p className="text-gray-500 text-sm mt-1">دورات تظهر في التطبيق بنظام الشرائح والنقاط</p></div>
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
                                    <div className="flex gap-2"><span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg flex items-center gap-1"><Layers className="w-3 h-3"/> {t.slides?.length}</span><span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">{t.points} نقطة</span></div>
                                    <button onClick={() => deleteMutation.mutate(t.id)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {activeTab === 'records' && (
                <>
                    <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50">
                        <div><h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><FileText className="w-6 h-6 text-green-600"/> سجل التدريبات</h2><p className="text-gray-500 text-sm mt-1">أرشيف التدريبات والدورات الحاصل عليها الموظفون</p></div>
                        <button onClick={() => setShowAssignModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-200"><UserPlus className="w-5 h-5"/> تسجيل جديد</button>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border shadow-sm flex gap-4">
                        <div className="relative flex-1"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input value={recordSearch} onChange={e => setRecordSearch(e.target.value)} placeholder="بحث باسم الموظف أو التدريب..." className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"/></div>
                    </div>
                    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 font-bold border-b text-gray-700">
                                <tr><th className="p-4">الموظف</th><th className="p-4">التخصص</th><th className="p-4">اسم التدريب</th><th className="p-4">التاريخ</th><th className="p-4">المكان</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredLogs.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا توجد سجلات</td></tr> : filteredLogs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{log.employees?.name}</td>
                                        <td className="p-4 text-xs text-gray-500">{log.employees?.specialty}</td>
                                        <td className="p-4 font-bold text-indigo-700">{log.training_name}</td>
                                        <td className="p-4 font-mono text-xs">{new Date(log.training_date).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-4 text-xs">{log.location}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* Modal 1: Create Training */}
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
                                                    <div className="flex flex-col items-center gap-2 p-2 w-full">
                                                        <label className="cursor-pointer flex flex-col items-center justify-center text-gray-400 text-xs text-center hover:text-indigo-600 transition-colors">
                                                            {uploading === idx ? <Loader2 className="animate-spin w-6 h-6"/> : <Upload className="w-6 h-6"/>}
                                                            <span className="mt-1 font-bold">رفع ملف</span>
                                                            <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileUpload(e, idx)} disabled={uploading !== null}/>
                                                        </label>
                                                        <div className="w-full border-t border-gray-200"></div>
                                                        <input 
                                                            placeholder="أو رابط خارجي..." 
                                                            className="w-full text-[10px] p-1 border rounded bg-white text-center"
                                                            onBlur={(e) => { if(e.target.value) handleExternalLink(e.target.value, idx); }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <textarea placeholder="المحتوى النصي للشريحة..." className="flex-1 bg-gray-50 p-3 rounded-2xl outline-none border resize-none focus:bg-white transition-all" value={slide.content} onChange={e => slideActions.update(idx, 'content', e.target.value)} />
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

            {/* Modal 2: Assign Training */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden zoom-in-95">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="font-black text-lg text-gray-800 flex items-center gap-2"><UserPlus className="w-5 h-5 text-green-600"/> تسجيل تدريب</h3>
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
                            <Input label="اسم الدورة / التدريب" value={assignForm.training_name} onChange={v => setAssignForm({...assignForm, training_name: v})} required />
                            <div className="grid grid-cols-2 gap-3">
                                <Input type="date" label="التاريخ" value={assignForm.training_date} onChange={v => setAssignForm({...assignForm, training_date: v})} />
                                <Select label="النوع" options={['internal', 'external']} value={assignForm.type} onChange={v => setAssignForm({...assignForm, type: v})} />
                            </div>
                            <Input label="المكان" value={assignForm.location} onChange={v => setAssignForm({...assignForm, location: v})} />
                            <button onClick={() => assignMutation.mutate(assignForm)} disabled={assignMutation.isPending || !assignForm.employee_id || !assignForm.training_name} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold shadow-lg hover:bg-green-700 disabled:opacity-50 mt-4">
                                {assignMutation.isPending ? 'جاري الحفظ...' : 'حفظ السجل'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
