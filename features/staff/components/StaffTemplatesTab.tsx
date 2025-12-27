import React, { useState } from 'react';
import { OFFICIAL_TEMPLATES } from '../../../data/OfficialTemplates'; // تأكد من مسار البيانات
import { Search, Printer, ArrowRight, FileCheck } from 'lucide-react';
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

    if (selectedTemplate) {
        return (
            <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-8 no-print border-b pb-4">
                    <button onClick={() => setSelectedTemplate(null)} className="flex items-center text-gray-500 font-bold hover:text-emerald-600 gap-2">
                        <ArrowRight className="w-5 h-5"/> عودة للقائمة
                    </button>
                    <button onClick={handlePrint} className="bg-emerald-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:bg-emerald-700">
                        <Printer className="w-5 h-5"/> طباعة النموذج
                    </button>
                </div>
                {/* ورقة الطباعة A4 */}
                <div className="print-paper mx-auto bg-white p-12 max-w-[210mm] min-h-[297mm] relative text-black print:w-full print:max-w-none print:p-0">
                    <div className="flex justify-between items-start border-b-4 border-black pb-6 mb-12">
                        <div className="text-center space-y-2"><h2 className="font-black text-xl">مديرية الشئون الصحية</h2><h3 className="font-bold text-lg">المركز الطبي</h3></div>
                        <div className="w-24 h-24 flex items-center justify-center opacity-80"><img src="https://upload.wikimedia.org/wikipedia/ar/thumb/a/a2/Logo_Ministry_of_Health_and_Population_%28Egypt%29.svg/1200px-Logo_Ministry_of_Health_and_Population_%28Egypt%29.svg.png" alt="MOH" className="w-20 object-contain grayscale" /></div>
                        <div className="text-center space-y-2"><h2 className="font-black text-xl">Ministry of Health</h2><h3 className="font-bold text-lg">Medical Center</h3></div>
                    </div>
                    <div className="text-center my-16"><h1 className="text-3xl font-black underline decoration-2 underline-offset-8 border-2 border-black inline-block px-8 py-2 rounded-lg">{selectedTemplate.title}</h1></div>
                    <div className="text-2xl leading-[3] text-justify font-medium px-4 whitespace-pre-line min-h-[400px]">{selectedTemplate.content(employee)}</div>
                    <div className="mt-20 grid grid-cols-2 gap-20 text-center text-lg break-inside-avoid">
                        <div className="space-y-24"><div className="space-y-2"><p className="font-black underline">توقيع الموظف</p><p className="text-sm font-bold">{employee.name}</p></div></div>
                        <div className="space-y-24"><div className="space-y-2"><p className="font-black underline">مدير المركز الطبي</p><p className="mt-8">............................</p></div></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom duration-500 no-print">
            <h3 className="text-2xl font-black flex items-center gap-3 text-gray-800 border-b pb-4"><Printer className="text-emerald-600 w-7 h-7" /> نماذج رسمية</h3>
            <div className="bg-gray-50 p-6 rounded-3xl border flex flex-col md:flex-row gap-4 items-center">
                <div className="relative w-full">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type="text" placeholder="ابحث..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-12 pl-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                </div>
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
                    {categories.map(cat => (
                        <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${filterCategory === cat ? 'bg-emerald-600 text-white shadow-md' : 'bg-white text-gray-500 border hover:bg-emerald-50'}`}>{cat}</button>
                    ))}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTemplates.map((tmpl: any) => (
                    <button key={tmpl.id} onClick={() => setSelectedTemplate(tmpl)} className="p-6 bg-white border-2 border-gray-100 rounded-3xl hover:border-emerald-500 hover:shadow-lg transition-all text-right group flex flex-col items-start gap-4">
                        <div className="flex justify-between w-full items-start">
                            <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-50 transition-colors border border-gray-100">{tmpl.icon}</div>
                            <span className="text-[10px] bg-gray-100 px-3 py-1 rounded-full text-gray-500 font-bold">{tmpl.category}</span>
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-black text-lg text-gray-800 group-hover:text-emerald-600 transition-colors">{tmpl.title}</h4>
                            <p className="text-xs text-gray-400 font-bold">اضغط للطباعة</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}