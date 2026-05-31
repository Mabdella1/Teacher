import { useState, useEffect } from 'react';
import { Student } from '../types';
import { 
  FileSpreadsheet, FileText, Calendar, ChevronDown, Users, CheckCircle2, AlertCircle, AlertTriangle, TrendingUp, PieChart as PieIcon,
  Download, Loader2, Target, Percent, Coins
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from 'recharts';

interface FinancialReportsProps {
  students: Student[];
  currency: string;
}

export default function FinancialReports({ students, currency }: FinancialReportsProps) {
  // Setup default filter to current month/year
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => String(now.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(() => String(now.getFullYear()));
  const [showPrintWarning, setShowPrintWarning] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Target Monthly Budget logic
  const budgetKey = `monthly_earnings_target_${selectedYear}_${selectedMonth}`;
  const [targetBudget, setTargetBudget] = useState<number>(5000);

  useEffect(() => {
    const saved = localStorage.getItem(budgetKey);
    if (saved) {
      setTargetBudget(Number(saved));
    } else {
      const globalSaved = localStorage.getItem('monthly_earnings_target_global');
      setTargetBudget(globalSaved ? Number(globalSaved) : 5000);
    }
  }, [selectedMonth, selectedYear, budgetKey]);

  const handleUpdateTargetBudget = (value: number) => {
    const maxVal = Math.max(0, value);
    setTargetBudget(maxVal);
    localStorage.setItem(budgetKey, String(maxVal));
    localStorage.setItem('monthly_earnings_target_global', String(maxVal));
  };

  const MONTHS = [
    { value: '01', name: 'يناير / كانون الثاني' },
    { value: '02', name: 'فبراير / شباط' },
    { value: '03', name: 'مارس / آذار' },
    { value: '04', name: 'أبريل / نيسان' },
    { value: '05', name: 'مايو / أيار' },
    { value: '06', name: 'يونيو / حزيران' },
    { value: '07', name: 'يوليو / تموز' },
    { value: '08', name: 'أغسطس / آب' },
    { value: '09', name: 'سبتمبر / أيلول' },
    { value: '10', name: 'أكتوبر / تشرين الأول' },
    { value: '11', name: 'نوفمبر / تشرين الثاني' },
    { value: '12', name: 'ديسمبر / كانون الأول' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 2 + i));

  // Filter and process stats for selected month/year
  const reportItems = students.map(student => {
    // 1. Filter sessions of that month
    const monthlySessions = student.sessions.filter(sess => {
      const [y, m] = sess.date.split('-');
      return y === selectedYear && m === selectedMonth;
    });

    // 2. Filter payments of that month
    const monthlyPayments = student.payments.filter(pay => {
      const [y, m] = pay.date.split('-');
      return y === selectedYear && m === selectedMonth;
    });

    const totalPaidThisMonth = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);
    const sessionsCountThisMonth = monthlySessions.length;

    // Expected profit calculations:
    let expectedProfitThisMonth = 0;
    let studentOustandingBalance = 0;

    if (student.type === 'lesson') {
      // Direct multiplication of rates of completed sessions
      expectedProfitThisMonth = sessionsCountThisMonth * (student.lessonRate || 0);
      
      const allSessionsCost = student.sessions.length * (student.lessonRate || 0);
      const allPaymentsPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
      studentOustandingBalance = Math.max(0, allSessionsCost - allPaymentsPaid);
    } else {
      // Proportional monthly Share with extra sessions accounted separately
      const standardMonthlySessions = monthlySessions.filter(s => !s.isExtra);
      const extraMonthlySessions = monthlySessions.filter(s => s.isExtra);
      
      const sessionRateProportional = (student.coursePrice || 0) / (student.totalLessonsCount || 1);
      const standardEarnings = standardMonthlySessions.length * sessionRateProportional;
      const extraEarnings = extraMonthlySessions.reduce((sum, s) => sum + (s.extraPrice || 0), 0);
      expectedProfitThisMonth = Number((standardEarnings + extraEarnings).toFixed(1)) || 0;

      const allPaymentsPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
      const totalExtraCost = student.sessions.filter(s => s.isExtra).reduce((sum, s) => sum + (s.extraPrice || 0), 0);
      const totalCost = (student.coursePrice || 0) + totalExtraCost;
      studentOustandingBalance = Math.max(0, totalCost - allPaymentsPaid);
    }

    return {
      studentId: student.id,
      studentName: student.name,
      studentType: student.type,
      sessionsCount: sessionsCountThisMonth,
      totalEarnings: expectedProfitThisMonth,
      totalPaid: totalPaidThisMonth,
      overallOutstanding: studentOustandingBalance,
    };
  });

  // Totals
  const totalMonthEarnings = reportItems.reduce((sum, item) => sum + item.totalEarnings, 0);
  const totalMonthPayments = reportItems.reduce((sum, item) => sum + item.totalPaid, 0);
  const totalPendingDue = reportItems.reduce((sum, item) => sum + item.overallOutstanding, 0);
  const activeSessionsThisMonth = reportItems.reduce((sum, item) => sum + item.sessionsCount, 0);

  // 1. Calculate Yearly Trend Data (12 Months of selectedYear)
  const getYearlyTrendData = () => {
    return MONTHS.map(m => {
      let monthlyEarnings = 0;
      let monthlyPayments = 0;

      students.forEach(student => {
        // Sessions in this specific month
        const sessions = student.sessions.filter(sess => {
          const [y, mon] = sess.date.split('-');
          return y === selectedYear && mon === m.value;
        });

        // Payments in this specific month
        const payments = student.payments.filter(pay => {
          const [y, mon] = pay.date.split('-');
          return y === selectedYear && mon === m.value;
        });

        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        monthlyPayments += totalPaid;

        if (student.type === 'lesson') {
          monthlyEarnings += sessions.length * (student.lessonRate || 0);
        } else {
          const sessionRateProportional = (student.coursePrice || 0) / (student.totalLessonsCount || 1);
          monthlyEarnings += Number((sessions.length * sessionRateProportional).toFixed(1)) || 0;
        }
      });

      return {
        name: m.name.split(' / ')[0], // e.g. "يناير"
        'الأرباح المستحقة': monthlyEarnings,
        'المدفوعات المستلمة': monthlyPayments,
      };
    });
  };

  const yearlyTrendData = getYearlyTrendData();

  // 2. Month-specific breakdown data for Pie Chart
  let lessonPaymentsTotal = 0;
  let coursePaymentsTotal = 0;

  reportItems.forEach(item => {
    if (item.studentType === 'lesson') {
      lessonPaymentsTotal += item.totalPaid;
    } else {
      coursePaymentsTotal += item.totalPaid;
    }
  });

  const allZero = lessonPaymentsTotal === 0 && coursePaymentsTotal === 0 && totalPendingDue === 0;
  
  const paymentDistributionData = allZero
    ? [{ name: 'لا توجد حركات مالية', value: 1, color: '#cbd5e1' }]
    : [
        { name: 'مدفوعات حصص يومية', value: lessonPaymentsTotal, color: '#10b981' },
        { name: 'مدفوعات كورس كامل', value: coursePaymentsTotal, color: '#3b82f6' },
        { name: 'ذمم طلبة معلقة', value: totalPendingDue, color: '#ef4444' }
      ];

  // Custom tooltips for Arabic localization
  const CustomTooltipDynamic = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900/90 text-white p-3.5 rounded-2xl border border-slate-800 shadow-2xl text-right font-sans text-xs space-y-1.5 backdrop-blur-md">
          <p className="font-extrabold pb-1 border-b border-white/10 text-slate-200">{label}</p>
          {payload.map((entry: any, index: number) => {
            const entryColor = entry.payload.color || entry.color;
            return (
              <p key={index} className="flex justify-between items-center gap-5 font-bold">
                <span className="text-[10.5px] flex items-center gap-1" style={{ color: entryColor }}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: entryColor }} />
                  {entry.name}:
                </span>
                <span className="font-mono text-slate-50">{entry.value} {currency}</span>
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Export Monthly Report to CSV
  const handleExportMonthCSV = () => {
    let csvContent = '\ufeff'; // UTF-8 BOM so Excel opens with correct Arabic characters
    csvContent += `تقرير أرباح وحسابات المعلم لشهر: ${selectedMonth} - ${selectedYear}\n`;
    csvContent += `العملة المعتمدة: ${currency}\n`;
    csvContent += `إجمالي المستحقات المترتبة بالشهر: ${totalMonthEarnings} ${currency}\n`;
    csvContent += `إجمالي الدفعات المستلمة بالشهر: ${totalMonthPayments} ${currency}\n`;
    csvContent += `إجمالي الذمم المدونة المستحقة للطلبة: ${totalPendingDue} ${currency}\n`;
    csvContent += `إجمالي حصص المدرس المنجزة: ${activeSessionsThisMonth} حصة\n\n`;

    // Headers
    csvContent += 'اسم الطالب,نظام التعلم,الحصص المكتملة هذا الشهر,ربحية المدرس المستحقة من حصص الشهر,الدفعات النقدية المسددة هذا الشهر,متبقي مستحقات كلية متأخرة للآن\n';

    reportItems.forEach(item => {
      const typeLabel = item.studentType === 'lesson' ? 'نظام حصص' : 'نظام كورس';
      csvContent += `"${item.studentName}","${typeLabel}","${item.sessionsCount}","${item.totalEarnings} ${currency}","${item.totalPaid} ${currency}","${item.overallOutstanding} ${currency}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `تقرير_أرباح_TEACHER_شهر_${selectedMonth}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = async () => {
    const element = document.getElementById('comprehensive-monthly-report-pdf');
    if (!element) {
      console.error('Target element "comprehensive-monthly-report-pdf" not found');
      return;
    }

    setIsGeneratingPDF(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));

      const canvas = await html2canvas(element, {
        scale: 2.2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: 850
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      pdf.save(`التقرير_المالي_والأداء_الشامل_شهر_${selectedMonth}_${selectedYear}.pdf`);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      alert('حدث خطأ أثناء رصد وتحميل كشف الـ PDF. يرجى تجربة فتح التطبيق في علامة تبويب مستقلة وإعادة المحاولة.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Filters Form */}
      <div className="premium-card p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-blue-900 flex items-center gap-1.5">
            <Calendar className="text-blue-600" size={18} />
            تصفية التقرير المالي لشهر محدد
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">يحتسب البرنامج الإحصائيات والأرباح حسب تاريخ ومقدار حصص ودفعات الشهر المختار.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Month Selector */}
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-800 px-4 py-2 pr-4 pl-9 text-xs rounded-xl font-bold cursor-pointer hover:border-slate-350 transition focus:outline-none"
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.name}</option>
              ))}
            </select>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <ChevronDown size={14} />
            </span>
          </div>

          {/* Year Selector */}
          <div className="relative font-sans">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-800 px-4 py-2 pr-4 pl-9 text-xs rounded-xl font-bold cursor-pointer hover:border-slate-350 transition focus:outline-none"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <ChevronDown size={14} />
            </span>
          </div>

          <button
            onClick={handleExportMonthCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm active:scale-95 duration-200"
          >
            <FileSpreadsheet size={15} />
            <span>تصدير تقرير Excel</span>
          </button>

          <button
            onClick={handlePrintPDF}
            disabled={isGeneratingPDF}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-150 text-rose-700 hover:bg-rose-100 text-xs font-bold rounded-xl transition cursor-pointer shadow-sm disabled:opacity-50 active:scale-95 duration-200"
          >
            {isGeneratingPDF ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Download size={15} />
            )}
            <span>{isGeneratingPDF ? 'جاري التنزيل...' : 'تنزيل تقرير PDF تلقائياً'}</span>
          </button>
        </div>
      </div>

      {/* Totals Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Earned based on sessions completed */}
        <div className="premium-card p-5 flex flex-col justify-between h-28">
          <p className="text-xs text-slate-500 font-bold">صافي أرباح حصص الشهر المستحقة</p>
          <div>
            <span className="text-2xl font-black text-slate-800">{totalMonthEarnings}</span>
            <span className="text-xs mr-1 text-slate-500">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">القيمة المقابلة للحصص المنقضية بالشهر</p>
        </div>

        {/* Total Paid / Collected this month */}
        <div className="premium-card p-5 flex flex-col justify-between h-28">
          <p className="text-xs text-slate-500 font-bold">المدفوعات والمستلم الفعلي بالشهر</p>
          <div>
            <span className="text-2xl font-black text-emerald-600">+{totalMonthPayments}</span>
            <span className="text-xs mr-1 text-emerald-700">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">السيولة النقدية الداخلة والمدفوعة</p>
        </div>

        {/* Outstandings */}
        <div className="premium-card p-5 flex flex-col justify-between h-28">
          <p className="text-xs text-slate-500 font-bold">إجمالي المتأخرات المتبقية (ذمم كلية)</p>
          <div>
            <span className="text-2xl font-black text-red-600">{totalPendingDue}</span>
            <span className="text-xs mr-1 text-slate-400">{currency}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium font-sans">المبلغ الإجمالي المطلوب تحصيله حالياً</p>
        </div>

        {/* Sessions Completed count */}
        <div className="premium-card p-5 flex flex-col justify-between h-28">
          <p className="text-xs text-slate-500 font-bold">عدد ساعات/حصص حضور الشهر</p>
          <div>
            <span className="text-2xl font-black text-slate-850">{activeSessionsThisMonth}</span>
            <span className="text-xs mr-1 text-slate-500">حصة منقضية</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">مجموع عطاء المدرس بهذا الشهر</p>
        </div>
      </div>

      {/* Target Monthly Earnings Budget Tracker & Comparison Chart */}
      <div className="premium-card p-6 space-y-6">
        <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-extrabold text-[#0f172a] flex items-center gap-2">
              <Target className="text-indigo-600 animate-pulse" size={20} />
              متابعة ميزانية الأرباح ومؤشر تحقيق الأهداف الشهرية 🎯
            </h3>
            <p className="text-xs text-slate-500">
              قارن ميزانية الأرباح المستهدفة لشهر {MONTHS.find(m => m.value === selectedMonth)?.name.split(' / ')[0]} {selectedYear} مع صافي الأرباح المحققة والمدفوعات الفعلية.
            </p>
          </div>

          {/* Budget Input Controls */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200/80 p-1.5 rounded-2xl w-full md:w-auto">
            <span className="text-xs text-slate-500 font-extrabold px-2 flex items-center gap-1">
              <Coins size={14} className="text-slate-400" />
              الميزانية المستهدفة:
            </span>
            <div className="relative flex items-center">
              <input
                type="number"
                min="0"
                step="500"
                value={targetBudget || 0}
                onChange={(e) => handleUpdateTargetBudget(Number(e.target.value))}
                className="w-28 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-1.5 px-3 pl-8 text-xs font-black text-slate-800 text-center outline-none shadow-3xs"
              />
              <span className="absolute left-2 text-[10px] text-slate-450 font-bold pointer-events-none">
                {currency}
              </span>
            </div>
            
            {/* Quick increase/decrease buttons */}
            <div className="flex gap-1">
              <button 
                onClick={() => handleUpdateTargetBudget((targetBudget || 0) + 1000)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-black cursor-pointer transition active:scale-95"
                title="إضافة 1000"
              >
                +1K
              </button>
              <button 
                onClick={() => handleUpdateTargetBudget((targetBudget || 0) + 500)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-black cursor-pointer transition active:scale-95"
                title="إضافة 500"
              >
                +500
              </button>
              <button 
                onClick={() => handleUpdateTargetBudget(Math.max(0, (targetBudget || 0) - 500))}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-650 rounded-lg text-[10px] font-black cursor-pointer transition active:scale-95"
                title="طرح 500"
              >
                -500
              </button>
            </div>
          </div>
        </div>

        {/* Breakdown dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Right/Stats Column */}
          <div className="space-y-4 flex flex-col justify-between">
            <div className="bg-slate-50/60 border border-slate-100 p-5 rounded-3xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-bold">نسبة إنجاز الهدف المالي</span>
                <span className={`text-xs font-black px-2.5 py-1 rounded-xl flex items-center gap-1 ${
                  targetBudget > 0 && totalMonthEarnings >= targetBudget 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                }`}>
                  <Percent size={12} />
                  {targetBudget > 0 ? Math.round((totalMonthEarnings / targetBudget) * 100) : 100}%
                </span>
              </div>

              {/* Styled modern progress bar with dynamic glow */}
              <div className="space-y-2">
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/20 relative">
                  <div 
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      targetBudget > 0 && totalMonthEarnings >= targetBudget
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-gradient-to-r from-blue-600 to-indigo-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]'
                    }`}
                    style={{ width: `${Math.min(100, targetBudget > 0 ? Math.round((totalMonthEarnings / targetBudget) * 100) : 100)}%` }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-[11px] text-slate-450 font-bold">
                  <span>0%</span>
                  <span>الهدف: {targetBudget} {currency}</span>
                </div>
              </div>
            </div>

            {/* Motivational status message */}
            <div className="bg-white border border-slate-100 rounded-3xl p-4 flex items-start gap-3 shadow-3xs">
              <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl mt-0.5 shrink-0">
                <Target size={16} />
              </div>
              <div className="space-y-1 text-right">
                <h4 className="text-xs font-black text-slate-800">حالة مؤشر المستهدف المالي</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                  {(() => {
                    const percent = targetBudget > 0 ? Math.round((totalMonthEarnings / targetBudget) * 100) : 100;
                    if (percent >= 100) {
                      return "🏆 تم تحقيق الهدف المالي لشهر التصفية بالكامل! لقد قمت بعمل رائع ومثمر هذا الشهر.";
                    } else if (percent >= 75) {
                      return "✨ ممتاز! أنت على وشك تحقيق الهدف بالكامل، المتبقي جزء بسيط جداً لتحقيق ميزانيتك.";
                    } else if (percent >= 45) {
                      return "📈 تقدم واعد وجيد جداً! استمر في تسجيل وإتمام الحصص المجدولة للطلبة لزيادة نسبة العائد.";
                    } else if (percent > 0) {
                      return "🎯 خطوة بداية صحيحة، تم تسجيل بعض أرباح الحصص المنجزة وجاري التقدم نحو موازنة الهدف.";
                    } else {
                      return "💤 لم يتم رصد أي أرباح مستحقة للشهر حتى الآن. يرجى البدء في تسجيل حضور الطلاب ومتابعتهم.";
                    }
                  })()}
                </p>
              </div>
            </div>

            {/* Simple numeric list highlights */}
            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-right">
                <p className="text-[10px] text-slate-400 font-bold font-sans">الأرباح المستهدفة</p>
                <p className="text-xs font-black text-slate-750 mt-1">{targetBudget} {currency}</p>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-right">
                <p className="text-[10px] text-slate-400 font-bold font-sans">الأرباح الفعلية حالياً</p>
                <span className={`text-xs font-black mt-1 inline-block ${totalMonthEarnings >= targetBudget ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {totalMonthEarnings} {currency}
                </span>
              </div>
            </div>
          </div>

          {/* Left/Comparison Chart Column */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black text-slate-500 flex items-center gap-1.5 justify-end">
              مقارنة بيانية دقيقة للميزانية مع الأداء المالي لشهر {MONTHS.find(m => m.value === selectedMonth)?.name.split(' / ')[0]}
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            </h4>
            
            <div className="h-64 w-full text-xs font-bold" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: 'المستهدف 🎯',
                      المبلغ: targetBudget,
                    },
                    {
                      name: 'المحقق الفعلي 💰',
                      المبلغ: totalMonthEarnings,
                    },
                    {
                      name: 'المدفوعات المستلمة 💵',
                      المبلغ: totalMonthPayments,
                    }
                  ]}
                  margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                  barSize={40}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fill: '#64748b', fontSize: 10 }}
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value} ${currency}`, 'القيمة']}
                    contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', textAlign: 'right', direction: 'rtl', fontFamily: 'sans-serif', fontSize: '11px', fontWeight: 'bold' }}
                    cursor={{ fill: 'rgba(241, 245, 249, 0.4)' }}
                  />
                  <Bar dataKey="المبلغ" radius={[8, 8, 0, 0]}>
                    <Cell fill="#818cf8" />
                    <Cell fill="#3b82f6" />
                    <Cell fill="#10b981" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Charts Dashboard with Recharts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Month-by-Month Evolution for Selected Year */}
        <div className="lg:col-span-2 premium-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-650" />
              تطور وتدفق الأرباح الشهرية مقابل المدفوعات لعام {selectedYear}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 font-sans">
              <TrendingUp size={12} className="text-blue-600" />
              <span>مخطط الزمن التراكمي</span>
            </div>
          </div>

          <div className="h-80 w-full text-xs font-bold" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={yearlyTrendData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10 }}
                />
                <Tooltip content={<CustomTooltipDynamic />} />
                <Legend 
                  verticalAlign="top" 
                  height={36} 
                  iconType="circle" 
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontFamily: 'sans-serif' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="الأرباح المستحقة" 
                  stroke="#3b82f6" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorEarnings)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="المدفوعات المستلمة" 
                  stroke="#10b981" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorPayments)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Income Distribution Breakdown */}
        <div className="premium-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              توزيع المدفوعات والديون لشهر {selectedMonth}
            </h4>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 font-sans">
              <PieIcon size={12} className="text-indigo-600" />
              <span>هيكل المداخيل</span>
            </div>
          </div>

          <div className="h-80 w-full flex flex-col justify-center items-center relative" dir="ltr">
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie
                  data={paymentDistributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {paymentDistributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltipDynamic />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Custom Interactive Legend description with values in Arabic */}
            <div className="w-full grid grid-cols-1 gap-2 text-right pt-2" dir="rtl">
              {paymentDistributionData.map((entry, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full block" style={{ backgroundColor: entry.color }} />
                    <span className="text-[11px]">{entry.name}</span>
                  </div>
                  <span className="font-mono font-extrabold text-slate-800">
                    {allZero ? 0 : entry.value} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Table Breakdown of Student Profits */}
      <div className="premium-card p-6">
        <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Users size={18} className="text-blue-600" />
          كشف تفصيلي بأرباح وحصص ومطالبات الطلاب في شهر {selectedMonth}/{selectedYear}
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 text-slate-605 font-bold border-b border-slate-100">
              <tr>
                <th className="py-3 px-4">اسم الطالب</th>
                <th className="py-3 px-4">نظام التعلم</th>
                <th className="py-3 px-4 text-center">حصص هذا الشهر</th>
                <th className="py-3 px-4">ربحية المدرس المستحقة</th>
                <th className="py-3 px-4">المدفوعات بالشهر</th>
                <th className="py-3 px-4">إجمالي المتأخرات المتراكمة</th>
                <th className="py-3 px-4 text-center">حالة الحساب للشهر</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              {reportItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-450 italic">
                    لا يوجد طلاب لإنشاء تقاريرهم. يرجى المتابعة والتسجيل أولاً.
                  </td>
                </tr>
              ) : (
                reportItems.map((item) => {
                  const isSettled = item.totalPaid >= item.totalEarnings;

                  return (
                    <tr key={item.studentId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{item.studentName}</td>
                      <td className="py-3.5 px-4">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                          item.studentType === 'lesson' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                            : 'bg-pink-50 text-pink-700 border border-pink-100'
                        }`}>
                          {item.studentType === 'lesson' ? 'نظام حصص' : 'نظام كورس'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-700">{item.sessionsCount} حصة</td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-850">
                        {item.totalEarnings} {currency}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-600">
                        {item.totalPaid > 0 ? `+${item.totalPaid}` : 0} {currency}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-500">
                        <span className={item.overallOutstanding > 0 ? 'text-red-600 font-extrabold' : 'text-emerald-600 font-extrabold'}>
                          {item.overallOutstanding}
                        </span>{' '}
                        <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {item.totalPaid === 0 && item.totalEarnings === 0 ? (
                          <span className="text-[10px] text-slate-400 font-semibold">لا يوجد حركات</span>
                        ) : isSettled ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-150 rounded-full inline-flex items-center gap-1">
                            <CheckCircle2 size={10} /> مسدد للشهر
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-700 border border-red-150 rounded-full inline-flex items-center gap-1">
                            <AlertCircle size={10} /> متبقي عليه
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Offscreen PDF Monthly Comprehensive Report Template used to generate high-DPI PDF directly (المحمل المباشر) */}
      <div className="absolute pointer-events-none select-none overflow-hidden" style={{ position: 'absolute', left: '-9999px', top: '0px', width: '850px', height: 'auto', opacity: 1, visibility: 'visible', zIndex: -100 }}>
        <div id="comprehensive-monthly-report-pdf" className="bg-white p-10 font-sans text-right relative text-slate-850" dir="rtl" style={{ width: '850px' }}>
          
          {/* Header */}
          <div className="border-b-4 border-blue-600 pb-5 mb-8 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-black text-blue-950 tracking-tight">تقرير الأداء الأكاديمي والمالي الشامل</h1>
              <p className="text-xs text-slate-500 mt-1.5 font-bold">
                عن شهر: <span className="text-blue-700 font-extrabold">{MONTHS.find(m => m.value === selectedMonth)?.name || `شهر ${selectedMonth}`}</span> لعام <span className="text-blue-700 font-extrabold">{selectedYear}</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="text-left">
              <div className="text-blue-650 font-black text-lg tracking-wider">نظام الإدارة الدراسي الذكي</div>
              <p className="text-[10px] text-slate-400 font-bold">منصة تنظيم المواعيد والمستحقات والتقارير</p>
            </div>
          </div>

          {/* Quick Metrics / Stats Grid */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-400 font-extrabold mb-1">الأرباح المستحقة من حصص الشهر</p>
              <p className="text-lg font-black text-slate-800">{totalMonthEarnings} <span className="text-xs text-slate-500 font-normal">{currency}</span></p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-400 font-extrabold mb-1">المدفوعات والمستحصلات الكلية</p>
              <p className="text-lg font-black text-emerald-600">+{totalMonthPayments} <span className="text-xs text-emerald-700 font-normal">{currency}</span></p>
            </div>
            <div className="bg-slate-100/70 border border-red-250 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-red-500 font-extrabold mb-1">الذمم المالية المتأخرة للطلاب</p>
              <p className="text-lg font-black text-red-650">{totalPendingDue} <span className="text-xs text-red-550 font-normal">{currency}</span></p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-slate-400 font-extrabold mb-1">عدد الحصص والدروس المكتملة</p>
              <p className="text-lg font-black text-blue-900">{activeSessionsThisMonth} <span className="text-xs text-blue-650 font-normal">حصة</span></p>
            </div>
          </div>

          {/* Outstanding Debts Analysis Detail (الذمم المالية للطلاب) */}
          <div className="mb-8">
            <h3 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-1.5 pb-2 border-b border-slate-150">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              كشف الذمم المالية المتأخرة والمطالبات المستحقة للطلاب
            </h3>
            
            <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-100 text-slate-605 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">اسم الطالب</th>
                  <th className="py-2.5 px-3">نظام التعلم</th>
                  <th className="py-2.5 px-3 text-center">حصص الشهر</th>
                  <th className="py-2.5 px-3">مدفوعات الشهر</th>
                  <th className="py-2.5 px-3 text-center">متبقي مستحقات متراكمة (ذمم)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reportItems.filter(item => item.overallOutstanding > 0).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400 italic bg-emerald-50/20 text-emerald-700 font-bold">
                      🎉 تهانينا! لا توجد ذمم مالية متأخرة أو مطالبات مستحقة على أي طالب لهذا الشهر.
                    </td>
                  </tr>
                ) : (
                  reportItems
                    .filter(item => item.overallOutstanding > 0)
                    .sort((a,b) => b.overallOutstanding - a.overallOutstanding)
                    .map((item) => (
                      <tr key={item.studentId} className="hover:bg-slate-55">
                        <td className="py-2.5 px-3 font-bold text-slate-800">{item.studentName}</td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {item.studentType === 'lesson' ? 'نظام حصص' : 'نظام كورس'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-slate-705">{item.sessionsCount} حصة</td>
                        <td className="py-2.5 px-3 font-bold text-emerald-650">
                          {item.totalPaid > 0 ? `${item.totalPaid} ${currency}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center bg-red-50/40">
                          <span className="font-extrabold text-red-650 bg-red-100 px-2 py-0.5 rounded-md">
                            {item.overallOutstanding} {currency}
                          </span>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          {/* Academic Performance & Lesson Density Analysis */}
          <div className="mb-10">
            <h3 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-1.5 pb-2 border-b border-slate-150">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              إحصائيات أداء وحضور الطلاب (نشاط الحصص والدروس)
            </h3>

            <table className="w-full text-right text-xs border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-slate-100 text-slate-605 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">اسم الطالب</th>
                  <th className="py-2.5 px-3">نظام التعلم</th>
                  <th className="py-2.5 px-3 text-center">عدد حصص الشهر المنقضية</th>
                  <th className="py-2.5 px-3">الأرباح المستحقة لشهر العمل</th>
                  <th className="py-2.5 px-3 text-center">أعلى نشاط هذا الشهر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {reportItems.map((item) => {
                  const isTopActive = item.sessionsCount >= 4;
                  return (
                    <tr key={item.studentId} className="hover:bg-slate-55">
                      <td className="py-2.5 px-3 font-bold text-slate-800">{item.studentName}</td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {item.studentType === 'lesson' ? 'نظام حصص' : 'نظام كورس'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-extrabold text-slate-705">{item.sessionsCount} حصة</td>
                      <td className="py-2.5 px-3 font-bold text-slate-600">{item.totalEarnings} {currency}</td>
                      <td className="py-2.5 px-3 text-center">
                        {isTopActive ? (
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 bg-indigo-50 text-indigo-750 border border-indigo-150 rounded">
                            🔥 نشاط متميز
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Report Footer / Signature Area */}
          <div className="border-t border-slate-200 pt-6 mt-12 flex justify-between items-start text-xs text-slate-500">
            <div>
              <p className="font-bold">ملاحظات هامة:</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-sm leading-relaxed">
                * تم إعداد واحتساب هذا التقرير تلقائياً استناداً للبيانات المدخلة في نظام الإدارة التعليمي المالي للطلاب. يرجى مراجعة وتوثيق كافة المدفوعات المستلمة والمستحقة.
              </p>
            </div>
            <div className="text-left">
              <p className="font-bold">توقيع المعلم واعتماده:</p>
              <div className="w-32 h-14 border border-dashed border-slate-300 rounded-xl mt-1.5 flex items-center justify-center text-slate-300 italic text-[10px]">
                توقيع معتمد
              </div>
            </div>
          </div>

        </div>
      </div>

      {showPrintWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            onClick={() => setShowPrintWarning(false)}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 font-sans text-right text-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex gap-3.5 items-start mb-4">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-blue-50 border border-blue-100 text-blue-600">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-bold text-slate-900 leading-snug">تنبيه بخصوص طباعة التقرير / PDF</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-line">
                  أنت تتصفح التطبيق حالياً من داخل نافذة المعاينة السريعة والمحمية (iFrame)، والتي تمنع متصفحات الويب تشغيل أوامر الطباعة المباشرة بداخلها لأسباب أمنية.

للطباعة وحفظ التقرير كـ PDF بنجاح وسهولة:
1. يرجى فتح التطبيق في علامة تبويب كاملة ومستقلة بالمتصفح بالضغط على زر فتح الرابط الخارجي (الأيقونة أو السهم بأعلى نافذة المعاينة).
2. ثم اضغط على زر طباعة من هناك لتظهر نافذة حفظ الـ PDF فوراً.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 font-bold text-xs pt-2">
              <button
                type="button"
                onClick={() => setShowPrintWarning(false)}
                className="px-4 py-2 text-slate-650 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer shadow-sm"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    window.print();
                  } catch(e) {}
                  setShowPrintWarning(false);
                }}
                className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                تفهمت، جرب الطباعة على أي حال
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
