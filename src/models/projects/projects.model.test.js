import { jest } from '@jest/globals';
import Project, { getNextProjectId } from './projects.model.js';

describe('Project Model', () => {
  it('should generate sequential projectId', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ projectId: 'PRJ0004' }),
          }),
        }),
      }),
    };

    const nextId = await getNextProjectId(mockModel);
    expect(nextId).toBe('PRJ0005');
  });

  it('should return PRJ0001 if no prior project exists', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    const nextId = await getNextProjectId(mockModel);
    expect(nextId).toBe('PRJ0001');
  });

  it('should return PRJ0001 on error', async () => {
    const mockModel = {
      findOne: jest.fn().mockImplementation(() => {
        throw new Error('DB Error');
      }),
    };

    const nextId = await getNextProjectId(mockModel);
    expect(nextId).toBe('PRJ0001');
  });

  it('instantiates project model with schema defaults', () => {
    const project = new Project({
      key: 'ENG',
      name: 'Engineering',
    });

    expect(project.name).toBe('Engineering');
    expect(project.key).toBe('ENG');
    expect(project.status).toBe('active');
    expect(project.taskSequence).toBe(0);
    expect(project.isDeleted).toBe(false);
    expect(project.members).toEqual([]);
  });
});
