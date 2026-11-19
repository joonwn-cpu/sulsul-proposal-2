import {
  BreweryProcess,
  PriorityBreakdown,
  PriorityLevel,
  Suggestion,
  SuggestionCategory,
} from '../types/brewery';
import { CATEGORY_CONFIG, PROCESS_CONFIG } from '../data/mockBreweryData';

/**
 * 긴급도(isUrgent) 가중치: 긴급 50점 / 일반 0점
 */
export const URGENCY_SCORE_WEIGHT = 50;

/**
 * 카테고리 심각도 가중치 (10 ~ 40점)
 * - 위험성평가(RISK_ASSESSMENT): 40점
 * - 고장정비(BREAKDOWN_REPAIR): 30점
 * - 예방정비(PREVENTIVE_MAINT): 20점
 * - 공정개선(PROCESS_IMPROVEMENT): 10점
 */
export const CATEGORY_SEVERITY_SCORES: Record<
  SuggestionCategory,
  { score: number; reason: string }
> = {
  RISK_ASSESSMENT: { score: 40, reason: '안전/아차사고 인명 위험' },
  BREAKDOWN_REPAIR: { score: 30, reason: '설비 고장 및 라인 가동 중단' },
  PREVENTIVE_MAINT: { score: 20, reason: '사전 징후 선제 예방 정비' },
  PROCESS_IMPROVEMENT: { score: 10, reason: '생산성/수율 공정 개선' },
};

/**
 * 공정 영향도 가중치 (최대 10점)
 * - 병입(BOTTLING): 10점 (최종 출하 병목 라인 및 유리병·살균 설비)
 * - 발효(FERMENTATION): 9점 (품온·미생물 관리 핵심 공정)
 * - 여과(FILTRATION): 7점 (고압 압착·규조토 필터 안전/수율)
 * - 담금(MASHING): 6점 (원료 증자·주모 품질 결정)
 * - 제국(MALTING): 5점 (누룩/입국 온·습도 배양)
 * - 제성(REFINING): 4점 (도수 보정 및 블렌딩 저장)
 * - 기타(OTHER): 2점 (공통 유틸리티 및 설비 지원)
 */
export const PROCESS_IMPORTANCE_SCORES: Record<
  BreweryProcess,
  { score: number; reason: string }
> = {
  BOTTLING: { score: 10, reason: '출하 직결 병목 라인 및 살균·충진' },
  FERMENTATION: { score: 9, reason: '발효 품온/오염 직결 핵심 공정' },
  FILTRATION: { score: 7, reason: '고압 압착·여과 수율 및 바닥 안전' },
  MASHING: { score: 6, reason: '주모·원료 증자 초기 품질 결정' },
  MALTING: { score: 5, reason: '제국실 온·습도 배양 관리' },
  REFINING: { score: 4, reason: '도수 보정 및 제성 저장 공정' },
  OTHER: { score: 2, reason: '공통 유틸리티 및 설비 지원' },
};

/**
 * 우선순위 등급 메타데이터
 */
export const PRIORITY_LEVEL_CONFIG: Record<
  PriorityLevel,
  { label: string; badgeClass: string; barColor: string; textColor: string }
> = {
  CRITICAL: {
    label: '최우선',
    badgeClass: 'bg-rose-600 text-white border-rose-700',
    barColor: 'bg-rose-600',
    textColor: 'text-rose-700',
  },
  HIGH: {
    label: '높음',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    barColor: 'bg-orange-500',
    textColor: 'text-orange-700',
  },
  MEDIUM: {
    label: '보통',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    barColor: 'bg-amber-500',
    textColor: 'text-amber-700',
  },
  LOW: {
    label: '낮음',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    barColor: 'bg-slate-400',
    textColor: 'text-slate-600',
  },
};

/**
 * 제안의 긴급도(isUrgent: 50), 카테고리 심각도(10~40), 공정 영향도(2~10)를 기반으로 우선순위 점수(0~100) 계산
 */
