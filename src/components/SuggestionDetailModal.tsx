import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  Calendar, 
  MessageSquare, 
  Send, 
  ChevronRight,
  ShieldCheck,
  Wrench,
  Lightbulb,
  ShieldAlert,
  ArrowRight,
  Gauge,
  BellRing,
  BellOff,
  Bell
} from 'lucide-react';
import { 
  Suggestion, 
  SuggestionStatus, 
  BreweryWorker 
} from '../types/brewery';
import { 
  CATEGORY_CONFIG, 
  PROCESS_CONFIG, 
  STATUS_CONFIG 
} from '../data/mockBreweryData';
import {
  CATEGORY_SEVERITY_SCORES,
  PRIORITY_LEVEL_CONFIG,
  PROCESS_IMPORTANCE_SCORES,
  enrichSuggestionWithPriority,
} from '../lib/priorityScore';

import {
  DEFAULT_DEADLINE_ALERT_DAYS,
  BrowserNotificationPermissionState,
  getBrowserNotificationPermission,
  getDeadlineAlertInfo,
  requestBrowserNotificationPermission,
} from '../lib/deadlineAlert';

interface SuggestionDetailModalProps {
  suggestion: Suggestion | null;
  currentUser: BreweryWorker;
  workers: BreweryWorker[];
  isOpen: boolean;
  isAdminView?: boolean;
  onClose: () => void;
  onUpdateStatus: (
    suggestionId: string,
    newStatus: SuggestionStatus,
    comment?: string,
    assignedTo?: string,
    assignedToId?: string,
    dueDate?: string,
    deadlineAlertEnabled?: boolean,
    deadlineAlertDays?: number
  ) => void;
  onToggleDeadlineAlert?: (
    suggestionId: string,
    enabled: boolean,
    alertDaysBefore?: number,
    dueDate?: string
  ) => void;
  onTriggerDeadlineTestAlert?: (suggestion: Suggestion) => void;
}

export const STATUS_LIST: SuggestionStatus[] = [
  'PENDING',
  'REVIEWING',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
];

