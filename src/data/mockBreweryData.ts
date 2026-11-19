import { 
  BreweryWorker, 
  Suggestion, 
  BreweryProcess, 
  SuggestionCategory, 
  SuggestionStatus 
} from '../types/brewery';

// 4대 카테고리 메타 정보
export const CATEGORY_CONFIG: Record<
  SuggestionCategory, 
  { label: string; shortLabel: string; color: string; bgLight: string; border: string; desc: string; isUrgentDefault: boolean }
> = {
  PROCESS_IMPROVEMENT: {
    label: '공정개선 (아이디어)',
    shortLabel: '공정개선',
    color: 'text-amber-700',
    bgLight: 'bg-amber-50',
    border: 'border-amber-300',
    desc: '발효 수율 향상, 세척(CIP) 시간 단축, 원료 계량 오차 개선 등',
    isUrgentDefault: false,
  },
  BREAKDOWN_REPAIR: {
    label: '고장정비 (즉시 수리)',
    shortLabel: '고장정비',
    color: 'text-rose-700',
    bgLight: 'bg-rose-50',
    border: 'border-rose-300',
    desc: '교반기 모터 정지, 병입기 센서 오작동, 이송 펌프 누액 등 즉각 조치',
    isUrgentDefault: true,
  },
  PREVENTIVE_MAINT: {
    label: '예방정비 (사전 알림)',
    shortLabel: '예방정비',
    color: 'text-blue-700',
    bgLight: 'bg-blue-50',
    border: 'border-blue-300',
    desc: '배관 누수 징후, 필터 교체 주기 도래, 구동 벨트 마모 등 선제 예방',
    isUrgentDefault: false,
  },
  RISK_ASSESSMENT: {
    label: '위험성평가 (아차사고)',
    shortLabel: '위험성평가',
    color: 'text-orange-700',
    bgLight: 'bg-orange-50',
    border: 'border-orange-300',
    desc: '발효조 주변 미끄럼, 회전부 방호 덮개 탈락, 고소 배관 점검 위험 등',
    isUrgentDefault: true,
  },
};

// 7대 제조 공정 메타 정보
export const PROCESS_CONFIG: Record<
  BreweryProcess, 
  { label: string; desc: string; icon: string; zone: string }
> = {
  MALTING: { label: '제국(製麴)', desc: '누룩 및 백국 제조, 배양실 온·습도', icon: '🌾', zone: '제1작업동 제국실' },
  MASHING: { label: '담금(仕込)', desc: '원료 쌀 증자, 주모(밑술) 및 덧술 담금', icon: '🍚', zone: '제1작업동 담금실' },
  FERMENTATION: { label: '발효(醱酵)', desc: '1~15호 발효조 품온 제어, 효모 활동', icon: '🧪', zone: '제2작업동 주발효실' },
  FILTRATION: { label: '여과(濾過)', desc: '술덧 분리, 규조토 및 마이크로 필터', icon: '💧', zone: '제2작업동 여과실' },
  REFINING: { label: '제성(製成)', desc: '알코올 도수 보정, 블렌딩, 냉각 숙성', icon: '⚗️', zone: '제3작업동 제성저장실' },
  BOTTLING: { label: '병입(甁入)', desc: '자동 충진, 캡핑, 검사, 라벨링, 박싱', icon: '🍾', zone: '제3작업동 병입패키징동' },
  OTHER: { label: '기타/공통', desc: '용수 정제, 폐수 처리, 보일러, CIP', icon: '🏭', zone: '공통 유틸리티' },
};

// 상태 메타 정보
export const STATUS_CONFIG: Record<
  SuggestionStatus, 
  { label: string; badgeClass: string; dotColor: string }
