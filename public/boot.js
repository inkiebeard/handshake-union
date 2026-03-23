(function () {
  var SKIP_KEY = 'hu_skip_intro';

  /* Skip immediately if user has opted out — guarded for private-browsing / quota errors */
  var skipIntro = false;
  try {
    if (typeof localStorage !== 'undefined') {
      skipIntro = localStorage.getItem(SKIP_KEY) === '1';
    }
  } catch (_) { skipIntro = false; }

  if (skipIntro) {
    var s = document.getElementById('boot-screen');
    if (s) s.remove();
    document.body.classList.add('boot-reveal');
    return;
  }

  /* Skip on reduced-motion */
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var s2 = document.getElementById('boot-screen');
    if (s2) s2.remove();
    document.body.classList.add('boot-reveal');
    return;
  }

  var CMD = 'handshakeunion --nexus --open';

  /* ── Timezone-based region detection (no permissions required) ── */
  var _tz = '';
  try { _tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
  var _cont = _tz.split('/')[0];
  var _off  = new Date().getTimezoneOffset(); /* +ve = behind UTC */
  var _region = 'emea'; /* default */
  if (_cont === 'America' || _cont === 'US' || _cont === 'Canada') {
    _region = (_off >= 360) ? 'amer-west' : 'amer-east';
  } else if (_cont === 'Asia' || _cont === 'Australia' || _cont === 'Indian') {
    _region = 'apac';
  } else if (_cont === 'Pacific') {
    _region = (_off > 0) ? 'amer-west' : 'apac';
  }
  /* Europe / Africa / Atlantic / Arctic → emea (already default) */

  /* ── Build relay probe frames for detected region ── */
  function buildRelayEntry(region) {
    /* Each set: [displayName (18 chars padded), latencyStr (5 chars)] */
    var sets = {
      'amer-east': [['relay-us-east-01  ', ' 12ms'], ['relay-eu-west-02  ', ' 87ms'], ['relay-ap-south-01 ', '168ms']],
      'amer-west': [['relay-us-west-02  ', ' 11ms'], ['relay-us-east-01  ', ' 58ms'], ['relay-ap-north-01 ', '134ms']],
      'emea':      [['relay-eu-west-01  ', ' 14ms'], ['relay-us-east-03  ', ' 67ms'], ['relay-ap-south-01 ', '141ms']],
      'apac':      [['relay-ap-south-01 ', ' 11ms'], ['relay-eu-west-02  ', '143ms'], ['relay-us-west-02  ', '168ms']]
    };
    var rs = sets[region] || sets['emea'];
    var F = '\u2588', E = '\u2591'; /* █ ░ */
    function bar(n) { return F.repeat(n) + E.repeat(10 - n); }
    function row(r, n, status) {
      return '  ' + r[0] + '  ' + r[1] + '   ' + bar(n) + '  [' + status + ']';
    }
    function d(s) { return '<div class="b-d">' + s + '</div>'; }
    return { replace: true, frameDelay: 88, frames: [
      rs.map(function (r) { return d(row(r, 0, 'probing\u2026')); }).join(''),
      d(row(rs[0], 3, 'probing\u2026')) + rs.slice(1).map(function (r) { return d(row(r, 0, 'probing\u2026')); }).join(''),
      d(row(rs[0], 6, 'probing\u2026')) + rs.slice(1).map(function (r) { return d(row(r, 0, 'probing\u2026')); }).join(''),
      d(row(rs[0], 9, 'selected'))      + d(row(rs[1], 2, 'probing\u2026')) + d(row(rs[2], 0, 'probing\u2026')),
      d(row(rs[0], 10, 'selected') + ' \u2713') + d(row(rs[1], 4, 'standby'))  + d(row(rs[2], 2, 'standby'))
    ]};
  }

  var LINES = [
    '> initializing nexus gateway...',
    { replace: true, frameDelay: 42, frames: [
      '<span class="b-d">  loading cryptographic suite: ecdsa-p256</span>',
      '<span class="b-d">  loading cryptographic suite: ecdsa-p256 &middot; curve25519</span>',
      '<span class="b-d">  loading cryptographic suite: ecdsa-p256 &middot; curve25519 &middot; chacha20-poly1305</span>',
      '<span class="b-d">  loading cryptographic suite: ecdsa-p256 &middot; curve25519 &middot; chacha20-poly1305 &middot; sha-256</span>'
    ]},
    '> establishing TLS 1.3 handshake sequence',
    { replace: true, frameDelay: 115, frames: [
      '<div class="b-d">  ClientHello        &rarr;  [sent]</div>',
      '<div class="b-d">  ClientHello        &rarr;  [sent]</div><div class="b-d">  ServerHello        &larr;  [recv]  cipher=TLS_AES_256_GCM_SHA384</div>',
      '<div class="b-d">  ClientHello        &rarr;  [sent]</div><div class="b-d">  ServerHello        &larr;  [recv]  cipher=TLS_AES_256_GCM_SHA384</div><div class="b-d">  Certificate        &larr;  [recv]  subject=nexus.handshakeunion.internal</div>',
      '<div class="b-d">  ClientHello        &rarr;  [sent]</div><div class="b-d">  ServerHello        &larr;  [recv]  cipher=TLS_AES_256_GCM_SHA384</div><div class="b-d">  Certificate        &larr;  [recv]  subject=nexus.handshakeunion.internal</div><div class="b-d">  CertificateVerify  &larr;  [recv]  sig=ecdsa-sha256-p256</div>',
      '<div class="b-d">  ClientHello        &rarr;  [sent]</div><div class="b-d">  ServerHello        &larr;  [recv]  cipher=TLS_AES_256_GCM_SHA384</div><div class="b-d">  Certificate        &larr;  [recv]  subject=nexus.handshakeunion.internal</div><div class="b-d">  CertificateVerify  &larr;  [recv]  sig=ecdsa-sha256-p256</div><div class="b-d">  Finished           &harr;  [ok]</div>'
    ]},
    '<span class="b-a">  handshake complete &#10003;</span>',
    '> verifying X.509 certificate chain  depth=3',
    '<span class="b-d">  &#9500;&#9472; root CA      : handshakeunion.nexus              [valid]</span>',
    '<span class="b-d">  &#9500;&#9472; intermediate : nexus-gate-01.internal            [valid]</span>',
    '<span class="b-d">  &#9492;&#9472; leaf          : worker-relay-cluster-09           [valid]</span>',
    '<span class="b-a">  certificate chain verified &#10003;</span>',
    '> seeding entropy pool  /dev/urandom  256-bit',
    '> key derivation: HKDF-SHA256  salt=0x9a3fc1&hellip;  info="nexus-v3-session"',
    '<span class="b-a">  AES-256-GCM session key established &#10003;</span>',
    '> running human presence verification  HPV/2.4',
    '<span class="b-w">  [HPV] phase 1 &mdash; temporal cadence analysis</span>',
    '<span class="b-d">         keystroke entropy  :  847ms variance    threshold &ge;200ms    PASS &#10003;</span>',
    '<span class="b-w">  [HPV] phase 2 &mdash; zero-retention behavioral hashing</span>',
    '<span class="b-d">         mouse jitter coefficient   :  0.34     threshold &le;0.80     PASS &#10003;</span>',
    '<span class="b-d">         scroll velocity variance   :  112ms    threshold &ge;80ms     PASS &#10003;</span>',
    '<span class="b-d">         focus&ndash;blur cadence delta  :  294ms    threshold &ge;120ms    PASS &#10003;</span>',
    '<span class="b-w">  [HPV] phase 3 &mdash; interaction graph diffusion scoring</span>',
    '<span class="b-d">         graph similarity score  :  0.12    bot threshold &ge;0.78    PASS &#10003;</span>',
    '<span class="b-d">         temporal autocorrelation :  0.07    bot threshold &ge;0.60    PASS &#10003;</span>',
    { replace: true, frameDelay: 62, frames: [
      '<span class="b-a">  [HPV] verdict: HUMAN  confidence=71.2% &hellip;</span>',
      '<span class="b-a">  [HPV] verdict: HUMAN  confidence=85.4% &hellip;</span>',
      '<span class="b-a">  [HPV] verdict: HUMAN  confidence=94.1% &hellip;</span>',
      '<span class="b-a">  [HPV] verdict: HUMAN  confidence=98.7% &#10003;</span>'
    ]},
    '<span class="b-d">         behavioural hash discarded  [zero-retention policy enforced]</span>',
    '> probing relay network&hellip;',
    buildRelayEntry(_region),
    '> loading ephemeral messaging backbone',
    '<span class="b-d">  TTL policy    : 72h hard-delete on schedule</span>',
    '<span class="b-d">  receipt store : sha-256 hash only  (original content never retained)</span>',
    '<span class="b-d">  broadcast     : realtime pub/sub  channel-per-room</span>',
    '<span class="b-d">  rate limiter  : 1 msg / 3s per session  (enforced server-side)</span>',
    '> validating public-key infrastructure',
    '<span class="b-d">  ECDSA P-256 signature verification     &#10003;</span>',
    '<span class="b-d">  certificate-pinning hash match         &#10003;  0x4f2e9ab1&hellip;</span>',
    '<span class="b-d">  OCSP staple status                     &#10003;  not-revoked</span>',
    '> initializing aggregate stats engine',
    '<span class="b-d">  salary distribution index    : loaded  (n=412)</span>',
    '<span class="b-d">  role distribution index      : loaded  (n=412)</span>',
    '<span class="b-d">  experience cohort index      : loaded  (n=412)</span>',
    '<span class="b-d">  privacy guard                : n&lt;30 = hidden  &#10003;</span>',
    '> mounting pseudonym namespace',
    '<span class="b-d">  entropy space : 16^6 = 16,777,216 unique handles</span>',
    '<span class="b-d">  formats       : worker_* &middot; debug_* &middot; node_* &middot; void_* &middot; pixel_* &middot; flux_*</span>',
    '> enforcing row-level security policies',
    '<span class="b-d">  profiles  : own-row read only</span>',
    '<span class="b-d">  messages  : authenticated read &middot; own write</span>',
    '<span class="b-d">  receipts  : deny ALL  (system-level only)</span>',
    '<span class="b-d">  functions : search_path hardened</span>',
    '<span class="b-a">  RLS enforced &#10003;</span>',
    '> verifying union manifest',
    '<span class="b-d">  verified workers   :  412</span>',
    '<span class="b-d">  active sessions    :   31</span>',
    '<span class="b-d">  messages in flight :  847  (ephemeral &middot; 72h TTL)</span>',
    '&nbsp;',
    '<span class="b-a">  all systems nominal.</span>',
    '<span class="b-b">  opening nexus&hellip;</span>'
  ];

  var cmdEl  = document.getElementById('b-cmd');
  var curEl  = document.getElementById('b-cur');
  var outEl  = document.getElementById('b-out');
  var screen = document.getElementById('boot-screen');

  /* Safety net: reveal app after max 12 s if animation stalls */
  var revealed = false;
  function reveal() {
    if (revealed) return;
    revealed = true;
    document.removeEventListener('keydown', skipHandler);
    if (screen) screen.classList.add('b-out');
    document.body.classList.add('boot-reveal');
    setTimeout(function () { if (screen) screen.remove(); }, 650);
  }
  setTimeout(reveal, 12000);

  /* Skip handler — s / Escape saves preference and jumps straight to app */
  function skipHandler(e) {
    if (e.key === 's' || e.key === 'S' || e.key === 'Escape') {
      try { localStorage.setItem(SKIP_KEY, '1'); } catch (_) {}
      if (spinTimer) clearInterval(spinTimer);
      reveal();
    }
  }
  document.addEventListener('keydown', skipHandler);

  /* Show skip hint after command is fully typed */
  function showHint() {
    var h = document.getElementById('b-hint');
    if (h) h.style.display = 'block';
  }

  /* Phase 1: type the command character by character */
  var ci = 0;
  function typeChar() {
    if (ci < CMD.length) {
      cmdEl.textContent += CMD[ci++];
      setTimeout(typeChar, 44 + (Math.random() * 26 - 13));
    } else {
      curEl.classList.add('b-off');
      showHint();
      setTimeout(startLines, 210);
    }
  }
  setTimeout(typeChar, 280);

  /* Phase 2: stream jargon lines — strings append, replace-objects animate in-place */
  var li = 0;
  function nextLine() {
    if (li >= LINES.length) { startSpinner(); return; }
    var entry = LINES[li++];
    var el = document.createElement('div');
    outEl.appendChild(el);
    outEl.scrollTop = outEl.scrollHeight;
    if (typeof entry === 'string') {
      el.innerHTML = entry;
      var isHeader = entry.charAt(0) === '>';
      var base   = isHeader ? 55 : 14;
      setTimeout(nextLine, base + Math.random() * 28);
    } else {
      /* replace-in-place: cycle frames on the same container div */
      el.innerHTML = entry.frames[0];
      var fi = 1;
      var fd = entry.frameDelay || 80;
      var tick = function () {
        if (fi >= entry.frames.length) {
          setTimeout(nextLine, 14 + Math.random() * 28);
          return;
        }
        el.innerHTML = entry.frames[fi++];
        outEl.scrollTop = outEl.scrollHeight;
        setTimeout(tick, fd);
      };
      setTimeout(tick, fd);
    }
  }
  function startLines() { nextLine(); }

  /* Phase 3: ASCII spinner then 300 ms pause, then reveal */
  var spinFrames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  var spinLabels = [
    'loading bundle…',
    'mounting filesystem…',
    'resolving entry point…',
    'hydrating app…'
  ];
  var spinIdx = 0, spinLabelIdx = 0, spinTimer;
  function startSpinner() {
    var row   = document.getElementById('b-spinner-row');
    var spinEl = document.getElementById('b-spin');
    var lblEl  = document.getElementById('b-spin-label');
    if (!row) { scheduleReveal(); return; }
    row.style.display = 'block';
    lblEl.textContent = spinLabels[0];
    spinTimer = setInterval(function () {
      spinEl.textContent = spinFrames[spinIdx % spinFrames.length];
      spinIdx++;
      /* Cycle label every ~8 frames */
      if (spinIdx % 8 === 0 && spinLabelIdx < spinLabels.length - 1) {
        spinLabelIdx++;
        lblEl.textContent = spinLabels[spinLabelIdx];
      }
    }, 80);
    /* Run spinner for ~900 ms then 300 ms blank pause then reveal */
    setTimeout(function () {
      clearInterval(spinTimer);
      spinEl.textContent = '✓';
      lblEl.textContent = 'ready.';
      setTimeout(reveal, 300);
    }, 900);
  }
  function scheduleReveal() { setTimeout(reveal, 300); }
})();
