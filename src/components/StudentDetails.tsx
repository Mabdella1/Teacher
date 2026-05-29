import React, { useState, useEffect } from 'react';
import { Student, Session, Payment, RewardTransaction, Appointment } from '../types';
import { 
  ArrowLeft, FileSpreadsheet, Plus, DollarSign, Clock, Notebook, 
  Trash2, Phone, Sparkles, CheckCircle, HelpCircle, CalendarCheck, CreditCard, 
  TrendingUp, AlertTriangle, FileText, Download, Loader2, User, Camera, Upload, X,
  Award, Gift, History, Edit, Share2, Send, Filter, BookOpen, MessageCircle, QrCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';
import { formatTimeTo12h } from '../lib/timeUtils';

interface StudentDetailsProps {
  student: Student;
  onBack: () => void;
  onUpdateStudent: (id: string, updatedFields: Partial<Student>) => void;
  currency: string;
  appointments: Appointment[];
}

export default function StudentDetails({ student, onBack, onUpdateStudent, currency, appointments }: StudentDetailsProps) {
  const studentAppointments = appointments?.filter(appt => appt.studentId === student.id) || [];
  const [activeTab, setActiveTab] = useState<'sessions' | 'payments' | 'rewards' | 'studyNotes' | 'whatsAppTemplates'>('sessions');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'session-over-limit' | 'delete-session' | 'delete-payment' | 'print-error';
    data?: any;
  } | null>(null);

  // States for Gemini AI Student Attendance Analysis
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Student QR Code Identity state and generator
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  useEffect(() => {
    let active = true;
    QRCode.toDataURL(`student-qr:${student.id}`, { 
      margin: 1.5, 
      width: 256,
      color: {
        dark: '#1e293b', // Deep slate for ideal scanning readability
        light: '#ffffff'
      }
    }, (err, url) => {
      if (!err && active) {
        setQrCodeUrl(url);
      }
    });
    return () => { active = false; };
  }, [student.id]);

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `QR_${student.name.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Photo editing state for student details profile card
  const [isDetailsCameraActive, setIsDetailsCameraActive] = useState(false);
  const detailsVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const detailsStreamRef = React.useRef<MediaStream | null>(null);

  const startDetailsCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      detailsStreamRef.current = stream;
      if (detailsVideoRef.current) {
        detailsVideoRef.current.srcObject = stream;
        detailsVideoRef.current.play();
      }
      setIsDetailsCameraActive(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopDetailsCamera = () => {
    if (detailsStreamRef.current) {
      detailsStreamRef.current.getTracks().forEach(track => track.stop());
      detailsStreamRef.current = null;
    }
    setIsDetailsCameraActive(false);
  };

  const captureDetailsPhoto = () => {
    if (detailsVideoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = detailsVideoRef.current.videoWidth || 300;
      canvas.height = detailsVideoRef.current.videoHeight || 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(-1, 1);
        ctx.drawImage(detailsVideoRef.current, -canvas.width, 0, canvas.width, canvas.height);
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
            onUpdateStudent(student.id, { photo: resizeCanvas.toDataURL('image/jpeg', 0.8) });
          }
        };
      }
      stopDetailsCamera();
    }
  };

  const handleDetailsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
            onUpdateStudent(student.id, { photo: resizeCanvas.toDataURL('image/jpeg', 0.8) });
          }
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const removeDetailsPhoto = () => {
    onUpdateStudent(student.id, { photo: undefined });
  };

  // Register Session Form State
  const [sessionDate, setSessionDate] = useState(() => {
    const local = new Date();
    return local.toISOString().split('T')[0];
  });
  const [sessionTime, setSessionTime] = useState(() => {
    const local = new Date();
    const hours = String(local.getHours()).padStart(2, '0');
    const mins = String(local.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
  });
  const [sessionNotes, setSessionNotes] = useState('');
  const [sessionIsExtra, setSessionIsExtra] = useState(false);
  const [sessionExtraPrice, setSessionExtraPrice] = useState('100');
  const [isOpenSessionForm, setIsOpenSessionForm] = useState(false);

  // Register Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => {
    const local = new Date();
    return local.toISOString().split('T')[0];
  });
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isPaymentOnTime, setIsPaymentOnTime] = useState(true);
  const [isOpenPaymentForm, setIsOpenPaymentForm] = useState(false);

  // Rewards System form states
  const [customAdjustmentPoints, setCustomAdjustmentPoints] = useState('');
  const [customAdjustmentNotes, setCustomAdjustmentNotes] = useState('');
  const [customRewardPoints, setCustomRewardPoints] = useState('');
  const [customRewardDiscount, setCustomRewardDiscount] = useState('');
  const [customRewardNotes, setCustomRewardNotes] = useState('');

  useEffect(() => {
    if (isOpenPaymentForm) {
      if (student.dueDate) {
        const today = new Date().toISOString().split('T')[0];
        setIsPaymentOnTime(today <= student.dueDate);
      } else {
        setIsPaymentOnTime(true);
      }
    }
  }, [isOpenPaymentForm, student.dueDate]);

  // Edit Settings/Status
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editRate, setEditRate] = useState(String(student.lessonRate || 100));
  const [editPrice, setEditPrice] = useState(String(student.coursePrice || 800));
  const [editTotalSessions, setEditTotalSessions] = useState(String(student.totalLessonsCount || 8));
  const [editDueDate, setEditDueDate] = useState(student.dueDate || '');
  const [editAutoReminder, setEditAutoReminder] = useState(student.autoReminder || false);

  useEffect(() => {
    setEditRate(String(student.lessonRate || 100));
    setEditPrice(String(student.coursePrice || 800));
    setEditTotalSessions(String(student.totalLessonsCount || 8));
    setEditDueDate(student.dueDate || '');
    setEditAutoReminder(student.autoReminder || false);
    // Reset AI recommendation states on student switch
    setAiAdvice(null);
    setAiError(null);
  }, [student.id, student.lessonRate, student.coursePrice, student.totalLessonsCount, student.dueDate, student.autoReminder]);

  // Study Notes State Handlers
  const [isOpenNoteForm, setIsOpenNoteForm] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteType, setNoteType] = useState<'academic' | 'behavior' | 'homework' | 'exam' | 'general'>('general');
  const [noteDate, setNoteDate] = useState(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const adj = new Date(local.getTime() - (offset * 60 * 1000));
    return adj.toISOString().split('T')[0];
  });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [searchNotesQuery, setSearchNotesQuery] = useState('');
  const [filterNotesType, setFilterNotesType] = useState<'all' | 'academic' | 'behavior' | 'homework' | 'exam' | 'general'>('all');

  const handleSaveStudyNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    const currentNotes = student.studyNotes || [];
    
    if (editingNoteId) {
      const updatedNotes = currentNotes.map(n => 
        n.id === editingNoteId 
          ? { 
              ...n, 
              content: noteContent.trim(), 
              title: noteTitle.trim() || undefined, 
              type: noteType, 
              date: noteDate 
            } 
          : n
      );
      onUpdateStudent(student.id, { studyNotes: updatedNotes });
    } else {
      const newNote = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        content: noteContent.trim(),
        title: noteTitle.trim() || undefined,
        type: noteType,
        date: noteDate,
      };
      const updatedNotes = [newNote, ...currentNotes];
      onUpdateStudent(student.id, { studyNotes: updatedNotes });
    }

    // Reset Form
    setNoteContent('');
    setNoteTitle('');
    setNoteType('general');
    setEditingNoteId(null);
    setIsOpenNoteForm(false);
  };

  const handleStartEditNote = (note: any) => {
    setNoteContent(note.content);
    setNoteTitle(note.title || '');
    setNoteType(note.type);
    setNoteDate(note.date);
    setEditingNoteId(note.id);
    setIsOpenNoteForm(true);
  };

  const handleDeleteStudyNote = (noteId: string) => {
    const currentNotes = student.studyNotes || [];
    const updatedNotes = currentNotes.filter(n => n.id !== noteId);
    onUpdateStudent(student.id, { studyNotes: updatedNotes });
  };

  // WhatsApp Templates component state & saving handlers
  const [templateTitle, setTemplateTitle] = useState('');
  const [templateText, setTemplateText] = useState('');
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isOpenTemplateForm, setIsOpenTemplateForm] = useState(false);

  const handleSaveWhatsAppTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateTitle.trim() || !templateText.trim()) return;

    const currentTemplates = student.whatsAppTemplates || [];
    let updatedTemplates;

    if (editingTemplateId) {
      updatedTemplates = currentTemplates.map(t => 
        t.id === editingTemplateId 
          ? { ...t, title: templateTitle.trim(), text: templateText.trim() } 
          : t
      );
    } else {
      const newTemplate = {
        id: `tpl-${Date.now()}`,
        title: templateTitle.trim(),
        text: templateText.trim()
      };
      updatedTemplates = [...currentTemplates, newTemplate];
    }

    onUpdateStudent(student.id, { whatsAppTemplates: updatedTemplates });

    // Reset Form
    setTemplateTitle('');
    setTemplateText('');
    setEditingTemplateId(null);
    setIsOpenTemplateForm(false);
  };

  const handleStartEditTemplate = (tpl: { id: string; title: string; text: string }) => {
    setTemplateTitle(tpl.title);
    setTemplateText(tpl.text);
    setEditingTemplateId(tpl.id);
    setIsOpenTemplateForm(true);
  };

  const handleDeleteWhatsAppTemplate = (tplId: string) => {
    const currentTemplates = student.whatsAppTemplates || [];
    const updatedTemplates = currentTemplates.filter(t => t.id !== tplId);
    onUpdateStudent(student.id, { whatsAppTemplates: updatedTemplates });
  };

  // Calculate stats
  const sessionsCount = student.sessions.length;
  const standardSessionsCount = student.sessions.filter(s => !s.isExtra).length;
  const extraSessionsCount = student.sessions.filter(s => s.isExtra).length;
  const extraSessionsTotalCost = student.sessions.filter(s => s.isExtra).reduce((sum, s) => sum + (s.extraPrice || 0), 0);
  const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);

  let totalCost = 0;
  let remainingInCourse = 0;
  let outstandingBalance = 0;

  if (student.type === 'lesson') {
    totalCost = sessionsCount * (student.lessonRate || 0);
    outstandingBalance = totalCost - totalPaid;
  } else {
    totalCost = (student.coursePrice || 0) + extraSessionsTotalCost;
    remainingInCourse = student.totalLessonsCount !== undefined 
      ? Math.max(0, (student.totalLessonsCount || 0) - standardSessionsCount)
      : 0;
    outstandingBalance = totalCost - totalPaid;
  }

  // Calculate paid and unpaid sessions (only for lesson system/type)
  const chronologicalSessions = [...student.sessions].reverse(); // oldest first
  let remainingMoney = totalPaid;
  const sessionCost = student.lessonRate || 0;

  const sessionPaymentStatuses = chronologicalSessions.map((session) => {
    let isPaid = false;
    if (student.type !== 'lesson') {
      isPaid = false;
    } else if (sessionCost <= 0) {
      isPaid = true;
    } else if (remainingMoney >= sessionCost - 0.01) {
      isPaid = true;
      remainingMoney -= sessionCost;
    } else {
      isPaid = false;
    }
    return {
      id: session.id,
      isPaid,
    };
  });

  const isSessionPaidMap = new Map(sessionPaymentStatuses.map(s => [s.id, s.isPaid]));
  const paidSessionsCount = sessionPaymentStatuses.filter(s => s.isPaid).length;
  const unpaidSessionsCount = sessionPaymentStatuses.length - paidSessionsCount;

  const handleRegisterSession = (e: React.FormEvent) => {
    e.preventDefault();
    const isOverLimit = !sessionIsExtra && student.type === 'course' && student.totalLessonsCount !== undefined && standardSessionsCount >= student.totalLessonsCount;
    if (isOverLimit) {
      setConfirmDialog({
        type: 'session-over-limit',
        data: { date: sessionDate, time: sessionTime, notes: sessionNotes }
      });
      return;
    }

    const extraPriceNum = sessionIsExtra ? parseFloat(sessionExtraPrice) || 0 : undefined;
    executeRegisterSession(sessionDate, sessionTime, sessionNotes, sessionIsExtra, extraPriceNum);
  };

  const executeRegisterSession = (date: string, time: string, notes: string, isExtra?: boolean, extraPrice?: number) => {
    const newSession: Session = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      date: date,
      time: time,
      notes: notes.trim() || undefined,
      isExtra: isExtra || undefined,
      extraPrice: isExtra ? (extraPrice ?? 100) : undefined
    };

    const updatedSessions = [newSession, ...student.sessions];
    
    const earnedPoints = 10;
    const currentPoints = student.rewardPoints || 0;
    const newPoints = currentPoints + earnedPoints;
    const newTx: RewardTransaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      type: 'earn',
      amount: earnedPoints,
      reason: 'session',
      description: `حضور حصة ${isExtra ? 'إضافية' : 'أساسية'} في تاريخ ${date}`,
      date: new Date().toISOString().split('T')[0]
    };
    const updatedTxs = [newTx, ...(student.rewardTransactions || [])];

    onUpdateStudent(student.id, { 
      sessions: updatedSessions,
      rewardPoints: newPoints,
      rewardTransactions: updatedTxs
    });
    
    // Reset
    setSessionNotes('');
    setSessionIsExtra(false);
    setSessionExtraPrice('100');
    setIsOpenSessionForm(false);
  };

  const handleQuickRegisterSession = () => {
    const isOverLimit = student.type === 'course' && student.totalLessonsCount !== undefined && standardSessionsCount >= student.totalLessonsCount;
    const local = new Date();
    const yyyy = local.getFullYear();
    const mm = String(local.getMonth() + 1).padStart(2, '0');
    const dd = String(local.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    
    const hours = String(local.getHours()).padStart(2, '0');
    const mins = String(local.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${mins}`;

    if (isOverLimit) {
      setConfirmDialog({
        type: 'session-over-limit',
        data: { date: dateStr, time: timeStr, notes: "" }
      });
      return;
    }
    
    executeRegisterSession(dateStr, timeStr, "");
  };

  const handleRegisterPayment = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const newPayment: Payment = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      amount: parsedAmount,
      date: paymentDate,
      notes: paymentNotes.trim() || undefined,
    };

    const updatedPayments = [newPayment, ...student.payments];
    
    // Earn points for payment
    const earnedPoints = isPaymentOnTime ? 25 : 5;
    const currentPoints = student.rewardPoints || 0;
    const newPoints = currentPoints + earnedPoints;
    const newTx: RewardTransaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      type: 'earn',
      amount: earnedPoints,
      reason: 'payment_ontime',
      description: isPaymentOnTime 
        ? `تسديد دفعة في الموعد بقيمة ${parsedAmount} ${currency}`
        : `تسديد دفعة بقيمة ${parsedAmount} ${currency}`,
      date: new Date().toISOString().split('T')[0]
    };
    const updatedTxs = [newTx, ...(student.rewardTransactions || [])];

    // Extend due date in Course if they settle full
    let nextFields: Partial<Student> = { 
      payments: updatedPayments,
      rewardPoints: newPoints,
      rewardTransactions: updatedTxs
    };
    if (student.type === 'course' && outstandingBalance - parsedAmount <= 0) {
      nextFields.dueDate = '';
    }

    onUpdateStudent(student.id, nextFields);

    // Reset
    setPaymentAmount('');
    setPaymentNotes('');
    setIsOpenPaymentForm(false);
  };

  const handleRedeemReward = (type: 'discount' | 'free_class' | 'custom' | 'manual_add', data?: { points: number, amount?: number, description?: string }) => {
    const currentPoints = student.rewardPoints || 0;
    
    let costPoints = 0;
    let discountAmount = 0;
    let description = '';
    let reason: 'redeem_discount' | 'redeem_free_session' | 'manual' = 'redeem_discount';
    
    if (type === 'discount') {
      costPoints = data?.points || 50;
      discountAmount = data?.amount || 20;
      description = `🎁 استرداد مكافأة: خصم بقيمة ${discountAmount} ${currency}`;
      reason = 'redeem_discount';
    } else if (type === 'free_class') {
      costPoints = 120;
      discountAmount = student.type === 'lesson' ? (student.lessonRate || 100) : 100;
      description = `🎁 استرداد مكافأة: حصة مجانية بالكامل (قيمة ${discountAmount} ${currency})`;
      reason = 'redeem_free_session';
    } else if (type === 'custom') {
      costPoints = data?.points || 0;
      discountAmount = data?.amount || 0;
      description = data?.description || 'استرداد مكافأة مخصصة';
      reason = 'redeem_discount';
    } else if (type === 'manual_add') {
      const pointsToChange = data?.points || 0;
      const changeDesc = data?.description || 'نقاط تشجيعية من المعلم';
      
      const newPoints = Math.max(0, currentPoints + pointsToChange);
      
      const newTx: RewardTransaction = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        type: pointsToChange >= 0 ? 'earn' : 'redeem',
        amount: Math.abs(pointsToChange),
        reason: 'manual',
        description: changeDesc,
        date: new Date().toISOString().split('T')[0]
      };
      
      onUpdateStudent(student.id, {
        rewardPoints: newPoints,
        rewardTransactions: [newTx, ...(student.rewardTransactions || [])]
      });
      return;
    }
    
    if (currentPoints < costPoints) {
      alert(`عفواً، رصيد نقاط الطالب غير كافٍ! يحتاج الطالب إلى ${costPoints} نقطة لشحن هذه المكافأة، بينما يمتلك حالياً ${currentPoints} نقطة.`);
      return;
    }
    
    // Process points conversion
    const newPoints = currentPoints - costPoints;
    const newTx: RewardTransaction = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      type: 'redeem',
      amount: costPoints,
      reason: reason,
      description: description,
      date: new Date().toISOString().split('T')[0]
    };
    
    // Process the reward discount as a virtual payment so user's financial balances are automatically lowered & updated!
    const newPayment: Payment = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      amount: discountAmount,
      date: new Date().toISOString().split('T')[0],
      notes: `🎁 استرداد نقاط مكافأة (${costPoints} نقطة) - خصم تلقائي`
    };
    
    const updatedPayments = [newPayment, ...student.payments];
    const updatedTxs = [newTx, ...(student.rewardTransactions || [])];
    
    onUpdateStudent(student.id, {
      rewardPoints: newPoints,
      rewardTransactions: updatedTxs,
      payments: updatedPayments
    });
  };

  const handleAnalyzeStudent = async () => {
    setIsAnalyzing(true);
    setAiError(null);
    try {
      const response = await fetch("/api/analyze-student", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentName: student.name,
          sessions: student.sessions,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "حدث خطأ غير متوقع أثناء معالجة البيانات بالذكاء الاصطناعي");
      }

      const data = await response.json();
      setAiAdvice(data.advice);
    } catch (err: any) {
      console.error(err);
      setAiError(err instanceof Error ? err.message : "فشلت معالجة ذكاء اصطناعي");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getMonthlyAttendanceData = () => {
    if (!student.sessions || student.sessions.length === 0) return [];
    
    const monthsMap: { [key: string]: { count: number; extraCount: number; sNo: number } } = {};
    const arabicMonthsShort = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    
    student.sessions.forEach(session => {
      if (!session.date) return;
      const parts = session.date.split('-');
      if (parts.length < 2) return;
      const year = parseInt(parts[0], 10);
      const monthIdx = parseInt(parts[1], 10) - 1; // 0-11
      const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      
      if (!monthsMap[key]) {
        monthsMap[key] = {
          count: 0,
          extraCount: 0,
          sNo: year * 105 + monthIdx,
        };
      }
      
      monthsMap[key].count += 1;
      if (session.isExtra) {
        monthsMap[key].extraCount += 1;
      }
    });

    return Object.entries(monthsMap)
      .map(([key, data]) => {
        const parts = key.split('-');
        const y = parts[0];
        const mIdx = parseInt(parts[1], 10) - 1;
        const monthLabel = arabicMonthsShort[mIdx] || `شهر ${mIdx + 1}`;
        return {
          key,
          label: `${monthLabel} ${y}`,
          count: data.count,
          extraCount: data.extraCount,
          regularCount: data.count - data.extraCount,
          sortNo: data.sNo,
        };
      })
      .sort((a, b) => a.sortNo - b.sortNo);
  };

  const handleDeleteSession = (sessionId: string) => {
    setConfirmDialog({
      type: 'delete-session',
      data: sessionId
    });
  };

  const executeDeleteSession = (sessionId: string) => {
    const updatedSessions = student.sessions.filter(s => s.id !== sessionId);
    onUpdateStudent(student.id, { sessions: updatedSessions });
  };

  const handleDeletePayment = (paymentId: string) => {
    setConfirmDialog({
      type: 'delete-payment',
      data: paymentId
    });
  };

  const executeDeletePayment = (paymentId: string) => {
    const updatedPayments = student.payments.filter(p => p.id !== paymentId);
    onUpdateStudent(student.id, { payments: updatedPayments });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateStudent(student.id, {
      lessonRate: student.type === 'lesson' ? parseFloat(editRate) || 0 : undefined,
      coursePrice: student.type === 'course' ? parseFloat(editPrice) || 0 : undefined,
      totalLessonsCount: student.type === 'course' ? parseInt(editTotalSessions) || 0 : undefined,
      dueDate: student.type === 'course' && editDueDate ? editDueDate : undefined,
      autoReminder: editAutoReminder,
    });
    setIsEditingSettings(false);
  };

  const handleExportIndividualCSV = () => {
    let csvContent = '\ufeff'; // UTF-8 BOM so Excel decodes Arabic text
    csvContent += `تقرير كشف الحساب للطالب: ${student.name}\n`;
    csvContent += `رقم الهاتف: ${student.phone || 'غير مسجل'}\n`;
    csvContent += `نوع الاشتراك: ${student.type === 'lesson' ? 'نظام الحصص' : 'نظام الكورس'}\n`;
    csvContent += `العملة: ${currency}\n`;
    
    if (student.type === 'lesson') {
      csvContent += `سعر الحصة: ${student.lessonRate}\n`;
      csvContent += `إجمالي الحصص المسجلة: ${sessionsCount}\n`;
      csvContent += `إجمالي القيمة المستحقة: ${totalCost}\n`;
    } else {
      csvContent += `سعر الكورس الكلي: ${student.coursePrice}\n`;
      csvContent += `عدد الحصص المقررة: ${student.totalLessonsCount}\n`;
      csvContent += `الحصص المكتملة: ${sessionsCount}\n`;
      csvContent += `الحصص المتبقية: ${remainingInCourse}\n`;
    }
    
    csvContent += `إجمالي المبلغ المدفوع: ${totalPaid}\n`;
    csvContent += `المبلغ المتبقي: ${outstandingBalance}\n\n`;

    // Add Sessions Section
    csvContent += '--- سجل الحصص والتحضير ---\n';
    csvContent += 'مسلسل,التاريخ,الوقت,ملاحظات المدرس\n';
    student.sessions.forEach((s, idx) => {
      csvContent += `"${student.sessions.length - idx}","${s.date}","${s.time}","${s.notes || ''}"\n`;
    });
    csvContent += '\n';

    // Add Payments Section
    csvContent += '--- سجل المدفوعات والدفعات ---\n';
    csvContent += 'مسلسل,التاريخ,المبلغ المدفوع,ملاحظات ومخرجات\n';
    student.payments.forEach((p, idx) => {
      csvContent += `"${student.payments.length - idx}","${p.date}","${p.amount} ${currency}","${p.notes || ''}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `كشف_حساب_${student.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    handleExportPDF();
  };

  const handleExportPDF = async () => {
    const element = document.getElementById('student-pdf-report');
    if (!element) return;

    setIsGeneratingPDF(true);
    try {
      // Small timeout to allow any re-renderings to flush
      await new Promise((resolve) => setTimeout(resolve, 200));

      const canvas = await html2canvas(element, {
        scale: 2.2, // Ultra-sharp high quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
      
      // Calculate scaled heights
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Wrap if longer than single page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      pdf.save(`كشف_حساب_الطالب_${student.name.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation Top Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-800 rounded-xl transition-all cursor-pointer font-bold text-sm active:scale-95 shadow-sm"
        >
          <ArrowLeft size={16} />
          <span>العودة للطلاب</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleExportPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 border border-blue-150 text-blue-700 hover:bg-blue-100 disabled:opacity-50 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-sm"
            title="تصدير كشف الحساب بملف PDF منسق وجاهز للطباعة بدعم كامل للغة العربية"
          >
            {isGeneratingPDF ? (
              <Loader2 size={15} className="animate-spin text-blue-600" />
            ) : (
              <Download size={15} className="text-blue-600" />
            )}
            <span>{isGeneratingPDF ? 'جاري التوليد...' : 'حفظ كـ PDF منسق'}</span>
          </button>
          <button
            onClick={handleExportIndividualCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 border border-indigo-150 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-sm"
          >
            <FileSpreadsheet size={15} />
            <span>تصدير Excel</span>
          </button>
          <button
            onClick={handlePrintReport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-150 text-rose-700 hover:bg-rose-100 rounded-xl transition-all font-bold text-xs cursor-pointer shadow-sm"
          >
            <Download size={15} />
            <span>تنزيل تقرير PDF تلقائياً</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Student Information Page Header */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Details Sidebar Card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="premium-card p-6 relative overflow-hidden">
            {/* Top design ribbon depending on type */}
            <div className={`absolute top-0 right-0 left-0 h-1.5 ${
              student.type === 'lesson' ? 'bg-indigo-500' : 'bg-pink-500'
            }`} />

            <div className="flex justify-between items-start pt-2">
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                student.type === 'lesson' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-pink-50 text-pink-700 border border-pink-100'
              }`}>
                {student.type === 'lesson' ? 'نظام حصص' : 'نظام كورس'}
              </span>

              <button
                onClick={() => onUpdateStudent(student.id, { active: !student.active })}
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold cursor-pointer transition-all ${
                  student.active 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : 'bg-red-50 text-red-700 border border-red-100'
                }`}
              >
                {student.active ? 'نشط (اضغط للتعطيل)' : 'معطل (اضغط للتنشيط)'}
              </button>
            </div>

            {/* Restructured 2-Column Grid Layout inside the card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5 items-start">
              
              {/* Column 1: Contact Details & Communication */}
              <div className="space-y-4">
                {/* Contact & Profile Identity Info */}
                <div className="flex flex-col items-center text-center space-y-3 bg-slate-50/50 p-4.5 rounded-2xl border border-slate-150/65">
                {/* Student Profile Avatar */}
                <div className="flex flex-col items-center">
                  <div className="w-22 h-22 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-350 shadow-inner shrink-0">
                    <User size={36} />
                  </div>

                  {/* Live camera stream view in sidebar if active */}
                  {isDetailsCameraActive && (
                    <div className="mt-3 w-full bg-white p-2.5 rounded-2xl border border-slate-200 text-center space-y-2 shadow-xs">
                      <div className="relative aspect-video rounded-lg bg-black overflow-hidden border border-slate-300">
                        <video
                          ref={detailsVideoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover scale-x-[-1]"
                        />
                      </div>
                      <div className="flex gap-1.5 justify-center">
                        <button
                          type="button"
                          onClick={captureDetailsPhoto}
                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-[10px] font-bold cursor-pointer"
                        >
                          التقاط 📸
                        </button>
                        <button
                          type="button"
                          onClick={stopDetailsCamera}
                          className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-[10px] font-bold cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Simple non-hover editing helper labels for mobile/touch users */}
                  <div className="flex items-center gap-2 mt-2">
                    <label className="text-[9px] text-slate-400 font-extrabold hover:text-blue-600 cursor-pointer transition flex items-center gap-1">
                      <Upload size={10} />
                      <span>تغيير الصورة</span>
                      <input type="file" accept="image/*" onChange={handleDetailsFileChange} className="hidden" />
                    </label>
                    {typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && (
                      <>
                        <span className="text-slate-300 text-[9px]">|</span>
                        <button
                          type="button"
                          onClick={isDetailsCameraActive ? stopDetailsCamera : startDetailsCamera}
                          className="text-[9px] text-slate-400 font-extrabold hover:text-blue-600 cursor-pointer transition flex items-center gap-1"
                        >
                          <Camera size={10} />
                          <span>الكاميرا</span>
                        </button>
                      </>
                    )}
                    {student.photo && (
                      <>
                        <span className="text-slate-300 text-[9px]">|</span>
                        <button
                          type="button"
                          onClick={removeDetailsPhoto}
                          className="text-[9px] text-red-500 font-extrabold hover:text-red-750 cursor-pointer transition flex items-center gap-1"
                        >
                          <X size={10} />
                          <span>حذف</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="w-full">
                  <h2 className="text-lg font-black text-slate-800 leading-tight text-center">
                    {student.name}
                  </h2>

                  {student.phone && (
                    <div className="flex justify-center mt-2.5">
                      <a 
                        href={`https://wa.me/${student.phone.replace(/[^0-9]/g, '')}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-emerald-700 font-mono text-xs group bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-3xs hover:scale-102 transition-all"
                      >
                        <Phone size={12} className="text-slate-400 group-hover:text-emerald-500" />
                        <span>{student.phone}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md font-sans font-bold">واتساب</span>
                      </a>
                    </div>
                  )}
                </div>

                <div className="w-full border-t border-slate-200/60 pt-2.5 flex justify-between items-center text-[10px] text-slate-500">
                  <span>تاريخ التسجيل:</span>
                  <span className="font-extrabold text-slate-700">{student.createdAt}</span>
                </div>
              </div>

              {/* Visual Weekly Schedule View */}
              <div className="bg-slate-50/50 border border-slate-150/65 p-4 rounded-2xl space-y-3 text-right">
                <div className="flex items-center justify-between border-b border-slate-150/85 pb-2.5">
                  <span className="text-xs font-black text-slate-750 flex items-center gap-1.5">
                    <span className="text-blue-600">📅</span>
                    <span>التوزيع الأسبوعي للحصص</span>
                  </span>
                  <span className="text-[10px] font-black text-slate-500 px-2 py-0.5 bg-white border border-slate-200 rounded-md shadow-3xs">
                    المجموع: {studentAppointments.length}
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(day => {
                    const dayAppointments = studentAppointments.filter(appt => appt.dayOfWeek === day);
                    const hasAppt = dayAppointments.length > 0;
                    return (
                      <div 
                        className={`flex flex-col items-center p-1 rounded-lg border text-center transition-all ${
                          hasAppt 
                            ? 'bg-blue-50/95 border-blue-200 text-blue-700 font-bold shadow-3xs' 
                            : 'bg-white/40 border-slate-150/50 text-slate-400'
                        }`} 
                        key={day}
                      >
                        <span className="text-[9px] font-black leading-none mb-1 opacity-80">{day.replace('ال', '')}</span>
                        <div className="flex flex-col gap-0.5 w-full items-center">
                          {hasAppt ? (
                            dayAppointments.map(appt => (
                              <span 
                                key={appt.id} 
                                className="text-[9px] font-mono font-bold leading-none py-0.5 px-0.5 bg-white border border-blue-150 rounded text-blue-800 shadow-3xs w-full text-center truncate"
                                title={appt.notes}
                                dir="ltr"
                              >
                                {formatTimeTo12h(appt.time)}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] font-mono text-slate-350">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              </div>

              {/* Column 2: Academic & Financial Specifications & QR Identification */}
              <div className="space-y-4">
                <div className="bg-slate-50/50 border border-slate-150/65 p-4.5 rounded-2xl space-y-3.5 text-xs text-slate-550 flex flex-col justify-between h-full">
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-700 border-b border-slate-150/85 pb-2 flex items-center gap-1.5">
                    <span className="text-indigo-600">📊</span>
                    <span>المعلومات الدراسية والمالية</span>
                  </h3>

                  <div className="space-y-2">
                    {student.type === 'lesson' ? (
                      <div className="flex justify-between items-center bg-white border border-slate-150 p-2.5 rounded-xl">
                        <span className="font-bold text-slate-500 text-[11px]">سعر الحصة:</span>
                        <span className="font-black text-slate-830">
                          {student.lessonRate} {currency}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center bg-white border border-slate-150 p-2.5 rounded-xl">
                          <span className="font-bold text-slate-500 text-[11px]">قيمة الكورس المتفق عليها:</span>
                          <span className="font-black text-slate-830">
                            {student.coursePrice} {currency}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-white border border-slate-150 p-2.5 rounded-xl">
                          <span className="font-bold text-slate-500 text-[11px]">عدد الحصص الكلي:</span>
                          <span className="font-black text-slate-830">
                            {student.totalLessonsCount} حصة كورس
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-white border border-slate-150 p-2.5 rounded-xl">
                          <span className="font-bold text-slate-505 text-[11px]">موعد استحقاق السداد:</span>
                          <span className={`font-black ${student.dueDate ? 'text-amber-600' : 'text-slate-400'}`}>
                            {student.dueDate || 'غير مخصص'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-slate-200/60 pt-3 mt-1.5">
                  <span className="font-bold text-slate-500 text-[10px]">تذكير تلقائي (24ساعة):</span>
                  <span className={`font-black text-[9px] px-2.5 py-1 rounded-lg border leading-none ${
                    student.autoReminder 
                      ? 'bg-blue-50 border-blue-150 text-blue-700' 
                      : 'bg-slate-50 border-slate-250 text-slate-400'
                  }`}>
                    {student.autoReminder ? 'نشط 🔔' : 'معطل 🔕'}
                  </span>
                </div>
              </div>

              {/* Column 3: Student QR Identity Card */}
              <div className="bg-slate-50/50 border border-slate-150/65 p-4.5 rounded-2xl flex flex-col items-center justify-between text-center h-full space-y-3.5">
                <div className="w-full space-y-3">
                  <h3 className="text-xs font-black text-slate-700 border-b border-slate-150/85 pb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="text-indigo-600"><QrCode size={14} /></span>
                      <span>رمز التعريف السريع QR</span>
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-extrabold rounded-md">آمن 🔒</span>
                  </h3>

                  <div className="flex flex-col items-center justify-center bg-white border border-slate-200 p-4 rounded-xl shadow-inner relative group/qr w-full">
                    {qrCodeUrl ? (
                      <img 
                        src={qrCodeUrl} 
                        alt="Student QR Identity" 
                        className="w-28 h-28 object-contain transition-transform duration-300 group-hover/qr:scale-105"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-28 h-28 bg-slate-100 flex items-center justify-center text-[10px] text-slate-400 font-semibold rounded-lg">
                        جاري تهيئة الرمز...
                      </div>
                    )}
                    <span className="text-[9px] font-mono font-bold text-slate-400 mt-2 block select-all">
                      ID: {student.id}
                    </span>
                  </div>
                </div>

                <div className="w-full space-y-2">
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed max-w-[200px] mx-auto">
                    امسح هذا الرمز المخصص عبر كاميرا لوحة التحكم للانتقال لملف <strong className="text-slate-700 font-black">{student.name}</strong> فوراً بلمسة واحدة!
                  </p>

                  <button
                    onClick={handleDownloadQR}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <Download size={12} />
                    <span>تحميل بطاقة QR</span>
                  </button>
                </div>
              </div>

            </div> {/* Close Column 2 wrapper */}
            </div> {/* Close grid container */}

            {/* WhatsApp Custom Alerts Quick Shortcuts Box */}
            {student.phone && (
              <div className="mt-5 p-4 bg-emerald-50/55 border border-emerald-150 rounded-2xl text-right text-[11px] font-sans space-y-3 shadow-3xs">
                <span className="font-extrabold text-emerald-950 flex items-center gap-1.5 border-b border-emerald-100 pb-2">
                  📱 إرسال تذكيرات سريعة لولي الأمر (واتساب)
                </span>
                <p className="text-slate-500 leading-normal font-semibold">
                  اضغط على ميزة من الأسفل لإنشاء رسالة واتساب مخصصة جاهزة للإرسال فوراً حسب قالب المعلم المعتمد:
                </p>

                <div className="flex flex-col gap-2 font-bold text-xs pt-1">
                  <a
                    href={((): string => {
                      const stored = localStorage.getItem('teacherNotificationSettings');
                      let settings = {
                        classTemplate: 'السلام عليكم يا [الاسم]، نود تذكيرك بموعد حصتنا اليوم الساعة [الوقت] إن شاء الله. بالتوفيق!',
                      };
                      if (stored) {
                        try {
                          const parsed = JSON.parse(stored);
                          if (parsed.classTemplate) settings.classTemplate = parsed.classTemplate;
                        } catch (e) {}
                      }
                      let filled = settings.classTemplate
                        .replace(/\[الاسم\]/g, student.name)
                        .replace(/\[الوقت\]/g, 'ميعادنا المعتاد')
                        .replace(/\[العملة\]/g, currency);
                      let cleanPhone = student.phone.replace(/\D/g, '');
                      if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = '2' + cleanPhone;
                      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(filled)}`;
                    })()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex justify-between items-center p-2.5 bg-white border border-emerald-200/50 hover:border-emerald-300 text-emerald-800 hover:text-emerald-950 rounded-xl transition cursor-pointer"
                  >
                    <span>تذكير ميعاد الحصة اليومية 📅</span>
                    <span className="text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-sans">توليد وإرسال</span>
                  </a>

                  {((): React.ReactNode => {
                    let outstanding = 0;
                    if (student.type === 'lesson') {
                      const totalCost = student.sessions.length * (student.lessonRate || 0);
                      const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
                      outstanding = totalCost - totalPaid;
                    } else {
                      const totalCost = student.coursePrice || 0;
                      const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
                      outstanding = totalCost - totalPaid;
                    }

                    if (outstanding <= 0) return null;

                    const stored = localStorage.getItem('teacherNotificationSettings');
                    let settings = {
                      paymentTemplate: 'السلام عليكم يا [الاسم]، تذكير لطيف بمستحقات الكورس المتبقية وقيمتها [المتبقي] [العملة] المستحقة في [التاريخ]. شكراً لكم!',
                    };
                    if (stored) {
                      try {
                        const parsed = JSON.parse(stored);
                        if (parsed.paymentTemplate) settings.paymentTemplate = parsed.paymentTemplate;
                      } catch (e) {}
                    }
                    let filled = settings.paymentTemplate
                      .replace(/\[الاسم\]/g, student.name)
                      .replace(/\[المتبقي\]/g, String(outstanding))
                      .replace(/\[العملة\]/g, currency)
                      .replace(/\[التاريخ\]/g, student.dueDate || 'اليوم');
                    let cleanPhone = student.phone.replace(/\D/g, '');
                    if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = '2' + cleanPhone;

                    return (
                      <a
                        href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(filled)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex justify-between items-center p-2.5 bg-white border border-emerald-200/50 hover:border-emerald-300 text-red-750 hover:text-red-900 rounded-xl transition cursor-pointer"
                      >
                        <span>تذكير بمستحقات معلقة ({outstanding} {currency}) 💰</span>
                        <span className="text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-sans font-bold">توليد وإرسال</span>
                      </a>
                    );
                  })()}

                  {student.type === 'course' && (
                    <a
                      href={((): string => {
                        const stored = localStorage.getItem('teacherNotificationSettings');
                        let settings = {
                          completionTemplate: 'أهلاً يا [الاسم]، نود إخطارك باقتراب اكتمال حصص الكورس المسجلة لك بنجاح. لقد أنجزت [الحصص] حصة حتى الآن.',
                        };
                        if (stored) {
                          try {
                            const parsed = JSON.parse(stored);
                            if (parsed.completionTemplate) settings.completionTemplate = parsed.completionTemplate;
                          } catch (e) {}
                        }
                        let filled = settings.completionTemplate
                          .replace(/\[الاسم\]/g, student.name)
                          .replace(/\[الحصص\]/g, String(standardSessionsCount))
                          .replace(/\[المتبقي\]/g, String((student.totalLessonsCount || 0) - standardSessionsCount))
                          .replace(/\[العملة\]/g, currency);
                        let cleanPhone = student.phone.replace(/\D/g, '');
                        if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = '2' + cleanPhone;
                        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(filled)}`;
                      })()}
                      target="_blank"
                      rel="noreferrer"
                      className="flex justify-between items-center p-2.5 bg-white border border-emerald-200/50 hover:border-emerald-300 text-purple-800 hover:text-purple-950 rounded-xl transition cursor-pointer"
                    >
                      <span>حالة اكتمال باقة الكورس ({standardSessionsCount} من {student.totalLessonsCount} حصة) 🏆</span>
                      <span className="text-[9px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 font-sans">توليد وإرسال</span>
                    </a>
                  )}

                  <a
                    href={((): string => {
                      const storedSettings = localStorage.getItem('teacherNotificationSettings');
                      let settings = {
                        classTemplate: 'السلام عليكم يا [الاسم]، نود تذكيرك بموعد حصتنا اليوم الساعة [الوقت] إن شاء الله. بالتوفيق!',
                        paymentTemplate: 'السلام عليكم يا [الاسم]، تذكير لطيف بمستحقات الكورس المتبقية وقيمتها [المتبقي] [العملة] المستحقة في [التاريخ]. شكراً لكم!',
                      };
                      if (storedSettings) {
                        try {
                          const parsed = JSON.parse(storedSettings);
                          if (parsed.classTemplate) settings.classTemplate = parsed.classTemplate;
                          if (parsed.paymentTemplate) settings.paymentTemplate = parsed.paymentTemplate;
                        } catch (e) {}
                      }

                      const storedAppts = localStorage.getItem('teacherAppointments');
                      let studentAppts: string[] = [];
                      if (storedAppts) {
                        try {
                          const list = JSON.parse(storedAppts);
                          const filtered = list.filter((a: any) => a.studentId === student.id);
                          studentAppts = filtered.map((a: any) => `${a.dayOfWeek} الساعة ${a.time}`);
                        } catch(e) {}
                      }
                      const apptsText = studentAppts.length > 0 ? studentAppts.join(' و ') : 'ميعادنا المعتاد';

                      let filledClass = settings.classTemplate
                        .replace(/\[الاسم\]/g, student.name)
                        .replace(/\[الوقت\]/g, apptsText)
                        .replace(/\[العملة\]/g, currency);

                      let filledPayment = settings.paymentTemplate
                        .replace(/\[الاسم\]/g, student.name)
                        .replace(/\[المتبقي\]/g, String(outstandingBalance))
                        .replace(/\[العملة\]/g, currency)
                        .replace(/\[التاريخ\]/g, student.dueDate || 'التاريخ المحدد');

                      let finalMessage = '';
                      if (outstandingBalance > 0) {
                        finalMessage = `تذكير بمستحقات وحصص:\n\n${filledPayment}\n\n📅 المواعيد القادمة:\n${filledClass}`;
                      } else {
                        finalMessage = `تذكير بمواعيد الحصص:\n\n${filledClass}`;
                      }

                      let cleanPhone = student.phone.replace(/\D/g, '');
                      if (cleanPhone.startsWith('0') && cleanPhone.length === 11) {
                        cleanPhone = '2' + cleanPhone;
                      }
                      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMessage)}`;
                    })()}
                    target="_blank"
                    rel="noreferrer"
                    className="flex justify-between items-center p-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 border border-emerald-500 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl transition cursor-pointer shadow-sm shadow-emerald-500/15"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold">
                      <span>📊 تذكير تفصيلي (المواعيد والديون المتبقية)</span>
                    </span>
                    <span className="text-[9px] text-emerald-100 bg-emerald-800/40 px-1.5 py-0.5 rounded font-bold font-sans">توليد تلقائي 💬</span>
                  </a>
                </div>
              </div>
            )}

            {/* Quick Pricing Edit Toggle */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              {isEditingSettings ? (
                <form onSubmit={handleSaveSettings} className="space-y-3 mt-2">
                  {student.type === 'lesson' ? (
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">تعديل سعر الحصة ({currency})</label>
                      <input
                        type="number"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">تعديل كامل سعر الكورس ({currency})</label>
                        <input
                          type="number"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                        />
                      </div>
                      {student.totalLessonsCount !== undefined && (
                        <div>
                          <label className="text-[10px] text-slate-500 font-bold block mb-1">تعديل عدد الحصص الكلي</label>
                          <input
                            type="number"
                            value={editTotalSessions}
                            onChange={(e) => setEditTotalSessions(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">تعديل تاريخ استحقاق السداد</label>
                        <input
                          type="text"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          placeholder="مثال: 1 في الشهر"
                          className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-right"
                        />
                      </div>
                    </div>
                  )}

                  {/* Auto Reminder Option */}
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50/40 border border-blue-100 rounded-xl">
                    <input
                      id="details-auto-reminder-checkbox"
                      type="checkbox"
                      checked={editAutoReminder}
                      onChange={(e) => setEditAutoReminder(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                    />
                    <label htmlFor="details-auto-reminder-checkbox" className="text-[10px] text-slate-700 font-bold cursor-pointer select-none">
                      تفعيل التذكير التلقائي (قبل الحصة بـ 24 ساعة) 🔔
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingSettings(false)}
                      className="px-2.5 py-1 text-[10px] font-bold text-slate-550 bg-slate-100 rounded-md cursor-pointer"
                    >
                      إلغاء
                    </button>
                    <button
                      type="submit"
                      className="px-2.5 py-1 text-[10px] font-bold text-white bg-blue-600 rounded-md cursor-pointer hover:bg-blue-700"
                    >
                      حفظ التغييرات
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingSettings(true)}
                  className="w-full text-center py-2.5 bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-600 hover:text-slate-900 rounded-xl transition-all cursor-pointer border border-slate-200"
                >
                  تعديل بيانات القسط والمحاسبة ⚙️
                </button>
              )}
            </div>
          </div>

          {/* Quick Warnings / Reminders */}
          <div className={`border border-slate-200/95 rounded-3xl p-4 text-xs flex gap-3 shadow-3xs ${
            student.type === 'course' && student.totalLessonsCount !== undefined && remainingInCourse <= 2 
              ? 'bg-red-50 border-red-150 text-red-700 animate-pulse'
              : outstandingBalance > 0
              ? 'bg-amber-50 border-amber-150 text-amber-800'
              : 'bg-emerald-50 border-emerald-150 text-emerald-800'
          }`}>
            <div className="pt-0.5">
              <AlertTriangle size={18} />
            </div>
            <div className="space-y-1 w-full text-right">
              <h4 className="font-extrabold text-sm text-slate-900">تنبيهات المتابعة والسداد</h4>
              {student.type === 'course' && student.totalLessonsCount !== undefined && remainingInCourse <= 2 ? (
                <p>تنبيه: متبقي حصتين فقط أو أقل من حصص الاشتراك! المتبقي حالياً هو <span className="font-black">{remainingInCourse}</span> حصة.</p>
              ) : outstandingBalance > 0 ? (
                <p>
                  تنبيه: متبقي مبالغ مالية {student.type === 'lesson' ? 'مستحقة عن الحصص المسجلة' : 'من رسوم الاشتراك المالي'} بقيمة{' '}
                  <span className="font-black text-rose-600">{outstandingBalance} {currency}</span>. يرجى مراجعة الطالب أو ولي أمره لتسديدها.
                </p>
              ) : (
                <p>
                  الوضع مستقر: تم تسديد ومحاسبة كافة المستحقات المالية بالكامل للطالب {student.type === 'lesson' ? 'عن الحصص المسجلة حتى الآن' : 'عن باقة الاشتراك الحالية'}.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Financial Stat boxes */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between h-28 relative overflow-hidden shadow-sm">
              <div className="absolute top-2 left-2 text-slate-100">
                <TrendingUp size={36} />
              </div>
              <p className="text-xs text-slate-500 font-bold">المستحقات والقيمة الكلية</p>
              <div>
                <span className="text-2xl font-black text-slate-800">{totalCost}</span>
                <span className="text-xs text-slate-550 mr-1.5 font-medium">{currency}</span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold">
                {student.type === 'lesson' ? `عن الحصص المسجلة (${sessionsCount} حصة)` : 'إجمالي سعر الكورس'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between h-28 relative overflow-hidden shadow-sm">
              <div className="absolute top-2 left-2 text-emerald-100">
                <CreditCard size={36} />
              </div>
              <p className="text-xs text-slate-500 font-bold">إجمالي المدفوعات المستلمة</p>
              <div>
                <span className="text-2xl font-black text-emerald-600">{totalPaid}</span>
                <span className="text-xs text-emerald-600/80 mr-1.5 font-medium">{currency}</span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold">عبر {student.payments.length} دفعات كاش ومحافظ</p>
            </div>

            <div className={`premium-card p-4 flex flex-col justify-between h-28 relative overflow-hidden shadow-sm ${
              outstandingBalance > 0 
                ? 'bg-red-50/70 border-red-200' 
                : outstandingBalance < 0 
                ? 'bg-emerald-50/70 border-emerald-250' 
                : 'bg-white border border-slate-200'
            }`}>
              {/* WhatsApp Quick Reminder button if there's an outstanding balance with registered telephone number */}
              {outstandingBalance > 0 && (
                <div className="absolute top-3 left-3 z-10">
                  {student.phone ? (
                    <a
                      href={((): string => {
                        const stored = localStorage.getItem('teacherNotificationSettings');
                        let settings = {
                          paymentTemplate: 'السلام عليكم يا [الاسم]، تذكير لطيف بمستحقات الكورس المتبقية وقيمتها [المتبقي] [العملة] المستحقة في [التاريخ]. شكراً لكم!',
                        };
                        if (stored) {
                          try {
                            const parsed = JSON.parse(stored);
                            if (parsed.paymentTemplate) settings.paymentTemplate = parsed.paymentTemplate;
                          } catch (e) {}
                        }
                        let filled = settings.paymentTemplate
                          .replace(/\[الاسم\]/g, student.name)
                          .replace(/\[المتبقي\]/g, String(outstandingBalance))
                          .replace(/\[العملة\]/g, currency)
                          .replace(/\[التاريخ\]/g, student.dueDate || 'اليوم');
                        let cleanPhone = student.phone.replace(/\D/g, '');
                        if (cleanPhone.startsWith('0') && cleanPhone.length === 11) cleanPhone = '2' + cleanPhone;
                        return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(filled)}`;
                      })()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white hover:text-white rounded-lg text-[10px] font-black hover:scale-105 active:scale-95 transition-all shadow-3xs cursor-pointer select-none"
                      title="إرسال تذكير بالدفع للمستحقات المعلقة عبر واتساب"
                      id="whatsapp-direct-reminder-btn"
                    >
                      <MessageCircle size={12} className="text-white shrink-0" />
                      <span>تذكير بالدفع 📱</span>
                    </a>
                  ) : (
                    <span 
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 text-slate-400 rounded-lg text-[10px] font-black cursor-not-allowed select-none"
                      title="لا يوجد رقم هاتف مسجل لهذا الطالب"
                      id="whatsapp-direct-reminder-disabled"
                    >
                      <MessageCircle size={12} className="text-slate-350 shrink-0" />
                      <span>بدون هاتف</span>
                    </span>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-500 font-bold">
                {outstandingBalance > 0 ? 'المتبقي والمطلوب تحصيله' : outstandingBalance < 0 ? 'رصيد زائد للطالب' : 'الحساب مقفل بالكامل'}
              </p>
              <div>
                <span className={`text-2xl font-black ${
                  outstandingBalance > 0 
                    ? 'text-red-650' 
                    : outstandingBalance < 0 
                    ? 'text-emerald-700' 
                    : 'text-slate-500'
                }`}>
                  {Math.abs(outstandingBalance)}
                </span>
                <span className="text-xs mr-1.5 font-medium text-slate-400">{currency}</span>
              </div>
              <p className="text-[9px] text-slate-400 font-semibold">
                {outstandingBalance > 0 ? 'الرجاء تذكير الطالب بالدفع' : outstandingBalance < 0 ? 'رصيد لصالح الطالب للحصص القادمة' : 'مسدد بالكامل ممتاز'}
              </p>
            </div>
          </div>

          {/* Quick Registry Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleQuickRegisterSession}
              className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 font-bold text-sm text-white rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-650/15 active:scale-95"
            >
              <Plus size={16} />
              <span>تسجيل حصة حضور جديدة</span>
            </button>

            <button
              onClick={() => {
                const local = new Date();
                setSessionDate(local.toISOString().split('T')[0]);
                const hours = String(local.getHours()).padStart(2, '0');
                const mins = String(local.getMinutes()).padStart(2, '0');
                setSessionTime(`${hours}:${mins}`);
                setSessionNotes('');
                setSessionIsExtra(false);
                setSessionExtraPrice('100');
                setIsOpenSessionForm(true);
              }}
              className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 font-bold text-sm text-slate-700 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <CalendarCheck size={16} className="text-indigo-600" />
              <span>خيارات يدوية / حصة إضافية ⚙️</span>
            </button>

            <button
              onClick={() => setIsOpenPaymentForm(true)}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-700 font-bold text-sm text-white rounded-xl transition-all cursor-pointer shadow-md shadow-blue-650/15 active:scale-95"
            >
              <DollarSign size={16} />
              <span>تسجيل دفعة نقدية</span>
            </button>
          </div>

          {/* Tab Selection */}
          <div className="border-b border-slate-200 flex gap-4">
            <button
              onClick={() => setActiveTab('sessions')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'sessions' 
                  ? 'border-indigo-600 text-indigo-700 font-black' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              سجل الحصص والمتابعة ({sessionsCount})
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'payments' 
                  ? 'border-blue-600 text-blue-700 font-black' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              دفعات الدفع والتحصيل ({student.payments.length})
            </button>
            <button
              onClick={() => setActiveTab('rewards')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'rewards' 
                  ? 'border-amber-500 text-amber-700 font-black' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              نظام المكافآت 🏆 ({student.rewardPoints || 0} نقطة)
            </button>
            <button
              onClick={() => setActiveTab('studyNotes')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'studyNotes' 
                  ? 'border-pink-600 text-pink-700 font-black' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              الملاحظات الدراسية 📝 ({student.studyNotes?.length || 0})
            </button>
            <button
              onClick={() => setActiveTab('whatsAppTemplates')}
              className={`pb-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'whatsAppTemplates' 
                  ? 'border-emerald-600 text-emerald-700 font-black' 
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              قوالب واتساب 🟢 ({student.whatsAppTemplates?.length || 0})
            </button>
          </div>

          {/* Tab Contents */}
          <div>
            {activeTab === 'sessions' ? (
              <div className="space-y-4">
                {student.type === 'lesson' && student.sessions.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4.5">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-emerald-700 font-bold mb-1">عدد الحصص المدفوعة (باللون الأخضر) 🟢</p>
                      <p className="text-xl font-black text-emerald-800">{paidSessionsCount} حصة</p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                      <p className="text-[10px] text-amber-700 font-bold mb-1">عدد الحصص الغير مدفوعة 🔴</p>
                      <p className="text-xl font-black text-amber-800">{unpaidSessionsCount} حصة</p>
                    </div>
                  </div>
                )}

                {/* AI Attendance Analysis and Performance Adviser */}
                <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-150 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1 space-y-1.5 text-right">
                    <h4 className="text-xs font-black text-blue-950 flex items-center gap-1.5 justify-start">
                      <Sparkles size={14} className="text-blue-600 animate-pulse" />
                      <span>مركز التحليل والتشخيص الذكي (Gemini AI)</span>
                    </h4>
                    
                    {isAnalyzing ? (
                      <div className="flex items-center gap-2 text-slate-500 text-xs py-1">
                        <Loader2 size={13} className="animate-spin text-blue-600" />
                        <span>جاري قراءة سجلات الطالب وصياغة النصيحة التربوية...</span>
                      </div>
                    ) : aiError ? (
                      <p className="text-[11px] text-red-650 font-semibold">{aiError}</p>
                    ) : aiAdvice ? (
                      <div className="p-3 bg-white border border-blue-100 rounded-xl text-xs text-slate-700 leading-relaxed font-bold shadow-2xs">
                        {aiAdvice}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 font-semibold">
                        احصل على نصيحة موجزة وذكية فورياً وصمم خطة لتأمين حضور {student.name} بناءً على سجلات حضوره السابقة والحالية.
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={handleAnalyzeStudent}
                    disabled={isAnalyzing}
                    className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-black text-xs rounded-xl shadow-md transition-all duration-150 transform hover:scale-102 active:scale-97 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Sparkles size={13} />
                    )}
                    <span>تحليل سجل الحضور بالذكاء الاصطناعي</span>
                  </button>
                </div>

                {/* Monthly Attendance Chart */}
                {student.sessions && student.sessions.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div className="text-right">
                        <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 justify-start">
                          <TrendingUp size={14} className="text-indigo-600" />
                          <span>إحصائيات ومخطط حضور الحصص الشهري</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">توزيع وتعداد حصص الطالب الإجمالية والإضافية المنفذة على مدار الأشهر</p>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-1 font-sans">
                        إجمالي الحصص: {student.sessions.length}
                      </span>
                    </div>

                    <div className="relative pt-6">
                      {(() => {
                        const data = getMonthlyAttendanceData();
                        const maxCount = data.length > 0 ? Math.max(...data.map(d => d.count)) : 4;
                        const midCount = Math.round(maxCount / 2);

                        return (
                          <>
                            {/* Guideline lines */}
                            <div className="absolute inset-x-0 top-6 bottom-8 flex flex-col justify-between pointer-events-none opacity-40">
                              <div className="border-t border-dashed border-slate-200 w-full" />
                              <div className="border-t border-dashed border-slate-200 w-full" />
                              <div className="border-t border-dashed border-slate-200 w-full" />
                            </div>

                            {/* Guideline values */}
                            <div className="absolute right-0 top-6 bottom-8 flex flex-col justify-between text-[9px] font-black text-slate-400 pr-1 pointer-events-none select-none">
                              <span>{maxCount} حصص</span>
                              <span>{midCount} حصص</span>
                              <span>0</span>
                            </div>

                            {/* Columns Area */}
                            <div className="h-44 flex items-end justify-around gap-2 px-10 relative z-10">
                              {data.map((m) => {
                                const percentage = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
                                const regularPercent = m.count > 0 ? (m.regularCount / m.count) * 100 : 0;
                                const extraPercent = m.count > 0 ? (m.extraCount / m.count) * 100 : 0;

                                return (
                                  <div key={m.key} className="flex flex-col items-center flex-1 h-full max-w-[55px] group relative">
                                    {/* Elevated tooltip */}
                                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-900 border border-slate-855 text-white text-[10px] rounded-xl py-2 px-3 shadow-xl z-50 text-right w-44 pointer-events-none transition duration-150">
                                      <p className="font-extrabold pb-1 border-b border-slate-800 mb-1.5 text-center text-indigo-400">
                                        {m.label}
                                      </p>
                                      <div className="space-y-1 font-bold">
                                        <div className="flex justify-between">
                                          <span>عدد الحصص الإجمالي:</span>
                                          <span className="font-mono">{m.count}</span>
                                        </div>
                                        <div className="flex justify-between text-indigo-200">
                                          <span>الأساسية:</span>
                                          <span className="font-mono">{m.regularCount}</span>
                                        </div>
                                        {m.extraCount > 0 && (
                                          <div className="flex justify-between text-amber-300">
                                            <span>الإضافية (Extra):</span>
                                            <span className="font-mono">{m.extraCount}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-x-4 border-x-transparent border-t-4 border-t-slate-900" />
                                    </div>

                                    {/* Interactive bar column */}
                                    <div className="w-full flex-1 flex flex-col justify-end">
                                      <motion.div 
                                        initial={{ height: 0 }}
                                        animate={{ height: `${percentage}%` }}
                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                        className="w-full relative rounded-t-lg overflow-hidden bg-slate-100 flex flex-col-reverse justify-end shadow-3xs cursor-pointer group-hover:scale-105 transition-all"
                                      >
                                        <div 
                                          className="bg-indigo-600 transition-colors duration-150 group-hover:bg-indigo-700 w-full"
                                          style={{ height: `${regularPercent}%` }}
                                        />
                                        {m.extraCount > 0 && (
                                          <div 
                                            className="bg-amber-500 transition-colors duration-150 group-hover:bg-amber-600 w-full"
                                            style={{ height: `${extraPercent}%` }}
                                          />
                                        )}

                                        <div className="absolute inset-x-0 top-1 text-center select-none">
                                          <span className="text-[9px] font-black text-white bg-slate-900/40 px-1 py-0.5 rounded font-mono">
                                            {m.count}
                                          </span>
                                        </div>
                                      </motion.div>
                                    </div>

                                    {/* Month label below */}
                                    <span className="text-[9px] font-bold text-slate-600 text-center truncate w-full mt-2 font-mono group-hover:text-indigo-600 transition-all">
                                      {m.label.split(' ')[0]}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        );
                      })()}
                    </div>

                    {/* Chart legends */}
                    <div className="flex gap-4 justify-center text-[10px] font-bold text-slate-500 pt-3 border-t border-slate-50 leading-none">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600" />
                        <span>حصص أساسية</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                        <span>حصص إضافية ⚙️</span>
                      </div>
                    </div>
                  </div>
                )}

                {student.sessions.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <CalendarCheck size={32} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-slate-600 font-semibold text-sm">سجل الحضور خالٍ</p>
                    <p className="text-xs text-slate-400 font-medium mt-1">اضغط على زر "تسجيل حصة حضور جديدة" للبدء بالتحضير.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4 w-12 text-center">#</th>
                          <th className="py-3 px-4">التاريخ واليوم</th>
                          <th className="py-3 px-4">الساعة</th>
                          <th className="py-3 px-4">
                            {student.type === 'lesson' ? 'ملاحظات الدرس والواجب والتحصيل' : 'ملاحظات الدرس والواجب'}
                          </th>
                          <th className="py-3 px-4 w-12 text-center">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {student.sessions.map((session, idx) => {
                          const d = new Date(session.date);
                          const dayLabel = d.toLocaleDateString('ar-EG', { weekday: 'long' });
                          const isPaid = student.type === 'lesson' ? isSessionPaidMap.get(session.id) : false;
                          return (
                            <tr 
                              key={session.id} 
                              className={`transition-colors border-b border-slate-100 ${
                                student.type === 'lesson' && isPaid 
                                  ? 'bg-emerald-50/50 hover:bg-emerald-100/60 border-r-4 border-emerald-500' 
                                  : session.isExtra
                                  ? 'bg-blue-50/40 hover:bg-blue-100/40 border-r-4 border-blue-500'
                                  : 'hover:bg-slate-50'
                              }`}
                            >
                              <td className="py-3 px-4 text-center font-bold text-slate-500">{student.sessions.length - idx}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">
                                <span>{session.date}</span>
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mr-2 font-semibold">{dayLabel}</span>
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-500 text-left font-mono" dir="ltr">{formatTimeTo12h(session.time)}</td>
                              <td className="py-3 px-4 text-slate-700 font-medium">
                                <div className="flex flex-wrap items-center gap-2">
                                  {student.type === 'lesson' && (
                                    isPaid ? (
                                      <span className="px-1.5 py-0.5 bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-md font-bold text-[9px] whitespace-nowrap">مدفوعة 🟢</span>
                                    ) : (
                                      <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-md font-bold text-[9px] whitespace-nowrap">غير مدفوعة 🔴</span>
                                    )
                                  )}
                                  {session.isExtra && (
                                    <span className="px-1.5 py-0.5 bg-blue-100 border border-blue-150 text-blue-800 rounded-md font-bold text-[9px] whitespace-nowrap flex items-center gap-0.5 animate-pulse">
                                      ⭐ حصة إضافية ({session.extraPrice || 0} {currency})
                                    </span>
                                  )}
                                  <span>{session.notes || <span className="text-slate-400 font-serif italic">لا توجد ملاحظات للدرس</span>}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleDeleteSession(session.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                  title="حذف الحصة"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeTab === 'payments' ? (
              <div className="space-y-3">
                {student.payments.length === 0 ? (
                  <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <DollarSign size={32} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-slate-600 font-semibold text-sm">سجل المدفوعات خالٍ</p>
                    <p className="text-xs text-slate-400 font-medium mt-1">اضغط على زر "تسجيل دفعة نقدية" لتقييد المبالغ المستلمة كاش أو فودافون كاش.</p>
                  </div>
                ) : (
                  <div className="overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                        <tr>
                          <th className="py-3 px-4 w-12 text-center">#</th>
                          <th className="py-3 px-4">تاريخ الاستلام</th>
                          <th className="py-3 px-4">المبلغ المسدد</th>
                          <th className="py-3 px-4">طريقة/ملاحظة الدفع</th>
                          <th className="py-3 px-4 w-12 text-center">إجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {student.payments.map((payment, idx) => {
                          const d = new Date(payment.date);
                          const dayLabel = d.toLocaleDateString('ar-EG', { weekday: 'long' });
                          return (
                            <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 text-center font-bold text-slate-500">{student.payments.length - idx}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">
                                <span>{payment.date}</span>
                                <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded mr-2 font-semibold">{dayLabel}</span>
                              </td>
                              <td className="py-3 px-4 font-black text-emerald-600 text-sm">
                                {payment.amount} {currency}
                              </td>
                              <td className="py-3 px-4 text-slate-700 font-medium">
                                {payment.notes || <span className="text-slate-400 font-serif italic">دفعة مباشرة</span>}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <button
                                  onClick={() => handleDeletePayment(payment.id)}
                                  className="p-1 text-slate-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                  title="حذف الدفعة"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : activeTab === 'studyNotes' ? (
              <div className="space-y-6 text-right font-sans">
                {/* Header Controls */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-pink-50/40 to-indigo-50/30 p-5 rounded-2xl border border-pink-100/50">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-pink-100/70 text-pink-600 rounded-xl shrink-0">
                      <BookOpen size={24} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-800">سجل الملاحظات الدراسية والتقارير الأكاديمية</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                        دون وقيد ملاحظات تفصيلية، مستويات أداء، سلوكيات، وتكاليف الطالب مخصصة للرجوع والمشاركة مع ولي الأمر.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (isOpenNoteForm) {
                        // Close & clean
                        setNoteContent('');
                        setNoteTitle('');
                        setNoteType('general');
                        setEditingNoteId(null);
                        setIsOpenNoteForm(false);
                      } else {
                        setIsOpenNoteForm(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all duration-200 shadow-sm active:scale-95 shrink-0 ${
                      isOpenNoteForm 
                        ? 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/55' 
                        : 'bg-pink-600 text-white hover:bg-pink-700'
                    }`}
                  >
                    {isOpenNoteForm ? (
                      <>
                        <X size={15} />
                        <span>إلغاء الكتابة</span>
                      </>
                    ) : (
                      <>
                        <Plus size={15} />
                        <span>إضافة ملاحظة جديدة</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Form to Create/Edit Note */}
                <AnimatePresence>
                  {isOpenNoteForm && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="premium-card p-5 space-y-4 border border-pink-200 bg-pink-50/5"
                    >
                      <h5 className="text-sm font-black text-slate-800 border-b border-pink-100/80 pb-2.5 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shrink-0" />
                        {editingNoteId ? 'تعديل الملاحظة الدراسية الحالية ✍️' : 'إضافة ملاحظة دراسية مخصصة جديدة 📝'}
                      </h5>

                      <form onSubmit={handleSaveStudyNote} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Note Title */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 block">عنوان الملاحظة (اختياري)</label>
                            <input
                              type="text"
                              value={noteTitle}
                              onChange={(e) => setNoteTitle(e.target.value)}
                              placeholder="مثال: تسميع سورة البقرة، مستوى الالتزام..."
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-pink-500 focus:bg-white premium-input"
                            />
                          </div>

                          {/* Note Type */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 block">تصنيف وفئة الملاحظة</label>
                            <select
                              value={noteType}
                              onChange={(e) => setNoteType(e.target.value as any)}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:border-pink-500 focus:bg-white cursor-pointer"
                            >
                              <option value="general">📌 ملاحظة عامة مخصصة</option>
                              <option value="academic">🎓 مستوى وتطور دراسي</option>
                              <option value="behavior">🤝 سلوك ومشاركة بالطابور</option>
                              <option value="homework">✍️ واجبات وتكاليف وحفظ</option>
                              <option value="exam">📝 اختبارات وتسميع دوري</option>
                            </select>
                          </div>

                          {/* Note Date */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-600 block">تاريخ الملاحظة</label>
                            <input
                              type="date"
                              value={noteDate}
                              onChange={(e) => setNoteDate(e.target.value)}
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-pink-500 focus:bg-white premium-input"
                            />
                          </div>
                        </div>

                        {/* Note Content */}
                        <div className="space-y-1.5 col-span-full">
                          <label className="text-xs font-bold text-slate-600 block">تفصيل ونص الملاحظة الدراسية <span className="text-red-500">*</span></label>
                          <textarea
                            required
                            rows={3}
                            value={noteContent}
                            onChange={(e) => setNoteContent(e.target.value)}
                            placeholder="اكتب أداء الطالب، نقاط القوة، مواطن التحسين، أو أي تفاصيل دراسية هامة..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-850 focus:outline-none focus:border-pink-500 focus:bg-white premium-input resize-y"
                          />
                        </div>

                        {/* Form Submit actions */}
                        <div className="flex gap-2 justify-end pt-2">
                          <button
                            type="button"
                            onClick={() => {
                              setNoteContent('');
                              setNoteTitle('');
                              setNoteType('general');
                              setEditingNoteId(null);
                              setIsOpenNoteForm(false);
                            }}
                            className="px-4.5 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer active:scale-95 transition-all outline-none"
                          >
                            إلغاء
                          </button>
                          <button
                            type="submit"
                            className="flex items-center gap-1.5 px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-bold shadow-md shadow-pink-650/15 cursor-pointer active:scale-95 transition-all outline-none"
                          >
                            <CheckCircle size={14} />
                            <span>{editingNoteId ? 'تعديل وحفظ 💾' : 'إضافة الملاحظة ✅'}</span>
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Filters and Searches bar */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-100/50 p-3.5 rounded-2xl border border-slate-200/60">
                  {/* Search bar */}
                  <div className="relative w-full md:w-80">
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Filter size={15} />
                    </span>
                    <input
                      type="text"
                      placeholder="ابحث في نص أو عنوان الملاحظات..."
                      value={searchNotesQuery}
                      onChange={(e) => setSearchNotesQuery(e.target.value)}
                      className="w-full pr-9 pl-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 transition-all premium-input"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex flex-wrap gap-1.5 w-full md:w-auto">
                    {[
                      { key: 'all', label: 'كافة التصنيفات 📋' },
                      { key: 'academic', label: 'دراسي 🎓' },
                      { key: 'behavior', label: 'سلوك 🤝' },
                      { key: 'homework', label: 'واجبات ✍️' },
                      { key: 'exam', label: 'اختبارات 📝' },
                      { key: 'general', label: 'عامة 📌' }
                    ].map((pill) => (
                      <button
                        key={pill.key}
                        onClick={() => setFilterNotesType(pill.key as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          filterNotesType === pill.key
                            ? 'bg-pink-600 text-white shadow-xs'
                            : 'bg-white hover:bg-slate-150/60 text-slate-600 border border-slate-200/70'
                        }`}
                      >
                        {pill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes List Display */}
                {(() => {
                  const filteredNotes = (student.studyNotes || []).filter((note) => {
                    const matchesSearch = note.content.toLowerCase().includes(searchNotesQuery.toLowerCase()) || 
                                          (note.title && note.title.toLowerCase().includes(searchNotesQuery.toLowerCase()));
                    const matchesType = filterNotesType === 'all' || note.type === filterNotesType;
                    return matchesSearch && matchesType;
                  });

                  const getCategoryDetails = (type: string) => {
                    switch(type) {
                      case 'academic': return { label: 'مستوى دراسي 🎓', color: 'bg-indigo-50 text-indigo-700 border-indigo-150' };
                      case 'behavior': return { label: 'سلوك ومشاركة 🤝', color: 'bg-purple-50 text-purple-700 border-purple-150' };
                      case 'homework': return { label: 'واجبات وتكاليف ✍️', color: 'bg-teal-50 text-teal-700 border-teal-150' };
                      case 'exam': return { label: 'اختبار وتقييم 📝', color: 'bg-rose-50 text-rose-700 border-rose-150' };
                      default: return { label: 'ملاحظة عامة 📌', color: 'bg-slate-50 text-slate-700 border-slate-200' };
                    }
                  };

                  if (filteredNotes.length === 0) {
                    return (
                      <div className="text-center py-14 bg-white border border-slate-200 rounded-3xl shadow-sm">
                        <Notebook size={36} className="mx-auto text-slate-300 mb-2.5" />
                        <p className="text-slate-500 text-sm font-semibold">لم يتم العثور على أي ملاحظات دراسية</p>
                        <p className="text-xs text-slate-400 mt-1.5 font-medium max-w-sm mx-auto leading-relaxed">
                          {searchNotesQuery || filterNotesType !== 'all' 
                            ? 'جرب تعديل خيارات البحث والتصفية أو إعادتها للوضع الافتراضي لعرض الملاحظات.' 
                            : 'سجل الملاحظات والتقارير الأكاديمية فارغ حالياً لهذا الطالب. اضغط على "إضافة ملاحظة جديدة" بالأعلى لتسجيل أول تقرير ومتابعة !'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredNotes.map((note) => {
                        const cat = getCategoryDetails(note.type);
                        const d = new Date(note.date);
                        const dayLabel = isNaN(d.getTime()) ? '' : d.toLocaleDateString('ar-EG', { weekday: 'long' });
                        
                        // WhatsApp Quick Share variables
                        const rawPhone = student.phone.replace(/[^0-9]/g, '');
                        const shareMessage = `📋 تقرير مـتابعة دراسي للطالب: ${student.name}

التصنيف: ${cat.label}
التاريخ: ${dayLabel ? `${dayLabel}، ` : ''}${note.date}

💡 نص التقرير والملاحظة:
${note.content}

تمنياتنا بالتوفيق والتفوق المستمر 🌸`;

                        return (
                          <motion.div
                            key={note.id}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="premium-card p-5 flex flex-col justify-between border-r-4 hover:shadow-md transition-all duration-300 relative group overflow-hidden"
                            style={{ 
                              borderRightColor: 
                                note.type === 'academic' ? '#4f46e5' : 
                                note.type === 'behavior' ? '#9333ea' : 
                                note.type === 'homework' ? '#0d9488' : 
                                note.type === 'exam' ? '#e11d48' : '#64748b' 
                            }}
                          >
                            <div className="space-y-3.5">
                              {/* Card badge Type & Date header */}
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] px-2.5 py-1 rounded-lg border font-black shrink-0 ${cat.color}`}>
                                  {cat.label}
                                </span>
                                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-semibold">
                                  <Clock size={11} />
                                  <span>{note.date}</span>
                                  {dayLabel && (
                                    <span className="bg-slate-100 text-[10px] px-1.5 py-0.5 rounded text-slate-500 font-bold">{dayLabel}</span>
                                  )}
                                </div>
                              </div>

                              {/* Title / Body Text */}
                              <div className="space-y-1.5">
                                {note.title && (
                                  <h6 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                                    {note.title}
                                  </h6>
                                )}
                                <p className="text-xs text-slate-705 leading-relaxed font-semibold whitespace-pre-wrap break-words">
                                  {note.content}
                                </p>
                              </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="border-t border-slate-100 mt-4 pt-3 flex items-center justify-between text-slate-400">
                              <a
                                href={`https://wa.me/${rawPhone}?text=${encodeURIComponent(shareMessage)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100/75 px-2.5 py-1.5 rounded-xl border border-emerald-150/40 transition-all cursor-pointer shadow-3xs hover:scale-102"
                                title="إرسال هذا التقرير لولي الأمر مباشرة عبر واتساب"
                              >
                                <MessageCircle size={12} />
                                <span>إرسال لولي الأمر 💬</span>
                              </a>

                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleStartEditNote(note)}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                                  title="تعديل الملاحظة الدراسية"
                                >
                                  <Edit size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    if(confirm('هل أنت متأكد من حذف هذه الملاحظة الدراسية نهائياً؟')) {
                                      handleDeleteStudyNote(note.id);
                                    }
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                  title="حذف الملاحظة"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : activeTab === 'whatsAppTemplates' ? (
              <div className="space-y-6 text-right font-sans">
                {/* Header Banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/40 to-teal-50/30 p-5 rounded-2xl border border-emerald-100/50">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-emerald-100/70 text-emerald-600 rounded-xl shrink-0">
                      <MessageCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-800">قوالب رسائل واتساب المخصصة للطالب</h4>
                      <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                        قم بصياغة قوالب رسائل مجهزة مسبقاً مخصصة لـ <strong className="text-emerald-700 font-black">{student.name}</strong> (مثال: تذكير الواجب، تقرير أسبوعي، تذكير حجز مقعد، تهنئة). يمكنك إرسالها بضغطة واحدة من هنا أو مباشرة من مركز التنبيهات!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (isOpenTemplateForm) {
                        setTemplateTitle('');
                        setTemplateText('');
                        setEditingTemplateId(null);
                        setIsOpenTemplateForm(false);
                      } else {
                        setIsOpenTemplateForm(true);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-4.5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition-all duration-200 shadow-sm active:scale-95 shrink-0 ${
                      isOpenTemplateForm 
                        ? 'bg-slate-100 text-slate-705 border border-slate-200 hover:bg-slate-200/55' 
                        : 'bg-emerald-600 text-white hover:bg-emerald-750'
                    }`}
                  >
                    {isOpenTemplateForm ? (
                      <>
                        <X size={15} />
                        <span>إلغاء الصياغة</span>
                      </>
                    ) : (
                      <>
                        <Plus size={15} />
                        <span>إضافة قالب مخصص جديد</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Create or Edit Form */}
                <AnimatePresence>
                  {isOpenTemplateForm && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="premium-card p-5 space-y-4 border border-emerald-200 bg-emerald-50/5"
                    >
                      <h5 className="text-sm font-black text-slate-800 border-b border-emerald-100/80 pb-2.5 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        {editingTemplateId ? 'تعديل قالب واتساب المخصص الحالي ✍️' : 'صياغة قالب واتساب مخصص جديد للطالب 📝'}
                      </h5>

                      <form onSubmit={handleSaveWhatsAppTemplate} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Template Title */}
                          <div className="space-y-1.5 md:col-span-1">
                            <label className="text-xs font-bold text-slate-600 block">عنوان أو نوع القالب *</label>
                            <input
                              type="text"
                              required
                              value={templateTitle}
                              onChange={(e) => setTemplateTitle(e.target.value)}
                              placeholder="مثال: تذكير بالواجب، تقرير الحفظ، متأخرات..."
                              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white premium-input"
                            />
                          </div>

                          {/* Template Content with variable helper tags */}
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-xs font-bold text-slate-600 block">نص الرسالة والنموذج *</label>
                            <textarea
                              rows={3}
                              required
                              value={templateText}
                              onChange={(e) => setTemplateText(e.target.value)}
                              placeholder="اكتب صياغة الرسالة، واستعن بالأزرار أدناه لإدراج المتغيرات التلقائية..."
                              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white font-sans leading-relaxed"
                            />
                            
                            {/* Variables Insertion helper pills */}
                            <div className="flex flex-wrap gap-1.5 items-center justify-start pt-1">
                              <span className="text-[10px] text-slate-400 font-bold ml-1">انقر لإدراج متغير تلقائي:</span>
                              {[
                                { tag: '[الاسم]', desc: 'الاسم الكلي للطالب', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                                { tag: '[الوقت]', desc: 'توقيت آخر حصة', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                                { tag: '[التاريخ]', desc: 'تاريخ آخر حصة', color: 'bg-pink-50 text-pink-700 border-pink-200' },
                                { tag: '[المتبقي]', desc: 'المبلغ المتبقي المطلوب كاش', color: 'bg-red-50 text-red-700 border-red-200' },
                                { tag: '[العملة]', desc: 'العملة المعتمدة', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                                { tag: '[الحصص]', desc: 'إجمالي الحصص المنفذة', color: 'bg-orange-50 text-orange-700 border-orange-200' }
                              ].map((v) => (
                                <button
                                  type="button"
                                  key={v.tag}
                                  onClick={() => setTemplateText(prev => prev + ' ' + v.tag)}
                                  className={`px-2 py-1 text-[9px] font-extrabold border rounded-lg hover:scale-102 hover:shadow-3xs transition-all cursor-pointer ${v.color}`}
                                  title={v.desc}
                                >
                                  {v.tag}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Live Pre-fill Simulation Preview card */}
                        {templateText.trim() && (
                          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                            <span className="text-[9px] font-bold text-slate-400">👀 معاينة حية لشكل الرسالة مع بيانات {student.name}:</span>
                            <p className="text-[10px] text-slate-700 leading-relaxed font-bold whitespace-pre-wrap font-sans">
                              {(() => {
                                let txt = templateText;
                                const lastSess = student.sessions.length > 0 ? student.sessions[student.sessions.length - 1] : null;
                                txt = txt.replace(/\[الاسم\]/g, student.name);
                                txt = txt.replace(/\[الوقت\]/g, lastSess?.time ? formatTimeTo12h(lastSess.time) : '06:30 PM');
                                txt = txt.replace(/\[التاريخ\]/g, lastSess?.date || new Date().toISOString().split('T')[0]);
                                txt = txt.replace(/\[المتبقي\]/g, String(outstandingBalance > 0 ? outstandingBalance : 0));
                                txt = txt.replace(/\[العملة\]/g, currency);
                                txt = txt.replace(/\[الحصص\]/g, String(student.sessions.length));
                                return txt;
                              })()}
                            </p>
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setTemplateTitle('');
                              setTemplateText('');
                              setEditingTemplateId(null);
                              setIsOpenTemplateForm(false);
                            }}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold cursor-pointer transition-all"
                          >
                            تراجع
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-emerald-500/10"
                          >
                            {editingTemplateId ? 'حفظ التعديلات' : 'إضافة وحفظ قالب مخصص'}
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Templates List grid */}
                {(!student.whatsAppTemplates || student.whatsAppTemplates.length === 0) ? (
                  <div className="text-center py-14 bg-white border border-slate-200 rounded-3xl shadow-sm">
                    <MessageCircle size={36} className="mx-auto text-slate-300 mb-2.5" />
                    <p className="text-slate-500 text-sm font-semibold">لا توجد أي قوالب رسائل مخصصة لهذا الطالب بعد</p>
                    <p className="text-xs text-slate-400 mt-1.5 font-medium max-w-sm mx-auto leading-relaxed">
                      أضف قوالب لتتمكن من إرسال رسائل دورية بلمسة واحدة. تدعم هذه المفهوم ملحقات ذكية تلقائية التعبئة.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {student.whatsAppTemplates.map((tpl) => {
                      // Substituted final message content
                      let constructedMsg = tpl.text;
                      const lastSess = student.sessions.length > 0 ? student.sessions[student.sessions.length - 1] : null;
                      constructedMsg = constructedMsg.replace(/\[الاسم\]/g, student.name);
                      constructedMsg = constructedMsg.replace(/\[الوقت\]/g, lastSess?.time ? formatTimeTo12h(lastSess.time) : '06:30 PM');
                      constructedMsg = constructedMsg.replace(/\[التاريخ\]/g, lastSess?.date || new Date().toISOString().split('T')[0]);
                      constructedMsg = constructedMsg.replace(/\[المتبقي\]/g, String(outstandingBalance > 0 ? outstandingBalance : 0));
                      constructedMsg = constructedMsg.replace(/\[العملة\]/g, currency);
                      constructedMsg = constructedMsg.replace(/\[الحصص\]/g, String(student.sessions.length));

                      const rawPhone = student.phone.replace(/[^0-9]/g, '');
                      const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(constructedMsg)}`;

                      return (
                        <div
                          key={tpl.id}
                          className="premium-card p-5 border-l-4 border-l-emerald-500 flex flex-col justify-between hover:shadow-md transition-all duration-300 relative group overflow-hidden"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg font-black shrink-0">
                                {tpl.title}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold font-mono">معرّف القالب: {tpl.id}</span>
                            </div>

                            <div className="space-y-2">
                              {/* Template pattern specification */}
                              <div className="text-[10px] bg-slate-50/70 p-2 rounded-xl border border-slate-100/80">
                                <span className="text-[9px] font-bold text-slate-400 block pb-0.5">صيغة القالب الخام:</span>
                                <p className="font-mono text-slate-600 leading-relaxed font-semibold">{tpl.text}</p>
                              </div>

                              {/* Formatted live simulation preview */}
                              <div className="bg-emerald-50/20 p-2.5 rounded-xl border border-emerald-100/50">
                                <span className="text-[9px] font-black text-emerald-700 block pb-0.5">معاينة الرسالة الفعلية المسردة:</span>
                                <p className="text-xs text-slate-705 leading-relaxed font-bold whitespace-pre-wrap font-sans">{constructedMsg}</p>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-slate-100 mt-4 pt-3 flex items-center justify-between">
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[10px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 rounded-xl shadow-xs transition-all cursor-pointer hover:scale-102"
                              title="مراسلتهم مباشرة بالقالب عبر الواتساب"
                            >
                              <Send size={11} className="text-emerald-100 animate-pulse" />
                              <span>إرسال عبر واتساب فوراً 🚀</span>
                            </a>

                            <div className="flex gap-2">
                              <button
                                onClick={() => handleStartEditTemplate(tpl)}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                                title="تعديل صيغة القالب"
                              >
                                <Edit size={13} />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذا القالب المخصص للطالب نهائياً؟')) {
                                    handleDeleteWhatsAppTemplate(tpl.id);
                                  }
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                                title="حذف القالب"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 text-right font-sans">
                {/* Row 1: Dashboard with points & controls */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Card 1: Points balance */}
                  <div className="relative bg-gradient-to-br from-amber-550 to-orange-600 text-white rounded-3xl p-6 shadow-xl shadow-amber-500/15 overflow-hidden flex flex-col justify-between min-h-[180px]">
                    <div className="absolute -right-6 -bottom-6 text-amber-400/20 pointer-events-none transform -rotate-12">
                      <Award size={140} />
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="p-2 bg-white/10 rounded-2xl backdrop-blur-md">
                        <Award size={20} className="text-amber-100" />
                      </span>
                      <span className="text-xs bg-white/20 px-3 py-1 rounded-full font-bold">باقة الولاء والتشجيع ⭐</span>
                    </div>
                    <div className="mt-4">
                      <span className="text-4xl font-black font-mono tracking-tight">{student.rewardPoints || 0}</span>
                      <span className="text-sm font-bold mr-1.5 text-amber-100 font-sans">نقطة نشطة</span>
                    </div>
                    <div className="mt-2 text-xs text-amber-50 font-medium">
                      يمكن للطالب استبدال هذه النقاط بخصومات على الحصص أو الفواتير المستقلة!
                    </div>
                  </div>

                  {/* Card 2: Rules explanation */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                        <Sparkles size={16} className="text-amber-500" />
                        كيف يربح الطالب النقاط؟
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-600 font-medium">
                        <li className="flex items-center gap-2">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          <span>حضور الحصة الدراسية والتحضير: <strong>+10 نقاط</strong></span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          <span>تسديد المستحقات في موعدها: <strong>+25 نقطة</strong></span>
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                          <span>التفوق وتشجيع المعلم التقديري يدوياً.</span>
                        </li>
                      </ul>
                    </div>
                    <div className="pt-2 border-t border-slate-100 mt-2 text-[10px] text-slate-400">
                      يتم احتساب النقاط وتحديث الرصيد تلقائياً عند تنفيذ العمليات.
                    </div>
                  </div>

                  {/* Card 3: Manual Adjustment Control */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col justify-between z-10">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-2">
                        <Plus size={16} className="text-blue-500" />
                        إضافة أو خصم نقاط يدوياً
                      </h4>
                      <div className="space-y-2">
                        <input
                          type="number"
                          placeholder="عدد النقاط (مثال: +20 أو -15)"
                          value={customAdjustmentPoints}
                          onChange={(e) => setCustomAdjustmentPoints(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-center focus:outline-none focus:border-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="السبب (مثلاً: حل الواجب بالكامل)"
                          value={customAdjustmentNotes}
                          onChange={(e) => setCustomAdjustmentNotes(e.target.value)}
                          className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!customAdjustmentPoints}
                      onClick={() => {
                        const pts = parseInt(customAdjustmentPoints);
                        if (isNaN(pts)) return;
                        handleRedeemReward('manual_add', { 
                          points: pts, 
                          description: customAdjustmentNotes.trim() || (pts >= 0 ? "إضافة نقاط تشجيعية من قبل المعلم" : "تعديل نقاط يدوي")
                        });
                        setCustomAdjustmentPoints('');
                        setCustomAdjustmentNotes('');
                      }}
                      className="w-full mt-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      تعديل الرصيد يدوياً
                    </button>
                  </div>

                </div>

                {/* Section 2: Redemption Center */}
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-4">
                    <Gift size={18} className="text-orange-500" />
                    كتالوج مكافآت واستبدال الجوائز المتاحة
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    
                    {/* Package A */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full hover:border-amber-300 transition-all">
                      <div>
                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3 ml-auto">
                          <Gift size={20} />
                        </div>
                        <h5 className="font-bold text-slate-800 text-sm font-sans">كوبون خصم بقيمة 20 {currency}</h5>
                        <p className="text-xs text-slate-400 mt-1">يخصم القيمة تالياً من المديونية التراكمية الإجمالية للطالب.</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs text-slate-500 font-bold">التكلفة والخصم:</span>
                          <span className="text-xs font-mono font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">50 نقطة ⭐</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRedeemReward('discount', { points: 50, amount: 20 })}
                          disabled={(student.rewardPoints || 0) < 50}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          استبدال الآن 🛒
                        </button>
                      </div>
                    </div>

                    {/* Package B */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full hover:border-amber-300 transition-all">
                      <div>
                        <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 mb-3 ml-auto">
                          <Gift size={20} />
                        </div>
                        <h5 className="font-bold text-slate-800 text-sm font-sans">كوبون خصم بقيمة 50 {currency}</h5>
                        <p className="text-xs text-slate-400 mt-1">خصم فوري لحساب الطالب يتم احتسابه وتسجيله في كشف الحساب.</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs text-slate-500 font-bold">التكلفة والخصم:</span>
                          <span className="text-xs font-mono font-black text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">100 نقطة ⭐</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRedeemReward('discount', { points: 100, amount: 50 })}
                          disabled={(student.rewardPoints || 0) < 100}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          استبدال الآن 🛒
                        </button>
                      </div>
                    </div>

                    {/* Package C */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full hover:border-amber-300 transition-all">
                      <div>
                        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 mb-3 ml-auto">
                          <Award size={20} />
                        </div>
                        <h5 className="font-bold text-slate-800 text-sm font-sans">حصة دراسية مجانية 🎁</h5>
                        <p className="text-xs text-slate-400 mt-1">
                          {student.type === 'lesson' 
                            ? `إعفاء لحصة فردية بقيمة ${student.lessonRate || 100} ${currency}.` 
                            : 'خصم معادل لرسوم حصة إضافية بموجب نقاط الجوائز والولاء.'}
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs text-slate-500 font-bold">التكلفة والخصم:</span>
                          <span className="text-xs font-mono font-black text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg">120 نقطة ⭐</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRedeemReward('free_class')}
                          disabled={(student.rewardPoints || 0) < 120}
                          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          استبدال الآن 🛒
                        </button>
                      </div>
                    </div>

                    {/* Custom Reward Card */}
                    <div className="bg-gradient-to-br from-indigo-50/50 to-purple-50/50 border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between h-full">
                      <div>
                        <h5 className="font-bold text-indigo-950 text-sm flex items-center gap-1.5 justify-end">
                          <span>تفصيل خصم مخصص ⚙️</span>
                          <History size={15} />
                        </h5>
                        <div className="space-y-1.5 mt-3 text-right">
                          <input
                            type="number"
                            placeholder="عدد النقاط المطلوبة"
                            value={customRewardPoints}
                            onChange={(e) => setCustomRewardPoints(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-indigo-150 rounded-xl text-xs font-bold text-center focus:outline-none"
                          />
                          <input
                            type="number"
                            placeholder={`المبلغ المسند بالخصم (${currency})`}
                            value={customRewardDiscount}
                            onChange={(e) => setCustomRewardDiscount(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-indigo-150 rounded-xl text-xs font-black text-center focus:outline-none text-emerald-600"
                          />
                          <input
                            type="text"
                            placeholder="تفاصيل التكريم أو السبب كمرجع"
                            value={customRewardNotes}
                            onChange={(e) => setCustomRewardNotes(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-indigo-150 rounded-xl text-xs font-medium focus:outline-none"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={!customRewardPoints || !customRewardDiscount}
                        onClick={() => {
                          const pts = parseInt(customRewardPoints);
                          const amt = parseFloat(customRewardDiscount);
                          if (isNaN(pts) || isNaN(amt)) return;
                          
                          handleRedeemReward('custom', {
                            points: pts,
                            amount: amt,
                            description: customRewardNotes.trim() || `🎁 خصم مخصص من مكافأة نقاط استرداد بقيمة ${amt} ${currency}`
                          });
                          
                          setCustomRewardPoints('');
                          setCustomRewardDiscount('');
                          setCustomRewardNotes('');
                        }}
                        className="w-full mt-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
                      >
                        خصم مخصص للأرصدة
                      </button>
                    </div>

                  </div>
                </div>

                {/* Section 3: Transactions Log */}
                <div>
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2 mb-3">
                    <History size={18} className="text-slate-500" />
                    كشف وسجل عمليات النقاط والجوائز لـ {student.name}
                  </h3>

                  {(!student.rewardTransactions || student.rewardTransactions.length === 0) ? (
                    <div className="text-center py-10 bg-white border border-slate-200 rounded-3xl shadow-sm">
                      <History size={30} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-slate-500 text-xs font-semibold">لا توجد حركات في تاريخ النقاط لهذا الطالب حتى الآن</p>
                      <p className="text-[10px] text-slate-400 mt-1 font-medium">ستظهر الحركات بمجرد كسب أو استبدال الجوائز ومكافآت الحصص.</p>
                    </div>
                  ) : (
                    <div className="overflow-hidden bg-white border border-slate-200 rounded-2xl shadow-sm">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                          <tr>
                            <th className="py-2.5 px-4 font-bold text-slate-550">التاريخ</th>
                            <th className="py-2.5 px-4 text-center font-bold text-slate-550">النوع</th>
                            <th className="py-2.5 px-4 text-center font-bold text-slate-550">النقاط</th>
                            <th className="py-2.5 px-3 font-bold text-slate-550">البيان وسبب المعاملة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700 font-bold">
                          {student.rewardTransactions.map((tx) => (
                            <tr key={tx.id} className="hover:bg-slate-50/55 transition-colors">
                              <td className="py-2.5 px-4 text-slate-500 font-mono" dir="ltr">{tx.date}</td>
                              <td className="py-2.5 px-4 text-center">
                                {tx.type === 'earn' ? (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md font-bold text-[10px]">كسب 🟢</span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-100 rounded-md font-bold text-[10px]">استبدال 🔴</span>
                                )}
                              </td>
                              <td className={`py-2.5 px-4 text-center font-bold text-sm ${tx.type === 'earn' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                {tx.type === 'earn' ? `+${tx.amount}` : `-${tx.amount}`}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 font-semibold">{tx.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>

      {/* Register Session Dialog Modal */}
      <AnimatePresence>
        {isOpenSessionForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenSessionForm(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-slate-800 text-right"
            >
              <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2 mb-4">
                <CalendarCheck size={20} className="text-indigo-600" />
                تسجيل حصة جديدة بالساعة والتاريخ
              </h3>

              <form onSubmit={handleRegisterSession} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">تاريخ الحصة *</label>
                    <input
                      type="date"
                      required
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-600 font-bold block">ساعة الحصة *</label>
                    <input
                      type="time"
                      required
                      value={sessionTime}
                      onChange={(e) => setSessionTime(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-indigo-500 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">موضوع الدرس، الواجب أو الملاحظة</label>
                  <textarea
                    value={sessionNotes}
                    onChange={(e) => setSessionNotes(e.target.value)}
                    placeholder="مثال: شرح قاعدة المضارع البسيط وحل تمارين صفحة 22"
                    rows={3}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-205 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:border-indigo-500 transition-all"
                  />
                </div>

                {student.type === 'course' && (
                  <div className="space-y-3 p-3 bg-blue-50/50 border border-blue-105 rounded-2xl">
                    <div className="flex items-center gap-2">
                      <input
                        id="session-is-extra-checkbox"
                        type="checkbox"
                        checked={sessionIsExtra}
                        onChange={(e) => setSessionIsExtra(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-650 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                      <label htmlFor="session-is-extra-checkbox" className="text-xs text-slate-700 font-bold cursor-pointer select-none">
                        تسجيل كحصة إضافية (خارج باقة الكورس الأصلي) ⭐
                      </label>
                    </div>

                    {sessionIsExtra && (
                      <div className="space-y-1 pt-2 border-t border-blue-100">
                        <label className="text-[10px] text-blue-800 font-black block mb-1">سعر خاص لهذه الحصة الإضافية ({currency}) *</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={sessionExtraPrice}
                          onChange={(e) => setSessionExtraPrice(e.target.value)}
                          className="w-full px-4 py-2 bg-white border border-blue-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-mono"
                          placeholder="0 مجاناً"
                        />
                        <p className="text-[9px] text-blue-600 font-bold">سيتم حساب قيمة هذه الحصة وتنزيلها لمديونيات ومجمل حسابات الطالب.</p>
                      </div>
                    )}
                  </div>
                )}

                {student.type === 'lesson' && (
                  <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl text-xs text-indigo-700 leading-relaxed">
                    سيقوم البرنامج بإضافة <strong>{student.lessonRate} {currency}</strong> كمديونية إضافية مستحقة على حساب الطالب فور حفظ الحصة.
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpenSessionForm(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-650 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    تسجيل الحصة وتحضير الحضور
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Register Payment Dialog Modal */}
      <AnimatePresence>
        {isOpenPaymentForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpenPaymentForm(false)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-slate-800 text-right"
            >
              <h3 className="text-lg font-bold text-blue-900 flex items-center gap-2 mb-4">
                <DollarSign size={20} className="text-blue-600" />
                تسجيل دفعة نقدية أو تحويل مستلم
              </h3>

              <form onSubmit={handleRegisterPayment} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">المبلغ المدفوع ({currency}) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    autoFocus
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="أدخل قيمة المبلغ المسدد، مثال: 500"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-205 rounded-xl text-sm font-black text-slate-800 focus:outline-none focus:border-blue-500 transition-all text-center"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">تاريخ استلام الدفعة *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-slate-600 font-bold block">طريقة الدفع أو الملاحظة</label>
                  <input
                    type="text"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="مثال: نقداً، تحويل فودافون كاش، محفظة إلكترونية"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                  <input
                    id="payment-is-on-time-checkbox"
                    type="checkbox"
                    checked={isPaymentOnTime}
                    onChange={(e) => setIsPaymentOnTime(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-550 border-slate-350 cursor-pointer"
                  />
                  <label htmlFor="payment-is-on-time-checkbox" className="text-xs text-slate-700 font-bold cursor-pointer select-none">
                    الدفع في الموعد المحدد (ربح نقاط مكافأة +25) ⏱️
                  </label>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpenPaymentForm(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-650 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all cursor-pointer shadow-md"
                  >
                    تأكيد وحفظ الدفعة
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Reusable Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDialog(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-right text-slate-800"
            >
              <div className="flex gap-3.5 items-start mb-4">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmDialog.type === 'session-over-limit'
                    ? 'bg-amber-50 border border-amber-100 text-amber-600'
                    : confirmDialog.type === 'print-error'
                    ? 'bg-blue-50 border border-blue-100 text-blue-600'
                    : 'bg-red-50 border border-red-100 text-red-650'
                }`}>
                  <AlertTriangle size={22} />
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-slate-900 leading-snug">
                    {confirmDialog.type === 'session-over-limit' && 'تنبيه: تخطي حد الحصص'}
                    {confirmDialog.type === 'delete-session' && 'تأكيد حذف الحصة'}
                    {confirmDialog.type === 'delete-payment' && 'تأكيد حذف الدفعة'}
                    {confirmDialog.type === 'print-error' && 'تنبيه بخصوص طباعة التقرير / PDF'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-line">
                    {confirmDialog.type === 'session-over-limit' && (
                      student.type === 'course'
                        ? 'لقد استنفذ هذا الطالب كامل عدد حصص الاشتراك بالكورس المسجلة له بالفعل! هل أنت متأكد من تسجيل هذه الحصة كحصة إضافية؟'
                        : 'لقد تخطى هذا الطالب حد الحصص المحدد له بالفعل! هل أنت متأكد من تسجيل هذه الحصة كحصة إضافية؟'
                    )}
                    {confirmDialog.type === 'delete-session' && 'هل أنت متأكد من حذف تسجيل هذه الحصة؟ سيعاد احتساب المستحقات المالية للطالب.'}
                    {confirmDialog.type === 'delete-payment' && 'هل أنت متأكد من حذف هذه الدفعة المالية؟ سيعاد احتساب الرصيد المتبقي على الطالب.'}
                    {confirmDialog.type === 'print-error' && 
                      `أنت تتصفح التطبيق حالياً من داخل نافذة المعاينة السريعة والمحمية (iFrame)، والتي تمنع متصفحات الويب تشغيل أوامر الطباعة المباشرة بداخلها لأسباب أمنية.

للطباعة وحفظ التقرير كـ PDF بنجاح وسهولة:
1. يرجى فتح التطبيق في علامة تبويب كاملة ومستقلة بالمتصفح بالضغط على زر فتح الرابط الخارجي (الأيقونة أو السهم بأعلى نافذة المعاينة).
2. ثم اضغط على زر طباعة من هناك لتظهر نافذة حفظ الـ PDF فوراً.`}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 font-bold text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4 py-2 text-slate-650 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer shadow-sm"
                >
                  إلغاء
                </button>
                {confirmDialog.type !== 'print-error' ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirmDialog.type === 'session-over-limit') {
                        executeRegisterSession(confirmDialog.data.date, confirmDialog.data.time, confirmDialog.data.notes, true, 100);
                      } else if (confirmDialog.type === 'delete-session') {
                        executeDeleteSession(confirmDialog.data);
                      } else if (confirmDialog.type === 'delete-payment') {
                        executeDeletePayment(confirmDialog.data);
                      }
                      setConfirmDialog(null);
                    }}
                    className={`px-4 py-2 text-white rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer ${
                      confirmDialog.type === 'session-over-limit'
                        ? 'bg-amber-600 hover:bg-amber-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {confirmDialog.type === 'session-over-limit' ? 'نعم، أضف كحصة إضافية' : 'نعم، احذف السجل'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        window.print();
                      } catch(e) {}
                      setConfirmDialog(null);
                    }}
                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
                  >
                    تفهمت، جرب الطباعة على أي حال
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Hidden PDF Report Template used to generate high-DPI PDF */}
      <div className="absolute top-0 left-0 pointer-events-none opacity-0 select-none overflow-hidden" style={{ width: '800px', height: 'auto', zIndex: -100 }}>
        <div id="student-pdf-report" className="bg-white p-8 font-sans text-right relative text-slate-850 rounded-3xl shadow-lg border border-slate-100" dir="rtl" style={{ width: '800px' }}>
          {/* Elegant Header with custom color banner */}
          <div className="border-b-4 border-indigo-600 pb-5 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black text-indigo-900 tracking-tight">كشف حساب مالي تفصيلي للمشترك</h1>
              <p className="text-xs text-slate-500 mt-1 font-bold">تاريخ التصدير: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="text-left font-sans">
              <div className="text-indigo-600 font-black text-lg tracking-wider">نظام الإدارة الدراسي الذكي</div>
              <p className="text-[10px] text-slate-400 font-bold">المساعد الذكي لإدارة الحصص والمدفوعات</p>
            </div>
          </div>

          {/* Student Personal Info Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-6 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-400 font-bold mb-0.5">اسم الطالب:</p>
              <p className="text-sm font-black text-slate-800">{student.name}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold mb-0.5">رقم الهاتف:</p>
              <p className="text-sm font-mono font-bold text-slate-700">{student.phone || 'غير مسجل'}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold mb-0.5">نوع الاشتراك والنظام:</p>
              <span className={`text-xs inline-block px-2.5 py-0.5 rounded-md font-bold ${
                student.type === 'lesson' ? 'bg-indigo-50 border border-indigo-150 text-indigo-700' : 'bg-pink-50 border border-pink-150 text-pink-700'
              }`}>
                {student.type === 'lesson' ? 'نظام الحصص الفردي' : 'نظام كورس متصل'}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-bold mb-0.5">تاريخ الانضمام للبرنامج:</p>
              <p className="text-xs font-bold text-slate-650">{student.createdAt}</p>
            </div>
          </div>

          {/* High contrast financial cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="border border-slate-200 rounded-xl p-4 text-center bg-slate-50/50">
              <p className="text-[10px] text-slate-500 font-bold mb-1">المستحقات الكلية</p>
              <p className="text-lg font-black text-slate-800">{totalCost} <span className="text-xs font-semibold">{currency}</span></p>
            </div>
            <div className="border border-slate-200 rounded-xl p-4 text-center bg-emerald-50/40">
              <p className="text-[10px] text-emerald-700 font-bold mb-1">المدفوعات المستلمة</p>
              <p className="text-lg font-black text-emerald-600">{totalPaid} <span className="text-xs font-semibold">{currency}</span></p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${outstandingBalance > 0 ? 'bg-red-50/40 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <p className="text-[10px] text-slate-500 font-bold mb-1">الذمم المطلوبة والمتبقية</p>
              <p className={`text-lg font-black ${outstandingBalance > 0 ? 'text-red-650' : 'text-slate-600'}`}>{outstandingBalance} <span className="text-xs font-semibold">{currency}</span></p>
            </div>
          </div>

          {/* Tables Section */}
          <div className="space-y-6">
            {/* Sessions Table */}
            <div>
              <h3 className="text-xs font-extrabold border-r-4 border-indigo-500 pr-2.5 mb-2.5 text-right flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 inline-block" />
                سجل الحضور والتحضير
              </h3>
              {student.sessions.length === 0 ? (
                <p className="text-xs text-slate-450 italic pr-3 py-2 bg-slate-50 rounded-lg">لا توجد حصص مسجلة في كشف الحساب حالياً.</p>
              ) : (
                <div className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs bg-slate-50/10">
                  <table className="w-full text-right border-collapse" style={{ fontFamily: "'Cairo', sans-serif", fontSize: '10px' }}>
                    <thead className="border-b-2 border-slate-300 text-slate-850" style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center border border-slate-300">#</th>
                        <th className="py-2.5 px-3 border border-slate-300">التاريخ واليوم</th>
                        <th className="py-2.5 px-3 border border-slate-300">ساعة الحصة</th>
                        <th className="py-2.5 px-3 border border-slate-300">موضوع وملاحظات التحصيل الدراسي والواجب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {student.sessions.map((session, idx) => {
                        const d = new Date(session.date);
                        const dayLabel = d.toLocaleDateString('ar-EG', { weekday: 'long' });
                        return (
                          <tr key={session.id} className="odd:bg-white even:bg-[#f8fafc] hover:bg-indigo-50/20" style={idx % 2 === 1 ? { backgroundColor: '#f8fafc' } : undefined}>
                            <td className="py-2 px-3 text-center border border-slate-300 font-semibold">{student.sessions.length - idx}</td>
                            <td className="py-2 px-3 border border-slate-300 font-bold">{session.date} <span className="text-[9px] text-slate-500 font-normal">({dayLabel})</span></td>
                            <td className="py-2 px-3 border border-slate-300 font-medium text-left font-mono" dir="ltr">{formatTimeTo12h(session.time)}</td>
                            <td className="py-2 px-3 border border-slate-300 text-slate-600 font-bold">
                              {session.isExtra && <span className="text-blue-700 font-black shrink-0 ml-1.5 bg-blue-50 border border-blue-105 px-1 py-0.2 rounded-md text-[8px] inline-block">⭐ حصة إضافية (+{session.extraPrice} {currency})</span>}
                              {session.notes || '-'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total sessions row */}
                      <tr className="font-bold text-slate-900 border-t-2 border-slate-300" style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                        <td className="py-2.5 px-3 text-center border border-slate-300 font-black">المجموع</td>
                        <td className="py-2.5 px-3 border border-slate-300" colSpan={3}>
                          إجمالي الحصص المنفذة: {student.sessions.length} حصة
                          {student.type === 'course' && ` (منها ${standardSessionsCount} حصص من الكورس الأصلي، و ${extraSessionsCount} حصص إضافية بقيمة ${extraSessionsTotalCost} ${currency})`}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payments Table */}
            <div>
              <h3 className="text-xs font-extrabold border-r-4 border-emerald-500 pr-2.5 mb-2.5 text-right flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                سجل الدفعات المستلمة التفصيلية
              </h3>
              {student.payments.length === 0 ? (
                <p className="text-xs text-slate-450 italic pr-3 py-2 bg-slate-50 rounded-lg">لم يتم قيد دفعات نقدية في حساب الطالب ببرنامجنا حتى الآن.</p>
              ) : (
                <div className="border-2 border-slate-300 rounded-xl overflow-hidden shadow-xs bg-slate-50/10">
                  <table className="w-full text-right border-collapse" style={{ fontFamily: "'Cairo', sans-serif", fontSize: '10px' }}>
                    <thead className="border-b-2 border-slate-300 text-slate-850" style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                      <tr>
                        <th className="py-2.5 px-3 w-12 text-center border border-slate-300">#</th>
                        <th className="py-2.5 px-3 border border-slate-300">تاريخ الدفعة</th>
                        <th className="py-2.5 px-3 border border-slate-300">القيمة والعملة</th>
                        <th className="py-2.5 px-3 border border-slate-300">البيان وملاحظة الاستلام</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-700">
                      {student.payments.map((payment, idx) => {
                        const d = new Date(payment.date);
                        const dayLabel = d.toLocaleDateString('ar-EG', { weekday: 'long' });
                        return (
                          <tr key={payment.id} className="odd:bg-white even:bg-[#f8fafc] hover:bg-emerald-50/20" style={idx % 2 === 1 ? { backgroundColor: '#f8fafc' } : undefined}>
                            <td className="py-2 px-3 text-center border border-slate-300 font-semibold">{student.payments.length - idx}</td>
                            <td className="py-2 px-3 border border-slate-300 font-bold">{payment.date} <span className="text-[9px] text-slate-500 font-normal">({dayLabel})</span></td>
                            <td className="py-2 px-3 border border-slate-300 font-black text-emerald-600 font-mono">{payment.amount} {currency}</td>
                            <td className="py-2 px-3 border border-slate-300 text-slate-600 font-bold">{payment.notes || 'دفعة مسجلة مباشرة'}</td>
                          </tr>
                        );
                      })}
                      {/* Total payments row */}
                      <tr className="font-bold text-slate-900 border-t-2 border-slate-300" style={{ backgroundColor: '#f1f5f9', fontWeight: 'bold' }}>
                        <td className="py-2.5 px-3 text-center border border-slate-300 font-black">المجموع</td>
                        <td className="py-2.5 px-3 border border-slate-300 font-bold text-slate-800">إجمالي المدفوعات المستلمة</td>
                        <td className="py-2.5 px-3 border border-slate-300 font-black text-emerald-700 font-mono text-xs">{totalPaid} {currency}</td>
                        <td className="py-2.5 px-3 border border-slate-300 text-slate-500 font-semibold">تأكيد دفعات نقدية مسجلة</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Printable Stamp/Certification & Teacher Signature */}
          <div className="mt-12 pt-8 border-t border-slate-200">
            <div className="grid grid-cols-2 gap-8 mb-6">
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-slate-400 font-extrabold mb-1">توقيع المعاملات والاعتماد:</span>
                <div className="w-full border-b border-dashed border-slate-400 h-8 mt-1"></div>
                <span className="text-[9px] text-slate-500 mt-1 font-bold">توقيع المعلم والمشرف الدراسي</span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-slate-400 font-extrabold mb-1">تاريخ المصادقة والتوقيع:</span>
                <div className="w-full border-b border-dashed border-slate-400 h-8 mt-1 flex items-end justify-start px-2 font-mono text-[10px] text-slate-600">
                  <span className="mb-0.5">التاريخ: _____ / _____ / ٢٠٢٦م</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-1 font-bold">يُدون يدوياً وقت التبادل الورقي</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center text-[9px] text-slate-400 font-bold pt-4 border-t border-slate-100">
              <div>تم التوليد إلكترونياً وبشكل آمن وآلي عبر النظام</div>
              <div className="text-left font-sans">
                <div>برنامج إدارة المعلمين والطلاب الذكي v3</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
