import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { Student } from '../types';
import { 
  TrendingUp, Download, Coins, ArrowUpRight, ArrowDownRight, Wallet, Calendar, Plus, Minus, History, Trash2, FileText, CheckCircle, AlertTriangle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, LineChart, Line } from 'recharts';

interface FinancialReportsProps {
  students: Student[];
  currency: string;
  onUpdateStudent?: (id: string, updatedFields: Partial<Student>) => void;
}

interface BudgetLedgerEntry {
  id: string;
  amount: number; // positive for addition, negative for subtraction
  date: string;
  note: string;
  category: string;
}

export default function FinancialReports({ students, currency = 'ج.م', onUpdateStudent }: FinancialReportsProps) {
  const [activeTab, setActiveTab] = useState<'reports' | 'budget' | 'expenses'>('reports');
  const [activePeriod, setActivePeriod] = useState<'all' | 'annual' | 'monthly' | 'weekly' | 'daily'>('monthly');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Budget States
  const [budgetBalance, setBudgetBalance] = useState<number>(0);
  const [ledger, setLedger] = useState<BudgetLedgerEntry[]>([]);
  const [customNote, setCustomNote] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<string>('');
  const [customType, setCustomType] = useState<'add' | 'subtract'>('add');
  const [selectedCategory, setSelectedCategory] = useState<string>('مصروفات عامة');
  const [chartView, setChartView] = useState<'comparison' | 'byCategory' | 'byDate' | 'monthlyTrend'>('comparison');

  // Input states for setting exact budget and recording lesson payments
  const [setAmountInput, setSetAmountInput] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [lessonAmount, setLessonAmount] = useState<string>('');
  const [lessonNotes, setLessonNotes] = useState<string>('');
  const [lessonPaymentDate, setLessonPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Ref for the single page A4 PDF capture
  const printableReportRef = useRef<HTMLDivElement>(null);

  // Load Budget from LocalStorage
  useEffect(() => {
    const loadBudgetFromStorage = () => {
      const savedBalance = localStorage.getItem('financial_budget_balance');
      const savedLedger = localStorage.getItem('financial_budget_ledger_v1');
      
      if (savedBalance) {
        setBudgetBalance(Number(savedBalance));
      } else {
        setBudgetBalance(1000); // Default budget initializer
        localStorage.setItem('financial_budget_balance', '1000');
      }

      if (savedLedger) {
        try {
          setLedger(JSON.parse(savedLedger));
        } catch (e) {
          console.error('Failed to parse budget ledger', e);
        }
      }
    };

    loadBudgetFromStorage();

    // Listen to custom updates to the budget
    window.addEventListener('financialBudgetUpdated', loadBudgetFromStorage);
    return () => {
      window.removeEventListener('financialBudgetUpdated', loadBudgetFromStorage);
    };
  }, []);

  // Save changes to localStorage
  const saveBudget = (newBalance: number, newLedger: BudgetLedgerEntry[]) => {
    setBudgetBalance(newBalance);
    setLedger(newLedger);
    localStorage.setItem('financial_budget_balance', String(newBalance));
    localStorage.setItem('financial_budget_ledger_v1', JSON.stringify(newLedger));
  };

  const handleQuickBudgetChange = (amount: number, isAddition: boolean) => {
    const change = isAddition ? amount : -amount;
    const newBalance = budgetBalance + change;
    
    const newEntry: BudgetLedgerEntry = {
      id: 'quick_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      amount: change,
      date: new Date().toISOString().split('T')[0],
      note: isAddition ? `إضافة سريعة فئة ${amount}` : `سحب سريع فئة ${amount}`,
      category: isAddition ? 'تغذية الميزانية' : 'مصروفات عامة'
    };

    saveBudget(newBalance, [newEntry, ...ledger]);
  };

  const handleCustomBudgetSubmitWithType = (e: FormEvent, forcedType: 'add' | 'subtract') => {
    e.preventDefault();
    const parsedAmount = parseFloat(customAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    const change = forcedType === 'add' ? parsedAmount : -parsedAmount;
    const newBalance = budgetBalance + change;

    const newEntry: BudgetLedgerEntry = {
      id: 'custom_' + Date.now(),
      amount: change,
      date: new Date().toISOString().split('T')[0],
      note: customNote.trim() || (forcedType === 'add' ? 'إيداع إضافي' : 'مصروفات مخصصة'),
      category: forcedType === 'add' ? 'إيرادات خارجية' : 'تكاليف تشغيلية'
    };

    saveBudget(newBalance, [newEntry, ...ledger]);
    setCustomAmount('');
    setCustomNote('');
  };

  // State for success feedback message
  const [successFeedback, setSuccessFeedback] = useState<string>('');

  const handleSetExactBudget = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(setAmountInput);
    if (isNaN(parsed) || parsed < 0) return;
    const diff = parsed - budgetBalance;
    const newEntry: BudgetLedgerEntry = {
      id: 'set_' + Date.now(),
      amount: diff,
      date: new Date().toISOString().split('T')[0],
      note: `تثبيت رصيد الميزانية يدوياً بقيمة: ${parsed}`,
      category: 'تحديد الميزانية'
    };
    saveBudget(parsed, [newEntry, ...ledger]);
    setSetAmountInput('');
    setSuccessFeedback(`تم بنجاح تحديد الميزانية وتعديل رصيدها الاجمالي إلى: ${parsed} ${currency}`);
    setTimeout(() => setSuccessFeedback(''), 5000);
  };

  const handleRegisterLessonPayment = (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(lessonAmount);
    if (!selectedStudentId || isNaN(parsedAmount) || parsedAmount <= 0) return;

    const targetStudent = students.find(s => s.id === selectedStudentId);
    if (!targetStudent) return;

    const newPaymentObj = {
      id: 'pay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      amount: parsedAmount,
      date: lessonPaymentDate || new Date().toISOString().split('T')[0],
      notes: lessonNotes.trim() || 'دفعة حصة مسجلة مباشرة'
    };

    if (onUpdateStudent) {
      onUpdateStudent(selectedStudentId, {
        payments: [newPaymentObj, ...(targetStudent.payments || [])]
      });
      // Also record it inside our ledger log right away!
      const newBudget = budgetBalance + parsedAmount;
      const budgetEntry: BudgetLedgerEntry = {
        id: 'pay_sync_' + newPaymentObj.id,
        amount: parsedAmount,
        date: newPaymentObj.date,
        note: `تسجيل دفعة حصة للطالب: ${targetStudent.name}${newPaymentObj.notes ? ` (${newPaymentObj.notes})` : ''}`,
        category: 'إيراد من طالب'
      };
      saveBudget(newBudget, [budgetEntry, ...ledger]);
      
      // Clear inputs
      setLessonAmount('');
      setLessonNotes('');
      // Set success message
      setSuccessFeedback(`تم بنجاح تسجيل دفعة مالية بقيمة ${parsedAmount} ${currency} للطالب ${targetStudent.name}`);
      setTimeout(() => setSuccessFeedback(''), 5000);
    }
  };

  const handleDeleteLedgerEntry = (id: string) => {
    const targetEntry = ledger.find(e => e.id === id);
    if (!targetEntry) return;

    const newBalance = budgetBalance - targetEntry.amount; // reverse the transaction
    const newLedger = ledger.filter(e => e.id !== id);
    saveBudget(newBalance, newLedger);
  };

  const handleResetExpenses = () => {
    if (!window.confirm("هل أنت متأكد من تصفير وحذف كافة قيود المصروفات المسجلة بالمحفظة بالكامل؟ لا يمكن التراجع عن هذا الإجراء.")) {
      return;
    }
    const cleanedLedger = ledger.filter(entry => entry.category !== 'مصروفات عامة' && !(entry.amount < 0 && entry.id.startsWith('manual_')));
    
    // Recalculate and reimburse the deleted expenses to budget balance
    const deletedExpensesSum = ledger
      .filter(entry => entry.category === 'مصروفات عامة' || (entry.amount < 0 && entry.id.startsWith('manual_')))
      .reduce((sum, entry) => sum + Math.abs(entry.amount), 0);
    
    const newBalance = budgetBalance + deletedExpensesSum;
    saveBudget(newBalance, cleanedLedger);
    
    setSuccessFeedback('تم بنجاح تصفير وإلغاء كافة قيود المصروفات من السجل! 🧹');
    setTimeout(() => setSuccessFeedback(''), 5500);
  };

  // Parse Year, Month, Day from item.date to check if it matches period filter
  const filterByPeriod = <T extends { date: string }>(items: T[]): T[] => {
    if (!items || !Array.isArray(items)) return [];
    
    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = String(today.getMonth() + 1).padStart(2, '0');
    
    return items.filter(item => {
      if (!item.date) return false;
      const [yStr, mStr, dStr] = item.date.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      const d = Number(dStr);
      if (isNaN(y) || isNaN(m) || isNaN(d)) return false;
      
      const itemDate = new Date(y, m - 1, d);

      if (activePeriod === 'all') {
        return true;
      } else if (activePeriod === 'annual') {
        return y === curYear;
      } else if (activePeriod === 'monthly') {
        return y === curYear && String(m).padStart(2, '0') === curMonth;
      } else if (activePeriod === 'weekly') {
        // within last 7 days
        const diffMs = today.getTime() - itemDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      } else if (activePeriod === 'daily') {
        // Last 2 days (Today and yesterday)
        const diffMs = today.getTime() - itemDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 2;
      }
      return true;
    });
  };

  // Perform Period Calculations for the Report
  const reportBreakdown = students.map(student => {
    const periodSessions = filterByPeriod(student.sessions || []);
    const periodPayments = filterByPeriod(student.payments || []);

    const periodPaymentsSum = periodPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Proportional Expected Earnings
    let expectedEarning = 0;
    if (student.type === 'lesson') {
      expectedEarning = periodSessions.reduce((sum, s) => {
        return sum + (s.extraPrice !== undefined ? s.extraPrice : (student.lessonRate || 100));
      }, 0);
    } else {
      const baseSessionRate = (student.coursePrice || 0) / (student.totalLessonsCount || 8 || 1);
      expectedEarning = periodSessions.reduce((sum, s) => {
        const rate = s.isExtra && s.extraPrice !== undefined ? s.extraPrice : baseSessionRate;
        return sum + rate;
      }, 0);
      // round to 1 decimal place
      expectedEarning = Math.round(expectedEarning * 10) / 10;
    }

    // Outstanding Dues for this student specifically in this period
    // If they were supposed to pay expectedEarning but paid periodPaymentsSum
    const dues = Math.max(0, expectedEarning - periodPaymentsSum);

    return {
      studentId: student.id,
      studentName: student.name,
      studentType: student.type,
      sessionsCount: periodSessions.length,
      income: expectedEarning,
      paid: periodPaymentsSum,
      dues: dues
    };
  });

  // Calculate Aggregates for display
  const totalIncome = reportBreakdown.reduce((sum, item) => sum + item.income, 0);
  const totalPayments = reportBreakdown.reduce((sum, item) => sum + item.paid, 0);
  const totalOutstandingDues = reportBreakdown.reduce((sum, item) => sum + item.dues, 0);
  const totalSessionsCount = reportBreakdown.reduce((sum, item) => sum + item.sessionsCount, 0);

  // Wallet summary variables: Revenues (all payments + manual revenues) and Expenses
  const computedRevenues = students.reduce((sum, s) => {
    return sum + (s.payments || []).reduce((pSum, p) => pSum + p.amount, 0);
  }, 0) + ledger
    .filter(e => e.amount > 0 && (e.category === 'إيرادات عامة' || e.id.startsWith('manual_rev_')))
    .reduce((sum, e) => sum + e.amount, 0);

  const computedExpenses = ledger
    .filter(e => e.amount < 0 && (e.category === 'مصروفات عامة' || e.id.startsWith('manual_exp_')))
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // Period-specific calculations for the graphical reports
  const periodRevenues = students.reduce((sum, s) => {
    return sum + filterByPeriod(s.payments || []).reduce((pSum, p) => pSum + p.amount, 0);
  }, 0) + filterByPeriod<BudgetLedgerEntry>(ledger.filter(e => e.amount > 0)).reduce((sum, e) => sum + e.amount, 0);

  const periodExpenses = filterByPeriod<BudgetLedgerEntry>(ledger.filter(e => e.amount < 0)).reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // Grouped expenses by their categories
  const expensesByCategory = (() => {
    const periodExpensesList = filterByPeriod<BudgetLedgerEntry>(ledger.filter(e => e.amount < 0));
    const groups: { [key: string]: number } = {};

    periodExpensesList.forEach(e => {
      const cat = e.category || 'مصروفات عامة';
      groups[cat] = (groups[cat] || 0) + Math.abs(e.amount);
    });

    return Object.entries(groups).map(([name, value]) => ({
      name,
      value: Math.round(value * 100) / 100,
      fill: '#f43f5e'
    }));
  })();

  // Grouped expenses by their dates, sorted chronologically
  const expensesByDate = (() => {
    const periodExpensesList = filterByPeriod<BudgetLedgerEntry>(ledger.filter(e => e.amount < 0));
    const groups: { [key: string]: number } = {};

    periodExpensesList.forEach(e => {
      const rawDate = e.date || new Date().toISOString().split('T')[0];
      groups[rawDate] = (groups[rawDate] || 0) + Math.abs(e.amount);
    });

    const sortedRawDates = Object.keys(groups).sort();

    return sortedRawDates.map(rawDate => {
      let displayDate = rawDate;
      try {
        const parts = rawDate.split('-');
        if (parts.length === 3) {
          displayDate = `${parts[2]}/${parts[1]}`;
        }
      } catch (err) {
        displayDate = rawDate;
      }
      return {
        name: displayDate,
        value: Math.round(groups[rawDate] * 100) / 100,
        fill: '#f43f5e'
      };
    });
  })();

  // Grouped expenses by their months, sorted chronologically
  const expensesByMonth = (() => {
    const periodExpensesList = filterByPeriod<BudgetLedgerEntry>(ledger.filter(e => e.amount < 0));
    const groups: { [key: string]: number } = {};

    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    periodExpensesList.forEach(e => {
      const rawDate = e.date || new Date().toISOString().split('T')[0];
      const parts = rawDate.split('-');
      if (parts.length >= 2) {
        const yearMonth = `${parts[0]}-${parts[1].padStart(2, '0')}`;
        groups[yearMonth] = (groups[yearMonth] || 0) + Math.abs(e.amount);
      }
    });

    const sortedMonthKeys = Object.keys(groups).sort();

    return sortedMonthKeys.map(yearMonth => {
      const [year, month] = yearMonth.split('-');
      const monthIndex = parseInt(month, 10) - 1;
      const arabicMonthName = monthNamesAr[monthIndex] || `شهر ${month}`;
      const label = activePeriod === 'all' ? `${arabicMonthName} ${year}` : arabicMonthName;
      return {
        name: label,
        value: Math.round(groups[yearMonth] * 100) / 100,
        fill: '#f43f5e'
      };
    });
  })();

  // Check if selected chart view has zero values to render zero states
  const isSelectedDataZero = (() => {
    if (chartView === 'comparison') {
      return periodRevenues === 0 && periodExpenses === 0;
    } else if (chartView === 'byCategory') {
      return expensesByCategory.length === 0 || expensesByCategory.every(item => item.value === 0);
    } else if (chartView === 'byDate') {
      return expensesByDate.length === 0 || expensesByDate.every(item => item.value === 0);
    } else if (chartView === 'monthlyTrend') {
      return expensesByMonth.length === 0 || expensesByMonth.every(item => item.value === 0);
    }
    return false;
  })();

  // Period label translator
  const getPeriodArabicLabel = () => {
    switch (activePeriod) {
      case 'all': return 'الحسابات الإجمالية (كافة الأوقات)';
      case 'annual': return `التقرير السنوي لعام ${new Date().getFullYear()}`;
      case 'monthly': return `التقرير الشهري لشهر ${new Date().toLocaleString('ar-EG', { month: 'long' })} ${new Date().getFullYear()}`;
      case 'weekly': return 'التقرير الأسبوعي لآخر 7 أيام';
      case 'daily': return 'تقرير اليومين الماضيين (اليوم وأمس)';
      default: return 'التقرير المالي';
    }
  };

  // Recharts payload
  const chartData = [
    { name: 'إجمالي الدخل 🔵', value: totalIncome, fill: '#2563eb' },
    { name: 'المدفوعات المستلمة 🟢', value: totalPayments, fill: '#16a34a' },
    { name: 'المستحقات المعلقة 🔴', value: totalOutstandingDues, fill: '#dc2626' }
  ];

  // Function to capture offscreen/onscreen design to high-quality PDF containing exactly ONE elegant page
  const handleExportPDF = async () => {
    const element = printableReportRef.current;
    if (!element) return;
    
    setIsGeneratingPDF(true);
    try {
      // Force preview of elements to settle animations
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const width = 800; // Fixed A4 width factor
      const height = 1130; // Fixed A4 height factor
      
      const imgData = await toPng(element, {
        width: width,
        height: height,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: '#ffffff'
        },
        pixelRatio: 2.2, // high quality rasterization
        cacheBust: true
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Draw exactly on one single sheet matching boundaries perfectly
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`التقرير_المالي_${activePeriod}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Failed to export PDF:', error);
      alert('حدث خطأ أثناء استخراج التقرير بصيغة PDF. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Function to capture and download report breakdown and expenses into a standard CSV file read by Excel easily
  const handleExportExcel = () => {
    try {
      // Create CSV content with UTF-8 BOM to ensure Arabic displays correctly in Excel
      let csvContent = "\uFEFF";
      
      // Header Section
      csvContent += `"التقرير المالي والشؤون المالية للطلاب - منصة المعلم الذكية TEACHER"\n`;
      csvContent += `"تاريخ التصدير:","${new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}"\n`;
      csvContent += `"الفترة المحددة التصفية:","${getPeriodArabicLabel()}"\n`;
      csvContent += `\n`;
      
      // Summary metrics
      csvContent += `"المؤشر المالي","القيمة بالعملة (${currency})"\n`;
      csvContent += `"إجمالي الدخل المتوقع","${totalIncome}"\n`;
      csvContent += `"إجمالي المبالغ المحصلة فعلياً","${totalPayments}"\n`;
      csvContent += `"إجمالي المستحقات المعلقة","${totalOutstandingDues}"\n`;
      csvContent += `"إجمالي المصروفات المنفذة","${periodExpenses}"\n`;
      csvContent += `"صافي الربح المالي للفترة","${totalPayments - periodExpenses}"\n`;
      csvContent += `\n`;
      
      // Breakdown Table
      csvContent += `"جدول تفاصيل حسابات الطلاب للفتـرة:"\n`;
      csvContent += `"اسم الطالب","نوع الاشتراك","عدد الحصص المنفذة خلال الفترة","المبلغ المستحق بالفترة","المسدد الفعلي بالفترة","المتبقي المطلوب بالفترة"\n`;
      
      reportBreakdown.forEach(item => {
        const typeAr = item.studentType === 'lesson' ? 'حصص فردية' : 'اشتراك كورس';
        csvContent += `"${item.studentName.replace(/"/g, '""')}","${typeAr}","${item.sessionsCount}","${item.income}","${item.paid}","${item.dues}"\n`;
      });
      
      csvContent += `\n`;
      
      // Expenses Table
      csvContent += `"جدول المصروفات والتدفقات الخارجة للفترة:"\n`;
      csvContent += `"البيان أو الملاحظة","تاريخ الصرف","التصنيف","المبلغ المستهلك"\n`;
      
      const periodExpensesList = filterByPeriod<BudgetLedgerEntry>(ledger.filter(e => e.amount < 0));
      if (periodExpensesList.length === 0) {
        csvContent += `"لا يوجد مصروفات مسجلة ضمن المدة المحددة"\n`;
      } else {
        periodExpensesList.forEach(e => {
          csvContent += `"${(e.note || '').replace(/"/g, '""')}","${e.date}","${e.category || 'عامة'}","${Math.abs(e.amount)}"\n`;
        });
      }
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `التقرير_المالي_${activePeriod}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to export CSV/Excel:', error);
      alert('حدث خطأ أثناء تصدير ملف إكسل. يرجى المحاولة مرة أخرى.');
    }
  };

  return (
    <div className="space-y-6 text-right font-sans" dir="rtl">
      
      {/* HEADER SECTION & TABS */}
      <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Coins size={22} className="text-blue-600 animate-pulse" />
            نظام الإدارة المالية الشامل 📊
          </h2>
          <p className="text-xs text-slate-500 mt-1">تتبع الدخل الإجمالي، المدفوعات والاشتراكات، وضبط ميزانية وميزان المصروفات فورياً.</p>
        </div>

        {/* Segmented control for main view categories */}
        <div className="flex flex-row items-center justify-center bg-slate-50 border border-slate-200/60 p-1.5 rounded-2xl shrink-0 gap-1.5 md:flex-nowrap">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            التقارير المالية 📈
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all duration-200 cursor-pointer whitespace-nowrap ${
              activeTab === 'expenses'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
            }`}
          >
            المصروفات 💸
          </button>
        </div>
      </div>

      {/* VIEW 1: FINANCIAL REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          
          {/* Period Selection Controls */}
          <div className="bg-slate-50 border border-slate-200/55 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-black text-slate-700">تصفية التقرير المالي بالتاريخ:</span>
            <div className="flex flex-row items-center justify-center p-1 bg-white border border-slate-200 rounded-2xl gap-0.5 md:gap-1 flex-nowrap overflow-x-auto">
              {[
                { id: 'all', label: 'الإجمالي (الكل)' },
                { id: 'annual', label: 'سنوي' },
                { id: 'monthly', label: 'شهري' },
                { id: 'weekly', label: 'أسبوعي' },
                { id: 'daily', label: 'يوم' }
              ].map(period => (
                <button
                  key={period.id}
                  onClick={() => setActivePeriod(period.id as any)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer whitespace-nowrap active:scale-95 duration-150 ${
                    activePeriod === period.id
                      ? 'bg-blue-600 text-white font-extrabold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Print 1-page PDF trigger */}
              <button
                onClick={handleExportPDF}
                disabled={isGeneratingPDF}
                className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100/80 text-rose-700 text-xs font-black px-4 py-2 rounded-xl transition cursor-pointer disabled:opacity-50 duration-200 shadow-3xs"
              >
                {isGeneratingPDF ? (
                  <span className="animate-spin text-rose-600">🌀</span>
                ) : (
                  <FileText size={15} />
                )}
                <span>تصدير التقرير PDF (صفحة واحدة)</span>
              </button>

              {/* Export CSV / Excel */}
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/80 text-emerald-700 text-xs font-black px-4 py-2 rounded-xl transition cursor-pointer duration-200 shadow-3xs"
              >
                <Download size={15} className="text-emerald-600" />
                <span>تصدير التقرير Excel (.csv)</span>
              </button>
            </div>
          </div>



          {/* THREE CORE BOLD GLOWING METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* 1. TOTAL INCOME (VIOLET) */}
            <div className="bg-violet-50/55 border-2 border-violet-500 rounded-3xl p-6 shadow-xs relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="absolute top-0 right-0 w-2.5 h-full bg-violet-500" />
              <p className="text-xs font-black text-violet-800 pr-1 select-none">إجمالي الدخل المتوقع</p>
              <div className="mt-4 flex items-baseline justify-between pr-1">
                <span className="text-4xl font-extrabold text-violet-700 tracking-tight leading-none">
                  {totalIncome.toLocaleString()}
                </span>
                <span className="text-sm font-black text-violet-600 mr-1.5">{currency}</span>
              </div>
              <p className="text-[10px] text-violet-505 font-bold mt-2 pr-1">القيمة المحسوبة لمجموع الحصص والاشتراكات المستحقة لهذه الفترة.</p>
            </div>

            {/* 2. PAYMENTS RECEIVED (GREEN) */}
            <div className="bg-emerald-50/55 border-2 border-emerald-500 rounded-3xl p-6 shadow-xs relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="absolute top-0 right-0 w-2.5 h-full bg-emerald-500" />
              <p className="text-xs font-black text-emerald-800 pr-1 select-none">المدفوعات والمبالغ المحصلة</p>
              <div className="mt-4 flex items-baseline justify-between pr-1">
                <span className="text-4xl font-extrabold text-emerald-700 tracking-tight leading-none">
                  {totalPayments.toLocaleString()}
                </span>
                <span className="text-sm font-black text-emerald-600 mr-1.5">{currency}</span>
              </div>
              <p className="text-[10px] text-emerald-505 font-bold mt-2 pr-1">السيولة النقدية الفعلية التي تم استلامها وتسجيلها.</p>
            </div>

            {/* 3. OUTSTANDING DUES (RED) */}
            <div className="bg-rose-50/55 border-2 border-rose-500 rounded-3xl p-6 shadow-xs relative overflow-hidden transition-all duration-300 hover:shadow-md">
              <div className="absolute top-0 right-0 w-2.5 h-full bg-rose-500" />
              <p className="text-xs font-black text-rose-800 pr-1 select-none">المستحقات والذمم المعلقة</p>
              <div className="mt-4 flex items-baseline justify-between pr-1">
                <span className="text-4xl font-extrabold text-rose-700 tracking-tight leading-none">
                  {totalOutstandingDues.toLocaleString()}
                </span>
                <span className="text-sm font-black text-rose-600 mr-1.5">{currency}</span>
              </div>
              <p className="text-[10px] text-rose-505 font-bold mt-2 pr-1">الأرصدة المتبقية والمستحقة على الطلبة في هذه الفترة.</p>
            </div>

          </div>

          {/* TWO GRAPHICAL & BREAKDOWN MODULES */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left side: Recharts graphical representation */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs lg:col-span-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 mb-1 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block animate-pulse" />
                  المقارنة البيانية للميزان المالي
                </h3>
                <p className="text-[10px] text-slate-400 mb-4 font-semibold">تحليل بصري سريع للتناسب بين المداخيل والمستحقات الفعلية.</p>
              </div>

              <div className="h-60 w-full text-xs font-bold" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                    barSize={40}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#334155', fontSize: 9, fontWeight: 'bold' }} 
                    />
                    <YAxis 
                      tickLine={false} 
                      axisLine={false} 
                      tick={{ fill: '#64748b', fontSize: 9 }}
                    />
                    <Tooltip 
                      formatter={(value: any) => [`${value} ${currency}`, 'القيمة']}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #f1f5f9', textAlign: 'right', direction: 'rtl', fontSize: '11px', fontFamily: 'sans-serif' }}
                    />
                    <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-center text-[10px] text-slate-500 font-semibold mt-4">
                تظهر الإحصائيات لعدد <span className="text-orange-600 font-black">{totalSessionsCount}</span> حصة منجزة مسجلين للطلاب خلال هذه الفترة.
              </div>
            </div>

            {/* Right side: Student-specific detailed breakdown table */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs lg:col-span-2">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block" />
                  تفاصيل كشف التدخلات المالية للطلاب
                </h3>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-2.5 py-1 rounded-lg">
                  عدد المقيدين: {students.length} طالب
                </span>
              </div>

              <div className="overflow-x-auto select-none rounded-2xl border border-slate-100">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-150">
                    <tr>
                      <th className="py-3 px-4">اسم الطالب</th>
                      <th className="py-3 px-4 text-center">النظام</th>
                      <th className="py-3 px-4 text-center">الحصص</th>
                      <th className="py-3 px-4 text-blue-600 font-black">الدخل</th>
                      <th className="py-3 px-4 text-emerald-600 font-black">المسدد</th>
                      <th className="py-3 px-4 text-rose-600 font-black">متبقي مطلوب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {reportBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                          لا توجد بيانات متاحة حالياً لتصميم تقرير لهذه الفترة.
                        </td>
                      </tr>
                    ) : (
                      reportBreakdown.map((item) => (
                        <tr key={item.studentId} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{item.studentName}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                              item.studentType === 'lesson'
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-pink-50 text-pink-700'
                            }`}>
                              {item.studentType === 'lesson' ? 'حصص فردية' : 'اشتراك كورس'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">{item.sessionsCount}</td>
                          <td className="py-3 px-4 text-blue-600 font-black font-mono">{item.income} {currency}</td>
                          <td className="py-3 px-4 text-emerald-600 font-black font-mono">{item.paid} {currency}</td>
                          <td className="py-3 px-4 font-bold font-mono">
                            {item.dues > 0 ? (
                              <span className="text-rose-600">
                                {item.dues} {currency}
                              </span>
                            ) : (
                              <span className="text-emerald-600">مسدد بالكامل</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW 2: BUDGET MANAGEMENT ("الميزانية") */}
      {activeTab === 'budget' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main budgeting console (Balance and actions) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Direct success or informational notifications */}
            {successFeedback && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-4 rounded-2xl text-right animate-bounce flex items-center justify-between gap-2">
                <span>{successFeedback}</span>
                <span className="text-emerald-600 font-extrabold">✓</span>
              </div>
            )}

            {/* CARD 1: تحديد مبلغ الميزانية */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs text-right space-y-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 justify-start">
                <Wallet size={18} className="text-blue-600" />
                <span>تحديد وتعيين مبلغ الميزانية الحالي 🛠️</span>
              </h3>
              <p className="text-[11px] text-slate-500">قم بإدخال وتثبيت القيمة الكلية لميزانيتك وسيقوم النظام بتثبيت الرصيد الجديد مباشرة.</p>
              
              <form onSubmit={handleSetExactBudget} className="flex gap-2 items-center">
                <input
                  type="number"
                  required
                  min="0"
                  step="0.5"
                  placeholder="مثال: 5000"
                  value={setAmountInput}
                  onChange={(e) => setSetAmountInput(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-mono font-bold flex-1 text-right"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-xl transition cursor-pointer active:scale-95 duration-100 whitespace-nowrap"
                >
                  تعيين وتحديث الرصيد
                </button>
              </form>
            </div>

            {/* CARD 2: تسجيل مدفوعات الحصص للطلاب */}
            <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xs text-right space-y-4">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 justify-start">
                <Plus size={18} className="text-emerald-600" />
                <span>تسجيل دفعة مالية لحصة الطالب 🧑‍🎓💰</span>
              </h3>
              <p className="text-[11px] text-slate-500">اختر الطالب وسجل المبلغ المدفوع ليتم قيد الدفع في حساب الطالب ومزامنة الإيراد فوريا مع رصيد الميزانية.</p>
              
              <form onSubmit={handleRegisterLessonPayment} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  {/* Select Student */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">اختر الطالب المقيد:</label>
                    <select
                      required
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    >
                      <option value="">-- اختر طالباً من القائمة --</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} ({student.type === 'lesson' ? 'حصص' : 'كورسات'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Amount */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">القيمة المسددة ({currency}):</label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.5"
                      placeholder="أدخل قيمة الدفعة"
                      value={lessonAmount}
                      onChange={(e) => setLessonAmount(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-mono font-bold text-right"
                    />
                  </div>

                  {/* Date Pick */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">تاريخ السداد:</label>
                    <input
                      type="date"
                      required
                      value={lessonPaymentDate}
                      onChange={(e) => setLessonPaymentDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-right font-mono"
                    />
                  </div>

                  {/* Optional Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-500">ملاحظة أو بيان (اختياري):</label>
                    <input
                      type="text"
                      placeholder="مثال: سداد نقدي للمجموعة الجديدة"
                      value={lessonNotes}
                      onChange={(e) => setLessonNotes(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-right"
                    />
                  </div>

                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-6 py-2.5 rounded-xl transition cursor-pointer active:scale-95 duration-100"
                  >
                    تنفيذ الخدمة وتسجيل عملية الدفع الحصصية
                  </button>
                </div>
              </form>
            </div>

          </div>

          {/* Right side: Display Balance & Ledger synced results */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Displaying visual balances */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 text-center shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 left-0 bottom-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.15),transparent)] pointer-events-none" />
              <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">رصيد الميزانية الحالي</p>
              <div className="mt-3 flex items-center justify-center gap-1.5">
                <span className="text-4xl font-extrabold tracking-tight font-sans text-emerald-400">
                  {budgetBalance.toLocaleString()}
                </span>
                <span className="text-sm font-bold text-slate-300">{currency}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold mt-2">رصيد مالي تشغيلي موثق لحصص الطلاب المسددة وتحويلات التمويل.</p>
            </div>

            {/* Mini Log of Registered Student Lesson Payments */}
            <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs flex flex-col h-[340px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3 select-none">
                <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 leading-none">
                  <CheckCircle size={15} className="text-emerald-500" />
                  مدفوعات الطلاب المسجلة في الميزانية
                </h3>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin space-y-2 pr-0.5">
                {(() => {
                  const studentLogs = ledger.filter(e => e.category === 'إيراد من طالب' || e.note.includes('دفعة'));
                  if (studentLogs.length === 0) {
                    return (
                      <div className="h-full flex flex-col justify-center items-center text-center text-slate-400 p-4">
                        <span className="text-2xl mb-1">🎓</span>
                        <p className="text-[11px] font-bold text-slate-600">لا توجد دفعات حصص مسجلة</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">عند تسجيل مدفوعات الحصص ستظهر هنا التاريخ والاسم والقيمة.</p>
                      </div>
                    );
                  }
                  return studentLogs.map((entry) => (
                    <div 
                      key={entry.id} 
                      className="bg-slate-50 hover:bg-slate-100/70 p-2.5 rounded-xl border border-slate-100 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-800 leading-tight">{entry.note}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{entry.date}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-extrabold text-emerald-600 font-mono">
                          +{entry.amount}
                        </span>
                        <button
                          onClick={() => handleDeleteLedgerEntry(entry.id)}
                          className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-rose-600 transition cursor-pointer"
                          title="تراجع عن القيد"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* VIEW 3: EXPENSES MANAGEMENT ("المصروفات") */}
      {activeTab === 'expenses' && (
        <div className="max-w-5xl mx-auto space-y-6">

          {/* THREE CORE METRICS FOR REVENUES, EXPENSES & BALANCE */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* 1. REVENUES CARD */}
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-3xl p-6 shadow-3xs relative overflow-hidden transition-all duration-300 hover:shadow-2xs">
              <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500" />
              <div className="flex items-center justify-between pb-1">
                <p className="text-xs font-black text-emerald-800 pr-2 select-none">إجمالي الإيرادات الكلية</p>
                <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-xl">
                  <ArrowUpRight size={15} />
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between pr-2">
                <span className="text-3xl font-extrabold text-emerald-700 tracking-tight leading-none font-sans">
                  {computedRevenues.toLocaleString()}
                </span>
                <span className="text-xs font-black text-emerald-600 mr-1.5">{currency}</span>
              </div>
              <p className="text-[10px] text-emerald-600/80 font-medium mt-2.5 pr-2">تشمل إيرادات الطلاب ودفعات حضور الحصص مع المداخيل المسجلة.</p>
            </div>

            {/* 2. EXPENSES CARD */}
            <div className="bg-rose-50/40 border border-rose-200 rounded-3xl p-6 shadow-3xs relative overflow-hidden transition-all duration-300 hover:shadow-2xs">
              <div className="absolute top-0 right-0 w-2 h-full bg-rose-500" />
              <div className="flex items-center justify-between pb-1">
                <p className="text-xs font-black text-rose-800 pr-2 select-none">إجمالي المصروفات العامة</p>
                <span className="p-1.5 bg-rose-100 text-rose-700 rounded-xl">
                  <ArrowDownRight size={15} />
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between pr-2">
                <span className="text-3xl font-extrabold text-rose-700 tracking-tight leading-none font-sans">
                  {computedExpenses.toLocaleString()}
                </span>
                <span className="text-xs font-black text-rose-600 mr-1.5">{currency}</span>
              </div>
              <p className="text-[10px] text-rose-600/80 font-medium mt-2.5 pr-2">تشمل المصاريف الإدارية والورقيات والخصومات الموثقة بالمحفظة.</p>
            </div>

            {/* 3. BALANCE CARD */}
            {(() => {
              const netBalance = computedRevenues - computedExpenses;
              const isProfitable = netBalance >= 0;
              return (
                <div className={`rounded-3xl p-6 shadow-3xs relative overflow-hidden transition-all duration-300 hover:shadow-2xs border ${
                  isProfitable 
                    ? 'bg-blue-50/40 border-blue-200' 
                    : 'bg-amber-50/45 border-amber-200'
                }`}>
                  <div className={`absolute top-0 right-0 w-2 h-full ${isProfitable ? 'bg-blue-500' : 'bg-amber-500'}`} />
                  <div className="flex items-center justify-between pb-1">
                    <p className={`text-xs font-black pr-2 select-none ${isProfitable ? 'text-blue-800' : 'text-amber-800'}`}>صافي موازنة التوازن المالي</p>
                    <span className={`p-1.5 rounded-xl ${isProfitable ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                      <Wallet size={15} />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between pr-2">
                    <span className={`text-3xl font-extrabold tracking-tight leading-none font-sans ${isProfitable ? 'text-blue-700' : 'text-amber-700'}`}>
                      {netBalance.toLocaleString()}
                    </span>
                    <span className={`text-xs font-black mr-1.5 ${isProfitable ? 'text-blue-600' : 'text-amber-600'}`}>{currency}</span>
                  </div>
                  <p className={`text-[10px] font-medium mt-2.5 pr-2 ${isProfitable ? 'text-blue-600/80' : 'text-amber-700/80'}`}>
                    {isProfitable 
                      ? 'مؤشر ممتاز: تغطية مالية كاملة والأرباح تزيد لتغذية الميزانية.' 
                      : 'مؤشر عجز مؤقت: إجمالي المصروفات تخطى الأرباح المسجلة للفترة.'}
                  </p>
                </div>
              );
            })()}

          </div>

          {/* NEAT FINANCIAL DASHBOARD OVERVIEW: REVENUES, EXPENSES & BALANCE */}
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-4 gap-4">
              <div className="text-right">
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 justify-start">
                  <TrendingUp size={16} className="text-blue-600" />
                  <span>التحليل البصري التفاعلي للأرباح والمصروفات</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 select-none">اختر التبويب المطلوب لعرض المقارنة العامة للمحفظة، أو تجميع المصروفات حسب الأقسام، أو المخطط الزمني، أو تتبع التقرير الشهري للمصروفات.</p>
              </div>
              <div className="flex bg-slate-100/85 border border-slate-200/50 p-1 rounded-2xl gap-1 shrink-0 flex-wrap md:flex-nowrap justify-start md:self-auto font-sans" dir="rtl">
                <button
                  onClick={() => setChartView('comparison')}
                  className={`px-3 py-1.5 text-[10.5px] font-black rounded-xl transition-all duration-150 cursor-pointer ${
                    chartView === 'comparison'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                  }`}
                >
                  ⚖️ الموازنة العامة
                </button>
                <button
                  onClick={() => setChartView('byCategory')}
                  className={`px-3 py-1.5 text-[10.5px] font-black rounded-xl transition-all duration-150 cursor-pointer ${
                    chartView === 'byCategory'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                  }`}
                >
                  📁 حسب التصنيف
                </button>
                <button
                  onClick={() => setChartView('byDate')}
                  className={`px-3 py-1.5 text-[10.5px] font-black rounded-xl transition-all duration-150 cursor-pointer ${
                    chartView === 'byDate'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
                  }`}
                >
                  📅 الجدول الزمني
                </button>
                <button
                  onClick={() => setChartView('monthlyTrend')}
                  className={`px-3 py-1.5 text-[10.5px] font-black rounded-xl transition-all duration-150 cursor-pointer ${
                    chartView === 'monthlyTrend'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-white/40'
                  }`}
                >
                  📈 التقرير الشهري
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Graphic Comparison Gauge */}
              <div className="lg:col-span-4 space-y-5 text-right bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                <h4 className="text-xs font-black text-slate-700">مقياس توزيع رأس المال ومؤشر الموازنة</h4>
                
                <div className="space-y-4">
                  {/* Revenue gauge */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-600 mb-1">
                      <span>إجمالي التدفق الوارد (الإيرادات)</span>
                      <span className="text-emerald-600 font-mono">
                        {computedRevenues > 0 ? Math.round((computedRevenues / (computedRevenues + computedExpenses || 1)) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex flex-row-reverse">
                      <div 
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${computedRevenues > 0 ? (computedRevenues / (computedRevenues + computedExpenses || 1)) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Expense gauge */}
                  <div>
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-600 mb-1">
                      <span>إجمالي التدفق الصادر (المصروفات)</span>
                      <span className="text-rose-600 font-mono">
                        {computedExpenses > 0 ? Math.round((computedExpenses / (computedRevenues + computedExpenses || 1)) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden flex flex-row-reverse">
                      <div 
                        className="bg-rose-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${computedExpenses > 0 ? (computedExpenses / (computedRevenues + computedExpenses || 1)) * 105 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200/60 pt-4 mt-2">
                  {(() => {
                    const balance = computedRevenues - computedExpenses;
                    const divisor = computedRevenues || 1;
                    const margin = Math.round((balance / divisor) * 100);
                    const isProfitable = balance >= 0;
                    return (
                      <div className="space-y-2">
                        <span className="text-[10px] text-slate-450 font-black block">هامش التوازن النقدي الفعلي:</span>
                        <div className="flex items-center gap-1.5 justify-start">
                          <span className={`text-sm font-black px-2.5 py-1 rounded-lg ${isProfitable ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {margin}% {isProfitable ? 'فائض مالي 📈' : 'عجز في السيولة 📉'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                          {isProfitable 
                            ? 'النموذج المالي مستقر تماماً. المداخيل المسجلة بالخزينة تفي بالتزامات الإدارة وتزيد الأرباح.' 
                            : 'تحذير: المصروفات العامة تفوق الإيرادات المستلمة حالياً، يرجى الاستغناء عن المصاريف الهامشية أو تحصيل اشتراكات الطلاب المتأخرة.'}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Recharts Column chart representing comparative/grouped views */}
              <div className="lg:col-span-8">
                <div className="h-[230px] w-full mt-2" dir="ltr">
                  {isSelectedDataZero ? (
                    <div className="h-full w-full flex flex-col justify-center items-center text-center p-6 bg-slate-50/70 rounded-2xl border border-dashed border-slate-205 select-none" dir="rtl">
                      <span className="text-4xl animate-bounce duration-1000">📊</span>
                      <h4 className="text-xs font-black text-slate-700 mt-2">لا توجد بيانات متاحة لعرضها حالياً في تصفية {activePeriod === 'all' ? 'جميع الأوقات' : getPeriodArabicLabel()}</h4>
                      <p className="text-[10px] text-slate-400 mt-1 max-w-sm leading-relaxed mx-auto">
                        {chartView === 'comparison' 
                          ? 'لم يتم تسجيل أي أرباح أو مصروفات في المحفظة لهذه الفترة الزمنية المحددة بالفلتر.' 
                          : chartView === 'byCategory'
                          ? 'لا توجد قيود مصروفات مسجلة ومصفاة ضمن الفترات الزمنية حالياً. جرب تسجيل مصروف مع تصنيف.'
                          : chartView === 'byDate'
                          ? 'لا توجد مصروفات مسجلة بتواريخ محددة لإظهار حركة الكاش الزمني.'
                          : 'لا توجد مصروفات مسجلة لتوضيح المخطط البياني للاتجاه الشهري للمصروفات.'}
                      </p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      {chartView === 'monthlyTrend' ? (
                        <LineChart
                          data={expensesByMonth}
                          margin={{ top: 15, right: 15, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 9.5, fontWeight: 'bold', fill: '#475569' }} 
                            tickLine={false}
                            axisLine={false} 
                          />
                          <YAxis 
                            tick={{ fontSize: 9, fill: '#64748b' }} 
                            tickLine={false}
                            axisLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'right', direction: 'rtl', fontFamily: 'sans-serif' }}
                            formatter={(value: any) => [`${value} ${currency}`, 'إجمالي المصروفات']}
                          />
                          <Line 
                            type="monotone"
                            dataKey="value" 
                            stroke="#f43f5e" 
                            strokeWidth={3}
                            activeDot={{ r: 6 }}
                            dot={{ r: 4, stroke: '#f43f5e', strokeWidth: 2, fill: '#fff' }}
                          />
                        </LineChart>
                      ) : (
                        <BarChart
                          data={
                            chartView === 'comparison'
                              ? [
                                  { name: 'الإيرادات 🟢', value: periodRevenues, fill: '#10b981' },
                                  { name: 'المصروفات 🔴', value: periodExpenses, fill: '#f43f5e' },
                                  { name: 'صافي الرصيد 🔵', value: periodRevenues - periodExpenses, fill: '#3b82f6' }
                                ]
                              : chartView === 'byCategory'
                              ? expensesByCategory
                              : expensesByDate
                          }
                          margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis 
                            dataKey="name" 
                            tick={{ fontSize: 9.5, fontWeight: 'bold', fill: '#475569' }} 
                            tickLine={false}
                            axisLine={false} 
                          />
                          <YAxis 
                            tick={{ fontSize: 9, fill: '#64748b' }} 
                            tickLine={false}
                            axisLine={false} 
                          />
                          <Tooltip 
                            contentStyle={{ fontSize: 11, borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'right', direction: 'rtl', fontFamily: 'sans-serif' }}
                            formatter={(value: any) => [`${value} ${currency}`, 'القيمة']}
                          />
                          <Bar dataKey="value" radius={[10, 10, 0, 0]} maxBarSize={50}>
                            {
                              chartView === 'comparison'
                                ? [
                                    { name: 'الإيرادات 🟢', value: periodRevenues, fill: '#10b981' },
                                    { name: 'المصروفات 🔴', value: periodExpenses, fill: '#f43f5e' },
                                    { name: 'صافي الرصيد 🔵', value: periodRevenues - periodExpenses, fill: '#3b82f6' }
                                  ].map((entry, index) => (
                                    <Cell key={`cell-exp-${index}`} fill={entry.fill} />
                                  ))
                                : chartView === 'byCategory'
                                ? expensesByCategory.map((entry, index) => (
                                    <Cell key={`cell-cat-${index}`} fill={entry.fill} />
                                  ))
                                : expensesByDate.map((entry, index) => (
                                    <Cell key={`cell-date-${index}`} fill={entry.fill} />
                                  ))
                            }
                          </Bar>
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* TWO COLUMN CONTENT: FORM ON RIGHT, LEDGER TRANSACTION HISTORY ON LEFT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* COLUMN 1: FORM */}
            <div className="lg:col-span-5 bg-white border border-slate-100 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-black text-slate-800 text-right flex items-center gap-1.5 justify-start">
                <Plus size={16} className="text-indigo-600" />
                <span>تسجيل وإثبات حركة مالية مخصصة 🌿💸</span>
              </h3>
              <p className="text-[11px] text-slate-400 text-right">أدخل القيمة والبيان واضغط على الزر المقابل لقيد العملية في سجل المحفظة.</p>
              
              <div className="space-y-4 text-right">
                
                {/* Amount input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-black text-slate-600">مربع كتابة القيمة المالية (المبلغ):</label>
                  <input
                    type="number"
                    required
                    min="0.1"
                    step="0.5"
                    placeholder="0.00"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:ring-1 focus:ring-blue-500 outline-none font-mono font-black text-right"
                  />
                </div>

                {/* Note input */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-black text-slate-600">مربع كتابة ملاحظة حول العملية (اختياري):</label>
                  <input
                    type="text"
                    maxLength={100}
                    placeholder="مثال: شراء أوراق وأقلام للمجموعات، إيجار القاعة"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-right placeholder:text-slate-350"
                  />
                </div>

                {/* Category input dynamic dropdown */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-black text-slate-600">تصنيف أو تبويب العملية (القسم):</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-4 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-right font-bold text-slate-700 cursor-pointer"
                  >
                    <optgroup label="📂 أقسام المصروفات">
                      <option value="مصروفات عامة">مصروفات عامة 💸</option>
                      <option value="أدوات ومستلزمات مكتبية">أدوات ومستلزمات مكتبية 📚</option>
                      <option value="إيجار وقاعات وضيافة">إيجار وقاعات وضيافة 🏠</option>
                      <option value="رواتب وأجور ومساعدين">رواتب وأجور ومساعدين 👥</option>
                      <option value="اشتراكات تقنية ومنصات">اشتراكات تقنية ومنصات 💻</option>
                      <option value="دعاية وتسويق ومطبوعات">دعاية وتسويق ومطبوعات 📢</option>
                    </optgroup>
                    <optgroup label="💰 أقسام الإيرادات">
                      <option value="إيرادات عامة">إيرادات عامة 🟢</option>
                      <option value="بيع كتب وملازم">بيع كتب وملازم 📖</option>
                      <option value="دعم وتمويل خارجي">دعم وتمويل خارجي 🪙</option>
                      <option value="إيرادات أخرى">إيرادات أخرى 🌟</option>
                    </optgroup>
                  </select>
                </div>

                {/* Two buttons representing Revenues vs Expenses */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  
                  {/* Revenue Option Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseFloat(customAmount);
                      if (isNaN(parsed) || parsed <= 0) return;
                      const change = parsed;
                      const newBalance = budgetBalance + change;
                      
                      const validIncomeCategories = ['إيرادات عامة', 'بيع كتب وملازم', 'دعم وتمويل خارجي', 'إيرادات أخرى'];
                      const finalCat = validIncomeCategories.includes(selectedCategory) 
                        ? selectedCategory 
                        : 'إيرادات عامة';

                      const newEntry: BudgetLedgerEntry = {
                        id: 'manual_rev_' + Date.now(),
                        amount: change,
                        date: new Date().toISOString().split('T')[0],
                        note: customNote.trim() || `إيراد مسجل بقسم: ${finalCat}`,
                        category: finalCat
                      };
                      saveBudget(newBalance, [newEntry, ...ledger]);
                      setCustomAmount('');
                      setCustomNote('');
                      setSuccessFeedback(`تم بنجاح تسجيل إيراد جديد بقيمة +${parsed} ${currency} تحت قسم ${finalCat}`);
                      setTimeout(() => setSuccessFeedback(''), 5000);
                    }}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs py-3 px-4 rounded-xl transition cursor-pointer active:scale-95 duration-100 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Plus size={14} />
                    <span>إيراد مالي (+)</span>
                  </button>

                  {/* Expense Option Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseFloat(customAmount);
                      if (isNaN(parsed) || parsed <= 0) return;
                      const change = -parsed;
                      const newBalance = budgetBalance + change;

                      const validExpenseCategories = ['مصروفات عامة', 'أدوات ومستلزمات مكتبية', 'إيجار وقاعات وضيافة', 'رواتب وأجور ومساعدين', 'اشتراكات تقنية ومنصات', 'دعاية وتسويق ومطبوعات'];
                      const finalCat = validExpenseCategories.includes(selectedCategory)
                        ? selectedCategory
                        : 'مصروفات عامة';

                      const newEntry: BudgetLedgerEntry = {
                        id: 'manual_exp_' + Date.now(),
                        amount: change,
                        date: new Date().toISOString().split('T')[0],
                        note: customNote.trim() || `مصروف مسجل بقسم: ${finalCat}`,
                        category: finalCat
                      };
                      saveBudget(newBalance, [newEntry, ...ledger]);
                      setCustomAmount('');
                      setCustomNote('');
                      setSuccessFeedback(`تم بنجاح تسجيل مصروف جديد بقيمة -${parsed} ${currency} تحت قسم ${finalCat}`);
                      setTimeout(() => setSuccessFeedback(''), 5000);
                    }}
                    className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-black text-xs py-3 px-4 rounded-xl transition cursor-pointer active:scale-95 duration-100 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Minus size={14} />
                    <span>مصروف مالي (-)</span>
                  </button>
                </div>

              </div>

              {successFeedback && (
                <p className="text-[11px] text-center font-bold text-emerald-600 bg-emerald-50 py-1.5 rounded-lg mt-3">
                  {successFeedback}
                </p>
              )}

            </div>

            {/* COLUMN 2: LEDGER TRANSACTION HISTORY TABLE */}
            <div className="lg:col-span-7 bg-white border border-slate-100 rounded-3xl p-5 shadow-xs text-right space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-100">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 justify-start">
                  <History size={15} className="text-indigo-500" />
                  <span>سجل المعاملات والعمليات المالية مخرجات المحفظة</span>
                </h4>
                <span className="text-[9.5px] bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-lg select-none">الكل</span>
              </div>
              
              <div className="space-y-2 max-h-[360px] overflow-y-auto scrollbar-thin pr-0.5">
                {(() => {
                  const expenseLogs = ledger.filter(e => e.category === 'مصروفات عامة' || e.category === 'إيرادات عامة' || e.id.startsWith('manual_'));
                  if (expenseLogs.length === 0) {
                    return (
                      <div className="py-12 text-center text-slate-400">
                        <span className="text-3xl mb-1 block select-none">💳</span>
                        <p className="text-[11px] font-bold text-slate-650">لا توجد عمليات مخصصة مسجلة بالمحفظة حتى الآن.</p>
                        <p className="text-[9.5px] mt-0.5 text-slate-400">قم بتسجيل الإيرادات والمصروفات اليدوية بالنموذج لتظهر هنا.</p>
                      </div>
                    );
                  }
                  return expenseLogs.map((entry) => {
                    const isPositive = entry.amount > 0;
                    return (
                      <div 
                        key={entry.id} 
                        className="bg-slate-50 hover:bg-slate-100/70 p-3 rounded-xl flex items-center justify-between text-xs text-right border border-slate-100/50 transition-colors"
                      >
                        <div className="text-right">
                          <p className="font-extrabold text-slate-800 text-[11px]">{entry.note}</p>
                          <div className="flex items-center gap-1.5 text-[9.5px] text-slate-450 mt-0.5 select-none font-bold">
                            <span className="font-mono">{entry.date}</span>
                            <span>•</span>
                            <span className={isPositive ? 'text-emerald-600' : 'text-rose-600'}>
                              {isPositive ? 'إضافة إيراد' : 'صرف مصروف'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-extrabold font-sans text-sm ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPositive ? 'ج.م +' : 'ج.م -'}{Math.abs(entry.amount)}
                          </span>
                          <button
                            onClick={() => handleDeleteLedgerEntry(entry.id)}
                            className="text-slate-400 hover:text-rose-650 p-1 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="حذف القيد المالي"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ========================================== */}
      {/* PERFECT SINGLE-VIEW MANDATORY A4 WRAPPER FOR PDF PRINTING */}
      {/* ========================================== */}
      <div className="absolute pointer-events-none select-none overflow-hidden" style={{ position: 'absolute', left: '-9999px', top: '0px', width: '800px', height: '1130px', opacity: 1, visibility: 'visible', zIndex: -999 }}>
        <div 
          ref={printableReportRef} 
          className="bg-white p-10 font-sans text-right relative text-slate-900 border-t-8 border-blue-600 flex flex-col justify-between" 
          dir="rtl" 
          style={{ width: '800px', height: '1130px' }}
        >
          {/* A4 Content Wrapper */}
          <div className="space-y-8">
            
            {/* Elegant Header */}
            <div className="flex justify-between items-start border-b pb-6 border-slate-200">
              <div className="space-y-1.5">
                <span className="bg-blue-105 bg-blue-50 text-blue-700 text-[10px] font-black px-2.5 py-1 rounded-lg">مستند رسمي معتمد</span>
                <h1 className="text-2xl font-black text-slate-900 leading-none">تقرير التدفقات المالية الشامل</h1>
                <p className="text-xs text-slate-505 font-bold">{getPeriodArabicLabel()}</p>
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1 justify-end font-black text-blue-600 text-sm">
                  <span>نظام الحصص الإلكتروني</span>
                  <Coins size={16} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-bold">تاريخ التصدير: {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p className="text-[9px] text-slate-400 font-mono mt-0.5">ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
              </div>
            </div>

            {/* Period Statistics Summary Cards */}
            <div>
              <p className="text-xs font-black text-slate-500 mb-3 block">ملخص المؤشرات المالية الرئيسية:</p>
              <div className="grid grid-cols-3 gap-4">
                
                {/* Income */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right">
                  <span className="text-[10px] font-bold text-blue-600 block">إجمالي الدخل المتوقع</span>
                  <span className="text-xl font-extrabold text-blue-600 block mt-1 tracking-tight">
                    {totalIncome.toLocaleString()} <span className="text-[10px] font-bold">{currency}</span>
                  </span>
                </div>

                {/* Paid */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right">
                  <span className="text-[10px] font-bold text-emerald-600 block">المدفوعات والمبالغ المحصلة</span>
                  <span className="text-xl font-extrabold text-emerald-600 block mt-1 tracking-tight">
                    {totalPayments.toLocaleString()} <span className="text-[10px] font-bold">{currency}</span>
                  </span>
                </div>

                {/* Dues */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-right">
                  <span className="text-[10px] font-bold text-rose-600 block">المستحقات المعلقة</span>
                  <span className="text-xl font-extrabold text-rose-600 block mt-1 tracking-tight">
                    {totalOutstandingDues.toLocaleString()} <span className="text-[10px] font-bold">{currency}</span>
                  </span>
                </div>

              </div>
            </div>

            {/* Analysis Note */}
            <div className="bg-blue-50/50 border border-blue-150 rounded-2xl p-4 text-right space-y-1">
              <span className="text-xs font-black text-blue-800 block flex items-center gap-1.5 justify-end">
                <span>توجيهات وتحليل الأداء العام للتقرير</span>
                <CheckCircle size={14} className="text-blue-600" />
              </span>
              <p className="text-[10.5px] text-slate-600 leading-relaxed font-semibold">
                عقد الطالب بمختلف الفترات يسير بنسبة تحصيل مالي تبلغ <span className="text-blue-700 font-extrabold">{totalIncome > 0 ? Math.round((totalPayments / totalIncome) * 100) : 100}%</span> من إجمالي الدخل الكلي المحدد. يرجى توجيه وإرسال تنبيهات السداد والمطالبات للطلاب الذين يندرج تحت حسابهم متبقي مستحقات لسرعة التحصيل وتغذية الميزانية العامة للمركز.
              </p>
            </div>

            {/* Graphical representation of financial performance */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5">
              <p className="text-[11px] font-black text-slate-600 flex items-center gap-1 justify-end">
                <span>📊 التمثيل البياني لهيكل الأداء المالي للفترة</span>
              </p>
              
              <div className="flex gap-4 items-end justify-center h-24 px-6 pt-2">
                {/* Expected Income Bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full relative">
                  <div className="w-full bg-slate-250/30 bg-slate-200 rounded-t-lg h-14 relative flex items-end">
                    <div className="bg-blue-600 w-full rounded-t-lg transition-all duration-500" style={{ height: '100%' }}>
                      <div className="absolute top-[-16px] left-0 right-0 text-center font-mono text-[9px] font-black text-blue-700">
                        {totalIncome.toLocaleString()} {currency}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-center text-[10px] font-black text-blue-800">
                    الدخل الكلي المتوقع
                  </div>
                </div>

                {/* Collected Payments Bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full relative">
                  <div className="w-full bg-slate-250/30 bg-slate-200 rounded-t-lg h-14 relative flex items-end">
                    <div className="bg-emerald-600 w-full rounded-t-lg transition-all duration-500" style={{ height: `${totalIncome > 0 ? Math.min(100, (totalPayments / totalIncome) * 100) : 100}%` }}>
                      <div className="absolute top-[-16px] left-0 right-0 text-center font-mono text-[9px] font-black text-emerald-700">
                        {totalPayments.toLocaleString()} {currency}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-center text-[10px] font-black text-emerald-800">
                    المدفوع الفعلي ({totalIncome > 0 ? Math.round((totalPayments / totalIncome) * 100) : 100}%)
                  </div>
                </div>

                {/* Outstanding Dues Bar */}
                <div className="flex-1 flex flex-col items-center justify-end h-full relative">
                  <div className="w-full bg-slate-250/30 bg-slate-200 rounded-t-lg h-14 relative flex items-end">
                    <div className="bg-rose-600 w-full rounded-t-lg transition-all duration-500" style={{ height: `${totalIncome > 0 ? Math.min(100, (totalOutstandingDues / totalIncome) * 100) : 0}%` }}>
                      <div className="absolute top-[-16px] left-0 right-0 text-center font-mono text-[9px] font-black text-rose-700">
                        {totalOutstandingDues.toLocaleString()} {currency}
                      </div>
                    </div>
                  </div>
                  <div className="mt-1.5 text-center text-[10px] font-black text-rose-800">
                    المستحقات المتبقية
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Table for PDF - Designed with compact padding to fit exactly 1 page */}
            <div>
              <p className="text-xs font-black text-slate-500 mb-2 block">تفاصيل حسابات الطلبة المنجزة للفترة:</p>
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-right text-[10px]">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">اسم الطالب المقيد</th>
                      <th className="py-2.5 px-3 text-center">النظام</th>
                      <th className="py-2.5 px-3 text-center">عدد الحصص</th>
                      <th className="py-2.5 px-3 text-blue-600">إجمالي المستحق</th>
                      <th className="py-2.5 px-3 text-emerald-600">المسدد الفعلي</th>
                      <th className="py-2.5 px-3 text-rose-600">المتبقي المطلوب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                    {reportBreakdown.slice(0, 9).map((item) => ( // Show top 9 items to safely maintain A4 single sheet boundary with graph
                      <tr key={item.studentId + '_pdf'}>
                        <td className="py-2 px-3 font-extrabold text-slate-900">{item.studentName}</td>
                        <td className="py-2 px-3 text-center">
                          {item.studentType === 'lesson' ? 'حصص فردية' : 'اشتراك كورس'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">{item.sessionsCount}</td>
                        <td className="py-2 px-3 font-mono text-slate-800">{item.income} {currency}</td>
                        <td className="py-2 px-3 font-mono text-slate-800">{item.paid} {currency}</td>
                        <td className="py-2 px-3 font-mono text-slate-900">
                          {item.dues > 0 ? `${item.dues} ${currency}` : 'مسدد بالكامل'}
                        </td>
                      </tr>
                    ))}
                    {reportBreakdown.length > 9 && (
                      <tr>
                        <td colSpan={6} className="py-2 px-3 text-center text-slate-455 font-bold italic bg-slate-50 leading-none">
                          * تم إظهار أول ٩ طلاب فقط لبيانات التوافق الحجمي للورقة الواحدة. يرجى استخدام شاشة العرض لرؤية القائمة الإجمالية.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Footer of A4 single page */}
          <div className="border-t pt-5 border-slate-200 mt-6 flex justify-between items-end text-right">
            <div>
              <p className="text-[10px] text-slate-500 font-extrabold">توقيع المعلم المشرف:</p>
              <div className="h-10 w-36 border-b border-dashed border-slate-300 mt-2" />
            </div>
            
            <div className="text-left text-[9px] text-slate-400 font-black space-y-0.5">
              <p>مستخرج إلكترونياً ولا يحتاج إلى ختم مادي</p>
              <p>نظام الحصص الذكي لإدارة شؤون الطلاب والمجموعات</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
