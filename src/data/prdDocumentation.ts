/**
 * PRD / Functional Specification 산출물 3종 데이터
 * 1. Firebase Firestore DB 스키마
 * 2. Next.js 프론트엔드 핵심 디렉토리 트리
 * 3. 메인 화면 예시 코드 (실시간 onSnapshot 연동)
 */

export const FIRESTORE_SCHEMA_MARKDOWN = `### 1. Firebase Firestore DB 스키마 설계서
**제품명**: 술술제안 (탁·약주 현장 스마트 제안관리 시스템)  
**특징**: 4대 제안 카테고리(공정개선, 고장정비, 예방정비, 위험성평가) 및 27명 현장 작업자 + 관리자 권한 분리, 실시간 동기화 및 긴급 알림 트리거 최적화

---

#### 📁 컬렉션 구조 요약 (Collections Overview)
1. \`users\` : 27명 현장 직원 및 관리자/공무팀 계정 정보
2. \`suggestions\` : 4대 카테고리 제안 본문 및 상태, 첨부파일 메타
3. \`suggestions/{suggestionId}/comments\` : 제안별 관리자 피드백 및 조치 이력 (서브컬렉션)
4. \`urgent_alerts\` : 고장정비/위험성평가 시 생성되는 실시간 푸시 트리거 큐
5. \`statistics\` : 일별/월별 공정별 집계 캐시 (대시보드 고속 조회용)

---

#### 1) \`users\` 컬렉션 (현장 작업자 & 관리자 정보)
* **문서 ID (\`userId\`)**: 직원 고유 사번 (예: \`240101\`, \`ADMIN01\`)

\`\`\`typescript
interface UserDocument {
  userId: string;              // 사번 4~6자리 (Primary Key)
  name: string;                // 성명 (예: "박제국", "최발효")
  role: 'WORKER' | 'ADMIN' | 'MAINTENANCE'; // 권한 (현장작업자 / 제품팀관리자 / 공무안전팀)
  process: 'MALTING' | 'MASHING' | 'FERMENTATION' | 'FILTRATION' | 'REFINING' | 'BOTTLING' | 'OTHER';
                               // 주 담당 공정 (제국, 담금, 발효, 여과, 제성, 병입, 기타)
  phone: string;               // 비상 연락처 (예: "010-1234-5678")
  fcmToken?: string;           // 모바일 Push 알림용 FCM 디바이스 토큰
  isFirstLogin: boolean;       // 최초 로그인 여부 (F-01: 초기 비밀번호 변경 강제 플래그)
  isActive: boolean;           // 재직 여부 (퇴사 시 즉시 false 전환하여 계정 비활성화)
  suggestionCount: number;     // 누적 등록 제안 수
  adoptedCount: number;        // 채택/완료된 제안 수
  createdAt: Timestamp;        // 계정 생성 일시
  updatedAt: Timestamp;        // 최근 정보 수정 일시
}
\`\`\`

---

#### 2) \`suggestions\` 컬렉션 (핵심 제안 문서)
* **문서 ID (\`suggestionId\`)**: \`SUG_20261111_001\` 형식 또는 Firestore 자동 생성 UID

\`\`\`typescript
interface SuggestionDocument {
  id: string;                  // 제안 고유 ID
  title: string;               // 제안 제목 (또는 체크리스트 요약)
  description: string;         // 상세 내용 (텍스트 또는 STT 음성 변환 텍스트)
  
  // 4대 제안 카테고리 (F-02)
  category: 
    | 'PROCESS_IMPROVEMENT'    // 공정개선 (발효 수율, CIP 시간 단축 등)
    | 'BREAKDOWN_REPAIR'      // 고장정비 (교반기 정지, 센서 오작동 등 - 긴급)
    | 'PREVENTIVE_MAINT'      // 예방정비 (배관 누수 징후, 필터 교체 주기 등)
    | 'RISK_ASSESSMENT';      // 위험성평가 (미끄럼, 협착, 아차사고 요인 등 - 긴급)

  // 주류 제조 공정 (F-02)
  process: 
    | 'MALTING'               // 제국
    | 'MASHING'               // 담금
    | 'FERMENTATION'          // 발효
    | 'FILTRATION'            // 여과
    | 'REFINING'              // 제성
    | 'BOTTLING'              // 병입
    | 'OTHER';                // 기타

  locationDetail: string;      // 현장 상세 위치 (예: "2호 발효조 상부 감속기", "병입 3라인 충진기")

  // 작성자 정보 (F-01 연동)
  author: {
    userId: string;            // 사번
    name: string;              // 작성자 성명
    process: string;           // 작성자 소속 공정
    role: string;
  };

  // 진행 상태 라벨링 (F-04)
  status: 'PENDING' | 'REVIEWING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  // (대기중 / 검토중 / 조치중 / 완료 / 반려)

  // 긴급도 및 알림 트리거 (F-03)
  isUrgent: boolean;           // 고장정비 또는 위험성평가인 경우 true
  urgencyReason?: string;      // 긴급 사유 (예: "품온 상승으로 산패 위험", "전도 아차사고")
  alertDispatched: boolean;    // 긴급 Push 알림 발송 완료 여부
  priorityScore: number;       // 자동 산정 우선순위 점수 (긴급 50 + 유형 10~40 + 공정 2~10 = 0~100)

  // 멀티미디어 첨부 (최대 3장, Firebase Storage 연동)
  attachments: Array<{
    fileId: string;
    downloadUrl: string;       // Storage 다운로드 URL
    storagePath: string;       // gs://... 버킷 내부 경로
    fileName: string;
    fileType: 'image/jpeg' | 'image/png' | 'video/mp4';
    fileSizeBytes: number;
    uploadedAt: Timestamp;
  }>;

  // 관리자 검토 및 조치 할당 (F-05)
  assignedTo?: {
    userId: string;            // 조치 담당자 사번 (공무팀/안전팀)
    name: string;
    assignedAt: Timestamp;
  };
  dueDate?: Timestamp;         // 조치 마감일
  adminFeedback?: string;      // 관리자 피드백 코멘트

  // 현장 사용성 보조 데이터
  inputMethod: 'TOUCH' | 'VOICE_STT' | 'CHECKLIST'; // 입력 방식
  quickTags?: string[];        // 원터치 체크리스트 선택 키워드
  isOfflineSynced: boolean;    // 오프라인 큐에서 업로드된 데이터인지 여부

  // 감사 타임스탬프
  createdAt: Timestamp;        // 최초 등록 일시
  updatedAt: Timestamp;        // 최종 수정 일시
  completedAt?: Timestamp;     // 조치 완료 일시 (리드타임 측정용)
}
\`\`\`

---

#### 3) \`suggestions/{suggestionId}/comments\` 서브컬렉션
* **목적**: 제안에 대한 관리자, 공무팀, 작업자 간의 조치 코멘트 및 상태 변경 이력 추적

\`\`\`typescript
interface CommentDocument {
  commentId: string;
  authorId: string;
  authorName: string;
  authorRole: 'WORKER' | 'ADMIN' | 'MAINTENANCE';
  message: string;
  statusChange?: {
    from: string;
    to: string;
  };
  createdAt: Timestamp;
}
\`\`\`

---

#### 4) \`urgent_alerts\` 컬렉션 (Cloud Functions 트리거용)
* **목적**: '고장정비' 또는 '위험성평가' 생성 시 즉각 Cloud Functions를 통해 관리자 및 공무팀 모바일 기기로 FCM Push 및 SMS 전송

\`\`\`typescript
interface UrgentAlertDocument {
  alertId: string;
  suggestionId: string;
  category: 'BREAKDOWN_REPAIR' | 'RISK_ASSESSMENT';
  title: string;
  process: string;
  authorName: string;
  targetRoles: ('ADMIN' | 'MAINTENANCE')[];
  isSent: boolean;
  sentAt?: Timestamp;
  createdAt: Timestamp;
}
\`\`\`

---

#### 5) Firestore 복합 인덱스 (Composite Indexes)
* \`suggestions\`: \`priorityScore\` (DESC) + \`createdAt\` (DESC) (우선순위 자동 정렬 대시보드용)
* \`suggestions\`: \`process\` (ASC) + \`createdAt\` (DESC)
* \`suggestions\`: \`category\` (ASC) + \`status\` (ASC) + \`createdAt\` (DESC)
* \`suggestions\`: \`author.userId\` (ASC) + \`createdAt\` (DESC) (내 제안 조회용)
* \`suggestions\`: \`isUrgent\` (DESC) + \`status\` (ASC) + \`createdAt\` (DESC) (긴급 조치 모니터링용)
`;

