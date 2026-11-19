/**
 * 탁·약주 제조 현장 스마트 제안관리 시스템 ('술술제안') 타입 정의
 */

// 4대 제안 카테고리
export type SuggestionCategory = 
  | 'PROCESS_IMPROVEMENT'   // 공정개선 (발효 수율, CIP 시간 단축 등)
  | 'BREAKDOWN_REPAIR'     // 고장정비 (교반기 모터 정지, 병입기 센서 오작동 등 - 긴급)
  | 'PREVENTIVE_MAINT'     // 예방정비 (배관 누수 징후, 필터 교체 주기 도래 등)
  | 'RISK_ASSESSMENT';     // 위험성평가 (미끄럼, 협착, 아차사고 요인 등 - 긴급)

// 주류 제조 주요 공정 (탁·약주 기준)
export type BreweryProcess = 
  | 'MALTING'      // 제국 (누룩/입국 제조 및 온도·습도 관리)
  | 'MASHING'      // 담금 (원료 쌀 침지, 찌기, 주모 및 본담금)
  | 'FERMENTATION' // 발효 (1차/2차 발효조 품온 및 교반 관리)
  | 'FILTRATION'   // 여과 (술덧 압착, 여과기 및 규조토 필터링)
  | 'REFINING'     // 제성 (알코올 도수 조정, 배합 및 제성 탱크)
  | 'BOTTLING'     // 병입 (살균기, 병세척, 충진, 캡핑, 라벨링, 포장)
  | 'OTHER';       // 기타 (유틸리티, 용수, 보일러, CIP 세척실 등)

// 제안 진행 상태
export type SuggestionStatus = 
  | 'PENDING'      // 대기중
  | 'REVIEWING'    // 검토중
  | 'IN_PROGRESS'  // 조치중
  | 'COMPLETED'    // 완료
  | 'REJECTED';    // 반려

// 사용자 권한 역할
export type UserRole = 
  | 'WORKER'       // 현장 작업자 (27명)
  | 'ADMIN'        // 제품팀 관리자
  | 'MAINTENANCE'; // 공무/안전 담당자

// 직원 정보
export interface BreweryWorker {
  id: string;            // 사번 (예: "240101")
  name: string;          // 이름
  process: BreweryProcess; // 주 배속 공정
  role: UserRole;
  phone: string;
  isFirstLogin: boolean; // 최초 로그인 시 비밀번호 변경 여부 (F-01)
  suggestionCount: number;
  avatarUrl?: string;
}

// 첨부 파일 정보
export interface AttachmentItem {
  id: string;
  url: string;
  name: string;
  type: 'image' | 'video';
  sizeBytes?: number;
  uploadedAt: string;
}

// 조치 및 검토 이력 로그
export interface StatusHistoryLog {
  id: string;
  fromStatus: SuggestionStatus;
  toStatus: SuggestionStatus;
  changedBy: string;      // 변경자 이름
  changedById: string;    // 변경자 사번
  changedAt: string;      // 변경 일시
  comment?: string;       // 관리자 코멘트
}

// 우선순위 등급
export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// 우선순위 점수 산정 상세 내역
export interface PriorityBreakdown {
  totalScore: number;       // 0 ~ 100점
  level: PriorityLevel;
  urgencyScore: number;     // 긴급도 점수 (isUrgent: 50점 / 일반: 0점)
  categoryScore: number;    // 카테고리 심각도 점수 (위험 40 / 고장 30 / 예방 20 / 개선 10)
  processScore: number;     // 공정 영향도 점수 (병입 10 / 발효 9 / 여과 7 / 담금 6 / 제국 5 / 제성 4 / 기타 2)
  categoryLabel: string;
  processLabel: string;
}

// 핵심 제안 문서 인터페이스
export interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  process: BreweryProcess;
  locationDetail?: string; // 예: "2호 발효조 상단 교반기", "병입 3라인 충진 노즐"
  
  // 작성자 정보
  authorId: string;       // 사번
  authorName: string;     // 작성자 이름
  authorProcess: BreweryProcess;

  // 처리 상태 및 긴급도
  status: SuggestionStatus;
  isUrgent: boolean;      // 고장정비 또는 위험성평가일 경우 자동 true (F-03)
  urgencyReason?: string;

  // 자동 계산 우선순위 점수
  priorityScore?: number;
  priorityBreakdown?: PriorityBreakdown;

  // 조치 담당 및 기한 (F-05)
  assignedTo?: string;    // 조치 담당자 (공무/안전 담당자)
  assignedToId?: string;
  dueDate?: string;       // 조치 마감일 (YYYY-MM-DD)
  deadlineAlertEnabled?: boolean; // 처리 기한 임박 알림 설정 여부
  deadlineAlertDays?: number;     // 마감일 기준 알림 임박 일수 (기본 2일 전)
  adminFeedback?: string; // 관리자 피드백 코멘트

  // 멀티미디어 첨부 (최대 3장/영상)
  attachments: AttachmentItem[];

  // 체크리스트 빠른 태그
  quickTags?: string[];
  audioTranscript?: string; // 음성 인식(STT) 원문

  // 타임스탬프
  createdAt: string;
  updatedAt: string;
  completedAt?: string;

  // 오프라인 동기화 상태 (비기능)
  isOfflineSynced?: boolean;
  historyLogs: StatusHistoryLog[];
}

// 통계 지표 데이터
export interface BreweryStats {
  totalSuggestions: number;
  workerParticipationRate: number; // 27명 중 1회 이상 등록 비율 (%)
  activeWorkersCount: number;      // 참여한 직원 수
  avgLeadTimeHours: number;        // 고장정비 접수 후 조치 완료까지의 평균 시간
  categoryCounts: Record<SuggestionCategory, number>;
  processCounts: Record<BreweryProcess, number>;
  statusCounts: Record<SuggestionStatus, number>;
  topSuggesters: {
    workerId: string;
    name: string;
    process: BreweryProcess;
    count: number;
    adoptedCount: number;
  }[];
}