export function calculatePriorityBreakdown(input: {
  isUrgent: boolean;
  category: SuggestionCategory;
  process: BreweryProcess;
}): PriorityBreakdown {
  // 1. 긴급도 점수 (50점 또는 0점)
  const urgencyScore = input.isUrgent ? URGENCY_SCORE_WEIGHT : 0;

  // 2. 카테고리 심각도 점수 (10 ~ 40점)
  const categoryInfo =
    CATEGORY_SEVERITY_SCORES[input.category] ||
    CATEGORY_SEVERITY_SCORES.PROCESS_IMPROVEMENT;
  const categoryScore = categoryInfo.score;
  const categoryLabel =
    CATEGORY_CONFIG[input.category]?.shortLabel || input.category;

  // 3. 공정 영향도 점수 (2 ~ 10점)
  const processInfo =
    PROCESS_IMPORTANCE_SCORES[input.process] || PROCESS_IMPORTANCE_SCORES.OTHER;
  const processScore = processInfo.score;
  const processLabel = PROCESS_CONFIG[input.process]?.label || input.process;

  // 4. 총점 및 등급 산정
  const totalScore = Math.min(100, urgencyScore + categoryScore + processScore);

  let level: PriorityLevel = 'LOW';
  if (totalScore >= 80) {
    level = 'CRITICAL';
  } else if (totalScore >= 50) {
    level = 'HIGH';
  } else if (totalScore >= 25) {
    level = 'MEDIUM';
  }

  return {
    totalScore,
    level,
    urgencyScore,
    categoryScore,
    processScore,
    categoryLabel,
    processLabel,
  };
}

/**
 * 제안 객체에 최신 priorityScore 및 산정 내역 부여
 */
export function enrichSuggestionWithPriority(suggestion: Suggestion): Suggestion {
  const breakdown = calculatePriorityBreakdown({
    isUrgent: suggestion.isUrgent,
    category: suggestion.category,
    process: suggestion.process,
  });

  return {
    ...suggestion,
    priorityScore: breakdown.totalScore,
    priorityBreakdown: breakdown,
  };
}

export type SuggestionSortMode =
  | 'PRIORITY_DESC'
  | 'PRIORITY_ASC'
  | 'LATEST_DESC';

/**
 * 대시보드 제안 리스트 정렬 유틸리티
 * - PRIORITY_DESC (기본): priorityScore 높은 순 (동점 시 미완료 우선 -> 최신순)
 * - PRIORITY_ASC: priorityScore 낮은 순
 * - LATEST_DESC: 최신 등록순
 */
export function sortSuggestions(
  list: Suggestion[],
  mode: SuggestionSortMode = 'PRIORITY_DESC'
): Suggestion[] {
  const enriched = list.map((item) =>
    item.priorityBreakdown && typeof item.priorityScore === 'number'
      ? item
      : enrichSuggestionWithPriority(item)
  );

  return [...enriched].sort((a, b) => {
    const scoreA = a.priorityScore ?? 0;
    const scoreB = b.priorityScore ?? 0;

    if (mode === 'LATEST_DESC') {
      return b.createdAt.localeCompare(a.createdAt);
    }

    if (mode === 'PRIORITY_ASC') {
      if (scoreA !== scoreB) return scoreA - scoreB;
      return b.createdAt.localeCompare(a.createdAt);
    }

    // Default: PRIORITY_DESC
    if (scoreB !== scoreA) return scoreB - scoreA;
    const isDoneA = a.status === 'COMPLETED' || a.status === 'REJECTED' ? 1 : 0;
    const isDoneB = b.status === 'COMPLETED' || b.status === 'REJECTED' ? 1 : 0;
    if (isDoneA !== isDoneB) return isDoneA - isDoneB;

    return b.createdAt.localeCompare(a.createdAt);
  });
}
