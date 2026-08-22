import { describe, it, expect } from 'vitest';
import { decideAffiliateLink } from './affiliate-link';

const OWNER = 'pro-1';
const provider = { userId: OWNER, affiliateId: null };
const affiliate = { id: 'aff-1' };

describe('decideAffiliateLink — autorisation du rattachement affilié', () => {
  it('appel sans jeton → 401', () => {
    const d = decideAffiliateLink({ authUid: null, providerId: OWNER, provider, affiliate });
    expect(d.ok).toBe(false);
    expect((d as { status: number }).status).toBe(401);
  });

  it('jeton ne correspondant pas au providerId → 403', () => {
    const d = decideAffiliateLink({ authUid: 'intrus', providerId: OWNER, provider, affiliate });
    expect(d.ok).toBe(false);
    expect((d as { status: number }).status).toBe(403);
  });

  it('document dont userId ne correspond pas au jeton → 403', () => {
    const d = decideAffiliateLink({
      authUid: OWNER, providerId: OWNER,
      provider: { userId: 'autre', affiliateId: null }, affiliate,
    });
    expect(d.ok).toBe(false);
    expect((d as { status: number }).status).toBe(403);
  });

  it('prestataire introuvable → 404', () => {
    const d = decideAffiliateLink({ authUid: OWNER, providerId: OWNER, provider: null, affiliate });
    expect(d.ok).toBe(false);
    expect((d as { status: number }).status).toBe(404);
  });

  it('code valide + propriétaire réel → rattachement accepté', () => {
    const d = decideAffiliateLink({ authUid: OWNER, providerId: OWNER, provider, affiliate });
    expect(d.ok).toBe(true);
    expect((d as { affiliateId: string }).affiliateId).toBe('aff-1');
  });

  it("second rattachement → aucun écrasement, même avec un code valide", () => {
    const d = decideAffiliateLink({
      authUid: OWNER, providerId: OWNER,
      provider: { userId: OWNER, affiliateId: 'aff-existante' }, affiliate,
    });
    expect(d.ok).toBe(true);
    expect((d as { alreadyLinked: boolean }).alreadyLinked).toBe(true);
  });

  it('code invalide (aucun affilié actif) → 404', () => {
    const d = decideAffiliateLink({ authUid: OWNER, providerId: OWNER, provider, affiliate: null });
    expect(d.ok).toBe(false);
    expect((d as { status: number }).status).toBe(404);
  });
});
