/*!
 * Opatam Embed — v1.1
 *
 * Tiny vanilla-JS loader that lets any website integrate the Opatam booking UI.
 * See https://opatam.com/pro/parametres?tab=widget for copy-paste snippets.
 *
 * Three modes:
 *   1. Inline  — <div data-opatam-embed="slug">   (auto-sized iframe inside the div)
 *   2. Popup   — <button data-opatam-popup="slug">  (opens a modal on click)
 *   3. Floating — <script data-opatam-floating="slug">  (fixed FAB bottom-right)
 *
 * Shared data-* options:
 *   data-primary   — hex color, with or without # (e.g. "#FF5733" or "FF5733")
 *   data-radius    — border radius in px (0-32)
 *   data-theme     — "light" | "dark" | "auto"
 *   data-service   — service id to preselect (skips the first step)
 *
 * Inline-only option:
 *   data-min-height — floor for the iframe height in px once the widget has
 *                     reported its size (default 160). Before the first
 *                     report the iframe keeps a 520px floor so a blocked
 *                     message never leaves an unusable strip.
 *
 * Floating-only options:
 *   data-label     — button text (default: "Réserver")
 *   data-position  — "bottom-right" | "bottom-left" | "top-right" | "top-left"
 */
(function () {
  'use strict';

  // ─── Resolve base URL from the <script> tag that loaded us ────────────────
  var currentScript = document.currentScript;
  if (!currentScript) {
    var scripts = document.getElementsByTagName('script');
    currentScript = scripts[scripts.length - 1];
  }
  var scriptSrc = (currentScript && currentScript.src) || '';
  var BASE_URL = scriptSrc.split('/embed.js')[0] || 'https://opatam.com';

  // ─── URL construction ─────────────────────────────────────────────────────
  function buildUrl(slug, options, mode) {
    var url = BASE_URL + '/p/' + encodeURIComponent(slug) + '/embed';
    var params = [];
    if (options.primary) {
      params.push('primary=' + encodeURIComponent(String(options.primary).replace(/^#/, '')));
    }
    if (options.radius != null && options.radius !== '') {
      params.push('radius=' + encodeURIComponent(options.radius));
    }
    if (options.theme) {
      params.push('theme=' + encodeURIComponent(options.theme));
    }
    // Pass mode so the embed page knows whether to show its mini-header (only in modal).
    if (mode === 'modal') {
      params.push('mode=modal');
    }
    if (options.service) {
      params.push('service=' + encodeURIComponent(options.service));
    }
    return params.length > 0 ? url + '?' + params.join('&') : url;
  }

  // ─── Iframe factory ───────────────────────────────────────────────────────
  function createIframe(slug, options, mode) {
    var iframe = document.createElement('iframe');
    iframe.src = buildUrl(slug, options, mode);
    iframe.setAttribute('title', 'Réservation');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('allow', 'payment; clipboard-write');
    iframe.setAttribute('data-opatam-slug', slug);
    iframe.setAttribute('data-opatam-mode', mode || 'inline');
    iframe.style.width = '100%';
    iframe.style.border = '0';
    iframe.style.display = 'block';
    iframe.style.background = 'transparent';
    if (mode !== 'modal') {
      // Plancher de sécurité tant que le widget n'a pas annoncé sa hauteur.
      iframe.style.minHeight = '520px';
      var floor = parseInt(options.minHeight, 10);
      iframe.setAttribute('data-opatam-floor', String(floor > 0 ? floor : 160));
    }
    return iframe;
  }

  // ─── Loader ───────────────────────────────────────────────────────────────
  // Le temps que le widget arrive, un visiteur voyait un rectangle blanc de
  // 520 px sans rien comprendre. On pose une attente discrète (spinner +
  // « Chargement de l'agenda… ») par-dessus l'iframe, et l'iframe reste
  // invisible jusqu'au signal « prêt » de la page embarquée — ou à sa première
  // hauteur annoncée, ou après 10 s quoi qu'il arrive (message bloqué : le
  // widget doit rester utilisable).
  function createLoader(options) {
    var color = options.primary
      ? (String(options.primary).charAt(0) === '#' ? options.primary : '#' + options.primary)
      : '#2563eb';
    var dark = options.theme === 'dark';
    var bg = dark ? '#0f172a' : '#ffffff';
    var bone = dark ? '#1e293b' : '#eef2f7';
    var sheen = dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)';
    var text = dark ? '#94a3b8' : '#64748b';

    var loader = document.createElement('div');
    loader.setAttribute('data-opatam-loader', '1');
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.style.cssText =
      'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'padding:24px;background:' + bg + ';color:' + text + ';' +
      'font:500 13px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
      'transition:opacity 0.3s ease-out;pointer-events:none;';

    // Le monogramme, au centre d'un anneau qui tourne dans la couleur du widget.
    var badge = document.createElement('div');
    badge.style.cssText = 'position:relative;width:72px;height:72px;margin-bottom:22px;';
    var ring = document.createElement('div');
    ring.style.cssText =
      'position:absolute;inset:0;border-radius:50%;' +
      'background:conic-gradient(from 0deg,' + color + ' 0 25%,transparent 25% 100%);' +
      '-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));' +
      'mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 3px));' +
      'animation:opatam-spin 1.1s linear infinite;';
    var disc = document.createElement('div');
    disc.style.cssText =
      'position:absolute;inset:8px;border-radius:50%;background:' + (dark ? '#1e293b' : '#f8fafc') + ';' +
      'display:flex;align-items:center;justify-content:center;animation:opatam-breathe 1.6s ease-in-out infinite;';
    var logo = document.createElement('img');
    logo.src = BASE_URL + '/logo-opatam.png';
    logo.alt = '';
    logo.setAttribute('aria-hidden', 'true');
    logo.style.cssText = 'width:38px;height:38px;object-fit:contain;' + (dark ? 'filter:brightness(0) invert(1);' : '');
    disc.appendChild(logo);
    badge.appendChild(ring);
    badge.appendChild(disc);
    loader.appendChild(badge);

    // Une esquisse de l'agenda qui arrive : trois lignes de prestations qui
    // scintillent. Le visiteur comprend ce qu'il attend.
    var sketch = document.createElement('div');
    sketch.style.cssText = 'width:min(100%,360px);display:flex;flex-direction:column;gap:10px;margin-bottom:22px;';
    function bone_(w, h, extra) {
      var b = document.createElement('div');
      b.style.cssText =
        'height:' + h + 'px;width:' + w + ';border-radius:6px;background:' + bone + ';position:relative;overflow:hidden;' + (extra || '');
      var shine = document.createElement('div');
      shine.style.cssText =
        'position:absolute;inset:0;transform:translateX(-100%);' +
        'background:linear-gradient(90deg,transparent,' + sheen + ',transparent);' +
        'animation:opatam-shimmer 1.4s ease-in-out infinite;';
      b.appendChild(shine);
      return b;
    }
    sketch.appendChild(bone_('46%', 12, 'margin-bottom:4px;'));
    for (var i = 0; i < 3; i++) {
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:12px;';
      row.appendChild(bone_('44px', 44, 'flex:0 0 44px;border-radius:10px;'));
      var lines = document.createElement('div');
      lines.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:7px;';
      lines.appendChild(bone_((62 - i * 8) + '%', 11));
      lines.appendChild(bone_('38%', 9));
      row.appendChild(lines);
      row.appendChild(bone_('48px', 22, 'flex:0 0 48px;border-radius:999px;'));
      sketch.appendChild(row);
    }
    loader.appendChild(sketch);

    // Le mot, puis une barre qui avance sans fin dans la couleur du widget.
    var label = document.createElement('div');
    label.textContent = 'Votre agenda arrive…';
    label.style.cssText = 'margin-bottom:10px;letter-spacing:0.01em;';
    loader.appendChild(label);
    var bar = document.createElement('div');
    bar.style.cssText = 'width:140px;height:3px;border-radius:999px;background:' + bone + ';overflow:hidden;';
    var fill = document.createElement('div');
    fill.style.cssText =
      'width:40%;height:100%;border-radius:999px;background:' + color + ';' +
      'animation:opatam-slide 1.2s ease-in-out infinite;';
    bar.appendChild(fill);
    loader.appendChild(bar);
    return loader;
  }

  function attachLoader(container, iframe, options) {
    var loader = createLoader(options);
    container.appendChild(loader);
    iframe.style.opacity = '0';
    iframe.style.transition = 'opacity 0.25s ease-out';
    var done = false;
    function reveal() {
      if (done) return;
      done = true;
      iframe.style.opacity = '1';
      loader.style.opacity = '0';
      setTimeout(function () { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 300);
    }
    iframe.setAttribute('data-opatam-loading', '1');
    iframe.__opatamReveal = reveal;
    setTimeout(reveal, 10000);
  }

  function revealIframe(iframe) {
    if (iframe && typeof iframe.__opatamReveal === 'function') iframe.__opatamReveal();
  }

  // ─── Messages from the embedded page ──────────────────────────────────────
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'opatam-embed-ready') {
      var readyFrames = document.querySelectorAll('iframe[data-opatam-slug]');
      for (var r = 0; r < readyFrames.length; r++) {
        if (readyFrames[r].contentWindow === event.source) revealIframe(readyFrames[r]);
      }
      return;
    }
    if (data.type !== 'opatam-embed-height') return;
    var height = data.height;
    if (typeof height !== 'number' || height <= 0) return;

    // Match the iframe that sent this by comparing contentWindow references
    var iframes = document.querySelectorAll('iframe[data-opatam-slug]');
    for (var i = 0; i < iframes.length; i++) {
      var iframe = iframes[i];
      if (iframe.contentWindow !== event.source) continue;
      revealIframe(iframe);
      var h = Math.ceil(height);
      if (iframe.getAttribute('data-opatam-mode') === 'modal') {
        // La boîte de la modale suit le contenu : plus de moitié vide à la
        // dernière étape. Plafond à l'écran, plancher pour rester lisible.
        var box = iframe.parentElement;
        if (box && box.getAttribute('data-opatam-frame') === '1') {
          box.style.height = 'min(90vh,' + Math.max(320, h) + 'px)';
        }
        return;
      }
      // Première mesure reçue : le plancher de sécurité laisse place au
      // plancher réel (data-min-height, 160 par défaut). Le widget peut alors
      // aussi rétrécir — une étape courte ne laisse plus de vide.
      var floor = iframe.getAttribute('data-opatam-floor');
      if (floor) {
        iframe.style.minHeight = floor + 'px';
      }
      iframe.style.height = h + 'px';
      return;
    }
  });

  // ─── Inline mode ──────────────────────────────────────────────────────────
  function initInline() {
    var targets = document.querySelectorAll('[data-opatam-embed]');
    for (var i = 0; i < targets.length; i++) {
      var target = targets[i];
      if (target.getAttribute('data-opatam-initialized') === '1') continue;
      var slug = target.getAttribute('data-opatam-embed');
      if (!slug) continue;
      var options = readOptions(target);
      var iframe = createIframe(slug, options, 'inline');
      var holder = document.createElement('div');
      holder.style.cssText = 'position:relative;';
      holder.appendChild(iframe);
      target.innerHTML = '';
      target.appendChild(holder);
      attachLoader(holder, iframe, options);
      target.setAttribute('data-opatam-initialized', '1');
    }
  }

  // ─── Popup mode ───────────────────────────────────────────────────────────
  function initPopup() {
    var triggers = document.querySelectorAll('[data-opatam-popup]');
    for (var i = 0; i < triggers.length; i++) {
      var trigger = triggers[i];
      if (trigger.getAttribute('data-opatam-initialized') === '1') continue;
      var slug = trigger.getAttribute('data-opatam-popup');
      if (!slug) continue;
      var options = readOptions(trigger);
      trigger.setAttribute('data-opatam-initialized', '1');
      // Closure capture
      (function (s, o) {
        trigger.addEventListener('click', function (e) {
          e.preventDefault();
          openModal(s, o);
        });
      })(slug, options);
    }
  }

  // ─── Floating FAB mode ────────────────────────────────────────────────────
  function initFloating() {
    var scripts = document.querySelectorAll('script[data-opatam-floating]');
    for (var i = 0; i < scripts.length; i++) {
      var script = scripts[i];
      if (script.getAttribute('data-opatam-initialized') === '1') continue;
      var slug = script.getAttribute('data-opatam-floating');
      if (!slug) continue;
      script.setAttribute('data-opatam-initialized', '1');

      var label = script.getAttribute('data-label') || 'Réserver';
      var position = script.getAttribute('data-position') || 'bottom-right';
      var options = readOptions(script);
      var bgColor = options.primary
        ? (String(options.primary).charAt(0) === '#' ? options.primary : '#' + options.primary)
        : '#2563eb';

      var fab = document.createElement('button');
      fab.type = 'button';
      fab.textContent = label;
      fab.setAttribute('aria-label', label);
      fab.style.cssText =
        'position:fixed;z-index:9999;padding:14px 22px;' +
        'background:' + bgColor + ';color:#fff;border:0;border-radius:9999px;' +
        'font:600 14px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
        'box-shadow:0 10px 30px -8px rgba(0,0,0,0.35);cursor:pointer;' +
        'transition:transform 0.15s ease-out,box-shadow 0.15s ease-out;' +
        positionStyle(position);

      fab.addEventListener('mouseenter', function () {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 15px 35px -8px rgba(0,0,0,0.4)';
      });
      fab.addEventListener('mouseleave', function () {
        this.style.transform = '';
        this.style.boxShadow = '0 10px 30px -8px rgba(0,0,0,0.35)';
      });

      (function (s, o) {
        fab.addEventListener('click', function () {
          openModal(s, o);
        });
      })(slug, options);

      document.body.appendChild(fab);
    }
  }

  function positionStyle(position) {
    switch (position) {
      case 'bottom-left':
        return 'bottom:24px;left:24px;';
      case 'top-right':
        return 'top:24px;right:24px;';
      case 'top-left':
        return 'top:24px;left:24px;';
      default:
        return 'bottom:24px;right:24px;';
    }
  }

  // ─── Modal (used by popup + floating modes) ───────────────────────────────
  function openModal(slug, options) {
    var radius = options.radius != null && options.radius !== ''
      ? parseInt(options.radius, 10) || 12
      : 12;

    var overlay = document.createElement('div');
    overlay.setAttribute('data-opatam-modal', '1');
    overlay.style.cssText =
      'position:fixed;inset:0;z-index:10000;' +
      'background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);' +
      'display:flex;align-items:center;justify-content:center;padding:16px;' +
      'animation:opatam-fade-in 0.2s ease-out;';

    var frame = document.createElement('div');
    frame.setAttribute('data-opatam-frame', '1');
    // Hauteur initiale pleine, puis ajustée au contenu à chaque étape via le
    // message de hauteur du widget (voir le listener plus haut).
    frame.style.cssText =
      'position:relative;width:100%;max-width:900px;height:min(90vh,900px);' +
      'background:#fff;border-radius:' + radius + 'px;overflow:hidden;' +
      'box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);' +
      'transition:height 0.25s ease-out;' +
      'animation:opatam-pop-in 0.25s cubic-bezier(.2,.9,.3,1.2);';

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.cssText =
      'position:absolute;top:10px;right:10px;z-index:2;' +
      'width:36px;height:36px;border:0;border-radius:50%;' +
      'background:rgba(255,255,255,0.92);color:#111;' +
      'font:400 24px/1 system-ui,-apple-system,sans-serif;' +
      'cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.15);';

    var iframe = createIframe(slug, options, 'modal');
    iframe.style.width = '100%';
    iframe.style.height = '100%';

    frame.appendChild(iframe);
    attachLoader(frame, iframe, options);
    frame.appendChild(closeBtn);
    overlay.appendChild(frame);

    function close() {
      overlay.remove();
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onEsc);
    }
    function onEsc(e) {
      if (e.key === 'Escape') close();
    }

    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', onEsc);

    var prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.appendChild(overlay);
  }

  // ─── Read data-* options from an element ──────────────────────────────────
  function readOptions(el) {
    return {
      primary: el.getAttribute('data-primary'),
      radius: el.getAttribute('data-radius'),
      theme: el.getAttribute('data-theme'),
      service: el.getAttribute('data-service'),
      minHeight: el.getAttribute('data-min-height'),
    };
  }

  // ─── Inject CSS animations once ───────────────────────────────────────────
  if (!document.getElementById('opatam-embed-style')) {
    var style = document.createElement('style');
    style.id = 'opatam-embed-style';
    style.textContent =
      '@keyframes opatam-fade-in{from{opacity:0}to{opacity:1}}' +
      '@keyframes opatam-pop-in{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}' +
      '@keyframes opatam-spin{to{transform:rotate(360deg)}}' +
      '@keyframes opatam-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}' +
      '@keyframes opatam-shimmer{to{transform:translateX(100%)}}' +
      '@keyframes opatam-slide{0%{transform:translateX(-120%)}100%{transform:translateX(320%)}}' +
      '@media (prefers-reduced-motion:reduce){[data-opatam-loader] *{animation-duration:2.5s!important}}';
    document.head.appendChild(style);
  }

  // ─── Kick it off ──────────────────────────────────────────────────────────
  function init() {
    initInline();
    initPopup();
    initFloating();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Public API for programmatic use ──────────────────────────────────────
  window.Opatam = window.Opatam || {};
  window.Opatam.open = function (slug, options) {
    openModal(slug, options || {});
  };
  window.Opatam.refresh = init;
})();
