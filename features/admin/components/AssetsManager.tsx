import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { 
    Box, Search, Plus, FileSpreadsheet, 
    Monitor, Stethoscope, AlertTriangle, 
    Trash2, Edit, Save, X, Wrench, Printer, QrCode, FileText, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';

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
    custodians: string[];
    last_maintenance_date: string;
    notes: string;
}

const INITIAL_LOCATIONS = ['عيادة الأسنان', 'عيادة الباطنة', 'الاستقبال', 'المعمل', 'الصيدلية', 'مكتب المدير', 'المخزن', 'أخرى'];

const STATUS_TRANSLATION: any = {
    'new': 'جديد',
    'working': 'يعمل',
    'broken': 'معطل',
    'scrap': 'كهنة',
    'stagnant': 'راكد'
};

const MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

export default function AssetsManager() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    
    const [locations, setLocations] = useState<string[]>(INITIAL_LOCATIONS);

    // الفلترة والبحث
    const [filterLocation, setFilterLocation] = useState('all');
    const [filterCustodian, setFilterCustodian] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // المودال
    const [showModal, setShowModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState<Asset | null>(null);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [formData, setFormData] = useState<Partial<Asset>>({
        type: 'medical',
        status: 'working',
        custodians: [],
        location: ''
    });

    useEffect(() => { 
        fetchData(); 
        const savedLocs = localStorage.getItem('asset_locations');
        if (savedLocs) setLocations(JSON.parse(savedLocs));
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: emps } = await supabase.from('employees').select('id, name, employee_id');
        if (emps) setEmployees(emps as Employee[]);
        
        const { data: asts, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false });
        if (error) {
            toast.error('فشل جلب البيانات');
        } else if (asts) {
            // ✅ إصلاح الخطأ هنا: تنظيف البيانات لضمان أن المصفوفات ليست null
            const sanitizedAssets = asts.map((item: any) => ({
                ...item,
                custodians: item.custodians || [] // تحويل null إلى []
            }));
            setAssets(sanitizedAssets as Asset[]);
        }
        setLoading(false);
    };

    const handleAddLocation = () => {
        const newLoc = prompt('أدخل اسم المكان الجديد:');
        if (newLoc && !locations.includes(newLoc)) {
            const updatedLocs = [...locations, newLoc];
            setLocations(updatedLocs);
            localStorage.setItem('asset_locations', JSON.stringify(updatedLocs));
            setFormData({...formData, location: newLoc});
            toast.success('تم إضافة المكان');
        }
    };

    const handleSave = async () => {
        // التحقق من الحقول الإجبارية (الاسم والمكان فقط، العهدة اختيارية الآن لتجنب المشاكل)
        if (!formData.name || !formData.location) {
            toast.error('الرجاء إدخال اسم الجهاز والمكان'); 
            return;
        }
        
        try {
            // ضمان أن العهدة مصفوفة حتى لو فارغة
            const payload = {
                ...formData,
                custodians: formData.custodians || []
            };

            if (editingAsset) {
                const { error } = await supabase.from('assets').update(payload).eq('id', editingAsset.id).select();
                if (error) throw error;
                toast.success('تم التعديل بنجاح');
            } else {
                const { error } = await supabase.from('assets').insert([payload]).select();
                if (error) throw error;
                toast.success('تمت الإضافة بنجاح');
            }
            
            setShowModal(false); 
            setEditingAsset(null); 
            setFormData({ type: 'medical', status: 'working', custodians: [], location: '' }); 
            
            await fetchData(); 

        } catch (e: any) { 
            console.error(e);
            toast.error('خطأ: ' + e.message); 
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد من الحذف؟ لا يمكن التراجع.')) { 
            await supabase.from('assets').delete().eq('id', id); 
            toast.success('تم الحذف');
            fetchData(); 
        }
    };

    const handleReportIssue = async (asset: Asset) => {
        const issue = prompt('وصف العطل:');
        if (issue) {
            await supabase.from('assets').update({ status: 'broken' }).eq('id', asset.id);
            await supabase.from('maintenance_logs').insert({ asset_id: asset.id, issue_description: issue });
            toast.success('تم الإبلاغ وتغيير الحالة إلى معطل'); 
            fetchData();
        }
    };

    // --- 🖨️ دوال الطباعة ---
    const handlePrintCard = (asset: Asset) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const htmlContent = `
            <html dir="rtl">
            <head>
                <title>كارت جهاز - ${asset.name}</title>
                <style>
                    @page { size: A5 landscape; margin: 0; }
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 10px; margin: 0; }
                    .card-container { border: 2px solid #000; padding: 15px; height: 95vh; display: flex; flex-direction: column; }
                    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
                    .asset-details { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 10px; background: #f3f4f6; padding: 10px; }
                    .maintenance-table { width: 100%; border-collapse: collapse; font-size: 10px; flex-1: 1; }
                    .maintenance-table th, .maintenance-table td { border: 1px solid #000; padding: 4px; text-align: center; }
                </style>
            </head>
            <body>
                <div class="card-container">
                    <div class="header">
                        <div><h1>بطاقة جهاز</h1><p>مركز طب أسرة غرب المطار</p></div>
                        <div id="qrcode"></div>
                    </div>
                    <div class="asset-details">
                        <div><strong>الجهاز:</strong> ${asset.name}</div>
                        <div><strong>الموديل:</strong> ${asset.model || '-'}</div>
                        <div><strong>S/N:</strong> ${asset.serial_number || '-'}</div>
                        <div><strong>المكان:</strong> ${asset.location}</div>
                    </div>
                    <table class="maintenance-table">
                        <thead><tr><th>الشهر</th><th>التاريخ</th><th>الإجراء</th><th>الفني</th><th>التوقيع</th></tr></thead>
                        <tbody>${MONTHS.map(m => `<tr style="height:25px"><td>${m}</td><td></td><td></td><td></td><td></td></tr>`).join('')}</tbody>
                    </table>
                </div>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <script>
                    new QRCode(document.getElementById("qrcode"), { text: '${asset.id}', width: 64, height: 64 });
                    setTimeout(() => window.print(), 500);
                </script>
            </body>
            </html>`;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    const handlePrintList = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const htmlContent = `
            <html dir="rtl"><head><title>قائمة الأصول</title>
            <style>table { width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 12px; } th, td { border: 1px solid #ddd; padding: 8px; text-align: right; } th { background: #f2f2f2; }</style>
            </head><body><h2>تقرير الأصول</h2><table><thead><tr><th>م</th><th>الجهاز</th><th>المكان</th><th>الحالة</th><th>المسؤول</th></tr></thead><tbody>
            ${filteredAssets.map((a, i) => `
                <tr>
                    <td>${i+1}</td>
                    <td>${a.name}</td>
                    <td>${a.location}</td>
                    <td>${STATUS_TRANSLATION[a.status]}</td>
                    <td>${(a.custodians || []).join(', ')}</td> </tr>`).join('')}
            </tbody></table><script>window.print()</script></body></html>`;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // --- الفلترة ---
    const filteredAssets = assets.filter(asset => {
        const matchLoc = filterLocation === 'all' || asset.location === filterLocation;
        const matchCust = filterCustodian === 'all' || (asset.custodians || []).includes(filterCustodian); // ✅ حماية هنا
        const matchStatus = filterStatus === 'all' || asset.status === filterStatus; 
        const matchType = filterType === 'all' || asset.type === filterType; 
        const matchSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
        
        return matchLoc && matchCust && matchStatus && matchType && matchSearch;
    });

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* إحصائيات */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"><span className="text-xs text-gray-500 font-bold">الإجمالي</span><div className="text-2xl font-black text-blue-700">{assets.length}</div></div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100"><span className="text-xs text-gray-500 font-bold">يعمل</span><div className="text-2xl font-black text-green-700">{assets.filter(a => a.status === 'working' || a.status === 'new').length}</div></div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100"><span className="text-xs text-gray-500 font-bold">معطل/كهنة</span><div className="text-2xl font-black text-red-700">{assets.filter(a => a.status === 'broken' || a.status === 'scrap').length}</div></div>
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100"><span className="text-xs text-gray-500 font-bold">طبية</span><div className="text-2xl font-black text-purple-700">{assets.filter(a => a.type === 'medical').length}</div></div>
            </div>

            {/* أدوات التحكم والفلترة */}
            <div className="bg-white p-4 rounded-2xl border shadow-sm space-y-4">
                <div className="flex flex-wrap gap-3 items-center justify-between">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="بحث بالاسم أو السريال..." 
                            className="w-full pr-9 pl-4 py-2 rounded-xl border bg-gray-50 text-sm focus:bg-white transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handlePrintList} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition-colors">
                            <Printer className="w-4 h-4" /> طباعة
                        </button>
                        <button onClick={() => { setEditingAsset(null); setFormData({ type: 'medical', status: 'working', custodians: [], location: '' }); setShowModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                            <Plus className="w-4 h-4" /> إضافة جهاز
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t">
                    <select className="p-2 rounded-xl border bg-gray-50 text-sm font-bold" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
                        <option value="all">📍 كل الأماكن</option>
                        {locations.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>

                    <select className="p-2 rounded-xl border bg-gray-50 text-sm font-bold" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                        <option value="all">📊 كل الحالات</option>
                        <option value="working">يعمل</option>
                        <option value="broken">معطل</option>
                        <option value="new">جديد</option>
                        <option value="scrap">كهنة</option>
                        <option value="stagnant">راكد</option>
                    </select>

                    <select className="p-2 rounded-xl border bg-gray-50 text-sm font-bold" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="all">🩺 النوع (الكل)</option>
                        <option value="medical">طبي</option>
                        <option value="non_medical">غير طبي</option>
                    </select>

                    <select className="p-2 rounded-xl border bg-gray-50 text-sm font-bold" value={filterCustodian} onChange={e => setFilterCustodian(e.target.value)}>
                        <option value="all">👤 كل العهد</option>
                        {employees.map(emp => <option key={emp.id} value={emp.employee_id}>{emp.name}</option>)}
                    </select>
                </div>
            </div>

            {/* جدول الأصول */}
            <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50 font-bold text-gray-700 border-b">
                            <tr>
                                <th className="p-4">الجهاز</th>
                                <th className="p-4">البيانات</th>
                                <th className="p-4">المكان والعهدة</th>
                                <th className="p-4">الحالة</th>
                                <th className="p-4 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredAssets.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-400">لا توجد أجهزة مطابقة للبحث</td></tr>
                            ) : (
                                filteredAssets.map(asset => (
                                    <tr key={asset.id} className="hover:bg-gray-50/50">
                                        <td className="p-4">
                                            <div className="font-bold text-gray-800">{asset.name}</div>
                                            <div className="text-xs text-gray-500 font-mono mt-1">{asset.serial_number ? `SN: ${asset.serial_number}` : ''}</div>
                                        </td>
                                        <td className="p-4 text-xs text-gray-600">
                                            <div>موديل: {asset.model || '-'}</div>
                                            <div>منشأ: {asset.origin_country || '-'}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-bold text-indigo-700 mb-1">{asset.location}</div>
                                            <div className="flex flex-wrap gap-1">
                                                {/* ✅ حماية هنا: (asset.custodians || []).map */}
                                                {(asset.custodians || []).map(cId => (
                                                    <span key={cId} className="bg-gray-100 px-1.5 rounded text-[10px] border">
                                                        {employees.find(e => e.employee_id === cId)?.name.split(' ')[0] || cId}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${
                                                asset.status === 'working' ? 'bg-green-100 text-green-700 border-green-200' :
                                                asset.status === 'broken' ? 'bg-red-100 text-red-700 border-red-200' :
                                                'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}>
                                                {STATUS_TRANSLATION[asset.status]}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => setShowQRModal(asset)} title="QR" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg"><QrCode className="w-4 h-4 text-gray-600"/></button>
                                                <button onClick={() => handlePrintCard(asset)} title="طباعة" className="p-2 bg-blue-50 hover:bg-blue-100 rounded-lg"><FileText className="w-4 h-4 text-blue-600"/></button>
                                                <button onClick={() => handleReportIssue(asset)} title="عطل" className="p-2 bg-orange-50 hover:bg-orange-100 rounded-lg"><Wrench className="w-4 h-4 text-orange-600"/></button>
                                                <button onClick={() => { setEditingAsset(asset); setFormData(asset); setShowModal(true); }} title="تعديل" className="p-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg"><Edit className="w-4 h-4 text-indigo-600"/></button>
                                                <button onClick={() => handleDelete(asset.id)} title="حذف" className="p-2 bg-red-50 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4 text-red-600"/></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* QR Modal */}
            {showQRModal && (
                <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in zoom-in-95">
                    <div className="bg-white p-8 rounded-3xl text-center shadow-2xl max-w-sm w-full relative">
                        <button onClick={() => setShowQRModal(null)} className="absolute top-4 right-4 p-1 bg-gray-100 rounded-full"><X className="w-5 h-5"/></button>
                        <h3 className="font-black text-xl mb-6 text-gray-800">{showQRModal.name}</h3>
                        <div className="bg-white p-4 border-4 border-black rounded-xl inline-block mb-4">
                            <QRCode value={showQRModal.id} size={200} />
                        </div>
                        <button onClick={() => handlePrintCard(showQRModal)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 flex justify-center gap-2">
                            <Printer className="w-5 h-5"/> طباعة
                        </button>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal */}
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
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-gray-500">المكان</label>
                                        <button onClick={handleAddLocation} className="text-[10px] text-indigo-600 font-bold hover:underline">+ إضافة</button>
                                    </div>
                                    <select className="w-full p-3 rounded-xl border bg-gray-50" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})}>
                                        <option value="">-- اختر --</option>
                                        {locations.map(l => <option key={l} value={l}>{l}</option>)}
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
                                <label className="block text-xs font-bold text-gray-500 mb-1">أصحاب العهدة (اضغط Ctrl للاختيار المتعدد)</label>
                                <select 
                                    multiple 
                                    className="w-full p-3 rounded-xl border bg-gray-50 h-32 custom-scrollbar" 
                                    value={formData.custodians || []} // ✅ حماية هنا
                                    onChange={e => {
                                        const selected = Array.from(e.target.selectedOptions, option => option.value);
                                        setFormData({...formData, custodians: selected});
                                    }}
                                >
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.employee_id}>{emp.name}</option>
                                    ))}
                                </select>
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
