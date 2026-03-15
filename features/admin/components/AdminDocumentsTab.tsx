import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, FileText, FileSpreadsheet, FileIcon, 
    Printer, Download, FolderOpen, UploadCloud, Trash2, Loader2 
} from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';

interface AdminDocument {
    id: string;
    name: string;
    type: string;
    url: string;
    size: string;
    created_at: string;
}

export default function AdminDocumentsTab() {
    const [documents, setDocuments] = useState<AdminDocument[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // 1. جلب الملفات أوتوماتيكياً من Supabase Storage
    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            // قراءة محتويات المجلد admin_docs
            const { data, error } = await supabase.storage.from('admin_docs').list();
            
            if (error) throw error;
            
            // استبعاد الملف الـ placeholder الخفي الخاص بـ supabase
            const validFiles = data.filter(file => file.name !== '.emptyFolderPlaceholder');

            const formattedDocs = validFiles.map(file => {
                // استخراج الرابط المباشر للملف
                const { data: publicUrlData } = supabase.storage.from('admin_docs').getPublicUrl(file.name);
                
                // تحديد نوع الملف من امتداده
                const extension = file.name.split('.').pop()?.toLowerCase();
                let type = 'other';
                if (extension === 'pdf') type = 'pdf';
                else if (['doc', 'docx'].includes(extension || '')) type = 'word';
                else if (['xls', 'xlsx'].includes(extension || '')) type = 'excel';

                return {
                    id: file.id,
                    name: file.name.replace(/\.[^/.]+$/, ""), // إزالة الامتداد من الاسم للعرض
                    type: type,
                    url: publicUrlData.publicUrl,
                    size: (file.metadata?.size / 1024).toFixed(1) + ' KB', // تحويل الحجم لكيلوبايت
                    created_at: file.created_at
                };
            });

            // ترتيب الملفات الأحدث أولاً
            setDocuments(formattedDocs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
        } catch (error: any) {
            console.error('Error fetching docs:', error);
            toast.error('حدث خطأ أثناء جلب الملفات');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    // 2. الفلترة المحلية (لا تستهلك داتا بيز)
    const filteredDocs = useMemo(() => {
        return documents.filter(doc => 
            doc.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, documents]);

    // 3. رفع ملف جديد أوتوماتيكياً
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const toastId = toast.loading('جاري رفع الملف...');

        try {
            // منع تكرار الأسماء بإضافة طابع زمني
            const fileExt = file.name.split('.').pop();
            const fileName = `${file.name.replace(/\.[^/.]+$/, "")}_${Date.now()}.${fileExt}`;

            const { error } = await supabase.storage.from('admin_docs').upload(fileName, file);
            
            if (error) throw error;

            toast.success('تم رفع الملف بنجاح!', { id: toastId });
            fetchDocuments(); // تحديث القائمة أوتوماتيكياً
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('فشل رفع الملف', { id: toastId });
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = ''; // تفريغ الـ input
        }
    };

    // 4. حذف ملف
    const handleDelete = async (fileNameWithExt: string, docName: string) => {
        if (!confirm(`هل أنت متأكد من حذف ${docName}؟`)) return;

        try {
            // يجب استخراج الاسم الفعلي للملف مع امتداده من الـ URL أو تمريره، للتبسيط سنقوم باستخراجه من الرابط
            const urlParts = fileNameWithExt.split('/');
            const actualFileName = decodeURIComponent(urlParts[urlParts.length - 1]);

            const { error } = await supabase.storage.from('admin_docs').remove([actualFileName]);
            if (error) throw error;

            toast.success('تم حذف الملف');
            fetchDocuments();
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('فشل حذف الملف');
        }
    };

    const getFileIcon = (type: string) => {
        if (type === 'pdf') return <FileIcon className="w-8 h-8 text-red-500" />;
        if (type === 'word') return <FileText className="w-8 h-8 text-blue-600" />;
        if (type === 'excel') return <FileSpreadsheet className="w-8 h-8 text-emerald-600" />;
        return <FileIcon className="w-8 h-8 text-gray-500" />;
    };

    const getFileColor = (type: string) => {
        if (type === 'pdf') return 'bg-red-50 border-red-100 group-hover:border-red-300';
        if (type === 'word') return 'bg-blue-50 border-blue-100 group-hover:border-blue-300';
        if (type === 'excel') return 'bg-emerald-50 border-emerald-100 group-hover:border-emerald-300';
        return 'bg-gray-50 border-gray-100 group-hover:border-gray-300';
    };

    const handleAction = (doc: AdminDocument) => {
        if (doc.type === 'pdf') {
            window.open(doc.url, '_blank');
        } else {
            const link = document.createElement('a');
            link.href = doc.url;
            link.download = doc.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`جاري تحميل ${doc.name} للطباعة`, { icon: '⬇️' });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            
            {/* Header & Upload Button */}
            <div className="flex flex-col md:flex-row justify-between items-center border-b border-gray-200 pb-4 gap-4">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-2 text-gray-800">
                        <FolderOpen className="w-7 h-7 text-indigo-600" /> مكتبة النماذج والملفات الإدارية
                    </h2>
                    <p className="text-sm font-bold text-gray-500 mt-1">
                        جميع الملفات تسحب أوتوماتيكياً من وحدة التخزين السحابية (Storage).
                    </p>
                </div>
                
                {/* زر الرفع المخفي كـ Input */}
                <label className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md cursor-pointer active:scale-95">
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                    {isUploading ? 'جاري الرفع...' : 'رفع ملف جديد'}
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx" disabled={isUploading} />
                </label>
            </div>

            {/* أدوات البحث */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="relative w-full">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="ابحث عن نموذج..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pr-11 pl-4 font-bold text-sm focus:border-indigo-500 outline-none transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* شبكة الملفات */}
            {isLoading ? (
                <div className="py-20 text-center flex flex-col items-center">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
                    <p className="text-gray-500 font-bold">جاري جلب الملفات الإدارية...</p>
                </div>
            ) : filteredDocs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-black text-gray-600 mb-1">لا توجد ملفات</h3>
                    <p className="text-sm font-bold text-gray-400">قم برفع ملفاتك الأولى لتظهر هنا أوتوماتيكياً.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.map((doc) => (
                        <div 
                            key={doc.id} 
                            className={`p-5 rounded-[2rem] border transition-all group flex flex-col justify-between ${getFileColor(doc.type)} shadow-sm hover:shadow-md`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-white">
                                    {getFileIcon(doc.type)}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-white/60 text-gray-600 px-2 py-1 rounded-lg text-[10px] font-black border border-gray-200">
                                        {doc.size}
                                    </span>
                                    {/* زر الحذف */}
                                    <button 
                                        onClick={() => handleDelete(doc.url, doc.name)}
                                        className="p-1.5 bg-white text-red-500 rounded-lg border border-red-100 hover:bg-red-50 transition-colors"
                                        title="حذف الملف"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="font-black text-gray-800 text-base leading-tight mb-1 truncate" title={doc.name}>
                                    {doc.name}
                                </h3>
                                <p className="text-[10px] text-gray-400 font-mono">
                                    {new Date(doc.created_at).toLocaleDateString('ar-EG')}
                                </p>
                            </div>

                            <div className="mt-5 pt-4 border-t border-black/5 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    {doc.type.toUpperCase()}
                                </span>
                                <button 
                                    onClick={() => handleAction(doc)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors ${
                                        doc.type === 'pdf' 
                                            ? 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200' 
                                            : doc.type === 'word'
                                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                                    }`}
                                >
                                    {doc.type === 'pdf' ? <Printer className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                    {doc.type === 'pdf' ? 'عرض وطباعة' : 'تنزيل للطباعة'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
