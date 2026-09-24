import 'dotenv/config';
import mongoose from 'mongoose';
import GetAllUsers from '../models/users/users.model.js';
import Project from '../models/projects/projects.model.js';
import Task from '../models/tasks/tasks.model.js';
import Comment from '../models/comments/comments.model.js';
import { seedSuperAdmin } from '../helpers/seedAdmin.js';
import { seedDefaultRoles } from '../helpers/seedRoles.js';

// Additional demo accounts layered on top of whichever Taskflow Admin / Project
// Manager / Developer accounts already exist in this database.
const EXTRA_USERS = [
  {
    userId: 'TF0004',
    firstName: 'Priya',
    lastName: 'Nair',
    email: 'priya.qa@taskflow.com',
    password: 'TestUser@123',
    role: 'QA',
  },
  {
    userId: 'TF0005',
    firstName: 'Marcus',
    lastName: 'Chen',
    email: 'marcus.dev@taskflow.com',
    password: 'TestUser@123',
    role: 'Developer',
  },
  {
    userId: 'TF0006',
    firstName: 'Sofia',
    lastName: 'Alvarez',
    email: 'sofia.pm@taskflow.com',
    password: 'TestUser@123',
    role: 'Project Manager',
  },
];

async function ensureUser(userData) {
  let user = await GetAllUsers.findOne({ email: userData.email });
  if (!user) {
    user = await GetAllUsers.create({ ...userData, isActive: true, isDeleted: false });
    console.log(`Created user ${userData.email} (${userData.role})`);
  }
  return user;
}

async function ensureProject({ name, key, description, leadId, memberIds }) {
  let project = await Project.findOne({ name });
  if (!project) {
    project = await Project.create({
      name,
      key,
      description,
      leadId,
      members: memberIds,
      status: 'active',
      isDeleted: false,
    });
    console.log(`Created project ${project.name} (${project.key})`);
  }
  return project;
}

