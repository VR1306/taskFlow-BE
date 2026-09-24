import Task from './tasks.model.js';

describe('Task Model', () => {
  it('instantiates task model with schema defaults', () => {
    const task = new Task({
      projectId: '650c00000000000000000001',
      title: 'Fix login bug',
    });

    expect(task.title).toBe('Fix login bug');
    expect(task.type).toBe('Task');
    expect(task.status).toBe('Todo');
    expect(task.priority).toBe('Medium');
    expect(task.order).toBe(0);
    expect(task.isDeleted).toBe(false);
    expect(task.labels).toEqual([]);
  });

  it('rejects an invalid status via schema validation', () => {
    const task = new Task({
      projectId: '650c00000000000000000001',
      title: 'Invalid status task',
      status: 'Blocked',
    });

    const validationError = task.validateSync();
    expect(validationError?.errors?.status).toBeDefined();
  });
});
