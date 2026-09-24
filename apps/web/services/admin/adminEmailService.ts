import { adminHeaders } from './adminFetch';

const BASE_URL = '/api/admin/emails';

/** Une entrée du journal `emailLogs`, telle que la route la renvoie. */
export interface EmailLogEntry {
  id: string;
  type: string;
  to: string[];
  subject: string;
  bookingId: string | null;
  providerId: string | null;
  locale: string | null;
  /** Ce que l'e-mail annonçait : `affiche` (« vendredi 25 septembre à 17:00 »), `timeZone`… */
  resume: Record<string, string | number | boolean | null> | null;
  resendId: string | null;
  status: 'sent' | 'failed';
  error: string | null;
  /** ISO 8601. */
  sentAt: string | null;
}

/** L'e-mail tel que Resend l'a envoyé — relu à la demande, jamais stocké. */
export interface EmailRendu {
  subject: string;
  to: string[];
  html: string | null;
  text: string | null;
  /** Dernier événement connu de Resend : delivered, bounced, opened… */
  lastEvent: string | null;
  createdAt: string | null;
}

export const adminEmailService = {
  async listForBooking(bookingId: string): Promise<EmailLogEntry[]> {
    const res = await fetch(`${BASE_URL}?bookingId=${encodeURIComponent(bookingId)}`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des e-mails');
    const body = (await res.json()) as { items: EmailLogEntry[] };
    return body.items;
  },

  async getRendered(logId: string): Promise<EmailRendu> {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(logId)}`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? 'Impossible de relire cet e-mail');
    }
    return res.json();
  },
};
