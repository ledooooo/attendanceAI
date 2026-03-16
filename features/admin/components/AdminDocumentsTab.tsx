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
    originalName: string; 
    type: string;
    url: string;
    size: string;
    created_at: string;
}

// دوال الترجمة الذكية لحل مشكلة الحروف العربية في السيرفرات
const encodeFileName = (str: string) => {
    return Array.from(new TextEncoder().encode(str))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
};

const decodeFileName = (str: string) => {
    if (/^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0) {
        try {
            const match = str.match(/.{1,2}/g);
            if (match) {
                const bytes = new Uint8Array(match.map(byte => parseInt(byte, 16)));
                return new TextDecoder().decode(bytes);
            }
        } catch (e) {
            return str;
        }
    }
    return str.replace(/_/g, " "); 
};

export default function AdminDocumentsTab() {
    const [documents, setDocuments] = useState<AdminDocument[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    const fetchDocuments = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.storage.from('admin_docs').list();
            if (error) throw error;
            
            const validFiles = data.filter(file => file.name !== '.emptyFolderPlaceholder');

            const formattedDocs = validFiles.map(file => {
                const { data: publicUrlData } = supabase.storage.from('admin_docs').getPublicUrl(file.name);
                
                const extension = file.name.split('.').pop()?.toLowerCase();
                let type = 'other';
                if (extension === 'pdf') type = 'pdf';
                else if (['doc', 'docx'].includes(extension || '')) type = 'word';
                else if (['xls', 'xlsx', 'csv'].includes(extension || '')) type = 'excel';

                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                const parts = nameWithoutExt.split('_');
                const timestamp = parts.pop(); 
                const encodedBaseName = parts.join('_'); 
                
                const displayName = decodeFileName(encodedBaseName);

                return {
                    id: file.id,
                    name: displayName || 'ملف بدون اسم',
                    originalName: file.name, 
                    type: type,
                    url: publicUrlData.publicUrl,
                    size: (file.metadata?.size / 1024).toFixed(1) + ' KB',
                    created_at: file.created_at
                };
            });

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

    const filteredDocs = useMemo(() => {
        return documents.filter(doc => 
            doc.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [searchQuery, documents]);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const toastId = toast.loading('جاري رفع الملف...');

        try {
            const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
            const baseName = file.name.replace(/\.[^/.]+$/, "");
            
            const safeEncodedName = encodeFileName(baseName);
            const fileName = `${safeEncodedName}_${Date.now()}.${fileExt}`;

            const { error } = await supabase.storage.from('admin_docs').upload(fileName, file);
            if (error) throw error;

            toast.success('تم رفع الملف بنجاح!', { id: toastId });
            fetchDocuments(); 
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error('فشل رفع الملف', { id: toastId });
        } finally {
            setIsUploading(false);
            if (event.target) event.target.value = ''; 
        }
    };

    const handleDelete = async (originalFileName: string, docName: string) => {
        if (!confirm(`هل أنت متأكد من حذف الملف "${docName}"؟`)) return;

        try {
            const { error } = await supabase.storage.from('admin_docs').remove([originalFileName]);
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

    // ✅ برمجة الطباعة المباشرة الصامتة للـ PDF
    const handleAction = async (doc: AdminDocument) => {
        if (doc.type === 'pdf') {
            const toastId = toast.loading(`جاري تحضير ${doc.name} للطباعة المباشرة...`);
            try {
                // سحب الملف כـ Blob لتجاوز الحماية (CORS) والسماح للطباعة المباشرة
                const response = await fetch(doc.url);
                const blob = await response.blob();
                const blobUrl = URL.createObjectURL(blob);
                
                // إنشاء نافذة iframe مخفية ووضع الملف فيها
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = blobUrl;
                document.body.appendChild(iframe);
                
                // أمر الطباعة يتم بمجرد تحميل الإطار المخفي
                iframe.onload = () => {
                    setTimeout(() => {
                        iframe.contentWindow?.focus();
                        iframe.contentWindow?.print();
                        toast.success('تم فتح نافذة الطباعة بنجاح! 🖨️', { id: toastId });
                        
                        // تنظيف الذاكرة بعد قليل
                        setTimeout(() => {
                            document.body.removeChild(iframe);
                            URL.revokeObjectURL(blobUrl);
                        }, 15000);
                    }, 500);
                };
            } catch (error) {
                console.error('Print Error:', error);
                toast.error('حدثت مشكلة في الطباعة الصامتة، سيتم الفتح في نافذة جديدة', { id: toastId });
                window.open(doc.url, '_blank');
            }
        } else {
            // الوورد والاكسيل يتم تحميلهما أوتوماتيكياً
            const link = document.createElement('a');
            link.href = doc.url;
            link.download = doc.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`تم تحميل ملف الوورد/الاكسيل للطباعة`, { icon: '⬇️' });
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
                
                <label className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-md cursor-pointer active:scale-95">
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
                    {isUploading ? 'جاري الرفع...' : 'رفع ملف جديد'}
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.xls,.xlsx,.csv" disabled={isUploading} />
                </label>
            </div>

            {/* أدوات البحث */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
                <div className="relative w-full">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text"
                        placeholder="ابحث عن نموذج بالاسم..."
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
                    <p className="text-sm font-bold text-gray-400">قم برفع ملفاتك الإدارية لتظهر هنا أوتوماتيكياً.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDocs.map((doc) => (
                        <div 
                            key={doc.id} 
                            className={`p-5 rounded-[2rem] border transition-all group flex flex-col justify-between ${getFileColor(doc.type)} shadow-sm hover:shadow-md hover:-translate-y-1`}
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="bg-white p-3 rounded-2xl shadow-sm border border-white">
                                    {getFileIcon(doc.type)}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="bg-white/60 text-gray-600 px-2 py-1 rounded-lg text-[10px] font-black border border-gray-200">
                                        {doc.size}
                                    </span>
                                    <button 
                                        onClick={() => handleDelete(doc.originalName, doc.name)}
                                        className="p-1.5 bg-white text-red-500 rounded-lg border border-red-100 hover:bg-red-50 transition-colors shadow-sm"
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
                                {/* ✅ الزر الذكي يعتمد طباعة للـ PDF وتحميلاً للوورد والاكسيل */}
                                <button 
                                    onClick={() => handleAction(doc)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors active:scale-95 ${
                                        doc.type === 'pdf' 
                                            ? 'bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-200' 
                                            : doc.type === 'word'
                                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200'
                                                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200'
                                    }`}
                                >
                                    {doc.type === 'pdf' ? <Printer className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                                    {doc.type === 'pdf' ? 'طباعة مباشرة' : 'تنزيل للطباعة'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
