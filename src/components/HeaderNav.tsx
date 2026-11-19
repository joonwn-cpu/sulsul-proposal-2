import React from 'react';
import { 
  Smartphone, 
  LayoutDashboard, 
  FileCode2, 
  Wifi, 
  WifiOff, 
  ShieldCheck, 
  RotateCcw, 
  User,
  Sparkles,
  AlertTriangle,
  LogIn,
  LogOut
} from 'lucide-react';
import { BreweryWorker } from '../types/brewery';
import { PROCESS_CONFIG } from '../data/mockBreweryData';

interface HeaderNavProps {
  activeTab: 'mobile' | 'admin' | 'docs';
  setActiveTab: (tab: 'mobile' | 'admin' | 'docs') => void;
  currentUser: BreweryWorker;
  workers: BreweryWorker[];
  onSelectUser: (workerId: string) => void;
  isOffline: boolean;
  setIsOffline: (offline: boolean) => void;
  hasWatermark: boolean;
  setHasWatermark: (val: boolean) => void;
  onResetData: () => void;
  urgentAlertCount: number;
  firebaseUserEmail?: string | null;
  firebaseAuthReady?: boolean;
  onSignInGoogle?: () => void;
  onSignOutGoogle?: () => void;
}

export function HeaderNav({
  activeTab,
  setActiveTab,
  currentUser,
  workers,
  onSelectUser,
  isOffline,
  setIsOffline,
  hasWatermark,
  setHasWatermark,
  onResetData,
  urgentAlertCount,
  firebaseUserEmail,
  firebaseAuthReady = true,
  onSignInGoogle,
  onSignOutGoogle,
}: HeaderNavProps) {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* 로고 & 탭 전환 */}
          <div className="flex items-center justify-between md:justify-start gap-4">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl filter drop-shadow">🍶</span>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg tracking-tight text-white">
                    술술제안
                  </span>
                  <span className="text-[10px] bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black px-1.5 py-0.5 rounded">
                    탁·약주 스마트 제조
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium hidden sm:block">
                  현장 27명 스마트폰 실시간 제안 & 관리자 대시보드
                </div>
              </div>
            </div>

            {/* 메인 3대 모드 탭 */}
            <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700">
              <button
                onClick={() => setActiveTab('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'mobile'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>현장 모바일</span>
              </button>

              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                  activeTab === 'admin'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>관리자 대시보드</span>
                {urgentAlertCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                )}
              </button>

              <button
                onClick={() => setActiveTab('docs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'docs'
                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                    : 'text-indigo-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-extrabold">PRD 3대 산출물</span>
              </button>
            </div>
          </div>

          {/* 우측 시뮬레이션 컨트롤: 사용자 변경, 오프라인 모드, 보안 워터마크 */}
          <div className="flex items-center justify-between md:justify-end gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
            {/* 1) 작업자 27명 / 관리자 계정 스위처 */}
            <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-xs">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-400 text-[11px] hidden lg:inline">로그인 계정:</span>
              <select
                value={currentUser.id}
                onChange={e => onSelectUser(e.target.value)}
                className="bg-transparent font-bold text-amber-300 text-xs outline-none cursor-pointer pr-1"
              >
                <optgroup label="👑 제품팀 관리자 & 공무팀">
                  {workers.filter(w => w.role !== 'WORKER').map(w => (
                    <option key={w.id} value={w.id} className="bg-slate-800 text-white">
                      {w.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="👷‍♂️ 현장 작업자 (27명)">
                  {workers.filter(w => w.role === 'WORKER').map(w => (
                    <option key={w.id} value={w.id} className="bg-slate-800 text-white">
                      {w.name} ({PROCESS_CONFIG[w.process]?.label})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* 2) Wi-Fi 음영지역 오프라인 시뮬레이션 토글 (비기능 요구사항) */}
            <button
              onClick={() => setIsOffline(!isOffline)}
              title="공장 내 Wi-Fi 음영 구역 오프라인 임시 저장 및 백그라운드 동기화 테스트"
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                isOffline 
                  ? 'bg-rose-600 text-white animate-pulse' 
                  : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
              }`}
            >
              {isOffline ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="hidden sm:inline">{isOffline ? '오프라인 모드' : '온라인 연결'}</span>
            </button>

            {/* 3) 보안 워터마크 토글 (F-비기능) */}
            <button
              onClick={() => setHasWatermark(!hasWatermark)}
              title="사내 공정 기밀 유출 방지 화면 캡처 방지 워터마크"
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                hasWatermark ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-500' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
            </button>

            {/* 4) Firebase Google 로그인/로그아웃 */}
            {firebaseAuthReady && (onSignInGoogle || onSignOutGoogle) && (
              firebaseUserEmail ? (
                <button
                  type="button"
                  onClick={onSignOutGoogle}
                  title={`Firebase 계정(${firebaseUserEmail}) 로그아웃`}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-950/70 text-emerald-300 border border-emerald-700/70 hover:bg-emerald-900/70 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline max-w-[120px] truncate">{firebaseUserEmail.split('@')[0]}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onSignInGoogle}
                  title="Google 계정으로 로그인하여 Firebase Firestore 실시간 연동"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Google 로그인</span>
                </button>
              )
            )}

            {/* 5) 데이터 초기화 */}
            <button
              onClick={() => {
                if (confirm('초기 목업 데이터로 재설정하시겠습니까?')) {
                  onResetData();
                }
              }}
              title="데이터 리셋"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
