import { jest } from '@jest/globals';
import Comment, { getNextCommentId } from './comments.model.js';

describe('Comment Model', () => {
  it('should generate sequential commentId', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ commentId: 'CMT0007' }),
          }),
        }),
      }),
    };

    const nextId = await getNextCommentId(mockModel);
    expect(nextId).toBe('CMT0008');
  });

  it('should return CMT0001 if no prior comment exists', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    const nextId = await getNextCommentId(mockModel);
    expect(nextId).toBe('CMT0001');
  });

  it('should return CMT0001 on error', async () => {
    const mockModel = {
      findOne: jest.fn().mockImplementation(() => {
        throw new Error('DB Error');
      }),
    };

    const nextId = await getNextCommentId(mockModel);
    expect(nextId).toBe('CMT0001');
  });

  it('instantiates comment model with schema defaults', () => {
    const comment = new Comment({
      taskId: '650c00000000000000000001',
      authorId: '650c00000000000000000002',
      body: 'Looks good to me.',
    });

    expect(comment.body).toBe('Looks good to me.');
    expect(comment.isDeleted).toBe(false);
  });
});
