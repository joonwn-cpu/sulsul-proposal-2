import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  MIN_PASSWORD_LENGTH,
  changeCurrentUserPassword,
  formatFirebaseAuthError,
} from '../lib/firebase/auth';

interface PasswordChangeModalProps {
  isOpen: boolean;
  forced?: boolean;
  workerId: string;
  displayName: string;
  onClose: () => void;
  onSuccess?: () => void;
  onLogout?: () => void;
}

export function PasswordChangeModal({
  isOpen,
  forced = false,
  workerId,
  displayName,
  onClose,
  onSuccess,
  onLogout,
}: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setErrorMessage('현재(초기) 비밀번호를 입력해 주세요.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`새 비밀번호는 최소 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    if (currentPassword === newPassword) {
      setErrorMessage('새 비밀번호는 기존 비밀번호와 다르게 설정해 주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      await changeCurrentUserPassword(currentPassword, newPassword);
      setSuccessMessage('비밀번호가 안전하게 변경되었습니다.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.();
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 900);
    } catch (err) {
      setErrorMessage(formatFirebaseAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <KeyRound className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="font-bold text-base">
                {forced ? '최초 로그인 비밀번호 변경' : '비밀번호 변경'}
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {displayName} · 사번 {workerId}
              </p>
            </div>
          </div>

          {!forced && (
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {forced && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs leading-relaxed">
              관리자가 발급한 초기 비밀번호로 첫 접속하셨습니다. 사내 보안 정책(F-01)에 따라
              본인만 아는 새 비밀번호로 변경한 뒤 시스템을 이용해 주세요.
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div>
            <label
              htmlFor="pw-current"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              {forced ? '초기 비밀번호' : '현재 비밀번호'}
            </label>
            <input
              id="pw-current"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="pw-new"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              새 비밀번호 (6자 이상)
            </label>
            <input
              id="pw-new"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label
              htmlFor="pw-confirm"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              새 비밀번호 확인
            </label>
            <input
              id="pw-confirm"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(prev => !prev)}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showPasswords ? '비밀번호 숨기기' : '입력한 비밀번호 표시'}</span>
          </button>

          <div className="pt-2 flex items-center justify-end gap-2">
            {forced && onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>로그아웃</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold cursor-pointer"
              >
                취소
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>비밀번호 변경 저장</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
