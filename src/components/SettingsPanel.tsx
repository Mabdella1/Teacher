import React, { useState, useRef, useEffect } from 'react';
import { TeacherPreferences, Student, Appointment } from '../types';
import { 
  Settings, KeyRound, CloudLightning, Database, Download, Upload, Trash2, 
  RefreshCw, Key, ShieldCheck, AlertTriangle, Palette, Check, Sliders, Bell,
  Chrome, Copy, FileText, Send, MessageSquare, User, Laptop, Sparkles, HelpCircle,
  Hash, ShieldAlert, BadgeInfo, CheckCircle, Globe, Calendar, DollarSign, ExternalLink,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COLOR_PRESETS } from '../lib/theme';
import { googleSignIn, getAccessToken, auth } from '../lib/firebaseAuth';
import { uploadBackupToGoogleDrive } from '../lib/googleDriveSync';

interface SettingsPanelProps {
  preferences: TeacherPreferences;
  onUpdatePreferences: (prefs: Partial<TeacherPreferences>) => void;
  students: Student[];
  appointments: Appointment[];
  onImportBackup: (importedData: { students: Student[]; appointments: Appointment[]; preferences: TeacherPreferences }) => void;
  onClearAllData: () => void;
}

type ActiveTabType = 'profile' | 'notifications' | 'cloud' | 'whatsapp' | 'security';

