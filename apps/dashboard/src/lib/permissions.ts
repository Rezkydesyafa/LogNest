export const PROJECT_ROLES = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

const RANK: Record<ProjectRole, number> = { VIEWER: 1, MEMBER: 2, ADMIN: 3, OWNER: 4 };

/**
 * Minimum role each action needs.
 *
 * Mirrors the floors the API enforces. This is a UX layer only — it decides what to *offer*,
 * never what is *allowed*; the server remains the authority.
 */
export const REQUIRED_ROLE = {
  viewLogs: 'VIEWER',
  viewIncidents: 'VIEWER',
  viewMembers: 'VIEWER',
  changeIncidentStatus: 'MEMBER',
  runAiAnalysis: 'MEMBER',
  manageApiKeys: 'ADMIN',
  manageAlerts: 'ADMIN',
  manageMembers: 'ADMIN',
  viewAuditLog: 'ADMIN',
  editProject: 'ADMIN',
  deleteProject: 'OWNER',
} as const satisfies Record<string, ProjectRole>;

export type ProjectAction = keyof typeof REQUIRED_ROLE;

export function roleAtLeast(role: ProjectRole | undefined, minimum: ProjectRole) {
  return role ? RANK[role] >= RANK[minimum] : false;
}

export function can(role: ProjectRole | undefined, action: ProjectAction) {
  return roleAtLeast(role, REQUIRED_ROLE[action]);
}

/** Tooltip explaining why a control is disabled, so the block is not silent. */
export function deniedReason(action: ProjectAction) {
  return `Requires the ${REQUIRED_ROLE[action].toLowerCase()} role`;
}

export function roleLabel(role: ProjectRole) {
  return role.charAt(0) + role.slice(1).toLowerCase();
}
