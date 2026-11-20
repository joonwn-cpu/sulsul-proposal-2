import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  AlertTriangle, 
  Wrench, 
  Lightbulb, 
  Clock, 
  ShieldAlert, 
  Camera, 
  ChevronRight, 
  Filter, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  Search,
  Sparkles,
  Smartphone,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { 
  Suggestion, 
  SuggestionCategory, 
  BreweryProcess, 
  BreweryWorker 
} from '../types/brewery';
import { 
  CATEGORY_CONFIG, 
  PROCESS_CONFIG, 
  PROCESS_ORDER,
  STATUS_CONFIG 
} from '../data/mockBreweryData';
import {
  PRIORITY_LEVEL_CONFIG,
  enrichSuggestionWithPriority,
  sortSuggestions,
} from '../lib/priorityScore';

interface MobileWorkerViewProps {
  suggestions: Suggestion[];
  currentUser: BreweryWorker;
  isOffline: boolean;
  onOpenNewModal: () => void;
  onSelectSuggestion: (suggestion: Suggestion) => void;
  onSyncOffline: () => void;
  offlineCount: number;
}

export function MobileWorkerView({
  suggestions,
  currentUser,
  isOffline,
  onOpenNewModal,
  onSelectSuggestion,
  onSyncOffline,
  offlineCount,
}: MobileWorkerViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<SuggestionCategory | 'ALL'>('ALL');
  const [selectedProcess, setSelectedProcess] = useState<BreweryProcess | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMyOnly, setFilterMyOnly] = useState(false);
  const [sortByPriority, setSortByPriority] = useState(true);
  const [isPhoneFrame, setIsPhoneFrame] = useState(true);

  // 긴급 미조치 건수 (F-03)
  const urgentCount = useMemo(() => {
    return suggestions.filter(s => s.isUrgent && (s.status === 'PENDING' || s.status === 'REVIEWING')).length;
  }, [suggestions]);

  // 필터링 및 우선순위 정렬
  const filteredList = useMemo(() => {
    const filtered = suggestions.filter(item => {
      const matchCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchProc = selectedProcess === 'ALL' || item.process === selectedProcess;
      const matchMy = !filterMyOnly || item.authorId === currentUser.id;
      const matchSearch = !searchQuery.trim() || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.locationDetail && item.locationDetail.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.quickTags && item.quickTags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));

      return matchCat && matchProc && matchMy && matchSearch;
    });

    return sortSuggestions(filtered, sortByPriority ? 'PRIORITY_DESC' : 'LATEST_DESC');
  }, [suggestions, selectedCategory, selectedProcess, filterMyOnly, searchQuery, currentUser.id, sortByPriority]);

  return (
    <div className="flex flex-col items-center justify-center">
      {/* 뷰포트 전환 도구 바 (데스크톱 사용자를 위한 배려) */}
      <div className="w-full max-w-md sm:max-w-lg mb-3 flex items-center justify-between text-xs text-slate-500 px-2">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700">현장 모바일 뷰:</span>
          <span>양조2팀 제품공정 작업자 스마트폰 구동 화면</span>
        </div>
        <button
          onClick={() => setIsPhoneFrame(prev => !prev)}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
        >
          {isPhoneFrame ? <Maximize2 className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
          <span>{isPhoneFrame ? '넓게 보기' : '스마트폰 프레임'}</span>
        </button>
      </div>

      {/* 스마트폰 목업 컨테이너 */}
      <div className={`w-full transition-all duration-300 ${
        isPhoneFrame 
          ? 'max-w-[430px] rounded-3xl shadow-2xl border-[7px] border-slate-900 overflow-hidden bg-slate-100 min-h-[780px]' 
          : 'max-w-3xl rounded-2xl shadow-md border border-slate-200 bg-slate-100'
      }`}>
        {/* 스마트폰 상단 스피커 & 노치 (프레임 모드일 때) */}
        {isPhoneFrame && (
          <div className="bg-slate-900 h-6 w-full flex items-center justify-center">
            <div className="w-20 h-3.5 bg-black rounded-b-xl flex items-center justify-center">
              <div className="w-10 h-1 bg-slate-800 rounded-full" />
            </div>
          </div>
        )}

        {/* 1) 모바일 앱 헤더 (술술제안) */}
        <div className="bg-slate-900 text-white px-4 py-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🍶</span>
              <div>
                <h1 className="font-black text-base tracking-tight flex items-center gap-1.5">
                  술술제안
                  <span className="text-[10px] bg-amber-500 text-slate-950 font-extrabold px-1.5 py-0.2 rounded">
                    현장모바일
                  </span>
                </h1>
                <p className="text-[10px] text-slate-400">
                  {currentUser.name} ({PROCESS_CONFIG[currentUser.process]?.label})
                </p>
              </div>
            </div>

            {/* 오프라인 & 동기화 상태 배지 */}
            <div className="flex items-center gap-1.5">
              {isOffline ? (
                <div className="flex items-center gap-1 bg-rose-600/90 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  <WifiOff className="w-3 h-3" />
                  <span>오프라인</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 bg-emerald-700/80 text-emerald-100 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  <Wifi className="w-3 h-3" />
                  <span>실시간 연결</span>
                </div>
              )}
            </div>
          </div>

          {/* F-03 긴급 알림 띠배너 (고장정비 및 위험성평가 미조치 건) */}
          {urgentCount > 0 && (
            <div className="mt-2.5 bg-gradient-to-r from-rose-600 to-amber-600 text-white px-3 py-1.5 rounded-lg flex items-center justify-between text-xs font-bold animate-pulse">
              <div className="flex items-center gap-1.5 truncate">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span className="truncate">긴급 조치 요망 {urgentCount}건 발생! (즉시 확인)</span>
              </div>
              <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded ml-1 shrink-0">
                F-03 트리거
              </span>
            </div>
          )}

          {/* 오프라인 대기 큐 동기화 알림 */}
          {offlineCount > 0 && !isOffline && (
            <div className="mt-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center justify-between text-xs font-bold">
              <span>대기중인 오프라인 제안 {offlineCount}건</span>
              <button
                onClick={onSyncOffline}
                className="bg-white text-blue-800 text-[11px] px-2 py-0.5 rounded font-extrabold flex items-center gap-1 hover:bg-blue-50"
              >
                <RefreshCw className="w-3 h-3" />
                <span>즉시 동기화</span>
              </button>
            </div>
          )}
        </div>

        {/* 2) 모바일 본문 */}
        <div className="p-3.5 space-y-3 pb-24">
          {/* F-02 신규 제안 등록 빅 버튼 (위생장갑 착용 최적화: 높이 56px, 대형 터치 타겟) */}
          <button
            onClick={onOpenNewModal}
            className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white rounded-2xl shadow-lg font-black text-base flex items-center justify-center gap-2.5 transition-transform"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Plus className="w-5 h-5 stroke-[3]" />
            </div>
            <span>+ 새 제안 / 고장정비 신고하기</span>
          </button>

          {/* 4대 카테고리 퀵 선택 버튼 (장갑 낀 손으로 터치 쉬운 타겟) */}
          <div>
            <div className="text-[11px] font-bold text-slate-500 mb-1.5 px-0.5 flex items-center justify-between">
              <span>카테고리 선택</span>
              <span className="text-[10px] text-slate-400">4대 핵심 영역</span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {(['ALL', 'BREAKDOWN_REPAIR', 'RISK_ASSESSMENT', 'PROCESS_IMPROVEMENT'] as const).map(cat => {
                const isActive = selectedCategory === cat;
                const label = 
                  cat === 'ALL' ? '전체' :
                  cat === 'BREAKDOWN_REPAIR' ? '고장정비' :
                  cat === 'RISK_ASSESSMENT' ? '위험성' : '공정개선';
                
                const isUrgentCat = cat === 'BREAKDOWN_REPAIR' || cat === 'RISK_ASSESSMENT';

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`h-12 rounded-xl flex flex-col items-center justify-center font-bold text-xs transition-all relative ${
                      isActive 
                        ? 'bg-slate-900 text-white shadow-sm ring-2 ring-blue-500' 
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{label}</span>
                    {isUrgentCat && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-1.5 right-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 검색 및 공정 필터 / 내 제안 필터 */}
          <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="설비명, 제목, 위치 검색..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-8 pl-8 pr-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <select
                value={selectedProcess}
                onChange={e => setSelectedProcess(e.target.value as BreweryProcess | 'ALL')}
                className="h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold text-xs outline-none"
              >
                <option value="ALL">전체 공정 (양조2팀 제품공정)</option>
                {PROCESS_ORDER.map(k => (
                  <option key={k} value={k}>
                    {PROCESS_CONFIG[k].icon} {PROCESS_CONFIG[k].label}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setFilterMyOnly(prev => !prev)}
                className={`h-8 px-2.5 rounded-lg font-bold text-xs transition-colors shrink-0 ${
                  filterMyOnly 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                내 제안만
              </button>
            </div>
          </div>

          {/* 제안 리스트 (F-04 실시간 피드) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-0.5">
              <span>현장 제안 리스트 ({filteredList.length}건)</span>
              <button
                type="button"
                onClick={() => setSortByPriority(prev => !prev)}
                className={`text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                  sortByPriority
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {sortByPriority ? '우선순위순 정렬' : '최신순 정렬'}
              </button>
            </div>

            {filteredList.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-400 text-xs">
                조건에 맞는 제안이 없습니다.
              </div>
            ) : (
              filteredList.map(rawItem => {
                const item = rawItem.priorityBreakdown
                  ? rawItem
                  : enrichSuggestionWithPriority(rawItem);
                const breakdown = item.priorityBreakdown!;
                const levelMeta = PRIORITY_LEVEL_CONFIG[breakdown.level];
                const catMeta = CATEGORY_CONFIG[item.category];
                const procMeta = PROCESS_CONFIG[item.process];
                const stMeta = STATUS_CONFIG[item.status];
                const isUrgent = item.isUrgent;

                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectSuggestion(item)}
                    className={`bg-white rounded-2xl p-3.5 border transition-all cursor-pointer shadow-xs active:scale-[0.99] hover:border-slate-300 ${
                      isUrgent 
                        ? 'border-rose-300 ring-2 ring-rose-100 bg-gradient-to-b from-rose-50/20 to-white' 
                        : 'border-slate-200'
                    }`}
                  >
                    {/* 상단 라벨 라인 */}
                    <div className="flex items-start justify-between gap-1.5 mb-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${levelMeta.badgeClass}`}>
                          {breakdown.totalScore}점 · {levelMeta.label}
                        </span>
                        {isUrgent && (
                          <span className="inline-flex items-center gap-0.5 bg-rose-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" /> 긴급
                          </span>
                        )}
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${catMeta.bgLight} ${catMeta.color}`}>
                          {catMeta.shortLabel}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {procMeta?.icon} {procMeta?.label}
                        </span>
                      </div>

                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${stMeta.badgeClass}`}>
                        {stMeta.label}
                      </span>
                    </div>

                    {/* 제목 */}
                    <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">
                      {item.title}
                    </h3>

                    {/* 설명 */}
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                      {item.description}
                    </p>

                    {/* 하단 메타 */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2.5 pt-2 border-t border-slate-100">
                      <span className="flex items-center gap-1.5">
                        <span className="text-slate-600 font-medium">{item.authorName}</span>
                        {item.attachments && item.attachments.length > 0 && (
                          <span className="flex items-center gap-0.5 text-blue-600 font-bold">
                            <Camera className="w-3 h-3" /> {item.attachments.length}
                          </span>
                        )}
                      </span>

                      <span className="flex items-center text-slate-500 font-medium">
                        상세보기 <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
