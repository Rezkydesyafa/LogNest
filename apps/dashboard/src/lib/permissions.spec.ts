import { describe, expect, it } from 'vitest';
import { can, deniedReason, PROJECT_ROLES, REQUIRED_ROLE, roleAtLeast, roleLabel } from './permissions';

describe('roleAtLeast', () => {
  it('treats a higher role as satisfying a lower requirement', () => {
    expect(roleAtLeast('OWNER', 'VIEWER')).toBe(true);
    expect(roleAtLeast('ADMIN', 'ADMIN')).toBe(true);
    expect(roleAtLeast('VIEWER', 'MEMBER')).toBe(false);
  });

  it('denies everything for an unknown role', () => {
    expect(roleAtLeast(undefined, 'VIEWER')).toBe(false);
  });
});

describe('can', () => {
  it('lets a viewer read but not change anything', () => {
    expect(can('VIEWER', 'viewLogs')).toBe(true);
    expect(can('VIEWER', 'viewIncidents')).toBe(true);
    expect(can('VIEWER', 'changeIncidentStatus')).toBe(false);
    expect(can('VIEWER', 'manageApiKeys')).toBe(false);
  });

  it('lets a member work incidents but not administer', () => {
    expect(can('MEMBER', 'changeIncidentStatus')).toBe(true);
    expect(can('MEMBER', 'runAiAnalysis')).toBe(true);
    expect(can('MEMBER', 'manageAlerts')).toBe(false);
    expect(can('MEMBER', 'viewAuditLog')).toBe(false);
  });

  it('lets an admin administer but not delete the project', () => {
    expect(can('ADMIN', 'manageApiKeys')).toBe(true);
    expect(can('ADMIN', 'manageMembers')).toBe(true);
    expect(can('ADMIN', 'deleteProject')).toBe(false);
  });

  it('lets an owner do everything', () => {
    for (const action of Object.keys(REQUIRED_ROLE) as (keyof typeof REQUIRED_ROLE)[]) {
      expect(can('OWNER', action)).toBe(true);
    }
  });

  it('denies every action when the role is unknown', () => {
    for (const action of Object.keys(REQUIRED_ROLE) as (keyof typeof REQUIRED_ROLE)[]) {
      expect(can(undefined, action)).toBe(false);
    }
  });
});

describe('labels', () => {
  it('explains why a control is disabled', () => {
    expect(deniedReason('manageApiKeys')).toBe('Requires the admin role');
    expect(deniedReason('deleteProject')).toBe('Requires the owner role');
  });

  it('renders a role for display', () => {
    expect(PROJECT_ROLES.map(roleLabel)).toEqual(['Viewer', 'Member', 'Admin', 'Owner']);
  });
});
