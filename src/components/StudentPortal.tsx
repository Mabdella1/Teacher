import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GraduationCap, Calendar, Clock, DollarSign, Award, Bell, 
  BookOpen, ChevronLeft, LogOut, CheckCircle2, AlertTriangle, 
  Smartphone, User, Award as CupIcon, Sparkles, BookMarked,
  Heart, Milestone, ClipboardList, LayoutGrid, Activity, MessageSquare, Lock, X
} from 'lucide-react';
import { Student, Appointment, ExamAppointment, TeacherPreferences, Session, Payment, StudyNote, ChatGroup } from '../types';
import SmartStatisticsWidget from './SmartStatisticsWidget';
import LiveChat from './LiveChat';
// @ts-ignore
import studentLogo from '../assets/images/student_logo_1780395755595.png';

// Helper to determine day of the week in Arabic
function getArabicDayName(dateStr: string): string {
  try {
    const days = [
      'الأحد',
      'الإثنين',
      'الثلاثاء',
      'الأربعاء',
      'الخميس',
      'الجمعة',
      'السبت'
    ];
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return days[date.getDay()];
  } catch {
    return '';
  }
}

interface StudentPortalProps {
  student: Student;
  allAppointments: Appointment[];
  allExamAppointments: ExamAppointment[];
  preferences: TeacherPreferences;
  onLogout: () => void;
  onUpdateStudent?: (id: string, updatedFields: Partial<Student>) => void;
}

