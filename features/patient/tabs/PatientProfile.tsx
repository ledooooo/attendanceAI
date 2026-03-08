import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import { User, Activity, FileText, AlertCircle, Edit2, Save, X, Loader2, Heart } from 'lucide-react';

export default function PatientProfile({ patientId }: { patientId: string }) {
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (patientId) fetchProfile();
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

    if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
    if (!profile) return null;

    return (
        <div className="animate-in fade-in space-y-6">
            <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                        <User size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-800">{profile.full_name}</h2>
                        <p className="text-sm font-bold text-gray-500 mt-1">رقم الملف: <span className="text-blue-600 bg-blue-50 px-2 rounded">{profile.file_number}</span> | {profile.gender}</p>
                    </div>
                </div>
                {!editMode ? (
                    <button onClick={() => setEditMode(true)} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-200 transition">
                        <Edit2 size={16} /> تعديل البيانات
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={handleSave} disabled={saving} className="bg-green-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-green-600 transition">
                            {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />} حفظ
                        </button>
                        <button onClick={() => {setEditMode(false); setFormData(profile);}} className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-red-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* البطاقة الأولى: القياسات */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="font-black text-rose-600 mb-4 flex items-center gap-2"><Activity size={18}/> القياسات الحيوية</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-gray-500 font-bold text-sm">فصيلة الدم</span>
                            {editMode ? <select value={formData.blood_group} onChange={e => setFormData({...formData, blood_group: e.target.value})} className="border rounded p-1 text-sm font-bold outline-none" dir="ltr"><option>غير معروف</option><option>A+</option><option>O+</option><option>B+</option><option>AB+</option><option>A-</option><option>O-</option><option>B-</option><option>AB-</option></select> : <span className="font-black text-gray-800" dir="ltr">{profile.blood_group}</span>}
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-gray-500 font-bold text-sm">الوزن (كجم)</span>
                            {editMode ? <input type="number" value={formData.weight || ''} onChange={e => setFormData({...formData, weight: e.target.value})} className="border rounded p-1 text-sm font-bold w-20 outline-none text-center"/> : <span className="font-black text-gray-800">{profile.weight || '-'}</span>}
                        </div>
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-gray-500 font-bold text-sm">الطول (سم)</span>
                            {editMode ? <input type="number" value={formData.height || ''} onChange={e => setFormData({...formData, height: e.target.value})} className="border rounded p-1 text-sm font-bold w-20 outline-none text-center"/> : <span className="font-black text-gray-800">{profile.height || '-'}</span>}
                        </div>
                    </div>
                </div>

                {/* البطاقة الثانية: الأمراض المزمنة */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
                    <h3 className="font-black text-blue-600 mb-4 flex items-center gap-2"><Heart size={18}/> الحالة الصحية</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-gray-500 font-bold text-sm">أمراض مزمنة</span>
                            {editMode ? <input type="checkbox" checked={formData.has_chronic_diseases} onChange={e => setFormData({...formData, has_chronic_diseases: e.target.checked})} className="w-4 h-4" /> : <span className={`font-black text-xs px-2 py-1 rounded ${profile.has_chronic_diseases ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>{profile.has_chronic_diseases ? 'نعم' : 'لا يوجد'}</span>}
                        </div>
                        {formData.has_chronic_diseases && (
                            <div className="border-b pb-2">
                                <span className="text-gray-500 font-bold text-sm block mb-1">تفاصيل الأمراض:</span>
                                {editMode ? <input type="text" value={formData.chronic_diseases_notes || ''} onChange={e => setFormData({...formData, chronic_diseases_notes: e.target.value})} className="border rounded p-1 text-sm font-bold w-full outline-none"/> : <span className="font-black text-gray-800 text-sm">{profile.chronic_diseases_notes}</span>}
                            </div>
                        )}
                        <div className="flex justify-between items-center border-b pb-2">
                            <span className="text-gray-500 font-bold text-sm">مدخن</span>
                            {editMode ? <input type="checkbox" checked={formData.is_smoking} onChange={e => setFormData({...formData, is_smoking: e.target.checked})} className="w-4 h-4" /> : <span className={`font-black text-xs px-2 py-1 rounded ${profile.is_smoking ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{profile.is_smoking ? 'نعم' : 'لا'}</span>}
                        </div>
                    </div>
                </div>

                {/* البطاقة الثالثة: معلومات ثابتة */}
                <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 md:col-span-2">
                    <h3 className="font-black text-teal-600 mb-4 flex items-center gap-2"><FileText size={18}/> معلومات أخرى (للعرض فقط)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="bg-gray-50 p-3 rounded-xl"><p className="text-gray-400 font-bold text-xs mb-1">تاريخ الميلاد</p><p className="font-black text-gray-800">{profile.birth_date || 'غير مسجل'}</p></div>
                        <div className="bg-gray-50 p-3 rounded-xl"><p className="text-gray-400 font-bold text-xs mb-1">الرقم القومي</p><p className="font-black text-gray-800">{profile.national_id}</p></div>
                        <div className="bg-gray-50 p-3 rounded-xl"><p className="text-gray-400 font-bold text-xs mb-1">رقم الهاتف</p><p className="font-black text-gray-800" dir="ltr">{profile.phone || 'غير مسجل'}</p></div>
                        <div className="bg-gray-50 p-3 rounded-xl"><p className="text-gray-400 font-bold text-xs mb-1">الحالة الاجتماعية</p><p className="font-black text-gray-800">{profile.marital_status}</p></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
