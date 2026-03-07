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

    // 🌟 1. استخراج الأقسام بذكاء (فصل الكلمات بالشرطة العادية أو الطويلة وإزالة الفراغات)
    const departments = useMemo(() => {
        const allDepts = new Set<string>();
        docs.forEach(doc => {
            if (doc.department) {
                // تقسيم النص باستخدام علامة (-) أو (–)
                const parts = doc.department.split(/-|–|—/).map((p: string) => p.trim()).filter(Boolean);
                parts.forEach((p: string) => allDepts.add(p));
            }
        });
        // ترتيب الأبجدية للأقسام
        return ['all', ...Array.from(allDepts).sort()];
    }, [docs]);

    const fileTypes = useMemo(() => {
        const types = new Set(docs.map(d => d.file_type).filter(Boolean));
        return ['all', ...Array.from(types)];
    }, [docs]);

    // 🌟 2. تطبيق الفلترة الذكية والبحث المتقدم
    const filteredDocs = docs.filter(doc => {
        // البحث في العنوان أو الوصف
        const searchTarget = `${doc.title || ''} ${doc.description || ''}`.toLowerCase();
        const matchSearch = searchTarget.includes(searchTerm.toLowerCase());
        
        const matchType = typeFilter === 'all' || doc.file_type === typeFilter;
        
        // التحقق مما إذا كان القسم المختار موجوداً ضمن الأقسام المستهدفة للمستند
        let matchDept = deptFilter === 'all';
        if (deptFilter !== 'all' && doc.department) {
            const docDepts = doc.department.split(/-|–|—/).map((p: string) => p.trim());
            matchDept = docDepts.includes(deptFilter);
        }
        
        return matchSearch && matchType && matchDept;
    });

    const getFileIcon = (type: string) => {
        if (!type) return <BookOpen className="text-indigo-500" size={20} />;
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
                <h2 className="text-xl font-black flex items-center gap-2 text-gray-800 shrink-0">
                    <BookOpen size={24} className="text-indigo-600" /> المكتبة الرقمية
                </h2>
                
                {/* شريط البحث والفلاتر */}
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" placeholder="ابحث في العنوان أو الوصف..." 
                            className="w-full pr-8 pl-3 py-2 bg-gray-100/70 rounded-xl text-xs font-bold border-none focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select 
                        className="bg-gray-100/70 px-3 py-2 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                        value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}
                    >
                        <option value="all">كل الأقسام المستهدفة</option>
                        {departments.filter(d => d !== 'all').map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select 
                        className="bg-gray-100/70 px-3 py-2 rounded-xl text-xs font-bold border-none outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
                        value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="all">نوع الملف</option>
                        {fileTypes.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20 text-indigo-400 animate-pulse font-black flex flex-col items-center justify-center gap-3">
                    <BookOpen size={40} className="opacity-50" />
                    جاري تحميل المستندات...
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredDocs.map(doc => {
                        // 🌟 3. تحويل النص المتصل إلى مصفوفة لعرضها كـ Badges منفصلة
                        const targetDepartments = doc.department ? doc.department.split(/-|–|—/).map((d: string) => d.trim()).filter(Boolean) : [];
                        
                        return (
                            <div key={doc.id} className="group bg-white p-4 rounded-2xl border border-gray-100 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 transition-all duration-300 flex flex-col justify-between h-full">
                                <div>
                                    <div className="flex justify-between items-start mb-3 gap-2">
                                        <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-indigo-50 transition-colors shrink-0">
                                            {getFileIcon(doc.file_type)}
                                        </div>
                                        
                                        {/* عرض التخصصات بشكل أنيق */}
                                        <div className="flex flex-wrap justify-end gap-1">
                                            {targetDepartments.length > 0 ? (
                                                targetDepartments.map((dept, i) => (
                                                    <span key={i} className="text-[9px] font-black text-indigo-600 bg-indigo-50/80 border border-indigo-100 px-2 py-0.5 rounded-lg text-center">
                                                        {dept}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-[9px] font-black text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg">عام</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <h4 className="font-black text-gray-800 text-sm mb-1.5 line-clamp-2 leading-snug">
                                        {doc.title}
                                    </h4>
                                    <p className="text-[10px] text-gray-500 line-clamp-2 mb-4 font-medium leading-relaxed min-h-[1.75rem]">
                                        {doc.description || "لا يوجد وصف متوفر لهذا المستند."}
                                    </p>
                                </div>

                                <a 
                                    href={doc.file_url} target="_blank" rel="noreferrer"
                                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 text-gray-700 group-hover:bg-indigo-600 group-hover:text-white rounded-xl text-xs font-black transition-all shadow-sm"
                                >
                                    <ExternalLink size={14} /> عرض المستند
                                </a>
                            </div>
                        );
                    })}
                </div>
            )}
            
            {filteredDocs.length === 0 && !loading && (
                <div className="text-center py-20 flex flex-col items-center justify-center">
                    <div className="bg-gray-50 inline-flex p-6 rounded-full mb-4 border border-gray-100">
                        <Layers size={40} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-black text-sm">عذراً، لم يتم العثور على أي ملفات تطابق بحثك.</p>
                </div>
            )}
        </div>
    );
}
