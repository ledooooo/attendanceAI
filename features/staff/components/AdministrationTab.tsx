import React, { useState } from 'react';
import { Employee } from '../../../types';
import { supabase } from '../../../supabaseClient';
import { useQuery } from '@tanstack/react-query';
import { Syringe, Fingerprint, FileText, ChevronRight, LayoutDashboard, Loader2, ArrowRight } from 'lucide-react';

// ✅ 1. استيراد مكونات الأدمن الموجودة بالفعل
import VaccinationsTab from '../../admin/components/VaccinationsTab';
import DoctorsTab from '../../admin/components/DoctorsTab';
import AttendanceTab from '../../admin/components/AttendanceTab'; 

export default function AdministrationTab({ employee }: { employee: Employee }) {
    const [activeTool, setActiveTool] = useState<string | null>(null);

    // ✅ 2. جلب داتا كل الموظفين (لأن صفحات الأدمن تحتاجها)
    // لن يتم الجلب إلا إذا فتح الموظف هذا التبويب
    const { data: allEmployees = [], isLoading, refetch } = useQuery({
        queryKey: ['admin_access_employees'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('employees')
                .select('*')
                .neq('role', 'admin'); // جلب الجميع ما عدا المديرين (اختياري)
            if (error) throw error;
            return data as Employee[];
        },
        // تفعيل الجلب فقط إذا كان للموظف صلاحيات
        enabled: (employee.permissions && employee.permissions.length > 0)
    });

    // تعريف الأدوات وربطها بالمكونات الحقيقية
    const TOOLS_CONFIG: any = {
        'vaccinations': {
            id: 'vaccinations',
            label: 'إدارة التطعيمات',
            icon: <Syringe className="w-8 h-8 text-blue-600"/>,
            color: 'bg-blue-50 border-blue-100',
            // ✅ تمرير الداتا للمكون الموجود بالفعل
            component: <VaccinationsTab employees={allEmployees} /> 
        },
        'attendance': {
            id: 'attendance',
            label: 'إدارة البصمة',
            icon: <Fingerprint className="w-8 h-8 text-purple-600"/>,
            color: 'bg-purple-50 border-purple-100',
            // ✅ هنا تضع مكون رفع البصمة الخاص بالأدمن
            // مثال:
            // component: <AttendanceAdminTab /> 
            component: <div className="text-center p-10 text-gray-500">يرجى استبدال هذا السطر بمكون رفع البصمة الموجود في لوحة الأدمن (AttendanceTab)</div>
        },
        'reports': {
            id: 'reports',
            label: 'شئون الموظفين والتقارير',
            icon: <FileText className="w-8 h-8 text-emerald-600"/>,
            color: 'bg-emerald-50 border-emerald-100',
            // ✅ إعادة استخدام DoctorsTab بالكامل (بحث، طباعة، فلترة)
            component: <DoctorsTab employees={allEmployees} onRefresh={refetch} centerId={employee.center_id} />
        }
    };

    const userPermissions = employee.permissions || [];
    const allowedTools = Object.keys(TOOLS_CONFIG).filter(key => userPermissions.includes(key));

    // شاشة تحميل أثناء جلب بيانات الموظفين
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-gray-500 font-bold">جاري تحميل بيانات النظام...</p>
            </div>
        );
    }

    // --- 1. عرض الأداة المختارة (Detail View) ---
    if (activeTool) {
        const tool = TOOLS_CONFIG[activeTool];
        return (
            <div className="animate-in slide-in-from-left duration-300 min-h-screen pb-20 bg-gray-50">
                {/* Header خاص بالأداة */}
                <div className="bg-white p-4 sticky top-0 z-10 border-b flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setActiveTool(null)}
                            className="p-2 rounded-full hover:bg-gray-100 transition-colors bg-gray-50"
                        >
                            <ArrowRight className="w-5 h-5 text-gray-700" />
                        </button>
                        <h2 className="font-black text-lg text-gray-800">{tool.label}</h2>
                    </div>
                </div>
                
                {/* محتوى الأداة (المكون الأصلي للأدمن) */}
                <div className="p-2 md:p-6">
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
                    <p className="text-sm text-gray-400 font-bold">أهلاً بك، لديك {allowedTools.length} صلاحيات إدارية</p>
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
                                className={`p-6 rounded-[2rem] border-2 text-right transition-all transform active:scale-95 hover:shadow-xl flex items-center justify-between group ${tool.color}`}
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
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-300">
                    <LayoutDashboard className="w-12 h-12 text-gray-200 mb-4"/>
                    <p className="text-gray-400 font-bold">لا توجد صلاحيات إدارية محددة لك.</p>
                    <p className="text-xs text-gray-300 mt-2">راجع مدير النظام لمنحك الصلاحيات</p>
                </div>
            )}
        </div>
    );
}
