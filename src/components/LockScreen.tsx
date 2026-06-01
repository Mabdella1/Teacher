import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, LogIn, Lock, GraduationCap, Grid,
  Sparkles, CheckCircle2, ChevronRight, AlertCircle, Laptop, Smartphone,
  Copy, Check, ExternalLink
} from 'lucide-react';
import { COLOR_PRESETS } from '../lib/theme';
import { emailSignUp, emailSignIn, googleSignIn, auth } from '../lib/firebaseAuth';
import { saveWorkspaceToCloud, fetchWorkspaceFromCloud } from '../lib/firebaseSync';

interface LockScreenProps {
  onLogin: (account: { username: string; fullName: string; subject: string; primaryColor?: string; userId: string }) => void;
  // Fallback for passcode to keep existing handlers valid if needed
  storedPasscode?: string;
  onUnlock?: () => void;
}

export default function LockScreen({ onLogin, storedPasscode, onUnlock }: LockScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Registration States
  const [regFullName, setRegFullName] = useState('');
  const [regSubject, setRegSubject] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regColor, setRegColor] = useState('indigo');
  const [regMigrateData, setRegMigrateData] = useState(true);

  // Login States
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // General App/Interface States
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // PWA Installer State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);

  // Check if PWA is already running as standalone or installed
  useEffect(() => {
    setIsInIframe(window.self !== window.top);
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      setError('لتثبيت التطبيق على هاتفك أو حاسوبك: اضغط على زر المشاركة أو القائمة الثلاثية في متصفحك واقرن التطبيق بالشاشة الرئيسية لسهولة الاستخدام بنقرة واحدة! ⚡');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!regFullName.trim() || !regSubject.trim() || !regUsername.trim() || !regPassword.trim()) {
      setError('الرجاء تعبئة كافة الحقول المطلوبة لإنشاء حسابك.');
      return;
    }

    if (!regUsername.includes('@')) {
      setError('يرجى كتابة بريد إلكتروني صحيح لتفعيل الحفظ والمزامنة السحابية (مثال: teacher@example.com).');
      return;
    }

    if (regPassword.length < 6) {
      setError('يجب أن تتكون كلمة المرور من 6 خانات على الأقل لتسجيلها بشكل آمن مسموح.');
      return;
    }

    try {
      setSuccess('جاري إنشاء الحساب السحابي وتثبيت قاعدة البيانات... ⏳');
      // Sign up inside Firebase Authentication
      const firebaseUser = await emailSignUp(regUsername.trim(), regPassword.trim(), regFullName.trim());

      // Prepare workspace data payload (and optionally migrate local data)
      let studentsList = [];
      let appointmentsList = [];
      let examsList = [];

      if (regMigrateData) {
        const localStudents = localStorage.getItem('teacherStudents');
        const localApps = localStorage.getItem('teacherAppointments');
        const localExams = localStorage.getItem('teacherExamAppointments');
        try {
          if (localStudents) studentsList = JSON.parse(localStudents);
          if (localApps) appointmentsList = JSON.parse(localApps);
          if (localExams) examsList = JSON.parse(localExams);
        } catch (e) {
          console.error("Local migration parse skew: ", e);
        }
      }

      // Save initial setup in Cloud Firestore
      await saveWorkspaceToCloud(firebaseUser.uid, {
        teacherName: regFullName.trim(),
        subject: regSubject.trim(),
        currency: 'ج.م',
        passcode: regPassword.slice(0, 8),
        primaryColor: regColor,
        enableWhatsApp24hReminders: true,
        autoBackupDownloadInterval: 'disabled',
        students: studentsList,
        appointments: appointmentsList,
        examAppointments: examsList,
      });

      setSuccess('تم إنشاء الحساب السحابي وتفعيل الحفظ التلقائي بنجاح! 🚀');
      
      setTimeout(() => {
        onLogin({
          username: regUsername.trim().toLowerCase(),
          fullName: regFullName.trim(),
          subject: regSubject.trim(),
          primaryColor: regColor,
          userId: firebaseUser.uid
        });
      }, 1200);

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('auth/email-already-in-use')) {
        setError('هذا البريد الإلكتروني مسجل بالفعل! يرجى تسجيل الدخول بدلاً من ذلك أو استرجاعه.');
      } else if (err.message && err.message.includes('auth/operation-not-allowed')) {
        setError('يرجى التأكد من تمويل موفر تسجيل الدخول البريد والرمز (Email/Password) في إعدادات مشروع Firebase.');
      } else {
        setError(`فشل إنشاء الحساب السحابي: ${err.message || err}`);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!loginUsername.trim() || !loginPassword.trim()) {
      setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور لمتابعة الدخول.');
      return;
    }

    try {
      setSuccess('جاري التحقق الفوري والربط السحابي... 🔐');
      const firebaseUser = await emailSignIn(loginUsername.trim(), loginPassword.trim());

      setSuccess('تم تسجيل الدخول! جاري مزامنة وسحب البيانات... 📥');
      const cloudData = await fetchWorkspaceFromCloud(firebaseUser.uid);

      if (cloudData) {
        // Save cloud workspace to local storage to sync offline instance
        localStorage.setItem('teacherStudents', JSON.stringify(cloudData.students || []));
        localStorage.setItem('teacherAppointments', JSON.stringify(cloudData.appointments || []));
        localStorage.setItem('teacherExamAppointments', JSON.stringify(cloudData.examAppointments || []));
        
        const nextPrefs = {
          teacherName: cloudData.teacherName,
          subject: cloudData.subject,
          currency: cloudData.currency || 'ج.م',
          passcode: cloudData.passcode || '',
          primaryColor: cloudData.primaryColor || 'indigo',
          enableWhatsApp24hReminders: cloudData.enableWhatsApp24hReminders !== false,
          autoBackupDownloadInterval: cloudData.autoBackupDownloadInterval || 'disabled'
        };
        localStorage.setItem('teacherPreferences', JSON.stringify(nextPrefs));

        setSuccess(`أهلاً بك مجدداً أستاذ ${cloudData.teacherName}! تم تحميل البيانات السحابية بنجاح ⚡`);
        
        setTimeout(() => {
          onLogin({
            username: loginUsername.trim().toLowerCase(),
            fullName: cloudData.teacherName,
            subject: cloudData.subject,
            primaryColor: cloudData.primaryColor,
            userId: firebaseUser.uid
          });
        }, 1200);
      } else {
        // First log-in but no cloud document exists, setup a default one
        setSuccess('تم تسجيل الدخول! جاري تفعيل المزامنة السحابية الأولى لك... 🌱');
        setTimeout(() => {
          onLogin({
            username: loginUsername.trim().toLowerCase(),
            fullName: firebaseUser.displayName || 'المعلم الفاضل',
            subject: 'المادة الدراسية',
            primaryColor: 'indigo',
            userId: firebaseUser.uid
          });
        }, 1200);
      }

    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes('auth/invalid-credential') || err.message.includes('auth/user-not-found') || err.message.includes('auth/wrong-password'))) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة! يرجى إعادة التحقق للمحاولة مرة أخرى.');
      } else {
        setError(`فشل تسجيل الدخول: ${err.message || err}`);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    try {
      setSuccess('جاري الاتصال السحابي الآمن بجوجل... 🌍');
      const result = await googleSignIn();
      if (!result) return;

      const { user } = result;
      setSuccess('تم التحقق بجوجل بنجاح! جاري سحب البيانات... 📥');
      const cloudData = await fetchWorkspaceFromCloud(user.uid);

      if (cloudData) {
        localStorage.setItem('teacherStudents', JSON.stringify(cloudData.students || []));
        localStorage.setItem('teacherAppointments', JSON.stringify(cloudData.appointments || []));
        localStorage.setItem('teacherExamAppointments', JSON.stringify(cloudData.examAppointments || []));
        
        const nextPrefs = {
          teacherName: cloudData.teacherName,
          subject: cloudData.subject,
          currency: cloudData.currency || 'ج.م',
          passcode: cloudData.passcode || '',
          primaryColor: cloudData.primaryColor || 'indigo',
          enableWhatsApp24hReminders: cloudData.enableWhatsApp24hReminders !== false,
          autoBackupDownloadInterval: cloudData.autoBackupDownloadInterval || 'disabled'
        };
        localStorage.setItem('teacherPreferences', JSON.stringify(nextPrefs));

        setSuccess(`أهلاً بك أستاذ ${cloudData.teacherName}! تم المزامنة والربط تماماً ⚡`);
        setTimeout(() => {
          onLogin({
            username: user.email || 'google_user',
            fullName: cloudData.teacherName,
            subject: cloudData.subject,
            primaryColor: cloudData.primaryColor,
            userId: user.uid
          });
        }, 1200);
      } else {
        setSuccess('تم التسجيل! جاري تهيئة مساحتك السحابية الجديدة... 🎉');
        
        const defaultName = user.displayName || 'أستاذ معلم';
        const defaultSubject = 'مادة دراسية';
        
        await saveWorkspaceToCloud(user.uid, {
          teacherName: defaultName,
          subject: defaultSubject,
          currency: 'ج.م',
          passcode: '',
          primaryColor: 'indigo',
          enableWhatsApp24hReminders: true,
          autoBackupDownloadInterval: 'disabled',
          students: [],
          appointments: [],
          examAppointments: [],
        });

        setTimeout(() => {
          onLogin({
            username: user.email || 'google_user',
            fullName: defaultName,
            subject: defaultSubject,
            primaryColor: 'indigo',
            userId: user.uid
          });
        }, 1200);
      }
    } catch (err: any) {
      console.error(err);
      const msg = err?.message || String(err);
      if (msg.includes('auth/popup-blocked') || msg.includes('popup_blocked_by_browser')) {
        setError('تنبيه: تم حظر النافذة المنبثقة! يرجى السماح بالنوافذ المنبثقة في إعدادات متصفحك لهذا الموقع، أو جرب فتح التطبيق في علامة تبويب جديدة مستقلة.');
      } else if (msg.includes('auth/unauthorized-domain') || msg.includes('unauthorized-domain')) {
        const currentDomain = window.location.hostname;
        setUnauthorizedDomain(currentDomain);
        setError('');
      } else if (msg.includes('auth/network-request-failed') || msg.includes('auth/internal-error') || window.self !== window.top) {
        setError('فشل الاتصال الآمن بـ Google. يحدث هذا غالباً بسبب قيود إطار المعاينة (Iframe) أو تفعيل حظر كوكيز الطرف الثالث بالمتصفح. يُنصح بشدة بالنقر فوق زر "فتح التطبيق في نافذة جديدة" بالأسفل وتجربة تسجيل الدخول ثانيةً، أو استخدام تسجيل الدخول بالبريد الإلكتروني.');
      } else {
        setError(`فشل تسجيل الدخول بجوجل: ${err.message || err}. يرجى محاولة فتح التطبيق في علامة تبويب مستقلة.`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-y-auto font-sans">
      {/* Visual glowing backdrops for top fidelity layout */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-5 relative z-10 py-6">
        
        {/* Upper Brand Badge and App Titles */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2.5 bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-600 p-2.5 rounded-2.5xl shadow-lg shadow-blue-500/10 hover:rotate-2 transition-all">
            <GraduationCap size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">نظام الحسابات الذكي للمعلم</h2>
            <p className="text-xs text-slate-405 font-bold mt-1">سجل حضور طلابك، مدفوعات الأقساط والمستندات سحابياً</p>
          </div>
        </div>

        {/* Auth Interface */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xl space-y-6">
          
          {/* Iframe Notice for Google Login troubleshooting */}
          {isInIframe && (
            <motion.div 
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 bg-amber-50/80 border border-amber-200/60 rounded-2xl text-amber-850 text-[11px] font-bold text-right flex flex-col gap-2.5 shadow-sm"
              dir="rtl"
            >
              <div className="flex items-start gap-2">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600 animate-pulse" />
                <span className="leading-relaxed">
                  تنبيه المعاينة: نظرًا لسياسات أمان المتصفح الصارمة داخل الإطارات (iFrames)، قد يفشل تسجيل الدخول باستخدام Google. يرجى فتح التطبيق في علامة تبويب جديدة مستقلة للمزامنة بنجاح.
                </span>
              </div>
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="self-start px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl transition text-[10px] font-black flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-600/10"
              >
                <span>فتح التطبيق في نافذة مستقلة 🌍</span>
              </button>
            </motion.div>
          )}

          {/* Unauthorized Domain Interactive Solution Card */}
          {unauthorizedDomain && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-right flex flex-col gap-3 shadow-md border-r-4 border-r-rose-500"
              dir="rtl"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle size={18} className="text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-xs font-black text-rose-950">تفعيل الدخول السحابي بجوجل (خطوة مطلوبة)</h4>
                  <p className="text-[11px] text-rose-800 leading-relaxed mt-1 font-bold">
                    لقد قمت بتصميم وبرمجة التطبيق ومزامنة السحابة بنجاح! كوني مساعد ذكاء اصطناعي (AI)، <strong>لا أملك صلاحيات تعديل حسابك الشخصي</strong> في جوجل أو Firebase لإضافة نطاقاتك تلقائياً. يرجى القيام بهذه الخطوة البسيطة والسريعة لتفعيل الدخول المباشر بجوجل:
                  </p>
                </div>
              </div>

              {/* Step 1: Copy Domain */}
              <div className="bg-white border border-rose-100 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-sm">
                <span className="font-mono text-xs text-slate-800 select-all font-semibold overflow-x-auto whitespace-nowrap max-w-[200px]" dir="ltr">
                  {unauthorizedDomain}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(unauthorizedDomain);
                    setCopiedDomain(true);
                    setTimeout(() => setCopiedDomain(false), 2000);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 ${
                    copiedDomain 
                      ? 'bg-emerald-600 text-white shadow-sm' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {copiedDomain ? (
                    <>
                      <Check size={11} />
                      <span>تم النسخ!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={11} />
                      <span>نسخ النطاق</span>
                    </>
                  )}
                </button>
              </div>

              {/* Step 2: Open Firebase link */}
              <div className="flex items-center gap-2 mt-1">
                <a
                  href="https://console.firebase.google.com/project/inductive-rigging-q5xj8/authentication/providers"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] transition-all text-white font-black text-[11px] rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-rose-600/10 cursor-pointer"
                >
                  <ExternalLink size={12} />
                  <span>انتقل إلى إعدادات Firebase 🚀</span>
                </a>
                <button
                  type="button"
                  onClick={() => setUnauthorizedDomain(null)}
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] rounded-xl transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>

              <div className="text-[10px] text-rose-700/85 leading-normal bg-rose-100/30 rounded-lg p-2 font-bold" dir="rtl">
                💡 <strong>طريقة التفعيل:</strong> بمجرد فتح الرابط، انزل لأسفل الصفحة لقسم <strong>Authorized Domains (النطاقات المعتمدة)</strong>، اضغط <strong>Add Domain</strong> ثم الصق النطاق المنسوخ واضغط <strong>Save</strong>. سيشتغل الدخول بجوجل مباشرة!
              </div>
            </motion.div>
          )}

          {/* Tabs Selector */}
          <div className="grid grid-cols-2 p-1 bg-slate-50 border border-slate-200/50 rounded-2xl">
            <button
              onClick={() => { setActiveTab('login'); setError(''); setSuccess(''); }}
              className={`py-3 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'login'
                  ? 'bg-white text-indigo-605 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn size={15} />
              <span>تسجيل الدخول</span>
            </button>
            <button
              onClick={() => { setActiveTab('register'); setError(''); setSuccess(''); }}
              className={`py-3 rounded-xl text-xs font-black transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-white text-indigo-605 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus size={15} />
              <span>إنشاء حساب جديد</span>
            </button>
          </div>

          {/* Quick Alert notification block */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[11px] font-bold text-right flex items-start gap-2"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 text-[11px] font-bold text-right flex items-start gap-2"
            >
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
              <span>{success}</span>
            </motion.div>
          )}

          {/* Main Tab Panels */}
          <AnimatePresence mode="wait">
            {activeTab === 'login' ? (
              <motion.form 
                key="login-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin} 
                className="space-y-4 text-right"
              >
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-slate-600 font-extrabold text-[11px] mb-1.5 pr-1">البريد الإلكتروني السحابي</label>
                    <input
                      type="email"
                      required
                      placeholder="أدخل بريدك الإلكتروني المعتمد"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-extrabold text-[11px] mb-1.5 pr-1">كلمة المرور</label>
                    <div className="relative">
                      <input
                        type="password"
                        required
                        placeholder="أدخل كلمة مرور الحساب"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full text-right px-4 py-3 pb-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                      />
                      <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition duration-200 shadow-md shadow-indigo-600/10 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <LogIn size={15} />
                  <span>تسجيل الدخول ومزامنة السحابة</span>
                </button>

                {/* Separator */}
                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-slate-100"></div>
                  <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold">أو تسجيل سريع</span>
                  <div className="flex-grow border-t border-slate-100"></div>
                </div>

                {/* Google Authentication Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-250 hover:border-slate-350 rounded-2xl font-black text-xs transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                  </svg>
                  <span>الدخول المباشر بحساب Google</span>
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleRegister}
                className="space-y-4 text-right"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-extrabold text-[11px] mb-1.5 pr-1">اسم المعلم</label>
                    <input
                      type="text"
                      required
                      placeholder="الأستاذ..."
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-extrabold text-[11px] mb-1.5 pr-1">مادة التدريس</label>
                    <input
                      type="text"
                      required
                      placeholder="مثل: فيزياء"
                      value={regSubject}
                      onChange={(e) => setRegSubject(e.target.value)}
                      className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-600 font-extrabold text-[11px] mb-1.5 pr-1">البريد الإلكتروني السحابي</label>
                  <input
                    type="email"
                    required
                    placeholder="سيستخدم لتسجيل دخولك من أي جهاز"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-bold focus:outline-none font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-extrabold text-[11px] mb-1.5 pr-1">كلمة المرور (6 حروف فأكثر)</label>
                  <div className="relative">
                    <input
                      type="password"
                      required
                      placeholder="أدخل المقاس الآمن للمرور"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-2xl text-xs font-bold focus:outline-none font-sans"
                    />
                    <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                </div>

                {/* Color choices presets */}
                <div>
                  <label className="block text-slate-600 font-extrabold text-[11px] mb-1.5 pr-1">اختر لون لوحة التحكم</label>
                  <div className="flex gap-2 flex-wrap pt-0.5 justify-start">
                    {Object.keys(COLOR_PRESETS).map((pKey) => (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => setRegColor(pKey)}
                        style={{ backgroundColor: COLOR_PRESETS[pKey].accent }}
                        className={`w-6 h-6 rounded-full border-2 transition-all cursor-pointer ${
                          regColor === pKey ? 'border-indigo-650 scale-125 ring-2 ring-indigo-600/20' : 'border-white hover:scale-110'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Data migration toggle */}
                <div className="pt-1.5">
                  <label className="flex items-center gap-2 justify-end select-none cursor-pointer">
                    <span className="text-[10px] text-slate-500 font-extrabold leading-tight text-right">
                      ترحيل وربط البيانات الحالية على هذا الجهاز إلى حسابي الجديد
                    </span>
                    <input
                      type="checkbox"
                      checked={regMigrateData}
                      onChange={(e) => setRegMigrateData(e.target.checked)}
                      className="rounded accent-indigo-600 text-indigo-600 h-4 w-4 shrink-0 cursor-pointer"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs transition duration-200 shadow-md shadow-indigo-600/10 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <UserPlus size={15} />
                  <span>تأكيد وإنشاء الحساب السحابي</span>
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* PWA App Installation Module with golden cap ledger brand */}
        <div className="bg-gradient-to-tr from-slate-900 via-indigo-950 to-slate-950 text-white rounded-3xl p-5 shadow-xl border border-indigo-500/20 text-center relative overflow-hidden flex flex-col md:flex-row items-center gap-4 text-right">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 blur-2xl rounded-full pointer-events-none" />
          
          <div className="w-14 h-14 bg-indigo-950/80 border border-indigo-800 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
            <GraduationCap size={28} className="text-amber-400" />
          </div>

          <div className="flex-1 space-y-1">
            <h4 className="text-xs font-black text-slate-100 flex items-center justify-center md:justify-start gap-1">
              <span>📱</span> تثبيت التطبيق بهويته المميزة الجديدة
            </h4>
            <p className="text-[10px] text-slate-350 font-semibold leading-relaxed">
              قم بإضافة اختصار نظام المعلم إلى شاشة هاتفك أو جهازك كمثبت PWA بلمسته الأكاديمية والمالية الراقية.
            </p>
          </div>

          {!isInstalled && (
            <button
              onClick={handleInstallApp}
              className="w-full md:w-auto px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-900 rounded-xl font-bold text-xs transition duration-150 shadow-md cursor-pointer text-center whitespace-nowrap"
            >
              تثبيت التطبيق
            </button>
          )}
        </div>

        {/* Brand signature */}
        <div className="text-center text-[10px] text-slate-400 font-semibold leading-relaxed">
          <span>نظام TEACHER المعلم • حماية مدمجة، توافقية، وتشفير سحابي متفوق</span>
        </div>
      </div>
    </div>
  );
}
