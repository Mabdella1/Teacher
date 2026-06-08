import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, BookOpen, Award, Check, Copy, Download, 
  ShieldCheck, TrendingUp, Clock, QrCode, Calendar, 
  Users, Wallet, Mail, Star, Sparkles, AlertCircle
} from 'lucide-react';
import { TeacherPreferences, Student, Appointment } from '../types';
import { COLOR_PRESETS } from '../lib/theme';
import { auth } from '../lib/firebaseAuth';

interface TeacherProfileTabProps {
  preferences: TeacherPreferences;
  students: Student[];
  appointments: Appointment[];
}

export default function TeacherProfileTab({ preferences, students, appointments }: TeacherProfileTabProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Keep UTC time ticking for professional live feeling
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { teacherName = 'الأستاذ المساعد', subject = 'عام / جميع المواد', currency = 'ج.م', primaryColor = 'indigo', teacherAvatar } = preferences;

  // Active theme calculations
  const currentThemePreset = COLOR_PRESETS.find(p => p.id === primaryColor) || COLOR_PRESETS[0];
  const accentColor = primaryColor.startsWith('#') ? primaryColor : currentThemePreset.colors['600'];
  const accentLight = primaryColor.startsWith('#') ? `${primaryColor}15` : currentThemePreset.colors['50'];
  const accentGradientFrom = currentThemePreset.colors['900'] || '#1e1b4b';
  const accentGradientTo = currentThemePreset.colors['800'] || '#311042';

  // Generate Unique Monospace ID
  const teacherIdString = auth.currentUser 
    ? `TEA-2026-${auth.currentUser.uid.substring(0, 6).toUpperCase()}` 
    : `TEA-2026-${(teacherName || 'ADMIN').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(16).padEnd(4, '0').toUpperCase()}`;

  // Simple copy helper
  const handleCopyID = () => {
    navigator.clipboard.writeText(teacherIdString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Canvas-based high-res PNG exporter for the ID Card
  const handleDownloadCard = () => {
    setIsDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      // High-res retina dimensions
      canvas.width = 1200;
      canvas.height = 700;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsDownloading(false);
        return;
      }

      // Draw beautiful dark gradient mesh background
      const gradient = ctx.createLinearGradient(0, 0, 1200, 700);
      gradient.addColorStop(0, '#090d16'); // deep midnight coal
      gradient.addColorStop(0.5, '#111827'); // slate gray
      gradient.addColorStop(1, '#020617'); // dark obsidian
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 1200, 700);

      // Accent colored ambient light flare
      const flareGlow = ctx.createRadialGradient(900, 200, 50, 900, 200, 400);
      flareGlow.addColorStop(0, `${accentColor}30`);
      flareGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = flareGlow;
      ctx.beginPath();
      ctx.arc(900, 200, 400, 0, Math.PI * 2);
      ctx.fill();

      // Top corner copper/gold glow
      const goldGlow = ctx.createRadialGradient(250, 500, 10, 250, 500, 300);
      goldGlow.addColorStop(0, 'rgba(234, 179, 8, 0.12)');
      goldGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = goldGlow;
      ctx.beginPath();
      ctx.arc(250, 500, 300, 0, Math.PI * 2);
      ctx.fill();

      // Double-layered premium borders
      ctx.strokeStyle = '#e2e8f01a';
      ctx.lineWidth = 14;
      ctx.strokeRect(20, 20, 1160, 660);

      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(34, 34, 1132, 632);

      // Grid line texture overlays (simulating laser security mesh pattern)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let i = 40; i < 1160; i += 30) {
        ctx.beginPath();
        ctx.moveTo(i, 40);
        ctx.lineTo(i, 660);
        ctx.stroke();
      }

      // 1. Right Side - Branding & Credentials (Arabic text has fallbacks, we use robust layout)
      ctx.textAlign = 'right';

      // Brand Accent title
      ctx.fillStyle = '#fbbf24'; // amber golden
      ctx.font = 'bold 36px Arial, Helvetica, sans-serif';
      ctx.fillText('بطاقة الاعتماد والهُوية الذكية للأستاذ', 1110, 100);

      ctx.fillStyle = '#94a3b8'; // text slate
      ctx.font = 'bold 20px Arial, sans-serif';
      ctx.fillText('المنظومة الإلكترونية المتكاملة لإدارة وعوائد الحصص', 1110, 140);

      // Horizontal separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(80, 180);
      ctx.lineTo(1110, 180);
      ctx.stroke();

      // DETAILS LABELS BLOCK (RIGHT)
      const dataX = 1110;
      
      // Teacher Name Block
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText('👤 اسـم الأستـاذ الفـاضل:', dataX, 240);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.fillText(teacherName, dataX, 300);

      // Subject Block
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px Arial, sans-serif';
      ctx.fillText('📚 التخصص والمـادة العـلمية:', dataX, 380);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 28px Arial, sans-serif';
      ctx.fillText(subject, dataX, 430);

      // Academic accreditation tag
      ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
      ctx.fillRect(570, 480, 540, 50);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(570, 480, 540, 50);
      
      ctx.fillStyle = '#34d399'; // vibrant emerald
      ctx.font = 'bold 18px Arial, sans-serif';
      ctx.fillText('✓ تم التحقق من الاعتماد السحابي والأكاديمي للمنصة', 1090, 512);

      // 2. Left Side - Photo Placement & Simulation Chip
      const photoX = 100;
      const photoY = 220;
      const photoW = 220;
      const photoH = 220;

      // Draw Photo Backing box
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 6;
      ctx.strokeRect(photoX, photoY, photoW, photoH);

      // Gold secure chip placement
      const chipX = 380;
      const chipY = 225;
      const chipW = 75;
      const chipH = 55;
      ctx.fillStyle = '#f59e0b'; // golden yellow
      ctx.fillRect(chipX, chipY, chipW, chipH);
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(chipX, chipY, chipW, chipH);

      // Simulated microchip connections inside the golden box
      ctx.beginPath();
      ctx.moveTo(chipX + chipW / 2, chipY);
      ctx.lineTo(chipX + chipW / 2, chipY + chipH);
      ctx.moveTo(chipX, chipY + chipH / 2);
      ctx.lineTo(chipX + chipW, chipY + chipH / 2);
      ctx.moveTo(chipX + 20, chipY);
      ctx.lineTo(chipX + 20, chipY + chipH);
      ctx.moveTo(chipX + 55, chipY);
      ctx.lineTo(chipX + 55, chipY + chipH);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(chipX + 10, chipY + 10, chipW - 20, chipH - 20);

      // Monospace unique ID String below Chip
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fbbf24'; // amber-400
      ctx.font = 'bold 24px Courier New, monospace';
      ctx.fillText(`ID CODE: ${teacherIdString}`, 380, 340);

      // QR / Partner Certificate stamp
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(380, 370, 160, 70);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(380, 370, 160, 70);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px Courier New, monospace';
      ctx.fillText('STATUS: LICENSED', 395, 400);
      ctx.fillText('DATE: 2026/06', 395, 425);

      const finalizeDraw = () => {
        // Under avatar role
        ctx.textAlign = 'center';
        ctx.fillStyle = '#a5f3fc';
        ctx.font = 'bold 15px Courier New, monospace';
        ctx.fillText('PREMIUM EDUCATOR PARTNER', photoX + photoW / 2, photoY + photoH + 30);

        // Status Badge Ribbon under avatar
        ctx.fillStyle = accentColor;
        ctx.fillRect(photoX - 10, photoY + photoH + 45, photoW + 20, 42);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillText('مُعلّم معتمد وموثق ✓', photoX + photoW / 2, photoY + photoH + 71);

        // Bottom section Barcode display
        const barX = 100;
        const barY = 560;
        const barcodePattern = [4, 2, 6, 2, 4, 6, 2, 6, 10, 2, 4, 2, 6, 4, 4, 3, 8, 2, 4, 2, 6, 4];
        ctx.fillStyle = '#ffffff';
        let currX = barX;
        barcodePattern.forEach((w, idx) => {
          ctx.fillRect(currX, barY, w * 1.5, 55);
          currX += w * 1.5 + (idx % 2 === 0 ? 5 : 2.5);
        });

        // Stamp code
        ctx.textAlign = 'right';
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('SECURITY ID DIGITIZED SHIELD SYSTEM • SECURE SYSTEM INTEGRATION', 1110, 640);

        // Download trigger
        try {
          const imgUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          const cleanName = teacherName.trim().replace(/\s+/g, '_');
          link.download = `TEACHER_ID_${cleanName || 'profile'}.png`;
          link.href = imgUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (e) {
          console.error(e);
          alert('تعذر تحميل الصورة مباشرة، يرجى المحاولة مرة أخرى.');
        } finally {
          setIsDownloading(false);
        }
      };

      // Handle loading avatar image safely
      if (teacherAvatar) {
        const imgObj = new Image();
        imgObj.crossOrigin = 'anonymous';
        imgObj.onload = () => {
          try {
            ctx.drawImage(imgObj, photoX, photoY, photoW, photoH);
            finalizeDraw();
          } catch (err) {
            // fallback if draw fails due to CORS or structure
            ctx.fillStyle = '#ffffff';
            ctx.font = '120px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('🧑‍🏫', photoX + photoW / 2, photoY + photoH / 2 - 10);
            finalizeDraw();
          }
        };
        imgObj.onerror = () => {
          ctx.fillStyle = '#ffffff';
          ctx.font = '120px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🧑‍🏫', photoX + photoW / 2, photoY + photoH / 2 - 10);
          finalizeDraw();
        };
        imgObj.src = teacherAvatar;
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = '120px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧑‍🏫', photoX + photoW / 2, photoY + photoH / 2 - 10);
        finalizeDraw();
      }
    } catch (err) {
      console.error(err);
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-right font-sans pb-12 max-w-6xl mx-auto">
      {/* 1. Header Banner */}
      <div 
        className="rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-xl border"
        style={{ 
          background: `linear-gradient(135deg, ${accentGradientFrom}, ${accentGradientTo})`,
          borderColor: accentColor
        }}
      >
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
        <div className="absolute left-0 bottom-0 w-60 h-60 bg-pink-500/5 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none" />
        
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 z-10">
          <div className="flex items-center gap-4.5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 flex items-center justify-center border border-white/25 shadow-inner shrink-0 overflow-hidden">
              {teacherAvatar ? (
                <img src={teacherAvatar} alt={teacherName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-4xl">🧑‍🏫</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black">{teacherName}</h2>
                <span className="bg-amber-400 text-slate-950 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-sm">
                  عضو معتمد 👑
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 flex items-center gap-1.5 justify-end md:justify-start">
                <BookOpen size={13} className="text-amber-400" />
                <span>أستاذ مادة {subject}</span>
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-1 pr-0.5 tracking-wide">
                مسجل برقم: {teacherIdString}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end md:self-center font-mono bg-white/10 backdrop-blur-xs px-4 py-2 rounded-2xl border border-white/15 text-xs text-amber-200">
            <Clock size={14} />
            <span className="font-bold">{currentTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {/* 2. Quick Stat Tiles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white border border-slate-200 rounded-[22px] p-5.5 flex items-center justify-between shadow-3xs">
          <div className="text-right">
            <span className="text-[11px] font-black text-slate-405 uppercase tracking-wide block">قاعدة الطلاب</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{students.length} طالب</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-2xs">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[22px] p-5.5 flex items-center justify-between shadow-3xs">
          <div className="text-right">
            <span className="text-[11px] font-black text-slate-405 uppercase tracking-wide block">كشف المواعيد الفعالة</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block">{appointments.length} درس إسبوعي</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center shadow-2xs">
            <Calendar size={22} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[22px] p-5.5 flex items-center justify-between shadow-3xs">
          <div className="text-right">
            <span className="text-[11px] font-black text-slate-405 uppercase tracking-wide block">العملة المعتمدة للحصص</span>
            <span className="text-2xl font-black text-emerald-600 mt-1 block font-sans">{currency}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-2xs">
            <Wallet size={22} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[22px] p-5.5 flex items-center justify-between shadow-3xs">
          <div className="text-right">
            <span className="text-[11px] font-black text-slate-405 uppercase tracking-wide block">شعار الموثوقية بالمنظومة</span>
            <span className="text-2xl font-black text-amber-600 mt-1 block">شريك ممتاز</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shadow-2xs">
            <Award size={22} />
          </div>
        </div>
      </div>

      {/* 3. Core content split workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Right column: ID Details details table */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[30px] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <span className="text-sm font-black text-slate-900 flex items-center gap-2">
                <span className="text-xl">📋</span> بيانات الاعتماد للمحاضر والفوترة
              </span>
              <span className="text-[10px] bg-slate-100 font-mono font-bold px-2.5 py-1 text-slate-600 rounded-full">
                ACTIVE STATE
              </span>
            </div>
            
            <div className="divide-y divide-slate-100">
              <div className="flex justify-between items-center py-3.5 font-sans">
                <span className="text-xs text-slate-500 font-semibold text-right">رقم المعرّف الموحد (Teacher ID):</span>
                <div className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 transition px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-mono font-black text-indigo-755 select-all tracking-wider">{teacherIdString}</span>
                  <button
                    type="button"
                    onClick={handleCopyID}
                    className="text-slate-500 hover:text-slate-800 transition p-1 cursor-pointer"
                    title="نسخ المعرف"
                  >
                    {copied ? <span className="text-emerald-600 text-xs font-extrabold flex items-center gap-0.5">تم ✓</span> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center py-3.5">
                <span className="text-xs text-slate-500 font-semibold text-right">الاسم الرسمي في المستندات:</span>
                <span className="text-xs font-bold text-slate-800">{teacherName}</span>
              </div>

              <div className="flex justify-between items-center py-3.5">
                <span className="text-xs text-slate-500 font-semibold text-right">المادة والبرنامج الدراسي:</span>
                <span className="text-xs font-black text-blue-650 bg-blue-50/70 border border-blue-100 px-3 py-1 rounded-full">{subject}</span>
              </div>

              <div className="flex justify-between items-center py-3.5">
                <span className="text-xs text-slate-500 font-semibold text-right">مستوى الموثوقية بالمنظومة:</span>
                <span className="bg-emerald-50 text-emerald-850 text-[10px] font-black px-3 py-1 rounded-full border border-emerald-150 flex items-center gap-1">
                  شريك معتمد وموثق رقمياً 🛡️ ✓
                </span>
              </div>

              <div className="flex justify-between items-center py-3.5">
                <span className="text-xs text-slate-450 font-semibold text-right">رمز الاستيراد السريع للطلاب:</span>
                <button
                  type="button"
                  onClick={() => setShowQRModal(true)}
                  className="flex items-center gap-1 text-slate-700 hover:text-indigo-600 text-xs font-bold underline decoration-dotted underline-offset-4 cursor-pointer"
                >
                  <QrCode size={13} className="text-indigo-500" />
                  <span>عرض كود الطالب QR 🔗</span>
                </button>
              </div>

              <div className="flex justify-between items-center py-3.5">
                <span className="text-xs text-slate-500 font-semibold text-right">تاريخ المعاينة الفورية:</span>
                <span className="text-xs font-mono font-bold text-slate-700">2026-06-08</span>
              </div>
            </div>
          </div>

          <div className="p-5.5 bg-blue-50/40 border border-blue-150 rounded-2xl flex items-start gap-3">
            <ShieldCheck size={18} className="text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <span className="text-xs font-black text-slate-900 block">نظام التوثيق المتكامل</span>
              <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                تمثل هذه البطاقة الاعتماد الرسمي للمحاضر المسجل، وتربط حسابك الرقمي بالبيانات السحابية المشفرة. سيتمكن طلابك من إدخال رمز المعرف الخاص بك للانضمام إلى حصصك اليومية وعقد الامتحانات التقييمية ومراجعة كشوفات دفعاتهم المالية بكل أمان وشفافية.
              </p>
            </div>
          </div>
        </div>

        {/* Left column: ID Card representation with clear styling and download option */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center space-y-6">
          <div className="text-center">
            <span className="text-xs font-black text-slate-850 block mb-1">المعاينة الحية لبطاقة الهوية الأكاديمية (تصميم مميز فائق الدقة)</span>
            <span className="text-[10px] text-slate-450 font-bold block">مجهزة بدوائر الموثوقية الفضية وشريحة الاتصال الذكي الافتراضية.</span>
          </div>

          {/* Gorgeous Live ID Card Component on Screen */}
          <div className="w-full max-w-sm relative overflow-hidden bg-slate-950 border-2 border-amber-400 rounded-[30px] p-6 text-white shadow-2xl select-none group font-sans">
            {/* Decorative background glows */}
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute left-0 bottom-0 w-24 h-24 bg-pink-500/10 rounded-full blur-xl pointer-events-none" />
            
            {/* Overlay Grid Line Effect for High-Tech feel */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

            {/* Card Header */}
            <div className="relative flex items-center justify-between border-b pb-3.5 border-white/10">
              <div className="text-right">
                <h5 className="text-[11px] font-black text-amber-350 flex items-center gap-1 uppercase tracking-wider">
                  <span>👑</span> بطاقة هُوية الأستاذ الرقمية
                </h5>
                <span className="text-[8px] text-slate-400 block tracking-light mt-0.5">المنظومة الإلكترونية المتكاملة لإدارة وعوائد الحصص</span>
              </div>
              <div className="w-8.5 h-8.5 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center text-sm font-black shadow-inner">
                🎓
              </div>
            </div>

            {/* Card Body */}
            <div className="relative pt-4.5 flex gap-4.5 mt-1 items-start">
              {/* Profile Avatar Frame */}
              <div className="flex flex-col items-center gap-2 shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-amber-300 bg-slate-900 flex items-center justify-center shadow-lg transform transition-all group-hover:scale-105 duration-300">
                  {teacherAvatar ? (
                    <img src={teacherAvatar} alt={teacherName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-4xl">🧑‍🏫</span>
                  )}
                </div>
                <span className="text-[7.5px] font-extrabold text-[#94a3b8] tracking-wider uppercase">PREMIUM PARTNER</span>
              </div>

              {/* Info Labels */}
              <div className="flex-1 space-y-3 text-right">
                <div>
                  <span className="text-[8px] text-slate-450 block leading-none">👤 اسم الأستاذ الفاضل:</span>
                  <span className="text-xs font-black text-white mt-1 block truncate max-w-[150px]">
                    {teacherName}
                  </span>
                </div>

                <div>
                  <span className="text-[8px] text-slate-450 block leading-none">📚 التخصّص والمادة العلمية:</span>
                  <span className="text-[11px] font-bold text-slate-200 mt-0.5 truncate block max-w-[150px]">
                    {subject}
                  </span>
                </div>

                <div>
                  <span className="text-[8px] text-slate-450 block leading-none">🎖️ درجة الموثوقية بالمنظومة:</span>
                  <span className="text-[9px] font-black tracking-wide inline-block px-2 py-0.5 rounded-md mt-0.5 bg-emerald-500/20 text-emerald-355 border border-emerald-500/10">
                    مُعلّم معتمد بالمنظومة ✅
                  </span>
                </div>
              </div>

              {/* Golden Smart-SIM Chip representation */}
              <div className="absolute left-0 bottom-1">
                <div className="w-7.5 h-6 bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 rounded p-0.5 flex flex-col justify-between opacity-95 shadow-sm border border-yellow-250/50">
                  <div className="flex justify-between">
                    <span className="w-1 border-b border-yellow-800"></span>
                    <span className="w-1.5 border-b border-yellow-800"></span>
                  </div>
                  <div className="h-[1px] bg-yellow-800/85"></div>
                  <div className="flex justify-between">
                    <span className="w-1 border-t border-yellow-800"></span>
                    <span className="w-1.5 border-t border-yellow-800"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Barcode & ID text */}
            <div className="relative mt-5 pt-3.5 border-t border-white/10 flex flex-col items-center justify-center gap-1.5">
              <div className="flex items-center gap-1 bg-white/5 text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-white/5 text-[9px] font-semibold">
                <span className="text-slate-400 font-mono text-[8.5px]">ID:</span>
                <span className="font-mono font-bold text-amber-350 select-all tracking-wide">{teacherIdString}</span>
              </div>

              {/* Decorative Barcode Lines */}
              <div className="flex items-center justify-center gap-0.5 bg-white py-1.5 px-4 rounded-md h-8 w-full max-w-[200px] shadow-sm">
                <span className="w-[1.5px] h-5 bg-slate-900 inline-block" />
                <span className="w-0.5 h-5 bg-slate-900 inline-block" />
                <span className="w-1 h-5 bg-slate-900 inline-block" />
                <span className="w-0.5 h-5 bg-slate-900 inline-block" />
                <span className="w-2 h-5 bg-slate-900 inline-block" />
                <span className="w-[1.5px] h-5 bg-slate-900 inline-block" />
                <span className="w-0.5 h-5 bg-slate-900 inline-block" />
                <span className="w-1 h-5 bg-slate-900 inline-block" />
                <span className="w-2.5 h-5 bg-slate-900 inline-block" />
                <span className="w-0.5 h-5 bg-slate-900 inline-block" />
                <span className="w-[1px] h-5 bg-slate-900 inline-block" />
              </div>
            </div>
          </div>

          {/* Download Action Trigger */}
          <button
            type="button"
            onClick={handleDownloadCard}
            disabled={isDownloading}
            className="w-full max-w-sm flex items-center justify-center gap-2.5 py-4 px-5 text-xs text-white font-black rounded-2xl cursor-pointer transition active:scale-95 shadow-md hover:brightness-105 disabled:bg-slate-300"
            style={{ backgroundColor: accentColor }}
          >
            <Download size={15} className={isDownloading ? 'animate-bounce' : ''} />
            <span>{isDownloading ? 'جاري تصدير الملف...' : 'تنزيل بطاقة المدرس الفورية (PNG) 📸'}</span>
          </button>
        </div>
      </div>

      {/* QR Code Quick Modal overlay */}
      <AnimatePresence>
        {showQRModal && (
          <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[32px] border border-slate-200 p-6 max-w-sm w-full text-center space-y-5 shadow-2xl relative"
            >
              <div className="absolute top-4 left-4">
                <button
                  onClick={() => setShowQRModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs cursor-pointer transition"
                >
                  ✕
                </button>
              </div>

              <div className="mx-auto w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <QrCode size={24} />
              </div>

              <div>
                <h4 className="text-base font-black text-slate-900">رمز الربط السريع للطلاب</h4>
                <p className="text-xs text-slate-500 mt-1">يستطيع طلابك استخدام هذا المعرف للربط بملفك فورياً ومتابعة حصصهم.</p>
              </div>

              {/* QR Simulation vector */}
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex flex-col items-center justify-center gap-2">
                <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-3xs">
                  {/* Real simulated visual QR blocks representation */}
                  <div className="w-36 h-36 bg-slate-900 rounded-lg p-2.5 flex flex-col justify-between">
                    <div className="flex justify-between">
                      <div className="w-10 h-10 border-4 border-white bg-slate-900" />
                      <div className="w-10 h-10 border-4 border-white bg-slate-900" />
                    </div>
                    {/* Inner complex QR modules */}
                    <div className="flex justify-center flex-wrap gap-1 px-2">
                      <div className="w-2 h-2 bg-white" />
                      <div className="w-3 h-1 bg-white" />
                      <div className="w-1.5 h-1.5 bg-white" />
                      <div className="w-2.5 h-1 bg-white" />
                      <div className="w-1 h-3 bg-white" />
                      <div className="w-2 h-2 bg-white" />
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="w-10 h-10 border-4 border-white bg-slate-900" />
                      <div className="w-4 h-4 bg-white rounded-xs" />
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-black text-slate-800 tracking-wider bg-slate-200 px-3 py-1 rounded-lg mt-1">
                  ID: {teacherIdString}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(teacherIdString);
                  alert('تم نسخ الرمز بنجاح!');
                }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                نسخ رمز المعرف فقط 📋
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
