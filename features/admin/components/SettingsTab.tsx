import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Input, Select } from '../../../components/ui/FormElements'; 
import { AttendanceRule } from '../../../types'; 
import {
  Save, Building, Clock, MapPin, Calculator, Link as LinkIcon,
  Plus, Trash2, Loader2, Locate, Settings2, Calendar, LayoutList, Globe, Palette, Sparkles, Info
} from 'lucide-react';

export default function SettingsTab({ onUpdateName }: { onUpdateName?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  // ✅ تمت إضافة 'themes' هنا
  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'holidays' | 'links' | 'themes'>('general');

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
    links_urls: [] as string[],
    holidays_name: [] as string[],
    holidays_date: [] as string[],
    active_theme: 'default' // ✅ تمت إضافة حقل الثيم
  });

  // 2. بيانات قواعد الحضور
  const [rules, setRules] = useState<AttendanceRule[]>([]);
  const [newRule, setNewRule] = useState({
      name: '', 
      type: 'in', // 'in' or 'out'
      start_time: '', 
      end_time: '', 
      color: 'emerald'
  });

  // خيارات الألوان المتاحة للقواعد
  const colorOptions = [
    { value: 'emerald', label: 'أخضر (طبيعي)', bg: 'bg-emerald-500' },
    { value: 'yellow', label: 'أصفر (تحذير)', bg: 'bg-yellow-500' },
    { value: 'red', label: 'أحمر (خطأ/تأخير)', bg: 'bg-red-500' },
    { value: 'blue', label: 'أزرق (مبكر)', bg: 'bg-blue-500' },
    { value: 'purple', label: 'بنفسجي (إضافي)', bg: 'bg-purple-500' },
    { value: 'gray', label: 'رمادي (محايد)', bg: 'bg-gray-500' },
  ];

  // خيارات الثيمات المتاحة
  const themeOptions = [
      { id: 'default', name: 'الوضع الافتراضي', icon: '🏢', desc: 'بدون زينة إضافية' },
      { id: 'ramadan', name: 'شهر رمضان', icon: '🏮', desc: 'فوانيس وزينة رمضانية' },
      { id: 'eid', name: 'الأعياد', icon: '🎉', desc: 'بالونات وزينة العيد' },
      { id: 'christmas', name: 'رأس السنة', icon: '❄️', desc: 'تساقط الثلوج' }
  ];

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
            links_urls: data.links_urls || [],
            holidays_name: data.holidays_name || [],
            holidays_date: data.holidays_date || [],
            active_theme: data.active_theme || 'default' // ✅ جلب الثيم المحفوظ
        });
      }
    } catch (err) {
        console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRules = async () => {
      const { data } = await supabase.from('attendance_rules').select('*').order('type').order('start_time');
      if (data) setRules(data as any);
  };

  // --- العمليات ---
  const getCurrentLocation = () => {
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
              setFormData(prev => ({ ...prev, location_lat: pos.coords.latitude, location_lng: pos.coords.longitude }));
              alert("تم تحديد الموقع ✅");
          }, (err) => alert("فشل: " + err.message));
      } else { alert("المتصفح لا يدعم"); }
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
        alert('تم الحفظ ✅');
        if (onUpdateName) onUpdateName();
        fetchSettings();
    } catch (err: any) { alert('خطأ: ' + err.message); } 
    finally { setSaving(false); }
  };

  // --- إدارة القواعد ---
  const addRule = async () => {
      if(!newRule.name || !newRule.start_time || !newRule.end_time) return alert('البيانات ناقصة');
      
      // @ts-ignore
      const { error } = await supabase.from('attendance_rules').insert(newRule);
      if(!error) {
          setNewRule({ name: '', type: 'in', start_time: '', end_time: '', color: 'emerald' });
          fetchRules();
      } else { alert(error.message); }
  };

  const deleteRule = async (id: string) => {
      if(!confirm('حذف القاعدة؟')) return;
      await supabase.from('attendance_rules').delete().eq('id', id);
      fetchRules();
  };

  // --- إدارة العطلات ---
  const addHoliday = () => {
      setFormData(prev => ({
          ...prev,
          holidays_name: [...prev.holidays_name, ''],
          holidays_date: [...prev.holidays_date, '']
      }));
  };
  const removeHoliday = (index: number) => {
      const newNames = [...formData.holidays_name];
      const newDates = [...formData.holidays_date];
      newNames.splice(index, 1);
      newDates.splice(index, 1);
      setFormData(prev => ({ ...prev, holidays_name: newNames, holidays_date: newDates }));
  };
  const updateHoliday = (index: number, field: 'name' | 'date', value: string) => {
      const list = field === 'name' ? [...formData.holidays_name] : [...formData.holidays_date];
      list[index] = value;
      if (field === 'name') setFormData(prev => ({ ...prev, holidays_name: list }));
      else setFormData(prev => ({ ...prev, holidays_date: list }));
  };

  // --- إدارة الروابط ---
  const addLink = () => {
      setFormData(prev => ({ ...prev, links_names: [...prev.links_names, ''], links_urls: [...prev.links_urls, ''] }));
  };
  const removeLink = (index: number) => {
      const n = [...formData.links_names]; n.splice(index, 1);
      const u = [...formData.links_urls]; u.splice(index, 1);
      setFormData(prev => ({ ...prev, links_names: n, links_urls: u }));
  };
  const updateLink = (index: number, field: 'name' | 'url', value: string) => {
      const l = field === 'name' ? [...formData.links_names] : [...formData.links_urls];
      l[index] = value;
      if (field === 'name') setFormData(prev => ({ ...prev, links_names: l }));
      else setFormData(prev => ({ ...prev, links_urls: l }));
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto"/>جاري التحميل...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-7xl mx-auto pb-20">
        
        {/* Header with Save Button */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-6 bg-gray-50/95 backdrop-blur z-10 pt-4 gap-4">
            <div>
                <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                    <Settings2 className="w-8 h-8 text-emerald-600"/> إعدادات النظام
                </h2>
                <p className="text-gray-400 font-bold mt-1 text-sm">التحكم الشامل في خصائص وقواعد النظام</p>
            </div>
            <button onClick={handleSave} disabled={saving} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:bg-gray-400 w-full md:w-auto justify-center">
                {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white p-1 rounded-2xl border shadow-sm">
            {[
                { id: 'general', label: 'الإعدادات العامة', icon: Building },
                { id: 'rules', label: 'قواعد الحضور', icon: Clock },
                { id: 'holidays', label: 'العطلات', icon: Calendar },
                { id: 'links', label: 'الروابط', icon: Globe },
                { id: 'themes', label: 'المظهر والمناسبات', icon: Palette }, // ✅ تمت إضافة التبويب
            ].map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all text-sm whitespace-nowrap ${
                        activeTab === tab.id 
                        ? 'bg-emerald-600 text-white shadow-md' 
                        : 'text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <tab.icon className="w-4 h-4"/>
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
            
            {/* 1. General Settings Tab */}
            {activeTab === 'general' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2">
                    {/* Center Info */}
                    <div className="bg-white p-6 rounded-[30px] border shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
                        <h3 className="font-black text-lg text-gray-700 flex items-center gap-2 mb-4">
                            <Building className="w-5 h-5 text-blue-500"/> بيانات المركز
                        </h3>
                        <Input label="اسم المركز الطبي" value={formData.center_name} onChange={(v:any)=>setFormData({...formData, center_name: v})} />
                    </div>

                    {/* Time Policies */}
                    <div className="bg-white p-6 rounded-[30px] border shadow-sm relative overflow-hidden group hover:border-purple-200 transition-all">
                        <div className="absolute top-0 left-0 w-full h-1 bg-purple-500"></div>
                        <h3 className="font-black text-lg text-gray-700 flex items-center gap-2 mb-4">
                            <Clock className="w-5 h-5 text-purple-500"/> سياسات الوقت
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="بداية العمل" type="time" value={formData.work_start_time} onChange={(v:any)=>setFormData({...formData, work_start_time: v})} />
                            <Input label="نهاية العمل" type="time" value={formData.work_end_time} onChange={(v:any)=>setFormData({...formData, work_end_time: v})} />
                            <div className="col-span-2">
                                <Input label="فترة السماح (دقائق)" type="number" value={formData.lateness_grace_minutes} onChange={(v:any)=>setFormData({...formData, lateness_grace_minutes: Number(v)})} />
                            </div>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="bg-white p-6 rounded-[30px] border shadow-sm relative overflow-hidden group hover:border-red-200 transition-all">
                        <div className="absolute top-0 left-0 w-full h-1 bg-red-500"></div>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-black text-lg text-gray-700 flex items-center gap-2">
                                <MapPin className="w-5 h-5 text-red-500"/> الموقع الجغرافي
                            </h3>
                            <button onClick={getCurrentLocation} className="text-xs bg-red-50 text-red-600 px-3 py-1 rounded-lg font-bold hover:bg-red-100 flex items-center gap-1">
                                <Locate className="w-3 h-3"/> موقعي الحالي
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

                    {/* Balances */}
                    <div className="bg-white p-6 rounded-[30px] border shadow-sm relative overflow-hidden group hover:border-green-200 transition-all">
                        <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
                        <h3 className="font-black text-lg text-gray-700 flex items-center gap-2 mb-4">
                            <Calculator className="w-5 h-5 text-green-500"/> أرصدة الإجازات الافتراضية
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="اعتيادية" type="number" value={formData.annual_leave_days} onChange={(v:any)=>setFormData({...formData, annual_leave_days: Number(v)})} />
                            <Input label="عارضة" type="number" value={formData.casual_leave_days} onChange={(v:any)=>setFormData({...formData, casual_leave_days: Number(v)})} />
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Attendance Rules Tab */}
            {activeTab === 'rules' && (
                <div className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                            <LayoutList className="w-6 h-6 text-emerald-600"/> قواعد ترجمة الحضور
                        </h3>
                    </div>

                    {/* Add New Rule Form */}
                    <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 mb-8">
                        <h4 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm">
                            <Plus className="w-4 h-4"/> إضافة قاعدة جديدة
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div className="md:col-span-2 lg:col-span-1">
                                <Input 
                                    label="اسم الحالة (مثل: تأخير صباحي)" 
                                    value={newRule.name} 
                                    onChange={(v:any) => setNewRule({...newRule, name: v})} 
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">نوع القاعدة</label>
                                <select 
                                    className="w-full p-3 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-100 bg-white font-bold text-gray-700"
                                    value={newRule.type}
                                    onChange={e => setNewRule({...newRule, type: e.target.value})}
                                >
                                    <option value="in">تسجيل دخول (حضور)</option>
                                    <option value="out">تسجيل خروج (انصراف)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5">لون التمييز</label>
                                <div className="flex gap-2 items-center h-[46px] bg-white border border-gray-200 rounded-xl px-3">
                                    {colorOptions.map(c => (
                                        <button
                                            key={c.value}
                                            onClick={() => setNewRule({...newRule, color: c.value})}
                                            title={c.label}
                                            className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${c.bg} ${newRule.color === c.value ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''}`}
                                        />
                                    ))}
                                    <span className="text-xs text-gray-400 mr-auto">{newRule.color}</span>
                                </div>
                            </div>

                            <div>
                                <Input label="من الساعة" type="time" value={newRule.start_time} onChange={(v:any)=>setNewRule({...newRule, start_time: v})} />
                            </div>
                            <div>
                                <Input label="إلى الساعة" type="time" value={newRule.end_time} onChange={(v:any)=>setNewRule({...newRule, end_time: v})} />
                            </div>

                            <div className="flex items-end">
                                <button 
                                    onClick={addRule} 
                                    className="w-full h-[46px] bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
                                >
                                    <Plus className="w-5 h-5"/> حفظ القاعدة
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Rules List */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                        {rules.length === 0 && <p className="text-center text-gray-400 col-span-2 py-8">لا توجد قواعد مضافة</p>}
                        {rules.map(rule => (
                            <div key={rule.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:border-emerald-200 transition-colors group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-3 h-12 rounded-full ${colorOptions.find(c => c.value === rule.color)?.bg || 'bg-gray-400'}`}></div>
                                    <div>
                                        <h5 className="font-bold text-gray-800">{rule.name}</h5>
                                        <div className="flex gap-2 mt-1 text-xs font-bold text-gray-400">
                                            <span className={`px-2 py-0.5 rounded ${rule.type === 'in' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'}`}>
                                                {rule.type === 'in' ? 'حضور' : 'انصراف'}
                                            </span>
                                            <span className="bg-gray-50 px-2 py-0.5 rounded flex items-center gap-1">
                                                <Clock className="w-3 h-3"/> {rule.start_time} - {rule.end_time}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => deleteRule(rule.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all">
                                    <Trash2 className="w-5 h-5"/>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3. Holidays Tab */}
            {activeTab === 'holidays' && (
                <div className="bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-xl text-gray-700 flex items-center gap-2">
                            <Calendar className="w-6 h-6 text-orange-500"/> العطلات الرسمية
                        </h3>
                        <button onClick={addHoliday} className="text-xs bg-orange-50 text-orange-600 px-4 py-2 rounded-lg font-bold hover:bg-orange-100 flex items-center gap-2 shadow-sm">
                            <Plus className="w-4 h-4"/> إضافة عطلة
                        </button>
                    </div>

                    <div className="space-y-3">
                        {formData.holidays_name.map((name, i) => (
                            <div key={i} className="flex flex-col md:flex-row gap-3 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                                <span className="font-black text-gray-300 w-6 text-center">{i + 1}</span>
                                <div className="flex-1 w-full">
                                    <input 
                                        placeholder="اسم العطلة (مثال: عيد العمال)" 
                                        value={name} 
                                        onChange={e => updateHoliday(i, 'name', e.target.value)} 
                                        className="w-full bg-white border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-400" 
                                    />
                                </div>
                                <div className="w-full md:w-48">
                                    <input 
                                        type="date"
                                        value={formData.holidays_date[i]} 
                                        onChange={e => updateHoliday(i, 'date', e.target.value)} 
                                        className="w-full bg-white border rounded-xl p-3 text-sm text-gray-600 font-mono outline-none focus:ring-2 focus:ring-orange-400" 
                                    />
                                </div>
                                <button onClick={() => removeHoliday(i)} className="text-red-400 p-3 hover:bg-red-100 rounded-xl transition-colors" title="حذف">
                                    <Trash2 className="w-5 h-5"/>
                                </button>
                            </div>
                        ))}
                        {formData.holidays_name.length === 0 && (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
                                <p className="text-gray-400 font-bold">لا توجد عطلات مسجلة حالياً</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 4. Links Tab */}
            {activeTab === 'links' && (
                <div className="bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-xl text-gray-700 flex items-center gap-2">
                            <Globe className="w-6 h-6 text-teal-500"/> الروابط الهامة
                        </h3>
                        <button onClick={addLink} className="text-xs bg-teal-50 text-teal-600 px-4 py-2 rounded-lg font-bold hover:bg-teal-100 flex items-center gap-2 shadow-sm">
                            <Plus className="w-4 h-4"/> إضافة رابط
                        </button>
                    </div>
                    <div className="space-y-3">
                        {formData.links_names.map((name, i) => (
                            <div key={i} className="flex flex-col md:flex-row gap-3 items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <span className="font-black text-gray-300 w-6 text-center">{i + 1}</span>
                                <input value={name} onChange={e => updateLink(i, 'name', e.target.value)} className="flex-1 w-full bg-white border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-teal-400" placeholder="الاسم" />
                                <input value={formData.links_urls[i]} onChange={e => updateLink(i, 'url', e.target.value)} className="flex-[2] w-full bg-white border rounded-xl p-3 text-sm font-mono outline-none focus:ring-2 focus:ring-teal-400" placeholder="الرابط" dir="ltr" />
                                <button onClick={() => removeLink(i)} className="text-red-400 p-3 hover:bg-red-100 rounded-xl"><Trash2 className="w-5 h-5"/></button>
                            </div>
                        ))}
                        {formData.links_names.length === 0 && (
                            <div className="text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                <Globe className="w-10 h-10 text-gray-300 mx-auto mb-2"/>
                                <p className="text-gray-400 font-bold">لا توجد روابط مضافة</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ 5. Themes Tab */}
            {activeTab === 'themes' && (
                <div className="bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm animate-in slide-in-from-bottom-2">
                    <div className="mb-6">
                        <h3 className="font-black text-xl text-gray-800 flex items-center gap-2 mb-2">
                            <Sparkles className="w-6 h-6 text-amber-500"/> مظهر التطبيق والمناسبات
                        </h3>
                        <p className="text-gray-500 text-sm font-bold">
                            اختر الثيم العام الذي سيظهر لجميع الموظفين في النظام.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {themeOptions.map((theme) => (
                            <button
                                key={theme.id}
                                onClick={() => setFormData({ ...formData, active_theme: theme.id })}
                                className={`flex flex-col items-center p-6 rounded-2xl border-2 transition-all ${
                                    formData.active_theme === theme.id
                                    ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100'
                                    : 'border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/50'
                                }`}
                            >
                                <span className="text-4xl mb-3 block">{theme.icon}</span>
                                <h4 className="font-black text-gray-800 mb-1">{theme.name}</h4>
                                <p className="text-[10px] text-gray-500 font-bold text-center">{theme.desc}</p>
                            </button>
                        ))}
                    </div>

                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-500 mt-0.5 shrink-0"/>
                        <div>
                            <h4 className="font-bold text-blue-800 mb-1">ملاحظة حول ثيم أعياد الميلاد</h4>
                            <p className="text-xs text-blue-600 font-medium leading-relaxed">
                                ثيم عيد الميلاد يظهر تلقائياً للموظف في يوم ميلاده فقط (يتم حسابه من الرقم القومي)، ولا يتأثر باختيارك للثيم العام هنا.
                            </p>
                        </div>
                    </div>
                </div>
            )}

        </div>
    </div>
  );
}
