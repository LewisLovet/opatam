import { describe, it, expect } from 'vitest';
import { signSalesLink, verifySalesLink } from './sales-attribution';

process.env.SALES_LINK_SECRET = 'secret-de-test-uniquement';

describe('liens commerciaux signés', () => {
  it('un jeton signé se vérifie et restitue son contenu', () => {
    const t = signSalesLink({ staffUid: 'com-1', campaign: 'salon-2026', sector: 'beaute' });
    const v = verifySalesLink(t);
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.payload.staffUid).toBe('com-1');
      expect(v.payload.campaign).toBe('salon-2026');
    }
  });

  it("un jeton ALTÉRÉ est rejeté — on ne s'attribue pas des inscriptions", () => {
    const t = signSalesLink({ staffUid: 'com-1', campaign: null, sector: null });
    const [v0, body] = t.split('.');
    const forged = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    forged.staffUid = 'voleur';
    const forgedBody = Buffer.from(JSON.stringify(forged), 'utf8').toString('base64url');
    const forgedToken = `${v0}.${forgedBody}.${t.split('.')[2]}`;
    const v = verifySalesLink(forgedToken);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('bad-signature');
  });

  it('un jeton fabriqué de toutes pièces est rejeté', () => {
    expect(verifySalesLink('v1.nimporte.quoi').ok).toBe(false);
    expect(verifySalesLink('').ok).toBe(false);
    expect(verifySalesLink('v2.a.b').ok).toBe(false);
  });

  it('un jeton trop vieux expire (180 jours)', () => {
    const t = signSalesLink({ staffUid: 'com-1', campaign: null, sector: null });
    const [v0, body, mac] = t.split('.');
    void v0; void mac;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    p.issuedAt -= 181 * 86_400;
    // re-signe avec le vrai secret pour isoler le test d'expiration
    const { createHmac } = require('node:crypto');
    const nb = Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
    const nm = createHmac('sha256', process.env.SALES_LINK_SECRET).update(`v1.${nb}`).digest().toString('base64url');
    const v = verifySalesLink(`v1.${nb}.${nm}`);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe('expired');
  });
});
