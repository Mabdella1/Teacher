import React, { useMemo, useState, useEffect } from 'react';
import { Student, Appointment, TeacherPreferences } from '../types';
import { formatTimeTo12h } from '../lib/timeUtils';
import { 
  Users, Calendar, DollarSign, BarChart3, TrendingUp, Coins, 
  Clock, ArrowUpRight, Award, CheckCircle2, AlertCircle, Sparkles, MessageSquare,
  ClipboardList, CheckSquare, Square, Trash2, Plus, Bell
} from 'lucide-react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar
} from 'recharts';

interface DashboardProps {
  students: Student[];
  appointments: Appointment[];
  preferences: TeacherPreferences;
  onSelectStudent: (id: string) => void;
  onNavigateToTab: (tab: 'students' | 'schedule' | 'financials' | 'settings') => void;
}

const DAYS_AR_MAP: { [key: number]: string } = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت'
};

const DAYS_ORDER = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

interface DailyTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  reminderTime?: string; // HTML datetime-local selector value
  notified?: boolean;
}

export default function Dashboard({ students, appointments, preferences, onSelectStudent, onNavigateToTab }: DashboardProps) {
  const currency = preferences.currency || 'ج.م';
  const teacherName = preferences.teacherName || 'الأستاذ';
  const subject = preferences.subject || 'المادة الدراسية';

  // Daily Tasks state & logic
  const [dailyTasks, setDailyTasks] = useState<DailyTask[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskReminderTime, setNewTaskReminderTime] = useState('');
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  
  // Active popped up task alerts
  const [activeAlertTasks, setActiveAlertTasks] = useState<DailyTask[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('teacherDailyTasks');
    if (stored) {
      try {
        setDailyTasks(JSON.parse(stored));
      } catch (e) {
        console.error("Error reading daily tasks:", e);
      }
    } else {
      // Initialize with beautiful default tasks if none exist
      const defaults: DailyTask[] = [
        { id: 'dt-1', text: 'تصحيح أوراق اختبار الباب الأول للطلاب الجدد', completed: false, createdAt: new Date().toISOString() },
        { id: 'dt-2', text: 'تجهيز المذكرة التعليمية وملخص المراجعة للأسبوع القادم', completed: true, createdAt: new Date().toISOString() },
        { id: 'dt-3', text: 'مراجعة الموقف المالي وحساب الاشتراكات المتبقية للطلاب', completed: false, createdAt: new Date().toISOString() }
      ];
      setDailyTasks(defaults);
      localStorage.setItem('teacherDailyTasks', JSON.stringify(defaults));
    }
  }, []);

  // Save to localStorage
  const saveDailyTasks = (tasks: DailyTask[]) => {
    setDailyTasks(tasks);
    localStorage.setItem('teacherDailyTasks', JSON.stringify(tasks));
  };

  // Synthesizes a beautiful notification alert sound tone using Web Audio API
  const playAlertSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.3);

      setTimeout(() => {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
        gain2.gain.setValueAtTime(0.15, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.5);
      }, 160);
    } catch (err) {
      console.warn("Chime sound play skipped/blocked by user browser policy:", err);
    }
  };

  // Background reminder watchdog interval (checks every 5 seconds)
  useEffect(() => {
    const watchdog = setInterval(() => {
      const now = new Date();
      
      setDailyTasks(prevTasks => {
        let triggered = false;
        const updated = prevTasks.map(task => {
          if (!task.completed && task.reminderTime && !task.notified) {
            const reminderDate = new Date(task.reminderTime);
            if (reminderDate <= now) {
              triggered = true;
              
              // Show notification alert
              setActiveAlertTasks(prev => {
                if (prev.some(x => x.id === task.id)) return prev;
                return [...prev, task];
              });

              // Play auditory chime tone 
              playAlertSound();
              
              return { ...task, notified: true };
            }
          }
          return task;
        });

        if (triggered) {
          localStorage.setItem('teacherDailyTasks', JSON.stringify(updated));
          return updated;
        }
        return prevTasks;
      });
    }, 5000);

    return () => clearInterval(watchdog);
  }, []);

  const formatReminder = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('ar-EG', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return isoString;
    }
  };

  const handleAddDailyTask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newTaskText.trim();
    if (!text) return;

    const newTask: DailyTask = {
      id: `dt-${Math.random().toString(36).substring(2, 9)}`,
      text,
      completed: false,
      createdAt: new Date().toISOString(),
      reminderTime: newTaskReminderTime || undefined,
      notified: false
    };

    const updated = [newTask, ...dailyTasks];
    saveDailyTasks(updated);
    setNewTaskText('');
    setNewTaskReminderTime('');
    setShowReminderPicker(false);
  };

  const handleToggleDailyTask = (id: string) => {
    const updated = dailyTasks.map(t => 
      t.id === id ? { ...t, completed: !t.completed } : t
    );
    saveDailyTasks(updated);
  };

  const handleDeleteDailyTask = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = dailyTasks.filter(t => t.id !== id);
    saveDailyTasks(updated);
  };

  // Action from popup: Complete task
  const handleCompleteTaskFromAlert = (id: string) => {
    const updated = dailyTasks.map(t => 
      t.id === id ? { ...t, completed: true, notified: true } : t
    );
    saveDailyTasks(updated);
    setActiveAlertTasks(prev => prev.filter(x => x.id !== id));
  };

  // Action from popup: Acknowledge / Dismiss alert
  const handleDismissAlert = (id: string) => {
    setActiveAlertTasks(prev => prev.filter(x => x.id !== id));
  };

  // Current system date information
  const sysTime = useMemo(() => new Date(), []);
  const todayDayArabic = DAYS_AR_MAP[sysTime.getDay()];
  const tomorrowDayArabic = DAYS_AR_MAP[(sysTime.getDay() + 1) % 7];

  // 1. Calculate General Metrics
  const metrics = useMemo(() => {
    let totalPaymentsReceived = 0;
    let totalExpectedEarnings = 0;
    let totalOutstandingBalance = 0;

    let activeCount = 0;
    let lessonTypeCount = 0;
    let courseTypeCount = 0;
    let totalSessionsDelivered = 0;

    students.forEach(student => {
      // Keep track of counts
      if (student.active) {
        activeCount++;
        if (student.type === 'lesson') {
          lessonTypeCount++;
        } else {
          courseTypeCount++;
        }
      }

      // Total payments received (cash on hand)
      const studentPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
      totalPaymentsReceived += studentPaid;

      // Total sessions delivered by student
      totalSessionsDelivered += student.sessions.length;

      // Financials Based on types
      let studentCost = 0;
      if (student.type === 'lesson') {
        studentCost = student.sessions.length * (student.lessonRate || 0);
        totalExpectedEarnings += studentCost;
      } else {
        const standardSessions = student.sessions.filter(s => !s.isExtra);
        const extraSessions = student.sessions.filter(s => s.isExtra);
        const sessionRateProportional = (student.coursePrice || 0) / (student.totalLessonsCount || 1);
        const standardEarnings = standardSessions.length * sessionRateProportional;
        const extraEarnings = extraSessions.reduce((sum, s) => sum + (s.extraPrice || 0), 0);
        
        studentCost = (student.coursePrice || 0) + extraSessions.reduce((sum, s) => sum + (s.extraPrice || 0), 0);
        totalExpectedEarnings += Number((standardEarnings + extraEarnings).toFixed(1)) || 0;
      }

      const outstanding = Math.max(0, studentCost - studentPaid);
      totalOutstandingBalance += outstanding;
    });

    return {
      totalPaymentsReceived,
      totalExpectedEarnings: Math.round(totalExpectedEarnings),
      totalOutstandingBalance: Math.round(totalOutstandingBalance),
      totalStudents: students.length,
      activeStudents: activeCount,
      inactiveStudents: students.length - activeCount,
      lessonStudents: lessonTypeCount,
      courseStudents: courseTypeCount,
      totalSessionsDelivered
    };
  }, [students]);

  // 2. Upcoming / scheduled appointments for Today & Tomorrow & Week
  const { todayAppointments, tomorrowAppointments, otherAppointments } = useMemo(() => {
    const today: Appointment[] = [];
    const tomorrow: Appointment[] = [];
    const other: Appointment[] = [];

    const getLocalYMDStr = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const todayStr = getLocalYMDStr(new Date());
    const tomoDate = new Date();
    tomoDate.setDate(tomoDate.getDate() + 1);
    const tomorrowStr = getLocalYMDStr(tomoDate);

    appointments.forEach(app => {
      // Find corresponding student to ensure they are active
      const student = students.find(s => s.id === app.studentId);
      if (student && student.active) {
        if (app.isExceptional) {
          if (app.date === todayStr) {
            today.push(app);
          } else if (app.date === tomorrowStr) {
            tomorrow.push(app);
          } else if (app.date && app.date > tomorrowStr) {
            other.push(app);
          }
        } else {
          if (app.dayOfWeek === todayDayArabic) {
            today.push(app);
          } else if (app.dayOfWeek === tomorrowDayArabic) {
            tomorrow.push(app);
          } else {
            other.push(app);
          }
        }
      }
    });

    // Helper to sort by time "HH:MM"
    const sortByTime = (a: Appointment, b: Appointment) => a.time.localeCompare(b.time);

    return {
      todayAppointments: today.sort(sortByTime),
      tomorrowAppointments: tomorrow.sort(sortByTime),
      // Sort other appointments by the custom week order
      otherAppointments: other.sort((a, b) => {
        const idxA = DAYS_ORDER.indexOf(a.dayOfWeek);
        const idxB = DAYS_ORDER.indexOf(b.dayOfWeek);
        if (idxA !== idxB) return idxA - idxB;
        return a.time.localeCompare(b.time);
      })
    };
  }, [appointments, students, todayDayArabic, tomorrowDayArabic]);

  // 3. Chart 1 Data: Student Distribution (Lesson System vs Course System)
  const studentDistributionData = useMemo(() => {
    return [
      { name: 'نظام الحصص (Lesson-based)', value: metrics.lessonStudents, color: '#6366f1' },
      { name: 'نظام الكورسات (Course-based)', value: metrics.courseStudents, color: '#10b981' }
    ].filter(item => item.value > 0);
  }, [metrics]);

  // 4. Chart 2 Data: Recent Monthly Collections vs Expected Earnings (Last 6 Months)
  const monthlyTimelineData = useMemo(() => {
    const monthsArabicName = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const currentYear = sysTime.getFullYear();
    const timeline = [];

    // Form data for the last 6 months (including current one)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(sysTime.getFullYear(), sysTime.getMonth() - i, 1);
      const mVal = String(d.getMonth() + 1).padStart(2, '0');
      const yVal = String(d.getFullYear());

      let monthlyExpected = 0;
      let monthlyCollected = 0;

      students.forEach(student => {
        // Sessions in this specific month
        const studentSessionsInMonth = student.sessions.filter(s => {
          const [y, m] = s.date.split('-');
          return y === yVal && m === mVal;
        });

        // Payments in this specific month
        const studentPaymentsInMonth = student.payments.filter(p => {
          const [y, m] = p.date.split('-');
          return y === yVal && m === mVal;
        });

        // Sum payments
        monthlyCollected += studentPaymentsInMonth.reduce((sum, p) => sum + p.amount, 0);

        // Sum expected values
        if (student.type === 'lesson') {
          monthlyExpected += studentSessionsInMonth.length * (student.lessonRate || 0);
        } else {
          const sessionRateProportional = (student.coursePrice || 0) / (student.totalLessonsCount || 1);
          monthlyExpected += studentSessionsInMonth.length * sessionRateProportional;
        }
      });

      timeline.push({
        name: monthsArabicName[d.getMonth()],
        'المبالغ المحصلة فعلياً': Math.round(monthlyCollected),
        'الأرباح المستحقة': Math.round(monthlyExpected)
      });
    }

    return timeline;
  }, [students, sysTime]);

  const totalUpcomingCount = todayAppointments.length + tomorrowAppointments.length;

  // Custom tooltips for Recharts
  const customTooltipStyle = {
    contentStyle: {
      backgroundColor: '#ffffff',
      border: '1px solid #e2e8f0',
      borderRadius: '16px',
      direction: 'rtl' as const,
      textAlign: 'right' as const,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: '12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
    }
  };

  return (
    <div className="space-y-6 select-none font-sans animate-in fade-in duration-200">
      
      {/* 1. Header Hero Panel */}
      <div className="bg-gradient-to-br from-indigo-650 via-blue-650 to-indigo-850 text-white rounded-3xl p-6 relative overflow-hidden shadow-xl shadow-blue-500/10 border-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-350/15 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10 w-full">
          <div className="space-y-1.5 text-right">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold bg-white/10 border border-white/20 text-white">
              <Sparkles size={11} className="text-amber-300" />
              لوحة التحكم الذكية السحابية
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-1">
              أهلاً بك، {teacherName} 👋
            </h1>
            <p className="text-xs sm:text-sm text-indigo-50 font-medium leading-relaxed">
              إليك مراجعة بصرية ذكية شاملة وإحصائيات فورية لأداء طلابك ومستحقاتك المالية في مادة <span className="text-amber-300 font-extrabold">{subject}</span>.
            </p>
          </div>

          <div className="bg-white text-slate-900 border border-slate-100 shadow-xl p-3.5 pr-4 rounded-2xl flex items-center gap-4 shrink-0 self-stretch md:self-auto justify-between md:justify-start min-w-[210px]">
            <div className="space-y-0.5 text-right md:pl-2">
              <span className="text-[10px] text-indigo-600 font-black block tracking-wide">🏆 تاريخ اليوم المعتمد</span>
              <div className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                {sysTime.toLocaleDateString('ar-EG', { weekday: 'long' })}
              </div>
              <div className="text-xs font-extrabold text-slate-500 font-sans mt-0.5 whitespace-nowrap">
                {sysTime.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-650 text-white flex flex-col items-center justify-center shadow-md shadow-indigo-600/10 shrink-0 border border-indigo-400/20 overflow-hidden">
              <div className="bg-indigo-700/60 w-full text-center py-0.5 text-[8px] font-black uppercase tracking-wider leading-none text-indigo-100">
                {sysTime.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
              </div>
              <div className="flex-1 flex items-center justify-center text-white font-black text-sm font-sans leading-none pb-0.5">
                {sysTime.getDate()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Metrics Widgets Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Total Payments Received */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-2xs hover:shadow-xs transition-shadow duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/2 rounded-full translate-x-3 -translate-y-3" />
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-right">
              <span className="text-xs text-slate-450 font-black block leading-none">المدفوعات الإجمالية</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-none tracking-tight flex items-baseline gap-1 py-1">
                {metrics.totalPaymentsReceived.toLocaleString('ar-EG')} <span className="text-xs font-black text-slate-450">{currency}</span>
              </h3>
              <p className="text-[10px] text-emerald-600 font-extrabold flex items-center gap-1">
                <TrendingUp size={11} />
                <span>المبالغ المحصلة نقداً بالكامل</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform duration-200">
              <Coins size={18} />
            </div>
          </div>
        </div>

        {/* Metric 2: Estimated Earnings */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-2xs hover:shadow-xs transition-shadow duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/2 rounded-full translate-x-3 -translate-y-3" />
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-right">
              <span className="text-xs text-slate-450 font-black block leading-none">أرباح الحصص المنفذة</span>
              <h3 className="text-xl sm:text-2xl font-black text-indigo-650 leading-none tracking-tight flex items-baseline gap-1 py-1">
                {metrics.totalExpectedEarnings.toLocaleString('ar-EG')} <span className="text-xs font-black text-slate-450">{currency}</span>
              </h3>
              <p className="text-[10px] text-indigo-500 font-extrabold flex items-center gap-1">
                <CheckCircle2 size={11} className="text-indigo-400" />
                <span>قيمة المجهود والدروس الفعلية</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 group-hover:scale-110 transition-transform duration-200">
              <Award size={18} />
            </div>
          </div>
        </div>

        {/* Metric 3: Outstanding / Pending */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-2xs hover:shadow-xs transition-shadow duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/2 rounded-full translate-x-3 -translate-y-3" />
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-right">
              <span className="text-xs text-slate-450 font-black block leading-none">المستحقات المتبقية</span>
              <h3 className="text-xl sm:text-2xl font-black text-amber-650 leading-none tracking-tight flex items-baseline gap-1 py-1">
                {metrics.totalOutstandingBalance.toLocaleString('ar-EG')} <span className="text-xs font-black text-slate-450">{currency}</span>
              </h3>
              <p className="text-[10px] text-amber-600 font-extrabold flex items-center gap-1">
                <AlertCircle size={11} className="text-amber-500" />
                <span>مستحق السداد والتحصيل قريباً</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-110 transition-transform duration-200">
              <DollarSign size={18} />
            </div>
          </div>
        </div>

        {/* Metric 4: Registered/Active Students */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4.5 shadow-2xs hover:shadow-xs transition-shadow duration-200 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/2 rounded-full translate-x-3 -translate-y-3" />
          <div className="flex items-center justify-between">
            <div className="space-y-1 text-right">
              <span className="text-xs text-slate-450 font-black block leading-none">الطلاب النشطون</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-850 leading-none tracking-tight flex items-baseline gap-1.5 py-1">
                {metrics.activeStudents} <span className="text-xs font-black text-slate-400">من {metrics.totalStudents}</span>
              </h3>
              <p className="text-[10px] text-blue-600 font-extrabold flex items-center gap-1">
                <Users size={11} />
                <span>{metrics.lessonStudents} حصص • {metrics.courseStudents} كورسات</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform duration-200">
              <Users size={18} />
            </div>
          </div>
        </div>

      </div>

      {/* 3. Charts and Schedules Core Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Elements: Visual Statistics Graphs & Charts (Col-span-7) */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Timeline Bar Chart: Collected payments vs Actual lesson value */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 md:p-5 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div className="space-y-0.5 text-right">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                  مستحقات الدروس مقابل التحصيل المالي (آخر 6 أشهر)
                </h3>
                <p className="text-[10px] text-slate-450 font-bold">مقارنة شهرية دقيقة لقيمة مجهود الحصص والمدفوعات الكاش المقبوضة</p>
              </div>
            </div>

            <div className="h-64 w-full text-xs font-bold" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={monthlyTimelineData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} stroke="#94a3b8" fontSize={11} />
                  <YAxis tickLine={false} stroke="#94a3b8" fontSize={11} />
                  <Tooltip {...customTooltipStyle} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '8px', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="المبالغ المحصلة فعلياً" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollected)" />
                  <Area type="monotone" dataKey="الأرباح المستحقة" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExpected)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Row Charts: Student Division doughnut & quick stats summary */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            
            {/* Pie Chart Student System breakdown */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4.5 shadow-2xs md:col-span-7 flex flex-col justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800 pb-3 border-b border-slate-100 flex items-center gap-1.5 text-right w-full">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                  تصنيف الطلاب المشتركين حسب الأنظمة
                </h3>
                
                {studentDistributionData.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs font-semibold italic">
                    لا يوجد طلاب مسجلون حالياً لعرض الرسم البياني.
                  </div>
                ) : (
                  <div className="h-44 w-full my-1" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={studentDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {studentDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip {...customTooltipStyle} />
                        <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '10.5px', paddingTop: '4px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-xl text-[10.5px] text-slate-600 leading-normal text-right mt-2 font-medium">
                تساعدك تفرقة نظام «الكورسات» عن نظام «المحاضرات الفردية» على ضبط طرق المحاسبة المالية والتنقل التلقائي باقتدار.
              </div>
            </div>

            {/* Total Delivered sessions and metrics summary numbers card */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-4.5 shadow-2xs md:col-span-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-800 pb-3 border-b border-slate-100 text-right">
                  إحصائيات الإنجاز التعليمي
                </h3>
                <div className="space-y-4 pt-4 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 font-extrabold block">إجمالي عدد الحصص المنفذة حتى الآن</span>
                    <span className="text-2xl font-black text-slate-800 font-mono tracking-tight">{metrics.totalSessionsDelivered}</span>
                    <span className="text-slate-400 text-xs font-semibold mr-1">محاضرة</span>
                  </div>
                  <div className="pt-3 border-t border-slate-100/70">
                    <span className="text-[10px] text-slate-400 font-extrabold block">متوسط الحصص لكل طالب</span>
                    <span className="text-md font-bold text-indigo-650 font-mono">
                      {metrics.totalStudents > 0 ? (metrics.totalSessionsDelivered / metrics.totalStudents).toFixed(1) : 0}
                    </span>
                    <span className="text-slate-500 text-[10px] font-bold mr-1">حصة / طالب</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateToTab('financials')}
                className="w-full mt-4 py-2 bg-slate-50 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl text-[11px] font-black text-slate-650 flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <span>عرض التقارير المالية المفصلة</span>
                <ArrowUpRight size={13} />
              </button>
            </div>

          </div>

        </div>

        {/* Right Elements: Scheduled lessons & Action plan (Col-span-5) */}
        <div className="lg:col-span-5 space-y-5">
          
          {/* Upcoming scheduled lectures */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-4 md:p-5 shadow-2xs flex flex-col min-h-[350px]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 shrink-0">
              <div className="space-y-0.5 text-right">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block animate-pulse" />
                  مواعيد الحصص القادمة واليومية
                </h3>
                <p className="text-[10px] text-slate-450 font-bold">الحصص والمحاضرات المقررة اليوم غداً لتنظيم يومك الدراسي</p>
              </div>
              {totalUpcomingCount > 0 && (
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                  {totalUpcomingCount} حصص قريبة
                </span>
              )}
            </div>

            {/* List area with scrollbar if long */}
            <div className="flex-1 overflow-y-auto space-y-4 max-h-[420px] pr-0.5 scrollbar-thin">
              
              {/* TODAY SECTION */}
              <div className="space-y-2">
                <span className="text-[10.5px] font-black text-indigo-600 bg-indigo-50 border border-indigo-100/50 px-2.5 py-0.5 rounded-lg inline-block text-right">
                  حِصص اليوم ({todayDayArabic})
                </span>
                {todayAppointments.length === 0 ? (
                  <p className="text-[11px] text-slate-400 font-medium italic py-2 pr-2 text-right">لا توجد حصص مجدولة لليوم.</p>
                ) : (
                  <div className="space-y-2">
                    {todayAppointments.map(app => {
                      const stud = students.find(s => s.id === app.studentId);
                      return (
                        <div 
                          key={app.id}
                          className="p-3 bg-slate-50/70 hover:bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between gap-3 group transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {stud?.photo ? (
                              <img src={stud.photo} className="w-8 h-8 rounded-full object-cover shrink-0 grayscale-xs" referrerPolicy="no-referrer" alt="" />
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-blue-100/75 text-blue-600 text-xs font-black flex items-center justify-center shrink-0">
                                {app.studentName.charAt(0)}
                              </div>
                            )}
                            <div className="space-y-0.5 text-right min-w-0">
                              <span 
                                onClick={() => onSelectStudent(app.studentId)}
                                className="text-xs font-black text-slate-800 hover:text-blue-600 cursor-pointer block truncate"
                              >
                                {app.studentName}
                              </span>
                              <p className="text-[9px] text-slate-450 leading-tight truncate">
                                {app.notes ? `📌 ${app.notes}` : `نظام ${stud?.type === 'lesson' ? 'الحصص' : 'الكورسات'}`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="bg-slate-200/60 font-mono text-[10.5px] px-2 py-0.5 rounded-lg text-slate-655 font-bold flex items-center gap-1" dir="ltr">
                              <span className="font-bold">{formatTimeTo12h(app.time)}</span>
                              <Clock size={11} className="text-slate-400" />
                            </div>
                            
                            {stud?.phone && (
                              <a
                                href={`https://wa.me/${stud.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                  `السلام عليكم يا ${stud.name}، تذكير بمعد حصتنا اليوم الساعة ${formatTimeTo12h(app.time)} إن شاء الله. بانتظارك!`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-7.5 h-7.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100 transition-transform active:scale-90"
                                title="إرسال تذكير واتساب سريع"
                              >
                                <MessageSquare size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* TOMORROW SECTION */}
              <div className="space-y-2 pt-2 border-t border-slate-100/60">
                <span className="text-[10.5px] font-black text-emerald-650 bg-emerald-50 border border-emerald-100/50 px-2.5 py-0.5 rounded-lg inline-block text-right">
                  حِصص غداً ({tomorrowDayArabic})
                </span>
                {tomorrowAppointments.length === 0 ? (
                  <p className="text-[11px] text-slate-400 font-medium italic py-2 pr-2 text-right">لا توجد حصص مجدولة للغد.</p>
                ) : (
                  <div className="space-y-2">
                    {tomorrowAppointments.map(app => {
                      const stud = students.find(s => s.id === app.studentId);
                      return (
                        <div 
                          key={app.id}
                          className="p-3 bg-slate-50/70 hover:bg-slate-50 border border-slate-150 rounded-2xl flex items-center justify-between gap-3 group transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {stud?.photo ? (
                              <img src={stud.photo} className="w-8 h-8 rounded-full object-cover shrink-0 grayscale-xs" referrerPolicy="no-referrer" alt="" />
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-emerald-100/75 text-emerald-600 text-xs font-black flex items-center justify-center shrink-0">
                                {app.studentName.charAt(0)}
                              </div>
                            )}
                            <div className="space-y-0.5 text-right min-w-0">
                              <span 
                                onClick={() => onSelectStudent(app.studentId)}
                                className="text-xs font-black text-slate-800 hover:text-blue-600 cursor-pointer block truncate"
                              >
                                {app.studentName}
                              </span>
                              <p className="text-[9px] text-slate-450 leading-tight truncate">
                                {app.notes ? `📌 ${app.notes}` : `نظام ${stud?.type === 'lesson' ? 'الحصص' : 'الكورسات'}`}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="bg-slate-200/60 font-mono text-[10.5px] px-2 py-0.5 rounded-lg text-slate-655 font-bold flex items-center gap-1" dir="ltr">
                              <span className="font-bold">{formatTimeTo12h(app.time)}</span>
                              <Clock size={11} className="text-slate-400" />
                            </div>
                            
                            {stud?.phone && (
                              <a
                                href={`https://wa.me/${stud.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                  `تذكير تلقائي: غداً موعد حصتنا الساعة ${formatTimeTo12h(app.time)} إن شاء الله. يرجى الاستعداد والمراجعة الكافية!`
                                )}`}
                                target="_blank"
                                rel="noreferrer"
                                className="w-7.5 h-7.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center border border-emerald-100 transition-transform active:scale-90"
                                title="إرسال تذكير ترحيبي"
                              >
                                <MessageSquare size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* OTHER WEEK APPOINTMENTS */}
                {otherAppointments.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100/60">
                    <span className="text-[10.5px] font-black text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-lg inline-block text-right">
                      بقية أيام الأسبوع المجدولة
                    </span>
                    <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto pr-0.5 scrollbar-thin">
                      {otherAppointments.slice(0, 4).map(app => (
                        <div key={app.id} className="text-[11px] p-2 bg-slate-50/50 border border-slate-150 rounded-xl flex items-center justify-between text-right">
                          <span className="font-extrabold text-slate-700 truncate max-w-[160px]">{app.studentName}</span>
                          <span className="text-[10px] text-slate-400 font-bold font-mono" dir="ltr">{app.dayOfWeek} • {formatTimeTo12h(app.time)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

            </div>

            {/* Quick scheduling actions footer widget */}
            <div className="bg-gradient-to-l from-indigo-50/40 to-blue-50/40 border border-indigo-100 p-3 rounded-2xl text-[11px] text-slate-700 leading-relaxed text-right mt-3 shrink-0">
              <span className="font-extrabold text-indigo-950 block mb-0.5">💡 تنظيم المواعيد وجدول الحصص:</span>
              يمكنك إدارة وتخطيط أوقات ومواعيد الحصص الأسبوعية بالكامل من خلال بوابة المواعيد وحجز slots دراسية جديدة بسهولة بالغة.
              <button
                onClick={() => onNavigateToTab('schedule')}
                className="font-black text-indigo-600 block mt-1.5 hover:underline cursor-pointer"
              >
                الدخول لبوابة المواعيد والأيام ←
              </button>
            </div>
            
          </div>

          {/* Daily Todo List Card */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-2xs flex flex-col space-y-4 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-indigo-50/40 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-emerald-50/30 rounded-full blur-2xl pointer-events-none" />

            <div className="flex items-center justify-between pb-3 border-b border-slate-100 relative z-10 font-sans">
              <div className="space-y-0.5 text-right font-sans">
                <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-2">
                  <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                    <ClipboardList size={15} />
                  </span>
                  <span>قائمة المهام اليومية السريعة</span>
                </h3>
                <p className="text-[10px] text-slate-450 font-bold">مهام تنظيمية حرة غير مرتبطة بحصص معينة</p>
              </div>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-mono">
                {dailyTasks.filter(t => t.completed).length} / {dailyTasks.length} مكتمل
              </span>
            </div>

            {/* Task completion progress bar */}
            {dailyTasks.length > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${(dailyTasks.filter(t => t.completed).length / dailyTasks.length) * 100}%` }}
                />
              </div>
            )}

            {/* Task Add Form */}
            <form onSubmit={handleAddDailyTask} className="space-y-2 relative z-10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="أضف مهمة جديدة، مثلاً: تصحيح أوراق سريعة..."
                  className="flex-1 bg-slate-50 border border-[#e2e8f0] focus:outline-none focus:border-indigo-500 text-xs px-3.5 py-2.5 rounded-xl transition font-medium placeholder-slate-400 text-right font-sans"
                  dir="rtl"
                />
                
                {/* Bell toggle connection to trigger configuration drawer */}
                <button
                  type="button"
                  onClick={() => setShowReminderPicker(!showReminderPicker)}
                  className={`p-2.5 rounded-xl border flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0 ${
                    newTaskReminderTime 
                      ? 'bg-amber-50 border-amber-200 text-amber-600' 
                      : showReminderPicker 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                        : 'bg-slate-50 border-[#e2e8f0] text-slate-450 hover:bg-slate-100'
                  }`}
                  title="تعيين وقت تنبيه مخصص للمهمة"
                >
                  <Bell size={15} className={newTaskReminderTime ? 'animate-bounce' : ''} />
                </button>

                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-3xs cursor-pointer active:scale-95 shrink-0"
                >
                  <Plus size={14} />
                  <span>إضافة</span>
                </button>
              </div>

              {/* Collapsible alarm date picker panel */}
              {showReminderPicker && (
                <div className="flex flex-col sm:flex-row items-center gap-2 bg-indigo-50/50 border border-indigo-100 p-2.5 rounded-xl text-right animate-fadeIn" dir="rtl">
                  <span className="text-[10px] font-extrabold text-indigo-850 shrink-0">⏰ وقت التنبيه:</span>
                  <input
                    type="datetime-local"
                    value={newTaskReminderTime}
                    onChange={(e) => setNewTaskReminderTime(e.target.value)}
                    className="flex-grow bg-white border border-indigo-150 focus:outline-none focus:border-indigo-500 rounded-lg text-[11px] px-2 py-1 font-bold text-slate-705 font-sans"
                  />
                  {newTaskReminderTime && (
                    <button
                      type="button"
                      onClick={() => setNewTaskReminderTime('')}
                      className="text-[9px] text-red-500 font-bold hover:underline shrink-0"
                    >
                      إلغاء التنبيه
                    </button>
                  )}
                </div>
              )}
            </form>

            {/* Todo Items list */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5 scrollbar-thin relative z-10" dir="rtl">
              {dailyTasks.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-medium italic">
                  لا توجد مهام مضافة حالياً. ابدأ بإضافة مهامك اليومية بالتحضير!
                </div>
              ) : (
                dailyTasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => handleToggleDailyTask(task.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-with-all cursor-pointer group border ${
                      task.completed 
                        ? 'bg-slate-50/60 border-slate-100 text-slate-400 line-through' 
                        : 'bg-white hover:bg-slate-50 border-slate-150 text-slate-700 font-semibold shadow-3xs'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 text-right">
                      <button 
                        type="button" 
                        className={`shrink-0 ${task.completed ? 'text-emerald-500' : 'text-slate-400 group-hover:text-indigo-600'}`}
                      >
                        {task.completed ? (
                          <CheckSquare size={14} className="fill-emerald-50 text-emerald-600" />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                      
                      <div className="flex flex-col min-w-0 flex-1 text-right">
                        <span className="leading-relaxed truncate flex-1">{task.text}</span>
                        {task.reminderTime && !task.completed && (
                          <span className="text-[9px] text-amber-600 font-bold flex items-center gap-1 mt-0.5">
                            <span className="inline-block animate-pulse">🔔</span>
                            <span>تنبيه: {formatReminder(task.reminderTime)}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleDeleteDailyTask(task.id, e)}
                        className="text-slate-350 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100 transition duration-150 shrink-0 cursor-pointer"
                        title="حذف المهمة"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Active Daily Tasks alerts popup modal overlay */}
      {activeAlertTasks.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-100 font-sans cursor-default" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl relative w-full max-w-sm overflow-hidden text-right p-5 flex flex-col items-center">
            
            <div className="w-14 h-14 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-3 animate-bounce">
              <Bell size={28} className="fill-amber-500" />
            </div>

            <h3 className="text-sm font-black text-slate-800 text-center mb-1">⏰ حان وقت التنبيه للمهمة اليومية!</h3>
            <p className="text-[10px] text-slate-450 font-bold mb-4 text-center">حان وقت التذكير الذي قمت بضبطه مسبقاً للتحضير</p>

            {/* List of active due tasks */}
            <div className="w-full space-y-2.5 max-h-48 overflow-y-auto shrink-0 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-150 scrollbar-thin">
              {activeAlertTasks.map(task => (
                <div key={task.id} className="text-xs bg-white border border-slate-200/80 p-3 rounded-xl flex flex-col justify-start relative shadow-3xs">
                  <span className="font-extrabold text-slate-850 leading-relaxed mb-2 text-right">{task.text}</span>
                  
                  {task.reminderTime && (
                    <span className="text-[9px] font-bold text-slate-450 block mb-2 font-mono text-right">
                      📅 الموعد المبرمج: {formatReminder(task.reminderTime)}
                    </span>
                  )}

                  <div className="flex gap-2 w-full mt-1 justify-end">
                    <button
                      onClick={() => handleCompleteTaskFromAlert(task.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[10px] rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      ✔️ تم الإنجاز
                    </button>
                    <button
                      onClick={() => handleDismissAlert(task.id)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold text-[10px] rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      موافق، إغلاق
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[9.5px] text-slate-400 text-center italic">
              تنظم قائمة المهام السريعة جدولك وتذكرك بكل المهام دون تشتيت!
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
