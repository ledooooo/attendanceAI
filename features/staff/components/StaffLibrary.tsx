import React, { useEffect, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Search, Filter, FileText, ExternalLink, Download } from 'lucide-react';

export default function StaffDocuments() {
    const [docs, setDocs] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [deptFilter, setDeptFilter] = useState('all');

    useEffect(() => { fetchDocs(); }, []);

    const fetchDocs = async () => {
        const { data } = await supabase.from('company_documents').select('*').order('title');
        if (data) setDocs(data);
    };

    const filteredDocs = docs.filter(doc => {
        const matchSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchType = typeFilter === 'all' || doc.file_type === typeFilter;
        const matchDept = deptFilter === 'all' || doc.department === deptFilter;
        return matchSearch && matchType && matchDept;
    });

    return (
        <div className="p-6 max-w-6xl mx-auto text-right" dir="rtl">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-2 text-indigo-700">
                <FileText /> المكتبة الرقمية والسياسات
            </h2>

            {/* شريط البحث والفلترة */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-wrap gap-4 mb-8">
                <div className="flex-1 relative min-w-[200px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" placeholder="ابحث عن ملف..." 
                        className="w-full pr-10 pl-4 py-2 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100"
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select 
                    className="bg-gray-50 px-4 py-2 rounded-xl outline-none text-sm font-bold"
                    onChange={(e) => setDeptFilter(e.target.value)}
                >
                    <option value="all">كل الأقسام</option>
                    <option value="HR">شئون العاملين</option>
                    <option value="Quality">الجودة</option>
                    <option value="Finance">المالية</option>
                </select>
                <select 
                    className="bg-gray-50 px-4 py-2 rounded-xl outline-none text-sm font-bold"
                    onChange={(e) => setTypeFilter(e.target.value)}
                >
                    <option value="all">كل الأنواع</option>
                    <option value="PDF">PDF</option>
                    <option value="Word">Word</option>
                    <option value="Excel">Excel</option>
                </select>
            </div>

            {/* عرض الملفات */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocs.map(doc => (
                    <div key={doc.id} className="bg-white p-5 rounded-3xl border border-gray-100 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${
                                doc.file_type === 'PDF' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                            }`}>
                                {doc.file_type}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold">{doc.department}</span>
                        </div>
                        <h4 className="font-black text-gray-800 mb-4">{doc.title}</h4>
                        <a 
                            href={doc.file_url} target="_blank" rel="noreferrer"
                            className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                        >
                            <ExternalLink size={16} /> فتح المستند
                        </a>
                    </div>
                ))}
            </div>
        </div>
    );
}
