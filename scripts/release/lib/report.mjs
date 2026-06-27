import fs from 'node:fs';
import path from 'node:path';

export function ensureReportDir(rootDir) {
  const dir = path.join(rootDir, 'reports', 'release');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function nowIso() {
  return new Date().toISOString();
}

export function writeJsonReport(rootDir, name, payload) {
  const dir = ensureReportDir(rootDir);
  const file = path.join(dir, `${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

export function writeMarkdownReport(rootDir, name, payload) {
  const dir = ensureReportDir(rootDir);
  const file = path.join(dir, `${name}.md`);
  fs.writeFileSync(file, renderMarkdown(payload));
  return file;
}

export function writeHtmlReport(rootDir, name, payload) {
  const dir = ensureReportDir(rootDir);
  const file = path.join(dir, `${name}.html`);
  fs.writeFileSync(file, renderHtmlPage(payload));
  writeHtmlIndex(rootDir);
  return file;
}

export function writeReportFiles(rootDir, name, payload) {
  return {
    json: writeJsonReport(rootDir, name, payload),
    markdown: writeMarkdownReport(rootDir, name, payload),
    html: writeHtmlReport(rootDir, name, payload),
  };
}

export function verdictFromChecks(checks) {
  if (checks.some((check) => check.status === 'fail')) return 'FAIL';
  if (checks.some((check) => check.status === 'warn')) return 'WARN';
  return 'PASS';
}

export function statusIcon(status) {
  if (status === 'pass') return 'OK';
  if (status === 'warn') return 'ATTENTION';
  if (status === 'skip') return 'IGNORÉ';
  return 'ÉCHEC';
}

export function verdictLabel(verdict) {
  if (verdict === 'PASS') return 'RÉUSSI';
  if (verdict === 'WARN') return 'ATTENTION';
  if (verdict === 'FAIL') return 'ÉCHEC';
  return verdict || 'INCONNU';
}

function renderMarkdown(payload) {
  const lines = [];
  lines.push(`# Rapport de release Opatam - ${payload.name}`);
  lines.push('');
  lines.push(`Généré le : ${payload.generatedAt}`);
  lines.push(`Verdict : **${verdictLabel(payload.verdict)}**`);
  lines.push('');

  if (payload.summary) {
    lines.push('## Résumé');
    lines.push('');
    lines.push(payload.summary);
    lines.push('');
  }

  if (payload.impacts?.length) {
    lines.push('## Impacts');
    lines.push('');
    for (const impact of payload.impacts) lines.push(`- ${impact}`);
    lines.push('');
  }

  if (payload.warnings?.length) {
    lines.push('## Alertes');
    lines.push('');
    for (const warning of payload.warnings) lines.push(`- ${warning}`);
    lines.push('');
  }

  if (payload.checks?.length) {
    lines.push('## Vérifications');
    lines.push('');
    lines.push('| Statut | Vérification | Détail |');
    lines.push('| --- | --- | --- |');
    for (const check of payload.checks) {
      const detail = (check.detail || '').replace(/\n/g, '<br>');
      lines.push(`| ${statusIcon(check.status)} | ${escapeMd(check.name)} | ${escapeMd(detail)} |`);
    }
    lines.push('');
  }

  if (payload.changedFiles?.length) {
    lines.push('## Fichiers modifiés');
    lines.push('');
    for (const file of payload.changedFiles) lines.push(`- \`${file}\``);
    lines.push('');
  }

  if (payload.nextSteps?.length) {
    lines.push('## Prochaines étapes');
    lines.push('');
    for (const step of payload.nextSteps) lines.push(`- ${step}`);
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

function escapeMd(value) {
  return String(value ?? '').replace(/\|/g, '\\|');
}

function readJsonSafe(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeHtmlIndex(rootDir) {
  const dir = ensureReportDir(rootDir);
  const names = ['latest', 'preflight', 'smoke-web', 'provider-readiness', 'booking-live'];
  const reports = names
    .map((name) => readJsonSafe(path.join(dir, `${name}.json`)))
    .filter(Boolean)
    .sort((a, b) => String(b.generatedAt || '').localeCompare(String(a.generatedAt || '')));

  const latest = reports[0];
  const html = renderShell({
    title: 'Tests de release Opatam',
    body: `
      <header class="hero">
        <div>
          <p class="eyebrow">Sécurité de release</p>
          <h1>Tests de release Opatam</h1>
          <p class="muted">Derniers rapports générés localement. Ces fichiers ne sont pas déployés.</p>
        </div>
        ${latest ? verdictBadge(latest.verdict) : ''}
      </header>
      <section class="grid">
        ${reports.map((report) => renderReportCard(report, true)).join('')}
      </section>
      ${reports.length ? '' : '<p class="empty">Aucun rapport pour le moment. Lance <code>pnpm release:check</code> ou un test individuel.</p>'}
    `,
  });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

function renderHtmlPage(payload) {
  return renderShell({
    title: `Opatam - ${payload.name}`,
    body: `
      <header class="hero">
        <div>
          <p class="eyebrow">Rapport de release</p>
          <h1>${escapeHtml(payload.name || 'report')}</h1>
          <p class="muted">${escapeHtml(payload.generatedAt || '')}</p>
        </div>
        ${verdictBadge(payload.verdict)}
      </header>
      ${renderReportCard(payload, false)}
      <p class="back"><a href="./index.html">Retour à l'index des rapports</a></p>
    `,
  });
}

function renderReportCard(report, compact) {
  const checks = report.checks || [];
  const failed = checks.filter((check) => check.status === 'fail').length;
  const warned = checks.filter((check) => check.status === 'warn').length;
  const skipped = checks.filter((check) => check.status === 'skip').length;
  const passed = checks.filter((check) => check.status === 'pass').length;

  return `
    <article class="card ${String(report.verdict || '').toLowerCase()}">
      <div class="card-head">
        <div>
          <h2>${escapeHtml(report.name || 'report')}</h2>
          <p class="muted">${escapeHtml(report.summary || '')}</p>
        </div>
        ${verdictBadge(report.verdict)}
      </div>
      <div class="stats">
        <span><strong>${passed}</strong> OK</span>
        <span><strong>${failed}</strong> échec</span>
        <span><strong>${warned}</strong> attention</span>
        <span><strong>${skipped}</strong> ignoré</span>
      </div>
      ${report.provider ? renderProviderSection(report.provider) : ''}
      ${report.booking ? renderBookingSection(report.booking) : ''}
      ${report.warnings?.length ? `
        <section>
          <h3>Alertes</h3>
          <ul>${report.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>
      ` : ''}
      ${report.impacts?.length ? `
        <section>
          <h3>Impacts</h3>
          <div class="chips">${report.impacts.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>
        </section>
      ` : ''}
      ${checks.length ? `
        <section>
          <h3>Vérifications</h3>
          <table>
            <thead><tr><th>Statut</th><th>Vérification</th><th>Détail</th></tr></thead>
            <tbody>
              ${checks.map((check) => `
                <tr>
                  <td>${statusPill(check.status)}</td>
                  <td>${escapeHtml(check.name)}</td>
                  <td><pre>${escapeHtml(check.detail || '')}</pre></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </section>
      ` : ''}
      ${compact ? `<a class="button" href="./${escapeHtml(report.name)}.html">Voir le détail</a>` : ''}
      ${!compact && report.nextSteps?.length ? `
        <section>
          <h3>Prochaines étapes</h3>
          <ul>${report.nextSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        </section>
      ` : ''}
      ${!compact && report.changedFiles?.length ? `
        <section>
          <h3>Fichiers modifiés</h3>
          <ul class="files">${report.changedFiles.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join('')}</ul>
        </section>
      ` : ''}
    </article>
  `;
}

function renderKeyValueTable(rows) {
  return `
    <table class="kv">
      <tbody>
        ${rows.map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

function renderProviderSection(provider) {
  const yesNo = (value) => (value ? 'Oui' : 'Non');
  const slot = provider.firstPlausibleSlot;
  const rows = [
    ['Nom', provider.businessName || '—'],
    ['Identifiant', provider.id || '—'],
    ['Slug', provider.slug || '—'],
    ['Publié', yesNo(provider.isPublished)],
    ['Statut abonnement', provider.subscriptionStatus || '—'],
    ['Services actifs', provider.activeServices ?? '—'],
    ['Lieux actifs', provider.activeLocations ?? '—'],
    ['Membres actifs', provider.activeMembers ?? '—'],
    ['Disponibilités ouvertes', provider.openAvailabilityDocs ?? '—'],
    [
      'Premier créneau plausible',
      slot
        ? `${slot.datetime} — ${slot.serviceName} avec ${slot.memberName} (${slot.totalDuration} min)`
        : 'Aucun',
    ],
  ];
  return `
    <section class="block">
      <h3>Prestataire testé</h3>
      ${renderKeyValueTable(rows)}
    </section>`;
}

function renderBookingSection(booking) {
  const rows = [
    ['Identifiant réservation', booking.id || '—'],
    ['Statut', booking.status || '—'],
    ['Client', booking.clientEmail || '—'],
    ['Prestation', booking.serviceName || '—'],
    ['Membre', booking.memberName || '—'],
    ['Créneau', booking.datetime || '—'],
    ['Endpoint appelé', booking.endpoint || '—'],
  ];
  return `
    <section class="block real">
      <h3>Réservation créée</h3>
      ${renderKeyValueTable(rows)}
      <p class="muted note">Actions manuelles : vérifier l'email client, les notifications prestataire et l'agenda, puis annuler la réservation si elle ne doit pas rester dans l'agenda.</p>
    </section>`;
}

function renderShell({ title, body }) {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; --ok:#047857; --fail:#b91c1c; --warn:#b45309; --skip:#52525b; --ink:#18181b; --muted:#71717a; --line:#e4e4e7; --bg:#f8fafc; --card:#fff; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:var(--bg); color:var(--ink); }
    main { max-width:1180px; margin:0 auto; padding:32px 20px 56px; }
    .hero { display:flex; justify-content:space-between; gap:20px; align-items:flex-start; margin-bottom:24px; }
    .eyebrow { margin:0 0 6px; text-transform:uppercase; letter-spacing:.08em; font-size:12px; font-weight:700; color:#2563eb; }
    h1 { margin:0; font-size:34px; line-height:1.12; }
    h2 { margin:0 0 6px; font-size:22px; }
    h3 { margin:22px 0 10px; font-size:14px; text-transform:uppercase; letter-spacing:.05em; color:#3f3f46; }
    .muted { color:var(--muted); margin:0; line-height:1.5; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:18px; box-shadow:0 1px 2px rgba(15,23,42,.04); }
    .card.pass { border-top:4px solid var(--ok); }
    .card.fail { border-top:4px solid var(--fail); }
    .card.warn { border-top:4px solid var(--warn); }
    .card-head { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; }
    .badge, .pill { display:inline-flex; align-items:center; min-height:28px; padding:5px 10px; border-radius:999px; font-size:12px; font-weight:800; white-space:nowrap; }
    .badge.pass, .pill.pass { color:#065f46; background:#d1fae5; }
    .badge.fail, .pill.fail { color:#991b1b; background:#fee2e2; }
    .badge.warn, .pill.warn { color:#92400e; background:#fef3c7; }
    .badge.skip, .pill.skip { color:#3f3f46; background:#e4e4e7; }
    .stats { display:flex; flex-wrap:wrap; gap:8px; margin:16px 0; }
    .stats span { border:1px solid var(--line); border-radius:6px; padding:7px 9px; background:#fafafa; font-size:13px; }
    .chips { display:flex; gap:8px; flex-wrap:wrap; }
    .chips span { padding:6px 9px; border-radius:6px; background:#eff6ff; color:#1d4ed8; font-size:13px; font-weight:600; }
    table { width:100%; border-collapse:collapse; margin-top:8px; font-size:13px; }
    th, td { text-align:left; vertical-align:top; border-top:1px solid var(--line); padding:10px 8px; }
    th { color:#52525b; font-size:12px; text-transform:uppercase; letter-spacing:.04em; }
    .block { margin-top:8px; }
    .block.real { border-left:4px solid var(--warn); padding-left:12px; }
    table.kv th { width:230px; text-transform:none; font-weight:600; color:#3f3f46; font-size:13px; letter-spacing:0; }
    table.kv td { color:#27272a; font-size:13px; }
    .note { margin-top:8px; }
    pre { margin:0; white-space:pre-wrap; overflow-wrap:anywhere; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:12px; line-height:1.45; color:#27272a; }
    ul { padding-left:18px; }
    li { margin:6px 0; }
    code { font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-size:.95em; background:#f4f4f5; padding:2px 4px; border-radius:4px; }
    .button { display:inline-flex; margin-top:14px; padding:9px 12px; border-radius:6px; background:#18181b; color:#fff; text-decoration:none; font-size:14px; font-weight:700; }
    .back a { color:#2563eb; font-weight:700; }
    .empty { padding:18px; background:#fff; border:1px dashed var(--line); border-radius:8px; }
    @media (max-width:720px) { .hero, .card-head { flex-direction:column; } h1 { font-size:28px; } main { padding:24px 14px; } }
  </style>
</head>
<body>
  <main>${body}</main>
</body>
</html>`;
}

function verdictBadge(verdict) {
  const cls = String(verdict || 'skip').toLowerCase();
  return `<span class="badge ${cls}">${escapeHtml(verdictLabel(verdict) || 'IGNORÉ')}</span>`;
}

function statusPill(status) {
  const cls = String(status || 'skip').toLowerCase();
  return `<span class="pill ${cls}">${escapeHtml(statusIcon(status))}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
