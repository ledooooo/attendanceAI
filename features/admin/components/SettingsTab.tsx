import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Input } from '../../../components/ui/FormElements';
import { Save, Building, Clock, MapPin, Calculator } from 'lucide-react';

export default function SettingsTab({ onUpdateName }: { onUpdateName?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    center_name: '',
    work_start_time: '08:00',
    work_end_time: '14:00',
    lateness_grace_minutes: 15,
    location_lat: 0,
    location_lng: 0,
    allowed_distance_meters: 50,
    annual_leave_days: 21,
    casual_leave_days: 7
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('general_settings').select('*').maybeSingle();
    if (data) {
        setSettings({
            center_name: data.center_name || '',
            work_start_time: data.work_start_time || '08:00',
            work_end_time: data.work_end_time || '14:00',
            lateness_grace_minutes: data.lateness_grace_minutes || 15,
            location_lat: data.location_lat || 0,
            location_lng: data.location_lng || 0,
            allowed_distance_meters: data.allowed_distance_meters || 50,
            annual_leave_days: data.annual_leave_days || 21,
            casual_leave_days: data.casual_leave_days || 7
        });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    // نفترض أن هناك صف واحد فقط في general_settings، سنقوم بتحديثه
    // أو إدراجه إذا لم يوجد (مع id ثابت مثلاً أو بدونه)
    
    // أولاً نتحقق هل يوجد صف
    const { count } = await supabase.from('general_settings').select('*', { count: 'exact', head: true });
    
    let error;
    if (count && count > 0) {
        // تحديث الصف الأول
        // ملاحظة: الأفضل استخدام ID ثابت لو كنت تعرفه، لكن هنا سنحدث أي صف نجده
        const { error: err } = await supabase.from('general_settings').update(settings).neq('id', '00000000-0000-0000-0000-000000000000'); // شرط وهمي لتحديث الكل (عادة صف واحد)
        error = err;
    } else {
        // إدخال جديد
        const { error: err } = await supabase.from('general_settings').insert([settings]);
        error = err;
    }

    if (!error) {
        alert('تم حفظ الإعدادات بنجاح');
        if (onUpdateName) onUpdateName(); // تحديث اسم المركز في الهيدر
    } else {
        alert('خطأ في الحفظ: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center">جاري تحميل الإعدادات...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div className="flex justify-between items-center border-b pb-4">
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                <Settings className="text-emerald-600 w-8 h-8"/> إعدادات النظام الشاملة
            </h2>
            <button 
                onClick={handleSave} 
                disabled={saving}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2 active:scale-95 disabled:bg-gray-400"
            >
                <Save className="w-5 h-5"/> {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* 1. إعدادات المركز الأساسية */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4">
                <h3 className="font-black text-gray-700 flex items-center gap-2 border-b pb-2 mb-4">
                    <Building className="w-5 h-5 text-blue-500"/> بيانات المركز
                </h3>
                <Input 
                    label="اسم المركز الطبي (يظهر في التقارير والهيدر)" 
                    value={settings.center_name} 
                    onChange={(v:any)=>setSettings({...settings, center_name: v})} 
                />
            </div>

            {/* 2. إعدادات المواعيد */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4">
                <h3 className="font-black text-gray-700 flex items-center gap-2 border-b pb-2 mb-4">
                    <Clock className="w-5 h-5 text-purple-500"/> مواعيد العمل الرسمية
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="بداية العمل" type="time" value={settings.work_start_time} onChange={(v:any)=>setSettings({...settings, work_start_time: v})} />
                    <Input label="نهاية العمل" type="time" value={settings.work_end_time} onChange={(v:any)=>setSettings({...settings, work_end_time: v})} />
                </div>
                <Input 
                    label="فترة السماح للتأخير (بالدقائق)" 
                    type="number" 
                    value={settings.lateness_grace_minutes} 
                    onChange={(v:any)=>setSettings({...settings, lateness_grace_minutes: Number(v)})} 
                />
            </div>

            {/* 3. إعدادات الموقع الجغرافي */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4">
                <h3 className="font-black text-gray-700 flex items-center gap-2 border-b pb-2 mb-4">
                    <MapPin className="w-5 h-5 text-red-500"/> الموقع الجغرافي (للبصمة)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="خط العرض (Latitude)" type="number" value={settings.location_lat} onChange={(v:any)=>setSettings({...settings, location_lat: Number(v)})} />
                    <Input label="خط الطول (Longitude)" type="number" value={settings.location_lng} onChange={(v:any)=>setSettings({...settings, location_lng: Number(v)})} />
                </div>
                <Input 
                    label="نطاق البصمة المسموح (بالمتر)" 
                    type="number" 
                    value={settings.allowed_distance_meters} 
                    onChange={(v:any)=>setSettings({...settings, allowed_distance_meters: Number(v)})} 
                />
            </div>

            {/* 4. رصيد الإجازات الافتراضي */}
            <div className="bg-white p-6 rounded-[30px] border shadow-sm space-y-4">
                <h3 className="font-black text-gray-700 flex items-center gap-2 border-b pb-2 mb-4">
                    <Calculator className="w-5 h-5 text-green-500"/> رصيد الإجازات السنوي
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <Input label="الاعتيادية" type="number" value={settings.annual_leave_days} onChange={(v:any)=>setSettings({...settings, annual_leave_days: Number(v)})} />
                    <Input label="العارضة" type="number" value={settings.casual_leave_days} onChange={(v:any)=>setSettings({...settings, casual_leave_days: Number(v)})} />
                </div>
                <p className="text-xs text-gray-400 font-bold">* هذه القيم ستطبق على الموظفين الجدد فقط.</p>
            </div>

        </div>
    </div>
  );
}