import { 
  BreweryWorker, 
  Suggestion, 
  BreweryStats, 
  SuggestionCategory, 
  BreweryProcess, 
  SuggestionStatus,
  StatusHistoryLog
} from '../types/brewery';
import {
  INITIAL_SUGGESTIONS,
  INITIAL_WORKERS,
  normalizeProcess,
  normalizeRole,
} from '../data/mockBreweryData';
import {
  CATEGORY_SEVERITY_SCORES,
  PROCESS_IMPORTANCE_SCORES,
  URGENCY_SCORE_WEIGHT,
  calculatePriorityBreakdown,
  enrichSuggestionWithPriority,
} from './priorityScore';

/**
 * 제안의 긴급도(isUrgent: 50점), 카테고리 심각도(RISK=40, BREAKDOWN=30, PREVENT=20, IMPROVEMENT=10),
 * 공정 영향도(Bottling=10 등)를 합산하여 priorityScore(0~100)를 계산
 */
export function calculatePriorityScore(input: {
  isUrgent: boolean;
  category: SuggestionCategory;
  process: BreweryProcess;
}): number {
  const urgencyPoints = input.isUrgent ? URGENCY_SCORE_WEIGHT : 0;
  const categoryPoints =
    CATEGORY_SEVERITY_SCORES[input.category]?.score ?? 10;
  const processPoints =
    PROCESS_IMPORTANCE_SCORES[input.process]?.score ?? 2;

  return Math.min(100, urgencyPoints + categoryPoints + processPoints);
}

/**
 * Firestore `suggestions` 컬렉션에 저장할 문서 직렬화 포맷 (priorityScore 포함 보장)
 */
export function toFirestoreSuggestionDocument(suggestion: Suggestion) {
  const priorityScore = calculatePriorityScore({
    isUrgent: suggestion.isUrgent,
    category: suggestion.category,
    process: suggestion.process,
  });

  return {
    id: suggestion.id,
    title: suggestion.title,
    description: suggestion.description,
    category: suggestion.category,
    process: suggestion.process,
    locationDetail: suggestion.locationDetail || '',
    author: {
      userId: suggestion.authorId,
      name: suggestion.authorName,
      process: suggestion.authorProcess,
    },
    status: suggestion.status,
    isUrgent: suggestion.isUrgent,
    urgencyReason: suggestion.urgencyReason || null,
    priorityScore,
    attachments: suggestion.attachments || [],
    quickTags: suggestion.quickTags || [],
    assignedTo: suggestion.assignedTo || null,
    assignedToId: suggestion.assignedToId || null,
    dueDate: suggestion.dueDate || null,
    deadlineAlertEnabled: Boolean(suggestion.deadlineAlertEnabled),
    deadlineAlertDays: suggestion.deadlineAlertDays ?? 2,
    adminFeedback: suggestion.adminFeedback || null,
    isOfflineSynced: suggestion.isOfflineSynced ?? true,
    createdAt: suggestion.createdAt,
    updatedAt: suggestion.updatedAt,
    completedAt: suggestion.completedAt || null,
  };
}

const STORAGE_KEYS = {
  SUGGESTIONS: 'sulsul_suggestions_v4',
  WORKERS: 'sulsul_workers_v4',
  CURRENT_USER_ID: 'sulsul_current_user_v4',
  OFFLINE_QUEUE: 'sulsul_offline_queue_v4',
};

const LEGACY_STORAGE_KEYS = [
  'sulsul_suggestions_v3',
  'sulsul_workers_v3',
  'sulsul_current_user_v3',
  'sulsul_offline_queue_v3',
];

const LEGACY_SAMPLE_SUGGESTION_IDS = new Set([
  'SUG-2026-001',
  'SUG-2026-002',
  'SUG-2026-003',
  'SUG-2026-004',
  'SUG-2026-005',
]);

function purgeLegacySampleStorage(): void {
  try {
    LEGACY_STORAGE_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
  } catch {
    // ignore storage errors
  }
}

