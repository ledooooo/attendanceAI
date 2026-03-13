import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { User, Activity, FileText, Edit2, Save, X, Loader2, Stethoscope, Heart, Droplet } from 'lucide-react';

export default function PatientProfile({ patientId }: { patientId: string }) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (patientId && patientId !== 'guest') fetchProfile();
    }, [patientId]);

    const fetchProfile = async () => {
        setLoading(true);
        const { data } = await supabase.from('patients').select('*').eq('id', patientId).single();
        if (data) {
            setProfile(data);
            setFormData(data);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase.from('patients').update({
            blood_group: formData.blood_group,
            weight: formData.weight,
            height: formData.height,
            is_smoking: formData.is_smoking,
            has_chronic_diseases: formData.has_chronic_diseases,
            chronic_diseases_notes: formData.chronic_diseases_notes,
        }).eq('id', patientId);

        if (error) {
            toast.error('حدث خطأ أثناء الحفظ');
        } else {
            toast.success('تم تحديث الملف الطبي بنجاح');
            setProfile(formData);
            setEditMode(false);
        }
        setSaving(false);
    };

    if (patientId === 'guest') return null; // حماية إضافية
    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>;
    if (!profile) return null;

    return (
        <div className="animate-in fade-in space-y-6">
            {/* الكارت التعريفي الرئيسي */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-[2rem] shadow-lg shadow-blue-200 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full blur-3xl"></div>
                <div className="flex items-center gap-5 relative z-10">
                    <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-sm">
                        <User size={32} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black">{profile.full_name}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-lg backdrop-blur-sm">رقم الملف: {profile.file_number}</span>
                            <span className="text-xs font-bold bg-white/10 px-3 py-1 rounded-lg backdrop-blur-sm">{profile.gender}</span>
                        </div>
                    </div>
                </div>
                <div className="relative z-10 w-full md:w-auto">
                    {!editMode ? (
                        <button onClick={() => setEditMode(true)} className="w-full md:w-auto bg-white/20 hover:bg-white/30 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-all backdrop-blur-md border border-white/20">
                            <Edit2 size={16} /> تعديل البيانات الطبية
                        </button>
                    ) : (
                        <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={handleSave} disabled={saving} className="flex-1 md:flex-none bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black text-sm flex justify-center items-center gap-2 transition-all shadow-md">
                                {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />} حفظ
                            </button>
                            <button onClick={() => {setEditMode(false); setFormData(profile);}} className="bg-red-400/20 hover:bg-red-400/40 text-white px-4 py-2.5 rounded-xl font-black flex justify-center items-center transition-all border border-red-300/30">
                                <X size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* البطاقة الأولى: القياسات */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col h-full">
                    <h3 className="font-black text-rose-600 mb-5 flex items-center gap-2 text-lg"><Activity size={20}/> القياسات الحيوية</h3>
                    <div className="space-y-4 flex-1">
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <span className="text-gray-500 font-bold text-sm flex items-center gap-2"><Droplet size={16} className="text-rose-400"/> فصيلة الدم</span>
                            {editMode ? 
                                <select value={formData.blood_group} onChange={e => setFormData({...formData, blood_group: e.target.value})} className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm font-black outline-none focus:ring-2 focus:ring-blue-500 bg-white" dir="ltr">
                                    <option>غير معروف</option><option>A+</option><option>O+</option><option>B+</option><option>AB+</option><option>A-</option><option>O-</option><option>B-</option><option>AB-</option>
                                </select> 
                            : <span className="font-black text-gray-800 text-lg" dir="ltr">{profile.blood_group}</span>}
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <span className="text-gray-500 font-bold text-sm">الوزن (كجم)</span>
                            {editMode ? <input type="number" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: e.target.value})} className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm font-black w-24 outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white"/> : <span className="font-black text-gray-800 text-lg">{profile.weight || '-'}</span>}
                        </div>
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <span className="text-gray-500 font-bold text-sm">الطول (سم)</span>
                            {editMode ? <input type="number" value={formData.height || ''} onChange={e => setFormData({...formData, height: e.target.value})} className="border border-gray-300 rounded-xl px-3 py-1.5 text-sm font-black w-24 outline-none focus:ring-2 focus:ring-blue-500 text-center bg-white"/> : <span className="font-black text-gray-800 text-lg">{profile.height || '-'}</span>}
                        </div>
                    </div>
                </div>

                {/* البطاقة الثانية: الحالة الصحية */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col h-full">
                    <h3 className="font-black text-blue-600 mb-5 flex items-center gap-2 text-lg"><Heart size={20}/> الحالة الصحية</h3>
                    <div className="space-y-4 flex-1">
                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <span className="text-gray-500 font-bold text-sm">أمراض مزمنة</span>
                            {editMode ? 
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={formData.has_chronic_diseases} onChange={e => setFormData({...formData, has_chronic_diseases: e.target.checked})} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            : <span className={`font-black text-xs px-3 py-1.5 rounded-lg border ${profile.has_chronic_diseases ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{profile.has_chronic_diseases ? 'يوجد أمراض مزمنة' : 'لا يوجد'}</span>}
                        </div>

                        {formData.has_chronic_diseases && (
                            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 transition-all duration-300">
                                <span className="text-blue-800 font-black text-xs block mb-2">يرجى توضيح الأمراض المزمنة:</span>
                                {editMode ? 
                                    <textarea value={formData.chronic_diseases_notes || ''} onChange={e => setFormData({...formData, chronic_diseases_notes: e.target.value})} className="border border-blue-200 rounded-xl p-3 text-sm font-bold w-full outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none" rows={2}/> 
                                : <p className="font-black text-blue-900 text-sm leading-relaxed">{profile.chronic_diseases_notes}</p>}
                            </div>
                        )}

                        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <span className="text-gray-500 font-bold text-sm">التدخين</span>
                            {editMode ? 
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={formData.is_smoking} onChange={e => setFormData({...formData, is_smoking: e.target.checked})} className="sr-only peer" />
                                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            : <span className={`font-black text-xs px-3 py-1.5 rounded-lg border ${profile.is_smoking ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>{profile.is_smoking ? 'مدخن' : 'غير مدخن'}</span>}
                        </div>
                    </div>
                </div>

                {/* البطاقة الثالثة: معلومات ثابتة */}
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 md:col-span-2">
                    <h3 className="font-black text-teal-600 mb-5 flex items-center gap-2 text-lg"><FileText size={20}/> معلومات أساسية مسجلة</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                            <p className="text-gray-400 font-bold text-xs mb-1.5">تاريخ الميلاد</p>
                            <p className="font-black text-gray-800">{profile.birth_date || 'غير مسجل'}</p>
                        </div>
                        <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                            <p className="text-gray-400 font-bold text-xs mb-1.5">الرقم القومي</p>
                            <p className="font-black text-gray-800">{profile.national_id}</p>
                        </div>
                        <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                            <p className="text-gray-400 font-bold text-xs mb-1.5">رقم الهاتف</p>
                            <p className="font-black text-gray-800" dir="ltr">{profile.phone || 'غير مسجل'}</p>
                        </div>
                        <div className="bg-gray-50/80 p-4 rounded-2xl border border-gray-100">
                            <p className="text-gray-400 font-bold text-xs mb-1.5">الحالة الاجتماعية</p>
                            <p className="font-black text-gray-800">{profile.marital_status}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