export const DIRECTORY_TREE_MARKDOWN = `### 2. Next.js 기반 프론트엔드 핵심 디렉토리 트리
**기술 스택**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Firebase SDK (v10+), Lucide Icons  
**설계 철학**: 현장 모바일 뷰(Glove-friendly, 오프라인 싱크)와 관리자 웹 대시보드(통계 차트, 일괄 처리)의 완전한 역할 분리 및 반응형 통합

\`\`\`text
sul-sul-proposal/
├── .env.local                    # Firebase API 키 및 프로젝트 환경변수
├── .env.example
├── next.config.mjs               # PWA 플러그인 및 이미지 도메인 설정
├── package.json
├── tsconfig.json
├── tailwind.config.ts            # 공장 현장 대비 고대비 컬러 및 터치 패딩 토큰
│
├── public/
│   ├── manifest.json             # PWA 설치 명세 (홈 화면 추가)
│   ├── icons/                    # 모바일 앱 아이콘 (192px, 512px)
│   └── sounds/                   # F-03 긴급 고장 발생 경보음 (alert.mp3)
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # 전역 레이아웃 (Pretendard 폰트, 오프라인 프로바이더)
│   │   ├── page.tsx              # 메인 라우터 (로그인 여부 및 권한에 따라 리다이렉트)
│   │   │
│   │   ├── (auth)/               # 인증 모듈 (F-01)
│   │   │   ├── login/
│   │   │   │   └── page.tsx      # 사번(4~6자리) 간편 로그인 화면
│   │   │   └── reset-password/
│   │   │       └── page.tsx      # 최초 로그인 시 비밀번호 강제 변경 화면
│   │   │
│   │   ├── (worker)/             # [현장 작업자용 모바일 뷰]
│   │   │   ├── layout.tsx        # 모바일 뷰포트 고정 헤더/하단 내비바
│   │   │   ├── suggestions/
│   │   │   │   ├── page.tsx      # [핵심] 현장 실시간 제안 리스트 메인 (F-04)
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx  # 신규 제안 등록 화면 (대형 터치, 카메라, STT) (F-02)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx  # 제안 상세 조회 및 조치 진행상황 확인
│   │   │   └── my/
│   │   │       └── page.tsx      # 내가 등록한 제안 목록 및 포상 점수 확인
│   │   │
│   │   ├── (admin)/              # [관리자/공무팀용 웹 대시보드]
│   │   │   ├── layout.tsx        # 사이드바 관리자 레이아웃
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx      # F-06 통계 대시보드 (트렌드 그래프, 파이차트, 27명 랭킹)
│   │   │   ├── manage/
│   │   │   │   └── page.tsx      # F-05 제안 검토, 상태 변경, 담당자 지정 및 코멘트
│   │   │   └── workers/
│   │   │       └── page.tsx      # 27명 현장 작업자 계정 및 공정별 배치 관리
│   │   │
│   │   └── api/                  # Next.js API Routes (Server Actions 또는 API)
│   │       ├── urgent-alert/
│   │       │   └── route.ts      # F-03 긴급 고장/위험 알림 발송 백엔드 엔드포인트
│   │       └── stats/
│   │           └── route.ts      # 통계 집계 데이터 API
│   │
│   ├── components/               # 재사용 컴포넌트
│   │   ├── common/
│   │   │   ├── CategoryBadge.tsx # 4대 카테고리 색상 뱃지
│   │   │   ├── StatusBadge.tsx   # 대기/검토/조치/완료/반려 뱃지
│   │   │   ├── ProcessIcon.tsx   # 제국, 담금, 발효, 여과, 제성, 병입 아이콘
│   │   │   └── UrgentBanner.tsx  # 최상단 긴급 고장/위험 경보 토스트 배너
│   │   │
│   │   ├── worker/               # 현장 특화 UI (장갑 착용 UX)
│   │   │   ├── BigTouchButton.tsx# 54px+ 대형 터치 버튼
│   │   │   ├── QuickChecklist.tsx# 텍스트 입력 최소화 퀵 체크리스트
│   │   │   ├── VoiceInputSTT.tsx # Web Speech API 기반 음성 텍스트 변환기
│   │   │   ├── CameraCapture.tsx # 현장 사진 최대 3장 즉각 촬영/압축
│   │   │   └── OfflineQueueStatus.tsx # Wi-Fi 음영지역 임시저장 표시기
│   │   │
│   │   └── admin/                # 관리자 화면 컴포넌트
│   │       ├── TrendChart.tsx    # 월별/주별 제안 추이 차트
│   │       ├── CategoryPieChart.tsx # 4대 카테고리 비중 차트
│   │       ├── WorkerRankingTable.tsx # 27명 참여율(100% 목표) 및 랭킹
│   │       └── AssigneeModal.tsx # 담당자 할당 및 마감일(Due Date) 설정 모달
│   │
│   ├── hooks/                    # 커스텀 훅
│   │   ├── useAuth.ts            # 사번 세션 관리 훅
│   │   ├── useRealtimeSuggestions.ts # Firestore onSnapshot 실시간 구독 훅
│   │   ├── useOfflineSync.ts     # IndexedDB 오프라인 큐 및 네트워크 복구 자동 싱크
│   │   └── useUrgentAudio.ts     # 긴급 알림 비프음 재생 훅
│   │
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts         # Firebase App, Firestore, Storage 초기화
│   │   │   ├── auth.ts           # 사번 커스텀 인증 로직
│   │   │   └── firestore.ts      # 실시간 리스너 및 CRUD 헬퍼 함수
│   │   ├── constants/
│   │   │   └── brewery.ts        # 주류 공정, 카테고리, 상태값 상수 정의
│   │   └── utils/
│   │       ├── imageCompressor.ts # 업로드 전 모바일 현장 사진 1MB 이하 압축
│   │       └── date.ts
│   │
│   └── types/                    # 타입 선언부
│       ├── suggestion.ts         # 제안 데이터 모델 인터페이스
│       └── user.ts               # 작업자 및 관리자 모델 인터페이스
\`\`\`
`;

