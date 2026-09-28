import 'dotenv/config';
import mongoose from 'mongoose';
import GetAllUsers from '../models/users/users.model.js';
import Project from '../models/projects/projects.model.js';
import Task from '../models/tasks/tasks.model.js';
import Comment from '../models/comments/comments.model.js';
import { seedSuperAdmin } from '../helpers/seedAdmin.js';
import { seedDefaultRoles } from '../helpers/seedRoles.js';

// Demo credentials in exact seed order requested:
// 1. Taskflow Admin
// 2. Project Manager
// 3. QA
// 4. Developer
const DEMO_ACCOUNTS = [
  // ── 1. Taskflow Admin ─────────────────────────────────────────────────────
  {
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@taskflow.com',
    password: 'TestUser@123',
    role: 'Taskflow Admin',
  },
  // ── 2. Project Manager ───────────────────────────────────────────────────
  {
    firstName: 'Sofia',
    lastName: 'Alvarez',
    email: 'sofia.pm@taskflow.com',
    password: 'TestUser@123',
    role: 'Project Manager',
  },
  {
    firstName: 'Project',
    lastName: 'Manager',
    email: 'pm@taskflow.com',
    password: 'TestUser@123',
    role: 'Project Manager',
  },
  // ── 3. QA ────────────────────────────────────────────────────────────────
  {
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'priya.qa@taskflow.com',
    password: 'TestUser@123',
    role: 'QA',
  },
  {
    firstName: 'Quality',
    lastName: 'Assurance',
    email: 'qa@taskflow.com',
    password: 'TestUser@123',
    role: 'QA',
  },
  // ── 4. Developer ─────────────────────────────────────────────────────────
  {
    firstName: 'Marcus',
    lastName: 'Chen',
    email: 'marcus.dev@taskflow.com',
    password: 'TestUser@123',
    role: 'Developer',
  },
  {
    firstName: 'Lead',
    lastName: 'Developer',
    email: 'dev@taskflow.com',
    password: 'TestUser@123',
    role: 'Developer',
  },
];

const cleanLog = (val) => String(val ?? '').replace(/[\r\n]/g, '');

async function ensureUser(userData) {
  let user = await GetAllUsers.findOne({ email: userData.email });
  if (!user) {
    user = await GetAllUsers.create({
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      password: userData.password,
      role: userData.role,
      isActive: true,
      isDeleted: false,
    });
    console.log(`Created user ${cleanLog(userData.email)} (${cleanLog(userData.role)}) [ID: ${cleanLog(user.userId)}]`);
  } else {
    let modified = false;
    if (userData.password && userData.email !== 'vijayaraghavan130699@gmail.com') {
      const isMatch = await user.comparePassword(userData.password);
      if (!isMatch) {
        user.password = userData.password;
        modified = true;
      }
    }
    if (user.role !== userData.role) {
      user.role = userData.role;
      modified = true;
    }
    if (user.isActive !== true || user.isDeleted !== false) {
      user.isActive = true;
      user.isDeleted = false;
      modified = true;
    }
    if (modified) {
      await user.save();
      console.log(`Updated user ${cleanLog(userData.email)} (${cleanLog(userData.role)})`);
    }
  }
  return user;
}

async function ensureProject({ name, key, description, leadId, memberIds, createdBy }) {
  let project = await Project.findOne({ name });
  const uniqueMembers = Array.from(new Set(memberIds.filter(Boolean).map(String)));

  if (!project) {
    project = await Project.create({
      name,
      key,
      description,
      leadId,
      createdBy,
      members: uniqueMembers,
      status: 'active',
      isDeleted: false,
    });
    console.log(`Created project ${cleanLog(project.name)} (${cleanLog(project.key)})`);
  } else {
    project.leadId = leadId || project.leadId;
    project.createdBy = createdBy || project.createdBy;
    project.members = Array.from(
      new Set([...(project.members || []).map(String), ...uniqueMembers])
    );
    project.status = 'active';
    project.isDeleted = false;
    await project.save();
    console.log(`Updated project ${cleanLog(project.name)} (${cleanLog(project.key)}) with assigned members.`);
  }
  return project;
}

async function ensureTask(project, order, taskData) {
  let task = await Task.findOne({ projectId: project._id, title: taskData.title });
  if (!task) {
    project.taskSequence = (project.taskSequence || 0) + 1;
    await project.save();
    task = await Task.create({
      taskKey: `${project.key}-${project.taskSequence}`,
      projectId: project._id,
      title: taskData.title,
      description: taskData.description || '',
      type: taskData.type,
      status: taskData.status,
      priority: taskData.priority,
      assigneeId: taskData.assigneeId || null,
      reporterId: taskData.reporterId || project.leadId,
      labels: taskData.labels || [],
      dueDate: taskData.dueDate || null,
      order,
      isDeleted: false,
    });
    console.log(`  Created task ${cleanLog(task.taskKey)}: ${cleanLog(task.title)} [${cleanLog(task.status)}]`);
  }
  return task;
}

