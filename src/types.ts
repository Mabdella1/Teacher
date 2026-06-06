export type StudentType = 'lesson' | 'course';

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes?: string;
  isExtra?: boolean; // indicates an extra/additional lesson outside of course limits
  extraPrice?: number; // specific custom price for this extra session
  evaluation?: 'ممتاز' | 'جيد جداً' | 'جيد' | 'مقبول' | 'ضعيف';
  evaluationNotes?: string;
}

export interface RewardTransaction {
  id: string;
  type: 'earn' | 'redeem';
  amount: number; // positive points count
  reason: 'session' | 'payment_ontime' | 'redeem_discount' | 'redeem_free_session' | 'manual';
  description: string;
  date: string; // YYYY-MM-DD
}

export interface Payment {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
}

export interface StudyNote {
  id: string;
  content: string;
  date: string; // YYYY-MM-DD or ISO string
  type: 'academic' | 'behavior' | 'homework' | 'exam' | 'general'; // Note category for organization
  title?: string; // Optional title for the note
}

export interface EarnedBadge {
  id: string;
  name: string;
  description: string;
  earnedDate: string;
  requirementType: 'lessons' | 'course_complete' | 'other';
  requirementValue: number;
  pointsAwarded: number;
  icon: string;
}

export interface Student {
  id: string;
  name: string;
  phone: string;
  type: StudentType;
  active: boolean;
  createdAt: string;
  
  // Specific settings for Lesson System
  lessonRate?: number; // Price per lesson
  
  // Specific settings for Course System
  coursePrice?: number; // Total price
  totalLessonsCount?: number; // Capacity/Total sessions in course
  dueDate?: string; // YYYY-MM-DD next payment date if any
  
  // Captured records
  sessions: Session[];
  payments: Payment[];
  photo?: string; // base64 image data URL
  autoReminder?: boolean; // 24-hour auto-reminder toggle before session
  rewardPoints?: number; // total available points for rewards
  rewardTransactions?: RewardTransaction[]; // points log history
  customReminderDate?: string; // YYYY-MM-DD custom one-off reminder
  customReminderNote?: string; // custom notification note
  studyNotes?: StudyNote[]; // custom study notes
  whatsAppTemplates?: { id: string; title: string; text: string }[];
  password?: string; // Student custom password for portal
  overallEvaluation?: 'ممتاز' | 'جيد جداً' | 'جيد' | 'مقبول' | 'ضعيف';
  overallEvaluationNotes?: string;
  cardColor?: string; // Hex color for ID card accent
  earnedBadges?: EarnedBadge[]; // custom system of rewards
}

export interface Appointment {
  id: string;
  studentId: string;
  studentName: string;
  dayOfWeek: string; // e.g. "السبت", "الأحد", etc.
  time: string; // HH:MM
  title?: string;
  notes?: string;
  color?: string; // custom hex color tag
  isExceptional?: boolean; // is it an exceptional one-off appointment
  date?: string; // YYYY-MM-DD for exceptional appointments
}

export interface TeacherPreferences {
  teacherName: string;
  subject: string;
  currency: string;
  passcode: string; // for security
  primaryColor?: string; // custom primary color hex or tailwind slug
  enableWhatsApp24hReminders?: boolean; // toggle for automated 24h WhatsApp session ready reminder
  autoBackupDownloadInterval?: 'daily' | 'weekly' | 'monthly' | 'disabled'; // auto backup download frequency
  lastAutoBackupDownloadDate?: string; // YYYY-MM-DD date when the last download took place
  lastGoogleDriveBackupDate?: string; // YYYY-MM-DD date when the last Google Drive backup took place
  hideAIAnalysis?: boolean; // toggle to hide Gemini AI feature from the UI
  hideGoogleCalendar?: boolean; // toggle to hide Google Calendar feature from the UI
}

export interface MonthlyReportItem {
  studentId: string;
  studentName: string;
  studentType: StudentType;
  sessionsCount: number;
  totalEarnings: number; // calculated based on billing type
  totalPaid: number;
  outstandingBalance: number;
}

export interface NotificationSettings {
  remindClasses: boolean;
  classHoursThreshold: number; // e.g. 2 hours before
  remindPayments: boolean;
  paymentDaysThreshold: number; // e.g. 3 days before
  remindCompletion: boolean;
  completionRemainingCount: number; // e.g. 1 lesson remaining
  enablePush: boolean;
  enableInApp: boolean;
  whatsappEnabled: boolean;
  smsEnabled: boolean;
  classTemplate: string;
  paymentTemplate: string;
  completionTemplate: string;
  
  // Custom teacher alert settings
  notifyTeacherOnSessionComplete?: boolean;
  notifyTeacherOnNewPayment?: boolean;
  notifyTeacherOnPaymentDue?: boolean;
  
  // Do Not Disturb (DND) settings
  dndEnabled?: boolean;
  dndStart?: string; // HH:MM format
  dndEnd?: string; // HH:MM format

  // Customizable alert toggles for student portal
  sendStudentClassReminders?: boolean;
  sendStudentPaymentReminders?: boolean;
  sendStudentCompletionReminders?: boolean;
}

export interface AppNotification {
  id: string;
  studentId?: string;
  type: 'class' | 'payment' | 'completion' | 'teacher-session' | 'teacher-payment' | 'teacher-due';
  title: string;
  message: string;
  date: string; // ISO or human format
  read: boolean;
  dynamicActionData?: any; // e.g. target phone, whatsapp link
}

export interface ExamAppointment {
  id: string;
  studentId: string;
  studentName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  notes?: string;
  subject?: string;
}

export interface TeacherAccount {
  username: string;
  fullName: string;
  subject: string;
  passwordHash: string; // Passcode or password representation
  createdAt: string;
}

export interface ChatFile {
  name: string;
  type: string;
  size: number;
  data: string; // Base64 Content URI
}

export interface ChatMessage {
  id: string;
  studentId: string;
  sender: 'teacher' | 'student';
  senderName?: string;
  text: string;
  timestamp: number;
  file?: ChatFile;
}

export interface ChatGroup {
  id: string;
  name: string;
  studentIds: string[];
  createdAt: number;
}



