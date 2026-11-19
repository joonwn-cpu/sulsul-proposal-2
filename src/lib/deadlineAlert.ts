import { Suggestion } from '../types/brewery';

export const DEFAULT_DEADLINE_ALERT_DAYS = 2;

export type DeadlineSeverity =
  | 'overdue'
  | 'today'
  | 'soon'
  | 'normal'
  | 'closed'
  | 'none';

export interface DeadlineAlertInfo {
  isEnabled: boolean;
  hasDueDate: boolean;
  isClosed: boolean;
  alertDaysBefore: number;
  daysRemaining: number | null;
  isOverdue: boolean;
  isDueToday: boolean;
  isImminent: boolean;
  shouldTriggerAlert: boolean;
  dDayLabel: string;
  severity: DeadlineSeverity;
}

export function getTodayLocalDateStr(referenceDate: Date = new Date()): string {
  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
  const d = String(referenceDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDateOnly(dateStr?: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/**
 * 제안의 처리 기한(dueDate) 및 알림 설정(deadlineAlertEnabled) 상태 계산
 */
export function getDeadlineAlertInfo(
  suggestion: Suggestion,
  referenceDate: Date = new Date()
): DeadlineAlertInfo {
  const isEnabled = Boolean(suggestion.deadlineAlertEnabled);
  const alertDaysBefore =
    typeof suggestion.deadlineAlertDays === 'number' && suggestion.deadlineAlertDays >= 0
      ? suggestion.deadlineAlertDays
      : DEFAULT_DEADLINE_ALERT_DAYS;
  const isClosed = suggestion.status === 'COMPLETED' || suggestion.status === 'REJECTED';
  const parsedDue = parseLocalDateOnly(suggestion.dueDate);

  if (!parsedDue) {
    return {
      isEnabled,
      hasDueDate: false,
      isClosed,
      alertDaysBefore,
      daysRemaining: null,
      isOverdue: false,
      isDueToday: false,
      isImminent: false,
      shouldTriggerAlert: false,
      dDayLabel: '',
      severity: 'none',
    };
  }

  const todayMidnight = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const diffMs = parsedDue.getTime() - todayMidnight.getTime();
  const daysRemaining = Math.round(diffMs / 86400000);

  if (isClosed) {
    return {
      isEnabled,
      hasDueDate: true,
      isClosed: true,
      alertDaysBefore,
      daysRemaining,
      isOverdue: false,
      isDueToday: false,
      isImminent: false,
      shouldTriggerAlert: false,
      dDayLabel: suggestion.status === 'COMPLETED' ? '조치 완료' : '반려 종결',
      severity: 'closed',
    };
  }

  const isOverdue = daysRemaining < 0;
  const isDueToday = daysRemaining === 0;
  const isImminent = daysRemaining <= alertDaysBefore;

  let dDayLabel = `D-${daysRemaining}`;
  let severity: DeadlineSeverity = 'normal';

  if (isOverdue) {
    dDayLabel = `기한 초과 D+${Math.abs(daysRemaining)}`;
    severity = 'overdue';
  } else if (isDueToday) {
    dDayLabel = '오늘 마감 (D-Day)';
    severity = 'today';
  } else if (isImminent) {
    dDayLabel = `마감 임박 D-${daysRemaining}`;
    severity = 'soon';
  }

  return {
    isEnabled,
    hasDueDate: true,
    isClosed: false,
    alertDaysBefore,
    daysRemaining,
    isOverdue,
    isDueToday,
    isImminent,
    shouldTriggerAlert: isEnabled && isImminent,
    dDayLabel,
    severity,
  };
}

export type BrowserNotificationPermissionState = NotificationPermission | 'unsupported';

export function getBrowserNotificationPermission(): BrowserNotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission || 'denied';
  }
}

export function sendDeadlineBrowserNotification(
  suggestion: Suggestion,
  info: DeadlineAlertInfo,
  customPrefix?: string
): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }
  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const prefix = customPrefix ? `${customPrefix} ` : '';
    const title = `${prefix}[술술제안] 처리 기한 임박 (${info.dDayLabel || '기한 알림'})`;
    const body = `[${suggestion.id}] ${suggestion.title}\n마감일: ${suggestion.dueDate || '미지정'} · 담당: ${
      suggestion.assignedTo ? suggestion.assignedTo.split(' ')[0] : '미지정'
    }`;

    const notification = new Notification(title, {
      body,
      tag: `sulsul-deadline-${suggestion.id}`,
      requireInteraction: false,
    });

    notification.onclick = () => {
      try {
        window.focus();
        notification.close();
      } catch {
        // Ignore focus errors inside sandboxed iframes
      }
    };

    return true;
  } catch {
    return false;
  }
}
