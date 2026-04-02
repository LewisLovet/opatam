import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the scheduling service before importing the route
const mockGetAvailableSlots = vi.fn();

vi.mock('@booking-app/firebase', () => ({
  schedulingService: {
    getAvailableSlots: mockGetAvailableSlots,
  },
}));

// Dynamic import after mock
const { GET } = await import('./route');

// Helper to create a NextRequest-like object
function createRequest(url: string) {
  return { url } as any;
}

describe('GET /api/slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if providerId is missing', async () => {
    const req = createRequest('http://localhost/api/slots?serviceId=s1&memberId=m1&date=2026-04-01');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('manquants');
  });

  it('returns 400 if serviceId is missing', async () => {
    const req = createRequest('http://localhost/api/slots?providerId=p1&memberId=m1&date=2026-04-01');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('manquants');
  });

  it('returns 400 if memberId is missing', async () => {
    const req = createRequest('http://localhost/api/slots?providerId=p1&serviceId=s1&date=2026-04-01');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('manquants');
  });

  it('returns 400 if no date params provided', async () => {
    const req = createRequest('http://localhost/api/slots?providerId=p1&serviceId=s1&memberId=m1');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('date');
  });

  it('returns 400 for invalid date', async () => {
    const req = createRequest('http://localhost/api/slots?providerId=p1&serviceId=s1&memberId=m1&date=not-a-date');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('invalide');
  });

  it('returns slots from scheduling service with correct params', async () => {
    const mockSlots = [
      {
        date: new Date('2026-04-01T00:00:00'),
        start: '09:00',
        end: '09:30',
        datetime: new Date('2026-04-01T09:00:00'),
        endDatetime: new Date('2026-04-01T09:30:00'),
      },
      {
        date: new Date('2026-04-01T00:00:00'),
        start: '10:00',
        end: '10:30',
        datetime: new Date('2026-04-01T10:00:00'),
        endDatetime: new Date('2026-04-01T10:30:00'),
      },
    ];

    mockGetAvailableSlots.mockResolvedValue(mockSlots);

    const req = createRequest('http://localhost/api/slots?providerId=p1&serviceId=s1&memberId=m1&date=2026-04-01');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.slots).toHaveLength(2);
    expect(body.slots[0].start).toBe('09:00');
    expect(body.slots[0].end).toBe('09:30');
    expect(body.slots[1].start).toBe('10:00');

    // Verify scheduling service was called with correct params
    expect(mockGetAvailableSlots).toHaveBeenCalledWith(
      expect.objectContaining({
        providerId: 'p1',
        serviceId: 's1',
        memberId: 'm1',
      })
    );
  });

  it('returns serialized ISO dates', async () => {
    const mockSlots = [
      {
        date: new Date('2026-04-01T00:00:00'),
        start: '14:00',
        end: '14:30',
        datetime: new Date('2026-04-01T14:00:00'),
        endDatetime: new Date('2026-04-01T14:30:00'),
      },
    ];

    mockGetAvailableSlots.mockResolvedValue(mockSlots);

    const req = createRequest('http://localhost/api/slots?providerId=p1&serviceId=s1&memberId=m1&date=2026-04-01');
    const res = await GET(req);
    const body = await res.json();

    // Dates should be ISO strings
    expect(body.slots[0].datetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.slots[0].endDatetime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns empty array when no slots available', async () => {
    mockGetAvailableSlots.mockResolvedValue([]);

    const req = createRequest('http://localhost/api/slots?providerId=p1&serviceId=s1&memberId=m1&date=2026-04-01');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.slots).toEqual([]);
  });

  it('returns 400 when scheduling service throws', async () => {
    mockGetAvailableSlots.mockRejectedValue(new Error('Provider not found'));

    const req = createRequest('http://localhost/api/slots?providerId=p1&serviceId=s1&memberId=m1&date=2026-04-01');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Provider not found');
  });

  it('supports legacy startDate/endDate params', async () => {
    mockGetAvailableSlots.mockResolvedValue([]);

    const req = createRequest('http://localhost/api/slots?providerId=p1&serviceId=s1&memberId=m1&startDate=2026-04-01T00:00:00Z&endDate=2026-04-01T23:59:59Z');
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetAvailableSlots).toHaveBeenCalled();
  });
});