async function ensureTask(project, order, taskData) {
  let task = await Task.findOne({ projectId: project._id, title: taskData.title });
  if (!task) {
    project.taskSequence += 1;
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
    console.log(`  Created task ${task.taskKey}: ${task.title} [${task.status}]`);
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

  // Ensure the base accounts and default roles exist first
  await seedSuperAdmin();
  await seedDefaultRoles();
  for (const userData of EXTRA_USERS) {
    await ensureUser(userData);
  }

  // Resolved by actual role rather than assumed seed emails, since this database
  // already had real pre-existing accounts under different emails than the
  // original SEED_USERS placeholders (e.g. no "admin@taskflow.com" ever existed here).
  const admin = await GetAllUsers.findOne({ role: 'Taskflow Admin', isDeleted: { $ne: true } });
  const [pm1, pm2] = await GetAllUsers.find({
    role: 'Project Manager',
    isDeleted: { $ne: true },
  }).sort({ createdAt: 1 });
  const [dev1, dev2] = await GetAllUsers.find({
    role: 'Developer',
    isDeleted: { $ne: true },
  }).sort({ createdAt: 1 });
  const qa1 = await GetAllUsers.findOne({ role: 'QA', isDeleted: { $ne: true } });

  if (!admin || !pm1 || !dev1 || !qa1) {
    throw new Error(
      'Missing a required seed account (Taskflow Admin / Project Manager / Developer / QA). Run this script again after seedSuperAdmin/seedDefaultRoles have completed.'
    );
  }

  // Fall back to the first account of that role if a second one isn't available
  const secondPm = pm2 || pm1;
  const secondDev = dev2 || dev1;

  // ── Project 1: Engineering Platform ──────────────────────────────────────
  const eng = await ensureProject({
    name: 'Engineering Platform',
    key: 'ENG',
    description: 'Core backend services and API platform for TaskFlow.',
    leadId: pm1._id,
    memberIds: [admin._id, pm1._id, dev1._id, secondDev._id, qa1._id],
  });

  const engTasks = [
    { title: 'Set up CI/CD pipeline', type: 'Task', status: 'Done', priority: 'High', assigneeId: dev1._id, labels: ['infra'] },
    { title: 'Design database schema for billing', type: 'Story', status: 'Done', priority: 'Medium', assigneeId: secondDev._id, labels: ['backend'] },
    { title: 'Fix memory leak in worker process', type: 'Bug', status: 'In Review', priority: 'Urgent', assigneeId: dev1._id, labels: ['bug', 'production'], dueDate: daysFromNow(1) },
    { title: 'Implement rate limiting middleware', type: 'Task', status: 'In Progress', priority: 'High', assigneeId: secondDev._id, labels: ['backend'] },
    { title: 'Write integration tests for auth flow', type: 'Task', status: 'In Progress', priority: 'Medium', assigneeId: qa1._id, labels: ['testing'] },
    { title: 'Investigate flaky test suite', type: 'Bug', status: 'Todo', priority: 'Medium', assigneeId: qa1._id, labels: ['testing'], dueDate: daysFromNow(5) },
    { title: 'Add pagination to search endpoint', type: 'Task', status: 'Todo', priority: 'Low', assigneeId: null, labels: [] },
    { title: 'Upgrade Node.js runtime to v22', type: 'Task', status: 'Todo', priority: 'Low', assigneeId: dev1._id, labels: ['infra'], dueDate: daysFromNow(-2) },
  ];

  // ── Project 2: Mobile App Revamp ─────────────────────────────────────────
  const mob = await ensureProject({
    name: 'Mobile App Revamp',
    key: 'MOB',
    description: 'Redesign and rebuild the TaskFlow mobile experience.',
    leadId: secondPm._id,
    memberIds: [secondPm._id, secondDev._id, qa1._id, admin._id],
  });

  const mobTasks = [
    { title: 'Wireframe onboarding flow', type: 'Story', status: 'Done', priority: 'High', assigneeId: secondPm._id, labels: ['design'] },
    { title: 'Build push notification service', type: 'Task', status: 'In Progress', priority: 'High', assigneeId: secondDev._id, labels: ['mobile'] },
    { title: 'Crash on iOS 18 launch screen', type: 'Bug', status: 'In Review', priority: 'Urgent', assigneeId: secondDev._id, labels: ['bug', 'ios'], dueDate: daysFromNow(2) },
    { title: 'QA pass on Android release candidate', type: 'Task', status: 'Todo', priority: 'Medium', assigneeId: qa1._id, labels: ['testing', 'android'] },
    { title: 'Add dark mode support', type: 'Story', status: 'Todo', priority: 'Low', assigneeId: null, labels: ['design'] },
  ];

  // ── Project 3: Marketing Website ─────────────────────────────────────────
  const web = await ensureProject({
    name: 'Marketing Website',
    key: 'WEB',
    description: 'Public-facing marketing site and landing pages.',
    leadId: admin._id,
    memberIds: [admin._id, pm1._id, dev1._id],
  });

  const webTasks = [
    { title: 'Launch new pricing page', type: 'Story', status: 'Done', priority: 'Medium', assigneeId: dev1._id, labels: ['web'] },
    { title: 'Fix broken links in footer', type: 'Bug', status: 'Done', priority: 'Low', assigneeId: dev1._id, labels: ['bug'] },
    { title: 'SEO audit for blog section', type: 'Task', status: 'In Progress', priority: 'Medium', assigneeId: pm1._id, labels: ['seo'] },
    { title: 'A/B test signup CTA', type: 'Task', status: 'Todo', priority: 'High', assigneeId: null, labels: ['growth'], dueDate: daysFromNow(7) },
  ];

  for (const [project, tasks] of [
    [eng, engTasks],
    [mob, mobTasks],
    [web, webTasks],
  ]) {
    let order = 0;
    for (const taskData of tasks) {
      await ensureTask(project, order, taskData);
      order += 1;
    }
  }

  // A couple of comments to demo the Comments tab out of the box
  const sampleTask = await Task.findOne({ projectId: eng._id, title: 'Fix memory leak in worker process' });
  if (sampleTask) {
    await ensureComment(
      sampleTask,
      dev1._id,
      "Reproduced locally — looks like the connection pool isn't releasing sockets under load."
    );
    await ensureComment(sampleTask, qa1._id, 'Confirmed on staging too. This is blocking the next release.');
  }

  console.log('\nTest data seeding completed.');
  console.log('Accounts used for this data (existing passwords unchanged for pre-existing accounts):');
  console.log(`  Taskflow Admin   ${admin.email}`);
  console.log(`  Project Manager  ${pm1.email}`);
  console.log(`  Developer        ${dev1.email}`);
  console.log(`  QA               ${qa1.email} / TestUser@123`);
  if (secondDev !== dev1) console.log(`  Developer        ${secondDev.email} / TestUser@123`);
  if (secondPm !== pm1) console.log(`  Project Manager  ${secondPm.email} / TestUser@123`);
}

try {
  await run();
  process.exit(0);
} catch (error) {
  console.error('Seeding failed:', error);
  process.exit(1);
}
