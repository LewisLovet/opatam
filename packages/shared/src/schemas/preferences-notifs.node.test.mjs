/**
 * Les interrupteurs de notifications « absent = activé » survivent à une
 * écriture complète de `settings` : zod retire en silence les clés non
 * déclarées, et l'interrupteur coupé se rallumait tout seul.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(specifier, context, next) {
    try { return await next(specifier, context); }
    catch (e) {
      if (specifier.startsWith('.') && !/\\.[cm]?[jt]s$/.test(specifier)) {
        try { return await next(specifier + '.ts', context); }
        catch { return next(specifier + '/index.ts', context); }
      }
      throw e;
    }
  }
`));
const { updateProviderSchema } = await import('./provider.schema.ts');

describe('préférences de notifications du gérant', () => {
  it('les interrupteurs coupés restent coupés après validation', () => {
    const prefs = {
      dailyAgendaPush: false,
      teamBookingNotifications: false,
      planningChangesPush: false,
      planningReminderPush: false,
    };
    const r = updateProviderSchema.parse({ settings: { notificationPreferences: prefs } });
    assert.deepEqual(r.settings.notificationPreferences, prefs);
  });
});
