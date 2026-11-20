import React, { useState } from 'react';
import {
  BadgeCheck,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { BreweryProcess } from '../types/brewery';
import { PROCESS_CONFIG } from '../data/mockBreweryData';
import {
  EMPLOYEE_EMAIL_DOMAIN,
  MIN_PASSWORD_LENGTH,
  formatFirebaseAuthError,
  isValidWorkerId,
  normalizeWorkerId,
  registerWorkerAccount,
  signInWithWorkerId,
  workerIdToEmail,
} from '../lib/firebase/auth';

interface EmployeeAuthScreenProps {
  onSignInGoogle: () => Promise<void>;
  onAuthSuccess?: () => void;
}

const PROCESS_OPTIONS: BreweryProcess[] = [
  'MALTING',
  'MASHING',
  'FERMENTATION',
  'FILTRATION',
  'REFINING',
  'BOTTLING',
  'OTHER',
];

export function EmployeeAuthScreen({
  onSignInGoogle,
  onAuthSuccess,
}: EmployeeAuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // 로그인 상태
  const [loginWorkerId, setLoginWorkerId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // 신규 직원 등록 상태
  const [regWorkerId, setRegWorkerId] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regProcess, setRegProcess] = useState<BreweryProcess>('FERMENTATION');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleModeSwitch = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setErrorMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normalized = normalizeWorkerId(loginWorkerId);
    if (!isValidWorkerId(normalized)) {
      setErrorMessage('사번은 영문, 숫자, 하이픈(-), 밑줄(_) 조합 2~32자로 입력해 주세요.');
      return;
    }
    if (loginPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await signInWithWorkerId(normalized, loginPassword);
      onAuthSuccess?.();
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normalized = normalizeWorkerId(regWorkerId);
    if (!isValidWorkerId(normalized)) {
      setErrorMessage('사번은 영문, 숫자, 하이픈(-), 밑줄(_) 조합 2~32자로 입력해 주세요.');
      return;
    }
    if (!regDisplayName.trim()) {
      setErrorMessage('성명과 직급을 입력해 주세요. (예: 김민수 주임)');
      return;
    }
    if (regPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상으로 설정해야 합니다.`);
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMessage('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      await registerWorkerAccount({
        workerId: normalized,
        password: regPassword,
        displayName: regDisplayName.trim(),
        process: regProcess,
        phone: regPhone.trim(),
      });
      onAuthSuccess?.();
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setErrorMessage(null);
    setIsGoogleLoading(true);
    try {
      await onSignInGoogle();
      onAuthSuccess?.();
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const previewRegEmail =
    regWorkerId.trim() && isValidWorkerId(regWorkerId)
      ? workerIdToEmail(regWorkerId)
      : `사번@${EMPLOYEE_EMAIL_DOMAIN}`;

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
        {/* 좌측: 현장 시스템 개요 패널 */}
        <aside className="lg:col-span-5 bg-slate-900 text-slate-100 p-7 sm:p-9 flex flex-col justify-between gap-8">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-xl">
                🍶
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white">술술제안</h1>
                <p className="text-xs text-slate-400">탁·약주 제조 현장 스마트 제안관리</p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight [text-wrap:balance]">
                사번과 비밀번호로
                <br />
                현장 제안 시스템에 접속하세요
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                제국·담금·발효·여과·제성·병입 전 공정 작업자와 관리자가 개인 사번 계정으로
                제안 등록, 고장 긴급 신고, 조치 이력 관리를 실시간으로 기록합니다.
              </p>
            </div>

            <div className="border-t border-slate-800 pt-6 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">사번 기반 개별 인증</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    이메일 주소 없이 사번(예: <span className="font-mono text-slate-200">240301</span>)과
                    비밀번호만으로 즉시 로그인합니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <BadgeCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">최초 로그인 비밀번호 변경 (F-01)</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    관리자가 발급한 초기 비밀번호로 첫 접속 시 개인 비밀번호 변경 안내가 자동 표시됩니다.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Building2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">실시간 Firestore 연동</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    작성한 제안과 담당자 배정, 처리 기한 알림 설정이 클라우드 데이터베이스에 안전하게 저장됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 text-xs text-slate-400 flex items-center justify-between gap-2">
            <span>인증 도메인</span>
            <span className="font-mono text-slate-300">@{EMPLOYEE_EMAIL_DOMAIN}</span>
          </div>
        </aside>

        {/* 우측: 사번 로그인 / 신규 직원 등록 폼 */}
        <section className="lg:col-span-7 p-6 sm:p-9 flex flex-col justify-center">
          {/* 모드 전환 세그먼트 컨트롤 */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>사번 로그인</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('register')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 text-sm font-bold rounded-lg transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>신규 직원 등록</span>
            </button>
          </div>

          {/* 에러 메시지 */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-worker-id"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  사번
                </label>
                <input
                  id="login-worker-id"
                  type="text"
                  autoComplete="username"
                  value={loginWorkerId}
                  onChange={e => setLoginWorkerId(e.target.value)}
                  placeholder="예: 240301 또는 hong01"
                  required
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  비밀번호
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showLoginPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="비밀번호 6자 이상 입력"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    className="w-full h-11 pl-3.5 pr-11 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(prev => !prev)}
                    aria-label={showLoginPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-800 rounded-lg"
                  >
                    {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isGoogleLoading}
                className="w-full h-12 mt-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>로그인 중...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>사번으로 로그인</span>
                  </>
                )}
              </button>

              <p className="text-xs text-slate-500 text-center pt-1">
                아직 사번 계정이 없으신가요?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('register')}
                  className="font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  신규 직원 등록하기
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="reg-worker-id"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    사번 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="reg-worker-id"
                    type="text"
                    value={regWorkerId}
                    onChange={e => setRegWorkerId(e.target.value)}
                    placeholder="예: 240301"
                    required
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1 font-mono truncate">
                    인증 ID: {previewRegEmail}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reg-display-name"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    성명 / 직급 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="reg-display-name"
                    type="text"
                    value={regDisplayName}
                    onChange={e => setRegDisplayName(e.target.value)}
                    placeholder="예: 홍길동 주임"
                    required
                    maxLength={80}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="reg-process"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    담당 공정 <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="reg-process"
                    value={regProcess}
                    onChange={e => setRegProcess(e.target.value as BreweryProcess)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {PROCESS_OPTIONS.map(proc => (
                      <option key={proc} value={proc}>
                        {PROCESS_CONFIG[proc].label} — {PROCESS_CONFIG[proc].desc}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="reg-phone"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    연락처 (선택)
                  </label>
                  <input
                    id="reg-phone"
                    type="tel"
                    value={regPhone}
                    onChange={e => setRegPhone(e.target.value)}
                    placeholder="예: 010-1234-5678"
                    maxLength={30}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="reg-password"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    비밀번호 (6자 이상) <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showRegPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={e => setRegPassword(e.target.value)}
                      placeholder="6자 이상"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      className="w-full h-10 pl-3 pr-9 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(prev => !prev)}
                      aria-label={showRegPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800"
                    >
                      {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-password-confirm"
                    className="block text-xs font-bold text-slate-700 mb-1"
                  >
                    비밀번호 확인 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    id="reg-password-confirm"
                    type={showRegPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={regPasswordConfirm}
                    onChange={e => setRegPasswordConfirm(e.target.value)}
                    placeholder="비밀번호 재입력"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isGoogleLoading}
                className="w-full h-11 mt-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>계정 등록 중...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>신규 직원 계정 등록 및 로그인</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                자가 등록 시 기본 권한은 현장 작업자(WORKER)로 부여됩니다. 관리자 또는 공무팀 권한이
                필요한 경우 등록 후 시스템 관리자에게 권한 변경을 요청하세요.
              </p>
            </form>
          )}

          {/* 관리자 Google 인증 영역 */}
          <div className="mt-7 pt-5 border-t border-slate-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>시스템 관리자 전용 인증</span>
              <span>전체 직원 계정 발급 · 권한 관리</span>
            </div>
            <button
              type="button"
              onClick={handleGoogleClick}
              disabled={isSubmitting || isGoogleLoading}
              className="w-full h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-semibold text-sm flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
            >
              {isGoogleLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-slate-600" />
                  <span>Google 인증 진행 중...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.96H1.29v3.1A12 12 0 0 0 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.28A7.22 7.22 0 0 1 4.9 12c0-.79.14-1.56.38-2.28v-3.1H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.99-3.1Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.76c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l3.99 3.1C6.23 6.87 8.88 4.76 12 4.76Z"
                    />
                  </svg>
                  <span>관리자 Google 계정으로 로그인</span>
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
