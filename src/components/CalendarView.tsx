import React, { useState } from 'react';
import { Student, Appointment, Session } from '../types';
import { 
  Calendar as CalendarIcon, ChevronRight, ChevronLeft, LayoutGrid, CalendarRange, 
  CalendarDays, User, Clock, Phone, FileText, CheckCircle, Info, ExternalLink, X, MessageSquare, Award, BookOpen, Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatTimeTo12h } from '../lib/timeUtils';

interface CalendarViewProps {
  students: Student[];
  appointments: Appointment[];
  onSelectStudent?: (studentId: string) => void;
}

interface CalendarEvent {
  id: string;
  time: string;
  title: string;
  eventType: 'appointment' | 'session';
  studentId: string;
  studentName: string;
  studentType: 'lesson' | 'course';
  notes?: string;
  sessionObj?: Session;
  dateStr: string;
}

const DAYS_OF_WEEK_AR = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const JS_TO_AR_DAY: Record<number, string> = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت'
};

const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function CalendarView({ students, appointments, onSelectStudent }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // Helper mapping JS day index (0=Sun, 1=Mon, ..., 6=Sat) to Saturday-first calendar column index (0-6)
  const getSaturdayFirstColIndex = (jsDay: number): number => {
    return (jsDay + 1) % 7;
  };

  // Build list of CalendarEvents for a given date
  const getEventsForDate = (dateObj: Date): CalendarEvent[] => {
    const dateStr = formatDateStr(dateObj);
    const arDayName = JS_TO_AR_DAY[dateObj.getDay()];
    const activeStudentIds = new Set(students.filter(s => s.active).map(s => s.id));
    
    const evs: CalendarEvent[] = [];
    
    // 1. Recurring weekly appointments matching this day of week OR exceptional appointments on this date
    appointments.forEach(app => {
      const matchesDayOfWeek = app.dayOfWeek === arDayName;
      const isMatch = app.isExceptional
        ? (app.date === dateStr)
        : (matchesDayOfWeek);

      if (isMatch && activeStudentIds.has(app.studentId)) {
        const student = students.find(s => s.id === app.studentId);
        if (student) {
          evs.push({
            id: `app-${app.id}-${dateStr}`,
            time: app.time,
            title: app.isExceptional ? `${app.studentName} (موعد استثنائي لمرة واحدة ⚡)` : `${app.studentName} (مجدول أسبوعي)`,
            eventType: 'appointment',
            studentId: app.studentId,
            studentName: app.studentName,
            studentType: student.type,
            notes: app.notes,
            dateStr
          });
        }
      }
    });
    
    // 2. Transcribed specific sessions matching this date
    students.forEach(student => {
      student.sessions.forEach(sess => {
        if (sess.date === dateStr) {
          evs.push({
            id: `sess-${sess.id}`,
            time: sess.time,
            title: `${student.name} (حصة مسجلة)`,
            eventType: 'session',
            studentId: student.id,
            studentName: student.name,
            studentType: student.type,
            notes: sess.notes,
            sessionObj: sess,
            dateStr
          });
        }
      });
    });
    
    // Sort chronologically by time string
    return evs.sort((a, b) => a.time.localeCompare(b.time));
  };

  // Month Math
  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const totalDaysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayColIndex = getSaturdayFirstColIndex(startOfMonth.getDay());

  const prevMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0);
  const totalDaysInPrevMonth = prevMonthDate.getDate();
  
  const prevMonthDays = Array.from({ length: firstDayColIndex }, (_, i) => {
    const dayNum = totalDaysInPrevMonth - firstDayColIndex + 1 + i;
    const year = prevMonthDate.getFullYear();
    const month = prevMonthDate.getMonth();
    const d = new Date(year, month, dayNum);
    return {
      dayNum,
      dateObj: d,
      isCurrentMonth: false,
      events: getEventsForDate(d)
    };
  });

  const currentMonthDays = Array.from({ length: totalDaysInMonth }, (_, i) => {
    const dayNum = i + 1;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const d = new Date(year, month, dayNum);
    return {
      dayNum,
      dateObj: d,
      isCurrentMonth: true,
      events: getEventsForDate(d)
    };
  });

  const cellsFetchedSoFar = prevMonthDays.length + currentMonthDays.length;
  const rem = cellsFetchedSoFar % 7;
  const trailingCellsNeeded = rem === 0 ? 0 : 7 - rem;
  
  const nextMonthDays = Array.from({ length: trailingCellsNeeded }, (_, i) => {
    const dayNum = i + 1;
    const year = currentDate.getMonth() === 11 ? currentDate.getFullYear() + 1 : currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1) % 12;
    const d = new Date(year, month, dayNum);
    return {
      dayNum,
      dateObj: d,
      isCurrentMonth: false,
      events: getEventsForDate(d)
    };
  });

  const allMonthCells = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // Week Math (starting Saturday)
  const getWeekDays = (focusDate: Date) => {
    const firstDayOfWeek = new Date(focusDate);
    const sub = (focusDate.getDay() + 1) % 7;
    firstDayOfWeek.setDate(focusDate.getDate() - sub);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(firstDayOfWeek);
      d.setDate(firstDayOfWeek.getDate() + i);
      return d;
    });
  };

  const weekDays = getWeekDays(currentDate);

  // Handle previous interval
  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else if (viewMode === 'week') {
      const prevWeek = new Date(currentDate);
      prevWeek.setDate(currentDate.getDate() - 7);
      setCurrentDate(prevWeek);
    } else {
      const prevDay = new Date(currentDate);
      prevDay.setDate(currentDate.getDate() - 1);
      setCurrentDate(prevDay);
    }
  };

  // Handle next interval
  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else if (viewMode === 'week') {
      const nextWeek = new Date(currentDate);
      nextWeek.setDate(currentDate.getDate() + 7);
      setCurrentDate(nextWeek);
    } else {
      const nextDay = new Date(currentDate);
      nextDay.setDate(currentDate.getDate() + 1);
      setCurrentDate(nextDay);
    }
  };

  // Return to Today
  const handleTodayEnv = () => {
    setCurrentDate(new Date());
  };

  // Generate WhatsApp Quick Chat Connection Link
  const getWhatsappLink = (phone: string, text: string) => {
    const cleaned = phone.replace(/[^\d+]/g, '');
    let finalPhone = cleaned;
    if (cleaned.startsWith('01') && cleaned.length === 11) {
      finalPhone = `+2${cleaned}`;
    } else if (!cleaned.startsWith('+') && cleaned.length === 10) {
      finalPhone = `+20${cleaned}`;
    }
    return `https://wa.me/${finalPhone.replace('+', '')}?text=${encodeURIComponent(text)}`;
  };

  const exportAllToICS = () => {
    const year = new Date().getFullYear();
    const icsLines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//TeacherApp//NONSGML Classes Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    const dayIndices: Record<string, number> = {
      'الأحد': 0,
      'الاثنين': 1,
      'الثلاثاء': 2,
      'الأربعاء': 3,
      'الخميس': 4,
      'الجمعة': 5,
      'السبت': 6
    };

    const dayToIcsRecurrence: Record<string, string> = {
      'الأحد': 'SU',
      'الاثنين': 'MO',
      'الثلاثاء': 'TU',
      'الأربعاء': 'WE',
      'الخميس': 'TH',
      'الجمعة': 'FR',
      'السبت': 'SA'
    };

    const activeStudentIds = new Set(students.filter(s => s.active).map(s => s.id));

    const sanitizeIcsText = (str: string) => {
      return str
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '');
    };

    const formatIcsDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const ss = String(d.getSeconds()).padStart(2, '0');
      return `${yyyy}${mm}${dd}T${hh}${min}${ss}`;
    };

    // 1. Process recurring appointments
    appointments.forEach(app => {
      if (!activeStudentIds.has(app.studentId)) return;
      const student = students.find(s => s.id === app.studentId);
      if (!student) return;

      const targetDayIdx = dayIndices[app.dayOfWeek] ?? 0;
      // Start of current year Jan 1st
      const startD = new Date(year, 0, 1);
      while (startD.getDay() !== targetDayIdx) {
        startD.setDate(startD.getDate() + 1);
      }

      // Set start time
      const [hStr, mStr] = app.time.split(':');
      const h = parseInt(hStr, 10) || 0;
      const m = parseInt(mStr, 10) || 0;
      startD.setHours(h, m, 0, 0);

      const endD = new Date(startD);
      endD.setHours(startD.getHours() + 1); // Default duration 1 hour

      const dstart = formatIcsDate(startD);
      const dend = formatIcsDate(endD);
      const dstamp = formatIcsDate(new Date());

      const icsDay = dayToIcsRecurrence[app.dayOfWeek] || 'MO';

      icsLines.push('BEGIN:VEVENT');
      icsLines.push(`UID:appt-${app.id}@teacherapp`);
      icsLines.push(`DTSTAMP:${dstamp}`);
      icsLines.push(`DTSTART:${dstart}`);
      icsLines.push(`DTEND:${dend}`);
      icsLines.push(`RRULE:FREQ=WEEKLY;BYDAY=${icsDay}`);
      icsLines.push(`SUMMARY:${sanitizeIcsText(`${app.studentName} - حصة اسبوعية`)}`);
      icsLines.push(`DESCRIPTION:${sanitizeIcsText(`موعد الحصة الأسبوعي المعتاد للطالب ${app.studentName} في يوم ${app.dayOfWeek} الساعة ${app.time}.${app.notes ? ' ملاحظة: ' + app.notes : ''}`)}`);
      icsLines.push('END:VEVENT');
    });

    // 2. Process non-recurring finished sessions
    students.forEach(student => {
      student.sessions.forEach(sess => {
        const [yStr, mStr, dStr] = sess.date.split('-');
        const [hStr, minStr] = sess.time.split(':');
        
        const sessDate = new Date(
          parseInt(yStr, 10),
          parseInt(mStr, 10) - 1,
          parseInt(dStr, 10),
          parseInt(hStr, 10) || 0,
          parseInt(minStr, 10) || 0
        );

        const endD = new Date(sessDate);
        endD.setHours(sessDate.getHours() + 1);

        const dstart = formatIcsDate(sessDate);
        const dend = formatIcsDate(endD);
        const dstamp = formatIcsDate(new Date());

        icsLines.push('BEGIN:VEVENT');
        icsLines.push(`UID:sess-${sess.id}@teacherapp`);
        icsLines.push(`DTSTAMP:${dstamp}`);
        icsLines.push(`DTSTART:${dstart}`);
        icsLines.push(`DTEND:${dend}`);
        icsLines.push(`SUMMARY:${sanitizeIcsText(`${student.name} - حصة مسجلة منجزة`)}`);
        icsLines.push(`DESCRIPTION:${sanitizeIcsText(`حصة فعلية مسجلة للطالب ${student.name} في تمام الساعة ${sess.time}.${sess.notes ? ' ملاحظة: ' + sess.notes : ''}`)}`);
        icsLines.push('END:VEVENT');
      });
    });

    icsLines.push('END:VCALENDAR');

    const icsString = icsLines.join('\r\n');
    const blob = new Blob([icsString], { type: 'text/calendar;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `جدول_حصص_الطلاب_TEACHER_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const matchedStudentObj = selectedEvent 
    ? students.find(s => s.id === selectedEvent.studentId)
    : null;

  return (
    <div className="space-y-6 text-right font-sans">
      {/* Upper Calendar Navigation Hub */}
      <div className="bg-white border border-slate-200/85 p-5 rounded-3xl shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Navigation buttons */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-150 p-1 rounded-2xl">
            <button 
              onClick={handleNext}
              className="p-2 hover:bg-white hover:text-blue-650 hover:shadow-3xs text-slate-600 rounded-xl transition-all cursor-pointer"
              title="التالي"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={handleTodayEnv}
              className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-800 text-xs font-black rounded-xl border border-slate-150 shadow-3xs hover:shadow-2xs active:scale-95 transition-all cursor-pointer"
            >
              اليوم
            </button>
            <button 
              onClick={handlePrev}
              className="p-2 hover:bg-white hover:text-blue-650 hover:shadow-3xs text-slate-600 rounded-xl transition-all cursor-pointer"
              title="السابق"
            >
              <ChevronLeft size={16} />
            </button>
          </div>

          <h3 className="text-base font-black text-slate-800 min-w-[130px] text-center font-sans tracking-tight">
            {viewMode === 'month' && (
              <span>{MONTHS_AR[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            )}
            {viewMode === 'week' && (
              <span className="text-xs sm:text-sm">
                من {weekDays[0].getDate()} {MONTHS_AR[weekDays[0].getMonth()]} إلى {weekDays[6].getDate()} {MONTHS_AR[weekDays[6].getMonth()]}
              </span>
            )}
            {viewMode === 'day' && (
              <span className="text-xs sm:text-sm">
                {JS_TO_AR_DAY[currentDate.getDay()]}، {currentDate.getDate()} {MONTHS_AR[currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
            )}
          </h3>
        </div>

        {/* Action Controls Group */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Mode Switcher pill buttons */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl gap-1 shrink-0 border border-slate-200/40">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === 'month' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              <LayoutGrid size={13} />
              <span>شهري</span>
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === 'week' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              <CalendarRange size={13} />
              <span>أسبوعي</span>
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                viewMode === 'day' 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/50'
              }`}
            >
              <CalendarDays size={13} />
              <span>يومي</span>
            </button>
          </div>

          {/* Export to ICS button */}
          <button
            onClick={exportAllToICS}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-3xs hover:shadow-2xs active:scale-95 transition-all cursor-pointer border border-transparent"
            title="تنزيل ملف التقويم لمزامنته مع Google Calendar أو Apple Calendar"
          >
            <Download size={13} />
            <span>تصدير للتقويم (ICS)</span>
          </button>
        </div>
      </div>

      {/* Main Core Views Panel */}
      <div className="bg-white border border-slate-200/85 rounded-3xl shadow-3xs overflow-hidden">
        {/* Month View Layout */}
        {viewMode === 'month' && (
          <div className="w-full">
            {/* Week header row starting Saturday */}
            <div className="grid grid-cols-7 border-b border-slate-150 text-slate-500 font-extrabold text-xs text-center py-3.5 bg-slate-50/50">
              {DAYS_OF_WEEK_AR.map(day => (
                <div key={day} className="truncate px-1">{day}</div>
              ))}
            </div>

            {/* Calendar Cells Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 divide-x-reverse min-h-[480px]">
              {allMonthCells.map((cell, idx) => {
                const todayFormatted = formatDateStr(new Date());
                const isToday = formatDateStr(cell.dateObj) === todayFormatted;
                
                return (
                  <div 
                    key={`${formatDateStr(cell.dateObj)}-${idx}`} 
                    className={`p-1.5 sm:p-2.5 flex flex-col justify-between hover:bg-slate-50/40 transition-all min-h-[90px] sm:min-h-[110px] ${
                      cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/[0.3] text-slate-300'
                    }`}
                  >
                    {/* Header: cell date flag */}
                    <div className="flex justify-between items-center mb-1.5">
                      <span className={`text-[10px] sm:text-xs font-black font-mono w-6 h-6 flex items-center justify-center rounded-full leading-none ${
                        isToday 
                          ? 'bg-blue-600 text-white' 
                          : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-350'
                      }`}>
                        {cell.dayNum}
                      </span>
                      {cell.events.length > 0 && (
                        <span className="text-[8px] bg-slate-100 text-slate-500 font-extrabold px-1 py-0.25 rounded-md min-w-[14px] text-center shrink-0">
                          {cell.events.length}
                        </span>
                      )}
                    </div>

                    {/* Events body content */}
                    <div className="flex-1 space-y-1 overflow-hidden">
                      {cell.events.slice(0, 3).map((ev) => (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`w-full text-right block px-1.5 py-0.75 sm:py-1 rounded-md text-[9px] sm:text-[10.5px] truncate cursor-pointer font-bold leading-normal border transition-transform hover:scale-[1.02] border-transparent active:scale-95 ${
                            ev.eventType === 'session'
                              ? ev.studentType === 'lesson'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-100 hover:border-emerald-250'
                                : 'bg-purple-50 text-purple-800 border-purple-100 hover:border-purple-250'
                              : 'bg-indigo-50 text-indigo-800 border-indigo-100 hover:border-indigo-250'
                          }`}
                          title={`${ev.studentName} - ${formatTimeTo12h(ev.time)}`}
                        >
                          <div className="flex items-center gap-1 justify-start">
                            <span className="font-mono text-[8.5px] font-black tracking-tight self-center shrink-0">
                              {formatTimeTo12h(ev.time)}:
                            </span>
                            <span className="truncate">{ev.studentName}</span>
                          </div>
                        </button>
                      ))}

                      {cell.events.length > 3 && (
                        <div className="text-[8.5px] text-slate-400 font-extrabold pr-1.5 pt-0.5">
                          + {cell.events.length - 3} أخرى...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Week View Layout (Columns format starting Saturday) */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-slate-150">
            {weekDays.map((date, idx) => {
              const events = getEventsForDate(date);
              const dayStr = JS_TO_AR_DAY[date.getDay()];
              const isToday = formatDateStr(date) === formatDateStr(new Date());
              
              return (
                <div 
                  key={`week-${idx}`}
                  className={`flex flex-col flex-1 p-4 ${
                    isToday ? 'bg-blue-50/15' : 'bg-white'
                  }`}
                >
                  {/* Day Date Header column */}
                  <div className="pb-3 border-b border-slate-100 mb-3 text-center sm:text-right">
                    <h4 className="font-black text-sm text-slate-800 flex items-center justify-center sm:justify-start gap-1.5">
                      <span className={`w-1.5 h-3.5 rounded ${isToday ? 'bg-blue-600 animate-pulse' : 'bg-slate-300'}`} />
                      <span>{dayStr}</span>
                    </h4>
                    <span className="text-[10.5px] font-mono text-slate-450 font-bold block mt-1">
                      {date.getDate()} {MONTHS_AR[date.getMonth()]} {date.getFullYear()}
                    </span>
                    <span className="inline-block text-[9px] px-1.5 py-0.25 mt-1.5 rounded-md font-extrabold bg-slate-50 text-slate-500 border border-slate-150-none">
                      {events.length} حصص
                    </span>
                  </div>

                  {/* Events space listing */}
                  <div className="flex-1 space-y-3 min-h-[140px]">
                    {events.length === 0 ? (
                      <div className="py-12 text-center text-slate-350 text-[10.5px] font-medium italic select-none">
                        لا توجد مواعيد
                      </div>
                    ) : (
                      events.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => setSelectedEvent(ev)}
                          className={`group select-none border rounded-2xl p-3 text-right hover:shadow-3xs hover:-translate-y-0.25 transition-all text-slate-800 cursor-pointer ${
                            ev.eventType === 'session'
                              ? ev.studentType === 'lesson'
                                ? 'bg-emerald-50/40 border-emerald-150/80 hover:bg-emerald-50/80 hover:border-emerald-300'
                                : 'bg-purple-50/40 border-purple-150/80 hover:bg-purple-50/80 hover:border-purple-300'
                              : 'bg-indigo-50/40 border-indigo-150/80 hover:bg-indigo-50/80 hover:border-indigo-300'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-1 pb-1.5 border-b border-dashed border-slate-200/50 mb-2">
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                              ev.eventType === 'session'
                                ? ev.studentType === 'lesson'
                                  ? 'bg-emerald-200/50 text-emerald-800'
                                  : 'bg-purple-200/50 text-purple-800'
                                : 'bg-indigo-200/50 text-indigo-800'
                            }`}>
                              {ev.eventType === 'session' ? 'مسجلة' : 'مجدولة'}
                            </span>
                            <div className="flex items-center gap-1 font-mono text-[10px] font-extrabold text-blue-650 tracking-tight" dir="ltr">
                              <Clock size={11} className="text-slate-400 shrink-0" />
                              <span>{formatTimeTo12h(ev.time)}</span>
                            </div>
                          </div>
                          
                          <p className="text-xs font-bold text-slate-900 group-hover:text-blue-650 transition-colors truncate">
                            {ev.studentName}
                          </p>
                          {ev.notes && (
                            <p className="text-[9.5px] text-slate-450 mt-1 lines-clamp-2 truncate max-w-full" title={ev.notes}>
                              {ev.notes}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Day View Timeline Layout */}
        {viewMode === 'day' && (
          <div className="p-6">
            <div className="mb-4 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm">أجندة يوم {JS_TO_AR_DAY[currentDate.getDay()]}</h4>
                <p className="text-[10.5px] text-slate-450 font-bold mt-0.5">
                  {currentDate.getDate()} {MONTHS_AR[currentDate.getMonth()]} {currentDate.getFullYear()}
                </p>
              </div>
              <span className="text-xs bg-blue-50 border border-blue-100 text-blue-700 font-extrabold px-3 py-1 rounded-2xl">
                إجمالي حصص اليوم: {getEventsForDate(currentDate).length}
              </span>
            </div>

            {getEventsForDate(currentDate).length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs font-bold leading-relaxed">
                <CalendarIcon size={34} className="text-slate-300 mx-auto mb-2" />
                <span>لا توجد أي حصص أو جلسات مجدولة أو مسجلة لهذا اليوم.</span>
              </div>
            ) : (
              <div className="relative border-r border-slate-150 pr-4 sm:pr-6 space-y-5 py-2">
                {getEventsForDate(currentDate).map((ev) => (
                  <div key={ev.id} className="relative group">
                    {/* Ring Bullet Line indicator */}
                    <div className="absolute right-[-21px] sm:right-[-29px] top-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-500 z-10 duration-200 group-hover:scale-110" />
                    
                    <div 
                      onClick={() => setSelectedEvent(ev)}
                      className={`border rounded-2xl p-4 cursor-pointer text-right group-hover:shadow-2xs transition-all max-w-xl ${
                        ev.eventType === 'session'
                          ? ev.studentType === 'lesson'
                            ? 'bg-emerald-50/30 border-emerald-150/80 hover:bg-emerald-50/60 hover:border-emerald-300'
                            : 'bg-purple-50/30 border-purple-150/80 hover:bg-purple-50/60 hover:border-purple-300'
                          : 'bg-indigo-50/30 border-indigo-150/80 hover:bg-indigo-50/60 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2 pb-2 border-b border-slate-100/55">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                            ev.eventType === 'session'
                              ? ev.studentType === 'lesson'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-purple-100 text-purple-800'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {ev.eventType === 'session' ? 'جلسة منجزة' : 'موعد أسبوعي مجدول'}
                          </span>
                          
                          <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                            ev.studentType === 'lesson' ? 'bg-blue-50 text-blue-800 border-blue-100' : 'bg-orange-50 text-orange-850 border-orange-100'
                          } border`}>
                            {ev.studentType === 'lesson' ? 'نظام الحصص' : 'نظام الكورس'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 font-mono text-xs font-black text-blue-650" dir="ltr">
                          <Clock size={12} className="text-slate-400" />
                          <span>{formatTimeTo12h(ev.time)}</span>
                        </div>
                      </div>

                      <h5 className="font-extrabold text-sm text-slate-900 group-hover:text-blue-650 transition-colors">
                        {ev.studentName}
                      </h5>
                      {ev.notes && (
                        <p className="text-[11px] text-slate-500 mt-2 font-medium bg-white/70 border border-slate-150 p-2 rounded-xl italic">
                          ✍️ ملاحظة: {ev.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Popover Details Modal dialog */}
      <AnimatePresence>
        {selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEvent(null)}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              id="calendar-backdrop"
            />

            {/* Content box popup */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl z-10 text-right text-slate-800 font-sans"
              id="calendar-modal"
            >
              {/* Modal window header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-120 mb-4">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${
                    selectedEvent.eventType === 'session' ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500 animate-pulse'
                  }`} />
                  <h3 className="text-sm font-black text-slate-900">تفاصيل {selectedEvent.eventType === 'session' ? 'الحصة المسجلة' : 'الموعد المجدول'}</h3>
                </div>
                
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 px-1.5 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 cursor-pointer"
                  title="إغلاق التقرير"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Student basic bio card widget */}
              {matchedStudentObj ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-150 rounded-2xl p-3.5 flex items-center gap-4">
                    {/* User initial avatar bubble */}
                    <div className="w-13 h-13 rounded-2xl bg-indigo-650 text-white flex items-center justify-center text-xl font-bold font-sans tracking-wide shrink-0 shadow-sm border border-indigo-700/10">
                      {matchedStudentObj.photo ? (
                        <img 
                          src={matchedStudentObj.photo} 
                          alt={matchedStudentObj.name} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover rounded-2xl"
                        />
                      ) : (
                        <span>{matchedStudentObj.name.trim().charAt(0)}</span>
                      )}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <h4 className="font-extrabold text-sm text-slate-900 truncate">{matchedStudentObj.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1 mt-0.5">
                        <span className={`px-1.5 py-0.25 text-[8.5px] rounded border ${
                          matchedStudentObj.type === 'lesson' 
                            ? 'bg-blue-50 text-blue-700 border-blue-100' 
                            : 'bg-orange-50 text-orange-700 border-orange-100'
                        }`}>
                          {matchedStudentObj.type === 'lesson' ? 'نظام الحصص' : 'نظام الكورس'}
                        </span>
                        <span>•</span>
                        <span className={matchedStudentObj.active ? 'text-emerald-600 font-extrabold' : 'text-slate-400 font-extrabold'}>
                          {matchedStudentObj.active ? '✅ طالب نشط حالياً' : '🛑 غير نشط'}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Class Specific Info parameters */}
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-black tracking-wider uppercase text-slate-400 pr-1">بيانات الموعد والجلسة</p>
                    
                    {/* Date Details Tag */}
                    <div className="grid grid-cols-2 gap-2.5 text-xs">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span className="text-[10px] text-slate-400 font-medium block">تاريخ اليوم المعتمد</span>
                        <span className="font-black text-slate-800 block mt-0.5">{selectedEvent.dateStr}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                        <span className="text-[10px] text-slate-400 font-medium block">ساعة وتوقيت الحصة</span>
                        <span className="font-black text-blue-700 font-mono tracking-tight block mt-0.5" dir="ltr">
                          {formatTimeTo12h(selectedEvent.time)}
                        </span>
                      </div>
                    </div>

                    {selectedEvent.notes && (
                      <div className="bg-blue-50/20 border border-blue-100 text-slate-755 p-3 rounded-xl text-xs font-semibold leading-relaxed">
                        <p className="text-[9.5px] text-blue-600 font-black mb-1 flex items-center gap-1">
                          <FileText size={11} />
                          <span>مذكرات المدرب / الملاحظة:</span>
                        </p>
                        <p className="italic font-medium">{selectedEvent.notes}</p>
                      </div>
                    )}
                  </div>

                  {/* Phone contact WhatsApp widget actions */}
                  <div className="space-y-2.5 pt-1.5">
                    <p className="text-[10px] font-black tracking-wider uppercase text-slate-400 pr-1">اتصال وتواصل سريع</p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      {/* WhatsApp connect pin */}
                      <a
                        href={getWhatsappLink(
                          matchedStudentObj.phone, 
                          selectedEvent.eventType === 'session' 
                            ? `مرحبا ${matchedStudentObj.name}، بخصوص حصتنا المنجزة بتاريخ ${selectedEvent.dateStr}...` 
                            : `مرحبا ${matchedStudentObj.name}، تذكير بموعد حصتنا القادمة المقررة في يوم السبت الساعة ${formatTimeTo12h(selectedEvent.time)}...`
                        )}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-3xs hover:shadow-2xs leading-none"
                      >
                        <MessageSquare size={14} />
                        <span>راسل واتساب</span>
                      </a>
                      {/* Phone call pin */}
                      <a
                        href={`tel:${matchedStudentObj.phone}`}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition-all cursor-pointer"
                      >
                        <Phone size={13} />
                        <span className="font-mono tracking-wide">{matchedStudentObj.phone}</span>
                      </a>
                    </div>
                  </div>

                  {/* Actions Bar Footer window */}
                  {onSelectStudent && (
                    <div className="border-t border-slate-120 pt-4 flex justify-between gap-3 font-bold text-xs mt-3">
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(null)}
                        className="px-4 py-2.5 text-slate-650 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 rounded-xl cursor-pointer"
                      >
                        إغلاق
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEvent(null);
                          onSelectStudent(matchedStudentObj.id);
                        }}
                        className="px-4 py-2.5 text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <ExternalLink size={13} />
                        <span>انتقال إلى ملف الطالب</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-6 text-center">عذراً، لم نتمكن من العثور على سجلات الطالب المعنى بهذا الموعد.</p>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
