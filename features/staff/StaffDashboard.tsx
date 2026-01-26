import React, { useState } from 'react';
import { Search, Printer, ArrowRight, ArrowLeft, PenTool, FileText } from 'lucide-react';
import { Employee } from '../../../types';
import { TEMPLATES_DATA, Template } from '../../../data/templatesData';
import { PrintLayout } from '../../../components/templates/PrintLayout';

export default function StaffTemplatesTab({ employee }: { employee: Employee }) {
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'form' | 'print'>('list');
    const [templateData, setTemplateData] = useState<any>({});
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('الكل');

    const categories = ['الكل', ...Array.from(new Set(TEMPLATES_DATA.map((t) => t.category)))];

    const filteredTemplates = TEMPLATES_DATA.filter((tmpl) => 
        (filterCategory === 'الكل' || tmpl.category === filterCategory) &&
        (tmpl.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handlePrint = () => setTimeout(() => window.print(), 100);

    const handleSelectTemplate = (tmpl: Template) => {
        setSelectedTemplate(tmpl);
        setTemplateData({});
        if (tmpl.fields && tmpl.fields.length > 0) {
            setViewMode('form');
        } else {
            setViewMode('print');
        }
    };

    const handleBack = () => {
        if (viewMode === 'print' && selectedTemplate?.fields?.length) {
            setViewMode('form');
        } else {
            setViewMode('list');
            setSelectedTemplate(null);
        }
    };

    // --- 1. وضع الطباعة والمعاينة (تم إضافة إصلاح الطباعة هنا) ---
// ... (داخل المكون، عند حالة viewMode === 'print')

    if (viewMode === 'print' && selectedTemplate) {
        return (
            <div className="min-h-screen bg-gray-100/50">
                {/* 🔥 كود CSS القوي لإصلاح الطباعة */}
                <style>
                    {`
                        @media print {
                            /* إخفاء كل العناصر في الصفحة */
                            body * {
                                visibility: hidden;
                                height: 0; 
                                overflow: hidden;
                            }
                            
                            /* إظهار منطقة الطباعة فقط */
                            #printable-content, #printable-content * {
                                visibility: visible;
                                height: auto;
                                overflow: visible;
                            }

                            /* ضبط موضع الورقة لتبدأ من أعلى الصفحة تماماً */
                            #printable-content {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                                margin: 0;
                                padding: 0;
                                background: white;
                            }

                            /* إخفاء الهوامش الافتراضية للمتصفح */
                            @page {
                                size: A4;
                                margin: 0; 
                            }
                        }
                    `}
                </style>

                {/* الشريط العلوي (لا يظهر في الطباعة بسبب no-print) */}
                <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b p-4 flex justify-between items-center shadow-sm no-print">
                    <button onClick={handleBack} className="flex items-center text-gray-600 font-bold hover:text-emerald-600 gap-2 bg-gray-100 px-4 py-2 rounded-xl transition-all">
                        <ArrowRight className="w-5 h-5"/> رجوع للتعديل
                    </button>
                    {/* ... باقي الأزرار ... */}
                    <button onClick={handlePrint} className="...">
                        <Printer className="w-5 h-5"/> طباعة
                    </button>
                </div>

                {/* منطقة الورقة فقط */}
                <div className="py-8 overflow-auto flex justify-center no-print-bg">
                    <div id="printable-content">
                        <PrintLayout title={selectedTemplate.title} employee={employee}>
                            {selectedTemplate.content(employee, templateData)}
                        </PrintLayout>
                    </div>
                </div>
            </div>
        );
    }
    
    
    // --- 2. وضع إدخال البيانات (الفورم) ---
    if (viewMode === 'form' && selectedTemplate) {
        return (
            <div className="max-w-2xl mx-auto py-10 px-4 animate-in slide-in-from-bottom duration-300">
                <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-100 overflow-hidden">
                    <div className="bg-emerald-50 p-6 border-b border-emerald-100 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-black text-gray-800 mb-1">{selectedTemplate.title}</h3>
                            <p className="text-xs text-emerald-600 font-bold">يرجى ملء البيانات الناقصة لإنشاء النموذج</p>
                        </div>
                        <div className="p-3 bg-white rounded-2xl shadow-sm">
                            {selectedTemplate.icon}
                        </div>
                    </div>
                    
                    <div className="p-8 space-y-6">
                        {selectedTemplate.fields.map((field) => (
                            <div key={field.key} className="space-y-2">
                                <label className="block text-sm font-bold text-gray-700">{field.label}</label>
                                <input
                                    type={field.type}
                                    placeholder={field.placeholder}
                                    value={templateData[field.key] || ''}
                                    onChange={(e) => setTemplateData({ ...templateData, [field.key]: e.target.value })}
                                    className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-emerald-500 outline-none transition-all font-bold text-gray-800 bg-gray-50 focus:bg-white"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-gray-50 border-t flex gap-4">
                        <button onClick={() => setViewMode('list')} className="flex-1 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors">
                            إلغاء
                        </button>
                        <button 
                            onClick={() => setViewMode('print')} 
                            className="flex-[2] py-3 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex justify-center items-center gap-2"
                        >
                            <FileText className="w-5 h-5"/> إنشاء النموذج للمعاينة
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- 3. وضع القائمة الرئيسية (List) ---
    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500 p-2">
            <div className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl"><Printer className="w-6 h-6" /></div>
                        النماذج الرسمية
                    </h3>
                    <div className="text-sm font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-lg border">
                        {filteredTemplates.length} نموذج
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative w-full">
                        <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="ابحث..." 
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTemplates.map((tmpl) => (
                    <button 
                        key={tmpl.id} 
                        onClick={() => handleSelectTemplate(tmpl)} 
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
                                <p className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                    <PenTool className="w-3 h-3"/> اضغط لملء البيانات
                                </p>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
