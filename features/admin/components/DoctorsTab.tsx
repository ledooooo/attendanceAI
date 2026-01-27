import React, { useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { Input, Select } from '../../../components/ui/FormElements';
import { ExcelUploadButton } from '../../../components/ui/ExcelUploadButton';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { 
    Download, Users, ArrowRight, User, Clock, FileText, 
    Award, BarChart, Inbox, ArrowUpDown, ArrowUp, ArrowDown, PieChart, 
    RefreshCw, FileSpreadsheet, UserPlus, X, Save, Edit, Loader2, Baby, Timer, Info, Syringe, ShieldCheck
} from 'lucide-react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Sub-components
import StaffProfile from '../../staff/components/StaffProfile';
import StaffAttendance from '../../staff/components/StaffAttendance';
import StaffRequestsHistory from '../../staff/components/StaffRequestsHistory';
import StaffEvaluations from '../../staff/components/StaffEvaluations';
import StaffStats from '../../staff/components/StaffStats';
import StaffMessages from '../../staff/components/StaffMessages';

const DAYS_OPTIONS = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];

// في ملف DoctorsTab.tsx
const AVAILABLE_PERMISSIONS = [
    { id: 'vaccinations', label: 'إدارة التطعيمات' },
    { id: 'attendance', label: 'إدارة البصمة والحضور' },
    { id: 'reports', label: 'التقارير وشئون الموظفين' }, // DoctorsTab
    { id: 'leaves', label: 'إدارة الإجازات والطلبات' }, // ✅ جديد
    { id: 'absence', label: 'تقارير الغياب' }, // ✅ جديد
    { id: 'quality', label: 'إدارة الجودة (OVR)' },
];

