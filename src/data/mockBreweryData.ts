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

// 양조2팀 전체 공정(DP, RFC, 라벨러, 포장기, 검사, 파트장, 반장, 관리자) 항목별 제안 예시 (제안자: 관리자 허준원)
export const PROCESS_EXAMPLE_SUGGESTIONS: Suggestion[] = [
  {
    id: 'SUG-EX-DP',
    title: 'DP 공병 투입구 파손 병 비산 방호 커버 보강 및 안전 가이드 설치',
    description:
      '공병 팔레트 층간 패드 제거 시 측면 가이드 간섭으로 유리병 파손 및 파편 비산 위험이 있어 전면 투명 폴리카보네이트 방호 커버를 연장 설치하고 바닥 안전 가이드를 보강했습니다.',
    category: 'RISK_ASSESSMENT',
    process: 'DEPALLETIZER',
    locationDetail: '양조2팀 제품공정 DP 인피드 좌측 구간',
    authorId: 'ADMIN01',
    authorName: '허준원 관리자',
    authorProcess: 'ADMIN',
    status: 'COMPLETED',
    isUrgent: true,
    urgencyReason: '공병 파손 비산으로 인한 작업자 베임 및 바닥 미끄럼 위험',
    assignedTo: '허준원 관리자',
    assignedToId: 'ADMIN01',
    dueDate: '2026-11-25',
    deadlineAlertEnabled: false,
    deadlineAlertDays: 2,
    adminFeedback: 'DP 인피드 방호 커버 보강 및 안전 가이드 설치 완료 확인.',
    attachments: [],
    quickTags: ['DP 공병 파손 비산 방호 커버 보강 필요'],
    createdAt: '2026-11-18 09:10:00',
    updatedAt: '2026-11-20 15:30:00',
    completedAt: '2026-11-20 15:30:00',
    isOfflineSynced: true,
    historyLogs: [
      {
        id: 'log-ex-dp-1',
        fromStatus: 'PENDING',
        toStatus: 'COMPLETED',
        changedBy: '허준원 관리자',
        changedById: 'ADMIN01',
        changedAt: '2026-11-20 15:30:00',
        comment: 'DP 공정 방호 커버 보강 및 현장 안전 점검 완료',
      },
    ],
  },
  {
    id: 'SUG-EX-RFC',
    title: 'RFC 1호기 로터리 타전기 공압 실린더 압력 저하 점검 및 패킹 교체',
    description:
      '제품 충진 후 타전 공정에서 압착 압력이 일시적으로 저하되는 현상이 확인되어 솔레노이드 밸브 및 공압 실린더 씰 패킹 점검과 예비 키트 교체를 진행 중입니다.',
    category: 'BREAKDOWN_REPAIR',
    process: 'RFC',
    locationDetail: '양조2팀 제품공정 RFC 1호기 로터리 타전기',
    authorId: 'ADMIN01',
    authorName: '허준원 관리자',
    authorProcess: 'ADMIN',
    status: 'IN_PROGRESS',
    isUrgent: true,
    urgencyReason: 'RFC 핵심 설비 압력 저하 시 캡 밀봉 불량 및 라인 정지 우려',
    assignedTo: '허준원 관리자',
    assignedToId: 'ADMIN01',
    dueDate: '2026-11-24',
    deadlineAlertEnabled: true,
    deadlineAlertDays: 2,
    adminFeedback: '예비 실린더 패킹 불출 완료, 비가동 시간대 교체 조치 진행 중.',
    attachments: [],
    quickTags: ['RFC 로터리 타전기 공압 실린더 압력 저하 정지'],
    createdAt: '2026-11-21 08:30:00',
    updatedAt: '2026-11-21 10:15:00',
    isOfflineSynced: true,
    historyLogs: [
      {
        id: 'log-ex-rfc-1',
        fromStatus: 'PENDING',
        toStatus: 'IN_PROGRESS',
        changedBy: '허준원 관리자',
        changedById: 'ADMIN01',
        changedAt: '2026-11-21 10:15:00',
        comment: 'RFC 타전기 압력 점검 및 패킹 교체 작업 배정',
      },
    ],
  },
  {
    id: 'SUG-EX-LABELER',
    title: '라벨러 1호기 광센서 결로 방지 에어 블로우 추가 및 날인기 필터 교체',
    description:
      '세척 후 고습 환경에서 라벨러 감지 센서 렌즈에 결로가 발생해 라벨 위치가 밀리는 현상을 예방하기 위해 에어 블로우 노즐을 추가하고 날인기 잉크 필터를 선제 교체했습니다.',
    category: 'PREVENTIVE_MAINT',
    process: 'LABELER',
    locationDetail: '양조2팀 제품공정 라벨러 1호기 센서·날인부',
    authorId: 'ADMIN01',
    authorName: '허준원 관리자',
    authorProcess: 'ADMIN',
    status: 'COMPLETED',
    isUrgent: false,
    assignedTo: '허준원 관리자',
    assignedToId: 'ADMIN01',
    dueDate: '2026-11-20',
    deadlineAlertEnabled: false,
    deadlineAlertDays: 2,
    adminFeedback: '에어 블로우 장착 및 필터 교체 후 라벨 부착 정밀도 정상 확인.',
    attachments: [],
    quickTags: ['라벨러 날인기 잉크 필터 정기 교체 주기 도래'],
    createdAt: '2026-11-16 11:20:00',
    updatedAt: '2026-11-19 14:00:00',
    completedAt: '2026-11-19 14:00:00',
    isOfflineSynced: true,
    historyLogs: [
      {
        id: 'log-ex-labeler-1',
        fromStatus: 'PENDING',
        toStatus: 'COMPLETED',
        changedBy: '허준원 관리자',
        changedById: 'ADMIN01',
        changedAt: '2026-11-19 14:00:00',
        comment: '예방정비 조치 완료 및 센서 감도 테스트 통과',
      },
    ],
  },
  {
    id: 'SUG-EX-PACKER',
    title: '포장기 케이스 패커 박스 매거진 정렬 가이드 미세 조절 스토퍼 장착',
    description:
      '박스 투입 시 매거진 하단 가이드 유격으로 간헐적 박스 걸림이 발생하는 구간에 눈금형 미세 조절 스토퍼를 장착하여 품목 전환 시 정렬 시간을 단축할 수 있습니다.',
    category: 'PROCESS_IMPROVEMENT',
    process: 'PACKER',
    locationDetail: '양조2팀 제품공정 포장기 1라인 케이스 패커',
    authorId: 'ADMIN01',
    authorName: '허준원 관리자',
    authorProcess: 'ADMIN',
    status: 'PENDING',
    isUrgent: false,
    dueDate: '2026-11-28',
    deadlineAlertEnabled: false,
    deadlineAlertDays: 2,
    attachments: [],
    quickTags: ['포장기 박스 공급 매거진 정렬 가이드 보완'],
    createdAt: '2026-11-22 09:00:00',
    updatedAt: '2026-11-22 09:00:00',
    isOfflineSynced: true,
    historyLogs: [],
  },
  {
    id: 'SUG-EX-INSPECTION',
    title: '검사기 리젝트 슈트 실리콘 완충 패드 적용으로 정상병 회수 파손 저감',
    description:
      '이물·액위 검사기 리젝트 시 슈트 끝단 충격으로 병목 스크래치가 발생하던 구간에 식품용 실리콘 완충 패드를 적용하여 재투입 회수율을 높이고 파손 0건을 달성했습니다.',
    category: 'PROCESS_IMPROVEMENT',
    process: 'INSPECTION',
    locationDetail: '양조2팀 제품공정 검사기 1라인 리젝트 테이블',
    authorId: 'ADMIN01',
    authorName: '허준원 관리자',
    authorProcess: 'ADMIN',
    status: 'COMPLETED',
    isUrgent: false,
    assignedTo: '허준원 관리자',
    assignedToId: 'ADMIN01',
    dueDate: '2026-11-15',
    deadlineAlertEnabled: false,
    deadlineAlertDays: 2,
    adminFeedback: '검사 라인 전체 동일 사양 적용 완료.',
    attachments: [],
    quickTags: ['검사기 리젝트 슈트 완충 패드 개선'],
    createdAt: '2026-11-12 13:40:00',
    updatedAt: '2026-11-15 17:10:00',
    completedAt: '2026-11-15 17:10:00',
    isOfflineSynced: true,
    historyLogs: [
      {
        id: 'log-ex-insp-1',
        fromStatus: 'PENDING',
        toStatus: 'COMPLETED',
        changedBy: '허준원 관리자',
        changedById: 'ADMIN01',
        changedAt: '2026-11-15 17:10:00',
        comment: '실리콘 완충 패드 설치 완료 및 품질 검증 종료',
      },
    ],
  },
  {
    id: 'SUG-EX-PART',
    title: '파트장 교대 인수인계 시 라인별 핵심 설비·센서 사전 점검 체크시트 표준화',
    description:
      '교대 시간마다 DP·RFC·라벨러·포장기·검사기 공압 및 센서 상태를 파트장이 5분 내 공통 항목으로 점검할 수 있도록 표준 체크시트와 이상 징후 기록 절차를 정비합니다.',
    category: 'PREVENTIVE_MAINT',
    process: 'PART_LEADER',
    locationDetail: '양조2팀 제품공정 전 라인 파트장 인수인계 구역',
    authorId: 'ADMIN01',
    authorName: '허준원 관리자',
    authorProcess: 'ADMIN',
    status: 'REVIEWING',
    isUrgent: false,
    assignedTo: '허준원 관리자',
    assignedToId: 'ADMIN01',
    dueDate: '2026-11-27',
    deadlineAlertEnabled: false,
    deadlineAlertDays: 2,
    adminFeedback: '파트장 회의에서 점검 항목 최종 검토 중입니다.',
    attachments: [],
    quickTags: ['파트장 교대 설비 사전 점검 표준화'],
    createdAt: '2026-11-19 10:20:00',
    updatedAt: '2026-11-20 11:00:00',
    isOfflineSynced: true,
    historyLogs: [
      {
        id: 'log-ex-part-1',
        fromStatus: 'PENDING',
        toStatus: 'REVIEWING',
        changedBy: '허준원 관리자',
        changedById: 'ADMIN01',
        changedAt: '2026-11-20 11:00:00',
        comment: '표준 체크시트 초안 작성 및 파트장 의견 수렴 시작',
      },
    ],
  },
  {
    id: 'SUG-EX-TEAM',
    title: '반장 주관 제품공정 세척수 배수로 그레이팅 보수 및 미끄럼 방지 구역 확대',
    description:
      '라인 물세척 후 이동 통로 배수로 그레이팅 단차와 세척수 고임으로 전도 아차사고 우려가 있어 반장 주관으로 단차 보수 및 논슬립 매트 구역을 확대 적용했습니다.',
    category: 'RISK_ASSESSMENT',
    process: 'TEAM_LEADER',
    locationDetail: '양조2팀 제품공정 중앙 세척 이동 통로',
    authorId: 'ADMIN01',
    authorName: '허준원 관리자',
    authorProcess: 'ADMIN',
    status: 'COMPLETED',
    isUrgent: true,
    urgencyReason: '세척수 고임 구간 작업자 보행 중 미끄럼 전도 위험',
    assignedTo: '허준원 관리자',
    assignedToId: 'ADMIN01',
    dueDate: '2026-11-18',
    deadlineAlertEnabled: false,
    deadlineAlertDays: 2,
    adminFeedback: '배수로 그레이팅 수평 보수 및 논슬립 매트 설치 완료.',
    attachments: [],
    quickTags: ['RFC 하부 세척수 고임으로 통로 바닥 미끄럼 위험'],
    createdAt: '2026-11-14 07:50:00',
    updatedAt: '2026-11-18 16:40:00',
    completedAt: '2026-11-18 16:40:00',
    isOfflineSynced: true,
    historyLogs: [
      {
        id: 'log-ex-team-1',
        fromStatus: 'PENDING',
        toStatus: 'COMPLETED',
        changedBy: '허준원 관리자',
        changedById: 'ADMIN01',
        changedAt: '2026-11-18 16:40:00',
        comment: '현장 안전 개선 조치 완료 및 반장 최종 확인',
      },
    ],
  },
  {
    id: 'SUG-EX-ADMIN',
    title: '양조2팀 월간 설비 고장·예방정비 이력 연계 핵심 예비품 안전재고 알림 기준 수립',
    description:
      '술술제안에 누적되는 설비별 고장정비·예방정비 이력을 바탕으로 소모성 부품(씰 패킹, 센서, 필터 등)의 월간 소모 주기를 집계해 안전재고 부족 시 선제 발주하는 관리 기준을 제안합니다.',
    category: 'PROCESS_IMPROVEMENT',
    process: 'ADMIN',
    locationDetail: '양조2팀 제품공정 관리자 운영실 및 자재창고',
    authorId: 'ADMIN01',
    authorName: '허준원 관리자',
    authorProcess: 'ADMIN',
    status: 'PENDING',
    isUrgent: false,
    dueDate: '2026-11-30',
    deadlineAlertEnabled: false,
    deadlineAlertDays: 2,
    attachments: [],
    quickTags: ['핵심 예비품 안전재고 관리 기준 수립'],
    createdAt: '2026-11-22 10:00:00',
    updatedAt: '2026-11-22 10:00:00',
    isOfflineSynced: true,
    historyLogs: [],
  },
];

// 초기 제안 목록 (양조2팀 8개 담당 공정 항목별 제안 예시)
export const INITIAL_SUGGESTIONS: Suggestion[] = PROCESS_EXAMPLE_SUGGESTIONS;
