import React, { useState } from 'react';
import { Student, StudentType, Appointment } from '../types';
import { UserPlus, Search, Phone, CalendarRange, Layers, GraduationCap, X, Trash2, AlertTriangle, Camera, User, Bell, MessageCircle, Edit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
      totalLessonsCount: undefined,
      dueDate: type === 'course' ? '1 في الشهر' : undefined,
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
        {/* TOTAL STUDENTS */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.005 }}
          className="bg-indigo-50/45 border-2 border-indigo-400/80 rounded-[24px] p-5.5 shadow-3xs relative overflow-hidden group transition-all duration-300 hover:shadow-md"
        >
          <div className="absolute right-0 top-0 w-2 h-full bg-indigo-500" />
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs font-black text-indigo-900 pr-1 select-none">إجمالي المقيدين بالدفعة</p>
            <span className="p-2.5 bg-indigo-100 text-indigo-750 rounded-2xl group-hover:scale-105 transition-transform duration-300">
              <GraduationCap size={18} />
            </span>
          </div>
          <div className="mt-3.5 flex items-baseline justify-start gap-1.5 pr-1">
            <span className="text-3xl font-extrabold text-indigo-900 tracking-tight leading-none font-sans">
              {students.length}
            </span>
            <span className="text-[11px] font-black text-indigo-600">طلاب وطالبات</span>
          </div>
          <p className="text-[10px] text-indigo-700/80 font-medium mt-3.5 pr-1 select-none">العدد الكلي للمقيدين الفعليين بالبرنامج التعليمي والمجموعة.</p>
        </motion.div>

        {/* LESSON SYSTEM */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.005 }}
          className="bg-teal-50/45 border-2 border-teal-400/80 rounded-[24px] p-5.5 shadow-3xs relative overflow-hidden group transition-all duration-300 hover:shadow-md"
        >
          <div className="absolute right-0 top-0 w-2 h-full bg-teal-500" />
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs font-black text-teal-900 pr-1 select-none">نظام المحاسبة بالحصة</p>
            <span className="p-2.5 bg-teal-100 text-teal-700 rounded-2xl group-hover:scale-105 transition-transform duration-300">
              <CalendarRange size={18} />
            </span>
          </div>
          <div className="mt-3.5 flex items-baseline justify-start gap-1.5 pr-1">
            <span className="text-3xl font-extrabold text-teal-900 tracking-tight leading-none font-sans">
              {students.filter(s => s.type === 'lesson').length}
            </span>
            <span className="text-[11px] font-black text-teal-600">طالب نشط بالحصة</span>
          </div>
          <p className="text-[10px] text-teal-700/80 font-medium mt-3.5 pr-1 select-none">الطلاب التابعين للمحاسبة الفردية لكل حضور دراسي مسجل.</p>
        </motion.div>

        {/* COURSE SYSTEM */}
        <motion.div 
          whileHover={{ y: -3, scale: 1.005 }}
          className="bg-pink-50/45 border-2 border-pink-400/80 rounded-[24px] p-5.5 shadow-3xs relative overflow-hidden group transition-all duration-300 hover:shadow-md"
        >
          <div className="absolute right-0 top-0 w-2 h-full bg-pink-500" />
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs font-black text-pink-900 pr-1 select-none">نظام الاشتراك بالكورسات</p>
            <span className="p-2.5 bg-pink-100 text-pink-700 rounded-2xl group-hover:scale-105 transition-transform duration-300">
              <Layers size={18} />
            </span>
          </div>
          <div className="mt-3.5 flex items-baseline justify-start gap-1.5 pr-1">
            <span className="text-3xl font-extrabold text-pink-900 tracking-tight leading-none font-sans">
              {students.filter(s => s.type === 'course').length}
            </span>
            <span className="text-[11px] font-black text-pink-600">طالب حالي بالكورس</span>
          </div>
          <p className="text-[10px] text-pink-700/80 font-medium mt-3.5 pr-1 select-none">المنضمون للباقات التعليمية الشهرية والكورسات الكاملة.</p>
        </motion.div>
      </div>

      {/* Filters and Search and Actions */}
      <div className="bg-white border border-slate-100 rounded-[26px] p-5 shadow-3xs flex flex-col xl:flex-row gap-5 items-center justify-between">
        
        {/* Search Input Box */}
        <div className="relative w-full xl:w-[380px]">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-440 pointer-events-none select-none">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="ابحث بالنقر عن اسم طالب أو هاتف المتابعة للطلب..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-11 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50/70 transition-all duration-300 premium-input"
          />
        </div>

        {/* Action Controls & Filters Custom Styling */}
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-4 w-full xl:w-auto justify-end">
          
          {/* Sub-group 1: System Types */}
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200/60 text-[11px] font-black w-full sm:w-auto justify-center select-none">
            <button
               onClick={() => setFilterType('all')}
               className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                 filterType === 'all' 
                   ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-xs' 
                   : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/30'
               }`}
             >
               كافة الأنظمة
             </button>
             <button
               onClick={() => setFilterType('lesson')}
               className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                 filterType === 'lesson' 
                   ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-xs' 
                   : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/30'
               }`}
             >
               بالحصة
             </button>
             <button
               onClick={() => setFilterType('course')}
               className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                 filterType === 'course' 
                   ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-xs' 
                   : 'text-slate-600 hover:text-slate-800 hover:bg-slate-200/30'
               }`}
             >
               بالكورس
             </button>
          </div>

          {/* Sub-group 2: Student Statuses */}
          <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200/60 text-[11px] font-black w-full sm:w-auto justify-center select-none">
            <button
              onClick={() => setFilterStatus('all')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                filterStatus === 'all' 
                  ? 'bg-slate-800 text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
              }`}
            >
              الكل
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                filterStatus === 'active' 
                  ? 'bg-emerald-600 text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
              }`}
            >
              النشطين
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                filterStatus === 'inactive' 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/30'
              }`}
            >
              المتوقفين
            </button>
          </div>

          {/* Add Student CTA Button */}
          <button
            onClick={() => setIsOpenAddModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white text-xs font-black rounded-2xl cursor-pointer shadow-sm shadow-indigo-600/10 shrink-0"
          >
            <UserPlus size={15} />
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
            return (
              <motion.div
                key={student.id}
                layoutId={`card-${student.id}`}
                whileHover={{ scale: 1.02, y: -2 }}
                transition={{ type: "spring", stiffness: 350, damping: 28 }}
                onClick={() => onSelectStudent(student.id)}
                className={`group bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-4.5 flex items-center justify-between relative cursor-pointer shadow-3xs hover:shadow-xs transition-colors duration-300 ${
                  !student.active ? 'opacity-65 hover:opacity-95' : ''
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Elegant User Initial Badge */}
                  <div 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0 shadow-sm ${
                      !student.cardColor ? (student.active 
                        ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/10' 
                        : 'bg-gradient-to-tr from-slate-400 to-slate-500 shadow-slate-400/10') : ''
                    }`}
                    style={student.cardColor && student.active ? { backgroundColor: student.cardColor } : undefined}
                  >
                    {student.name.trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors duration-250 truncate">
                      {student.name}
                    </h3>
                  </div>
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
                  <label className="text-xs text-slate-655 font-bold block">اسم الطالب الثنائي/الكامل *</label>
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
                  <label className="text-xs text-slate-655 font-bold block">رقم الهاتف (واتساب/اتصال)</label>
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
                  <label className="text-xs text-slate-655 font-bold block">حالة الطالب بالمنصة *</label>
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
                  <label className="text-xs text-slate-655 font-bold block">نظام التعلم والمحاسبة *</label>
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
                        <label className="text-xs text-slate-655 font-bold block">ثمن حصة الطالب الفردية ({currency}) *</label>
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
                  <label className="text-xs text-slate-655 font-bold block mb-1">صورة الطالب (اختياري)</label>
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
                          className="absolute -top-1.5 -right-1.5 bg-slate-100 border border-slate-200 hover:bg-red-50 hover:text-red-650 rounded-full p-0.5 text-slate-500"
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
                    <label htmlFor="edit-student-auto-reminder" className="text-xs text-slate-655 font-bold cursor-pointer select-none">
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
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed font-sans">
                    هل أنت متأكد من حذف الطالب <span className="font-extrabold text-slate-800">"{deleteConfirmStudent.name}"</span>؟
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 text-xs space-y-2 mb-5 text-slate-600 font-sans">
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
                  className="px-4.5 py-2.5 text-slate-600 hover:text-slate-800 bg-slate-100/80 hover:bg-slate-200 rounded-xl cursor-pointer"
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
                  <label className="block text-[11px] font-black text-slate-707 mb-1.5">تاريخ الحدوث والتذكير *</label>
                  <input
                    type="date"
                    required
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                    className="w-full text-xs font-bold text-slate-700 p-2.5 border border-slate-200 focus:outline-none focus:border-amber-400 bg-slate-50 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-705 mb-1.5">نص وملاحظة التذكير (مثال: متابعة واجب، تذكير بدفعة)</label>
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
                  className="px-4 py-2.5 text-slate-650 hover:text-slate-855 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer font-bold"
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

    </div>
  );
}
