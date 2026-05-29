import { Appointment } from '../types';

// Map Arabic day name to Google Calendar RRULE BYDAY format
export const DAY_TO_BYDAY: Record<string, string> = {
  'الأحد': 'SU',
  'الاثنين': 'MO',
  'الثلاثاء': 'TU',
  'الأربعاء': 'WE',
  'الخميس': 'TH',
  'الجمعة': 'FR',
  'السبت': 'SA',
};

// Map Arabic day name to JS Date index (0 = Sunday, 1 = Monday, etc.)
export const DAY_TO_INDEX: Record<string, number> = {
  'الأحد': 0,
  'الاثنين': 1,
  'الثلاثاء': 2,
  'الأربعاء': 3,
  'الخميس': 4,
  'الجمعة': 5,
  'السبت': 6,
};

// Formats a Date object to ISO 8601 string preserving the client's local timezone offset
const formatISOWithLocalOffset = (date: Date): string => {
  const tzo = -date.getTimezoneOffset();
  const dif = tzo >= 0 ? '+' : '-';
  const pad = (num: number) => String(num).padStart(2, '0');
  
  return date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds()) +
    dif + pad(Math.floor(Math.abs(tzo) / 60)) +
    ':' + pad(Math.abs(tzo) % 60);
};

// Finds the next date for a given Arabic day name and time (HH:MM)
export const getNextOccurrence = (dayOfWeekArabic: string, timeStr: string): Date => {
  const targetDayNum = DAY_TO_INDEX[dayOfWeekArabic];
  if (targetDayNum === undefined) return new Date();

  const now = new Date();
  const currentDayNum = now.getDay();
  
  let daysUntilTarget = targetDayNum - currentDayNum;
  if (daysUntilTarget < 0) {
    daysUntilTarget += 7; // Next week's occurrence
  }
  
  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);
  
  // Parse HH:MM
  const [hour, minute] = timeStr.split(':').map(Number);
  targetDate.setHours(hour || 0, minute || 0, 0, 0);
  
  return targetDate;
};

// Local storage key for calendar mapping
const STORAGE_KEY = 'teacher_app_google_calendar_mappings';

// Gets the map of appointment ID -> Google Calendar Event ID from local storage
export const getCalendarMappings = (): Record<string, string> => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Error reading index mappings', e);
    return {};
  }
};

// Saves a mapping
export const saveCalendarMapping = (appointmentId: string, eventId: string | null) => {
  try {
    const mappings = getCalendarMappings();
    if (eventId) {
      mappings[appointmentId] = eventId;
    } else {
      delete mappings[appointmentId];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mappings));
  } catch (e) {
    console.error('Error saving mapping', e);
  }
};

// Sync multiple appointments to Google Calendar
export const syncAppointmentsToGoogleCalendar = async (
  appointments: Appointment[],
  accessToken: string,
  onProgress?: (current: number, total: number, studentName: string) => void
): Promise<{ successCount: number; failedCount: number }> => {
  const mappings = getCalendarMappings();
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < appointments.length; i++) {
    const app = appointments[i];
    if (onProgress) {
      onProgress(i + 1, appointments.length, app.studentName);
    }

    try {
      // 1. Delete old event if mapped to avoid duplicates
      const existingEventId = mappings[app.id];
      if (existingEventId) {
        try {
          await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
        } catch (err) {
          console.warn(`Could not delete previous event ${existingEventId}, it may have been already deleted.`, err);
        }
        saveCalendarMapping(app.id, null);
      }

      // 2. Prepare event parameters
      const startDate = getNextOccurrence(app.dayOfWeek, app.time);
      // Set lesson duration default to 1 hour
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

      const byDay = DAY_TO_BYDAY[app.dayOfWeek];
      const recurrenceRule = byDay ? [`RRULE:FREQ=WEEKLY;BYDAY=${byDay}`] : [];

      const eventBody = {
        summary: `حصة الطالب: ${app.studentName}`,
        description: `حصة أسبوعية مجدولة تلقائياً ومزامنة من تطبيق المعلم الذكي للدراسة الخصوصية.\nملاحظات الموعد: ${app.notes || 'لا توجد ملاحظات.'}`,
        start: {
          dateTime: formatISOWithLocalOffset(startDate),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        end: {
          dateTime: formatISOWithLocalOffset(endDate),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        recurrence: recurrenceRule,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 }, // 1 hour reminder before class
            { method: 'popup', minutes: 1440 }, // 1 day reminder
          ],
        },
      };

      // 3. Create new event
      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      });

      if (!response.ok) {
        throw new Error(`Google API returned active error code ${response.status}`);
      }

      const responseData = await response.json();
      if (responseData.id) {
        saveCalendarMapping(app.id, responseData.id);
        successCount++;
      } else {
        failedCount++;
      }
    } catch (error) {
      console.error(`Failed to sync appointment for student ${app.studentName}:`, error);
      failedCount++;
    }
  }

  return { successCount, failedCount };
};

// Delete a single appointment from Google Calendar
export const deleteFromGoogleCalendar = async (appointmentId: string, accessToken: string): Promise<boolean> => {
  const mappings = getCalendarMappings();
  const existingEventId = mappings[appointmentId];
  if (!existingEventId) return false;

  try {
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok || response.status === 404) {
      saveCalendarMapping(appointmentId, null);
      return true;
    }
  } catch (err) {
    console.error('Error deleting event from Google Calendar', err);
  }
  return false;
};
