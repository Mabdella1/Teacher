import React, { useState, useEffect } from 'react';
import { Student, Appointment } from '../types';
import { Calendar, Plus, Clock, Trash2, X, CalendarDays, ClipboardCheck, AlertTriangle, GripVertical, RefreshCw, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatTimeTo12h } from '../lib/timeUtils';
import { initAuth, googleSignIn, logout, getAccessToken } from '../lib/firebaseAuth';
import { syncAppointmentsToGoogleCalendar } from '../lib/googleCalendar';
import { User } from 'firebase/auth';

interface SchedulerProps {
  students: Student[];
  appointments: Appointment[];
  onAddAppointment: (appointmentData: Omit<Appointment, 'id'>) => void;
  onDeleteAppointment: (id: string) => void;
  onUpdateAppointmentDay?: (id: string, newDay: string) => void;
}

const DAYS_OF_WEEK = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

export default function Scheduler({ students, appointments, onAddAppointment, onDeleteAppointment, onUpdateAppointmentDay }: SchedulerProps) {
  const DAYS_AR_MAP: Record<number, string> = {
    0: 'الأحد',
    1: 'الاثنين',
    2: 'الثلاثاء',
    3: 'الأربعاء',
    4: 'الخميس',
    5: 'الجمعة',
    6: 'السبت'
  };

  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedDay, setSelectedDay] = useState('السبت');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [appointmentTime, setAppointmentTime] = useState('16:00');
  const [notes, setNotes] = useState('');
  const [deleteConfirmApp, setDeleteConfirmApp] = useState<{ appId: string; studentName: string; day: string; time: string } | null>(null);

  const getNextDateForDay = (arabicDayName: string): string => {
    const today = new Date();
    const indexMap: Record<string, number> = {
      'الأحد': 0, 'الاثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6
    };
    const targetDayNum = indexMap[arabicDayName] ?? today.getDay();
    const currentDayNum = today.getDay();
    
    let diff = targetDayNum - currentDayNum;
    if (diff < 0) {
      diff += 7;
    }
    
    const targetDate = new Date();
    targetDate.setDate(today.getDate() + diff);
    return targetDate.toISOString().split('T')[0];
  };

  const getArabicDayNameFromDate = (dateStr: string): string => {
    if (!dateStr) return 'السبت';
    const dObj = new Date(`${dateStr}T12:00:00`);
    const dayIndex = dObj.getDay();
    return DAYS_AR_MAP[dayIndex] || 'السبت';
  };

  // Google Calendar Integration states
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [cachedToken, setCachedToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{
    current: number;
    total: number;
    studentName: string;
    successCount?: number;
    failedCount?: number;
    lastSynced?: string;
  } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(
    localStorage.getItem('google_calendar_last_sync_time')
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setCachedToken(token);
      },
      () => {
        setGoogleUser(null);
        setCachedToken(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        setCachedToken(res.accessToken);
      }
    } catch (err) {
      console.error('Sign-in failed:', err);
    }
  };

  const handleGoogleSignOut = async () => {
    if (window.confirm('هل تريد بالتأكيد تسجيل الخروج وقطع الاتصال بـ Google Calendar؟')) {
      await logout();
      setGoogleUser(null);
      setCachedToken(null);
      setSyncStatus(null);
    }
  };

  const handleSyncAll = async () => {
    const token = cachedToken || getAccessToken();
    if (!token) {
      try {
        const res = await googleSignIn();
        if (res) {
          setGoogleUser(res.user);
          setCachedToken(res.accessToken);
          triggerSync(res.accessToken);
        }
      } catch (err) {
        console.error('Auth or sync failed:', err);
      }
    } else {
      triggerSync(token);
    }
  };

  const triggerSync = async (token: string) => {
    setIsSyncing(true);
    setSyncStatus({ current: 0, total: appointments.length, studentName: 'جاري البدء...' });
    
    try {
      const results = await syncAppointmentsToGoogleCalendar(
        appointments,
        token,
        (current, total, studentName) => {
          setSyncStatus({ current, total, studentName });
        }
      );
      
      const nowStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date().toLocaleDateString('ar-EG', { month: 'numeric', day: 'numeric' });
      
      setSyncStatus({
        current: appointments.length,
        total: appointments.length,
        studentName: '',
        successCount: results.successCount,
        failedCount: results.failedCount,
        lastSynced: nowStr
      });
      
      setLastSyncTime(nowStr);
      localStorage.setItem('google_calendar_last_sync_time', nowStr);
    } catch (err) {
      console.error('Error in triggerSync:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Drag-and-Drop States
  const [activeDragAppId, setActiveDragAppId] = useState<string | null>(null);
  const [draggedOverDay, setDraggedOverDay] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setActiveDragAppId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, day: string) => {
    e.preventDefault();
    if (draggedOverDay !== day) {
      setDraggedOverDay(day);
    }
  };

  const handleDragLeave = (day: string) => {
    if (draggedOverDay === day) {
      setDraggedOverDay(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetDay: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || activeDragAppId;
    setActiveDragAppId(null);
    setDraggedOverDay(null);

    if (id && onUpdateAppointmentDay) {
      onUpdateAppointmentDay(id, targetDay);
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;

    const matchedStudent = students.find(s => s.id === selectedStudentId);
    if (!matchedStudent) return;

    const dayName = getArabicDayNameFromDate(selectedDate);

    onAddAppointment({
      studentId: selectedStudentId,
      studentName: matchedStudent.name,
      dayOfWeek: dayName,
      time: appointmentTime,
      notes: notes.trim() ? `${selectedDate} • ${notes.trim()}` : selectedDate,
    });

    // Reset Form
    setSelectedStudentId('');
    setNotes('');
    setIsOpenAddModal(false);
  };

  // Group appointments by day of week
  const groupedAppointments = DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = appointments
      .filter(app => app.dayOfWeek === day)
      .sort((a, b) => a.time.localeCompare(b.time));
    return acc;
  }, {} as Record<string, Appointment[]>);

  // Find today's day name in Arabic
  const todayDayName = new Date().toLocaleDateString('ar-EG', { weekday: 'long' });
  const todayAppointments = appointments.filter(app => app.dayOfWeek === todayDayName);

  // Union of standard template hours and actual scheduled appointment hours
  const defaultHours = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
  const allHours = Array.from(new Set([
    ...defaultHours,
    ...appointments.map(app => app.time).filter(t => t && t.includes(':'))
  ])).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-blue-900 flex items-center gap-2">
            <CalendarDays className="text-blue-600" size={24} />
            جدول مواعيد وحصص الطلاب الإسبوعي
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            قم بتنظيم وإدارة المواعيد الأسبوعية لكل طالب لضمان عدم حدوث تداخل في الحصص والأنصبة.
          </p>
        </div>

        <button
          onClick={() => {
            const today = new Date();
            setSelectedDate(today.toISOString().split('T')[0]);
            const derivedDay = getArabicDayNameFromDate(today.toISOString().split('T')[0]);
            setSelectedDay(derivedDay);
            setAppointmentTime('16:00');
            setIsOpenAddModal(true);
          }}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer shadow-md shadow-blue-500/10 mr-auto md:mr-0 w-full md:w-auto"
        >
          <Plus size={16} />
          <span>إضافة موعد استثنائي</span>
        </button>
      </div>

      {/* Google Calendar Sync Dashboard Card */}
      <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border border-blue-100 rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Calendar size={18} className="animate-pulse text-indigo-500" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                مزامنة مواعيد الحصص مع Google Calendar
                {googleUser && (
                  <span className="text-[10px] bg-emerald-50 border border-emerald-150 text-emerald-700 px-2 py-0.5 rounded-full font-extrabold">
                    🟢 متصل ومستعد
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-medium">
                {googleUser 
                  ? `أنت متصل الآن كـ (${googleUser.email}). مزامنة مواعيد حصص الأسبوع مباشرة لتلقي تنبيهات دورية على هاتفك والتحكم بيومك من الخارج.`
                  : "اربط جدولك الدراسي الخصوصي بـ Google Calendar لمزامنة المواعيد كأحداث دورية متكررة واستقبال إشعارات تلقائية عبر هاتفك المحمول."
                }
              </p>
              {lastSyncTime && (
                <p className="text-[10px] text-slate-400 font-extrabold mt-1">
                  آخر مزامنة ناجحة: <span className="text-indigo-600">{lastSyncTime}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {googleUser ? (
              <>
                <button
                  onClick={handleSyncAll}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 text-xs font-bold rounded-xl shadow-md shadow-indigo-500/10 cursor-pointer transition-all active:scale-95"
                >
                  <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                  <span>{isSyncing ? "جاري المزامنة..." : "مزامنة المواعيد الآن"}</span>
                </button>
                <button
                  onClick={handleGoogleSignOut}
                  disabled={isSyncing}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-extrabold rounded-xl cursor-pointer transition-all"
                  title="تسجيل الخروج وفصل الحساب"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline text-[11px]">فصل الحساب</span>
                </button>
              </>
            ) : (
              <button
                onClick={handleGoogleSignIn}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-250 hover:bg-slate-50 shadow-xs rounded-xl text-xs font-extrabold text-slate-700 cursor-pointer active:scale-95 transition-all"
              >
                <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                </svg>
                <span>ربط الحساب والمزامنة مع Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Sync Progress Tracker */}
        {syncStatus && (
          <div className="mt-4 pt-4 border-t border-slate-100 text-xs">
            {isSyncing ? (
              <div className="space-y-2">
                <div className="flex justify-between font-extrabold text-slate-700">
                  <span>جاري تحويل المواعيد الأسبوعية إلى تقويم جوجل...</span>
                  <span className="font-mono">{syncStatus.current} / {syncStatus.total}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-300 rounded-full" 
                    style={{ width: `${(syncStatus.current / syncStatus.total) * 100}%` }}
                  />
                </div>
                {syncStatus.studentName && (
                  <p className="text-[10px] text-slate-400 font-extrabold">تجهيز موعد الطالب: {syncStatus.studentName}</p>
                )}
              </div>
            ) : (
              syncStatus.successCount !== undefined && (
                <div className="flex items-center gap-2.5 text-emerald-800 bg-emerald-50/50 border border-emerald-150 rounded-2xl p-3.5 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping shrink-0" />
                  <div>
                    <p className="text-xs font-black">تمت مزامنة جدول الحصص بنجاح مذهل!</p>
                    <p className="text-[10px] text-emerald-600 font-bold mt-0.5">تمت إضافة/تحديث {syncStatus.successCount} حصص أسبوعية مجدولة وتثبيتها كأحداث مكررة مستمرة على تقويم Google Calendar الشخصي.</p>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Today's Schedule Banner Highlights */}
      <div className="premium-card p-5 relative overflow-hidden">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-50 pointer-events-none hidden md:block">
          <ClipboardCheck size={80} />
        </div>
        <h3 className="text-sm font-bold text-blue-600 flex items-center gap-1.5 mb-2">
          <span>📅 حصص اليوم:</span>
          <span className="text-slate-800 font-extrabold">{todayDayName}</span>
        </h3>
        
        {todayAppointments.length === 0 ? (
          <p className="text-xs text-slate-500 font-medium">لا توجد مواعيد حصص مجدولة لهذا اليوم. يوم هادئ ومثمر!</p>
        ) : (
          <div className="flex flex-wrap gap-3 mt-3">
            {todayAppointments.map((app) => (
              <div 
                key={app.id} 
                className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-2xl flex items-center gap-3 shadow-2xs"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                  <Clock size={14} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-850">{app.studentName}</p>
                  <p className="text-[10px] font-mono text-slate-500 tracking-wider" dir="ltr">الساعة: {formatTimeTo12h(app.time)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drag & Drop Help Instruction Banner */}
      <div className="bg-blue-50/55 border border-blue-150 p-3.5 rounded-2xl text-[11px] font-bold text-blue-800 leading-relaxed flex items-center gap-2.5">
        <span className="text-base select-none">💡</span>
        <p>
          <span className="text-blue-900 font-extrabold">ميزة ذكية لتنظيم الوقت:</span> يمكنك سحب أي حصة وإفلاتها (Drag & Drop) على يوم آخر بالجدول لتغيير يوم الطالب وتحديث قائمة التنبيهات ولينكات تذكير واتساب فوراً وبأمان!
        </p>
      </div>

      {/* Grid of Days of the Week Planner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in fade-in zoom-in-95 duration-200">
        {DAYS_OF_WEEK.map((day) => {
          const dayApps = groupedAppointments[day] || [];
          const isToday = day === todayDayName;
          const isDraggedOver = draggedOverDay === day;

          return (
            <div
              key={day}
              onDragOver={(e) => handleDragOver(e, day)}
              onDragLeave={() => handleDragLeave(day)}
              onDrop={(e) => handleDrop(e, day)}
              className={`premium-card p-4 flex flex-col justify-between transition-all duration-300 ${
                isDraggedOver
                  ? 'border-dashed border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-300 scale-[1.01] shadow-md'
                  : isToday
                  ? 'border-indigo-400 shadow-[0_4px_20px_-10px_rgba(99,102,241,0.15)] ring-1 ring-indigo-300 bg-indigo-50/15'
                  : 'border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 mb-3">
                  <h4 className="font-extrabold text-sm text-slate-800 flex items-center gap-1.5">
                    <span className={`w-1.5 h-3 rounded ${isToday ? 'bg-blue-600' : 'bg-slate-400'}`} />
                    {day}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-slate-50 text-slate-500 border border-slate-150">
                    {dayApps.length} حصص
                  </span>
                </div>

                {dayApps.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-[11px] font-medium italic select-none">
                    لا توجد مواعيد
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dayApps.map((app) => {
                      const isBeingDragged = activeDragAppId === app.id;
                      return (
                        <div
                          key={app.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, app.id)}
                          onDragEnd={() => {
                            setActiveDragAppId(null);
                            setDraggedOverDay(null);
                          }}
                          className={`bg-slate-50 border border-slate-150 hover:border-slate-200 rounded-xl p-3 flex justify-between items-start transition-all cursor-grab active:cursor-grabbing select-none ${
                            isBeingDragged ? 'opacity-35 border-dashed border-blue-400 bg-blue-50/10' : 'hover:shadow-2xs'
                          }`}
                        >
                          <div className="space-y-1.5 min-w-0 flex-1 pl-1">
                            <div className="flex items-center gap-1 min-w-0">
                              <GripVertical size={13} className="text-slate-300 hover:text-slate-500 shrink-0" />
                              <p className="text-xs font-extrabold text-slate-850 truncate" title={app.studentName}>
                                {app.studentName}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-sans pr-4">
                              <Clock size={11} className="text-slate-400" />
                              <span className="font-bold tracking-tight" dir="ltr">{formatTimeTo12h(app.time)}</span>
                            </div>
                            {app.notes && (
                              <p className="text-[9px] text-slate-450 leading-tight block truncate max-w-[140px] pr-4" title={app.notes}>
                                {app.notes}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setDeleteConfirmApp({
                                appId: app.id,
                                studentName: app.studentName,
                                day,
                                time: formatTimeTo12h(app.time)
                              });
                            }}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-5 transition-all text-center cursor-pointer shrink-0"
                            title="حذف الموعد"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Booking slot trigger under each day */}
              <div className="pt-3 border-t border-slate-100/60 mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDay(day);
                    setSelectedDate(getNextDateForDay(day));
                    setAppointmentTime('16:00');
                    setIsOpenAddModal(true);
                  }}
                  className="w-full py-2 px-3 border border-dashed border-blue-200 hover:border-blue-500 hover:bg-blue-50/50 text-blue-600 hover:text-blue-700 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
                >
                  <Plus size={13} />
                  <span>حجز موعد</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Appointment Slide-over / Popup Dialog */}
      <AnimatePresence>
        {isOpenAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenAddModal(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Content Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 text-right text-slate-800"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-blue-900 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600" />
                  إضافة موعد استثنائي جديد
                </h3>
                <button
                  onClick={() => setIsOpenAddModal(false)}
                  className="p-1 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {students.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">الرجاء إضافة طالب واحد على الأقل أولاً لتتمكن من جدولة حصص له.</p>
                  <button
                    onClick={() => setIsOpenAddModal(false)}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    تفقد صفحة الطلاب
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddSubmit} className="space-y-4">
                  {/* Select Student */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">اختر الطالب لجدولته *</label>
                    <select
                      required
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="">-- اضغط للاختيار --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.type === 'lesson' ? 'حصص' : 'كورس'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Input instead of list of weekdays */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">تاريخ الموعد الدراسي *</label>
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        if (e.target.value) {
                          const derivedDay = getArabicDayNameFromDate(e.target.value);
                          setSelectedDay(derivedDay);
                        }
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 text-right focus:outline-none focus:border-blue-500 transition-all"
                    />
                    {selectedDate && (
                      <span className="text-[10px] text-blue-600 font-black block mt-1 font-sans">
                        🎯 يوافق يوم الحصة: {getArabicDayNameFromDate(selectedDate)}
                      </span>
                    )}
                  </div>

                  {/* Time field - Huge digital layout */}
                  <div className="space-y-1 text-center py-2.5 bg-blue-50/20 rounded-2xl border border-blue-100/50">
                    <label className="text-xs text-slate-600 font-bold block text-center mb-1">توقيت وساعة الموعد *</label>
                    <div className="flex justify-center">
                      <input
                        type="time"
                        required
                        value={appointmentTime}
                        onChange={(e) => setAppointmentTime(e.target.value)}
                        className="text-3xl sm:text-4xl font-black text-center text-blue-700 bg-white hover:bg-slate-50 border-2 border-slate-200 focus:border-blue-600 rounded-2xl py-1.5 px-4 w-52 font-mono tracking-wider focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Notes fields - Optional */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">ملاحظة إضافية (اختياري)</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="مثال: في السنتر، عبر زووم، الخ"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3.5">
                    <button
                      type="button"
                      onClick={() => setIsOpenAddModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      إلغاء الأمر
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedStudentId}
                      className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-50 disabled:text-slate-400 rounded-xl cursor-pointer transition-all shadow-md"
                    >
                      حفظ الموعد
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Appointment Delete Confirm Dialog */}
      <AnimatePresence>
        {deleteConfirmApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmApp(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-right text-slate-800"
            >
              <div className="flex gap-3.5 items-start mb-4">
                <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0 text-red-650">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-snug">
                    إلغاء موعد الطالب الأسبوعي
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    هل ترغب في إلغاء موعد حصة الطالب <span className="font-extrabold text-slate-850">"{deleteConfirmApp.studentName}"</span> المقررة بجدول يوم <span className="font-semibold text-blue-650">({deleteConfirmApp.day})</span> الساعة <span className="font-mono">{deleteConfirmApp.time}</span>؟
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 font-bold text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmApp(null)}
                  className="px-4 py-2.5 text-slate-650 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  التراجع (إبقاء الموعد)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteAppointment(deleteConfirmApp.appId);
                    setDeleteConfirmApp(null);
                  }}
                  className="px-4 py-2.5 text-white bg-red-650 hover:bg-red-700 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>نعم، الغِ الموعد</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
