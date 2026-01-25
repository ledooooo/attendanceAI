import React, { useState } from 'react';
import { Search, Printer, ArrowRight, ArrowLeft, FileText } from 'lucide-react';
import { Employee } from '../../../types';
import { TEMPLATES_DATA } from '../../../data/templatesData'; 
import { PrintLayout } from '../../../components/templates/PrintLayout';
export default function StaffTemplatesTab({ employee }: { employee: Employee }) {
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('الكل');

    const categories = ['الكل', ...Array.from(new Set(TEMPLATES_DATA.map((t) => t.category)))];

    const filteredTemplates = TEMPLATES_DATA.filter((tmpl) => 
        (filterCategory === 'الكل' || tmpl.category === filterCategory) &&
        (tmpl.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handlePrint = () => setTimeout(() => window.print(), 100);

    // --- وضع المعاينة والطباعة ---
    if (selectedTemplate) {
        return (
            <div className="animate-in fade-in duration-300 min-h-screen bg-gray-100/50">
                {/* شريط التحكم */}
                <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b p-4 flex justify-between items-center shadow-sm no-print">
                    <button onClick={() => setSelectedTemplate(null)} className="flex items-center text-gray-600 font-bold hover:text-emerald-600 gap-2 bg-gray-100 px-4 py-2 rounded-xl transition-all">
                        <ArrowRight className="w-5 h-5"/> رجوع
                    </button>
                    <div className="text-center hidden md:block">
                        <h2 className="font-black text-lg text-gray-800">{selectedTemplate.title}</h2>
                        <p className="text-xs text-gray-500">معاينة قبل الطباعة</p>
                    </div>
                    <button onClick={handlePrint} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700 transition-all transform active:scale-95">
                        <Printer className="w-5 h-5"/> طباعة
                    </button>
                </div>

                {/* استدعاء مكون الطباعة الموحد */}
                <div className="py-8 overflow-auto">
                    <PrintLayout title={selectedTemplate.title} employee={employee}>
                        {selectedTemplate.content(employee)}
                    </PrintLayout>
                </div>
            </div>
        );
    }

    // --- وضع القائمة (Grid) ---
    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500 p-2">
            
            {/* Header & Search */}
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><Printer className="w-6 h-6" /></div>
                        النماذج الرسمية والمخاطبات
                    </h3>
                    <div className="text-sm font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-lg border">
                        {filteredTemplates.length} نموذج متاح
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative w-full">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="ابحث باسم النموذج (مثال: إجازة، راتب...)" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="w-full pr-12 pl-4 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all font-bold text-gray-700" 
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar shrink-0">
                        {categories.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setFilterCategory(cat)} 
                                className={`px-6 py-3 rounded-2xl text-sm font-black whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-gray-500 border hover:bg-gray-50'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTemplates.map((tmpl) => (
                    <button 
                        key={tmpl.id} 
                        onClick={() => setSelectedTemplate(tmpl)} 
                        className="relative bg-white border border-gray-100 rounded-[2rem] p-6 hover:border-emerald-500 hover:shadow-xl transition-all text-right group overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-gray-50 to-transparent rounded-bl-[100%] -z-0 group-hover:from-emerald-50 transition-colors"></div>
                        
                        <div className="relative z-10 flex flex-col h-full justify-between gap-4">
                            <div className="flex justify-between items-start">
                                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-50 group-hover:scale-110 transition-transform">
                                    {tmpl.icon}
                                </div>
                                <span className="text-[10px] bg-gray-100 px-3 py-1.5 rounded-full text-gray-500 font-bold group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    {tmpl.category}
                                </span>
                            </div>
                            
                            <div>
                                <h4 className="font-black text-lg text-gray-800 leading-tight mb-2 group-hover:text-emerald-700 transition-colors">
                                    {tmpl.title}
                                </h4>
                                <p className="text-xs text-gray-400 font-medium">اضغط للمعاينة والطباعة الفورية</p>
                            </div>

                            <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-2">
                                <div className="h-full bg-emerald-500 w-0 group-hover:w-full transition-all duration-500 ease-out"></div>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}

