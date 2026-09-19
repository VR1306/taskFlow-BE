const defineModule = (moduleKey, moduleName, description, icon, permissions) => ({
  moduleKey,
  moduleName,
  description,
  icon,
  permissions: permissions.map(([actionKey, name, desc, action]) => ({
    id: `${moduleKey}.${actionKey}`,
    name,
    description: desc,
    action,
  })),
});

const defineRole = (
  name,
  description,
  roleType,
  permissions,
  isSystem = true,
  isActive = true
) => ({
  name,
  description,
  roleType,
  permissions,
  isSystem,
  isActive,
});

export const SYSTEM_PERMISSIONS_CATALOGUE = [
  defineModule(
    'users',
    'User Management',
    'Manage user accounts, invitations, and workspace profiles.',
    'users',
    [
      ['view', 'View Users', 'Browse, search, and view user details and membership lists.', 'read'],
      [
        'create',
        'Create Users',
        'Invite and register new team members to the organization.',
        'create',
      ],
      [
        'edit',
        'Edit Users',
        'Update user profile details, assigned roles, and active status.',
        'update',
      ],
      [
        'delete',
        'Delete Users',
        'Remove or deactivate user accounts from the workspace.',
        'delete',
      ],
    ]
  ),
  defineModule(
    'roles',
    'Role & Access Control',
    'Define custom access levels, roles, and security policy permissions.',
    'shield',
    [
      ['view', 'View Roles', 'Browse role directory and inspect granted permissions.', 'read'],
      [
        'create',
        'Create Roles',
        'Create new custom organizational roles with granular permissions.',
        'create',
      ],
      [
        'edit',
        'Edit Roles',
        'Modify role details, description, and permission matrices.',
        'update',
      ],
      [
        'delete',
        'Delete Roles',
        'Remove obsolete custom roles that are not in active use.',
        'delete',
      ],
    ]
  ),
  defineModule(
    'tasks',
    'Task & Workflow Management',
    'Create, schedule, assign, and track workspace workflow tasks.',
    'task',
    [
      ['view', 'View Tasks', 'View task boards, status columns, and workspace activity.', 'read'],
      ['create', 'Create Tasks', 'Create and assign new tasks to team members.', 'create'],
      ['edit', 'Edit Tasks', 'Update task progress, status transitions, and deadlines.', 'update'],
      ['delete', 'Delete Tasks', 'Archive or permanently remove completed tasks.', 'delete'],
    ]
  ),
  defineModule(
    'analytics',
    'Analytics & Audit Reports',
    'Monitor workspace productivity metrics and export activity logs.',
    'chart',
    [
      ['view', 'View Reports', 'Inspect performance dashboards and usage trends.', 'read'],
      ['export', 'Export Reports', 'Download CSV and PDF audit logs and data exports.', 'export'],
    ]
  ),
  defineModule(
    'settings',
    'System & Security Settings',
    'Configure organizational parameters and global authentication settings.',
    'settings',
    [
      [
        'view',
        'View Settings',
        'Inspect workspace security policies and environment configuration.',
        'read',
      ],
      [
        'edit',
        'Manage Settings',
        'Modify organizational configuration, domain policies, and API keys.',
        'update',
      ],
    ]
  ),
];

/**
 * All valid permission IDs flattened into a simple array
 */
export const ALL_PERMISSION_IDS = SYSTEM_PERMISSIONS_CATALOGUE.flatMap((module) =>
  module.permissions.map((p) => p.id)
);

/**
 * Default Seed Roles configured with appropriate permission baselines
 */
export const DEFAULT_SEED_ROLES = [
  defineRole(
    'Super Admin',
    'Complete and unrestricted administrative access to all workspace resources and system settings.',
    'Super Admin',
    ALL_PERMISSION_IDS
  ),
  defineRole(
    'Admin',
    'Full workspace management access including users, roles, tasks, reports, and settings.',
    'Admin',
    ALL_PERMISSION_IDS.filter((id) => id !== 'settings.edit')
  ),
  defineRole(
    'Manager',
    'Manage team members, create workflows, assign tasks, and view organizational reports.',
    'Manager',
    [
      'users.view',
      'users.create',
      'users.edit',
      'roles.view',
      'tasks.view',
      'tasks.create',
      'tasks.edit',
      'tasks.delete',
      'analytics.view',
      'analytics.export',
      'settings.view',
    ]
  ),
  defineRole(
    'User',
    'Standard team member access to view directory, participate in tasks, and track personal work.',
    'User',
    ['users.view', 'tasks.view', 'tasks.create', 'tasks.edit', 'analytics.view']
  ),
  defineRole(
    'Guest',
    'Read-only access for external collaborators and clients to view shared tasks.',
    'Guest',
    ['tasks.view', 'analytics.view'],
    false
  ),
];

export const VALID_ROLE_TYPES = ['Super Admin', 'Admin', 'Manager', 'User', 'Guest', 'Custom'];
