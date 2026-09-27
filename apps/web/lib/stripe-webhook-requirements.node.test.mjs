/**
 * Régression 8 : le contrôle de production doit passer au ROUGE si
 * `payment_intent.succeeded` manque au flux Connect.
 *
 * node --experimental-strip-types --test apps/web/lib/stripe-webhook-requirements.node.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIRED_CONNECT_EVENTS, evaluateEvents } from './stripe-webhook-requirements.ts';

describe('contrôle des webhooks Connect', () => {
  it('payment_intent.succeeded fait partie des événements requis', () => {
    assert.ok(REQUIRED_CONNECT_EVENTS.includes('payment_intent.succeeded'));
  });

  it('ROUGE quand payment_intent.succeeded manque, même si tout le reste est là', () => {
    const sans = REQUIRED_CONNECT_EVENTS.filter((e) => e !== 'payment_intent.succeeded');
    const r = evaluateEvents([{ status: 'enabled', enabled_events: sans }], REQUIRED_CONNECT_EVENTS);
    assert.equal(r.ok, false);
    assert.deepEqual(r.missing, ['payment_intent.succeeded']);
  });

  it('VERT quand tout est là, ou avec le joker « * »', () => {
    assert.equal(evaluateEvents([{ status: 'enabled', enabled_events: [...REQUIRED_CONNECT_EVENTS] }], REQUIRED_CONNECT_EVENTS).ok, true);
    assert.equal(evaluateEvents([{ status: 'enabled', enabled_events: ['*'] }], REQUIRED_CONNECT_EVENTS).ok, true);
  });

  it('un point DÉSACTIVÉ ne couvre rien', () => {
    const r = evaluateEvents([{ status: 'disabled', enabled_events: ['*'] }], REQUIRED_CONNECT_EVENTS);
    assert.equal(r.ok, false);
    assert.equal(r.activeCount, 0);
  });

  it('la couverture peut être répartie sur plusieurs points actifs', () => {
    const [a, ...b] = REQUIRED_CONNECT_EVENTS;
    const r = evaluateEvents(
      [{ status: 'enabled', enabled_events: [a] }, { status: 'enabled', enabled_events: b }],
      REQUIRED_CONNECT_EVENTS,
    );
    assert.equal(r.ok, true);
  });
});
