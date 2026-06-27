#!/usr/bin/env node
import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const reportDir = path.join(rootDir, 'reports', 'release');
const port = Number.parseInt(process.env.RELEASE_UI_PORT || '8787', 10);
const host = '127.0.0.1';

const tests = [
  {
    id: 'preflight',
    label: 'Pré-vérification technique',
    description: 'Tests unitaires, typecheck web/functions/mobile, build web, carte des impacts et alertes (Stripe, booking, mobile, Firebase, emails).',
    command: ['pnpm', ['release:preflight']],
    report: 'preflight.html',
    destructive: false,
  },
  {
    id: 'provider',
    label: 'Réservabilité prestataire',
    description: 'Lecture seule Firestore : vérifie que le prestataire test est publié, actif, avec services/lieux/membres/disponibilités et un premier créneau réservable.',
    command: ['pnpm', ['release:provider', '--', 'rgq0JPuTOKPim9xKdjWO3LanDSI3']],
    report: 'provider-readiness.html',
    destructive: false,
  },
  {
    id: 'smoke',
    label: 'Smoke test web',
    description: 'Vérifie que les pages publiques critiques (accueil, recherche, tarifs…) répondent correctement.',
    command: ['pnpm', ['release:smoke']],
    report: 'smoke-web.html',
    destructive: false,
  },
  {
    id: 'booking-live',
    label: 'Réservation réelle',
    description: 'Crée une VRAIE réservation en production sur opatam.com avec bwemba13@gmail.com. Déclenche emails, notifications et agenda.',
    command: ['pnpm', ['release:booking-live', '--', 'rgq0JPuTOKPim9xKdjWO3LanDSI3']],
    report: 'booking-live.html',
    destructive: true,
    dangerNote: 'Ce test crée une vraie réservation et peut envoyer des emails/notifications.',
    env: {
      RELEASE_BASE_URL: 'https://opatam.com',
      LIVE_BOOKING_CONFIRM: 'yes',
    },
  },
  {
    id: 'report',
    label: 'Rafraîchir les rapports',
    description: 'Reconstruit uniquement les pages HTML depuis les JSON existants. Ne relance aucun test.',
    command: ['pnpm', ['release:report']],
    report: 'index.html',
    destructive: false,
  },
];

// Single global run — only one test at a time (the whole point of the lock).
let currentRun = null;
const history = [];

function send(res, status, body, contentType = 'text/html; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType, 'cache-control': 'no-store' });
  res.end(body);
}

function json(res, status, body) {
  send(res, status, JSON.stringify(body), 'application/json; charset=utf-8');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function labelVerdict(verdict) {
  if (verdict === 'PASS') return 'RÉUSSI';
  if (verdict === 'FAIL') return 'ÉCHEC';
  if (verdict === 'WARN') return 'ATTENTION';
  return verdict || 'INCONNU';
}

function readReportFile(name) {
  const file = path.join(reportDir, name);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

function listReports() {
  if (!fs.existsSync(reportDir)) return [];
  return fs.readdirSync(reportDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(reportDir, file), 'utf8'));
        const checks = Array.isArray(data.checks) ? data.checks : [];
        const counts = {
          pass: checks.filter((c) => c.status === 'pass').length,
          fail: checks.filter((c) => c.status === 'fail').length,
          warn: checks.filter((c) => c.status === 'warn').length,
          skip: checks.filter((c) => c.status === 'skip').length,
        };
        return {
          file,
          name: data.name || file.replace(/\.json$/, ''),
          verdict: data.verdict || null,
          labelVerdict: labelVerdict(data.verdict),
          summary: data.summary || '',
          generatedAt: data.generatedAt || '',
          counts,
          htmlHref: `/reports/${file.replace(/\.json$/, '.html')}`,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((report) => report.name !== 'latest')
    .sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)));
}

