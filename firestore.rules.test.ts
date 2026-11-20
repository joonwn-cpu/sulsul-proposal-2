/**
 * Phase 0 Security Rules Verification Harness (Dirty Dozen Payloads)
 *
 * Documents and validates the 12 adversarial payloads against the expected
 * PERMISSION_DENIED invariants defined in `security_spec.md` and enforced in `firestore.rules`.
 * Compatible with `@firebase/rules-unit-testing` when executed against the Firebase Emulator Suite.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email?: string;
    email_verified?: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_PAYLOADS: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Suggestion Create',
    operation: 'create',
    path: '/suggestions/SUG-2026-999',
    auth: null,
    payload: {
      id: 'SUG-2026-999',
      ownerUid: 'anon',
      title: 'Unauthorized report',
      description: 'Should be rejected',
      category: 'BREAKDOWN_REPAIR',
      process: 'PACKER',
      authorId: '240601',
      authorName: 'Anon',
      authorProcess: 'PACKER',
      status: 'PENDING',
      isUrgent: true,
      priorityScore: 90,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isAuthenticatedUser() requires verified email or @sulsul.brewery password auth',
  },
  {
    id: 2,
    name: 'Unverified Admin Email Spoofing',
    operation: 'get',
    path: '/users/victimUid',
    auth: {
      uid: 'attackerUid',
      email: 'joonwn@gmail.com',
      email_verified: false,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isBootstrappedAdmin() mandates request.auth.token.email_verified == true and non-@sulsul.brewery password emails are rejected',
  },
  {
    id: 3,
    name: 'Self-Assigned Admin Role Escalation (Employee-ID Auth)',
    operation: 'create',
    path: '/users/workerUid1',
    auth: {
      uid: 'workerUid1',
      email: '240301@sulsul.brewery',
      email_verified: false,
    },
    payload: {
      uid: 'workerUid1',
      workerId: '240301',
      displayName: 'Worker One',
      email: '240301@sulsul.brewery',
      process: 'RFC',
      role: 'ADMIN',
      isFirstLogin: false,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'Non-admin user profile creation strictly blocks role == "ADMIN"',
  },
  {
    id: 4,
    name: 'PII Cross-User Profile Read',
    operation: 'get',
    path: '/users/workerUid2',
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'PII isolation restricts /users/{userId} get to isOwner(userId) || isAdmin()',
  },
  {
    id: 5,
    name: 'Path Variable ID Poisoning',
    operation: 'create',
    path: `/suggestions/${'A'.repeat(160)}`,
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    payload: {
      id: 'A'.repeat(160),
      ownerUid: 'workerUid1',
      title: 'Oversized ID injection',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(suggestionId) enforces <= 128 chars and ^[a-zA-Z0-9_\\-]+$',
  },
  {
    id: 6,
    name: 'Identity Spoofing on Suggestion Create',
    operation: 'create',
    path: '/suggestions/SUG-2026-100',
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    payload: {
      id: 'SUG-2026-100',
      ownerUid: 'workerUid2',
      title: 'Spoofed author UID',
      description: 'Impersonating another worker',
      category: 'PROCESS_IMPROVEMENT',
      process: 'DEPALLETIZER',
      authorId: '240101',
      authorName: 'Victim',
      authorProcess: 'DEPALLETIZER',
      status: 'PENDING',
      isUrgent: false,
      priorityScore: 15,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidSuggestion() enforces data.ownerUid == request.auth.uid on create',
  },
  {
    id: 7,
    name: 'Shadow Field Injection ("Ghost Field")',
    operation: 'create',
    path: '/suggestions/SUG-2026-101',
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    payload: {
      id: 'SUG-2026-101',
      ownerUid: 'workerUid1',
      title: 'Shadow field attack',
      description: 'Attempting to inject undocumented boolean',
      category: 'PROCESS_IMPROVEMENT',
      process: 'INSPECTION',
      authorId: '240201',
      authorName: 'Worker One',
      authorProcess: 'INSPECTION',
      status: 'PENDING',
      isUrgent: false,
      priorityScore: 16,
      isVerifiedAdmin: true,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidSuggestion() enforces data.keys().hasOnly([...]) allowlist',
  },
  {
    id: 8,
    name: 'Client Timestamp Forgery',
    operation: 'create',
    path: '/suggestions/SUG-2026-102',
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    payload: {
      id: 'SUG-2026-102',
      ownerUid: 'workerUid1',
      title: 'Backdated suggestion',
      description: 'Trying to pass arbitrary client timestamp',
      category: 'PREVENTIVE_MAINT',
      process: 'LABELER',
      authorId: '240501',
      authorName: 'Worker One',
      authorProcess: 'LABELER',
      status: 'PENDING',
      isUrgent: false,
      priorityScore: 24,
      createdAt: '2020-01-01T00:00:00.000Z',
      updatedAt: '2020-01-01T00:00:00.000Z',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'Temporal integrity requires incoming().createdAt == request.time && incoming().updatedAt == request.time',
  },
  {
    id: 9,
    name: 'Workflow State Shortcutting by Worker',
    operation: 'create',
    path: '/suggestions/SUG-2026-103',
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    payload: {
      id: 'SUG-2026-103',
      ownerUid: 'workerUid1',
      title: 'Auto-approved suggestion',
      description: 'Skipping review workflow',
      category: 'PROCESS_IMPROVEMENT',
      process: 'RFC',
      authorId: '240301',
      authorName: 'Worker One',
      authorProcess: 'RFC',
      status: 'COMPLETED',
      isUrgent: false,
      priorityScore: 19,
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'Non-admin create requires incoming().status == "PENDING"',
  },
  {
    id: 10,
    name: 'Terminal State Mutation by Non-Admin',
    operation: 'update',
    path: '/suggestions/SUG-2026-003',
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    payload: {
      title: 'Tampering with completed suggestion',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'Terminal state lock blocks non-admin updates when existing().status in ["COMPLETED", "REJECTED"]',
  },
  {
    id: 11,
    name: 'Array Size & Element Type Poisoning',
    operation: 'update',
    path: '/suggestions/SUG-2026-005',
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    payload: {
      quickTags: [12345, 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11'],
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'Total array guarding checks quickTags.size() <= 10 and first element is string <= 80 chars',
  },
  {
    id: 12,
    name: 'Orphaned Comment Write on Missing/Unowned Parent',
    operation: 'create',
    path: '/suggestions/NON_EXISTENT_ID/comments/comment-1',
    auth: {
      uid: 'workerUid1',
      email: 'worker1@brewery.local',
      email_verified: true,
    },
    payload: {
      id: 'comment-1',
      suggestionId: 'NON_EXISTENT_ID',
      parentOwnerUid: 'workerUid1',
      authorUid: 'workerUid1',
      authorName: 'Worker One',
      message: 'Orphaned write',
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'Master Gate checks exists() and get() on parent /suggestions/{suggestionId}',
  },
];
