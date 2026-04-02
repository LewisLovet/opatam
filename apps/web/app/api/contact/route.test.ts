import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Resend with all exports the route needs
vi.mock('@/lib/resend', () => ({
  resend: {
    emails: {
      send: vi.fn().mockResolvedValue({ id: 'test-email-id' }),
    },
  },
  isValidEmail: (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  escapeHtml: (str: string) => str,
}));

// Mock the email wrapper
vi.mock('@/lib/email-utils', () => ({
  getEmailWrapperHtml: vi.fn().mockReturnValue('<html><body>test</body></html>'),
}));

const { POST } = await import('./route');

function createRequest(body: Record<string, unknown>) {
  return {
    json: () => Promise.resolve(body),
  } as any;
}

describe('POST /api/contact', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if name is missing', async () => {
    const req = createRequest({
      email: 'test@test.com',
      subject: 'general',
      message: 'Hello',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if email is missing', async () => {
    const req = createRequest({
      name: 'Test',
      subject: 'general',
      message: 'Hello',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if email is invalid', async () => {
    const req = createRequest({
      name: 'Test',
      email: 'not-an-email',
      subject: 'general',
      message: 'Hello',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if message is missing', async () => {
    const req = createRequest({
      name: 'Test',
      email: 'test@test.com',
      subject: 'general',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 if subject is missing', async () => {
    const req = createRequest({
      name: 'Test',
      email: 'test@test.com',
      message: 'Hello',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
