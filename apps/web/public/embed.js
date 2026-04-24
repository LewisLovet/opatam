/*!
 * Opatam Embed — v1
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
      iframe.style.minHeight = '520px';
    }
    return iframe;
  }

  // ─── Auto-size inline iframes via postMessage ─────────────────────────────
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'opatam-embed-height') return;
    var height = data.height;
    if (typeof height !== 'number' || height <= 0) return;

    // Match the iframe that sent this by comparing contentWindow references
    var iframes = document.querySelectorAll('iframe[data-opatam-slug]');
    for (var i = 0; i < iframes.length; i++) {
      var iframe = iframes[i];
      if (iframe.contentWindow !== event.source) continue;
      // Don't auto-size iframes inside a modal — those fill their container
      if (iframe.getAttribute('data-opatam-mode') === 'modal') return;
      iframe.style.height = Math.ceil(height) + 'px';
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
      target.innerHTML = '';
      target.appendChild(iframe);
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
    frame.style.cssText =
      'position:relative;width:100%;max-width:900px;height:min(90vh,900px);' +
      'background:#fff;border-radius:' + radius + 'px;overflow:hidden;' +
      'box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);' +
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

    frame.appendChild(closeBtn);
    frame.appendChild(iframe);
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
    };
  }

  // ─── Inject CSS animations once ───────────────────────────────────────────
  if (!document.getElementById('opatam-embed-style')) {
    var style = document.createElement('style');
    style.id = 'opatam-embed-style';
    style.textContent =
      '@keyframes opatam-fade-in{from{opacity:0}to{opacity:1}}' +
      '@keyframes opatam-pop-in{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}';
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
