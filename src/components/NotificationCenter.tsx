import React, { useState, useEffect } from 'react';
import { Student, Appointment, NotificationSettings, AppNotification, TeacherPreferences } from '../types';
import { 
  Bell, BellOff, Settings, Calendar, DollarSign, Award, Check, 
  X, MessageSquare, AlertCircle, RefreshCw, Send, CheckCheck, 
  Info, ExternalLink, Sliders, ToggleLeft, ToggleRight, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatTimeTo12h } from '../lib/timeUtils';

interface NotificationCenterProps {
  students: Student[];
  appointments: Appointment[];
  currency: string;
  preferences?: TeacherPreferences;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  remindClasses: true,
  classHoursThreshold: 2,
  remindPayments: true,
  paymentDaysThreshold: 3,
  remindCompletion: true,
  completionRemainingCount: 1,
  enablePush: false,
  enableInApp: true,
  whatsappEnabled: true,
  smsEnabled: false,
  classTemplate: 'السلام عليكم يا [الاسم]، نود تذكيرك بموعد حصتنا اليوم الساعة [الوقت] إن شاء الله. بالتوفيق!',
  paymentTemplate: 'السلام عليكم يا [الاسم]، تذكير لطيف بمستحقات الكورس المتبقية وقيمتها [المتبقي] [العملة] المستحقة في [التاريخ]. شكراً لكم!',
  completionTemplate: 'أهلاً يا [الاسم]، نود إخطارك باقتراب اكتمال حصص الكورس المسجلة لك بنجاح. لقد أنجزت [الحصص] حصة حتى الآن.',
  
  // Custom teacher alert settings
  notifyTeacherOnSessionComplete: true,
  notifyTeacherOnNewPayment: true,
  notifyTeacherOnPaymentDue: true,
  
  // Do Not Disturb (DND) settings
  dndEnabled: false,
  dndStart: '22:00',
  dndEnd: '08:00',

  // Customizable student portal alert settings
  sendStudentClassReminders: true,
  sendStudentPaymentReminders: true,
  sendStudentCompletionReminders: true
};

const DAYS_AR_MAP: { [key: number]: string } = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت'
};

