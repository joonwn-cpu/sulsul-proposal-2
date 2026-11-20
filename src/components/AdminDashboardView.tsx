import React, { useMemo, useState } from 'react';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Search, 
  Award, 
  PieChart, 
  BarChart3,
  Download,
  ArrowUpRight,
  ArrowUpDown,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Flame,
  BellRing,
  BellOff,
  Bell,
  Activity
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
} from 'recharts';
import { 
  Suggestion, 
  BreweryStats, 
  BreweryWorker, 
  SuggestionStatus, 
  SuggestionCategory, 
  BreweryProcess 
} from '../types/brewery';
import { 
  CATEGORY_CONFIG, 
  PROCESS_CONFIG, 
  STATUS_CONFIG 
} from '../data/mockBreweryData';
import {
  PRIORITY_LEVEL_CONFIG,
  PROCESS_IMPORTANCE_SCORES,
  SuggestionSortMode,
  enrichSuggestionWithPriority,
  sortSuggestions,
} from '../lib/priorityScore';

import {
  BrowserNotificationPermissionState,
  getDeadlineAlertInfo,
} from '../lib/deadlineAlert';

interface AdminDashboardViewProps {
  stats: BreweryStats;
  suggestions: Suggestion[];
  workers: BreweryWorker[];
  currentUser: BreweryWorker;
  onSelectSuggestion: (suggestion: Suggestion) => void;
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
  notificationPermission?: BrowserNotificationPermissionState;
  onRequestNotificationPermission?: () => void;
  onDispatchPushAlerts?: () => void;
  onOpenAccountManager?: () => void;
  realUserCount?: number;
}

