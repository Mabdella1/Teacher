/**
 * Converts a 24-hour time string "HH:mm" (or similar) into a 12-hour format with AM/PM.
 */
export function formatTimeTo12h(timeStr: string): string {
  if (!timeStr) return '';
  const trimmed = timeStr.trim().toUpperCase();
  
  // If already formatted, return as is
  if (trimmed.endsWith('AM') || trimmed.endsWith('PM')) {
    return timeStr;
  }
  
  if (!timeStr.includes(':')) {
    return timeStr;
  }

  const parts = trimmed.split(':');
  if (parts.length < 2) return timeStr;

  let hour = parseInt(parts[0], 10);
  const min = parts[1].substring(0, 2);

  if (isNaN(hour)) return timeStr;

  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; // 0 becomes 12

  return `${hour}:${min} ${ampm}`;
}
