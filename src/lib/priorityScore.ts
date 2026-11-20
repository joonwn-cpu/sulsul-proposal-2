import {
  BreweryProcess,
  PriorityBreakdown,
  PriorityLevel,
  Suggestion,
  SuggestionCategory,
} from '../types/brewery';
import { CATEGORY_CONFIG, PROCESS_CONFIG, normalizeProcess } from '../data/mockBreweryData';

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
 * 양조2팀 제품공정 영향도 가중치 (6 ~ 10점)
 * - RFC(RFC): 10점 (세병·충진·타전 핵심 병목 설비)
 * - 검사(INSPECTION): 9점 (이물·액위·캡 품질 유출 차단)
 * - 라벨러(LABELER): 8점 (라벨 부착 및 유통기한 날인 품질)
 * - 파트장(PART_LEADER): 8점 (공정 설비·품질 연계 관리)
 * - 반장(TEAM_LEADER): 8점 (현장 반 운영 및 라인 조율)
 * - 포장기(PACKER): 7점 (케이스 패킹 및 출하 마감 라인)
 * - 관리자(ADMIN): 7점 (공정 총괄 및 운영 개선)
 * - DP(DEPALLETIZER): 6점 (공병 공급 및 초기 투입 라인)
 */
export const PROCESS_IMPORTANCE_SCORES: Record<
  BreweryProcess,
  { score: number; reason: string }
> = {
  RFC: { score: 10, reason: '세병·충진·타전 핵심 병목 설비' },
  INSPECTION: { score: 9, reason: '이물·액위·캡 불량 유출 차단 핵심 검사' },
  LABELER: { score: 8, reason: '라벨 부착 및 표시사항·날인 품질 관리' },
  PACKER: { score: 7, reason: '자동 박싱·팔레타이징 출하 공정' },
  DEPALLETIZER: { score: 6, reason: 'DP 공병 공급 및 초기 인피드 라인' },
  PART_LEADER: { score: 8, reason: '파트장 공정 설비·품질 연계 관리' },
  TEAM_LEADER: { score: 8, reason: '반장 현장 반 운영 및 라인 조율' },
  ADMIN: { score: 7, reason: '관리자 공정 총괄 및 운영 개선' },
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
 * 제안의 긴급도(isUrgent: 50), 카테고리 심각도(10~40), 공정 영향도(6~10)를 기반으로 우선순위 점수(0~100) 계산
 */
export function calculatePriorityBreakdown(input: {
  isUrgent: boolean;
  category: SuggestionCategory;
  process: BreweryProcess;
}): PriorityBreakdown {
  const urgencyScore = input.isUrgent ? URGENCY_SCORE_WEIGHT : 0;

  const categoryInfo =
    CATEGORY_SEVERITY_SCORES[input.category] ||
    CATEGORY_SEVERITY_SCORES.PROCESS_IMPROVEMENT;
  const categoryScore = categoryInfo.score;
  const categoryLabel =
    CATEGORY_CONFIG[input.category]?.shortLabel || input.category;

  const safeProcess = normalizeProcess(input.process);
  const processInfo =
    PROCESS_IMPORTANCE_SCORES[safeProcess] || PROCESS_IMPORTANCE_SCORES.RFC;
  const processScore = processInfo.score;
  const processLabel = PROCESS_CONFIG[safeProcess]?.label || safeProcess;

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
  const safeProcess = normalizeProcess(suggestion.process);
  const safeAuthorProcess = normalizeProcess(suggestion.authorProcess);
  const breakdown = calculatePriorityBreakdown({
    isUrgent: suggestion.isUrgent,
    category: suggestion.category,
    process: safeProcess,
  });

  return {
    ...suggestion,
    process: safeProcess,
    authorProcess: safeAuthorProcess,
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
 */
export function sortSuggestions(
  list: Suggestion[],
  mode: SuggestionSortMode = 'PRIORITY_DESC'
): Suggestion[] {
  const enriched = list.map(item =>
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

    if (scoreB !== scoreA) return scoreB - scoreA;
    const isDoneA = a.status === 'COMPLETED' || a.status === 'REJECTED' ? 1 : 0;
    const isDoneB = b.status === 'COMPLETED' || b.status === 'REJECTED' ? 1 : 0;
    if (isDoneA !== isDoneB) return isDoneA - isDoneB;

    return b.createdAt.localeCompare(a.createdAt);
  });
}
