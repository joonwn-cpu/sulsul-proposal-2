import {
  BreweryProcess,
  BreweryWorker,
  Suggestion,
  SuggestionCategory,
  SuggestionStatus,
  UserRole,
} from '../types/brewery';

export const PROCESS_ORDER: BreweryProcess[] = [
  'DEPALLETIZER',
  'RFC',
  'LABELER',
  'PACKER',
  'INSPECTION',
  'PART_LEADER',
  'TEAM_LEADER',
  'ADMIN',
];

export const ROLE_ORDER: UserRole[] = [
  'WORKER',
  'PART_LEADER',
  'TEAM_LEADER',
  'ADMIN',
];

// 직책/권한 메타 정보 (일반 담당, 파트장, 반장, 관리자)
export const ROLE_CONFIG: Record<
  UserRole,
  { label: string; shortLabel: string; desc: string }
> = {
  WORKER: {
    label: '일반 담당',
    shortLabel: '일반 담당',
    desc: '현장 제안 등록, 고장 신고 및 진행 현황 확인',
  },
  PART_LEADER: {
    label: '파트장',
    shortLabel: '파트장',
    desc: '담당 공정 설비·품질 관리 및 1차 점검',
  },
  TEAM_LEADER: {
    label: '반장',
    shortLabel: '반장',
    desc: '양조2팀 제품공정 현장 반 운영 및 조치 검토',
  },
  ADMIN: {
    label: '관리자',
    shortLabel: '관리자',
    desc: '전체 제안 총괄 관리, 계정 발급 및 권한 설정',
  },
};

// 4대 카테고리 메타 정보
export const CATEGORY_CONFIG: Record<
  SuggestionCategory,
  {
    label: string;
    shortLabel: string;
    color: string;
    bgLight: string;
    border: string;
    desc: string;
    isUrgentDefault: boolean;
  }
> = {
  PROCESS_IMPROVEMENT: {
    label: '공정개선 (아이디어)',
    shortLabel: '공정개선',
    color: 'text-amber-700',
    bgLight: 'bg-amber-50',
    border: 'border-amber-300',
    desc: '라인 가동률 향상, 품목 전환 시간 단축, 자재 로스 절감 등',
    isUrgentDefault: false,
  },
  BREAKDOWN_REPAIR: {
    label: '고장정비 (즉시 수리)',
    shortLabel: '고장정비',
    color: 'text-rose-700',
    bgLight: 'bg-rose-50',
    border: 'border-rose-300',
    desc: 'RFC 충진·타전 정지, 라벨러·검사기 센서 오작동, 포장기 잼 등 즉각 조치',
    isUrgentDefault: true,
  },
  PREVENTIVE_MAINT: {
    label: '예방정비 (사전 알림)',
    shortLabel: '예방정비',
    color: 'text-blue-700',
    bgLight: 'bg-blue-50',
    border: 'border-blue-300',
    desc: '공압 실린더 누기, 컨베이어 가이드 마모, 노즐·벨트 교체 주기 도래 등',
    isUrgentDefault: false,
  },
  RISK_ASSESSMENT: {
    label: '위험성평가 (아차사고)',
    shortLabel: '위험성평가',
    color: 'text-orange-700',
    bgLight: 'bg-orange-50',
    border: 'border-orange-300',
    desc: '회전부 협착 위험, 공병 파손 비산, 바닥 세척수 미끄럼 등 아차사고',
    isUrgentDefault: true,
  },
};

// 양조2팀 제품공정 담당 공정 메타 정보 (DP, RFC, 라벨러, 포장기, 검사, 파트장, 반장, 관리자)
export const PROCESS_CONFIG: Record<
  BreweryProcess,
  { label: string; shortLabel: string; desc: string; icon: string; zone: string }
> = {
  DEPALLETIZER: {
    label: 'DP',
    shortLabel: 'DP',
    desc: '공병 투입, 디팔레타이저 및 인피드 컨베이어 공급',
    icon: '🏗️',
    zone: '양조2팀 제품공정 DP 구역',
  },
  RFC: {
    label: 'RFC',
    shortLabel: 'RFC',
    desc: '세병(Rinser)·충진(Filler)·타전(Capper) 통합 핵심 설비',
    icon: '🍾',
    zone: '양조2팀 제품공정 RFC 구역',
  },
  LABELER: {
    label: '라벨러',
    shortLabel: '라벨러',
    desc: '자동 라벨 부착, 제조일자 날인기 및 바코드 확인',
    icon: '🏷️',
    zone: '양조2팀 제품공정 라벨러 구역',
  },
  PACKER: {
    label: '포장기',
    shortLabel: '포장기',
    desc: '케이스 패커, 봉함기, 팔레타이저 및 출하 적재',
    icon: '📦',
    zone: '양조2팀 제품공정 포장기 구역',
  },
  INSPECTION: {
    label: '검사',
    shortLabel: '검사',
    desc: '이물·액위·캡 불량 비전 검사 및 품질 리젝트 관리',
    icon: '🔍',
    zone: '양조2팀 제품공정 검사 구역',
  },
  PART_LEADER: {
    label: '파트장',
    shortLabel: '파트장',
    desc: '담당 공정 설비·품질 관리 및 현장 1차 점검 총괄',
    icon: '🧭',
    zone: '양조2팀 제품공정 파트장 관리',
  },
  TEAM_LEADER: {
    label: '반장',
    shortLabel: '반장',
    desc: '양조2팀 제품공정 현장 반 운영 및 조치 조율',
    icon: '📋',
    zone: '양조2팀 제품공정 반장 관리',
  },
  ADMIN: {
    label: '관리자',
    shortLabel: '관리자',
    desc: '양조2팀 제품공정 제안 총괄 및 운영 관리',
    icon: '🛡️',
    zone: '양조2팀 제품공정 관리자',
  },
};