// Simple event emitter for real-time Firestore simulation
type Listener = () => void;
const listeners = new Set<Listener>();

function emitChange() {
  listeners.forEach(fn => fn());
}

export function subscribeBreweryStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Get stored suggestions (legacy sample items excluded)
export function getStoredSuggestions(): Suggestion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
    if (!raw) {
      // 기존 v3 로컬 데이터 중 샘플 항목을 제외한 사용자 작성분만 이관
      const legacyRaw = localStorage.getItem('sulsul_suggestions_v3');
      let migrated: Suggestion[] = [];
      if (legacyRaw) {
        try {
          const legacyParsed: Suggestion[] = JSON.parse(legacyRaw);
          migrated = legacyParsed
            .filter(item => item && !LEGACY_SAMPLE_SUGGESTION_IDS.has(item.id))
            .map(enrichSuggestionWithPriority);
        } catch {
          migrated = [];
        }
      }
      purgeLegacySampleStorage();
      const initial = migrated.length > 0 ? migrated : INITIAL_SUGGESTIONS.map(enrichSuggestionWithPriority);
      localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(initial));
      return initial;
    }
    const parsed: Suggestion[] = JSON.parse(raw);
    let needsPersist = false;
    const cleaned = parsed.filter(item => {
      if (LEGACY_SAMPLE_SUGGESTION_IDS.has(item.id)) {
        needsPersist = true;
        return false;
      }
      return true;
    });
    const enriched = cleaned.map(item => {
      const next = enrichSuggestionWithPriority(item);
      if (
        item.priorityScore !== next.priorityScore ||
        !item.priorityBreakdown ||
        typeof item.priorityBreakdown.categoryScore !== 'number'
      ) {
        needsPersist = true;
      }
      return next;
    });
    if (needsPersist) {
      localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(enriched));
    }
    return enriched;
  } catch {
    return [];
  }
}

// Get stored workers (no pre-seeded fake sample workers)
export function getStoredWorkers(): BreweryWorker[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKERS);
    if (!raw) {
      localStorage.removeItem('sulsul_workers_v3');
      localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(INITIAL_WORKERS));
      return INITIAL_WORKERS;
    }
    const parsed: BreweryWorker[] = JSON.parse(raw);
    return parsed.map(w => ({
      ...w,
      process: normalizeProcess(w.process),
      role: normalizeRole(w.role),
    }));
  } catch {
    return [];
  }
}

// Current logged in worker (fallback helper)
export function getCurrentUser(): BreweryWorker | null {
  const workers = getStoredWorkers();
  if (workers.length === 0) return null;
  const currentId = localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || '';
  return workers.find(w => w.id === currentId) || workers[0];
}

export function setCurrentUser(userId: string): BreweryWorker | null {
  const workers = getStoredWorkers();
  const worker = workers.find(w => w.id === userId) || workers[0] || null;
  if (worker) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, worker.id);
  }
  emitChange();
  return worker;
}

// Add new suggestion (F-02)
export function addSuggestion(
  newSuggestion: Omit<Suggestion, 'id' | 'createdAt' | 'updatedAt' | 'historyLogs'>,
  isOffline = false
): Suggestion {
  const currentList = getStoredSuggestions();
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  const priorityBreakdown = calculatePriorityBreakdown({
    isUrgent: newSuggestion.isUrgent,
    category: newSuggestion.category,
    process: newSuggestion.process,
  });
  const priorityScore = calculatePriorityScore({
    isUrgent: newSuggestion.isUrgent,
    category: newSuggestion.category,
    process: newSuggestion.process,
  });

  const created: Suggestion = {
    ...newSuggestion,
    id: `SUG-${new Date().getFullYear()}-${String(currentList.length + 1).padStart(3, '0')}`,
    priorityScore,
    priorityBreakdown,
    createdAt: dateStr,
    updatedAt: dateStr,
    isOfflineSynced: !isOffline,
    historyLogs: [
      {
        id: `log-${Date.now()}`,
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
        changedBy: newSuggestion.authorName,
        changedById: newSuggestion.authorId,
        changedAt: dateStr,
        comment: isOffline ? '오프라인 상태에서 작성됨 (동기화 대기)' : '현장 모바일에서 최초 등록됨',
      }
    ]
  };

  if (isOffline) {
    // Save to offline queue
    const queueRaw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    const queue: Suggestion[] = queueRaw ? JSON.parse(queueRaw) : [];
    queue.push(created);
    localStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
  }

  // Update suggestions
  const updatedList = [created, ...currentList];
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(updatedList));

  // Update author count
  const workers = getStoredWorkers();
  const workerIndex = workers.findIndex(w => w.id === newSuggestion.authorId);
  if (workerIndex >= 0) {
    workers[workerIndex].suggestionCount += 1;
    localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify(workers));
  }

  emitChange();
  return created;
}

