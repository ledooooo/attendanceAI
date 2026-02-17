import React, { useState } from 'react';
import { Employee } from '../../../types';
import { 
    Syringe, Fingerprint, FileText, ChevronRight, LayoutDashboard, 
    Users, FileSignature, ArrowRight, ShieldAlert, BookOpen, FileX, Box, BarChart3
} from 'lucide-react';

// استيراد المكونات السبعة
import StaffEmployeeManager from './admin_tools/StaffEmployeeManager';
import StaffAttendanceManager from './admin_tools/StaffAttendanceManager';
import StaffVaccineManager from './admin_tools/StaffVaccineManager';
import StaffRequestsManager from './admin_tools/StaffRequestsManager';
import StaffOVRManager from './admin_tools/StaffOVRManager';
import TrainingManager from './admin_tools/TrainingManager';
import StaffAbsenceManager from './admin_tools/StaffAbsenceManager'; 

// استيراد المكونات الإضافية من مجلد الإدارة
import AssetsManager from '../../admin/components/AssetsManager'; 
import StatisticsManager from '../../admin/components/StatisticsManager'; // ✅ استيراد صفحة الإحصائيات

export default function AdministrationTab({ employee }: { employee: Employee }) {
    const [activeTool, setActiveTool] = useState<string | null>(null);

    // ✅ خريطة الصلاحيات الكاملة (تمت إضافة statistics_manager)
    const TOOLS_CONFIG: any = {
        'reports': { 
            id: 'reports',
            label: 'إدارة بيانات الموظفين',
            icon: <Users className="w-8 h-8 text-emerald-600"/>,
            color: 'bg-emerald-50 border-emerald-100',
            component: <StaffEmployeeManager currentUser={employee} />
        },
        'attendance': { 
            id: 'attendance',
            label: 'إدارة البصمة والتقارير',
            icon: <Fingerprint className="w-8 h-8 text-purple-600"/>,
            color: 'bg-purple-50 border-purple-100',
            component: <StaffAttendanceManager />
        },
        'vaccinations': { 
            id: 'vaccinations',
            label: 'سجل التطعيمات',
            icon: <Syringe className="w-8 h-8 text-blue-600"/>,
            color: 'bg-blue-50 border-blue-100',
            component: <StaffVaccineManager />
        },
        'leaves': { 
            id: 'leaves',
            label: 'مراجعة طلبات الموظفين',
            icon: <FileSignature className="w-8 h-8 text-orange-600"/>,
            color: 'bg-orange-50 border-orange-100',
            component: <StaffRequestsManager />
        },
        'quality': { 
            id: 'quality',
            label: 'تقارير OVR',
            icon: <ShieldAlert className="w-8 h-8 text-red-600"/>,
            color: 'bg-red-50 border-red-100',
            component: <StaffOVRManager />
        },
        'training_manager': { 
            id: 'training_manager',
            label: 'إدارة التدريب والتعليم المستمر',
            icon: <BookOpen className="w-8 h-8 text-indigo-600"/>,
            color: 'bg-indigo-50 border-indigo-100',
            component: <TrainingManager />
        },
        'absence': {
            id: 'absence',
            label: 'تقارير الغياب',
            icon: <FileX className="w-8 h-8 text-rose-600"/>,
            color: 'bg-rose-50 border-rose-100',
            component: <StaffAbsenceManager />
        },
        'assets_manager': {
            id: 'assets_manager',
            label: 'إدارة العهد والأصول',
            icon: <Box className="w-8 h-8 text-cyan-600"/>,
            color: 'bg-cyan-50 border-cyan-100',
            component: <AssetsManager />
        },
        // ✅ إضافة تبويب إحصائيات العمل
        'statistics_manager': {
            id: 'statistics_manager',
            label: 'إدخال إحصائيات العمل',
            icon: <BarChart3 className="w-8 h-8 text-pink-600"/>,
            color: 'bg-pink-50 border-pink-100',
            component: <StatisticsManager />
        }
    };

    // إضافة 'statistics_manager' كصلاحية صريحة إذا كانت can_manage_statistics = true
    const userPermissions = [...(employee.permissions || [])];
    if (employee.can_manage_statistics && !userPermissions.includes('statistics_manager')) {
        userPermissions.push('statistics_manager');
    }
    
    // إذا كان Admin يرى كل شيء، وإلا يرى فقط الصلاحيات الممنوحة له
    const allowedTools = employee.role === 'admin' 
        ? Object.keys(TOOLS_CONFIG) 
        : Object.keys(TOOLS_CONFIG).filter(key => userPermissions.includes(key));

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
                        if (!tool) return null; // حماية ضد الأخطاء
                        
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
