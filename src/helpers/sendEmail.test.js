import { jest } from '@jest/globals';
import nodemailer from 'nodemailer';
import {
  sendWelcomeEmail,
  sendProjectAssignmentEmail,
  sendPasswordResetEmail,
} from './sendEmail.js';

describe('Send Email Helpers', () => {
  let mockSendMail;

  beforeEach(() => {
    process.env.GMAIL_USER = 'taskflow.noreply@gmail.com';
    process.env.GMAIL_APP_PASS = 'app-password-secret';

    mockSendMail = jest.fn();
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue({
      sendMail: mockSendMail,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendWelcomeEmail', () => {
    it('sends welcome email with plain password and html body', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-123' });

      await sendWelcomeEmail({
        name: 'Sarah Connor',
        email: 'sarah@example.com',
        plainPassword: 'TempPassword123!',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'sarah@example.com',
          subject: 'Welcome to TaskFlow - Your Account Credentials',
          html: expect.stringContaining('Sarah Connor'),
        })
      );
    });

    it('throws custom error when transporter.sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('Network failure'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        sendWelcomeEmail({
          name: 'Sarah Connor',
          email: 'sarah@example.com',
          plainPassword: 'TempPassword123!',
        })
      ).rejects.toThrow('Failed to send welcome email.');

      consoleSpy.mockRestore();
    });
  });

  describe('sendProjectAssignmentEmail', () => {
    it('sends assignment email with project name and role', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-789' });

      await sendProjectAssignmentEmail({
        name: 'Priya Nair',
        email: 'priya@example.com',
        projectName: 'Engineering Platform',
        role: 'Project Lead',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'priya@example.com',
          subject: 'You\'ve been assigned to "Engineering Platform"',
          html: expect.stringContaining('Priya Nair'),
        })
      );
      expect(mockSendMail.mock.calls[0][0].html).toContain('Project Lead');
    });

    it('throws custom error when transporter.sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('Network failure'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        sendProjectAssignmentEmail({
          name: 'Priya Nair',
          email: 'priya@example.com',
          projectName: 'Engineering Platform',
          role: 'Developer',
        })
      ).rejects.toThrow('Failed to send project assignment email.');

      consoleSpy.mockRestore();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset link with resetUrl and secure styling', async () => {
      mockSendMail.mockResolvedValue({ messageId: 'msg-456' });

      await sendPasswordResetEmail({
        name: 'John Doe',
        email: 'john@example.com',
        resetUrl: 'https://taskflow.io/auth/reset-password?token=abc12345',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
          subject: 'TaskFlow Reset Password Link (Expires in 10 mins)',
          html: expect.stringContaining('https://taskflow.io/auth/reset-password?token=abc12345'),
        })
      );
    });
  });
});
