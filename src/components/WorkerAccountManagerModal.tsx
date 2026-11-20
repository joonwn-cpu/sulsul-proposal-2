import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  KeyRound,
  Loader2,
  ShieldAlert,
  Square,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { BreweryProcess, UserRole } from '../types/brewery';
import {
  PROCESS_CONFIG,
  PROCESS_ORDER,
  ROLE_CONFIG,
  ROLE_ORDER,
} from '../data/mockBreweryData';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  BulkProvisionItemInput,
  DEFAULT_INITIAL_PASSWORD,
  EMPLOYEE_EMAIL_DOMAIN,
  FirestoreUserProfile,
  MIN_PASSWORD_LENGTH,
  bulkProvisionWorkersByAdmin,
  formatFirebaseAuthError,
  isValidWorkerId,
  normalizeWorkerId,
  provisionWorkerAccountByAdmin,
  updateWorkerByAdmin,
} from '../lib/firebase/auth';
import {
  BulkExecutionRowResult,
  BulkExecutionRowStatus,
  ParsedBulkWorkerRow,
  buildBulkResultCsv,
  buildBulkTemplateCsv,
  parseBulkWorkersText,
} from '../lib/bulkWorkerImport';

interface WorkerAccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfiles: FirestoreUserProfile[];
  currentUserUid: string;
  isBootstrappedAdmin: boolean;
  canManageAccounts: boolean;
}

type AccountPanelMode = 'single' | 'bulk';