// 레거시 공정 문자열 안전 정규화
export function normalizeProcess(raw: unknown): BreweryProcess {
  const val = String(raw || '').trim().toUpperCase();
  if (
    val === 'DEPALLETIZER' ||
    val === 'RFC' ||
    val === 'LABELER' ||
    val === 'PACKER' ||
    val === 'INSPECTION' ||
    val === 'PART_LEADER' ||
    val === 'TEAM_LEADER' ||
    val === 'ADMIN'
  ) {
    return val;
  }
  if (val === 'DP' || val === 'MALTING' || val === 'MASHING') return 'DEPALLETIZER';
  if (val === 'FERMENTATION' || val === 'FILTRATION' || val === 'REFINING') return 'RFC';
  if (val === 'BOTTLING') return 'PACKER';
  return 'RFC';
}

// 레거시 역할 문자열 안전 정규화
export function normalizeRole(raw: unknown): UserRole {
  const val = String(raw || '').toUpperCase();
  if (val === 'ADMIN' || val === 'TEAM_LEADER' || val === 'PART_LEADER' || val === 'WORKER') {
    return val;
  }
  if (val === 'MAINTENANCE') return 'PART_LEADER';
  return 'WORKER';
}

// 상태 메타 정보
export const STATUS_CONFIG: Record<
  SuggestionStatus,
  { label: string; badgeClass: string; dotColor: string }
> = {
  PENDING: {
    label: '대기중',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    dotColor: 'bg-slate-400',
  },
  REVIEWING: {
    label: '검토중',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    dotColor: 'bg-amber-500',
  },
  IN_PROGRESS: {
    label: '조치중',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    dotColor: 'bg-sky-500',
  },
  COMPLETED: {
    label: '완료',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    dotColor: 'bg-emerald-500',
  },
  REJECTED: {
    label: '반려',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    dotColor: 'bg-rose-500',
  },
};

// 초기 직원 목록 (샘플 인원 미포함 - 실제 등록 계정만 사용)
export const INITIAL_WORKERS: BreweryWorker[] = [];

// 자주 발생하는 양조2팀 제품공정 퀵 체크리스트 (음성/터치 입력 지원)
export const QUICK_ISSUE_CHECKLISTS: Record<SuggestionCategory, string[]> = {
  PROCESS_IMPROVEMENT: [
    'RFC 품목 전환 시 가이드 조정 시간 10분 단축안',
    '라벨러 롤 교체 지그 설치로 로스 최소화',
    '검사기 리젝트 슈트 완충 패드 개선',
    '포장기 박스 공급 매거진 정렬 가이드 보완',
  ],
  BREAKDOWN_REPAIR: [
    'RFC 로터리 타전기 공압 실린더 압력 저하 정지',
    '라벨러 1호기 광센서 오감지로 라벨 밀림 발생',
    'DP 리프트 체인 센서 인터락 알람',
    '포장기 케이스 실러 테이프 헤드 걸림 정지',
  ],
  PREVENTIVE_MAINT: [
    'RFC 충진 밸브 씰 패킹 마모 사전 교체 필요',
    '검사기 비전 카메라 조명 조도 저하 점검',
    'DP 인피드 컨베이어 가이드 마모 점검',
    '라벨러 날인기 잉크 필터 정기 교체 주기 도래',
  ],
  RISK_ASSESSMENT: [
    'DP 공병 파손 비산 방호 커버 보강 필요',
    'RFC 하부 세척수 고임으로 통로 바닥 미끄럼 위험',
    '포장기 진입부 회전 롤러 협착 방지 가드 유격',
    '검사기 리젝트 병 수거 박스 적재 높이 전도 위험',
  ],
};

// 초기 제안 목록 (샘플 제안 미포함 - 실제 등록 제안만 사용)
export const INITIAL_SUGGESTIONS: Suggestion[] = [];
