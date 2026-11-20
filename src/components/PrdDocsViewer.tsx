import React, { useState } from 'react';
import { 
  Database, 
  FolderTree, 
  FileCode2, 
  Copy, 
  Check, 
  ExternalLink,
  ShieldAlert,
  Server,
  Layers
} from 'lucide-react';
import { 
  FIRESTORE_SCHEMA_MARKDOWN, 
  DIRECTORY_TREE_MARKDOWN, 
  MAIN_PAGE_CODE_MARKDOWN 
} from '../data/prdDocumentation';

export function PrdDocsViewer() {
  const [activeTab, setActiveTab] = useState<'schema' | 'tree' | 'code'>('schema');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const handleCopy = (content: string, tabKey: string) => {
    navigator.clipboard.writeText(content);
    setCopiedTab(tabKey);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 상단 소개 배너 */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 mb-3">
              <Server className="w-3.5 h-3.5" />
              양조2팀 제품공정 스마트 제안관리 시스템 ('술술제안')
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              PRD & FS 3대 핵심 개발 산출물
            </h2>
            <p className="text-slate-300 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
              사용자 요구사항에 맞춘 <strong className="text-white">① Firebase Firestore DB 스키마</strong>, <strong className="text-white">② Next.js App Router 핵심 폴더 구조</strong>, <strong className="text-white">③ 실시간 Firestore 연동 메인 화면 React 코드</strong>입니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                const targetContent = 
                  activeTab === 'schema' ? FIRESTORE_SCHEMA_MARKDOWN :
                  activeTab === 'tree' ? DIRECTORY_TREE_MARKDOWN : MAIN_PAGE_CODE_MARKDOWN;
                handleCopy(targetContent, activeTab);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white transition-all shadow-md"
            >
              {copiedTab === activeTab ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>현재 탭 전체 코드 복사</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3개 탭 전환 버튼 */}
        <div className="grid grid-cols-3 gap-2 mt-6 pt-6 border-t border-slate-800">
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex items-center justify-center gap-2.5 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'schema'
                ? 'bg-white text-slate-900 shadow-md scale-[1.01]'
                : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">1. Firestore</span>
            <span>DB 스키마</span>
          </button>

          <button
            onClick={() => setActiveTab('tree')}
            className={`flex items-center justify-center gap-2.5 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'tree'
                ? 'bg-white text-slate-900 shadow-md scale-[1.01]'
                : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FolderTree className="w-4 h-4 text-emerald-500" />
            <span className="hidden sm:inline">2. Next.js</span>
            <span>폴더 구조</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center justify-center gap-2.5 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'code'
                ? 'bg-white text-slate-900 shadow-md scale-[1.01]'
                : 'bg-slate-800/70 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileCode2 className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">3. 메인 화면</span>
            <span>React 코드</span>
          </button>
        </div>
      </div>

      {/* 탭 내용 표시부 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* 헤더 */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-slate-800 text-base">
            {activeTab === 'schema' && (
              <>
                <Database className="w-5 h-5 text-indigo-600" />
                <span>1. Firebase Firestore 컬렉션 및 문서 스키마 (TS 인터페이스 & 인덱스)</span>
              </>
            )}
            {activeTab === 'tree' && (
              <>
                <FolderTree className="w-5 h-5 text-emerald-600" />
                <span>2. Next.js 14+ (App Router) 프론트엔드 핵심 디렉토리 트리 구조</span>
              </>
            )}
            {activeTab === 'code' && (
              <>
                <FileCode2 className="w-5 h-5 text-amber-600" />
                <span>3. 메인 화면 (React / Next.js) - Firestore onSnapshot 실시간 연동 코드</span>
              </>
            )}
          </div>

          <button
            onClick={() => {
              const target = activeTab === 'schema' ? FIRESTORE_SCHEMA_MARKDOWN :
                             activeTab === 'tree' ? DIRECTORY_TREE_MARKDOWN : MAIN_PAGE_CODE_MARKDOWN;
              handleCopy(target, activeTab);
            }}
            className="text-xs text-slate-600 hover:text-indigo-600 flex items-center gap-1 font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            {copiedTab === activeTab ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>복사하기</span>
          </button>
        </div>

        {/* 본문 코드 뷰 */}
        <div className="p-6 overflow-x-auto bg-slate-950 text-slate-100 font-mono text-xs sm:text-sm leading-relaxed max-h-[750px] overflow-y-auto">
          <pre className="whitespace-pre-wrap">
            {activeTab === 'schema' && FIRESTORE_SCHEMA_MARKDOWN}
            {activeTab === 'tree' && DIRECTORY_TREE_MARKDOWN}
            {activeTab === 'code' && MAIN_PAGE_CODE_MARKDOWN}
          </pre>
        </div>
      </div>

      {/* 부가 가이드 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-3">
            <Layers className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1.5">실시간 onSnapshot 설계</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            REST 폴링 방식 대신 WebSocket 기반 Firestore 리스너를 채택하여 RFC·라벨러·포장기 설비 이상 시 지연 시간 0초대로 전파됩니다.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold mb-3">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1.5">F-03 긴급 알림 트리거</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            제안 등록 시 카테고리가 '고장정비' 또는 '위험성평가'이면 Firestore 트리거가 동작하여 관리자·반장·파트장 모바일로 Push 및 비프 알림을 자동 발송합니다.
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold mb-3">
            <ExternalLink className="w-5 h-5" />
          </div>
          <h4 className="font-bold text-slate-900 text-sm mb-1.5">Vercel 배포 & PWA 최적화</h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            Next.js App Router로 Vercel에 단일 클릭 배포 가능하며, 양조2팀 제품공정 직원 스마트폰 홈 화면에 아이콘으로 설치하여 앱처럼 구동할 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
