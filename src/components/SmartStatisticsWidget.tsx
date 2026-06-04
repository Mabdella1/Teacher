import React, { useMemo } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend, 
  PieChart, 
  Pie, 
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Coins, 
  BarChart3, 
  Activity, 
  Award, 
  CheckCircle2, 
  Wallet, 
  CalendarDays,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import { Student, TeacherPreferences } from '../types';

interface SmartStatisticsWidgetProps {
  student: Student;
  preferences: TeacherPreferences;
}

export default function SmartStatisticsWidget({ student, preferences }: SmartStatisticsWidgetProps) {
  const currency = preferences.currency || 'ج.م';

  // 1. Calculations
  const calculations = useMemo(() => {
    const totalPaid = student.payments.reduce((sum, p) => sum + p.amount, 0);
    const normalSessions = student.sessions.filter(s => !s.isExtra);
    const extraSessions = student.sessions.filter(s => s.isExtra);
    
    // Sessions and Cost
    const totalSessions = student.sessions.length;
    let totalCost = 0;
    const sessionCost = student.lessonRate || (student.coursePrice && student.totalLessonsCount ? (student.coursePrice / student.totalLessonsCount) : 0) || 100;

    if (student.type === 'course') {
      const coursePrice = student.coursePrice || 0;
      const extraCost = extraSessions.reduce((sum, s) => sum + (s.extraPrice || sessionCost), 0);
      totalCost = coursePrice + extraCost;
    } else {
      totalCost = normalSessions.length * sessionCost + extraSessions.reduce((sum, s) => sum + (s.extraPrice || sessionCost), 0);
    }

    const outstandingBalance = Math.max(0, totalCost - totalPaid);
    
    // Progress calculation
    const attendanceProgress = student.type === 'course' && student.totalLessonsCount 
      ? Math.round((normalSessions.length / student.totalLessonsCount) * 100)
      : student.sessions.length > 0 ? 100 : 0;

    return {
      totalPaid,
      totalCost,
      outstandingBalance,
      normalSessions,
      extraSessions,
      totalSessions,
      sessionCost,
      attendanceProgress
    };
  }, [student, preferences]);

  // 2. Timeline Chart Data (Sessions over time showing Cumulative value)
  const timelineData = useMemo(() => {
    if (!student.sessions || student.sessions.length === 0) return [];
    
    // Sort standard sessions oldest first to map timeline progression
    const sortedSessions = [...student.sessions].sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    let cumulativeCount = 0;
    return sortedSessions.map((session, index) => {
      cumulativeCount += 1;
      return {
        key: index + 1,
        date: session.date,
        count: cumulativeCount,
        numStr: `حصة ${cumulativeCount}`,
        notes: session.notes || ''
      };
    });
  }, [student.sessions]);

  // 3. Financial breakdown chart (Payments compared over timeline months, or Paid vs Unpaid Pie Chart)
  const financialPieData = useMemo(() => {
    return [
      { name: 'المدفوع الفعلي', value: calculations.totalPaid, color: '#10b981' },
      { name: 'المتبقي المستحق', value: calculations.outstandingBalance, color: '#f59e0b' }
    ].filter(item => item.value > 0);
  }, [calculations.totalPaid, calculations.outstandingBalance]);

  // 4. Study Notes classification for visual statistics (Academic / Sلوك / واجبات)
  const feedbackData = useMemo(() => {
    const notes = student.studyNotes || [];
    const counts = {
      academic: 0,
      behavior: 0,
      homework: 0,
      exam: 0,
      general: 0
    };

    notes.forEach(note => {
      if (counts[note.type] !== undefined) {
        counts[note.type] += 1;
      } else {
        counts.general += 1;
      }
    });

    return [
      { name: 'أكاديمي 📚', count: counts.academic, color: '#4f46e5' },
      { name: 'سلوكي ⭐', count: counts.behavior, color: '#10b981' },
      { name: 'الواجبات 📝', count: counts.homework, color: '#0ea5e9' },
      { name: 'امتحانات 📈', count: counts.exam, color: '#f59e0b' },
      { name: 'عامة 📢', count: counts.general, color: '#a855f7' }
    ].filter(item => item.count > 0);
  }, [student.studyNotes]);

  // Check if any statistics exist
  const hasData = student.sessions.length > 0 || student.payments.length > 0 || student.studyNotes?.length;

  if (!hasData) {
    return (
      <div id="smart-stats-empty" className="bg-white border border-slate-100 rounded-3xl p-8 text-center space-y-4 shadow-sm text-right" dir="rtl">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 text-3xl">
          📈
        </div>
        <div>
          <h4 className="text-base font-black text-slate-900">لوحة الإحصاءات والتحليل الذكي جاهزة</h4>
          <p className="text-xs text-slate-550 max-w-lg mx-auto leading-relaxed mt-1">
            سيقوم البرنامج بتحليل وتوليد الإحصاءات والرسوم البيانية المتقدمة لحضور الطالب، مدفوعاته المالية المتراكمة وتقاويم التحصيل الدراسي بمجرد البدء في تسجيل الحصص الأولى أو تحصيل الأقساط.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="smart-statistics-widget" className="space-y-6 text-right" dir="rtl">
      
      {/* Visual Counters bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Attendance Rate */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-50 text-indigo-700 shrink-0">
            <Activity size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-400 font-extrabold block">قوة الالتزام والحضور</span>
            <span className="text-lg font-black text-slate-900 block mt-0.5">
              {calculations.totalSessions} حصص
            </span>
            <span className="text-[9px] text-indigo-600 font-bold block mt-0.5">
              منها {calculations.extraSessions.length} إضافية
            </span>
          </div>
        </div>

        {/* Financial Collection */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-400 font-extrabold block">تم سداده وتصفيته</span>
            <span className="text-lg font-black text-emerald-700 block mt-0.5">
              {calculations.totalPaid} {currency}
            </span>
            <span className="text-[9px] text-slate-500 font-bold block mt-0.5">
              من أصل ميزانية {calculations.totalCost} {currency}
            </span>
          </div>
        </div>

        {/* Outstanding Unpay */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-700 shrink-0">
            <Wallet size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-400 font-extrabold block">المستحقات الباقية</span>
            <span className={`text-lg font-black block mt-0.5 ${calculations.outstandingBalance > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>
              {calculations.outstandingBalance} {currency}
            </span>
            <span className="text-[9px] text-slate-500 font-bold block mt-0.5">
              {calculations.outstandingBalance === 0 ? 'تسوية مالية كاملة ومثالية ✨' : 'بانتظار التحصيل'}
            </span>
          </div>
        </div>

        {/* Loyalty score */}
        <div className="bg-white border border-slate-100 rounded-2xl p-4.5 shadow-xs relative overflow-hidden flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-100 text-amber-700 shrink-0">
            <Award size={22} className="animate-pulse" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] text-slate-400 font-extrabold block">نقاط التحصيل والذهبية</span>
            <span className="text-lg font-black text-amber-700 block mt-0.5">
              {student.rewardPoints || 0} نقطة
            </span>
            <span className="text-[9px] text-slate-500 font-bold block mt-0.5 flex items-center gap-0.5">
              <Sparkles size={10} className="text-amber-500" /> بانتظار استبدال المكافأة
            </span>
          </div>
        </div>

      </div>

      {/* Main Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 1. Timeline Chart (Sessions Progression over dates) */}
        {timelineData.length > 0 && (
          <div className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-sm lg:col-span-8 flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-slate-50 mb-4 select-none">
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-650" /> مؤشر النمو التراكمي وجدول الحضور 📈
                </h4>
                <p className="text-[10px] text-slate-450 mt-0.5">منحنى بياني يوضح وتيرة نمو حضور الطالب وجديته المنهجية</p>
              </div>
              <span className="text-[10px] bg-indigo-50 border border-indigo-150 text-indigo-700 px-2 py-0.5 rounded-lg font-black">
                التردد المخطط
              </span>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-[260px] w-full font-mono text-xs" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timelineData}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    tickLine={false}
                    fontSize={10}
                    dy={10}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    tickLine={false}
                    fontSize={10}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-2xl border border-slate-800 text-right font-sans text-xs shadow-xl space-y-1">
                            <p className="font-extrabold text-[#818cf8]">{data.numStr}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">تاريخ الانعقاد: <span className="font-mono text-slate-200">{data.date}</span></p>
                            {data.notes && (
                              <p className="text-[10px] bg-slate-850 p-1.5 rounded-lg border border-slate-800 text-slate-300">
                                📝 {data.notes}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#4f46e5" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorCount)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 2. Financial Balance Pie Chart / Donut Chart */}
        <div className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-sm lg:col-span-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-slate-50 mb-4 select-none">
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Coins size={16} className="text-emerald-600" /> الهيكل المالي وموازنة الحساب 💰
              </h4>
              <p className="text-[10px] text-slate-455 mt-0.5">نسب المبالغ المسددة والمستحقة على الطالب من التكلفة الكلية</p>
            </div>
          </div>

          {financialPieData.length > 0 ? (
            <div className="space-y-4">
              <div className="h-[180px] w-full flex items-center justify-center" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={financialPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {financialPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-right font-sans text-[11px] shadow-lg">
                              <span className="font-extrabold" style={{ color: data.color }}>{data.name}: </span>
                              <span className="font-black font-mono text-slate-200">{data.value} {currency}</span>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legends explanation */}
              <div className="grid grid-cols-2 gap-2 text-center text-[10px] font-bold select-none">
                <div className="bg-emerald-50 text-emerald-800 p-2 border border-emerald-100 rounded-xl">
                  <span className="block text-slate-500 font-semibold mb-0.5">تم سداده</span>
                  <p className="text-xs font-black">{calculations.totalPaid} {currency}</p>
                </div>
                <div className={calculations.outstandingBalance > 0 ? "bg-amber-50 text-amber-800 p-2 border border-amber-100 rounded-xl" : "bg-slate-50 text-slate-400 p-2 border border-slate-100 rounded-xl"}>
                  <span className="block text-slate-500 font-semibold mb-0.5">متبقي مستحق</span>
                  <p className="text-xs font-black">{calculations.outstandingBalance} {currency}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-10 text-center select-none text-slate-400 text-xs">
              لا توجد مدفوعات مسجلة لإجراء التقرير المالي الدائري.
            </div>
          )}
        </div>

      </div>

      {/* 3. Feedback Notes breakdown & Recommendations for Academic Advisor */}
      {feedbackData.length > 0 && (
        <div className="bg-white border border-slate-100 rounded-3xl p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-50 mb-5 select-none">
            <div>
              <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-600" /> تحليل مجالات تقييم الأستاذ للمستويات 🎓
              </h4>
              <p className="text-[10px] text-slate-450 mt-0.5">تدرج وتكرار تعليقات وملاحظات الأستاذ السلوكية والأكاديمية لتحديد محاور التميز</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Horizontal Bar Chart showing frequency */}
            <div className="h-[200px] w-full font-mono text-xs" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={feedbackData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" tickLine={false} fontSize={10} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="#475569" tickLine={false} fontSize={11} width={80} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white px-3 py-1.5 rounded-xl text-right font-sans text-xs">
                            <span className="font-extrabold">{data.name}: </span>
                            <span className="font-black font-mono">{data.count} تقارير</span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={20}>
                    {feedbackData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Smart Automated Advising & Dynamic encouragement words */}
            <div className="space-y-4 text-slate-700 text-xs text-right bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
              <span className="bg-indigo-100 text-indigo-750 text-[10px] font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 w-fit">
                <ArrowUpRight size={13} /> إرشادات وتوصية المساعد الذكي للطالب
              </span>
              
              <div className="space-y-3 font-bold leading-relaxed">
                <p>
                  بناءً على تتبع كشكول الطالب المتميز وملاحظات الأستاذ، سجل تكراراً للمستويات التالية:
                </p>
                <ul className="list-inside list-disc space-y-1.5 text-slate-650 font-semibold pr-1">
                  <li>
                    لديك عدد <span className="font-black text-indigo-650">{feedbackData.find(f => f.name.includes('أكاديمي'))?.count || 0}</span> تقييمات أكاديمية تعكس تطورك المتزن في فهم المناهج المقررة.
                  </li>
                  <li>
                    حضور الواجبات المنزلية والمهام حقق <span className="font-black text-indigo-650">{feedbackData.find(f => f.name.includes('الواجبات'))?.count || 0}</span> مراجعات إيجابية، التزام كامل بالخطط.
                  </li>
                </ul>
                <div className="bg-indigo-650/5 p-3 rounded-xl border border-indigo-650/10 text-indigo-950 font-black text-xs leading-relaxed">
                  💡 <strong>نصيحة التفوق:</strong> تطلع دائماً للحصول على العلامة الكاملة ومراجعة النوتس السلوكية مع الأستاذ. نقاطك تنمو باستمرار، استبدلها برحلات ومكافآت التميز الكرنفالية!
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