function publicRunState() {
  if (!currentRun) return { running: false };
  const test = tests.find((t) => t.id === currentRun.testId);
  const endMs = currentRun.running ? Date.now() : (currentRun.finishedAtMs || Date.now());
  const elapsedSeconds = Math.max(0, Math.round((endMs - currentRun.startedAtMs) / 1000));
  const phase = currentRun.running ? 'running' : (currentRun.exitCode === 0 ? 'done' : 'failed');
  // Heartbeat: keep signalling life even when the command prints nothing.
  const message = currentRun.running && !currentRun.hasOutput
    ? 'Le test est en cours, certaines commandes peuvent rester silencieuses.'
    : '';
  return {
    running: currentRun.running,
    runId: currentRun.id,
    testId: currentRun.testId,
    label: test ? test.label : currentRun.testId,
    report: test ? test.report : null,
    destructive: test ? !!test.destructive : false,
    startedAt: currentRun.startedAt,
    finishedAt: currentRun.finishedAt,
    exitCode: currentRun.exitCode,
    elapsedSeconds,
    phase,
    hasOutput: currentRun.hasOutput,
    message,
    log: currentRun.log,
  };
}

function startRun(test, confirmed) {
  if (currentRun && currentRun.running) {
    return { busy: true };
  }
  if (test.destructive && confirmed !== true) {
    return { error: 'Ce test crée de vraies données. Coche la confirmation avant de le lancer.' };
  }

  const startedAtMs = Date.now();
  const runId = `${startedAtMs}-${test.id}`;
  const child = spawn(test.command[0], test.command[1], {
    cwd: rootDir,
    env: { ...process.env, ...(test.env || {}) },
    shell: false,
  });

  currentRun = {
    id: runId,
    testId: test.id,
    running: true,
    exitCode: null,
    log: '',
    hasOutput: false,
    startedAt: new Date(startedAtMs).toISOString(),
    startedAtMs,
    finishedAt: null,
    finishedAtMs: null,
  };

  const onChunk = (chunk) => { currentRun.log += chunk.toString(); currentRun.hasOutput = true; };
  child.stdout.on('data', onChunk);
  child.stderr.on('data', onChunk);
  child.on('error', (err) => {
    currentRun.log += `\n[erreur de lancement] ${err.message}\n`;
    currentRun.hasOutput = true;
    currentRun.running = false;
    currentRun.exitCode = -1;
    currentRun.finishedAt = new Date().toISOString();
    currentRun.finishedAtMs = Date.now();
  });
  child.on('close', (code) => {
    currentRun.running = false;
    currentRun.exitCode = code;
    currentRun.finishedAt = new Date().toISOString();
    currentRun.finishedAtMs = Date.now();
    history.unshift({ ...currentRun });
    history.splice(20);
  });

  return { runId };
}

