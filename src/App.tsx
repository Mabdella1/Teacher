import { useState, useEffect } from 'react';
import { Student, Appointment, TeacherPreferences } from './types';
import LockScreen from './components/LockScreen';
import StudentList from './components/StudentList';
import StudentDetails from './components/StudentDetails';
import Scheduler from './components/Scheduler';
import FinancialReports from './components/FinancialReports';
import SettingsPanel from './components/SettingsPanel';
import NotificationCenter from './components/NotificationCenter';
import ThemeStyleInjector from './components/ThemeStyleInjector';
import Dashboard from './components/Dashboard';
import { 
  Users, CalendarDays, BarChart3, Settings, LogOut, Lock, Award, 
  Menu, X, Sparkles, GraduationCap, ChevronDown, User, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Default initial state
const DEFAULT_PREFERENCES: TeacherPreferences = {
  teacherName: 'الأستاذ الفاضل',
  subject: '',
  currency: 'ج.م',
  passcode: '', // Guided setup on first load
  enableWhatsApp24hReminders: true,
  autoBackupDownloadInterval: 'disabled',
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
  
  // App view control
  const [activeTab, setActiveTab] = useState<'dashboard' | 'students' | 'schedule' | 'financials' | 'settings'>('dashboard');
  const [navDropdownOpen, setNavDropdownOpen] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initial load
  useEffect(() => {
    // Load Teacher Options Preferences
    const storedPrefs = localStorage.getItem('teacherPreferences');
    let loadedPrefs = DEFAULT_PREFERENCES;
    if (storedPrefs) {
      try {
        loadedPrefs = JSON.parse(storedPrefs);
        // Force-disable auto backup download if it's currently set to 'weekly' (previous default)
        if (loadedPrefs.autoBackupDownloadInterval === 'weekly') {
          loadedPrefs.autoBackupDownloadInterval = 'disabled';
          localStorage.setItem('teacherPreferences', JSON.stringify(loadedPrefs));
        }
        setPreferences(loadedPrefs);
      } catch (e) {}
    } else {
      localStorage.setItem('teacherPreferences', JSON.stringify(DEFAULT_PREFERENCES));
    }

    // Load Students database
    const storedStudents = localStorage.getItem('teacherStudents');
    let loadedStudents = DEFAULT_STUDENTS;
    if (storedStudents) {
      try {
        loadedStudents = JSON.parse(storedStudents);
        setStudents(loadedStudents);
      } catch (e) {}
    } else {
      setStudents(DEFAULT_STUDENTS);
      localStorage.setItem('teacherStudents', JSON.stringify(DEFAULT_STUDENTS));
    }

    // Load Appointments database
    const storedAppointments = localStorage.getItem('teacherAppointments');
    let loadedAppointments = DEFAULT_APPOINTMENTS;
    if (storedAppointments) {
      try {
        loadedAppointments = JSON.parse(storedAppointments);
        setAppointments(loadedAppointments);
      } catch (e) {}
    } else {
      setAppointments(DEFAULT_APPOINTMENTS);
      localStorage.setItem('teacherAppointments', JSON.stringify(DEFAULT_APPOINTMENTS));
    }

    // Daily Auto-save backup logic
    const today = new Date().toISOString().split('T')[0];
    const lastAutoSaveDate = localStorage.getItem('teacherLastAutoSaveDate');
    if (lastAutoSaveDate !== today) {
      const backupData = {
        students: loadedStudents,
        appointments: loadedAppointments,
        preferences: loadedPrefs,
        savedAt: new Date().toISOString(),
      };
      
      localStorage.setItem(`teacher_autosave_${today}`, JSON.stringify(backupData));
      
      const existingBackupsJson = localStorage.getItem('teacherAutoBackupsList') || '[]';
      let list = [];
      try {
        list = JSON.parse(existingBackupsJson);
      } catch(e) {}
      
      if (!list.includes(today)) {
        list.push(today);
        // Keep the last 10 days of backups to avoid over-bloating
        while (list.length > 10) {
          const removedDate = list.shift();
          localStorage.removeItem(`teacher_autosave_${removedDate}`);
        }
        localStorage.setItem('teacherAutoBackupsList', JSON.stringify(list));
      }
      
      localStorage.setItem('teacherLastAutoSaveDate', today);
      console.log(`Auto-saved backup completed for today: ${today}`);
    }

    // Browser JSON Auto-download backup logic (periodic)
    const interval = loadedPrefs.autoBackupDownloadInterval || 'disabled';
    if (interval !== 'disabled') {
      let shouldDownload = false;
      const lastDownloadDateStr = loadedPrefs.lastAutoBackupDownloadDate;
      
      if (!lastDownloadDateStr) {
        shouldDownload = true;
      } else {
        const lastDate = new Date(lastDownloadDateStr);
        const currentDate = new Date(today);
        const diffTime = Math.abs(currentDate.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (interval === 'daily' && diffDays >= 1) {
          shouldDownload = true;
        } else if (interval === 'weekly' && diffDays >= 7) {
          shouldDownload = true;
        } else if (interval === 'monthly' && diffDays >= 30) {
          shouldDownload = true;
        }
      }

      if (shouldDownload) {
        setTimeout(() => {
          try {
            const backupData = {
              version: '1.0.0',
              exportedAt: new Date().toISOString(),
              preferences: {
                ...loadedPrefs,
                lastAutoBackupDownloadDate: today,
              },
              students: loadedStudents,
              appointments: loadedAppointments,
            };

            const str = JSON.stringify(backupData, null, 2);
            const blob = new Blob([str], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `نسخة_تلقائية_TEACHER_${today}.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Update preferences
            const updatedPrefs = {
              ...loadedPrefs,
              lastAutoBackupDownloadDate: today,
            };
            setPreferences(updatedPrefs);
            localStorage.setItem('teacherPreferences', JSON.stringify(updatedPrefs));
            console.log(`Auto backup JSON download completed for today: ${today}`);
          } catch (err) {
            console.error('Failed to trigger automatic backup JSON download', err);
          }
        }, 1500); // Small timeout to ensure optimal rendering
      }
    }
  }, []);

  // Sync is locked check
  useEffect(() => {
    // If no lock setup yet (passcode as empty string), bypass locked screen immediately to establish set passcode!
    if (preferences.passcode === '') {
      setIsLocked(false);
    } else {
      setIsLocked(true);
    }
  }, [preferences.passcode]);

  // Save utility wrappers
  const savePreferences = (updatedPrefs: Partial<TeacherPreferences>) => {
    const next = { ...preferences, ...updatedPrefs };
    setPreferences(next);
    localStorage.setItem('teacherPreferences', JSON.stringify(next));
  };

  const saveStudents = (newStudents: Student[]) => {
    setStudents(newStudents);
    localStorage.setItem('teacherStudents', JSON.stringify(newStudents));
  };

  const saveAppointments = (newAppointments: Appointment[]) => {
    setAppointments(newAppointments);
    localStorage.setItem('teacherAppointments', JSON.stringify(newAppointments));
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

  // Global Settings import / export
  const handleImportSystemBackup = (importedData: { students: Student[]; appointments: Appointment[]; preferences: TeacherPreferences }) => {
    saveStudents(importedData.students);
    saveAppointments(importedData.appointments);
    savePreferences(importedData.preferences);
  };

  const handleClearAllSystemData = () => {
    saveStudents([]);
    saveAppointments([]);
    savePreferences({
      teacherName: 'الأستاذ الفاضل',
      subject: '',
      currency: 'ج.م',
      passcode: '', // Guided setup reset
    });
  };

  // Locked check
  if (isLocked && preferences.passcode !== '') {
    return (
      <>
        <ThemeStyleInjector primaryColor={preferences.primaryColor} />
        <LockScreen
          storedPasscode={preferences.passcode}
          onUnlock={() => setIsLocked(false)}
          onSetPasscode={(code) => {
            savePreferences({ passcode: code });
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
    <div className="min-h-screen bg-[#f8fafc] text-[#0f172a] flex flex-col font-sans transition-all duration-300 relative select-none">
      <ThemeStyleInjector primaryColor={preferences.primaryColor} />
      {/* Background Ambience quiet subtle top light-blue flare */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-indigo-500/10 via-blue-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[500px] h-[500px] bg-gradient-to-tr from-sky-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Main Top Header Navigation */}
      <header className="sticky top-0 z-45 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-3 md:px-8 py-2.5 flex items-center justify-between shadow-xs print:hidden select-none">
        <div className="flex items-center gap-2 sm:gap-4 font-sans max-w-full overflow-hidden">
          {/* Logo Card */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-transform shrink-0">
              <GraduationCap size={20} className="text-white" />
            </div>
            <div className="leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-black tracking-tight text-slate-900">Teacher</span>
                <span className="text-[8px] sm:text-[9px] bg-blue-50 border border-blue-100 text-blue-700 font-extrabold px-1.5 py-0.25 rounded-md leading-none">برو</span>
              </div>
              <p className="text-[8px] sm:text-[9.5px] text-slate-400 font-bold mt-0.5">منصة لإدارة الحصص الدراسية</p>
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



          {preferences.passcode && (
            <button
              onClick={() => setIsLocked(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs active:scale-95"
              title="قفل الشاشة السريع"
            >
              <Lock size={13} className="text-slate-450" />
              <span className="hidden sm:inline">قفل سريع</span>
            </button>
          )}

          <div className="md:hidden flex items-center gap-1 text-[9px] font-bold px-2 py-1 bg-emerald-50 border border-emerald-150 text-emerald-700 rounded-lg">
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

            {/* Teacher Profile Info - At Ribbon swapped to the left of Settings */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-150/80 px-2.5 py-1.5 sm:py-2 rounded-xl shrink-0 text-[10px] sm:text-xs font-black text-slate-800 self-center">
              <div className="w-5.5 h-5.5 rounded-lg bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
                <User size={12} className="text-indigo-600" />
              </div>
              <span className="truncate max-w-[70px] sm:max-w-[120px]">{preferences.teacherName}</span>
              {preferences.subject && (
                <>
                  <span className="text-slate-300 mx-0.5">•</span>
                  <span className="text-indigo-600 font-extrabold truncate max-w-[60px] sm:max-w-[100px]">{preferences.subject}</span>
                </>
              )}
            </div>
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
              <LayoutGrid size={16} className={`${activeTab === 'dashboard' && !selectedStudentId ? 'text-white' : 'text-slate-555'}`} />
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
                initial={{ opacity: 0, scale: 0.995 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.995 }}
                transition={{ duration: 0.15 }}
              >
                <StudentDetails
                  student={selectedStudentObj}
                  currency={preferences.currency}
                  onBack={() => setSelectedStudentId(null)}
                  onUpdateStudent={handleUpdateStudent}
                  appointments={appointments}
                />
              </motion.div>
            ) : (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.15 }}
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
                    onAddAppointment={handleAddAppointment}
                    onDeleteAppointment={handleDeleteAppointment}
                    onUpdateAppointmentDay={handleUpdateAppointmentDay}
                  />
                )}

                {activeTab === 'financials' && (
                  <FinancialReports
                    students={students}
                    currency={preferences.currency}
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
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <footer className="bg-slate-50 border-t border-slate-200/80 py-6 text-center text-slate-400 text-[10px] font-bold print:hidden z-10 w-full mt-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-right">
            <p className="text-slate-550">مساعد تخطيط وإلتحاق ومتابعة شؤون الطلاب الذكي للأستاذ • برنامج Teacher الذكي</p>
            <div className="flex items-center gap-2.5">
              <span className="bg-slate-200 text-slate-650 border border-slate-300 px-2 py-0.5 rounded font-mono">1.1.0</span>
              <p className="text-slate-400 font-semibold text-left">تم التطوير بامتياز بواسطة المُبرمج <span className="text-indigo-600 font-black">Mohamed Abdella</span></p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
