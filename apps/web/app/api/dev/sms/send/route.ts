import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/dev/sms/send
 *
 * Dev-only proxy to Prelude's Transactional API. The API key is supplied
 * by the caller (pasted in the dev UI) so we don't have to commit a key
 * to the environment just to test SMS templates.
 *
 * Endpoint: https://api.prelude.dev/v2/transactional
 *
 * Request body:
 *  - apiKey      string  (Bearer token from Prelude dashboard)
 *  - to          string  (E.164, e.g. "+33612345678")
 *  - templateId  string  ("template_01k8...")
 *  - from        string  (sender ID, default "Opatam")
 *  - variables   Record<string, string>
 *  - locale      string  (optional, e.g. "fr" — falls back to template's default_locale)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey, to, templateId, from, variables, locale } = body as {
      apiKey?: string;
      to?: string;
      templateId?: string;
      from?: string;
      variables?: Record<string, string>;
      locale?: string;
    };

    if (!apiKey) return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 });
    if (!to) return NextResponse.json({ error: 'Missing to' }, { status: 400 });
    if (!templateId) return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });

    const payload: Record<string, unknown> = {
      to,
      template_id: templateId,
      variables: variables ?? {},
      correlation_id: `dev-${Date.now()}`,
    };
    if (from) payload.from = from;
    if (locale) payload.locale = locale;

    const preludeRes = await fetch('https://api.prelude.dev/v2/transactional', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const text = await preludeRes.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }

    return NextResponse.json(
      {
        ok: preludeRes.ok,
        status: preludeRes.status,
        prelude: parsed,
      },
      { status: preludeRes.ok ? 200 : 502 }
    );
  } catch (error) {
    console.error('[DEV/SMS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
