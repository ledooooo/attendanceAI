import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../supabaseClient';
import { Search, FileText, ExternalLink, BookOpen, Layers, FileCode, FileSpreadsheet } from 'lucide-react';

export default function StaffLibrary() {
    const [docs, setDocs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDocs(); }, []);

    const fetchDocs = async () => {
        setLoading(true);
        const { data } = await supabase.from('company_documents').select('*').order('title');
        if (data) setDocs(data);
        setLoading(false);
    };

    // جلب القوائم الفريدة للفلاتر ديناميكياً من البيانات
    const departments = useMemo(() => ['all', ...Array.from(new Set(docs.map(d => d.department)))], [docs]);
    const fileTypes = useMemo(() => ['all', ...Array.from(new Set(docs.map(d => d.file_type)))], [docs]);

    const filteredDocs = docs.filter(doc => {
        const matchSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = typeFilter === 'all' || doc.file_type === typeFilter;
        const matchDept = deptFilter === 'all' || doc.department === deptFilter;
        return matchSearch && matchType && matchDept;
    });

    const getFileIcon = (type: string) => {
        switch (type.toUpperCase()) {
            case 'PDF': return <FileText className="text-red-500" size={20} />;
            case 'EXCEL': 
            case 'XLSX': return <FileSpreadsheet className="text-emerald-600" size={20} />;
            case 'HTML': return <FileCode className="text-blue-500" size={20} />;
            default: return <BookOpen className="text-indigo-500" size={20} />;
        }
    };

    return (
        <div className="p-4 max-w-7xl mx-auto text-right space-y-4" dir="rtl">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b pb-4 border-gray-100">
                <h2 className="text-xl font-black flex items-center gap-2 text-gray-800">
                    <BookOpen size={24} className="text-indigo-600" /> المكتبة الرقمية
                </h2>
                
                {/* شريط البحث والفلاتر المصغر */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" placeholder="بحث..." 
                            className="w-full pr-8 pl-3 py-1.5 bg-gray-100/50 rounded-xl text-xs border-none focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select 
                        className="bg-gray-100/50 px-3 py-1.5 rounded-xl text-[11px] font-bold border-none outline-none"
                        value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                    >
                        <option value="all">كل الأقسام</option>
                        {departments.filter(d => d !== 'all').map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select 
                        className="bg-gray-100/50 px-3 py-1.5 rounded-xl text-[11px] font-bold border-none outline-none"
                        value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="all">كل الأنواع</option>
                        {fileTypes.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-gray-400 animate-pulse font-bold">جاري تحميل المستندات...</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {filteredDocs.map(doc => (
                        <div key={doc.id} className="group bg-white p-3 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-300 flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="p-1.5 bg-gray-50 rounded-lg group-hover:bg-white transition-colors">
                                        {getFileIcon(doc.file_type)}
                                    </div>
                                    <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">{doc.department}</span>
                                </div>
                                <h4 className="font-bold text-gray-800 text-sm mb-1 line-clamp-2 min-h-[2.5rem] leading-snug">
                                    {doc.title}
                                </h4>
                                <p className="text-[10px] text-gray-400 line-clamp-2 mb-3 h-8">
                                    {doc.description || "لا يوجد وصف متوفر لهذا المستند."}
                                </p>
                            </div>

                            <a 
                                href={doc.file_url} target="_blank" rel="noreferrer"
                                className="w-full flex items-center justify-center gap-2 py-2 bg-gray-50 text-gray-700 group-hover:bg-indigo-600 group-hover:text-white rounded-xl text-[11px] font-black transition-all"
                            >
                                <ExternalLink size={14} /> عرض المستند
                            </a>
                        </div>
                    ))}
                </div>
            )}
            
            {filteredDocs.length === 0 && !loading && (
                <div className="text-center py-20">
                    <div className="bg-gray-50 inline-block p-6 rounded-full mb-4">
                        <Layers size={40} className="text-gray-200" />
                    </div>
                    <p className="text-gray-400 font-bold">عذراً، لم يتم العثور على أي ملفات تطابق بحثك.</p>
                </div>
            )}
        </div>
    );
}
