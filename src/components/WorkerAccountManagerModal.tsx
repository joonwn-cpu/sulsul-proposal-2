import React, { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  ShieldAlert,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { BreweryProcess, UserRole } from '../types/brewery';
import { PROCESS_CONFIG } from '../data/mockBreweryData';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  EMPLOYEE_EMAIL_DOMAIN,
  FirestoreUserProfile,
  MIN_PASSWORD_LENGTH,
  formatFirebaseAuthError,
  isValidWorkerId,
  normalizeWorkerId,
  provisionWorkerAccountByAdmin,
  updateWorkerByAdmin,
} from '../lib/firebase/auth';

interface WorkerAccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfiles: FirestoreUserProfile[];
  currentUserUid: string;
  isBootstrappedAdmin: boolean;
  canManageAccounts: boolean;
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

const ROLE_LABELS: Record<UserRole, string> = {
  WORKER: '현장 작업자',
  MAINTENANCE: '공무·안전',
  ADMIN: '관리자',
};

export function WorkerAccountManagerModal({
  isOpen,
  onClose,
  userProfiles,
  currentUserUid,
  isBootstrappedAdmin,
  canManageAccounts,
}: WorkerAccountManagerModalProps) {
  const [workerId, setWorkerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [process, setProcess] = useState<BreweryProcess>('FERMENTATION');
  const [role, setRole] = useState<UserRole>('WORKER');
  const [phone, setPhone] = useState('');
  const [initialPassword, setInitialPassword] = useState('sulsul1234');

  const [isProvisioning, setIsProvisioning] = useState(false);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastProvisioned, setLastProvisioned] = useState<{
    workerId: string;
    displayName: string;
    initialPassword: string;
  } | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!isOpen) return null;

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLastProvisioned(null);

    const normalized = normalizeWorkerId(workerId).toUpperCase();
    if (!isValidWorkerId(normalized)) {
      setErrorMessage('사번은 영문, 숫자, 하이픈(-), 밑줄(_) 조합 2~32자로 입력해 주세요.');
      return;
    }
    if (!displayName.trim()) {
      setErrorMessage('직원 성명/직급을 입력해 주세요.');
      return;
    }
    if (initialPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`초기 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }

    setIsProvisioning(true);
    try {
      await provisionWorkerAccountByAdmin({
        workerId: normalized,
        initialPassword,
        displayName: displayName.trim(),
        process,
        phone: phone.trim(),
        role: isBootstrappedAdmin ? role : role === 'ADMIN' ? 'MAINTENANCE' : role,
      });

      setLastProvisioned({
        workerId: normalized,
        displayName: displayName.trim(),
        initialPassword,
      });
      setWorkerId('');
      setDisplayName('');
      setPhone('');
      setRole('WORKER');
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!lastProvisioned) return;
    const text = `[술술제안 로그인 안내]\n성명: ${lastProvisioned.displayName}\n사번: ${lastProvisioned.workerId}\n초기 비밀번호: ${lastProvisioned.initialPassword}\n* 최초 로그인 후 비밀번호를 변경해 주세요.`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleInlineUpdate = async (
    targetUid: string,
    updates: { process?: BreweryProcess; role?: UserRole }
  ) => {
    setErrorMessage(null);
    setUpdatingUid(targetUid);
    try {
      await updateWorkerByAdmin(targetUid, updates);
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setUpdatingUid(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">실제 직원 계정 발급 및 권한 관리</h3>
              <p className="text-xs text-slate-400">
                Firebase 사번 로그인(@{EMPLOYEE_EMAIL_DOMAIN}) · 등록 직원 {userProfiles.length}명
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isBootstrappedAdmin && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed">
              전체 직원 목록 조회 및 관리자 권한(ADMIN) 부여는 Google 시스템 관리자 계정(
              <span className="font-mono font-bold">{BOOTSTRAPPED_ADMIN_EMAIL}</span>)으로
              로그인했을 때 활성화됩니다.
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {lastProvisioned && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <p className="font-bold">
                    {lastProvisioned.displayName} 계정이 발급되었습니다.
                  </p>
                  <p className="font-mono text-emerald-900">
                    사번: {lastProvisioned.workerId} · 초기 비밀번호: {lastProvisioned.initialPassword}
                  </p>
                  <p className="text-emerald-800">
                    직원이 첫 로그인 시 개인 비밀번호로 변경하도록 자동 안내됩니다.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedSummary ? '복사됨' : '안내 문구 복사'}</span>
              </button>
            </div>
          )}

          {/* 신규 직원 계정 발급 폼 */}
          {canManageAccounts && (
            <form
              onSubmit={handleProvision}
              className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>신규 직원 사번 계정 발급</span>
                </h4>
                <span className="text-xs text-slate-500">
                  관리자 로그인 세션 유지 상태로 즉시 발급
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    사번 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={workerId}
                    onChange={e => setWorkerId(e.target.value)}
                    placeholder="예: 250101"
                    required
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    성명 / 직급 <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="예: 김철수 반장"
                    required
                    maxLength={80}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    초기 비밀번호 (6자+) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={initialPassword}
                    onChange={e => setInitialPassword(e.target.value)}
                    placeholder="6자 이상"
                    required
                    minLength={MIN_PASSWORD_LENGTH}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    담당 공정
                  </label>
                  <select
                    value={process}
                    onChange={e => setProcess(e.target.value as BreweryProcess)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {PROCESS_OPTIONS.map(proc => (
                      <option key={proc} value={proc}>
                        {PROCESS_CONFIG[proc].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    권한 등급
                  </label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="WORKER">현장 작업자 (WORKER)</option>
                    <option value="MAINTENANCE">공무·안전 담당 (MAINTENANCE)</option>
                    {isBootstrappedAdmin && <option value="ADMIN">관리자 (ADMIN)</option>}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    비상 연락처 (선택)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="010-0000-0000"
                    maxLength={30}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isProvisioning}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {isProvisioning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>계정 발급 중...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>사번 계정 발급</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 등록된 실제 직원 목록 테이블 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">
                등록된 직원 계정 목록 ({userProfiles.length}명)
              </h4>
              <span className="text-xs text-slate-500">Firestore /users 실시간 동기화</span>
            </div>

            {userProfiles.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
                아직 등록된 직원 프로필이 없습니다. 상단 폼에서 첫 번째 직원 사번 계정을 발급해 보세요.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">사번</th>
                      <th className="py-2.5 px-3">성명 / 직급</th>
                      <th className="py-2.5 px-3">담당 공정</th>
                      <th className="py-2.5 px-3">권한</th>
                      <th className="py-2.5 px-3">연락처</th>
                      <th className="py-2.5 px-3">비밀번호 상태</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {userProfiles.map(profile => {
                      const isSelf = profile.uid === currentUserUid;
                      const isBusy = updatingUid === profile.uid;
                      return (
                        <tr key={profile.uid} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {profile.workerId}
                            {isSelf && (
                              <span className="ml-1.5 text-[11px] font-sans font-semibold text-blue-700">
                                (본인)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                            {profile.displayName}
                          </td>
                          <td className="py-2.5 px-3">
                            {isBootstrappedAdmin ? (
                              <select
                                value={profile.process}
                                disabled={isBusy}
                                onChange={e =>
                                  handleInlineUpdate(profile.uid, {
                                    process: e.target.value as BreweryProcess,
                                  })
                                }
                                className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                              >
                                {PROCESS_OPTIONS.map(proc => (
                                  <option key={proc} value={proc}>
                                    {PROCESS_CONFIG[proc].label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-slate-700">
                                {PROCESS_CONFIG[profile.process]?.label}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {isBootstrappedAdmin && !isSelf ? (
                              <select
                                value={profile.role}
                                disabled={isBusy}
                                onChange={e =>
                                  handleInlineUpdate(profile.uid, {
                                    role: e.target.value as UserRole,
                                  })
                                }
                                className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                              >
                                <option value="WORKER">현장 작업자</option>
                                <option value="MAINTENANCE">공무·안전</option>
                                <option value="ADMIN">관리자</option>
                              </select>
                            ) : (
                              <span className="font-semibold text-slate-700">
                                {ROLE_LABELS[profile.role]}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                            {profile.phone || '-'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {profile.isFirstLogin ? (
                              <span className="text-amber-700 font-semibold">
                                초기 비밀번호 변경 대기
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">변경 완료</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
