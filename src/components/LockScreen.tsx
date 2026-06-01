import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UserPlus, LogIn, Lock, GraduationCap, Grid,
  Sparkles, CheckCircle2, ChevronRight, AlertCircle, Laptop, Smartphone,
  Copy, Check, ExternalLink, User, BookOpen, ShieldCheck, HelpCircle, Eye, EyeOff,
  Chrome
} from 'lucide-react';
import { COLOR_PRESETS, getPresetColors } from '../lib/theme';
import { emailSignUp, emailSignIn, googleSignIn, auth } from '../lib/firebaseAuth';
import { sendEmailVerification } from 'firebase/auth';
import { saveWorkspaceToCloud, fetchWorkspaceFromCloud } from '../lib/firebaseSync';

// Convert any arbitrary username text (Arabic, spaces, emojis, etc.) into a 100% valid Firebase Auth email
const convertToSafeEmail = (username: string): string => {
  const clean = username.trim().toLowerCase();
  if (clean.includes('@') && clean.includes('.')) {
    return clean;
  }
  
  let encoded = '';
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (/^[a-z0-9_.-]$/.test(char)) {
      encoded += char;
    } else {
      // Map non-alphanumeric (Arabic, space, emoji, etc) to a safe hex-code string
      encoded += 'x' + char.charCodeAt(0).toString(16);
    }
  }

  if (!encoded) {
    encoded = 'user';
  }
  
  if (!/^[a-z0-9]/.test(encoded)) {
    encoded = 'u' + encoded;
  }
  
  if (encoded.length > 55) {
    encoded = encoded.slice(0, 55);
  }
  
  return `${encoded}@teacher.app`;
};

interface LockScreenProps {
  onLogin: (account: { username: string; fullName: string; subject: string; primaryColor?: string; userId: string }) => void;
  // Fallback for passcode to keep existing handlers valid if needed
  storedPasscode?: string;
  onUnlock?: () => void;
}

