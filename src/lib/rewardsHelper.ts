import { Student, EarnedBadge, RewardTransaction } from '../types';

export interface BadgeRule {
  id: string;
  name: string;
  description: string;
  type: 'lessons' | 'course_complete';
  count: number;
  points: number;
  icon: string; // Tailwind icon name or emoji
}

export const BADGE_RULES: BadgeRule[] = [
  { id: 'badge-3-sess', name: 'البادئ الطموح 🌟', description: 'إتمام 3 حصص دراسية بنجاح', type: 'lessons', count: 3, points: 30, icon: 'Award' },
  { id: 'badge-5-sess', name: 'المثابر المجتهد 🎯', description: 'إتمام 5 حصص دراسية بنجاح', type: 'lessons', count: 5, points: 50, icon: 'Target' },
  { id: 'badge-10-sess', name: 'بطل المعرفة 👑', description: 'إتمام 10 حصص دراسية بنجاح', type: 'lessons', count: 10, points: 100, icon: 'GraduationCap' },
  { id: 'badge-15-sess', name: 'أيقونة التفوق 💎', description: 'إتمام 15 حصة دراسية بنجاح وتأصيل المنهج', type: 'lessons', count: 15, points: 150, icon: 'Sparkles' },
  { id: 'badge-25-sess', name: 'العلامة الفذّ 🏆', description: 'إتمام 25 حصة دراسية بنجاح وتأسيس حضور خرافي', type: 'lessons', count: 25, points: 250, icon: 'Trophy' },
  { id: 'badge-course-complete', name: 'قاهر المناهج 📚', description: 'إيجاز وإتمام الدورة الدراسية بالكامل بنجاح', type: 'course_complete', count: 1, points: 200, icon: 'BookOpen' }
];

/**
 * Automatically syncs the student's badges based on their registered sessions & course complete status.
 * Re-applies historical badges and awards points safely without duplicating entries.
 */
export function syncStudentBadges(student: Student): { updatedStudent: Student; newlyEarned: string[] } {
  const earnedBadges: EarnedBadge[] = student.earnedBadges ? [...student.earnedBadges] : [];
  const rewardTransactions: RewardTransaction[] = student.rewardTransactions ? [...student.rewardTransactions] : [];
  let points = student.rewardPoints || 0;
  const newlyEarned: string[] = [];

  const completedSessionsCount = student.sessions.length;
  const isCourseComplete = student.type === 'course' && student.totalLessonsCount ? (completedSessionsCount >= student.totalLessonsCount) : false;

  BADGE_RULES.forEach((rule) => {
    const isEarned = earnedBadges.some((b) => b.id === rule.id);
    if (!isEarned) {
      let qualifies = false;
      if (rule.type === 'lessons') {
        qualifies = completedSessionsCount >= rule.count;
      } else if (rule.type === 'course_complete') {
        qualifies = isCourseComplete;
      }

      if (qualifies) {
        // Find corresponding session date for display accuracy
        let earnedDate = new Date().toISOString().split('T')[0];
        if (rule.type === 'lessons' && student.sessions[rule.count - 1]) {
          earnedDate = student.sessions[rule.count - 1].date;
        } else if (student.sessions.length > 0) {
          earnedDate = student.sessions[student.sessions.length - 1].date;
        }

        // Add to earned list
        earnedBadges.push({
          id: rule.id,
          name: rule.name,
          description: rule.description,
          earnedDate,
          requirementType: rule.type,
          requirementValue: rule.count,
          pointsAwarded: rule.points,
          icon: rule.icon,
        });

        // Add reward transaction if not present
        const hasTx = rewardTransactions.some(
          (tx) => tx.type === 'earn' && tx.description.includes(rule.name)
        );
        if (!hasTx) {
          const newTx: RewardTransaction = {
            id: `badge_earn_${rule.id}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'earn',
            amount: rule.points,
            reason: 'manual',
            description: `🏆 وسام متميز: تم منح الطالب "${rule.name}" لتخطي المستويات المستهدفة بنجاح!`,
            date: earnedDate,
          };
          rewardTransactions.unshift(newTx);
          points += rule.points;
        }

        newlyEarned.push(rule.name);
      }
    }
  });

  return {
    updatedStudent: {
      ...student,
      earnedBadges,
      rewardPoints: points,
      rewardTransactions,
    },
    newlyEarned,
  };
}
