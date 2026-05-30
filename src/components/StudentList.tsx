import React, { useState } from 'react';
import { Student, StudentType, Appointment } from '../types';
import { UserPlus, Search, Phone, CalendarRange, Layers, GraduationCap, X, Trash2, AlertTriangle, Camera, User, Bell, MessageCircle, QrCode, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsQR from 'jsqr';
import { formatTimeTo12h } from '../lib/timeUtils';

interface StudentListProps {
  students: Student[];
  onSelectStudent: (id: string) => void;
  onAddStudent: (studentData: Omit<Student, 'id' | 'createdAt' | 'sessions' | 'payments'>) => void;
  onDeleteStudent: (id: string) => void;
  currency: string;
  onUpdateStudent?: (id: string, updatedFields: Partial<Student>) => void;
  subject?: string;
  appointments: Appointment[];
}

export default function StudentList({ students, onSelectStudent, onAddStudent, onDeleteStudent, currency, onUpdateStudent, subject, appointments }: StudentListProps) {
  const [isOpenAddModal, setIsOpenAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | StudentType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [deleteConfirmStudent, setDeleteConfirmStudent] = useState<Student | null>(null);
  const [reminderModalStudent, setReminderModalStudent] = useState<Student | null>(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [expandedQuickViews, setExpandedQuickViews] = useState<string[]>([]);
  const [expandedSchedules, setExpandedSchedules] = useState<string[]>([]);

  const toggleQuickView = (studentId: string) => {
    setExpandedQuickViews(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleScheduleExpansion = (studentId: string) => {
    setExpandedSchedules(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  // Student QR Scanner Camera States & Refs
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannedSuccessId, setScannedSuccessId] = useState<string | null>(null);
  const qrVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const qrStreamRef = React.useRef<MediaStream | null>(null);
  const animationFrameIdRef = React.useRef<number | null>(null);

  const startQrScanner = async () => {
    setScannerError(null);
    setScannedSuccessId(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      qrStreamRef.current = stream;
      setIsQrScannerOpen(true);
      
      // Delay playing to ensure ref has mounted in DOM
      setTimeout(() => {
        if (qrVideoRef.current) {
          qrVideoRef.current.srcObject = stream;
          qrVideoRef.current.play().then(() => {
            animationFrameIdRef.current = requestAnimationFrame(tickQrScanner);
          }).catch(err => {
            console.error("Error playing QR Video stream:", err);
          });
        }
      }, 250);
    } catch (err: any) {
      console.error("Error accessing camera for QR:", err);
      setScannerError("عذراً، لم نتمكن من الوصول لكاميرا المسح. يرجى التحقق من صلاحيات الكاميرا.");
    }
  };

  const stopQrScanner = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(track => track.stop());
      qrStreamRef.current = null;
    }
    setIsQrScannerOpen(false);
  };

  const tickQrScanner = () => {
    if (!qrStreamRef.current) return; // Scanner was stopped
    
    if (!qrVideoRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(tickQrScanner);
      return;
    }

    const video = qrVideoRef.current;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (decoded && decoded.data) {
          const qrText = decoded.data;
          if (qrText.startsWith('student-qr:')) {
            const studentId = qrText.split('student-qr:')[1]?.trim();
            if (studentId) {
              const matchedStudent = students.find(s => s.id === studentId);
              if (matchedStudent) {
                // Play notification if supported, set success highlight, then redirect
                setScannedSuccessId(studentId);
                setTimeout(() => {
                  stopQrScanner();
                  onSelectStudent(studentId);
                }, 750);
                return;
              }
            }
          }
        }
      }
    }

    animationFrameIdRef.current = requestAnimationFrame(tickQrScanner);
  };

  // New Student Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [type, setType] = useState<StudentType>('lesson');
  const [lessonRate, setLessonRate] = useState('100');
  const [coursePrice, setCoursePrice] = useState('800');
  const [totalLessonsCount, setTotalLessonsCount] = useState('8');
  const [dueDate, setDueDate] = useState('');
  const [photo, setPhoto] = useState('');
  const [autoReminder, setAutoReminder] = useState(false);

  // States for student editing
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editType, setEditType] = useState<StudentType>('lesson');
  const [editActive, setEditActive] = useState(true);
  const [editLessonRate, setEditLessonRate] = useState('100');
  const [editCoursePrice, setEditCoursePrice] = useState('800');
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);
  const [editAutoReminder, setEditAutoReminder] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 300;
      canvas.height = videoRef.current.videoHeight || 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
        const base64 = canvas.toDataURL('image/jpeg', 0.85);
        
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = 160;
          resizeCanvas.height = 160;
          const rCtx = resizeCanvas.getContext('2d');
          if (rCtx) {
            rCtx.drawImage(img, 0, 0, 160, 160);
            setPhoto(resizeCanvas.toDataURL('image/jpeg', 0.8));
          }
        };
      }
      stopCamera();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = 160;
          resizeCanvas.height = 160;
          const rCtx = resizeCanvas.getContext('2d');
          if (rCtx) {
            rCtx.drawImage(img, 0, 0, 160, 160);
            setPhoto(resizeCanvas.toDataURL('image/jpeg', 0.8));
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          const resizeCanvas = document.createElement('canvas');
          resizeCanvas.width = 160;
          resizeCanvas.height = 160;
          const rCtx = resizeCanvas.getContext('2d');
          if (rCtx) {
            rCtx.drawImage(img, 0, 0, 160, 160);
            setEditPhoto(resizeCanvas.toDataURL('image/jpeg', 0.8));
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddStudent({
      name,
      phone,
      type,
      active: true,
      lessonRate: type === 'lesson' ? parseFloat(lessonRate) || 0 : undefined,
      coursePrice: type === 'course' ? parseFloat(coursePrice) || 0 : undefined,
      totalLessonsCount: undefined, // الغي عدد الحصص
      dueDate: type === 'course' ? '1 في الشهر' : undefined, // موعد الاستحقاق وخليها 1 في الشهر
      photo: photo || undefined,
      autoReminder: autoReminder || false,
    });

    // Reset Form
    setName('');
    setPhone('');
    setType('lesson');
    setLessonRate('100');
    setCoursePrice('800');
    setTotalLessonsCount('8');
    setDueDate('');
    setPhoto('');
    setAutoReminder(false);
    stopCamera();
    setIsOpenAddModal(false);
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          student.phone.includes(searchQuery);
    const matchesType = filterType === 'all' || student.type === filterType;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && student.active) || 
                         (filterStatus === 'inactive' && !student.active);
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header Metrics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="premium-card p-5 flex items-center gap-4.5 relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 h-1 border-r-4 border-indigo-500 rounded-bl-3xl" />
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100/75 flex items-center justify-center text-indigo-600 shadow-3xs group-hover:scale-105 transition-transform duration-300">
            <GraduationCap size={22} className="glow-pulse" />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wide">إجمالي المقيدين بالدفعة</p>
            <p className="text-xl font-black text-slate-800 mt-1">{students.length} <span className="text-xs font-bold text-slate-500">طلاب وطالبات</span></p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="premium-card p-5 flex items-center gap-4.5 relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 h-1 border-r-4 border-teal-500 rounded-bl-3xl" />
          <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100/75 flex items-center justify-center text-teal-600 shadow-3xs group-hover:scale-105 transition-transform duration-300">
            <CalendarRange size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wide">نظام المحاسبة بالحصة</p>
            <p className="text-xl font-black text-slate-800 mt-1">{students.filter(s => s.type === 'lesson').length} <span className="text-xs font-bold text-slate-500">طالب نشط</span></p>
          </div>
        </motion.div>

        <motion.div 
          whileHover={{ y: -4, scale: 1.01 }}
          className="premium-card p-5 flex items-center gap-4.5 relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 h-1 border-r-4 border-pink-500 rounded-bl-3xl" />
          <div className="w-12 h-12 rounded-xl bg-pink-50 border border-pink-100/75 flex items-center justify-center text-pink-600 shadow-3xs group-hover:scale-105 transition-transform duration-300">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wide">نظام الاشتراك بالكورسات</p>
            <p className="text-xl font-black text-slate-800 mt-1">{students.filter(s => s.type === 'course').length} <span className="text-xs font-bold text-slate-500">طالب حالي</span></p>
          </div>
        </motion.div>
      </div>

      {/* Filters and Search and Actions */}
      <div className="premium-card p-4.5 flex flex-col xl:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2.5 w-full xl:w-[460px] items-center">
          <div className="relative flex-grow">
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={18} />
            </span>
            <input
              type="text"
              placeholder="ابحث بالنقر عن اسم طالب أو هاتف المتابعة للطلب..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-450 focus:outline-none focus:border-indigo-500/85 focus:bg-white focus:ring-2 focus:ring-indigo-500/10 transition-all duration-300 premium-input"
            />
          </div>
          <button
            onClick={startQrScanner}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-150 rounded-xl text-xs font-black cursor-pointer transition shadow-3xs active:scale-95 shrink-0"
            title="مسح رمز تعريف الطالب QR لتسجيل حضور أو سحب الملف"
          >
            <Camera size={14} />
            <span>مسح QR 📷</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3.5 w-full xl:w-auto justify-end">
          {/* Learn system check type filter */}
          <div className="flex gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200/50 text-[11px] font-black">
            <button
               onClick={() => setFilterType('all')}
               className={`px-3.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                 filterType === 'all' 
                   ? 'bg-indigo-600 text-white shadow-xs' 
                   : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
               }`}
             >
               كافة الأنظمة
             </button>
             <button
               onClick={() => setFilterType('lesson')}
               className={`px-3.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer ${
                 filterType === 'lesson' 
                   ? 'bg-indigo-600 text-white shadow-xs' 
                   : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
               }`}
             >
               بالحصة
             </button>
             <button
               onClick={() => setFilterType('course')}
              className={`px-3.5 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                filterType === 'course' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              بالكورس
            </button>
          </div>

          {/* Status checklist filter */}
          <div className="flex gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-[11px] font-black">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                filterStatus === 'all' 
                  ? 'bg-slate-800 text-white' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                filterStatus === 'active' 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              النشطين
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer ${
                filterStatus === 'inactive' 
                  ? 'bg-rose-600 text-white' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50'
              }`}
            >
              المتوقفين
            </button>
          </div>

          <button
            onClick={() => setIsOpenAddModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 transition-all text-white text-xs font-black rounded-xl cursor-pointer shadow-md shadow-indigo-600/10 mr-auto xl:mr-0 shrink-0"
          >
            <UserPlus size={16} />
            <span>تسجيل طالب جديد</span>
          </button>
        </div>
      </div>

      {/* Grid of Student Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStudents.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white border border-slate-200 rounded-3xl shadow-sm">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 mb-4">
              <Search size={28} />
            </div>
            <h3 className="text-slate-700 font-bold mb-1.5">لا يوجد طلاب متطابقين مع البحث</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              تصفح التصفية الحالية أو قم بإضافة طالب جديد للبدء في التسجيل والمتابعة والمالية.
            </p>
          </div>
        ) : (
          filteredStudents.map((student) => {
            const sessionsCount = student.sessions.length;
            const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
            
            const resolvedSubject = subject || (()=>{
              try {
                const stored = localStorage.getItem('teacherPreferences');
                if (stored) {
                  return JSON.parse(stored).subject;
                }
              } catch (e) {}
              return '';
            })() || 'مادة عامة';

            // Calculate current month's weekly attendance counts for the Sparkline
            const now = new Date();
            const currentYearStr = String(now.getFullYear());
            const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
            
            const monthSessions = (student.sessions || []).filter(session => {
              if (!session.date) return false;
              return session.date.startsWith(`${currentYearStr}-${currentMonthStr}`);
            });

            const w1 = monthSessions.filter(s => {
              const d = parseInt(s.date.split('-')[2], 10);
              return d >= 1 && d <= 7;
            }).length;
            const w2 = monthSessions.filter(s => {
              const d = parseInt(s.date.split('-')[2], 10);
              return d >= 8 && d <= 14;
            }).length;
            const w3 = monthSessions.filter(s => {
              const d = parseInt(s.date.split('-')[2], 10);
              return d >= 15 && d <= 21;
            }).length;
            const w4 = monthSessions.filter(s => {
              const d = parseInt(s.date.split('-')[2], 10);
              return d >= 22 && d <= 31;
            }).length;

            const totalMonthSessions = monthSessions.length;
            
            const maxVal = Math.max(w1, w2, w3, w4, 2);
            const y1 = 24 - (w1 / maxVal) * 20;
            const y2 = 24 - (w2 / maxVal) * 20;
            const y3 = 24 - (w3 / maxVal) * 20;
            const y4 = 24 - (w4 / maxVal) * 20;

            const pathD = `M 10 ${y1} L 40 ${y2} L 70 ${y3} L 100 ${y4}`;
            const areaD = `M 10 26 L 10 ${y1} L 40 ${y2} L 70 ${y3} L 100 ${y4} L 100 26 Z`;

            let remainingInCourse = 0;
            let totalDue = 0;

            if (student.type === 'lesson') {
              const totalCost = sessionsCount * (student.lessonRate || 0);
              totalDue = totalCost - totalPaid;
            } else if (student.type === 'course') {
              remainingInCourse = Math.max(0, (student.totalLessonsCount || 0) - sessionsCount);
              totalDue = (student.coursePrice || 0) - totalPaid;
            }

            const getPerformanceStatus = () => {
              const rate = student.lessonRate || 100;
              const price = student.coursePrice || 800;
              
              if (student.type === 'lesson') {
                if (totalDue > rate * 2) {
                  return {
                    label: 'متعثر ماليًا',
                    color: 'bg-rose-50 text-rose-700 border-rose-150',
                    icon: '⚠️'
                  };
                } else if (totalDue <= 0 && sessionsCount >= 4) {
                  return {
                    label: 'ممتاز ومثالي',
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-150',
                    icon: '👑'
                  };
                } else {
                  return {
                    label: 'منتظم',
                    color: 'bg-slate-50 text-slate-600 border-slate-150',
                    icon: '✨'
                  };
                }
              } else {
                const total = student.totalLessonsCount || 8;
                const progressRatio = total > 0 ? (sessionsCount / total) : 0;
                
                if (totalDue > price * 0.3) {
                  return {
                    label: 'متأخر السداد',
                    color: 'bg-rose-50 text-rose-700 border-rose-150',
                    icon: '⚠️'
                  };
                } else if (progressRatio >= 0.75 && totalDue <= 0) {
                  return {
                    label: 'مكتمل ومتميز',
                    color: 'bg-emerald-50 text-emerald-700 border-emerald-150',
                    icon: '👑'
                  };
                } else {
                  return {
                    label: 'منتظم',
                    color: 'bg-slate-50 text-slate-600 border-slate-150',
                    icon: '✨'
                  };
                }
              }
            };

            const perfStatus = getPerformanceStatus();
            const studentAppointments = appointments?.filter(appt => appt.studentId === student.id) || [];

            return (
              <motion.div
                key={student.id}
                layoutId={`card-${student.id}`}
                whileHover={{ scale: 1.015, y: -4 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                className={`group premium-card p-5 flex flex-col justify-between relative cursor-pointer ${
                  expandedSchedules.includes(student.id) ? 'ring-2 ring-blue-500 bg-blue-50/15' : ''
                } ${
                  !student.active ? 'opacity-60 bg-slate-50/40 hover:opacity-95' : ''
                }`}
                onClick={() => toggleScheduleExpansion(student.id)}
              >
                {/* Floating Performance Tag */}
                <motion.div 
                  className={`absolute -top-2.5 right-4.5 px-2.5 py-0.5 text-[9px] rounded-full font-black border tracking-wide flex items-center gap-1.5 shadow-3xs z-10 ${perfStatus.color}`}
                  title={perfStatus.label}
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{
                    duration: 2.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      perfStatus.label.includes('ممتاز') || perfStatus.label.includes('متميز')
                        ? 'bg-[#10b981]' 
                        : perfStatus.label.includes('متعثر') || perfStatus.label.includes('متأخر')
                        ? 'bg-[#f43f5e]' 
                        : 'bg-[#64748b]'
                    }`}></span>
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                      perfStatus.label.includes('ممتاز') || perfStatus.label.includes('متميز')
                        ? 'bg-[#10b981]' 
                        : perfStatus.label.includes('متعثر') || perfStatus.label.includes('متأخر')
                        ? 'bg-[#f43f5e]' 
                        : 'bg-[#64748b]'
                    }`}></span>
                  </span>
                  <span>{perfStatus.icon}</span>
                  <span>{perfStatus.label}</span>
                </motion.div>

                <div>
                  <div className="flex justify-between items-start gap-2 mb-3 px-0.5">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                        student.type === 'lesson'
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-100/60'
                          : 'bg-pink-50 text-pink-700 border border-pink-100/60'
                      }`}
                    >
                      {student.type === 'lesson' ? 'نظام الحصص' : 'نظام الكورسات'}
                    </span>
                    
                    <div className="flex gap-2.5 items-center">
                      <span
                        className={`text-[9.5px] px-2 py-0.5 rounded-full font-bold ${
                          student.active
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100/60'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {student.active ? 'نشط' : 'متوقف'}
                      </span>
                      
                      {student.phone ? (
                        <a
                           href={((): string => {
                            const reminderMsg = `السلام عليكم، أردت تذكيركم بموعد حصة الطالب "${student.name}" القادمة والمقررة بجدولنا. يرجى تأكيد الموعد، أو إخبارنا لإعادة جدولته إن دعت الحاجة. تحياتنا لكم!`;
                            let cleanPhone = student.phone.replace(/\D/g, '');
                            if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
                              cleanPhone = '2' + cleanPhone;
                            }
                            return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(reminderMsg)}`;
                          })()}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer flex items-center justify-center p-0.5 hover:scale-110 active:scale-95"
                          title="إرسال تذكير سريع بالموعد أو إعادة الجدولة"
                        >
                          <MessageCircle size={15} />
                        </a>
                      ) : (
                        <span
                          className="text-slate-250 cursor-not-allowed flex items-center justify-center p-0.5"
                          title="رقم الهاتف غير مسجل لإرسال تذكير"
                        >
                          <MessageCircle size={15} className="opacity-30" />
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingStudent(student);
                          setEditName(student.name);
                          setEditPhone(student.phone || '');
                          setEditType(student.type);
                          setEditActive(student.active);
                          setEditLessonRate(student.lessonRate ? student.lessonRate.toString() : '100');
                          setEditCoursePrice(student.coursePrice ? student.coursePrice.toString() : '800');
                          setEditPhoto(student.photo);
                          setEditAutoReminder(student.autoReminder || false);
                        }}
                        className="text-slate-400 hover:text-blue-500 transition-colors cursor-pointer hover:scale-110 active:scale-95 mx-1"
                        title="تعديل بيانات الطالب"
                      >
                        <Edit size={14} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmStudent(student);
                        }}
                        className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer hover:scale-110 active:scale-95"
                        title="حذف الطالب"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                      <User size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-slate-800 group-hover:text-blue-600 transition-colors duration-300 leading-tight">
                          {student.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.25 rounded-md text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-150 whitespace-nowrap transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white group-hover:shadow-3xs" title="إجمالي الحصص المنجزة">
                          {sessionsCount} حصص
                        </span>
                        {studentAppointments.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.25 rounded-md text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-150/85 whitespace-nowrap animate-in fade-in duration-300" title="لديه مواعيد أسبوعية مجدولة">
                            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span>مجدول 📅</span>
                          </span>
                        )}
                      </div>
                      {student.phone ? (
                        <p className="text-xs text-slate-550 flex items-center gap-1.5 mt-1 transition-all duration-300 group-hover:text-emerald-700">
                          <Phone size={12} className="text-slate-400 group-hover:text-emerald-500 transition-all duration-300 group-hover:animate-bounce" />
                          <span className="font-mono group-hover:font-extrabold tracking-wide transition-all duration-300">{student.phone}</span>
                        </p>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold group-hover:text-slate-500 transition-colors duration-300">بدون رقم هاتف</span>
                      )}
                    </div>
                  </div>

                  {/* Elegant Hover-Activated Info Summary Drawer */}
                  <div className="max-h-0 opacity-0 overflow-hidden transition-all duration-500 ease-in-out group-hover:max-h-[160px] group-hover:opacity-100 group-hover:mt-3 pt-0 group-hover:pt-2.5 border-t border-dashed border-slate-200">
                    <div className="space-y-1.5 text-[11px] text-slate-600" dir="rtl">
                      <div className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded-lg py-1 px-2.5 shadow-3xs">
                        <span className="text-slate-500 font-bold">نوع الالتزام:</span>
                        <span className={`font-black ${
                          totalMonthSessions >= 5
                            ? 'text-emerald-650'
                            : totalMonthSessions >= 3
                              ? 'text-blue-650'
                              : totalMonthSessions >= 1
                                ? 'text-amber-550'
                                : 'text-slate-450'
                        }`}>
                          {totalMonthSessions >= 5 ? 'إلتزام ممتاز 🔥' : totalMonthSessions >= 3 ? 'حضور مستقر ✨' : totalMonthSessions >= 1 ? 'تفاعل متقطع ⚠️' : 'بحاجة للمتابعة 💤'}
                        </span>
                      </div>

                      <div className="flex justify-between items-center px-1">
                        <span className="text-slate-450 font-bold">المادة / المقرر:</span>
                        <span className="font-extrabold text-blue-650 text-xs">{resolvedSubject}</span>
                      </div>

                      {student.phone && (
                        <div className="flex justify-between items-center px-1">
                          <span className="text-slate-450 font-bold">رقم الهاتف النشط:</span>
                          <span className="font-mono font-black text-emerald-700 text-xs tracking-wider">{student.phone}</span>
                        </div>
                      )}

                      {student.sessions.length > 0 && (
                        <div className="flex justify-between items-center px-1">
                          <span className="text-slate-450 font-bold">تاريخ آخر حصة:</span>
                          <span className="font-mono font-black text-slate-700 text-xs">{student.sessions[student.sessions.length - 1].date}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Core details by type */}
                  <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-xs">
                    {student.type === 'lesson' ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">سعر الحصة:</span>
                          <span className="font-bold text-slate-700">
                            {student.lessonRate} {currency}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">الحصص المسجلة:</span>
                          <span className="font-bold text-slate-700">{sessionsCount} حصص</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-slate-500">قيمة الكورس:</span>
                          <span className="font-bold text-slate-700">
                            {student.coursePrice} {currency}
                          </span>
                        </div>
                        {student.totalLessonsCount !== undefined ? (
                          <div className="flex justify-between">
                            <span className="text-slate-500">الحصص المتبقية:</span>
                            <span
                              className={`font-bold ${
                                remainingInCourse <= 2 ? 'text-red-650' : 'text-slate-700'
                              }`}
                            >
                              {remainingInCourse} من {student.totalLessonsCount} حصص
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-slate-500">الحصص المسجلة:</span>
                            <span className="font-bold text-slate-700">{sessionsCount} حصص</span>
                          </div>
                        )}
                        {student.dueDate && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-550">استحقاق الدفع:</span>
                            <span className="font-bold text-amber-600">{student.dueDate}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Attendance Sparkline for Current Month */}
                  <div className="mt-3.5 p-3 bg-slate-50 border border-slate-150/80 rounded-2xl animate-in fade-in duration-200">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black text-slate-700 flex items-center gap-1">
                        📈
                        <span>وتيرة الحضور (الشهر الحالي)</span>
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-md">
                        {totalMonthSessions} {totalMonthSessions === 1 ? 'حصة' : totalMonthSessions === 2 ? 'حصتان' : 'حصص'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* SVG Canvas for Sparkline */}
                      <div className="flex-1 h-8 flex items-center justify-center bg-white/70 border border-slate-100 rounded-xl px-2">
                        {totalMonthSessions > 0 ? (
                          <svg className="w-full h-full overflow-visible" viewBox="0 0 110 30" dir="ltr">
                            <defs>
                              <linearGradient id={`spark-grad-${student.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                              </linearGradient>
                            </defs>
                            {/* Gradient Area under curve */}
                            <path
                              d={areaD}
                              fill={`url(#spark-grad-${student.id})`}
                              className="transition-all duration-350"
                            />
                            {/* Sparkline curve */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke={student.active ? '#2563eb' : '#64748b'}
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="transition-all duration-350"
                            />
                            {/* Anchored dots */}
                            <circle cx="10" cy={y1} r="3" fill={student.active ? '#1d4ed8' : '#475569'} stroke="#ffffff" strokeWidth="1" className="hover:r-4 transition-all duration-150 cursor-pointer" />
                            <circle cx="40" cy={y2} r="3" fill={student.active ? '#1d4ed8' : '#475569'} stroke="#ffffff" strokeWidth="1" className="hover:r-4 transition-all duration-150 cursor-pointer" />
                            <circle cx="70" cy={y3} r="3" fill={student.active ? '#1d4ed8' : '#475569'} stroke="#ffffff" strokeWidth="1" className="hover:r-4 transition-all duration-150 cursor-pointer" />
                            <circle cx="100" cy={y4} r="3" fill={student.active ? '#1d4ed8' : '#475569'} stroke="#ffffff" strokeWidth="1" className="hover:r-4 transition-all duration-150 cursor-pointer" />
                          </svg>
                        ) : (
                          <div className="text-[9px] text-slate-400 font-semibold italic text-center w-full">
                            📭 لا توجد حصص مسجلة هذا الشهر
                          </div>
                        )}
                      </div>

                      {/* Sparkline Engagement Indicator */}
                      <div className="flex flex-col gap-0.5 text-right pl-2 border-r border-slate-200">
                        <span className="text-[8px] text-slate-400 font-bold whitespace-nowrap">الالتزام</span>
                        <span className={`text-[10px] font-black whitespace-nowrap ${
                          totalMonthSessions >= 5
                            ? 'text-emerald-650'
                            : totalMonthSessions >= 3
                              ? 'text-blue-650'
                              : totalMonthSessions >= 1
                                ? 'text-amber-550'
                                : 'text-slate-400'
                        }`}>
                          {totalMonthSessions >= 5 ? 'ممتاز 🔥' : totalMonthSessions >= 3 ? 'منتظم ✨' : totalMonthSessions >= 1 ? 'متقطع ⚠️' : 'خامل 💤'}
                        </span>
                      </div>
                    </div>

                    {totalMonthSessions > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-150/50 flex justify-between text-[8px] text-slate-400 font-bold font-mono" dir="rtl">
                        <div className="flex flex-col items-center">
                          <span className="text-[7px]">أسبوع ١</span>
                          <span className="text-slate-700 font-black text-[9px]">{w1}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px]">أسبوع ٢</span>
                          <span className="text-slate-700 font-black text-[9px]">{w2}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px]">أسبوع ٣</span>
                          <span className="text-slate-700 font-black text-[9px]">{w3}</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[7px]">أسبوع ٤</span>
                          <span className="text-slate-700 font-black text-[9px]">{w4}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick View Expandable Section */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleQuickView(student.id);
                      }}
                      className="w-full flex items-center justify-between text-[10px] font-black text-slate-500 hover:text-blue-700 transition-colors cursor-pointer bg-slate-50 hover:bg-slate-100 px-2 rounded-lg py-1 border border-slate-200/60"
                      id={`btn-quickview-${student.id}`}
                    >
                      <span className="flex items-center gap-1">
                        ⏱️
                        <span>العرض السريع (آخر 3 حصص)</span>
                      </span>
                      <span className="font-sans font-extrabold text-[9px] text-slate-400">
                        {expandedQuickViews.includes(student.id) ? 'إخفاء ▲' : 'عرض آخر الحصص ▼'}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {expandedQuickViews.includes(student.id) && (
                        <motion.div
                          key="quickview-panel"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden space-y-1 mt-2"
                        >
                          {student.sessions && student.sessions.length > 0 ? (
                            [...student.sessions]
                              .sort((a, b) => {
                                const dateA = `${a.date}T${a.time || '00:00'}`;
                                const dateB = `${b.date}T${b.time || '00:00'}`;
                                return dateB.localeCompare(dateA);
                              })
                              .slice(0, 3)
                              .map((session, sIdx) => (
                                <div 
                                  key={session.id} 
                                  className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-xl text-[10px] transition-colors"
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-500 font-mono font-bold">
                                      #{student.sessions.length - sIdx}
                                    </span>
                                    <span className="font-bold text-slate-700 truncate" title={session.notes}>
                                      {session.notes || 'حصة منجزة'}
                                    </span>
                                  </div>
                                  <div className="text-left shrink-0 text-slate-400 font-mono font-bold text-[9px] flex items-center gap-1">
                                    <span>{session.date}</span>
                                    {session.isExtra && (
                                      <span className="bg-amber-100 text-amber-800 text-[8px] px-1 rounded font-black">إضافي</span>
                                    )}
                                  </div>
                                </div>
                              ))
                          ) : (
                            <div className="text-center py-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-[9px] text-slate-400 font-bold">
                              📭 لا توجد حصص مسجلة بعد لهذا الطالب
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Homework & Manual Reminder Row */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {student.phone ? (
                    <a
                      href={((): string => {
                        const latestSession = student.sessions && student.sessions.length > 0 
                          ? student.sessions[student.sessions.length - 1] 
                          : null;
                        const notes = latestSession?.notes || 'لا يوجد واجب مسجل حالياً';
                        const homeworkMsg = `السلام عليكم يا ${student.name}، نود تذكيركم بالواجب وملاحظات الحصة الأخيرة المطلوب إنجازها:
📚 ${notes}`;
                        let cleanPhone = student.phone.replace(/\D/g, '');
                        if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
                          cleanPhone = '2' + cleanPhone;
                        }
                        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(homeworkMsg)}`;
                      })()}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 hover:text-emerald-800 text-[10px] font-black rounded-xl transition cursor-pointer text-center"
                    >
                      <span className="text-emerald-600 text-[11px]">📱</span>
                      <span>تذكير بالواجب</span>
                    </a>
                  ) : (
                    <div className="flex items-center justify-center gap-1 py-1.5 bg-slate-50 border border-slate-200 text-slate-400 text-[10px] font-black rounded-xl select-none">
                      <span>🔕</span>
                      <span>بدون هاتف</span>
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setReminderModalStudent(student);
                      setReminderDate(student.customReminderDate || new Date().toISOString().split('T')[0]);
                      setReminderNote(student.customReminderNote || '');
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-150 hover:border-amber-250 text-amber-700 hover:text-amber-850 text-[10px] font-black rounded-xl transition cursor-pointer"
                  >
                    <Bell size={11} className="text-amber-600" />
                    <span>جدولة تذكير ⏰</span>
                  </button>
                </div>

                {/* Active Custom Reminder Display */}
                {student.customReminderDate && (
                  <div className="mt-2.5 flex items-center justify-between gap-1 px-3 py-1.5 bg-indigo-50/60 border border-indigo-100 rounded-xl text-[10px] select-none">
                    <div className="flex items-center gap-1 text-indigo-800 font-extrabold truncate">
                      <Bell size={11} className="text-indigo-600 shrink-0" />
                      <span className="truncate" title={student.customReminderNote}>تذكير: {student.customReminderDate} {student.customReminderNote ? `(${student.customReminderNote})` : ''}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onUpdateStudent) {
                          onUpdateStudent(student.id, { customReminderDate: undefined, customReminderNote: undefined });
                        }
                      }}
                      className="text-indigo-400 hover:text-red-500 font-black px-1.5 py-0.5 rounded-md hover:bg-indigo-100/50 cursor-pointer"
                      title="حذف التذكير"
                    >
                      إلغاء ❌
                    </button>
                  </div>
                )}

                 {/* Expanded Upcoming Schedule Section */}
                 <AnimatePresence initial={false}>
                   {expandedSchedules.includes(student.id) && (
                     <motion.div
                       key="schedule-expansion"
                       initial={{ height: 0, opacity: 0 }}
                       animate={{ height: "auto", opacity: 1 }}
                       exit={{ height: 0, opacity: 0 }}
                       transition={{ duration: 0.25, ease: "easeInOut" }}
                       className="overflow-hidden mt-3 pt-3 border-t border-dashed border-slate-200 text-right"
                       onClick={(e) => e.stopPropagation()}
                     >
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-black text-slate-700 flex items-center gap-1.5 bg-blue-50/70 border border-blue-100/40 px-2 py-0.5 rounded-md">
                           <CalendarRange size={11} className="text-blue-600 animate-pulse" />
                           <span>جدول الحصص القادم والمواعيد الأسبوعية 📅</span>
                         </span>
                         <span className="text-[9px] font-bold text-slate-450 bg-slate-100 border border-slate-200/50 px-1.5 py-0.25 rounded">
                           {studentAppointments.length} {studentAppointments.length === 1 ? 'موعد' : studentAppointments.length === 2 ? 'موعدان' : 'مواعيد'}
                         </span>
                       </div>

                       {studentAppointments.length > 0 ? (
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-0.5 scrollbar-thin">
                           {studentAppointments.map((appt) => (
                             <div
                               key={appt.id}
                               className="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50/30 to-blue-50/75 hover:from-blue-50/50 hover:to-blue-50/90 border border-blue-100/50 rounded-xl text-[10px] transition-all duration-300 shadow-3xs"
                             >
                               <div className="flex items-center gap-1.5 truncate">
                                 <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                 <span className="font-extrabold text-blue-900">{appt.dayOfWeek}</span>
                                 {appt.title && (
                                   <span className="text-[8px] text-slate-450 font-bold truncate max-w-[70px]">
                                     ({appt.title})
                                   </span>
                                 )}
                               </div>
                               <div className="text-left font-mono font-black text-blue-700 bg-white border border-blue-100/80 px-1.5 py-0.5 rounded-md text-[9px] shadow-3xs" dir="ltr">
                                 {formatTimeTo12h(appt.time)}
                               </div>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="text-center py-4 bg-slate-50/40 border border-dashed border-slate-200/80 rounded-2xl text-[9.5px] text-slate-450 font-bold space-y-1">
                           <p>📭 لم يتم جدولة مواعيد أسبوعية في النظام بعد</p>
                           <p className="text-[8.5px] text-slate-400 font-semibold">يمكنك إضافة مواعيد ثابتة من تبويب المواعيد الحرة</p>
                         </div>
                       )}
                     </motion.div>
                   )}
                 </AnimatePresence>

                {/* Progress Indicators & Core Action */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-semibold">
                      {totalDue > 0 ? 'متبقي عليه' : totalDue < 0 ? 'له رصيد' : 'مستحق مسدد'}
                    </p>
                    <p
                      className={`text-sm font-extrabold ${
                        totalDue > 0
                          ? 'text-red-600'
                          : totalDue < 0
                          ? 'text-emerald-650'
                          : 'text-slate-500'
                      }`}
                    >
                      {Math.abs(totalDue)} {currency}
                    </p>
                  </div>

                  <button
                    onClick={() => onSelectStudent(student.id)}
                    className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer border border-blue-100"
                  >
                    السجل والمتابعة ←
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Add Student Slide-over Modal */}
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

            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md max-h-[75vh] md:max-h-[80vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl z-10 font-sans text-right text-slate-800 scrollbar-thin"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                  <UserPlus size={20} className="text-blue-600" />
                  تسجيل طالب جديد في النظام
                </h3>
                <button
                  onClick={() => setIsOpenAddModal(false)}
                  className="p-1 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Basic Fields */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">اسم الطالب الثنائي/الكامل *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: أحمد محمد علي"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">رقم الهاتف (واتساب/اتصال)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="مثال: 01012345678"
                    className="w-full px-4 py-2.5 text-left font-mono bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                    dir="ltr"
                  />
                </div>

                {/* System Selection Button Group */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">نظام التعلم والمحاسبة *</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 border border-slate-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setType('lesson')}
                      className={`py-2 w-full text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        type === 'lesson'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      نظام الحصص (دفع لكل حصة)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('course')}
                      className={`py-2 w-full text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        type === 'course'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      نظام كورس كامل (مسدد مقدماً)
                    </button>
                  </div>
                </div>

                {/* Type Specific Fields */}
                <AnimatePresence mode="wait">
                  {type === 'lesson' ? (
                    <motion.div
                      key="lesson-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="space-y-1">
                        <label className="text-xs text-slate-600 font-bold block">ثمن حصة الطالب الفردية ({currency}) *</label>
                        <input
                          type="number"
                          required
                          value={lessonRate}
                          onChange={(e) => setLessonRate(e.target.value)}
                          min="0"
                          placeholder="مثال: 150"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                        />
                        <p className="text-[10px] text-slate-500">
                          سيقوم البرنامج آلياً بحساب المستحقات المالية عن كل حصة يتم تسجيلها بهذا السعر.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="course-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="space-y-1">
                        <label className="text-xs text-slate-600 font-bold block">مجموع تكلفة الكورس ({currency}) *</label>
                        <input
                          type="number"
                          required
                          value={coursePrice}
                          onChange={(e) => setCoursePrice(e.target.value)}
                          min="0"
                          placeholder="مثال: 1000"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                        />
                      </div>
                      <p className="text-[11px] text-emerald-600 font-bold">
                        💡 سيتم تثبيت موعد الاستحقاق تلقائياً ليكون "1 في الشهر".
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>



                {/* Auto Reminder Option */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between p-3 bg-blue-50/40 rounded-2xl border border-blue-100/50">
                  <div className="flex items-center gap-2.5">
                    <input
                      id="student-auto-reminder-checkbox"
                      type="checkbox"
                      checked={autoReminder}
                      onChange={(e) => setAutoReminder(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="student-auto-reminder-checkbox" className="text-xs text-slate-700 font-bold cursor-pointer select-none">
                      تفعيل التذكير التلقائي (قبل الحصة بـ 24 ساعة) 🔔
                    </label>
                  </div>
                  <span className="text-[9px] text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded font-extrabold shrink-0">
                    جديد
                  </span>
                </div>

                <div className="pt-4 flex justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => setIsOpenAddModal(false)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-150 rounded-xl cursor-pointer"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    تسجيل الطالب
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Student Slide-over Modal */}
      <AnimatePresence>
        {editingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingStudent(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md max-h-[75vh] md:max-h-[80vh] overflow-y-auto bg-white border border-slate-200 rounded-3xl p-5 shadow-2xl z-10 font-sans text-right text-slate-800 scrollbar-thin animate-in fade-in zoom-in duration-200"
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2">
                  <Edit size={20} className="text-blue-600" />
                  تعديل بيانات الطالب
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="p-1 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!editName.trim()) return;
                  if (onUpdateStudent && editingStudent) {
                    onUpdateStudent(editingStudent.id, {
                      name: editName.trim(),
                      phone: editPhone.trim(),
                      type: editType,
                      active: editActive,
                      lessonRate: editType === 'lesson' ? parseFloat(editLessonRate) || 0 : undefined,
                      coursePrice: editType === 'course' ? parseFloat(editCoursePrice) || 0 : undefined,
                      photo: editPhoto,
                      autoReminder: editAutoReminder,
                    });
                  }
                  setEditingStudent(null);
                }}
                className="space-y-4"
              >
                {/* Basic Fields */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 font-bold block">اسم الطالب الثنائي/الكامل *</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="مثال: أحمد محمد علي"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-650 font-bold block">رقم الهاتف (واتساب/اتصال)</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="مثال: 01012345678"
                    className="w-full px-4 py-2.5 text-left font-mono bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                    dir="ltr"
                  />
                </div>

                {/* Status Switch (Active / Passive) */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 font-bold block">حالة الطالب بالمنصة *</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 border border-slate-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditActive(true)}
                      className={`py-2 w-full text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        editActive
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      طالب نشط
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditActive(false)}
                      className={`py-2 w-full text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        !editActive
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-rose-800'
                      }`}
                    >
                      طالب متوقف
                    </button>
                  </div>
                </div>

                {/* System Selection Button Group */}
                <div className="space-y-1">
                  <label className="text-xs text-slate-650 font-bold block">نظام التعلم والمحاسبة *</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 border border-slate-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditType('lesson')}
                      className={`py-2 w-full text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        editType === 'lesson'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      نظام الحصص (دفع لكل حصة)
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditType('course')}
                      className={`py-2 w-full text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        editType === 'course'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      نظام كورس كامل (مسدد مقدماً)
                    </button>
                  </div>
                </div>

                {/* Type Specific Fields */}
                <AnimatePresence mode="wait">
                  {editType === 'lesson' ? (
                    <motion.div
                      key="edit-lesson-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="space-y-1">
                        <label className="text-xs text-slate-650 font-bold block">ثمن حصة الطالب الفردية ({currency}) *</label>
                        <input
                          type="number"
                          required
                          value={editLessonRate}
                          onChange={(e) => setEditLessonRate(e.target.value)}
                          min="0"
                          placeholder="مثال: 150"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                        />
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="edit-course-fields"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <div className="space-y-1 font-sans">
                        <label className="text-xs text-slate-655 font-bold block">مجموع تكلفة الكورس ({currency}) *</label>
                        <input
                          type="number"
                          required
                          value={editCoursePrice}
                          onChange={(e) => setEditCoursePrice(e.target.value)}
                          min="0"
                          placeholder="مثال: 1000"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Photo upload option */}
                <div className="space-y-1 bg-slate-50 border border-slate-150 p-3 rounded-2xl">
                  <label className="text-xs text-slate-650 font-bold block mb-1">صورة الطالب (اختياري)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      id="edit-student-file-input"
                      accept="image/*"
                      onChange={handleEditFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="edit-student-file-input"
                      className="px-3.5 py-1.5 bg-white border border-slate-200 hover:border-blue-500 text-slate-700 hover:text-blue-600 text-xs font-bold rounded-xl shadow-3xs cursor-pointer flex items-center gap-1.5 transition-all"
                    >
                      <Camera size={13} />
                      تغيير الصورة
                    </label>
                    {editPhoto && (
                      <div className="relative">
                        <img src={editPhoto} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                        <button
                          type="button"
                          onClick={() => setEditPhoto(undefined)}
                          className="absolute -top-1.5 -right-1.5 bg-slate-100 border border-slate-200 hover:bg-red-50 hover:text-red-600 rounded-full p-0.5 text-slate-500"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Auto Reminder Option */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between p-3 bg-blue-50/40 rounded-2xl border border-blue-100/50">
                  <div className="flex items-center gap-2.5 font-sans">
                    <input
                      id="edit-student-auto-reminder"
                      type="checkbox"
                      checked={editAutoReminder}
                      onChange={(e) => setEditAutoReminder(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="edit-student-auto-reminder" className="text-xs text-slate-705 font-bold cursor-pointer select-none">
                      تفعيل التذكير التلقائي (قبل الحصة بـ 24 ساعة) 🔔
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3.5">
                  <button
                    type="button"
                    onClick={() => setEditingStudent(null)}
                    className="px-5 py-2.5 text-xs font-bold text-slate-650 bg-slate-150 rounded-xl cursor-pointer"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    حفظ التعديلات
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmStudent(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-right text-slate-800"
            >
              <div className="flex gap-4 items-start mb-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-650 shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 leading-snug">
                    تأكيد حذف الطالب نهائياً
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    هل أنت متأكد من حذف الطالب <span className="font-extrabold text-slate-800">"{deleteConfirmStudent.name}"</span>؟
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-xs space-y-2 mb-5 text-slate-600">
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>سيتم حذف كامل سجل حصصه وتفاصيل حضوره وغيابه.</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>سيتم حذف جميع إيصالات الدفع والعمليات المالية الخاصة به نهائياً.</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>سيتم إزالة مواعيده الثابتة من جدول طلبة الأسبوع.</span>
                </p>
              </div>

              <div className="flex justify-end gap-3 font-bold text-xs">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmStudent(null)}
                  className="px-4.5 py-2.5 text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  إلغاء الحذف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteStudent(deleteConfirmStudent.id);
                    setDeleteConfirmStudent(null);
                  }}
                  className="px-4.5 py-2.5 text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 size={13} />
                  <span>نعم، احذف الطالب وكل سجلاته</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Set Custom Reminder Modal */}
      <AnimatePresence>
        {reminderModalStudent && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReminderModalStudent(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-40"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-50 font-sans text-right text-slate-850"
            >
              <div className="flex gap-4 items-start mb-5">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                  <Bell size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-snug">
                    جدولة تذكير مخصص للطالب
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed font-bold">
                    حدد تاريخاً وملاحظة للتذكير والمتابعة لـ <span className="font-extrabold text-blue-600">"{reminderModalStudent.name}"</span>
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1.5">تاريخ الحدوث والتذكير *</label>
                  <input
                    type="date"
                    required
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full text-xs font-bold text-slate-700 p-2.5 border border-slate-200 focus:outline-none focus:border-amber-400 bg-slate-50 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1.5">نص وملاحظة التذكير (مثال: متابعة واجب، تذكير بدفعة)</label>
                  <textarea
                    rows={3}
                    value={reminderNote}
                    onChange={(e) => setReminderNote(e.target.value)}
                    placeholder="اكتب تفاصيل التذكير هنا..."
                    className="w-full text-xs font-bold text-slate-700 p-2.5 border border-slate-200 focus:outline-none focus:border-amber-400 bg-slate-50 rounded-xl resize-none leading-relaxed"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 font-black text-xs">
                <button
                  type="button"
                  onClick={() => setReminderModalStudent(null)}
                  className="px-4 py-2.5 text-slate-650 hover:text-slate-850 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer font-bold"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="button"
                  disabled={!reminderDate}
                  onClick={() => {
                    if (onUpdateStudent) {
                      onUpdateStudent(reminderModalStudent.id, {
                        customReminderDate: reminderDate,
                        customReminderNote: reminderNote || 'تذكير مخصص'
                      });
                    }
                    setReminderModalStudent(null);
                  }}
                  className="px-4.5 py-2.5 text-white bg-amber-550 hover:bg-amber-600 disabled:bg-slate-200 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 font-bold"
                >
                  <Bell size={13} />
                  <span>تأكيد وجدولة التذكير ⏰</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Student QR Scanner Modal overlay */}
      <AnimatePresence>
        {isQrScannerOpen && (
          <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-100 font-sans cursor-default" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-slate-100/10 shadow-2xl relative w-full max-w-sm overflow-hidden text-right"
            >
              {/* Header */}
              <div className="bg-indigo-600 p-4.5 text-white flex justify-between items-center relative">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <QrCode size={18} className="text-indigo-10 position-relative animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black">ماسح رمز QR للطالب</h3>
                    <p className="text-[9px] text-indigo-200 mt-0.5 leading-relaxed">وجّه الكاميرا نحو رمز الاستجابة السريعة للطالب</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={stopQrScanner}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer transition"
                  title="إغلاق"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Camera Scanner Container */}
              <div className="p-5 flex flex-col items-center">
                {/* Viewfinder block */}
                <div className="relative aspect-square w-full max-w-[240px] rounded-2xl bg-black overflow-hidden border-2 border-indigo-500 shadow-inner flex items-center justify-center">
                  <video
                    ref={qrVideoRef}
                    playsInline
                    className="w-full h-full object-cover"
                  />

                  {/* Laser effect */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.7)] z-10 animate-bounce" />

                  {/* Target sight brackets */}
                  <div className="absolute top-3 right-3 w-5 h-5 border-t-4 border-r-4 border-white opacity-80 rounded-tr" />
                  <div className="absolute top-3 left-3 w-5 h-5 border-t-4 border-l-4 border-white opacity-80 rounded-tl" />
                  <div className="absolute bottom-3 right-3 w-5 h-5 border-b-4 border-r-4 border-white opacity-80 rounded-br" />
                  <div className="absolute bottom-3 left-3 w-5 h-5 border-b-4 border-l-4 border-white opacity-80 rounded-bl" />

                  {/* Scanned success state overlay */}
                  {scannedSuccessId && (
                    <div className="absolute inset-0 bg-indigo-950/95 flex flex-col items-center justify-center text-white p-4 text-center z-25 leading-relaxed">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-lg text-lg animate-bounce">
                        ✔️
                      </div>
                      <p className="text-xs font-black mt-3">تم قراءة الرمز بنجاح!</p>
                      <p className="text-[10px] text-indigo-200 mt-1">
                        جاري فتح ملف: {students.find(s => s.id === scannedSuccessId)?.name}
                      </p>
                    </div>
                  )}
                </div>

                {/* Subtext description */}
                {scannerError ? (
                  <div className="mt-4 p-3 bg-red-50 border border-red-150 rounded-xl text-red-700 text-[10px] font-bold text-center leading-relaxed">
                    ⚠️ {scannerError}
                  </div>
                ) : (
                  <div className="mt-4 text-slate-500 text-[10px] font-semibold text-center leading-relaxed">
                    سيقوم النظام بقراءة الرمز وتوجيهك لملف الطالب المالي والدراسي فوراً بشكل آمن.
                  </div>
                )}
              </div>

              {/* Bottom control info footer */}
              <div className="bg-slate-550/10 p-3 flex justify-center border-t border-slate-100 font-bold text-[10px] text-slate-450">
                🔒 يشفر رمز QR معلومات معرّف الطالب لحماية الخصوصية.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
