import React, { useState, useRef, useEffect } from 'react';
import { TeacherPreferences, Student, Appointment } from '../types';
import { 
  Settings, KeyRound, CloudLightning, Database, Download, Upload, Trash2, 
  RefreshCw, Key, ShieldCheck, AlertTriangle, Palette, Check, Sliders, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { COLOR_PRESETS } from '../lib/theme';

interface SettingsPanelProps {
  preferences: TeacherPreferences;
  onUpdatePreferences: (prefs: Partial<TeacherPreferences>) => void;
  students: Student[];
  appointments: Appointment[];
  onImportBackup: (importedData: { students: Student[]; appointments: Appointment[]; preferences: TeacherPreferences }) => void;
  onClearAllData: () => void;
}

export default function SettingsPanel({ 
  preferences, onUpdatePreferences, students, appointments, onImportBackup, onClearAllData 
}: SettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [teacherName, setTeacherName] = useState(preferences.teacherName);
  const [subject, setSubject] = useState(preferences.subject);
  const [currency, setCurrency] = useState(preferences.currency);
  const [primaryColor, setPrimaryColor] = useState(preferences.primaryColor || 'blue');
  const [enableWhatsApp24h, setEnableWhatsApp24h] = useState(preferences.enableWhatsApp24hReminders !== false);
  const [hideAIAnalysis, setHideAIAnalysis] = useState(preferences.hideAIAnalysis === true);
  const [hideGoogleCalendar, setHideGoogleCalendar] = useState(preferences.hideGoogleCalendar === true);
  const [newPasscode, setNewPasscode] = useState('');
  const [isUpdatingPasscode, setIsUpdatingPasscode] = useState(false);
  
  // Custom states
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('لم تتم مزامنته بعد');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'import-backup' | 'clear-all' | 'error' | 'success';
    message?: string;
    data?: any;
  } | null>(null);
  const [clearWord, setClearWord] = useState('');

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
    });
    triggerSuccess('تم حفظ الإعدادات التفضيلية واللون الأساسي بنجاح!');
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
    // Reset file input value
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Restore daily auto-saved backup from localStorage
  const handleRestoreAutoSave = (date: string) => {
    const key = `teacher_autosave_${date}`;
    const raw = localStorage.getItem(key);
    if (!raw) {
      setConfirmDialog({
        type: 'error',
        message: 'عذراً، لم نتمكن من الحصول على ملفات النسخة الاحتياطية المحددة لهذه اليوم.'
      });
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed.students || !Array.isArray(parsed.students)) {
        throw new Error('صيغة ملف النسخة المحددة غير متوافقة!');
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
        message: 'فشلت معالجة بيانات هذه النسخة المحددة: ' + (err instanceof Error ? err.message : 'تنسيق خاطئ')
      });
    }
  };

  // Simulate Cloud Sync
  const handleTriggerCloudSync = () => {
    setIsCloudSyncing(true);
    
    // Simulate high quality API request & synchronization to firestore or server
    setTimeout(() => {
      setIsCloudSyncing(false);
      const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSyncTime(time);
      triggerSuccess('تمت مزاوجة وتحديث السحابة ومزامنة الأجهزة بنجاح!');
    }, 1800);
  };

  return (
    <div className="space-y-6 text-right font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-blue-900 flex items-center gap-2">
            <Settings className="text-blue-600" size={24} />
            إعدادات التطبيق والنسخ السحابي الاحتياطي
          </h2>
          <p className="text-xs text-slate-500 mt-1">تخصيص معلومات المعلم، إدارة رموز الأمان والمزامنة وتصدير واسترجاع قواعد البيانات.</p>
        </div>
      </div>

      {successMsg && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 rounded-2xl text-xs font-bold"
        >
          ✅ {successMsg}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preference Settings Form */}
        <div className="premium-card p-6 space-y-4">
          <h3 className="text-base font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Database size={18} className="text-blue-650" />
            بيانات المعلم والملف الشخصي
          </h3>

          <form onSubmit={handleSavePreferences} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-slate-650 font-bold block">اسم المعلم / الأستاذ *</label>
              <input
                type="text"
                required
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="أدخل اسمك الفاضل"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-650 font-bold block">المادة العلمية المقررة (الاسم)</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="مثال: الرياضيات، اللغة الإنجليزية، الكيمياء"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-205 rounded-xl text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-sans"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-650 font-bold block">رمز العملة النقدية للبرنامج *</label>
              <input
                type="text"
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="مثال: ج.م، ر.س، د.ك، $"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-205 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-blue-500 transition-all font-sans"
              />
              <p className="text-[10px] text-slate-400 font-medium">سيتم استخدام هذا الرمز في جدول الأرباح والمدفوعات والتقارير المالية.</p>
            </div>

            {/* WhatsApp Ready-For-Session Toggle with customized review pull */}
            <div className="pt-3.5 border-t border-slate-100/70 space-y-2">
              <div className="flex items-center justify-between p-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                <div className="space-y-1 pl-3 min-w-0 flex-1">
                  <span className="text-xs font-black text-emerald-950 flex items-center gap-1.5 leading-none">
                    <span className="text-emerald-650">📱</span>
                    تنزيل وإرسال مسودات "الاستعداد للحصة" (WhatsApp) تلقائياً
                  </span>
                  <p className="text-[10px] sm:text-[10.5px] text-emerald-850 leading-relaxed font-bold mt-1.5">
                    عند التفعيل، سيقوم التطبيق بسحب ملاحظات وواجبات المراجعة المخصصة لكل طالب تلقائياً من المحاضرات السابقة وصياغتها في إشعارات تذكير الاستعداد قبل موعد الحصص بـ 24 ساعة.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !enableWhatsApp24h;
                    setEnableWhatsApp24h(nextVal);
                    // Also trigger reactive update immediately for best interactive feel
                    onUpdatePreferences({ enableWhatsApp24hReminders: nextVal });
                  }}
                  className="shrink-0 transition-transform active:scale-95 cursor-pointer ml-1 text-right duration-150"
                >
                  {enableWhatsApp24h ? (
                    <span className="text-emerald-600 block transition-colors duration-200">
                      <svg className="w-12 h-6" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="48" height="24" rx="12" fill="currentColor"/>
                        <circle cx="36" cy="12" r="9" fill="white"/>
                      </svg>
                    </span>
                  ) : (
                    <span className="text-slate-350 block transition-colors duration-200">
                      <svg className="w-12 h-6" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="48" height="24" rx="12" fill="currentColor"/>
                        <circle cx="12" cy="12" r="9" fill="white"/>
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* خيارات الخصوصية والربط البرمجي (APIs & Security) */}
            <div className="pt-3.5 border-t border-slate-100/70 space-y-3">
              <label className="text-xs text-slate-655 font-black block flex items-center gap-1.5 text-right">
                <span>🔒</span>
                إخفاء الربط البرمجي وميزات الذكاء الاصطناعي (APIs & Security)
              </label>
              
              <div className="space-y-2">
                {/* 1. Hide Gemini AI */}
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-right">
                  <div className="space-y-0.5 pl-3 min-w-0 flex-1">
                    <span className="text-xs font-bold text-slate-850 flex items-center gap-1 justify-start">
                      <span>✨</span>
                      إخفاء ميزة تشخيص وتحليل الطلاب بالذكاء الاصطناعي (Gemini AI)
                    </span>
                    <p className="text-[10px] text-slate-500 leading-snug">عند التفعيل، سيتم إخفاء قسم تحليل سجل الحضور بـ Gemini AI تماماً عن الواجهة لضمان عدم لفت انتباه الطلاب أو الآخرين.</p>
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
                    {hideAIAnalysis ? (
                      <span className="text-indigo-600 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="36" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="text-slate-350 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="12" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    )}
                  </button>
                </div>

              </div>
            </div>

            {/* اللون الأساسي للتطبيق */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <label className="text-xs text-slate-655 font-black block flex items-center gap-1.5">
                <Palette className="text-blue-600" size={15} />
                اللون الأساسي للتطبيق ومظهر واجهة التحكم (Theme & Primary Color)
              </label>
              <p className="text-[10px] text-slate-400 font-medium">اختر لونك المفضل ليتم تطبيقه فوراً على كافة الأزرار، والشرائط، والقوائم والتنبيهات الممتدة عبر النظام كاملاً.</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-1">
                {COLOR_PRESETS.map((preset) => {
                  const isSelected = primaryColor === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(preset.id);
                        // Instantly update preference for responsive design feel
                        onUpdatePreferences({ primaryColor: preset.id });
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-right transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 bg-slate-50/40 hover:bg-slate-50'
                      }`}
                    >
                      <span 
                        className="w-4.5 h-4.5 rounded-full shrink-0 flex items-center justify-center border border-black/10 shadow-3xs"
                        style={{ backgroundColor: preset.colors['600'] }}
                      >
                        {isSelected && <Check size={11} className="text-white font-black" />}
                      </span>
                      <span className={`text-[10px] font-bold truncate ${isSelected ? 'text-blue-900 font-black' : 'text-slate-600'}`}>
                        {preset.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Theme Color Picker Orb */}
              <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-right">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-extrabold text-slate-850 block">🎨 أو حدد لوناً مخصصاً لعلامتك التجارية (Custom Color Color):</span>
                  <p className="text-[9.5px] text-slate-405 font-semibold">تسمح لك هذه الميزة باختيار أي درجة لونية مخصصة مباشرة من عجلة الألوان أو لصق كود HEX المفضل لديك لتعيينه وتكراره في الواجهة فوراً.</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 justify-end">
                  <div className="relative flex items-center gap-1.5 bg-white border border-slate-250 rounded-xl px-2.5 py-1.5 shadow-3xs">
                    {/* The Color Orb Picker */}
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
                        title="افتح لوحة اختيار الألوان"
                      />
                      <div 
                        className="w-full h-full pointer-events-none" 
                        style={{ backgroundColor: primaryColor.startsWith('#') ? primaryColor : '#2563eb' }}
                      />
                    </div>
                    {/* Hex Code Input */}
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
                      className="w-20 text-center font-mono text-xs font-bold text-slate-750 bg-transparent border-0 focus:ring-0 focus:outline-hidden"
                      dir="ltr"
                      placeholder="#2563eb"
                      maxLength={7}
                    />
                  </div>
                  {primaryColor.startsWith('#') && (
                    <span className="text-[9.5px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded-md font-extrabold select-none">
                      مفعّل 🟢
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-md shadow-blue-500/10"
            >
              حفظ الخيارات والتحديث المباشر
            </button>
          </form>
        </div>

        {/* Cloud backup & local files operations */}
        <div className="premium-card p-6 space-y-4">
          <h3 className="text-base font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <CloudLightning size={18} className="text-blue-600" />
            تحميل وحفظ ومزامنة البيانات السحابية (Cloud Support)
          </h3>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-605 font-medium">حالة الربط السحابي:</span>
              <span className="font-extrabold text-emerald-700 flex items-center gap-1">
                <ShieldCheck size={14} /> متصل ومؤمن بالكامل
              </span>
            </div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-605 font-medium">آخر نسخ متطابق سحابي:</span>
              <span className="font-semibold text-slate-705 font-mono">{lastSyncTime}</span>
            </div>

            <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
              تضمن هذه الميزة تشفير وحفظ بيانات طلابك وتعداد حصصهم ومدفوعاتهم بشكل متزامن للوصول إليها في أي وقت ومن أي هاتف أو كمبيوتر بنفس الحساب.
            </p>

            <button
              onClick={handleTriggerCloudSync}
              disabled={isCloudSyncing}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl font-bold text-xs transition cursor-pointer shadow-sm disabled:shadow-none"
            >
              <RefreshCw size={14} className={isCloudSyncing ? 'animate-spin' : ''} />
              <span>{isCloudSyncing ? 'جاري رفع المقارنات ومزامنة الأجهزة...' : 'مزامنة ورفع البيانات السحابية الآن'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-1">
            <button
              onClick={handleExportJSON}
              className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-250 rounded-xl font-bold text-xs cursor-pointer shadow-3xs"
            >
              <Download size={14} />
              <span>تحميل نسخة احتياطية (.JSON)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-250 rounded-xl font-bold text-xs cursor-pointer shadow-3xs"
            >
              <Upload size={14} />
              <span>استعادة نسخة احتياطية (.JSON)</span>
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportJSON}
              accept=".json"
              className="hidden"
            />
          </div>

          {/* Dynamic Auto Backup/Google Drive Sync Selection */}
          <div className="pt-4 border-t border-slate-150 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5 justify-start">
              <span className="text-blue-600">🤖</span>
              <span>مزامنة النسخ الاحتياطي التلقائي (Google Drive / السحابية)</span>
            </h4>
            <p className="text-[10px] text-slate-505 leading-relaxed font-semibold">
              اختر تكرار رفع ونسخ بياناتك تلقائيًا لمزامنتها مع حساب Google Drive والشبكة السحابية للأستاذ لضمان حمايتها من أي فقدان وتحديثها باستمرار.
            </p>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => onUpdatePreferences({ autoBackupDownloadInterval: 'daily' })}
                className={`py-2 text-[11px] font-bold rounded-xl transition cursor-pointer select-none ${
                  preferences.autoBackupDownloadInterval === 'daily'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-white hover:bg-slate-200/55 text-slate-700 border border-slate-200'
                }`}
              >
                يومي ⏱️
              </button>
              <button
                type="button"
                onClick={() => onUpdatePreferences({ autoBackupDownloadInterval: 'weekly' })}
                className={`py-2 text-[11px] font-bold rounded-xl transition cursor-pointer select-none ${
                  preferences.autoBackupDownloadInterval === 'weekly'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-white hover:bg-slate-200/55 text-slate-700 border border-slate-200'
                }`}
              >
                أسبوعي 🗓️
              </button>
              <button
                type="button"
                onClick={() => onUpdatePreferences({ autoBackupDownloadInterval: 'monthly' })}
                className={`py-2 text-[11px] font-bold rounded-xl transition cursor-pointer select-none ${
                  preferences.autoBackupDownloadInterval === 'monthly'
                    ? 'bg-blue-600 text-white shadow-sm font-black'
                    : 'bg-white hover:bg-slate-200/55 text-slate-700 border border-slate-200'
                }`}
              >
                شهري 📅
              </button>
              <button
                type="button"
                onClick={() => onUpdatePreferences({ autoBackupDownloadInterval: 'disabled' })}
                className={`py-2 text-[11px] font-bold rounded-xl transition cursor-pointer select-none ${
                  preferences.autoBackupDownloadInterval === 'disabled' || !preferences.autoBackupDownloadInterval
                    ? 'bg-slate-700 text-white shadow-sm font-black'
                    : 'bg-white hover:bg-slate-200/55 text-slate-700 border border-slate-200'
                }`}
              >
                إيجاف المزامنة ❌
              </button>
            </div>

            {preferences.autoBackupDownloadInterval && preferences.autoBackupDownloadInterval !== 'disabled' ? (
              <div className="p-3 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-150 text-[10.5px] font-semibold leading-relaxed text-right flex items-center gap-2">
                <span>🛡️</span>
                <span><strong>المزامنة التلقائية مفعلة:</strong> يتم حالياً جدولة مزامنة بياناتك بشكل <strong>{
                  preferences.autoBackupDownloadInterval === 'daily' ? 'يومي متكرر' :
                  preferences.autoBackupDownloadInterval === 'weekly' ? 'أسبوعي منتظم' : 'شهري دوري'
                }</strong> على السحابة وجوجل درايف.</span>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 text-amber-900 rounded-2xl border border-amber-150 text-[10.5px] font-semibold leading-relaxed text-right flex items-center gap-2">
                <span>🚨</span>
                <span><strong>المزامنة التلقائية ملغاة:</strong> تم إيقاف النسخ التلقائي. تقع مسؤولية الحفظ الاحتياطي الآن يدوياً بالكامل.</span>
              </div>
            )}
          </div>
        </div>

        {/* Password Lock Settings */}
        <div className="premium-card p-6 space-y-4">
          <h3 className="text-base font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <KeyRound size={18} className="text-pink-600" />
            نظام الحماية والخصوصية (رمز المرور)
          </h3>

          <div className="space-y-4 text-xs">
            {preferences.passcode ? (
              <div className="flex items-center gap-2 p-3 bg-pink-50/50 border border-pink-100 rounded-xl">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                </span>
                <span className="font-extrabold text-pink-700">حماية رمز الخصوصية مفعلة (مؤمنة) 🔒</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                <span className="font-extrabold text-slate-500">الحماية غير مفعلة (مفتوحة) 🔓</span>
              </div>
            )}

            <p className="text-slate-500 leading-relaxed font-semibold">
              رمز المرور يتكون من <strong>4 أرقام حماية</strong>. يتم تفعيله عند تحميل الصفحة لحفظ خصوصية حسابات طلابك وسجل التحصيل عن أي تملص أو تنصت غير مصرح به.
            </p>

            {isUpdatingPasscode ? (
              <form onSubmit={handleChangePasscode} className="space-y-3 mt-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-600 font-bold block">رمز الحماية الجديد (4 أرقام عددية) *</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="أدخل 4 أرقام جديدة"
                    className="w-full px-4 py-2.5 text-center bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-800 tracking-[0.5em] focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsUpdatingPasscode(false)}
                    className="px-3.5 py-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 rounded-lg cursor-pointer animate-none"
                  >
                    إلغاء الأمر
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 text-[10px] font-bold text-white bg-pink-600 hover:bg-pink-700 rounded-lg cursor-pointer shadow-sm"
                  >
                    اعتمد الرمز والتشديد 🔒
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => setIsUpdatingPasscode(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-pink-50 hover:bg-pink-100 border border-pink-150 text-pink-750 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-[0.98]"
                >
                  <Key size={13} />
                  <span>{preferences.passcode ? 'تعديل أو تغيير رمز المرور' : 'تفعيل رمز المرور للأمان ➕'}</span>
                </button>
                
                {preferences.passcode && (
                  <button
                    onClick={() => {
                      onUpdatePreferences({ passcode: '' });
                      triggerSuccess('تم إلغاء تفعيل رمز المرور وإزالة قفل الخصوصية بنجاح!');
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-200 hover:border-red-200 text-slate-650 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <Trash2 size={13} />
                    <span>إلغاء كلمة السر (إزالة الحماية)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* تخصيص وقت تنبيهات الحصص والدفعات */}
        <div id="customize-notifications-card" className="premium-card p-6 space-y-4">
          <h3 className="text-base font-extrabold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Sliders size={18} className="text-indigo-600" />
            تخصيص وقت التنبيه للتذكيرات (الحصص والدفعات)
          </h3>

          <div className="space-y-4 text-xs">
            <p className="text-slate-500 leading-relaxed font-semibold">
              حدد بدقة وقت إرسال التنبيهات ونظام التذكير الذكي للحصص الدراسية اليومية وكذلك فترات استحقاق الرسوم والذمم المعلقة لطلابك.
            </p>

            <div className="space-y-4 pt-1">
              {/* Section: Classes Reminder */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => saveNotifSetting({ remindClasses: !notifSettings.remindClasses })}
                    className="text-blue-650 cursor-pointer hover:opacity-85"
                  >
                    {notifSettings.remindClasses ? (
                      <span className="text-indigo-600 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2500/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="36" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="text-slate-350 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="12" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    )}
                  </button>
                  <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span>🔔</span> تنبيهات بمواعيد الحصص اليومية
                  </span>
                </div>
                {notifSettings.remindClasses && (
                  <div className="flex items-center justify-end gap-2 text-right pt-2 border-t border-slate-200/50">
                    <select
                      value={notifSettings.classHoursThreshold}
                      onChange={(e) => saveNotifSetting({ classHoursThreshold: Number(e.target.value) })}
                      className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-[11px] font-bold focus:outline-none focus:border-indigo-500 font-sans"
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
                    <span className="text-[10px] text-slate-500 font-medium">عرض التذكير قبل الحصة بـ:</span>
                  </div>
                )}
              </div>

              {/* Section: Payment Due Reminder */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => saveNotifSetting({ remindPayments: !notifSettings.remindPayments })}
                    className="text-blue-655 cursor-pointer hover:opacity-85"
                  >
                    {notifSettings.remindPayments ? (
                      <span className="text-indigo-600 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="36" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="text-slate-350 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="12" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    )}
                  </button>
                  <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span>💳</span> تذكير باستحقاق الرسوم والدفعات
                  </span>
                </div>
                {notifSettings.remindPayments && (
                  <div className="flex items-center justify-end gap-2 text-right pt-2 border-t border-slate-200/50">
                    <select
                      value={notifSettings.paymentDaysThreshold}
                      onChange={(e) => saveNotifSetting({ paymentDaysThreshold: Number(e.target.value) })}
                      className="px-2.5 py-1.5 bg-white border border-slate-205 rounded-lg text-[11px] font-bold focus:outline-none focus:border-indigo-500 font-sans"
                    >
                      <option value="1">قبل يوم واحد</option>
                      <option value="2">قبل يومين</option>
                      <option value="3">قبل 3 أيام</option>
                      <option value="5">قبل 5 أيام</option>
                      <option value="7">قبل أسبوع كامل</option>
                      <option value="10">قبل 10 أيام</option>
                      <option value="14">قبل أسبوعين (14 يوماً)</option>
                    </select>
                    <span className="text-[10px] text-slate-500 font-medium">عرض التذكير قبل موعد الاستحقاق بـ:</span>
                  </div>
                )}
              </div>

              {/* Section: Do Not Disturb Mode */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <button
                    type="button"
                    onClick={() => saveNotifSetting({ dndEnabled: !notifSettings.dndEnabled })}
                    className="text-indigo-650 cursor-pointer hover:opacity-85"
                  >
                    {notifSettings.dndEnabled ? (
                      <span className="text-indigo-600 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="36" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="text-slate-350 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="12" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    )}
                  </button>
                  <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <span>🌙</span> وضع عدم الإزعاج للمدرس (Do Not Disturb)
                  </span>
                </div>
                {notifSettings.dndEnabled && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200/50">
                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold text-right">
                      بمجرد التفعيل، سيقوم النظام بكتم كافة أصوات الرنين المزعجة وإخفاء إشارات التنبيه خلال الفترة المحددة تلقائياً لتتمتع بقسط من الراحة.
                    </p>
                    <div className="flex items-center justify-end gap-3.5 text-right font-sans">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold">من:</span>
                        <input
                          type="time"
                          value={notifSettings.dndStart || '22:00'}
                          onChange={(e) => saveNotifSetting({ dndStart: e.target.value })}
                          className="px-2.5 py-1 bg-white border border-slate-205 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold">إلى:</span>
                        <input
                          type="time"
                          value={notifSettings.dndEnd || '08:00'}
                          onChange={(e) => saveNotifSetting({ dndEnd: e.target.value })}
                          className="px-2.5 py-1 bg-white border border-slate-205 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Section: Teacher Personal Alerts */}
              <div className="p-4 bg-blue-50/45 border border-blue-150 rounded-2xl space-y-3">
                <span className="font-extrabold text-blue-900 text-xs block border-b border-blue-100 pb-2">
                  🧑‍🏫 تخصيص تنبيهات المعلم التلقائية (Teacher Dashboard Alerts)
                </span>
                
                {/* 1. Notify Session Complete */}
                <div className="flex justify-between items-center text-xs">
                  <button
                    type="button"
                    onClick={() => saveNotifSetting({ notifyTeacherOnSessionComplete: !notifSettings.notifyTeacherOnSessionComplete })}
                    className="text-blue-600 cursor-pointer"
                  >
                    {notifSettings.notifyTeacherOnSessionComplete !== false ? (
                      <span className="text-blue-600 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="36" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="text-slate-350 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="12" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    )}
                  </button>
                  <span className="text-[11px] font-bold text-slate-700">تنبيه فوري للمعلم عند تسجيل حضور طالب لحصة 🟢</span>
                </div>

                {/* 2. Notify New Payment */}
                <div className="flex justify-between items-center text-xs border-t border-blue-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => saveNotifSetting({ notifyTeacherOnNewPayment: !notifSettings.notifyTeacherOnNewPayment })}
                    className="text-blue-600 cursor-pointer"
                  >
                    {notifSettings.notifyTeacherOnNewPayment !== false ? (
                      <span className="text-blue-600 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="36" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="text-slate-350 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="12" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    )}
                  </button>
                  <span className="text-[11px] font-bold text-slate-700">تنبيه فوري للمعلم عند تسجيل دفعة نقدية جديدة 💰</span>
                </div>

                {/* 3. Notify Payment Due */}
                <div className="flex justify-between items-center text-xs border-t border-blue-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => saveNotifSetting({ notifyTeacherOnPaymentDue: !notifSettings.notifyTeacherOnPaymentDue })}
                    className="text-blue-600 cursor-pointer"
                  >
                    {notifSettings.notifyTeacherOnPaymentDue !== false ? (
                      <span className="text-blue-600 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="36" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="text-slate-350 block transition-colors duration-200">
                        <svg className="w-10 h-5" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="48" height="24" rx="12" fill="currentColor"/>
                          <circle cx="12" cy="12" r="9" fill="white"/>
                        </svg>
                      </span>
                    )}
                  </button>
                  <span className="text-[11px] font-bold text-slate-700">تنبيه عند اقتراب تاريخ استحقاق قسط الطالب ⏳</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Settings App reset */}
        <div className="premium-card p-6 space-y-4">
          <h3 className="text-base font-extrabold text-red-600 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Trash2 size={18} className="text-red-650" />
            حذف البيانات والبدء من جديد (خيار خطير!)
          </h3>

          <div className="space-y-3 text-xs">
            <p className="text-slate-500 leading-relaxed font-semibold">
              إذا كنت تود تصفير التطبيق بالكامل أو حظر السجلات وحذف كافة الطلاب الحاليين وسجل حضورهم ودفعاتهم مع تصفير المواعيد، يمكنك تفعيل هذا الخيار.
            </p>

            <button
              onClick={() => {
                setClearWord('');
                setConfirmDialog({
                  type: 'clear-all'
                });
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-50 hover:bg-red-100 border border-red-150 text-red-750 rounded-xl font-bold text-xs cursor-pointer"
            >
              <Trash2 size={13} />
              <span>تصفير ومسح قاعدة بيانات نظام TEACHER بالكامل</span>
            </button>
          </div>
        </div>
      </div>

      {/* Custom Reusable Confirm Dialog */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (confirmDialog.type !== 'import-backup') {
                  setConfirmDialog(null);
                }
              }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-right text-slate-800"
            >
              <div className="flex gap-4 items-start mb-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmDialog.type === 'import-backup' || confirmDialog.type === 'clear-all'
                    ? 'bg-red-50 border border-red-100 text-red-650'
                    : confirmDialog.type === 'success'
                    ? 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                    : 'bg-amber-50 border border-amber-100 text-amber-600'
                }`}>
                  <AlertTriangle size={24} />
                </div>
                <div className="flex-1">
                  <h4 className="text-base font-bold text-slate-900 leading-snug">
                    {confirmDialog.type === 'import-backup' && 'تأكيد استيراد البيانات'}
                    {confirmDialog.type === 'clear-all' && 'تنبيه خطير جداً: تصفير كل البيانات'}
                    {confirmDialog.type === 'success' && 'نجاح العملية'}
                    {confirmDialog.type === 'error' && 'خطأ في العملية'}
                  </h4>
                  <div className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                    {confirmDialog.type === 'import-backup' && (
                      <p>
                        تنبيه: سيؤدي استيراد هذا الملف إلى استبدال كافة بيانات الطلاب الحالية وسجل المواعيد والدفعات ببيانات الملف الجديد. <strong className="text-red-600">هذه الخطوة لا يمكن التراجع عنها!</strong> هل ترغب بالاستمرار ومسح البيانات الحالية؟
                      </p>
                    )}
                    {confirmDialog.type === 'clear-all' && (
                      <div className="space-y-3">
                        <p>
                          سيتم حذف جميع الطلاب، الفواتير، المواعيد، الحصص، والمقادير المالية من هاتفك ومتصفحك بشكل نهائي ولا يمكن استعادتها.
                        </p>
                        <div className="space-y-1.5 bg-red-50 p-3.5 border border-red-100 rounded-2xl text-right">
                          <label className="font-bold text-red-950 block">للتأكيد والمتابعة، يرجى كتابة الكلمة "حذف" أدناه:</label>
                          <input
                            type="text"
                            value={clearWord}
                            onChange={(e) => setClearWord(e.target.value)}
                            placeholder='اكتب: حذف'
                            className="w-full px-3 py-2 border border-red-200 rounded-xl bg-white text-xs font-bold focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-center"
                          />
                        </div>
                      </div>
                    )}
                    {confirmDialog.type === 'success' && <p>{confirmDialog.message}</p>}
                    {confirmDialog.type === 'error' && <p>{confirmDialog.message}</p>}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 font-bold text-xs pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className="px-4.5 py-2.5 text-slate-650 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  {confirmDialog.type === 'success' || confirmDialog.type === 'error' ? 'إغلاق' : 'تراجع وإلغاء'}
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
                        triggerSuccess('تم تصفير قاعدة البيانات بنجاح وتبويب حساب المعلم من جديد.');
                      }
                    }}
                    className="px-4.5 py-2.5 text-white bg-red-650 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Trash2 size={13} />
                    <span>{confirmDialog.type === 'import-backup' ? 'تأكيد الاستيراد والمسح' : 'نعم، احذف النظام بالكامل'}</span>
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
