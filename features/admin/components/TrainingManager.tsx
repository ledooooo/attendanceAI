import React, { useState, useMemo } from 'react';
import { supabase } from '../../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Plus, Save, Trash2, BookOpen, MapPin, Layers, 
    Loader2, Image as ImageIcon, Video, X, UserPlus, Search, 
    CheckCircle, FileText, Upload, Users, Eye, Link as LinkIcon,
    Filter, RefreshCw, UserCheck, Check
} from 'lucide-react';
import { Input, Select } from '../../../../components/ui/FormElements';
import { Employee } from '../../../../types';
import toast from 'react-hot-toast';

export default function TrainingManager() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'create' | 'records'>('create');

    // --- State: Create Training ---
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null);
    
    // حالة البحث الداخلي لاختيار الموظفين
    const [empSelectSearch, setEmpSelectSearch] = useState('');

    // نموذج إنشاء التدريب
    const initialFormState = {
        title: '', 
        type: 'internal', 
        location: '', 
        responsible_person: '', 
        training_date: '', 
        is_mandatory: 'false', 
        points: 10,
        target_specialties: [] as string[],
        target_employees: [] as string[], // ✅ تمت الإضافة: مصفوفة للموظفين المحددين
        slides: [{ title: 'مقدمة', content: '', mediaUrl: '', mediaType: 'none' }] 
    };
    const [createForm, setCreateForm] = useState(initialFormState);

    // --- State: Assign Manual Training ---
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [assignForm, setAssignForm] = useState({
        employee_id: '',
        manual_title: '',
        manual_date: new Date().toISOString().split('T')[0],
        manual_location: 'داخل المركز',
        type: 'internal'
    });

    // --- State: Records Filter ---
    const [recordFilters, setRecordFilters] = useState({
        search: '',
        employee_code: '',
        specialty: 'all'
    });

    // --- State: Modals ---
    const [showStatsModal, setShowStatsModal] = useState<any>(null);
    const [showHistoryModal, setShowHistoryModal] = useState<any>(null);

    // ================= QUERIES =================

    // 1. Employees
    const { data: employees = [] } = useQuery({
        queryKey: ['admin_employees_list'],
        queryFn: async () => {
            const { data } = await supabase.from('employees').select('id, name, employee_id, specialty').eq('status', 'نشط').order('name');
            return data as Employee[];
        }
    });

    const uniqueSpecialties = useMemo(() => Array.from(new Set(employees.map(e => e.specialty).filter(Boolean))), [employees]);

    // 2. Trainings (LMS)
    const { data: trainings = [], refetch: refetchTrainings } = useQuery({
        queryKey: ['admin_trainings'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('trainings')
                .select('*, employee_trainings(count)')
                .eq('employee_trainings.status', 'completed')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data.map((t: any) => ({
                ...t,
                completed_count: t.employee_trainings ? t.employee_trainings[0]?.count : 0
            }));
        }
    });

    // 3. All Records
    const { data: allRecords = [], refetch: refetchRecords, isLoading: loadingRecords } = useQuery({
        queryKey: ['all_training_records'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employee_trainings')
                .select(`
                    *,
                    employees!employee_trainings_employee_id_fkey (name, specialty, employee_id),
                    trainings (title)
                `)
                .order('created_at', { ascending: false });

            if (error) { 
                console.error("Error fetching records:", error); 
                return []; 
            }
            return data;
        }
    });

    // 4. Stats for specific training
    const { data: specificTrainingStats = [], isLoading: loadingStats } = useQuery({
        queryKey: ['training_stats', showStatsModal?.id],
        queryFn: async () => {
            if (!showStatsModal) return [];
            const { data } = await supabase
                .from('employee_trainings')
                .select('completed_at, employees!employee_trainings_employee_id_fkey (name, specialty, employee_id)')
                .eq('training_id', showStatsModal.id)
                .eq('status', 'completed');
            return data || [];
        },
        enabled: !!showStatsModal
    });

    // ================= MUTATIONS =================

    const createMutation = useMutation({
        mutationFn: async (form: any) => {
            const payload = { 
                ...form, 
                points: Number(form.points), 
                is_mandatory: form.is_mandatory === 'true', 
                training_date: form.training_date || null, 
                target_specialties: form.target_specialties.length ? form.target_specialties : null,
                target_employees: form.target_employees.length ? form.target_employees : null, // ✅ حفظ الموظفين المحددين
                responsible_person: form.responsible_person
            };
            const { error } = await supabase.from('trainings').insert([payload]);
            if(error) throw error;

            // Notify Target Users Logic
            // 1. الحالة الافتراضية: للجميع
            let targetIds = new Set<string>();

            if (!payload.target_specialties && !payload.target_employees) {
                // للجميع
                const { data: allIds } = await supabase.from('employees').select('employee_id').eq('status', 'نشط');
                allIds?.forEach(e => targetIds.add(e.employee_id));
            } else {
                // 2. تجميع أصحاب التخصصات
                if (payload.target_specialties) {
                    const { data: specIds } = await supabase.from('employees').select('employee_id').in('specialty', payload.target_specialties).eq('status', 'نشط');
                    specIds?.forEach(e => targetIds.add(e.employee_id));
                }
                // 3. تجميع الموظفين المحددين بالاسم
                if (payload.target_employees) {
                    payload.target_employees.forEach((id: string) => targetIds.add(id));
                }
            }

            if (targetIds.size > 0) {
                const notifs = Array.from(targetIds).map(userId => ({
                    user_id: userId,
                    title: payload.is_mandatory ? '🚨 تدريب إلزامي جديد' : '📚 تدريب جديد متاح',
                    message: `تم إضافة تدريب: "${payload.title}"${payload.responsible_person ? `، المحاضر: ${payload.responsible_person}` : ''}`,
                    type: 'training', is_read: false
                }));
                await supabase.from('notifications').insert(notifs);
            }
        },
        onSuccess: () => { 
            toast.success('تم النشر وإرسال الإشعارات'); 
            setShowCreateModal(false); 
            setCreateForm(initialFormState);
            refetchTrainings(); 
        },
        onError: (err: any) => toast.error('خطأ: ' + err.message)
    });

    const assignMutation = useMutation({
        mutationFn: async (form: any) => {
            const { error } = await supabase.from('employee_trainings').insert([{
                employee_id: form.employee_id,
                training_id: null,
                status: 'completed',
                type: 'manual',
                manual_title: form.manual_title,
                manual_date: form.manual_date,
                manual_location: form.manual_location
            }]);
            if(error) throw error;

            await supabase.from('notifications').insert({
                user_id: form.employee_id,
                title: '✅ تسجيل تدريب',
                message: `تم توثيق حصولك على تدريب: ${form.manual_title}`,
                type: 'info', is_read: false
            });
        },
        onSuccess: () => { 
            toast.success('تم التسجيل'); 
            setShowAssignModal(false); 
            setAssignForm({ ...assignForm, employee_id: '', manual_title: '' });
            refetchRecords(); 
        },
        onError: (err: any) => toast.error(err.message)
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => { await supabase.from('trainings').delete().eq('id', id); },
        onSuccess: () => { toast.success('تم الحذف'); refetchTrainings(); }
    });

    // ================= HELPERS =================

    const handleFileUpload = async (event: any, index: number) => {
        const file = event.target.files[0];
        if (!file) return;
        setUploading(index);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}.${fileExt}`;
            const { error } = await supabase.storage.from('training-media').upload(fileName, file, {
                contentType: file.type, 
                upsert: true
            });
            if (error) throw error;
            const { data } = supabase.storage.from('training-media').getPublicUrl(fileName);
            
            const newSlides = [...createForm.slides];
            // @ts-ignore
            newSlides[index].mediaUrl = data.publicUrl;
            
            let type = 'document';
            if (file.type.startsWith('video')) type = 'video';
            else if (file.type.startsWith('image')) type = 'image';
            
            // @ts-ignore
            newSlides[index].mediaType = type;
            
            setCreateForm({ ...createForm, slides: newSlides });
            toast.success('تم الرفع');
        } catch (error: any) { toast.error('فشل الرفع'); } finally { setUploading(null); }
    };

    const handleExternalLink = (val: string, index: number) => {
        const newSlides: any = [...createForm.slides];
        newSlides[index].mediaUrl = val;
        
        if (val.includes('youtube') || val.includes('youtu.be') || val.endsWith('.mp4')) {
            newSlides[index].mediaType = 'video';
        } else if (val.endsWith('.pdf') || val.endsWith('.ppt') || val.endsWith('.pptx') || val.endsWith('.doc') || val.endsWith('.docx')) {
            newSlides[index].mediaType = 'document';
        } else {
            newSlides[index].mediaType = 'image';
        }
        
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

    const toggleTargetSpecialty = (spec: string) => {
        const current = createForm.target_specialties;
        if (current.includes(spec)) {
            setCreateForm({ ...createForm, target_specialties: current.filter(s => s !== spec) });
        } else {
            setCreateForm({ ...createForm, target_specialties: [...current, spec] });
        }
    };

    // ✅ دالة اختيار/إلغاء اختيار الموظف
    const toggleTargetEmployee = (empId: string) => {
        const current = createForm.target_employees;
        if (current.includes(empId)) {
            setCreateForm({ ...createForm, target_employees: current.filter(id => id !== empId) });
        } else {
            setCreateForm({ ...createForm, target_employees: [...current, empId] });
        }
    };

    // Filters
    const filteredRecords = useMemo(() => allRecords.filter((rec: any) => {
        const empName = rec.employees?.name || '';
        const empId = rec.employees?.employee_id || '';
        const title = rec.trainings?.title || rec.manual_title || '';
        const specialty = rec.employees?.specialty || '';

        const matchSearch = 
            empName.toLowerCase().includes(recordFilters.search.toLowerCase()) || 
            empId.includes(recordFilters.search) || 
            title.toLowerCase().includes(recordFilters.search.toLowerCase());
        
        const matchCode = recordFilters.employee_code ? empId.includes(recordFilters.employee_code) : true;
        const matchSpec = recordFilters.specialty === 'all' || specialty === recordFilters.specialty;

        return matchSearch && matchCode && matchSpec;
    }), [allRecords, recordFilters]);

    const filteredEmployees = useMemo(() => employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.employee_id.includes(searchTerm)), [employees, searchTerm]);
    
    // ✅ فلترة الموظفين داخل المودال (للقائمة الجديدة)
    const filteredEmployeesForSelect = useMemo(() => 
        employees.filter(e => 
            e.name.toLowerCase().includes(empSelectSearch.toLowerCase()) || 
            e.employee_id.includes(empSelectSearch)
        ), 
    [employees, empSelectSearch]);

    const employeeHistory = useMemo(() => {
        if (!showHistoryModal) return [];
        return allRecords.filter((r: any) => r.employees?.employee_id === showHistoryModal.employee_id);
    }, [allRecords, showHistoryModal]);

    // ================= UI RENDER =================

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* Tabs */}
            <div className="flex bg-white p-1.5 rounded-2xl border shadow-sm w-fit gap-1">
                <button onClick={() => setActiveTab('create')} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>المحتوى (LMS)</button>
                <button onClick={() => { setActiveTab('records'); refetchRecords(); }} className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'records' ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>السجل الشامل</button>
            </div>

            {/* TAB 1: LMS */}
            {activeTab === 'create' && (
                <>
                    <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50">
                        <div><h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><BookOpen className="w-6 h-6 text-indigo-600"/> الدورات التفاعلية</h2><p className="text-gray-500 text-sm mt-1">إدارة المحتوى التعليمي</p></div>
                        <button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg"><Plus className="w-5 h-5"/> دورة جديدة</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trainings.map((t: any) => (
                            <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden hover:shadow-md transition-all group">
                                <div className={`absolute top-0 right-0 left-0 h-1.5 ${t.type === 'online' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                                <div className="flex justify-between items-start mt-2">
                                    <div>
                                        <h3 className="font-bold text-gray-800 mb-1 line-clamp-1">{t.title}</h3>
                                        <p className="text-xs text-gray-500 font-bold flex items-center gap-1 mb-1"><MapPin className="w-3 h-3"/> {t.location || 'Online'}</p>
                                        {t.responsible_person && <p className="text-xs text-indigo-600 font-bold flex items-center gap-1"><UserCheck className="w-3 h-3"/> {t.responsible_person}</p>}
                                    </div>
                                    {t.is_mandatory && <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-1 rounded-full border border-red-100">إجباري</span>}
                                </div>
                                <div className="flex flex-wrap gap-1 mt-3">
                                    {/* عرض التخصصات */}
                                    {t.target_specialties && t.target_specialties.length > 0 && 
                                     t.target_specialties.slice(0,2).map((s: string) => <span key={s} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">{s}</span>)
                                    }
                                    
                                    {/* عرض عدد الموظفين المحددين بالاسم */}
                                    {t.target_employees && t.target_employees.length > 0 && (
                                        <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                                            {t.target_employees.length} موظف محدد
                                        </span>
                                    )}

                                    {/* إذا لم يكن هناك تحديد */}
                                    {(!t.target_specialties || t.target_specialties.length === 0) && (!t.target_employees || t.target_employees.length === 0) && (
                                        <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded">للجميع</span>
                                    )}
                                </div>
                                <div className="mt-4 flex justify-between items-center border-t border-gray-50 pt-3">
                                    <button onClick={() => setShowStatsModal(t)} className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1.5 rounded-lg flex items-center gap-1 hover:bg-green-100 transition-colors">
                                        <Users className="w-3 h-3"/> {t.completed_count || 0} اجتازوا
                                    </button>
                                    <button onClick={() => { if(confirm('حذف؟')) deleteMutation.mutate(t.id); }} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* TAB 2: RECORDS */}
            {activeTab === 'records' && (
                <>
                    <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50">
                        <div><h2 className="text-xl font-black text-gray-800 flex items-center gap-2"><FileText className="w-6 h-6 text-green-600"/> السجل الشامل</h2><p className="text-gray-500 text-sm mt-1">عرض جميع التدريبات</p></div>
                        <div className="flex gap-2">
                            <button onClick={() => refetchRecords()} className="bg-gray-100 text-gray-600 px-3 py-2.5 rounded-xl hover:bg-gray-200"><RefreshCw className={`w-5 h-5 ${loadingRecords ? 'animate-spin' : ''}`}/></button>
                            <button onClick={() => setShowAssignModal(true)} className="bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 shadow-lg"><UserPlus className="w-5 h-5"/> تسجيل يدوي</button>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative"><Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input value={recordFilters.search} onChange={e => setRecordFilters({...recordFilters, search: e.target.value})} placeholder="بحث..." className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"/></div>
                        <div className="relative"><UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input value={recordFilters.employee_code} onChange={e => setRecordFilters({...recordFilters, employee_code: e.target.value})} placeholder="كود الموظف..." className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"/></div>
                        <div className="relative"><Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><select value={recordFilters.specialty} onChange={e => setRecordFilters({...recordFilters, specialty: e.target.value})} className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold text-gray-600"><option value="all">كل التخصصات</option>{uniqueSpecialties.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    </div>

                    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 font-bold border-b text-gray-700">
                                <tr><th className="p-4">الموظف</th><th className="p-4">التخصص</th><th className="p-4">التدريب</th><th className="p-4">التاريخ</th><th className="p-4">النوع</th><th className="p-4 text-center">سجل</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {loadingRecords ? <tr><td colSpan={6} className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600"/></td></tr> : 
                                filteredRecords.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد سجلات</td></tr> : 
                                filteredRecords.map((rec: any) => (
                                    <tr key={rec.id} className="hover:bg-gray-50">
                                        <td className="p-4 font-bold text-gray-800">{rec.employees?.name} <span className="block text-[10px] text-gray-400 font-mono">{rec.employees?.employee_id}</span></td>
                                        <td className="p-4 text-xs text-gray-500 font-bold">{rec.employees?.specialty}</td>
                                        <td className="p-4 font-bold text-indigo-700">{rec.trainings?.title || rec.manual_title}</td>
                                        <td className="p-4 font-mono text-xs">{new Date(rec.manual_date || rec.completed_at).toLocaleDateString('ar-EG')}</td>
                                        <td className="p-4"><span className={`px-2 py-1 rounded text-[10px] font-bold ${rec.type === 'manual' ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>{rec.type === 'manual' ? 'يدوي' : 'تفاعلي'}</span></td>
                                        <td className="p-4 text-center"><button onClick={() => setShowHistoryModal(rec.employees)} className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg"><Eye className="w-4 h-4"/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* --- MODALS --- */}

            {/* 1. Modal: Create Training */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b flex justify-between items-center shrink-0">
                            <h3 className="font-black text-xl text-gray-800">إضافة دورة جديدة</h3>
                            <button onClick={() => setShowCreateModal(false)}><X className="w-6 h-6 text-gray-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Input label="العنوان" value={createForm.title} onChange={v => setCreateForm({...createForm, title: v})} required />
                                <Select label="النوع" options={['internal', 'external', 'online']} value={createForm.type} onChange={v => setCreateForm({...createForm, type: v})} />
                                {createForm.type !== 'online' && <Input label="المكان" value={createForm.location} onChange={v => setCreateForm({...createForm, location: v})} />}
                                <Input label="المسؤول / المحاضر" value={createForm.responsible_person} onChange={v => setCreateForm({...createForm, responsible_person: v})} />
                                <Select label="إلزامي؟" options={['true', 'false']} value={createForm.is_mandatory} onChange={v => setCreateForm({...createForm, is_mandatory: v})} />
                                <Input label="النقاط" type="number" value={createForm.points} onChange={v => setCreateForm({...createForm, points: Number(v)})} />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* التخصصات المستهدفة */}
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-indigo-800">حسب التخصص</label>
                                        <button onClick={() => setCreateForm({...createForm, target_specialties: []})} className="text-xs text-indigo-600 underline">مسح التخصصات</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto custom-scrollbar">
                                        {uniqueSpecialties.map(spec => (
                                            <button 
                                                key={spec} 
                                                onClick={() => toggleTargetSpecialty(spec)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${createForm.target_specialties.includes(spec) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
                                            >
                                                {spec}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* ✅ اختيار موظفين محددين */}
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-bold text-amber-800">أو موظفين محددين</label>
                                        <button onClick={() => setCreateForm({...createForm, target_employees: []})} className="text-xs text-amber-600 underline">مسح الموظفين</button>
                                    </div>
                                    <input 
                                        placeholder="ابحث بالاسم أو الكود..." 
                                        className="w-full text-xs p-2 rounded-lg border border-amber-200 mb-2 focus:ring-1 focus:ring-amber-400 outline-none"
                                        value={empSelectSearch}
                                        onChange={(e) => setEmpSelectSearch(e.target.value)}
                                    />
                                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
                                        {filteredEmployeesForSelect.slice(0, 20).map(emp => {
                                            const isSelected = createForm.target_employees.includes(emp.employee_id);
                                            return (
                                                <button 
                                                    key={emp.id} 
                                                    onClick={() => toggleTargetEmployee(emp.employee_id)}
                                                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex justify-between items-center border ${isSelected ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-600 border-gray-100'}`}
                                                >
                                                    <span>{emp.name}</span>
                                                    {isSelected ? <CheckCircle className="w-3 h-3"/> : <Plus className="w-3 h-3 text-gray-300"/>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Slides Builder */}
                            <div className="bg-gray-50 p-4 rounded-2xl border border-dashed">
                                {createForm.slides.map((slide, idx) => (
                                    <div key={idx} className="bg-white p-4 mb-4 rounded-xl border shadow-sm relative">
                                        <button onClick={() => slideActions.remove(idx)} className="absolute top-2 left-2 text-red-500 bg-red-50 p-1.5 rounded"><Trash2 className="w-4 h-4"/></button>
                                        <span className="text-xs font-black text-gray-400 mb-2 block">شريحة #{idx+1}</span>
                                        <input placeholder="عنوان الشريحة" className="w-full font-bold mb-2 border-b outline-none" value={slide.title} onChange={e => slideActions.update(idx, 'title', e.target.value)} />
                                        
                                        <div className="flex gap-4">
                                            {/* مربع الميديا */}
                                            <div className="w-40 h-40 bg-gray-100 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden border p-2">
                                                {slide.mediaUrl ? (
                                                    <>
                                                        {slide.mediaType === 'video' ? (
                                                            <video src={slide.mediaUrl} className="w-full h-full object-cover"/> 
                                                        ) : (slide.mediaType === 'document' || slide.mediaUrl.includes('.pdf') || slide.mediaUrl.includes('.ppt')) ? (
                                                            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-200 text-gray-600">
                                                                <FileText className="w-10 h-10 mb-2"/>
                                                                <span className="text-[9px] text-center font-bold px-2 truncate w-full">مستند</span>
                                                                <a href={slide.mediaUrl} target="_blank" rel="noreferrer" className="text-[9px] text-indigo-600 underline mt-1">عرض</a>
                                                            </div>
                                                        ) : (
                                                            <img src={slide.mediaUrl} className="w-full h-full object-cover" alt=""/>
                                                        )}
                                                        <button onClick={() => slideActions.removeMedia(idx)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full"><X className="w-3 h-3"/></button>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col gap-2 w-full">
                                                        <label className="cursor-pointer bg-white border rounded p-1 text-[10px] text-center hover:bg-gray-50 flex items-center justify-center gap-1">
                                                            {uploading === idx ? <Loader2 className="w-3 h-3 animate-spin"/> : <Upload className="w-3 h-3"/>} ملف
                                                            <input type="file" accept="image/*,video/*,.pdf,.ppt,.pptx,.doc,.docx" className="hidden" onChange={(e) => handleFileUpload(e, idx)} disabled={uploading !== null}/>
                                                        </label>
                                                        <div className="text-[9px] text-center text-gray-400 font-bold">- أو -</div>
                                                        <button onClick={() => { const url = prompt('رابط الصورة/الفيديو/الملف:'); if(url) handleExternalLink(url, idx); }} className="bg-white border rounded p-1 text-[10px] text-center hover:bg-gray-50 flex items-center justify-center gap-1"><LinkIcon className="w-3 h-3"/> رابط</button>
                                                    </div>
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

            {/* 2. Modal: Stats (Who Completed) */}
            {showStatsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-green-50">
                            <h3 className="font-black text-lg text-green-800">المجتازين: {showStatsModal.title}</h3>
                            <button onClick={() => setShowStatsModal(null)}><X className="w-5 h-5 text-gray-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {loadingStats ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-green-600"/> : 
                             specificTrainingStats.length === 0 ? <p className="text-center text-gray-400 py-4">لا يوجد بيانات.</p> : (
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

            {/* 3. Modal: Employee History */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-blue-50">
                            <h3 className="font-black text-lg text-blue-800">سجل: {showHistoryModal.name}</h3>
                            <button onClick={() => setShowHistoryModal(null)}><X className="w-5 h-5 text-gray-400"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {employeeHistory.length === 0 ? <p className="text-center text-gray-400 py-4">سجل فارغ.</p> : (
                                <table className="w-full text-sm text-right">
                                    <thead className="text-gray-500 border-b"><tr><th className="pb-2">التدريب</th><th className="pb-2">التاريخ</th><th className="pb-2">النوع</th></tr></thead>
                                    <tbody className="divide-y">
                                        {employeeHistory.map((h: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-gray-50">
                                                <td className="py-3 font-bold text-gray-800">{h.trainings?.title || h.manual_title}</td>
                                                <td className="py-3 font-mono text-xs">{new Date(h.manual_date || h.completed_at).toLocaleDateString('ar-EG')}</td>
                                                <td className="py-3"><span className={`px-2 py-0.5 rounded text-[10px] ${h.type === 'manual' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{h.type === 'manual' ? 'يدوي' : 'تفاعلي'}</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Modal: Assign Manual */}
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
                                <input placeholder="ابحث..." className="w-full p-2 rounded-xl border bg-gray-50 mb-2 text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                                <select className="w-full p-3 rounded-xl border bg-white font-bold" value={assignForm.employee_id} onChange={e => setAssignForm({...assignForm, employee_id: e.target.value})}>
                                    <option value="">-- اختر --</option>
                                    {filteredEmployees.map(e => <option key={e.id} value={e.employee_id}>{e.name} ({e.specialty})</option>)}
                                </select>
                            </div>
                            <Input label="اسم الدورة" value={assignForm.manual_title} onChange={v => setAssignForm({...assignForm, manual_title: v})} required />
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