function triggerCsvDownload(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getTodayCompactDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function WorkerAccountManagerModal({
  isOpen,
  onClose,
  userProfiles,
  currentUserUid,
  isBootstrappedAdmin,
  canManageAccounts,
}: WorkerAccountManagerModalProps) {
  const [activeMode, setActiveMode] = useState<AccountPanelMode>('single');

  // 개별 발급 상태
  const [workerId, setWorkerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [process, setProcess] = useState<BreweryProcess>('DEPALLETIZER');
  const [role, setRole] = useState<UserRole>('WORKER');
  const [phone, setPhone] = useState('');
  const [initialPassword, setInitialPassword] = useState(DEFAULT_INITIAL_PASSWORD);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [lastProvisioned, setLastProvisioned] = useState<{
    workerId: string;
    displayName: string;
    initialPassword: string;
  } | null>(null);
  const [copiedSummary, setCopiedSummary] = useState(false);

  // 일괄 발급 상태
  const [bulkText, setBulkText] = useState('');
  const [bulkInitialPassword, setBulkInitialPassword] = useState(DEFAULT_INITIAL_PASSWORD);
  const [updateExistingOnBulk, setUpdateExistingOnBulk] = useState(false);
  const [isBulkRunning, setIsBulkRunning] = useState(false);
  const [bulkStoppedEarly, setBulkStoppedEarly] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ completed: 0, total: 0 });
  const [bulkResults, setBulkResults] = useState<BulkExecutionRowResult[]>([]);
  const [bulkUsedPassword, setBulkUsedPassword] = useState(DEFAULT_INITIAL_PASSWORD);
  const [bulkCopied, setBulkCopied] = useState(false);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const stopBulkRef = useRef(false);

  // 공통 상태
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedBulkRows = useMemo<ParsedBulkWorkerRow[]>(
    () => parseBulkWorkersText(bulkText, userProfiles, isBootstrappedAdmin),
    [bulkText, userProfiles, isBootstrappedAdmin]
  );

  const bulkStats = useMemo(() => {
    const readyRows = parsedBulkRows.filter(row => row.status === 'READY');
    const existingRows = parsedBulkRows.filter(row => row.status === 'EXISTING');
    const invalidRows = parsedBulkRows.filter(row => row.status === 'INVALID');
    const executableRows = updateExistingOnBulk
      ? parsedBulkRows.filter(row => row.status === 'READY' || row.status === 'EXISTING')
      : readyRows;
    return {
      readyRows,
      existingRows,
      invalidRows,
      executableRows,
    };
  }, [parsedBulkRows, updateExistingOnBulk]);

  const resultStats = useMemo(() => {
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    bulkResults.forEach(item => {
      if (item.status === 'CREATED') created += 1;
      else if (item.status === 'UPDATED') updated += 1;
      else if (item.status === 'SKIPPED') skipped += 1;
      else if (item.status === 'FAILED') failed += 1;
    });
    return { created, updated, skipped, failed };
  }, [bulkResults]);

  if (!isOpen) return null;

  const assignableRoles: UserRole[] = isBootstrappedAdmin
    ? ROLE_ORDER
    : ROLE_ORDER.filter(r => r !== 'ADMIN');

  const handleSafeClose = () => {
    if (isBulkRunning) {
      setErrorMessage('일괄 발급이 진행 중입니다. 먼저 [중단]을 누르거나 완료될 때까지 기다려 주세요.');
      return;
    }
    onClose();
  };

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLastProvisioned(null);

    const normalized = normalizeWorkerId(workerId);
    if (!isValidWorkerId(normalized)) {
      setErrorMessage('사번은 숫자 4자리로 입력해 주세요. (예: 1455)');
      return;
    }
    if (!displayName.trim()) {
      setErrorMessage('직원 성명을 입력해 주세요.');
      return;
    }
    if (initialPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`초기 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상이어야 합니다.`);
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
        role: isBootstrappedAdmin ? role : role === 'ADMIN' ? 'TEAM_LEADER' : role,
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
      setInitialPassword(DEFAULT_INITIAL_PASSWORD);
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

  const handleDownloadTemplate = () => {
    triggerCsvDownload(buildBulkTemplateCsv(), '양식_양조2팀_직원일괄발급.csv');
  };

  const handleLoadBulkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      let decodedText = '';
      try {
        decodedText = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
      } catch {
        // 한국어 엑셀 기본 CSV(CP949 / EUC-KR) 자동 복원
        decodedText = new TextDecoder('euc-kr').decode(buffer);
      }
      setBulkText(decodedText);
      setBulkFileName(file.name);
      setBulkResults([]);
      setBulkStoppedEarly(false);
    } catch {
      setErrorMessage('파일을 읽는 중 오류가 발생했습니다. CSV 또는 TXT 파일인지 확인해 주세요.');
    }
  };

  const handleClearBulk = () => {
    if (isBulkRunning) return;
    setBulkText('');
    setBulkFileName(null);
    setBulkResults([]);
    setBulkStoppedEarly(false);
    setBulkProgress({ completed: 0, total: 0 });
    setErrorMessage(null);
  };

  const handleRunBulkImport = async () => {
    setErrorMessage(null);

    if (bulkInitialPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `일괄 초기 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자리 이상이어야 합니다.`
      );
      return;
    }

    const targets: BulkProvisionItemInput[] = bulkStats.executableRows
      .filter(row => row.role !== null && row.process !== null)
      .map(row => {
        const isSelfUpdate = row.existingProfile?.uid === currentUserUid;
        return {
          rowNumber: row.rowNumber,
          workerId: row.workerId,
          displayName: row.displayName,
          // 본인 계정의 권한이 일괄 업데이트로 의도치 않게 하향되지 않도록 보호
          role: isSelfUpdate && row.existingProfile ? row.existingProfile.role : row.role!,
          process: row.process!,
          phone: row.phone,
          existingUid: row.existingProfile?.uid,
        };
      });

    if (targets.length === 0) {
      setErrorMessage('발급하거나 업데이트할 정상 직원 명단이 없습니다.');
      return;
    }

    stopBulkRef.current = false;
    setBulkStoppedEarly(false);
    setIsBulkRunning(true);
    setBulkUsedPassword(bulkInitialPassword);
    setBulkResults([]);
    setBulkProgress({ completed: 0, total: targets.length });

    try {
      await bulkProvisionWorkersByAdmin({
        items: targets,
        initialPassword: bulkInitialPassword,
        updateExisting: updateExistingOnBulk,
        shouldStop: () => stopBulkRef.current,
        onItemProgress: (itemResult, completedCount, totalCount) => {
          setBulkProgress({ completed: completedCount, total: totalCount });
          setBulkResults(prev => [...prev, itemResult]);
        },
      });
      if (stopBulkRef.current) {
        setBulkStoppedEarly(true);
      }
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsBulkRunning(false);
    }
  };

  const handleStopBulk = () => {
    stopBulkRef.current = true;
  };

  const handleCopyBulkNotice = async () => {
    const createdRows = bulkResults.filter(r => r.status === 'CREATED');
    if (createdRows.length === 0) return;

    const lines = [
      `[술술제안 양조2팀 로그인 안내]`,
      `초기 비밀번호: ${bulkUsedPassword} (최초 로그인 후 변경)`,
      ``,
      ...createdRows.map(
        r =>
          `- ${r.workerId} / ${r.displayName} (${ROLE_CONFIG[r.role]?.label || r.role} · ${
            PROCESS_CONFIG[r.process]?.label || r.process
          })`
      ),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setBulkCopied(true);
      setTimeout(() => setBulkCopied(false), 2000);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleDownloadBulkResultCsv = () => {
    if (bulkResults.length === 0) return;
    triggerCsvDownload(
      buildBulkResultCsv(bulkResults, bulkUsedPassword),
      `양조2팀_직원일괄발급_결과_${getTodayCompactDate()}.csv`
    );
  };

  const renderResultStatusLabel = (status: BulkExecutionRowStatus) => {
    switch (status) {
      case 'CREATED':
        return <span className="font-bold text-emerald-700">발급 완료</span>;
      case 'UPDATED':
        return <span className="font-bold text-blue-700">업데이트</span>;
      case 'SKIPPED':
        return <span className="font-semibold text-slate-600">건너뜀</span>;
      case 'FAILED':
        return <span className="font-bold text-rose-700">실패</span>;
      default:
        return <span className="text-slate-500">대기</span>;
    }
  };

  const bulkProgressPct =
    bulkProgress.total > 0
      ? Math.round((bulkProgress.completed / bulkProgress.total) * 100)
      : 0;

  const bulkSubmitLabel = (() => {
    const newCount = bulkStats.readyRows.length;
    const updCount = updateExistingOnBulk ? bulkStats.existingRows.length : 0;
    if (newCount > 0 && updCount > 0) {
      return `신규 ${newCount}명 발급 · 기존 ${updCount}명 업데이트`;
    }
    if (newCount === 0 && updCount > 0) {
      return `기존 ${updCount}명 정보 일괄 업데이트`;
    }
    return `신규 ${newCount}명 일괄 발급 실행`;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
        {/* 헤더 */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Users className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-base truncate">실제 직원 계정 발급 및 권한 관리</h3>
              <p className="text-xs text-slate-400 truncate">
                양조2팀 제품공정 · 숫자 4자리 사번 로그인(@{EMPLOYEE_EMAIL_DOMAIN}) · 등록 직원{' '}
                <span className="tabular-nums font-semibold text-slate-200">
                  {userProfiles.length}
                </span>
                명
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSafeClose}
            disabled={isBulkRunning}
            aria-label="닫기"
            title={
              isBulkRunning
                ? '일괄 발급 진행 중에는 중단 후 닫을 수 있습니다.'
                : '닫기'
            }
            className="p-1.5 text-slate-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!isBootstrappedAdmin && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed">
              전체 직원 목록 조회 및 관리자 권한(관리자) 부여는 Google 시스템 관리자 계정(
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

          {/* 발급 영역: 개별 / 엑셀·CSV 일괄 전환 */}
          {canManageAccounts && (
            <div className="space-y-4">
              {/* 모드 전환 세그먼트 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div
                  role="tablist"
                  aria-label="직원 계정 발급 방식 선택"
                  className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMode === 'single'}
                    disabled={isBulkRunning || isProvisioning}
                    onClick={() => {
                      setActiveMode('single');
                      setErrorMessage(null);
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 ${
                      activeMode === 'single'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>개별 사번 발급</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeMode === 'bulk'}
                    disabled={isBulkRunning || isProvisioning}
                    onClick={() => {
                      setActiveMode('bulk');
                      setErrorMessage(null);
                    }}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 ${
                      activeMode === 'bulk'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>엑셀·CSV 일괄 발급</span>
                  </button>
                </div>

                <span className="text-xs text-slate-500">
                  관리자 로그인 세션 유지 상태로 Firebase Auth + Firestore 즉시 등록
                </span>
              </div>

              {/* 모드 1: 개별 직원 계정 발급 */}
              {activeMode === 'single' && (
                <div className="space-y-4">
                  {lastProvisioned && (
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <p className="font-bold">
                            {lastProvisioned.displayName} 계정이 발급되었습니다.
                          </p>
                          <p className="font-mono text-emerald-900">
                            사번: {lastProvisioned.workerId} · 초기 비밀번호:{' '}
                            {lastProvisioned.initialPassword}
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

                  <form
                    onSubmit={handleProvision}
                    className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          사번 (숫자 4자리) <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={4}
                          value={workerId}
                          onChange={e =>
                            setWorkerId(e.target.value.replace(/\D/g, '').slice(0, 4))
                          }
                          placeholder="예: 1455"
                          required
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          성명 <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={e => setDisplayName(e.target.value)}
                          placeholder="성명을 입력하세요"
                          required
                          maxLength={80}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          초기 비밀번호 ({MIN_PASSWORD_LENGTH}자리+ · 기본 {DEFAULT_INITIAL_PASSWORD}
                          ) <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={initialPassword}
                          onChange={e => setInitialPassword(e.target.value)}
                          placeholder={`예: ${DEFAULT_INITIAL_PASSWORD}`}
                          required
                          minLength={MIN_PASSWORD_LENGTH}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          직책 / 권한
                        </label>
                        <select
                          value={role}
                          onChange={e => setRole(e.target.value as UserRole)}
                          className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        >
                          {assignableRoles.map(r => (
                            <option key={r} value={r}>
                              {ROLE_CONFIG[r].label}
                            </option>
                          ))}
                        </select>
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
                          {PROCESS_ORDER.map(proc => (
                            <option key={proc} value={proc}>
                              {PROCESS_CONFIG[proc].label}
                            </option>
                          ))}
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
                </div>
              )}

              {/* 모드 2: 엑셀·CSV 일괄 발급 */}
              {activeMode === 'bulk' && (
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-4">
                  {/* 상단 툴바 */}
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                    <div className="w-full lg:w-64">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        일괄 초기 비밀번호 ({MIN_PASSWORD_LENGTH}자리+ · 기본{' '}
                        {DEFAULT_INITIAL_PASSWORD})
                      </label>
                      <input
                        type="text"
                        value={bulkInitialPassword}
                        disabled={isBulkRunning}
                        onChange={e => setBulkInitialPassword(e.target.value)}
                        placeholder={DEFAULT_INITIAL_PASSWORD}
                        minLength={MIN_PASSWORD_LENGTH}
                        className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.tsv,.txt"
                        onChange={handleLoadBulkFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={isBulkRunning}
                        onClick={handleDownloadTemplate}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>양식 CSV 다운로드</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBulkRunning}
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>CSV·TXT 파일 불러오기</span>
                      </button>
                      {(bulkText.trim().length > 0 || bulkResults.length > 0) && (
                        <button
                          type="button"
                          disabled={isBulkRunning}
                          onClick={handleClearBulk}
                          className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-600 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>초기화</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 붙여넣기 입력 영역 */}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <label className="font-bold text-slate-700">
                        엑셀 명단 붙여넣기 (사번 · 성명 · 직책/권한 · 담당 공정 · 연락처)
                      </label>
                      {bulkFileName && (
                        <span className="font-mono text-blue-700">
                          불러온 파일: {bulkFileName}
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={7}
                      disabled={isBulkRunning}
                      value={bulkText}
                      onChange={e => {
                        setBulkText(e.target.value);
                        if (bulkResults.length > 0) {
                          setBulkResults([]);
                          setBulkStoppedEarly(false);
                        }
                      }}
                      placeholder={`엑셀에서 [사번, 성명, 직책/권한, 담당 공정, 연락처(선택)] 열을 드래그·복사 후 여기에 붙여넣으세요.\n성명과 사번 순서가 바뀌거나 첫 줄 제목 행이 있어도 자동으로 인식됩니다.`}
                      className="w-full p-3 rounded-xl border border-slate-300 bg-white font-mono text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-100"
                    />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      인식 직책: 일반 담당 · 파트장 · 반장 · 관리자 &nbsp;|&nbsp; 인식 공정: DP ·
                      RFC · 라벨러 · 포장기 · 검사 · 파트장 · 반장 · 관리자
                    </p>
                  </div>

                  {/* 실시간 검증 미리보기 */}
                  {parsedBulkRows.length > 0 && (
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <p className="text-xs text-slate-700 tabular-nums">
                          총 <span className="font-bold text-slate-900">{parsedBulkRows.length}</span>
                          명 · 신규 발급 가능{' '}
                          <span className="font-bold text-emerald-700">
                            {bulkStats.readyRows.length}
                          </span>
                          명 · 기존 사번{' '}
                          <span className="font-bold text-blue-700">
                            {bulkStats.existingRows.length}
                          </span>
                          명 · 확인 필요{' '}
                          <span className="font-bold text-rose-700">
                            {bulkStats.invalidRows.length}
                          </span>
                          명
                        </p>

                        {bulkStats.existingRows.length > 0 && (
                          <label className="inline-flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none">
                            <input
                              type="checkbox"
                              disabled={isBulkRunning}
                              checked={updateExistingOnBulk}
                              onChange={e => setUpdateExistingOnBulk(e.target.checked)}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <span>
                              기존 사번 {bulkStats.existingRows.length}명의 성명·직책·담당 공정 함께
                              업데이트 (비밀번호 유지)
                            </span>
                          </label>
                        )}
                      </div>

                      <div className="border border-slate-200 rounded-xl bg-white overflow-auto max-h-64">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-600 font-semibold z-10">
                            <tr>
                              <th className="py-2 px-2.5 w-12">행</th>
                              <th className="py-2 px-2.5">사번</th>
                              <th className="py-2 px-2.5">성명</th>
                              <th className="py-2 px-2.5">직책 / 권한</th>
                              <th className="py-2 px-2.5">담당 공정</th>
                              <th className="py-2 px-2.5">연락처</th>
                              <th className="py-2 px-2.5">검증 결과</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {parsedBulkRows.map(row => (
                              <tr
                                key={`${row.rowNumber}-${row.rawLine}`}
                                className={
                                  row.status === 'INVALID'
                                    ? 'bg-rose-50/60'
                                    : row.status === 'EXISTING'
                                    ? 'bg-blue-50/40'
                                    : 'hover:bg-slate-50/70'
                                }
                              >
                                <td className="py-2 px-2.5 font-mono text-slate-500 tabular-nums">
                                  {row.rowNumber}
                                </td>
                                <td className="py-2 px-2.5 font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                  {row.workerId || '-'}
                                </td>
                                <td className="py-2 px-2.5 font-semibold text-slate-900 whitespace-nowrap">
                                  {row.displayName || '-'}
                                </td>
                                <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap">
                                  {row.role ? ROLE_CONFIG[row.role].label : '-'}
                                </td>
                                <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap">
                                  {row.process ? PROCESS_CONFIG[row.process].label : '-'}
                                </td>
                                <td className="py-2 px-2.5 font-mono text-slate-600 tabular-nums whitespace-nowrap">
                                  {row.phone || '-'}
                                </td>
                                <td className="py-2 px-2.5">
                                  {row.status === 'READY' && (
                                    <span className="font-semibold text-emerald-700 whitespace-nowrap">
                                      신규 발급 대기
                                    </span>
                                  )}
                                  {row.status === 'EXISTING' && (
                                    <span
                                      className={`font-semibold whitespace-nowrap ${
                                        updateExistingOnBulk ? 'text-blue-700' : 'text-slate-600'
                                      }`}
                                    >
                                      {updateExistingOnBulk
                                        ? '기존 사번 · 정보 업데이트 예정'
                                        : '기존 사번 · 건너뜀'}
                                    </span>
                                  )}
                                  {row.status === 'INVALID' && (
                                    <span className="inline-flex items-start gap-1 text-rose-700 font-medium">
                                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                      <span>{row.errors.join(' · ')}</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 실행 컨트롤 및 진행률 */}
                      {isBulkRunning ? (
                        <div className="p-4 rounded-xl bg-white border border-blue-200 space-y-2.5">
                          <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="font-bold text-slate-900 inline-flex items-center gap-2">
                              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                              <span className="tabular-nums">
                                순차 계정 발급 진행 중... {bulkProgress.completed} /{' '}
                                {bulkProgress.total}명 ({bulkProgressPct}%)
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={handleStopBulk}
                              className="px-3 py-1.5 rounded-lg border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                            >
                              <Square className="w-3 h-3 fill-current" />
                              <span>중단</span>
                            </button>
                          </div>
                          <progress
                            value={bulkProgress.completed}
                            max={Math.max(bulkProgress.total, 1)}
                            aria-label="일괄 발급 진행률"
                            className="w-full h-2 rounded-full overflow-hidden accent-blue-600 [&::-webkit-progress-bar]:bg-slate-200 [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:bg-blue-600"
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <p className="text-xs text-slate-600">
                            {bulkStats.invalidRows.length > 0 &&
                            bulkStats.executableRows.length > 0 ? (
                              <>
                                확인 필요{' '}
                                <span className="font-bold text-rose-700 tabular-nums">
                                  {bulkStats.invalidRows.length}
                                </span>
                                행은 제외하고 정상{' '}
                                <span className="font-bold text-slate-900 tabular-nums">
                                  {bulkStats.executableRows.length}
                                </span>
                                명만 처리됩니다.
                              </>
                            ) : bulkStats.executableRows.length > 0 ? (
                              <>
                                신규 발급 계정은 첫 로그인 시 개인 비밀번호 변경 안내가 자동
                                표시됩니다.
                              </>
                            ) : (
                              <>
                                발급 가능한 신규 사번이 없습니다. 오류 행을 수정하거나 기존 사번
                                업데이트를 선택해 주세요.
                              </>
                            )}
                          </p>

                          <button
                            type="button"
                            onClick={handleRunBulkImport}
                            disabled={
                              bulkStats.executableRows.length === 0 ||
                              bulkInitialPassword.length < MIN_PASSWORD_LENGTH
                            }
                            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>{bulkSubmitLabel}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 실행 결과 리포트 */}
                  {bulkResults.length > 0 && (
                    <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>
                              일괄 처리 결과 {bulkStoppedEarly ? '(사용자 중단됨)' : ''}
                            </span>
                          </p>
                          <p className="text-xs text-slate-600 tabular-nums">
                            처리 {bulkResults.length}명 · 신규 발급{' '}
                            <span className="font-bold text-emerald-700">
                              {resultStats.created}
                            </span>
                            명 · 업데이트{' '}
                            <span className="font-bold text-blue-700">{resultStats.updated}</span>명
                            · 건너뜀{' '}
                            <span className="font-bold text-slate-700">{resultStats.skipped}</span>
                            명 · 실패{' '}
                            <span className="font-bold text-rose-700">{resultStats.failed}</span>명
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {resultStats.created > 0 && (
                            <button
                              type="button"
                              onClick={handleCopyBulkNotice}
                              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              <span>{bulkCopied ? '복사됨' : '신규 계정 안내 복사'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={handleDownloadBulkResultCsv}
                            className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>처리 결과 CSV</span>
                          </button>
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-auto max-h-56">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                            <tr>
                              <th className="py-2 px-2.5 w-12">행</th>
                              <th className="py-2 px-2.5">사번</th>
                              <th className="py-2 px-2.5">성명</th>
                              <th className="py-2 px-2.5">직책 · 공정</th>
                              <th className="py-2 px-2.5">상태</th>
                              <th className="py-2 px-2.5">상세 결과</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {bulkResults.map(item => (
                              <tr key={`${item.rowNumber}-${item.workerId}`}>
                                <td className="py-2 px-2.5 font-mono text-slate-500 tabular-nums">
                                  {item.rowNumber}
                                </td>
                                <td className="py-2 px-2.5 font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                                  {item.workerId}
                                </td>
                                <td className="py-2 px-2.5 font-semibold text-slate-900 whitespace-nowrap">
                                  {item.displayName}
                                </td>
                                <td className="py-2 px-2.5 text-slate-700 whitespace-nowrap">
                                  {ROLE_CONFIG[item.role]?.label || item.role} ·{' '}
                                  {PROCESS_CONFIG[item.process]?.label || item.process}
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap">
                                  {renderResultStatusLabel(item.status)}
                                </td>
                                <td className="py-2 px-2.5 text-slate-600">{item.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 등록된 실제 직원 목록 테이블 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900 tabular-nums">
                등록된 직원 계정 목록 ({userProfiles.length}명)
              </h4>
              <span className="text-xs text-slate-500">Firestore /users 실시간 동기화</span>
            </div>

            {userProfiles.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">
                아직 등록된 직원 프로필이 없습니다. 상단에서 개별 또는 엑셀·CSV 일괄 발급으로 직원
                사번 계정을 등록해 보세요.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                      <th className="py-2.5 px-3">사번</th>
                      <th className="py-2.5 px-3">성명</th>
                      <th className="py-2.5 px-3">직책 / 권한</th>
                      <th className="py-2.5 px-3">담당 공정</th>
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
                            {isBootstrappedAdmin && !isSelf ? (
                              <select
                                value={profile.role}
                                disabled={isBusy || isBulkRunning}
                                onChange={e =>
                                  handleInlineUpdate(profile.uid, {
                                    role: e.target.value as UserRole,
                                  })
                                }
                                className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                              >
                                {ROLE_ORDER.map(r => (
                                  <option key={r} value={r}>
                                    {ROLE_CONFIG[r].label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="font-semibold text-slate-700">
                                {ROLE_CONFIG[profile.role]?.label || profile.role}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3">
                            {isBootstrappedAdmin ? (
                              <select
                                value={profile.process}
                                disabled={isBusy || isBulkRunning}
                                onChange={e =>
                                  handleInlineUpdate(profile.uid, {
                                    process: e.target.value as BreweryProcess,
                                  })
                                }
                                className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                              >
                                {PROCESS_ORDER.map(proc => (
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