> = {
  PENDING: { label: '대기중', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300', dotColor: 'bg-slate-400' },
  REVIEWING: { label: '검토중', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300', dotColor: 'bg-amber-500' },
  IN_PROGRESS: { label: '조치중', badgeClass: 'bg-sky-100 text-sky-800 border-sky-300', dotColor: 'bg-sky-500' },
  COMPLETED: { label: '완료', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300', dotColor: 'bg-emerald-500' },
  REJECTED: { label: '반려', badgeClass: 'bg-rose-100 text-rose-800 border-rose-300', dotColor: 'bg-rose-500' },
};

// 현장 직원 27명 + 관리자/공무팀 3명
export const INITIAL_WORKERS: BreweryWorker[] = [
  // 제국 (3명)
  { id: '240101', name: '박제국 반장', process: 'MALTING', role: 'WORKER', phone: '010-3101-0001', isFirstLogin: false, suggestionCount: 5 },
  { id: '240102', name: '이누룩 사원', process: 'MALTING', role: 'WORKER', phone: '010-3101-0002', isFirstLogin: false, suggestionCount: 3 },
  { id: '240103', name: '강온습 사원', process: 'MALTING', role: 'WORKER', phone: '010-3101-0003', isFirstLogin: true, suggestionCount: 1 },

  // 담금 (4명)
  { id: '240201', name: '김담금 반장', process: 'MASHING', role: 'WORKER', phone: '010-3102-0001', isFirstLogin: false, suggestionCount: 6 },
  { id: '240202', name: '정증자 조장', process: 'MASHING', role: 'WORKER', phone: '010-3102-0002', isFirstLogin: false, suggestionCount: 4 },
  { id: '240203', name: '송주모 사원', process: 'MASHING', role: 'WORKER', phone: '010-3102-0003', isFirstLogin: false, suggestionCount: 2 },
  { id: '240204', name: '한교반 사원', process: 'MASHING', role: 'WORKER', phone: '010-3102-0004', isFirstLogin: false, suggestionCount: 2 },

  // 발효 (5명)
  { id: '240301', name: '최발효 반장', process: 'FERMENTATION', role: 'WORKER', phone: '010-3103-0001', isFirstLogin: false, suggestionCount: 8 },
  { id: '240302', name: '오품온 조장', process: 'FERMENTATION', role: 'WORKER', phone: '010-3103-0002', isFirstLogin: false, suggestionCount: 4 },
  { id: '240303', name: '윤효모 사원', process: 'FERMENTATION', role: 'WORKER', phone: '010-3103-0003', isFirstLogin: false, suggestionCount: 3 },
  { id: '240304', name: '장냉각 사원', process: 'FERMENTATION', role: 'WORKER', phone: '010-3103-0004', isFirstLogin: false, suggestionCount: 2 },
  { id: '240305', name: '문통기 사원', process: 'FERMENTATION', role: 'WORKER', phone: '010-3103-0005', isFirstLogin: false, suggestionCount: 1 },

  // 여과 (4명)
  { id: '240401', name: '배여과 반장', process: 'FILTRATION', role: 'WORKER', phone: '010-3104-0001', isFirstLogin: false, suggestionCount: 4 },
  { id: '240402', name: '신압착 조장', process: 'FILTRATION', role: 'WORKER', phone: '010-3104-0002', isFirstLogin: false, suggestionCount: 3 },
  { id: '240403', name: '류규조 사원', process: 'FILTRATION', role: 'WORKER', phone: '010-3104-0003', isFirstLogin: false, suggestionCount: 2 },
  { id: '240404', name: '서필터 사원', process: 'FILTRATION', role: 'WORKER', phone: '010-3104-0004', isFirstLogin: false, suggestionCount: 1 },

  // 제성 (3명)
  { id: '240501', name: '조제성 반장', process: 'REFINING', role: 'WORKER', phone: '010-3105-0001', isFirstLogin: false, suggestionCount: 4 },
  { id: '240502', name: '황도수 사원', process: 'REFINING', role: 'WORKER', phone: '010-3105-0002', isFirstLogin: false, suggestionCount: 2 },
  { id: '240503', name: '안배합 사원', process: 'REFINING', role: 'WORKER', phone: '010-3105-0003', isFirstLogin: false, suggestionCount: 2 },

  // 병입 (6명)
  { id: '240601', name: '유병입 반장', process: 'BOTTLING', role: 'WORKER', phone: '010-3106-0001', isFirstLogin: false, suggestionCount: 7 },
  { id: '240602', name: '권충진 조장', process: 'BOTTLING', role: 'WORKER', phone: '010-3106-0002', isFirstLogin: false, suggestionCount: 5 },
  { id: '240603', name: '남캡핑 사원', process: 'BOTTLING', role: 'WORKER', phone: '010-3106-0003', isFirstLogin: false, suggestionCount: 3 },
  { id: '240604', name: '홍라벨 사원', process: 'BOTTLING', role: 'WORKER', phone: '010-3106-0004', isFirstLogin: false, suggestionCount: 2 },
  { id: '240605', name: '구검사 사원', process: 'BOTTLING', role: 'WORKER', phone: '010-3106-0005', isFirstLogin: false, suggestionCount: 2 },
  { id: '240606', name: '양박싱 사원', process: 'BOTTLING', role: 'WORKER', phone: '010-3106-0006', isFirstLogin: false, suggestionCount: 1 },

  // 기타/유틸리티 (2명) - 총 현장 직원 27명
  { id: '240701', name: '탁용수 반장', process: 'OTHER', role: 'WORKER', phone: '010-3107-0001', isFirstLogin: false, suggestionCount: 3 },
  { id: '240702', name: '약세척 사원', process: 'OTHER', role: 'WORKER', phone: '010-3107-0002', isFirstLogin: true, suggestionCount: 0 },

  // 제품팀 관리자 & 공무/안전 담당자
  { id: 'ADMIN01', name: '김상우 팀장 (제품팀 관리자)', process: 'OTHER', role: 'ADMIN', phone: '010-9999-0001', isFirstLogin: false, suggestionCount: 0 },
  { id: 'SAFETY01', name: '이공무 과장 (공무/안전팀)', process: 'OTHER', role: 'MAINTENANCE', phone: '010-8888-0001', isFirstLogin: false, suggestionCount: 0 },
];

// 자주 발생하는 현장 문제 퀵 체크리스트 (음성/터치 입력 지원)
export const QUICK_ISSUE_CHECKLISTS: Record<SuggestionCategory, string[]> = {
  PROCESS_IMPROVEMENT: [
    '발효조 CIP 자동세척 시간 15분 단축안',
    '밑술(주모) 투입 시 쌀가루 비산 방지 호퍼 개조',
    '여과 잔여 술덧 회수율 3% 향상 필터링 방식',
    '병입 라인 간이 라벨 자동 검사 센서 추가',
  ],
  BREAKDOWN_REPAIR: [
    '3호 발효조 상단 교반기 모터 과열 정지',
    '병입 2라인 캡핑기 공압 실린더 누기 발생',
    '담금 쌀 이송 스크루 피더 모터 이상 진동',
    '여과 펌프 메카니컬 씰 누액 발생',
  ],
  PREVENTIVE_MAINT: [
    '5호 발효조 냉각 자켓 밸브 미세 누수 징후',
    '마이크로 카트리지 필터 차압 상승 교체 주기',
    '원료 증자 솥 스팀 밸브 패킹 노후 점검',
    '에어 컴프레셔 드레인 밸브 자동 배출 점검',
  ],
  RISK_ASSESSMENT: [
    '여과기 규조토 투입 구역 바닥 세척수 미끄럼',
    '2호 발효조 상부 점검 사다리 난간 유격 흔들림',
    '병입 라인 유리병 파손 비산 파편 위험',
    '제국실 고온·고습 환경 환기팬 풍량 저하',
  ],
};

// 초기 시뮬레이션 제안 데이터
export const INITIAL_SUGGESTIONS: Suggestion[] = [
  {
    id: 'SUG-2026-001',
    title: '3호 발효조 상단 교반기 모터 이상 소음 및 과열 정지',
    description: '3호 발효조 2차 품온 제어 중 교반기 모터 하우징 표면 온도가 78℃까지 상승하며 과부하 트립 발생. 약주 발효 균일화에 치명적이므로 즉각적인 베어링 교체 및 전기 점검 요망.',
    category: 'BREAKDOWN_REPAIR',
    process: 'FERMENTATION',
    locationDetail: '제2작업동 주발효실 3호조 상부 감속기',
    authorId: '240301',
    authorName: '최발효 반장',
    authorProcess: 'FERMENTATION',
    status: 'IN_PROGRESS',
    isUrgent: true,
    urgencyReason: '발효조 품온 불균일로 인한 산패 위험 (긴급 고장)',
    assignedTo: '이공무 과장 (공무/안전팀)',
    assignedToId: 'SAFETY01',
    dueDate: '2026-11-12',
    deadlineAlertEnabled: true,
    deadlineAlertDays: 2,
    adminFeedback: '긴급 접수 완료. 공무팀에 예비 모터 어셈블리 불출 및 교체 지시함.',
    attachments: [
      {
        id: 'att-1',
        url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
        name: '모터_과열_열화상.jpg',
        type: 'image',
        uploadedAt: '2026-11-11 08:30',
      },
      {
        id: 'att-2',
        url: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=600&q=80',
        name: '감속기_베어링부.jpg',
        type: 'image',
        uploadedAt: '2026-11-11 08:31',
      }
    ],
    quickTags: ['교반기 모터 과열 정지', '품온 이상'],
    createdAt: '2026-11-11 08:30:15',
    updatedAt: '2026-11-11 09:10:00',
    historyLogs: [
      {
        id: 'log-1',
        fromStatus: 'PENDING',
        toStatus: 'REVIEWING',
        changedBy: '김상우 팀장 (제품팀 관리자)',
        changedById: 'ADMIN01',
        changedAt: '2026-11-11 08:45:00',
        comment: '긴급 고장 확인. 공무팀 긴급 출동 요청',
      },
      {
        id: 'log-2',
        fromStatus: 'REVIEWING',
        toStatus: 'IN_PROGRESS',
        changedBy: '이공무 과장 (공무/안전팀)',
        changedById: 'SAFETY01',
        changedAt: '2026-11-11 09:10:00',
        comment: '모터 베어링 분해 정비 시작. 예상 소요 2시간',
      }
    ]
  },
  {
    id: 'SUG-2026-002',
    title: '여과실 규조토 슬러리 배출부 바닥 고임 및 미끄럼 아차사고',
    description: '어제 야간조 여과 작업 종료 후 규조토 세척수가 배수로 경사 불량으로 작업 통로에 2cm 고임. 작업자가 이동 중 미끄러져 넘어질 뻔한 아차사고 발생함. 미끄럼 방지 트렌치 덮개 및 논슬립 바닥 도포 필요.',
    category: 'RISK_ASSESSMENT',
    process: 'FILTRATION',
    locationDetail: '제2작업동 여과실 1호 필터프레스 하부 통로',
    authorId: '240402',
    authorName: '신압착 조장',
    authorProcess: 'FILTRATION',
    status: 'REVIEWING',
    isUrgent: true,
    urgencyReason: '작업자 전도 및 골절 위험 (아차사고 보고)',
    assignedTo: '이공무 과장 (공무/안전팀)',
    assignedToId: 'SAFETY01',
    dueDate: '2026-11-14',
    deadlineAlertEnabled: true,
    deadlineAlertDays: 2,
    adminFeedback: '안전보건 점검 사항 등록. 우선 고무 미끄럼 방지 매트 즉시 배치 조치.',
    attachments: [
      {
        id: 'att-3',
        url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80',
        name: '여과실_배수로_상태.jpg',
        type: 'image',
        uploadedAt: '2026-11-10 17:20',
      }
    ],
    quickTags: ['여과기 규조토 투입 구역 바닥 세척수 미끄럼'],
    createdAt: '2026-11-10 17:20:00',
    updatedAt: '2026-11-11 07:50:00',
    historyLogs: [
      {
        id: 'log-3',
        fromStatus: 'PENDING',
        toStatus: 'REVIEWING',
        changedBy: '김상우 팀장 (제품팀 관리자)',
        changedById: 'ADMIN01',
        changedAt: '2026-11-11 07:50:00',
        comment: '긴급 임시 매트 포설 지시 및 배수로 개선 검토',
      }
    ]
  },
  {
    id: 'SUG-2026-003',
    title: '발효탱크 CIP(제자리세척) 가성소다 순환 시간 15분 최적화 제안',
    description: '기존 60℃ 가성소다 45분 순환 공정을 전단 고압 스프레이 노즐 분사각 조정을 통해 30분 순환으로 단축 가능함을 시험조에서 검증함. 주간 온수 및 전력 비용 12% 절감 및 일일 가동률 1조 증가 기대.',
    category: 'PROCESS_IMPROVEMENT',
    process: 'FERMENTATION',
    locationDetail: '발효조 1~8호 공용 CIP 라인',
    authorId: '240301',
    authorName: '최발효 반장',
    authorProcess: 'FERMENTATION',
    status: 'COMPLETED',
    isUrgent: false,
    assignedTo: '김상우 팀장 (제품팀 관리자)',
    assignedToId: 'ADMIN01',
    dueDate: '2026-11-08',
    completedAt: '2026-11-09 16:30:00',
    adminFeedback: '미생물(일반세균, 진균) 잔류 검사 3회 연속 음성 판정 확인. 전 발효조 표준 SOP로 개정 승인 완료. 우수 개선 제안 포상 추천.',
    attachments: [
      {
        id: 'att-4',
        url: 'https://images.unsplash.com/photo-1516594798947-e65505dbb29d?auto=format&fit=crop&w=600&q=80',
        name: 'CIP_세척검사_결과서.jpg',
        type: 'image',
        uploadedAt: '2026-11-05 14:00',
      }
    ],
    quickTags: ['발효조 CIP 자동세척 시간 15분 단축안'],
    createdAt: '2026-11-05 14:00:00',
    updatedAt: '2026-11-09 16:30:00',
    historyLogs: [
      {
        id: 'log-4',
        fromStatus: 'PENDING',
        toStatus: 'REVIEWING',
        changedBy: '김상우 팀장 (제품팀 관리자)',
        changedById: 'ADMIN01',
        changedAt: '2026-11-06 10:00:00',
        comment: '품질팀 잔류 검사 의뢰',
      },
      {
        id: 'log-5',
        fromStatus: 'REVIEWING',
        toStatus: 'COMPLETED',
        changedBy: '김상우 팀장 (제품팀 관리자)',
        changedById: 'ADMIN01',
        changedAt: '2026-11-09 16:30:00',
        comment: '적용 완료 및 현장 표준 작업서 반영',
      }
    ]
  },
  {
    id: 'SUG-2026-004',
    title: '병입 1호기 자동 캡핑기 공압 실린더 패킹 마모 및 누기 징후',
    description: '막걸리 750ml PET 병입 라인에서 캡 압착 시 압력 게이지가 5.5bar에서 4.8bar로 간헐적 드롭 현상 발생. 다음 주 정기 휴동일 전 사전 패킹 키트 교체 필요.',
    category: 'PREVENTIVE_MAINT',
    process: 'BOTTLING',
    locationDetail: '제3작업동 병입 1호 라인 로터리 캡핑기',
    authorId: '240603',
    authorName: '남캡핑 사원',
    authorProcess: 'BOTTLING',
    status: 'IN_PROGRESS',
    isUrgent: false,
    assignedTo: '이공무 과장 (공무/안전팀)',
    assignedToId: 'SAFETY01',
    dueDate: '2026-11-15',
    adminFeedback: '예비 실린더 패킹 세트 자재실 재고 확인 완료. 11/14 야간 정기 점검 시 교체 예정.',
    attachments: [
      {
        id: 'att-5',
        url: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=600&q=80',
        name: '캡핑기_공압부.jpg',
        type: 'image',
        uploadedAt: '2026-11-10 11:15',
      }
    ],
    quickTags: ['배관 누수 징후', '필터 교체 주기 도래'],
    createdAt: '2026-11-10 11:15:00',
    updatedAt: '2026-11-10 14:00:00',
    historyLogs: [
      {
        id: 'log-6',
        fromStatus: 'PENDING',
        toStatus: 'IN_PROGRESS',
        changedBy: '이공무 과장 (공무/안전팀)',
        changedById: 'SAFETY01',
        changedAt: '2026-11-10 14:00:00',
        comment: '부품 확보 완료, 주말 정비 예약',
      }
    ]
  },
  {
    id: 'SUG-2026-005',
    title: '제국실 입국 배양 3번실 가습 노즐 석회질 막힘 선제 교체',
    description: '백국 증식 24~36시간 구간에서 상대습도 85% 유지가 필수적인데, 3번 노즐 분무 상태가 고르지 못해 배양대 테두리 건조 발생. 초음파 가습 노즐 세척 및 스페어 교체 건의.',
    category: 'PREVENTIVE_MAINT',
    process: 'MALTING',
    locationDetail: '제1작업동 제국실 3호 배양실 중앙 덕트',
    authorId: '240101',
    authorName: '박제국 반장',
    authorProcess: 'MALTING',
    status: 'PENDING',
    isUrgent: false,
    attachments: [
      {
        id: 'att-6',
        url: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=600&q=80',
        name: '가습노즐_분무상태.jpg',
        type: 'image',
        uploadedAt: '2026-11-11 06:40',
      }
    ],
    quickTags: ['제국실 고온·고습 환경 환기팬 풍량 저하'],
    createdAt: '2026-11-11 06:40:00',
    updatedAt: '2026-11-11 06:40:00',
    historyLogs: []
  },
  {
    id: 'SUG-2026-006',
    title: '증자 쌀 밑술 담금 투입 호퍼 분진 흡입 후드 풍량 증설',
    description: '증자된 고두밥 냉각 후 밑술 탱크 투입 시 비산 분진과 증기가 천장에 응결되어 물방울 낙하 우려가 있음. 국소 배기 후드 풍량 인버터 주파수 45Hz->55Hz 상향 조정 요망.',
    category: 'PROCESS_IMPROVEMENT',
    process: 'MASHING',
    locationDetail: '제1작업동 담금실 1번 밑술조 상부',
    authorId: '240201',
    authorName: '김담금 반장',
    authorProcess: 'MASHING',
    status: 'PENDING',
    isUrgent: false,
    attachments: [],
    quickTags: ['밑술(주모) 투입 시 쌀가루 비산 방지 호퍼 개조'],
    createdAt: '2026-11-11 07:15:00',
    updatedAt: '2026-11-11 07:15:00',
    historyLogs: []
  }
];
