import { jest } from '@jest/globals';
import {
  getTaskAttachments,
  uploadTaskAttachment,
  downloadTaskAttachment,
  deleteTaskAttachment,
} from './attachments.controller.js';
import Attachment from '../../models/attachments/attachments.model.js';
import Task from '../../models/tasks/tasks.model.js';

const taskId = '650c00000000000000000001';

const mockFindActiveTask = (task) => {
  jest.spyOn(Task, 'findOne').mockReturnValue({
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(task),
  });
};

describe('Attachments Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      params: {},
      body: {},
      file: null,
      user: { _id: 'user-1', firstName: 'Jane', lastName: 'Doe', permissions: [] },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn(),
    };
  });

  describe('getTaskAttachments', () => {
    it('returns 404 when task is not found', async () => {
      mockFindActiveTask(null);
      mockReq.params = { id: 'missing' };
      await getTaskAttachments(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns attachment metadata without binary data', async () => {
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Attachment, 'find').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([{ _id: 'a1', filename: 'diagram.png' }]),
      });

      mockReq.params = { id: 'ENG-1' };
      await getTaskAttachments(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.data).toHaveLength(1);
    });
  });

  describe('uploadTaskAttachment', () => {
    it('returns 404 when task is not found', async () => {
      mockFindActiveTask(null);
      mockReq.params = { id: 'missing' };
      await uploadTaskAttachment(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('returns 400 when no file is provided', async () => {
      mockFindActiveTask({ _id: taskId });
      mockReq.params = { id: 'ENG-1' };
      mockReq.file = null;
      await uploadTaskAttachment(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('stores the uploaded file buffer and returns sanitized metadata', async () => {
      mockFindActiveTask({ _id: taskId, taskKey: 'ENG-1' });
      const createSpy = jest.spyOn(Attachment, 'create').mockResolvedValue({
        _id: 'a1',
        filename: 'diagram.png',
      });
      jest.spyOn(Attachment, 'findById').mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue({ _id: 'a1', filename: 'diagram.png' }),
      });

      mockReq.params = { id: 'ENG-1' };
      mockReq.file = {
        originalname: 'diagram.png',
        mimetype: 'image/png',
        size: 2048,
        buffer: Buffer.from('fake'),
      };

      await uploadTaskAttachment(mockReq, mockRes);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({ filename: 'diagram.png', mimetype: 'image/png', size: 2048 })
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      const payload = mockRes.json.mock.calls[0][0];
      expect(payload.data.data).toBeUndefined();
    });
  });

  describe('downloadTaskAttachment', () => {
    it('returns 404 when attachment is not found', async () => {
      mockFindActiveTask({ _id: taskId });
      jest
        .spyOn(Attachment, 'findOne')
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

      mockReq.params = { id: 'ENG-1', attachmentId: 'missing' };
      await downloadTaskAttachment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('streams the attachment content with correct headers', async () => {
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Attachment, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          filename: 'diagram.png',
          mimetype: 'image/png',
          data: Buffer.from('fake'),
        }),
      });

      mockReq.params = { id: 'ENG-1', attachmentId: 'a1' };
      await downloadTaskAttachment(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'image/png');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.send).toHaveBeenCalled();
    });
  });

  describe('deleteTaskAttachment', () => {
    it('returns 404 when attachment is not found', async () => {
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Attachment, 'findOne').mockResolvedValue(null);

      mockReq.params = { id: 'ENG-1', attachmentId: 'missing' };
      await deleteTaskAttachment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('forbids deleting another user’s attachment without tasks.edit permission', async () => {
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Attachment, 'findOne').mockResolvedValue({ uploaderId: 'someone-else' });

      mockReq.params = { id: 'ENG-1', attachmentId: 'a1' };
      await deleteTaskAttachment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('allows the uploader to delete their own attachment', async () => {
      const mockAttachment = {
        uploaderId: 'user-1',
        isDeleted: false,
        save: jest.fn().mockResolvedValue(true),
      };
      mockFindActiveTask({ _id: taskId });
      jest.spyOn(Attachment, 'findOne').mockResolvedValue(mockAttachment);

      mockReq.params = { id: 'ENG-1', attachmentId: 'a1' };
      await deleteTaskAttachment(mockReq, mockRes);

      expect(mockAttachment.isDeleted).toBe(true);
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
