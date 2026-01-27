import React, { useState } from 'react';
import { Employee } from '../../../types';
import { Syringe, Fingerprint, FileText, ChevronRight, LayoutDashboard } from 'lucide-react';

// استيراد المكونات التي قمنا ببرمجتها سابقاً
import VaccinationsTab from '../../admin/components/VaccinationsTab';
// import AttendanceUploader from ... (مكون البصمة المستقبلي)
// import ReportsTab from ... (مكون التقارير المستقبلي)

export default function AdministrationTab({ employee }: { employee: Employee }) {
    // حالة لتخزين "ما هي الأداة المفتوحة حالياً؟"
    const [activeTool, setActiveTool] = useState<string | null>(null);

    // تعريف الأدوات وربطها بالصلاحيات
    const TOOLS_CONFIG: any = {
        'vaccinations': {
            id: 'vaccinations',
            label: 'إدارة التطعيمات',
            icon: <Syringe className="w-8 h-8 text-blue-600"/>,
            color: 'bg-blue-50 border-blue-100',
            component: <VaccinationsTab employees={[]} /> // ⚠️ سنحتاج لتمرير بيانات الموظفين هنا لاحقاً
        },
        'attendance': {
            id: 'attendance',
            label: 'رفع البصمة',
            icon: <Fingerprint className="w-8 h-8 text-purple-600"/>,
            color: 'bg-purple-50 border-purple-100',
            component: <div className="p-10 text-center">صفحة رفع البصمة (قيد التطوير)</div>
        },
        'reports': {
            id: 'reports',
            label: 'التقارير والبيانات',
            icon: <FileText className="w-8 h-8 text-emerald-600"/>,
            color: 'bg-emerald-50 border-emerald-100',
            component: <div className="p-10 text-center">صفحة التقارير (قيد التطوير)</div>
        }
    };

    // استخراج الصلاحيات المخزنة في قاعدة البيانات
    const userPermissions = employee.permissions || []; // مثال: ["vaccinations", "reports"]

    // تصفية الأدوات المسموح بها فقط
    const allowedTools = Object.keys(TOOLS_CONFIG).filter(key => userPermissions.includes(key));

    // --- 1. عرض الأداة المختارة (Detail View) ---
    if (activeTool) {
        const tool = TOOLS_CONFIG[activeTool];
        return (
            <div className="animate-in slide-in-from-left duration-300 min-h-screen pb-20">
                {/* شريط علوي للرجوع */}
                <div className="bg-white p-4 sticky top-0 z-10 border-b flex items-center gap-2 shadow-sm">
                    <button 
                        onClick={() => setActiveTool(null)}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <ChevronRight className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="font-bold text-lg text-gray-800">{tool.label}</h2>
                </div>
                
                {/* محتوى الأداة */}
                <div className="p-4">
                    {tool.component}
                </div>
            </div>
        );
    }

    // --- 2. عرض القائمة الرئيسية (Grid View) ---
    return (
        <div className="p-6 space-y-6 animate-in fade-in pb-24">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-200">
                    <LayoutDashboard className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-800">لوحة الإدارة</h2>
                    <p className="text-sm text-gray-400 font-bold">صلاحيات خاصة: {employee.name}</p>
                </div>
            </div>

            {allowedTools.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {allowedTools.map(key => {
                        const tool = TOOLS_CONFIG[key];
                        return (
                            <button
                                key={key}
                                onClick={() => setActiveTool(key)}
                                className={`p-6 rounded-[2rem] border-2 text-right transition-all transform active:scale-95 hover:shadow-lg flex items-center justify-between group ${tool.color}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="bg-white p-4 rounded-2xl shadow-sm group-hover:scale-110 transition-transform">
                                        {tool.icon}
                                    </div>
                                    <span className="font-black text-lg text-gray-700">{tool.label}</span>
                                </div>
                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:-translate-x-1 transition-transform"/>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
                    <p className="text-gray-400 font-bold">لا توجد صلاحيات إدارية محددة لك.</p>
                </div>
            )}
        </div>
    );
}