// Get offline queue
export function getOfflineQueue(): Suggestion[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Sync offline items
export function syncOfflineQueue(): number {
  const queue = getOfflineQueue();
  if (queue.length === 0) return 0;

  const currentList = getStoredSuggestions();
  const syncedList = currentList.map(s => {
    if (queue.some(q => q.id === s.id)) {
      return enrichSuggestionWithPriority({ ...s, isOfflineSynced: true });
    }
    return s;
  });

  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(syncedList));
  localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  emitChange();
  return queue.length;
}

// Update status & assign admin/maintenance (F-05)
export function updateSuggestionStatus(
  suggestionId: string,
  newStatus: SuggestionStatus,
  reviewerName: string,
  reviewerId: string,
  comment?: string,
  assignedTo?: string,
  assignedToId?: string,
  dueDate?: string,
  deadlineAlertEnabled?: boolean,
  deadlineAlertDays?: number
): Suggestion | null {
  const currentList = getStoredSuggestions();
  const index = currentList.findIndex(s => s.id === suggestionId);
  if (index === -1) return null;

  const target = currentList[index];
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const newLog: StatusHistoryLog = {
    id: `log-${Date.now()}`,
    fromStatus: target.status,
    toStatus: newStatus,
    changedBy: reviewerName,
    changedById: reviewerId,
    changedAt: dateStr,
    comment: comment || `상태 변경: ${target.status} ➔ ${newStatus}`,
  };

  const updated: Suggestion = enrichSuggestionWithPriority({
    ...target,
    status: newStatus,
    updatedAt: dateStr,
    completedAt: newStatus === 'COMPLETED' ? dateStr : target.completedAt,
    assignedTo: assignedTo ?? target.assignedTo,
    assignedToId: assignedToId ?? target.assignedToId,
    dueDate: dueDate ?? target.dueDate,
    deadlineAlertEnabled:
      deadlineAlertEnabled !== undefined ? deadlineAlertEnabled : target.deadlineAlertEnabled,
    deadlineAlertDays:
      deadlineAlertDays !== undefined ? deadlineAlertDays : target.deadlineAlertDays,
    adminFeedback: comment || target.adminFeedback,
    historyLogs: [...target.historyLogs, newLog],
  });

  currentList[index] = updated;
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(currentList));
  emitChange();
  return updated;
}

// Toggle or configure deadline imminent alert on a single suggestion
export function updateSuggestionDeadlineAlert(
  suggestionId: string,
  enabled: boolean,
  alertDaysBefore?: number,
  dueDate?: string
): Suggestion | null {
  const currentList = getStoredSuggestions();
  const index = currentList.findIndex(s => s.id === suggestionId);
  if (index === -1) return null;

  const target = currentList[index];
  const dateStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

  const updated: Suggestion = enrichSuggestionWithPriority({
    ...target,
    dueDate: dueDate !== undefined ? dueDate : target.dueDate,
    deadlineAlertEnabled: enabled,
    deadlineAlertDays:
      alertDaysBefore !== undefined
        ? alertDaysBefore
        : (target.deadlineAlertDays ?? 2),
    updatedAt: dateStr,
  });

  currentList[index] = updated;
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(currentList));
  emitChange();
  return updated;
}