const getUpcomingReviewTopics = (student: Student): string[] => {
  const latestSession = [...student.sessions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .find(s => s.notes && s.notes.trim().length > 3);

  if (!latestSession || !latestSession.notes) {
    return [
      "مراجعة وتثبيت أساسيات المادة والمفاهيم الكلية",
      "قراءة وحل ورقة العمل التمهيدية الأولى",
      "إعداد خطة وجدول الدراسة المعتمد للمسار التعليمي"
    ];
  }

  const notes = latestSession.notes.trim();
  const topics: string[] = [];
  const cleanNote = notes.toLowerCase();

  // Highlight homework
  if (cleanNote.includes("واجب") || cleanNote.includes("الواجب")) {
    topics.push("حل واستكمال الواجب المنزلي المعطى في الدرس السابق بالكامل والتأكد من إرساله");
  }

  // Highlight exam
  if (cleanNote.includes("امتحان") || cleanNote.includes("اختبار") || cleanNote.includes("حل امتحان")) {
    topics.push("الاستعداد للاختبار القادم عبر مراجعة نموذج الإجابات وتجنب الأخطاء الشائعة");
  }

  // Highlight explanation notes
  if (cleanNote.includes("شرح")) {
    const match = notes.match(/شرح\s+([^،.,\-و(]+)/i);
    const topic = match ? match[1].trim() : "";
    if (topic && topic.length > 3) {
      topics.push(`مراجعة واستذكار المفاهيم الأساسية لدرس: ${topic}`);
      topics.push(`حل المزيد من الأسئلة والتمارين المتنوعة على الجزء المشروح: ${topic}`);
    } else {
      topics.push("تلخيص ومراجعة النقاط المشروحة حديثا في آخر محاضرة بدفتر الملاحظات");
    }
  }

  // Highlight review notes
  if (cleanNote.includes("مراجعة")) {
    const match = notes.match(/مراجعة\s+([^،.,\-و(]+)/i);
    const topic = match ? match[1].trim() : "";
    if (topic && topic.length > 3) {
      topics.push(`إعادة حل المسائل العملية المعقدة الخاصة بموضوع: ${topic}`);
    } else {
      topics.push("استرجاع ومراجعة قواعد الفصول السابقة لضمان عدم تراكمها");
    }
  }

  // Fallbacks to reach at least 3 high-quality topics
  if (topics.length < 3) {
    const clauses = notes.split(/[،,و.\-]\s+/).map(x => x.trim()).filter(x => x.length > 5 && x.length < 50);
    clauses.forEach(clause => {
      if (topics.length < 3 && !clause.includes("واجب") && !clause.includes("شرح")) {
        topics.push(`التركيز على مراجعة وفهم جزئية: "${clause}"`);
      }
    });
  }

  // ultimate fallback fillers
  const fallbacks = [
    "التحقق من فهم وحفظ المفردات والقواعد الأساسية المعطاة",
    "تجهيز الكراسة والأدوات المطلوبة لبداية الحصة القادمة والمشاركة التفاعلية",
    "تدوين أي استفسار أو مفهوم غامض لمناقشته مع المعلم في أول 5 دقائق"
  ];

  while (topics.length < 3 && fallbacks.length > 0) {
    const item = fallbacks.shift();
    if (item && !topics.includes(item)) {
      topics.push(item);
    }
  }

  return topics.slice(0, 3);
};

export default function NotificationCenter({ students, appointments, currency, preferences }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'alerts' | 'settings' | 'templates'>('alerts');
  const [alertsSubTab, setAlertsSubTab] = useState<'students' | 'teacher'>('students');
  const [teacherAlerts, setTeacherAlerts] = useState<AppNotification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [dismissedAlerts, setDismissedAlerts] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState('');
  const [sysTimeState, setSysTimeState] = useState(new Date());
  const [openTemplatesAlertId, setOpenTemplatesAlertId] = useState<string | null>(null);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);

  // Push Permission State
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  // Load settings on mount
  useEffect(() => {
    const loadSettings = () => {
      const stored = localStorage.getItem('teacherNotificationSettings');
      if (stored) {
        try {
          setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
        } catch (e) {
          setSettings(DEFAULT_SETTINGS);
        }
      }
    };

    loadSettings();

    const handleSettingsUpdate = () => {
      loadSettings();
    };
    window.addEventListener('notificationSettingsUpdated', handleSettingsUpdate);

    const loadTeacherAlerts = () => {
      const storedAlerts = localStorage.getItem('teacherActionAlerts');
      if (storedAlerts) {
        try {
          setTeacherAlerts(JSON.parse(storedAlerts));
        } catch (e) {}
      } else {
        setTeacherAlerts([]);
      }
    };

    loadTeacherAlerts();
    window.addEventListener('teacherAlertsUpdated', loadTeacherAlerts);

    const dismissed = localStorage.getItem('teacherDismissedAlerts');
    if (dismissed) {
      try {
        setDismissedAlerts(JSON.parse(dismissed));
      } catch (e) {}
    }

    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }

    // Keep clock in sync for accurate testing
    const interval = setInterval(() => {
      setSysTimeState(new Date());
    }, 30000);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('notificationSettingsUpdated', handleSettingsUpdate);
      window.removeEventListener('teacherAlertsUpdated', loadTeacherAlerts);
    };
  }, []);

  const saveSettings = (newSettings: NotificationSettings) => {
    setSettings(newSettings);
    localStorage.setItem('teacherNotificationSettings', JSON.stringify(newSettings));
    window.dispatchEvent(new Event('notificationSettingsUpdated'));
  };

  const triggerToast = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleRequestPushPermission = async () => {
    if (!('Notification' in window)) {
      triggerToast('المتصفح الحالي لا يدعم إشعارات سطح المكتب (Push Notification).');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted') {
        saveSettings({ ...settings, enablePush: true });
        triggerToast('تم تفعيل إشعارات سطح المكتب والبدء بنجاح! 🎉');
        // Test notification
        new Notification('نظام إشعار ذكي للشاشات', {
          body: 'مرحباً بك! تم تفعيل قنوات التنبيه ودفع التنبيهات في تطبيق المعلم بنجاح.',
          icon: 'https://cdn-icons-png.flaticon.com/512/3413/3413535.png'
        });
      } else {
        saveSettings({ ...settings, enablePush: false });
        triggerToast('تم رفض إذن الإشعارات من المتصفح.');
      }
    } catch (e) {
      triggerToast('فشل طلب إذن الإشعارات.');
    }
  };

  // Helper inside template fillers
  const fillTemplate = (template: string, studentName: string, extra: { time?: string; date?: string; outstanding?: number | string; count?: number | string }) => {
    let res = template;
    res = res.replace(/\[الاسم\]/g, studentName);
    res = res.replace(/\[الوقت\]/g, extra.time || '');
    res = res.replace(/\[التاريخ\]/g, extra.date || '');
    res = res.replace(/\[المتبقي\]/g, String(extra.outstanding !== undefined ? extra.outstanding : ''));
    res = res.replace(/\[العملة\]/g, currency);
    res = res.replace(/\[الحصص\]/g, String(extra.count !== undefined ? extra.count : ''));
    return res;
  };

  const getWhatsappLink = (phone: string, text: string) => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
      cleanPhone = '2' + cleanPhone; // Egypt format prefix standard
    }
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  };

  const handleSendTestPush = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted' && settings.enablePush) {
      new Notification(title, {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/3413/3413535.png'
      });
    } else {
      // In-app alert fallback
      triggerToast(`🔔 إشعار تجريبي: ${title} - ${body}`);
    }
  };

  // --- DYNAMIC ALERTS CALCULATIONS ---
  const activeAlerts: AppNotification[] = [];

  // 1. Upcoming classes reminder
  if (settings.remindClasses) {
    const todayDayArabic = DAYS_AR_MAP[sysTimeState.getDay()];
    const getLocalYMDStr = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const todayDateStr = getLocalYMDStr(sysTimeState);

    // Find appointments scheduled for today (both weekly and exceptional ones)
    const todaysAppointments = appointments.filter(app => {
      if (app.isExceptional) {
        return app.date === todayDateStr;
      }
      return app.dayOfWeek === todayDayArabic;
    });

    todaysAppointments.forEach(app => {
      // Find associated student
      const student = students.find(s => s.id === app.studentId);
      if (student && student.active) {
        // Parse class hour and minute
        const [appH, appM] = app.time.split(':').map(Number);
        
        // Construct date-time for appointment today
        const appDateTime = new Date(sysTimeState);
        appDateTime.setHours(appH, appM, 0, 0);

        const diffMs = appDateTime.getTime() - sysTimeState.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // We trigger the notification if remaining hours fits within the configured threshold
        // and allow 1 hour grace period so it doesn't disappear immediately down to the minute.
        if (diffHours <= settings.classHoursThreshold && diffHours >= -1) {
          const id = `class-${app.id}-${sysTimeState.toDateString()}`;
          if (!dismissedAlerts.includes(id)) {
            const filledMsg = fillTemplate(settings.classTemplate, student.name, { time: formatTimeTo12h(app.time) });
            const waLink = getWhatsappLink(student.phone, filledMsg);
            
            // Build intuitive localized countdown or timing label
            let timingLabel = 'اليوم';
            if (diffHours < 0) {
              timingLabel = 'بدأت الحصة 🟢';
            } else if (diffHours < 1) {
              const minutes = Math.max(1, Math.round(diffHours * 60));
              timingLabel = `خلال ${minutes} دقيقة ⚡`;
            } else {
              timingLabel = `خلال ${Math.round(diffHours)} ساعة`;
            }

            activeAlerts.push({
              id,
              studentId: student.id,
              type: 'class',
              title: app.isExceptional ? `حصة استثنائية قادمة: ${student.name}` : `حصة قادمة اليوم: ${student.name}`,
              message: `لديه حصة مجدولة اليوم في تمام الساعة ${formatTimeTo12h(app.time)} (${app.notes || 'لا يوجد مكان محدد'}).`,
              date: timingLabel,
              read: false,
              dynamicActionData: {
                phone: student.phone,
                whatsappLink: waLink,
                rawMessage: filledMsg
              }
            });
          }
        }
      }
    });
  }

  // 1.5. 24-hours before class Auto Reminder (Tomorrow's classes)
  const globalWhatsApp24hEnabled = preferences?.enableWhatsApp24hReminders !== false;
  const tomorrowDayIndex = (sysTimeState.getDay() + 1) % 7;
  const tomorrowDayArabic = DAYS_AR_MAP[tomorrowDayIndex];
  const tomorrowsAppointments = appointments.filter(app => app.dayOfWeek === tomorrowDayArabic);

  if (globalWhatsApp24hEnabled) {
    tomorrowsAppointments.forEach(app => {
      const student = students.find(s => s.id === app.studentId);
      if (student && student.active && student.autoReminder) {
        const id = `auto-remind-24h-${app.id}-${sysTimeState.toDateString()}`;
        if (!dismissedAlerts.includes(id)) {
          const topics = getUpcomingReviewTopics(student);
          const topicsLabel = topics.map((t, i) => `${i + 1}. ${t}`).join('\n');
          const filledMsg = `تذكير تلقائي لحصة غداً الساعة ${formatTimeTo12h(app.time)}.\nأهم 3 مواضيع للمراجعة والاستعداد قبل الحصة:\n${topicsLabel}`;
          const waLink = getWhatsappLink(student.phone, filledMsg);

          activeAlerts.push({
            id,
            studentId: student.id,
            type: 'class',
            title: `تذكير تلقائي (قبل 24 ساعة): ${student.name}`,
            message: `ستبدأ حصتك المجدولة غداً في الساعة ${formatTimeTo12h(app.time)}. من فضلك تأكد من مراجعة المواضيع الـ 3 الموضحة أدناه للاستعداد التام:\n` + topics.map((t, idx) => `• ${t}`).join('\n'),
            date: 'غداً',
            read: false,
            dynamicActionData: {
              phone: student.phone,
              whatsappLink: waLink,
              rawMessage: filledMsg,
              topics
            }
          });
        }
      }
    });
  }

  // 2. Course payment due reminder
  if (settings.remindPayments) {
    students.forEach(student => {
      if (!student.active) return;
      
      // Calculate outstanding balance
      let outstanding = 0;
      if (student.type === 'lesson') {
        const totalCost = student.sessions.length * (student.lessonRate || 0);
        const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
        outstanding = totalCost - totalPaid;
      } else {
        const totalExtraCost = student.sessions.filter(s => s.isExtra).reduce((sum, s) => sum + (s.extraPrice || 0), 0);
        const totalCost = (student.coursePrice || 0) + totalExtraCost;
        const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
        outstanding = totalCost - totalPaid;
      }

      // Check payment due dates for Course systems
      if (student.type === 'course' && student.dueDate && outstanding > 0) {
        const dueDateObj = new Date(student.dueDate);
        const diffTime = dueDateObj.getTime() - sysTimeState.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        // Trigger if bill due date is within threshold days, or already overdue
        if (diffDays <= settings.paymentDaysThreshold) {
          const isOverdue = diffDays < 0;
          const id = `pay-${student.id}-${student.dueDate}`;
          
          if (!dismissedAlerts.includes(id)) {
            const dateLabel = student.dueDate;
            const filledMsg = fillTemplate(settings.paymentTemplate, student.name, { 
              outstanding, 
              date: dateLabel 
            });
            const waLink = getWhatsappLink(student.phone, filledMsg);

            activeAlerts.push({
              id,
              studentId: student.id,
              type: 'payment',
              title: isOverdue ? `دفعة متأخرة! للغالـي: ${student.name}` : `استحقاق دفعة قريباً: ${student.name}`,
              message: isOverdue 
                ? `تخطى موعد استحقاق الدفع المحدد في تاريخ ${dateLabel}! المتبقي المطلوب: ${outstanding} ${currency}.`
                : `موعد الدفع المتبقي في تاريخ ${dateLabel} (باقي ${diffDays} يوم/أيام). المستحقات: ${outstanding} ${currency}.`,
              date: isOverdue ? 'متأخرة' : `باقي ${diffDays} يوم`,
              read: false,
              dynamicActionData: {
                phone: student.phone,
                whatsappLink: waLink,
                rawMessage: filledMsg
              }
            });
          }
        }
      }

      // Check overdue outstanding balances in simple lesson rates
      if (student.type === 'lesson' && outstanding >= (student.lessonRate || 100)) {
        const id = `pay-lesson-${student.id}-${outstanding}`;
        if (!dismissedAlerts.includes(id)) {
          const filledMsg = fillTemplate(settings.paymentTemplate, student.name, { 
            outstanding, 
            date: 'الآن'
          });
          const waLink = getWhatsappLink(student.phone, filledMsg);

          activeAlerts.push({
            id,
            studentId: student.id,
            type: 'payment',
            title: `تراكم مبالغ على الطالب: ${student.name}`,
            message: `لقد بلغ مستحق ذمة الطالب المتأخرة ${outstanding} ${currency} مقابل الحصص الماضية وغير المسددة.`,
            date: 'ذمة معلقة',
            read: false,
            dynamicActionData: {
              phone: student.phone,
              whatsappLink: waLink,
              rawMessage: filledMsg
            }
          });
        }
      }
    });
  }

  // 3. Course Completion Reminders
  if (settings.remindCompletion) {
    students.forEach(student => {
      if (student.type === 'course' && student.active && student.totalLessonsCount !== undefined) {
        const total = student.totalLessonsCount;
        const currentCount = student.sessions.length;
        const remaining = total - currentCount;

        // trigger if remaining lessons is equal or less than threshold
        if (remaining <= settings.completionRemainingCount && remaining >= 0) {
          const id = `completion-${student.id}-${currentCount}`;
          if (!dismissedAlerts.includes(id)) {
            const filledMsg = fillTemplate(settings.completionTemplate, student.name, { count: currentCount });
            const waLink = getWhatsappLink(student.phone, filledMsg);

            activeAlerts.push({
              id,
              studentId: student.id,
              type: 'completion',
              title: remaining === 0 ? `اكتمل الكورس بنجاح: ${student.name}` : `اقتراب نهاية الكورس: ${student.name}`,
              message: remaining === 0
                ? `أتم الطالب ${student.name} الجلسات بالكامل المتاحة لديه (${currentCount} منصلة ${total} حصص). يرجى التجديد.`
                : `أجرى هذا الطالب ${currentCount} حصة ولم يتبق له سوى ${remaining} فقط لاكتمال باقة الكورس الكلية (${total}).`,
              date: remaining === 0 ? 'مكتمل' : `جلسة ${remaining} باقية`,
              read: false,
              dynamicActionData: {
                phone: student.phone,
                whatsappLink: waLink,
                rawMessage: filledMsg
              }
            });
          }
        }
      }
    });
  }

  // 4. Custom Teacher Reminders (one-off)
  students.forEach(student => {
    if (student.active && student.customReminderDate) {
      const todayStr = sysTimeState.toISOString().split('T')[0];
      if (todayStr >= student.customReminderDate) {
        const id = `custom-remind-${student.id}-${student.customReminderDate}`;
        if (!dismissedAlerts.includes(id)) {
          const filledMsg = `تذكير بمتابعة الطالب ${student.name}: ${student.customReminderNote || 'متابعة وتذكير مخصص'}`;
          const waLink = getWhatsappLink(student.phone, filledMsg);

          activeAlerts.push({
            id,
            studentId: student.id,
            type: 'completion',
            title: `🔔 تذكير خاص: ${student.name}`,
            message: student.customReminderNote || 'متابعة خاصة تم جدولتها بطلب معلم الطالب.',
            date: student.customReminderDate,
            read: false,
            dynamicActionData: {
              phone: student.phone,
              whatsappLink: waLink,
              rawMessage: filledMsg
            }
          });
        }
      }
    }
  });

  // Sound trigger when new teacher alerts come in (if not in DND)
  const prevAlertsLength = React.useRef(teacherAlerts.length);
  useEffect(() => {
    if (teacherAlerts.length > prevAlertsLength.current) {
      const isDndActiveNow = (): boolean => {
        if (!settings.dndEnabled || !settings.dndStart || !settings.dndEnd) return false;
        
        const [startH, startM] = settings.dndStart.split(':').map(Number);
        const [endH, endM] = settings.dndEnd.split(':').map(Number);
        const now = new Date();
        const currentH = now.getHours();
        const currentM = now.getMinutes();
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const currentMinutes = currentH * 60 + currentM;
        
        if (startMinutes < endMinutes) {
          return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        } else {
          return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
      };

      if (!isDndActiveNow()) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
          osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
          osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
          
          gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
          
          osc.start();
          osc.stop(audioCtx.currentTime + 0.5);
        } catch (e) {}
      }
    }
    prevAlertsLength.current = teacherAlerts.length;
  }, [teacherAlerts, settings]);

  // --- DO NOT DISTURB (DND) CHECK FOR RENDER ---
  const isDndCurrentlyActive = (): boolean => {
    if (!settings.dndEnabled || !settings.dndStart || !settings.dndEnd) return false;
    
    const [startH, startM] = settings.dndStart.split(':').map(Number);
    const [endH, endM] = settings.dndEnd.split(':').map(Number);
    const currentH = sysTimeState.getHours();
    const currentM = sysTimeState.getMinutes();
    
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const currentMinutes = currentH * 60 + currentM;
    
    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  };

  const isDndActiveNow = isDndCurrentlyActive();

  // --- COMPUTE TEACHER ALERTS ---
  const computedTeacherAlerts: AppNotification[] = [...teacherAlerts];

  // Dynamic due payments alert for teacher (only computed if notifyTeacherOnPaymentDue is enabled)
  if (settings.notifyTeacherOnPaymentDue !== false) {
    students.forEach(student => {
      if (!student.active) return;

      // Outstanding balance calculation
      let outstanding = 0;
      if (student.type === 'lesson') {
        const totalCost = student.sessions.length * (student.lessonRate || 0);
        const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
        outstanding = totalCost - totalPaid;
      } else {
        const totalExtraCost = student.sessions.filter(s => s.isExtra).reduce((sum, s) => sum + (s.extraPrice || 0), 0);
        const totalCost = (student.coursePrice || 0) + totalExtraCost;
        const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
        outstanding = totalCost - totalPaid;
      }

      if (student.type === 'course' && student.dueDate && outstanding > 0) {
        const dueDateObj = new Date(student.dueDate);
        const diffTime = dueDateObj.getTime() - sysTimeState.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= settings.paymentDaysThreshold) {
          const isOverdue = diffDays < 0;
          const alertId = `t-due-${student.id}-${student.dueDate}`;
          
          if (!dismissedAlerts.includes(alertId)) {
            computedTeacherAlerts.push({
              id: alertId,
              studentId: student.id,
              type: 'teacher-due',
              title: isOverdue ? '⚠️ تجاوز تاريخ استحقاق قسط الطالب' : '⏳ اقتراب موعد استحقاق قسط الطالب',
              message: isOverdue 
                ? `تخطى الطالب "${student.name}" موعد استحقاق قسطه المقرر في تاريخ ${student.dueDate}. القيمة المتأخرة المستحقة: ${outstanding} ${currency}.`
                : `يقترب موعد سداد قسط الطالب "${student.name}" في تاريخ ${student.dueDate} (متبقي ${diffDays} يوم/أيام). المطلوب: ${outstanding} ${currency}.`,
              date: isOverdue ? 'متأخرة' : `باقي ${diffDays} يوم`,
              read: false,
            });
          }
        }
      }
    });
  }

  const totalAlertsCount = activeAlerts.length + computedTeacherAlerts.length;

  const handleDismissTeacherAlert = (id: string) => {
    if (id.startsWith('t-due-')) {
      const updated = [...dismissedAlerts, id];
      setDismissedAlerts(updated);
      localStorage.setItem('teacherDismissedAlerts', JSON.stringify(updated));
    } else {
      const stored = localStorage.getItem('teacherActionAlerts');
      if (stored) {
        try {
          const list = JSON.parse(stored);
          const filtered = list.filter((a: any) => a.id !== id);
          localStorage.setItem('teacherActionAlerts', JSON.stringify(filtered));
          window.dispatchEvent(new Event('teacherAlertsUpdated'));
        } catch (e) {}
      }
    }
    triggerToast('تم أرشفة وحذف التنبيه بنجاح');
  };

  // Dismiss a specific alert from dashboard
  const handleDismissAlert = (id: string) => {
    const updated = [...dismissedAlerts, id];
    setDismissedAlerts(updated);
    localStorage.setItem('teacherDismissedAlerts', JSON.stringify(updated));
    triggerToast('تم تجاهل وإخفاء التنبيه بنجاح');
  };

  // Reset dismissed alert list to see everything again
  const handleClearDismissed = () => {
    setDismissedAlerts([]);
    localStorage.removeItem('teacherDismissedAlerts');
    triggerToast('تمت استعادة وعرض كافة التنبيهات النشطة المخفية!');
  };

  const handleDeleteAllNotifications = () => {
    setShowConfirmDeleteAll(true);
  };

  const executeDeleteAllNotifications = () => {
    // 1. Dismiss all activeAlerts & dynamic/computed teacher alerts
    const activeAlertIds = activeAlerts.map(a => a.id);
    const dynamicTeacherAlertIds = computedTeacherAlerts.map(a => a.id);
    const allDismissableIds = [...activeAlertIds, ...dynamicTeacherAlertIds];
    
    const updatedDismissed = Array.from(new Set([...dismissedAlerts, ...allDismissableIds]));
    setDismissedAlerts(updatedDismissed);
    localStorage.setItem('teacherDismissedAlerts', JSON.stringify(updatedDismissed));

    // 2. Clear teacherAlerts
    setTeacherAlerts([]);
    localStorage.setItem('teacherActionAlerts', JSON.stringify([]));
    
    // Trigger storage dispatch
    window.dispatchEvent(new Event('teacherAlertsUpdated'));
    
    triggerToast('تم مسح وتصفير كافة الإشعارات بنجاح! 🧹');
    setShowConfirmDeleteAll(false);
  };

  return (
    <div id="notification-center-root" className="relative print:hidden">
      {/* Visual Bell indicator triggering button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 border border-slate-200 hover:border-blue-100 rounded-xl transition duration-200 cursor-pointer flex items-center justify-center active:scale-95"
        title="التنبيهات الذكية وإشعارات الهاتف"
      >
        {isDndActiveNow ? (
          <div className="relative">
            <BellOff size={20} className="text-slate-400" />
            <span className="absolute -top-1 -left-1 text-[10px]" title="وضع عدم الإزعاج مفعّل وطمس الأصوات">🌙</span>
          </div>
        ) : totalAlertsCount > 0 ? (
          <motion.div
            animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
            transition={{ repeat: Infinity, repeatDelay: 4, duration: 0.5 }}
          >
            <Bell size={20} className="text-blue-600" />
          </motion.div>
        ) : (
          <BellOff size={20} className="text-slate-500" />
        )}

        {!isDndActiveNow && totalAlertsCount > 0 && (
          <span className="absolute -top-1.5 -left-1.5 min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {totalAlertsCount}
          </span>
        )}
      </button>

      {/* Popover / Drawer Container */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Dark background modal trigger backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-3xs"
            />

            {/* Main alerts center layout drawer */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 15 }}
              className="fixed xs:absolute left-4 right-4 md:left-0 md:right-auto md:w-96 top-24 md:top-14 mt-1 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 p-5 font-sans text-right text-slate-800 flex flex-col max-h-[80vh] overflow-hidden"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-3.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1 mb-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                  
                  {(activeAlerts.length > 0 || computedTeacherAlerts.length > 0) && (
                    <button
                      type="button"
                      onClick={handleDeleteAllNotifications}
                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1"
                      title="حذف جميع الإشعارات دفعة واحدة"
                    >
                      <span>حذف الكل 🗑️</span>
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 font-sans">الإشعارات</span>
                  <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                </div>
              </div>

              {/* Multi-Tab Navigation */}
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold mb-4 font-sans">
                <button
                  type="button"
                  onClick={() => setActiveTab('alerts')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === 'alerts'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  تنبيهات ({totalAlertsCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === 'settings'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  التخصيص
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('templates')}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer text-center ${
                    activeTab === 'templates'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  القوالب
                </button>
              </div>

              {/* Toast Messages for Notification Center Operations */}
              {successMsg && (
                <div className="mb-3 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-150 py-1.5 px-3 rounded-lg text-center font-sans animate-in fade-in duration-205">
                  ✓ {successMsg}
                </div>
              )}

              {/* Inline Confirm Delete All Notifications */}
              {showConfirmDeleteAll && (
                <div className="mb-3 p-3.5 bg-rose-50 border border-rose-150 rounded-2xl text-right animate-in slide-in-from-top-2 duration-200">
                  <div className="flex gap-2 items-start text-right">
                    <span className="text-sm shrink-0">🗑️</span>
                    <div className="flex-1">
                      <h5 className="font-black text-rose-950 text-[11px] leading-tight mb-0.5">تأكيد تفريغ كافة الإشعارات؟</h5>
                      <p className="text-[10px] font-sans font-medium text-slate-500 leading-normal">
                        سيتم إخفاء ومسح كافة تنبيهات الطلاب وحركات المعلم بالكامل دفعة واحدة. هذه الخطوة نهائية لتصفير القائمة.
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 mt-3 font-bold text-[10px]">
                    <button
                      type="button"
                      onClick={() => setShowConfirmDeleteAll(false)}
                      className="px-2.5 py-1 text-slate-650 hover:text-slate-800 bg-white border border-slate-200 rounded-lg cursor-pointer transition-colors"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={executeDeleteAllNotifications}
                      className="px-2.5 py-1 text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer transition-colors shadow-xs"
                    >
                      نعم، احذف الكل
                    </button>
                  </div>
                </div>
              )}

              {/* Center Core Views */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs font-semibold scrollbar-thin">
                
                {/* 1. Alerts Dashboard */}
                {activeTab === 'alerts' && (
                  <div className="space-y-3.5">
                    {/* Show DND active banner warning */}
                    {isDndActiveNow && (
                      <div className="flex items-center gap-2.5 p-3 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-2xl font-sans mb-1 text-right">
                        <span className="text-base select-none shrink-0 mb-0.5">🌙</span>
                        <div className="leading-normal text-[10px] font-black">
                          وضع عدم الإزعاج مفعّل وطمس الأصوات (تلقائياً من {settings.dndStart} وحتى {settings.dndEnd}). تم تعليق رنين وصوتيات الإشعارات لراحتك.
                        </div>
                      </div>
                    )}

                    {/* Sub-Tabs Pills */}
                    <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-50 border border-slate-150/60 rounded-xl font-bold mb-3 font-sans">
                      <button
                        type="button"
                        onClick={() => setAlertsSubTab('students')}
                        className={`py-1.5 rounded-lg transition-all text-center text-[10.5px] cursor-pointer font-black ${
                          alertsSubTab === 'students'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-650 hover:bg-slate-105'
                        }`}
                      >
                        إشعارات الطلاب ({activeAlerts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setAlertsSubTab('teacher')}
                        className={`py-1.5 rounded-lg transition-all text-center text-[10.5px] cursor-pointer font-black ${
                          alertsSubTab === 'teacher'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-650 hover:bg-slate-105'
                        }`}
                      >
                        خاصة بالمعلم ({computedTeacherAlerts.length})
                      </button>
                    </div>

                    {alertsSubTab === 'students' ? (
                      activeAlerts.length === 0 ? (
                        <div className="text-center py-10 space-y-3">
                          <div className="w-12 h-12 bg-slate-50 border border-slate-150 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                            <CheckCheck size={22} />
                          </div>
                          <p className="text-xs text-slate-550 font-bold leading-normal">
                            كل الحسابات مستقرة! لا توجد تذكيرات مستحقة أو حصص متأخرة اليوم لطلابك.
                          </p>
                          {dismissedAlerts.length > 0 && (
                            <button
                              onClick={handleClearDismissed}
                              className="text-[10px] text-blue-600 hover:underline cursor-pointer font-bold"
                            >
                              استعراض التنبيهات التي تم تجاهلها سابقاً ({dismissedAlerts.length})
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center text-[10px] text-slate-400">
                            <span>تحديث تلقائي مستمر</span>
                            {dismissedAlerts.length > 0 && (
                              <button
                                onClick={handleClearDismissed}
                                className="text-blue-600 hover:underline cursor-pointer font-bold"
                              >
                                إظهار المخفي ({dismissedAlerts.length})
                              </button>
                            )}
                          </div>

                          {activeAlerts.map(alert => (
                            <div
                              key={alert.id}
                              className={`p-3.5 border rounded-2xl transition-all relative group shadow-2xs ${
                                alert.type === 'class'
                                  ? 'bg-blue-50/50 border-blue-100 hover:bg-blue-50'
                                  : alert.type === 'payment'
                                  ? 'bg-red-50/40 border-red-100 hover:bg-red-50/70'
                                  : 'bg-purple-50/50 border-purple-100 hover:bg-purple-50'
                              }`}
                            >
                              <button
                                onClick={() => handleDismissAlert(alert.id)}
                                className="absolute top-2 left-2 text-slate-300 hover:text-slate-500 opacity-60 group-hover:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
                                title="تجاهل وإخفاء التنبيه"
                              >
                                <Check size={14} className="hover:text-emerald-600" />
                              </button>

                              <div className="flex gap-2.5 items-start pl-4 font-sans">
                                {/* Colored Visual badge */}
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                                  alert.type === 'class'
                                    ? 'bg-blue-100 border-blue-200 text-blue-600'
                                    : alert.type === 'payment'
                                    ? 'bg-red-100 border-red-200 text-red-650'
                                    : 'bg-purple-100 border-purple-200 text-purple-600'
                                }`}>
                                  {alert.type === 'class' && <Calendar size={15} />}
                                  {alert.type === 'payment' && <DollarSign size={15} />}
                                  {alert.type === 'completion' && <Award size={15} />}
                                </div>

                                <div className="flex-1 space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 bg-white/85 px-1.5 py-0.5 rounded border border-slate-100 float-left shadow-3xs">
                                    {alert.date}
                                  </span>
                                  <h4 className="font-bold text-slate-900 leading-snug text-xs pr-1">
                                    {alert.title}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold whitespace-pre-line">
                                    {alert.message}
                                  </p>
                                </div>
                              </div>

                              {/* Actions bar for alert */}
                              <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex gap-2 justify-end text-[10px] font-bold">
                                {/* Send to WhatsApp prefilled shortcut */}
                                {alert.dynamicActionData?.whatsappLink && settings.whatsappEnabled && (
                                  <a
                                    href={alert.dynamicActionData.whatsappLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition duration-150 cursor-pointer shadow-sm"
                                  >
                                    <Send size={11} className="text-emerald-100" />
                                    <span>واتساب 🟢</span>
                                  </a>
                                )}

                                {/* Custom WhatsApp student templates if available */}
                                {(() => {
                                  const student = students.find(s => s.id === alert.studentId);
                                  if (!student || !student.whatsAppTemplates || student.whatsAppTemplates.length === 0) return null;

                                  return (
                                    <div className="relative inline-block text-right">
                                      <button
                                        type="button"
                                        onClick={() => setOpenTemplatesAlertId(openTemplatesAlertId === alert.id ? null : alert.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 rounded-xl transition cursor-pointer shadow-3xs"
                                      >
                                        <span>قوالب الطالب 💬</span>
                                        <span className="text-[8px]">{openTemplatesAlertId === alert.id ? '▲' : '▼'}</span>
                                      </button>

                                      {openTemplatesAlertId === alert.id && (
                                        <div className="absolute right-0 bottom-full mb-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-2xl z-55 py-2 font-sans text-right max-h-48 overflow-y-auto">
                                          <div className="px-3.5 py-1 text-[9px] font-black text-slate-400 border-b border-slate-100 mb-1 leading-relaxed">رسالة مخصصة لـ {student.name}:</div>
                                          {student.whatsAppTemplates.map(tpl => {
                                            let txt = tpl.text;
                                            let outstanding = 0;
                                            if (student.type === 'lesson') {
                                              const totalCost = student.sessions.length * (student.lessonRate || 0);
                                              const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
                                              outstanding = totalCost - totalPaid;
                                            } else {
                                              const totalExtraCost = student.sessions.filter(s => s.isExtra).reduce((sum, s) => sum + (s.extraPrice || 0), 0);
                                              const totalCost = (student.coursePrice || 0) + totalExtraCost;
                                              const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
                                              outstanding = totalCost - totalPaid;
                                            }
                                            const lastSess = student.sessions.length > 0 ? student.sessions[student.sessions.length - 1] : null;

                                            txt = txt.replace(/\[الاسم\]/g, student.name);
                                            txt = txt.replace(/\[الوقت\]/g, lastSess?.time || '18:30');
                                            txt = txt.replace(/\[التاريخ\]/g, lastSess?.date || new Date().toISOString().split('T')[0]);
                                            txt = txt.replace(/\[المتبقي\]/g, String(outstanding > 0 ? outstanding : 0));
                                            txt = txt.replace(/\[العملة\]/g, currency);
                                            txt = txt.replace(/\[الحصص\]/g, String(student.sessions.length));

                                            const rawPhone = student.phone.replace(/[^0-9]/g, '');
                                            let cleanPhone = rawPhone;
                                            if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
                                              cleanPhone = '2' + cleanPhone;
                                            }
                                            const tplUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(txt)}`;

                                            return (
                                              <a
                                                key={tpl.id}
                                                href={tplUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={() => setOpenTemplatesAlertId(null)}
                                                className="block px-3.5 py-2 text-slate-705 hover:bg-slate-50 hover:text-emerald-700 transition font-bold text-[10px] truncate"
                                                title={txt}
                                              >
                                                {tpl.title} 🚀
                                              </a>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Trigger direct System Notification simulation for testing */}
                                <button
                                  type="button"
                                  onClick={() => handleSendTestPush(alert.title, alert.message)}
                                  className="flex items-center gap-1 px-2.5 py-1.2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer font-bold"
                                  title="إرسال دفعة إشعار عبر لسان الهاتف الحالي"
                                >
                                  <Play size={10} className="text-slate-450 animate-pulse" />
                                  <span>تجربة الإشعار</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      computedTeacherAlerts.length === 0 ? (
                        <div className="text-center py-10 space-y-3">
                          <div className="w-12 h-12 bg-slate-50 border border-slate-150 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
                            <CheckCheck size={22} />
                          </div>
                          <p className="text-xs text-slate-550 font-bold leading-normal">
                            لا توجد إشعارات مخصصة للمعلم حالياً! سيقوم النظام بإدراج تنبيهات الحصص المنجزة والدفعات المسجلة وأقساط الطلاب المستحقة بمجرد قيدها.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3 font-sans">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                            <span>أرشيف التنبيهات المكتملة</span>
                            <span>تحديث لحظي مستمر</span>
                          </div>

                          {computedTeacherAlerts.map(alert => (
                            <div
                              key={alert.id}
                              className={`p-3.5 border rounded-2xl transition-all relative group shadow-3xs text-right leading-relaxed ${
                                alert.type === 'teacher-session'
                                  ? 'bg-indigo-50/45 border-indigo-100 hover:bg-indigo-50/70'
                                  : alert.type === 'teacher-payment'
                                  ? 'bg-emerald-50/45 border-emerald-100 hover:bg-emerald-50/70'
                                  : 'bg-red-50/35 border-red-105 hover:bg-red-50/65'
                              }`}
                            >
                              <button
                                onClick={() => handleDismissTeacherAlert(alert.id)}
                                className="absolute top-2.5 left-2.5 text-slate-300 hover:text-red-500 opacity-65 group-hover:opacity-100 transition-all p-0.5 rounded cursor-pointer"
                                title="أرشفة وحذف هذا التنبيه"
                              >
                                <X size={14} />
                              </button>

                              <div className="flex gap-2.5 items-start pl-4 font-sans text-right">
                                {/* Icon Badge */}
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border text-xs font-bold leading-none ${
                                  alert.type === 'teacher-session'
                                    ? 'bg-indigo-100 border-indigo-200 text-indigo-700'
                                    : alert.type === 'teacher-payment'
                                    ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                                    : 'bg-red-100 border-red-200 text-red-700'
                                }`}>
                                  {alert.type === 'teacher-session' && '🧑‍🏫'}
                                  {alert.type === 'teacher-payment' && '💰'}
                                  {alert.type === 'teacher-due' && '⏳'}
                                </div>

                                <div className="flex-1 space-y-0.5 text-right">
                                  <div className="flex items-center justify-between gap-2.5">
                                    <h5 className="font-extrabold text-slate-950 text-xs leading-snug">
                                      {alert.title}
                                    </h5>
                                    <span className="text-[9px] font-bold text-slate-400 bg-white/90 border border-slate-105 rounded px-1.5 py-0.5 shrink-0">
                                      {alert.date}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 leading-relaxed font-semibold mt-1">
                                    {alert.message}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    )}
                  </div>
                )}


                {/* 2. Toggle controls threshold configuration */}
                {activeTab === 'settings' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 text-[10px] leading-relaxed text-slate-500 flex gap-2.5 items-start font-medium">
                      <Sliders size={18} className="text-blue-600 shrink-0 mt-0.5" />
                      <p>
                        خصص من هنا معايير وتوقيت احتساب التنبيهات بشكل ذكي قبل المواعيد المجدولة لطلابك. سنقوم بالتحديث فوراً.
                      </p>
                    </div>

                    <div className="space-y-3.5 pt-1">
                      {/* Section: Classes Reminder */}
                      <div className="p-3 bg-white border border-slate-250 rounded-2xl space-y-2.5">
                        <div className="flex justify-between items-center">
                          <button
                            type="button"
                            onClick={() => saveSettings({ ...settings, remindClasses: !settings.remindClasses })}
                            className="text-blue-600 cursor-pointer hover:opacity-85"
                          >
                            {settings.remindClasses ? <ToggleRight size={24} className="text-blue-600" /> : <ToggleLeft size={24} className="text-slate-400" />}
                          </button>
                          <span className="font-extrabold text-slate-800">تنبيهات بمواعيد الحصص اليومية</span>
                        </div>
                        {settings.remindClasses && (
                          <div className="flex items-center justify-end gap-2 text-right pr-6 pt-1">
                            <span className="text-[10px] text-slate-500 font-bold">وقت التنبيه</span>
                            <select
                              value={settings.classHoursThreshold}
                              onChange={(e) => saveSettings({ ...settings, classHoursThreshold: Number(e.target.value) })}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold focus:outline-none focus:border-blue-500 font-sans"
                            >
                              <option value="0.25">قبل 15 دقيقة</option>
                              <option value="0.5">قبل 30 دقيقة</option>
                              <option value="1">قبل ساعة واحدة</option>
                              <option value="2">قبل ساعتين</option>
                              <option value="3">قبل 3 ساعات</option>
                              <option value="6">قبل 6 ساعات</option>
                              <option value="12">قبل 12 ساعة</option>
                              <option value="24">قبل يوم واحد (24 ساعة)</option>
                            </select>
                            <span className="text-[10px] text-slate-500 font-medium">عرض التذكير قبلها بـ:</span>
                          </div>
                        )}
                      </div>

                      {/* Section: Payment Due Reminder */}
                      <div className="p-3 bg-white border border-slate-250 rounded-2xl space-y-2.5">
                        <div className="flex justify-between items-center">
                          <button
                            type="button"
                            onClick={() => saveSettings({ ...settings, remindPayments: !settings.remindPayments })}
                            className="text-blue-600 cursor-pointer hover:opacity-85"
                          >
                            {settings.remindPayments ? <ToggleRight size={24} className="text-blue-600" /> : <ToggleLeft size={24} className="text-slate-400" />}
                          </button>
                          <span className="font-extrabold text-slate-800">تذكير باستحقاق الدفعات (الكورسات)</span>
                        </div>
                        {settings.remindPayments && (
                          <div className="flex items-center justify-end gap-2 text-right pr-6 pt-1">
                            <span className="text-[10px] text-slate-500 font-bold">وقت التنبيه</span>
                            <select
                              value={settings.paymentDaysThreshold}
                              onChange={(e) => saveSettings({ ...settings, paymentDaysThreshold: Number(e.target.value) })}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold focus:outline-none focus:border-blue-500 font-sans"
                            >
                              <option value="1">قبل يوم واحد</option>
                              <option value="2">قبل يومين</option>
                              <option value="3">قبل 3 أيام</option>
                              <option value="5">قبل 5 أيام</option>
                              <option value="7">قبل أسبوع كامل</option>
                              <option value="10">قبل 10 أيام</option>
                              <option value="14">قبل أسبوعين (14 يوماً)</option>
                            </select>
                            <span className="text-[10px] text-slate-500 font-medium">عرض التذكير قبلها بـ:</span>
                          </div>
                        )}
                      </div>

                      {/* Section: Completion Reminder */}
                      <div className="p-3 bg-white border border-slate-250 rounded-2xl space-y-2.5">
                        <div className="flex justify-between items-center">
                          <button
                            type="button"
                            onClick={() => saveSettings({ ...settings, remindCompletion: !settings.remindCompletion })}
                            className="text-blue-600 cursor-pointer hover:opacity-85"
                          >
                            {settings.remindCompletion ? <ToggleRight size={24} className="text-blue-600" /> : <ToggleLeft size={24} className="text-slate-400" />}
                          </button>
                          <span className="font-extrabold text-slate-800">تنبيه باقتراب انتهاء كورس الطالب</span>
                        </div>
                        {settings.remindCompletion && (
                          <div className="flex items-center justify-end gap-2 text-right pr-6 pt-1">
                            <span className="text-[10px] text-slate-500 font-bold">جلسات</span>
                            <select
                              value={settings.completionRemainingCount}
                              onChange={(e) => saveSettings({ ...settings, completionRemainingCount: Number(e.target.value) })}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold focus:outline-none focus:border-blue-500 font-sans"
                            >
                              <option value="0">عند الاكتمال تماماً فقط (0 باقٍ)</option>
                              <option value="1">متبقي حصة واحدة (1)</option>
                              <option value="2">متبقي حصتان (2)</option>
                              <option value="3">متبقي 3 حصص (3)</option>
                            </select>
                            <span className="text-[10px] text-slate-500 font-medium">تنبيه عند اقتراب:</span>
                          </div>
                        )}
                      </div>

                      {/* Section: Delivery Channels Preferences */}
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-3">
                        <span className="font-extrabold text-blue-900 text-xs block border-b border-blue-100 pb-1.5">تخصيص قنوات التوصيل المفضلة</span>
                        
                        <div className="flex justify-between items-center">
                          <button
                            type="button"
                            onClick={() => saveSettings({ ...settings, whatsappEnabled: !settings.whatsappEnabled })}
                            className="text-emerald-600 cursor-pointer"
                          >
                            {settings.whatsappEnabled ? <ToggleRight size={22} className="text-emerald-600" /> : <ToggleLeft size={22} className="text-slate-400" />}
                          </button>
                          <span className="text-[11px] font-bold text-slate-700">تفعيل روابط إرسال تذكير واتساب السريع 🟢</span>
                        </div>

                        {/* Push Notification permissions toggle */}
                        <div className="flex justify-between items-center border-t border-blue-105 pt-2">
                          {pushPermission === 'granted' ? (
                            <button
                              type="button"
                              onClick={() => saveSettings({ ...settings, enablePush: !settings.enablePush })}
                              className="text-blue-600 cursor-pointer"
                            >
                              {settings.enablePush ? <ToggleRight size={22} className="text-blue-600" /> : <ToggleLeft size={22} className="text-slate-400" />}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleRequestPushPermission}
                              className="px-2 py-1 bg-blue-600 font-extrabold text-[9px] text-white rounded-lg transition hover:bg-blue-700 cursor-pointer"
                            >
                              طلب تفعيل إذن سطح المكتب
                            </button>
                          )}
                          <span className="text-[11px] font-bold text-slate-700">تفعيل إشعارات سطح المكتب / الهاتف (Push) 📱</span>
                        </div>
                      </div>

                      {/* Section: Student Portal Alerts Customization */}
                      <div className="p-4 bg-purple-50 border border-purple-100 rounded-2xl space-y-3">
                        <span className="font-extrabold text-purple-900 text-xs block border-b border-purple-100 pb-1.5">تخصيص تنبيهات بوابة الطالب 🎓</span>
                        
                        <div className="flex justify-between items-center">
                          <button
                            type="button"
                            onClick={() => saveSettings({ ...settings, sendStudentClassReminders: settings.sendStudentClassReminders !== false ? false : true })}
                            className="text-purple-600 cursor-pointer hover:opacity-85"
                          >
                            {settings.sendStudentClassReminders !== false ? <ToggleRight size={22} className="text-purple-600" /> : <ToggleLeft size={22} className="text-slate-400" />}
                          </button>
                          <span className="text-[11px] font-bold text-slate-700">تنبيه بحصص الطالب القادمة اليومية 📆</span>
                        </div>

                        <div className="flex justify-between items-center border-t border-purple-105 pt-2">
                          <button
                            type="button"
                            onClick={() => saveSettings({ ...settings, sendStudentPaymentReminders: settings.sendStudentPaymentReminders !== false ? false : true })}
                            className="text-purple-600 cursor-pointer hover:opacity-85"
                          >
                            {settings.sendStudentPaymentReminders !== false ? <ToggleRight size={22} className="text-purple-600" /> : <ToggleLeft size={22} className="text-slate-400" />}
                          </button>
                          <span className="text-[11px] font-bold text-slate-700">تنبيهات بمستحقات الدفع والرسوم 💰</span>
                        </div>

                        <div className="flex justify-between items-center border-t border-purple-105 pt-2">
                          <button
                            type="button"
                            onClick={() => saveSettings({ ...settings, sendStudentCompletionReminders: settings.sendStudentCompletionReminders !== false ? false : true })}
                            className="text-purple-600 cursor-pointer hover:opacity-85"
                          >
                            {settings.sendStudentCompletionReminders !== false ? <ToggleRight size={22} className="text-purple-600" /> : <ToggleLeft size={22} className="text-slate-400" />}
                          </button>
                          <span className="text-[11px] font-bold text-slate-700">تنبيه باقتراب موعد تجديد/نهاية الكورس 🏆</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Text Message Templates Customizer */}
                {activeTab === 'templates' && (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 text-[10px] leading-relaxed text-slate-500 font-medium">
                      <p className="font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <Info size={14} className="text-blue-600" />
                        تعليمات استخدام المتغيرات الذكية:
                      </p>
                      <p>
                        يمكنك تعديل وصياغة نص رسائل التذكير وتضمين المتغيرات التلقائية ليقوم البرنامج بملئها تلقائياً لكل طالب:
                      </p>
                      <ul className="list-disc pr-4 mt-1 space-y-0.5 text-[9px] font-semibold text-slate-600">
                        <li><strong className="text-purple-700">[الاسم]</strong>: سيعوض عنه باسم الطالب تلقائياً.</li>
                        <li><strong className="text-blue-700">[الوقت]</strong>: سيعوض عنه بساعة وتوقيت الحصة.</li>
                        <li><strong className="text-red-700">[المتبقي]</strong>: سيعوض بالمبلغ المتأخر المطلوب نقدياً.</li>
                        <li><strong className="text-pink-700">[التاريخ]</strong>: سيعوض بتاريخ الاستحقاق.</li>
                        <li><strong className="text-emerald-700">[العملة]</strong>: رمز العملة المعتمد في الإعدادات ({currency}).</li>
                        <li><strong className="text-indigo-700">[الحصص]</strong>: عدد الحصص المنجزة أو المتبقية.</li>
                      </ul>
                    </div>

                    {/* Template Input: Upcoming Classes */}
                    <div className="space-y-1.5 p-3 bg-white border border-slate-205 rounded-2xl">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Calendar size={13} className="text-blue-600" />
                        نموذج رسالة ميعاد الحصة اليومية
                      </label>
                      <textarea
                        rows={3}
                        value={settings.classTemplate}
                        onChange={(e) => saveSettings({ ...settings, classTemplate: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 focus:outline-none focus:border-blue-500 font-sans"
                        placeholder="اكتب صياغة نص التذكير..."
                      />
                    </div>

                    {/* Template Input: Payment Due */}
                    <div className="space-y-1.5 p-3 bg-white border border-slate-205 rounded-2xl">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <DollarSign size={13} className="text-red-655" />
                        نموذج رسالة استحقاق الرصيد والرسوم
                      </label>
                      <textarea
                        rows={3}
                        value={settings.paymentTemplate}
                        onChange={(e) => saveSettings({ ...settings, paymentTemplate: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 focus:outline-none focus:border-blue-500 font-sans"
                        placeholder="اكتب صياغة نص التذكير..."
                      />
                    </div>

                    {/* Template Input: Course Completion */}
                    <div className="space-y-1.5 p-3 bg-white border border-slate-205 rounded-2xl">
                      <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Award size={13} className="text-purple-600" />
                        نموذج رسالة نهاية وتجديد الكورس
                      </label>
                      <textarea
                        rows={3}
                        value={settings.completionTemplate}
                        onChange={(e) => saveSettings({ ...settings, completionTemplate: e.target.value })}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold text-slate-700 focus:outline-none focus:border-blue-500 font-sans"
                        placeholder="اكتب صياغة نص التذكير..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer footer close button */}
              <div className="border-t border-slate-100 pt-3 mt-3.5 flex justify-between items-center text-[9px] font-mono text-slate-400">
                <span>تحديث مستمر للبيانات والحصص</span>
                <span className="font-sans font-semibold text-slate-500">منصة TEACHER v{(import.meta as any).env?.VITE_APP_VERSION || '1.3'}</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