async function ensureComment(task, authorId, body) {
  const existing = await Comment.findOne({ taskId: task._id, body });
  if (!existing) {
    await Comment.create({ taskId: task._id, authorId, body, isDeleted: false });
  }
}

const daysFromNow = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function run() {
  await mongoose.connect(process.env.MONGO_DB_URL, { dbName: 'taskflow' });

  // 1. Ensure default permissions & roles exist
  await seedSuperAdmin();
  await seedDefaultRoles();

  // 2. Ensure all demo accounts exist with active status
  const seededUsers = {};
  for (const account of DEMO_ACCOUNTS) {
    const user = await ensureUser(account);
    seededUsers[account.email] = user;
  }

  // Also resolve primary admin if present
  const primaryAdmin = await GetAllUsers.findOne({
    email: 'vijayaraghavan130699@gmail.com',
    isDeleted: { $ne: true },
  });

  const admin = seededUsers['admin@taskflow.com'] || primaryAdmin;
  const pmSofia = seededUsers['sofia.pm@taskflow.com'];
  const pmAlias = seededUsers['pm@taskflow.com'];
  const qaPriya = seededUsers['priya.qa@taskflow.com'];
  const qaAlias = seededUsers['qa@taskflow.com'];
  const devMarcus = seededUsers['marcus.dev@taskflow.com'];
  const devAlias = seededUsers['dev@taskflow.com'];

  const allResourceIds = [
    admin?._id,
    primaryAdmin?._id,
    pmSofia?._id,
    pmAlias?._id,
    qaPriya?._id,
    qaAlias?._id,
    devMarcus?._id,
    devAlias?._id,
  ].filter(Boolean);

  // ── Showcase Project: TaskFlow Showcase Workspace ────────────────────────
  const showcaseProject = await ensureProject({
    name: 'TaskFlow Showcase Workspace',
    key: 'TF03',
    description:
      'Live demonstration workspace showcasing cross-functional agile workflows, sprint boards, and RBAC permissions across Admin, PM, QA, and Developer roles.',
    leadId: pmSofia._id,
    createdBy: admin._id,
    memberIds: allResourceIds,
  });

  const showcaseTasks = [
    // ── Planned Backlog Column (Unstarted) ──────────────────────────────────
    {
      title: 'Automated End-to-End Test Suite for Mobile & Desktop',
      description:
        'Implement Playwright regression tests covering tab transitions, drawer opening, and task creation across viewports.',
      type: 'Task',
      status: 'Todo',
      priority: 'High',
      assigneeId: qaPriya._id,
      labels: ['testing', 'automation'],
      dueDate: daysFromNow(4),
    },
    {
      title: 'Stripe Webhook Integration for Subscription Billing',
      description:
        'Handle checkout.session.completed and customer.subscription.updated events to provision workspace tiers.',
      type: 'Story',
      status: 'Todo',
      priority: 'Medium',
      assigneeId: devMarcus._id,
      labels: ['billing', 'backend'],
      dueDate: daysFromNow(7),
    },
    {
      title: 'Security Audit: Role Permission Escalation Matrix',
      description:
        'Verify that QA and Developer roles cannot perform unauthorized user deletion or project management actions.',
      type: 'Task',
      status: 'Todo',
      priority: 'Urgent',
      assigneeId: pmSofia._id,
      labels: ['security', 'compliance'],
      dueDate: daysFromNow(2),
    },
    // ── In Progress ────────────────────────────────────────────────────────
    {
      title: 'Smooth Tab Slide Transitions & Touch Gestures',
      description:
        'Implement bidirectional sliding animations and touch swipe support for project navigation tabs.',
      type: 'Story',
      status: 'In Progress',
      priority: 'High',
      assigneeId: devMarcus._id,
      labels: ['frontend', 'ui/ux'],
      dueDate: daysFromNow(1),
    },
    {
      title: 'Cross-Browser Regression Testing on 320px Viewports',
      description:
        'Validate layout boundaries and ensure zero horizontal overflow on small mobile displays.',
      type: 'Task',
      status: 'In Progress',
      priority: 'Medium',
      assigneeId: qaPriya._id,
      labels: ['qa', 'responsive'],
      dueDate: daysFromNow(2),
    },
    // ── In Review ──────────────────────────────────────────────────────────
    {
      title: 'Real-Time Notification Bell & WebSocket Dispatcher',
      description:
        'Broadcast task assignments, project mentions, and status updates via instant toast and drawer notifications.',
      type: 'Story',
      status: 'In Review',
      priority: 'High',
      assigneeId: devMarcus._id,
      labels: ['realtime', 'frontend'],
      dueDate: daysFromNow(1),
    },
    {
      title: 'Session Token Refresh Race Condition Fix',
      description:
        'Synchronize token refreshing across concurrent API calls to prevent intermittent 401 unauthorized errors.',
      type: 'Bug',
      status: 'In Review',
      priority: 'Urgent',
      assigneeId: qaPriya._id,
      labels: ['auth', 'security'],
      dueDate: daysFromNow(1),
    },
    // ── Done ───────────────────────────────────────────────────────────────
    {
      title: 'Implement Granular RBAC Permissions Architecture',
      description:
        'Designed system permission catalogue with module-level capabilities and hierarchical role inheritance.',
      type: 'Task',
      status: 'Done',
      priority: 'High',
      assigneeId: pmSofia._id,
      labels: ['architecture', 'rbac'],
    },
    {
      title: 'Interactive Kanban Board Drag-and-Drop Workflow',
      description:
        'Built dynamic Kanban columns with HTML5 drag-and-drop, state preservation, and quick task preview drawers.',
      type: 'Story',
      status: 'Done',
      priority: 'High',
      assigneeId: devMarcus._id,
      labels: ['kanban', 'frontend'],
    },
    {
      title: 'Responsive Drawer Navigation for Small Mobile Devices',
      description:
        'Refactored project filter, task detail, and create drawers with full responsive viewport adaptation.',
      type: 'Bug',
      status: 'Done',
      priority: 'Medium',
      assigneeId: qaPriya._id,
      labels: ['bug', 'mobile'],
    },
  ];

  let order = 0;
  for (const taskData of showcaseTasks) {
    await ensureTask(showcaseProject, order, taskData);
    order += 1;
  }

  // Sample collaboration comments on the In Progress & In Review tasks
  const tabSlideTask = await Task.findOne({
    projectId: showcaseProject._id,
    title: 'Smooth Tab Slide Transitions & Touch Gestures',
  });
  if (tabSlideTask) {
    await ensureComment(
      tabSlideTask,
      devMarcus._id,
      'Implemented CSS hardware-accelerated transforms for directional tab sliding. Testing smoothly across Safari and Chrome.'
    );
    await ensureComment(
      tabSlideTask,
      qaPriya._id,
      'Verified on 320px viewport emulation: slide animations are fluid and touch targets remain fully accessible!'
    );
  }

  const notificationTask = await Task.findOne({
    projectId: showcaseProject._id,
    title: 'Real-Time Notification Bell & WebSocket Dispatcher',
  });
  if (notificationTask) {
    await ensureComment(
      notificationTask,
      pmSofia._id,
      'Great work on notifications! Please confirm unread badges increment dynamically when a task is reassigned.'
    );
    await ensureComment(
      notificationTask,
      devMarcus._id,
      'Confirmed: unread count badges increment in real time with audio alert toggle in settings.'
    );
  }

  // Also ensure existing demo projects have createdBy & members populated
  await ensureProject({
    name: 'Engineering Platform',
    key: 'ENG',
    description: 'Core backend services and API platform for TaskFlow.',
    leadId: pmSofia._id,
    createdBy: admin._id,
    memberIds: allResourceIds,
  });

  console.log('\n=============================================================');
  console.log('🎉 TASKFLOW TEST CREDENTIALS & SHOWCASE PROJECT READY!');
  console.log('=============================================================');
  console.log('Project: TaskFlow Showcase Workspace (Key: TF03)');
  console.log('Assigned Resources: Taskflow Admin, Project Manager, QA, Developer\n');
  console.log('Credentials by Seed Order:\n');
  console.log('1. Taskflow Admin');
  console.log('   Email:    admin@taskflow.com');
  console.log('   Password: TestUser@123');
  if (primaryAdmin) {
    console.log(`   (Primary Admin: ${primaryAdmin.email} / Vij@y13061999!)`);
  }
  console.log('\n2. Project Manager');
  console.log('   Email:    pm@taskflow.com (or sofia.pm@taskflow.com)');
  console.log('   Password: TestUser@123');
  console.log('\n3. QA');
  console.log('   Email:    qa@taskflow.com (or priya.qa@taskflow.com)');
  console.log('   Password: TestUser@123');
  console.log('\n4. Developer');
  console.log('   Email:    dev@taskflow.com (or marcus.dev@taskflow.com)');
  console.log('   Password: TestUser@123');
  console.log('=============================================================\n');
}

try {
  await run();
  process.exit(0);
} catch (error) {
  console.error('Seeding failed:', error);
  process.exit(1);
}
