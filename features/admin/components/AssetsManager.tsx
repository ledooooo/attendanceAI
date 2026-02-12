import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee } from '../../../types';
import { 
    Box, Search, Plus, FileSpreadsheet, 
    Monitor, Stethoscope, AlertTriangle, 
    Trash2, Edit, Save, X, Wrench, Printer, QrCode, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code'; // تأكد من تثبيت المكتبة: npm install react-qr-code

// ... (نفس الـ Interfaces والثوابت السابقة)
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

const LOCATIONS = ['عيادة الأسنان', 'عيادة الباطنة', 'الاستقبال', 'المعمل', 'الصيدلية', 'مكتب المدير', 'المخزن', 'أخرى'];
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
    
    // الفلترة والبحث
    const [filterLocation, setFilterLocation] = useState('all');
    const [filterCustodian, setFilterCustodian] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // المودال
    const [showModal, setShowModal] = useState(false);
    const [showQRModal, setShowQRModal] = useState<Asset | null>(null); // مودال الـ QR
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [formData, setFormData] = useState<Partial<Asset>>({
        type: 'medical',
        status: 'working',
        custodians: [],
        location: LOCATIONS[0]
    });

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: emps } = await supabase.from('employees').select('id, name, employee_id');
        if (emps) setEmployees(emps as Employee[]);
        const { data: asts } = await supabase.from('assets').select('*').order('created_at', { ascending: false });
        if (asts) setAssets(asts as Asset[]);
        setLoading(false);
    };

    // ... (نفس دوال الحفظ والحذف والـ Upload السابقة - يمكنك نسخها من الرد السابق)
    const handleSave = async () => {
        if (!formData.name || !formData.custodians?.length) {
            toast.error('بيانات ناقصة'); return;
        }
        try {
            if (editingAsset) {
                await supabase.from('assets').update(formData).eq('id', editingAsset.id);
                toast.success('تم التعديل');
            } else {
                await supabase.from('assets').insert([formData]);
                toast.success('تمت الإضافة');
            }
            setShowModal(false); setEditingAsset(null); setFormData({ type: 'medical', status: 'working', custodians: [], location: LOCATIONS[0] }); fetchData();
        } catch (e: any) { toast.error(e.message); }
    };

    const handleDelete = async (id: string) => {
        if (confirm('حذف؟')) { await supabase.from('assets').delete().eq('id', id); fetchData(); }
    };

    const handleReportIssue = async (asset: Asset) => {
        const issue = prompt('وصف العطل:');
        if (issue) {
            await supabase.from('assets').update({ status: 'broken' }).eq('id', asset.id);
            await supabase.from('maintenance_logs').insert({ asset_id: asset.id, issue_description: issue });
            toast.success('تم الإبلاغ'); fetchData();
        }
    };

    // --- 🖨️ دوال الطباعة ---

    // 1. طباعة كارت الصيانة (نصف A4)
    const handlePrintCard = (asset: Asset) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const qrValue = JSON.stringify({ id: asset.id, n: asset.name, s: asset.serial_number });
        
        // تصميم الكارت (HTML + CSS)
        const htmlContent = `
            <html dir="rtl">
            <head>
                <title>كارت جهاز - ${asset.name}</title>
                <style>
                    @page { size: A5 landscape; margin: 0; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 10px; margin: 0; -webkit-print-color-adjust: exact; }
                    .card-container { border: 2px solid #000; padding: 15px; height: 95vh; box-sizing: border-box; display: flex; flex-direction: column; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 10px; }
                    .header-info h1 { margin: 0; font-size: 18px; }
                    .header-info p { margin: 2px 0; font-size: 12px; }
                    .asset-details { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 10px; background: #f3f4f6; padding: 10px; border-radius: 5px; }
                    .detail-item strong { display: block; font-size: 10px; color: #555; }
                    .maintenance-table { width: 100%; border-collapse: collapse; font-size: 10px; flex-1: 1; }
                    .maintenance-table th, .maintenance-table td { border: 1px solid #000; padding: 4px; text-align: center; }
                    .maintenance-table th { background-color: #e5e7eb; }
                    .qr-box { text-align: center; }
                </style>
            </head>
            <body>
                <div class="card-container">
                    <div class="header">
                        <div class="header-info">
                            <h1>بطاقة تعريف ومتابعة جهاز</h1>
                            <p>مركز طب أسرة غرب المطار</p>
                        </div>
                        <div class="qr-box" id="qrcode-container"></div>
                    </div>

                    <div class="asset-details">
                        <div class="detail-item"><strong>اسم الجهاز:</strong> ${asset.name}</div>
                        <div class="detail-item"><strong>الموديل:</strong> ${asset.model || '-'}</div>
                        <div class="detail-item"><strong>السريال:</strong> ${asset.serial_number || '-'}</div>
                        <div class="detail-item"><strong>بلد المنشأ:</strong> ${asset.origin_country || '-'}</div>
                        <div class="detail-item"><strong>المكان:</strong> ${asset.location}</div>
                        <div class="detail-item"><strong>تاريخ البدء:</strong> ${asset.start_date || '-'}</div>
                    </div>

                    <h3 style="margin: 5px 0; font-size: 12px;">سجل الصيانة الدورية / الإصلاح (${new Date().getFullYear()})</h3>
                    <table class="maintenance-table">
                        <thead>
                            <tr>
                                <th width="10%">الشهر</th>
                                <th width="15%">التاريخ</th>
                                <th width="30%">نوع الإجراء (دورية / إصلاح)</th>
                                <th width="25%">اسم الفني / الشركة</th>
                                <th width="20%">التوقيع / الختم</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${MONTHS.map(month => `
                                <tr style="height: 25px;">
                                    <td style="font-weight:bold;">${month}</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div style="font-size: 9px; margin-top: 5px; text-align: left;">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-EG')}</div>
                </div>
                
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
                <script>
                    new QRCode(document.getElementById("qrcode-container"), {
                        text: '${asset.id}',
                        width: 64,
                        height: 64
                    });
                    setTimeout(() => window.print(), 500);
                </script>
            </body>
            </html>
        `;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // 2. طباعة القائمة كاملة
    const handlePrintList = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const htmlContent = `
            <html dir="rtl">
            <head>
                <title>قائمة الأصول والعهد</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, sans-serif; padding: 20px; }
                    h1 { text-align: center; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                    th { background-color: #f2f2f2; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px;}
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>تقرير جرد الأصول والعهد</h2>
                    <p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>م</th>
                            <th>الجهاز</th>
                            <th>الموديل</th>
                            <th>السريال</th>
                            <th>المكان</th>
                            <th>النوع</th>
                            <th>الحالة</th>
                            <th>المسؤول</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filteredAssets.map((a, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${a.name}</td>
                                <td>${a.model || '-'}</td>
                                <td>${a.serial_number || '-'}</td>
                                <td>${a.location}</td>
                                <td>${a.type === 'medical' ? 'طبي' : 'غير طبي'}</td>
                                <td>${STATUS_TRANSLATION[a.status]}</td>
                                <td>${a.custodians.map(id => employees.find(e => e.employee_id === id)?.name || id).join(', ')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <script>window.print();</script>
            </body>
            </html>
        `;
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    };

    // الفلترة
    const filteredAssets = assets.filter(asset => {
        const matchLoc = filterLocation === 'all' || asset.location === filterLocation;
        const matchCust = filterCustodian === 'all' || asset.custodians.includes(filterCustodian);
        const matchSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchLoc && matchCust && matchSearch;
    });

    return (
        <div className="space-y-6 animate-in fade-in pb-20">
            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100"><span className="text-xs text-gray-500 font-bold">الإجمالي</span><div className="text-2xl font-black text-blue-700">{assets.length}</div></div>
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100"><span className="text-xs text-gray-500 font-bold">يعمل</span><div className="text-2xl font-black text-green-700">{assets.filter(a => a.status === 'working' || a.status === 'new').length}</div></div>
                <div className="bg-red-50 p-4 rounded-2xl border border-red-100"><span className="text-xs text-gray-500 font-bold">معطل/كهنة</span><div className="text-2xl font-black text-red-700">{assets.filter(a => a.status === 'broken' || a.status === 'scrap').length}</div></div>
                <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100"><span className="text-xs text-gray-500 font-bold">طبية</span><div className="text-2xl font-black text-purple-700">{assets.filter(a => a.type === 'medical').length}</div></div>
            </div>

            {/* أدوات التحكم */}
            <div className="bg-white p-4 rounded-2xl border shadow-sm flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3 items-center flex-1">
                    <div className="relative">
                        <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="بحث..." 
                            className="pr-9 pl-4 py-2 rounded-xl border bg-gray-50 text-sm w-40 focus:w-60 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select className="p-2 rounded-xl border bg-gray-50 text-sm font-bold" value={filterLocation} onChange={e => setFilterLocation(e.target.value)}>
                        <option value="all">📍 كل الأماكن</option>
                        {LOCATIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>

                <div className="flex gap-2">
                    <button onClick={handlePrintList} className="bg-gray-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-black transition-colors">
                        <Printer className="w-4 h-4" /> طباعة القائمة
                    </button>
                    <button onClick={() => { setEditingAsset(null); setFormData({ type: 'medical', status: 'working', custodians: [], location: LOCATIONS[0] }); setShowModal(true); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                        <Plus className="w-4 h-4" /> إضافة جهاز
                    </button>
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
                            {filteredAssets.map(asset => (
                                <tr key={asset.id} className="hover:bg-gray-50/50">
                                    <td className="p-4">
                                        <div className="font-bold text-gray-800">{asset.name}</div>
                                        <div className="text-xs text-gray-500 font-mono mt-1">SN: {asset.serial_number}</div>
                                    </td>
                                    <td className="p-4 text-xs text-gray-600">
                                        <div>Mod: {asset.model}</div>
                                        <div>Org: {asset.origin_country}</div>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-bold text-indigo-700 mb-1">{asset.location}</div>
                                        <div className="flex flex-wrap gap-1">
                                            {asset.custodians.map(cId => (
                                                <span key={cId} className="bg-gray-100 px-1.5 rounded text-[10px] border">
                                                    {employees.find(e => e.employee_id === cId)?.name.split(' ')[0] || cId}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${asset.status === 'working' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {STATUS_TRANSLATION[asset.status]}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-center gap-1">
                                            <button onClick={() => setShowQRModal(asset)} title="QR Code" className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"><QrCode className="w-4 h-4"/></button>
                                            <button onClick={() => handlePrintCard(asset)} title="طباعة كارت" className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"><FileText className="w-4 h-4"/></button>
                                            <button onClick={() => handleReportIssue(asset)} title="عطل" className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100"><Wrench className="w-4 h-4"/></button>
                                            <button onClick={() => { setEditingAsset(asset); setFormData(asset); setShowModal(true); }} title="تعديل" className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"><Edit className="w-4 h-4"/></button>
                                            <button onClick={() => handleDelete(asset.id)} title="حذف" className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
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
                        <p className="text-xs text-gray-500 font-mono mb-6">{showQRModal.id}</p>
                        <button onClick={() => handlePrintCard(showQRModal)} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 flex justify-center gap-2">
                            <Printer className="w-5 h-5"/> طباعة الكارت والـ QR
                        </button>
                    </div>
                </div>
            )}

            {/* Add/Edit Modal (نفس الكود السابق للمودال هنا) */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    {/* ... (نفس محتوى المودال السابق) ... */}
                    {/* للتبسيط لم أكرر كود المودال الطويل هنا، استخدم نفس كود المودال من الرد السابق */}
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
                                <label className="block text-xs font-bold text-gray-500 mb-1">أصحاب العهدة (اضغط Ctrl للاختيار المتعدد)</label>
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
