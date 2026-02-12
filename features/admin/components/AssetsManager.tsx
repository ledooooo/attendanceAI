import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { 
    Box, Search, Filter, Plus, FileSpreadsheet, 
    Monitor, Stethoscope, AlertTriangle, CheckCircle, 
    Trash2, Edit, Save, X, Wrench, History
} from 'lucide-react';
import toast from 'react-hot-toast';

// تعريف أنواع البيانات
interface Asset {
    id: string;
    name: string;
    model: string;
    serial_number: string;
    origin_country: string;
    start_date: string;
    location: string;
    type: 'medical' | 'non_medical';
    status: 'new' | 'working' | 'broken' | 'scrap' | 'stagnant';
    custodians: string[]; // Array of Employee IDs
    last_maintenance_date: string;
    notes: string;
}

const LOCATIONS = ['عيادة الأسنان', 'عيادة الباطنة', 'الاستقبال', 'المعمل', 'الصيدلية', 'مكتب المدير', 'المخزن', 'أخرى'];
const STATUS_TRANSLATION: any = {
    'new': 'جديد',
    'working': 'يعمل',
    'broken': 'معطل',
    'scrap': 'كهنة',
    'stagnant': 'راكد'
};

export default function AssetsManager() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    
    // حالات الفلترة
    const [filterLocation, setFilterLocation] = useState('all');
    const [filterCustodian, setFilterCustodian] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // حالات المودال (إضافة/تعديل)
    const [showModal, setShowModal] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [formData, setFormData] = useState<Partial<Asset>>({
        type: 'medical',
        status: 'working',
        custodians: [],
        location: LOCATIONS[0]
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        // جلب الموظفين
        const { data: emps } = await supabase.from('employees').select('id, name, employee_id');
        if (emps) setEmployees(emps as Employee[]);

        // جلب الأصول
        const { data: asts } = await supabase.from('assets').select('*').order('created_at', { ascending: false });
        if (asts) setAssets(asts as Asset[]);
        setLoading(false);
    };

    // --- العمليات ---

    const handleSave = async () => {
        if (!formData.name || !formData.custodians?.length) {
            toast.error('يرجى إدخال اسم الجهاز واختيار صاحب عهدة واحد على الأقل');
            return;
        }

        try {
            if (editingAsset) {
                // تعديل
                const { error } = await supabase.from('assets').update(formData).eq('id', editingAsset.id);
                if (error) throw error;
                toast.success('تم التعديل بنجاح');
            } else {
                // إضافة جديد
                const { error } = await supabase.from('assets').insert([formData]);
                if (error) throw error;
                toast.success('تمت الإضافة بنجاح');
            }
            setShowModal(false);
            setEditingAsset(null);
            setFormData({ type: 'medical', status: 'working', custodians: [], location: LOCATIONS[0] });
            fetchData();
        } catch (error: any) {
            toast.error('حدث خطأ: ' + error.message);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('هل أنت متأكد من حذف هذا الأصل؟')) return;
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (!error) {
            toast.success('تم الحذف');
            fetchData();
        }
    };

    const handleReportIssue = async (asset: Asset) => {
        const issue = prompt(`وصف العطل للجهاز: ${asset.name}`);
        if (issue) {
            // 1. تحديث حالة الجهاز لمعطل
            await supabase.from('assets').update({ status: 'broken' }).eq('id', asset.id);
            
            // 2. تسجيل في سجل الصيانة (اختياري لو أنشأت الجدول الثاني)
            await supabase.from('maintenance_logs').insert({
                asset_id: asset.id,
                issue_description: issue,
                status: 'pending'
            });

            toast.success('تم الإبلاغ عن العطل وتغيير الحالة');
            fetchData();
        }
    };

    // --- رفع ملف CSV (إكسيل) ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            const rows = text.split('\n').slice(1); // تخطي العنوان
            const newAssets = [];

            for (const row of rows) {
                const cols = row.split(',');
                if (cols.length < 3) continue;
                
                // هنا تفترض ترتيب الأعمدة في ملف الـ CSV
                // Name, Model, Serial, Location, Type, CustodianID
                newAssets.push({
                    name: cols[0]?.trim(),
                    model: cols[1]?.trim(),
                    serial_number: cols[2]?.trim(),
                    location: cols[3]?.trim() || 'أخرى',
                    type: cols[4]?.trim() === 'طبي' ? 'medical' : 'non_medical',
                    status: 'working',
                    custodians: cols[5] ? [cols[5].trim()] : [] // كود الموظف
                });
            }

            if (newAssets.length > 0) {
                const { error } = await supabase.from('assets').insert(newAssets);
                if (!error) {
                    toast.success(`تم استيراد ${newAssets.length} جهاز بنجاح`);
                    fetchData();
                } else {
                    toast.error('فشل الاستيراد: تأكد من صحة البيانات');
                }
            }
        };
        reader.readAsText(file);
    };

    // --- الفلترة ---
    const filteredAssets = assets.filter(asset => {
        const matchLoc = filterLocation === 'all' || asset.location === filterLocation;
        const matchCust = filterCustodian === 'all' || asset.custodians.includes(filterCustodian);
        const matchSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchLoc && matchCust && matchSearch;
    });

    // دالة مساعدة لجلب أسماء الموظفين من الـ IDs
    const getCustodianNames = (ids: string[]) => {
        return ids.map(id => employees.find(e => e.employee_id === id)?.name || id).join('، ');
    };

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* Header & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-gray-500 text-xs font-bold">إجمالي الأصول</p>
                            <h3 className="text-2xl font-black text-blue-600">{assets.length}</h3>
                        </div>
                        <Box className="w-8 h-8 text-blue-200" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-gray-500 text-xs font-bold">أجهزة معطلة</p>
                            <h3 className="text-2xl font-black text-red-600">{assets.filter(a => a.status === 'broken').length}</h3>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-200" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-green-100 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-gray-500 text-xs font-bold">أجهزة طبية</p>
                            <h3 className="text-2xl font-black text-green-600">{assets.filter(a => a.type === 'medical').length}</h3>
                        </div>
                        <Stethoscope className="w-8 h-8 text-green-200" />
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="text-gray-500 text-xs font-bold">أجهزة غير طبية</p>
                            <h3 className="text-2xl font-black text-purple-600">{assets.filter(a => a.type === 'non_medical').length}</h3>
                        </div>
                        <Monitor className="w-8 h-8 text-purple-200" />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 items-center flex-1">
                    <div className="relative">
                        <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="بحث بالاسم أو السريال..." 
                            className="pr-9 pl-4 py-2 rounded-xl border bg-gray-50 text-sm w-48 focus:w-64 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <select className="p-2 rounded-xl border bg-gray-50 text-sm font-bold" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
                        <option value="all">📍 كل الأماكن</option>
                        {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>

                    <select className="p-2 rounded-xl border bg-gray-50 text-sm font-bold" value={filterCustodian} onChange={e => setFilterCustodian(e.target.value)}>
                        <option value="all">👤 كل العهد</option>
                        {employees.map(emp => <option key={emp.id} value={emp.employee_id}>{emp.name}</option>)}
                    </select>
                </div>

                <div className="flex gap-2">
                    <label className="cursor-pointer bg-green-50 text-green-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-green-100 transition-colors">
                        <FileSpreadsheet className="w-4 h-4" /> استيراد Excel
                        <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button onClick={() => { setEditingAsset(null); setFormData({ type: 'medical', status: 'working', custodians: [], location: LOCATIONS[0] }); setShowModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                        <Plus className="w-4 h-4" /> إضافة جهاز
                    </button>
                </div>
            </div>

            {/* Assets Table */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50 font-bold text-gray-700 border-b">
                            <tr>
                                <th className="p-4">الجهاز / الموديل</th>
                                <th className="p-4">البيانات</th>
                                <th className="p-4">المكان والعهدة</th>
                                <th className="p-4">الحالة</th>
                                <th className="p-4 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredAssets.map(asset => (
                                <tr key={asset.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-800">{asset.name}</div>
                                        <div className="text-xs text-gray-500">{asset.model} - {asset.origin_country}</div>
                                        <div className="text-[10px] text-gray-400 font-mono mt-1">SN: {asset.serial_number}</div>
                                    </td>
                                    <td className="p-4 text-xs text-gray-600 space-y-1">
                                        <div className="flex items-center gap-1"><span className="font-bold">النوع:</span> {asset.type === 'medical' ? 'طبي' : 'غير طبي'}</div>
                                        <div className="flex items-center gap-1"><span className="font-bold">بدء العمل:</span> {asset.start_date || '-'}</div>
                                        <div className="flex items-center gap-1"><span className="font-bold text-orange-600">آخر صيانة:</span> {asset.last_maintenance_date || 'لا يوجد'}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-indigo-700 mb-1">{asset.location}</div>
                                        <div className="flex flex-wrap gap-1">
                                            {asset.custodians.map(cId => (
                                                <span key={cId} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px] border">
                                                    {employees.find(e => e.employee_id === cId)?.name || cId}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold border ${
                                            asset.status === 'working' ? 'bg-green-50 text-green-700 border-green-200' :
                                            asset.status === 'broken' ? 'bg-red-50 text-red-700 border-red-200' :
                                            asset.status === 'new' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            'bg-gray-100 text-gray-600 border-gray-200'
                                        }`}>
                                            {STATUS_TRANSLATION[asset.status]}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => handleReportIssue(asset)} title="إبلاغ عن عطل" className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100">
                                                <Wrench className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => { setEditingAsset(asset); setFormData(asset); setShowModal(true); }} title="تعديل" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleDelete(asset.id)} title="حذف" className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Add / Edit */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 bg-gray-50 border-b flex justify-between items-center">
                            <h3 className="font-black text-xl text-gray-800">{editingAsset ? 'تعديل بيانات الأصل' : 'إضافة أصل جديد'}</h3>
                            <button onClick={() => setShowModal(false)}><X className="w-6 h-6 text-gray-400" /></button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">اسم الجهاز / العهدة *</label>
                                    <input className="w-full p-3 rounded-xl border bg-gray-50 font-bold" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">الموديل</label>
                                    <input className="w-full p-3 rounded-xl border bg-gray-50" value={formData.model || ''} onChange={e => setFormData({...formData, model: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">السريال (SN)</label>
                                    <input className="w-full p-3 rounded-xl border bg-gray-50" value={formData.serial_number || ''} onChange={e => setFormData({...formData, serial_number: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">بلد المنشأ</label>
                                    <input className="w-full p-3 rounded-xl border bg-gray-50" value={formData.origin_country || ''} onChange={e => setFormData({...formData, origin_country: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">النوع</label>
                                    <select className="w-full p-3 rounded-xl border bg-gray-50" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                                        <option value="medical">طبي</option>
                                        <option value="non_medical">غير طبي</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">المكان</label>
                                    <select className="w-full p-3 rounded-xl border bg-gray-50" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}>
                                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">الحالة</label>
                                    <select className="w-full p-3 rounded-xl border bg-gray-50" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                        <option value="new">جديد</option>
                                        <option value="working">يعمل</option>
                                        <option value="broken">معطل</option>
                                        <option value="scrap">كهنة</option>
                                        <option value="stagnant">راكد</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">أصحاب العهدة (يمكن اختيار أكثر من واحد)</label>
                                <select 
                                    multiple 
                                    className="w-full p-3 rounded-xl border bg-gray-50 h-32 custom-scrollbar" 
                                    value={formData.custodians} 
                                    onChange={e => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setFormData({...formData, custodians: selected});
                                    }}
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.employee_id}>{emp.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1">اضغط Ctrl (أو Cmd) لتحديد أكثر من موظف</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ بدء العمل</label>
                                    <input type="date" className="w-full p-3 rounded-xl border bg-gray-50" value={formData.start_date || ''} onChange={e => setFormData({...formData, start_date: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ آخر صيانة</label>
                                    <input type="date" className="w-full p-3 rounded-xl border bg-gray-50" value={formData.last_maintenance_date || ''} onChange={e => setFormData({...formData, last_maintenance_date: e.target.value})} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">ملاحظات إضافية</label>
                                <textarea className="w-full p-3 rounded-xl border bg-gray-50 h-20" value={formData.notes || ''} onChange={e => setFormData({...formData, notes: e.target.value})}></textarea>
                            </div>
                        </div>

                        <div className="p-4 border-t bg-gray-50 flex gap-3">
                            <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2">
                                <Save className="w-5 h-5" /> حفظ البيانات
                            </button>
                            <button onClick={() => setShowModal(false)} className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-300 transition-colors">
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
