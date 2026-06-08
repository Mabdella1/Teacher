import { useState, useEffect } from 'react';
import { Student, Appointment, TeacherPreferences, ExamAppointment } from './types';
import { syncStudentBadges } from './lib/rewardsHelper';
import LockScreen from './components/LockScreen';
import StudentPortal from './components/StudentPortal';
import StudentList from './components/StudentList';
import StudentDetails from './components/StudentDetails';
import Scheduler from './components/Scheduler';
import FinancialReports from './components/FinancialReports';
import SettingsPanel from './components/SettingsPanel';
import TeacherProfileTab from './components/TeacherProfileTab';
import NotificationCenter from './components/NotificationCenter';
import ThemeStyleInjector from './components/ThemeStyleInjector';
import Dashboard from './components/Dashboard';
import TeacherChatHub from './components/TeacherChatHub';
import RewardsDashboard from './components/RewardsDashboard';
import { 
  Users, CalendarDays, BarChart3, Settings, LogOut, Lock, Award, 
  Menu, X, Sparkles, GraduationCap, ChevronDown, User, LayoutGrid,
  Cloud, CloudLightning, CloudOff, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { initAuth, logout, getAccessToken } from './lib/firebaseAuth';
import { saveWorkspaceToCloud, fetchWorkspaceFromCloud } from './lib/firebaseSync';
import { triggerDailyGoogleDriveBackupIfNeeded, uploadBackupToGoogleDrive } from './lib/googleDriveSync';

// Default initial state
const DEFAULT_PREFERENCES: TeacherPreferences = {
  teacherName: 'الأستاذ الفاضل',
  subject: '',
  currency: 'ج.م',
  passcode: '', // Guided setup on first load
  primaryColor: 'blue',
  enableWhatsApp24hReminders: true,
  autoBackupDownloadInterval: 'daily',
  enableAutoCloudSync: true,
};

const DEFAULT_STUDENTS: Student[] = [
  {
    id: 's1',
    name: 'أحمد ياسين زكريا',
    phone: '01015672901',
    type: 'lesson',
    active: true,
    createdAt: '2026-05-10',
    lessonRate: 150,
    sessions: [
      { id: 'sess1.4', date: '2026-05-22', time: '17:30', notes: 'مراجعة الباب الثاني وحل الامتحان التجريبي الأول' },
      { id: 'sess1.3', date: '2026-05-18', time: '16:00', notes: 'شرح الباب الثاني كاملا وحل أسئلة الواجب' },
      { id: 'sess1.2', date: '2026-05-14', time: '16:30', notes: 'حل اختبار وتصحيح واجب المحاضرة السابقة الباب الأول' },
      { id: 'sess1.1', date: '2026-05-10', time: '16:00', notes: 'المحاضرة التمهيدية وشرح أساسيات المنهج وتوزيع الواجبات' }
    ],
    payments: [
      { id: 'pay1.1', amount: 300, date: '2026-05-12', notes: 'مقدم نقدية تحت الحساب' },
      { id: 'pay1.2', amount: 150, date: '2026-05-19', notes: 'تحويل فودافون كاش' }
    ]
  },
  {
    id: 's2',
    name: 'منى عبد الرحمن السيد',
    phone: '01229988771',
    type: 'course',
    active: true,
    createdAt: '2026-05-01',
    coursePrice: 1200,
    totalLessonsCount: 8,
    dueDate: '2026-05-28',
    sessions: [
      { id: 'sess2.4', date: '2026-05-20', time: '15:00', notes: 'الدرس الرابع في الكورس مع مناقشة المسائل المعقدة وبدء التدريب' },
      { id: 'sess2.3', date: '2026-05-15', time: '15:30', notes: 'شرح الدرس الثالث في الكورس مع تصحيح الواجب المنزلي' },
      { id: 'sess2.2', date: '2026-05-10', time: '15:00', notes: 'الدرس الثاني من المقرر وتدريب عملي تفاعلي' },
      { id: 'sess2.1', date: '2026-05-03', time: '15:15', notes: 'بداية الجزء الأول من الكورس وشرح خطة الحضور والغياب' }
    ],
    payments: [
      { id: 'pay2.1', amount: 600, date: '2026-05-01', notes: 'الدفعة الأولى كاش عند الحجز مباشرة' },
      { id: 'pay2.2', amount: 400, date: '2026-05-16', notes: 'الدفعة الثانية والمتبقي جزئيا' }
    ]
  },
  {
    id: 's3',
    name: 'عبد الله كمال ريان',
    phone: '01550102030',
    type: 'lesson',
    active: true,
    createdAt: '2026-05-12',
    lessonRate: 200,
    sessions: [
      { id: 'sess3.3', date: '2026-05-23', time: '19:00', notes: 'حل أسئلة بنك المعرفة كاملة وتطبيقات متميزة' },
      { id: 'sess3.2', date: '2026-05-19', time: '19:15', notes: 'إصلاح التمارين الخاطئة وشرح مفصل لعناصر الوحدة الثالثة' },
      { id: 'sess3.1', date: '2026-05-12', time: '19:00', notes: 'شرح الوحدة الأولى بالكامل وقراءتها معاً' }
    ],
    payments: [
      { id: 'pay3.1', amount: 600, date: '2026-05-21', notes: 'سداد الحصص الثلاث الأولى كاملا كاش' }
    ]
  },
  {
    id: 's4',
    name: 'يوسف مصطفى البدري',
    phone: '01124455663',
    type: 'course',
    active: false,
    createdAt: '2026-04-10',
    coursePrice: 950,
    totalLessonsCount: 6,
    dueDate: '2026-05-01',
    sessions: [
      { id: 'sess4.3', date: '2026-04-28', time: '14:00', notes: 'ورشة عمل وتدريبات المنهج المتكاملة' },
      { id: 'sess4.2', date: '2026-04-20', time: '14:30', notes: 'مناقشة اختبار نصف الفصل وحل الصعوبات' },
      { id: 'sess4.1', date: '2026-04-12', time: '14:00', notes: 'حصة البدء وشرح قواعد المصطلحات اللفظية' }
    ],
    payments: [
      { id: 'pay4.1', amount: 950, date: '2026-04-10', notes: 'تم سداد سعر الكورس الإجمالي مقدماً بالكامل' }
    ]
  }
];

const DEFAULT_APPOINTMENTS: Appointment[] = [
  { id: 'app1', studentId: 's1', studentName: 'أحمد ياسين زكريا', dayOfWeek: 'السبت', time: '16:00', notes: 'شقة الطالب' },
  { id: 'app2', studentId: 's2', studentName: 'منى عبد الرحمن السيد', dayOfWeek: 'الاثنين', time: '15:00', notes: 'في السنتر الرئيسي' },
  { id: 'app3', studentId: 's3', studentName: 'عبد الله كمال ريان', dayOfWeek: 'الثلاثاء', time: '19:00', notes: 'زووم أونلاين' },
  { id: 'app4', studentId: 's1', studentName: 'أحمد ياسين زكريا', dayOfWeek: 'الأربعاء', time: '16:00', notes: 'شقة الطالب' }
];

export default function App() {
  const [preferences, setPreferences] = useState<TeacherPreferences>(DEFAULT_PREFERENCES);
  const [students, setStudents] = useState<Student[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [examAppointments, setExamAppointments] = useState<ExamAppointment[]>([]);
  
  // App view control
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'schedule' | 'financials' | 'settings' | 'chat' | 'rewards' | 'teacher'>('dashboard');
  const [navDropdownOpen, setNavDropdownOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Student portal login state & session persistence
  const [studentUser, setStudentUser] = useState<Student | null>(() => {
    const cached = localStorage.getItem('loggedStudent');
    if (cached) {
      try { return JSON.parse(cached); } catch (e) { return null; }
    }
    return null;
  });

  // Watch student session changes
  useEffect(() => {
    if (studentUser) {
      localStorage.setItem('loggedStudent', JSON.stringify(studentUser));
    } else {
      localStorage.removeItem('loggedStudent');
    }
  }, [studentUser]);

  // Cloud Sync States
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<'synced' | 'syncing' | 'error'>('synced');
  const [isCloudPullCompleted, setIsCloudPullCompleted] = useState<boolean>(false);
  const [driveSyncState, setDriveSyncState] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showSyncErrorModal, setShowSyncErrorModal] = useState<boolean>(false);

  // Push updates helper
  const pushWorkspaceToCloud = async (
    userId: string,
    nextPrefs: TeacherPreferences,
    nextStudents: Student[],
    nextApps: Appointment[],
    nextExams: ExamAppointment[]
  ) => {
    if (userId === "offline_local") {
      setSyncState('synced');
      setSyncError(null);
      return;
    }
    try {
      // Keep silent to avoid blinking sync status
      // setSyncState('syncing');
      await saveWorkspaceToCloud(userId, {
        teacherName: nextPrefs.teacherName,
        subject: nextPrefs.subject,
        currency: nextPrefs.currency || 'ج.م',
        passcode: nextPrefs.passcode || '',
        primaryColor: nextPrefs.primaryColor || 'blue',
        enableWhatsApp24hReminders: nextPrefs.enableWhatsApp24hReminders !== false,
        autoBackupDownloadInterval: nextPrefs.autoBackupDownloadInterval || 'disabled',
        enableAutoCloudSync: nextPrefs.enableAutoCloudSync !== false,
        teacherAvatar: nextPrefs.teacherAvatar || '',
        students: nextStudents,
        appointments: nextApps,
        examAppointments: nextExams,
      });
      setSyncState('synced');
      setSyncError(null);
    } catch (err: any) {
      if (err?.isOffline) {
        console.warn("Auto Sync Push to Cloud paused (Client is offline). State remains intact locally and will sync once connection is restored.");
        setSyncState('synced');
        setSyncError(null);
      } else {
        console.error("Auto Sync Push to Cloud Failed:", err);
        let errorMsg = err?.message || String(err);
        try {
          const parsed = JSON.parse(errorMsg);
          if (parsed.error) errorMsg = parsed.error;
        } catch(e) {}
        setSyncError(errorMsg);
        setSyncState('error');
      }
    }
  };

  const triggerManualCloudSync = async () => {
    if (!currentUserId || currentUserId === "offline_local") return;
    setSyncState('syncing');
    setSyncError(null);
    try {
      await saveWorkspaceToCloud(currentUserId, {
        teacherName: preferences.teacherName,
        subject: preferences.subject,
        currency: preferences.currency || 'ج.م',
        passcode: preferences.passcode || '',
        primaryColor: preferences.primaryColor || 'blue',
        enableWhatsApp24hReminders: preferences.enableWhatsApp24hReminders !== false,
        autoBackupDownloadInterval: preferences.autoBackupDownloadInterval || 'disabled',
        enableAutoCloudSync: preferences.enableAutoCloudSync !== false,
        teacherAvatar: preferences.teacherAvatar || '',
        students,
        appointments,
        examAppointments,
      });
      setSyncState('synced');
      setSyncError(null);
    } catch (err: any) {
      let errorMsg = err?.message || String(err);
      try {
        const parsed = JSON.parse(errorMsg);
        if (parsed.error) errorMsg = parsed.error;
      } catch(e) {}
      
      const isOfflineError = err?.isOffline || 
                             errorMsg.toLowerCase().includes('offline') || 
                             errorMsg.toLowerCase().includes('network') || 
                             errorMsg.toLowerCase().includes('unavailable') ||
                             errorMsg.toLowerCase().includes('failed to get document') ||
                             errorMsg.toLowerCase().includes('connection');

      if (isOfflineError) {
        console.warn("[Manual Cloud Sync] Paused (Client in offline mode). Your edits are safe locally and will sync once internet connection resumes.");
        setSyncState('synced');
        setSyncError(null);
      } else {
        console.error("[Manual Cloud Sync] Failed:", err);
        setSyncError(errorMsg);
        setSyncState('error');
      }
    }
  };

  // Auth Listener setup
  useEffect(() => {
    const isOfflineMode = localStorage.getItem('teacher_offline_mode') === 'true';
    if (isOfflineMode) {
      setCurrentUserId("offline_local");
      setIsLocked(false);
    }

    const unsubscribe = initAuth((user) => {
      localStorage.removeItem('teacher_offline_mode');
      setCurrentUserId(user.uid);
      setIsLocked(false);
    }, () => {
      const activeOffline = localStorage.getItem('teacher_offline_mode') === 'true';
      if (!activeOffline) {
        setCurrentUserId(null);
      } else {
        setCurrentUserId("offline_local");
        setIsLocked(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Cloud workspace on login
  useEffect(() => {
    if (!currentUserId) return;

    let isSubscribed = true;
    setIsCloudPullCompleted(false);

    const pullCloudWorkspace = async () => {
      if (currentUserId === "offline_local") {
        if (isSubscribed) {
          setSyncState('synced');
          setSyncError(null);
          setIsCloudPullCompleted(true);
        }
        return;
      }
      try {
        setSyncState('syncing');
        setSyncError(null);
        const cloudData = await fetchWorkspaceFromCloud(currentUserId);
        if (cloudData && isSubscribed) {
          setStudents(cloudData.students || []);
          localStorage.setItem('teacherStudents', JSON.stringify(cloudData.students || []));

          setAppointments(cloudData.appointments || []);
          localStorage.setItem('teacherAppointments', JSON.stringify(cloudData.appointments || []));

          setExamAppointments(cloudData.examAppointments || []);
          localStorage.setItem('teacherExamAppointments', JSON.stringify(cloudData.examAppointments || []));

          const cloudPrefs: TeacherPreferences = {
            teacherName: cloudData.teacherName,
            subject: cloudData.subject,
            currency: cloudData.currency || 'ج.م',
            passcode: cloudData.passcode || '',
            primaryColor: cloudData.primaryColor || 'blue',
            enableWhatsApp24hReminders: cloudData.enableWhatsApp24hReminders !== false,
            autoBackupDownloadInterval: cloudData.autoBackupDownloadInterval || 'disabled'
          };
          setPreferences(cloudPrefs);
          localStorage.setItem('teacherPreferences', JSON.stringify(cloudPrefs));
          setSyncState('synced');
          setSyncError(null);
          setIsCloudPullCompleted(true);
        } else if (!cloudData && isSubscribed) {
          // Newly registered - push default or pre-auth local data as initial cloud document
          await pushWorkspaceToCloud(currentUserId, preferences, students, appointments, examAppointments);
          setIsCloudPullCompleted(true);
        }
      } catch (err: any) {
        if (err?.isOffline) {
          console.warn("Could not fetch cloud workspace because client is offline. Running securely in offline mode with cached local data.");
          setIsCloudPullCompleted(true);
          setSyncState('synced');
          setSyncError(null);
        } else {
          console.error("Failed to fetch cloud workspace on login:", err);
          let errorMsg = err?.message || String(err);
          try {
            const parsed = JSON.parse(errorMsg);
            if (parsed.error) errorMsg = parsed.error;
          } catch(e) {}
          setSyncError(errorMsg);
          setSyncState('error');
          setIsCloudPullCompleted(true);
        }
      }
    };

    pullCloudWorkspace();

    return () => {
      isSubscribed = false;
    };
  }, [currentUserId]);

  // Initial local state load
  useEffect(() => {
    const storedPrefs = localStorage.getItem('teacherPreferences');
    let loadedPrefs = DEFAULT_PREFERENCES;
    if (storedPrefs) {
      try {
        loadedPrefs = JSON.parse(storedPrefs);
        setPreferences(loadedPrefs);
      } catch (e) {}
    } else {
      localStorage.setItem('teacherPreferences', JSON.stringify(DEFAULT_PREFERENCES));
    }

    const storedStudents = localStorage.getItem('teacherStudents');
    let loadedStudents = DEFAULT_STUDENTS;
    if (storedStudents) {
      try {
        loadedStudents = JSON.parse(storedStudents);
      } catch (e) {}
    }
    const syncedStudents = loadedStudents.map(s => syncStudentBadges(s).updatedStudent);
    setStudents(syncedStudents);
    localStorage.setItem('teacherStudents', JSON.stringify(syncedStudents));

    const storedAppointments = localStorage.getItem('teacherAppointments');
    let loadedAppointments = DEFAULT_APPOINTMENTS;
    if (storedAppointments) {
      try {
        loadedAppointments = JSON.parse(storedAppointments);
      } catch (e) {}
    } else {
      localStorage.setItem('teacherAppointments', JSON.stringify(DEFAULT_APPOINTMENTS));
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const prunedAppointments = loadedAppointments.filter(app => {
      if (app.isExceptional && app.date && app.date < todayStr) {
        return false;
      }
      return true;
    });

    setAppointments(prunedAppointments);
    if (prunedAppointments.length !== loadedAppointments.length) {
      localStorage.setItem('teacherAppointments', JSON.stringify(prunedAppointments));
    }

    const storedExamApps = localStorage.getItem('teacherExamAppointments');
    if (storedExamApps) {
      try {
        setExamAppointments(JSON.parse(storedExamApps));
      } catch (e) {}
    } else {
      setExamAppointments([]);
      localStorage.setItem('teacherExamAppointments', JSON.stringify([]));
    }
  }, []);

  // Cloud automatic background synchronization for any state changes (preferences, students, appointments, and exams)
  useEffect(() => {
    if (!currentUserId || currentUserId === "offline_local") {
      setSyncState('synced');
      setSyncError(null);
      return;
    }
    if (preferences.enableAutoCloudSync === false) {
      setSyncState('synced');
      setSyncError(null);
      return;
    }
    if (!isCloudPullCompleted) return; // Prevent overwriting cloud data before initial pull completes

    // Keep syncState silent during automatic background sync to avoid visual distraction
    // setSyncState('syncing');

    // Debounce cloud sync to group rapid consecutive state changes (like notes typing, checkbox clicks, etc.)
    const timer = setTimeout(async () => {
      try {
        await saveWorkspaceToCloud(currentUserId, {
          teacherName: preferences.teacherName,
          subject: preferences.subject,
          currency: preferences.currency || 'ج.م',
          passcode: preferences.passcode || '',
          primaryColor: preferences.primaryColor || 'blue',
          enableWhatsApp24hReminders: preferences.enableWhatsApp24hReminders !== false,
          autoBackupDownloadInterval: preferences.autoBackupDownloadInterval || 'disabled',
          enableAutoCloudSync: preferences.enableAutoCloudSync !== false,
          teacherAvatar: preferences.teacherAvatar || '',
          students,
          appointments,
          examAppointments,
        });
        setSyncState('synced');
        setSyncError(null);
        console.log("[Cloud Auto Sync] Core states synced automatically to Firestore.");
      } catch (err: any) {
        if (err?.isOffline) {
          console.warn("[Cloud Auto Sync] Paused (Offline mode). Local modifications preserved.");
          setSyncState('synced'); // Remain looking healthy as offline Firestore cache will sync in the background
          setSyncError(null);
        } else {
          console.error("[Cloud Auto Sync] Auto synchronization failed:", err);
          let errorMsg = err?.message || String(err);
          try {
            const parsed = JSON.parse(errorMsg);
            if (parsed.error) errorMsg = parsed.error;
          } catch(e) {}
          setSyncError(errorMsg);
          setSyncState('error');
        }
      }
    }, 1500); // 1.5s quiet-time debounce

    return () => clearTimeout(timer);
  }, [
    currentUserId,
    isCloudPullCompleted,
    students,
    appointments,
    examAppointments,
    preferences.teacherName,
    preferences.subject,
    preferences.currency,
    preferences.passcode,
    preferences.primaryColor,
    preferences.enableWhatsApp24hReminders,
    preferences.autoBackupDownloadInterval,
    preferences.enableAutoCloudSync,
  ]);

  // Google Drive automated background sync/backup of modifications & daily checkes
  useEffect(() => {
    if (!currentUserId || currentUserId === "offline_local") {
      setDriveSyncState('idle');
      return;
    }
    if (!isCloudPullCompleted) return; // Prevent premature overrides before cloud data load

    const token = getAccessToken();
    if (!token) {
      setDriveSyncState('idle');
      return;
    }

    // Check configuration. If user chose 'disabled', skip auto sync
    if (preferences.autoBackupDownloadInterval === 'disabled') {
      setDriveSyncState('idle');
      return;
    }

    setDriveSyncState('syncing');

    // Debounce to group consecutive rapid changes (like typing notes or continuous status changes)
    const timer = setTimeout(async () => {
      try {
        const backupTimeFormatted = await uploadBackupToGoogleDrive(
          token,
          preferences,
          students,
          appointments
        );
        // Save the friendly timestamp
        localStorage.setItem('teacher_drive_last_backup', backupTimeFormatted);
        setDriveSyncState('synced');
        console.log(`[Google Drive Sync] Changes automatically backed up to Google Drive at ${backupTimeFormatted}`);
      } catch (err) {
        console.warn('[Google Drive Sync] Live auto-sync failed or skipped:', err);
        setDriveSyncState('error');
      }
    }, 4500); // 4.5 seconds of quiet time triggers the background Google Drive override

    return () => clearTimeout(timer);
  }, [
    currentUserId,
    isCloudPullCompleted,
    students,
    appointments,
    preferences.teacherName,
    preferences.subject,
    preferences.currency,
    preferences.passcode,
    preferences.primaryColor,
    preferences.autoBackupDownloadInterval
  ]);

  const handleManualDriveSync = async () => {
    const token = getAccessToken();
    if (!token) {
      alert("الرجاء ربط حساب Google Drive أولاً من صفحة الإعدادات لتفعيل المزامنة سحابياً! ☁️");
      return;
    }
    try {
      setDriveSyncState('syncing');
      const backupTimeFormatted = await uploadBackupToGoogleDrive(
        token,
        preferences,
        students,
        appointments
      );
      localStorage.setItem('teacher_drive_last_backup', backupTimeFormatted);
      setDriveSyncState('synced');
    } catch (err) {
      console.error('[Google Drive Sync] Manual sync failed:', err);
      setDriveSyncState('error');
    }
  };

  // Save wrappers
  const savePreferences = (updatedPrefs: Partial<TeacherPreferences>) => {
    const next = { ...preferences, ...updatedPrefs };
    setPreferences(next);
    localStorage.setItem('teacherPreferences', JSON.stringify(next));
  };

  const saveStudents = (newStudents: Student[]) => {
    const synced = newStudents.map(s => syncStudentBadges(s).updatedStudent);
    setStudents(synced);
    localStorage.setItem('teacherStudents', JSON.stringify(synced));
  };

  const saveAppointments = (newAppointments: Appointment[]) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const pruned = newAppointments.filter(app => {
      if (app.isExceptional && app.date && app.date < todayStr) {
        return false;
      }
      return true;
    });
    setAppointments(pruned);
    localStorage.setItem('teacherAppointments', JSON.stringify(pruned));
  };


  // Student CRUD actions
  const handleAddStudent = (studentData: Omit<Student, 'id' | 'createdAt' | 'sessions' | 'payments'>) => {
    const nextStudent: Student = {
      ...studentData,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString().split('T')[0],
      sessions: [],
      payments: [],
    };
    saveStudents([nextStudent, ...students]);
  };

  const handleUpdateStudent = (id: string, updatedFields: Partial<Student>) => {
    const targetStudent = students.find(s => s.id === id);
    if (targetStudent) {
      // Load teacher notification settings to respect permissions
      const storedSettings = localStorage.getItem('teacherNotificationSettings');
      let notifSettings = {
        notifyTeacherOnSessionComplete: true,
        notifyTeacherOnNewPayment: true,
      };
      if (storedSettings) {
        try {
          notifSettings = { ...notifSettings, ...JSON.parse(storedSettings) };
        } catch (e) {}
      }

      // Check for completed session
      if (
        notifSettings.notifyTeacherOnSessionComplete !== false &&
        updatedFields.sessions &&
        updatedFields.sessions.length > targetStudent.sessions.length
      ) {
        const addedSession = updatedFields.sessions.find(s => !targetStudent.sessions.some(oldS => oldS.id === s.id))
                           || updatedFields.sessions[0];
        if (addedSession) {
          const alertId = `t-sess-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const newAlert = {
            id: alertId,
            type: 'teacher-session',
            studentId: targetStudent.id,
            studentName: targetStudent.name,
            title: '🧑‍🏫 تم إنجاز حصة حضور للطالب',
            message: `أتم الطالب "${targetStudent.name}" الحصة بنجاح في تاريخ ${addedSession.date} الساعة ${addedSession.time}.${addedSession.notes ? ` ملاحظات: ${addedSession.notes}` : ''}`,
            date: new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }),
            read: false,
          };
          const storedAlerts = localStorage.getItem('teacherActionAlerts');
          let list = [];
          if (storedAlerts) {
            try { list = JSON.parse(storedAlerts); } catch(e){}
          }
          list = [newAlert, ...list].slice(0, 50);
          localStorage.setItem('teacherActionAlerts', JSON.stringify(list));
          window.dispatchEvent(new Event('teacherAlertsUpdated'));
        }
      }

      // Check for new payment
      if (
        notifSettings.notifyTeacherOnNewPayment !== false &&
        updatedFields.payments &&
        updatedFields.payments.length > targetStudent.payments.length
      ) {
        const addedPayment = updatedFields.payments.find(p => !targetStudent.payments.some(oldP => oldP.id === p.id))
                           || updatedFields.payments[0];
        if (addedPayment) {
          const alertId = `t-paym-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const newAlert = {
            id: alertId,
            type: 'teacher-payment',
            studentId: targetStudent.id,
            studentName: targetStudent.name,
            title: '💰 تم تسجيل دفعة مالية جديدة',
            message: `تم قيد استلام دفعة نقدية جديدة من الطالب "${targetStudent.name}" بقيمة ${addedPayment.amount} ${preferences.currency || 'ج.م'} بتاريخ ${addedPayment.date}.${addedPayment.notes ? ` ملاحظات: ${addedPayment.notes}` : ''}`,
            date: new Date().toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }),
            read: false,
          };
          const storedAlerts = localStorage.getItem('teacherActionAlerts');
          let list = [];
          if (storedAlerts) {
            try { list = JSON.parse(storedAlerts); } catch(e){}
          }
          list = [newAlert, ...list].slice(0, 50);
          localStorage.setItem('teacherActionAlerts', JSON.stringify(list));
          window.dispatchEvent(new Event('teacherAlertsUpdated'));
        }
      }

      // Automatically sync newly registered payments to the budget ledger and balance
      if (updatedFields.payments && updatedFields.payments.length > targetStudent.payments.length) {
        const targetIds = new Set(targetStudent.payments.map(p => p.id));
        const newPayments = updatedFields.payments.filter(p => !targetIds.has(p.id));

        if (newPayments.length > 0) {
          const savedBalance = localStorage.getItem('financial_budget_balance');
          const savedLedger = localStorage.getItem('financial_budget_ledger_v1');

          let currentBalance = savedBalance ? Number(savedBalance) : 1000;
          let currentLedger: any[] = [];
          
          if (savedLedger) {
            try {
              currentLedger = JSON.parse(savedLedger);
            } catch (e) {
              console.error('Failed to parse budget ledger', e);
            }
          }

          newPayments.forEach(payment => {
            currentBalance += payment.amount;
            const newEntry = {
              id: `pay_sync_${payment.id || Date.now() + '_' + Math.random().toString(36).substring(2, 6)}`,
              amount: payment.amount,
              date: payment.date || new Date().toISOString().split('T')[0],
              note: `دفعة مستلمة من الطالب: ${targetStudent.name}${payment.notes ? ` (${payment.notes})` : ''}`,
              category: 'إيراد من طالب'
            };
            currentLedger = [newEntry, ...currentLedger];
          });

          localStorage.setItem('financial_budget_balance', String(currentBalance));
          localStorage.setItem('financial_budget_ledger_v1', JSON.stringify(currentLedger));
          
          // Dispatch custom event to let financial components know the budget has updated
          window.dispatchEvent(new Event('financialBudgetUpdated'));
        }
      }
    }

    const modified = students.map(student => {
      if (student.id === id) {
        // Automatically sync appointment names if student name changes
        if (updatedFields.name && updatedFields.name !== student.name) {
          const modApps = appointments.map(app => 
            app.studentId === id ? { ...app, studentName: updatedFields.name! } : app
          );
          saveAppointments(modApps);
        }
        return { ...student, ...updatedFields };
      }
      return student;
    });
    saveStudents(modified);
  };

  const handleDeleteStudent = (id: string) => {
    // Delete student
    const modified = students.filter(s => s.id !== id);
    saveStudents(modified);

    // Clean obsolete appointments associated with student
    const refinedAppointments = appointments.filter(app => app.studentId !== id);
    saveAppointments(refinedAppointments);

    // If active details was open, close it
    if (selectedStudentId === id) {
      setSelectedStudentId(null);
    }
  };

  // Appointment Actions
  const handleAddAppointment = (appointmentData: Omit<Appointment, 'id'>) => {
    const nextApp: Appointment = {
      ...appointmentData,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
    };
    saveAppointments([...appointments, nextApp]);
  };

  const handleDeleteAppointment = (id: string) => {
    const nextApps = appointments.filter(app => app.id !== id);
    saveAppointments(nextApps);
  };

  const handleUpdateAppointmentDay = (id: string, newDay: string) => {
    const nextApps = appointments.map(app => 
      app.id === id ? { ...app, dayOfWeek: newDay } : app
    );
    saveAppointments(nextApps);
  };

  const handleUpdateAppointment = (id: string, updatedFields: Partial<Appointment>) => {
    const nextApps = appointments.map(app => 
      app.id === id ? { ...app, ...updatedFields } : app
    );
    saveAppointments(nextApps);
  };

  // Exam Appointment handlers
  const handleAddExamAppointment = (examData: Omit<ExamAppointment, 'id'>) => {
    const nextExam: ExamAppointment = {
      ...examData,
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
    };
    const updatedExams = [...examAppointments, nextExam];
    setExamAppointments(updatedExams);
    localStorage.setItem('teacherExamAppointments', JSON.stringify(updatedExams));

    const DAYS_AR_MAP: Record<number, string> = {
      0: 'الأحد',
      1: 'الإثنين',
      2: 'الثلاثاء',
      3: 'الأربعاء',
      4: 'الخميس',
      5: 'الجمعة',
      6: 'السبت'
    };
    const getArabicDayFromDateStr = (dateStr: string): string => {
      if (!dateStr) return 'السبت';
      const dObj = new Date(`${dateStr}T12:00:00`);
      const dayIndex = dObj.getDay();
      return DAYS_AR_MAP[dayIndex] || 'السبت';
    };

    const nextExamApp: Appointment = {
      id: `exam-${nextExam.id}`,
      studentId: examData.studentId,
      studentName: examData.studentName,
      dayOfWeek: getArabicDayFromDateStr(examData.date),
      time: examData.time,
      notes: `📝 امتحان: ${examData.subject || 'عام'} ${examData.notes ? `• ${examData.notes}` : ''}`,
      color: '#f97316',
      isExceptional: true,
      date: examData.date,
    };

    const updatedApps = [...appointments, nextExamApp];
    saveAppointments(updatedApps);
  };

  const handleDeleteExamAppointment = (id: string) => {
    const updatedExams = examAppointments.filter(app => app.id !== id);
    setExamAppointments(updatedExams);
    localStorage.setItem('teacherExamAppointments', JSON.stringify(updatedExams));

    const updatedApps = appointments.filter(app => app.id !== `exam-${id}`);
    saveAppointments(updatedApps);
  };

  // Global Settings import / export
  const handleImportSystemBackup = (importedData: { students: Student[]; appointments: Appointment[]; preferences: TeacherPreferences }) => {
    saveStudents(importedData.students);
    saveAppointments(importedData.appointments);
    savePreferences(importedData.preferences);
  };

  const handleClearAllSystemData = async () => {
    // 1. Clear State variables immediately
    const resetPrefs: TeacherPreferences = {
      teacherName: 'الأستاذ الفاضل',
      subject: '',
      currency: 'ج.م',
      passcode: '', // Guided setup reset
      primaryColor: 'blue',
      enableWhatsApp24hReminders: true,
      autoBackupDownloadInterval: 'disabled',
    };

    saveStudents([]);
    saveAppointments([]);
    setExamAppointments([]);
    localStorage.setItem('teacherExamAppointments', JSON.stringify([]));
    savePreferences(resetPrefs);

    // 2. Clear ALL local storage keys completely and securely
    localStorage.removeItem('loggedStudent');
    localStorage.removeItem('teacher_offline_mode');
    localStorage.removeItem('teacher_drive_last_backup');
    localStorage.removeItem('teacherNotificationSettings');
    localStorage.removeItem('teacherActionAlerts');

    // 3. Clear cloud database storage along with local storage if logged in
    if (currentUserId && currentUserId !== "offline_local") {
      try {
        setSyncState('syncing');
        await saveWorkspaceToCloud(currentUserId, {
          teacherName: resetPrefs.teacherName,
          subject: resetPrefs.subject,
          currency: resetPrefs.currency,
          passcode: resetPrefs.passcode,
          primaryColor: resetPrefs.primaryColor,
          enableWhatsApp24hReminders: resetPrefs.enableWhatsApp24hReminders,
          autoBackupDownloadInterval: resetPrefs.autoBackupDownloadInterval,
          students: [],
          appointments: [],
          examAppointments: [],
        });
        setSyncState('synced');
        setSyncError(null);
        console.log("[Cloud Factory Reset] Cloud storage updated with clean, initialized data alongside local storage.");
      } catch (err: any) {
        console.error("Failed to clear cloud database storage during reset:", err);
        setSyncState('error');
        setSyncError("لم نتمكن من مسح السحابة بالكامل: " + (err?.message || String(err)));
      }
    }
  };

  // If a student is logged in, direct them to their portal bypassing the teacher's gatekeeper
  if (studentUser) {
    const activeStudentObj = students.find(s => s.id === studentUser.id) || studentUser;
    return (
      <>
        <ThemeStyleInjector primaryColor={preferences.primaryColor} />
        <StudentPortal
          student={activeStudentObj}
          allAppointments={appointments}
          allExamAppointments={examAppointments}
          preferences={preferences}
          onLogout={() => {
            setStudentUser(null);
            setIsLocked(true);
          }}
          onUpdateStudent={handleUpdateStudent}
        />
      </>
    );
  }

  // Locked check for teacher
  if (isLocked) {
    return (
      <>
        <ThemeStyleInjector primaryColor={preferences.primaryColor} />
        <LockScreen
          storedPasscode={preferences.passcode}
          students={students}
          onStudentLogin={(stu) => {
            setStudentUser(stu);
            setIsLocked(false);
          }}
          onUnlock={() => setIsLocked(false)}
          onLogin={(account) => {
            savePreferences({ 
              teacherName: account.fullName,
              subject: account.subject,
              primaryColor: account.primaryColor || preferences.primaryColor
            });
            setIsLocked(false);
          }}
        />
      </>
    );
  }

  const selectedStudentObj = selectedStudentId 
    ? students.find(s => s.id === selectedStudentId) 
    : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col font-sans transition-all duration-300 relative select-none overflow-x-hidden w-full max-w-full">
      <ThemeStyleInjector primaryColor={preferences.primaryColor} />

      {/* Main Top Header Navigation */}
      <header className="sticky top-0 z-45 bg-white/90 backdrop-blur-md border-b border-slate-200/90 px-4 md:px-8 py-3 flex items-center justify-between shadow-xs print:hidden select-none">
        <div className="flex items-center gap-2.5 font-sans shrink-0">
          {/* Mobile menu toggle button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-700 hover:bg-slate-100 border border-slate-200/40 rounded-xl transition-all cursor-pointer shrink-0 active:scale-95 flex items-center justify-center"
            title="القائمة"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Logo Card */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform shrink-0">
              <GraduationCap size={22} className="text-white" />
            </div>
            <div className="leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg md:text-xl font-black tracking-tight text-slate-900">Teacher</span>
                <span className="text-[9px] sm:text-[10px] bg-blue-550/10 text-blue-700 border border-blue-550/15 font-black px-1.5 py-0.5 rounded-lg leading-none">برو 🔥</span>
              </div>
              <p className="text-[9px] sm:text-[11px] text-slate-500 font-bold mt-1">منصة لإدارة الحصص الدراسية</p>
            </div>
          </div>
        </div>

        {/* Quick Lock Out options */}
        <div className="flex items-center gap-2.5">
          {selectedStudentObj && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 text-amber-600 border border-amber-500/15 px-2.5 py-1 rounded-xl text-[10px] font-bold">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
              </span>
              <span className="hidden sm:inline">أنت الآن في ملف تلميذ:</span>
              <span className="font-extrabold">{selectedStudentObj.name}</span>
            </div>
          )}

          {/* Notification Center Hub */}
          <NotificationCenter
            students={students}
            appointments={appointments}
            currency={preferences.currency}
            preferences={preferences}
          />

          {/* Cloud Sign Out Button */}
          {currentUserId && (
            <button
              onClick={async () => {
                try {
                  setSyncState('syncing');
                  await logout();
                  setCurrentUserId(null);
                  setIsLocked(true);
                } catch (e) {
                  console.error(e);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-650 hover:text-red-750 border border-red-200 hover:border-red-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-3xs active:scale-95 shrink-0"
              title="تسجيل الخروج السحابي"
            >
              <LogOut size={13} className="text-red-550 rotate-180" />
              <span className="hidden sm:inline">خروج سحابي</span>
            </button>
          )}

          {preferences.passcode && (
            <button
              onClick={() => setIsLocked(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs active:scale-95 shrink-0"
              title="قفل الشاشة السريع"
            >
              <Lock size={13} className="text-slate-450" />
              <span className="hidden sm:inline">قفل سريع</span>
            </button>
          )}

          <div className="md:hidden flex items-center gap-1 text-[9px] font-bold px-2 py-1 bg-emerald-50 border border-emerald-150 text-emerald-700 rounded-lg shrink-0">
            <span>مؤمنة</span>
          </div>
        </div>
      </header>

      {/* Navigation Ribbon / Bar with Icons for Departments */}
      <nav className="bg-white/95 backdrop-blur-md text-slate-700 border-b border-slate-200/95 sticky top-[57px] z-40 print:hidden shadow-2xs select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-8 py-2 md:py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none w-full md:w-auto">
            <button
              onClick={() => {
                setActiveTab('dashboard');
                setSelectedStudentId(null);
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'dashboard' && !selectedStudentId
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <LayoutGrid size={15} />
              <span>لوحة التحكم</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('students');
                setSelectedStudentId(null);
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'students' && !selectedStudentId
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Users size={15} />
              <span>الطلاب</span>
              <span className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                activeTab === 'students' && !selectedStudentId ? 'bg-white/20 text-white font-black' : 'bg-slate-100 text-slate-500 font-bold'
              }`}>
                {students.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('schedule');
                setSelectedStudentId(null);
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'schedule'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <CalendarDays size={15} />
              <span>المواعيد</span>
              <span className={`text-[9px] sm:text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                activeTab === 'schedule' ? 'bg-white/20 text-white font-black' : 'bg-slate-100 text-slate-500 font-bold'
              }`}>
                {appointments.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('financials');
                setSelectedStudentId(null);
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'financials'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <BarChart3 size={15} />
              <span>المالية</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('chat');
                setSelectedStudentId(null);
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'chat'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <MessageSquare size={15} />
              <span>المحادثات المباشرة</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </button>

            <button
              onClick={() => {
                setActiveTab('rewards');
                setSelectedStudentId(null);
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'rewards'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Award size={15} />
              <span>لوحة الأوسمة 🏆</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('teacher');
                setSelectedStudentId(null);
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'teacher'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <GraduationCap size={15} />
              <span>ملف المعلم 🧑‍🏫</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('settings');
                setSelectedStudentId(null);
              }}
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer shrink-0 ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/15'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
              }`}
            >
              <Settings size={15} />
              <span>الإعدادات</span>
            </button>


          </div>
        </div>
      </nav>

      {/* Mobile Dropdown Menu Drawer List */}
      {mobileMenuOpen && (
        <div className="absolute top-[69px] left-0 right-0 bg-[#0b0f19] border-b border-slate-850 shadow-2xl z-40 md:hidden flex flex-col p-4.5 space-y-2.5 font-sans animate-in fade-in duration-200 select-none">
          <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider mb-2 pr-1 text-right">بوابات النظام</p>
          <button
            onClick={() => {
              setActiveTab('dashboard');
              setSelectedStudentId(null);
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'dashboard' && !selectedStudentId
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <LayoutGrid size={16} className={`${activeTab === 'dashboard' && !selectedStudentId ? 'text-white' : 'text-slate-550'}`} />
              <span>لوحة التحكم</span>
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('students');
              setSelectedStudentId(null);
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'students' && !selectedStudentId
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Users size={16} className={`${activeTab === 'students' && !selectedStudentId ? 'text-white' : 'text-slate-550'}`} />
              <span>الطلاب</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-900/80 border border-slate-800 text-slate-400 rounded-md font-bold">
              {students.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('schedule');
              setSelectedStudentId(null);
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <CalendarDays size={16} className={`${activeTab === 'schedule' ? 'text-white' : 'text-slate-550'}`} />
              <span>المواعيد</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-900/80 border border-slate-800 text-slate-400 rounded-md font-bold">
              {appointments.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('financials');
              setSelectedStudentId(null);
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'financials'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <BarChart3 size={16} className={`${activeTab === 'financials' ? 'text-white' : 'text-slate-550'}`} />
              <span>المالية</span>
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('chat');
              setSelectedStudentId(null);
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <MessageSquare size={16} className={`${activeTab === 'chat' ? 'text-white' : 'text-slate-550'}`} />
              <span>المحادثات المباشرة</span>
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>

          <button
            onClick={() => {
              setActiveTab('rewards');
              setSelectedStudentId(null);
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'rewards'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Award size={16} className={`${activeTab === 'rewards' ? 'text-white' : 'text-slate-550'}`} />
              <span>لوحة الأوسمة والجوائز 🏆</span>
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('teacher');
              setSelectedStudentId(null);
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'teacher'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <GraduationCap size={16} className={`${activeTab === 'teacher' ? 'text-white' : 'text-slate-550'}`} />
              <span>ملف المعلم 🧑‍🏫</span>
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab('settings');
              setSelectedStudentId(null);
              setMobileMenuOpen(false);
            }}
            className={`w-full text-right flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <Settings size={16} className={`${activeTab === 'settings' ? 'text-white' : 'text-slate-550'}`} />
              <span>الإعدادات</span>
            </span>
          </button>

          <div className="pt-4 border-t border-slate-800 mt-2 flex items-center justify-between text-right text-slate-500 text-[10px] font-semibold">
            <span>برنامج Teacher الذكي</span>
            <span className="text-indigo-400 font-bold">Mohamed Abdella</span>
          </div>
        </div>
      )}



      {/* Main Core Frame Layout */}
      <div className="flex-1 flex flex-col">
        {/* Content View Workspace Panel */}
        <main className="flex-1 p-4 md:p-8 overflow-x-hidden w-full max-w-7xl mx-auto z-10">
          <AnimatePresence mode="wait">
            {selectedStudentObj ? (
              <motion.div
                key="student-details-panel"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
              >
                <StudentDetails
                  student={selectedStudentObj}
                  currency={preferences.currency}
                  onBack={() => setSelectedStudentId(null)}
                  onUpdateStudent={handleUpdateStudent}
                  onDeleteStudent={handleDeleteStudent}
                  appointments={appointments}
                  preferences={preferences}
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              >
                {activeTab === 'dashboard' && (
                  <Dashboard
                    students={students}
                    appointments={appointments}
                    preferences={preferences}
                    onSelectStudent={(id) => setSelectedStudentId(id)}
                    onNavigateToTab={(tab) => {
                      setActiveTab(tab);
                      setSelectedStudentId(null);
                    }}
                  />
                )}

                {activeTab === 'students' && (
                  <div className="space-y-6">
                    <StudentList
                      students={students}
                      currency={preferences.currency}
                      onSelectStudent={(id) => setSelectedStudentId(id)}
                      onAddStudent={handleAddStudent}
                      onDeleteStudent={handleDeleteStudent}
                      onUpdateStudent={handleUpdateStudent}
                      subject={preferences.subject}
                      appointments={appointments}
                    />
                  </div>
                )}

                {activeTab === 'schedule' && (
                  <Scheduler
                    students={students}
                    appointments={appointments}
                    examAppointments={examAppointments}
                    onAddAppointment={handleAddAppointment}
                    onDeleteAppointment={handleDeleteAppointment}
                    onAddExamAppointment={handleAddExamAppointment}
                    onDeleteExamAppointment={handleDeleteExamAppointment}
                    onUpdateAppointmentDay={handleUpdateAppointmentDay}
                    onUpdateAppointment={handleUpdateAppointment}
                    onUpdateStudent={handleUpdateStudent}
                    onSelectStudent={(id) => setSelectedStudentId(id)}
                    preferences={preferences}
                  />
                )}

                {activeTab === 'financials' && (
                  <FinancialReports
                    students={students}
                    currency={preferences.currency}
                    onUpdateStudent={handleUpdateStudent}
                  />
                )}

                {activeTab === 'teacher' && (
                  <TeacherProfileTab
                    preferences={preferences}
                    students={students}
                    appointments={appointments}
                  />
                )}

                {activeTab === 'settings' && (
                  <SettingsPanel
                    preferences={preferences}
                    students={students}
                    appointments={appointments}
                    onUpdatePreferences={savePreferences}
                    onImportBackup={handleImportSystemBackup}
                    onClearAllData={handleClearAllSystemData}
                  />
                )}

                {activeTab === 'chat' && (
                  <TeacherChatHub
                    students={students}
                    preferences={preferences}
                  />
                )}

                {activeTab === 'rewards' && (
                  <RewardsDashboard
                    students={students}
                    preferences={preferences}
                    onUpdateStudent={handleUpdateStudent}
                    onSelectStudent={(id) => setSelectedStudentId(id)}
                    onSwitchTab={(tab) => {
                      setActiveTab(tab);
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="bg-slate-50 border-t border-slate-200/80 py-8 text-center text-slate-400 text-xs font-bold print:hidden z-10 w-full mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col items-center justify-center gap-2.5 select-none font-sans">
            <p className="text-slate-800 font-extrabold text-xs">تم تصميم البرنامج بواسطة</p>
            <p className="text-indigo-600 font-black text-sm">Mohamed Abdella ( Abo Selim )</p>
            <p className="text-[11px] text-slate-450 font-extrabold">{new Date().getFullYear()} • نسخة البرنامج v{(import.meta as any).env?.VITE_APP_VERSION || '1.3'}</p>
          </div>
        </footer>
      </div>

      {/* Cloud Diagnostic and Error Information Modal */}
      <AnimatePresence>
        {showSyncErrorModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSyncErrorModal(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            
            {/* Modal box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 md:p-8 w-full max-w-lg text-right overflow-hidden font-sans z-10"
              dir="rtl"
            >
              {/* Decorative background gradient */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" />
              
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={`p-3 rounded-2xl ${syncState === 'synced' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-650'}`}>
                  <Cloud size={24} className={syncState === 'syncing' ? 'animate-bounce' : ''} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">تشخيص المزامنة السحابية ☁️</h3>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">تفاصيل حالة اتصال وحفظ بيانات منصة Teacher</p>
                </div>
              </div>

              {/* Body - Case 1: Synced (Success) */}
              {(syncState === 'synced' || syncState === 'syncing') && (
                <div className="space-y-4">
                  {preferences.autoBackupDownloadInterval === 'disabled' ? (
                    <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-2xl flex items-start gap-3">
                      <span className="text-xl shrink-0">📴</span>
                      <div className="text-xs text-amber-800 leading-relaxed font-bold">
                        تم إيقاف المزامنة والنسخ التلقائي بناءً على اختيارك. بياناتك تُحفظ حالياً في ذاكرة هاتفك/متصفحك فقط. للنسخ المتطابق مع السحابة، يرجى إجراء مزامنة يدوية بالضغط على الزر أدناه.
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/5 border border-emerald-500/15 p-4 rounded-2xl flex items-start gap-3">
                      <span className="text-xl shrink-0">✅</span>
                      <div className="text-xs text-emerald-800 leading-relaxed font-bold">
                        تم مزامنة بيانات الطلاب والحصص والإعدادات مع السحابة الفيدرالية بنجاح تام وبشكل آمن! جميع بياناتك محدثة ولا توجد أي مشاكل مفقودة.
                      </div>
                    </div>
                  )}
                  
                  <div className="text-xs text-slate-500 space-y-2 font-semibold">
                    <p className="font-extrabold text-slate-700">📌 معلومات نظام الاتصال السحابي:</p>
                    <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 font-mono text-[11px] text-slate-650">
                      <div>• معرّف المستخدم الموثق: {currentUserId}</div>
                      <div>• حالة اتصال الشبكة: متصل (قاعدة بيانات Firestore)</div>
                      <div>• المزامنة التلقائية: {preferences.autoBackupDownloadInterval === 'disabled' ? 'معطلة ❌' : 'مفعلة تلقائيًا 🟢'}</div>
                      <div>• حالة التزامن الحالي: {preferences.autoBackupDownloadInterval === 'disabled' ? 'محلي (اضغط زر المزامنة للحفظ يدويًا)' : 'مستمر وتلقائي'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Body - Case 3: Error */}
              {syncState === 'error' && (
                <div className="space-y-4">
                  <div className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-2xl flex items-start gap-3 text-right">
                    <span className="text-xl shrink-0">⚠️</span>
                    <div className="text-xs text-rose-800 leading-relaxed font-extrabold">
                      تم تعليق المزامنة التلقائية. البيانات محفوظة مؤقتاً ومحلياً للعمل بمثالية بدون خسارة، لكن لم نتمكن من الحفظ سحابياً للمبررات الفنية بالأسفل.
                    </div>
                  </div>

                  {/* Diagnostic technical error */}
                  <div className="space-y-1.5 text-right">
                    <span className="text-[11px] font-bold text-slate-500 block">تفاصيل الخطأ التقني المسترجع (الغلط):</span>
                    <div className="bg-slate-950 text-rose-400 p-3.5 rounded-xl font-mono text-[11px] leading-relaxed break-all overflow-x-auto max-h-36 border border-slate-800 text-left" dir="ltr">
                      {syncError || 'Error: Permission Denied or Firestore Database not provisioned.'}
                    </div>
                  </div>

                  {/* Common solutions list */}
                  <div className="space-y-2 text-xs text-slate-650 leading-relaxed font-semibold">
                    <p className="font-extrabold text-slate-800">🛠️ خطوات سريعة لتجاوز هذا الخلل:</p>
                    <ul className="list-disc list-inside mr-3 space-y-1 text-slate-600 text-[11px]">
                      <li>تأكد من إنشاء وتفعيل قاعدة بيانات Firestore بنجاح على مشروع Firebase الخاص بك.</li>
                      <li>تأكد من وجود وتطبيق قواعد الحماية الصحيحة للـ Database (Security Rules) لتفادي منع الوصول.</li>
                      <li>تأكد من ثبات شبكة ومصادر الإنترنت في متصفحك أو هاتفك.</li>
                      <li>حاول إعادة محاولة التسجيل لجلسة الدخول لتأكيد الهوية.</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Actions footer */}
              <div className="flex gap-2.5 mt-6 pt-4 border-t border-slate-100">
                {(syncState === 'error' || preferences.autoBackupDownloadInterval === 'disabled') && (
                  <button
                    onClick={async () => {
                      await triggerManualCloudSync();
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold py-2.5 px-4 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/15"
                  >
                    {syncState === 'syncing' ? 'جاري التحديث... ⏳' : 'مزامنة يدوية الآن 🔄'}
                  </button>
                )}
                <button
                  onClick={() => setShowSyncErrorModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold py-2.5 px-4 rounded-xl transition-all"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