export default function LockScreen({ onLogin }: LockScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  
  // Registration States
  const [regFullName, setRegFullName] = useState('');
  const [regSubject, setRegSubject] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regColor, setRegColor] = useState('blue');
  const [regMigrateData, setRegMigrateData] = useState(true);

  // Login States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // UI Utilities
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Suggested clean handle in real-time
  const getCleanPreviewHandle = (input: string) => {
    if (!input) return '';
    const clean = input.trim().toLowerCase().replace(/\s+/g, '-');
    return clean;
  };

  // Check if PWA is already running as standalone or installed
  useEffect(() => {
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

    const emailToUse = regEmail.trim();
    const rawUsername = regUsername.trim();
    if (!regFullName.trim() || !regSubject.trim() || !emailToUse || !rawUsername || !regPassword.trim()) {
      setError('الرجاء تعبئة كافة الحقول المطلوبة لإنشاء حسابك الجديد.');
      return;
    }

    if (!emailToUse.includes('@') || !emailToUse.includes('.')) {
      setError('الرجاء كتابة بريد إلكتروني صحيح لتلقي رابط تفعيل الحساب.');
      return;
    }

    if (regPassword.length < 6) {
      setError('يجب أن تتكون كلمة المرور من 6 خانات أو أكثر لتأمين حسابك بشكل قوي.');
      return;
    }

    try {
      setSuccess('جاري إنشاء مساحتك السحابية الآمنة وتثبيت قاعدة البيانات... ⏳');
      const firebaseUser = await emailSignUp(emailToUse, regPassword.trim(), regFullName.trim());

      // Send verification email
      try {
        await sendEmailVerification(firebaseUser);
      } catch (verificationError) {
        console.error("Verification email failed: ", verificationError);
      }

      // Prepare local storage data for migration if requested
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
          console.error("Local migration error: ", e);
        }
      }

      // Save workspace record
      await saveWorkspaceToCloud(firebaseUser.uid, {
        teacherName: regFullName.trim(),
        subject: regSubject.trim(),
        currency: 'ج.م',
        passcode: regPassword.slice(0, 8),
        primaryColor: regColor,
        enableWhatsApp24hReminders: true,
        autoBackupDownloadInterval: 'daily',
        students: studentsList,
        appointments: appointmentsList,
        examAppointments: examsList,
      });

      setSuccess('مبارك! تم إنشاء الحساب السحابي بنجاح وإرسال رابط التفعيل لبريدك الإلكتروني! ✉️ يرجى تفقد Inbox أو البريد المزعج (Spam) لتنشيط الحساب.');
      
      setTimeout(() => {
        onLogin({
          username: rawUsername,
          fullName: regFullName.trim(),
          subject: regSubject.trim(),
          primaryColor: regColor,
          userId: firebaseUser.uid
        });
      }, 2000);

    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('auth/email-already-in-use')) {
        setError('البريد الإلكتروني هذا مسجل بالفعل! يرجى اختيار بريد آخر أو الانتقال لتبويب "تسجيل الدخول".');
      } else if (err.message && (err.message.includes('auth/operation-not-allowed') || err.message.includes('operation-not-allowed'))) {
        setError('⚠️ المزامنة السحابية مغطاة بخاصية مقفلة! الرجاء تفعيل حقل الدخول بالبريد/الرقم السري (Email/Password) في إعدادات كونسول Firebase Authentication.');
      } else {
        setError(`فشل عملية التسجيل: ${err.message || 'يرجى التحقق من اتصالك بالشبكة وإعادة المحاولة.'}`);
      }
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const inputEmail = loginEmail.trim();
    if (!inputEmail || !loginPassword.trim()) {
      setError('الرجاء إدخال البريد الإلكتروني وكلمة المرور للدخول.');
      return;
    }

    try {
      setSuccess('جاري التحقق والمزامنة وتأمين الاتصال السحابي... 🔐');
      const emailToUse = inputEmail.includes('@') ? inputEmail : convertToSafeEmail(inputEmail);
      const firebaseUser = await emailSignIn(emailToUse, loginPassword.trim());

      setSuccess('تم التحقق بنجاح! جاري تحميل وتحديث بياناتك السحابية... 📥');
      const cloudData = await fetchWorkspaceFromCloud(firebaseUser.uid);

      if (cloudData) {
        // Hydrate local database cache
        localStorage.setItem('teacherStudents', JSON.stringify(cloudData.students || []));
        localStorage.setItem('teacherAppointments', JSON.stringify(cloudData.appointments || []));
        localStorage.setItem('teacherExamAppointments', JSON.stringify(cloudData.examAppointments || []));
        
        const nextPrefs = {
          teacherName: cloudData.teacherName,
          subject: cloudData.subject,
          currency: cloudData.currency || 'ج.م',
          passcode: cloudData.passcode || '',
          primaryColor: cloudData.primaryColor || 'blue',
          enableWhatsApp24hReminders: cloudData.enableWhatsApp24hReminders !== false,
          autoBackupDownloadInterval: cloudData.autoBackupDownloadInterval || 'daily'
        };
        localStorage.setItem('teacherPreferences', JSON.stringify(nextPrefs));

        setSuccess(`مرحباً بك أستاذ ${cloudData.teacherName}! تم تحميل مساحتك بالكامل بنجاح ⚡`);
        
        setTimeout(() => {
          onLogin({
            username: inputEmail.split('@')[0],
            fullName: cloudData.teacherName,
            subject: cloudData.subject,
            primaryColor: cloudData.primaryColor,
            userId: firebaseUser.uid
          });
        }, 1500);
      } else {
        setSuccess('تم الدخول! جاري تهيئة الحفظ التلقائي لمساحتك الجديدة... 🌱');
        setTimeout(() => {
          onLogin({
            username: inputEmail.split('@')[0],
            fullName: firebaseUser.displayName || 'المعلم الفاضل',
            subject: 'المادة الدراسية',
            primaryColor: 'blue',
            userId: firebaseUser.uid
          });
        }, 1500);
      }

    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes('auth/invalid-credential') || err.message.includes('auth/user-not-found') || err.message.includes('auth/wrong-password'))) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة! يرجى إعادة التحقق ثم المحاولة مرة أخرى.');
      } else if (err.message && (err.message.includes('auth/operation-not-allowed') || err.message.includes('operation-not-allowed'))) {
        setError('⚠️ المزامنة السحابية مقفلة! الرجاء تفعيل موفر الدخول بالبريد والرمز (Email/Password) في منصة Firebase Auth.');
      } else {
        setError(`فشل عملية تسجيل الدخول: ${err.message || 'يرجى التحقق من اتصالك بالإنترنت والعودة لاحقاً.'}`);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    try {
      setSuccess('جاري الاتصال بحساب Google وتأمين الدخول... 🔐');
      const googleResult = await googleSignIn();
      if (!googleResult) {
        throw new Error('العملية ألغيت');
      }
      const { user: firebaseUser } = googleResult;
      
      setSuccess('تم التحقق بنجاح! جاري مزامنة بياناتك وتحميل اللوحة... 📥');
      const cloudData = await fetchWorkspaceFromCloud(firebaseUser.uid);
      
      if (cloudData) {
        // Hydrate local database cache
        localStorage.setItem('teacherStudents', JSON.stringify(cloudData.students || []));
        localStorage.setItem('teacherAppointments', JSON.stringify(cloudData.appointments || []));
        localStorage.setItem('teacherExamAppointments', JSON.stringify(cloudData.examAppointments || []));
        
        const nextPrefs = {
          teacherName: cloudData.teacherName,
          subject: cloudData.subject,
          currency: cloudData.currency || 'ج.م',
          passcode: cloudData.passcode || '',
          primaryColor: cloudData.primaryColor || 'blue',
          enableWhatsApp24hReminders: cloudData.enableWhatsApp24hReminders !== false,
          autoBackupDownloadInterval: cloudData.autoBackupDownloadInterval || 'daily'
        };
        localStorage.setItem('teacherPreferences', JSON.stringify(nextPrefs));

        setSuccess(`مرحباً بك أستاذ ${cloudData.teacherName}! تم تحميل مساحتك بالكامل بنجاح ⚡`);
        
        setTimeout(() => {
          onLogin({
            username: firebaseUser.email?.split('@')[0] || 'teacher',
            fullName: cloudData.teacherName,
            subject: cloudData.subject,
            primaryColor: cloudData.primaryColor,
            userId: firebaseUser.uid
          });
        }, 1500);
      } else {
        // Prepare local storage data for migration
        let studentsList = [];
        let appointmentsList = [];
        let examsList = [];

        const localStudents = localStorage.getItem('teacherStudents');
        const localApps = localStorage.getItem('teacherAppointments');
        const localExams = localStorage.getItem('teacherExamAppointments');
        try {
          if (localStudents) studentsList = JSON.parse(localStudents);
          if (localApps) appointmentsList = JSON.parse(localApps);
          if (localExams) examsList = JSON.parse(localExams);
        } catch (e) {
          console.error("Local migration error: ", e);
        }

        const fullName = firebaseUser.displayName || 'المعلم الفاضل';
        const defaultSubject = 'المادة الدراسية';

        // Save workspace record
        await saveWorkspaceToCloud(firebaseUser.uid, {
          teacherName: fullName,
          subject: defaultSubject,
          currency: 'ج.م',
          passcode: '123456',
          primaryColor: 'blue',
          enableWhatsApp24hReminders: true,
          autoBackupDownloadInterval: 'daily',
          students: studentsList,
          appointments: appointmentsList,
          examAppointments: examsList,
        });

        setSuccess('تم تهيئة مساحتك السحابية الجديدة ومزامنتها بنجاح! 🎉');
        
        setTimeout(() => {
          onLogin({
            username: firebaseUser.email?.split('@')[0] || 'teacher',
            fullName: fullName,
            subject: defaultSubject,
            primaryColor: 'blue',
            userId: firebaseUser.uid
          });
        }, 1500);
      }
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('auth/popup-closed-by-user')) {
        setError('تم إغلاق نافذة تسجيل الدخول من Google قبل إكمال العملية.');
      } else {
        setError(`فشل تسجيل الدخول بواسطة Google: ${err.message || 'يرجى المحاولة مرة أخرى.'}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 relative overflow-y-auto overflow-x-hidden w-full max-w-full font-sans select-none">
      <div className="w-full max-w-md space-y-6 relative z-10 py-8">
        
        {/* Upper Brand Badge and App Header Card */}
        <div className="text-center space-y-3">
          <div className="inline-block relative">
            <img 
              src="/app_icon.png" 
              alt="شعار التطبيق" 
              referrerPolicy="no-referrer"
              className="w-20 h-20 md:w-24 md:h-24 rounded-3xl shadow-md border-2 border-white/90 relative z-10 mx-auto transform hover:rotate-3 transition duration-300"
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center justify-center gap-1.5 font-sans">
              <span>برنامج المعلم</span>
              <span className="text-[11px] bg-blue-600 text-white font-extrabold px-2 py-0.5 rounded-full shadow-sm shadow-blue-600/10">سحابي</span>
            </h2>
            <p className="text-xs text-slate-500 font-bold max-w-sm mx-auto leading-relaxed">
              منظم المواعيد المالي والأكاديمي المتكامل لإدارة الحصص، المستحقات المالية وحضور ومستويات الطلاب
            </p>
          </div>
        </div>

        {/* Auth Box Container */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-lg space-y-6">
          
          {/* Custom Slider Tab Selector */}
          <div className="relative grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200/40">
            {/* Animated Slider Pill */}
            <div className="absolute top-1 bottom-1 p-0.5 w-[50%] transition-transform duration-300 ease-out" style={{
              transform: activeTab === 'register' ? 'translateX(-100%)' : 'translateX(0%)',
              right: 4
            }}>
              <div className="w-full h-full bg-white rounded-xl shadow-md border border-slate-200/50" />
            </div>

            <button
              onClick={() => { setActiveTab('login'); setError(''); setSuccess(''); }}
              className={`relative z-10 py-3 text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'login' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn size={15} />
              <span>تسجيل الدخول</span>
            </button>
            <button
              onClick={() => { setActiveTab('register'); setError(''); setSuccess(''); }}
              className={`relative z-10 py-3 text-xs font-black transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'register' ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserPlus size={15} />
              <span>إنشاء حساب جديد</span>
            </button>
          </div>

          {/* Success / Error Toast Banners */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-3.5 bg-rose-50 border border-rose-100/80 rounded-2xl text-rose-700 text-xs font-bold text-right flex items-start gap-2.5 shadow-sm"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-600" />
                <span className="leading-relaxed">{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-3.5 bg-emerald-50 border border-emerald-100/80 rounded-2xl text-emerald-800 text-xs font-bold text-right flex items-start gap-2.5 shadow-sm"
              >
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600 animate-pulse" />
                <span className="leading-relaxed">{success}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tab Panel Forms */}
          <AnimatePresence mode="wait">
            {activeTab === 'login' ? (
              <motion.form 
                key="login-view"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleLogin}
                className="space-y-4 text-right"
              >
                <div className="space-y-4">
                  <div>
                    <label className="block text-slate-700 font-extrabold text-[11px] mb-1.5 pr-1 flex items-center gap-1 justify-start">
                      <User size={13} className="text-slate-400" />
                      <span>البريد الإلكتروني</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="أدخل بريدك الإلكتروني (مثل: teacher@example.com)"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200/80 focus:border-blue-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-extrabold text-[11px] mb-1.5 pr-1 flex items-center gap-1 justify-start">
                      <Lock size={13} className="text-slate-400" />
                      <span>كلمة المرور</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="أدخل كلمة مرور الحساب"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full text-right pl-11 pr-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200/80 focus:border-blue-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 focus:outline-none p-1 rounded-lg"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center leading-relaxed">
                  🔒 جميع بياناتك وفواتير وحضور ومستويات الطلاب مشفرة سحابياً بالكامل لتأمين خصوصيتك المطلقة.
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-xs transition-all duration-150 shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2 mt-4"
                >
                  <LogIn size={15} />
                  <span>تسجيل الدخول ومزامنة لوحتي ⚡</span>
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-slate-400 font-bold">أو عن طريق</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:scale-98 text-slate-700 rounded-2xl font-black text-xs transition-all duration-150 shadow-sm cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>تسجيل الدخول بواسطة Google</span>
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="register-view"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleRegister}
                className="space-y-4 text-right"
              >
                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-slate-700 font-extrabold text-[11px] mb-1.5 pr-1 flex items-center gap-1 justify-start">
                      <User size={13} className="text-slate-400 animate-pulse" />
                      <span>اسم المعلم الثنائي</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثل: الأستاذ أحمد"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200/80 focus:border-blue-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-extrabold text-[11px] mb-1.5 pr-1 flex items-center gap-1 justify-start">
                      <BookOpen size={13} className="text-slate-400" />
                      <span>المادة الدراسية</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثل: اللغة العربية"
                      value={regSubject}
                      onChange={(e) => setRegSubject(e.target.value)}
                      className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200/80 focus:border-blue-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-extrabold text-[11px] mb-1.5 pr-1 flex items-center gap-1 justify-start">
                    <User size={13} className="text-slate-400" />
                    <span>البريد الإلكتروني (لتفعيل الحساب)</span>
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="مثال: teacher@gmail.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200/80 focus:border-blue-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-extrabold text-[11px] mb-1.5 pr-1 flex items-center gap-1 justify-start">
                    <User size={13} className="text-slate-400" />
                    <span>اسم المستخدم (بالأحرف الفريدة)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثل: ahmed20"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    className="w-full text-right px-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200/80 focus:border-blue-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-extrabold text-[11px] mb-1.5 pr-1 flex items-center gap-1 justify-start">
                    <Lock size={13} className="text-slate-400" />
                    <span>كلمة المرور (6 حروف فأكثر)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="اختر كلمة مرور قوية"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      className="w-full text-right pl-11 pr-4 py-3 placeholder:text-slate-350 bg-slate-50 border border-slate-200/80 focus:border-blue-500 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 focus:outline-none p-1 rounded-lg"
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Data migration toggle */}
                <div className="bg-slate-50 border border-slate-205/60 p-3 rounded-2xl">
                  <label className="flex items-start gap-2.5 justify-end select-none cursor-pointer">
                    <span className="text-[10.5px] text-slate-500 font-extrabold leading-relaxed text-right">
                      ترحيل وربط البيانات الحالية على هذا الجهاز تلقائياً إلى حسابي السحابي الجديد
                    </span>
                    <input
                      type="checkbox"
                      checked={regMigrateData}
                      onChange={(e) => setRegMigrateData(e.target.checked)}
                      className="rounded accent-blue-600 text-blue-600 h-4.5 w-4.5 shrink-0 cursor-pointer mt-0.5 text-center"
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-xs transition-all duration-150 shadow-lg shadow-blue-600/10 hover:shadow-blue-600/20 cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <UserPlus size={15} />
                  <span>تأكيد وإنشاء حسابي بالكامل 🚀</span>
                </button>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-3 text-slate-400 font-bold">أو عن طريق</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 px-4 bg-white border border-slate-200 hover:bg-slate-50 active:scale-98 text-slate-700 rounded-2xl font-black text-xs transition-all duration-150 shadow-sm cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>تسجيل الدخول بواسطة Google</span>
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* PWA App Installation Minimal Promo Card */}
        <div className="bg-slate-950 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center gap-4 text-right border border-white/[0.08]">
          <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
            <Smartphone size={24} className="text-sky-400" />
          </div>

          <div className="flex-1 space-y-1">
            <h4 className="text-xs font-black text-slate-100 flex items-center justify-center md:justify-start gap-1">
              <span>📱</span> هل ترغب في استخدام التطبيق على شاشة هاتفك؟
            </h4>
            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
              قم بتثبيت التطبيق وافتحه مباشرة بضغطة زر واحدة كأي تطبيق هاتف بفضل تقنية الـ PWA المتقدمة.
            </p>
          </div>

          {!isInstalled && (
            <button
              onClick={handleInstallApp}
              className="w-full md:w-auto px-4 py-2.5 bg-sky-500 hover:bg-sky-600 active:scale-95 text-white rounded-xl font-black text-xs transition duration-150 shadow-md cursor-pointer text-center whitespace-nowrap"
            >
              تحميل وتثبيت
            </button>
          )}
        </div>

        {/* Brand signature and privacy check */}
        <div className="space-y-1 text-center">
          <p className="text-[10px] text-slate-400 font-bold leading-relaxed flex items-center justify-center gap-1.5">
            <ShieldCheck size={12} className="text-blue-500" />
            <span>نظام المعلم الذكي • حماية مدمجة، تشفير كامل للأقساط والبيانات السحابية</span>
          </p>
        </div>
      </div>
    </div>
  );
}
