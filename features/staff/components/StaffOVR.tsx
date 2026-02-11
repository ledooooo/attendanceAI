import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Employee, OVRReport } from '../../../types';
import { 
    AlertTriangle, Send, FileText, MapPin, Clock, 
    Eye, EyeOff, RefreshCcw, CheckCircle, Image as ImageIcon, X, UploadCloud
} from 'lucide-react';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

const PREDEFINED_LOCATIONS = [
    'عيادة طب الاسرة', 'عيادة الاسنان', 'المعمل', 'دار الولادة', 
    'شئون العاملين', 'المبادرات', 'المدير', 'العلاج الطبيعى', 
    'مكتب الصحة', 'الاستراحة', 'غرفة التمريض', 'شباك التذاكر', 'اخرى'
];

export default function StaffOVR({ employee }: { employee: Employee }) {
    const [loading, setLoading] = useState(false);
    const [myReports, setMyReports] = useState<OVRReport[]>([]);
    const [isAnonymous, setIsAnonymous] = useState(false);
    
    // حالة للتحقق من الحد اليومي (1 فقط يومياً)
    const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
    const [checkingLimit, setCheckingLimit] = useState(true);

    const [form, setForm] = useState({
        incident_date: new Date().toISOString().split('T')[0],
        incident_time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        description: '',
        action_taken: ''
    });

    // حالات المكان
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [otherLocationText, setOtherLocationText] = useState('');

    // حالة الصورة
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    useEffect(() => {
        fetchMyReports();
        checkDailyLimit();
    }, []);

    const fetchMyReports = async () => {
        const { data } = await supabase
            .from('ovr_reports')
            .select('*')
            .eq('reporter_id', employee.employee_id) 
            .order('created_at', { ascending: false });
            
        if (data) setMyReports(data as any);
    };

    const checkDailyLimit = async () => {
        setCheckingLimit(true);
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
            .from('ovr_reports')
            .select('id')
            .eq('reporter_id', employee.employee_id)
            .gte('created_at', `${today}T00:00:00.000Z`)
            .lte('created_at', `${today}T23:59:59.999Z`);
        
        if (data && data.length > 0) {
            setHasSubmittedToday(true);
        }
        setCheckingLimit(false);
    };

    const toggleLocation = (loc: string) => {
        if (selectedLocations.includes(loc)) {
            setSelectedLocations(prev => prev.filter(l => l !== loc));
        } else {
            setSelectedLocations(prev => [...prev, loc]);
        }
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const clearImage = () => {
        setImageFile(null);
        setImagePreview(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (selectedLocations.length === 0) {
            toast.error('الرجاء اختيار مكان الواقعة');
            return;
        }

        setLoading(true);

        try {
            // 1. رفع الصورة إذا وجدت
            let imageUrl = null;
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}_${employee.employee_id}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('ovr-images')
                    .upload(fileName, imageFile);
                
                if (uploadError) throw new Error('فشل رفع الصورة');

                const { data: publicUrlData } = supabase.storage.from('ovr-images').getPublicUrl(fileName);
                imageUrl = publicUrlData.publicUrl;
            }

            // 2. تجميع أماكن الواقعة كنص
            let finalLocation = selectedLocations.join('، ');
            if (selectedLocations.includes('اخرى') && otherLocationText.trim() !== '') {
                finalLocation = finalLocation.replace('اخرى', `أخرى (${otherLocationText})`);
            }

            // 3. إدراج التقرير
            const { error: insertError } = await supabase.from('ovr_reports').insert({
                reporter_id: employee.employee_id,
                reporter_name: employee.name,
                is_anonymous: isAnonymous,
                location: finalLocation,
                image_url: imageUrl,
                ...form,
                status: 'new'
            });

            if (insertError) throw insertError;

            // 4. إضافة 15 نقطة للموظف
            await supabase.rpc('increment_points', { emp_id: employee.employee_id, amount: 15 });
            await supabase.from('points_ledger').insert({
                employee_id: employee.employee_id,
                points: 15,
                reason: 'إرسال تقرير OVR للارتقاء بالجودة'
            });

            // 5. إرسال إشعار لمسؤولي الجودة
            const { data: qManagers } = await supabase.from('employees').select('employee_id').eq('role', 'quality_manager').eq('status', 'نشط');
            if (qManagers && qManagers.length > 0) {
                const notifs = qManagers.map(qm => ({
                    user_id: qm.employee_id,
                    title: '🚨 تقرير OVR جديد',
                    message: `تم إرسال تقرير OVR جديد ${isAnonymous ? '(مجهول المصدر)' : `بواسطة ${employee.name}`}. يرجى المراجعة.`,
                    type: 'ovr',
                    is_read: false
                }));
                await supabase.from('notifications').insert(notifs);
            }

            // 6. إنهاء بنجاح
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            toast.success('تم إرسال التقرير بنجاح! حصلت على 15 نقطة ⭐');
            
            setForm({ ...form, description: '', action_taken: '' });
            setSelectedLocations([]);
            setOtherLocationText('');
            clearImage();
            setHasSubmittedToday(true);
            fetchMyReports();

        } catch (err: any) {
            toast.error(err.message || 'حدث خطأ أثناء الإرسال');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            
            {/* نموذج الإرسال */}
            <div className="bg-white p-6 rounded-[30px] border border-red-100 shadow-sm">
                <div className="flex justify-between items-center mb-6 border-b border-red-50 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-50 p-3 rounded-full">
                            <AlertTriangle className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-gray-800">إبلاغ عن واقعة (OVR)</h3>
                            <p className="text-xs text-gray-500 font-bold">تقرير سري يذهب لمسؤول الجودة مباشرة</p>
                        </div>
                    </div>
                    {/* شارة توضح أنه بمكافأة */}
                    <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1">
                        +15 نقطة 🌟
                    </div>
                </div>

                {checkingLimit ? (
                    <div className="py-10 text-center text-gray-400 font-bold animate-pulse">جاري التحقق...</div>
                ) : hasSubmittedToday ? (
                    <div className="bg-green-50 border-2 border-green-200 rounded-3xl p-8 text-center">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h4 className="text-xl font-black text-green-800 mb-2">شكراً لتعاونك!</h4>
                        <p className="text-sm font-bold text-green-700 leading-relaxed">
                            لقد قمت بإرسال تقرير OVR اليوم بالفعل وحصلت على نقاطك.<br/>
                            لضمان جودة المتابعة، يُسمح بإرسال تقرير واحد فقط يومياً لكل موظف.
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* خيار مجهول */}
                        <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <input 
                                type="checkbox" 
                                id="anon" 
                                checked={isAnonymous} 
                                onChange={e => setIsAnonymous(e.target.checked)}
                                className="w-5 h-5 accent-red-600 cursor-pointer"
                            />
                            <label htmlFor="anon" className="text-sm font-bold text-gray-700 cursor-pointer flex items-center gap-2 select-none">
                                {isAnonymous ? <EyeOff className="w-4 h-4 text-red-500"/> : <Eye className="w-4 h-4 text-emerald-500"/>}
                                إرسال كـ "مجهول الهوية" (لن يظهر اسمك عند العرض)
                            </label>
                        </div>

                        {/* التاريخ والوقت */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">تاريخ الواقعة</label>
                                <input type="date" required className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                    value={form.incident_date} onChange={e => setForm({...form, incident_date: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-2">وقت الواقعة</label>
                                <input type="time" required className="w-full p-3 rounded-xl border bg-gray-50 font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                    value={form.incident_time} onChange={e => setForm({...form, incident_time: e.target.value})} />
                            </div>
                        </div>

                        {/* المكان (اختيار من متعدد) */}
                        <div className="bg-red-50/30 p-4 rounded-2xl border border-red-50">
                            <label className="block text-xs font-black text-red-800 mb-3 flex items-center gap-1">
                                <MapPin className="w-4 h-4" /> مكان الواقعة (يمكن اختيار أكثر من مكان)
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {PREDEFINED_LOCATIONS.map(loc => (
                                    <button
                                        key={loc}
                                        type="button"
                                        onClick={() => toggleLocation(loc)}
                                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                                            selectedLocations.includes(loc) 
                                            ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-200' 
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-red-50'
                                        }`}
                                    >
                                        {loc}
                                    </button>
                                ))}
                            </div>
                            
                            {/* حقل نصي يظهر إذا تم اختيار "اخرى" */}
                            {selectedLocations.includes('اخرى') && (
                                <div className="mt-3 animate-in fade-in slide-in-from-top-2">
                                    <input 
                                        type="text" 
                                        placeholder="يرجى تحديد المكان بدقة..." 
                                        required 
                                        className="w-full p-3 rounded-xl border border-red-200 bg-white font-bold text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                        value={otherLocationText} 
                                        onChange={e => setOtherLocationText(e.target.value)} 
                                    />
                                </div>
                            )}
                        </div>

                        {/* الوصف */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2">وصف الواقعة بدقة</label>
                            <textarea required placeholder="اشرح ما حدث بالتفصيل (من، ماذا، أين، كيف)..." className="w-full p-4 rounded-xl border bg-gray-50 font-medium text-sm h-32 focus:ring-2 focus:ring-red-500 outline-none transition-all resize-none leading-relaxed"
                                value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
                        </div>

                        {/* الإجراء */}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-2">الإجراء الفوري المتخذ</label>
                            <input type="text" placeholder="ماذا فعلت فور حدوث الواقعة للسيطرة عليها؟" className="w-full p-3 rounded-xl border bg-gray-50 font-medium text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all"
                                value={form.action_taken} onChange={e => setForm({...form, action_taken: e.target.value})} />
                        </div>

                        {/* رفع صورة اختيارية */}
                        <div className="bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-300">
                            <label className="block text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">
                                <ImageIcon className="w-4 h-4" /> إرفاق صورة (اختياري)
                            </label>
                            
                            {!imagePreview ? (
                                <label className="flex flex-col items-center justify-center w-full h-24 bg-white rounded-xl border border-gray-200 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors group">
                                    <UploadCloud className="w-6 h-6 text-gray-400 group-hover:text-indigo-500 mb-2" />
                                    <span className="text-xs font-bold text-gray-500 group-hover:text-indigo-600">اضغط لرفع صورة من جهازك</span>
                                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                                </label>
                            ) : (
                                <div className="relative w-32 h-32 rounded-xl overflow-hidden border shadow-sm mx-auto">
                                    <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                                    <button type="button" onClick={clearImage} className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-full hover:bg-red-700 shadow-lg">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        <button type="submit" disabled={loading} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black hover:bg-red-700 active:scale-95 transition-all shadow-xl shadow-red-200 flex justify-center items-center gap-2 text-lg">
                            {loading ? 'جاري الإرسال والتوثيق...' : <><Send className="w-6 h-6 rtl:rotate-180"/> إرسال التقرير النهائي</>}
                        </button>
                    </form>
                )}
            </div>

            {/* قائمة تقاريري السابقة */}
            <div className="bg-white p-6 rounded-[30px] border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-lg text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-gray-500"/> تقاريري السابقة
                    </h3>
                    <button onClick={fetchMyReports} className="text-gray-400 hover:text-indigo-600 bg-gray-50 p-2 rounded-full transition-colors">
                        <RefreshCcw className="w-4 h-4"/>
                    </button>
                </div>
                
                <div className="space-y-4">
                    {myReports.length === 0 ? (
                        <div className="text-center bg-gray-50 rounded-2xl p-8 border border-dashed">
                            <p className="text-gray-400 font-bold text-sm">لم تقم بإرسال أي تقارير OVR حتى الآن</p>
                        </div>
                    ) : (
                        myReports.map(rep => (
                            <div key={rep.id} className="border border-gray-100 rounded-2xl p-5 hover:shadow-md transition-shadow bg-white">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-gray-100 p-2 rounded-xl"><Calendar className="w-4 h-4 text-gray-500"/></div>
                                        <div>
                                            <span className="text-xs font-black text-gray-800 block">{rep.incident_date}</span>
                                            <span className="text-[10px] font-bold text-gray-400">{rep.incident_time}</span>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border ${
                                        rep.status === 'new' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-green-50 text-green-700 border-green-200'
                                    }`}>
                                        {rep.status === 'new' ? 'قيد المراجعة' : 'تم الرد'}
                                    </span>
                                </div>
                                
                                <div className="bg-gray-50 p-3 rounded-xl mb-3 border border-gray-100">
                                    <p className="text-xs font-bold text-indigo-700 mb-1 flex items-center gap-1"><MapPin className="w-3 h-3"/> {rep.location}</p>
                                    <p className="text-sm font-medium text-gray-700 leading-relaxed line-clamp-2">{rep.description}</p>
                                </div>

                                {/* عرض الصورة إذا وجدت (Thumbnail مصغر) */}
                                {/* @ts-ignore */}
                                {rep.image_url && (
                                    <div className="mb-3">
                                        {/* @ts-ignore */}
                                        <a href={rep.image_url} target="_blank" rel="noreferrer" className="inline-block relative rounded-lg overflow-hidden border shadow-sm hover:opacity-80 transition-opacity">
                                            {/* @ts-ignore */}
                                            <img src={rep.image_url} alt="مرفق" className="w-16 h-16 object-cover" />
                                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                <Eye className="w-4 h-4 text-white" />
                                            </div>
                                        </a>
                                    </div>
                                )}
                                
                                {rep.quality_response && (
                                    <div className="bg-emerald-50 p-4 rounded-xl text-sm text-emerald-900 border border-emerald-100 relative">
                                        <div className="absolute -top-3 right-4 bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-black">رد الجودة</div>
                                        <p className="font-bold leading-relaxed">{rep.quality_response}</p>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
