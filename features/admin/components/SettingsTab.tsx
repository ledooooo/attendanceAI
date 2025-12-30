import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Input } from '../../../components/ui/FormElements';
import { AttendanceRule } from '../../../types'; 
import {
  Save, Building, Clock, MapPin, Calculator, Link as LinkIcon,
  Plus, Trash2, Loader2, Locate, Settings2
} from 'lucide-react';

export default function SettingsTab({ onUpdateName }: { onUpdateName?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // 1. بيانات الإعدادات العامة
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

  // 2. بيانات قواعد الحضور (الجديدة)
  const [rules, setRules] = useState<AttendanceRule[]>([]);
  const [newRule, setNewRule] = useState({
      name: '', type: 'in', start_time: '', end_time: '', color: 'emerald'
  });

  useEffect(() => {
    fetchSettings();
    fetchRules();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('general_settings').select('*').limit(1).maybeSingle();
      if (data) {
        setSettingsId(data.id);
        setFormData({
            center_name: data.center_name || '',
            work_start_time: data.work_start_time || '08:00',
            work_end_time: data.work_end_time || '14:00',
            lateness_grace_minutes: data.lateness_grace_minutes || 0,
            location_lat: data.location_lat || 0,
            location_lng: data.location_lng || 0,
            allowed_distance_meters: data.allowed_distance_meters || 50,
            annual_leave_days: data.annual_leave_days || 21,
            casual_leave_days: data.casual_leave_days || 7,
            links_names: data.links_names || [],
            links_urls: data.links_urls || []
        });
      }
    } catch (err) {
        console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
      const { data } = await supabase.from('attendance_rules').select('*').order('start_time');
      if (data) setRules(data);
  };

  const addRule = async () => {
      if(!newRule.name || !newRule.start_time || !newRule.end_time) return alert('البيانات ناقصة');
      
      const { error } = await supabase.from('attendance_rules').insert(newRule);
      if(!error) {
          setNewRule({ name: '', type: 'in', start_time: '', end_time: '', color: 'emerald' });
          fetchRules();
      } else {
          alert(error.message);
      }
  };

  const deleteRule = async (id: string) => {
      if(!confirm('حذف القاعدة؟')) return;
      await supabase.from('attendance_rules').delete().eq('id', id);
      fetchRules();
  };

  // ... (باقي دوال الحفظ والروابط كما هي في كودك القديم، سأضعها هنا للاكتمال)
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

  const getCurrentLocation = () => {
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
              setFormData(prev => ({
                  ...prev,
                  location_lat: pos.coords.latitude,
                  location_lng: pos.coords.longitude
              }));
              alert("تم تحديد موقعك الحالي بنجاح ✅");
          }, (err) => alert("تعذر تحديد الموقع: " + err.message));
      } else {
          alert("المتصفح لا يدعم تحديد الموقع");
      }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
        let error;
        if (settingsId) {
            error = (await supabase.from('general_settings').update(formData).eq('id', settingsId)).error;
        } else {
            error = (await supabase.from('general_settings').insert([formData])).error;
        }

        if (error) throw error;
        alert('تم حفظ كافة الإعدادات بنجاح ✅');
        if (onUpdateName) onUpdateName();
        fetchSettings();
    } catch (err: any) {
        alert('خطأ أثناء الحفظ: ' + err.message);
    } finally {
        setSaving(false);
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto"/>جاري تحميل الإعدادات...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b pb-6 sticky top-0 bg-gray-50/95 backdrop-blur z-10 pt-4">
            <div>
                <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                    إعدادات النظام الشاملة
                </h2>
                <p className="text-gray-400 font-bold mt-1 text-sm">التحكم في بيانات المركز، المواعيد، الموقع، الروابط، وقواعد الحضور</p>
            </div>
            <button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:bg-gray-400"
            >
                {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. بيانات المركز */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                <h3 className="font-black text-lg text-gray-700 flex items-center gap-2 mb-4">
                    <Building className="w-5 h-5 text-blue-500"/> بيانات المركز
                </h3>
                <Input 
                    label="اسم المركز الطبي" 
                    value={formData.center_name} 
                    onChange={(v:any)=>setFormData({...formData, center_name: v})} 
                />
            </div>

            {/* 2. المواعيد العامة */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm relative overflow-hidden group hover:border-purple-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                <h3 className="font-black text-lg text-gray-700 flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-purple-500"/> سياسات الوقت الأساسية
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="بداية العمل" type="time" value={formData.work_start_time} onChange={(v:any)=>setFormData({...formData, work_start_time: v})} />
                    <Input label="نهاية العمل" type="time" value={formData.work_end_time} onChange={(v:any)=>setFormData({...formData, work_end_time: v})} />
                    <div className="col-span-2">
                        <Input label="فترة السماح (دقائق)" type="number" value={formData.lateness_grace_minutes} onChange={(v:any)=>setFormData({...formData, lateness_grace_minutes: Number(v)})} />
                    </div>
                </div>
            </div>

            {/* 3. الموقع الجغرافي */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm relative overflow-hidden group hover:border-red-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-black text-lg text-gray-700 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-red-500"/> الموقع الجغرافي
                    </h3>
                    <button onClick={getCurrentLocation} className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-lg font-bold hover:bg-red-100 flex items-center gap-1">
                        <Locate className="w-3 h-3"/> موقعي
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="Latitude" type="number" value={formData.location_lat} onChange={(v:any)=>setFormData({...formData, location_lat: Number(v)})} />
                    <Input label="Longitude" type="number" value={formData.location_lng} onChange={(v:any)=>setFormData({...formData, location_lng: Number(v)})} />
                    <div className="col-span-2">
                        <Input label="نطاق البصمة (متر)" type="number" value={formData.allowed_distance_meters} onChange={(v:any)=>setFormData({...formData, allowed_distance_meters: Number(v)})} />
                    </div>
                </div>
            </div>

            {/* 4. الأرصدة */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm relative overflow-hidden group hover:border-green-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                <h3 className="font-black text-lg text-gray-700 flex items-center gap-2 mb-4">
                    <Calculator className="w-5 h-5 text-green-500"/> أرصدة الإجازات (الافتراضية)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="اعتيادية" type="number" value={formData.annual_leave_days} onChange={(v:any)=>setFormData({...formData, annual_leave_days: Number(v)})} />
                    <Input label="عارضة" type="number" value={formData.casual_leave_days} onChange={(v:any)=>setFormData({...formData, casual_leave_days: Number(v)})} />
                </div>
            </div>

            {/* 5. قواعد الحضور والانصراف (القسم الجديد) */}
            <div className="lg:col-span-2 bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
                <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                    <Settings2 className="w-6 h-6 text-blue-600"/> قواعد ترجمة حالات الحضور
                </h3>

                {/* Form لإضافة قاعدة */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-gray-500 mb-1 block">اسم الحالة</label>
                        <input type="text" placeholder="مثال: تأخير صباحي" className="w-full p-2 rounded-lg border focus:ring-2 focus:ring-blue-200 outline-none" 
                            value={newRule.name} onChange={e => setNewRule({...newRule, name: e.target.value})} />
                    </div>
                    <div>
                         <label className="text-xs font-bold text-gray-500 mb-1 block">النوع</label>
                         <select className="w-full p-2 rounded-lg border bg-white" value={newRule.type} onChange={e => setNewRule({...newRule, type: e.target.value as any})}>
                             <option value="in">دخول</option>
                             <option value="out">خروج</option>
                         </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">من</label>
                        <input type="time" className="w-full p-2 rounded-lg border bg-white" 
                            value={newRule.start_time} onChange={e => setNewRule({...newRule, start_time: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 mb-1 block">إلى</label>
                        <input type="time" className="w-full p-2 rounded-lg border bg-white" 
                            value={newRule.end_time} onChange={e => setNewRule({...newRule, end_time: e.target.value})} />
                    </div>
                    <div>
                         <label className="text-xs font-bold text-gray-500 mb-1 block">اللون</label>
                         <select className="w-full p-2 rounded-lg border bg-white" value={newRule.color} onChange={e => setNewRule({...newRule, color: e.target.value})}>
                             <option value="emerald">أخضر</option>
                             <option value="orange">برتقالي</option>
                             <option value="red">أحمر</option>
                             <option value="blue">أزرق</option>
                         </select>
                    </div>
                    <div className="md:col-span-6 flex justify-end">
                        <button onClick={addRule} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2 shadow-sm">
                            <Plus className="w-4 h-4"/> إضافة القاعدة
                        </button>
                    </div>
                </div>

                {/* قائمة القواعد */}
                <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                    {rules.length === 0 ? (
                        <p className="text-center text-gray-400 py-4 text-sm">لا توجد قواعد مضافة</p>
                    ) : rules.map(rule => (
                        <div key={rule.id} className="flex justify-between items-center p-3 bg-white border rounded-xl shadow-sm hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-1 rounded text-xs font-bold ${rule.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {rule.type === 'in' ? 'دخول' : 'خروج'}
                                </span>
                                <span className="font-bold text-gray-800 text-sm">{rule.name}</span>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-lg dir-ltr font-mono">
                                    {rule.start_time.slice(0,5)} - {rule.end_time.slice(0,5)}
                                </span>
                                <div className={`w-3 h-3 rounded-full bg-${rule.color}-500 border border-gray-200`}></div>
                            </div>
                            <button onClick={() => deleteRule(rule.id)} className="text-red-400 hover:text-red-600 bg-red-50 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 6. الروابط الهامة */}
            <div className="lg:col-span-2 bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-xl text-gray-700 flex items-center gap-2">
                        <LinkIcon className="w-6 h-6 text-emerald-500"/> الروابط الهامة للموظفين
                    </h3>
                    <button onClick={addLink} className="text-xs bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg font-bold hover:bg-emerald-100 flex items-center gap-2 shadow-sm">
                        <Plus className="w-4 h-4"/> إضافة رابط جديد
                    </button>
                </div>

                <div className="space-y-3">
                    {formData.links_names.map((name, i) => (
                        <div key={i} className="flex flex-col md:flex-row gap-3 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                            <span className="font-black text-gray-300 w-6 text-center">{i + 1}</span>
                            <div className="flex-1 w-full">
                                <input 
                                    placeholder="اسم الرابط (مثال: نموذج طلب إجازة)" 
                                    value={name} 
                                    onChange={e => updateLink(i, 'name', e.target.value)} 
                                    className="w-full bg-white border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-400" 
                                />
                            </div>
                            <div className="flex-[2] w-full">
                                <input 
                                    placeholder="الرابط (URL)" 
                                    value={formData.links_urls[i]} 
                                    onChange={e => updateLink(i, 'url', e.target.value)} 
                                    className="w-full bg-white border rounded-xl p-3 text-sm text-gray-600 font-mono outline-none focus:ring-2 focus:ring-emerald-400" 
                                    dir="ltr" 
                                />
                            </div>
                            <button onClick={() => removeLink(i)} className="text-red-400 p-3 hover:bg-red-100 rounded-xl transition-colors" title="حذف">
                                <Trash2 className="w-5 h-5"/>
                            </button>
                        </div>
                    ))}
                    {formData.links_names.length === 0 && (
                        <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            <LinkIcon className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
                            <p className="text-gray-400 font-bold">لا توجد روابط مسجلة حالياً</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    </div>
  );
}
