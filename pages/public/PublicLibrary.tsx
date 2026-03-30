import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../supabaseClient'; // تأكد من مسار الـ supabase
import { Search, FileText, ExternalLink, BookOpen, Layers, FileCode, FileSpreadsheet, LogIn, Home, ChevronLeft } from 'lucide-react';

export default function PublicLibrary() {
    const [docs, setDocs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDocs(); }, []);

    const fetchDocs = async () => {
        setLoading(true);
        // سيتم جلب البيانات هنا، وتأكد أن جدول company_documents مسموح بقراءته للـ Public في إعدادات RLS
        const { data } = await supabase.from('company_documents').select('*').order('title');
        if (data) setDocs(data);
        setLoading(false);
    };

    // استخراج الأقسام وفصلها بجميع أنواع الشرطات (العادية، الطويلة، والمتوسطة)
    const departments = useMemo(() => {
        const allDepts = new Set<string>();
        docs.forEach(doc => {
            if (doc.department) {
                const parts = doc.department.split(/-|–|—/).map((p: string) => p.trim()).filter(Boolean);
                parts.forEach((p: string) => allDepts.add(p));
            }
        });
        return Array.from(allDepts).sort();
    }, [docs]);

    const fileTypes = useMemo(() => {
        const types = new Set(docs.map(d => d.file_type).filter(Boolean));
        return Array.from(types);
    }, [docs]);

    const filteredDocs = docs.filter(doc => {
        const searchTarget = `${doc.title || ''} ${doc.description || ''} ${doc.department || ''}`.toLowerCase();
        const matchSearch = searchTarget.includes(searchTerm.toLowerCase());
        const matchType = typeFilter === 'all' || doc.file_type === typeFilter;
        
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
        <div className="min-h-screen bg-gray-50 text-right pb-20" dir="rtl">
            {/* الشريط العلوي - Header */}
            <div className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-20">
                <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
                    <h1 className="text-lg font-black text-indigo-900 flex items-center gap-2">
                        <BookOpen size={20} className="text-indigo-600" /> سياسات العمل
                    </h1>
                    <div className="flex items-center gap-2">
                        <a href="/" className="p-2 text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors" title="الرئيسية">
                            <Home size={18} />
                        </a>
                        <a href="/login" className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-full text-xs font-bold transition-colors shadow-sm">
                            دخول الموظفين <LogIn size={14} />
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 mt-4">
                {/* منطقة البحث والفلترة (ثابتة في الأعلى لسهولة الاستخدام) */}
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 mb-4 sticky top-[68px] z-10">
                    <div className="relative mb-3">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input 
                            type="text" placeholder="ابحث عن سياسة، قسم، أو كلمة مفتاحية..." 
                            className="w-full pr-10 pl-4 py-3 bg-gray-50 rounded-xl text-sm font-bold border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    {/* فلاتر الأقسام السريعة (Scrollable Tabs) */}
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center">
                        <button 
                            onClick={() => setDeptFilter('all')} 
                            className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-black transition-all ${deptFilter === 'all' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            كل الأقسام
                        </button>
                        {departments.map(dept => (
                            <button 
                                key={dept} 
                                onClick={() => setDeptFilter(dept)} 
                                className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-black transition-all ${deptFilter === dept ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {dept}
                            </button>
                        ))}
                    </div>
                </div>

                {/* منطقة عرض الملفات (List View) */}
                {loading ? (
                    <div className="text-center py-16 text-indigo-400 animate-pulse font-black flex flex-col items-center gap-3">
                        <BookOpen size={40} className="opacity-50" />
                        جاري تحميل السياسات...
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1 mb-1">
                            <span className="text-xs font-bold text-gray-500">تم العثور على {filteredDocs.length} ملف</span>
                            {/* فلتر النوع كزرار صغير */}
                            <select 
                                className="bg-transparent text-xs font-bold text-gray-600 outline-none cursor-pointer"
                                value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                            >
                                <option value="all">كل الأنواع</option>
                                {fileTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>

                        {filteredDocs.map(doc => {
                            // فصل الأقسام للعرض تحت كل كارت
                            const targetDepartments = doc.department ? doc.department.split(/-|–|—/).map((d: string) => d.trim()).filter(Boolean) : [];
                            
                            return (
                                <a 
                                    key={doc.id} 
                                    href={doc.file_url} target="_blank" rel="noreferrer"
                                    className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-100 hover:border-indigo-300 hover:shadow-md active:scale-[0.98] transition-all group"
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-indigo-50 transition-colors shrink-0">
                                            {getFileIcon(doc.file_type)}
                                        </div>
                                        <div className="overflow-hidden">
                                            <h4 className="font-black text-gray-800 text-sm truncate mb-1">
                                                {doc.title}
                                            </h4>
                                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                                                {targetDepartments.length > 0 ? (
                                                    targetDepartments.map((dept, i) => (
                                                        <span key={i} className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                            {dept}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">عام</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="shrink-0 ml-2 p-2 bg-gray-50 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white rounded-full transition-colors">
                                        <ChevronLeft size={18} />
                                    </div>
                                </a>
                            );
                        })}
                        
                        {filteredDocs.length === 0 && (
                            <div className="text-center py-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-gray-200">
                                <div className="bg-gray-50 p-4 rounded-full mb-3">
                                    <Layers size={32} className="text-gray-300" />
                                </div>
                                <p className="text-gray-500 font-black text-sm">عذراً، لم يتم العثور على سياسات تطابق بحثك.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <style>{`
                /* لإخفاء شريط التمرير (Scrollbar) من قائمة الأقسام مع بقاء إمكانية السحب */
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
