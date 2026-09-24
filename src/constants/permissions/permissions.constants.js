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
    'projects',
    'Project Management',
    'Create and manage projects, membership, and delivery configuration.',
    'building',
    [
      ['view', 'View Projects', 'Browse project directory and inspect project details.', 'read'],
      ['create', 'Create Projects', 'Create new projects and configure their workspace.', 'create'],
      [
        'edit',
        'Edit Projects',
        'Update project details, membership, and lead assignment.',
        'update',
      ],
      ['delete', 'Delete Projects', 'Archive or permanently remove projects.', 'delete'],
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
    'Taskflow Admin',
    'Complete and unrestricted administrative access to every TaskFlow module, including user, role, and workspace configuration.',
    'Taskflow Admin',
    ALL_PERMISSION_IDS
  ),
  defineRole(
    'Project Manager',
    'Plan and oversee projects, manage team membership, assign work items, and monitor delivery reports.',
    'Project Manager',
    [
      'users.view',
      'users.create',
      'users.edit',
      'roles.view',
      'projects.view',
      'projects.create',
      'projects.edit',
      'projects.delete',
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
    'Developer',
    'Build and update assigned work items, track personal task progress, and view team performance.',
    'Developer',
    ['projects.view', 'tasks.view', 'tasks.create', 'tasks.edit', 'analytics.view']
  ),
  defineRole(
    'QA',
    'Verify completed work items, log defects, and track quality metrics across the workspace.',
    'QA',
    ['projects.view', 'tasks.view', 'tasks.create', 'tasks.edit', 'analytics.view']
  ),
];

export const VALID_ROLE_TYPES = ['Taskflow Admin', 'Project Manager', 'Developer', 'QA', 'Custom'];

// ─── User Roles ──────────────────────────────────────────────────────────────

/** All assignable user roles (used in Joi validators, UI dropdowns) */
export const USER_ROLES = ['Taskflow Admin', 'Project Manager', 'Developer', 'QA'];

/** Roles allowed on the Mongoose User schema enum */
export const USER_ROLES_SCHEMA = ['Taskflow Admin', 'Project Manager', 'Developer', 'QA'];

/** Default role assigned to newly created users */
export const USER_DEFAULT_ROLE = 'Developer';

// ─── Notification Target Roles ────────────────────────────────────────────────

/** Valid values for the Notification.targetRole field */
export const NOTIFICATION_TARGET_ROLES = [
  'All',
  'Taskflow Admin',
  'Project Manager',
  'Developer',
  'QA',
];

// ─── Protected Account ────────────────────────────────────────────────────────

/** Email address of the primary Taskflow Admin account — protected from deletion/demotion */
export const PRIMARY_ADMIN_EMAIL = 'vijayaraghavan130699@gmail.com';

// ─── ID Prefixes ─────────────────────────────────────────────────────────────

export const USER_ID_PREFIX = 'TF';
export const ROLE_ID_PREFIX = 'RL';
export const NOTIFICATION_ID_PREFIX = 'NT';
export const PROJECT_ID_PREFIX = 'PRJ';
export const COMMENT_ID_PREFIX = 'CMT';
export const ATTACHMENT_ID_PREFIX = 'ATT';
export const ACTIVITY_ID_PREFIX = 'ACT';

// ─── Project / Task Domain ────────────────────────────────────────────────────

/** Valid project lifecycle statuses */
export const PROJECT_STATUSES = ['active', 'archived'];

/** Default status assigned to newly created projects */
export const PROJECT_DEFAULT_STATUS = 'active';

/** Valid task workflow statuses, in board column order */
export const TASK_STATUSES = ['Todo', 'In Progress', 'In Review', 'Done'];

/** Default status assigned to newly created tasks */
export const TASK_DEFAULT_STATUS = 'Todo';

/** Valid task/issue types */
export const TASK_TYPES = ['Task', 'Story', 'Bug'];

/** Default task type */
export const TASK_DEFAULT_TYPE = 'Task';

/** Valid task priority levels, lowest to highest */
export const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

/** Default task priority */
export const TASK_DEFAULT_PRIORITY = 'Medium';

/**
 * Maximum accepted attachment size in bytes (4 MB) — attachments are stored inline in
 * MongoDB, and kept under Vercel's ~4.5 MB serverless request body limit with headroom
 * for multipart overhead.
 */
export const MAX_ATTACHMENT_SIZE_BYTES = 4 * 1024 * 1024;

// ─── Dashboard / Chart ───────────────────────────────────────────────────────

/** Color palette for role distribution charts on the dashboard */
export const ROLE_PALETTE = {
  'Taskflow Admin': '#6366f1',
  'Project Manager': '#3b82f6',
  Developer: '#10b981',
  QA: '#f59e0b',
  Custom: '#8b5cf6',
};

/** Abbreviated month names for registration trend charts */
export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

// ─── CSV Export Headers ───────────────────────────────────────────────────────

/** Column headers for the Users CSV export */
export const USERS_CSV_EXPORT_HEADERS = [
  'User ID',
  'First Name',
  'Last Name',
  'Full Name',
  'Email',
  'Role',
  'Status',
  'Joined Date',
];

/** Column headers for the Roles CSV export */
export const ROLES_CSV_EXPORT_HEADERS = [
  'Role ID',
  'Role Name',
  'Description',
  'Role Type',
  'Permissions Count',
  'Granted Permissions',
  'Status',
  'System Protected',
  'Created Date',
];
