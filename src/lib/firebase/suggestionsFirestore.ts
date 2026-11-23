import { User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  Suggestion,
  SuggestionCategory,
  SuggestionStatus,
} from '../../types/brewery';
import { normalizeProcess } from '../../data/mockBreweryData';
import { calculatePriorityScore } from '../breweryStore';
import { enrichSuggestionWithPriority } from '../priorityScore';
import { OperationType, db, handleFirestoreError } from './client';

// Verbatim blueprint constraints synchronized with firebase-blueprint.json & firestore.rules
const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
const DUE_DATE_PATTERN = /^(|\d{4}-\d{2}-\d{2})$/;
const MAX_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 4000;
const MAX_LOCATION_LENGTH = 200;
const MAX_AUTHOR_ID_LENGTH = 64;
const MAX_AUTHOR_NAME_LENGTH = 80;
const MAX_URGENCY_REASON_LENGTH = 300;
const MAX_ASSIGNED_TO_LENGTH = 120;
const MAX_ASSIGNED_TO_ID_LENGTH = 64;
const MAX_FEEDBACK_LENGTH = 2000;
const MAX_COMPLETED_AT_LENGTH = 40;
const MAX_QUICK_TAGS = 10;
const MAX_TAG_LENGTH = 80;

const BOOTSTRAPPED_ADMIN_EMAIL = 'joonwn@gmail.com';

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, MAX_ID_LENGTH);
  if (cleaned && ID_PATTERN.test(cleaned)) {
    return cleaned;
  }
  return `${fallbackPrefix}_${Date.now()}`;
}

function clampString(val: string | undefined, maxLen: number): string {
  return (val || '').trim().slice(0, maxLen);
}

function sanitizeDueDate(val: string | undefined): string {
  const trimmed = (val || '').trim();
  return DUE_DATE_PATTERN.test(trimmed) ? trimmed : '';
}

function sanitizeQuickTags(tags: string[] | undefined): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map(t => String(t ?? '').trim().slice(0, MAX_TAG_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_QUICK_TAGS);
}

function formatFirestoreTimestamp(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString().replace('T', ' ').substring(0, 19);
  }
  if (typeof val === 'string' && val.trim()) {
    return val;
  }
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export function isBootstrappedAdminUser(user: User | null): boolean {
  return Boolean(user && user.emailVerified && user.email === BOOTSTRAPPED_ADMIN_EMAIL);
}

/**
 * 인증된 사용자에 대해 Firestore `suggestions` 컬렉션 실시간 구독
 * (Pillar 8: 일반 사용자는 ownerUid == user.uid 쿼리 강제, 관리자는 전체 조회)
 */
export function subscribeFirestoreSuggestions(
  user: User,
  onSuggestions: (items: Suggestion[]) => void,
  onError?: (error: Error) => void
): () => void {
  const path = 'suggestions';
  const suggestionsRef = collection(db, path);
  const q = isBootstrappedAdminUser(user)
    ? query(suggestionsRef)
    : query(suggestionsRef, where('ownerUid', '==', user.uid));

  return onSnapshot(
    q,
    snapshot => {
      const items: Suggestion[] = snapshot.docs
        .map(docSnap => {
          const data = docSnap.data();
          const suggestion: Suggestion = {
            id: typeof data.id === 'string' ? data.id : docSnap.id,
            title: typeof data.title === 'string' ? data.title : '',
            description: typeof data.description === 'string' ? data.description : '',
            category: (data.category as SuggestionCategory) || 'PROCESS_IMPROVEMENT',
            process: normalizeProcess(data.process),
            locationDetail: typeof data.locationDetail === 'string' ? data.locationDetail : '',
            authorId: typeof data.authorId === 'string' ? data.authorId : user.uid,
            authorName: typeof data.authorName === 'string' ? data.authorName : '현장 작업자',
            authorProcess: normalizeProcess(data.authorProcess),
            status: (data.status as SuggestionStatus) || 'PENDING',
            isUrgent: Boolean(data.isUrgent),
            urgencyReason: typeof data.urgencyReason === 'string' ? data.urgencyReason : undefined,
            priorityScore: typeof data.priorityScore === 'number' ? data.priorityScore : undefined,
            assignedTo: typeof data.assignedTo === 'string' ? data.assignedTo : undefined,
            assignedToId: typeof data.assignedToId === 'string' ? data.assignedToId : undefined,
            dueDate: typeof data.dueDate === 'string' && data.dueDate ? data.dueDate : undefined,
            deadlineAlertEnabled:
              typeof data.deadlineAlertEnabled === 'boolean'
                ? data.deadlineAlertEnabled
                : undefined,
            deadlineAlertDays:
              typeof data.deadlineAlertDays === 'number' ? data.deadlineAlertDays : undefined,
            adminFeedback: typeof data.adminFeedback === 'string' ? data.adminFeedback : undefined,
            attachments: [],
            quickTags: Array.isArray(data.quickTags) ? data.quickTags.map(String) : [],
            createdAt: formatFirestoreTimestamp(data.createdAt),
            updatedAt: formatFirestoreTimestamp(data.updatedAt),
            completedAt:
              typeof data.completedAt === 'string' && data.completedAt
                ? data.completedAt
                : undefined,
            isOfflineSynced:
              typeof data.isOfflineSynced === 'boolean' ? data.isOfflineSynced : true,
            historyLogs: [],
          };
          return enrichSuggestionWithPriority(suggestion);
        })
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      onSuggestions(items);
    },
    error => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrappedError) {
        if (onError && wrappedError instanceof Error) {
          onError(wrappedError);
        }
      }
    }
  );
}

