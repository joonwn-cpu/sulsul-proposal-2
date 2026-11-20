import { BreweryProcess, UserRole } from '../types/brewery';
import { PROCESS_CONFIG, ROLE_CONFIG } from '../data/mockBreweryData';
import {
  FirestoreUserProfile,
  MAX_DISPLAY_NAME_LENGTH,
  MAX_PHONE_LENGTH,
  isValidWorkerId,
  normalizeWorkerId,
} from './firebase/auth';

export type ParsedRowStatus = 'READY' | 'EXISTING' | 'INVALID';

export interface ParsedBulkWorkerRow {
  rowNumber: number;
  rawLine: string;
  workerId: string;
  displayName: string;
  role: UserRole | null;
  process: BreweryProcess | null;
  phone: string;
  existingProfile?: FirestoreUserProfile;
  errors: string[];
  status: ParsedRowStatus;
}

export type BulkExecutionRowStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'CREATED'
  | 'UPDATED'
  | 'SKIPPED'
  | 'FAILED';

export interface BulkExecutionRowResult {
  rowNumber: number;
  workerId: string;
  displayName: string;
  role: UserRole;
  process: BreweryProcess;
  phone: string;
  status: BulkExecutionRowStatus;
  message: string;
}

/**
 * 직책/권한 한글·영문 입력값을 표준 UserRole로 변환
 */
export function parseRoleLabel(raw: string): UserRole | null {
  const cleaned = raw.trim().replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return null;

  if (
    cleaned === 'ADMIN' ||
    cleaned === '관리자' ||
    cleaned === '시스템관리자' ||
    cleaned === '총괄관리자' ||
    cleaned === '관리'
  ) {
    return 'ADMIN';
  }
  if (
    cleaned === 'TEAM_LEADER' ||
    cleaned === 'TEAMLEADER' ||
    cleaned === '반장' ||
    cleaned === '현장반장' ||
    cleaned === '공정반장'
  ) {
    return 'TEAM_LEADER';
  }
  if (
    cleaned === 'PART_LEADER' ||
    cleaned === 'PARTLEADER' ||
    cleaned === '파트장' ||
    cleaned === '공정파트장' ||
    cleaned === '조장'
  ) {
    return 'PART_LEADER';
  }
  if (
    cleaned === 'WORKER' ||
    cleaned === '일반담당' ||
    cleaned === '일반작업자' ||
    cleaned === '작업자' ||
    cleaned === '현장작업자' ||
    cleaned === '일반' ||
    cleaned === '담당' ||
    cleaned === '사원' ||
    cleaned === '직원'
  ) {
    return 'WORKER';
  }

  return null;
}

/**
 * 담당 공정 한글·영문 입력값을 표준 BreweryProcess로 변환
 * (DP, RFC, 라벨러, 포장기, 검사, 파트장, 반장, 관리자)
 */
