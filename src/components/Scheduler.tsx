import React, { useState, useEffect } from 'react';
import { Student, Appointment, TeacherPreferences, ExamAppointment } from '../types';
import { Calendar, Plus, Clock, Trash2, X, CalendarDays, ClipboardCheck, AlertTriangle, GripVertical, RefreshCw, LogOut, CalendarClock, Bell, BellRing, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatTimeTo12h } from '../lib/timeUtils';
import { initAuth, googleSignIn, logout, getAccessToken } from '../lib/firebaseAuth';
import { syncAppointmentsToGoogleCalendar } from '../lib/googleCalendar';
import { User } from 'firebase/auth';
import CalendarView from './CalendarView';

interface SchedulerProps {
  students: Student[];
  appointments: Appointment[];
  examAppointments?: ExamAppointment[];
  onAddAppointment: (appointmentData: Omit<Appointment, 'id'>) => void;
  onDeleteAppointment: (id: string) => void;
  onAddExamAppointment?: (examData: Omit<ExamAppointment, 'id'>) => void;
  onDeleteExamAppointment?: (id: string) => void;
  onUpdateAppointmentDay?: (id: string, newDay: string) => void;
  onUpdateAppointment?: (id: string, updatedFields: Partial<Appointment>) => void;
  onUpdateStudent?: (id: string, updatedFields: Partial<Student>) => void;
  onSelectStudent?: (studentId: string) => void;
  preferences?: TeacherPreferences;
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

export default function Scheduler({ 
  students, 
  appointments, 
  examAppointments = [],
  onAddAppointment, 
  onDeleteAppointment, 
  onAddExamAppointment,
  onDeleteExamAppointment,
  onUpdateAppointmentDay, 
  onUpdateAppointment,
  onUpdateStudent,
  onSelectStudent,
  preferences 
}: SchedulerProps) {
  const DAYS_AR_MAP: Record<number, string> = {
    0: 'الأحد',
    1: 'الاثنين',
    2: 'الثلاثاء',
    3: 'الأربعاء',
    4: 'الخميس',
    5: 'الجمعة',
    6: 'السبت'
  };

  const [activeSubTab, setActiveSubTab] = useState<'board' | 'calendar' | 'exams'>('calendar');
  const [isOpenAddExamModal, setIsOpenAddExamModal] = useState(false);
  const [examStudentId, setExamStudentId] = useState('');
  const [examDate, setExamDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [examTime, setExamTime] = useState('16:00');
  const [examSubject, setExamSubject] = useState('');
  const [examNotes, setExamNotes] = useState('');
  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedDay, setSelectedDay] = useState('السبت');
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [appointmentTime, setAppointmentTime] = useState('16:00');
  const [notes, setNotes] = useState('');
  const [isExceptionalVal, setIsExceptionalVal] = useState(true);
  const [deleteConfirmApp, setDeleteConfirmApp] = useState<{ appId: string; studentName: string; day: string; time: string } | null>(null);
  const [rescheduleApp, setRescheduleApp] = useState<Appointment | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState('16:00');
  const [rescheduleDay, setRescheduleDay] = useState('السبت');
  const [rescheduleNotes, setRescheduleNotes] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Custom reminder states
  const [reminderModalStudent, setReminderModalStudent] = useState<Student | null>(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');

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
      notes: notes.trim(),
      isExceptional: isExceptionalVal,
      date: selectedDate,
    });

