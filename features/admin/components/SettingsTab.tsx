import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Input } from '../../../components/ui/FormElements';
import { Save, Building, Clock, MapPin, Calculator, Loader2, Locate } from 'lucide-react';

export default function SettingsTab({ onUpdateName }: { onUpdateName?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null); // لحفظ ID الصف الحالي

  // الحالة الافتراضية
  const [formData, setFormData] = useState({
    center_name: '',
    work_start_time: '08:00',
    work_end_time: '14:00',
    lateness_grace_minutes: 15,
    location_lat: 0.0,
    location_lng: 0.0,
    allowed_distance_meters: 50,
    annual_leave_days: 21,
    casual_leave_days: 7
  });

  // جلب البيانات عند فتح الصفحة
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      // نجلب أول صف نجده (لأنها إعدادات عامة واحدة)
      const { data, error } = await supabase.from('general_settings').select('*').limit(1).maybeSingle();

      if (error) throw error;

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
            casual_leave_days: data.casual_leave_days || 7
        });
      }
    } catch (err: any) {
      alert('فشل تحميل الإعدادات: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
        let error;
        
        if (settingsId) {
            // تحديث (Update) إذا كان الصف موجوداً
            const { error: updateError } = await supabase
                .from('general_settings')
                .update(formData)
                .eq('id', settingsId);
            error = updateError;
        } else {
            // إنشاء (Insert) إذا كان الجدول فارغاً
            const { error: insertError } = await supabase
                .from('general_settings')
                .insert([formData]);
            error = insertError;
        }

        if (error) throw error;

        alert('تم حفظ إعدادات النظام بنجاح ✅');
        if (onUpdateName) onUpdateName(); // لتحديث اسم المركز في الهيدر فوراً
        fetchSettings(); // إعادة تحميل للتأكيد

    } catch (err: any) {
        alert('خطأ أثناء الحفظ: ' + err.message);
    } finally {
        setSaving(false);
    }
  };

  // دالة مساعدة لتحديد الموقع الحالي تلقائياً
  const getCurrentLocation = () => {
      if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition((pos) => {
              setFormData(prev => ({
                  ...prev,
                  location_lat: pos.coords.latitude,
                  location_lng: pos.coords.longitude
              }));
              alert("تم تحديد إحداثيات موقعك الحالي بنجاح");
          }, (err) => alert("تعذر تحديد الموقع: " + err.message));
      } else {
          alert("المتصفح لا يدعم تحديد الموقع");
      }
  };

  if (loading) return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin mb-2"/>
          <p>جاري تحميل الإعدادات...</p>
      </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto pb-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-center border-b pb-6 gap-4">
            <div>
                <h2 className="text-3xl font-black text-gray-800 flex items-center gap-3">
                    <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><Settings className="w-8 h-8"/></div>
                    إعدادات النظام
                </h2>
                <p className="text-gray-400 font-bold mt-1 mr-14">التحكم المركزي في بيانات وقواعد المنظومة</p>
            </div>
            
            <button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 flex items-center gap-2 active:scale-95 disabled:bg-gray-400 disabled:shadow-none w-full md:w-auto justify-center"
            >
                {saving ? <Loader2 className="w-5 h-5 animate-spin"/> : <Save className="w-5 h-5"/>}
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* 1. البيانات الأساسية */}
            <div className="bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500"></div>
                <h3 className="font-black text-xl text-gray-700 flex items-center gap-2 mb-6">
                    <Building className="w-6 h-6 text-blue-500"/> بيانات المركز
                </h3>
                <div className="space-y-4">
                    <Input 
                        label="اسم المركز الطبي (يظهر في الهيدر والتقارير)" 
                        value={formData.center_name} 
                        onChange={(v:any)=>setFormData({...formData, center_name: v})} 
                        placeholder="مثال: مركز صحة الأسرة..."
                    />
                </div>
            </div>

            {/* 2. المواعيد والحضور */}
            <div className="bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-purple-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500"></div>
                <h3 className="font-black text-xl text-gray-700 flex items-center gap-2 mb-6">
                    <Clock className="w-6 h-6 text-purple-500"/> سياسات الوقت والحضور
                </h3>
                <div className="grid grid-cols-2 gap-5">
                    <Input label="بداية العمل" type="time" value={formData.work_start_time} onChange={(v:any)=>setFormData({...formData, work_start_time: v})} />
                    <Input label="نهاية العمل" type="time" value={formData.work_end_time} onChange={(v:any)=>setFormData({...formData, work_end_time: v})} />
                    <div className="col-span-2">
                         <Input 
                            label="فترة السماح للتأخير (دقائق)" 
                            type="number" 
                            value={formData.lateness_grace_minutes} 
                            onChange={(v:any)=>setFormData({...formData, lateness_grace_minutes: Number(v)})} 
                        />
                        <p className="text-[10px] text-gray-400 mt-1 font-bold">أي حضور بعد (الموعد + فترة السماح) سيحسب تأخير.</p>
                    </div>
                </div>
            </div>

            {/* 3. الموقع الجغرافي */}
            <div className="bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-red-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
                <div className="flex justify-between items-start mb-6">
                    <h3 className="font-black text-xl text-gray-700 flex items-center gap-2">
                        <MapPin className="w-6 h-6 text-red-500"/> الموقع الجغرافي
                    </h3>
                    <button onClick={getCurrentLocation} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100 flex items-center gap-1">
                        <Locate className="w-3 h-3"/> تحديد موقعي الحالي
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-5">
                    <Input label="خط العرض (Lat)" type="number" value={formData.location_lat} onChange={(v:any)=>setFormData({...formData, location_lat: Number(v)})} />
                    <Input label="خط الطول (Lng)" type="number" value={formData.location_lng} onChange={(v:any)=>setFormData({...formData, location_lng: Number(v)})} />
                    <div className="col-span-2">
                        <Input 
                            label="قطر الدائرة المسموح للبصمة (متر)" 
                            type="number" 
                            value={formData.allowed_distance_meters} 
                            onChange={(v:any)=>setFormData({...formData, allowed_distance_meters: Number(v)})} 
                        />
                    </div>
                </div>
            </div>

            {/* 4. رصيد الإجازات */}
            <div className="bg-white p-8 rounded-[30px] border border-gray-100 shadow-sm relative overflow-hidden group hover:border-green-200 transition-all">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-emerald-500"></div>
                <h3 className="font-black text-xl text-gray-700 flex items-center gap-2 mb-6">
                    <Calculator className="w-6 h-6 text-green-500"/> الأرصدة الافتراضية
                </h3>
                <div className="grid grid-cols-2 gap-5">
                    <Input label="الاعتيادية (سنوي)" type="number" value={formData.annual_leave_days} onChange={(v:any)=>setFormData({...formData, annual_leave_days: Number(v)})} />
                    <Input label="العارضة (سنوي)" type="number" value={formData.casual_leave_days} onChange={(v:any)=>setFormData({...formData, casual_leave_days: Number(v)})} />
                </div>
                <p className="text-xs text-gray-400 font-bold mt-4 bg-gray-50 p-2 rounded-lg">
                    ⚠️ ملاحظة: هذه الأرصدة يتم تطبيقها تلقائياً عند إضافة موظف جديد للنظام فقط. لتعديل رصيد موظف حالي، اذهب لتبويب شئون الموظفين.
                </p>
            </div>
        </div>
    </div>
  );
}

// استيراد أيقونة الإعدادات الناقصة
import { Settings } from 'lucide-react';