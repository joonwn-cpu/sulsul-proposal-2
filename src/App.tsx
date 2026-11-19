import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  getStoredSuggestions, 
  getStoredWorkers, 
  getCurrentUser, 
  setCurrentUser, 
  addSuggestion, 
  updateSuggestionStatus, 
  updateSuggestionDeadlineAlert,
  calculateBreweryStats, 
  resetBreweryData, 
  subscribeBreweryStore, 
  getOfflineQueue, 
  syncOfflineQueue 
} from './lib/breweryStore';
import {
  auth,
  signInWithGoogle,
  signOutFirebase,
} from './lib/firebase/client';
import {
  createSuggestionInFirestore,
  subscribeFirestoreSuggestions,
  updateSuggestionInFirestore,
} from './lib/firebase/suggestionsFirestore';
import {
  BrowserNotificationPermissionState,
  getBrowserNotificationPermission,
  getDeadlineAlertInfo,
  getTodayLocalDateStr,
  requestBrowserNotificationPermission,
  sendDeadlineBrowserNotification,
} from './lib/deadlineAlert';
import { 
  Suggestion, 
  BreweryWorker, 
  SuggestionStatus, 
  SuggestionCategory, 
  BreweryProcess, 
  AttachmentItem 
} from './types/brewery';
import { HeaderNav } from './components/HeaderNav';
import { MobileWorkerView } from './components/MobileWorkerView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { PrdDocsViewer } from './components/PrdDocsViewer';
import { NewSuggestionModal } from './components/NewSuggestionModal';
import { SuggestionDetailModal } from './components/SuggestionDetailModal';
import { AlertTriangle, Bell, BellRing, X, CheckCircle2, Shield } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'mobile' | 'admin' | 'docs'>('mobile');
  const [localSuggestions, setLocalSuggestions] = useState<Suggestion[]>(getStoredSuggestions());
  const [cloudSuggestions, setCloudSuggestions] = useState<Suggestion[]>([]);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);
  const [workers, setWorkers] = useState<BreweryWorker[]>(getStoredWorkers());
  const [currentUser, setCurrentUserLocal] = useState<BreweryWorker>(getCurrentUser());
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [hasWatermark, setHasWatermark] = useState<boolean>(true);
  
  // 모달 상태
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);

  // 긴급 알림 푸시 토스트 (F-03)
  const [urgentAlertMessage, setUrgentAlertMessage] = useState<{
    id: string;
    title: string;
    category: string;
    author: string;
  } | null>(null);

  // 처리 기한 임박 푸시/경고 토스트
  const [deadlineToastAlert, setDeadlineToastAlert] = useState<{
    id: string;
    title: string;
    dDayLabel: string;
    dueDate: string;
    browserPushSent: boolean;
    extraCount: number;
  } | null>(null);

  const [notificationPermission, setNotificationPermission] =
    useState<BrowserNotificationPermissionState>(() => getBrowserNotificationPermission());

  const notifiedDeadlineKeysRef = useRef<Set<string>>(new Set());

  // 실시간 로컬 스토어 구독
  useEffect(() => {
    const unsubscribe = subscribeBreweryStore(() => {
      setLocalSuggestions(getStoredSuggestions());
      setWorkers(getStoredWorkers());
      setCurrentUserLocal(getCurrentUser());
    });
    return () => unsubscribe();
  }, []);

  // Firebase Auth 상태 구독
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setFirebaseUser(user);
      setAuthReady(true);
      if (!user) {
        setCloudSuggestions([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 인증 완료 후에만 Firestore onSnapshot 실시간 구독 연결
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const unsubscribe = subscribeFirestoreSuggestions(
      firebaseUser,
      items => {
        setCloudSuggestions(items);
      },
      err => {
        setFirestoreError(err);
      }
    );

    return () => unsubscribe();
  }, [authReady, firebaseUser]);

  // 클라우드(Firestore) 제안과 로컬 시뮬레이션 제안 병합
  const cloudSuggestionIds = useMemo(
    () => new Set(cloudSuggestions.map(item => item.id)),
    [cloudSuggestions]
  );

  const suggestions = useMemo(() => {
    if (cloudSuggestions.length === 0) return localSuggestions;
    const cloudMap = new Map(cloudSuggestions.map(item => [item.id, item]));
    const merged: Suggestion[] = [...cloudSuggestions];
    localSuggestions.forEach(item => {
      if (!cloudMap.has(item.id)) {
        merged.push(item);
      }
    });
    return merged;
  }, [cloudSuggestions, localSuggestions]);

  // 처리 기한 임박 제안 감지 시 브라우저 푸시 알림 및 대시보드 경고 토스트 발송
  useEffect(() => {
    const todayStr = getTodayLocalDateStr();
    const imminentEntries = suggestions
      .map(s => ({ suggestion: s, info: getDeadlineAlertInfo(s) }))
      .filter(entry => entry.info.shouldTriggerAlert);

    const newlyImminent = imminentEntries.filter(({ suggestion, info }) => {
      const key = `${suggestion.id}:${todayStr}:${suggestion.dueDate || ''}:${info.daysRemaining ?? 'none'}`;
      if (notifiedDeadlineKeysRef.current.has(key)) return false;
      notifiedDeadlineKeysRef.current.add(key);
      return true;
    });

    if (newlyImminent.length === 0) return;

    let pushedAny = false;
    newlyImminent.forEach(({ suggestion, info }) => {
      if (sendDeadlineBrowserNotification(suggestion, info)) {
        pushedAny = true;
      }
    });

    const primary = newlyImminent[0];
    setDeadlineToastAlert({
      id: primary.suggestion.id,
      title: primary.suggestion.title,
      dDayLabel: primary.info.dDayLabel,
      dueDate: primary.suggestion.dueDate || '-',
      browserPushSent: pushedAny,
      extraCount: Math.max(0, imminentEntries.length - 1),
    });

    const timer = setTimeout(() => {
      setDeadlineToastAlert(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [suggestions]);

  const activeSelectedSuggestion = selectedSuggestion
    ? suggestions.find(s => s.id === selectedSuggestion.id) || selectedSuggestion
    : null;

  const stats = calculateBreweryStats(suggestions, workers);
  const offlineQueue = getOfflineQueue();

  // 사용자 전환
  const handleSelectUser = (workerId: string) => {
    const updated = setCurrentUser(workerId);
    setCurrentUserLocal(updated);
  };

  // 신규 제안 등록 (F-02 & F-03)
  const handleCreateSuggestion = (data: {
    title: string;
    description: string;
    category: SuggestionCategory;
    process: BreweryProcess;
    locationDetail: string;
    isUrgent: boolean;
    urgencyReason?: string;
    attachments: AttachmentItem[];
    quickTags: string[];
    audioTranscript?: string;
  }) => {
    const created = addSuggestion({
      title: data.title,
      description: data.description,
      category: data.category,
      process: data.process,
      locationDetail: data.locationDetail,
      authorId: currentUser.id,
      authorName: currentUser.name,
      authorProcess: currentUser.process,
      status: 'PENDING',
      isUrgent: data.isUrgent,
      urgencyReason: data.urgencyReason,
      attachments: data.attachments,
      quickTags: data.quickTags,
      audioTranscript: data.audioTranscript,
    }, isOffline);

    // Firebase 인증 상태이고 온라인이면 Firestore에 저장
    if (firebaseUser && !isOffline) {
      void createSuggestionInFirestore(created, firebaseUser).catch(err => {
        if (err instanceof Error) setFirestoreError(err);
      });
    }

    // 긴급 고장/위험성평가 시 F-03 긴급 알림 푸시 토스트 발동
    if (data.isUrgent) {
      setUrgentAlertMessage({
        id: created.id,
        title: created.title,
        category: created.category === 'BREAKDOWN_REPAIR' ? '고장정비' : '위험성평가',
        author: currentUser.name,
      });

      // 5초 후 자동 닫기
      setTimeout(() => {
        setUrgentAlertMessage(null);
      }, 7000);
    }
  };

  // 상태 변경 및 관리자 할당 (F-05)
  const handleUpdateStatus = (
    suggestionId: string,
    newStatus: SuggestionStatus,
    comment?: string,
    assignedTo?: string,
    assignedToId?: string,
    dueDate?: string,
    deadlineAlertEnabled?: boolean,
    deadlineAlertDays?: number
  ) => {
    const updated = updateSuggestionStatus(
      suggestionId,
      newStatus,
      currentUser.name,
      currentUser.id,
      comment,
      assignedTo,
      assignedToId,
      dueDate,
      deadlineAlertEnabled,
      deadlineAlertDays
    );

    if (firebaseUser && !isOffline && cloudSuggestionIds.has(suggestionId)) {
      void updateSuggestionInFirestore(suggestionId, {
        status: newStatus,
        assignedTo,
        assignedToId,
        dueDate,
        deadlineAlertEnabled,
        deadlineAlertDays,
        adminFeedback: comment,
        completedAt: updated?.completedAt,
      }).catch(err => {
        if (err instanceof Error) setFirestoreError(err);
      });
    }
  };

  // 개별 제안 처리 기한 임박 '알림 설정' 토글 및 임박 기준 업데이트
  const handleToggleDeadlineAlert = async (
    suggestionId: string,
    enabled: boolean,
    alertDaysBefore?: number,
    dueDate?: string
  ) => {
    if (enabled && notificationPermission === 'default') {
      const perm = await requestBrowserNotificationPermission();
      setNotificationPermission(perm);
    } else {
      setNotificationPermission(getBrowserNotificationPermission());
    }
    updateSuggestionDeadlineAlert(suggestionId, enabled, alertDaysBefore, dueDate);

    if (firebaseUser && !isOffline && cloudSuggestionIds.has(suggestionId)) {
      void updateSuggestionInFirestore(suggestionId, {
        deadlineAlertEnabled: enabled,
        deadlineAlertDays: alertDaysBefore,
        dueDate,
      }).catch(err => {
        if (err instanceof Error) setFirestoreError(err);
      });
    }
  };

  const handleSignInGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Google sign-in failed:', error);
    }
  };

  const handleSignOutGoogle = async () => {
    try {
      await signOutFirebase();
    } catch (error) {
      console.error('Google sign-out failed:', error);
    }
  };

  const handleRequestNotificationPermission = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      handleDispatchPushAlerts();
    }
  };

  const handleDispatchPushAlerts = () => {
    const imminentEntries = suggestions
      .map(s => ({ suggestion: s, info: getDeadlineAlertInfo(s) }))
      .filter(entry => entry.info.shouldTriggerAlert);

    if (imminentEntries.length === 0) return;

    let pushedAny = false;
    imminentEntries.forEach(({ suggestion, info }) => {
      if (sendDeadlineBrowserNotification(suggestion, info)) {
        pushedAny = true;
      }
    });

    const primary = imminentEntries[0];
    setDeadlineToastAlert({
      id: primary.suggestion.id,
      title: primary.suggestion.title,
      dDayLabel: primary.info.dDayLabel,
      dueDate: primary.suggestion.dueDate || '-',
      browserPushSent: pushedAny,
      extraCount: Math.max(0, imminentEntries.length - 1),
    });
  };

  const handleTriggerDeadlineTestAlert = async (target: Suggestion) => {
    let perm = getBrowserNotificationPermission();
    if (perm === 'default') {
      perm = await requestBrowserNotificationPermission();
      setNotificationPermission(perm);
    }

    const info = getDeadlineAlertInfo(target);
    const previewInfo = {
      ...info,
      dDayLabel: info.dDayLabel || '기한 임박 테스트',
    };
    const sent = sendDeadlineBrowserNotification(target, previewInfo, '[테스트]');

    setDeadlineToastAlert({
      id: target.id,
      title: target.title,
      dDayLabel: previewInfo.dDayLabel,
      dueDate: target.dueDate || '미설정',
      browserPushSent: sent,
      extraCount: 0,
    });
  };

  // 오프라인 큐 동기화
  const handleSyncOffline = () => {
    const queuedItems = getOfflineQueue();
    const count = syncOfflineQueue();
    if (firebaseUser && queuedItems.length > 0) {
      queuedItems.forEach(item => {
        void createSuggestionInFirestore(item, firebaseUser).catch(err => {
          if (err instanceof Error) setFirestoreError(err);
        });
      });
    }
    alert(`오프라인에 보관되었던 ${count}건의 제안이 중앙 서버로 정상 동기화되었습니다.`);
  };

  if (firestoreError) {
    throw firestoreError;
  }

  return (
    <div className={`min-h-screen bg-slate-100 text-slate-900 flex flex-col relative ${hasWatermark ? 'plant-watermark' : ''}`}>
      {/* 화면 캡처 방지 및 사내 보안 워터마크 안내 (비기능) */}
      {hasWatermark && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center opacity-[0.035] select-none text-slate-900 rotate-[-25deg] text-xl font-black">
          [사내기밀] {currentUser.name} ({currentUser.id}) • {new Date().toLocaleDateString('ko-KR')}
        </div>
      )}

      {/* 상단 통합 네비게이션 */}
      <HeaderNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        workers={workers}
        onSelectUser={handleSelectUser}
        isOffline={isOffline}
        setIsOffline={setIsOffline}
        hasWatermark={hasWatermark}
        setHasWatermark={setHasWatermark}
        onResetData={resetBreweryData}
        urgentAlertCount={stats.statusCounts.PENDING}
        firebaseUserEmail={firebaseUser?.email}
        firebaseAuthReady={authReady}
        onSignInGoogle={handleSignInGoogle}
        onSignOutGoogle={handleSignOutGoogle}
      />

      {/* F-03 긴급 고장/위험 알림 실시간 푸시 토스트 */}
      {urgentAlertMessage && (
        <div className="fixed top-16 right-4 z-50 max-w-sm w-full bg-slate-950 text-white rounded-2xl shadow-2xl border-2 border-rose-500 p-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center shrink-0 animate-bounce">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                    F-03 긴급 발송
                  </span>
                  <span className="text-xs font-bold text-rose-300">
                    {urgentAlertMessage.category} 접수!
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white mt-1 leading-snug">
                  {urgentAlertMessage.title}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  작성자: {urgentAlertMessage.author} ➔ 관리자/공무팀 푸시 완료
                </p>
              </div>
            </div>

            <button 
              onClick={() => setUrgentAlertMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 처리 기한 임박 브라우저 푸시/경고 토스트 */}
      {deadlineToastAlert && (
        <div
          className={`fixed ${urgentAlertMessage ? 'top-44' : 'top-16'} right-4 z-50 max-w-sm w-full bg-amber-950 text-white rounded-2xl shadow-2xl border-2 border-amber-400 p-4 animate-in slide-in-from-top duration-300`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0 animate-pulse">
                <BellRing className="w-4 h-4 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400 text-slate-950">
                    기한 임박 알림
                  </span>
                  <span className="text-xs font-bold text-amber-300">
                    {deadlineToastAlert.dDayLabel}
                  </span>
                </div>
                <h4
                  onClick={() => {
                    const found = suggestions.find(s => s.id === deadlineToastAlert.id);
                    if (found) setSelectedSuggestion(found);
                  }}
                  className="font-bold text-sm text-white mt-1 leading-snug cursor-pointer hover:underline"
                >
                  [{deadlineToastAlert.id}] {deadlineToastAlert.title}
                </h4>
                <p className="text-[11px] text-amber-200/90 mt-0.5">
                  마감일: {deadlineToastAlert.dueDate}
                  {deadlineToastAlert.extraCount > 0 && ` 외 ${deadlineToastAlert.extraCount}건 임박`}
                  {deadlineToastAlert.browserPushSent ? ' · 브라우저 푸시 전송됨' : ''}
                </p>
              </div>
            </div>

            <button
              onClick={() => setDeadlineToastAlert(null)}
              className="text-amber-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 메인 뷰 컨텐츠 */}
      <main className="flex-1 p-3 sm:p-6">
        {activeTab === 'mobile' && (
          <MobileWorkerView
            suggestions={suggestions}
            currentUser={currentUser}
            isOffline={isOffline}
            onOpenNewModal={() => setIsNewModalOpen(true)}
            onSelectSuggestion={item => setSelectedSuggestion(item)}
            onSyncOffline={handleSyncOffline}
            offlineCount={offlineQueue.length}
          />
        )}

        {activeTab === 'admin' && (
          <AdminDashboardView
            stats={stats}
            suggestions={suggestions}
            workers={workers}
            currentUser={currentUser}
            onSelectSuggestion={item => setSelectedSuggestion(item)}
            onUpdateStatus={handleUpdateStatus}
            onToggleDeadlineAlert={handleToggleDeadlineAlert}
            notificationPermission={notificationPermission}
            onRequestNotificationPermission={handleRequestNotificationPermission}
            onDispatchPushAlerts={handleDispatchPushAlerts}
          />
        )}

        {activeTab === 'docs' && (
          <PrdDocsViewer />
        )}
      </main>

      {/* F-02 신규 제안 등록 모달 */}
      {isNewModalOpen && (
        <NewSuggestionModal
          currentUser={currentUser}
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSubmit={handleCreateSuggestion}
          isOffline={isOffline}
        />
      )}

      {/* 제안 상세 및 F-05 관리자 조치 모달 */}
      <SuggestionDetailModal
        suggestion={activeSelectedSuggestion}
        currentUser={currentUser}
        workers={workers}
        isOpen={!!activeSelectedSuggestion}
        isAdminView={activeTab === 'admin'}
        onClose={() => setSelectedSuggestion(null)}
        onUpdateStatus={handleUpdateStatus}
        onToggleDeadlineAlert={handleToggleDeadlineAlert}
        onTriggerDeadlineTestAlert={handleTriggerDeadlineTestAlert}
      />
    </div>
  );
}