    // Reset Form
    setSelectedStudentId('');
    setNotes('');
    setIsExceptionalVal(true);
    setIsOpenAddModal(false);
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleApp) return;

    const finalDay = getArabicDayNameFromDate(rescheduleDate);

    if (onUpdateAppointment) {
      onUpdateAppointment(rescheduleApp.id, {
        dayOfWeek: finalDay,
        time: rescheduleTime,
        notes: rescheduleNotes.trim() ? `${rescheduleDate} • ${rescheduleNotes.trim()}` : rescheduleDate,
      });
    } else if (onUpdateAppointmentDay) {
      onUpdateAppointmentDay(rescheduleApp.id, finalDay);
    }

    setRescheduleApp(null);
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
  
  const getLocalDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const todayDateStr = getLocalDateStr(new Date());

  const todayAppointments = appointments.filter(app => {
    if (app.isExceptional) {
      return app.date === todayDateStr;
    }
    return app.dayOfWeek === todayDayName;
  });

  // Union of standard template hours and actual scheduled appointment hours
  const defaultHours = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '21:00'];
  const allHours = Array.from(new Set([
    ...defaultHours,
    ...appointments.map(app => app.time).filter(t => t && t.includes(':'))
  ])).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-xl font-extrabold text-blue-900 flex items-center gap-2">
            <CalendarDays className="text-blue-600" size={24} />
            إدارة وتنظيم مواعيد الحصص
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            تابع مواعيد وجدول حصص الطلاب وحلل أوقاتها لضمان تنظيم تام للمقررات والأنصبة.
          </p>
        </div>

        {/* View Switcher segment */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 self-center shrink-0">
          <button
            type="button"
            onClick={() => setActiveSubTab('calendar')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'calendar' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            تقويم الحصص والجلسات
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('board')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'board' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            الجدول الأسبوعي المعتاد
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('exams')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === 'exams' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
            }`}
          >
            جدول الامتحانات المخصص 🏆
          </button>
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
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer shadow-md shadow-blue-500/10 mr-auto md:mr-0 w-full md:w-auto shrink-0"
        >
          <Plus size={16} />
          <span>إضافة موعد استثنائي</span>
        </button>
      </div>

      {activeSubTab === 'calendar' && (
        <CalendarView 
          students={students} 
          appointments={appointments} 
          onSelectStudent={onSelectStudent}
        />
      )}

      {activeSubTab === 'board' && (
        <>
          {/* Google Calendar Sync Dashboard Card */}
          {!preferences?.hideGoogleCalendar && (
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
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed font-semibold">
                      {googleUser 
                        ? `أنت متصل الآن كـ (${googleUser.email}). مزامنة مواعيد حصص الأسبوع مباشرة لتلقي تنبيهات دورية على هاتفك والتحكم بيومك من الخارج.`
                        : "اربط جدولك الدراسي الخصوصي بـ Google Calendar لمزامنة المواعيد كأحداث دورية متكررة واستقبل إشعارات تلقائية عبر هاتفك المحمول."
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
                <div className="mt-4 pt-4 border-t border-slate-100 text-xs font-bold">
                  {isSyncing ? (
                    <div className="space-y-2">
                      <div className="flex justify-between font-extrabold text-slate-750">
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
                          <p className="text-xs font-black">تمت مزاوجة جدول الحصص بنجاح مذهل!</p>
                          <p className="text-[10px] text-emerald-600 font-bold mt-0.5">تمت إضافة/تحديث {syncStatus.successCount} حصص أسبوعية مجدولة وتثبيتها كأحداث مكررة مستمرة على تقويم Google Calendar الشخصي.</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

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
                      const studentRecord = students.find(s => s.id === app.studentId);
                      return (
                        <div
                          key={app.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, app.id)}
                          onDragEnd={() => {
                            setActiveDragAppId(null);
                            setDraggedOverDay(null);
                          }}
                          className={`bg-white border border-slate-200/90 hover:border-blue-300 rounded-xl p-3 flex justify-between items-start transition-all cursor-grab active:cursor-grabbing select-none ${
                            isBeingDragged ? 'opacity-35 border-dashed border-blue-400 bg-blue-50/10' : 'hover:shadow-md hover:shadow-slate-100'
                          }`}
                          style={{
                            borderRight: app.color ? `4px solid ${app.color}` : undefined
                          }}
                        >
                          <div className="space-y-1.5 min-w-0 flex-1 pl-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GripVertical size={13} className="text-slate-300 hover:text-slate-500 shrink-0" />
                              {studentRecord?.photo ? (
                                <img src={studentRecord.photo} className="w-[18px] h-[18px] rounded-full object-cover border border-slate-200 shrink-0" />
                              ) : (
                                <span className="w-[18px] h-[18px] rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[8px] font-bold border border-slate-200 shrink-0">
                                  {app.studentName.charAt(0)}
                                </span>
                              )}
                              <p className="text-xs font-black text-slate-850 truncate" title={app.studentName}>
                                {app.studentName}
                              </p>
                            </div>

                            {app.isExceptional && (
                              <div className="pr-4">
                                <span className="inline-flex items-center px-1 py-0.25 rounded bg-amber-50 text-amber-700 border border-amber-150 text-[8px] font-black font-sans" title={app.date}>
                                  ⚡ حصة استثنائية لمرة واحدة
                                </span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-sans pr-4">
                              <Clock size={11} className="text-slate-400" />
                              <span className="font-bold tracking-tight" dir="ltr">{formatTimeTo12h(app.time)}</span>
                            </div>
                            {app.notes && (
                              <p className="text-[9px] text-slate-450 leading-tight block truncate max-w-[140px] pr-4 font-bold" title={app.notes}>
                                {app.notes}
                              </p>
                            )}

                            {studentRecord?.customReminderDate && (
                              <div className="flex items-center gap-1 mt-1 text-[9px] text-amber-600 bg-amber-50/65 border border-amber-100 rounded-lg px-2 py-0.5 w-max select-none font-bold animate-pulse" title={studentRecord.customReminderNote}>
                                <Bell size={10} className="text-amber-500 fill-amber-500 shrink-0" />
                                <span className="truncate max-w-[120px]">تذكير: {studentRecord.customReminderDate}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {/* Color Tag Picker */}
                            <div className="relative group/color p-1 hover:bg-slate-100 rounded-lg flex items-center justify-center cursor-pointer" title="تخصيص لون مميز للحصة">
                              <input
                                type="color"
                                value={app.color || '#3b82f6'}
                                onChange={(e) => {
                                  if (onUpdateAppointment) {
                                    onUpdateAppointment(app.id, { color: e.target.value });
                                  }
                                }}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                              />
                              <span 
                                className="w-3.5 h-3.5 rounded-full border border-slate-300 shadow-xs block transition-transform group-hover/color:scale-115"
                                style={{ backgroundColor: app.color || '#cbd5e1' }}
                              />
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const s = students.find(x => x.id === app.studentId);
                                if (s) {
                                  setReminderModalStudent(s);
                                  setReminderDate(s.customReminderDate || new Date().toISOString().split('T')[0]);
                                  setReminderNote(s.customReminderNote || '');
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-all text-center cursor-pointer ${
                                studentRecord?.customReminderDate 
                                  ? 'text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100/80 border border-amber-100' 
                                  : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                              }`}
                              title="إضافة أو تعديل تذكير مخصص للطالب"
                            >
                              <Bell size={12} className={studentRecord?.customReminderDate ? 'fill-amber-400 text-amber-550' : ''} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRescheduleApp(app);
                                setRescheduleTime(app.time);
                                setRescheduleDay(app.dayOfWeek);
                                
                                // Extract date
                                let dateVal = new Date().toISOString().split('T')[0];
                                if (app.notes) {
                                  const match = app.notes.match(/^(\d{4}-\d{2}-\d{2})/);
                                  if (match) {
                                    dateVal = match[1];
                                  }
                                }
                                setRescheduleDate(dateVal);
                                
                                // Extract notes without prefix
                                let notesVal = app.notes || '';
                                if (notesVal.startsWith(dateVal)) {
                                  notesVal = notesVal.replace(new RegExp(`^${dateVal}\\s*(•\\s*)?`), '');
                                }
                                setRescheduleNotes(notesVal);
                              }}
                              className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-1 px-2 rounded-lg transition-all text-center cursor-pointer flex items-center gap-1 text-[9px] font-bold"
                              title="إعادة جدولة"
                            >
                              <CalendarClock size={11} />
                              <span>إعادة جدولة</span>
                            </button>

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
                              className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-5 transition-all text-center cursor-pointer"
                              title="حذف الموعد"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
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
      </>
      )}

      {/* Custom Exam Schedule View */}
      {activeSubTab === 'exams' && (
        <div className="space-y-6 font-sans">
          {/* Header Stats */}
          <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 text-right">
            <div>
              <h3 className="text-base font-bold text-blue-900 flex items-center gap-2">
                <BookOpen className="text-blue-600" size={18} />
                قائمة وجدول مواعيد الامتحانات الخاصة للطلاب
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                سجل مواعيد الاختبارات الدورية وتواريخها بشكل منفصل ومستقل تماماً دون أي مساس بمواعيد الحصص الأسبوعية المعتادة.
              </p>
            </div>
            <button
              onClick={() => {
                if (students.length > 0) {
                  setExamStudentId(students[0].id);
                } else {
                  setExamStudentId('');
                }
                setExamSubject('');
                setExamNotes('');
                setIsOpenAddExamModal(true);
              }}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer shadow-md shadow-blue-500/10 shrink-0 self-start md:self-auto"
            >
              <Plus size={16} />
              <span>تسجيل موعد امتحان جديد</span>
            </button>
          </div>

          {examAppointments.length === 0 ? (
            <div className="bg-white border text-center py-12 rounded-3xl space-y-3">
              <span className="inline-flex w-12 h-12 bg-slate-50 border text-slate-400 items-center justify-center rounded-2xl">
                <BookOpen size={20} />
              </span>
              <p className="text-xs text-slate-500 font-bold">لا توجد أي امتحانات مسجلة حالياً.</p>
              <p className="text-[11px] text-slate-400">ابدأ بجدولة أول امتحان ومحاذاة المواعيد المستقلة بلمسة واحدة.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5">اسم الطالب</th>
                      <th className="px-5 py-3.5">المادة الاختبارية</th>
                      <th className="px-5 py-3.5">تاريخ الامتحان</th>
                      <th className="px-5 py-3.5">توقيت وساعة المحاضرة</th>
                      <th className="px-5 py-3.5">ملاحظات توجيهية</th>
                      <th className="px-5 py-3.5 text-center">خيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                    {examAppointments.map((exam) => {
                      return (
                        <tr key={exam.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-4 font-bold text-slate-800">{exam.studentName}</td>
                          <td className="px-5 py-4">
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[11px] font-black">
                              {exam.subject || 'مراجعة وتقييم عام'}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono text-slate-700 font-black">{exam.date}</td>
                          <td className="px-5 py-4 font-mono font-bold text-indigo-600">{formatTimeTo12h(exam.time)}</td>
                          <td className="px-5 py-4 text-slate-500 max-w-xs truncate">{exam.notes || '-'}</td>
                          <td className="px-5 py-4 text-center">
                            <button
                              onClick={() => {
                                if (onDeleteExamAppointment) {
                                  onDeleteExamAppointment(exam.id);
                                }
                              }}
                              className="p-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-100 rounded-lg text-[10px] font-black cursor-pointer transition-all active:scale-95"
                            >
                              حذف موعد الامتحان
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Exam Appointment Popup Modal */}
      <AnimatePresence>
        {isOpenAddExamModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenAddExamModal(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Content Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 text-right text-slate-800 font-sans"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-blue-900 flex items-center gap-2">
                  <BookOpen size={18} className="text-blue-600" />
                  تسجيل موعد امتحان خصوصي مستقل
                </h3>
                <button
                  onClick={() => setIsOpenAddExamModal(false)}
                  className="p-1 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {students.length === 0 ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-slate-500">الرجاء إضافة طالب واحد على الأقل أولاً لتتمكن من جدولة امتحانات له.</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!examStudentId) return;
                    const matStudent = students.find(s => s.id === examStudentId);
                    if (!matStudent) return;

                    if (onAddExamAppointment) {
                      onAddExamAppointment({
                        studentId: examStudentId,
                        studentName: matStudent.name,
                        date: examDate,
                        time: examTime,
                        subject: examSubject.trim() || undefined,
                        notes: examNotes.trim() || undefined,
                      });
                    }
                    setIsOpenAddExamModal(false);
                  }}
                  className="space-y-4"
                >
                  {/* Select Student */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">اختر الطالب للامتحان *</label>
                    <select
                      required
                      value={examStudentId}
                      onChange={(e) => setExamStudentId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                    >
                      <option value="">-- اضغط للاختيار --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Exam Date */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">تاريخ الامتحان *</label>
                    <input
                      type="date"
                      required
                      value={examDate}
                      onChange={(e) => setExamDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 text-right focus:outline-none focus:border-blue-500 transition-all"
                    />
                  </div>

                  {/* Exam Time */}
                  <div className="space-y-1 text-center py-2 bg-indigo-50/20 rounded-2xl border border-indigo-100/40">
                    <label className="text-xs text-slate-600 font-bold block mb-1">توقيت الامتحان *</label>
                    <div className="flex justify-center">
                      <input
                        type="time"
                        required
                        value={examTime}
                        onChange={(e) => setExamTime(e.target.value)}
                        className="text-2xl font-black text-center text-indigo-700 bg-white hover:bg-slate-50 border border-slate-200 focus:border-indigo-600 rounded-xl py-1 px-3 w-44 font-mono tracking-wider focus:outline-none transition-all shadow-sm"
                      />
                    </div>
                  </div>

                  {/* Exam Subject Name */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">الموضوع أو المادة الاختبارية (مثال: الباب الثاني للفيزياء)</label>
                    <input
                      type="text"
                      value={examSubject}
                      onChange={(e) => setExamSubject(e.target.value)}
                      placeholder="الباب الثاني، الجبر والهندسة التحليلية، الخ"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Exam Notes */}
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">ملاحظات التحضير والتوجيه (اختياري)</label>
                    <input
                      type="text"
                      value={examNotes}
                      onChange={(e) => setExamNotes(e.target.value)}
                      placeholder="إحضار الآلة الحاسبة وأدوات الرسم الهندسي"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-3.5 font-sans">
                    <button
                      type="button"
                      onClick={() => setIsOpenAddExamModal(false)}
                      className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      إلغاء الأمر
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer transition-all shadow-md active:scale-95"
                    >
                      حفظ موعد الامتحان
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

                  {/* Exceptional/One-off Toggle */}
                  <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200/50 flex items-center gap-2.5">
                    <input
                      id="is-exceptional-appointment-check"
                      type="checkbox"
                      checked={isExceptionalVal}
                      onChange={(e) => setIsExceptionalVal(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="is-exceptional-appointment-check" className="text-xs text-amber-900 font-bold cursor-pointer select-none">
                      موعد استثنائي (يحذف تلقائياً من الجدول بعد انتهاء يومه) 💡
                    </label>
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

      {/* Appointment Reschedule Dialog */}
      <AnimatePresence>
        {rescheduleApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRescheduleApp(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-right text-slate-800"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="text-base font-bold text-blue-900 flex items-center gap-2">
                  <CalendarClock size={16} className="text-blue-600" />
                  <span>إعادة جدولة حصة الطالب</span>
                </h3>
                <button
                  onClick={() => setRescheduleApp(null)}
                  className="p-1 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-4 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
                <p className="text-xs text-slate-500 font-bold">اسم الطالب:</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">{rescheduleApp.studentName}</p>
              </div>

              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                {/* Select Date & Day of Week automatically calculated */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 font-bold block">تحديد تاريخ الحصة الجديد *</label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => {
                      setRescheduleDate(e.target.value);
                      setRescheduleDay(getArabicDayNameFromDate(e.target.value));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-850 focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                  />
                  <p className="text-[10px] text-indigo-650 font-extrabold mt-1 text-right">
                    🎯 يوافق يوم الحصة: {getArabicDayNameFromDate(rescheduleDate)}
                  </p>
                </div>

                {/* Time selection */}
                <div className="space-y-1 text-center py-2.5 bg-blue-50/20 rounded-2xl border border-blue-100/50">
                  <label className="text-xs text-slate-600 font-bold block text-center mb-1">التوقيت الجديد للحصة *</label>
                  <div className="flex justify-center">
                    <input
                      type="time"
                      required
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="text-3xl sm:text-4xl font-black text-center text-blue-700 bg-white hover:bg-slate-50 border-2 border-slate-200 focus:border-blue-600 rounded-2xl py-1.5 px-4 w-52 font-mono tracking-wider focus:outline-none focus:ring-4 focus:ring-blue-50 transition-all shadow-sm"
                    />
                  </div>
                </div>

                {/* Notes update */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">ملاحظات الحصة (اختياري)</label>
                  <input
                    type="text"
                    value={rescheduleNotes}
                    onChange={(e) => setRescheduleNotes(e.target.value)}
                    placeholder="مثال: حلقة إضافية، تعديل طارئ، الخ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => setRescheduleApp(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-650 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl cursor-pointer transition-all shadow-md flex items-center gap-1.5 justify-center"
                  >
                    <CalendarClock size={13} />
                    <span>تحديث الموعد (إعادة جدولة)</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student Custom Reminder Dialog */}
      <AnimatePresence>
        {reminderModalStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReminderModalStudent(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-right text-slate-800"
            >
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h3 className="text-base font-bold text-amber-900 flex items-center gap-2">
                  <Bell size={16} className="text-amber-650" />
                  <span>جدولة أو تعديل تذكير للطالب</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setReminderModalStudent(null)}
                  className="p-1 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-4 bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
                <p className="text-xs text-slate-500 font-bold">اسم الطالب:</p>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5">{reminderModalStudent.name}</p>
              </div>

              <div className="space-y-4">
                {/* Reminder Date */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 font-bold block">تاريخ التذكير *</label>
                  <input
                    type="date"
                    required
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-850 focus:outline-none placeholder-slate-400"
                  />
                </div>

                {/* Reminder note */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 font-bold block">نص التذكير / الملاحظة</label>
                  <input
                    type="text"
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="مثال: مراجعة الواجب، إحضار كشكول الرسم، الخ"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-850 focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-between items-center gap-2">
                  {reminderModalStudent.customReminderDate ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onUpdateStudent) {
                          onUpdateStudent(reminderModalStudent.id, {
                            customReminderDate: undefined,
                            customReminderNote: undefined,
                          });
                        }
                        setReminderModalStudent(null);
                      }}
                      className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl cursor-pointer"
                    >
                      إلغاء التذكير النشط ❌
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setReminderModalStudent(null)}
                      className="px-4 py-2 text-xs font-bold text-slate-650 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                    >
                      الرجوع
                    </button>
                    <button
                      type="button"
                      disabled={!reminderDate}
                      onClick={() => {
                        if (onUpdateStudent) {
                          onUpdateStudent(reminderModalStudent.id, {
                            customReminderDate: reminderDate,
                            customReminderNote: reminderNote || 'تذكير مخصص',
                          });
                        }
                        setReminderModalStudent(null);
                      }}
                      className="px-4.5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:bg-slate-200 rounded-xl cursor-pointer transition-all shadow-md flex items-center gap-1.5"
                    >
                      <Bell size={13} />
                      <span>تأكيد التذكير ⏰</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