export default function DoctorsTab({ employees, onRefresh, centerId }: { employees: Employee[], onRefresh: () => void, centerId: string }) {
    const queryClient = useQueryClient();

    // UI State
    const [fName, setFName] = useState('');
    const [fId, setFId] = useState('');
    const [fSpec, setFSpec] = useState('all');
    const [fStatus, setFStatus] = useState('all');
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'employee_id' | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'asc' });
    const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
    const [detailTab, setDetailTab] = useState('profile');
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

    // Form State
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [isPartTimeEnabled, setIsPartTimeEnabled] = useState(false);
    
    // ✅ الحالة الابتدائية محدثة بجميع الحقول الجديدة
    const initialFormState: any = {
        employee_id: '', name: '', national_id: '', specialty: '', phone: '', email: '',
        gender: 'ذكر', grade: '', photo_url: '', id_front_url: '', id_back_url: '',
        religion: 'مسلم', work_days: [], start_time: '08:00', end_time: '14:00',
        leave_annual_balance: 21, leave_casual_balance: 7, total_absence: 0,
        remaining_annual: 21, remaining_casual: 7, admin_tasks: '',
        status: 'نشط', join_date: new Date().toISOString().split('T')[0],
        resignation_date: '', 
        training_courses: '', notes: '', maternity: 'false', role: 'user',
        nursing_start_date: '', nursing_end_date: '', nursing_time: '',
        part_time_start_date: '', part_time_end_date: '',
        // الحقول الجديدة
        address: '', qualification: '', marital_status: '', penalties: '',
        permissions: [], // مصفوفة الصلاحيات
        hep_b_dose1: '', hep_b_dose2: '', hep_b_dose3: '', hep_b_notes: '', hep_b_location: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    // 1. Fetch Data
    const { data: empData = { attendance: [], requests: [], evals: [], messages: [] }, isLoading: loadingDetails } = useQuery({
        queryKey: ['employee_full_details', selectedEmp?.employee_id],
        queryFn: async () => {
            if (!selectedEmp) return null;
            const [att, req, evl, msg] = await Promise.all([
                supabase.from('attendance').select('*').eq('employee_id', selectedEmp.employee_id),
                supabase.from('leave_requests').select('*').eq('employee_id', selectedEmp.employee_id).order('created_at', { ascending: false }),
                supabase.from('evaluations').select('*').eq('employee_id', selectedEmp.employee_id).order('month', { ascending: false }),
                supabase.from('messages').select('*').or(`to_user.eq.${selectedEmp.employee_id},to_user.eq.all`).order('created_at', { ascending: false })
            ]);
            
            return { 
                attendance: att.data || [], 
                requests: req.data || [], 
                evals: evl.data || [], 
                messages: msg.data || [] 
            };
        },
        enabled: !!selectedEmp,
        staleTime: 1000 * 60 * 2,
    });

    // 2. Mutations
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const payload = {
                ...data,
                center_id: centerId,
                leave_annual_balance: Number(data.leave_annual_balance),
                leave_casual_balance: Number(data.leave_casual_balance),
                remaining_annual: Number(data.remaining_annual),
                remaining_casual: Number(data.remaining_casual),
                total_absence: Number(data.total_absence),
                part_time_start_date: isPartTimeEnabled ? data.part_time_start_date : null,
                part_time_end_date: isPartTimeEnabled ? data.part_time_end_date : null,
                // التأكد من أن التواريخ الفارغة ترسل كـ null
                hep_b_dose1: data.hep_b_dose1 || null,
                hep_b_dose2: data.hep_b_dose2 || null,
                hep_b_dose3: data.hep_b_dose3 || null,
                permissions: data.permissions || [] // حفظ مصفوفة الصلاحيات
            };

            if (editMode && data.id) {
                const { error } = await supabase.from('employees').update(payload).eq('id', data.id);
                if (error) throw error;
            } else {
                if (!payload.id) delete payload.id;
                const { error } = await supabase.from('employees').insert([payload]);
                if (error) throw error;
            }
        },
        onSuccess: () => {
            toast.success(editMode ? 'تم تعديل البيانات بنجاح' : 'تم إضافة الموظف بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
            setShowModal(false);
            onRefresh();
        },
        onError: (err: any) => toast.error(err.message)
    });

    const statusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: string }) => {
            const { error } = await supabase.from('employees').update({ status }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم تحديث الحالة');
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
        },
        onError: () => toast.error('فشل تحديث الحالة')
    });

    const syncMutation = useMutation({
        mutationFn: async () => {
            const { error } = await supabase.rpc('recalculate_all_balances');
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تمت مزامنة الأرصدة بنجاح');
            queryClient.invalidateQueries({ queryKey: ['admin_employees'] });
        },
        onError: (err: any) => toast.error(err.message)
    });

    // 3. UI Logic
    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        saveMutation.mutate(formData);
    };

    const handleSort = (key: 'name' | 'employee_id') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const sortedEmployees = useMemo(() => {
        let filtered = employees.filter(e => 
            (e.name.includes(fName)) && (e.employee_id.includes(fId)) && 
            (fSpec === 'all' || e.specialty === fSpec) && (fStatus === 'all' || e.status === fStatus)
        );

        if (sortConfig.key !== null) {
            filtered.sort((a, b) => {
                // @ts-ignore
                if (a[sortConfig.key!] < b[sortConfig.key!]) return sortConfig.direction === 'asc' ? -1 : 1;
                // @ts-ignore
                if (a[sortConfig.key!] > b[sortConfig.key!]) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return filtered;
    }, [employees, fName, fId, fSpec, fStatus, sortConfig]);

    const handleOpenAdd = () => {
        setFormData(initialFormState);
        setEditMode(false);
        setIsPartTimeEnabled(false);
        setShowModal(true);
    };

    const handleOpenEdit = (emp: Employee) => {
        setFormData({
            ...initialFormState, // دمج مع القيم الافتراضية لضمان وجود الحقول الجديدة
            ...emp,
            work_days: typeof emp.work_days === 'string' ? JSON.parse(emp.work_days) : emp.work_days || [],
            maternity: String(emp.maternity),
            permissions: emp.permissions || [] // التأكد من وجود المصفوفة
        });
        setEditMode(true);
        setIsPartTimeEnabled(!!emp.part_time_start_date || !!emp.part_time_end_date);
        setShowModal(true);
    };

    const handleDayToggle = (day: string) => {
        const currentDays = Array.isArray(formData.work_days) ? formData.work_days : [];
        if (currentDays.includes(day)) {
            setFormData({ ...formData, work_days: currentDays.filter((d:string) => d !== day) });
        } else {
            setFormData({ ...formData, work_days: [...currentDays, day] });
        }
    };

    const handlePermissionToggle = (permId: string) => {
        const currentPerms = Array.isArray(formData.permissions) ? formData.permissions : [];
        if (currentPerms.includes(permId)) {
            setFormData({ ...formData, permissions: currentPerms.filter((p: string) => p !== permId) });
        } else {
            setFormData({ ...formData, permissions: [...currentPerms, permId] });
        }
    };

    const togglePartTime = (enabled: boolean) => {
        setIsPartTimeEnabled(enabled);
        if (!enabled) {
            setFormData({ ...formData, part_time_start_date: '', part_time_end_date: '' });
        }
    };

    const handleExportEmployees = async () => {
        const ws = XLSX.utils.json_to_sheet(employees);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "All_Employees");
        XLSX.writeFile(wb, `Employees_${new Date().toISOString().split('T')[0]}.xlsx`);
    };
    const handleDownloadSample = () => {}; 
    const handleExcelImport = async (data: any[]) => {}; 

    // --- View ---
    if (selectedEmp) {
        return (
            <div className="space-y-6 animate-in slide-in-from-left duration-300">
                <div className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-blue-100">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSelectedEmp(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <ArrowRight className="w-6 h-6 text-gray-600"/>
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-gray-800">{selectedEmp.name}</h2>
                            <p className="text-xs text-gray-500 font-bold">{selectedEmp.specialty} • {selectedEmp.employee_id}</p>
                        </div>
                    </div>
                    <button onClick={() => handleOpenEdit(selectedEmp)} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center gap-2">
                        <Edit className="w-4 h-4"/> تعديل البيانات
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {[
                        {id: 'profile', icon: User, label: 'البيانات والتعديل'},
                        {id: 'attendance', icon: Clock, label: 'الحضور'},
                        {id: 'stats', icon: BarChart, label: 'الإحصائيات'},
                        {id: 'requests', icon: FileText, label: 'الطلبات'},
                        {id: 'evals', icon: Award, label: 'التقييمات'},
                        {id: 'messages', icon: Inbox, label: 'الرسائل'},
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setDetailTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${detailTab === tab.id ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                        >
                            <tab.icon className="w-4 h-4"/> {tab.label}
                        </button>
                    ))}
                </div>

                <div className="bg-white p-6 rounded-[30px] border shadow-sm min-h-[500px]">
                    {loadingDetails ? (
                        <div className="flex items-center justify-center h-40 text-gray-400 gap-2">
                            <Loader2 className="w-6 h-6 animate-spin" /> جاري تحميل الملف...
                        </div>
                    ) : (
                        <>
                            {detailTab === 'profile' && <StaffProfile employee={selectedEmp} isEditable={true} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['admin_employees'] })} />}
                            {detailTab === 'attendance' && <StaffAttendance attendance={empData.attendance} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} employee={selectedEmp} />}
                            {detailTab === 'stats' && <StaffStats attendance={empData.attendance} evals={empData.evals} requests={empData.requests} month={selectedMonth} employee={selectedEmp} />}
                            {detailTab === 'requests' && <StaffRequestsHistory requests={empData.requests} employee={selectedEmp} />}
                            {detailTab === 'evals' && <StaffEvaluations employee={selectedEmp} isAdmin={true} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['employee_full_details'] })} />}
                            {detailTab === 'messages' && <StaffMessages messages={empData.messages} employee={selectedEmp} currentUserId="admin" />}                                
                        </>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            <div className="flex flex-col md:flex-row justify-between items-center border-b pb-4 gap-4">
                <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800"><Users className="w-7 h-7 text-blue-600"/> شئون الموظفين</h2>
                <div className="flex flex-wrap gap-2 justify-center">
                    
                    <button onClick={handleOpenAdd} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 text-sm">
                        <UserPlus className="w-4 h-4"/> إضافة موظف
                    </button>

                    <button 
                        onClick={() => { if(confirm('تأكيد المزامنة؟')) syncMutation.mutate(); }} 
                        disabled={syncMutation.isPending}
                        className="bg-orange-50 text-orange-600 border border-orange-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-100 transition-all shadow-sm text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`}/> 
                        {syncMutation.isPending ? 'جاري الحساب...' : 'مزامنة الأرصدة'}
                    </button>

                    <button onClick={handleExportEmployees} className="bg-green-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg shadow-green-200 text-sm">
                        <FileSpreadsheet className="w-4 h-4"/> تصدير Excel
                    </button>

                    <button onClick={handleDownloadSample} className="bg-white text-gray-600 border border-gray-200 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all text-sm">
                        <Download className="w-4 h-4"/> نموذج إكسيل
                    </button>
                    <ExcelUploadButton onData={handleExcelImport} label="رفع ملف إكسيل" />
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-3xl border border-gray-100 shadow-inner">
                <Input label="بحث بالاسم" value={fName} onChange={setFName} placeholder="اسم الموظف..." />
                <Input label="بحث بالكود" value={fId} onChange={setFId} placeholder="كود الموظف..." />
                <Select label="التخصص" options={['all', ...Array.from(new Set(employees.map(e=>e.specialty)))]} value={fSpec} onChange={setFSpec} />
                <Select label="الحالة" options={['all', 'نشط', 'موقوف', 'إجازة', 'خارج المركز']} value={fStatus} onChange={setFStatus} />
            </div>
            
            <div className="overflow-x-auto border rounded-[30px] bg-white shadow-sm max-h-[600px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm text-right min-w-[800px]">
                    <thead className="bg-gray-100 font-black border-b sticky top-0 z-10 text-gray-600">
                        <tr>
                            <th className="p-4 text-center cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('employee_id')}>
                                <div className="flex items-center justify-center gap-1">
                                   الكود {sortConfig.key === 'employee_id' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600"/> : <ArrowDown className="w-4 h-4 text-blue-600"/>)}
                                </div>
                            </th>
                            <th className="p-4 cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1">
                                   الاسم {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ArrowUp className="w-4 h-4 text-blue-600"/> : <ArrowDown className="w-4 h-4 text-blue-600"/>)}
                                </div>
                            </th>
                            <th className="p-4 text-center">التخصص</th>
                            <th className="p-4 text-center">الصلاحية</th>
                            <th className="p-4 text-center">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEmployees.map(emp => (
                            <tr key={emp.id} className="border-b hover:bg-blue-50/50 transition-all group">
                                <td onClick={() => setSelectedEmp(emp)} className="p-4 font-mono font-bold text-blue-600 text-center cursor-pointer hover:underline">{emp.employee_id}</td>
                                <td onClick={() => setSelectedEmp(emp)} className="p-4 font-black group-hover:text-blue-600 transition-colors cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs overflow-hidden">
                                            {emp.photo_url ? <img src={emp.photo_url} className="w-full h-full object-cover" alt=""/> : <User className="w-4 h-4"/>}
                                        </div>
                                        {emp.name}
                                    </div>
                                </td>
                                <td onClick={() => setSelectedEmp(emp)} className="p-4 text-xs font-bold text-gray-500 text-center cursor-pointer">{emp.specialty}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                                        emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                                        emp.role === 'head_of_dept' ? 'bg-orange-100 text-orange-700' : 
                                        emp.role === 'quality_manager' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        {emp.role === 'admin' ? 'مدير' : emp.role === 'head_of_dept' ? 'رئيس قسم' : emp.role === 'quality_manager' ? 'مسؤول جودة' : 'مستخدم'}
                                    </span>
                                </td>
                                <td className="p-4 text-center flex justify-center gap-2 items-center">
                                    <button onClick={(e) => { e.stopPropagation(); setDetailTab('stats'); setSelectedEmp(emp); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors" title="إحصائيات">
                                        <PieChart className="w-4 h-4"/>
                                    </button>
                                    
                                    <button onClick={(e) => { e.stopPropagation(); handleOpenEdit(emp); }} className="p-1.5 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors" title="تعديل">
                                        <Edit className="w-4 h-4"/>
                                    </button>

                                    <select 
                                        value={emp.status || 'نشط'} 
                                        onChange={(e) => statusMutation.mutate({ id: emp.id, status: e.target.value })}
                                        className={`px-2 py-1.5 rounded-lg text-xs font-black border-2 cursor-pointer outline-none transition-all ${
                                            emp.status === 'نشط' ? 'bg-green-50 border-green-200 text-green-700' :
                                            emp.status === 'موقوف' ? 'bg-red-50 border-red-200 text-red-700' :
                                            'bg-gray-50 border-gray-200 text-gray-700'
                                        }`}
                                        onClick={(e) => e.stopPropagation()} 
                                    >
                                        <option value="نشط">نشط</option>
                                        <option value="موقوف">موقوف</option>
                                        <option value="إجازة">إجازة</option>
                                        <option value="خارج المركز">خارج</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Modal for Add/Edit Employee */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 my-8">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                {editMode ? <Edit className="w-6 h-6 text-yellow-600"/> : <UserPlus className="w-6 h-6 text-blue-600"/>}
                                {editMode ? 'تعديل بيانات الموظف والصلاحيات' : 'إضافة موظف جديد'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-red-500 bg-white p-2 rounded-full shadow-sm"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <form onSubmit={handleFormSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                            
                            {/* 1. Basic Info */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-500 border-b pb-2">البيانات الشخصية والوظيفية</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Input label="الاسم الرباعي" value={formData.name} onChange={v => setFormData({...formData, name: v})} required />
                                    <Input label="كود الموظف (ID)" value={formData.employee_id} onChange={v => setFormData({...formData, employee_id: v})} required />
                                    <Input label="الرقم القومي" value={formData.national_id} onChange={v => setFormData({...formData, national_id: v})} />
                                    
                                    <Input label="رقم الهاتف" value={formData.phone} onChange={v => setFormData({...formData, phone: v})} />
                                    <Input label="العنوان (جديد)" value={formData.address} onChange={v => setFormData({...formData, address: v})} />
                                    <Select label="النوع" options={['ذكر', 'أنثى']} value={formData.gender} onChange={v => setFormData({...formData, gender: v})} />
                                    
                                    <Select label="الحالة الاجتماعية (جديد)" options={['أعزب', 'متزوج', 'مطلق', 'أرمل']} value={formData.marital_status} onChange={v => setFormData({...formData, marital_status: v})} />
                                    <Input label="التخصص" value={formData.specialty} onChange={v => setFormData({...formData, specialty: v})} required />
                                    <Input label="الدرجة الوظيفية" value={formData.grade} onChange={v => setFormData({...formData, grade: v})} />
                                    <Input label="المؤهل الدراسي (جديد)" value={formData.qualification} onChange={v => setFormData({...formData, qualification: v})} />
                                    
                                    <Input type="date" label="تاريخ التعيين" value={formData.join_date} onChange={v => setFormData({...formData, join_date: v})} />
                                    <Input type="date" label="تاريخ الإخلاء" value={formData.resignation_date} onChange={v => setFormData({...formData, resignation_date: v})} />
                                    <Select label="الحالة" options={['نشط', 'موقوف', 'إجازة', 'خارج المركز']} value={formData.status} onChange={v => setFormData({...formData, status: v})} />
                                    
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">الصلاحية (Role)</label>
                                        <select 
                                            className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none font-bold text-gray-700"
                                            value={formData.role}
                                            onChange={e => setFormData({...formData, role: e.target.value})}
                                        >
                                            <option value="user">مستخدم عادي (User)</option>
                                            <option value="head_of_dept">رئيس قسم (Head of Dept)</option>
                                            <option value="quality_manager">مسؤول جودة (Quality Manager)</option>
                                            <option value="admin">مدير نظام (Admin)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* ✅ قسم صلاحيات لوحة الإدارة (Permissions) */}
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                                <h4 className="text-sm font-black text-indigo-700 mb-3 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4"/> صلاحيات لوحة الإدارة (Permissions)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {AVAILABLE_PERMISSIONS.map(perm => (
                                        <label key={perm.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border cursor-pointer hover:border-indigo-300">
                                            <input 
                                                type="checkbox" 
                                                className="w-5 h-5 accent-indigo-600"
                                                checked={(formData.permissions || []).includes(perm.id)}
                                                onChange={() => handlePermissionToggle(perm.id)}
                                            />
                                            <span className="text-sm font-bold text-gray-700">{perm.label}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">تنبيه: منح صلاحية سيمكن الموظف من دخول لوحة الإدارة لرؤية القسم المحدد فقط.</p>
                            </div>

                            {/* ✅ قسم التطعيمات (Hepatitis B) */}
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                                <h4 className="text-sm font-black text-blue-700 mb-3 flex items-center gap-2">
                                    <Syringe className="w-4 h-4"/> سجل التطعيمات (فيروس B)
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Input type="date" label="الجرعة الأولى" value={formData.hep_b_dose1} onChange={v => setFormData({...formData, hep_b_dose1: v})} />
                                    <Input type="date" label="الجرعة الثانية" value={formData.hep_b_dose2} onChange={v => setFormData({...formData, hep_b_dose2: v})} />
                                    <Input type="date" label="الجرعة الثالثة" value={formData.hep_b_dose3} onChange={v => setFormData({...formData, hep_b_dose3: v})} />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                    <Input label="مكان التطعيم" value={formData.hep_b_location} onChange={v => setFormData({...formData, hep_b_location: v})} placeholder="المستشفى/المركز" />
                                    <Input label="ملاحظات التطعيم" value={formData.hep_b_notes} onChange={v => setFormData({...formData, hep_b_notes: v})} />
                                </div>
                            </div>

                            {/* 2. Schedule & Part Time */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-500 border-b pb-2">مواعيد ونظام العمل</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Input type="time" label="وقت الحضور" value={formData.start_time} onChange={v => setFormData({...formData, start_time: v})} />
                                    <Input type="time" label="وقت الانصراف" value={formData.end_time} onChange={v => setFormData({...formData, end_time: v})} />
                                </div>

                                <div className={`p-4 rounded-2xl border transition-all ${isPartTimeEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
                                    <div className="flex items-center justify-between mb-4">
                                        <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                            <Timer className={`w-5 h-5 ${isPartTimeEnabled ? 'text-indigo-600' : 'text-gray-400'}`}/>
                                            تفعيل نظام العمل الجزئي (أيام محددة)؟
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="checkbox" 
                                                className="toggle-checkbox w-5 h-5 accent-indigo-600"
                                                checked={isPartTimeEnabled}
                                                onChange={(e) => togglePartTime(e.target.checked)}
                                            />
                                        </div>
                                    </div>

                                    {isPartTimeEnabled && (
                                        <div className="animate-in fade-in space-y-4">
                                            <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-xl border border-indigo-100">
                                                <Input type="date" label="من تاريخ" value={formData.part_time_start_date} onChange={v => setFormData({...formData, part_time_start_date: v})} />
                                                <Input type="date" label="إلى تاريخ" value={formData.part_time_end_date} onChange={v => setFormData({...formData, part_time_end_date: v})} />
                                            </div>
                                            
                                            <div>
                                                <label className="block text-xs font-bold text-indigo-700 mb-2">
                                                    اختر أيام الحضور (خلال الفترة المحددة فقط):
                                                </label>
                                                <div className="flex flex-wrap gap-2">
                                                    {DAYS_OPTIONS.map(day => (
                                                        <button
                                                            type="button"
                                                            key={day}
                                                            onClick={() => handleDayToggle(day)}
                                                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                                (formData.work_days || []).includes(day)
                                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-100'
                                                            }`}
                                                        >
                                                            {day}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 3. Balances & Maternity */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-500 border-b pb-2">الأرصدة والوضع</h4>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <Input type="number" label="رصيد اعتيادي" value={formData.leave_annual_balance} onChange={v => setFormData({...formData, leave_annual_balance: v})} />
                                    <Input type="number" label="رصيد عارضة" value={formData.leave_casual_balance} onChange={v => setFormData({...formData, leave_casual_balance: v})} />
                                    <Input type="number" label="متبقي اعتيادي" value={formData.remaining_annual} onChange={v => setFormData({...formData, remaining_annual: v})} />
                                    <Input type="number" label="متبقي عارضة" value={formData.remaining_casual} onChange={v => setFormData({...formData, remaining_casual: v})} />
                                    <Input type="number" label="إجمالي الغياب" value={formData.total_absence} onChange={v => setFormData({...formData, total_absence: v})} />
                                </div>

                                <div className="bg-pink-50 p-4 rounded-xl border border-pink-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <input 
                                            type="checkbox" 
                                            checked={formData.maternity === 'true'} 
                                            onChange={e => setFormData({...formData, maternity: e.target.checked ? 'true' : 'false'})}
                                            className="w-5 h-5 accent-pink-500"
                                        />
                                        <label className="text-sm font-bold text-gray-700">في إجازة وضع / رضاعة</label>
                                    </div>

                                    {formData.maternity === 'true' && (
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in">
                                            <Input type="date" label="بداية الرضاعة" value={formData.nursing_start_date} onChange={v => setFormData({...formData, nursing_start_date: v})} />
                                            <Input type="date" label="نهاية الرضاعة" value={formData.nursing_end_date} onChange={v => setFormData({...formData, nursing_end_date: v})} />
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">وقت الرضاعة</label>
                                                <select 
                                                    className="w-full p-3 rounded-xl border bg-white focus:border-pink-500 outline-none text-sm"
                                                    value={formData.nursing_time}
                                                    onChange={e => setFormData({...formData, nursing_time: e.target.value})}
                                                >
                                                    <option value="">اختر التوقيت...</option>
                                                    <option value="morning">صباحي (تأخير)</option>
                                                    <option value="evening">مسائي (انصراف)</option>
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 4. Extra Info & Penalties */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-500 border-b pb-2">بيانات إضافية</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="الدورات التدريبية" value={formData.training_courses} onChange={v => setFormData({...formData, training_courses: v})} />
                                    <Input label="مهام إدارية" value={formData.admin_tasks} onChange={v => setFormData({...formData, admin_tasks: v})} />
                                    <Input label="رابط الصورة الشخصية" value={formData.photo_url} onChange={v => setFormData({...formData, photo_url: v})} />
                                    <Input label="الجزاءات (جديد)" value={formData.penalties} onChange={v => setFormData({...formData, penalties: v})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">ملاحظات</label>
                                    <textarea 
                                        className="w-full p-3 rounded-xl border bg-gray-50 focus:border-blue-500 outline-none text-sm min-h-[80px]"
                                        value={formData.notes}
                                        onChange={e => setFormData({...formData, notes: e.target.value})}
                                    ></textarea>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t">
                                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">إلغاء</button>
                                <button type="submit" disabled={saveMutation.isPending} className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex justify-center items-center gap-2">
                                    {saveMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>} 
                                    {saveMutation.isPending ? 'جاري الحفظ...' : (editMode ? 'حفظ التعديلات' : 'إضافة الموظف')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