// Calculate Statistics (F-06)
export function calculateBreweryStats(suggestions: Suggestion[], workers: BreweryWorker[]): BreweryStats {
  const totalSuggestions = suggestions.length;

  // 현장 인원(일반 담당·파트장·반장) 대상 참여율 계산
  const fieldWorkers = workers.filter(w => w.role !== 'ADMIN');
  const totalFieldWorkers = fieldWorkers.length;
  
  const workerSuggestionMap = new Map<string, number>();
  const workerAdoptedMap = new Map<string, number>();

  suggestions.forEach(s => {
    workerSuggestionMap.set(s.authorId, (workerSuggestionMap.get(s.authorId) || 0) + 1);
    if (s.status === 'COMPLETED') {
      workerAdoptedMap.set(s.authorId, (workerAdoptedMap.get(s.authorId) || 0) + 1);
    }
  });

  const activeWorkersCount = fieldWorkers.filter(w => (workerSuggestionMap.get(w.id) || 0) > 0).length;
  const workerParticipationRate = totalFieldWorkers > 0 
    ? Math.round((activeWorkersCount / totalFieldWorkers) * 100) 
    : 0;

  // Category counts
  const categoryCounts: Record<SuggestionCategory, number> = {
    PROCESS_IMPROVEMENT: 0,
    BREAKDOWN_REPAIR: 0,
    PREVENTIVE_MAINT: 0,
    RISK_ASSESSMENT: 0,
  };

  // 양조2팀 제품공정 8개 담당 공정별 건수
  const processCounts: Record<BreweryProcess, number> = {
    DEPALLETIZER: 0,
    RFC: 0,
    LABELER: 0,
    PACKER: 0,
    INSPECTION: 0,
    PART_LEADER: 0,
    TEAM_LEADER: 0,
    ADMIN: 0,
  };

  // Status counts
  const statusCounts: Record<SuggestionStatus, number> = {
    PENDING: 0,
    REVIEWING: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    REJECTED: 0,
  };

  suggestions.forEach(s => {
    const safeProc = normalizeProcess(s.process);
    if (categoryCounts[s.category] !== undefined) categoryCounts[s.category]++;
    if (processCounts[safeProc] !== undefined) processCounts[safeProc]++;
    if (statusCounts[s.status] !== undefined) statusCounts[s.status]++;
  });

  // Top suggesters ranking
  const topSuggesters = fieldWorkers
    .map(w => ({
      workerId: w.id,
      name: w.name,
      process: w.process,
      count: workerSuggestionMap.get(w.id) || 0,
      adoptedCount: workerAdoptedMap.get(w.id) || 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 7);

  // 고장정비 평균 리드타임 계산 (시간 단위)
  const completedRepairs = suggestions.filter(
    s => s.category === 'BREAKDOWN_REPAIR' && s.status === 'COMPLETED' && s.completedAt
  );

  let avgLeadTimeHours = 0;
  if (completedRepairs.length > 0) {
    const totalHours = completedRepairs.reduce((acc, cur) => {
      const created = new Date(cur.createdAt).getTime();
      const comp = new Date(cur.completedAt!).getTime();
      const diffHours = Math.max(0.5, (comp - created) / (1000 * 60 * 60));
      return acc + diffHours;
    }, 0);
    avgLeadTimeHours = Number((totalHours / completedRepairs.length).toFixed(1));
  }

  return {
    totalSuggestions,
    workerParticipationRate,
    activeWorkersCount,
    avgLeadTimeHours,
    categoryCounts,
    processCounts,
    statusCounts,
    topSuggesters,
  };
}

// Reset local cached data cleanly (no fake sample data)
export function resetBreweryData(): void {
  purgeLegacySampleStorage();
  localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify([]));
  localStorage.setItem(STORAGE_KEYS.WORKERS, JSON.stringify([]));
  localStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
  emitChange();
}
