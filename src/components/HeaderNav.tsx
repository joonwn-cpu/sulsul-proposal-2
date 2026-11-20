import React, { useState } from 'react';
import {
  FileCode2,
  KeyRound,
  LayoutDashboard,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  User,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BreweryWorker, UserRole } from '../types/brewery';
import { PROCESS_CONFIG } from '../data/mockBreweryData';

interface HeaderNavProps {
  activeTab: 'mobile' | 'admin' | 'docs';
  setActiveTab: (tab: 'mobile' | 'admin' | 'docs') => void;
  currentUser: BreweryWorker;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  hasWatermark: boolean;
  setHasWatermark: (val: boolean) => void;
  onResetData: () => void;
  urgentAlertCount: number;
  canChangePassword: boolean;
  canManageAccounts: boolean;
  onOpenPasswordModal: () => void;
  onOpenAccountManager: () => void;
  onSignOut: () => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  WORKER: '작업자',
  ADMIN: '관리자',
  MAINTENANCE: '공무·안전',
};

export function HeaderNav({
  activeTab,
  setActiveTab,
  currentUser,
  isOffline,
  setIsOffline,
  hasWatermark,
  setHasWatermark,
  onResetData,
  urgentAlertCount,
  canChangePassword,
  canManageAccounts,
  onOpenPasswordModal,
  onOpenAccountManager,
  onSignOut,
}: HeaderNavProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  const handleResetClick = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3500);
      return;
    }
    setConfirmReset(false);
    onResetData();
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* 좌측: 브랜드 및 3대 모드 탭 */}
          <div className="flex items-center justify-between lg:justify-start gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-2xl filter drop-shadow" aria-hidden="true">
                🍶
              </span>
              <span className="font-black text-lg tracking-tight text-white whitespace-nowrap">
                술술제안
              </span>
            </div>

            <nav className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTab('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'mobile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>현장 모바일</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>관리자 대시보드</span>
                {urgentAlertCount > 0 && (
                  <span className="ml-0.5 text-[11px] font-mono tabular-nums text-amber-300">
                    ({urgentAlertCount})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('docs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'docs'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-indigo-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>PRD 산출물</span>
              </button>
            </nav>
          </div>

          {/* 우측: 인증된 실제 직원 정보 및 계정 컨트롤 */}
          <div className="flex items-center justify-between lg:justify-end gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800 flex-wrap">
            {/* 인증된 실제 직원 프로필 표시 */}
            <div className="flex items-center gap-2 text-xs text-slate-200 px-2.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700 min-w-0">
              <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-bold text-white truncate max-w-[110px]">
                {currentUser.name}
              </span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="font-mono text-amber-300 tabular-nums whitespace-nowrap">
                {currentUser.id}
              </span>
              <span className="hidden xl:inline text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="hidden xl:inline text-slate-300 whitespace-nowrap">
                {PROCESS_CONFIG[currentUser.process]?.label} / {ROLE_LABELS[currentUser.role]}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* 관리자용 직원 계정 관리 버튼 */}
              {canManageAccounts && (
                <button
                  type="button"
                  onClick={onOpenAccountManager}
                  title="실제 직원 사번 계정 발급 및 권한 관리"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">직원 관리</span>
                </button>
              )}

              {/* 비밀번호 변경 버튼 (사번 이메일/비밀번호 로그인 사용자 전용) */}
              {canChangePassword && (
                <button
                  type="button"
                  onClick={onOpenPasswordModal}
                  title="비밀번호 변경 (F-01)"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden md:inline">비밀번호</span>
                </button>
              )}

              {/* Wi-Fi 음영지역 오프라인 시뮬레이션 토글 */}
              <button
                type="button"
                onClick={() => setIsOffline(!isOffline)}
                title="공장 내 Wi-Fi 음영 구역 오프라인 임시 저장 테스트"
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isOffline
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
                }`}
              >
                {isOffline ? (
                  <WifiOff className="w-3.5 h-3.5" />
                ) : (
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span className="hidden xl:inline">{isOffline ? '오프라인' : '온라인'}</span>
              </button>

              {/* 보안 워터마크 토글 */}
              <button
                type="button"
                onClick={() => setHasWatermark(!hasWatermark)}
                title="사내 공정 기밀 유출 방지 워터마크 표시"
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  hasWatermark
                    ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-500'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
              </button>

              {/* 로컬 샘플 데이터 리셋 (2단계 확인, window.confirm 미사용) */}
              <button
                type="button"
                onClick={handleResetClick}
                title={
                  confirmReset
                    ? '한 번 더 클릭하면 로컬 샘플 데이터를 초기화합니다'
                    : '로컬 샘플 데이터 초기화'
                }
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  confirmReset
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {confirmReset && <span>확인</span>}
              </button>

              {/* 로그아웃 */}
              <button
                type="button"
                onClick={onSignOut}
                title="로그아웃"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-rose-950 hover:text-rose-200 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