/**
 * 신규 제안을 Blueprint 제약 조건에 맞춰 정제 후 Firestore에 저장
 */
export async function createSuggestionInFirestore(
  suggestion: Suggestion,
  user: User,
  isAdminOverride = false
): Promise<void> {
  const safeId = sanitizeId(suggestion.id, 'SUG');
  const docPath = `suggestions/${safeId}`;
  const isAdmin = isBootstrappedAdminUser(user) || isAdminOverride;
  const safeProcess = normalizeProcess(suggestion.process);
  const safeAuthorProcess = normalizeProcess(suggestion.authorProcess);
  const priorityScore = calculatePriorityScore({
    isUrgent: suggestion.isUrgent,
    category: suggestion.category,
    process: safeProcess,
  });

  const payload: Record<string, unknown> = {
    id: safeId,
    ownerUid: user.uid,
    title: clampString(suggestion.title, MAX_TITLE_LENGTH) || '현장 제안',
    description: clampString(suggestion.description, MAX_DESCRIPTION_LENGTH) || '상세 내용 없음',
    category: suggestion.category,
    process: safeProcess,
    locationDetail: clampString(suggestion.locationDetail, MAX_LOCATION_LENGTH),
    authorId: sanitizeId(suggestion.authorId || user.uid, 'W').slice(0, MAX_AUTHOR_ID_LENGTH),
    authorName: clampString(suggestion.authorName, MAX_AUTHOR_NAME_LENGTH) || '현장 작업자',
    authorProcess: safeAuthorProcess,
    status: isAdmin ? suggestion.status : 'PENDING',
    isUrgent: Boolean(suggestion.isUrgent),
    priorityScore,
    quickTags: sanitizeQuickTags(suggestion.quickTags),
    isOfflineSynced: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (suggestion.urgencyReason?.trim()) {
    payload.urgencyReason = clampString(suggestion.urgencyReason, MAX_URGENCY_REASON_LENGTH);
  }
  if (suggestion.dueDate) {
    payload.dueDate = sanitizeDueDate(suggestion.dueDate);
  }
  if (typeof suggestion.deadlineAlertEnabled === 'boolean') {
    payload.deadlineAlertEnabled = suggestion.deadlineAlertEnabled;
  }
  if (typeof suggestion.deadlineAlertDays === 'number') {
    payload.deadlineAlertDays = Math.min(30, Math.max(0, Math.round(suggestion.deadlineAlertDays)));
  }

  if (isAdmin) {
    if (suggestion.assignedTo?.trim()) {
      payload.assignedTo = clampString(suggestion.assignedTo, MAX_ASSIGNED_TO_LENGTH);
    }
    if (suggestion.assignedToId?.trim()) {
      payload.assignedToId = clampString(suggestion.assignedToId, MAX_ASSIGNED_TO_ID_LENGTH);
    }
    if (suggestion.adminFeedback?.trim()) {
      payload.adminFeedback = clampString(suggestion.adminFeedback, MAX_FEEDBACK_LENGTH);
    }
    if (suggestion.completedAt?.trim()) {
      payload.completedAt = clampString(suggestion.completedAt, MAX_COMPLETED_AT_LENGTH);
    }
  }

  try {
    await setDoc(doc(db, 'suggestions', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

/**
 * 누락된 공정별 제안 예시 목록을 Firestore에 일괄 등록
 */
export async function syncProcessExampleSuggestionsToFirestore(
  examples: Suggestion[],
  existingCloudIds: Set<string>,
  user: User,
  isAdminOverride = false
): Promise<number> {
  const missing = examples.filter(item => !existingCloudIds.has(item.id));
  if (missing.length === 0) return 0;

  let createdCount = 0;
  for (const item of missing) {
    await createSuggestionInFirestore(item, user, isAdminOverride);
    createdCount += 1;
  }
  return createdCount;
}

/**
 * 제안 상태, 담당자, 마감일, 피드백, 알림 설정 업데이트
 */
export async function updateSuggestionInFirestore(
  suggestionId: string,
  updates: {
    status?: SuggestionStatus;
    assignedTo?: string;
    assignedToId?: string;
    dueDate?: string;
    deadlineAlertEnabled?: boolean;
    deadlineAlertDays?: number;
    adminFeedback?: string;
    completedAt?: string;
  }
): Promise<void> {
  const safeId = sanitizeId(suggestionId, 'SUG');
  const docPath = `suggestions/${safeId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.assignedTo !== undefined) {
    payload.assignedTo = clampString(updates.assignedTo, MAX_ASSIGNED_TO_LENGTH);
  }
  if (updates.assignedToId !== undefined) {
    payload.assignedToId = clampString(updates.assignedToId, MAX_ASSIGNED_TO_ID_LENGTH);
  }
  if (updates.dueDate !== undefined) {
    payload.dueDate = sanitizeDueDate(updates.dueDate);
  }
  if (updates.deadlineAlertEnabled !== undefined) {
    payload.deadlineAlertEnabled = Boolean(updates.deadlineAlertEnabled);
  }
  if (updates.deadlineAlertDays !== undefined) {
    payload.deadlineAlertDays = Math.min(30, Math.max(0, Math.round(updates.deadlineAlertDays)));
  }
  if (updates.adminFeedback !== undefined) {
    payload.adminFeedback = clampString(updates.adminFeedback, MAX_FEEDBACK_LENGTH);
  }
  if (updates.completedAt !== undefined) {
    payload.completedAt = clampString(updates.completedAt, MAX_COMPLETED_AT_LENGTH);
  }

  try {
    await updateDoc(doc(db, 'suggestions', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}