export function AdminDashboardView({
  stats,
  suggestions,
  workers,
  currentUser,
  onSelectSuggestion,
  onUpdateStatus,
  onToggleDeadlineAlert,
  notificationPermission = 'default',
  onRequestNotificationPermission,
  onDispatchPushAlerts,
  onOpenAccountManager,
  realUserCount = 0,
}: AdminDashboardViewProps) {
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterProcess, setFilterProcess] = useState<string>('ALL');
  const [highPriorityOnly, setHighPriorityOnly] = useState<boolean>(false);
  const [priorityThreshold, setPriorityThreshold] = useState<number>(50);
  const [sortMode, setSortMode] = useState<SuggestionSortMode>('PRIORITY_DESC');
  const [searchQuery, setSearchQuery] = useState('');
  const [activityProcessFilter, setActivityProcessFilter] = useState<string>('ALL');
  const [showAllWorkersInActivity, setShowAllWorkersInActivity] = useState<boolean>(false);

  // 처리 기한 임박 알림이 설정(ON)되고 기한이 임박/초과한 미완료 제안 목록
  const imminentDeadlineAlerts = useMemo(() => {
    return suggestions
      .map(s => ({
        suggestion: s,
        info: getDeadlineAlertInfo(s),
      }))
      .filter(entry => entry.info.shouldTriggerAlert)
      .sort((a, b) => {
        const diffA = a.info.daysRemaining ?? 999;
        const diffB = b.info.daysRemaining ?? 999;
        if (diffA !== diffB) return diffA - diffB;
        return (b.suggestion.priorityScore ?? 0) - (a.suggestion.priorityScore ?? 0);
      });
  }, [suggestions]);

  const enabledDeadlineAlertCount = useMemo(
    () =>
      suggestions.filter(
        s => s.deadlineAlertEnabled && s.status !== 'COMPLETED' && s.status !== 'REJECTED'
      ).length,
    [suggestions]
  );

  // 4대 카테고리 비중 계산
  const totalCatCount = Math.max(1, stats.totalSuggestions);
  const catPercentages = {
    PROCESS_IMPROVEMENT: Math.round((stats.categoryCounts.PROCESS_IMPROVEMENT / totalCatCount) * 100),
    BREAKDOWN_REPAIR: Math.round((stats.categoryCounts.BREAKDOWN_REPAIR / totalCatCount) * 100),
    PREVENTIVE_MAINT: Math.round((stats.categoryCounts.PREVENTIVE_MAINT / totalCatCount) * 100),
    RISK_ASSESSMENT: Math.round((stats.categoryCounts.RISK_ASSESSMENT / totalCatCount) * 100),
  };

  // 긴급 미조치 건수
  const urgentPendingCount = suggestions.filter(
    s => s.isUrgent && (s.status === 'PENDING' || s.status === 'REVIEWING')
  ).length;

  // 지난 7일간 요일별 일일 제안 접수량 계산
  const dailyIntakeData = useMemo(() => {
    const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
    const toLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const parseDateStr = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };

    const countByDate = new Map<string, { total: number; urgent: number }>();
    let latestDateStr = '';

    suggestions.forEach(s => {
      const datePart = s.createdAt.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return;
      const cur = countByDate.get(datePart) || { total: 0, urgent: 0 };
      cur.total += 1;
      if (s.isUrgent) cur.urgent += 1;
      countByDate.set(datePart, cur);
      if (!latestDateStr || datePart > latestDateStr) {
        latestDateStr = datePart;
      }
    });

    const today = new Date();
    const todayWindowStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    const todayWindowStartStr = toLocalDateStr(todayWindowStart);
    const todayStr = toLocalDateStr(today);

    const hasRecentInTodayWindow = Array.from(countByDate.keys()).some(
      d => d >= todayWindowStartStr && d <= todayStr
    );

    const anchorDate =
      hasRecentInTodayWindow || !latestDateStr
        ? new Date(today.getFullYear(), today.getMonth(), today.getDate())
        : parseDateStr(latestDateStr);

    return Array.from({ length: 7 }, (_, i) => {
      const offset = 6 - i;
      const target = new Date(
        anchorDate.getFullYear(),
        anchorDate.getMonth(),
        anchorDate.getDate() - offset
      );
      const dateStr = toLocalDateStr(target);
      const weekday = WEEKDAYS[target.getDay()];
      const shortDate = `${String(target.getMonth() + 1).padStart(2, '0')}/${String(target.getDate()).padStart(2, '0')}`;
      const counts = countByDate.get(dateStr) || { total: 0, urgent: 0 };

      return {
        date: dateStr,
        weekday: `${weekday}요일`,
        shortLabel: `${weekday}(${shortDate})`,
        fullDateLabel: `${dateStr} (${weekday}요일)`,
        total: counts.total,
        urgent: counts.urgent,
      };
    });
  }, [suggestions]);

  const weeklyTotalCount = useMemo(
    () => dailyIntakeData.reduce((acc, item) => acc + item.total, 0),
    [dailyIntakeData]
  );

  // 우선순위 점수 3구간 분포 계산 (0~50점, 51~80점, 81점 이상 초고위험)
  const priorityDistributionData = useMemo(() => {
    let lowCount = 0;
    let midCount = 0;
    let criticalCount = 0;

    suggestions.forEach(s => {
      const score = s.priorityScore ?? enrichSuggestionWithPriority(s).priorityScore ?? 0;
      if (score >= 81) {
        criticalCount += 1;
      } else if (score >= 51) {
        midCount += 1;
      } else {
        lowCount += 1;
      }
    });

    const total = Math.max(1, suggestions.length);
    return [
      {
        key: 'LOW_0_50',
        name: '0~50점 (일반)',
        shortName: '0~50점',
        value: lowCount,
        percent: Math.round((lowCount / total) * 100),
        color: '#3b82f6',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      {
        key: 'MID_51_80',
        name: '51~80점 (주의)',
        shortName: '51~80점',
        value: midCount,
        percent: Math.round((midCount / total) * 100),
        color: '#f59e0b',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      },
      {
        key: 'HIGH_81_PLUS',
        name: '81점 이상 (초고위험)',
        shortName: '81점+ 초고위험',
        value: criticalCount,
        percent: Math.round((criticalCount / total) * 100),
        color: '#dc2626',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      },
    ];
  }, [suggestions]);

  // 현재 상태가 'PENDING'인 제안들의 공정별 우선순위 점수 평균 계산
  const pendingProcessAvgData = useMemo(() => {
    const pendingItems = suggestions.filter(s => s.status === 'PENDING');
    const grouped = new Map<BreweryProcess, { sum: number; count: number }>();

    (Object.keys(PROCESS_CONFIG) as BreweryProcess[]).forEach(proc => {
      grouped.set(proc, { sum: 0, count: 0 });
    });

    pendingItems.forEach(s => {
      const score = s.priorityScore ?? enrichSuggestionWithPriority(s).priorityScore ?? 0;
      const cur = grouped.get(s.process) || { sum: 0, count: 0 };
      cur.sum += score;
      cur.count += 1;
      grouped.set(s.process, cur);
    });

    return (Object.keys(PROCESS_CONFIG) as BreweryProcess[])
      .map(proc => {
        const stat = grouped.get(proc) || { sum: 0, count: 0 };
        const avgScore = stat.count > 0 ? Number((stat.sum / stat.count).toFixed(1)) : 0;
        const shortName = PROCESS_CONFIG[proc].label.split('(')[0];
        const color =
          avgScore >= 80
            ? '#dc2626'
            : avgScore >= 50
            ? '#f59e0b'
            : avgScore > 0
            ? '#2563eb'
            : '#cbd5e1';

        return {
          process: proc,
          shortName,
          fullLabel: `${PROCESS_CONFIG[proc].icon} ${PROCESS_CONFIG[proc].label}`,
          avgScore,
          pendingCount: stat.count,
          color,
        };
      })
      .sort((a, b) => {
        if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
        return b.pendingCount - a.pendingCount;
      });
  }, [suggestions]);

  const pendingTotalCount = useMemo(
    () => pendingProcessAvgData.reduce((acc, d) => acc + d.pendingCount, 0),
    [pendingProcessAvgData]
  );

  const topPendingProcess = pendingProcessAvgData.find(d => d.pendingCount > 0) || null;

  // 지난 1개월간 작업자별 제안 활동량 집계
  const workerMonthlyActivity = useMemo(() => {
    const toLocalDateStr = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const parseDateStr = (dateStr: string) => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, (m || 1) - 1, d || 1);
    };

    let latestDateStr = '';
    suggestions.forEach(s => {
      const datePart = s.createdAt.slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart) && (!latestDateStr || datePart > latestDateStr)) {
        latestDateStr = datePart;
      }
    });

    const today = new Date();
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayOneMonthAgo = new Date(
      todayEnd.getFullYear(),
      todayEnd.getMonth() - 1,
      todayEnd.getDate()
    );
    const todayEndStr = toLocalDateStr(todayEnd);
    const todayStartStr = toLocalDateStr(todayOneMonthAgo);

    const hasInTodayMonth = suggestions.some(s => {
      const d = s.createdAt.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= todayStartStr && d <= todayEndStr;
    });

    const anchorEnd =
      hasInTodayMonth || !latestDateStr ? todayEnd : parseDateStr(latestDateStr);
    const anchorStart = new Date(
      anchorEnd.getFullYear(),
      anchorEnd.getMonth() - 1,
      anchorEnd.getDate()
    );
    const startStr = toLocalDateStr(anchorStart);
    const endStr = toLocalDateStr(anchorEnd);

    const monthlySuggestions = suggestions.filter(s => {
      const datePart = s.createdAt.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(datePart) && datePart >= startStr && datePart <= endStr;
    });

    const fieldWorkers = workers.filter(w => w.role === 'WORKER');
    const workerStatsMap = new Map<
      string,
      {
        workerId: string;
        name: string;
        process: BreweryProcess;
        count: number;
        completedCount: number;
        urgentCount: number;
      }
    >();

    fieldWorkers.forEach(w => {
      workerStatsMap.set(w.id, {
        workerId: w.id,
        name: w.name,
        process: w.process,
        count: 0,
        completedCount: 0,
        urgentCount: 0,
      });
    });

    monthlySuggestions.forEach(s => {
      const existing = workerStatsMap.get(s.authorId);
      if (existing) {
        existing.count += 1;
        if (s.status === 'COMPLETED') existing.completedCount += 1;
        if (s.isUrgent) existing.urgentCount += 1;
      } else {
        workerStatsMap.set(s.authorId, {
          workerId: s.authorId,
          name: s.authorName,
          process: s.authorProcess,
          count: 1,
          completedCount: s.status === 'COMPLETED' ? 1 : 0,
          urgentCount: s.isUrgent ? 1 : 0,
        });
      }
    });

    const allRows = Array.from(workerStatsMap.values())
      .map(entry => {
        const procMeta = PROCESS_CONFIG[entry.process];
        const shortProc = procMeta ? procMeta.label.split('(')[0] : entry.process;
        return {
          ...entry,
          processLabel: procMeta?.label || entry.process,
          processIcon: procMeta?.icon || '🏭',
          shortProc,
          axisLabel: `${entry.name} · ${shortProc}`,
        };
      })
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.completedCount !== a.completedCount) return b.completedCount - a.completedCount;
        if (b.urgentCount !== a.urgentCount) return b.urgentCount - a.urgentCount;
        return a.workerId.localeCompare(b.workerId);
      });

    const activeWorkers = allRows.filter(r => r.count > 0);
    const totalMonthlyCount = monthlySuggestions.length;
    const topWorker = activeWorkers[0] || null;
    const maxCount = topWorker ? topWorker.count : 0;

    return {
      startStr,
      endStr,
      allRows,
      activeWorkers,
      activeCount: activeWorkers.length,
      totalFieldWorkers: fieldWorkers.length,
      totalMonthlyCount,
      topWorker,
      maxCount,
    };
  }, [suggestions, workers]);

  const visibleWorkerActivityData = useMemo(() => {
    const base = showAllWorkersInActivity
      ? workerMonthlyActivity.allRows
      : workerMonthlyActivity.activeWorkers;

    const filtered =
      activityProcessFilter === 'ALL'
        ? base
        : base.filter(item => item.process === activityProcessFilter);

    return filtered.map((item, idx) => ({
      ...item,
      rank: idx + 1,
      barColor:
        item.count === 0
          ? '#e2e8f0'
          : item.count === workerMonthlyActivity.maxCount
          ? '#f59e0b'
          : idx < 3
          ? '#2563eb'
          : '#60a5fa',
    }));
  }, [workerMonthlyActivity, showAllWorkersInActivity, activityProcessFilter]);

  // 고우선순위(기준 점수 이상) 건수
  const highPriorityCount = suggestions.filter(s => {
    const score = s.priorityScore ?? enrichSuggestionWithPriority(s).priorityScore ?? 0;
    return score >= priorityThreshold;
  }).length;

  // 필터링 및 우선순위 자동 정렬된 제안 목록
  const filteredSuggestions = suggestions.filter(s => {
    const score = s.priorityScore ?? enrichSuggestionWithPriority(s).priorityScore ?? 0;
    const matchPriority = !highPriorityOnly || score >= priorityThreshold;
    const matchCat = filterCategory === 'ALL' || s.category === filterCategory;
    const matchSt = filterStatus === 'ALL' || s.status === filterStatus;
    const matchProc = filterProcess === 'ALL' || s.process === filterProcess;
    const matchSearch = !searchQuery.trim() || 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.authorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.quickTags && s.quickTags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchPriority && matchCat && matchSt && matchProc && matchSearch;
  });

  const sortedSuggestions = sortSuggestions(filteredSuggestions, sortMode);

  // 현재 조회 중인 제안 목록 CSV 리포트 다운로드 (조치 결과 및 담당자 정보 포함)
  const handleExportCsv = () => {
    if (sortedSuggestions.length === 0) return;

    const escapeCsv = (val: string | number | undefined | null) => {
      const normalized = String(val ?? '').replace(/\r?\n/g, ' ').trim();
      return `"${normalized.replace(/"/g, '""')}"`;
    };

    const headers = [
      '제안 ID',
      '우선순위 점수',
      '위험 등급',
      '긴급 여부',
      '제안 유형',
      '공정',
      '상세 위치',
      '제목',
      '상세 내용',
      '작성자',
      '작성자 사번',
      '진행 상태',
      '조치 담당자',
      '담당자 사번',
      '조치 마감일',
      '기한 알림 설정',
      '조치 결과(피드백/완료내역)',
      '조치 완료일시',
      '등록일시',
      '태그',
    ];

    const rows = sortedSuggestions.map(raw => {
      const s = raw.priorityBreakdown ? raw : enrichSuggestionWithPriority(raw);
      const bd = s.priorityBreakdown!;
      const score = s.priorityScore ?? bd.totalScore;
      const riskLabel = score >= 80 ? '초고위험' : PRIORITY_LEVEL_CONFIG[bd.level].label;

      const completionLog = [...(s.historyLogs || [])]
        .reverse()
        .find(log => log.toStatus === 'COMPLETED');
      const latestLog =
        s.historyLogs && s.historyLogs.length > 0
          ? s.historyLogs[s.historyLogs.length - 1]
          : undefined;

      const resultParts: string[] = [];
      if (s.adminFeedback) resultParts.push(s.adminFeedback);
      if (completionLog?.comment && completionLog.comment !== s.adminFeedback) {
        resultParts.push(`[완료 기록] ${completionLog.comment}`);
      } else if (
        s.status === 'COMPLETED' &&
        !s.adminFeedback &&
        latestLog?.comment
      ) {
        resultParts.push(latestLog.comment);
      }

      const actionResult =
        resultParts.length > 0
          ? resultParts.join(' / ')
          : s.status === 'COMPLETED'
          ? '조치 완료'
          : '조치 진행/대기중';

      return [
        escapeCsv(s.id),
        escapeCsv(score),
        escapeCsv(riskLabel),
        escapeCsv(s.isUrgent ? '긴급' : '일반'),
        escapeCsv(CATEGORY_CONFIG[s.category]?.shortLabel || s.category),
        escapeCsv(PROCESS_CONFIG[s.process]?.label || s.process),
        escapeCsv(s.locationDetail || PROCESS_CONFIG[s.process]?.zone || ''),
        escapeCsv(s.title),
        escapeCsv(s.description),
        escapeCsv(s.authorName),
        escapeCsv(s.authorId),
        escapeCsv(STATUS_CONFIG[s.status]?.label || s.status),
        escapeCsv(s.assignedTo || '미지정'),
        escapeCsv(s.assignedToId || '-'),
        escapeCsv(s.dueDate || '-'),
        escapeCsv(s.deadlineAlertEnabled ? 'ON' : 'OFF'),
        escapeCsv(actionResult),
        escapeCsv(s.completedAt || '-'),
        escapeCsv(s.createdAt),
        escapeCsv((s.quickTags || []).join(' | ')),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `술술제안_관리자리포트_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 1. 상단 관리자 안내 및 KPI 요약 카드 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-slate-900 text-white">
              F-06 관리 대시보드
            </span>
            <span className="text-xs text-slate-500 font-medium">
              탁·약주 주류공장 실시간 통합 관제
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            제품팀 & 공무/안전 통합 제안 관리
          </h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onOpenAccountManager && (
            <button
              type="button"
              onClick={onOpenAccountManager}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span>
                직원 사번 계정 관리{realUserCount > 0 ? ` (${realUserCount}명)` : ''}
              </span>
            </button>
          )}
          {notificationPermission === 'default' && onRequestNotificationPermission && (
            <button
              type="button"
              onClick={onRequestNotificationPermission}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold rounded-xl transition-colors"
            >
              <Bell className="w-4 h-4 text-amber-600" />
              <span>브라우저 푸시 알림 허용</span>
            </button>
          )}
          <button 
            type="button"
            onClick={handleExportCsv}
            disabled={sortedSuggestions.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>조회 목록 CSV 다운로드 ({sortedSuggestions.length}건)</span>
          </button>
        </div>
      </div>

      {/* 처리 기한 임박 알림 경고 배너 */}
      {imminentDeadlineAlerts.length > 0 && (
        <div className="bg-rose-50/90 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 animate-pulse shadow-xs">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-black text-rose-950 text-sm sm:text-base">
                    처리 기한 임박 경고 ({imminentDeadlineAlerts.length}건)
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold">
                    알림 설정 활성 {enabledDeadlineAlertCount}건 감시중
                  </span>
                </div>
                <p className="text-xs text-rose-800 mt-0.5">
                  기한 알림이 설정된 제안 중 마감 기한이 임박하거나 초과된 항목입니다. 클릭하여 상세 조치 및 기한을 관리하세요.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {notificationPermission === 'default' && onRequestNotificationPermission && (
                <button
                  type="button"
                  onClick={onRequestNotificationPermission}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>푸시 알림 권한 허용</span>
                </button>
              )}
              {notificationPermission === 'granted' && onDispatchPushAlerts && (
                <button
                  type="button"
                  onClick={onDispatchPushAlerts}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-2xs"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  <span>브라우저 푸시 알림 발송</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {imminentDeadlineAlerts.map(({ suggestion: alertItem, info }) => (
              <div
                key={alertItem.id}
                onClick={() => onSelectSuggestion(alertItem)}
                className="bg-white hover:bg-rose-50/40 border border-rose-200 rounded-xl p-3 cursor-pointer transition-colors flex items-start justify-between gap-3 shadow-2xs"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${
                        info.severity === 'overdue'
                          ? 'bg-red-600 text-white border-red-700'
                          : info.severity === 'today'
                          ? 'bg-rose-600 text-white border-rose-700'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {info.dDayLabel}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-slate-500">
                      {alertItem.id}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      마감 {alertItem.dueDate}
                    </span>
                  </div>
                  <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {alertItem.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    담당: {alertItem.assignedTo ? alertItem.assignedTo.split(' ')[0] : '미지정'} · 상태:{' '}
                    {STATUS_CONFIG[alertItem.status]?.label}
                  </p>
                </div>

                {onToggleDeadlineAlert && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onToggleDeadlineAlert(alertItem.id, false);
                    }}
                    title="이 제안의 기한 알림 끄기"
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold shrink-0 transition-colors"
                  >
                    알림 끄기
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI 4대 지표 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: 현장 27명 참여율 (PRD 100% 목표) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>현장 직원 참여율 (27명)</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {stats.workerParticipationRate}%
            </span>
            <span className="text-xs font-semibold text-slate-500">
              ({stats.activeWorkersCount} / 27명 참여)
            </span>
          </div>
          <div className="mt-3">
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${stats.workerParticipationRate}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              목표: 1개월 내 27명 전원 100% 최소 1회 제안
            </span>
          </div>
        </div>

        {/* KPI 2: 총 누적 제안 건수 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>총 등록 제안</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {stats.totalSuggestions}건
            </span>
            <span className="text-xs font-semibold text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" /> 전월대비 +38%
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            완료 처리율: {Math.round((stats.statusCounts.COMPLETED / totalCatCount) * 100)}%
          </p>
        </div>

        {/* KPI 3: 긴급 조치 요망 (고장/위험) */}
        <div className={`p-5 rounded-2xl border shadow-xs transition-colors ${
          urgentPendingCount > 0 
            ? 'bg-rose-50/70 border-rose-200' 
            : 'bg-white border-slate-200'
        }`}>
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className={urgentPendingCount > 0 ? 'text-rose-900' : 'text-slate-500'}>
              긴급 미조치 (F-03)
            </span>
            <AlertTriangle className={`w-4 h-4 ${urgentPendingCount > 0 ? 'text-rose-600' : 'text-slate-400'}`} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black ${urgentPendingCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {urgentPendingCount}건
            </span>
            <span className="text-xs font-semibold text-slate-500">
              즉시 조치 필요
            </span>
          </div>
          <p className="text-[11px] text-rose-700 mt-3">
            고장정비 및 아차사고 위험성평가
          </p>
        </div>

        {/* KPI 4: 평균 조치 리드타임 (30% 단축 목표) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-2">
            <span>고장정비 평균 리드타임</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              {stats.avgLeadTimeHours}시간
            </span>
            <span className="text-xs font-semibold text-emerald-600">
              ▼ 32% 단축 달성
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-3">
            기존 수기/구두 보고 5.6시간 ➔ 현재 3.8시간
          </p>
        </div>
      </div>

      {/* 2. 시각화 섹션: 일일 제안 접수량 라인 차트 & 4대 카테고리 비중 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 지난 7일간 요일별 일일 제안 접수량 라인 차트 (Recharts) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <span>일일 제안 접수량 (최근 7일 요일별)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {dailyIntakeData[0]?.date} ~ {dailyIntakeData[6]?.date} 기준 요일별 전체 및 긴급 접수 추이
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                최근 7일 합계 {weeklyTotalCount}건
              </span>
            </div>
          </div>

          <div className="w-full h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={dailyIntakeData}
                margin={{ top: 10, right: 16, left: -16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="weekday"
                  tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  itemStyle={{ fontWeight: 700 }}
                  labelStyle={{ color: '#cbd5e1', fontWeight: 700, marginBottom: '4px' }}
                  formatter={(value, name) => [`${Number(value ?? 0)}건`, String(name ?? '')]}
                  labelFormatter={(label, payload) => {
                    const entry = payload?.[0]?.payload as { fullDateLabel?: string } | undefined;
                    return entry?.fullDateLabel || String(label ?? '');
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '6px' }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="전체 접수"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="urgent"
                  name="긴급 (고장/위험)"
                  stroke="#e11d48"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#e11d48', strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 카테고리별 비중 카드 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-600" />
              <span>4대 제안 카테고리 비중</span>
            </h3>
            <span className="text-xs text-slate-400">총 {stats.totalSuggestions}건</span>
          </div>

          <div className="space-y-3 pt-2">
            {(['BREAKDOWN_REPAIR', 'RISK_ASSESSMENT', 'PROCESS_IMPROVEMENT', 'PREVENTIVE_MAINT'] as SuggestionCategory[]).map(cat => {
              const meta = CATEGORY_CONFIG[cat];
              const count = stats.categoryCounts[cat] || 0;
              const percent = catPercentages[cat];

              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.bgLight} border ${meta.border}`} />
                      {meta.shortLabel}
                    </span>
                    <span>{count}건 ({percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${
                        cat === 'BREAKDOWN_REPAIR' ? 'bg-rose-500' :
                        cat === 'RISK_ASSESSMENT' ? 'bg-orange-500' :
                        cat === 'PROCESS_IMPROVEMENT' ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
            💡 <strong>인사이트:</strong> 발효조 교반기 및 병입기 중심의 고장정비 접수율이 가장 높으며, 위험성평가를 통한 아차사고 사전 차단 효과가 뚜렷합니다.
          </div>
        </div>
      </div>

      {/* 3. 우선순위 점수 분포 파이 차트 & 27명 현장 우수 제안자 랭킹 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 우선순위 점수 구간별 파이 차트 */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-1 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4 text-rose-600" />
                <span>우선순위 점수 분포</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                0~50점 · 51~80점 · 81점+(초고위험)
              </p>
            </div>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              총 {suggestions.length}건
            </span>
          </div>

          <div className="w-full h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={priorityDistributionData.filter(d => d.value > 0)}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={3}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {priorityDistributionData
                    .filter(d => d.value > 0)
                    .map(entry => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#f8fafc', fontWeight: 700 }}
                  formatter={(value, name) => {
                    const count = Number(value ?? 0);
                    const pct =
                      suggestions.length > 0
                        ? Math.round((count / suggestions.length) * 100)
                        : 0;
                    return [`${count}건 (${pct}%)`, String(name ?? '')];
                  }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-1 border-t border-slate-100">
            {priorityDistributionData.map(bucket => (
              <div
                key={bucket.key}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: bucket.color }}
                  />
                  <span className="font-semibold text-slate-700">
                    {bucket.name}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold border tabular-nums ${bucket.badgeClass}`}
                >
                  {bucket.value}건 ({bucket.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 27명 현장 우수 제안자 랭킹 (포상 연계용) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span>현장 우수 제안자 TOP 랭킹 (포상 연계)</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                월간 최다 제안 및 채택 직원 대상 분기별 인센티브 지급 데이터
              </p>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              27명 전원 추적중
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">순위</th>
                  <th className="py-2.5 px-3">성명 (사번)</th>
                  <th className="py-2.5 px-3">담당 공정</th>
                  <th className="py-2.5 px-3 text-center">등록 건수</th>
                  <th className="py-2.5 px-3 text-center">채택/완료</th>
                  <th className="py-2.5 px-3 text-right">포상 점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {stats.topSuggesters.map((item, index) => (
                  <tr key={item.workerId} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-bold">
                      {index === 0 && <span className="inline-block w-5 h-5 rounded-full bg-amber-400 text-amber-950 text-center font-extrabold text-[11px] leading-5">1</span>}
                      {index === 1 && <span className="inline-block w-5 h-5 rounded-full bg-slate-300 text-slate-800 text-center font-extrabold text-[11px] leading-5">2</span>}
                      {index === 2 && <span className="inline-block w-5 h-5 rounded-full bg-amber-700 text-white text-center font-extrabold text-[11px] leading-5">3</span>}
                      {index > 2 && <span className="text-slate-400 ml-1.5">{index + 1}</span>}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {item.name} <span className="text-slate-400 font-normal">({item.workerId})</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {PROCESS_CONFIG[item.process]?.icon} {PROCESS_CONFIG[item.process]?.label}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-blue-600">
                      {item.count}건
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-emerald-600">
                      {item.adoptedCount}건
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      {item.count * 10 + item.adoptedCount * 50}점
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 4. 대기중(PENDING) 제안 공정별 평균 우선순위 점수 막대 그래프 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <span>대기중(PENDING) 공정별 평균 우선순위 점수</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              미처리 대기(PENDING) 제안의 공정별 평균 위험도·중요도 비교 (리소스 우선 배정 기준)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {topPendingProcess && (
              <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                우선 투입 권장: {topPendingProcess.fullLabel} ({topPendingProcess.avgScore}점)
              </span>
            )}
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              PENDING 총 {pendingTotalCount}건
            </span>
          </div>
        </div>

        {pendingTotalCount === 0 ? (
          <div className="h-[220px] flex items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400">
            현재 대기중(PENDING) 상태의 제안이 없습니다. 모든 제안이 검토 또는 조치 단계로 전환되었습니다.
          </div>
        ) : (
          <div className="w-full h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pendingProcessAvgData}
                margin={{ top: 12, right: 16, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fontSize: 12, fill: '#334155', fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                  unit="점"
                />
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.7)' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #334155',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                  itemStyle={{ color: '#f8fafc', fontWeight: 700 }}
                  labelStyle={{ color: '#cbd5e1', fontWeight: 700, marginBottom: '4px' }}
                  formatter={(value, _name, props) => {
                    const row = props?.payload as { pendingCount?: number } | undefined;
                    const count = row?.pendingCount ?? 0;
                    return [`${Number(value ?? 0)}점 (대기 ${count}건)`, '평균 우선순위'];
                  }}
                  labelFormatter={(label, payload) => {
                    const entry = payload?.[0]?.payload as { fullLabel?: string } | undefined;
                    return entry?.fullLabel || String(label ?? '');
                  }}
                />
                <Bar
                  dataKey="avgScore"
                  name="평균 우선순위 점수"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={48}
                >
                  {pendingProcessAvgData.map(entry => (
                    <Cell key={entry.process} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 4-2. 지난 1개월간 작업자별 활동량 리포트 막대 그래프 */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-600" />
                <span>작업자별 활동량 (최근 1개월 제안 건수)</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                {workerMonthlyActivity.startStr} ~ {workerMonthlyActivity.endStr}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              지난 1개월간 각 현장 작업자가 등록한 제안 건수를 비교하여 최다 활동 작업자와 참여 현황을 한눈에 파악합니다.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {workerMonthlyActivity.topWorker && (
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300">
                <Award className="w-3.5 h-3.5 text-amber-600" />
                최다 제출: {workerMonthlyActivity.topWorker.name} ({workerMonthlyActivity.topWorker.count}건)
              </span>
            )}
            <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
              활동 {workerMonthlyActivity.activeCount} / {workerMonthlyActivity.totalFieldWorkers}명 · 총 {workerMonthlyActivity.totalMonthlyCount}건
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-slate-100">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowAllWorkersInActivity(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                !showAllWorkersInActivity
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              제출 작업자만 ({workerMonthlyActivity.activeCount}명)
            </button>
            <button
              type="button"
              onClick={() => setShowAllWorkersInActivity(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                showAllWorkersInActivity
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              전체 현장 작업자 ({workerMonthlyActivity.totalFieldWorkers}명)
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold mr-1">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" /> 최다 제출
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" /> 상위 활동
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-400" /> 일반 활동
              </span>
            </div>
            <select
              aria-label="작업자별 활동량 공정 필터"
              value={activityProcessFilter}
              onChange={e => setActivityProcessFilter(e.target.value)}
              className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
            >
              <option value="ALL">전체 공정</option>
              {Object.entries(PROCESS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label.split('(')[0]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visibleWorkerActivityData.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-400 gap-2">
            <span>해당 조건에 맞는 최근 1개월 제안 활동 데이터가 없습니다.</span>
            {!showAllWorkersInActivity && (
              <button
                type="button"
                onClick={() => setShowAllWorkersInActivity(true)}
                className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                전체 작업자 현황 보기
              </button>
            )}
          </div>
        ) : (
          <div className="max-h-[440px] overflow-y-auto pr-1">
            <div className="w-full">
              <ResponsiveContainer
                width="100%"
                height={Math.max(220, visibleWorkerActivityData.length * 36 + 32)}
              >
                <BarChart
                  data={visibleWorkerActivityData}
                  layout="vertical"
                  margin={{ top: 8, right: 44, left: 10, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                    unit="건"
                  />
                  <YAxis
                    type="category"
                    dataKey="axisLabel"
                    width={138}
                    tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 700 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(241, 245, 249, 0.75)' }}
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    itemStyle={{ color: '#f8fafc', fontWeight: 700 }}
                    labelStyle={{ color: '#fcd34d', fontWeight: 800, marginBottom: '4px' }}
                    formatter={(value, _name, props) => {
                      const row = props?.payload as
                        | { completedCount?: number; urgentCount?: number }
                        | undefined;
                      const comp = row?.completedCount ?? 0;
                      const urg = row?.urgentCount ?? 0;
                      return [
                        `${Number(value ?? 0)}건 (완료 ${comp}건 · 긴급 ${urg}건)`,
                        '최근 1개월 제안',
                      ];
                    }}
                    labelFormatter={(label, payload) => {
                      const entry = payload?.[0]?.payload as
                        | {
                            name?: string;
                            workerId?: string;
                            processIcon?: string;
                            processLabel?: string;
                          }
                        | undefined;
                      if (!entry) return String(label ?? '');
                      return `${entry.name} (${entry.workerId}) · ${entry.processIcon} ${entry.processLabel}`;
                    }}
                  />
                  <Bar
                    dataKey="count"
                    name="월간 제안 건수"
                    radius={[0, 8, 8, 0]}
                    barSize={22}
                  >
                    {visibleWorkerActivityData.map(entry => (
                      <Cell key={entry.workerId} fill={entry.barColor} />
                    ))}
                    <LabelList
                      dataKey="count"
                      position="right"
                      formatter={val => `${Number(val ?? 0)}건`}
                      style={{ fontSize: '11px', fontWeight: 800, fill: '#334155' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 5. F-05 통합 제안 검토 및 할당 목록 (우선순위 자동 산정 & 정렬) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* 필터 및 검색 헤더 */}
        <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-base text-slate-900">
                  전체 제안 목록 및 우선순위 정렬 현황 (F-05)
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                  <Flame className="w-3 h-3" />
                  자동 우선순위 정렬 적용됨
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                산정 기준: <strong>긴급도</strong>(50점/0점) + <strong>카테고리 심각도</strong>(위험 40 · 고장 30 · 예방 20 · 개선 10) + <strong>공정 영향도</strong>(병입 10 · 발효 9 · 여과 7 · 담금 6 · 제국 5 · 제성 4 · 기타 2)
              </p>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="제목, 작성자, 태그, ID 검색..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={sortedSuggestions.length === 0}
                title="현재 필터·정렬된 목록을 담당자 및 조치 결과 포함 CSV 파일로 다운로드"
                className="inline-flex items-center gap-1.5 h-9 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-xl transition-colors shrink-0 shadow-2xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV ({sortedSuggestions.length}건)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pt-1">
            {/* 한눈에 보는 우선순위 정렬 & 고우선순위 필터 토글 그룹 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* 고우선순위만 보기 토글 */}
              <button
                type="button"
                role="switch"
                aria-checked={highPriorityOnly}
                onClick={() => setHighPriorityOnly(prev => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                  highPriorityOnly
                    ? 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-200'
                    : 'bg-rose-50/70 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <Flame className={`w-3.5 h-3.5 ${highPriorityOnly ? 'text-amber-300' : 'text-rose-600'}`} />
                <span>고우선순위만 보기 ({priorityThreshold}점+)</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    highPriorityOnly
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {highPriorityCount}건
                </span>
                <span
                  className={`w-7 h-4 rounded-full p-0.5 flex items-center transition-colors ${
                    highPriorityOnly ? 'bg-white/30 justify-end' : 'bg-rose-200 justify-start'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full bg-white shadow-xs" />
                </span>
              </button>

              {highPriorityOnly && (
                <select
                  aria-label="고우선순위 기준 점수 선택"
                  value={priorityThreshold}
                  onChange={e => setPriorityThreshold(Number(e.target.value))}
                  className="h-8 px-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[11px] font-bold text-rose-900 outline-none"
                >
                  <option value={50}>기준: 50점+ (높음 이상)</option>
                  <option value={80}>기준: 80점+ (초고위험만)</option>
                </select>
              )}

              <span className="hidden sm:inline-block w-px h-5 bg-slate-200 mx-1" />

              <span className="text-[11px] font-bold text-slate-500 mr-0.5 flex items-center gap-1">
                <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
                정렬:
              </span>
              <button
                type="button"
                onClick={() => setSortMode('PRIORITY_DESC')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  sortMode === 'PRIORITY_DESC'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowDownWideNarrow className="w-3.5 h-3.5 text-amber-400" />
                <span>점수 높은 순</span>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('PRIORITY_ASC')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  sortMode === 'PRIORITY_ASC'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <ArrowUpNarrowWide className="w-3.5 h-3.5" />
                <span>점수 낮은 순</span>
              </button>
              <button
                type="button"
                onClick={() => setSortMode('LATEST_DESC')}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                  sortMode === 'LATEST_DESC'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>최신 등록순</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* 카테고리 필터 */}
              <select
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="ALL">전체 카테고리 (4대)</option>
                {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.shortLabel}</option>
                ))}
              </select>

              {/* 상태 필터 */}
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="ALL">전체 진행 상태</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {/* 공정 필터 */}
              <select
                value={filterProcess}
                onChange={e => setFilterProcess(e.target.value)}
                className="h-9 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none"
              >
                <option value="ALL">전체 공정 (제국~병입)</option>
                {Object.entries(PROCESS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.icon} {v.label} (중요도 {PROCESS_IMPORTANCE_SCORES[k as BreweryProcess]?.score}점)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 제안 테이블 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 pl-4 pr-1 w-12 text-center whitespace-nowrap">경고</th>
                <th className="py-3 px-4 min-w-[185px]">
                  <button
                    type="button"
                    onClick={() =>
                      setSortMode(prev => (prev === 'PRIORITY_DESC' ? 'PRIORITY_ASC' : 'PRIORITY_DESC'))
                    }
                    className="inline-flex items-center gap-1.5 font-extrabold text-slate-800 hover:text-indigo-600 transition-colors"
                  >
                    <span>우선순위 점수</span>
                    {sortMode === 'PRIORITY_DESC' && (
                      <ArrowDownWideNarrow className="w-3.5 h-3.5 text-rose-600" />
                    )}
                    {sortMode === 'PRIORITY_ASC' && (
                      <ArrowUpNarrowWide className="w-3.5 h-3.5 text-indigo-600" />
                    )}
                    {sortMode === 'LATEST_DESC' && (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-4">제안 ID</th>
                <th className="py-3 px-4">유형 / 공정</th>
                <th className="py-3 px-4 min-w-[240px]">제안 제목, 위치 및 태그</th>
                <th className="py-3 px-4">작성자</th>
                <th className="py-3 px-4">진행 상태</th>
                <th className="py-3 px-4">조치 담당자</th>
                <th className="py-3 px-4">마감일</th>
                <th className="py-3 px-4 text-center">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSuggestions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 space-y-2">
                    <div>
                      {highPriorityOnly
                        ? `${priorityThreshold}점 이상의 고우선순위 제안이 없습니다.`
                        : '일치하는 제안 내역이 없습니다.'}
                    </div>
                    {highPriorityOnly && (
                      <button
                        type="button"
                        onClick={() => setHighPriorityOnly(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
                      >
                        전체 제안 보기
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                sortedSuggestions.map((rawItem, idx) => {
                  const item = rawItem.priorityBreakdown
                    ? rawItem
                    : enrichSuggestionWithPriority(rawItem);
                  const breakdown = item.priorityBreakdown!;
                  const priorityScore = item.priorityScore ?? breakdown.totalScore;
                  const isSuperHighRisk = priorityScore >= 80;
                  const levelMeta = PRIORITY_LEVEL_CONFIG[breakdown.level];
                  const catMeta = CATEGORY_CONFIG[item.category];
                  const procMeta = PROCESS_CONFIG[item.process];
                  const stMeta = STATUS_CONFIG[item.status];
                  const isUrgent = item.isUrgent;

                  return (
                    <tr 
                      key={item.id} 
                      className={`transition-colors ${
                        isSuperHighRisk
                          ? 'bg-rose-50/70 hover:bg-rose-100/60 border-l-4 border-l-rose-600'
                          : isUrgent && item.status !== 'COMPLETED'
                          ? 'bg-rose-50/30 hover:bg-slate-50/80'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <td className="py-3 pl-4 pr-1 text-center align-middle">
                        {isSuperHighRisk ? (
                          <span
                            title={`초고위험 제안 (${priorityScore}점 · 80점 이상)`}
                            aria-label="초고위험 경고"
                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-red-600 text-white shadow-xs ring-2 ring-red-200 animate-pulse"
                          >
                            <AlertTriangle className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="inline-block text-slate-300 text-xs select-none" aria-hidden="true">
                            —
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black shrink-0 ${
                              isSuperHighRisk
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-200/80 text-slate-700'
                            }`}>
                              {idx + 1}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border shadow-2xs whitespace-nowrap ${levelMeta.badgeClass}`}
                              title={`긴급도 ${breakdown.urgencyScore}점 + 유형 ${breakdown.categoryScore}점 + 공정 ${breakdown.processScore}점`}
                            >
                              <span className="tabular-nums">{priorityScore}점</span>
                              <span className="opacity-70">·</span>
                              <span>{levelMeta.label}</span>
                            </span>
                            {isSuperHighRisk && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black tracking-tight shadow-2xs ring-1 ring-red-700 whitespace-nowrap">
                                <AlertTriangle className="w-3 h-3" />
                                <span>초고위험</span>
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${levelMeta.barColor}`}
                              style={{ width: `${priorityScore}%` }}
                            />
                          </div>
                          <div className={`text-[10px] font-medium whitespace-nowrap ${
                            isSuperHighRisk ? 'text-rose-700 font-bold' : 'text-slate-500'
                          }`}>
                            긴급 {breakdown.urgencyScore} · 유형 {breakdown.categoryScore} · 공정 {breakdown.processScore}
                          </div>
                        </div>
                      </td>

                      <td className={`py-3 px-4 font-mono font-bold whitespace-nowrap ${
                        isSuperHighRisk ? 'text-rose-700' : 'text-slate-700'
                      }`}>
                        {item.id}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] whitespace-nowrap ${catMeta.bgLight} ${catMeta.color}`}>
                            {catMeta.shortLabel}
                            {isUrgent && <span className="ml-1 text-rose-600">●</span>}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                            {procMeta?.icon} {procMeta?.label}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          {isSuperHighRisk && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-700 border border-red-300 text-[10px] font-black shrink-0">
                              초고위험
                            </span>
                          )}
                          <div 
                            onClick={() => onSelectSuggestion(item)}
                            className={`cursor-pointer line-clamp-1 text-sm ${
                              isSuperHighRisk
                                ? 'font-extrabold text-red-700 hover:text-red-800'
                                : 'font-bold text-slate-900 hover:text-blue-600'
                            }`}
                          >
                            {item.title}
                          </div>
                        </div>
                        <div className={`text-[11px] truncate mt-0.5 ${
                          isSuperHighRisk ? 'text-rose-700/80 font-medium' : 'text-slate-400'
                        }`}>
                          📍 {item.locationDetail || procMeta?.zone}
                        </div>
                        {item.quickTags && item.quickTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.quickTags.slice(0, 3).map((tag, tagIdx) => (
                              <span
                                key={tagIdx}
                                className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{item.authorName}</div>
                        <div className="text-[10px] text-slate-400">{item.createdAt.split(' ')[0]}</div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-full font-bold text-[11px] border ${stMeta.badgeClass}`}>
                          {stMeta.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium whitespace-nowrap">
                        {item.assignedTo ? (
                          <span className="font-semibold">{item.assignedTo.split(' ')[0]} {item.assignedTo.split(' ')[1]}</span>
                        ) : (
                          <span className="text-slate-400">미지정</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-600 font-mono whitespace-nowrap">
                        {(() => {
                          const dInfo = getDeadlineAlertInfo(item);
                          return (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={
                                    dInfo.shouldTriggerAlert
                                      ? 'font-black text-rose-700'
                                      : 'text-slate-600'
                                  }
                                >
                                  {item.dueDate || '-'}
                                </span>
                                {onToggleDeadlineAlert && !dInfo.isClosed && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onToggleDeadlineAlert(
                                        item.id,
                                        !dInfo.isEnabled,
                                        dInfo.alertDaysBefore
                                      )
                                    }
                                    title={
                                      dInfo.isEnabled
                                        ? '기한 임박 알림 켜짐 (클릭하여 끄기)'
                                        : '기한 임박 알림 꺼짐 (클릭하여 켜기)'
                                    }
                                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-sans text-[10px] font-bold border transition-colors ${
                                      dInfo.shouldTriggerAlert
                                        ? 'bg-rose-600 text-white border-rose-700'
                                        : dInfo.isEnabled
                                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                                        : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-700'
                                    }`}
                                  >
                                    {dInfo.isEnabled ? (
                                      <BellRing className="w-3 h-3" />
                                    ) : (
                                      <BellOff className="w-3 h-3" />
                                    )}
                                    <span>{dInfo.isEnabled ? '알림ON' : 'OFF'}</span>
                                  </button>
                                )}
                              </div>
                              {dInfo.shouldTriggerAlert && dInfo.dDayLabel && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-sans text-[10px] font-extrabold ${
                                    dInfo.severity === 'overdue'
                                      ? 'bg-red-600 text-white'
                                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                                  }`}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {dInfo.dDayLabel}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => onSelectSuggestion(item)}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs"
                        >
                          검토 / 할당
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
