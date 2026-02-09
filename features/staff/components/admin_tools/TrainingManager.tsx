import React, { useState, useMemo } from 'react';
import { supabase } from '../../../../supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    Plus, Save, Trash2, BookOpen, MapPin, Layers, 
    Loader2, Image as ImageIcon, Video, X, CheckCircle, AlertCircle,
    UserPlus, Search, Filter, Calendar
} from 'lucide-react';
import { Input, Select } from '../../../../components/ui/FormElements';
import toast from 'react-hot-toast';
import { Employee } from '../../../../types';

export default function TrainingManager() {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'create' | 'assign'>('create');
    
    // --- State for "Create Training" (Existing) ---
    const [showModal, setShowModal] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null);
    const initialFormState = {
        title: '',
        type: 'internal',
        location: '',
        training_date: '',
        is_mandatory: 'false',
        points: 10,
        slides: [{ title: 'مقدمة', content: '', mediaUrl: '', mediaType: 'none' }] 
    };
    const [formData, setFormData] = useState(initialFormState);

    // --- State for "Assign Training" (New) ---
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSpecialty, setFilterSpecialty] = useState('all');
    const [assignForm, setAssignForm] = useState({
        employee_id: '',
        training_name: '',
        training_date: new Date().toISOString().split('T')[0],
        training_location: 'داخل المركز',
        training_type: 'internal'
    });

    // --- State for "Training Records" (New) ---
    const [recordSearch, setRecordSearch] = useState('');
    const [recordFilterSpec, setRecordFilterSpec] = useState('all');

    // 1. Fetch Data
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
            const { data } = await supabase.from('employees').select('id, name, employee_id, specialty, status').order('name');
            return data as Employee[];
        }
    });

    // جلب سجلات التدريب المسجلة يدوياً (للعرض)
    // سنستخدم جدول منفصل أو نفس الجدول مع flag، لكن للأسهل سنفترض أننا نسجل في جدول `employee_training_records`
    // أو نستخدم حقل `training_courses` في الموظف (نصي) أو جدول جديد.
    // الأفضل: إنشاء جدول `training_logs` لتسجيل كل دورة يأخذها الموظف.
    /*
        SQL المقترح لهذا الجدول الجديد:
        CREATE TABLE training_logs (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            employee_id TEXT REFERENCES employees(employee_id),
            training_name TEXT,
            training_date DATE,
            location TEXT,
            type TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        );
    */
    const { data: trainingLogs = [] } = useQuery({
        queryKey: ['training_logs'],
        queryFn: async () => {
            // نقوم بعمل Join لجلب اسم الموظف وتخصصه
            const { data, error } = await supabase
                .from('training_logs')
                .select('*, employees(name, specialty)')
                .order('training_date', { ascending: false });
            
            if(error) {
                console.error("Error fetching logs (Create table 'training_logs' first!)", error);
                return [];
            }
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
        },
        onSuccess: () => {
            toast.success('تم نشر التدريب بنجاح');
            setShowModal(false);
            setFormData(initialFormState);
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
            toast.success('تم حذف التدريب');
            queryClient.invalidateQueries({ queryKey: ['admin_trainings'] });
        }
    });

    // تسجيل تدريب لموظف
    const assignMutation = useMutation({
        mutationFn: async (data: any) => {
            // 1. تسجيل في السجل الجديد
            const { error } = await supabase.from('training_logs').insert([data]);
            if (error) throw error;

            // 2. (اختياري) تحديث حقل النصوص القديم في جدول الموظفين للإرشيف
            // await supabase.rpc('append_training_text', { emp_id: data.employee_id, text: data.training_name });
        },
        onSuccess: () => {
            toast.success('تم تسجيل التدريب للموظف');
            setShowAssignModal(false);
            setAssignForm({ ...assignForm, employee_id: '', training_name: '' });
            queryClient.invalidateQueries({ queryKey: ['training_logs'] });
        },
        onError: (err: any) => toast.error('فشل التسجيل: ' + err.message)
    });

    // --- Helper Functions for Create Training ---
    const handleFileUpload = async (event: any, index: number) => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 50 * 1024 * 1024) return toast.error("حجم الملف كبير جداً");

        setUploading(index);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `slides/${fileName}`;

            const { error: uploadError } = await supabase.storage.from('training-media').upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('training-media').getPublicUrl(filePath);
            const type = file.type.startsWith('video') ? 'video' : 'image';

            const newSlides = [...formData.slides];
            // @ts-ignore
            newSlides[index].mediaUrl = publicUrl;
            // @ts-ignore
            newSlides[index].mediaType = type;
            setFormData({ ...formData, slides: newSlides });
            toast.success('تم الرفع');
        } catch (error: any) {
            toast.error('فشل الرفع');
        } finally {
            setUploading(null);
        }
    };

    const addSlide = () => setFormData({ ...formData, slides: [...formData.slides, { title: '', content: '', mediaUrl: '', mediaType: 'none' }] });
    const removeSlide = (index: number) => {
        if (formData.slides.length === 1) return;
        setFormData({ ...formData, slides: formData.slides.filter((_, i) => i !== index) });
    };
    const updateSlide = (index: number, field: string, value: string) => {
        const newSlides = [...formData.slides];
        // @ts-ignore
        newSlides[index][field] = value;
        setFormData({ ...formData, slides: newSlides });
    };
    const removeMedia = (index: number) => {
        const newSlides = [...formData.slides];
        // @ts-ignore
        newSlides[index].mediaUrl = '';
        // @ts-ignore
        newSlides[index].mediaType = 'none';
        setFormData({ ...formData, slides: newSlides });
    };

    // --- Filter Logic for Assign Modal ---
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const matchSearch = emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.employee_id.includes(searchTerm);
            const matchSpec = filterSpecialty === 'all' || emp.specialty === filterSpecialty;
            return matchSearch && matchSpec && emp.status === 'نشط';
        });
    }, [employees, searchTerm, filterSpecialty]);

    // --- Filter Logic for Training Logs ---
    const filteredLogs = useMemo(() => {
        return trainingLogs.filter((log: any) => {
            const empName = log.employees?.name || '';
            const matchSearch = empName.toLowerCase().includes(recordSearch.toLowerCase()) || log.training_name.includes(recordSearch);
            const matchSpec = recordFilterSpec === 'all' || log.employees?.specialty === recordFilterSpec;
            return matchSearch && matchSpec;
        });
    }, [trainingLogs, recordSearch, recordFilterSpec]);

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            
            {/* Tabs Header */}
            <div className="flex bg-white p-1 rounded-2xl border shadow-sm w-fit">
                <button 
                    onClick={() => setActiveTab('create')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    إنشاء محتوى تدريبي
                </button>
                <button 
                    onClick={() => setActiveTab('assign')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'assign' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                >
                    سجل التدريبات الفردية
                </button>
            </div>

            {/* ===================================================================================== */}
            {/* TAB 1: CREATE CONTENT (الكود السابق) */}
            {/* ===================================================================================== */}
            {activeTab === 'create' && (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50 gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                                <BookOpen className="w-8 h-8 text-indigo-600"/> الدورات التدريبية (Online/Slides)
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">إنشاء محتوى تعليمي يظهر في تطبيق الموظف</p>
                        </div>
                        <button onClick={() => setShowModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95">
                            <Plus className="w-5 h-5"/> تدريب جديد
                        </button>
                    </div>

                    {/* List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trainings.map((t: any) => (
                            <div key={t.id} className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                                <div className={`absolute top-0 right-0 left-0 h-2 ${t.type === 'online' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                                <div className="flex justify-between items-start mt-2">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-1">{t.title}</h3>
                                        <p className="text-xs text-gray-500 font-bold flex items-center gap-1"><MapPin className="w-3 h-3"/> {t.type}</p>
                                    </div>
                                    {t.is_mandatory && <span className="bg-red-50 text-red-600 text-[10px] font-black px-2 py-1 rounded-full border border-red-100">إجباري</span>}
                                </div>
                                <div className="mt-6 flex justify-between items-center border-t border-gray-50 pt-4">
                                    <div className="flex gap-3">
                                        <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg flex items-center gap-1"><Layers className="w-3 h-3"/> {t.slides?.length || 0}</span>
                                        <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg flex items-center gap-1">{t.points} نقطة</span>
                                    </div>
                                    <button onClick={() => deleteMutation.mutate(t.id)} className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* ===================================================================================== */}
            {/* TAB 2: TRAINING RECORDS (الجديد) */}
            {/* ===================================================================================== */}
            {activeTab === 'assign' && (
                <>
                    <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-indigo-50 gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                                <CheckCircle className="w-8 h-8 text-green-600"/> سجل التدريبات الفردية
                            </h2>
                            <p className="text-gray-500 text-sm mt-1">تسجيل الدورات التي حصل عليها الموظفون (داخل/خارج المركز)</p>
                        </div>
                        <button onClick={() => setShowAssignModal(true)} className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-green-700 shadow-lg shadow-green-200 transition-all active:scale-95">
                            <UserPlus className="w-5 h-5"/> تسجيل تدريب لموظف
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
                            <input 
                                placeholder="بحث في السجل (اسم الموظف أو التدريب)..." 
                                value={recordSearch} 
                                onChange={e => setRecordSearch(e.target.value)}
                                className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 outline-none text-sm"
                            />
                        </div>
                        <select 
                            value={recordFilterSpec} 
                            onChange={e => setRecordFilterSpec(e.target.value)}
                            className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold"
                        >
                            <option value="all">كل التخصصات</option>
                            {Array.from(new Set(employees.map(e => e.specialty))).map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>

                    {/* Records Table */}
                    <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-gray-50 font-bold border-b text-gray-700">
                                <tr>
                                    <th className="p-4">الموظف</th>
                                    <th className="p-4">التخصص</th>
                                    <th className="p-4">اسم التدريب</th>
                                    <th className="p-4">التاريخ</th>
                                    <th className="p-4">المكان</th>
                                    <th className="p-4">النوع</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filteredLogs.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-gray-400">لا توجد سجلات</td></tr>
                                ) : (
                                    filteredLogs.map((log: any) => (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 font-bold text-gray-800">{log.employees?.name}</td>
                                            <td className="p-4 text-xs text-gray-500">{log.employees?.specialty}</td>
                                            <td className="p-4 font-bold text-indigo-700">{log.training_name}</td>
                                            <td className="p-4 font-mono text-xs">{new Date(log.training_date).toLocaleDateString('ar-EG')}</td>
                                            <td className="p-4 text-xs">{log.location}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${log.type === 'internal' ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                                                    {log.type === 'internal' ? 'داخل المركز' : 'خارج المركز'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ===================================================================================== */}
            {/* MODALS */}
            {/* ===================================================================================== */}

            {/* 1. Modal: Create Content (Existing) */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
                        {/* ... (نفس محتوى مودال إنشاء التدريب السابق بالضبط) ... */}
                        {/* سأختصره هنا لتوفير المساحة، انسخ الجزء الخاص بالـ Form من ردودي السابقة وضعه هنا */}
                        {/* يجب وضع الـ Header, Inputs, Slides Builder, Footer هنا */}
                        <div className="p-6 border-b flex justify-between items-center shrink-0">
                            <h3 className="font-black text-xl text-gray-800 flex items-center gap-2">
                                <BookOpen className="w-6 h-6 text-indigo-600"/> إضافة برنامج تدريبي
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 bg-gray-50 p-2 rounded-full"><X className="w-6 h-6"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                             {/* ... Inputs & Slide Builder code ... */}
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <Input label="عنوان التدريب" value={formData.title} onChange={v => setFormData({...formData, title: v})} placeholder="مثال: بروتوكول التعامل مع الطوارئ" required />
                                <Select label="نوع التدريب" options={['internal', 'external', 'online']} value={formData.type} onChange={v => setFormData({...formData, type: v})} />
                                {formData.type !== 'online' && <Input label="المكان" value={formData.location} onChange={v => setFormData({...formData, location: v})} placeholder="اسم القاعة / المركز" />}
                                <Input label="تاريخ التدريب (اختياري)" type="datetime-local" value={formData.training_date} onChange={v => setFormData({...formData, training_date: v})} />
                                <Select label="إلزامية التدريب" options={['true', 'false']} value={formData.is_mandatory} onChange={v => setFormData({...formData, is_mandatory: v})} />
                                <Input label="نقاط المكافأة عند الإتمام" type="number" value={formData.points} onChange={v => setFormData({...formData, points: Number(v)})} />
                            </div>
                            {/* Slides Builder (مختصر) - انسخ الكود الكامل للشرائح هنا */}
                            <div className="bg-gray-50/80 p-6 rounded-3xl border border-gray-200">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2 text-lg"><Layers className="w-5 h-5 text-indigo-600"/> محتوى التدريب</h4>
                                    <button onClick={addSlide} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Plus className="w-4 h-4"/> شريحة</button>
                                </div>
                                <div className="space-y-6">
                                    {formData.slides.map((slide: any, index: number) => (
                                        <div key={index} className="bg-white p-5 rounded-3xl border border-gray-200 shadow-sm relative">
                                            <div className="absolute top-4 left-4 flex gap-2">
                                                <button onClick={() => removeSlide(index)} className="bg-red-50 text-red-500 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                            <div className="space-y-4 pt-2">
                                                <input placeholder="عنوان الشريحة" className="w-full font-black text-lg border-b-2 outline-none pb-2" value={slide.title} onChange={(e) => updateSlide(index, 'title', e.target.value)}/>
                                                <div className="flex gap-4">
                                                    <div className="w-40 h-40 bg-gray-100 rounded-2xl flex items-center justify-center relative">
                                                        {slide.mediaUrl ? (
                                                            <>
                                                                {slide.mediaType === 'video' ? <video src={slide.mediaUrl} className="w-full h-full object-cover"/> : <img src={slide.mediaUrl} className="w-full h-full object-cover"/>}
                                                                <button onClick={() => removeMedia(index)} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full"><X className="w-3 h-3"/></button>
                                                            </>
                                                        ) : (
                                                            <label className="cursor-pointer w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs text-center p-2">
                                                                <ImageIcon className="w-6 h-6 mb-1"/> 
                                                                {uploading === index ? 'جاري الرفع...' : 'صورة/فيديو'}
                                                                <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => handleFileUpload(e, index)} disabled={uploading !== null}/>
                                                            </label>
                                                        )}
                                                    </div>
                                                    <textarea placeholder="الشرح..." className="flex-1 w-full bg-gray-50 p-3 rounded-2xl outline-none resize-none" value={slide.content} onChange={(e) => updateSlide(index, 'content', e.target.value)}/>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t bg-gray-50 flex gap-4 shrink-0">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-4 rounded-2xl font-bold text-gray-500 hover:bg-gray-200">إلغاء</button>
                            <button onClick={() => createMutation.mutate(formData)} disabled={createMutation.isPending || uploading !== null} className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl flex justify-center gap-2">
                                {createMutation.isPending ? <Loader2 className="animate-spin"/> : <Save className="w-5 h-5"/>} نشر
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Modal: Assign Training (New) */}
            {showAssignModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-white rounded-[2rem] w-full max-w-2xl shadow-2xl overflow-hidden zoom-in-95">
                        <div className="bg-gray-50 p-6 border-b flex justify-between items-center">
                            <h3 className="font-black text-xl text-gray-800 flex items-center gap-2">
                                <UserPlus className="w-6 h-6 text-green-600"/> تسجيل تدريب لموظف
                            </h3>
                            <button onClick={() => setShowAssignModal(false)}><X className="w-6 h-6 text-gray-400 hover:text-red-500"/></button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            {/* Employee Selection */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-gray-700">اختر الموظف</label>
                                <div className="flex gap-2 mb-2">
                                    <input 
                                        placeholder="بحث بالاسم أو الكود..." 
                                        value={searchTerm} 
                                        onChange={e => setSearchTerm(e.target.value)} 
                                        className="flex-1 p-2 rounded-xl border bg-gray-50 outline-none text-sm"
                                    />
                                    <select 
                                        value={filterSpecialty} 
                                        onChange={e => setFilterSpecialty(e.target.value)} 
                                        className="p-2 rounded-xl border bg-gray-50 outline-none text-sm font-bold"
                                    >
                                        <option value="all">كل التخصصات</option>
                                        {Array.from(new Set(employees.map(e => e.specialty))).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <select 
                                    className="w-full p-3 rounded-xl border bg-white focus:border-green-500 outline-none font-bold"
                                    value={assignForm.employee_id}
                                    onChange={e => setAssignForm({...assignForm, employee_id: e.target.value})}
                                >
                                    <option value="">-- اختر من القائمة ({filteredEmployees.length}) --</option>
                                    {filteredEmployees.map(emp => (
                                        <option key={emp.employee_id} value={emp.employee_id}>
                                            {emp.name} ({emp.specialty})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Training Details */}
                            <Input label="اسم التدريب / الدورة" value={assignForm.training_name} onChange={v => setAssignForm({...assignForm, training_name: v})} placeholder="اسم الدورة..." />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <Input label="التاريخ" type="date" value={assignForm.training_date} onChange={v => setAssignForm({...assignForm, training_date: v})} />
                                <Select label="نوع التدريب" options={['internal', 'external']} value={assignForm.training_type} onChange={v => setAssignForm({...assignForm, training_type: v})} />
                            </div>
                            
                            <Input label="المكان" value={assignForm.training_location} onChange={v => setAssignForm({...assignForm, training_location: v})} />

                            <button 
                                onClick={() => assignMutation.mutate(assignForm)}
                                disabled={assignMutation.isPending || !assignForm.employee_id || !assignForm.training_name}
                                className="w-full bg-green-600 text-white py-4 rounded-xl font-black text-lg hover:bg-green-700 shadow-lg shadow-green-200 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                            >
                                {assignMutation.isPending ? <Loader2 className="animate-spin"/> : <Save className="w-5 h-5"/>} حفظ السجل
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