export function SuggestionDetailModal({
  suggestion,
  currentUser,
  workers,
  isOpen,
  isAdminView = false,
  onClose,
  onUpdateStatus,
  onToggleDeadlineAlert,
  onTriggerDeadlineTestAlert,
}: SuggestionDetailModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<SuggestionStatus>(suggestion?.status || 'PENDING');
  const [assignedWorkerId, setAssignedWorkerId] = useState<string>(suggestion?.assignedToId || 'SAFETY01');
  const [dueDate, setDueDate] = useState<string>(
    suggestion?.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
  );
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<BrowserNotificationPermissionState>(() =>
    getBrowserNotificationPermission()
  );

  useEffect(() => {
    if (suggestion) {
      setSelectedStatus(suggestion.status);
      setAssignedWorkerId(suggestion.assignedToId || 'SAFETY01');
      setDueDate(
        suggestion.dueDate || new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]
      );
      setFeedbackComment('');
      setNotifPermission(getBrowserNotificationPermission());
    }
  }, [suggestion]);

  if (!isOpen || !suggestion) return null;

  const enrichedSuggestion = suggestion.priorityBreakdown
    ? suggestion
    : enrichSuggestionWithPriority(suggestion);
  const breakdown = enrichedSuggestion.priorityBreakdown!;
  const levelMeta = PRIORITY_LEVEL_CONFIG[breakdown.level];
  const categoryInfo = CATEGORY_SEVERITY_SCORES[suggestion.category];
  const processInfo = PROCESS_IMPORTANCE_SCORES[suggestion.process];

  const categoryMeta = CATEGORY_CONFIG[suggestion.category];
  const processMeta = PROCESS_CONFIG[suggestion.process];
  const currentStatusMeta = STATUS_CONFIG[suggestion.status];
  const deadlineInfo = getDeadlineAlertInfo(suggestion);

  // 관리자 또는 공무팀 권한 여부 (또는 관리자 대시보드 화면에서 조회 중일 때 알림 토글 허용)
  const isAdminOrMaintenance = currentUser.role === 'ADMIN' || currentUser.role === 'MAINTENANCE';
  const canConfigureDeadlineAlert = isAdminOrMaintenance || isAdminView;

  const handleToggleAlertSwitch = async () => {
    const nextEnabled = !deadlineInfo.isEnabled;
    const effectiveDueDate = suggestion.dueDate || dueDate;
    const alertDays = suggestion.deadlineAlertDays ?? DEFAULT_DEADLINE_ALERT_DAYS;

    if (nextEnabled) {
      const perm = await requestBrowserNotificationPermission();
      setNotifPermission(perm);
    }

    onToggleDeadlineAlert?.(
      suggestion.id,
      nextEnabled,
      alertDays,
      suggestion.dueDate ? undefined : effectiveDueDate
    );
  };

  const handleChangeAlertDays = (days: number) => {
    onToggleDeadlineAlert?.(
      suggestion.id,
      deadlineInfo.isEnabled,
      days,
      suggestion.dueDate ? undefined : dueDate
    );
  };

  const handleRequestPushPermission = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotifPermission(perm);
  };

  const handleSaveAction = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedWorker = workers.find(w => w.id === assignedWorkerId);

    onUpdateStatus(
      suggestion.id,
      selectedStatus,
      feedbackComment.trim() || undefined,
      assignedWorker ? `${assignedWorker.name} (${assignedWorker.phone})` : undefined,
      assignedWorker?.id,
      dueDate,
      suggestion.deadlineAlertEnabled,
      suggestion.deadlineAlertDays
    );

    setFeedbackComment('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white w-full max-w-2xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* 헤더 */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2.5 py-1 rounded font-bold ${categoryMeta.bgLight} ${categoryMeta.color} border ${categoryMeta.border}`}>
              {categoryMeta.shortLabel}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              #{suggestion.id}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${currentStatusMeta.badgeClass}`}>
              {currentStatusMeta.label}
            </span>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* 긴급 알림 헤더 (F-03) */}
          {suggestion.isUrgent && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-900 text-sm">
                  F-03 긴급 조치 대상 (관리자 & 공무팀 Push 발송 완료)
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  {suggestion.urgencyReason || '고장 또는 안전 아차사고 요인으로 우선 대응이 필요합니다.'}
                </p>
              </div>
            </div>
          )}

          {/* 제목 & 세부 내용 */}
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {suggestion.title}
            </h3>
            
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-2.5 pt-2 border-t border-slate-100">
              <span className="font-semibold text-slate-700">
                작성자: {suggestion.authorName} ({suggestion.authorId})
              </span>
              <span>•</span>
              <span>공정: {processMeta?.label}</span>
              <span>•</span>
              <span>위치: {suggestion.locationDetail || processMeta?.zone}</span>
              <span>•</span>
              <span>등록일시: {suggestion.createdAt}</span>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm whitespace-pre-wrap leading-relaxed">
              {suggestion.description}
            </div>

            {/* 빠른 체크 태그 */}
            {suggestion.quickTags && suggestion.quickTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {suggestion.quickTags.map((tag, i) => (
                  <span key={i} className="text-xs bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 자동 우선순위 점수 산정 내역 카드 */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-indigo-950 text-xs sm:text-sm flex items-center gap-2">
                <Gauge className="w-4 h-4 text-indigo-600" />
                <span>자동 우선순위 점수 산정 내역</span>
              </h4>
              <div className="flex items-center gap-1.5">
                <span className={`text-lg font-black tabular-nums ${levelMeta.textColor}`}>
                  {breakdown.totalScore}점
                </span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${levelMeta.badgeClass}`}>
                  {levelMeta.label}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                <span className="text-slate-400 block text-[10px]">① 긴급도 (isUrgent)</span>
                <span className="font-black text-slate-900 text-sm">+{breakdown.urgencyScore}점</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  {suggestion.isUrgent ? '긴급 대상 (50점)' : '일반 제안 (0점)'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                <span className="text-slate-400 block text-[10px]">② 카테고리 심각도</span>
                <span className="font-black text-slate-900 text-sm">+{breakdown.categoryScore}점</span>
                <span className="block text-[10px] text-slate-500 mt-0.5 truncate">
                  {breakdown.categoryLabel} ({categoryInfo?.reason})
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                <span className="text-slate-400 block text-[10px]">③ 공정 영향도</span>
                <span className="font-black text-slate-900 text-sm">+{breakdown.processScore}점</span>
                <span className="block text-[10px] text-slate-500 mt-0.5 truncate">
                  {breakdown.processLabel} ({processInfo?.reason})
                </span>
              </div>
            </div>
          </div>

          {/* 첨부 사진 갤러리 */}
          {suggestion.attachments && suggestion.attachments.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 mb-2">
                현장 첨부 사진 ({suggestion.attachments.length}장)
              </h4>
              <div className="grid grid-cols-3 gap-2.5">
                {suggestion.attachments.map(att => (
                  <div 
                    key={att.id}
                    onClick={() => setPreviewImage(att.url)}
                    className="relative aspect-video sm:aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer group"
                  >
                    <img src={att.url} alt={att.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                      확대 보기
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 조치 및 검토 현황 (F-05) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
            <h4 className="font-bold text-slate-800 text-xs sm:text-sm flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              <span>조치 할당 및 관리자 피드백 (F-05)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">지정 담당자</span>
                <span className="font-bold text-slate-800 text-sm">
                  {suggestion.assignedTo || '미지정 (검토 대기)'}
                </span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-slate-400 block text-[11px]">조치 마감일 (Due Date)</span>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="font-bold text-slate-800 text-sm">
                    {suggestion.dueDate ? `📅 ${suggestion.dueDate}` : '미설정'}
                  </span>
                  {deadlineInfo.hasDueDate && deadlineInfo.dDayLabel && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                        deadlineInfo.severity === 'overdue'
                          ? 'bg-red-600 text-white border-red-700'
                          : deadlineInfo.severity === 'today'
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : deadlineInfo.severity === 'soon'
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : deadlineInfo.severity === 'closed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {deadlineInfo.dDayLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* 처리 기한 임박 '알림 설정' 토글 카드 */}
            {canConfigureDeadlineAlert && (
              <div
                className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                  deadlineInfo.shouldTriggerAlert
                    ? 'bg-rose-50 border-rose-300'
                    : deadlineInfo.isEnabled
                    ? 'bg-amber-50/70 border-amber-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        deadlineInfo.shouldTriggerAlert
                          ? 'bg-rose-600 text-white animate-pulse'
                          : deadlineInfo.isEnabled
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {deadlineInfo.isEnabled ? (
                        <BellRing className="w-4 h-4" />
                      ) : (
                        <BellOff className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs sm:text-sm">
                          알림 설정 (처리 기한 임박 알림)
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                            deadlineInfo.isEnabled
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {deadlineInfo.isEnabled ? 'ON' : 'OFF'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        마감 기한이 임박하면 관리자에게 브라우저 푸시 알림 및 대시보드 경고 배너를 표시합니다.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={deadlineInfo.isEnabled}
                    aria-label="처리 기한 임박 알림 설정"
                    onClick={handleToggleAlertSwitch}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                      deadlineInfo.isEnabled ? 'bg-amber-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                        deadlineInfo.isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/70 text-[11px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="font-bold text-slate-600">임박 기준:</label>
                    <select
                      aria-label="알림 임박 기준 일수"
                      value={deadlineInfo.alertDaysBefore}
                      onChange={e => handleChangeAlertDays(Number(e.target.value))}
                      className="h-7 px-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-semibold outline-none"
                    >
                      <option value={0}>마감 당일 (D-Day)</option>
                      <option value={1}>마감 1일 전 (D-1)</option>
                      <option value={2}>마감 2일 전 (D-2)</option>
                      <option value={3}>마감 3일 전 (D-3)</option>
                    </select>

                    {(!suggestion.dueDate || !isAdminOrMaintenance) && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">마감일:</span>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={e => {
                            const nextDate = e.target.value;
                            setDueDate(nextDate);
                            onToggleDeadlineAlert?.(
                              suggestion.id,
                              deadlineInfo.isEnabled,
                              deadlineInfo.alertDaysBefore,
                              nextDate
                            );
                          }}
                          className="h-7 px-2 rounded-lg border border-slate-300 bg-white text-slate-800 font-medium outline-none"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {notifPermission === 'granted' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        <Bell className="w-3 h-3" />
                        브라우저 푸시 허용됨
                      </span>
                    ) : notifPermission === 'default' ? (
                      <button
                        type="button"
                        onClick={handleRequestPushPermission}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors"
                      >
                        <Bell className="w-3 h-3" />
                        브라우저 푸시 권한 허용
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                        대시보드 경고 알림 활성
                      </span>
                    )}

                    {deadlineInfo.isEnabled && onTriggerDeadlineTestAlert && (
                      <button
                        type="button"
                        onClick={() => onTriggerDeadlineTestAlert(suggestion)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold transition-colors"
                      >
                        <BellRing className="w-3 h-3" />
                        알림 미리보기
                      </button>
                    )}
                  </div>
                </div>

                {deadlineInfo.shouldTriggerAlert && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-rose-600 text-white text-xs font-bold">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      처리 기한이 임박했습니다 ({deadlineInfo.dDayLabel})! 관리자 대시보드에 경고가 표시됩니다.
                    </span>
                  </div>
                )}
              </div>
            )}

            {suggestion.adminFeedback && (
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3 text-xs text-blue-950">
                <div className="font-bold mb-1 flex items-center gap-1.5 text-blue-800">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>관리자 공식 코멘트</span>
                </div>
                <p className="leading-relaxed">{suggestion.adminFeedback}</p>
              </div>
            )}
          </div>

          {/* F-05 관리자/공무팀 전용 상태 변경 및 할당 폼 */}
          {isAdminOrMaintenance && (
            <form onSubmit={handleSaveAction} className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-700" />
                <span>관리자 권한: 상태 검토 & 실무 담당자 지정</span>
              </div>

              {/* 상태 선택 탭 */}
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                  상태 변경
                </label>
                <div className="grid grid-cols-5 gap-1">
                  {STATUS_LIST.map(st => {
                    const isCur = selectedStatus === st;
                    const meta = STATUS_CONFIG[st];
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSelectedStatus(st)}
                        className={`py-2 px-1 rounded-lg text-xs font-bold text-center border transition-all ${
                          isCur
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 담당자 지정 & 마감일 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    조치 담당자 지정
                  </label>
                  <select
                    value={assignedWorkerId}
                    onChange={e => setAssignedWorkerId(e.target.value)}
                    className="w-full h-10 px-2.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800 outline-none"
                  >
                    <option value="SAFETY01">이공무 과장 (공무/안전팀)</option>
                    <option value="ADMIN01">김상우 팀장 (제품팀 관리자)</option>
                    <optgroup label="공정별 반장">
                      {workers.filter(w => w.name.includes('반장')).map(w => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({PROCESS_CONFIG[w.process]?.label})
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">
                    마감 기한 (Due Date)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full h-10 px-2.5 bg-white border border-slate-300 rounded-lg text-slate-800 outline-none font-medium"
                  />
                </div>
              </div>

              {/* 피드백 코멘트 */}
              <div>
                <label className="block font-bold text-slate-600 mb-1 text-xs">
                  피드백 코멘트 (작업자 전달용)
                </label>
                <input
                  type="text"
                  placeholder="조치 방향, 부품 주문 현황 또는 반려 사유를 입력하세요"
                  value={feedbackComment}
                  onChange={e => setFeedbackComment(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>검토 결과 저장 및 상태 업데이트</span>
              </button>
            </form>
          )}

          {/* 변경 히스토리 타임라인 */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>조치 및 변경 이력 로그</span>
            </h4>
            <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-3 text-xs">
              {suggestion.historyLogs && suggestion.historyLogs.length > 0 ? (
                suggestion.historyLogs.map(log => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-blue-500" />
                    <div className="font-semibold text-slate-800">
                      {log.changedBy} 
                      <span className="text-[11px] text-slate-400 ml-1.5">({log.changedAt})</span>
                    </div>
                    <div className="text-slate-600 mt-0.5">
                      {log.comment || `상태 변경: ${log.fromStatus} ➔ ${log.toStatus}`}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-400 text-xs">기록된 이력이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 사진 확대 모달 */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-60 bg-black/85 flex items-center justify-center p-4"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img src={previewImage} alt="확대 보기" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <button 
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 text-white bg-black/60 rounded-full p-2"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
