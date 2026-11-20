import React, { useMemo, useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  LabelList,
  ReferenceLine,
} from 'recharts';
import { BreweryProcess, Suggestion } from '../types/brewery';
import { PROCESS_CONFIG, PROCESS_ORDER } from '../data/mockBreweryData';

interface DashboardAnalyticsChartsProps {
  suggestions: Suggestion[];
  selectedProcessFilter: string;
  onSelectProcessFilter: (process: string) => void;
}

type ProcessBarMode = 'RATE' | 'COUNT';

interface ProcessRateRow {
  process: BreweryProcess;
  label: string;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  rejected: number;
  unresolved: number;
  completionRate: number;
  rateLabel: string;
  barColor: string;
  statusTierLabel: string;
}

interface MonthlyTrendRow {
  monthKey: string;
  axisLabel: string;
  fullLabel: string;
  total: number;
  completed: number;
  urgent: number;
  completionRate: number;
}

interface CustomTooltipPayloadItem<T> {
  payload?: T;
}

interface CustomTooltipProps<T> {
  active?: boolean;
  payload?: Array<CustomTooltipPayloadItem<T>>;
}

function parseYearMonth(dateStr: string): { year: number; month: number } | null {
  const match = String(dateStr || '').trim().match(/^(\d{4})[-/.](\d{1,2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function ProcessRateTooltip({ active, payload }: CustomTooltipProps<ProcessRateRow>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 shadow-xl space-y-1.5 min-w-[180px] tabular-nums">
      <div className="flex items-center justify-between gap-4 border-b border-slate-700/80 pb-1.5">
        <span className="font-bold text-white">{row.label}</span>
        <span className="font-mono font-bold text-emerald-400">
          {row.total > 0 ? `${row.completionRate}%` : '미등록'}
        </span>
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">전체 등록</span>
          <span className="font-mono font-semibold text-white">{row.total}건</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">완료 처리</span>
          <span className="font-mono font-semibold text-emerald-400">{row.completed}건</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">검토 · 조치중</span>
          <span className="font-mono font-semibold text-sky-300">{row.inProgress}건</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">대기중</span>
          <span className="font-mono font-semibold text-amber-300">{row.pending}건</span>
        </div>
        {row.rejected > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">반려</span>
            <span className="font-mono font-semibold text-rose-300">{row.rejected}건</span>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
        막대를 클릭하면 하단 목록이 해당 공정으로 필터링됩니다.
      </p>
    </div>
  );
}

function MonthlyTrendTooltip({ active, payload }: CustomTooltipProps<MonthlyTrendRow>) {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 shadow-xl space-y-1.5 min-w-[175px] tabular-nums">
      <div className="flex items-center justify-between gap-4 border-b border-slate-700/80 pb-1.5">
        <span className="font-bold text-white">{row.fullLabel}</span>
        <span className="font-mono text-[11px] text-slate-300">
          처리율 {row.total > 0 ? `${row.completionRate}%` : '-'}
        </span>
      </div>
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4">
          <span className="text-blue-300">전체 제안</span>
          <span className="font-mono font-bold text-white">{row.total}건</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-emerald-300">완료 제안</span>
          <span className="font-mono font-semibold text-emerald-400">{row.completed}건</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-rose-300">긴급 (고장·위험)</span>
          <span className="font-mono font-semibold text-rose-400">{row.urgent}건</span>
        </div>
      </div>
    </div>
  );
}

export function DashboardAnalyticsCharts({
  suggestions,
  selectedProcessFilter,
  onSelectProcessFilter,
}: DashboardAnalyticsChartsProps) {
  const [barMode, setBarMode] = useState<ProcessBarMode>('RATE');
  const [trendProcessFilter, setTrendProcessFilter] = useState<string>('ALL');

  // 1. 담당 공정별 제안 처리율 집계 (8개 담당 공정 순서 준수)
  const processAnalytics = useMemo(() => {
    const grouped = new Map<
      BreweryProcess,
      { total: number; completed: number; inProgress: number; pending: number; rejected: number }
    >();

    PROCESS_ORDER.forEach(proc => {
      grouped.set(proc, { total: 0, completed: 0, inProgress: 0, pending: 0, rejected: 0 });
    });

    suggestions.forEach(s => {
      const stat = grouped.get(s.process);
      if (!stat) return;
      stat.total += 1;
      if (s.status === 'COMPLETED') {
        stat.completed += 1;
      } else if (s.status === 'IN_PROGRESS' || s.status === 'REVIEWING') {
        stat.inProgress += 1;
      } else if (s.status === 'REJECTED') {
        stat.rejected += 1;
      } else {
        stat.pending += 1;
      }
    });

    const rows: ProcessRateRow[] = PROCESS_ORDER.map(proc => {
      const stat = grouped.get(proc) || {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
        rejected: 0,
      };
      const completionRate =
        stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
      const unresolved = stat.total - stat.completed;

      let barColor = '#e2e8f0';
      let statusTierLabel = '미등록';
      if (stat.total > 0) {
        if (completionRate >= 80) {
          barColor = '#16a34a';
          statusTierLabel = '우수 (80%+)';
        } else if (completionRate >= 50) {
          barColor = '#2563eb';
          statusTierLabel = '양호 (50~79%)';
        } else if (completionRate > 0) {
          barColor = '#d97706';
          statusTierLabel = '진행 (1~49%)';
        } else {
          barColor = '#dc2626';
          statusTierLabel = '미완료 (0%)';
        }
      }

      return {
        process: proc,
        label: PROCESS_CONFIG[proc].shortLabel,
        total: stat.total,
        completed: stat.completed,
        inProgress: stat.inProgress,
        pending: stat.pending,
        rejected: stat.rejected,
        unresolved,
        completionRate,
        rateLabel: stat.total > 0 ? `${completionRate}%` : '-',
        barColor,
        statusTierLabel,
      };
    });

    const totalCount = suggestions.length;
    const totalCompleted = rows.reduce((acc, r) => acc + r.completed, 0);
    const overallRate = totalCount > 0 ? Math.round((totalCompleted / totalCount) * 100) : 0;

    const activeRows = rows.filter(r => r.total > 0);
    const topRateProcess =
      activeRows.length > 0
        ? [...activeRows].sort((a, b) => {
            if (b.completionRate !== a.completionRate) return b.completionRate - a.completionRate;
            return b.completed - a.completed;
          })[0]
        : null;

    const mostBacklogProcess =
      activeRows.filter(r => r.unresolved > 0).length > 0
        ? [...activeRows]
            .filter(r => r.unresolved > 0)
            .sort((a, b) => {
              if (b.unresolved !== a.unresolved) return b.unresolved - a.unresolved;
              return a.completionRate - b.completionRate;
            })[0]
        : null;

    return {
      rows,
      totalCount,
      totalCompleted,
      overallRate,
      topRateProcess,
      mostBacklogProcess,
    };
  }, [suggestions]);

  // 2. 최근 6개월 월간 제안 추세 집계 (전체 또는 선택 공정)
  const monthlyAnalytics = useMemo(() => {
    const scopedSuggestions =
      trendProcessFilter === 'ALL'
        ? suggestions
        : suggestions.filter(s => s.process === trendProcessFilter);

    const monthMap = new Map<string, { total: number; completed: number; urgent: number }>();
    let latestYearMonth: { year: number; month: number } | null = null;

    for (const s of scopedSuggestions) {
      const ym = parseYearMonth(s.createdAt);
      if (!ym) continue;
      const key = formatMonthKey(ym.year, ym.month);
      const cur = monthMap.get(key) || { total: 0, completed: 0, urgent: 0 };
      cur.total += 1;
      if (s.status === 'COMPLETED') cur.completed += 1;
      if (s.isUrgent) cur.urgent += 1;
      monthMap.set(key, cur);

      if (
        !latestYearMonth ||
        ym.year > latestYearMonth.year ||
        (ym.year === latestYearMonth.year && ym.month > latestYearMonth.month)
      ) {
        latestYearMonth = ym;
      }
    }

    const now = new Date();
    const currentAnchor = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentWindowKeys = new Set<string>();
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(currentAnchor.getFullYear(), currentAnchor.getMonth() - i, 1);
      currentWindowKeys.add(formatMonthKey(d.getFullYear(), d.getMonth() + 1));
    }

    const hasInCurrentWindow = Array.from(monthMap.keys()).some(k => currentWindowKeys.has(k));
    const anchorDate =
      hasInCurrentWindow || !latestYearMonth
        ? currentAnchor
        : new Date(latestYearMonth.year, latestYearMonth.month - 1, 1);

    const monthDates = Array.from({ length: 6 }, (_, idx) => {
      const offset = 5 - idx;
      return new Date(anchorDate.getFullYear(), anchorDate.getMonth() - offset, 1);
    });

    const spansYears =
      monthDates[0].getFullYear() !== monthDates[monthDates.length - 1].getFullYear();

    const rows: MonthlyTrendRow[] = monthDates.map(date => {
      const y = date.getFullYear();
      const m = date.getMonth() + 1;
      const key = formatMonthKey(y, m);
      const stats = monthMap.get(key) || { total: 0, completed: 0, urgent: 0 };
      const axisLabel = spansYears ? `${String(y).slice(-2)}.${String(m).padStart(2, '0')}` : `${m}월`;

      return {
        monthKey: key,
        axisLabel,
        fullLabel: `${y}년 ${m}월`,
        total: stats.total,
        completed: stats.completed,
        urgent: stats.urgent,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      };
    });

    const sixMonthTotal = rows.reduce((acc, r) => acc + r.total, 0);
    const sixMonthCompleted = rows.reduce((acc, r) => acc + r.completed, 0);
    const monthlyAvg = Number((sixMonthTotal / 6).toFixed(1));

    const latestMonth = rows[rows.length - 1];
    const prevMonth = rows[rows.length - 2];
    const momDiff = latestMonth.total - prevMonth.total;

    let momLabel = '전월 대비 변동 없음';
    if (sixMonthTotal === 0) {
      momLabel = '집계 대기';
    } else if (prevMonth.total === 0 && latestMonth.total > 0) {
      momLabel = `전월 대비 +${latestMonth.total}건`;
    } else if (momDiff > 0) {
      const pct = Math.round((momDiff / prevMonth.total) * 100);
      momLabel = `전월 대비 +${momDiff}건 (+${pct}%)`;
    } else if (momDiff < 0) {
      const pct = Math.round((Math.abs(momDiff) / prevMonth.total) * 100);
      momLabel = `전월 대비 ${momDiff}건 (-${pct}%)`;
    }

    const peakMonth =
      sixMonthTotal > 0
        ? [...rows].sort((a, b) => b.total - a.total)[0]
        : null;

    return {
      rows,
      scopedCount: scopedSuggestions.length,
      sixMonthTotal,
      sixMonthCompleted,
      monthlyAvg,
      momLabel,
      momDiff,
      latestMonth,
      peakMonth,
      periodLabel: `${rows[0]?.fullLabel} ~ ${rows[rows.length - 1]?.fullLabel}`,
    };
  }, [suggestions, trendProcessFilter]);

  const handleSelectBar = (data: unknown) => {
    const entry = data as Partial<ProcessRateRow> | undefined;
    if (!entry?.process) return;
    onSelectProcessFilter(selectedProcessFilter === entry.process ? 'ALL' : entry.process);
  };

  return (
    <section
      aria-label="공정별 제안 처리율 및 월간 제안 추세 차트"
      className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch"
    >
      {/* 1. 담당 공정별 제안 처리율 막대 그래프 */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2 tracking-tight">
              <BarChart3 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>담당 공정별 제안 처리율</span>
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
              <span>
                전체 처리율{' '}
                <strong className="font-bold text-slate-900">{processAnalytics.overallRate}%</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                완료 {processAnalytics.totalCompleted}건 / 전체 {processAnalytics.totalCount}건
              </span>
              {selectedProcessFilter !== 'ALL' && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => onSelectProcessFilter('ALL')}
                    className="text-blue-600 hover:text-blue-800 font-semibold underline underline-offset-2 cursor-pointer"
                  >
                    {PROCESS_CONFIG[selectedProcessFilter as BreweryProcess]?.label ||
                      selectedProcessFilter}{' '}
                    필터 해제
                  </button>
                </>
              )}
            </div>
          </div>

          <div
            role="group"
            aria-label="공정별 차트 표시 기준"
            className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0 self-start"
          >
            <button
              type="button"
              onClick={() => setBarMode('RATE')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                barMode === 'RATE'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              처리율 (%)
            </button>
            <button
              type="button"
              onClick={() => setBarMode('COUNT')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                barMode === 'COUNT'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              완료 · 미완료 건수
            </button>
          </div>
        </div>

        {processAnalytics.totalCount === 0 ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-center px-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-1.5">
            <p className="text-sm font-semibold text-slate-700">
              아직 등록된 제안 데이터가 없습니다
            </p>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              현장에서 제안이 등록되고 완료 처리되면 8개 담당 공정(DP · RFC · 라벨러 · 포장기 ·
              검사 · 파트장 · 반장 · 관리자)별 처리율이 실시간으로 표시됩니다.
            </p>
          </div>
        ) : (
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={processAnalytics.rows}
                margin={{ top: 20, right: 12, left: -10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  interval={0}
                  tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                {barMode === 'RATE' ? (
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    unit="%"
                    width={46}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                ) : (
                  <YAxis
                    allowDecimals={false}
                    unit="건"
                    width={46}
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                  />
                )}
                <Tooltip
                  cursor={{ fill: 'rgba(241, 245, 249, 0.75)' }}
                  content={<ProcessRateTooltip />}
                />
                {barMode === 'RATE' ? (
                  <>
                    <ReferenceLine
                      y={processAnalytics.overallRate}
                      stroke="#475569"
                      strokeDasharray="4 4"
                      label={{
                        value: `전체 평균 ${processAnalytics.overallRate}%`,
                        position: 'insideTopRight',
                        fill: '#334155',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    />
                    <Bar
                      dataKey="completionRate"
                      name="제안 처리율"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                      onClick={handleSelectBar}
                      className="cursor-pointer"
                    >
                      {processAnalytics.rows.map(entry => {
                        const isDimmed =
                          selectedProcessFilter !== 'ALL' &&
                          selectedProcessFilter !== entry.process;
                        return (
                          <Cell
                            key={entry.process}
                            fill={entry.barColor}
                            fillOpacity={isDimmed ? 0.3 : 1}
                          />
                        );
                      })}
                      <LabelList
                        dataKey="rateLabel"
                        position="top"
                        className="fill-slate-700 text-[11px] font-bold"
                      />
                    </Bar>
                  </>
                ) : (
                  <>
                    <Legend
                      wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '6px' }}
                    />
                    <Bar
                      dataKey="completed"
                      name="완료"
                      stackId="processCount"
                      fill="#16a34a"
                      maxBarSize={36}
                      onClick={handleSelectBar}
                      className="cursor-pointer"
                    />
                    <Bar
                      dataKey="unresolved"
                      name="미완료 (대기·진행·반려)"
                      stackId="processCount"
                      fill="#94a3b8"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={36}
                      onClick={handleSelectBar}
                      className="cursor-pointer"
                    />
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
          {barMode === 'RATE' ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-green-600" />
                우수 80%+
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-blue-600" />
                양호 50~79%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-600" />
                진행 1~49%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-red-600" />
                미완료 0%
              </span>
            </div>
          ) : (
            <span>막대를 클릭하면 하단 제안 목록이 해당 담당 공정으로 필터링됩니다.</span>
          )}

          {processAnalytics.topRateProcess && (
            <span className="text-slate-700 font-medium">
              최고 처리율 {processAnalytics.topRateProcess.label}{' '}
              <strong className="font-mono font-bold text-slate-900">
                {processAnalytics.topRateProcess.completionRate}%
              </strong>
              {processAnalytics.mostBacklogProcess && (
                <>
                  {' '}
                  · 잔여 최다 {processAnalytics.mostBacklogProcess.label}{' '}
                  <strong className="font-mono font-bold text-rose-700">
                    {processAnalytics.mostBacklogProcess.unresolved}건
                  </strong>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* 2. 최근 6개월 월간 제안 추세 선 그래프 */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 flex flex-col justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2 tracking-tight">
              <TrendingUp className="w-4 h-4 text-blue-600 shrink-0" />
              <span>월간 제안 추세 (최근 6개월)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 tabular-nums">
              <span>{monthlyAnalytics.periodLabel}</span>
              <span aria-hidden="true">·</span>
              <span>
                6개월 누적{' '}
                <strong className="font-bold text-slate-900">
                  {monthlyAnalytics.sixMonthTotal}건
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>월평균 {monthlyAnalytics.monthlyAvg}건</span>
            </div>
          </div>

          <select
            aria-label="월간 추세 담당 공정 필터"
            value={trendProcessFilter}
            onChange={e => setTrendProcessFilter(e.target.value)}
            className="h-8 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-600 shrink-0 self-start"
          >
            <option value="ALL">전체 담당 공정</option>
            {PROCESS_ORDER.map(proc => (
              <option key={proc} value={proc}>
                {PROCESS_CONFIG[proc].label}
              </option>
            ))}
          </select>
        </div>

        {monthlyAnalytics.scopedCount === 0 ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-center px-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 space-y-2.5">
            <p className="text-sm font-semibold text-slate-700">
              {trendProcessFilter === 'ALL'
                ? '최근 6개월간 집계된 제안이 없습니다'
                : `${PROCESS_CONFIG[trendProcessFilter as BreweryProcess]?.label || trendProcessFilter} 공정의 제안 내역이 없습니다`}
            </p>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              신규 제안이 접수되면 최근 6개월간의 월별 전체 제안, 완료 건수, 긴급 신고 변화가
              선 그래프로 자동 누적됩니다.
            </p>
            {trendProcessFilter !== 'ALL' && suggestions.length > 0 && (
              <button
                type="button"
                onClick={() => setTrendProcessFilter('ALL')}
                className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                전체 공정 추세 보기
              </button>
            )}
          </div>
        ) : (
          <div className="w-full h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyAnalytics.rows}
                margin={{ top: 16, right: 16, left: -10, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="axisLabel"
                  tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  unit="건"
                  width={46}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<MonthlyTrendTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '6px' }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="전체 제안"
                  stroke="#2563eb"
                  strokeWidth={2.75}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="완료 제안"
                  stroke="#16a34a"
                  strokeWidth={2.25}
                  dot={{ r: 3.5, fill: '#16a34a', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 5.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="urgent"
                  name="긴급 (고장·위험)"
                  stroke="#dc2626"
                  strokeWidth={1.75}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#dc2626', strokeWidth: 1.5, stroke: '#ffffff' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 tabular-nums">
          <span
            className={`font-semibold ${
              monthlyAnalytics.sixMonthTotal === 0
                ? 'text-slate-500'
                : monthlyAnalytics.momDiff > 0
                ? 'text-blue-700'
                : monthlyAnalytics.momDiff < 0
                ? 'text-slate-700'
                : 'text-slate-600'
            }`}
          >
            {monthlyAnalytics.momLabel}
          </span>

          {monthlyAnalytics.peakMonth ? (
            <span className="text-slate-700 font-medium">
              최다 접수월 {monthlyAnalytics.peakMonth.fullLabel}{' '}
              <strong className="font-mono font-bold text-slate-900">
                {monthlyAnalytics.peakMonth.total}건
              </strong>
              {' · '}6개월 완료{' '}
              <strong className="font-mono font-bold text-emerald-700">
                {monthlyAnalytics.sixMonthCompleted}건
              </strong>
            </span>
          ) : (
            <span>최근 6개월 제안 등록 시 추세 지표가 자동 계산됩니다.</span>
          )}
        </div>
      </div>
    </section>
  );
}