export const MAIN_PAGE_CODE_MARKDOWN = `/**
 * ============================================================
 * [1] Firebase 초기화 모듈 (Next.js 환경 변수 기반 - sulsul-proposal-2)
 * 파일 위치: src/lib/firebase/client.ts
 * ============================================================
 * .env.local 설정 예시:
 * NEXT_PUBLIC_FIREBASE_API_KEY="YOUR_API_KEY"
 * NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="sulsul-proposal-2.firebaseapp.com"
 * NEXT_PUBLIC_FIREBASE_PROJECT_ID="sulsul-proposal-2"
 * NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="sulsul-proposal-2.firebasestorage.app"
 * NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="YOUR_MESSAGING_SENDER_ID"
 * NEXT_PUBLIC_FIREBASE_APP_ID="YOUR_APP_ID"
 * NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID="" // 기본 DB 사용 시 비워두기
 */
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  ...(process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
    ? { measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID }
    : {}),
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const firestoreDatabaseId = process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID;
export const db = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
export const auth = getAuth(app);

/**
 * ============================================================
 * [2] [술술제안] 현장 메인 화면 (React / Next.js)
 * 파일 위치: src/app/(worker)/suggestions/page.tsx
 * ============================================================
 * 
 * 주요 기능:
 * 1. Firebase Firestore \`onSnapshot\`을 이용한 실시간 제안 리스트 동기화
 * 2. 4대 카테고리(공정개선/고장정비/예방정비/위험성평가) 탭 필터링
 * 3. 긴급 알림(고장정비/위험성평가) 실시간 감지 시 최상단 경보 배너 노출
 * 4. 위생장갑/고무장갑 착용 상태에서도 터치하기 쉬운 큰 버튼 UI
 * 5. 공장 내 Wi-Fi 음영지역 대응 오프라인 큐 상태 표시
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  limit, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { 
  AlertTriangle, 
  Wrench, 
  Lightbulb, 
  ShieldAlert, 
  Plus, 
  WifiOff, 
  Filter, 
  ChevronRight,
  Clock,
  Camera
} from 'lucide-react';

// 타입 정의
export type SuggestionCategory = 
  | 'ALL'
  | 'PROCESS_IMPROVEMENT' 
  | 'BREAKDOWN_REPAIR' 
  | 'PREVENTIVE_MAINT' 
  | 'RISK_ASSESSMENT';

export type BreweryProcess = 
  | 'MALTING' | 'MASHING' | 'FERMENTATION' | 'FILTRATION' | 'REFINING' | 'BOTTLING' | 'OTHER';

export interface SuggestionItem {
  id: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  process: BreweryProcess;
  locationDetail?: string;
  author: {
    userId: string;
    name: string;
    process: string;
  };
  status: 'PENDING' | 'REVIEWING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  isUrgent: boolean;
  priorityScore: number;
  attachments?: Array<{ downloadUrl: string; fileName: string }>;
  createdAt: Timestamp;
}

// 4대 카테고리 메타 정보
const CATEGORY_META = {
  ALL: { label: '전체', color: 'bg-slate-800 text-white' },
  PROCESS_IMPROVEMENT: { label: '공정개선', icon: Lightbulb, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  BREAKDOWN_REPAIR: { label: '고장정비', icon: Wrench, color: 'text-rose-600 bg-rose-50 border-rose-200' },
  PREVENTIVE_MAINT: { label: '예방정비', icon: Clock, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  RISK_ASSESSMENT: { label: '위험성평가', icon: ShieldAlert, color: 'text-orange-600 bg-orange-50 border-orange-200' },
};

const PROCESS_LABELS: Record<BreweryProcess, string> = {
  MALTING: '제국(製麴)',
  MASHING: '담금(仕込)',
  FERMENTATION: '발효(醱酵)',
  FILTRATION: '여과(濾過)',
  REFINING: '제성(製成)',
  BOTTLING: '병입(甁入)',
  OTHER: '기타공정',
};

const STATUS_LABELS = {
  PENDING: { text: '대기중', badge: 'bg-slate-100 text-slate-700 border-slate-300' },
  REVIEWING: { text: '검토중', badge: 'bg-amber-100 text-amber-800 border-amber-300' },
  IN_PROGRESS: { text: '조치중', badge: 'bg-sky-100 text-sky-800 border-sky-300' },
  COMPLETED: { text: '완료', badge: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  REJECTED: { text: '반려', badge: 'bg-rose-100 text-rose-800 border-rose-300' },
};

export default function SuggestionsMainPage() {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<SuggestionCategory>('ALL');
  const [selectedProcess, setSelectedProcess] = useState<string>('ALL');
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // 1. 네트워크 연결 상태 감지 (공장 Wi-Fi 음영 대응)
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 2. Firebase Firestore 실시간(onSnapshot) 리스너 구독
  useEffect(() => {
    setLoading(true);
    const suggestionsRef = collection(db, 'suggestions');
    // 우선순위 점수(priorityScore) 높은 순 -> 최신순으로 최근 50개 실시간 조회
    const q = query(
      suggestionsRef,
      orderBy('priorityScore', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: SuggestionItem[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as SuggestionItem[];

        setSuggestions(items);
        setLoading(false);
      },
      (error) => {
        console.error('Firestore 실시간 구독 에러:', error);
        setLoading(false);
      }
    );

    // 컴포넌트 언마운트 시 리스너 해제
    return () => unsubscribe();
  }, []);

  // 3. 필터링 로직
  const filteredSuggestions = useMemo(() => {
    return suggestions.filter((item) => {
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchProc = selectedProcess === 'ALL' || item.process === selectedProcess;
      return matchCat && matchProc;
    });
  }, [suggestions, selectedCategory, selectedProcess]);

  // 4. 긴급 고장/위험 제안 건수 계산 (F-03)
  const urgentCount = useMemo(() => {
    return suggestions.filter(
      (s) => s.isUrgent && (s.status === 'PENDING' || s.status === 'REVIEWING')
    ).length;
  }, [suggestions]);

  return (
    <div className="min-h-screen bg-slate-100 pb-24 select-none">
      {/* 1) 상단 공장 안전 & 오프라인 상태 헤더 */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="font-bold text-lg tracking-tight">술술제안 현장모바일</h1>
          </div>
          <div className="flex items-center gap-2">
            {!isOnline && (
              <span className="flex items-center gap-1 text-xs bg-rose-600 text-white px-2.5 py-1 rounded-full font-medium">
                <WifiOff className="w-3.5 h-3.5" /> 오프라인 저장중
              </span>
            )}
            <span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700">
              작업자: 27명 가동중
            </span>
          </div>
        </div>

        {/* 긴급 알림 띠배너 (F-03) */}
        {urgentCount > 0 && (
          <div className="bg-rose-600 text-white px-4 py-2 flex items-center justify-between text-xs sm:text-sm font-semibold animate-pulse">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>긴급 조치 요망 {urgentCount}건 (고장/아차사고 대응중)</span>
            </div>
            <span className="underline underline-offset-2">확인</span>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 pt-3 space-y-3">
        {/* 2) 신규 제안 등록 빅 버튼 (장갑 낀 손으로 터치 최적화, 높이 56px+) */}
        <Link
          href="/suggestions/new"
          className="flex items-center justify-center gap-3 w-full h-14 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-xl shadow-lg font-bold text-lg transition-transform"
        >
          <Plus className="w-7 h-7 stroke-[2.5]" />
          <span>새 제안 / 고장신고 등록</span>
        </Link>

        {/* 3) 4대 카테고리 퀵 선택 탭 (큰 터치 타겟) */}
        <div className="grid grid-cols-4 gap-1.5 bg-white p-1.5 rounded-xl shadow-sm border border-slate-200">
          {(['ALL', 'BREAKDOWN_REPAIR', 'RISK_ASSESSMENT', 'PROCESS_IMPROVEMENT'] as SuggestionCategory[]).map(
            (cat) => {
              const isActive = selectedCategory === cat;
              const meta = CATEGORY_META[cat];
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={\`h-12 flex flex-col items-center justify-center rounded-lg text-xs font-bold transition-colors \${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }\`}
                >
                  <span>{meta.label}</span>
                </button>
              );
            }
          )}
        </div>

        {/* 4) 공정별 필터 셀렉트 */}
        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>공정 필터:</span>
          </div>
          <select
            value={selectedProcess}
            onChange={(e) => setSelectedProcess(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 font-semibold text-slate-800 outline-none"
          >
            <option value="ALL">전체 공정 (제국~병입)</option>
            <option value="MALTING">제국(製麴)</option>
            <option value="MASHING">담금(仕込)</option>
            <option value="FERMENTATION">발효(醱酵)</option>
            <option value="FILTRATION">여과(濾過)</option>
            <option value="REFINING">제성(製成)</option>
            <option value="BOTTLING">병입(甁入)</option>
            <option value="OTHER">기타</option>
          </select>
        </div>

        {/* 5) 실시간 제안 리스트 */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            현장 제안 리스트를 실시간 동기화 중...
          </div>
        ) : filteredSuggestions.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center text-slate-400 border border-slate-200">
            해당 공정 및 카테고리의 제안 내역이 없습니다.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredSuggestions.map((item) => {
              const status = STATUS_LABELS[item.status];
              const isUrgentItem = item.isUrgent;

              return (
                <Link
                  key={item.id}
                  href={\`/suggestions/\${item.id}\`}
                  className={\`block bg-white rounded-xl p-3.5 border transition-all shadow-sm active:bg-slate-50 \${
                    isUrgentItem ? 'border-rose-300 ring-2 ring-rose-100' : 'border-slate-200'
                  }\`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded">
                        우선순위 {item.priorityScore ?? 0}점
                      </span>
                      {isUrgentItem && (
                        <span className="inline-flex items-center gap-1 bg-rose-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3" /> 긴급
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {PROCESS_LABELS[item.process] || item.process}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {item.author?.name}
                      </span>
                    </div>

                    <span className={\`text-xs font-bold px-2 py-0.5 rounded-full border \${status?.badge}\`}>
                      {status?.text}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2">
                    {item.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-2 mt-1">
                    {item.description}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      {item.attachments && item.attachments.length > 0 && (
                        <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                          <Camera className="w-3 h-3" /> 사진 {item.attachments.length}
                        </span>
                      )}
                    </span>
                    <span className="flex items-center text-slate-400">
                      상세보기 <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
`;