export default function StudentPortal({ 
  student, 
  allAppointments, 
  allExamAppointments, 
  preferences, 
  onLogout,
  onUpdateStudent
}: StudentPortalProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sessions' | 'payments' | 'chat'>('dashboard');
  const [sessionsSubTab, setSessionsSubTab] = useState<'timeline' | 'followup'>('timeline');
  const [newPassword, setNewPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [isEditingPassword, setIsEditingPassword] = useState(false);

  // Claimed vouchers list with unique coupon codes state
  const [claimedCodes, setClaimedCodes] = useState<{ voucherId: string; title: string; points: number; code: string; date: string }[]>(() => {
    const key = `student_claimed_vouchers_${student.id}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  });
  const [successClaimVoucher, setSuccessClaimVoucher] = useState<{
    title: string;
    code: string;
    pointsSpent: number;
  } | null>(null);

  // States for interactive self-registration modals (requested by user)
  const [isOpenRegisterSessionModal, setIsOpenRegisterSessionModal] = useState(false);
  const [isOpenRegisterPaymentModal, setIsOpenRegisterPaymentModal] = useState(false);
  const [regSessionDate, setRegSessionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [regSessionTime, setRegSessionTime] = useState('16:00');
  const [regSessionNotes, setRegSessionNotes] = useState('');
  const [regPaymentAmount, setRegPaymentAmount] = useState('100');
  const [regPaymentDate, setRegPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [regPaymentNotes, setRegPaymentNotes] = useState('');
  const [selfRegSuccessMessage, setSelfRegSuccessMessage] = useState('');
  const [selfRegErrorMessage, setSelfRegErrorMessage] = useState('');

  const [studentGroups, setStudentGroups] = useState<ChatGroup[]>([]);
  const [activeChatTarget, setActiveChatTarget] = useState<{ id: string; name: string }>({ id: student.id, name: 'المحادثة الخاصة مع الأستاذ' });
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);

  useEffect(() => {
    if (activeTab === 'chat') {
      setIsLoadingGroups(true);
      fetch('/api/chat-groups')
        .then(res => res.json())
        .then(data => {
          if (data && data.groups) {
            // Filter only groups the current student is a member of
            const myGroups = data.groups.filter((g: ChatGroup) => g.studentIds.includes(student.id));
            setStudentGroups(myGroups);
          }
          setIsLoadingGroups(false);
        })
        .catch(err => {
          console.error("Error fetching student groups:", err);
          setIsLoadingGroups(false);
        });
    }
  }, [activeTab, student.id]);

  // Filter student-specific records
  const myAppointments = allAppointments.filter(app => app.studentId === student.id);
  const myExams = allExamAppointments.filter(exam => exam.studentId === student.id);
  
  // Basic calculations
  const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
  
  // Sessions computation
  const normalSessions = student.sessions.filter(s => !s.isExtra);
  const extraSessions = student.sessions.filter(s => s.isExtra);

  // Calculate paid and unpaid sessions for any student classification
  const chronologicalSessions = [...student.sessions].reverse(); // oldest first
  let remainingMoney = totalPaid;
  const sessionCost = student.lessonRate || (student.coursePrice && student.totalLessonsCount ? (student.coursePrice / student.totalLessonsCount) : 0) || 100;

  const paidSessionsCount = chronologicalSessions.filter((session) => {
    const cost = session.isExtra ? (session.extraPrice || sessionCost) : sessionCost;
    if (cost <= 0) return true;
    if (remainingMoney >= cost - 0.01) {
      remainingMoney -= cost;
      return true;
    }
    return false;
  }).length;

  const unpaidSessionsCount = student.sessions.length - paidSessionsCount;
  
  let outstandingBalance = 0;
  let remainingLessons = 0;
  let progressPercentage = 0;

  if (student.type === 'course') {
    const coursePrice = student.coursePrice || 0;
    outstandingBalance = Math.max(0, coursePrice - totalPaid);
    const totalLessons = student.totalLessonsCount || 0;
    const attendedCount = normalSessions.length;
    remainingLessons = Math.max(0, totalLessons - attendedCount);
    progressPercentage = totalLessons > 0 ? Math.round((attendedCount / totalLessons) * 100) : 0;
  } else {
    // Lesson system
    const lessonRate = student.lessonRate || 0;
    const totalCost = normalSessions.length * lessonRate + extraSessions.reduce((sum, s) => sum + (s.extraPrice || lessonRate), 0);
    outstandingBalance = Math.max(0, totalCost - totalPaid);
  }

  // Next due payment reminder message
  const isPaymentDue = student.type === 'course' && student.dueDate;

  // --- ENHANCED & CUSTOMIZABLE STUDENT PORTAL NOTIFICATION ENGINE ---
  const [notifSettings] = useState(() => {
    const DEFAULT = {
      remindClasses: true,
      classHoursThreshold: 2,
      remindPayments: true,
      paymentDaysThreshold: 3,
      remindCompletion: true,
      completionRemainingCount: 1,
      classTemplate: 'السلام عليكم يا [الاسم]، نود تذكيرك بموعد حصتنا اليوم الساعة [الوقت] إن شاء الله. بالتوفيق!',
      paymentTemplate: 'السلام عليكم يا [الاسم]، تذكير لطيف بمستحقات الكورس المتبقية وقيمتها [المتبقي] [العملة] المستحقة في [التاريخ]. شكراً لكم!',
      completionTemplate: 'أهلاً يا [الاسم]، نود إخطارك باقتراب اكتمال حصص الكورس المسجلة لك بنجاح. لقد أنجزت [الحصص] حصة حتى الآن.',
      sendStudentClassReminders: true,
      sendStudentPaymentReminders: true,
      sendStudentCompletionReminders: true,
    };
    const stored = localStorage.getItem('teacherNotificationSettings');
    if (stored) {
      try {
        return { ...DEFAULT, ...JSON.parse(stored) };
      } catch (e) {}
    }
    return DEFAULT;
  });

  const [dismissedStudentAlerts, setDismissedStudentAlerts] = useState<string[]>(() => {
    const stored = localStorage.getItem('studentDismissedAlerts');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {}
    }
    return [];
  });

  const handleDismissStudentAlert = (id: string) => {
    const nextSaved = [...dismissedStudentAlerts, id];
    setDismissedStudentAlerts(nextSaved);
    localStorage.setItem('studentDismissedAlerts', JSON.stringify(nextSaved));
  };

  const handleResetDismissedStudentAlerts = () => {
    setDismissedStudentAlerts([]);
    localStorage.removeItem('studentDismissedAlerts');
  };

  const studentPortalAlerts: {
    id: string;
    type: 'class' | 'payment' | 'completion' | 'exam';
    title: string;
    message: string;
    badge: string;
  }[] = [];

  const nowTime = new Date();

  // Helper to convert time format nicely
  const formatTo12hLocal = (timeStr: string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10);
    if (isNaN(h)) return timeStr;
    const ampm = h >= 12 ? 'مساءً' : 'صباحاً';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    return `${displayH}:${mStr || '00'} ${ampm}`;
  };

  const fillTemplateLocal = (template: string, studentName: string, extra: { time?: string; date?: string; outstanding?: number | string; count?: number | string }) => {
    let res = template;
    res = res.replace(/\[الاسم\]/g, studentName);
    res = res.replace(/\[الوقت\]/g, extra.time || '');
    res = res.replace(/\[التاريخ\]/g, extra.date || '');
    res = res.replace(/\[المتبقي\]/g, String(extra.outstanding !== undefined ? extra.outstanding : ''));
    res = res.replace(/\[العملة\]/g, preferences.currency || 'ج.م');
    res = res.replace(/\[الحصص\]/g, String(extra.count !== undefined ? extra.count : ''));
    return res;
  };

  // 1. Upcoming Classes Reminders
  if (notifSettings.sendStudentClassReminders !== false && notifSettings.remindClasses) {
    const weekdayIndices: { [key: string]: number } = {
      'الأحد': 0, 'الاثنين': 1, 'الإثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6
    };
    
    // Find todays appointments
    myAppointments.forEach(app => {
      let isTodayApp = false;
      if (app.isExceptional) {
        const ymd = nowTime.toISOString().split('T')[0];
        isTodayApp = app.date === ymd;
      } else {
        const todayIdx = nowTime.getDay();
        const appIdx = weekdayIndices[app.dayOfWeek];
        isTodayApp = appIdx === todayIdx;
      }

      if (isTodayApp) {
        const [appH, appM] = app.time.split(':').map(Number);
        const appDateTime = new Date(nowTime);
        appDateTime.setHours(appH, appM, 0, 0);

        const diffMs = appDateTime.getTime() - nowTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Within classHoursThreshold and up to 1 hour after class start
        if (diffHours <= notifSettings.classHoursThreshold && diffHours >= -1) {
          const alertId = `st-class-${app.id}-${nowTime.toDateString()}`;
          if (!dismissedStudentAlerts.includes(alertId)) {
            const time12 = formatTo12hLocal(app.time);
            const filling = fillTemplateLocal(notifSettings.classTemplate, student.name, { time: time12 });
            let badgeText = 'اليوم';
            if (diffHours < 0) {
              badgeText = 'بدأت الحصة 🟢';
            } else if (diffHours < 1) {
              badgeText = `تبدأ خلال ${Math.round(diffHours * 60)} دقيقة ⚡`;
            } else {
              badgeText = `باقي ${Math.round(diffHours)} ساعة`;
            }

            studentPortalAlerts.push({
              id: alertId,
              type: 'class',
              title: app.isExceptional ? '📆 لديك حصة استثنائية مجدولة اليوم!' : '📆 حصتك المجدولة لليوم تقترب!',
              message: filling,
              badge: badgeText
            });
          }
        }
      }
    });

    // Reminders standard display for tomorrow
    const tomorrowDayIndex = (nowTime.getDay() + 1) % 7;
    myAppointments.forEach(app => {
      if (!app.isExceptional) {
        const weekdayIndicesTomorrow: { [key: string]: number } = {
          'الأحد': 0, 'الاثنين': 1, 'الإثنين': 1, 'الثلاثاء': 2, 'الأربعاء': 3, 'الخميس': 4, 'الجمعة': 5, 'السبت': 6
        };
        const appIdx = weekdayIndicesTomorrow[app.dayOfWeek];
        if (appIdx === tomorrowDayIndex && student.autoReminder && preferences.enableWhatsApp24hReminders !== false) {
          const alertId = `st-tomorrow-${app.id}-${nowTime.toDateString()}`;
          if (!dismissedStudentAlerts.includes(alertId)) {
            studentPortalAlerts.push({
              id: alertId,
              type: 'class',
              title: '📌 تذكير مسبق بحصة الغد',
              message: `أهلاً يا ${student.name}، نود تذكيرك أن لديك حصة غداً في تمام الساعة ${formatTo12hLocal(app.time)} إن شاء الله.`,
              badge: 'غداً 🚀'
            });
          }
        }
      }
    });
  }

  // 2. Payment Due Reminders for Student
  if (notifSettings.sendStudentPaymentReminders !== false && notifSettings.remindPayments) {
    if (outstandingBalance > 0) {
      if (student.type === 'course' && student.dueDate) {
        const dueDateObj = new Date(student.dueDate);
        const diffTime = dueDateObj.getTime() - nowTime.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= notifSettings.paymentDaysThreshold) {
          const isOverdue = diffDays < 0;
          const alertId = `st-payment-${student.id}-${student.dueDate}`;
          if (!dismissedStudentAlerts.includes(alertId)) {
            const filling = fillTemplateLocal(notifSettings.paymentTemplate, student.name, {
              outstanding: outstandingBalance,
              date: student.dueDate
            });
            studentPortalAlerts.push({
              id: alertId,
              type: 'payment',
              title: isOverdue ? '⚠️ تجاوزت تاريخ استحقاق الدفع!' : '💰 موعد قادم لسداد المستحقات',
              message: filling,
              badge: isOverdue ? 'متأخرة السداد 🚨' : `متبقي ${diffDays} يوم`
            });
          }
        }
      } else {
        // Simple lesson rate threshold reminder
        const alertId = `st-payment-lesson-${student.id}-${outstandingBalance}`;
        if (!dismissedStudentAlerts.includes(alertId)) {
          const filling = fillTemplateLocal(notifSettings.paymentTemplate, student.name, {
            outstanding: outstandingBalance,
            date: 'الآن'
          });
          studentPortalAlerts.push({
            id: alertId,
            type: 'payment',
            title: '💰 مستحقات مالية متراكمة للعمل التعليمي',
            message: filling,
            badge: 'ذمة معلقة 🔔'
          });
        }
      }
    }
  }

  // 3. Course Completion Reminders (Session deadlines / count limitation)
  if (notifSettings.sendStudentCompletionReminders !== false && notifSettings.remindCompletion) {
    if (student.type === 'course' && student.totalLessonsCount !== undefined) {
      const total = student.totalLessonsCount;
      const currentCount = student.sessions.length;
      const remaining = total - currentCount;

      if (remaining <= notifSettings.completionRemainingCount && remaining >= 0) {
        const alertId = `st-completion-${student.id}-${currentCount}`;
        if (!dismissedStudentAlerts.includes(alertId)) {
          const filling = fillTemplateLocal(notifSettings.completionTemplate, student.name, {
            count: currentCount
          });
          studentPortalAlerts.push({
            id: alertId,
            type: 'completion',
            title: remaining === 0 ? '🏆 اكتمل نطاق الكورس بنجاح!' : '🏆 اقتراب انتهاء باقة الكورس المعتمدة',
            message: remaining === 0 
              ? `${filling} أتممت الباقة بالكامل (${currentCount} حصص منصلة ${total}). نرجو التجديد للاستمرار.`
              : `${filling} متبقي لك فقط ${remaining} جلسة/جلسات متبقية في الباقة الحالية (${total}).`,
            badge: remaining === 0 ? 'مكتمل بنجاح 🎉' : `متبقي ${remaining} حصص`
          });
        }
      }
    }
  }

  // 4. Exams (Always visible)
  if (myExams.length > 0) {
    const nextExam = myExams[0];
    const alertId = `st-exam-${nextExam.id}`;
    if (!dismissedStudentAlerts.includes(alertId)) {
      studentPortalAlerts.push({
        id: alertId,
        type: 'exam',
        title: '📝 تذكير باختبار تعليمي قادم',
        message: `لديك اختبار مجدول بتاريخ ${nextExam.date} في تمام الساعة ${formatTo12hLocal(nextExam.time)}. موضوع الاختبار: ${nextExam.notes || 'مراجعة عامة'}.`,
        badge: 'اختبار 🎯'
      });
    }
  }

  // Mock available reward reward claims to make the loyalty system incredibly fun!
  const availableVouchers = [
    { id: 'v1', points: 100, title: 'خصم 20% على الحصة القادمة', desc: 'وفر ماليًا على حصتك القادمة بنقاطك.' },
    { id: 'v2', points: 250, title: 'حصة مجانية بالكامل 🎁', desc: 'احصل على حصة تكميلية مجاناً مكافأةً لالتزامك الدراسي.' },
  ];

  // Handler for student self-registering a session (requested by user)
  const handleStudentSelfRegisterSession = (e: React.FormEvent) => {
    e.preventDefault();
    setSelfRegSuccessMessage('');
    setSelfRegErrorMessage('');

    if (!regSessionDate || !regSessionTime) {
      setSelfRegErrorMessage('الرجاء التأكد من كتابة التاريخ والوقت بشكل صحيح.');
      return;
    }

    const newSession: Session = {
      id: `session-self-${Date.now()}`,
      date: regSessionDate,
      time: regSessionTime,
      notes: regSessionNotes.trim() || 'حضور حصة - تسجيل ذاتي بواسطة الطالب',
    };

    if (onUpdateStudent) {
      const updatedSessions = [newSession, ...student.sessions];
      // Increment points (+20) for recording session
      const updatedPoints = (student.rewardPoints || 0) + 20;
      onUpdateStudent(student.id, {
        sessions: updatedSessions,
        rewardPoints: updatedPoints
      });
      setSelfRegSuccessMessage('تم تسجيل حضور الحصة بنجاح في سجلاتك! مبروك حصلت على +20 نقطة تميز! 🎉');
      setIsOpenRegisterSessionModal(false);
      setRegSessionNotes('');
    } else {
      setSelfRegErrorMessage('عذراً، يرجى تزويد بوابة الأستاذ بوحدة التعديل السحابي.');
    }
  };

  // Handler for student self-registering a payment (requested by user)
  const handleStudentSelfRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setSelfRegSuccessMessage('');
    setSelfRegErrorMessage('');

    const paidAmt = Number(regPaymentAmount);
    if (!regPaymentDate || isNaN(paidAmt) || paidAmt <= 0) {
      setSelfRegErrorMessage('الرجاء كتابة تاريخ ومبلغ الدفعة بشكل صحيح وموجب.');
      return;
    }

    const newPayment: Payment = {
      id: `pay-self-${Date.now()}`,
      amount: paidAmt,
      date: regPaymentDate,
      notes: regPaymentNotes.trim() || 'سداد دفعة مالية - إخطار ذاتي بواسطة الطالب',
    };

    if (onUpdateStudent) {
      const updatedPayments = [newPayment, ...student.payments];
      // Increment points (+50) for fast financial clearance reporting
      const updatedPoints = (student.rewardPoints || 0) + 50;
      onUpdateStudent(student.id, {
        payments: updatedPayments,
        rewardPoints: updatedPoints
      });
      setSelfRegSuccessMessage(`تم استلام وتسجيل إشعار الدفعة بمبلغ ${paidAmt} ${preferences.currency || 'ج.م'} بنجاح! حصلت على +50 نقطة مكافأة! 🎉`);
      setIsOpenRegisterPaymentModal(false);
      setRegPaymentAmount('100');
      setRegPaymentNotes('');
    } else {
      setSelfRegErrorMessage('عذراً، يرجى تزويد بوابة الأستاذ بوحدة التعديل السحابي.');
    }
  };

  return (
    <div id="student-portal-container" className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col w-full max-w-full overflow-x-hidden text-right" dir="rtl">
      
      {/* Top Stylish Student Navbar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 border-b border-slate-100 px-6 py-4 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-md border border-indigo-100 bg-white flex items-center justify-center shrink-0 cursor-pointer transition-all hover:scale-105">
            <img 
              src={studentLogo} 
              alt="شعار بوابة الطلاب" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <span className="text-slate-400 text-[10px] sm:text-xs font-black block">بوابة الطلاب الذكية</span>
            <h1 className="text-sm sm:text-lg font-black text-slate-900 leading-tight">منصة {preferences.teacherName} • {preferences.subject}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-bold py-1 px-2.5 rounded-full">
            الحساب نشط 🟢
          </span>
          <button 
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs py-2 px-3.5 rounded-xl transition-all cursor-pointer active:scale-95"
            title="تسجيل الخروج والرجوع للمدخل العام"
          >
            <LogOut size={14} />
            <span className="hidden md:inline">تسجيل خروج</span>
          </button>
        </div>
      </header>

      {/* Main Student Layout Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-8">
        
        {/* Welcome Dashboard Banner Card */}
        <div className="relative rounded-3xl overflow-hidden shadow-xl bg-gradient-to-l from-indigo-900 via-indigo-950 to-indigo-900 text-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 border-b-6 border-indigo-600">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_50%)] pointer-events-none" />
          
          <div className="flex items-center gap-4 sm:gap-6 z-10">
            {student.photo ? (
              <img 
                src={student.photo} 
                alt={student.name} 
                className="w-16 h-16 sm:w-22 sm:h-22 rounded-2xl object-cover border-4 border-indigo-500/45 shadow-lg shadow-indigo-950" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-2xl bg-indigo-600 text-indigo-100 text-4xl flex items-center justify-center font-black border-2 border-indigo-500/25 shadow-inner">
                {student.name.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <h2 className="text-xl sm:text-3xl font-black">{student.name}</h2>
                <span className="bg-emerald-500 text-white text-[9px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm font-sans animate-pulse">
                  <CheckCircle2 size={10} /> طالب متميز
                </span>
              </div>
              
              {/* Premium Classified Mode Badge */}
              <div className="my-2 flex flex-wrap gap-2 items-center">
                {student.type === 'course' ? (
                  <span className="bg-gradient-to-r from-violet-600 to-fuchsia-700 text-white text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-fuchsia-500/25 shadow-md">
                    📚 نظام الاشتراك الشهري / الباقة الشاملة
                  </span>
                ) : (
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white text-[10px] sm:text-xs font-black px-3 py-1.5 rounded-xl flex items-center gap-1.5 border border-indigo-500/25 shadow-md">
                    ⏱️ نظام المحاسبة والدفع للحصة الفردية ({student.lessonRate} {preferences.currency})
                  </span>
                )}
                {student.type === 'course' && student.totalLessonsCount ? (
                  <span className="bg-white/10 text-indigo-100 text-[9px] sm:text-xs font-semibold px-2 py-1 rounded-lg border border-white/5">
                    الاستيعاب: {student.totalLessonsCount} حصة كافية
                  </span>
                ) : null}
              </div>

              <p className="text-xs sm:text-sm text-indigo-200/90 font-semibold flex items-center gap-1.5 mt-2">
                <Smartphone size={13} className="text-indigo-400" /> هاتف مبرمج: {student.phone}
              </p>
              <p className="text-[10px] sm:text-xs text-indigo-300 font-mono mt-1">تاريخ الانضمام: {new Date(student.createdAt || Date.now()).toLocaleDateString('ar-EG')}</p>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col sm:flex-row gap-4 w-full md:w-auto items-stretch sm:items-center z-10 select-none">
            <div className="text-right sm:border-l sm:border-white/10 sm:pl-6">
              <span className="text-[10px] text-indigo-300 font-extrabold block mb-1">نقاط الولاء وتحديات التفوق 👑</span>
              <div className="flex items-center gap-1.5">
                <Award className="text-amber-400 animate-bounce" size={20} />
                <span className="text-xl sm:text-2xl font-black text-amber-300">{student.rewardPoints || 0}</span>
                <span className="text-[10px] text-white/80 font-bold">نقطة تميز</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-indigo-300 font-extrabold block mb-1">الوضع المالي الشامل</span>
              <span className={`text-base sm:text-lg font-black ${outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {outstandingBalance > 0 ? `${outstandingBalance} ${preferences.currency || 'ج.م'} متأخر` : 'مكتمل المسح ✅'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Status Notification Messages */}
        {selfRegSuccessMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-900 rounded-2xl text-xs font-black flex items-center gap-2"
          >
            <CheckCircle2 className="text-emerald-600" size={18} />
            <span>{selfRegSuccessMessage}</span>
          </motion.div>
        )}
        {selfRegErrorMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-50 border border-rose-250 text-rose-900 rounded-2xl text-xs font-black flex items-center gap-2"
          >
            <AlertTriangle className="text-rose-600" size={18} />
            <span>{selfRegErrorMessage}</span>
          </motion.div>
        )}

        {/* INTERACTIVE ACTIVITY SELF-REGISTRATION PANEL */}
        <div id="student-self-operations" className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-right space-y-1">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
                <Activity size={18} className="text-indigo-600 animate-spin-slow" />
                تسجيل العمليات والإجراءات التفاعلية الفورية ⚡️
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-bold leading-relaxed">
                هل حضرت حصة جديدة أو قمت بتحويل دفعة مالية للمعلم؟ يمكنك قيدها وتسجيلها في حسابك الآن بمثالية وسرعة فائقة!
              </p>
            </div>
            
            <div className="flex flex-row items-center gap-3 w-full sm:w-auto justify-end">
              {/* Register Session button */}
              <button
                type="button"
                id="student-btn-register-session"
                onClick={() => {
                  setSelfRegSuccessMessage('');
                  setSelfRegErrorMessage('');
                  setIsOpenRegisterSessionModal(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] sm:text-xs md:text-sm rounded-2xl cursor-pointer shadow-md shadow-indigo-600/10 transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                <span className="text-base leading-none">📝</span>
                <span className="truncate">تسجيل حصة</span>
              </button>

              {/* Register Payment button */}
              <button
                type="button"
                id="student-btn-register-payment"
                onClick={() => {
                  setSelfRegSuccessMessage('');
                  setSelfRegErrorMessage('');
                  setIsOpenRegisterPaymentModal(true);
                }}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] sm:text-xs md:text-sm rounded-2xl cursor-pointer shadow-md shadow-emerald-600/10 transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 text-center"
              >
                <span className="text-base leading-none">💰</span>
                <span className="truncate">تسجيل دفعة</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Alerts / Broadcast notifications */}
        {studentPortalAlerts.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                <Bell size={14} className="text-indigo-600 shrink-0" /> الإشعارات والتنبيهات المخصصة لك 📢
              </h3>
              {dismissedStudentAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={handleResetDismissedStudentAlerts}
                  className="text-[10px] text-indigo-750 hover:underline font-black cursor-pointer"
                >
                  إعادة عرض التنبيهات المخفية ({dismissedStudentAlerts.length})
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {studentPortalAlerts.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`border p-4 rounded-2xl flex items-start gap-3 relative transition duration-150 group shadow-xs ${
                    alert.type === 'class'
                      ? 'bg-blue-50/70 hover:bg-blue-50 border-blue-100 text-blue-950'
                      : alert.type === 'payment'
                      ? 'bg-red-50/60 hover:bg-red-50 border-red-100 text-red-950'
                      : alert.type === 'completion'
                      ? 'bg-purple-50/70 hover:bg-purple-50 border-purple-100 text-purple-950'
                      : 'bg-indigo-50/70 hover:bg-indigo-50 border-indigo-100 text-indigo-950'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleDismissStudentAlert(alert.id)}
                    className="absolute top-2.5 left-2.5 text-slate-300 hover:text-red-500 opacity-60 group-hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
                    title="إخفاء التنبيه"
                  >
                    <X size={14} />
                  </button>

                  {/* Circular icon representation */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border text-sm ${
                    alert.type === 'class'
                      ? 'bg-blue-100 border-blue-200 text-blue-600'
                      : alert.type === 'payment'
                      ? 'bg-red-100 border-red-200 text-red-650'
                      : alert.type === 'completion'
                      ? 'bg-purple-100 border-purple-200 text-purple-600'
                      : 'bg-indigo-100 border-indigo-200 text-indigo-600'
                  }`} style={{ minWidth: '36px' }}>
                    {alert.type === 'class' && '📆'}
                    {alert.type === 'payment' && '💰'}
                    {alert.type === 'completion' && '🏆'}
                    {alert.type === 'exam' && '📝'}
                  </div>

                  <div className="flex-1 space-y-1 pl-4 text-right">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-extrabold text-slate-900 text-xs leading-snug">
                        {alert.title}
                      </h4>
                      <span className="text-[9px] font-bold text-slate-500 bg-white/90 border border-slate-100 rounded px-1.5 py-0.5 shrink-0 shadow-3xs">
                        {alert.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold whitespace-pre-line mt-1">
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dashboard Dynamic Tab Navigation - Elegant Icon Docks */}
        <div className="bg-white border border-slate-100 rounded-3xl p-2 shadow-xs max-w-2xl mx-auto select-none w-full">
          <div className="grid grid-cols-4 gap-1 select-none">
            <button 
              type="button"
              onClick={() => setActiveTab('dashboard')} 
              className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 rounded-2xl transition-all duration-250 cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'bg-indigo-50 text-indigo-700 font-extrabold scale-103' 
                  : 'text-slate-455 hover:text-indigo-605 hover:bg-slate-50/50'
              }`}
              title="لوحة التحكم العامة"
            >
              <div className={`p-2.5 rounded-xl transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : 'bg-slate-55 bg-slate-100/60 text-slate-500 hover:scale-105'}`}>
                <LayoutGrid size={22} className="stroke-[2.2]" />
              </div>
              <span className="text-[10px] sm:text-xs tracking-tight font-black">اللوحة العامة</span>
            </button>
            
            <button 
              type="button"
              onClick={() => setActiveTab('sessions')} 
              className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 rounded-2xl transition-all duration-250 cursor-pointer ${
                activeTab === 'sessions' 
                  ? 'bg-indigo-50 text-indigo-700 font-extrabold scale-103' 
                  : 'text-slate-455 hover:text-indigo-605 hover:bg-slate-50/50'
              }`}
              title="سجل الحصص والمتابعة الدراسية"
            >
              <div className={`p-2.5 rounded-xl transition-all duration-200 ${activeTab === 'sessions' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : 'bg-slate-55 bg-slate-100/60 text-slate-500 hover:scale-105'}`}>
                <Calendar size={22} className="stroke-[2.2]" />
              </div>
              <span className="text-[10px] sm:text-xs tracking-tight font-black font-sans">سجل الحصص</span>
            </button>
            
            <button 
              type="button"
              onClick={() => setActiveTab('payments')} 
              className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 rounded-2xl transition-all duration-250 cursor-pointer ${
                activeTab === 'payments' 
                  ? 'bg-indigo-50 text-indigo-700 font-extrabold scale-103' 
                  : 'text-slate-455 hover:text-indigo-605 hover:bg-slate-50/50'
              }`}
              title="سجل الدفعات والوصولات المالية"
            >
              <div className={`p-2.5 rounded-xl transition-all duration-200 ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : 'bg-slate-55 bg-slate-100/60 text-slate-500 hover:scale-105'}`}>
                <DollarSign size={22} className="stroke-[2.2]" />
              </div>
              <span className="text-[10px] sm:text-xs tracking-tight font-black">سجل الدفعات</span>
            </button>
            
            <button 
              type="button"
              onClick={() => setActiveTab('chat')} 
              className={`flex flex-col items-center justify-center gap-1.5 py-3.5 px-1 rounded-2xl transition-all duration-250 cursor-pointer relative ${
                activeTab === 'chat' 
                  ? 'bg-indigo-50 text-indigo-700 font-extrabold scale-103' 
                  : 'text-slate-455 hover:text-indigo-605 hover:bg-slate-50/50'
              }`}
              title="المحادثة المباشرة مع الأستاذ"
            >
              <div className={`p-2.5 rounded-xl transition-all duration-200 ${activeTab === 'chat' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25' : 'bg-slate-55 bg-slate-100/60 text-slate-500 hover:scale-105'}`}>
                <MessageSquare size={22} className="stroke-[2.2]" />
              </div>
              <span className="text-[10px] sm:text-xs tracking-tight font-black">المحادثات</span>
            </button>
          </div>
        </div>

        {/* Tab Contents Frame */}
        <AnimatePresence mode="wait">
          
          {/* TAB 1: GENERAL DASHBOARD */}
          {activeTab === 'dashboard' && (
            <motion.div 
              id="student-dashboard"
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Visual Progress / Sessions Counts Box */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                  <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-50 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block">إحصائيات الحصص والتحصيل 📊</span>
                      <h4 className="text-base font-black text-slate-900 mt-1">
                        بيانات حضور الحصص والتحصيل الحالية
                      </h4>
                    </div>
                    <div className="bg-indigo-50 text-indigo-650 p-2.5 rounded-2xl">
                      <BookMarked size={20} />
                    </div>
                  </div>

                  <div className="my-5 grid grid-cols-3 gap-2">
                    <div className="bg-indigo-50/50 rounded-2xl p-3 text-center border border-indigo-100/30 flex flex-col justify-center items-center">
                      <p className="text-[9px] text-indigo-700 font-bold mb-1">إجمالي الحصص</p>
                      <p className="text-base sm:text-lg font-black text-indigo-950">{student.sessions.length} حصة</p>
                    </div>
                    <div className="bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100/30 flex flex-col justify-center items-center">
                      <p className="text-[9px] text-emerald-700 font-bold mb-1">الحصص المدفوعة</p>
                      <p className="text-base sm:text-lg font-black text-emerald-800">{paidSessionsCount} حصة</p>
                    </div>
                    <div className="bg-amber-50 rounded-2xl p-3 text-center border border-amber-100/30 flex flex-col justify-center items-center">
                      <p className="text-[9px] text-amber-700 font-bold mb-1">غير مدفوعة</p>
                      <p className="text-base sm:text-lg font-black text-amber-800">{unpaidSessionsCount} حصة</p>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-semibold border-t border-slate-50 pt-3">
                    المكتبة ودفاتر التحضير مأمنة ومربوطة سحابياً بشكل لحظي
                  </div>
                </div>

                {/* Outstanding Payment Summary Widget */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                  <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-50 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block">الحقيبة والوضعية المالية</span>
                      <h4 className="text-base font-black text-slate-900 mt-1">كشف المدفوعات والاشتراكات 💰</h4>
                    </div>
                    <div className={`p-2.5 rounded-2xl ${outstandingBalance > 0 ? 'bg-amber-50 text-amber-655' : 'bg-emerald-50 text-emerald-600'}`}>
                      <DollarSign size={20} />
                    </div>
                  </div>

                  <div className="my-3 space-y-2.5">
                    <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                      <span className="text-xs text-slate-500 font-bold">إجمالي المبلغ المدفوع:</span>
                      <span className="text-emerald-600 font-black text-sm">{totalPaid} {preferences.currency || 'ج.م'}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 font-bold">المتبقي الكلي للوفاء:</span>
                      <span className={`font-black text-sm ${outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {outstandingBalance} {preferences.currency || 'ج.م'} {outstandingBalance === 0 && '✅'}
                      </span>
                    </div>

                    {isPaymentDue && (
                      <div className="bg-amber-50/70 border border-amber-200/50 px-3 py-1.5 rounded-xl text-[10px] text-amber-800 font-bold leading-relaxed flex items-center gap-1.5 mt-1.5 text-right w-full">
                        <span className="animate-ping bg-amber-500 h-1.5 w-1.5 rounded-full shrink-0" />
                        الاستحقاق الشهري القادم للمشتريات الكلية: {student.dueDate}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-slate-400 font-semibold border-t border-slate-50 pt-3">
                    تتم المراجعة التلقائية وتغذية الفواتير بمستندات متفق عليها.
                  </div>
                </div>

                {/* Gamified Loyalty and Vouchers Box */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between min-h-[220px]">
                  <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-50/60 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide block">برنامج مكافآت منصة TEACHER 👑</span>
                      <h4 className="text-base font-black text-indigo-900 mt-1">تحديات ورصيد النقاط الذكي 🎁</h4>
                    </div>
                    <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-2xl">
                      <Sparkles size={20} className="text-indigo-650" />
                    </div>
                  </div>

                  <div className="my-3 flex items-center gap-3">
                    <div className="bg-gradient-to-tr from-amber-400 to-yellow-500 text-white rounded-2xl p-3 shadow-md py-4 text-center select-none shrink-0 w-20">
                      <CupIcon size={20} className="mx-auto mb-1 animate-pulse" />
                      <span className="text-lg font-black block leading-none">{student.rewardPoints || 0}</span>
                      <span className="text-[7px] font-bold block mt-1">نقاط متاحة</span>
                    </div>
                    <div className="text-right text-[10px] text-slate-600 space-y-1 font-bold leading-normal">
                      <p className="text-slate-800 font-black text-xs">🚀 كيف تنمو نقاطك بمرونة؟</p>
                      <p>✨ حضور الحصص المنهجية الموثقة (+20 نقطة)</p>
                      <p>💳 تسوية وتصفية الدفعات المالية مبكراً (+50 نقطة)</p>
                      <p>📈 نتائج الامتحانات المشرفة والنهائية (+100 نقطة)</p>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-400 font-semibold border-t border-slate-50 pt-3">
                    النقاط مرتبطة بـ ID الحساب، يمكنك استبدالها بخصومات من الأستاذ!
                  </div>
                </div>

              </div>

              {/* Overall Teacher Scholarly Evaluation Card */}
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden font-sans">
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-amber-50 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center gap-3 border-b border-slate-50 pb-4 mb-4">
                  <div className="bg-amber-50 text-amber-600 p-2.5 rounded-2xl">
                    <Sparkles size={20} className="text-amber-600 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-900">التقييم الأكاديمي العام وشهادة تقدير الأستاذ 📜</h4>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">
                      مستوى الطالب والتقرير التراكمي الشامل الصادر من معلم المادة
                    </p>
                  </div>
                </div>

                {student.overallEvaluation ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-tr from-slate-50 to-indigo-50/50 border border-indigo-100/50 rounded-2xl text-center">
                      <span className="text-xs text-slate-450 font-black mb-1.5 block">التقدير العام التراكمي</span>
                      <span className={`px-4 py-1.5 rounded-full font-black text-xs border select-none ${
                        student.overallEvaluation === 'ممتاز' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100/50' :
                        student.overallEvaluation === 'جيد جداً' ? 'bg-teal-50 text-teal-700 border-teal-200 shadow-sm shadow-teal-100/50' :
                        student.overallEvaluation === 'جيد' ? 'bg-blue-50 text-blue-700 border-blue-200 shadow-sm shadow-blue-105/50' :
                        student.overallEvaluation === 'مقبول' ? 'bg-amber-50 text-amber-700 border-amber-250 shadow-sm shadow-amber-100/50' :
                        'bg-red-50 text-red-700 border-red-200/80'
                      }`}>
                        🏅 {student.overallEvaluation}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-3 font-semibold">باقة تعليمية وحلقات حضور مكملة ومسجلة</p>
                    </div>

                    <div className="md:col-span-2 space-y-2 text-right">
                      <span className="text-xs text-slate-450 font-black block">شهادة التوصية والتعليقات المكتشفة:</span>
                      <div className="bg-slate-50/70 border border-slate-150 p-4 rounded-2xl text-xs text-slate-705 font-bold leading-relaxed relative">
                        <span className="absolute left-3 top-2 text-3xl text-slate-200 font-serif leading-none select-none">“</span>
                        {student.overallEvaluationNotes || "تميز سلوكي منقطع النظير، والتزام جاد مع التقيد التام بحل ومتابعة أوراق العمل والاختبارات الدورية."}
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold">صادر ومعتمد إلكترونياً من قبل الأستاذ • Mohamed Abdella ( Abo Selim )</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center">
                    <p className="text-xs text-slate-500 font-bold">لم يتم رصد التقييم العام للطالب وتوصية الأستاذ المكتملة بعد.</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold leading-relaxed">
                      بمجرد اكتمال الاشتراك أو رصد مجموع درجاتك، سيكتب الأستاذ توصيته وشهادته العامة وتظهر هنا لطباعتها وحفظها فورياً!
                    </p>
                  </div>
                )}
              </div>

              {/* password management lock block */}
              <div id="student-portal-password-section" className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs relative overflow-hidden">
                <div className="absolute -top-12 -left-12 w-32 h-32 bg-violet-50 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-violet-50 text-violet-600 p-2.5 rounded-2xl shrink-0">
                      <Lock size={20} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900">كلمة مرور بوابة الطلاب لزيادة الأمان 🔐</h4>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5 leading-relaxed">
                        {student.password 
                          ? "حسابك مأمن بكلمة مرور حالياً. يمكنك تعديلها في أي وقت أدناه لحماية خصوصيتك."
                          : "لم تقم بتعيين كلمة مرور لدخول البوابة بعد. يستطيع أي شخص الوصول لبياناتك عبر رقم هاتفك! نوصي بتعيينها الآن."
                        }
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsEditingPassword(!isEditingPassword);
                      setNewPassword("");
                      setPwdError("");
                      setPwdSuccess("");
                    }}
                    className="px-4 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 font-bold text-xs rounded-xl transition duration-155 cursor-pointer self-end sm:self-center shrink-0"
                  >
                    {isEditingPassword ? "إلغاء التعديل" : (student.password ? "تعديل كلمة المرور ⚙️" : "إنشاء كلمة مرور 🔒")}
                  </button>
                </div>

                <AnimatePresence>
                  {isEditingPassword && (
                    <motion.div
                      id="password-edit-form"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-4 pt-4 border-t border-slate-100"
                    >
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          setPwdError("");
                          setPwdSuccess("");
                          const cleanPwd = newPassword.trim();
                          if (cleanPwd.length < 4) {
                            setPwdError("الرجاء كتابة كلمة مرور تتكون من 4 أرقام أو حروف على الأقل.");
                            return;
                          }
                          if (onUpdateStudent) {
                            onUpdateStudent(student.id, { password: cleanPwd });
                            setPwdSuccess("تم حفظ وتحديث كلمة مرور البوابة بنجاح! 🎉");
                            setNewPassword("");
                            setTimeout(() => {
                              setIsEditingPassword(false);
                            }, 2000);
                          } else {
                            setPwdError("حدث خطأ في النظام السحابي، يرجى المحاولة لاحقاً.");
                          }
                        }}
                        className="flex flex-col sm:flex-row items-end gap-3 max-w-md text-right w-full"
                      >
                        <div className="flex-1 space-y-1.5 w-full">
                          <label className="text-xs text-slate-705 font-bold block">اكتب كلمة المرور الجديدة *</label>
                          <input
                            type="text"
                            required
                            placeholder="مثال: 123456"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full text-right px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-violet-500 rounded-xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-violet-500/20 transition-all font-sans"
                          />
                        </div>
                        <button
                          type="submit"
                          className="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-xl transition-all shadow-md shadow-violet-600/10 cursor-pointer w-full sm:w-auto shrink-0"
                        >
                          تأكيد وحفظ التغيير
                        </button>
                      </form>

                      {pwdError && <p className="text-xs text-rose-600 font-semibold mt-2">{pwdError}</p>}
                      {pwdSuccess && <p className="text-xs text-emerald-600 font-semibold mt-2">{pwdSuccess}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Smart Statistical Analytics Module with Recharts charts */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={14} className="text-indigo-600" /> التحليلات البيانية الذكية والتحصيل الدراسي 📊
                </h3>
                <SmartStatisticsWidget student={student} preferences={preferences} />
              </div>

              {/* Weekly Timetable & Calendar Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 1. Schedule View card */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-50 mb-4 select-none">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                       <Calendar size={16} className="text-indigo-600" /> جدول حصصك الأسبوعي المعتمد 🗓️
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold">الحصص الأسبوعية الثابتة</span>
                  </div>

                  {myAppointments.length > 0 ? (
                    <div className="space-y-2.5">
                      {myAppointments.map((app) => (
                        <div key={app.id} className="relative overflow-hidden bg-slate-50/60 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-colors flex justify-between items-center gap-4">
                          <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-indigo-500" />
                          
                          <div>
                            <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-lg">الحصة الأسبوعية الكلية</span>
                            <h4 className="text-sm font-extrabold text-slate-900 mt-1">{app.title || `حصة مادة ${preferences.subject || 'المنهج الرئيسي'}`}</h4>
                            {app.notes && <p className="text-[11px] text-slate-500 font-semibold mt-1">📝 ملحوظة: {app.notes}</p>}
                          </div>

                          <div className="text-left font-sans flex flex-col items-end gap-1 shrink-0">
                            <span className="text-sm font-black text-slate-900">{app.dayOfWeek}</span>
                            <span className="text-xs text-slate-500 bg-white border border-slate-100 py-0.5 px-2 rounded-md font-mono flex items-center gap-1">
                              <Clock size={11} className="text-indigo-600" /> {app.time}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-10 text-center space-y-2 select-none">
                      <div className="text-3xl">📭</div>
                      <h4 className="text-xs font-black text-slate-700">لا يوجد حصص ثابتة مسجلة لك حالياً</h4>
                      <p className="text-[10px] text-slate-400 px-6">يرجى متابعة المواعيد أو التنسيق مع الأستاذ لإضافتك وتحديد الجدول المناسب.</p>
                    </div>
                  )}
                </div>

                {/* 2. Loylaty system claims / Active exams */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-50 mb-4 select-none">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <ClipboardList size={16} className="text-indigo-600" /> جدول مواعيد اختباراتك القادمة 📝
                    </h3>
                    <span className="text-[10px] text-indigo-500 font-extrabold">الامتحانات والتقييم الشهري</span>
                  </div>

                  {myExams.length > 0 ? (
                    <div className="space-y-2.5">
                      {myExams.map((exam) => (
                        <div key={exam.id} className="relative bg-amber-50/35 p-4 rounded-2xl border border-amber-100/50 flex justify-between items-center gap-4 hover:bg-amber-50/50 transition-all">
                          <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-amber-400" />
                          
                          <div>
                            <span className="bg-amber-105 text-amber-850 bg-amber-100 text-amber-800 text-[9px] font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 w-fit">
                              <span className="animate-pulse flex h-1.5 w-1.5 rounded-full bg-amber-600" /> مجدول مستحق
                            </span>
                            <h4 className="text-xs font-black text-slate-800 mt-1.5">موضوع الامتحان: {exam.notes || 'تقييم شامل على الأجزاء والدروس السابقة'}</h4>
                            {exam.subject && <p className="text-[10px] text-slate-500 font-bold mt-1">المادة: {exam.subject}</p>}
                          </div>

                          <div className="text-left font-sans text-xs shrink-0 space-y-1 text-slate-705">
                            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-lg block text-center">
                              📅 {getArabicDayName(exam.date)}
                            </span>
                            <p className="text-slate-900 font-extrabold font-mono text-[11px] text-left">{exam.date}</p>
                            <p className="flex items-center gap-1 justify-end select-none text-[10px] text-slate-500 font-mono"><Clock size={11} className="text-amber-500" /> {exam.time}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-1.5 select-none text-slate-440">
                      <div className="text-xl text-emerald-500 font-bold">🎉</div>
                      <h4 className="text-xs font-black text-slate-700">لا توجد أي امتحانات مجدولة عليك مؤخراً!</h4>
                      <p className="text-[10px] px-8 text-slate-400">راجع دروسك السابقة باستمرار متمنين لك التفوق التام والدرجات النهائية.</p>
                    </div>
                  )}
                </div>

              </div>
            </motion.div>
          )}

          {/* TAB 2: DETAILED SESSIONS & ACADEMIC FOLLOW-UP */}
          {activeTab === 'sessions' && (
            <motion.div 
              id="student-sessions"
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -15 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs text-right space-y-6"
            >
              {/* Interactive Sliding Sub-Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-2xl max-w-xl mx-auto select-none gap-1 border border-slate-150">
                <button
                  type="button"
                  onClick={() => setSessionsSubTab('timeline')}
                  className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    sessionsSubTab === 'timeline'
                      ? 'bg-indigo-650 text-white shadow-sm'
                      : 'text-slate-650 hover:bg-white hover:text-indigo-600'
                  }`}
                >
                  <Calendar size={15} />
                  <span>📅 حصص الحضور والغياب ({student.sessions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSessionsSubTab('followup')}
                  className={`flex-1 py-3 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 relative ${
                    sessionsSubTab === 'followup'
                      ? 'bg-indigo-650 text-white shadow-sm'
                      : 'text-slate-650 hover:bg-white hover:text-indigo-600'
                  }`}
                >
                  <BookOpen size={15} />
                  <span>📝 دفتر المتابعة والواجبات ({student.studyNotes?.length || 0})</span>
                  {student.studyNotes && student.studyNotes.length > 0 && sessionsSubTab !== 'followup' && (
                    <span className="absolute top-1 left-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white px-1">
                      {student.studyNotes.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Sub-Tab 1: Sessions Timeline */}
              {sessionsSubTab === 'timeline' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100 flex-wrap gap-2">
                    <div>
                      <h3 className="text-base font-black text-indigo-900 flex items-center gap-2">
                        <Calendar size={18} className="text-indigo-650" /> سجل وأرشيف حضور الحصص 📝
                      </h3>
                      <p className="text-[10px] text-slate-450 mt-0.5">تفاصيل الحضور والأقساط التي تم تدوينها واعتمادها بالكامل</p>
                    </div>
                    
                    <div className="flex gap-2">
                      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-black px-3 py-1.5 rounded-xl">
                        حضور معتمد: {normalSessions.length} حصص
                      </span>
                      {extraSessions.length > 0 && (
                        <span className="bg-amber-50 border border-amber-100 text-amber-700 text-xs font-black px-3 py-1.5 rounded-xl">
                          حصص استثنائية: {extraSessions.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {student.sessions && student.sessions.length > 0 ? (
                    <div className="relative border-r-2 border-slate-100 pr-5 mr-3.5 space-y-6 py-4">
                      {student.sessions.map((session, index) => (
                        <div key={session.id || index} className="relative">
                          {/* Interactive dot icon on the vertical line */}
                          <div className={`absolute -right-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-xs ${
                            session.isExtra ? 'bg-amber-400' : 'bg-indigo-600'
                          }`} />
                          
                          <div className="bg-slate-50/60 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate-900 font-extrabold font-mono">الحصة رقم {student.sessions.length - index}</span>
                                {session.isExtra && (
                                  <span className="bg-amber-100 text-amber-800 text-[8px] font-black px-1.5 py-0.5 rounded-md">حصة إضافية داعمة ✨</span>
                                )}
                              </div>
                              
                              {session.notes ? (
                                <p className="text-xs text-slate-500 font-semibold mt-1.5 bg-white border border-slate-100/50 p-2 rounded-xl">
                                  📝 ملاحظة الدرس: {session.notes}
                                </p>
                              ) : (
                                <p className="text-xs text-slate-400 italic font-medium mt-1">لا توجد ملاحظة مكتوبة لهذه الحصة.</p>
                              )}

                              {session.evaluation && (
                                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs font-sans">
                                  <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] border leading-none select-none flex items-center gap-0.5 ${
                                    session.evaluation === 'ممتاز' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    session.evaluation === 'جيد جداً' ? 'bg-teal-50 text-teal-700 border-teal-200' :
                                    session.evaluation === 'جيد' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    session.evaluation === 'مقبول' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-red-50 text-red-700 border-red-200'
                                  }`}>
                                    🏆 تقييم الأداء: {session.evaluation}
                                  </span>
                                  {session.evaluationNotes && (
                                    <p className="text-[10.5px] text-indigo-805 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                                      💬 تعليق الأستاذ: {session.evaluationNotes}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="flex sm:flex-col items-start sm:items-end justify-between font-sans text-xs text-slate-500 font-semibold shrink-0 gap-1.5">
                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg py-1 px-2.5 font-bold flex items-center gap-1">
                                <span>📅 {getArabicDayName(session.date)}</span>
                                <span className="text-indigo-350">•</span>
                                <span className="font-mono">{session.date}</span>
                              </span>
                              <span className="text-[11px] flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-slate-600 font-mono"><Clock size={11} /> {session.time}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-14 text-center space-y-3 select-none text-slate-450 border border-dashed border-slate-200 rounded-2xl">
                      <div className="text-4xl text-slate-350">📝</div>
                      <h4 className="text-sm font-black text-slate-700">لم يتم تدوين أي حصص حضور بعد</h4>
                      <p className="text-xs max-w-sm mx-auto px-6">بمجرد الانتهاء من الحصة وبدء تحضير الكشكول، ستظهر هنا تفاصيل التوقيت والملاحظات مباشرة.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 2: Evaluations & Study Notes (The "المتابعة" Section) */}
              {sessionsSubTab === 'followup' && (
                <div className="space-y-6">
                  <div className="pb-4 border-b border-slate-100 select-none">
                    <h3 className="text-base font-black text-indigo-900 flex items-center gap-2">
                      <BookOpen size={18} className="text-indigo-650" /> كراسة المتابعة الأكاديمية والتقييمات 📜
                    </h3>
                    <p className="text-[10px] text-slate-450 mt-0.5">متابعة التحصيل العلمي، أداء الواجبات المنزلية، والتقييم السلوكي دورياً</p>
                  </div>

                  {student.studyNotes && student.studyNotes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {student.studyNotes.map((note) => {
                        const typeColorsMap: Record<string, { bg: string; text: string; label: string; icon: string }> = {
                          academic: { bg: 'bg-indigo-50/75 border-indigo-150', text: 'text-indigo-805', label: 'التحصيل الأكاديمي 📚', icon: '🧠' },
                          behavior: { bg: 'bg-emerald-50/75 border-emerald-150', text: 'text-emerald-805', label: 'التقييم السلوكي والأدبي 🌟', icon: '❤️' },
                          homework: { bg: 'bg-sky-50/75 border-sky-150', text: 'text-sky-805', label: 'متابعة الواجبات المدرسية 📝', icon: '✏️' },
                          exam: { bg: 'bg-amber-50/75 border-amber-150', text: 'text-amber-805', label: 'تقييم اختبار شهري 📊', icon: '📈' },
                          general: { bg: 'bg-purple-50/75 border-purple-150', text: 'text-purple-805', label: 'ملاحظة عامة وتنسيق 📢', icon: '🏷️' },
                        };
                        const styling = typeColorsMap[note.type] || typeColorsMap.general;

                        return (
                          <div key={note.id} className={`p-5 rounded-3xl border ${styling.bg} flex flex-col justify-between hover:shadow-xs transition-shadow relative overflow-hidden text-right`}>
                            <div className="absolute top-0 left-0 bg-white/40 backdrop-blur-xs px-3 py-1 rounded-bl-2xl font-mono text-[9px] text-slate-500 font-bold border-r border-b border-slate-100/30">
                              {note.date.split('T')[0]}
                            </div>
                            
                            <div>
                              <div className="flex items-center gap-2 text-xs font-black text-slate-900 mb-3 select-none">
                                <span className="text-base">{styling.icon}</span>
                                <span>{styling.label}</span>
                              </div>
                              <p className="text-xs text-slate-700 leading-relaxed font-bold block pr-1">
                                {note.content}
                              </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-slate-100/10 text-[9px] text-slate-400 font-bold">
                              تم التحرير بواسطة الأستاذ للتوجيه والدعم المستمر.
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-14 text-center space-y-3 select-none text-slate-450 border border-dashed border-slate-200 rounded-2xl">
                      <div className="text-4xl">🌟</div>
                      <h4 className="text-sm font-black text-slate-700">لا يوجد تقييمات أو ملاحظات مسجلة بعد</h4>
                      <p className="text-xs max-w-sm mx-auto px-6 text-slate-400">استمر في التواجد الإيجابي وتحصيل العلم، وسيقوم المعلم بتدوين أي توجيه أو تقييمات واجوبة لك مباشرة.</p>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 3: ACCOUNT BALANCES & PAYMENTS HISTORIES */}
          {activeTab === 'payments' && (
            <motion.div 
              id="student-payments"
              initial={{ opacity: 0, y: 15 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -15 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs text-right space-y-4"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div>
                  <h3 className="text-base font-black text-indigo-900 flex items-center gap-2">
                    <DollarSign size={18} className="text-emerald-600" /> سجل الدفعات النقدية والوصولات 💸
                  </h3>
                  <p className="text-[10px] text-slate-450 mt-0.5">تفاصيل المبالغ والتحصيلات التي قمت بتسليمها لمعلمك</p>
                </div>
                
                <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-black px-3 py-1.5 rounded-xl">
                  مجموع السداد الفعلي: {totalPaid} {preferences.currency || 'ج.م'}
                </span>
              </div>

              {student.payments && student.payments.length > 0 ? (
                <div className="space-y-3">
                  {student.payments.map((payment, index) => (
                    <div key={payment.id || index} className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-between gap-4">
                      
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
                          <CheckCircle2 size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500 block">دفعة مالية معتمدة</span>
                            <span className="text-[9px] bg-slate-200 text-slate-650 px-1.5 py-0.5 rounded font-bold font-mono">الرقم المرجعي: {index + 1}</span>
                          </div>
                          {payment.notes ? (
                            <p className="text-[11px] text-slate-600 font-bold mt-1">📝 ملحوظة: {payment.notes}</p>
                          ) : (
                            <p className="text-[11px] text-slate-400 italic mt-0.5">لا يوجد ملاحظات على هذه الدفعة</p>
                          )}
                        </div>
                      </div>

                      <div className="text-left font-mono shrink-0">
                        <span className="text-base font-black text-emerald-600 block">{payment.amount} {preferences.currency || 'ج.م'}</span>
                        <span className="text-[10px] text-slate-500 block mt-1 font-bold">{payment.date}</span>
                      </div>

                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-14 text-center space-y-3 select-none text-slate-450 border border-dashed border-slate-200 rounded-2xl font-sans">
                  <div className="text-4xl text-amber-500">💳</div>
                  <h4 className="text-sm font-black text-slate-755">لا توجد أي دفعات مالية مسجلة بعد</h4>
                  <p className="text-xs max-w-sm mx-auto px-6 text-slate-405">يرجى تسليم رسوم الاشتراك للأستاذ ليقوم بتسجيل المدفوعات وتحديث حسابك مباشرة.</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              id="student-chat"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs text-right space-y-4"
            >
              {/* Optional Group Selector Bar */}
              {(studentGroups.length > 0) && (
                <div className="flex flex-col space-y-2 mb-2 pb-3 border-b border-slate-100">
                  <span className="text-[10.5px] font-black text-slate-500">اختر قناة التواصل والمحادثة:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveChatTarget({ id: student.id, name: 'المحادثة الخاصة مع الأستاذ' })}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeChatTarget.id === student.id
                          ? 'bg-indigo-600 text-white shadow-3xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>👤</span>
                      <span>المحادثة الخاصة مع الأستاذ</span>
                    </button>

                    {studentGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => setActiveChatTarget({ id: group.id, name: group.name })}
                        className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                          activeChatTarget.id === group.id
                            ? 'bg-indigo-600 text-white shadow-3xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <span>👥</span>
                        <span>مجموعة: {group.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isLoadingGroups ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" dir="rtl" />
                  <span className="text-xs font-bold text-slate-500">جاري تحميل قنوات التواصل المباشر...</span>
                </div>
              ) : (
                <LiveChat 
                  key={activeChatTarget.id}
                  role="student"
                  studentId={activeChatTarget.id}
                  studentName={student.name}
                  teacherName={preferences?.teacherName || 'المعلم'}
                />
              )}
            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* Aesthetic Footer Branding */}
      <footer id="student-portal-footer" className="bg-slate-950 text-slate-400 py-8 border-t border-slate-900 text-center select-none pb-12 mt-12 w-full">
        <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center gap-2.5 text-xs font-sans">
          <p className="text-slate-100 font-black text-sm text-center">تم تصميم البرنامج بواسطة Mohamed Abdella ( Abo Selim )</p>
          <p className="text-[10.5px] text-slate-500 font-bold text-center">{new Date().getFullYear()} • نسخة البرنامج v1.3</p>
        </div>
      </footer>

      {/* INTERACTIVE MODAL 1: REGISTER SESSION */}
      <AnimatePresence>
        {isOpenRegisterSessionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenRegisterSessionModal(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            {/* Modal Content container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white border border-slate-150 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-hidden font-sans z-10 text-right"
              dir="rtl"
            >
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700" />
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl">
                    <ClipboardList size={22} className="text-indigo-650" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-black text-slate-950">تسجيل حصة حضور جديدة 📝</h3>
                    <p className="text-[10.5px] text-slate-450 font-bold mt-0.5">قيد وإضافة محاضرة حضرتها مع الأستاذ</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpenRegisterSessionModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-650 rounded-xl bg-slate-50 hover:bg-slate-100 transition duration-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleStudentSelfRegisterSession} className="space-y-4 font-sans text-right">
                <div className="grid grid-cols-2 gap-4">
                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-600 block">تاريخ الحصة *</label>
                    <input
                      type="date"
                      required
                      value={regSessionDate}
                      onChange={(e) => setRegSessionDate(e.target.value)}
                      className="w-full text-inner-right text-right px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors"
                    />
                  </div>

                  {/* Time Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-600 block">توقيت البدء *</label>
                    <input
                      type="time"
                      required
                      value={regSessionTime}
                      onChange={(e) => setRegSessionTime(e.target.value)}
                      className="w-full text-right px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors"
                    />
                  </div>
                </div>

                {/* Additional notes/homework details */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-600 block">تفاصيل أو ملاحظات الحصة</label>
                  <textarea
                    rows={3}
                    placeholder="امثلة: شرح ومراجعة الفصل الثالث، تسليم الاختبار المنزلي رقم 2"
                    value={regSessionNotes}
                    onChange={(e) => setRegSessionNotes(e.target.value)}
                    className="w-full text-right px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/10 transition-colors"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs  rounded-xl transition shadow-md shadow-indigo-600/15 cursor-pointer text-center"
                  >
                    تأكيد وتسجيل الحصة في السجلات
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpenRegisterSessionModal(false)}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* INTERACTIVE MODAL 2: REGISTER PAYMENT */}
      <AnimatePresence>
        {isOpenRegisterPaymentModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenRegisterPaymentModal(false)}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            />

            {/* Modal Content container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white border border-slate-150 rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl overflow-hidden font-sans z-10 text-right"
              dir="rtl"
            >
              <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-teal-650" />
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
                    <DollarSign size={22} className="text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-black text-slate-950">تسجيل دفعة نقدية جديدة 💰</h3>
                    <p className="text-[10.5px] text-slate-450 font-bold mt-0.5">قيد وإضافة دفعة/سداد مالي للوضع المحاسبي</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpenRegisterPaymentModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-650 rounded-xl bg-slate-50 hover:bg-slate-100 transition duration-100 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleStudentSelfRegisterPayment} className="space-y-4 font-sans text-right">
                <div className="grid grid-cols-2 gap-4">
                  {/* Amount Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-600 block">مقدار الدفعة ({preferences.currency}) *</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        required
                        min="1"
                        value={regPaymentAmount}
                        onChange={(e) => setRegPaymentAmount(e.target.value)}
                        className="w-full text-right px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-black focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-colors"
                      />
                      <span className="absolute left-3 text-[10px] text-slate-400 font-bold">{preferences.currency}</span>
                    </div>
                  </div>

                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-600 block">تاريخ الدفع *</label>
                    <input
                      type="date"
                      required
                      value={regPaymentDate}
                      onChange={(e) => setRegPaymentDate(e.target.value)}
                      className="w-full text-right px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-colors"
                    />
                  </div>
                </div>

                {/* Additional Notes or Receipt Code */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-600 block">طريقة الدفع أو الملاحظات</label>
                  <textarea
                    rows={3}
                    placeholder="أمثلة: نقدي كاش، تحويل فودافون كاش للمحفظة، سداد من خلال ولي الأمر"
                    value={regPaymentNotes}
                    onChange={(e) => setRegPaymentNotes(e.target.value)}
                    className="w-full text-right px-3.5 py-2.5 bg-slate-50 border border-slate-200 focus:border-emerald-500 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition-colors"
                  />
                </div>

                {/* Action buttons */}
                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="submit"
                    className="flex-1 px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition shadow-md shadow-emerald-650/15 cursor-pointer text-center"
                  >
                    تأكيد وتسجيل الدفعة المالية
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpenRegisterPaymentModal(false)}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer"
                  >
                    إلغاء التراجع
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
