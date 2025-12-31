import React, { useState } from 'react';
import { Search, Printer, ArrowRight, ArrowLeft } from 'lucide-react';
import { OFFICIAL_TEMPLATES } from '../../../data/OfficialTemplates';
import { Employee } from '../../../types';

export default function StaffTemplatesTab({ employee }: { employee: Employee }) {
    const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('الكل');

    const categories = ['الكل', ...Array.from(new Set(OFFICIAL_TEMPLATES.map((t: any) => t.category)))];

    const filteredTemplates = OFFICIAL_TEMPLATES.filter((tmpl: any) => 
        (filterCategory === 'الكل' || tmpl.category === filterCategory) &&
        (tmpl.title.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handlePrint = () => setTimeout(() => window.print(), 100);

    // عرض النموذج المختار للطباعة
    if (selectedTemplate) {
        return (
            <div className="animate-in fade-in duration-300">
                {/* شريط التحكم العلوي - يختفي عند الطباعة */}
                <div className="flex justify-between items-center mb-8 no-print border-b pb-4">
                    <button onClick={() => setSelectedTemplate(null)} className="flex items-center text-gray-500 font-bold hover:text-emerald-600 gap-2">
                        <ArrowRight className="w-5 h-5"/> عودة للقائمة
                    </button>
                    <button onClick={handlePrint} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700">
                        <Printer className="w-5 h-5"/> طباعة النموذج
                    </button>
                </div>

                {/* ورقة الطباعة A4 */}
                <div className="print-paper mx-auto bg-white p-8 md:p-12 max-w-[210mm] min-h-[297mm] relative text-black print:w-full print:max-w-none print:p-8 print:m-0 shadow-2xl print:shadow-none flex flex-col" dir="rtl">
                    
                    {/* الترويسة (Header) */}
                    <div className="flex justify-between items-start border-b-4 border-double border-gray-800 pb-6 mb-8 shrink-0">
                        {/* الجهة الإدارية (يمين) */}
                        <div className="w-1/3 text-right font-bold text-base space-y-1">
                            <p>مديرية الشئون الصحية بالجيزة</p>
                            <p>إدارة شمال الجيزة الصحية</p>
                            <p>مركز غرب المطار</p>
                        </div>

                        {/* عنوان النموذج (وسط) */}
                        <div className="w-1/3 text-center self-center pt-4">
                             <h1 className="text-xl md:text-2xl font-black underline decoration-2 underline-offset-8 inline-block px-4 py-2 border-2 border-black rounded-lg bg-gray-50">
                                {selectedTemplate.title}
                            </h1>
                        </div>

                        {/* شعار الوزارة أو مساحة فارغة (يسار) */}
                        <div className="w-1/3 text-left flex justify-end">
                           <img 
                             src="https://upload.wikimedia.org/wikipedia/ar/thumb/a/a2/Logo_Ministry_of_Health_and_Population_%28Egypt%29.svg/1200px-Logo_Ministry_of_Health_and_Population_%28Egypt%29.svg.png" 
                             alt="Logo" 
                             className="w-20 h-20 object-contain grayscale opacity-80"
                           />
                        </div>
                    </div>

                    {/* محتوى النموذج المتغير */}
                    <div className="flex-grow text-justify font-medium px-2 py-4">
                        {selectedTemplate.content(employee)}
                    </div>

                    {/* التذييل (Footer) - التوقيعات */}
                    <div className="mt-auto pt-12 break-inside-avoid shrink-0">
                        <div className="flex justify-between items-start text-center text-lg">
                            {/* اليمين: يعتمد مدير المركز */}
                            <div className="flex flex-col items-center gap-16 w-1/3">
                                <div className="font-black underline underline-offset-4">يعتمد مدير المركز</div>
                                <div className="font-medium text-gray-400">............................</div>
                            </div>

                            {/* اليسار: رئيس شئون العاملين */}
                            <div className="flex flex-col items-center gap-4 w-1/3">
                                <div className="font-black underline underline-offset-4">رئيس شئون العاملين</div>
                                <div className="mt-12 w-full border-b border-dotted border-gray-400"></div>
                                <div className="text-sm font-bold opacity-0 print:opacity-0">.</div>
                            </div>
                        </div>

                        {/* سطر المعلومات السفلي */}
                        <div className="mt-12 text-center text-sm text-gray-500 border-t pt-2 flex justify-between px-8">
                             <span>تحريراً في: <span className="font-mono text-black font-bold mx-2">{new Date().toLocaleDateString('ar-EG')}</span></span>
                             <span>مقدم الطلب: <span className="text-black font-bold mx-2">{employee.name}</span></span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // واجهة اختيار النموذج
    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500 no-print">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-b pb-4">
                <Printer className="text-emerald-600 w-7 h-7" /> نماذج رسمية
            </h3>
            
            <div className="bg-gray-50 p-6 rounded-3xl border flex flex-col md:flex-row gap-4 items-center">
                <div className="relative w-full">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="ابحث عن نموذج..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full pr-12 pl-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 bg-white" 
                    />
                </div>
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 custom-scrollbar">
                    {categories.map(cat => (
                        <button 
                            key={cat} 
                            onClick={() => setFilterCategory(cat)} 
                            className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-500 border hover:bg-emerald-50'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((tmpl: any) => (
                    <button 
                        key={tmpl.id} 
                        onClick={() => setSelectedTemplate(tmpl)} 
                        className="p-6 bg-white border-2 border-gray-100 rounded-3xl hover:border-emerald-500 hover:shadow-lg transition-all text-right group flex flex-col items-start gap-4"
                    >
                        <div className="flex justify-between w-full items-start">
                            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors border border-gray-100">
                                {tmpl.icon}
                            </div>
                            <span className="text-[10px] bg-gray-100 px-3 py-1 rounded-full text-gray-500 font-bold group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors">
                                {tmpl.category}
                            </span>
                        </div>
                        <div className="space-y-1 w-full">
                            <h4 className="font-black text-lg text-gray-800 group-hover:text-emerald-600 transition-colors">
                                {tmpl.title}
                            </h4>
                            <div className="flex justify-between items-center mt-2">
                                <p className="text-xs text-gray-400 font-bold">اضغط للعرض والطباعة</p>
                                <ArrowLeft className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 group-hover:-translate-x-1 transition-all"/>
                            </div>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
