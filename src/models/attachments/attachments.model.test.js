import { jest } from '@jest/globals';
import Attachment, { getNextAttachmentId } from './attachments.model.js';

describe('Attachment Model', () => {
  it('should generate sequential attachmentId', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue({ attachmentId: 'ATT0002' }),
          }),
        }),
      }),
    };

    const nextId = await getNextAttachmentId(mockModel);
    expect(nextId).toBe('ATT0003');
  });

  it('should return ATT0001 if no prior attachment exists', async () => {
    const mockModel = {
      findOne: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          collation: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue(null),
          }),
        }),
      }),
    };

    const nextId = await getNextAttachmentId(mockModel);
    expect(nextId).toBe('ATT0001');
  });

  it('should return ATT0001 on error', async () => {
    const mockModel = {
      findOne: jest.fn().mockImplementation(() => {
        throw new Error('DB Error');
      }),
    };

    const nextId = await getNextAttachmentId(mockModel);
    expect(nextId).toBe('ATT0001');
  });

  it('instantiates attachment model with schema fields', () => {
    const attachment = new Attachment({
      taskId: '650c00000000000000000001',
      uploaderId: '650c00000000000000000002',
      filename: 'diagram.png',
      mimetype: 'image/png',
      size: 1024,
      data: Buffer.from('fake-binary-data'),
    });

    expect(attachment.filename).toBe('diagram.png');
    expect(attachment.isDeleted).toBe(false);
  });
});
