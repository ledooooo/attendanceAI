import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Input } from '../../../components/ui/FormElements';
import { Settings, Save, MapPin, Trash2, Plus } from 'lucide-react';

export default function SettingsTab({ settings, onRefresh }: { settings: any, onRefresh: () => void }) {
    const [centers, setCenters] = useState<any[]>(settings?.centers || []);
    const [newCenter, setNewCenter] = useState({ id: '', name: '', password: '' });

    const handleSaveCenters = async () => {
        const { error } = await supabase.from('general_settings').update({ centers }).eq('id', settings.id);
        if (error) alert('خطأ في الحفظ');
        else {
            alert('تم حفظ إعدادات المراكز');
            onRefresh();
        }
    };

    const addCenter = () => {
        if (!newCenter.id || !newCenter.name) return alert('أكمل البيانات');
        setCenters([...centers, { ...newCenter }]);
        setNewCenter({ id: '', name: '', password: '' });
    };

    const removeCenter = (idx: number) => {
        if (confirm('حذف هذا المركز؟')) {
            const newC = [...centers];
            newC.splice(idx, 1);
            setCenters(newC);
        }
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-black flex items-center gap-2"><Settings className="w-6 h-6"/> إعدادات النظام</h2>
            
            <div className="bg-white p-6 rounded-3xl border shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-600"/> إدارة المراكز الطبية</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 bg-gray-50 p-4 rounded-xl">
                    <Input label="كود المركز" value={newCenter.id} onChange={(v:any)=>setNewCenter({...newCenter, id:v})} />
                    <Input label="اسم المركز" value={newCenter.name} onChange={(v:any)=>setNewCenter({...newCenter, name:v})} />
                    <Input label="كلمة مرور (للدخول القديم)" value={newCenter.password} onChange={(v:any)=>setNewCenter({...newCenter, password:v})} />
                    <button onClick={addCenter} className="md:col-span-3 bg-blue-600 text-white py-2 rounded-xl font-bold flex items-center justify-center gap-2"><Plus className="w-4 h-4"/> إضافة مركز</button>
                </div>

                <div className="space-y-2">
                    {centers.map((c: any, i: number) => (
                        <div key={i} className="flex justify-between items-center p-3 border rounded-xl hover:bg-gray-50">
                            <div>
                                <p className="font-bold">{c.name}</p>
                                <p className="text-xs text-gray-500">Code: {c.id}</p>
                            </div>
                            <button onClick={() => removeCenter(i)} className="text-red-500 bg-red-50 p-2 rounded-lg hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>
                
                <button onClick={handleSaveCenters} className="mt-6 w-full bg-emerald-600 text-white py-3 rounded-xl font-black shadow-lg flex justify-center gap-2"><Save className="w-5 h-5"/> حفظ التغييرات</button>
            </div>
        </div>
    );
}