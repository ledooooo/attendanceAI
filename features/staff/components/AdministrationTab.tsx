import React, { useState } from 'react';
import { Employee } from '../../../types';
import { 
    Syringe, Fingerprint, FileText, ChevronRight, LayoutDashboard, 
    Users, FileSignature, ArrowRight, ShieldAlert, BookOpen // ✅ استيراد BookOpen
} from 'lucide-react';

// استيراد المكونات الجديدة المخصصة للموظف
import StaffEmployeeManager from './admin_tools/StaffEmployeeManager';
import StaffAttendanceManager from './admin_tools/StaffAttendanceManager';
import StaffVaccineManager from './admin_tools/StaffVaccineManager';
import StaffRequestsManager from './admin_tools/StaffRequestsManager';
import StaffOVRManager from './admin_tools/StaffOVRManager';
import TrainingManager from './admin_tools/TrainingManager'; // ✅ استيراد صفحة التدريب الجديدة

export default function AdministrationTab({ employee }: { employee: Employee }) {
    const [activeTool, setActiveTool] = useState<string | null>(null);

    // تعريف الأدوات (يظهر فقط ما لديه صلاحية له)
    const TOOLS_CONFIG: any = {
        'reports': { // صلاحية شئون العاملين
            id: 'reports',
            label: 'إدارة بيانات الموظفين',
            icon: <Users className="w-8 h-8 text-emerald-600"/>,
            color: 'bg-emerald-50 border-emerald-100',
            component: <StaffEmployeeManager currentUser={employee} />
        },
        'attendance': { // صلاحية البصمة
            id: 'attendance',
            label: 'إدخال البصمة والتقارير',
            icon: <Fingerprint className="w-8 h-8 text-purple-600"/>,
            color: 'bg-purple-50 border-purple-100',
            component: <StaffAttendanceManager />
        },
        'vaccinations': { // صلاحية التطعيمات
            id: 'vaccinations',
            label: 'سجل التطعيمات',
            icon: <Syringe className="w-8 h-8 text-blue-600"/>,
            color: 'bg-blue-50 border-blue-100',
            component: <StaffVaccineManager />
        },
        'leaves': { // صلاحية الطلبات
            id: 'leaves',
            label: 'مراجعة طلبات الموظفين',
            icon: <FileSignature className="w-8 h-8 text-orange-600"/>,
            color: 'bg-orange-50 border-orange-100',
            component: <StaffRequestsManager />
        },
        'quality': { // صلاحية الجودة
            id: 'quality',
            label: 'تقارير OVR',
            icon: <ShieldAlert className="w-8 h-8 text-red-600"/>,
            color: 'bg-red-50 border-red-100',
            component: <StaffOVRManager />
        },
        // ✅ تمت إضافة قسم التدريب
        'training_manager': { 
            id: 'training_manager',
            label: 'إدارة التدريب والتعليم المستمر',
            icon: <BookOpen className="w-8 h-8 text-indigo-600"/>,
            color: 'bg-indigo-50 border-indigo-100',
            component: <TrainingManager />
        }
    };

    const userPermissions = employee.permissions || [];
    const allowedTools = Object.keys(TOOLS_CONFIG).filter(key => userPermissions.includes(key));

    // وضع عرض الأداة
    if (activeTool) {
        const tool = TOOLS_CONFIG[activeTool];
        return (
            <div className="animate-in slide-in-from-left duration-300 min-h-screen pb-20 bg-gray-50">
                <div className="bg-white p-4 sticky top-0 z-10 border-b flex items-center gap-3 shadow-sm no-print">
                    <button onClick={() => setActiveTool(null)} className="p-2 rounded-full hover:bg-gray-100 bg-gray-50">
                        <ArrowRight className="w-5 h-5 text-gray-700" />
                    </button>
                    <h2 className="font-black text-lg text-gray-800">{tool.label}</h2>
                </div>
                <div className="p-4">
                    {tool.component}
                </div>
            </div>
        );
    }

    // القائمة الرئيسية
    return (
        <div className="p-6 space-y-6 animate-in fade-in pb-24">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-indigo-600 rounded-2xl text-white shadow-lg">
                    <LayoutDashboard className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-black text-gray-800">أدوات الإدارة المفوضة</h2>
                    <p className="text-sm text-gray-400 font-bold">لديك صلاحية الوصول لـ {allowedTools.length} قسم</p>
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
                <div className="text-center py-20 text-gray-400">لا توجد صلاحيات لعرضها.</div>
            )}
        </div>
    );
}