export function parseProcessLabel(raw: string): BreweryProcess | null {
  const cleaned = raw.trim().replace(/\s+/g, '').toUpperCase();
  if (!cleaned) return null;

  if (
    cleaned === 'DP' ||
    cleaned === 'DP담당' ||
    cleaned === 'DEPALLETIZER' ||
    cleaned === 'DEPALLETIZER담당' ||
    cleaned === '디팔레타이저' ||
    cleaned === '디팔레타이저담당' ||
    cleaned === '디팔' ||
    cleaned === '디팔담당' ||
    cleaned === 'DEPAL' ||
    cleaned.includes('DEPALLET')
  ) {
    return 'DEPALLETIZER';
  }
  if (
    cleaned === 'RFC' ||
    cleaned === 'RFC담당' ||
    cleaned.startsWith('RFC')
  ) {
    return 'RFC';
  }
  if (
    cleaned === 'LABELER' ||
    cleaned === '라벨러' ||
    cleaned === '라벨러담당' ||
    cleaned === '라벨' ||
    cleaned === '라벨담당' ||
    cleaned === '라벨기'
  ) {
    return 'LABELER';
  }
  if (
    cleaned === 'PACKER' ||
    cleaned === '포장기' ||
    cleaned === '포장기담당' ||
    cleaned === '포장' ||
    cleaned === '포장담당' ||
    cleaned === '패커' ||
    cleaned === '케이스패커'
  ) {
    return 'PACKER';
  }
  if (
    cleaned === 'INSPECTION' ||
    cleaned === '검사' ||
    cleaned === '검사담당' ||
    cleaned === '검사기' ||
    cleaned === '검사기담당' ||
    cleaned === '비전검사' ||
    cleaned === '품질검사'
  ) {
    return 'INSPECTION';
  }
  if (
    cleaned === 'PART_LEADER' ||
    cleaned === 'PARTLEADER' ||
    cleaned === '파트장' ||
    cleaned === '파트장담당' ||
    cleaned === '공정파트장'
  ) {
    return 'PART_LEADER';
  }
  if (
    cleaned === 'TEAM_LEADER' ||
    cleaned === 'TEAMLEADER' ||
    cleaned === '반장' ||
    cleaned === '반장담당' ||
    cleaned === '현장반장' ||
    cleaned === '공정반장'
  ) {
    return 'TEAM_LEADER';
  }
  if (
    cleaned === 'ADMIN' ||
    cleaned === '관리자' ||
    cleaned === '관리자담당' ||
    cleaned === '관리' ||
    cleaned === '시스템관리자' ||
    cleaned === '총괄관리자'
  ) {
    return 'ADMIN';
  }

  return null;
}

/**
 * 한 줄의 CSV/TSV 문자열을 셀 배열로 안전하게 분리 (따옴표 지원)
 */
