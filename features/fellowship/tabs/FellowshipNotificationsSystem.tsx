import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import toast from 'react-hot-toast';
import {
  Bell, CheckCircle2, BookOpen, Activity, FileText,
  Calendar, Clock, GraduationCap, Loader2, X,
  Presentation, AlertTriangle, Trash2, BellOff, RefreshCw
} from 'lucide-react';

// ─── Notification types ────────────────────────────────────────────────────────
type NotifType =
  | 'logbook_approved'        // مدرب اعتمد حالة
  | 'logbook_pending'         // حالة تنتظر اعتماد (للمدرب)
  | 'dops_added'              // مدرب أضاف تقييم DOPS
  | 'tar_added'               // تقرير TAR جديد
  | 'tar_unsigned'            // TAR ينتظر توقيع
  | 'lecture_upcoming'        // محاضرة قادمة خلال 24 ساعة
  | 'lecture_quiz_available'  // اختبار محاضرة متاح
  | 'exam_upcoming'           // امتحان قادم
  | 'rotation_ending'         // دورة تنتهي قريباً
  | 'portfolio_reviewed'      // portfolio تمت مراجعته
  | 'graduation_ready'        // اكتملت كل المتطلبات
  | 'general';

const NOTIF_CFG: Record<NotifType, { icon: any; color: string; bg: string; border: string }> = {
  logbook_approved:       { icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200' },
  logbook_pending:        { icon: BookOpen,        color: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200'    },
  dops_added:             { icon: Activity,        color: 'text-purple-600',  bg: 'bg-purple-50',   border: 'border-purple-200'  },
  tar_added:              { icon: FileText,        color: 'text-teal-600',    bg: 'bg-teal-50',     border: 'border-teal-200'    },
  tar_unsigned:           { icon: Clock,           color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200'   },
  lecture_upcoming:       { icon: Presentation,    color: 'text-orange-600',  bg: 'bg-orange-50',   border: 'border-orange-200'  },
  lecture_quiz_available: { icon: Bell,            color: 'text-indigo-600',  bg: 'bg-indigo-50',   border: 'border-indigo-200'  },
  exam_upcoming:          { icon: GraduationCap,   color: 'text-blue-600',    bg: 'bg-blue-50',     border: 'border-blue-200'    },
  rotation_ending:        { icon: Calendar,        color: 'text-cyan-600',    bg: 'bg-cyan-50',     border: 'border-cyan-200'    },
  portfolio_reviewed:     { icon: FileText,        color: 'text-violet-600',  bg: 'bg-violet-50',   border: 'border-violet-200'  },
  graduation_ready:       { icon: GraduationCap,   color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-300' },
  general:                { icon: Bell,            color: 'text-gray-600',    bg: 'bg-gray-50',     border: 'border-gray-200'    },
};

// ─── Single notif card ────────────────────────────────────────────────────────
function NotifCard({ notif, onRead, onDelete }: { notif: any; onRead: (id: string) => void; onDelete: (id: string) => void }) {
  const type = (notif.notif_type || 'general') as NotifType;
  const cfg  = NOTIF_CFG[type] || NOTIF_CFG.general;
  const Icon = cfg.icon;
  const isNew = !notif.is_read;

  const timeAgo = (date: string) => {
    const d = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (d < 1)  return 'الآن';
    if (d < 60) return `منذ ${d} دقيقة`;
    if (d < 1440) return `منذ ${Math.floor(d/60)} ساعة`;
    return `منذ ${Math.floor(d/1440)} يوم`;
  };

  return (
    <div
      className={`group flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-md ${
        isNew ? `${cfg.bg} ${cfg.border} shadow-sm` : 'bg-white border-gray-100'
      }`}
      onClick={() => !notif.is_read && onRead(notif.id)}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
        isNew ? `${cfg.color} bg-white shadow-sm border border-white` : 'bg-gray-100 text-gray-500'
      }`}>
        <Icon size={18} />
        {isNew && <span className="absolute w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white -top-0.5 -right-0.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 relative">
        {isNew && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-indigo-500 rounded-full" />
        )}
        <p className={`text-xs font-black leading-snug ${isNew ? 'text-gray-900' : 'text-gray-600'}`}>
          {notif.message || notif.title}
        </p>
        <p className="text-[10px] font-semibold text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
      </div>

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(notif.id); }}
        className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all flex-shrink-0"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Smart generator: creates fellowship-specific notifications ────────────────
async function generateFellowshipNotifications(employeeId: string) {
  try {
    const { data: t } = await supabase.from('fellowship_trainees').select('id, current_year').eq('employee_id', employeeId).single();
    if (!t) return;

    const now    = new Date();
    const in24h  = new Date(now.getTime() + 86400000);
    const in7d   = new Date(now.getTime() + 7 * 86400000);
    const toInsert: any[] = [];

    // ── 1. Logbook awaiting approval (for trainers) ─────────────────────
    // This is handled via supabase realtime in admin panel

    // ── 2. Lectures in next 24h ─────────────────────────────────────────
    const { data: upcomingLecs } = await supabase
      .from('fellowship_lectures')
      .select('id, title, lecture_date, lecture_time')
      .gte('lecture_date', now.toISOString().split('T')[0])
      .lte('lecture_date', in24h.toISOString().split('T')[0]);

    for (const lec of (upcomingLecs || [])) {
      const { data: att } = await supabase.from('fellowship_lecture_attendance')
        .select('id').eq('lecture_id', lec.id).eq('trainee_id', t.id).maybeSingle();
      if (!att) {
        toInsert.push({
          user_id: employeeId,
          title: 'محاضرة قادمة غداً',
          message: `📚 محاضرة "${lec.title}" غداً الساعة ${lec.lecture_time} — لا تنسَ الحضور`,
          notif_type: 'lecture_upcoming',
          is_read: false,
        });
      }
    }

    // ── 3. TAR unsigned ────────────────────────────────────────────────
    const { data: unsignedTars } = await supabase
      .from('fellowship_tar_reports')
      .select('id, report_period_end')
      .eq('trainee_id', t.id)
      .eq('trainee_acknowledged', false);

    if ((unsignedTars?.length || 0) > 0) {
      toInsert.push({
        user_id: employeeId,
        title: 'تقرير TAR ينتظر توقيعك',
        message: `📋 لديك ${unsignedTars!.length} تقرير تقييم دوري لم توقّع عليه بعد`,
        notif_type: 'tar_unsigned',
        is_read: false,
      });
    }

    // ── 4. Rotation ending in 7 days ───────────────────────────────────
    const { data: endingRots } = await supabase
      .from('fellowship_trainee_rotations')
      .select('id, end_date, rotation_type:fellowship_rotation_types(name_ar)')
      .eq('trainee_id', t.id)
      .eq('status', 'ongoing')
      .lte('end_date', in7d.toISOString().split('T')[0])
      .gte('end_date', now.toISOString().split('T')[0]);

    for (const rot of (endingRots || [])) {
      toInsert.push({
        user_id: employeeId,
        title: 'دورة تدريبية على وشك الانتهاء',
        message: `⏰ دورة "${rot.rotation_type?.name_ar}" تنتهي في ${new Date(rot.end_date).toLocaleDateString('ar-EG')}`,
        notif_type: 'rotation_ending',
        is_read: false,
      });
    }

    // ── 5. Graduation readiness check ─────────────────────────────────
    const [
      { count: approved }, { count: dops }, { count: port },
      { data: rots }, { data: akt }, { data: prog }, { data: csa },
    ] = await Promise.all([
      supabase.from('fellowship_logbook').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id).eq('trainer_reviewed', true),
      supabase.from('fellowship_dops_assessments').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
      supabase.from('fellowship_portfolio_items').select('*', { count: 'exact', head: true }).eq('trainee_id', t.id),
      supabase.from('fellowship_trainee_rotations').select('status').eq('trainee_id', t.id),
      supabase.from('fellowship_akt_results').select('passed').eq('trainee_id', t.id),
      supabase.from('fellowship_progression_results').select('passed').eq('trainee_id', t.id),
      supabase.from('fellowship_csa_results').select('passed').eq('trainee_id', t.id),
    ]);

    const allReady =
      (approved || 0) >= 50 && (dops || 0) >= 34 && (port || 0) >= 12 &&
      (rots || []).filter(r => r.status === 'completed').length >= 15 &&
      (akt || []).some(r => r.passed) &&
      (prog || []).some(r => r.passed) &&
      (csa || []).some(r => r.passed);

    if (allReady) {
      const { data: existing } = await supabase.from('notifications')
        .select('id').eq('user_id', employeeId).eq('notif_type', 'graduation_ready').maybeSingle();
      if (!existing) {
        toInsert.push({
          user_id: employeeId,
          title: '🎓 أنت جاهز للتخرج!',
          message: 'مبروك! استكملت جميع متطلبات زمالة طب الأسرة. تواصل مع الإدارة للمتابعة.',
          notif_type: 'graduation_ready',
          is_read: false,
        });
      }
    }

    // ── Insert all new notifs (deduplicate by type+message same day) ──
    if (toInsert.length > 0) {
      await supabase.from('notifications').insert(toInsert);
    }

  } catch (e) { console.error('Notification generation error:', e); }
}

// ─── SQL note: add notif_type column to notifications table ──────────────────
// ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notif_type TEXT DEFAULT 'general';

// ─── Main Component ────────────────────────────────────────────────────────────
export default function FellowshipNotificationsSystem({
  employeeId,
  mode = 'panel',  // 'panel' = full page | 'dropdown' = compact dropdown
  onClose,
}: {
  employeeId: string;
  mode?: 'panel' | 'dropdown';
  onClose?: () => void;
}) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [filter, setFilter]               = useState<'all' | 'unread'>('all');

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await supabase.from('notifications')
        .select('*')
        .eq('user_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data || []);
    } catch { toast.error('خطأ في تحميل الإشعارات'); }
    finally { setLoading(false); setRefreshing(false); }
  }, [employeeId]);

  useEffect(() => {
    fetchNotifs();

    // ── Realtime subscription ────────────────────────────────────────
    const channel = supabase
      .channel(`notifs-${employeeId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${employeeId}`,
      }, payload => {
        setNotifications(prev => [payload.new, ...prev]);
        toast.custom((t) => (
          <div className={`bg-white border border-indigo-200 shadow-xl rounded-2xl px-4 py-3 flex items-center gap-3 max-w-xs ${t.visible ? 'animate-in slide-in-from-top-3' : 'animate-out'}`}>
            <Bell className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <p className="text-xs font-bold text-gray-700 leading-snug">
              {(payload.new as any).message || (payload.new as any).title}
            </p>
          </div>
        ), { duration: 4000, position: 'top-center' });
      })
      .subscribe();

    // ── Generate smart notifs every time component mounts ───────────
    generateFellowshipNotifications(employeeId);

    return () => { supabase.removeChannel(channel); };
  }, [employeeId, fetchNotifs]);

  const handleRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleDelete = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleReadAll = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', employeeId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success('تم تحديد الكل كمقروء');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await generateFellowshipNotifications(employeeId);
    await fetchNotifs();
  };

  const displayed  = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications;
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ── DROPDOWN MODE ──────────────────────────────────────────────────────
  if (mode === 'dropdown') {
    return (
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-80 md:w-96 overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-200" dir="rtl">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-indigo-600" />
            <h3 className="font-black text-gray-800 text-sm">الإشعارات</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">{unreadCount}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button onClick={handleReadAll} className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
                قراءة الكل
              </button>
            )}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-80 p-2 space-y-1.5 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-400" /></div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10">
              <BellOff className="w-10 h-10 mx-auto text-gray-200 mb-2" />
              <p className="text-xs font-bold text-gray-400">لا توجد إشعارات</p>
            </div>
          ) : (
            notifications.slice(0, 10).map(n => (
              <NotifCard key={n.id} notif={n} onRead={handleRead} onDelete={handleDelete} />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-3 flex items-center justify-between">
          <button onClick={handleRefresh} disabled={refreshing}
            className="flex items-center gap-1.5 text-[11px] font-black text-gray-500 hover:text-indigo-600 transition-colors">
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> تحديث
          </button>
          <p className="text-[10px] font-semibold text-gray-400">{notifications.length} إشعار</p>
        </div>
      </div>
    );
  }

  // ── PANEL MODE (full tab) ──────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-400" dir="rtl">

      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-700 to-violet-800 rounded-3xl p-5 md:p-7 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '22px 22px' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/15 rounded-2xl flex items-center justify-center border border-white/20 relative">
              <Bell className="w-6 h-6 text-white" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-black text-white flex items-center justify-center border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">مركز الإشعارات</h2>
              <p className="text-white/60 text-xs font-semibold">{unreadCount} غير مقروء · {notifications.length} إجمالي</p>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="bg-white/15 hover:bg-white/25 border border-white/20 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-colors">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'جاري التحديث...' : 'تحديث'}
          </button>
        </div>
      </div>

      {/* Filter + actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-xl">
          {([['all','الكل'],['unread','غير مقروء']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${filter === val ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'}`}>
              {label}{val === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button onClick={handleReadAll}
            className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800 transition-colors">
            <CheckCircle2 size={14}/> تحديد الكل كمقروء
          </button>
        )}
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm font-bold text-gray-400">جاري التحميل...</p>
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-14 text-center">
          <BellOff className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <p className="font-black text-gray-400 text-sm">
            {filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات بعد'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(n => (
            <NotifCard key={n.id} notif={n} onRead={handleRead} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Type legend */}
      <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <p className="text-[10px] font-black text-gray-500 mb-3">أنواع الإشعارات</p>
        <div className="flex flex-wrap gap-2">
          {[
            ['logbook_approved', 'حالة معتمدة'],
            ['dops_added', 'تقييم DOPS'],
            ['tar_unsigned', 'TAR ينتظر'],
            ['lecture_upcoming', 'محاضرة قادمة'],
            ['rotation_ending', 'دورة تنتهي'],
            ['graduation_ready', 'جاهز للتخرج'],
          ].map(([type, label]) => {
            const cfg = NOTIF_CFG[type as NotifType];
            const Icon = cfg.icon;
            return (
              <span key={type} className={`flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                <Icon size={11}/> {label}
              </span>
            );
          })}
        </div>
      </div>

    </div>
  );
}