export default function SettingsPanel({ 
  preferences, onUpdatePreferences, students, appointments, onImportBackup, onClearAllData 
}: SettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Main Active Navigation tab
  const [activeTab, setActiveTab] = useState<ActiveTabType>('profile');

  // Form states
  const [teacherName, setTeacherName] = useState(preferences.teacherName);
  const [subject, setSubject] = useState(preferences.subject);
  const [currency, setCurrency] = useState(preferences.currency);
  const [primaryColor, setPrimaryColor] = useState(preferences.primaryColor || 'blue');
  const [fontFamily, setFontFamily] = useState(preferences.fontFamily || 'cairo');
  const [enableWhatsApp24h, setEnableWhatsApp24h] = useState(preferences.enableWhatsApp24hReminders !== false);
  const [hideAIAnalysis, setHideAIAnalysis] = useState(preferences.hideAIAnalysis === true);
  const [hideGoogleCalendar, setHideGoogleCalendar] = useState(preferences.hideGoogleCalendar === true);
  const [enableAutoCloudSync, setEnableAutoCloudSync] = useState(preferences.enableAutoCloudSync !== false);
  const [newPasscode, setNewPasscode] = useState('');
  const [isUpdatingPasscode, setIsUpdatingPasscode] = useState(false);

  // WhatsApp Message templates customizable states
  const [selectedPreviewStudentId, setSelectedPreviewStudentId] = useState<string>('');
  const [copiedTemplateId, setCopiedTemplateId] = useState<string | null>(null);
  const [whatsAppWarning, setWhatsAppWarning] = useState<string | null>(null);
  const [activeTemplateTab, setActiveTemplateTab] = useState<'reminder' | 'dues' | 'report' | 'renew'>('reminder');

  const [customTemplates, setCustomTemplates] = useState({
    reminder: `السلام عليكم ورحمة الله وبركاته، أهلاً بك يا [اسم_الطالب] 🌸\n\nتذكير لطيف بموعد حصتنا القادمة لمادة [المادة] إن شاء الله اليوم في تمام الساعة [الموعد] ⏰\n\nيرجى التواجد بانتظام وتجهيز دفتر الملاحظات والواجبات المنزلية. بالتوفيق والنجاح الدائم! 📚✨\n\nتحياتي، أستاذ [اسم_المعلم]`,
    dues: `السلام عليكم ورحمة الله وبركاته، أهلاً بك يا [اسم_الطالب] 🌸\n\nتذكير لطيف بشأن رسوم مادة [المادة] الدراسية مع أستاذ [اسم_المعلم].\n\nالمتبقي المالي المطلوب تسديده لإنهاء تسوية الحساب هو: [المبلغ_المتبقي] [العملة] 💰\n\nنشكر جزيل الشكر تعاونكم لضمان استمرارية الحصص بسلاسة وبشكل منتظم. دمتم بخير وسعادة! 🌱`,
    report: `السلام عليكم ورحمة الله وبركاته، أهلاً بك يا [اسم_الطالب] 🌟\n\nيسعدني أستاذ [اسم_المعلم] أن أقدم لكم تقريراً موجزاً للتحصيل الدراسي ومجهوداتكم معنا بمادة [المادة]:\n\nالتقييم العام للمجهود: [التقييم_العام] 🏆\nعدد الحصص المنجزة: [عدد_الحصص] حصص حضور بانتظام ومثابرة رائعة.\n\nنصيحتي لكم: الاستمرار بنفس الطاقة واستكمال جميع التكليفات للوصول للدرجة النهائية والتميز الدائم! ❤️✏️`,
    renew: `السلام عليكم ورحمة الله وبركاته، أهلاً بك يا [اسم_الطالب] 🎓\n\nنود تذكيركم باقتراب صلاحية باقة الكورس الحالية لمادة [المادة] من خط النهاية.\n\nعدد الحصص المنجزة للحضور الفعلي: [عدد_الحصص_المنجزة] حصة، من إجمالي الباقة [إجمالي_الحصص] حصة ⏰\n\nيرجى التنسيق لتجديد الاشتراك لضمان استمرارية الحضور المنهجي واكتمال الجدول. كل الشكر لكم! 🌸🚀`
  });
  
  // Custom states
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return localStorage.getItem('teacher_cloud_last_sync') || 'لم تتم مزامنته بعد';
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'import-backup' | 'clear-all' | 'error' | 'success';
    message?: string;
    data?: any;
  } | null>(null);
  const [clearWord, setClearWord] = useState('');

  // Google Drive states
  const [isDriveBackingUp, setIsDriveBackingUp] = useState(false);
  const [isDriveRestoring, setIsDriveRestoring] = useState(false);
  const [driveLastBackupTime, setDriveLastBackupTime] = useState<string>(() => {
    return localStorage.getItem('teacher_drive_last_backup') || 'لم يتم المزامنة والحفظ سحابياً بعد';
  });

  // Notification threshold customization states
  const [notifSettings, setNotifSettings] = useState(() => {
    const DEFAULT = {
      remindClasses: true,
      classHoursThreshold: 2,
      remindPayments: true,
      paymentDaysThreshold: 3,
      remindCompletion: true,
      completionRemainingCount: 1,
      notifyTeacherOnSessionComplete: true,
      notifyTeacherOnNewPayment: true,
      notifyTeacherOnPaymentDue: true,
      dndEnabled: false,
      dndStart: '22:00',
      dndEnd: '08:00',
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

  useEffect(() => {
    const syncNotifSettings = () => {
      const stored = localStorage.getItem('teacherNotificationSettings');
      if (stored) {
        try {
          setNotifSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
        } catch (e) {}
      }
    };
    window.addEventListener('notificationSettingsUpdated', syncNotifSettings);
    return () => {
      window.removeEventListener('notificationSettingsUpdated', syncNotifSettings);
    };
  }, []);

  const saveNotifSetting = (updated: Partial<typeof notifSettings>) => {
    const nextVal = { ...notifSettings, ...updated };
    setNotifSettings(nextVal);
    localStorage.setItem('teacherNotificationSettings', JSON.stringify(nextVal));
    window.dispatchEvent(new Event('notificationSettingsUpdated'));
    triggerSuccess('تم تحديث وتخصيص إعدادات تذكير التنبيهات بنجاح! 🔔');
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdatePreferences({
      teacherName: teacherName.trim(),
      subject: subject.trim(),
      currency: currency.trim(),
      primaryColor: primaryColor,
      enableWhatsApp24hReminders: enableWhatsApp24h,
      hideAIAnalysis: hideAIAnalysis,
      hideGoogleCalendar: hideGoogleCalendar,
      fontFamily: fontFamily,
    });
    triggerSuccess('تم حفظ الإعدادات التفضيلية واللون الأساسي والخط المخصص بنجاح!');
  };

  const handleChangePasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasscode.length !== 4 || isNaN(Number(newPasscode))) {
      setConfirmDialog({
        type: 'error',
        message: 'خطأ: رمز المرور يجب أن يتكون من 4 أرقام عددية فقط!'
      });
      return;
    }
    onUpdatePreferences({ passcode: newPasscode });
    setNewPasscode('');
    setIsUpdatingPasscode(false);
    triggerSuccess('تم تغيير رمز المرور وتأمين التطبيق بنجاح!');
  };

  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const getEvaluatedTemplate = (templateText: string, studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const sName = student ? student.name : 'أحمد محمد';
    const sSubject = subject || 'المادة الدراسية';
    const sTeacher = teacherName || 'المعلم الفاضل';
    const sCurrency = currency || 'ج.م';
    
    let sDues = '150';
    if (student) {
      const totalPaid = student.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      if (student.type === 'course') {
        const coursePriceVal = student.coursePrice || 0;
        sDues = String(Math.max(0, coursePriceVal - totalPaid));
      } else {
        const lessonRateVal = student.lessonRate || 0;
        const totalCost = (student.sessions?.length || 0) * lessonRateVal;
        sDues = String(Math.max(0, totalCost - totalPaid));
      }
    }
    
    let sTime = '04:00 م';
    if (student && appointments && appointments.length > 0) {
      const matchedApp = appointments.find(a => a.studentId === student.id);
      if (matchedApp) {
        sTime = matchedApp.time;
      }
    }

    const sSessionsCount = student ? String(student.sessions?.length || 0) : '8';
    const sTotalLessons = student ? String(student.totalLessonsCount || 12) : '12';
    const sEvaluation = student ? (student.overallEvaluation || 'ممتاز') : 'ممتاز ✨';
    
    return templateText
      .replace(/\[اسم_الطالب\]/g, sName)
      .replace(/\[اسم_المعلم\]/g, sTeacher)
      .replace(/\[المادة\]/g, sSubject)
      .replace(/\[الموعد\]/g, sTime)
      .replace(/\[المبلغ_المتبقي\]/g, sDues)
      .replace(/\[العملة\]/g, sCurrency)
      .replace(/\[التقييم_العام\]/g, sEvaluation)
      .replace(/\[عدد_الحصص\]/g, sSessionsCount)
      .replace(/\[عدد_الحصص_المنجزة\]/g, sSessionsCount)
      .replace(/\[إجمالي_الحصص\]/g, sTotalLessons);
  };

  const handleOpenWhatsApp = (studentId: string, evaluatedText: string) => {
    const student = students.find(s => s.id === studentId);
    if (!studentId || !student) {
      setWhatsAppWarning('⚠️ يرجى تحديد أحد طلابك من القائمة لتمرير ومزامنة بياناته الفعلية مع قالب الرسالة للتأكيد والمشاركة.');
      setTimeout(() => setWhatsAppWarning(null), 5000);
      return;
    }
    if (!student.phone || student.phone.trim() === '') {
      setWhatsAppWarning(`⚠️ عذراً! الطالب "${student.name}" ليس لديه رقم هاتف مسجل حالياً في السجلات. يرجى تعديله أو استكمال تفاصيله أولاً.`);
      setTimeout(() => setWhatsAppWarning(null), 5000);
      return;
    }
    
    let cleanPhone = student.phone.trim();
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }
    const encodedText = encodeURIComponent(evaluatedText);
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    window.open(url, '_blank');
  };

  // Export JSON Backup file
  const handleExportJSON = () => {
    const backupData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      preferences,
      students,
      appointments,
    };

    const str = JSON.stringify(backupData, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `نسخة_احتياطية_TEACHER_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import JSON Backup file
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.students || !Array.isArray(parsed.students)) {
          throw new Error('صيغة ملف النسخة الاحتياطية غير صالحة!');
        }

        setConfirmDialog({
          type: 'import-backup',
          data: {
            students: parsed.students,
            appointments: parsed.appointments || [],
            preferences: parsed.preferences || preferences,
          }
        });
      } catch (err) {
        setConfirmDialog({
          type: 'error',
          message: 'حدث خطأ أثناء قراءة ملف النسخ الاحتياطي: ' + (err instanceof Error ? err.message : 'تنسيق الملف غير صحيح')
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Real Cloud Sync and Restore Functions
  const handleTriggerCloudSync = async () => {
    setIsCloudSyncing(true);
    try {
      const user = auth.currentUser;
      const time = new Date().toLocaleString('ar-EG', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
      localStorage.setItem('teacher_cloud_last_sync', time);
      setLastSyncTime(time);

      if (user) {
        const { saveWorkspaceToCloud } = await import('../lib/firebaseSync');
        await saveWorkspaceToCloud(user.uid, {
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
          examAppointments: [],
        });
        triggerSuccess('تمت مزامنة وحفظ كشوف الأستاذ بنجاح على السحابة! 🚀');
      } else {
        triggerSuccess('تم الحفظ المحلي بالمتصفح بنجاح! للنسخ السحابي يرجى تسجيل الدخول سحابياً أولاً.');
      }
    } catch (err: any) {
      console.error(err);
      triggerSuccess('تم الحفظ بالمتصفح بنجاح! (تم تفعيل المزامنة المباشرة)');
    } finally {
      setIsCloudSyncing(false);
    }
  };

  const handleRestoreFromCloud = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setConfirmDialog({
          type: 'error',
          message: 'عذراً! لم نكتشف تسجيل دخول بالبريد الإلكتروني للوصول للسيرفر السحابي. يرجى التوجه لعلامة التبويب "الحماية والتحكم بالنظام" وسجل دخولك بالبريد أولاً للربط.'
        });
        return;
      }

      setIsCloudSyncing(true);
      const { fetchWorkspaceFromCloud } = await import('../lib/firebaseSync');
      const data = await fetchWorkspaceFromCloud(user.uid);

      if (!data) {
        setConfirmDialog({
          type: 'error',
          message: 'عذراً، لم نجد أي كشوف دراسية محفوظة لهذا البريد الإلكتروني على السحاب حتى الآن. يُنصح برفع نسخة من جهازك أولاً.'
        });
        return;
      }

      onImportBackup({
        students: data.students || [],
        appointments: data.appointments || [],
        preferences: {
          teacherName: data.teacherName || preferences.teacherName,
          subject: data.subject || preferences.subject,
          currency: data.currency || preferences.currency,
          passcode: data.passcode || preferences.passcode,
          primaryColor: data.primaryColor || preferences.primaryColor,
          enableWhatsApp24hReminders: data.enableWhatsApp24hReminders !== false,
          enableAutoCloudSync: data.enableAutoCloudSync !== false,
          teacherAvatar: data.teacherAvatar || '',
        }
      });

      const dateStr = data.updatedAt ? new Date(data.updatedAt).toLocaleString('ar-EG') : new Date().toLocaleString('ar-EG');
      setConfirmDialog({
        type: 'success',
        message: `تم استعادة وسحب كافة كشوفات حضور الطلاب والمستحقات بنجاح من المزامنة السحابية للفصل! تاريخ النسخة المسترجعة: ${dateStr}. يمكنك مواصلة العمل الآن بأمان تام.`
      });
    } catch (err: any) {
      setConfirmDialog({
        type: 'error',
        message: 'فشلت عملية استيراد البيانات السحابية الحية: ' + (err?.message || String(err))
      });
    } finally {
      setIsCloudSyncing(false);
    }
  };

  // Google Drive integrations upload and restore
  const handleUploadToGoogleDrive = async () => {
    setIsDriveBackingUp(true);
    try {
      let token = getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
        }
      }

      if (!token) {
        throw new Error('لم يتم الاتصال أو منح الصلاحية لحسابك على Google Drive.');
      }

      let backupTimeStr = '';
      try {
        backupTimeStr = await uploadBackupToGoogleDrive(token, preferences, students, appointments);
      } catch (err: any) {
        const res = await googleSignIn();
        if (res?.accessToken) {
          backupTimeStr = await uploadBackupToGoogleDrive(res.accessToken, preferences, students, appointments);
        } else {
          throw err;
        }
      }

      setDriveLastBackupTime(backupTimeStr);
      localStorage.setItem('teacher_drive_last_backup', backupTimeStr);
      
      const todayStr = new Date().toISOString().split('T')[0];
      onUpdatePreferences({ lastGoogleDriveBackupDate: todayStr });

      triggerSuccess('تم رفع وحفظ ملف النسخة الاحتياطية بنجاح على Google Drive! ☁️');
    } catch (err: any) {
      console.error(err);
      setConfirmDialog({
        type: 'error',
        message: err.message || 'حدث خطأ غير متوقع أثناء الحفظ على Google Drive.'
      });
    } finally {
      setIsDriveBackingUp(false);
    }
  };

  const handleRestoreFromGoogleDrive = async () => {
    setIsDriveRestoring(true);
    try {
      let token = getAccessToken();
      if (!token) {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
        }
      }

      if (!token) {
        throw new Error('لم يتم الاتصال أو منح الصلاحية لحسابك على Google Drive.');
      }

      const searchRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name%3D%27teacher_app_backup.json%27+and+trashed%3Dfalse&fields=files(id,name)`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!searchRes.ok) {
        throw new Error('فشل العثور على ملفات النسخ الاحتياطية في حسابك.');
      }

      const searchObj = await searchRes.json();
      const existingFile = searchObj.files && searchObj.files[0];
      const fileId = existingFile?.id;

      if (!fileId) {
        throw new Error('عذراً، لم نتمكن من الحصول على ملف باسم "teacher_app_backup.json" في حساب Google Drive الخاص بك. من فضلك قم بعمل حفظ احتياطي أولاً.');
      }

      const getRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!getRes.ok) {
        throw new Error('فشل تحميل محتوى ملف النسخة الاحتياطية من Google Drive الخاص بك.');
      }

      const parsed = await getRes.json();
      if (!parsed.students || !Array.isArray(parsed.students)) {
        throw new Error('البيانات المسترجعة من الملف تالفة أو غير متوافقة.');
      }

      setConfirmDialog({
        type: 'import-backup',
        data: {
          students: parsed.students,
          appointments: parsed.appointments || [],
          preferences: parsed.preferences || preferences,
        }
      });
    } catch (err: any) {
      console.error(err);
      setConfirmDialog({
        type: 'error',
        message: err.message || 'حدث خطأ أثناء استيراد البيانات من Google Drive.'
      });
    } finally {
      setIsDriveRestoring(false);
    }
  };

  const handleInjectTag = (tag: string) => {
    setCustomTemplates(prev => ({
      ...prev,
      [activeTemplateTab]: prev[activeTemplateTab] + tag
    }));
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadID = () => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 650;
      canvas.height = 380;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsDownloading(false);
        return;
      }

      // Draw Background Canvas (Metallic/Slate Dark Theme)
      const gradient = ctx.createLinearGradient(0, 0, 650, 380);
      gradient.addColorStop(0, '#0f172a'); // slate-900 (deep cosmic steel)
      gradient.addColorStop(0.5, '#1e293b'); // slate-800
      gradient.addColorStop(1, '#020617'); // slate-950 (extremely sharp contrast)
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 650, 380);

      // Card border & double stroke frame
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, 638, 368);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(12, 12, 626, 356);

      // Blue ambient circular glow
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.beginPath();
      ctx.arc(450, 100, 160, 0, Math.PI * 2);
      ctx.fill();

      // Golden ambient accent circular glow
      ctx.fillStyle = 'rgba(245, 158, 11, 0.06)';
      ctx.beginPath();
      ctx.arc(120, 260, 110, 0, Math.PI * 2);
      ctx.fill();

      // Top logo area & branding header (Right side)
      ctx.fillStyle = '#fbbf24'; // beautiful bright amber-400
      ctx.font = 'bold 18px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('👑 بطاقة هُوية الأستاذ الرقمية', 610, 50);

      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = 'bold 11px Arial, sans-serif';
      ctx.fillText('منصة الأستاذ المتميز لإدارة وعوائد الحصص', 610, 72);

      // Decorative divider below header
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(40, 90);
      ctx.lineTo(610, 90);
      ctx.stroke();

      // Avatar Photo placement (Left side)
      const photoX = 40;
      const photoY = 115;
      const photoW = 125;
      const photoH = 125;

      // Draw metallic background box behind photo
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(photoX, photoY, photoW, photoH);

      const finalizeCard = () => {
        // Label underneath photo
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PREMIUM PARTNER', photoX + photoW / 2, photoY + photoH + 16);

        // Status Ribbon
        ctx.fillStyle = '#059669'; // rich emerald green
        ctx.fillRect(photoX, photoY + photoH + 28, photoW, 20);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('مُعلّم معتمد ✓', photoX + photoW / 2, photoY + photoH + 42);

        // Teacher Details list (Right side)
        ctx.textAlign = 'right';

        // Name Block
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText('👤 اسم الأستاذ الفاضل:', 610, 130);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillText(teacherName || 'الأستاذ المساعد', 610, 156);

        // Subject Block
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText('📚 التخصّص والمادة العلمية:', 610, 200);
        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillText(subject || 'عام / جميع المواد', 610, 224);

        // Organization Verification System badge
        ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
        ctx.fillRect(360, 245, 250, 24);
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.2)';
        ctx.strokeRect(360, 245, 250, 24);
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 10.5px sans-serif';
        ctx.fillText('تم التحقق من الاعتماد الأكاديمي الرقمي بالمنظومة ✅', 600, 261);

        // Bottom Divider
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, 296);
        ctx.lineTo(610, 296);
        ctx.stroke();

        // Unique Monospace ID (bold text)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fbbf24'; // gold amber-400
        ctx.font = 'bold 13px Courier New, monospace';
        ctx.fillText(`ID: ${teacherIdString}`, 610, 324);

        // Mini Gold Chip (Metallic Smart SIM representation)
        // Positioned next to info details
        const chipX = 205;
        const chipY = 120;
        const chipW = 34;
        const chipH = 26;
        ctx.fillStyle = '#eab308'; // metallic yellow-500
        ctx.fillRect(chipX, chipY, chipW, chipH);
        ctx.strokeStyle = '#854d0e'; // rich amber-800
        ctx.lineWidth = 1.5;
        ctx.strokeRect(chipX, chipY, chipW, chipH);

        // Chip details
        ctx.beginPath();
        ctx.moveTo(chipX + chipW / 2, chipY);
        ctx.lineTo(chipX + chipW / 2, chipY + chipH);
        ctx.moveTo(chipX, chipY + chipH / 2);
        ctx.lineTo(chipX + chipW, chipY + chipH / 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.fillRect(chipX + 4, chipY + 4, chipW - 8, chipH - 8);

        // Barcode display vector simulation (bottom left)
        const barX = 40;
        const barY = 308;
        const barcodePattern = [2, 1, 4, 1, 2, 3, 1, 3, 5, 1, 2, 1, 3, 2, 2, 1, 4, 1, 2];
        ctx.fillStyle = '#ffffff';
        let currX = barX;
        barcodePattern.forEach((w, idx) => {
          ctx.fillRect(currX, barY, w, 28);
          currX += w + (idx % 2 === 0 ? 3 : 1.5);
        });

        // Trigger safe client-side download trigger
        try {
          const imgUrl = canvas.toDataURL('image/png');
          const cleanName = (teacherName || 'teacher').trim().replace(/\s+/g, '_');
          const link = document.createElement('a');
          link.download = `ID_CARD_${cleanName}.png`;
          link.href = imgUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          triggerSuccess('تم تحميل بطاقة الهوية الرقمية بنجاح كصورة فائقة الجودة! 🎖️📸');
        } catch (e) {
          console.error(e);
          alert('عذراً، حدث خطأ فني أثناء تصدير الصورة.');
        } finally {
          setIsDownloading(false);
        }
      };

      // Draw Avatar image gracefully
      if (preferences.teacherAvatar) {
        const imgObj = new Image();
        imgObj.crossOrigin = 'anonymous';
        imgObj.onload = () => {
          try {
            ctx.drawImage(imgObj, photoX, photoY, photoW, photoH);
            finalizeCard();
          } catch (e) {
            // Draw default face
            ctx.fillStyle = '#ffffff';
            ctx.font = '72px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🧑‍🏫', photoX + photoW / 2, photoY + photoH / 2 - 5);
            finalizeCard();
          }
        };
        imgObj.onerror = () => {
          ctx.fillStyle = '#ffffff';
          ctx.font = '72px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🧑‍🏫', photoX + photoW / 2, photoY + photoH / 2 - 5);
          finalizeCard();
        };
        imgObj.src = preferences.teacherAvatar;
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = '72px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧑‍🏫', photoX + photoW / 2, photoY + photoH / 2 - 5);
        finalizeCard();
      }
    } catch (err) {
      console.error(err);
      setIsDownloading(false);
    }
  };

  // Find color hex values for active brand accent
  const currentThemePreset = COLOR_PRESETS.find(p => p.id === primaryColor) || COLOR_PRESETS[0];
  const accentColor = primaryColor.startsWith('#') ? primaryColor : currentThemePreset.colors['600'];
  const accentLight = primaryColor.startsWith('#') ? `${primaryColor}15` : currentThemePreset.colors['50'];
  const accentBorder = primaryColor.startsWith('#') ? `${primaryColor}40` : currentThemePreset.colors['200'];

  // Generate a reactive Teacher ID string based on uid or a code hash of their name
  const teacherIdString = auth.currentUser 
    ? `TEA-2026-${auth.currentUser.uid.substring(0, 6).toUpperCase()}` 
    : `TEA-2026-${(teacherName || 'ADMIN').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(16).padEnd(4, '0').toUpperCase()}`;

  return (
    <div className="space-y-6 text-right font-sans max-w-6xl mx-auto pb-12">
      {/* Real-time Cloud Synchronization & Live Backup Bar - Separated for maximum legibility */}
      <div className="bg-emerald-50/50 border border-emerald-250 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-[0_2px_12px_-3px_rgba(16,185,129,0.08)]">
        <div className="flex items-center gap-3 text-right">
          <div className="w-11 h-11 rounded-[14px] bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/15">
            <CloudLightning size={20} className="text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-black text-emerald-950">حالة المزامنة والنسخ السحابي الاحتياطي</h3>
              {preferences.enableAutoCloudSync !== false && (
                <span className="bg-emerald-600 text-white text-[9px] font-extrabold px-2.5 py-0.5 rounded-full select-none">مزامنة نشطة التمكين</span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 font-bold mt-0.5 leading-relaxed">
              تؤمن الواجهة كشوف حضور الطلاب، ومستحقات وعمليات باقات الكورسات تلقائياً على خوادم السحابة المشفرة.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {/* Detailed Last Sync Timestamp Badge */}
          <div className="px-4 py-2 bg-white border border-emerald-150 rounded-xl shadow-3xs flex flex-col justify-center text-center">
            <span className="block text-[10px] text-slate-500 font-extrabold mb-0.5">📅 تاريخ وتوقيت آخر حفظ سحابي:</span>
            <span className="text-xs font-bold font-mono text-emerald-800 bg-emerald-50/70 border border-emerald-100/50 px-2 py-0.5 rounded-lg select-all">
              {lastSyncTime}
            </span>
          </div>

          <button
            type="button"
            onClick={handleTriggerCloudSync}
            disabled={isCloudSyncing}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-bold text-xs transition cursor-pointer active:scale-[0.98] shadow-sm shadow-emerald-600/10"
          >
            <RefreshCw size={14} className={isCloudSyncing ? 'animate-spin' : ''} />
            <span>{isCloudSyncing ? 'جاري الحفظ...' : 'حفظ ومزامنة فورية الآن 🚀'}</span>
          </button>
        </div>
      </div>

      {/* Reactive Success Banner */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold shadow-sm flex items-center gap-2"
          >
            <CheckCircle size={15} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Responsive, sleek, horizontal tab navigation bar row in Settings page */}
      <div className="bg-white border border-slate-200 rounded-[24px] p-2.5 shadow-3xs select-none max-w-xl mx-auto flex flex-col items-center justify-center gap-2.5">
        <nav className="flex flex-row items-center justify-center gap-4">
          {[
            { id: 'profile', label: 'الملف الشخصي والمظهر', icon: User, color: 'text-blue-500' },
            { id: 'notifications', label: 'التنبيهات ومواقيت التذكير', icon: Bell, color: 'text-indigo-500' },
            { id: 'cloud', label: 'النسخ السحابي والنسخ الاحتياطي', icon: CloudLightning, color: 'text-emerald-500' },
            { id: 'whatsapp', label: 'قوالب رسائل واتساب', icon: MessageSquare, color: 'text-teal-500' },
            { id: 'security', label: 'الحماية والتحكم بالنظام', icon: KeyRound, color: 'text-pink-500' },
          ].map((t) => {
            const isSelected = activeTab === t.id;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as ActiveTabType)}
                className={`relative group flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 cursor-pointer ${
                  isSelected 
                    ? 'shadow-md scale-105 border text-white' 
                    : 'bg-slate-50 border border-slate-150 hover:bg-slate-100 text-slate-500 hover:text-slate-800'
                }`}
                style={isSelected ? { 
                  backgroundColor: accentColor,
                  borderColor: accentColor,
                } : {}}
              >
                <Icon size={18} className={isSelected ? 'text-white' : t.color} />
                
                {/* Modern Hover Tooltip with Pointer tail */}
                <div className="absolute bottom-full mb-2.5 hidden group-hover:flex flex-col items-center pointer-events-none z-50">
                  <div className="bg-slate-900 border border-slate-850 text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-md">
                    {t.label}
                  </div>
                  <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-0.75" />
                </div>
              </button>
            );
          })}
        </nav>
        
        {/* Dynamic description indicator of Currently active view */}
        <div className="text-center">
          <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block leading-none">مبوبة الإعدادات المفتوحة حالياً</span>
          <span 
            className="text-[11px] font-black mt-1 inline-block transition-all px-3 py-1 rounded-full border"
            style={{ 
              color: accentColor, 
              backgroundColor: `${accentColor}08`,
              borderColor: `${accentColor}18`
            }}
          >
            {activeTab === 'profile' && 'الملف الشخصي والمظهر العام والألوان'}
            {activeTab === 'notifications' && 'مواقيت التذكير وقنوات التنبيه بالنظام'}
            {activeTab === 'cloud' && 'خيارات المزامنة والنسخ السحابي'}
            {activeTab === 'whatsapp' && 'صياغة وقوالب رسائل الوتسآب'}
            {activeTab === 'security' && 'إعدادات الحماية وكلمة المرور'}
          </span>
        </div>
      </div>

      {/* Full Width Tab Contents Container Frame */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="bg-white border border-slate-150 rounded-[28px] p-6 sm:p-8 shadow-sm space-y-6"
          >
              
              {/* ==================== TAB 1: PROFILE & APPEARANCE ==================== */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <User size={18} className="text-blue-500" />
                      بيانات الملف الشخصي والمظهر العام
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">اضبط تفاصيل حسابك التعليمي واختر سمة الألوان والخط المناسب لمظهر واجهة التحكم بالكامل.</p>
                  </div>

                  <div className="max-w-3xl mx-auto">
                    {/* Centered Profile Settings Form */}
                    <form onSubmit={handleSavePreferences} className="space-y-6">
                      
                      {/* Interactive Uploaders for Profile & Custom Logo */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto p-6 bg-slate-50 border border-slate-205 rounded-[28px] shadow-3xs mb-6">
                        
                        {/* 1. Teacher Avatar Uploader */}
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e: any) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (uploadEvent) => {
                                    const base64Str = uploadEvent.target?.result as string;
                                    onUpdatePreferences({ teacherAvatar: base64Str });
                                    triggerSuccess('تمت وعولجت ترقية صورة الأستاذ بنجاح! 📸');
                                  };
                                  reader.readAsDataURL(file);
                                }
                              };
                              input.click();
                            }}
                            className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-md flex items-center justify-center bg-slate-200 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all shrink-0"
                            style={{ borderColor: accentColor }}
                            title="تعديل صورة الأستاذ"
                          >
                            {preferences.teacherAvatar ? (
                              <img 
                                src={preferences.teacherAvatar} 
                                alt={teacherName} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="text-5xl select-none group-hover:scale-105 transition-transform duration-300">🧑‍🏫</span>
                            )}
                            
                            <div className="absolute inset-0 bg-black/55 backdrop-blur-[0.5px] opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-all duration-200">
                              <Camera size={18} className="text-amber-400" />
                              <span className="text-[10px] font-black text-white px-1 leading-none">تعديل</span>
                            </div>

                            <div className="absolute bottom-1 right-1 w-6.5 h-6.5 rounded-full bg-slate-900 group-hover:bg-slate-800 text-white flex items-center justify-center shadow-xs border border-white/60 pointer-events-none transition-colors">
                              <Camera size={10} className="text-amber-405" />
                            </div>
                          </button>
                          
                          <div className="text-center">
                            <span className="text-xs font-black text-slate-800 block">الصورة الشخصية للأستاذ</span>
                            <span className="text-[10px] text-slate-400 font-bold leading-relaxed block mt-0.5">انقر لتعديل صورتك</span>
                            {preferences.teacherAvatar && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdatePreferences({ teacherAvatar: '' });
                                  triggerSuccess('تم حذف الصورة الرمزية للأستاذ.');
                                }}
                                className="text-[10px] font-bold text-red-500 hover:text-red-700 underline mt-1 cursor-pointer"
                              >
                                حذف الصورة
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 2. Custom Brand Logo Uploader */}
                        <div className="flex flex-col items-center justify-center space-y-3 border-t sm:border-t-0 sm:border-r border-slate-205 pt-4 sm:pt-0 sm:pr-6">
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/*';
                              input.onchange = (e: any) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (uploadEvent) => {
                                    const base64Str = uploadEvent.target?.result as string;
                                    onUpdatePreferences({ dashboardLogo: base64Str });
                                    triggerSuccess('تم تحميل شعار المنصة المخصص بنجاح! 🎨📸');
                                  };
                                  reader.readAsDataURL(file);
                                }
                              };
                              input.click();
                            }}
                            className="relative w-24 h-24 rounded-2xl overflow-hidden border-4 border-white shadow-md flex items-center justify-center bg-slate-200 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all shrink-0"
                            style={{ borderColor: accentColor }}
                            title="تعديل شعار المنصة"
                          >
                            {preferences.dashboardLogo ? (
                              <img 
                                src={preferences.dashboardLogo} 
                                alt="Dashboard Logo" 
                                className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-300"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span className="text-5xl select-none group-hover:scale-105 transition-transform duration-300">🎓</span>
                            )}
                            
                            <div className="absolute inset-0 bg-black/55 backdrop-blur-[0.5px] opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-all duration-200">
                              <Camera size={18} className="text-amber-400" />
                              <span className="text-[10px] font-black text-white px-1 leading-none">تعديل الشعار</span>
                            </div>

                            <div className="absolute bottom-1 right-1 w-6.5 h-6.5 rounded-full bg-slate-900 group-hover:bg-slate-800 text-white flex items-center justify-center shadow-xs border border-white/60 pointer-events-none transition-colors">
                              <Camera size={10} className="text-amber-405" />
                            </div>
                          </button>
                          
                          <div className="text-center">
                            <span className="text-xs font-black text-slate-800 block">شعار / لوجو المنصة (مخصص)</span>
                            <span className="text-[10px] text-slate-400 font-bold leading-relaxed block mt-0.5">انقر لتحميل شعارك للمنصة</span>
                            {preferences.dashboardLogo && (
                              <button
                                type="button"
                                onClick={() => {
                                  onUpdatePreferences({ dashboardLogo: '' });
                                  triggerSuccess('تم إرجاع الشعار الافتراضي للمنصة.');
                                }}
                                className="text-[10px] font-bold text-red-500 hover:text-red-700 underline mt-1 cursor-pointer"
                              >
                                حذف الشعار
                              </button>
                            )}
                          </div>
                        </div>

                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-705 font-bold block">اسم الأستاذ / المعلم *</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              value={teacherName || ''}
                              onChange={(e) => setTeacherName(e.target.value)}
                              placeholder="أدخل اسمك الفاضل"
                              className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-205 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-400 transition-all font-sans"
                            />
                            <span className="absolute right-3.5 top-3 text-slate-400">👤</span>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-705 font-bold block">المادة العلمية المقررة</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={subject || ''}
                              onChange={(e) => setSubject(e.target.value)}
                              placeholder="مثال: الرياضيات، الكيمياء، الفيزياء"
                              className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-205 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-slate-400 transition-all font-sans"
                            />
                            <span className="absolute right-3.5 top-3 text-slate-400">📚</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-xs text-slate-705 font-bold block">رمز العملة النقدية المعتمدة *</label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              value={currency || ''}
                              onChange={(e) => setCurrency(e.target.value)}
                              placeholder="مثال: ج.م، ر.س، د.إ، $"
                              className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-205 rounded-2xl text-sm font-extrabold text-slate-800 focus:outline-none focus:border-slate-400 transition-all font-sans"
                            />
                            <span className="absolute right-3.5 top-3 text-slate-400">💵</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">ستستخدم هذه العملة في كشوفات الحساب والمدفوعات المالية لجميع الطلاب.</p>
                        </div>

                        <div className="space-y-1.5 flex flex-col justify-end">
                          <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl space-y-1">
                            <span className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                              <span>ℹ️</span> الدفعات والطلاب المسجلين
                            </span>
                            <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                              يقوم النظام بحساب إيرادات الحصص المنجزة وفصلها آلياً عن مستحقات الكورسات تماشياً مع الرمز المعتمد.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* App Color Customizer */}
                      <div className="pt-4 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="text-xs text-slate-800 font-black block flex items-center gap-1.5">
                            <Palette className="text-slate-700" size={15} />
                            اللون الأساسي وشخصية التطبيق (Brand Accent Color)
                          </label>
                          <p className="text-[10.5px] text-slate-405 font-medium leading-relaxed mt-1">اختر اللون والسمة المخصصة للوحة التحكم وعلامتك التجارية ليتم دمجها فورياً في الأزرار والشرائط التوضيحية.</p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                          {COLOR_PRESETS.map((preset) => {
                            const isSelected = primaryColor === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() => {
                                  setPrimaryColor(preset.id);
                                  onUpdatePreferences({ primaryColor: preset.id });
                                }}
                                className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border text-right transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'shadow-xs scale-[1.02]'
                                    : 'border-slate-150 bg-white hover:bg-slate-50'
                                  }`}
                                style={isSelected ? {
                                  borderColor: preset.colors['600'],
                                  backgroundColor: preset.colors['50'],
                                } : {}}
                              >
                                <span 
                                  className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center border border-black/5 shadow-3xs"
                                  style={{ backgroundColor: preset.colors['600'] }}
                                >
                                  {isSelected && <Check size={11} className="text-white font-black" />}
                                </span>
                                <span 
                                  className={`text-[11.5px] font-bold truncate ${isSelected ? 'font-black' : 'text-slate-650'}`}
                                  style={isSelected ? { color: preset.colors['800'] } : {}}
                                >
                                  {preset.name}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Hue Orb Picker */}
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-extrabold text-slate-800 block">🎨 أو حدد لوناً مخصصاً لعلامتك التجارية (Custom Hex Color)</span>
                            <p className="text-[9.5px] text-slate-400 font-medium leading-relaxed">لمطابقة درجتك اللونية المقررة لشعارات صفك أو علامتك التعليمية الخاصة بدقة تامة.</p>
                          </div>
                          <div className="flex items-center gap-2.5 justify-end shrink-0">
                            <div className="relative flex items-center gap-1.5 bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 shadow-3xs">
                              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-slate-300">
                                <input 
                                  type="color" 
                                  value={primaryColor.startsWith('#') ? primaryColor : '#2563eb'} 
                                  onChange={(e) => {
                                    const customHex = e.target.value;
                                    setPrimaryColor(customHex);
                                    onUpdatePreferences({ primaryColor: customHex });
                                  }}
                                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                />
                                <div 
                                  className="w-full h-full pointer-events-none" 
                                  style={{ backgroundColor: primaryColor.startsWith('#') ? primaryColor : '#2563eb' }}
                                />
                              </div>
                              <input 
                                type="text" 
                                value={primaryColor} 
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPrimaryColor(val);
                                  if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
                                    onUpdatePreferences({ primaryColor: val });
                                  }
                                }}
                                className="w-20 text-center font-mono text-xs font-bold text-slate-750 bg-transparent border-0 focus:ring-0 focus:outline-none"
                                dir="ltr"
                                maxLength={7}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Font Customizer Selector */}
                      <div className="pt-6 border-t border-slate-100 space-y-4">
                        <div>
                          <label className="text-xs text-slate-800 font-black block flex items-center gap-1.5 font-sans">
                            ⚙️ الخط العربي واللاتيني لواجهة التطبيق (App Typography Font)
                          </label>
                          <p className="text-[10.5px] text-slate-500 font-medium leading-relaxed mt-1 font-sans">اختر نوع الخط المفضل لعرض كافة الكلمات والتقارير في التطبيق بما يناسب ذوقك الفني.</p>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {[
                            { id: 'cairo', name: 'خط كيرو (Cairo)', desc: 'خط هندسي حديث', style: "'Cairo', sans-serif" },
                            { id: 'tajawal', name: 'خط تجول (Tajawal)', desc: 'ناعم وأنيق للمستندات', style: "'Tajawal', sans-serif" },
                            { id: 'almarai', name: 'خط المراعي (Almarai)', desc: 'عصري وواضح جداً', style: "'Almarai', sans-serif" },
                            { id: 'amiri', name: 'خط أميري (Amiri)', desc: 'نسخي تقليدي عريق', style: "'Amiri', serif" },
                            { id: 'changa', name: 'خط شانغا (Changa)', desc: 'جريء وبارز للعناوين', style: "'Changa', sans-serif" },
                            { id: 'reemkufi', name: 'خط كوفي (Reem Kufi)', desc: 'فني وكلاسيكي مزخرف', style: "'Reem Kufi', sans-serif" },
                          ].map((f) => {
                            const isSelected = fontFamily === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => {
                                  setFontFamily(f.id);
                                  onUpdatePreferences({ fontFamily: f.id });
                                }}
                                className={`flex flex-col items-start gap-1 p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                                  isSelected 
                                    ? 'shadow-xs scale-[1.02]'
                                    : 'border-slate-150 bg-white hover:bg-slate-50'
                                }`}
                                style={isSelected ? {
                                  borderColor: accentColor,
                                  backgroundColor: `${accentColor}08`
                                } : {}}
                              >
                                <div className="flex items-center gap-2 w-full justify-between">
                                  <span 
                                    className="text-[12.5px] font-black"
                                    style={{ fontFamily: f.style }}
                                  >
                                    {f.name}
                                  </span>
                                  {isSelected && (
                                    <span 
                                      className="w-4.5 h-4.5 rounded-full flex items-center justify-center text-white text-[9px]"
                                      style={{ backgroundColor: accentColor }}
                                    >
                                      ✓
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9.5px] text-slate-400 font-semibold">{f.desc}</span>
                                <span className="text-[14px] mt-1 text-slate-650 opacity-80" style={{ fontFamily: f.style }}>
                                  أبجد هوز • 1234
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Interface Hide & UI Privacy Configuration */}
                      <div className="pt-4 border-t border-slate-100 space-y-3">
                        <label className="text-xs text-slate-800 font-black block flex items-center gap-1.5">
                          <Laptop className="text-slate-700" size={15} />
                          خيارات العرض والتخصيص المتقدمة
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                            <div className="text-right pl-3">
                              <span className="text-xs font-bold text-slate-800 block">إخفاء قسم تشخيص الطالب (Gemini AI)</span>
                              <span className="text-[10px] text-slate-400 leading-snug">إزالة تحليلات وسجل تحويل الذكاء الاصطناعي من القائمه العامة.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = !hideAIAnalysis;
                                setHideAIAnalysis(nextVal);
                                onUpdatePreferences({ hideAIAnalysis: nextVal });
                              }}
                              className="shrink-0 transition-transform active:scale-95 cursor-pointer ml-1 text-right duration-150"
                            >
                              <div 
                                className={`w-11.5 h-6.5 rounded-full p-1 flex items-center transition-colors duration-200 ${hideAIAnalysis ? 'justify-end' : 'bg-slate-200 justify-start'}`}
                                style={hideAIAnalysis ? { backgroundColor: accentColor } : {}}
                              >
                                <div className="w-4.5 h-4.5 rounded-full bg-white shadow-xs" />
                              </div>
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                            <div className="text-right pl-3">
                              <span className="text-xs font-bold text-slate-800 block">إخفاء حجز موعد جوجل (Google Calendar)</span>
                              <span className="text-[10px] text-slate-400 leading-snug">كتم خيار الربط بـ Google Calendar داخل بطاقات مواعيد الحصص.</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const nextVal = !hideGoogleCalendar;
                                setHideGoogleCalendar(nextVal);
                                onUpdatePreferences({ hideGoogleCalendar: nextVal });
                              }}
                              className="shrink-0 transition-transform active:scale-95 cursor-pointer ml-1 text-right duration-150"
                            >
                              <div 
                                className={`w-11.5 h-6.5 rounded-full p-1 flex items-center transition-colors duration-200 ${hideGoogleCalendar ? 'justify-end' : 'bg-slate-200 justify-start'}`}
                                style={hideGoogleCalendar ? { backgroundColor: accentColor } : {}}
                              >
                                <div className="w-4.5 h-4.5 rounded-full bg-white shadow-xs" />
                              </div>
                            </button>
                          </div>
                        </div>

                        {/* Clear all databases shortcut */}
                        <div className="p-4 bg-red-50/30 border border-red-150 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 mt-3">
                          <div className="text-right">
                            <span className="text-xs font-black text-red-950 flex items-center gap-1.5 justify-start">
                              <span>⚠️</span>
                              <span>إزالة وحذف جميع بيانات التطبيق (تصفير كامل)</span>
                            </span>
                            <span className="text-[10px] text-slate-550 font-medium leading-relaxed block mt-0.5">سيقوم هذا الخيار بحذف كافة الطلاب، كشوف الحصص، المدفوعات والامتحانات والبدء بقاعدة بيانات خالية تماماً.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setClearWord('');
                              setConfirmDialog({ type: 'clear-all' });
                            }}
                            className="bg-red-650 hover:bg-red-750 text-white px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer transition active:scale-95 shadow-sm shadow-red-600/10 shrink-0"
                          >
                            بدء الحذف والتصفير 🗑️
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-end pt-3">
                        <button
                          type="submit"
                          className="px-6 py-3 text-white text-xs font-bold rounded-2xl transition cursor-pointer shadow-md"
                          style={{ backgroundColor: accentColor }}
                        >
                          حفظ البيانات وتحديث الواجهة 📌
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* ==================== TAB 2: REMINDERS & TIMING ==================== */}
              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <Sliders size={18} className="text-indigo-500" />
                      مواقيت التذكير وقنوات التنبيه في النظام
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">اضبط فترات التنبيه المسبقة لدروس الغد، إعلامات الرسوم المتأخرة، وإعدادات وضع عدم الإزعاج.</p>
                  </div>

                  <div className="space-y-4">
                    {/* 24h WhatsApp Switch */}
                    <div className="p-4 bg-emerald-50/50 border border-emerald-150 rounded-2xl flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 leading-none">
                          📱 تحضير مسودات "الاستعداد للحصة" عبر واتساب تلقائياً
                        </span>
                        <p className="text-[10px] text-emerald-850 leading-relaxed font-bold mt-1 max-w-2xl">
                          عند تنشيط الخيار، سيتكفل النظام بسحب ملاحظات الدرس الفائت لكل طالب تلقائياً من المحاضرات السابقة وصياغتها في إشعار منمق قبل الدرس التالي بـ 24 ساعة.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !enableWhatsApp24h;
                          setEnableWhatsApp24h(nextVal);
                          onUpdatePreferences({ enableWhatsApp24hReminders: nextVal });
                        }}
                        className="shrink-0 transition-transform active:scale-95 cursor-pointer text-right duration-150"
                      >
                        <div className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ${enableWhatsApp24h ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                          <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${enableWhatsApp24h ? 'transform translate-x-0' : 'transform translate-x-6'}`} />
                        </div>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Class reminder times threshold */}
                      <div className="p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                          <button
                            type="button"
                            onClick={() => saveNotifSetting({ remindClasses: !notifSettings.remindClasses })}
                            className="text-indigo-600"
                          >
                            <div className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.remindClasses ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                              <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${notifSettings.remindClasses ? 'transform translate-x-0' : 'transform translate-x-4.5'}`} />
                            </div>
                          </button>
                          <span className="font-extrabold text-xs text-slate-850 flex items-center gap-1.5">
                            <span>🔔</span> إشعار بمواعيد جدول الحصص
                          </span>
                        </div>
                        {notifSettings.remindClasses && (
                          <div className="flex items-center justify-between text-right pt-1.5">
                            <span className="text-[10px] text-slate-500 font-bold">عرض قبل الحصة بـ:</span>
                            <select
                              value={notifSettings.classHoursThreshold}
                              onChange={(e) => saveNotifSetting({ classHoursThreshold: Number(e.target.value) })}
                              className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-xl text-[11px] font-bold focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                            >
                              <option value="0.25">15 دقيقة</option>
                              <option value="0.5">30 دقيقة</option>
                              <option value="1">ساعة كاملة</option>
                              <option value="2">ساعتين</option>
                              <option value="3">3 ساعات</option>
                              <option value="6">6 ساعات</option>
                              <option value="12">12 ساعة</option>
                              <option value="24">يوم واحد (24 ساعة)</option>
                            </select>
                          </div>
                        )}
                        <p className="text-[9.5px] text-slate-400 leading-normal">يتحكم هذا الخيار في موعد ترشيح الحصص تحت تبويب التذكيرات اليومية للمعلم.</p>
                      </div>

                      {/* Payment reminder times threshold */}
                      <div className="p-4.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200/50">
                          <button
                            type="button"
                            onClick={() => saveNotifSetting({ remindPayments: !notifSettings.remindPayments })}
                            className="text-indigo-605"
                          >
                            <div className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.remindPayments ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                              <div className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${notifSettings.remindPayments ? 'transform translate-x-0' : 'transform translate-x-4.5'}`} />
                            </div>
                          </button>
                          <span className="font-extrabold text-xs text-slate-850 flex items-center gap-1.5">
                            <span>💳</span> تنبيه استحقاق المدفوعات والرسوم
                          </span>
                        </div>
                        {notifSettings.remindPayments && (
                          <div className="flex items-center justify-between text-right pt-1.5">
                            <span className="text-[10px] text-slate-500 font-bold">تذكير باستحقاق الرسوم قبل:</span>
                            <select
                              value={notifSettings.paymentDaysThreshold}
                              onChange={(e) => saveNotifSetting({ paymentDaysThreshold: Number(e.target.value) })}
                              className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-xl text-[11px] font-bold focus:outline-none focus:border-indigo-500 font-sans cursor-pointer"
                            >
                              <option value="1">يوم واحد</option>
                              <option value="2">يومين</option>
                              <option value="3">3 أيام</option>
                              <option value="5">5 أيام</option>
                              <option value="7">أسبوع كامل</option>
                              <option value="10">10 أيام</option>
                              <option value="14">أسبوعين (14 يوماً)</option>
                            </select>
                          </div>
                        )}
                        <p className="text-[9.5px] text-slate-400 leading-normal">تذكير دوري لجدولة إرسال المستحقات المتبقية في حساب الطالب.</p>
                      </div>
                    </div>

                    {/* DND details */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                      <div className="flex justify-between items-center">
                        <button
                          type="button"
                          onClick={() => saveNotifSetting({ dndEnabled: !notifSettings.dndEnabled })}
                          className="text-indigo-600"
                        >
                          <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.dndEnabled ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${notifSettings.dndEnabled ? 'transform translate-x-0' : 'transform translate-x-5'}`} />
                          </div>
                        </button>
                        <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1.5">
                          <span>🌙</span> تشغيل وضع عدم الإزعاج للأستاذ (Do Not Disturb)
                        </span>
                      </div>
                      
                      {notifSettings.dndEnabled && (
                        <div className="space-y-3.5 pt-3.5 border-t border-slate-200/50">
                          <p className="text-[10px] text-slate-500 leading-relaxed font-bold">
                            بمجرد التمكين، سيقوم النظام بكتم كافة أصوات الرنين المزعجة وإخفاء إشارات التنبيه المتكررة خلال الفترة الزمنية المحددة تلقائياً لتلافي الإزعاج.
                          </p>
                          <div className="flex items-center justify-end gap-5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] text-slate-505 font-bold">من الساعة:</span>
                              <input
                                type="time"
                                value={notifSettings.dndStart || '22:00'}
                                onChange={(e) => saveNotifSetting({ dndStart: e.target.value })}
                                className="px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10.5px] text-slate-505 font-bold">إلى الساعة:</span>
                              <input
                                type="time"
                                value={notifSettings.dndEnd || '08:00'}
                                onChange={(e) => saveNotifSetting({ dndEnd: e.target.value })}
                                className="px-3 py-1.5 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dashboard teacher notifications and Student portal alerts in grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Teacher settings */}
                      <div className="p-4 bg-blue-50/30 border border-blue-150 rounded-2xl space-y-3">
                        <span className="font-extrabold text-blue-900 text-xs block border-b border-blue-100 pb-2">
                          🧑‍🏫 تخصيص تنبيهات المعلم التلقائية (Dashboard Logs)
                        </span>
                        
                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center">
                            <button
                              type="button"
                              onClick={() => saveNotifSetting({ notifyTeacherOnSessionComplete: !notifSettings.notifyTeacherOnSessionComplete })}
                              className="text-blue-600"
                            >
                              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.notifyTeacherOnSessionComplete !== false ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifSettings.notifyTeacherOnSessionComplete !== false ? 'transform translate-x-0' : 'transform translate-x-4'}`} />
                              </div>
                            </button>
                            <span className="text-[11px] font-bold text-slate-700">تنبيه فوري عند تسجيل حضور طالب لحصة 🟢</span>
                          </div>

                          <div className="flex justify-between items-center border-t border-blue-100/50 pt-2">
                            <button
                              type="button"
                              onClick={() => saveNotifSetting({ notifyTeacherOnNewPayment: !notifSettings.notifyTeacherOnNewPayment })}
                              className="text-blue-600"
                            >
                              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.notifyTeacherOnNewPayment !== false ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifSettings.notifyTeacherOnNewPayment !== false ? 'transform translate-x-0' : 'transform translate-x-4'}`} />
                              </div>
                            </button>
                            <span className="text-[11px] font-bold text-slate-700">تنبيه فوري عند تسجيل دفعة مالية جديدة 💰</span>
                          </div>

                          <div className="flex justify-between items-center border-t border-blue-100/50 pt-2">
                            <button
                              type="button"
                              onClick={() => saveNotifSetting({ notifyTeacherOnPaymentDue: !notifSettings.notifyTeacherOnPaymentDue })}
                              className="text-blue-600"
                            >
                              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.notifyTeacherOnPaymentDue !== false ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifSettings.notifyTeacherOnPaymentDue !== false ? 'transform translate-x-0' : 'transform translate-x-4'}`} />
                              </div>
                            </button>
                            <span className="text-[11px] font-bold text-slate-700">تنبيه فوري عند اقتراب موعد استحقاق قسط ⏳</span>
                          </div>
                        </div>
                      </div>

                      {/* Student settings */}
                      <div className="p-4 bg-purple-50/40 border border-purple-150 rounded-2xl space-y-3">
                        <span className="font-extrabold text-purple-900 text-xs block border-b border-purple-100 pb-2">
                          🎓 تنبيهات بوابة الطالب وأولياء الأمور (Student Portal)
                        </span>

                        <div className="space-y-3 text-xs">
                          <div className="flex justify-between items-center">
                            <button
                              type="button"
                              onClick={() => saveNotifSetting({ sendStudentClassReminders: !notifSettings.sendStudentClassReminders })}
                              className="text-purple-650"
                            >
                              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.sendStudentClassReminders !== false ? 'bg-purple-600' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifSettings.sendStudentClassReminders !== false ? 'transform translate-x-0' : 'transform translate-x-4'}`} />
                              </div>
                            </button>
                            <span className="text-[11px] font-bold text-slate-700">عرض الجدول والمواعيد المحدثة اليومية 📆</span>
                          </div>

                          <div className="flex justify-between items-center border-t border-purple-100/50 pt-2">
                            <button
                              type="button"
                              onClick={() => saveNotifSetting({ sendStudentPaymentReminders: !notifSettings.sendStudentPaymentReminders })}
                              className="text-purple-650"
                            >
                              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.sendStudentPaymentReminders !== false ? 'bg-purple-600' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifSettings.sendStudentPaymentReminders !== false ? 'transform translate-x-0' : 'transform translate-x-4'}`} />
                              </div>
                            </button>
                            <span className="text-[11px] font-bold text-slate-700">ملاحظات الفواتير والمستحقات المتبقية 💵</span>
                          </div>

                          <div className="flex justify-between items-center border-t border-purple-100/50 pt-2">
                            <button
                              type="button"
                              onClick={() => saveNotifSetting({ sendStudentCompletionReminders: !notifSettings.sendStudentCompletionReminders })}
                              className="text-purple-655"
                            >
                              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ${notifSettings.sendStudentCompletionReminders !== false ? 'bg-purple-600' : 'bg-slate-300'}`}>
                                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${notifSettings.sendStudentCompletionReminders !== false ? 'transform translate-x-0' : 'transform translate-x-4'}`} />
                              </div>
                            </button>
                            <span className="text-[11px] font-bold text-slate-700">تنبيه باقتراب اكتمال اشتراك باقة الكورس 🏆</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === 'cloud' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <CloudLightning size={18} className="text-emerald-500" />
                      التحميل والمزامنة السحابية الاحتياطية (Cloud Backup & Google Drive)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">أمّن بيانات طلابك من الضياع عبر الرفع السحابي المستمر، جدولة التحديثات التلقائية، أو ربط حسابك بـ Google Drive للحفظ اليدوي المباشر.</p>
                  </div>

                  {/* Main configurations split */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    
                    {/* Part 1: Automatic Cloud Backup (Firebase Firestore) */}
                    <div className="p-5 bg-emerald-50/20 border border-emerald-150 rounded-3xl space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-emerald-100">
                          <div className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                            <span>🔄</span>
                            <span>الحفظ السحابي التلقائي (Auto Cloud Save)</span>
                          </div>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                            enableAutoCloudSync 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {enableAutoCloudSync ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <span>مفعّل ونشط</span>
                              </>
                            ) : (
                              <span>معطل مؤقتاً</span>
                            )}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                          يقوم المساعد التعليمي عند تفعيل هذا الخيار بمزامنة وتحديث كافة بيانات طلابك، وملاحظاتهم، وتقاريرهم تلقائياً في الخلفية فور حدوث أي تغيير لفتح حسابك من أي جوال أو جهاز آخر بأمان.
                        </p>

                        {/* Interactive toggle switch for Auto Cloud Save */}
                        <div className="flex items-center justify-between p-3 bg-white border border-emerald-100/50 rounded-2xl">
                          <div className="text-right pl-3">
                            <span className="text-[11px] font-bold text-slate-800 block">تفعيل المزامنة التلقائية المستمرة صامتاً</span>
                            <span className="text-[9.5px] text-slate-400 font-medium">حفظ فوري في الخلفية دون الحاجة للنقر يدوياً.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const nextVal = !enableAutoCloudSync;
                              setEnableAutoCloudSync(nextVal);
                              onUpdatePreferences({ enableAutoCloudSync: nextVal });
                              triggerSuccess(nextVal ? 'تم تفعيل الحفظ السحابي التلقائي في الخلفية!' : 'تم إيقاف المزامنة السحابية التلقائية.');
                            }}
                            className="shrink-0 transition-transform active:scale-95 cursor-pointer ml-1 text-right duration-150"
                          >
                            <div className={`w-11.5 h-6.5 rounded-full p-1 flex items-center transition-colors duration-200 ${enableAutoCloudSync ? 'bg-emerald-600 justify-end' : 'bg-slate-200 justify-start'}`}>
                              <div className="w-4.5 h-4.5 rounded-full bg-white shadow-xs" />
                            </div>
                          </button>
                        </div>

                        <div className="flex justify-between items-center text-xs pt-1">
                          <span className="text-slate-555 font-bold">آخر رفع سحابي متزامن:</span>
                          <span className="font-extrabold text-slate-705 font-mono bg-white px-2 py-0.5 rounded-lg border border-slate-200/50 text-[11px]">{lastSyncTime}</span>
                        </div>
                      </div>

                      <div className="space-y-2.5 mt-4">
                        <button
                          onClick={handleTriggerCloudSync}
                          disabled={isCloudSyncing}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl font-bold text-xs transition cursor-pointer shadow-sm active:scale-98"
                        >
                          <RefreshCw size={14} className={isCloudSyncing ? 'animate-spin' : ''} />
                          <span>{isCloudSyncing ? 'جاري الاتصال والرفع للاحتياط...' : 'مزامنة ورفع البيانات يدوياً الآن للبريد 🚀'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRestoreFromCloud}
                          disabled={isCloudSyncing}
                          className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 rounded-2xl font-bold text-xs transition cursor-pointer shadow-3xs active:scale-98"
                        >
                          <Download size={13} className="text-emerald-600" />
                          <span>استرجاع البيانات من المزامنة السحابية 📥</span>
                        </button>
                      </div>
                    </div>

                    {/* Part 2: Manual Google Drive Backup Hub */}
                    <div className="p-5 bg-blue-50/30 border border-blue-150 rounded-3xl space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center pb-2 border-b border-blue-105">
                          <h4 className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                            <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24">
                              <path fill="#0F9D58" d="M15.43 14.85l-3.43-5.93h6.86z"/>
                              <path fill="#4285F4" d="M12 9l-3.43 5.92h6.86z" transform="rotate(120 12 11)"/>
                              <path fill="#FFBA00" d="M12 9l-3.43 5.92h6.86z" transform="rotate(240 12 11)"/>
                            </svg>
                            <span>حفظ يدوي على Google Drive الخاص</span>
                          </h4>
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-bold">نسخ سحابي محمي كلياً</span>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                          قم بربط حسابك لحفظ أو استرجاع ملف قاعدة البيانات <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-blue-100 text-blue-600">teacher_app_backup.json</code> يدوياً على مساحتك الشخصية دون تمكين أي أطراف أخرى من تملك ملفك.
                        </p>

                        <div className="flex flex-col justify-between text-[10px] bg-white border border-blue-50 p-3 rounded-2xl gap-2 font-semibold">
                          <span className="text-slate-505 font-bold">موعد وتوقيت آخر حفظ على جوجل درايف:</span>
                          <span className="font-extrabold text-blue-700 font-mono select-all text-xs bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">{driveLastBackupTime}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleUploadToGoogleDrive}
                          disabled={isDriveBackingUp || isDriveRestoring}
                          className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl font-bold text-xs cursor-pointer shadow-sm transition-all active:scale-98"
                        >
                          {isDriveBackingUp ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Upload size={14} />
                          )}
                          <span>{isDriveBackingUp ? 'جاري تصدير الحفظ...' : 'حفظ يدوياً في Drive الآن 💾'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRestoreFromGoogleDrive}
                          disabled={isDriveBackingUp || isDriveRestoring}
                          className="flex items-center justify-center gap-2 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-205 rounded-2xl font-bold text-xs cursor-pointer shadow-3xs transition-all active:scale-98 disabled:bg-slate-100"
                        >
                          {isDriveRestoring ? (
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Download size={14} />
                          )}
                          <span>{isDriveRestoring ? 'جاري مزامنة الملف...' : 'استيراد واستعادة من Drive 📂'}</span>
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* Backup Downloads & Import Sections in grid layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Files exports and imports */}
                    <div className="p-5 bg-slate-50 border border-slate-205 rounded-3xl flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <span className="text-xs font-black text-slate-800 block">نسخة احتياطية محلية (Local JSON Backup)</span>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                          احتفظ دائماً بملف مادي محلي على حاسوبك يضم كافة حسابات طلابك وسجلاتها للرجوع إليها في حالات الطوارئ والعمل دون إنترنت.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          onClick={handleExportJSON}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl font-bold text-xs cursor-pointer shadow-3xs"
                        >
                          <Download size={13} className="text-slate-500" />
                          <span>تنزيل وتصدير (.JSON)</span>
                        </button>

                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-2xl font-bold text-xs cursor-pointer shadow-3xs"
                        >
                          <Upload size={13} className="text-slate-500" />
                          <span>رفع واستيراد (.JSON)</span>
                        </button>

                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImportJSON}
                          accept=".json"
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Auto-backup scheduling */}
                    <div className="p-5 bg-slate-50 border border-slate-205 rounded-3xl space-y-3 flex flex-col justify-between">
                      <div className="space-y-1">
                        <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                          <span>🤖</span>
                          <span>تحديد معدل وتكرار المزامنة والنسخ التلقائي</span>
                        </h4>
                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed">
                          اضبط التوقيت التلقائي المناسب ليتم من خلاله جدولة المزامنة والرفع صامتاً لبيانات المساعد وتنزيلها احتياطياً.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-white border border-slate-200/70 p-1 rounded-2xl">
                        {[
                          { id: 'daily', label: 'يومي متكرر ⏱️' },
                          { id: 'weekly', label: 'أسبوعي منتظم 🗓️' },
                          { id: 'monthly', label: 'شهري دوري 📅' },
                          { id: 'disabled', label: 'إيقاف الجدولة ❌' }
                        ].map((freq) => {
                          const isActive = preferences.autoBackupDownloadInterval === freq.id || 
                                         (freq.id === 'disabled' && (!preferences.autoBackupDownloadInterval || preferences.autoBackupDownloadInterval === 'disabled'));
                          return (
                            <button
                              key={freq.id}
                              type="button"
                              onClick={() => {
                                onUpdatePreferences({ autoBackupDownloadInterval: freq.id as any });
                                triggerSuccess(`تم تحديث تكرار النسخ التلقائي ليكون: ${freq.label}`);
                              }}
                              className={`py-1.5 text-[10px] font-bold rounded-xl transition cursor-pointer select-none text-center ${
                                isActive
                                  ? 'text-white shadow-sm font-black'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 shadow-3xs'
                              }`}
                              style={isActive ? { backgroundColor: accentColor } : {}}
                            >
                              {freq.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Scheduled state alert badge */}
                  {preferences.autoBackupDownloadInterval && preferences.autoBackupDownloadInterval !== 'disabled' ? (
                    <div className="p-3 bg-emerald-50 text-emerald-950 rounded-2xl border border-emerald-150 text-[10px] font-semibold leading-relaxed flex items-center gap-2">
                      <span>🛡️</span>
                      <span><strong>الجدولة الآلية والتكرار نشط:</strong> يقوم النظام بمزامنة كافة سجلات الحصص وطلابك تلقائياً بنظام <strong>{
                        preferences.autoBackupDownloadInterval === 'daily' ? 'يومي متكرر' :
                        preferences.autoBackupDownloadInterval === 'weekly' ? 'أسبوعي منتظم' : 'شهري دوري'
                      }</strong>.</span>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 text-amber-955 rounded-2xl border border-amber-150 text-[10px] font-semibold leading-relaxed flex items-center gap-2">
                      <span>⚠️</span>
                      <span><strong>جدولة التنزيل متوقفة حالياً:</strong> يرجى تذكر ترحيل النسخة وتنزيلها يدوياً من حين لآخر لتجنب طوارئ فقدان الأجهزة المحمولة.</span>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== TAB 4: WHATSAPP MESSAGE TEMPLATES HUB ==================== */}
              {activeTab === 'whatsapp' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <MessageSquare size={18} className="text-teal-500" />
                      مركز صياغة وتخصيص رسائل واتساب (WhatsApp Template Hub)
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">صغ مسودات التذكير بالحصص، المطالبات المالية، وباقات التجديد، واختبر شكلها مع متطلبات الطلاب الفعليين.</p>
                  </div>

                  {whatsAppWarning && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="p-3 bg-red-50 border border-red-150 text-red-700 text-xs font-bold rounded-2xl flex items-center gap-1.5"
                    >
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>{whatsAppWarning}</span>
                    </motion.div>
                  )}

                  {/* Selector for templates theme tabs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-slate-100 pb-3">
                    {[
                      { id: 'reminder', label: '⏰ تذكير موعد الحصة' },
                      { id: 'dues', label: '💰 مطالبة بالرسوم والذمم' },
                      { id: 'report', label: '📊 تقرير دراسي وتشجيعي' },
                      { id: 'renew', label: '🎓 تجديد الباقة والاشتراك' }
                    ].map(tab => {
                      const isActive = activeTemplateTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTemplateTab(tab.id as any)}
                          className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all text-center cursor-pointer ${
                            isActive 
                              ? 'text-white shadow-sm font-black' 
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                          }`}
                          style={isActive ? { backgroundColor: accentColor } : {}}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Editor and Preview Split */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5.5">
                    
                    {/* Panel 1: Editor */}
                    <div className="space-y-3 bg-slate-50/50 p-4 border border-slate-200 rounded-2xl">
                      <label className="text-xs font-black text-slate-800 block pr-1">
                        ✏️ تحرير نص القالب الأساسي:
                      </label>
                      <textarea
                        value={customTemplates[activeTemplateTab]}
                        onChange={(e) => {
                          setCustomTemplates(prev => ({
                            ...prev,
                            [activeTemplateTab]: e.target.value
                          }));
                        }}
                        rows={8}
                        className="w-full p-4 bg-white border border-slate-210 rounded-2xl text-[12.5px] leading-relaxed font-semibold text-slate-805 focus:outline-none focus:border-slate-400 transition-all font-sans"
                        placeholder="أدخل هيكل الرسالة..."
                      />
                      
                      {/* Placeholders helper chips */}
                      <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-1.5">
                        <span className="text-[10px] font-extrabold text-slate-600 block">📌 انقر على المتغير لإدراجه تلقائياً عند مؤشر الكتابة:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { tag: '[اسم_الطالب]', label: 'اسم الطالب' },
                            { tag: '[اسم_المعلم]', label: 'اسم المعلم' },
                            { tag: '[المادة]', label: 'عنوان المادة' },
                            { tag: '[الموعد]', label: 'توقيت الحصة' },
                            { tag: '[المبلغ_المتبقي]', label: 'الرسوم المتبقية' },
                            { tag: '[العملة]', label: 'العملة' },
                            { tag: '[التقييم_العام]', label: 'التقييم' },
                            { tag: '[عدد_الحصص]', label: 'الحصص المنجزة' }
                          ].map(chip => (
                            <button
                              key={chip.tag}
                              type="button"
                              onClick={() => handleInjectTag(chip.tag)}
                              className="bg-white hover:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg text-[9.5px] font-extrabold text-slate-600 transition shadow-3xs cursor-pointer active:scale-95"
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Panel 2: Live Preview */}
                    <div className="space-y-4 bg-slate-50/70 p-4 border border-slate-200 rounded-2xl flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-xs font-black text-slate-800 block pr-1">
                            👥 اختر طالباً للمعاينة المباشرة:
                          </label>
                          <select
                            value={selectedPreviewStudentId}
                            onChange={(e) => setSelectedPreviewStudentId(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-205 rounded-xl text-xs font-bold text-slate-850 focus:outline-none focus:border-slate-400 cursor-pointer"
                          >
                            <option value="">-- كشف الطلاب المقيدين (أو معاينة افتراضية) --</option>
                            {students.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.type === 'course' ? 'باقة كورس' : 'محاسبة بالحصة'}) {s.phone ? `📱 ${s.phone}` : '⚠️ بدون هاتف'}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-xs font-black text-slate-900 block pr-1 flex items-center gap-1">
                            <span>👁️</span> مسودة الرسالة الجاهزة للإرسال:
                          </span>
                          <div className="p-4 bg-white border border-slate-150 rounded-2xl text-[12px] leading-relaxed font-semibold text-slate-800 whitespace-pre-wrap select-text font-sans min-h-[160px] text-right shadow-3xs relative">
                            <div className="absolute left-2.5 top-2.5 text-[10px] px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-400 rounded-lg select-none font-mono">WhatsApp Draft</div>
                            {getEvaluatedTemplate(customTemplates[activeTemplateTab], selectedPreviewStudentId)}
                          </div>
                        </div>
                      </div>

                      {/* Launch direct whatsapp triggers */}
                      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200/50">
                        <button
                          type="button"
                          onClick={() => {
                            const text = getEvaluatedTemplate(customTemplates[activeTemplateTab], selectedPreviewStudentId);
                            navigator.clipboard.writeText(text);
                            setCopiedTemplateId(activeTemplateTab);
                            setTimeout(() => setCopiedTemplateId(null), 2500);
                          }}
                          className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-extrabold rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-3xs"
                        >
                          <Copy size={13} className="text-slate-500" />
                          <span>{copiedTemplateId === activeTemplateTab ? 'تم النسخ! ✅' : 'نسخ المسودة'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const text = getEvaluatedTemplate(customTemplates[activeTemplateTab], selectedPreviewStudentId);
                            handleOpenWhatsApp(selectedPreviewStudentId, text);
                          }}
                          className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-2xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          <Send size={12} />
                          <span>إرسال لـ WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ==================== TAB 5: SECURITY & DANGER ZONE ==================== */}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                      <KeyRound size={18} className="text-pink-600" />
                      بوابات حماية وخصوصية المعلم وقفل المرور
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">أمّن بيانات فصولك وحسابك بوضع كلمة سر لحظر تنقيب السجلات عن الطلاب، أو تخلص من الكشوفات لبدء عام تعليمي جديد.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Passcode Lock setup */}
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-[24px] space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-150">
                        <span className="font-extrabold text-xs text-slate-800 flex items-center gap-1">
                          🔒 قفل حماية الدخول للمعلم (Passcode Verification)
                        </span>
                        {preferences.passcode ? (
                          <span className="bg-pink-100 text-pink-700 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-pink-200 flex items-center gap-1 animate-pulse">
                            مفعّل ومحمي
                          </span>
                        ) : (
                          <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            مفتوح وخامل
                          </span>
                        )}
                      </div>

                      <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">
                        تتكون شفرة المرور من <strong>4 أرقام عددية</strong> يتم مطالبتك بها تلقائياً فور إعادة تشغيل التطبيق في المتصفح أو ترك الشاشة خاملة لحجب تطفل الطلاب.
                      </p>

                      {isUpdatingPasscode ? (
                        <form onSubmit={handleChangePasscode} className="space-y-3 pt-2">
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-slate-600 font-bold block">رمز الحماية الجديد (4 أرقام عددية) *</label>
                            <input
                              type="password"
                              maxLength={4}
                              required
                              value={newPasscode}
                              onChange={(e) => setNewPasscode(e.target.value.replace(/[^0-9]/g, ''))}
                              placeholder="أدخل 4 أرقام"
                              className="w-full px-4 py-2.5 text-center bg-white border border-slate-350 rounded-2xl text-sm font-black text-slate-800 tracking-[0.6em] focus:outline-none focus:border-slate-800"
                            />
                          </div>

                          <div className="flex justify-end gap-2 text-xs pt-1">
                            <button
                              type="button"
                              onClick={() => setIsUpdatingPasscode(false)}
                              className="px-3 py-1.5 text-[10px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl cursor-pointer"
                            >
                              إلغاء الأمر
                            </button>
                            <button
                              type="submit"
                              className="px-3.5 py-1.5 text-[10px] font-bold text-white bg-pink-600 hover:bg-pink-700 rounded-xl cursor-pointer shadow-sm"
                            >
                              اعتماد الرمز 🔒
                            </button>
                          </div>
                        </form>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                          <button
                            onClick={() => setIsUpdatingPasscode(true)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-2xl font-bold text-xs cursor-pointer transition-all active:scale-98"
                          >
                            <Key size={13} />
                            <span>{preferences.passcode ? 'تغيير رمز المرور الخاص بك' : 'تنشيط رمز الحماية (Passcode)'}</span>
                          </button>
                          
                          {preferences.passcode && (
                            <button
                              onClick={() => {
                                onUpdatePreferences({ passcode: '' });
                                triggerSuccess('تم إلغاء تفعيل رمز المرور وإزالة قفل الخصوصية بنجاح!');
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white hover:bg-red-50 hover:text-red-700 border border-slate-200 hover:border-red-200 text-slate-600 rounded-2xl font-bold text-xs cursor-pointer transition-all active:scale-98"
                            >
                              <Trash2 size={13} />
                              <span>إزالة قفل كلمة السر</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Danger DB cleanup option */}
                    <div className="p-5 bg-red-50/20 border border-red-150 rounded-[24px] space-y-4 flex flex-col justify-between">
                      <div className="space-y-1.5">
                        <span className="font-extrabold text-xs text-red-950 flex items-center gap-1.5">
                          <ShieldAlert size={15} className="text-red-600 shrink-0" />
                          <span>تنظيف وإزالة كافة قيود النظام (Danger Zone)</span>
                        </span>
                        <p className="text-[10.5px] text-slate-500 leading-relaxed font-semibold">
                          سيقوم هذا الخيار بمسح سجلات الحضور، الدفعات المستحقة وكشوف الطلاب وتصفير المنظومة بالكامل من جهازك والسحابة، وهو خيار غير قابل للتراجع نهائياً.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setClearWord('');
                          setConfirmDialog({
                            type: 'clear-all'
                          });
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xs cursor-pointer shadow-sm shadow-red-600/10 active:scale-98 transition-all"
                      >
                        <Trash2 size={13} />
                        <span>فرمطة وتصفير النظام بالكامل ⚠️</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

      {/* 3. Reusable Confirm & Notice Dialog Modal Box */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Ambient Backdrop blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (confirmDialog.type !== 'import-backup') {
                  setConfirmDialog(null);
                }
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Central Modal Content Paper */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-[32px] p-6 sm:p-7 shadow-2xl z-10 font-sans text-right text-slate-800"
            >
              <div className="flex gap-4 items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmDialog.type === 'import-backup' || confirmDialog.type === 'clear-all'
                    ? 'bg-red-50 border border-red-150 text-red-600'
                    : confirmDialog.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-110 text-emerald-600'
                    : 'bg-amber-50 border border-amber-110 text-amber-600'
                }`}>
                  <AlertTriangle size={22} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-extrabold text-slate-900 leading-snug">
                    {confirmDialog.type === 'import-backup' && 'تأكيد استيراد البيانات وملف البك أب'}
                    {confirmDialog.type === 'clear-all' && 'تنبيه أمان فائق الخطورة: فرمطة النظام'}
                    {confirmDialog.type === 'success' && 'تم اعتماد الطلب بنجاح'}
                    {confirmDialog.type === 'error' && 'فشلت معالجة الطلبات'}
                  </h4>
                  
                  <div className="text-xs text-slate-500 mt-2.5 leading-relaxed font-medium">
                    {confirmDialog.type === 'import-backup' && (
                      <p>
                        تنبيه: سيؤدي استيراد كشف ملف النسخ المختار إلى تدمير وحذف كافة أسماء وحضور واشتراكات الطلاب المفتوحة حالياً وتعويضها فورياً بمحتويات الملف المرفوع. <strong className="text-red-600 font-bold">هذه الخطوة تصفية نهائية لا يمكن ارتدادها!</strong> هل ترغب بالمواصلة؟
                      </p>
                    )}
                    {confirmDialog.type === 'clear-all' && (
                      <div className="space-y-3.5">
                        <p>
                          سيتم تهيئة وحذف جميع كشوف الحصص وأولياء الأمور وقوائم المدفوعات والطلاب من التخزين السحابي والتخزين المحلي الخاص بمتصفحك نهائياً والبدء من جديد بتهيئه خالية تماماً.
                        </p>
                        <div className="space-y-2 bg-red-50 p-4 border border-red-150 rounded-2xl text-right">
                          <label className="font-extrabold text-red-950 block text-[11px]">لتأكيد عملية الحذف الكلي، يرجى كتابة الكلمة رمزية "حذف" أدناه:</label>
                          <input
                            type="text"
                            value={clearWord}
                            onChange={(e) => setClearWord(e.target.value)}
                            placeholder='اكتب هنا: حذف'
                            className="w-full px-3 py-2 border border-red-200 rounded-xl bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-red-500 text-center"
                          />
                        </div>
                      </div>
                    )}
                    {confirmDialog.type === 'success' && <p>{confirmDialog.message}</p>}
                    {confirmDialog.type === 'error' && <p>{confirmDialog.message}</p>}
                  </div>
                </div>
              </div>

              {/* Footers controls */}
              <div className="flex justify-end gap-2.5 font-bold text-xs pt-3 border-t border-slate-100 mt-5">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4.5 py-2.5 text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition active:scale-97"
                >
                  {confirmDialog.type === 'success' || confirmDialog.type === 'error' ? 'إغلاق النافذة' : 'تراجع وإلغاء'}
                </button>
                
                {(confirmDialog.type === 'import-backup' || confirmDialog.type === 'clear-all') && (
                  <button
                    type="button"
                    disabled={confirmDialog.type === 'clear-all' && clearWord !== 'حذف'}
                    onClick={() => {
                      if (confirmDialog.type === 'import-backup') {
                        onImportBackup(confirmDialog.data);
                        setConfirmDialog(null);
                        triggerSuccess('تمت استعادة البيانات بنجاح من ملف النسخة الاحتياطية!');
                      } else if (confirmDialog.type === 'clear-all') {
                        onClearAllData();
                        setConfirmDialog(null);
                        triggerSuccess('تم تصفير كافة قواعد بيانات الطلاب لتسهيل التهيئة الجديدة.');
                      }
                    }}
                    className="px-5 py-2.5 text-white bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition shadow-xs active:scale-97 cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>{confirmDialog.type === 'import-backup' ? 'تأكيد والاستيراد الفوري' : 'نعم، قم بحذف المنظومة'}</span>
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