function splitSpreadsheetLine(line: string, delimiter: '\t' | ',' | ';'): string[] {
  if (delimiter === '\t') {
    return line.split('\t').map(cell => cell.trim().replace(/^"(.*)"$/, '$1').trim());
  }

  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(lines: string[]): '\t' | ',' | ';' {
  const sample = lines.slice(0, 5);
  const tabScore = sample.reduce((acc, l) => acc + (l.split('\t').length - 1), 0);
  const commaScore = sample.reduce((acc, l) => acc + (l.split(',').length - 1), 0);
  const semiScore = sample.reduce((acc, l) => acc + (l.split(';').length - 1), 0);

  if (tabScore > 0 && tabScore >= commaScore && tabScore >= semiScore) return '\t';
  if (semiScore > commaScore) return ';';
  return ',';
}

interface ColumnMap {
  workerId: number;
  displayName: number;
  role: number;
  process: number;
  phone: number;
}

function detectHeaderColumns(cells: string[]): ColumnMap | null {
  const normalized = cells.map(c => c.trim().replace(/\s+/g, '').toLowerCase());
  let workerId = -1;
  let displayName = -1;
  let role = -1;
  let process = -1;
  let phone = -1;

  normalized.forEach((cell, idx) => {
    if (workerId === -1 && (cell.includes('사번') || cell === 'id' || cell.includes('workerid'))) {
      workerId = idx;
    } else if (
      displayName === -1 &&
      (cell.includes('성명') || cell.includes('이름') || cell.includes('명단') || cell === 'name')
    ) {
      displayName = idx;
    } else if (
      role === -1 &&
      (cell.includes('직책') || cell.includes('권한') || cell.includes('직급') || cell === 'role')
    ) {
      role = idx;
    } else if (
      process === -1 &&
      (cell.includes('공정') || cell.includes('담당') || cell === 'process')
    ) {
      process = idx;
    } else if (
      phone === -1 &&
      (cell.includes('연락') || cell.includes('전화') || cell.includes('휴대폰') || cell === 'phone')
    ) {
      phone = idx;
    }
  });

  // 최소 2개 이상의 헤더 키워드가 매칭되면 헤더 행으로 판정
  const matchedCount = [workerId, displayName, role, process].filter(v => v >= 0).length;
  if (matchedCount >= 2) {
    return { workerId, displayName, role, process, phone };
  }
  return null;
}

function isPureSequenceNumber(val: string): boolean {
  return /^\d{1,2}$/.test(val.trim());
}

/**
 * 엑셀 복사·붙여넣기(TSV) 또는 CSV 텍스트를 직원 일괄 발급용 행 목록으로 파싱 및 사전 검증
 */
export function parseBulkWorkersText(
  rawText: string,
  existingProfiles: FirestoreUserProfile[],
  isBootstrappedAdmin: boolean
): ParsedBulkWorkerRow[] {
  const rawLines = rawText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (rawLines.length === 0) return [];

  const delimiter = detectDelimiter(rawLines);
  const firstCells = splitSpreadsheetLine(rawLines[0], delimiter);
  const headerMap = detectHeaderColumns(firstCells);

  const dataLines = headerMap ? rawLines.slice(1) : rawLines;
  const lineOffset = headerMap ? 2 : 1;

  const existingByWorkerId = new Map<string, FirestoreUserProfile>();
  existingProfiles.forEach(p => {
    existingByWorkerId.set(normalizeWorkerId(p.workerId), p);
  });

  const seenInBatch = new Set<string>();

  return dataLines.map((line, index) => {
    const rowNumber = index + lineOffset;
    let cells = splitSpreadsheetLine(line, delimiter);

    // 헤더 없이 맨 앞에 연번(1, 2, 3...) 열이 붙은 경우 자동 제거 (5열 이상이면서 첫 열이 1~2자리 순번일 때)
    if (!headerMap && cells.length >= 5 && isPureSequenceNumber(cells[0])) {
      const nextIsIdOrName = isValidWorkerId(cells[1]) || isValidWorkerId(cells[2]);
      if (nextIsIdOrName) {
        cells = cells.slice(1);
      }
    }

    let rawWorkerId = '';
    let rawDisplayName = '';
    let rawRole = '';
    let rawProcess = '';
    let rawPhone = '';

    if (headerMap) {
      rawWorkerId = headerMap.workerId >= 0 ? cells[headerMap.workerId] || '' : '';
      rawDisplayName = headerMap.displayName >= 0 ? cells[headerMap.displayName] || '' : '';
      rawRole = headerMap.role >= 0 ? cells[headerMap.role] || '' : '';
      rawProcess = headerMap.process >= 0 ? cells[headerMap.process] || '' : '';
      rawPhone = headerMap.phone >= 0 ? cells[headerMap.phone] || '' : '';
    } else {
      // 헤더 없는 경우: [사번, 성명, ...] 또는 [성명, 사번, ...] 순서 자동 판별
      const c0 = cells[0] || '';
      const c1 = cells[1] || '';
      const c2 = cells[2] || '';
      const c3 = cells[3] || '';
      const c4 = cells[4] || '';

      if (!isValidWorkerId(c0) && isValidWorkerId(c1)) {
        rawDisplayName = c0;
        rawWorkerId = c1;
      } else {
        rawWorkerId = c0;
        rawDisplayName = c1;
      }

      // 3·4열에서 직책/공정 순서가 바뀐 경우도 자동 인식
      // (파트장/반장/관리자는 직책·공정 양쪽에 존재하므로 양쪽 모두 유효한 조합을 우선 선택)
      const c2AsRole = parseRoleLabel(c2);
      const c3AsProcess = parseProcessLabel(c3);
      const c2AsProcess = parseProcessLabel(c2);
      const c3AsRole = parseRoleLabel(c3);

      const normalBothValid = Boolean(c2AsRole && c3AsProcess);
      const swappedBothValid = Boolean(c2AsProcess && c3AsRole);

      if (normalBothValid) {
        rawRole = c2;
        rawProcess = c3;
      } else if (swappedBothValid) {
        rawProcess = c2;
        rawRole = c3;
      } else if ((c2AsProcess || c3AsRole) && !c2AsRole && !c3AsProcess) {
        rawProcess = c2;
        rawRole = c3;
      } else {
        rawRole = c2;
        rawProcess = c3;
      }

      rawPhone = c4;
    }

    const workerId = normalizeWorkerId(rawWorkerId);
    const displayName = rawDisplayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    const role = parseRoleLabel(rawRole);
    const process = parseProcessLabel(rawProcess);
    const phone = rawPhone.trim().slice(0, MAX_PHONE_LENGTH);

    const errors: string[] = [];

    if (!isValidWorkerId(workerId)) {
      errors.push(
        rawWorkerId
          ? `사번 형식 오류("${rawWorkerId}" · 숫자 4자리 필요)`
          : '사번 누락 (숫자 4자리)'
      );
    } else if (seenInBatch.has(workerId)) {
      errors.push('붙여넣은 명단 내 중복 사번');
    } else {
      seenInBatch.add(workerId);
    }

    if (!displayName) {
      errors.push('성명 누락');
    }

    if (!role) {
      errors.push(
        rawRole
          ? `직책 인식 불가("${rawRole}" · 일반 담당/파트장/반장/관리자)`
          : '직책/권한 누락'
      );
    } else if (role === 'ADMIN' && !isBootstrappedAdmin) {
      errors.push('관리자 권한 부여는 시스템 관리자(Google) 로그인 필요');
    }

    if (!process) {
      errors.push(
        rawProcess
          ? `공정 인식 불가("${rawProcess}" · DP/RFC/라벨러/포장기/검사/파트장/반장/관리자)`
          : '담당 공정 누락'
      );
    }

    const existingProfile = isValidWorkerId(workerId)
      ? existingByWorkerId.get(workerId)
      : undefined;

    const status: ParsedRowStatus =
      errors.length > 0 ? 'INVALID' : existingProfile ? 'EXISTING' : 'READY';

    return {
      rowNumber,
      rawLine: line,
      workerId,
      displayName,
      role,
      process,
      phone,
      existingProfile,
      errors,
      status,
    };
  });
}

function escapeCsvCell(val: string): string {
  const normalized = String(val ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${normalized.replace(/"/g, '""')}"`;
}

/**
 * 엑셀에서 바로 열어 작성할 수 있는 일괄 발급 양식 CSV 생성 (UTF-8 BOM, 헤더 전용)
 */
export function buildBulkTemplateCsv(): string {
  const headers = ['사번', '성명', '직책/권한', '담당 공정', '연락처'];
  return '\uFEFF' + headers.map(escapeCsvCell).join(',') + '\n';
}

/**
 * 일괄 발급 처리 결과 CSV 리포트 생성 (UTF-8 BOM)
 */
export function buildBulkResultCsv(
  results: BulkExecutionRowResult[],
  initialPassword: string
): string {
  const headers = [
    '행',
    '사번',
    '성명',
    '직책/권한',
    '담당 공정',
    '연락처',
    '초기 비밀번호',
    '처리 상태',
    '상세 결과',
  ];

  const statusLabelMap: Record<BulkExecutionRowStatus, string> = {
    PENDING: '대기',
    RUNNING: '처리중',
    CREATED: '신규 발급 완료',
    UPDATED: '정보 업데이트 완료',
    SKIPPED: '건너뜀',
    FAILED: '실패',
  };

  const rows = results.map(item => [
    String(item.rowNumber),
    item.workerId,
    item.displayName,
    ROLE_CONFIG[item.role]?.label || item.role,
    PROCESS_CONFIG[item.process]?.label || item.process,
    item.phone || '-',
    item.status === 'CREATED' ? initialPassword : '-',
    statusLabelMap[item.status],
    item.message,
  ]);

  return (
    '\uFEFF' +
    [
      headers.map(escapeCsvCell).join(','),
      ...rows.map(row => row.map(escapeCsvCell).join(',')),
    ].join('\n')
  );
}
