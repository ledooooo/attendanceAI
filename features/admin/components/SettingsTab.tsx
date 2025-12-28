import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Input } from '../../../components/ui/FormElements';
import { Save, Building, Link as LinkIcon, Plus, Trash2, Loader2 } from 'lucide-react';

export default function SettingsTab({ onUpdateName }: { onUpdateName?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    center_name: '',
    work_start_time: '08:00',
    work_end_time: '14:00',
    lateness_grace_minutes: 15,
    location_lat: 0.0,
    location_lng: 0.0,
    allowed_distance_meters: 50,
    annual_leave_days: 21,
    casual_leave_days: 7,
    links_names: [] as string[],
    links_urls: [] as string[]
  });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('general_settings').select('*').limit(1).maybeSingle();
      if (data) {
        setSettingsId(data.id);
        setFormData({
            ...data,
            links_names: data.links_names || [],
            links_urls: data.links_urls || []
        });
      }
    } finally { setLoading(false); }
  };

  // دوال التعامل مع الروابط
  const addLink = () => {
      setFormData(prev => ({
          ...prev,
          links_names: [...prev.links_names, ''],
          links_urls: [...prev.links_urls, '']
      }));
  };

  const removeLink = (index: number) => {
      const newNames = [...formData.links_names];
      const newUrls = [...formData.links_urls];
      newNames.splice(index, 1);
      newUrls.splice(index, 1);
      setFormData(prev => ({ ...prev, links_names: newNames, links_urls: newUrls }));
  };

  const updateLink = (index: number, field: 'name' | 'url', value: string) => {
      const list = field === 'name' ? [...formData.links_names] : [...formData.links_urls];
      list[index] = value;
      if (field === 'name') setFormData(prev => ({ ...prev, links_names: list as string[] }));
      else setFormData(prev => ({ ...prev, links_urls: list as string[] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
        const payload = { ...formData };
        let error;
        if (settingsId) error = (await supabase.from('general_settings').update(payload).eq('id', settingsId)).error;
        else error = (await supabase.from('general_settings').insert([payload])).error;
        
        if (error) throw error;
        alert('تم الحفظ بنجاح ✅');
        if (onUpdateName) onUpdateName();
    } catch (err: any) { alert('خطأ: ' + err.message); } 
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-10 text-center">جاري التحميل...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-10">
        <div className="flex justify-between items-center border-b pb-6">
            <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">إعدادات النظام</h2>
            <button onClick={handleSave} disabled={saving} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black hover:bg-emerald-700 transition-all flex items-center gap-2">
                {saving ? <Loader2 className="animate-spin"/> : <Save/>} حفظ
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* ... (الخانات السابقة: بيانات المركز، المواعيد، الخ) ... */}
            
            {/* قسم الروابط الهامة الجديد */}
            <div className="lg:col-span-2 bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-xl text-gray-700 flex items-center gap-2">
                        <LinkIcon className="w-6 h-6 text-blue-500"/> الروابط الهامة للموظفين
                    </h3>
                    <button onClick={addLink} className="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-lg font-bold hover:bg-blue-100 flex items-center gap-1">
                        <Plus className="w-4 h-4"/> رابط جديد
                    </button>
                </div>

                <div className="space-y-3">
                    {formData.links_names.map((name, i) => (
                        <div key={i} className="flex gap-4 items-center bg-gray-50 p-3 rounded-xl">
                            <div className="flex-1">
                                <input placeholder="اسم الرابط (مثال: نماذج جوجل)" value={name} onChange={e => updateLink(i, 'name', e.target.value)} className="w-full bg-white border rounded-lg p-2 text-sm font-bold outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div className="flex-[2]">
                                <input placeholder="الرابط (URL)" value={formData.links_urls[i]} onChange={e => updateLink(i, 'url', e.target.value)} className="w-full bg-white border rounded-lg p-2 text-sm text-gray-600 font-mono outline-none focus:ring-1 focus:ring-blue-400" dir="ltr" />
                            </div>
                            <button onClick={() => removeLink(i)} className="text-red-500 p-2 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                    {formData.links_names.length === 0 && <p className="text-center text-gray-400 text-sm">لا توجد روابط مسجلة</p>}
                </div>
            </div>
        </div>
    </div>
  );
}