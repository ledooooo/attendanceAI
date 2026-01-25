// components/templates/PrintLayout.tsx
import React from 'react';
import { Employee } from '../../types';

interface PrintLayoutProps {
  title: string;
  employee: Employee;
  children: React.ReactNode;
}

export const PrintLayout = ({ title, employee, children }: PrintLayoutProps) => {
  return (
    <div className="print-paper mx-auto bg-white p-12 max-w-[210mm] min-h-[297mm] relative text-black shadow-2xl flex flex-col font-serif" dir="rtl">
      
      {/* الترويسة الثابتة */}
      <div className="flex justify-between items-start border-b-4 border-double border-gray-800 pb-6 mb-8 shrink-0">
        <div className="w-1/3 text-right font-bold text-base space-y-1">
          <p>مديرية الشئون الصحية بالجيزة</p>
          <p>إدارة شمال الجيزة الصحية</p>
          <p>مركز غرب المطار</p>
        </div>
        <div className="w-1/3 text-center self-center pt-4">
           <h1 className="text-2xl font-black underline decoration-2 underline-offset-8 inline-block px-6 py-2 border-2 border-black rounded-lg bg-gray-50">
             {title}
           </h1>
        </div>
        <div className="w-1/3 text-left flex justify-end">
           {/* يمكنك وضع الشعار هنا */}
           <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-full flex items-center justify-center text-xs text-gray-400 font-bold">
             شعار الوزارة
           </div>
        </div>
      </div>

      {/* محتوى القالب المتغير */}
      <div className="flex-grow text-justify text-lg leading-loose px-4">
        {children}
      </div>

      {/* التذييل الثابت */}
      <div className="mt-auto pt-16 break-inside-avoid shrink-0">
        <div className="flex justify-between items-start text-center text-xl font-bold">
           <div className="flex flex-col items-center gap-16 w-1/3">
             <div className="underline underline-offset-4">يعتمد مدير المركز</div>
             <div className="text-gray-400 font-normal">............................</div>
           </div>
           <div className="flex flex-col items-center gap-16 w-1/3">
             <div className="underline underline-offset-4">رئيس شئون العاملين</div>
             <div className="text-gray-400 font-normal">............................</div>
           </div>
        </div>
        <div className="mt-8 text-center text-sm text-gray-500 border-t border-gray-400 pt-2 flex justify-between px-2">
           <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</span>
           <span>كود الموظف: {employee.employee_id}</span>
        </div>
      </div>
    </div>
  );
};
