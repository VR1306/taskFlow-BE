import { jest } from '@jest/globals';
import Task from '../../models/tasks/tasks.model.js';
import Comment from '../../models/comments/comments.model.js';
import Attachment from '../../models/attachments/attachments.model.js';
import { deleteTaskComment, createTaskComment } from '../comments/comments.controller.js';
import {
  downloadTaskAttachment,
  deleteTaskAttachment,
  uploadTaskAttachment,
} from '../attachments/attachments.controller.js';

const id = '650c00000000000000000001';
const query = (result) => ({
  populate: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});
const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
  send: jest.fn(),
});
afterEach(() => jest.restoreAllMocks());

it.each([deleteTaskComment, deleteTaskAttachment, downloadTaskAttachment])(
  'returns 404 for resources belonging to a missing task',
  async (handler) => {
    jest.spyOn(Task, 'findOne').mockReturnValue(query(null));
    const res = response();
    await handler({ params: { id, commentId: id, attachmentId: id } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  }
);

it.each([
  [Comment, deleteTaskComment],
  [Attachment, deleteTaskAttachment],
])(
  'rejects resource deletion when no authenticated owner or permissions are present',
  async (Model, handler) => {
    jest.spyOn(Task, 'findOne').mockReturnValue(query({ _id: id }));
    jest.spyOn(Model, 'findOne').mockResolvedValue({ authorId: 'other', uploaderId: 'other' });
    const res = response();
    await handler({ params: { id, commentId: id, attachmentId: id } }, res);
    expect(res.status).toHaveBeenCalledWith(403);
  }
);

it('downloads attachments addressed by ObjectId', async () => {
  jest.spyOn(Task, 'findOne').mockReturnValue(query({ _id: id }));
  const data = Buffer.from('attachment');
  jest
    .spyOn(Attachment, 'findOne')
    .mockReturnValue(query({ filename: 'test.txt', mimetype: 'text/plain', data }));
  const res = response();
  await downloadTaskAttachment({ params: { id, attachmentId: id } }, res);
  expect(res.send).toHaveBeenCalledWith(data);
});

it('persists an attachment with no uploader when no user is supplied', async () => {
  jest.spyOn(Task, 'findOne').mockReturnValue(query({ _id: id }));
  jest.spyOn(Attachment, 'create').mockResolvedValue({ _id: id });
  jest
    .spyOn(Attachment, 'findById')
    .mockReturnValue({ ...query({ _id: id }), select: jest.fn().mockReturnThis() });
  const res = response();
  await uploadTaskAttachment(
    {
      params: { id },
      file: { originalname: 'test.txt', mimetype: 'text/plain', size: 1, buffer: Buffer.from('a') },
    },
    res
  );
  expect(Attachment.create).toHaveBeenCalledWith(expect.objectContaining({ uploaderId: null }));
  expect(res.status).toHaveBeenCalledWith(201);
});

it('persists a comment with no author when no user is supplied', async () => {
  jest.spyOn(Task, 'findOne').mockReturnValue(query({ _id: id, assigneeId: 'other' }));
  jest.spyOn(Comment, 'create').mockResolvedValue({ _id: id });
  jest.spyOn(Comment, 'findById').mockReturnValue(query({ _id: id }));
  const res = response();
  await createTaskComment({ params: { id }, body: { body: 'Comment' } }, res);
  expect(Comment.create).toHaveBeenCalledWith(expect.objectContaining({ authorId: null }));
  expect(res.status).toHaveBeenCalledWith(201);
});
