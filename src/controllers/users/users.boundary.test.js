import { jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import User from '../../models/users/users.model.js';
import {
  buildUserFilter,
  getAllUsers,
  createUserApiCall,
  updateUserApiCall,
  exportUsersApiCall,
} from './users.controller.js';

const query = (result) => ({
  select: jest.fn().mockReturnThis(),
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockResolvedValue(result),
});
const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
  setHeader: jest.fn(),
  send: jest.fn(),
});
afterEach(() => jest.restoreAllMocks());

it.each(['false', 'unknown'])('handles inactive and unrecognized user statuses: %s', (status) => {
  expect(buildUserFilter({ status }).isActive).toBe(status === 'false' ? false : undefined);
});

it('provides pagination and user identifier defaults for legacy records', async () => {
  jest.spyOn(User, 'find').mockReturnValue(query([{}]));
  jest.spyOn(User, 'countDocuments').mockResolvedValue(0);
  const res = response();
  await getAllUsers({ query: {} }, res);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      data: [{ userId: 'TF0001', isActive: true }],
      pagination: expect.objectContaining({ totalPages: 1 }),
    })
  );
});

it.each([
  [{ id: 'u1' }, { firstName: 'Ada', lastName: 'Lovelace' }],
  [{}, {}],
])('creates a default developer with optional actor identity: %j', async (record, actor) => {
  jest.spyOn(User, 'findOne').mockReturnValue(query(null));
  jest
    .spyOn(User, 'create')
    .mockResolvedValue({ ...record, email: 'new@example.com', firstName: 'New', lastName: 'User' });
  jest
    .spyOn(nodemailer, 'createTransport')
    .mockReturnValue({ sendMail: jest.fn().mockResolvedValue({}) });
  const res = response();
  await createUserApiCall(
    {
      body: { firstName: 'New', lastName: 'User', email: 'new@example.com', isActive: false },
      user: actor,
    },
    res
  );
  expect(User.create).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'Developer', isActive: false })
  );
  expect(res.status).toHaveBeenCalledWith(201);
});

it('updates the surname independently of other account fields', async () => {
  const user = { _id: 'u1', lastName: 'Before', save: jest.fn(), toObject: () => ({}) };
  jest.spyOn(User, 'findOne').mockResolvedValue(user);
  const res = response();
  await updateUserApiCall(
    { params: { id: 'u1' }, body: { lastName: 'After', isActive: false } },
    res
  );
  expect(user.lastName).toBe('After');
  expect(user.isActive).toBe(false);
  expect(res.status).toHaveBeenCalledWith(200);
});

it('exports legacy users with fallback fields and explicit filters', async () => {
  jest.spyOn(User, 'find').mockReturnValue(query([{ _id: 'u1', isActive: false }, {}]));
  const res = response();
  await exportUsersApiCall({ query: { search: 'a', role: 'Developer', status: 'false' } }, res);
  expect(JSON.stringify(res.json.mock.calls[0][0])).toContain('N/A');
  expect(User.find).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'Developer', isActive: false })
  );
});
