import React, { useState } from 'react';
import { Student, TeacherPreferences, EarnedBadge } from '../types';
import { BADGE_RULES, BadgeRule } from '../lib/rewardsHelper';
import { 
  Award, Target, GraduationCap, Sparkles, Trophy, BookOpen, 
  Search, Users, Check, Gift, Zap, TrendingUp, ChevronLeft, Star
} from 'lucide-react';

interface RewardsDashboardProps {
  students: Student[];
  preferences: TeacherPreferences;
  onUpdateStudent: (id: string, updatedFields: Partial<Student>) => void;
  onSelectStudent: (id: string | null) => void;
  onSwitchTab: (tab: 'students') => void;
}

export default function RewardsDashboard({
  students,
  preferences,
  onUpdateStudent,
  onSelectStudent,
  onSwitchTab
}: RewardsDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBadgeFilter, setSelectedBadgeFilter] = useState<string | null>(null);
  
  // Quick manual points award
  const [quickStudentId, setQuickStudentId] = useState('');
  const [quickPoints, setQuickPoints] = useState('');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickSuccess, setQuickSuccess] = useState('');

  // 1. Calculate overall stats
  const totalPoints = students.reduce((sum, s) => sum + (s.rewardPoints || 0), 0);
  const totalBadgesEarned = students.reduce((sum, s) => sum + (s.earnedBadges?.length || 0), 0);
  
  const studentWithMostPoints = students.length > 0 
    ? [...students].sort((a, b) => (b.rewardPoints || 0) - (a.rewardPoints || 0))[0]
    : null;

  const totalLessonsAll = students.reduce((sum, s) => sum + s.sessions.length, 0);
  const avgLessonsPerStudent = students.length > 0 ? (totalLessonsAll / students.length).toFixed(1) : '0';

  // Helper to determine the next target milestone for a student
  const getNextMilestoneProgress = (student: Student) => {
    const completedCount = student.sessions.length;
    const earnedBadgeIds = new Set((student.earnedBadges || []).map(b => b.id));
    
    // Find first rule of type 'lessons' that is NOT yet earned
    const nextLessonRule = BADGE_RULES.find(r => r.type === 'lessons' && completedCount < r.count);
    
    if (nextLessonRule) {
      const prevRuleCount = BADGE_RULES
        .filter(r => r.type === 'lessons' && r.count < nextLessonRule.count)
        .reduce((max, r) => Math.max(max, r.count), 0);

      const targetCount = nextLessonRule.count;
      const currentProgress = completedCount;
      const percentage = Math.min(100, Math.max(0, Math.round(((currentProgress) / targetCount) * 100)));

      return {
        rule: nextLessonRule,
        percentage,
        completedCount,
        targetCount,
        label: `المستهدف قريباً: إتمام الحصة ${targetCount}`,
        isFinished: false
      };
    }

    // If all lesson rules are satisfied, look at course completeness
    if (student.type === 'course' && student.totalLessonsCount) {
      const isCourseBadgeEarned = earnedBadgeIds.has('badge-course-complete');
      if (!isCourseBadgeEarned) {
        const percentage = Math.min(100, Math.max(0, Math.round((completedCount / student.totalLessonsCount) * 100)));
        const courseRule = BADGE_RULES.find(r => r.type === 'course_complete');
        return {
          rule: courseRule || { id: 'badge-course-complete', name: 'قاهر المناهج 📚', points: 200 } as any,
          percentage,
          completedCount,
          targetCount: student.totalLessonsCount,
          label: `مستهدف الباقة: إتمام الكورس (${completedCount}/${student.totalLessonsCount})`,
          isFinished: false
        };
      }
    }

    return {
      rule: null,
      percentage: 100,
      completedCount,
      targetCount: completedCount,
      label: '🏆 حصد جميع الأوسمة الحالية! بطل أسطوري',
      isFinished: true
    };
  };

  // Helper to resolve Badge Icon corresponding Lucide component
  const getBadgeIcon = (iconName: string, className = "text-amber-500") => {
    switch(iconName) {
      case 'Award': return <Award className={className} size={15} />;
      case 'Target': return <Target className={className} size={15} />;
      case 'GraduationCap': return <GraduationCap className={className} size={15} />;
      case 'Sparkles': return <Sparkles className={className} size={15} />;
      case 'Trophy': return <Trophy className={className} size={15} />;
      case 'BookOpen': return <BookOpen className={className} size={15} />;
      default: return <Star className={className} size={15} />;
    }
  };

  // 2. Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          student.phone.includes(searchQuery);
    
    if (selectedBadgeFilter) {
      const hasBadge = (student.earnedBadges || []).some(b => b.id === selectedBadgeFilter);
      return matchesSearch && hasBadge;
    }
    
    return matchesSearch;
  });

  // Handle Quick Points update
  const handleQuickPointsAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickStudentId || !quickPoints) return;
    
    const pts = parseInt(quickPoints);
    if (isNaN(pts)) return;

    const targetStudent = students.find(s => s.id === quickStudentId);
    if (!targetStudent) return;

    const currentPoints = targetStudent.rewardPoints || 0;
    const newPoints = Math.max(0, currentPoints + pts);
    const reasonDesc = quickNotes.trim() || (pts >= 0 ? 'نقاط متميزة من المعلم' : 'تعديل نقاط يدوي من لوحة التحكم');

    const newTx = {
      id: `quick_earn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: (pts >= 0 ? 'earn' : 'redeem') as 'earn' | 'redeem',
      amount: Math.abs(pts),
      reason: 'manual' as const,
      description: `⭐ تعديل لوحة التحكم: ${reasonDesc}`,
      date: new Date().toISOString().split('T')[0]
    };

    onUpdateStudent(quickStudentId, {
      rewardPoints: newPoints,
      rewardTransactions: [newTx, ...(targetStudent.rewardTransactions || [])]
    });

    setQuickSuccess(`تم بنجاح تعديل رصيد الطالب "${targetStudent.name}" بقيمة ${pts >= 0 ? '+' : ''}${pts} نقطة!`);
    setQuickPoints('');
    setQuickNotes('');
    setTimeout(() => setQuickSuccess(''), 4000);
  };

  return (
    <div className="space-y-6 text-right font-sans">
      
      {/* Tab Header Banner */}
      <div className="relative rounded-3xl overflow-hidden shadow-lg bg-gradient-to-l from-slate-900 via-slate-950 to-slate-900 text-white p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.06),transparent_50%)] pointer-events-none" />
        <div className="z-10 flex items-center gap-4 sm:gap-6">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-2xl shrink-0">
            <Trophy size={36} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black">نظام مكافآت وأوسمة التفوق 🏆</h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 leading-relaxed max-w-xl">
              تتبع وإدارة مستويات تقدم الطلاب الأكاديمي، واكتسابهم للأوسمة والـ Badges المتميزة بشكل تلقائي بناءً على تفاعلهم وعدد الحصص والالتزام بالكورسات.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            onSelectStudent(null);
            onSwitchTab('students');
          }}
          className="z-10 self-stretch md:self-auto flex items-center justify-center gap-1.5 px-4.5 py-2.5 bg-gradient-to-l from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-500/10 hover:scale-[1.02] active:scale-98"
        >
          <span>تصفح قائمة الطلاب</span>
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Rewards System KPI Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wide">رصيد النقاط الكلي</span>
            <span className="text-2xl font-black text-slate-800 font-mono mt-0.5 block">
              {totalPoints} ✨
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-1 block">رصيد نشط متوفر للاستبدال</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Gift size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wide">الحصائل وأوسمة الشرف</span>
            <span className="text-2xl font-black text-slate-800 font-mono mt-0.5 block">
              {totalBadgesEarned} 🏅
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-1 block">رقم قياسي تم منحه للطلاب</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <Trophy size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wide">الطالب الأكثر تفوقاً</span>
            <span className="text-sm font-black text-slate-800 mt-1 block truncate max-w-[150px]">
              {studentWithMostPoints ? studentWithMostPoints.name : 'لا يوجد طلاب'}
            </span>
            <span className="text-[10px] text-amber-600 font-bold block">
              {studentWithMostPoints ? `${studentWithMostPoints.rewardPoints || 0} نقطة` : '—'}
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-500 rounded-xl">
            <Star size={20} className="fill-amber-405 fill-current animate-spin-slow" />
          </div>
        </div>

        <div className="bg-white border border-slate-150 rounded-2xl p-5 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-black block uppercase tracking-wide">متوسط تفاعل حضور الطلاب</span>
            <span className="text-2xl font-black text-slate-800 font-mono mt-0.5 block">
              {avgLessonsPerStudent} حصة
            </span>
            <span className="text-[10px] text-slate-500 font-medium mt-1 block">لكل طالب بالمنصة</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <TrendingUp size={20} />
          </div>
        </div>

      </div>

      {/* Main content Split layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* RIGHT COLUMN: Milestones Rules and Achievement stats */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Rules and criteria */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                <Target size={16} className="text-indigo-600" />
                <span>دليل مستويات الأوسمة والنقاط</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium mt-1 leading-relaxed">
                يتم تقصي كفاءة الطالب ومكافأته تلقائياً بالبادج والعملات المقابلة بمجرد تجاوزه الأهداف:
              </p>
            </div>

            <div className="space-y-4">
              {BADGE_RULES.map((rule) => {
                const countAchieved = students.filter(s => 
                  (s.earnedBadges || []).some(b => b.id === rule.id)
                ).length;

                const isSelected = selectedBadgeFilter === rule.id;

                return (
                  <div 
                    key={rule.id}
                    onClick={() => setSelectedBadgeFilter(isSelected ? null : rule.id)}
                    className={`p-3 rounded-2xl border transition-all text-right cursor-pointer relative group ${
                      isSelected 
                        ? 'bg-amber-50/50 border-amber-300 ring-2 ring-amber-400/10' 
                        : 'bg-slate-50/45 border-slate-150 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`p-2 rounded-xl text-xs shrink-0 ${
                        isSelected ? 'bg-amber-100 text-amber-600' : 'bg-white text-slate-650 shadow-2xs group-hover:bg-amber-50'
                      }`}>
                        {getBadgeIcon(rule.icon, isSelected ? "text-amber-600 font-black animate-bounce" : "text-slate-500")}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <h4 className="text-xs font-black text-slate-850">{rule.name}</h4>
                          <span className="text-[9px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-black">
                            +{rule.points} نقطة
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                          {rule.description}
                        </p>
                        
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-200/50 text-[9px] text-slate-400 font-extrabold font-mono">
                          <span>طريقة المكافأة: تلقائيّة</span>
                          <span className={`px-2 py-0.5 rounded-full ${countAchieved > 0 ? 'bg-emerald-50 text-emerald-700 font-black' : 'bg-slate-100 text-slate-500'}`}>
                            حققها {countAchieved} طلاب {countAchieved > 0 && '🎖️'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedBadgeFilter && (
              <button
                onClick={() => setSelectedBadgeFilter(null)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-250 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>إزالة فلترة الأوسمة</span>
                <span className="text-[10px] bg-slate-250 text-slate-800 px-1.5 py-0.2 rounded font-black font-sans">🔄</span>
              </button>
            )}
          </div>

          {/* Quick Point Adjuster */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm font-sans space-y-4">
            <div className="border-b border-slate-100 pb-2.5">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Zap size={14} className="text-amber-500 animate-pulse" />
                <span>الكونسول السريع لتعديل النقاط</span>
              </h3>
              <p className="text-[11px] text-slate-400 font-medium">مكافأة أو تعديل طارئ لنقاط الطالب دون مغادرة هذه الصفحة</p>
            </div>

            {quickSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-100 rounded-xl text-xs font-semibold leading-relaxed animate-in fade-in duration-200">
                {quickSuccess}
              </div>
            )}

            <form onSubmit={handleQuickPointsAward} className="space-y-3.5 text-right">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500">اختر الطالب المستهدف *</label>
                <select
                  required
                  value={quickStudentId}
                  onChange={(e) => setQuickStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- اختر من القائمة --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.rewardPoints || 0} نقطة)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-1">
                  <label className="text-[10px] font-bold text-slate-500">النقاط *</label>
                  <input
                    type="number"
                    required
                    placeholder="مثل: 20 أو -10"
                    value={quickPoints}
                    onChange={(e) => setQuickPoints(e.target.value)}
                    className="w-full px-2 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-black text-center font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="col-span-2 space-y-1 block">
                  <label className="text-[10px] font-bold text-slate-500">السبب أو نوع المجهود</label>
                  <input
                    type="text"
                    placeholder="مثال: الإجابة النموذجية بالاختبار العلمي"
                    value={quickNotes}
                    onChange={(e) => setQuickNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!quickStudentId || !quickPoints}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black cursor-pointer transition-all disabled:opacity-45 disabled:cursor-not-allowed shadow-md shadow-slate-950/5 hover:scale-[1.01] active:scale-99"
              >
                تطبيق وحفظ التعديل الفوري ✨
              </button>
            </form>
          </div>

        </div>

        {/* LEFT COLUMN: Student search and detailed progress trackers */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Filtering Header controls */}
          <div className="bg-white border border-slate-150 p-4 rounded-3xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shadow-2xs">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-450 pointer-events-none">
                <Search size={15} />
              </span>
              <input
                type="text"
                placeholder="ابحث عن الطالب بالاسم أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-700 text-xs font-semibold font-sans"
                >
                  مسح 🔄
                </button>
              )}
            </div>

            {/* Filter Pill indication */}
            {selectedBadgeFilter && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 text-[11px] text-amber-800 font-extrabold flex items-center gap-1.5 shrink-0 self-center">
                <span>تصفية: الحاصلين على وسام {BADGE_RULES.find(r => r.id === selectedBadgeFilter)?.name}</span>
                <button 
                  onClick={() => setSelectedBadgeFilter(null)} 
                  className="text-amber-600 hover:text-amber-850 font-black cursor-pointer text-[10px]"
                >
                  ✖
                </button>
              </div>
            )}
            
            <div className="text-[11px] text-slate-400 font-extrabold font-mono text-left shrink-0 self-center">
              تم العثور على <strong className="text-slate-800 font-black font-sans text-xs">{filteredStudents.length}</strong> طالب
            </div>
          </div>

          {/* Grid of students card trackers */}
          {filteredStudents.length === 0 ? (
            <div className="text-center py-20 bg-white border border-slate-200 rounded-3xl shadow-xs">
              <Trophy size={42} className="mx-auto text-slate-350 mb-3" />
              <p className="text-slate-600 text-base font-black">لا توجد نتائج مطابقة لفلترة المكافآت</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-2 leading-relaxed">
                تأكد من خلو خانة البحث من أخطاء إملائية أو جرب كتابة اسم مختلف، أو قم بإلغاء فلترة فئات الأوسمة المختارة.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredStudents.map((student) => {
                const nextMilestone = getNextMilestoneProgress(student);
                const earnedBadgesCount = student.earnedBadges?.length || 0;
                
                return (
                  <div
                    key={student.id}
                    className="p-5 sm:p-6 bg-white border border-slate-150 hover:border-amber-300 rounded-3xl transition-all duration-300 shadow-3xs hover:shadow-2xs text-right relative overflow-hidden group"
                  >
                    {/* Background glows */}
                    <div className="absolute top-0 left-0 w-24 h-24 bg-amber-500/3 rounded-full blur-2xl pointer-events-none" />
                    
                    {/* Core row info layout */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3.5">
                        {student.photo ? (
                          <img
                            src={student.photo}
                            alt={student.name}
                            className="w-13 h-13 rounded-2xl object-cover border-2 border-slate-100 shadow-3xs"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-13 h-13 rounded-2xl bg-indigo-50 text-indigo-600 text-lg flex items-center justify-center font-black border border-indigo-150/50">
                            {student.name.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-indigo-900 transition-colors">
                              {student.name}
                            </h3>
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-extrabold px-2 py-0.5 rounded-md font-mono">
                              ID: {student.id}
                            </span>
                          </div>
                          
                          <p className="text-[10px] sm:text-xs text-slate-450 font-bold mt-1 tracking-wide flex items-center gap-1">
                            <span>النظام: {student.type === 'course' ? 'باقة شهرية' : 'محاسبة بالحصّة'}</span>
                            <span className="text-slate-300">•</span>
                            <span>إجمالي حضور: {student.sessions.length} حصص</span>
                          </p>
                        </div>
                      </div>

                      {/* Right points and total badges pill */}
                      <div className="flex items-center gap-2.5 self-start sm:self-center">
                        <div className="bg-gradient-to-tr from-amber-50 to-orange-50 border border-amber-205 rounded-2xl px-4 py-2 text-center select-none shrink-0 min-w-[75px]">
                          <span className="text-[9px] text-amber-705 font-black uppercase tracking-wider block">رصيد النقاط</span>
                          <span className="text-base font-black font-mono text-amber-600">{student.rewardPoints || 0}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2 text-center select-none shrink-0 min-w-[75px]">
                          <span className="text-[9px] text-slate-450 font-black uppercase tracking-wider block">الأوسمة</span>
                          <span className="text-base font-black font-mono text-indigo-700">{earnedBadgesCount} 🏅</span>
                        </div>
                      </div>
                    </div>

                    {/* Progress tracking towards the next milestone */}
                    <div className="p-4 bg-slate-50/70 border border-slate-150 rounded-2xl space-y-2.5 font-sans mb-4">
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="text-slate-800 font-black flex items-center gap-1">
                          <Star size={12} className="text-amber-500 animate-spin-slow" />
                          <span>{nextMilestone.label}</span>
                        </span>
                        <span className={`font-mono font-black ${nextMilestone.isFinished ? 'text-amber-600' : 'text-slate-500'}`}>
                          {nextMilestone.percentage}% {nextMilestone.isFinished ? '✨ مكتمل' : ''}
                        </span>
                      </div>
                      
                      {/* Bar indicator */}
                      <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden flex flex-row-reverse relative">
                        <div 
                          className="bg-gradient-to-l from-amber-450 to-amber-600 h-full rounded-full transition-all duration-500"
                          style={{ width: `${nextMilestone.percentage}%` }}
                        />
                      </div>
                      
                      {/* Next badge info if any */}
                      {nextMilestone.rule && (
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold pt-1">
                          <span>المستهدف: {nextMilestone.rule.name}</span>
                          <span>المكافأة: +{nextMilestone.rule.points} نقطة تشجيعية مجانية</span>
                        </div>
                      )}
                    </div>

                    {/* Earned badges catalog list wrapping */}
                    <div className="flex items-center justify-between gap-4 flex-wrap pt-3.5 border-t border-slate-150 bg-white">
                      <div className="flex-1 text-right">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2">الأوسمة الحالية المكتسبة:</span>
                        {(!student.earnedBadges || student.earnedBadges.length === 0) ? (
                          <span className="text-[10px] text-slate-400/80 font-serif italic mt-1 block">لم يحرز هذا الطالب أي أوسام شرف رسمية بعد...</span>
                        ) : (
                          <div className="flex flex-wrap gap-2 justify-start">
                            {student.earnedBadges.map((badge) => (
                              <div
                                key={badge.id}
                                className="flex items-center gap-1.5 bg-indigo-50/50 hover:bg-indigo-50 border border-indigo-100 rounded-xl px-2.5 py-1 text-[10px] text-indigo-950 font-black transition-all cursor-help"
                                title={`اكتسبت في تاريخ ${badge.earnedDate} | مكافأة ${badge.pointsAwarded} نقطة`}
                              >
                                {getBadgeIcon(badge.icon, "text-indigo-600 shrink-0")}
                                <span>{badge.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Launch details modal switch */}
                      <div className="shrink-0 self-end">
                        <button
                          onClick={() => {
                            onSelectStudent(student.id);
                            onSwitchTab('students');
                          }}
                          className="px-4 py-2 text-[10px] font-black text-white bg-slate-900 hover:bg-slate-850 rounded-xl transition-all cursor-pointer flex items-center gap-1 select-none"
                        >
                          <span>إدارة سجلات المكافآت 🎁</span>
                          <ChevronLeft size={11} />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
