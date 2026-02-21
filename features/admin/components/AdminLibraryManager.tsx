import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
    Plus, Trash2, FileText, Download, Upload, 
    FileSpreadsheet, X, Save, ExternalLink, AlertCircle 
} from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminLibraryManager() {
    const [docs, setDocs] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({ 
        title: '', 
        file_type: 'PDF', 
        department: '', 
        file_url: '', 
        description: '',
        category: 'general'
    });

    useEffect(() => { fetchDocs(); }, []);

    const fetchDocs = async () => {
        const { data } = await supabase.from('company_documents').select('*').order('created_at', { ascending: false });
        if (data) setDocs(data);
    };

    // --- وظيفة تصدير البيانات إلى ملف اكسيل ---
    const handleExportExcel = () => {
        if (docs.length === 0) return alert('لا توجد بيانات لتصديرها');
        
        // استثناء الـ ID و Created At عند التصدير ليكون الملف جاهزاً لإعادة الرفع إذا لزم الأمر
        const dataToExport = docs.map(({ id, created_at, ...rest }) => rest);
        
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Documents");
        
        XLSX.writeFile(workbook, `Library_Backup_${new Date().toLocaleDateString()}.xlsx`);
    };

    // --- وظيفة استيراد البيانات من ملف اكسيل المحدثة والمحمية ---
const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                setLoading(true);
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                
                // تحويل البيانات مع التأكد من جلب كل الصفوف (defval تضمن عدم تجاهل الخلايا الفارغة)
                const rawData = XLSX.utils.sheet_to_json(ws, { defval: "" });

                if (!rawData || rawData.length === 0) {
                    throw new Error("الملف لا يحتوي على بيانات");
                }

                // تنظيف البيانات وفلترتها (تجاهل أي صف ليس له عنوان أو رابط)
                const cleanedData = rawData
                    .map((row: any) => ({
                        title: String(row.title || "").trim(),
                        file_type: String(row.file_type || "PDF").trim(),
                        department: String(row.department || "عام").trim(),
                        file_url: String(row.file_url || "").trim(),
                        description: String(row.description || "").trim(),
                        category: String(row.category || "general").trim()
                    }))
                    .filter(item => item.title !== "" && item.file_url !== ""); // استبعاد الصفوف الفارغة

                if (cleanedData.length === 0) {
                    throw new Error("لم يتم العثور على بيانات صالحة (تأكد من وجود title و file_url)");
                }

                // تنفيذ عملية الإدخال الجماعي لجميع الصفوف مرة واحدة
                const { error } = await supabase
                    .from('company_documents')
                    .insert(cleanedData);
                
                if (error) throw error;
                
                alert(`تم بنجاح استيراد جميع البيانات: عدد (${cleanedData.length}) مستند`);
                fetchDocs();
            } catch (error: any) {
                alert(`خطأ: ${error.message}`);
                console.error("Import Error:", error);
            } finally {
                setLoading(false);
                e.target.value = ''; 
            }
        };
        reader.readAsBinaryString(file);
    };
