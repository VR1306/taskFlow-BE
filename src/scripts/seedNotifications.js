import 'dotenv/config';
import mongoose from 'mongoose';
import GetAllUsers from '../models/users/users.model.js';
import Project from '../models/projects/projects.model.js';
import Task from '../models/tasks/tasks.model.js';
import Notification from '../models/notifications/notifications.model.js';
import { createNotification, notifyUsers } from '../helpers/notification.helper.js';

/**
 * Wipes every notification and re-seeds a realistic spread of app-generated events
 * (project + task + user lifecycle) against whichever real users/projects/tasks
 * already exist in this database, for exercising the notifications feature end to end.
 * Run with `npm run seed:notifications` after `npm run seed:testdata` has populated
 * projects/tasks, or it will fall back to whatever accounts/projects it can find.
 */
async function run() {
  await mongoose.connect(process.env.MONGO_DB_URL, { dbName: 'taskflow' });

  const { deletedCount } = await Notification.deleteMany({});
  console.log(`Cleared ${deletedCount} existing notification(s).`);

  const admin = await GetAllUsers.findOne({ role: 'Taskflow Admin', isDeleted: { $ne: true } });
  const users = await GetAllUsers.find({ isDeleted: { $ne: true } }).sort({ createdAt: 1 });
  const pm = users.find((u) => u.role === 'Project Manager') || admin;
  const dev1 = users.find((u) => u.role === 'Developer') || admin;
  const dev2 = users.filter((u) => u.role === 'Developer')[1] || dev1;
  const qa = users.find((u) => u.role === 'QA') || dev1;

  if (!admin || !pm || !dev1) {
    throw new Error(
      'Need at least a Taskflow Admin, Project Manager, and Developer account to seed realistic notifications. Run `npm run seed:testdata` first.'
    );
  }

  const projects = await Project.find({ isDeleted: { $ne: true } }).sort({ createdAt: 1 });
  const primaryProject = projects[0];
  const secondaryProject = projects[1] || primaryProject;

  if (!primaryProject) {
    throw new Error(
      'Need at least one project to seed project/task notifications. Run `npm run seed:testdata` first.'
    );
  }

  const tasksInProject = await Task.find({
    projectId: primaryProject._id,
    isDeleted: { $ne: true },
  }).sort({ createdAt: 1 });
  const taskForAssignment = tasksInProject[0];
  const taskForCompletion = tasksInProject.find((t) => t.status === 'Done') || tasksInProject[1];
  const taskForComment = tasksInProject[2] || taskForAssignment;

  let created = 0;
  const track = (result) => {
    if (Array.isArray(result)) {
      created += result.filter(Boolean).length;
    } else if (result) {
      created += 1;
    }
  };

  // ── Project lifecycle ──────────────────────────────────────────────────────
  track(
    await createNotification({
      actor: pm,
      type: 'project_created',
      title: 'Project Created',
      message: `Project "${primaryProject.name}" (${primaryProject.key}) was created and assigned to: ${dev1.firstName} ${dev1.lastName}, ${pm.firstName} ${pm.lastName}.`,
      targetRole: 'All',
      metadata: { projectId: primaryProject._id, projectKey: primaryProject.key },
    })
  );

  track(
    await createNotification({
      actor: pm,
      type: 'project_updated',
      title: 'Project Updated',
      message: `Project "${secondaryProject.name}" details have been updated.`,
      targetRole: 'All',
      metadata: { projectId: secondaryProject._id, projectKey: secondaryProject.key },
    })
  );

  track(
    await notifyUsers({
      recipientIds: [dev2._id],
      actor: pm,
      type: 'project_member_added',
      title: 'Added to Project',
      message: `You were added to project "${primaryProject.name}" (${primaryProject.key}).`,
      metadata: { projectId: primaryProject._id, projectKey: primaryProject.key },
    })
  );

  track(
    await notifyUsers({
      recipientIds: [qa._id],
      actor: pm,
      type: 'project_member_removed',
      title: 'Removed from Project',
      message: `You were removed from project "${secondaryProject.name}" (${secondaryProject.key}).`,
      metadata: { projectId: secondaryProject._id, projectKey: secondaryProject.key },
    })
  );

  track(
    await notifyUsers({
      recipientIds: [dev1._id, qa._id],
      actor: admin,
      type: 'project_deleted',
      title: 'Project Deleted',
      message: `Project "Archived Sandbox" (ARC) was deleted.`,
      metadata: { projectKey: 'ARC' },
    })
  );

  // ── Task lifecycle ───────────────────────────────────────────────────────
  if (taskForAssignment) {
    track(
      await createNotification({
        actor: pm,
        type: 'task_assigned',
        title: 'Task Assigned',
        message: `You were assigned to ${taskForAssignment.taskKey}: ${taskForAssignment.title}`,
        targetRole: 'All',
        recipientId: dev1._id,
        metadata: {
          taskId: taskForAssignment._id,
          taskKey: taskForAssignment.taskKey,
          projectId: primaryProject._id,
        },
      })
    );

    track(
      await createNotification({
        actor: pm,
        type: 'task_unassigned',
        title: 'Task Unassigned',
        message: `You were unassigned from ${taskForAssignment.taskKey}: ${taskForAssignment.title}`,
        recipientId: dev2._id,
        metadata: {
          taskId: taskForAssignment._id,
          taskKey: taskForAssignment.taskKey,
          projectId: primaryProject._id,
        },
      })
    );
  }

  if (taskForCompletion) {
    track(
      await createNotification({
        actor: dev1,
        type: 'task_completed',
        title: 'Task Completed',
        message: `${taskForCompletion.taskKey}: ${taskForCompletion.title} was marked Done.`,
        targetRole: 'All',
        recipientId: pm._id,
        metadata: {
          taskId: taskForCompletion._id,
          taskKey: taskForCompletion.taskKey,
          projectId: primaryProject._id,
        },
      })
    );
  }

  if (taskForComment) {
    track(
      await notifyUsers({
        recipientIds: [dev1._id, qa._id],
        actor: pm,
        type: 'task_comment',
        title: 'New Comment',
        message: `New comment on ${taskForComment.taskKey}: ${taskForComment.title}`,
        metadata: {
          taskId: taskForComment._id,
          taskKey: taskForComment.taskKey,
          projectId: primaryProject._id,
        },
      })
    );

    track(
      await notifyUsers({
        recipientIds: [dev1._id, pm._id],
        actor: admin,
        type: 'task_deleted',
        title: 'Task Deleted',
        message: `${taskForComment.taskKey}: ${taskForComment.title} was deleted.`,
        metadata: { taskKey: taskForComment.taskKey, projectId: primaryProject._id },
      })
    );
  }

  // ── User lifecycle ───────────────────────────────────────────────────────
  track(
    await createNotification({
      actor: admin,
      type: 'user_created',
      title: 'New User Registered',
      message: `${dev2.firstName} ${dev2.lastName} (${dev2.role}) was added by ${admin.firstName} ${admin.lastName}.`,
      targetRole: 'All',
      recipientId: dev2._id,
      metadata: { userId: dev2.userId, email: dev2.email, role: dev2.role },
    })
  );

  track(
    await createNotification({
      actor: admin,
      type: 'user_updated',
      title: 'User Profile Updated',
      message: `${qa.firstName} ${qa.lastName}'s account was updated by ${admin.firstName} ${admin.lastName}.`,
      targetRole: 'All',
      recipientId: qa._id,
      metadata: { userId: qa.userId, email: qa.email },
    })
  );

  track(
    await createNotification({
      actor: admin,
      type: 'user_deleted',
      title: 'User Deactivated',
      message: `Alex Former was removed from the workspace.`,
      targetRole: 'Project Manager',
      metadata: { email: 'alex.former@taskflow.com' },
    })
  );

  console.log(`Created ${created} fresh test notification(s).`);
}

try {
  await run();
  process.exit(0);
} catch (error) {
  console.error('Seeding notifications failed:', error);
  process.exit(1);
}