function renderHome() {
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tests de release Opatam</title>
  <style>
    :root { --ok:#047857; --fail:#b91c1c; --warn:#b45309; --ink:#18181b; --muted:#71717a; --line:#e4e4e7; --bg:#f8fafc; --card:#fff; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:var(--bg); color:var(--ink); }
    main { max-width:1180px; margin:0 auto; padding:32px 20px 64px; }
    header.top { display:flex; align-items:flex-start; justify-content:space-between; gap:20px; margin-bottom:24px; }
    h1 { margin:0; font-size:32px; line-height:1.12; }
    h3 { margin:30px 0 12px; font-size:13px; text-transform:uppercase; letter-spacing:.07em; color:#52525b; }
    p { line-height:1.5; }
    .muted { color:var(--muted); }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(330px,1fr)); gap:16px; }
    .card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:18px; box-shadow:0 1px 2px rgba(15,23,42,.04); display:flex; flex-direction:column; }
    .card.danger { border-top:4px solid var(--warn); }
    .card.safe { border-top:4px solid var(--ok); }
    .card h2 { margin:0 0 8px; font-size:19px; display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .tag { font-size:11px; font-weight:900; padding:3px 8px; border-radius:999px; text-transform:uppercase; letter-spacing:.04em; }
    .tag.real { background:#fee2e2; color:#991b1b; }
    .tag.safe { background:#d1fae5; color:#065f46; }
    .card p.desc { margin:0; color:#3f3f46; font-size:14px; flex:1; }
    .danger-note { margin:10px 0 0; font-size:13px; color:#991b1b; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:8px 10px; }
    .confirm { display:flex; gap:8px; align-items:flex-start; font-size:13px; color:#3f3f46; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin-top:14px; }
    button, .link { border:0; border-radius:6px; padding:10px 12px; font-weight:800; font-size:14px; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; background:#18181b; color:#fff; }
    button.secondary, .link.secondary { background:#f4f4f5; color:#18181b; border:1px solid var(--line); }
    button.danger { background:#991b1b; color:#fff; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .panel { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .panel.live { border-left:4px solid var(--warn); }
    .panel-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
    .spinner { width:14px; height:14px; border:2px solid #d4d4d8; border-top-color:#2563eb; border-radius:50%; animation:spin .8s linear infinite; display:inline-block; }
    @keyframes spin { to { transform:rotate(360deg); } }
    pre { background:#18181b; color:#fafafa; border-radius:8px; padding:14px; overflow:auto; max-height:360px; white-space:pre-wrap; margin:12px 0 0; font-size:12px; line-height:1.5; }
    .banner { position:sticky; top:0; z-index:50; display:flex; align-items:center; gap:12px; flex-wrap:wrap; padding:11px 20px; background:#fffbeb; border-bottom:1px solid #fde68a; color:#92400e; font-size:14px; }
    .banner strong { color:#78350f; }
    .banner .banner-meta { color:#b45309; }
    .banner .banner-link { margin-left:auto; color:#1d4ed8; font-weight:800; text-decoration:none; font-size:13px; }
    .timeline { list-style:none; padding:0; margin:14px 0 0; display:flex; flex-wrap:wrap; gap:8px; }
    .timeline li { font-size:12px; padding:5px 10px; border-radius:999px; background:#f4f4f5; color:#71717a; border:1px solid var(--line); display:flex; align-items:center; gap:6px; }
    .timeline li::before { content:'○'; font-size:11px; }
    .timeline li.done { background:#d1fae5; color:#065f46; border-color:#a7f3d0; }
    .timeline li.done::before { content:'✓'; }
    .timeline li.active { background:#dbeafe; color:#1e40af; border-color:#bfdbfe; font-weight:700; }
    .timeline li.active::before { content:'●'; }
    .timeline li.fail { background:#fee2e2; color:#991b1b; border-color:#fecaca; }
    .timeline li.fail::before { content:'✕'; }
    .run-status { font-size:13px; font-weight:800; }
    .run-status.go { color:#1d4ed8; }
    .run-status.ok { color:#047857; }
    .run-status.ko { color:#b91c1c; }
    .reports { display:grid; gap:10px; }
    .report-row { display:flex; justify-content:space-between; gap:12px; align-items:center; background:#fff; border:1px solid var(--line); border-radius:8px; padding:12px; }
    .report-row .meta small { color:var(--muted); }
    .counts { font-size:12px; color:#52525b; margin-top:2px; }
    .badge { display:inline-flex; padding:5px 9px; border-radius:999px; font-size:12px; font-weight:900; white-space:nowrap; }
    .badge.PASS { background:#d1fae5; color:#065f46; }
    .badge.FAIL { background:#fee2e2; color:#991b1b; }
    .badge.WARN { background:#fef3c7; color:#92400e; }
    .badge.none { background:#e4e4e7; color:#3f3f46; }
    @media (max-width:720px) { header.top, .report-row { flex-direction:column; align-items:flex-start; } h1 { font-size:26px; } main { padding:22px 14px; } }
  </style>
</head>
<body>
  <div id="banner" class="banner" style="display:none">
    <span class="spinner"></span>
    <strong id="banner-label"></strong>
    <span class="banner-meta" id="banner-meta"></span>
    <a class="banner-link" href="#current">Voir le log ↓</a>
  </div>
  <main>
    <header class="top">
      <div>
        <h1>Tests de release Opatam</h1>
        <p class="muted">Interface locale uniquement — rien n'est déployé. Un seul test à la fois.</p>
      </div>
      <a class="link secondary" href="/reports/index.html">Page rapports</a>
    </header>

    <h3>Tests disponibles</h3>
    <section class="grid">
      ${tests.map((test) => `
        <article class="card ${test.destructive ? 'danger' : 'safe'}">
          <h2>
            ${escapeHtml(test.label)}
            <span class="tag ${test.destructive ? 'real' : 'safe'}">${test.destructive ? 'Données réelles' : 'Sans risque'}</span>
          </h2>
          <p class="desc">${escapeHtml(test.description)}</p>
          ${test.dangerNote ? `<p class="danger-note">${escapeHtml(test.dangerNote)}</p>` : ''}
          ${test.destructive ? `
            <label class="confirm">
              <input id="confirm-${test.id}" type="checkbox" onchange="onConfirmChange()">
              <span>Je comprends que ce test crée une vraie réservation réelle.</span>
            </label>` : ''}
          <div class="actions">
            <button class="run-btn ${test.destructive ? 'danger' : ''}" data-id="${test.id}" onclick="run('${test.id}')">Lancer</button>
            <a class="link secondary" href="/reports/${escapeHtml(test.report)}">Voir le rapport</a>
            <span class="run-status" id="status-${test.id}"></span>
          </div>
        </article>
      `).join('')}
    </section>

    <h3>Test en cours</h3>
    <section id="current" class="panel">
      <p class="muted" id="current-empty">Aucun test en cours. Lance un test ci-dessus.</p>
      <div id="current-active" style="display:none">
        <div class="panel-head">
          <span class="spinner" id="current-spinner"></span>
          <strong id="current-label"></strong>
          <span class="muted" id="current-state"></span>
        </div>
        <ol class="timeline" id="timeline"></ol>
        <p class="muted" id="current-msg"></p>
        <pre id="log"></pre>
      </div>
    </section>

    <h3>Derniers rapports</h3>
    <section id="reports" class="reports">
      <p class="muted">Chargement…</p>
    </section>
  </main>

  <script>
    let polling = null;

    function esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }

    async function loadReports() {
      const box = document.getElementById('reports');
      try {
        const reports = await fetch('/api/reports').then((r) => r.json());
        if (!reports.length) { box.innerHTML = '<p class="muted">Aucun rapport généré pour le moment.</p>'; return; }
        box.innerHTML = reports.map((r) => {
          const cls = r.verdict === 'PASS' ? 'PASS' : r.verdict === 'FAIL' ? 'FAIL' : r.verdict === 'WARN' ? 'WARN' : 'none';
          const c = r.counts || {};
          return '<div class="report-row"><div class="meta"><strong>' + esc(r.name) + '</strong>'
            + '<p class="muted" style="margin:4px 0 0">' + esc(r.summary) + '</p>'
            + '<div class="counts">' + (c.pass||0) + ' OK · ' + (c.fail||0) + ' échec · ' + (c.warn||0) + ' attention · ' + (c.skip||0) + ' ignoré</div>'
            + '<small>' + esc(r.generatedAt) + '</small></div>'
            + '<div class="actions"><span class="badge ' + cls + '">' + esc(r.labelVerdict) + '</span>'
            + '<a class="link secondary" href="' + esc(r.htmlHref) + '">Ouvrir</a></div></div>';
        }).join('');
      } catch { box.innerHTML = '<p class="muted">Impossible de charger les rapports.</p>'; }
    }

    let isRunning = false;
    let launchingId = null;

    function fmtElapsed(sec) {
      sec = Math.max(0, Math.floor(sec));
      if (sec < 60) return sec + ' s';
      const m = Math.floor(sec / 60), s = sec % 60;
      return m + ' min ' + String(s).padStart(2, '0') + ' s';
    }

    function setButtonsDisabled(disabled) {
      document.querySelectorAll('.run-btn').forEach((btn) => {
        const id = btn.dataset.id;
        const confirmBox = document.getElementById('confirm-' + id);
        btn.disabled = disabled || (confirmBox ? !confirmBox.checked : false);
      });
    }

    function setButtonLabels(runningId) {
      document.querySelectorAll('.run-btn').forEach((btn) => {
        btn.textContent = (runningId && btn.dataset.id === runningId) ? 'En cours…' : 'Lancer';
      });
    }

    function clearStatuses() {
      document.querySelectorAll('.run-status').forEach((el) => { el.textContent = ''; el.className = 'run-status'; });
    }

    function setStatus(id, text, kind) {
      const el = document.getElementById('status-' + id);
      if (el) { el.textContent = text; el.className = 'run-status' + (kind ? ' ' + kind : ''); }
    }

    function onConfirmChange() { if (!isRunning) setButtonsDisabled(false); }

    function renderTimeline(run) {
      const finished = run.running === false;
      const failed = run.phase === 'failed';
      const steps = [
        ['Commande préparée', 'done'],
        ['Processus lancé', 'done'],
        ['En attente de sortie', run.running ? (run.hasOutput ? 'done' : 'active') : 'done'],
        ['Rapport généré', finished ? 'done' : ''],
        ['Terminé', finished ? (failed ? 'fail' : 'done') : ''],
      ];
      document.getElementById('timeline').innerHTML = steps
        .map(([label, state]) => '<li class="' + state + '">' + esc(label) + '</li>')
        .join('');
    }

    function elapsedFrom(run) {
      if (run.startedAt) {
        const ms = Date.now() - new Date(run.startedAt).getTime();
        return run.running ? ms / 1000 : (run.elapsedSeconds != null ? run.elapsedSeconds : ms / 1000);
      }
      return run.elapsedSeconds || 0;
    }

    async function refreshState() {
      let run;
      try { run = await fetch('/api/run/current').then((r) => r.json()); }
      catch { run = { running: false }; }

      const banner = document.getElementById('banner');
      const empty = document.getElementById('current-empty');
      const active = document.getElementById('current-active');
      const spinner = document.getElementById('current-spinner');

      if (!run.testId && !launchingId) {
        banner.style.display = 'none';
        empty.style.display = '';
        active.style.display = 'none';
        isRunning = false;
        setButtonLabels(null);
        setButtonsDisabled(false);
        return run;
      }

      empty.style.display = 'none';
      active.style.display = '';
      isRunning = run.running === true;
      const id = run.testId || launchingId;
      const elapsed = run.testId ? fmtElapsed(elapsedFrom(run)) : '0 s';
      document.getElementById('current-label').textContent = run.label || id;
      if (run.testId) renderTimeline(run);

      const log = document.getElementById('log');
      const msg = document.getElementById('current-msg');

      if (run.running) {
        spinner.style.display = '';
        document.getElementById('current-state').textContent = 'En cours · ' + elapsed;
        log.textContent = (run.log && run.log.trim()) ? run.log : 'Aucune sortie pour l\\'instant, le test tourne toujours.';
        msg.textContent = run.message || '';
        banner.style.display = '';
        document.getElementById('banner-label').textContent = 'Test en cours : ' + (run.label || id);
        document.getElementById('banner-meta').textContent = 'démarré à ' + new Date(run.startedAt).toLocaleTimeString('fr-FR') + ' · ' + elapsed;
        setButtonLabels(id);
        setButtonsDisabled(true);
        setStatus(id, 'En cours · ' + elapsed, 'go');
      } else if (run.testId) {
        spinner.style.display = 'none';
        const ok = run.exitCode === 0;
        document.getElementById('current-state').textContent = 'Terminé en ' + elapsed + ' (code ' + run.exitCode + ')';
        log.textContent = (run.log && run.log.trim()) ? run.log : '(aucune sortie)';
        msg.textContent = '';
        banner.style.display = 'none';
        setButtonLabels(null);
        setButtonsDisabled(false);
        setStatus(run.testId, ok ? 'Terminé : réussi' : 'Terminé : échec', ok ? 'ok' : 'ko');
      }
      return run;
    }

    async function poll() {
      const run = await refreshState();
      if (run.testId && !run.running) { clearInterval(polling); polling = null; launchingId = null; loadReports(); }
    }

    async function run(id) {
      const confirmBox = document.getElementById('confirm-' + id);
      const confirmed = confirmBox ? confirmBox.checked : false;
      // Immediate visible feedback, before the server even answers.
      launchingId = id;
      clearStatuses();
      setStatus(id, 'Lancement…', 'go');
      setButtonLabels(id);
      setButtonsDisabled(true);
      const banner = document.getElementById('banner');
      banner.style.display = '';
      document.getElementById('banner-label').textContent = 'Test en cours : ' + id;
      document.getElementById('banner-meta').textContent = 'démarrage…';
      document.getElementById('current-empty').style.display = 'none';
      const active = document.getElementById('current-active');
      active.style.display = '';
      active.scrollIntoView({ behavior: 'smooth', block: 'start' });

      let response, payload;
      try {
        response = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, confirmed }) });
        payload = await response.json().catch(() => ({}));
      } catch { response = { ok: false }; payload = { error: 'Serveur injoignable.' }; }

      if (!response.ok) {
        launchingId = null;
        banner.style.display = 'none';
        setStatus(id, payload.error || 'Erreur', 'ko');
        setButtonLabels(null);
        setButtonsDisabled(false);
        alert(payload.error || 'Erreur au lancement.');
        return;
      }
      await refreshState();
      if (!polling) polling = setInterval(poll, 1000);
    }

    // On load: restore any in-progress run + load reports.
    (async () => {
      const run = await refreshState();
      if (run.running && !polling) polling = setInterval(poll, 1000);
      loadReports();
    })();
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${host}:${port}`);
  const { pathname } = url;

  if (req.method === 'GET' && pathname === '/') {
    send(res, 200, renderHome());
    return;
  }

  if (req.method === 'GET' && pathname === '/api/tests') {
    json(res, 200, tests.map(({ id, label, description, destructive, dangerNote, report }) => ({
      id, label, description, destructive, dangerNote: dangerNote || null, report,
    })));
    return;
  }

  if (req.method === 'GET' && pathname === '/api/reports') {
    json(res, 200, listReports());
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/reports/')) {
    const name = path.basename(pathname);
    const content = readReportFile(name.endsWith('.json') ? name : `${name}.json`);
    if (!content) { json(res, 404, { error: 'Rapport introuvable.' }); return; }
    send(res, 200, content, 'application/json; charset=utf-8');
    return;
  }

  if (req.method === 'GET' && pathname === '/api/run/current') {
    json(res, 200, publicRunState());
    return;
  }

  if (req.method === 'GET' && pathname.startsWith('/api/run/')) {
    const runId = decodeURIComponent(pathname.split('/').pop() || '');
    const found = (currentRun && currentRun.id === runId)
      ? currentRun
      : history.find((run) => run.id === runId);
    if (!found) { json(res, 404, { error: 'Exécution introuvable.' }); return; }
    json(res, 200, found);
    return;
  }

  // Reports are served as rendered HTML by default. Raw .json/.md remain
  // reachable for download but are never the primary view.
  if (req.method === 'GET' && pathname.startsWith('/reports/')) {
    const fileName = path.basename(pathname);
    const content = readReportFile(fileName);
    if (!content) { send(res, 404, 'Rapport introuvable', 'text/plain; charset=utf-8'); return; }
    const type = fileName.endsWith('.html') ? 'text/html; charset=utf-8'
      : fileName.endsWith('.json') ? 'application/json; charset=utf-8'
      : 'text/plain; charset=utf-8';
    send(res, 200, content, type);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/run') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const test = tests.find((item) => item.id === payload.id);
        if (!test) { json(res, 404, { error: 'Test introuvable.' }); return; }

        const result = startRun(test, payload.confirmed === true);
        if (result.busy) {
          json(res, 409, { error: 'Un test est déjà en cours. Attends sa fin avant d\'en lancer un autre.' });
          return;
        }
        if (result.error) { json(res, 400, result); return; }
        json(res, 200, result);
      } catch (error) {
        json(res, 500, { error: error.message });
      }
    });
    return;
  }

  send(res, 404, 'Introuvable', 'text/plain; charset=utf-8');
});

server.listen(port, host, () => {
  console.log(`Interface locale des tests : http://${host}:${port}`);
  console.log('Ctrl+C pour arrêter.');
});
