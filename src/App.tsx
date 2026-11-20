import React, { useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react';
import {
  addSuggestion,
  calculateBreweryStats,
  getOfflineQueue,
  getStoredSuggestions,
  getStoredWorkers,
  resetBreweryData,
  subscribeBreweryStore,
  syncOfflineQueue,
  updateSuggestionDeadlineAlert,
  updateSuggestionStatus,
} from './lib/breweryStore';
import {
  auth,
  signInWithGoogle,
  signOutFirebase,
} from './lib/firebase/client';
import {
  FirestoreUserProfile,
  emailToWorkerId,
  ensureUserProfile,
  isBootstrappedAdminUser,
  isPasswordAuthUser,
  mapProfileToBreweryWorker,
  subscribeUserProfiles,
} from './lib/firebase/auth';
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
  AttachmentItem,
  BreweryProcess,
  BreweryWorker,
  Suggestion,
  SuggestionCategory,
  SuggestionStatus,
} from './types/brewery';
import { HeaderNav } from './components/HeaderNav';
import { MobileWorkerView } from './components/MobileWorkerView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { PrdDocsViewer } from './components/PrdDocsViewer';
import { NewSuggestionModal } from './components/NewSuggestionModal';
import { SuggestionDetailModal } from './components/SuggestionDetailModal';
import { EmployeeAuthScreen } from './components/EmployeeAuthScreen';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { WorkerAccountManagerModal } from './components/WorkerAccountManagerModal';

