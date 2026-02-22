import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    User, Briefcase, Calendar, Award, BookOpen, Edit2, 
    Check, X, Loader2, ShieldCheck, MapPin, FileText, Fingerprint
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SupervisorProfile({ supervisor }: { supervisor: any }) {
    const queryClient = useQueryClient();
    const [isEditing, setIsEditing] = useState(false);

    // حالة النموذج
    const [formData, setFormData] = useState({
        name: supervisor?.name || '',
        avatar_url: supervisor?.avatar_url || '',
        national_id: supervisor?.national_id || '',
        start_date: supervisor?.start_date || '',
        qualification: supervisor?.qualification || '',
        specialty: supervisor?.specialty || '',
        training_courses: supervisor?.training_courses || '',
        notes: supervisor?.notes || ''
    });

    // دالة التحديث
    const updateProfileMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const { error } = await supabase
                .from('supervisors')
                .update(data)
                .eq('id', supervisor.id);
            
            if (error) throw error;
        },
        onSuccess: () => {
            toast.success('تم تحديث البيانات بنجاح! ✅');
            setIsEditing(false);
            queryClient.invalidateQueries({ queryKey: ['current_supervisor'] });
        },
        onError: (err: any) => toast.error(err.message || 'حدث خطأ أثناء التحديث')
    });

    const handleCancel = () => {
        // إعادة القيم لما كانت عليه عند الإلغاء
        setFormData({
            name: supervisor?.name || '',
            avatar_url: supervisor?.avatar_url || '',
            national_id: supervisor?.national_id || '',
            start_date: supervisor?.start_date || '',
            qualification: supervisor?.qualification || '',
            specialty: supervisor?.specialty || '',
            training_courses: supervisor?.training_courses || '',
            notes: supervisor?.notes || ''
        });
        setIsEditing(false);
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden animate-in fade-in">
            {/* Header / Cover */}
            <div className="h-32 md:h-48 bg-gradient-to-r from-purple-600 to-indigo-600 relative">
                <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px]"></div>
                <div className="absolute -bottom-12 md:-bottom-16 right-6 flex items-end gap-4">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-[2rem] p-1.5 shadow-xl rotate-3">
                        <div className="w-full h-full bg-indigo-50 rounded-2xl flex items-center justify-center text-4xl md:text-5xl overflow-hidden border border-indigo-100">
                             {formData.avatar_url && formData.avatar_url.startsWith('http') ? (
                                <img src={formData.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                             ) : (
                                <span>{formData.avatar_url || "👨‍💼"}</span>
                             )}
                        </div>
                    </div>
                </div>
                {!isEditing && (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="absolute top-4 left-4 bg-white/20 hover:bg-white/30 text-white p-2 rounded-xl backdrop-blur-md transition-colors flex items-center gap-2 text-xs font-bold shadow-sm border border-white/20"
                    >
                        <Edit2 size={14}/> تعديل البيانات
                    </button>
                )}
            </div>

            <div className="pt-16 md:pt-20 px-6 pb-6 md:px-8 md:pb-8">
                {isEditing ? (
                    // --- وضع التعديل (Edit Mode) ---
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">الاسم</label>
                                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-purple-500 transition-colors font-bold text-gray-800"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">صورة / إيموجي (رابط أو رمز)</label>
                                <input type="text" value={formData.avatar_url} onChange={e => setFormData({...formData, avatar_url: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-purple-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">الرقم القومي</label>
                                <input type="text" maxLength={14} value={formData.national_id} onChange={e => setFormData({...formData, national_id: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-purple-500 transition-colors font-mono" dir="ltr"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">تاريخ استلام العمل</label>
                                <input type="date" value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-purple-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">المؤهل الدراسي</label>
                                <input type="text" value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-purple-500 transition-colors"/>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">التخصص</label>
                                <input type="text" value={formData.specialty} onChange={e => setFormData({...formData, specialty: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-purple-500 transition-colors"/>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">الدورات التدريبية</label>
                                <input type="text" value={formData.training_courses} onChange={e => setFormData({...formData, training_courses: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-purple-500 transition-colors"/>
                            </div>
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-gray-500 mb-1.5 block">ملاحظات / نبذة</label>
                                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-purple-500 transition-colors h-24 resize-none"></textarea>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button onClick={handleCancel} className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors flex items-center gap-2">
                                <X size={16}/> إلغاء
                            </button>
                            <button onClick={() => updateProfileMutation.mutate(formData)} disabled={updateProfileMutation.isPending} className="px-8 py-2.5 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
                                {updateProfileMutation.isPending ? <Loader2 size={16} className="animate-spin"/> : <Check size={16}/>} 
                                حفظ التعديلات
                            </button>
                        </div>
                    </div>
                ) : (
                    // --- وضع العرض (View Mode) ---
                    <div className="space-y-8">
                        <div>
                            <h2 className="text-2xl font-black text-gray-800">{supervisor?.name}</h2>
                            <div className="flex items-center gap-2 text-gray-500 mt-1">
                                <ShieldCheck size={16} className="text-indigo-500"/>
                                <span className="font-bold">{supervisor?.role_title}</span>
                                <span className="text-gray-300">•</span>
                                <span>{supervisor?.organization}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex gap-3 items-center">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl shrink-0"><Fingerprint size={20}/></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400">الرقم القومي</p>
                                    <p className="font-black text-gray-700 font-mono tracking-widest">{supervisor?.national_id || '---'}</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex gap-3 items-center">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl shrink-0"><Calendar size={20}/></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400">تاريخ استلام العمل</p>
                                    <p className="font-black text-gray-700">{supervisor?.start_date || '---'}</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex gap-3 items-center">
                                <div className="p-2 bg-orange-100 text-orange-600 rounded-xl shrink-0"><Award size={20}/></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400">المؤهل الدراسي</p>
                                    <p className="font-black text-gray-700">{supervisor?.qualification || '---'}</p>
                                </div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex gap-3 items-center">
                                <div className="p-2 bg-pink-100 text-pink-600 rounded-xl shrink-0"><Briefcase size={20}/></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400">التخصص الدقيق</p>
                                    <p className="font-black text-gray-700">{supervisor?.specialty || '---'}</p>
                                </div>
                            </div>
                        </div>

                        {supervisor?.training_courses && (
                            <div className="bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                                <h3 className="text-xs font-black text-purple-800 mb-2 flex items-center gap-2"><BookOpen size={14}/> الدورات التدريبية</h3>
                                <p className="text-sm text-gray-700 font-medium leading-relaxed">{supervisor.training_courses}</p>
                            </div>
                        )}

                        {supervisor?.notes && (
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                <h3 className="text-xs font-black text-gray-500 mb-2 flex items-center gap-2"><FileText size={14}/> ملاحظات / نبذة</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">{supervisor.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
