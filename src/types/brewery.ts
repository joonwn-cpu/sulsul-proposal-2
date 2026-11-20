/**
 * 양조2팀 제품공정 스마트 제안관리 시스템 ('술술제안') 타입 정의
 */

// 4대 제안 카테고리
export type SuggestionCategory =
  | 'PROCESS_IMPROVEMENT' // 공정개선 (라인 가동률, 전환 시간 단축 등)
  | 'BREAKDOWN_REPAIR' // 고장정비 (RFC 충진·타전 정지, 라벨러·포장기 센서 오작동 등 - 긴급)
  | 'PREVENTIVE_MAINT' // 예방정비 (공압 누기, 벨트/가이드 마모, 필터 교체 주기 도래 등)
  | 'RISK_ASSESSMENT'; // 위험성평가 (미끄럼, 협착, 유리병 비산, 아차사고 요인 등 - 긴급)

// 양조2팀 제품공정 담당 공정 (DP, RFC, 라벨러, 포장기, 검사, 파트장, 반장, 관리자)
export type BreweryProcess =
  | 'DEPALLETIZER' // DP (공병 공급, 디팔레타이저 및 인피드)
  | 'RFC' // RFC (세병 Rinser · 충진 Filler · 타전 Capper)
  | 'LABELER' // 라벨러 (자동 라벨 부착, 날인기 및 표시사항 확인)
  | 'PACKER' // 포장기 (케이스 패커, 봉함, 팔레타이징 및 출하 포장)
  | 'INSPECTION' // 검사 (이물 · 액위 · 캡 · 비전 및 품질 검사)
  | 'PART_LEADER' // 파트장 (공정 설비·품질 관리 및 1차 점검)
  | 'TEAM_LEADER' // 반장 (현장 반 운영 및 조치 조율)
  | 'ADMIN'; // 관리자 (공정 제안 총괄 및 운영 관리)

// 제안 진행 상태
export type SuggestionStatus =
  | 'PENDING' // 대기중
  | 'REVIEWING' // 검토중
  | 'IN_PROGRESS' // 조치중
  | 'COMPLETED' // 완료
  | 'REJECTED'; // 반려

// 직책/권한 (일반 담당, 파트장, 반장, 관리자)
export type UserRole =
  | 'WORKER' // 일반 담당
  | 'PART_LEADER' // 파트장
  | 'TEAM_LEADER' // 반장
  | 'ADMIN'; // 관리자

// 직원 정보
export interface BreweryWorker {
  id: string; // 사번 (예: "240101")
  name: string; // 이름
  process: BreweryProcess; // 담당 공정
  role: UserRole; // 직책/권한
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
  changedBy: string; // 변경자 이름
  changedById: string; // 변경자 사번
  changedAt: string; // 변경 일시
  comment?: string; // 관리자 코멘트
}

// 우선순위 등급
export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// 우선순위 점수 산정 상세 내역
export interface PriorityBreakdown {
  totalScore: number; // 0 ~ 100점
  level: PriorityLevel;
  urgencyScore: number; // 긴급도 점수 (isUrgent: 50점 / 일반: 0점)
  categoryScore: number; // 카테고리 심각도 점수 (위험 40 / 고장 30 / 예방 20 / 개선 10)
  processScore: number; // 공정 영향도 점수 (RFC 10 / 검사 9 / 라벨러 8 / 포장기 7 / Depalletizer 6)
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
  locationDetail?: string; // 예: "RFC 1라인 로터리 타전기", "라벨러 2호기 인피드 센서"

  // 작성자 정보
  authorId: string; // 사번
  authorName: string; // 작성자 이름
  authorProcess: BreweryProcess;

  // 처리 상태 및 긴급도
  status: SuggestionStatus;
  isUrgent: boolean; // 고장정비 또는 위험성평가일 경우 자동 true (F-03)
  urgencyReason?: string;

  // 자동 계산 우선순위 점수
  priorityScore?: number;
  priorityBreakdown?: PriorityBreakdown;

  // 조치 담당 및 기한 (F-05)
  assignedTo?: string; // 조치 담당자
  assignedToId?: string;
  dueDate?: string; // 조치 마감일 (YYYY-MM-DD)
  deadlineAlertEnabled?: boolean; // 처리 기한 임박 알림 설정 여부
  deadlineAlertDays?: number; // 마감일 기준 알림 임박 일수 (기본 2일 전)
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
  workerParticipationRate: number; // 등록 인원 중 1회 이상 제안 참여 비율 (%)
  activeWorkersCount: number; // 참여한 직원 수
  avgLeadTimeHours: number; // 고장정비 접수 후 조치 완료까지의 평균 시간
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
