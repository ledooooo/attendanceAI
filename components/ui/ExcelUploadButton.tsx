import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload } from 'lucide-react';

export const ExcelUploadButton = ({ onData, label = 'رفع ملف Excel' }: { onData: (data: any[]) => void, label?: string }) => {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      onData(data);
    };
    reader.readAsBinaryString(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <input type="file" ref={fileRef} onChange={handleFile} className="hidden" accept=".xlsx, .xls" />
      <button 
        onClick={() => fileRef.current?.click()} 
        className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-sm text-sm"
      >
        <Upload className="w-4 h-4"/> {label}
      </button>
    </>
  );
};

export const downloadSample = (type: string) => {
    // دالة تحميل العينات (يمكنك وضع روابط حقيقية هنا)
    alert(`سيتم تحميل نموذج عينة لـ: ${type}`);
};