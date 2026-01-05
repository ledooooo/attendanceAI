import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Plus, Trash2, Edit3, Save, X } from 'lucide-react';

export default function AdminDocuments() {
    const [docs, setDocs] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ title: '', file_type: 'PDF', department: '', file_url: '', category: 'policy' });

    useEffect(() => { fetchDocs(); }, []);

    const fetchDocs = async () => {
        const { data } = await supabase.from('company_documents').select('*');
        if (data) setDocs(data);
    };

    const handleSave = async () => {
        const { error } = await supabase.from('company_documents').insert([formData]);
        if (!error) {
            fetchDocs();
            setIsModalOpen(false);
            setFormData({ title: '', file_type: 'PDF', department: '', file_url: '', category: 'policy' });
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('هل أنت متأكد من حذف هذا الملف؟')) {
            await supabase.from('company_documents').delete().eq('id', id);
            fetchDocs();
        }
    };

    return (
        <div className="p-6 text-right" dir="rtl">
            <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black">إدارة المستندات والسياسات</h2>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-emerald-600 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-emerald-100"
                >
                    <Plus size={20} /> إضافة ملف جديد
                </button>
            </div>

            {/* جدول الإدارة */}
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500">
                        <tr>
                            <th className="p-4 text-right">اسم الملف</th>
                            <th className="p-4 text-right">القسم</th>
                            <th className="p-4 text-right">النوع</th>
                            <th className="p-4 text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {docs.map(doc => (
                            <tr key={doc.id} className="hover:bg-gray-50/50">
                                <td className="p-4 font-bold text-gray-700">{doc.title}</td>
                                <td className="p-4 text-gray-500">{doc.department}</td>
                                <td className="p-4"><span className="bg-gray-100 px-2 py-1 rounded text-[10px] font-bold">{doc.file_type}</span></td>
                                <td className="p-4 flex justify-center gap-2">
                                    <button onClick={() => handleDelete(doc.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* مودال الإضافة */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-black mb-6">إضافة مستند جديد</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="اسم الملف" className="w-full p-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-100" onChange={e => setFormData({...formData, title: e.target.value})} />
                            <input type="text" placeholder="القسم (مثلاً: شئون العاملين)" className="w-full p-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-100" onChange={e => setFormData({...formData, department: e.target.value})} />
                            <select className="w-full p-3 bg-gray-50 rounded-2xl outline-none" onChange={e => setFormData({...formData, file_type: e.target.value})}>
                                <option value="PDF">PDF</option>
                                <option value="Word">Word</option>
                                <option value="Excel">Excel</option>
                                <option value="HTML">HTML</option>
                            </select>
                            <input type="text" placeholder="رابط الملف (Google Drive Link)" className="w-full p-3 bg-gray-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-emerald-100" onChange={e => setFormData({...formData, file_url: e.target.value})} />
                        </div>
                        <div className="flex gap-2 mt-8">
                            <button onClick={handleSave} className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl font-black">حفظ الملف</button>
                            <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 bg-gray-100 text-gray-500 rounded-2xl font-black">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