export default function App() {
  const [activeTab, setActiveTab] = useState<'mobile' | 'admin' | 'docs'>('mobile');
  const [localSuggestions, setLocalSuggestions] = useState<Suggestion[]>(getStoredSuggestions());
  const [cloudSuggestions, setCloudSuggestions] = useState<Suggestion[]>([]);
  const [storedWorkers, setStoredWorkers] = useState<BreweryWorker[]>(getStoredWorkers());

  // Firebase 인증 & 사용자 프로필 상태
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [currentProfile, setCurrentProfile] = useState<FirestoreUserProfile | null>(null);
  const [userProfiles, setUserProfiles] = useState<FirestoreUserProfile[]>([]);
  const [firestoreError, setFirestoreError] = useState<Error | null>(null);

  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [hasWatermark, setHasWatermark] = useState<boolean>(true);

  // 모달 상태
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState<boolean>(false);

  // 일반 안내 토스트 (window.alert 대체)
  const [infoToast, setInfoToast] = useState<string | null>(null);

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
  const initialTabSyncedForUidRef = useRef<string | null>(null);

  const showInfoToast = (message: string) => {
    setInfoToast(message);
    setTimeout(() => {
      setInfoToast(prev => (prev === message ? null : prev));
    }, 4500);
  };

  // 실시간 로컬 스토어 구독
  useEffect(() => {
    const unsubscribe = subscribeBreweryStore(() => {
      setLocalSuggestions(getStoredSuggestions());
      setStoredWorkers(getStoredWorkers());
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
        setCurrentProfile(null);
        setUserProfiles([]);
        setIsPasswordModalOpen(false);
        setIsAccountManagerOpen(false);
        initialTabSyncedForUidRef.current = null;
      }
    });
    return () => unsubscribe();
  }, []);

  // 인증 완료 후 사용자 프로필 보장 및 실시간 구독
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    let cancelled = false;

    void ensureUserProfile(firebaseUser)
      .then(profile => {
        if (!cancelled) {
          setCurrentProfile(profile);
        }
      })
      .catch(err => {
        if (!cancelled && err instanceof Error) {
          setFirestoreError(err);
        }
      });

    const unsubProfiles = subscribeUserProfiles(
      firebaseUser,
      profiles => {
        setUserProfiles(profiles);
      },
      profile => {
        if (profile) {
          setCurrentProfile(profile);
        }
      },
      err => {
        setFirestoreError(err);
      }
    );

    const unsubSuggestions = subscribeFirestoreSuggestions(
      firebaseUser,
      items => {
        setCloudSuggestions(items);
      },
      err => {
        setFirestoreError(err);
      }
    );

    return () => {
      cancelled = true;
      unsubProfiles();
      unsubSuggestions();
    };
  }, [authReady, firebaseUser]);

  // 로그인 직후 권한에 따라 기본 탭 자동 전환 (파트장·반장·관리자 -> 관리자 대시보드, 일반 담당 -> 현장 모바일)
  useEffect(() => {
    if (!firebaseUser || !currentProfile) return;
    if (initialTabSyncedForUidRef.current === firebaseUser.uid) return;
    initialTabSyncedForUidRef.current = firebaseUser.uid;
    if (
      currentProfile.role === 'ADMIN' ||
      currentProfile.role === 'TEAM_LEADER' ||
      currentProfile.role === 'PART_LEADER'
    ) {
      setActiveTab('admin');
    } else {
      setActiveTab('mobile');
    }
  }, [firebaseUser, currentProfile]);

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

  // 인증된 실제 직원 기준 currentUser 계산
  const currentUser: BreweryWorker = useMemo(() => {
    if (currentProfile) {
      const count = suggestions.filter(s => s.authorId === currentProfile.workerId).length;
      return mapProfileToBreweryWorker(currentProfile, count);
    }

    const fallbackId = firebaseUser
      ? isBootstrappedAdminUser(firebaseUser)
        ? 'ADMIN01'
        : emailToWorkerId(firebaseUser.email, firebaseUser.uid)
      : '1455';

    return {
      id: fallbackId,
      name: firebaseUser?.displayName || `직원 ${fallbackId}`,
      process: isBootstrappedAdminUser(firebaseUser) ? 'ADMIN' : 'RFC',
      role: isBootstrappedAdminUser(firebaseUser) ? 'ADMIN' : 'WORKER',
      phone: '-',
      isFirstLogin: false,
      suggestionCount: 0,
    };
  }, [currentProfile, firebaseUser, suggestions]);

  // Firestore 실제 등록 계정을 우선으로 하여 workers 목록 구성
  const workers: BreweryWorker[] = useMemo(() => {
    const countByWorkerId = new Map<string, number>();
    suggestions.forEach(s => {
      countByWorkerId.set(s.authorId, (countByWorkerId.get(s.authorId) || 0) + 1);
    });

    const realWorkers = userProfiles.map(profile =>
      mapProfileToBreweryWorker(profile, countByWorkerId.get(profile.workerId) || 0)
    );

    const existingIds = new Set(realWorkers.map(w => w.id));
    if (!existingIds.has(currentUser.id)) {
      realWorkers.unshift(currentUser);
      existingIds.add(currentUser.id);
    }

    const merged: BreweryWorker[] = [...realWorkers];
    storedWorkers.forEach(w => {
      if (!existingIds.has(w.id)) {
        merged.push({
          ...w,
          suggestionCount: countByWorkerId.get(w.id) || 0,
        });
      }
    });
    return merged;
  }, [userProfiles, currentUser, storedWorkers, suggestions]);

  // 처리 기한 임박 제안 감지 시 브라우저 푸시 알림 및 대시보드 경고 토스트 발송
  useEffect(() => {
    if (!firebaseUser) return;
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
  }, [suggestions, firebaseUser]);

  const activeSelectedSuggestion = selectedSuggestion
    ? suggestions.find(s => s.id === selectedSuggestion.id) || selectedSuggestion
    : null;

  const stats = calculateBreweryStats(suggestions, workers);
  const offlineQueue = getOfflineQueue();

  const isSuperAdmin = isBootstrappedAdminUser(firebaseUser);
  const canManageAccounts = isSuperAdmin || currentUser.role === 'ADMIN';
  const canChangePassword = isPasswordAuthUser(firebaseUser);
  const mustChangePasswordNow = Boolean(
    firebaseUser && canChangePassword && currentProfile?.isFirstLogin
  );

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
    const created = addSuggestion(
      {
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
      },
      isOffline
    );

    if (firebaseUser && !isOffline) {
      void createSuggestionInFirestore(created, firebaseUser).catch(err => {
        if (err instanceof Error) setFirestoreError(err);
      });
    }

    if (data.isUrgent) {
      setUrgentAlertMessage({
        id: created.id,
        title: created.title,
        category: created.category === 'BREAKDOWN_REPAIR' ? '고장정비' : '위험성평가',
        author: currentUser.name,
      });

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

    if (
      firebaseUser &&
      !isOffline &&
      cloudSuggestionIds.has(suggestionId) &&
      (isSuperAdmin || currentUser.role === 'ADMIN')
    ) {
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
      const target = suggestions.find(s => s.id === suggestionId);
      const isTerminal = target?.status === 'COMPLETED' || target?.status === 'REJECTED';
      if (canManageAccounts || !isTerminal) {
        void updateSuggestionInFirestore(suggestionId, {
          deadlineAlertEnabled: enabled,
          deadlineAlertDays: alertDaysBefore,
          dueDate,
        }).catch(err => {
          if (err instanceof Error) setFirestoreError(err);
        });
      }
    }
  };

  const handleSignInGoogle = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    try {
      await signOutFirebase();
    } catch (error) {
      console.error('Sign-out failed:', error);
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
    showInfoToast(`오프라인 보관 제안 ${count}건이 중앙 서버로 정상 동기화되었습니다.`);
  };

  if (firestoreError) {
    throw firestoreError;
  }

  // Firebase Auth 초기화 대기 화면
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Loader2 className="w-7 h-7 animate-spin text-slate-800" />
          <p className="text-sm font-semibold">인증 상태를 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  // 미로그인 시 사번 + 비밀번호 로그인 화면 표시
  if (!firebaseUser) {
    return <EmployeeAuthScreen onSignInGoogle={handleSignInGoogle} />;
  }

  return (
    <div
      className={`min-h-screen bg-slate-100 text-slate-900 flex flex-col relative ${
        hasWatermark ? 'plant-watermark' : ''
      }`}
    >
      {/* 화면 캡처 방지 및 사내 보안 워터마크 안내 */}
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
        isOffline={isOffline}
        setIsOffline={setIsOffline}
        hasWatermark={hasWatermark}
        setHasWatermark={setHasWatermark}
        onResetData={() => {
          resetBreweryData();
          showInfoToast('로컬 임시 데이터가 초기화되었습니다.');
        }}
        urgentAlertCount={stats.statusCounts.PENDING}
        canChangePassword={canChangePassword}
        canManageAccounts={canManageAccounts}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        onOpenAccountManager={() => setIsAccountManagerOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* 일반 안내 토스트 */}
      {infoToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-slate-900 text-white rounded-xl border border-slate-700 shadow-xl px-4 py-3 flex items-center gap-2.5 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{infoToast}</span>
          <button
            type="button"
            onClick={() => setInfoToast(null)}
            className="text-slate-400 hover:text-white ml-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* F-03 긴급 고장/위험 알림 실시간 푸시 토스트 */}
      {urgentAlertMessage && (
        <div className="fixed top-16 right-4 z-50 max-w-sm w-full bg-slate-950 text-white rounded-2xl shadow-2xl border-2 border-rose-500 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-rose-600 text-white">
                    F-03 긴급 발송
                  </span>
                  <span className="text-xs font-bold text-rose-300">
                    {urgentAlertMessage.category} 접수
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white mt-1 leading-snug">
                  {urgentAlertMessage.title}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  작성자: {urgentAlertMessage.author} · 양조2팀 관리자·반장 알림 발송 완료
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setUrgentAlertMessage(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 처리 기한 임박 브라우저 푸시/경고 토스트 */}
      {deadlineToastAlert && (
        <div
          className={`fixed ${
            urgentAlertMessage ? 'top-44' : 'top-16'
          } right-4 z-50 max-w-sm w-full bg-amber-950 text-white rounded-2xl shadow-2xl border-2 border-amber-400 p-4`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
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
              type="button"
              onClick={() => setDeadlineToastAlert(null)}
              className="text-amber-300 hover:text-white cursor-pointer"
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
            onOpenAccountManager={canManageAccounts ? () => setIsAccountManagerOpen(true) : undefined}
            realUserCount={userProfiles.length}
          />
        )}

        {activeTab === 'docs' && <PrdDocsViewer />}
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

      {/* F-01 최초 로그인 강제 비밀번호 변경 & 상시 비밀번호 변경 모달 */}
      <PasswordChangeModal
        isOpen={mustChangePasswordNow || isPasswordModalOpen}
        forced={mustChangePasswordNow}
        workerId={currentUser.id}
        displayName={currentUser.name}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={() => {
          setCurrentProfile(prev => (prev ? { ...prev, isFirstLogin: false } : prev));
          showInfoToast('비밀번호가 변경되었습니다.');
        }}
        onLogout={handleSignOut}
      />

      {/* 관리자 전용 실제 직원 사번 계정 발급 및 권한 관리 모달 */}
      <WorkerAccountManagerModal
        isOpen={isAccountManagerOpen}
        onClose={() => setIsAccountManagerOpen(false)}
        userProfiles={userProfiles}
        currentUserUid={firebaseUser.uid}
        isBootstrappedAdmin={isSuperAdmin}
        canManageAccounts={canManageAccounts}
      />
    </div>
  );
}
