import { Student, Appointment, TeacherPreferences } from '../types';

export async function uploadBackupToGoogleDrive(
  token: string,
  preferences: TeacherPreferences,
  students: Student[],
  appointments: Appointment[],
  silent: boolean = false
): Promise<string> {
  const backupData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    preferences,
    students,
    appointments,
  };

  // 1. Search for existing backup file with same name
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name%3D%27teacher_app_backup.json%27+and+trashed%3Dfalse&fields=files(id,name)`,
    {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );

  if (!searchRes.ok) {
    throw new Error('فشل فحص النسخ السابقة في Google Drive.');
  }

  const searchObj = await searchRes.json();
  const existingFile = searchObj.files && searchObj.files[0];
  let fileId = existingFile?.id;

  // 2. If it does not exist, create the file first
  if (!fileId) {
    const createRes = await fetch(
      `https://www.googleapis.com/drive/v3/files`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'teacher_app_backup.json',
          mimeType: 'application/json'
        })
      }
    );

    if (!createRes.ok) {
      throw new Error('فشل في تهيئة وإنشاء ملف النسخة الاحتياطية الجديد في حساب Google Drive.');
    }

    const newFileFile = await createRes.json();
    fileId = newFileFile.id;
  }

  // 3. Upload content to the file
  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(backupData)
    }
  );

  if (!uploadRes.ok) {
    throw new Error('فشل رفع محتوى النسخة الاحتياطية وحفظ البيانات الخاصة بك.');
  }

  const nowStr = new Date().toLocaleDateString('ar-EG') + ' ' + new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  return nowStr;
}

/**
 * Automatically triggers backup if the last backup date is different from today.
 */
export async function triggerDailyGoogleDriveBackupIfNeeded(
  token: string | null,
  preferences: TeacherPreferences,
  students: Student[],
  appointments: Appointment[],
  onSuccess: (updatedPrefs: Partial<TeacherPreferences>, backupTimeFormatted: string) => void
): Promise<boolean> {
  // Check if daily backup is enabled and we have a valid token
  if (!token) return false;
  if (preferences.autoBackupDownloadInterval === 'disabled') return false;

  const todayStr = new Date().toISOString().split('T')[0];
  
  // Verify if daily/weekly/monthly is due
  let isDue = false;
  const lastBackupDate = preferences.lastGoogleDriveBackupDate;

  if (!lastBackupDate) {
    isDue = true;
  } else {
    const diffMs = new Date(todayStr).getTime() - new Date(lastBackupDate).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (preferences.autoBackupDownloadInterval === 'daily' && diffDays >= 1) {
      isDue = true;
    } else if (preferences.autoBackupDownloadInterval === 'weekly' && diffDays >= 7) {
      isDue = true;
    } else if (preferences.autoBackupDownloadInterval === 'monthly' && diffDays >= 30) {
      isDue = true;
    }
  }

  if (!isDue) return false;

  console.log(`[Google Drive Auto-Backup] Starting due auto-backup (Last: ${lastBackupDate || 'Never'}, Interval: ${preferences.autoBackupDownloadInterval})`);

  try {
    const backupTimeFormatted = await uploadBackupToGoogleDrive(token, preferences, students, appointments, true);
    
    // Save state update
    onSuccess({
      lastGoogleDriveBackupDate: todayStr
    }, backupTimeFormatted);
    
    return true;
  } catch (err) {
    console.error('[Google Drive Auto-Backup] Silent daily backup failed:', err);
    return false;
  }
}