const handleSave = async () => {
        if (!formData.title || !formData.file_url) return alert('يرجى ملء اسم الملف والرابط');
        setLoading(true);
        const { error } = await supabase.from('company_documents').insert([formData]);
        
        if (!error) {
            // ✅ إرسال إشعار لجميع الموظفين بأن هناك مستند جديد تمت إضافته
            try {
                const { data: activeEmps } = await supabase.from('employees').select('employee_id').eq('status', 'نشط');
                if (activeEmps && activeEmps.length > 0) {
                    const notifTitle = "📚 مستند جديد في المكتبة";
                    const notifMsg = `تمت إضافة مستند جديد بعنوان: ${formData.title}`;

                    // 1. الحفظ في قاعدة البيانات
                    const notificationsPayload = activeEmps.map(emp => ({
                        user_id: String(emp.employee_id),
                        title: notifTitle,
                        message: notifMsg,
                        type: 'general',
                        is_read: false
                    }));
                    await supabase.from('notifications').insert(notificationsPayload);

                    // 2. إرسال الإشعارات اللحظية بشكل متوازي
                    Promise.all(
                        activeEmps.map(emp => 
                            supabase.functions.invoke('send-push-notification', {
                                body: { 
                                    userId: String(emp.employee_id), 
                                    title: notifTitle, 
                                    body: notifMsg.substring(0, 50), 
                                    url: '/staff?tab=library' // توجيه الموظف لتبويب المكتبة
                                }
                            })
                        )
                    ).catch(err => console.error("Push Error in Library:", err));
                }
            } catch (err) {
                console.error("Notification Error:", err);
            }

            setIsModalOpen(false);
            setFormData({ title: '', file_type: 'PDF', department: '', file_url: '', description: '', category: 'general' });
            fetchDocs();
        } else {
            alert('خطأ في الحفظ يدوياً');
        }
        setLoading(false);
    };
    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد من حذف هذا الملف نهائياً؟')) {
            await supabase.from('company_documents').delete().eq('id', id);
            fetchDocs();
        }
    };

    return (
        <div className="p-4 md:p-8 text-right" dir="rtl">
            {/* الهيدر والأزرار */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-black text-gray-800">إدارة المكتبة والسياسات</h2>
                    <p className="text-gray-500 text-sm font-bold mt-1 text-right">تحكم شامل في ملفات PDF والروابط الرسمية</p>
                </div>

                <div className="flex flex-wrap gap-2 mr-auto md:mr-0">
                    <label className="bg-indigo-50 text-indigo-600 px-4 py-2.5 rounded-xl flex items-center gap-2 font-black cursor-pointer hover:bg-indigo-100 transition-all text-sm border border-indigo-100">
                        <Upload size={18} />
                        <span>رفع من اكسيل</span>
                        <input type="file" accept=".xlsx, .xls" hidden onChange={handleImportExcel} />
                    </label>

                    <button 
                        onClick={handleExportExcel}
                        className="bg-amber-50 text-amber-600 px-4 py-2.5 rounded-xl flex items-center gap-2 font-black hover:bg-amber-100 transition-all text-sm border border-amber-100"
                    >
                        <Download size={18} />
                        تحميل قاعدة البيانات
                    </button>

                    <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all text-sm"
                    >
                        <Plus size={18} /> إضافة مستند
                    </button>
                </div>
            </div>

            {loading && (
                <div className="mb-6 p-4 bg-indigo-50 text-indigo-700 rounded-2xl flex items-center gap-3 animate-pulse font-bold text-sm">
                    <FileSpreadsheet className="animate-bounce" /> جاري معالجة البيانات وتحديث القاعدة...
                </div>
            )}

            {/* الجدول */}
            <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-right border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-400 text-xs font-black uppercase">
                            <th className="p-5 text-right">المستند</th>
                            <th className="p-5 text-center">القسم المختص</th>
                            <th className="p-5 text-center">نوع الملف</th>
                            <th className="p-5 text-center">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                        {docs.map(doc => (
                            <tr key={doc.id} className="hover:bg-gray-50/50 transition-colors group">
                                <td className="p-5">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <p className="font-black text-gray-800">{doc.title}</p>
                                            <p className="text-[10px] text-gray-400 truncate max-w-[200px]">{doc.description}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5 text-center text-gray-500 font-bold">{doc.department || 'غير محدد'}</td>
                                <td className="p-5 text-center">
                                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase ${
                                        doc.file_type === 'PDF' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                                    }`}>
                                        {doc.file_type}
                                    </span>
                                </td>
                                <td className="p-5">
                                    <div className="flex justify-center gap-2">
                                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-colors">
                                            <ExternalLink size={18} />
                                        </a>
                                        <button onClick={() => handleDelete(doc.id)} className="p-2 text-red-400 hover:bg-red-50 rounded-xl transition-colors">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* مودال الإضافة اليدوية */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-800">إضافة مستند جديد</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X /></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">اسم المستند</label>
                                <input type="text" className="w-full p-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold" placeholder="مثلاً: سياسة مكافحة العدوى" onChange={e => setFormData({...formData, title: e.target.value})} />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">القسم</label>
                                    <input type="text" className="w-full p-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold" placeholder="HR / الجودة" onChange={e => setFormData({...formData, department: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">النوع</label>
                                    <select className="w-full p-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold" onChange={e => setFormData({...formData, file_type: e.target.value})}>
                                        <option value="PDF">PDF</option>
                                        <option value="Word">Word</option>
                                        <option value="Excel">Excel</option>
                                        <option value="HTML">Link / HTML</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">رابط الملف (جوجل درايف)</label>
                                <input type="text" className="w-full p-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold" placeholder="https://..." onChange={e => setFormData({...formData, file_url: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-gray-400 mb-2 mr-2">شرح مختصر</label>
                                <textarea className="w-full p-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-bold h-20" placeholder="عن ماذا يتحدث هذا الملف..." onChange={e => setFormData({...formData, description: e.target.value})} />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={handleSave} className="flex-1 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                                <Save size={20} /> حفظ في القاعدة
                            </button>
                            <button onClick={() => setIsModalOpen(false)} className="px-8 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black hover:bg-gray-200 transition-colors">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
