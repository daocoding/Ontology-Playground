/*!
 * Elements of Software — an animated cutaway explainer
 *
 * A plain-JavaScript, dependency-free scene that explains the
 * "Elements of Software" ontology (catalogue/community/daocoding/
 * elements-of-software) to people who have never read an ontology.
 * Every entity type gets a room in a cutaway building; the camera tours
 * the rooms and a caption card names the entity types and relationships
 * the visitor is looking at. The last stop fades the building into the
 * ontology graph itself.
 *
 * Usage:
 *   <div id="eos-scene" style="height:100vh"></div>
 *   <script src="elements-of-software.js"></script>
 *
 * Any element with id="eos-scene" or a data-eos-scene attribute is mounted
 * automatically. To mount by hand:
 *   ElementsOfSoftware.mount(element, { autoplay: true, mapUrl: '…' });
 *
 * Everything is drawn with the Canvas 2D API at runtime: no images, fonts,
 * libraries or network requests.
 *
 * MIT licensed, like the Ontology Playground it explains.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // The ontology (mirrors elements-of-software/ontology.rdf)
  // ---------------------------------------------------------------------------

  var ENTITIES = {
    Party:        { icon: '🎭', color: '#5C2D91', props: ['partyId', 'displayName'] },
    Person:       { icon: '👤', color: '#3498DB', props: ['fullName', 'emailAddress', 'phone'], parent: 'Party' },
    Organization: { icon: '🏢', color: '#2E86AB', props: ['legalName', 'webDomain', 'size'], parent: 'Party' },
    Agent:        { icon: '🤖', color: '#8E44AD', props: ['model', 'purpose', 'autonomyLevel'], parent: 'Party' },
    Role:         { icon: '🎫', color: '#9B59B6', props: ['kind', 'validFrom', 'validTo'] },
    Team:         { icon: '👥', color: '#16A085', props: ['teamName', 'focus'] },
    Project:      { icon: '📁', color: '#27AE60', props: ['projectName', 'status', 'startedAt'] },
    Task:         { icon: '✅', color: '#2ECC71', props: ['title', 'status', 'priority', 'dueAt'] },
    Document:     { icon: '📄', color: '#95A5A6', props: ['title', 'kind', 'updatedAt'] },
    Product:      { icon: '🧩', color: '#F39C12', props: ['productName', 'kind', 'price'] },
    Deal:         { icon: '💼', color: '#E67E22', props: ['stage', 'amount', 'probability'] },
    Subscription: { icon: '🔁', color: '#D4A017', props: ['status', 'startedAt', 'renewsAt'] },
    Invoice:      { icon: '🧾', color: '#C0A062', props: ['invoiceNumber', 'amount', 'status', 'dueDate'] },
    Payment:      { icon: '💳', color: '#B7950B', props: ['amount', 'method', 'paidAt'] },
    Interaction:  { icon: '💬', color: '#E91E8C', props: ['channel', 'direction', 'occurredAt', 'summary'] },
    SavedView:    { icon: '🗂️', color: '#7F8C8D', props: ['viewName', 'layout', 'filterQuery'] },
    Automation:   { icon: '⚙️', color: '#34495E', props: ['trigger', 'condition', 'action', 'enabled'] },
    Permission:   { icon: '🔐', color: '#5D6D7E', props: ['level', 'resourceKind'] },
    AuditEvent:   { icon: '📜', color: '#909497', props: ['verb', 'occurredAt', 'resourceKind', 'detail'] }
  };

  // [from, label, to]
  var RELATIONS = [
    ['Agent', 'operated by', 'Party'],
    ['Party', 'plays', 'Role'],
    ['Role', 'at', 'Organization'],
    ['Team', 'part of', 'Organization'],
    ['Person', 'member of', 'Team'],
    ['Project', 'owned by', 'Team'],
    ['Task', 'belongs to', 'Project'],
    ['Task', 'subtask of', 'Task'],
    ['Task', 'assigned to', 'Party'],
    ['Document', 'attached to', 'Project'],
    ['Document', 'authored by', 'Party'],
    ['Deal', 'with', 'Party'],
    ['Deal', 'for', 'Product'],
    ['Subscription', 'held by', 'Party'],
    ['Subscription', 'for', 'Product'],
    ['Invoice', 'bills', 'Subscription'],
    ['Payment', 'settles', 'Invoice'],
    ['Interaction', 'involves', 'Party'],
    ['Interaction', 'regarding', 'Deal'],
    ['SavedView', 'created by', 'Party'],
    ['Automation', 'maintained by', 'Party'],
    ['Automation', 'creates', 'Task'],
    ['Permission', 'granted to', 'Party'],
    ['AuditEvent', 'performed by', 'Party']
  ];

  // ---------------------------------------------------------------------------
  // The building (world units; the whole drawing is W x H)
  // ---------------------------------------------------------------------------

  var W = 1800, H = 1420;
  var X0 = 180, X1 = 1620;
  var FLOORS = [300, 520, 740, 960, 1180];
  var GROUND = 1180;

  function room(id, name, ent, x, y, w, h, step) {
    return { id: id, name: name, ent: ent, x: x, y: y, w: w, h: h, step: step };
  }

  var ROOMS = [
    room('party',   'Party Hall',     'Party',        180,  300, 460, 220, 1),
    room('role',    'Role Desk',      'Role',         640,  300, 320, 220, 3),
    room('team',    'Team Room',      'Team',         960,  300, 330, 220, 4),
    room('perm',    'Permissions',    'Permission',   1290, 300, 330, 220, 14),
    room('project', 'Projects',       'Project',      180,  520, 300, 220, 5),
    room('task',    'Task Line',      'Task',         480,  520, 570, 220, 6),
    room('auto',    'Automation',     'Automation',   1050, 520, 270, 220, 7),
    room('doc',     'Documents',      'Document',     1320, 520, 300, 220, 8),
    room('product', 'Products',       'Product',      180,  740, 290, 220, 9),
    room('deal',    'Deal Pipeline',  'Deal',         470,  740, 570, 220, 10),
    room('inter',   'Interactions',   'Interaction',  1040, 740, 300, 220, 11),
    room('view',    'Saved Views',    'SavedView',    1340, 740, 280, 220, 13),
    room('sub',     'Subscriptions',  'Subscription', 180,  960, 380, 220, 12),
    room('inv',     'Invoices',       'Invoice',      560,  960, 340, 220, 12),
    room('pay',     'Payments',       'Payment',      900,  960, 320, 220, 12),
    room('lobby',   'Lobby',          null,           1220, 960, 400, 220, 0),
    room('audit',   'Audit Vault',    'AuditEvent',   300,  1196, 1200, 170, 15)
  ];

  // Where each entity type "lives" in the drawing, for the graph overlay.
  var ANCHORS = {
    Party: [410, 352], Person: [292, 470], Organization: [410, 470], Agent: [528, 470],
    Role: [790, 380], Team: [1125, 370], Permission: [1440, 380],
    Project: [320, 610], Task: [760, 650], Automation: [1185, 625], Document: [1470, 620],
    Product: [325, 845], Deal: [755, 850], Interaction: [1190, 840], SavedView: [1480, 830],
    Subscription: [370, 1075], Invoice: [730, 1075], Payment: [1060, 1075],
    AuditEvent: [900, 1280]
  };

  // ---------------------------------------------------------------------------
  // The tour
  // ---------------------------------------------------------------------------
  // rect: camera target [x, y, w, h]. ents: entity chips. rels: relation chips;
  // a rel with `pts` [x1, y1, x2, y2] (and optional bend) is also drawn in the
  // scene as an arrow between two things you can see.

  var TOUR = [
    {
      rect: [120, 40, 1560, 1340],
      title: 'A software business, cut open',
      body: 'CRMs, project tools and billing systems look different on the surface, but they are built from the same few kinds of thing. This building gives each one a room. Follow the tour, or click any room to visit it.',
      ents: [], rels: []
    },
    {
      rect: [180, 296, 470, 228],
      title: 'Party: anyone who can act',
      body: 'A person, a company, a piece of software that does work. Rather than separate tables for users, contacts and companies, all three are kinds of one thing, a Party. Anything "someone" can do is attached to Party just once.',
      ents: ['Party', 'Person', 'Organization', 'Agent'],
      rels: [
        { from: 'Person', label: 'is a', to: 'Party', pts: [294, 440, 345, 374], bend: 10 },
        { from: 'Organization', label: 'is a', to: 'Party', pts: [410, 426, 410, 374], bend: 0 },
        { from: 'Agent', label: 'is a', to: 'Party', pts: [526, 436, 475, 374], bend: -10 }
      ]
    },
    {
      rect: [420, 320, 240, 205],
      title: 'Agent: software with a boss',
      body: 'The robot is a Party too. It can be given tasks, send messages and appear in the activity log, the same way a person does. But every agent is operated by someone, so there is always a named human or company answerable for it.',
      ents: ['Agent', 'Party'],
      rels: [{ from: 'Agent', label: 'operated by', to: 'Party', pts: [536, 446, 588, 452], bend: -34 }]
    },
    {
      rect: [640, 296, 330, 228],
      title: 'Role: a badge, worn for a while',
      body: 'Watch the visitor\'s badge. Lead, then Customer, then Vendor somewhere else, but always the same person. Lead, Customer, Vendor and Employee are roles a Party plays at an Organization, not separate kinds of people. Treating them as separate kinds is the most common mistake in business software.',
      ents: ['Role', 'Party', 'Organization'],
      rels: [
        { from: 'Party', label: 'plays', to: 'Role', dyn: 'plays' },
        { from: 'Role', label: 'at', to: 'Organization', dyn: 'at' }
      ]
    },
    {
      rect: [960, 296, 330, 228],
      title: 'Team: who owns the work',
      body: 'People are members of teams, and teams are part of an organization. A Person can sit in several teams without being copied.',
      ents: ['Team', 'Person', 'Organization'],
      rels: [
        { from: 'Person', label: 'member of', to: 'Team', pts: [1010, 450, 1080, 360] },
        { from: 'Team', label: 'part of', to: 'Organization', pts: [1170, 352, 1236, 352], bend: -22 }
      ]
    },
    {
      rect: [180, 516, 330, 228],
      title: 'Project: a bounded body of work',
      body: 'A project has an owner and a lifecycle. Task cards arrive through the slot on the right, and documents drop out of the tube in the ceiling. Both attach to the project they belong to.',
      ents: ['Project', 'Team', 'Task', 'Document'],
      rels: [
        { from: 'Project', label: 'owned by', to: 'Team' },
        { from: 'Task', label: 'belongs to', to: 'Project', pts: [462, 692, 352, 650], bend: 18 },
        { from: 'Document', label: 'attached to', to: 'Project', pts: [284, 590, 330, 612], bend: -22 }
      ]
    },
    {
      rect: [480, 516, 580, 228],
      title: 'Task: one kind of thing, nested',
      body: 'The small cards riding on big ones are subtasks, and a subtask is just a Task whose parent is another Task. The stamp then assigns each card to a Party, either a person or the robot. Swapping one for the other needs no change to the model.',
      ents: ['Task', 'Party', 'Project'],
      rels: [
        { from: 'Task', label: 'subtask of', to: 'Task', pts: [948, 570, 946, 594], bend: 34 },
        { from: 'Task', label: 'assigned to', to: 'Party', pts: [748, 655, 652, 676] },
        { from: 'Task', label: 'assigned to', to: 'Party', pts: [772, 655, 868, 672] },
        { from: 'Task', label: 'belongs to', to: 'Project' }
      ]
    },
    {
      rect: [1040, 516, 290, 228],
      title: 'Automation: a rule you can hold to account',
      body: 'When something happens, if a condition holds, then act. Because the rule is stored as a record, it has an owner you can ask "why?", it can be switched off, and every task it creates is logged.',
      ents: ['Automation', 'Task', 'Party'],
      rels: [
        { from: 'Automation', label: 'creates', to: 'Task', pts: [1092, 640, 1060, 686], bend: 18 },
        { from: 'Automation', label: 'maintained by', to: 'Party', pts: [1214, 640, 1272, 688] }
      ]
    },
    {
      rect: [1320, 516, 300, 228],
      title: 'Document: one thing, many formats',
      body: 'Docs, files, notes and templates differ only in their kind, which is why they share one drawer cabinet. People and agents both write, so the byline points at Party. Finished pages travel by tube to the project they are attached to.',
      ents: ['Document', 'Party', 'Project'],
      rels: [
        { from: 'Document', label: 'authored by', to: 'Party', pts: [1500, 678, 1452, 690], bend: 34 },
        { from: 'Document', label: 'authored by', to: 'Party', pts: [1514, 678, 1564, 686], bend: -34 },
        { from: 'Document', label: 'attached to', to: 'Project' }
      ]
    },
    {
      rect: [180, 736, 300, 228],
      title: 'Product: what you sell',
      body: 'An app, a service or a monthly plan. A service is a product you cannot drop on your foot, and a plan is a product that recurs. All of them are one entity type with a kind and a price.',
      ents: ['Product'],
      rels: []
    },
    {
      rect: [470, 736, 580, 228],
      title: 'Deal: one crate, moving through stages',
      body: 'The crate never turns into something else; only its stage label changes as it passes each gate. If Lead, Opportunity and Deal were separate entity types, every prospect that advanced would have to be moved from one table to another.',
      ents: ['Deal', 'Party', 'Product'],
      rels: [
        { from: 'Deal', label: 'with', to: 'Party', pts: [930, 896, 1008, 902], bend: -26 },
        { from: 'Deal', label: 'for', to: 'Product' }
      ]
    },
    {
      rect: [1040, 736, 300, 228],
      title: 'Interaction: every conversation, one shape',
      body: 'Calls, emails, chats and meetings all have participants, a time and the deal they are about. So they are one entity type with a channel, not four types repeating the same links.',
      ents: ['Interaction', 'Party', 'Deal'],
      rels: [
        { from: 'Interaction', label: 'involves', to: 'Party', pts: [1250, 820, 1262, 880], bend: 14 },
        { from: 'Interaction', label: 'regarding', to: 'Deal', pts: [1112, 800, 1040, 860], bend: -16 }
      ]
    },
    {
      rect: [180, 956, 1050, 228],
      title: 'The money chain',
      body: 'A Subscription binds a Party to a Product and renews on schedule. Each turn of the wheel prints an Invoice, and a Payment settles it. The whole recurring-revenue story can be read off three arrows.',
      ents: ['Subscription', 'Invoice', 'Payment', 'Party', 'Product'],
      rels: [
        { from: 'Subscription', label: 'held by', to: 'Party', pts: [352, 1064, 282, 1126] },
        { from: 'Subscription', label: 'for', to: 'Product' },
        { from: 'Invoice', label: 'bills', to: 'Subscription', pts: [690, 1110, 470, 1090], bend: -26 },
        { from: 'Payment', label: 'settles', to: 'Invoice', pts: [1000, 1040, 900, 1110], bend: 22 }
      ]
    },
    {
      rect: [1340, 736, 290, 228],
      title: 'Saved View: a way of looking, worth keeping',
      body: 'A Kanban board isn\'t part of your business; it\'s a way of looking at it. Once someone saves a view, though, it has an owner, a filter and a layout, so it becomes a real record.',
      ents: ['SavedView', 'Party'],
      rels: [{ from: 'SavedView', label: 'created by', to: 'Party', pts: [1470, 860, 1540, 900], bend: 14 }]
    },
    {
      rect: [1290, 296, 330, 228],
      title: 'Permission: keys, handed to Parties',
      body: 'Who may do how much to what. Because each grant is a record, you can ask "who can edit this, and since when?", and the same answer covers people and agents.',
      ents: ['Permission', 'Party'],
      rels: [
        { from: 'Permission', label: 'granted to', to: 'Party', pts: [1370, 420, 1470, 456] },
        { from: 'Permission', label: 'granted to', to: 'Party', pts: [1370, 420, 1572, 456], bend: -30 }
      ]
    },
    {
      rect: [150, 1060, 860, 320],
      title: 'Audit Event: the building\'s memory',
      body: 'Every action drops a slip down the pipes into the vault: who did what, when, and to what. Nothing is ever erased. When agents work alongside people, this record is how you check what happened instead of taking it on trust.',
      ents: ['AuditEvent', 'Party'],
      rels: [{ from: 'AuditEvent', label: 'performed by', to: 'Party', pts: [640, 1270, 286, 1140], bend: -40 }]
    },
    {
      rect: [120, 40, 1560, 1340],
      map: true,
      title: 'Now look at it as a map',
      body: 'This is the same building drawn as an ontology: each room is an entity type and each arrow is a relationship. Notice how many arrows end at Party. That is the idea the whole model is built on.',
      ents: [], rels: [], outro: true
    }
  ];

  // ---------------------------------------------------------------------------
  // Styles (injected once)
  // ---------------------------------------------------------------------------

  var CSS = [
    '.eos-root{--eos-paper:#fbfaf6;--eos-ink:#1c1c1c;--eos-muted:#5d5d5d;--eos-card:rgba(251,250,246,.94);--eos-line:rgba(28,28,28,.18);',
    'position:relative;width:100%;height:100%;min-height:420px;display:flex;flex-direction:column;background:var(--eos-paper);color:var(--eos-ink);',
    'font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden;outline:none;-webkit-tap-highlight-color:transparent}',
    '@media (prefers-color-scheme:dark){.eos-root:not([data-theme="light"]){--eos-paper:#151515;--eos-ink:#e9e6df;--eos-muted:#a7a39b;--eos-card:rgba(21,21,21,.93);--eos-line:rgba(233,230,223,.2)}}',
    '.eos-root[data-theme="dark"]{--eos-paper:#151515;--eos-ink:#e9e6df;--eos-muted:#a7a39b;--eos-card:rgba(21,21,21,.93);--eos-line:rgba(233,230,223,.2)}',
    '.eos-stage{position:relative;flex:1 1 auto;min-height:0;touch-action:none;cursor:grab}',
    '.eos-stage.eos-hover{cursor:pointer}.eos-stage.eos-drag{cursor:grabbing}',
    '.eos-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.eos-tip{position:absolute;pointer-events:none;padding:3px 8px;border:1px solid var(--eos-ink);background:var(--eos-paper);font-size:12px;font-weight:600;white-space:nowrap;transform:translate(-50%,-130%);opacity:0;transition:opacity .12s}',
    '.eos-tip.eos-on{opacity:1}',
    '.eos-card{position:absolute;left:16px;bottom:16px;width:min(440px,calc(100% - 32px));background:var(--eos-card);border:1.5px solid var(--eos-ink);box-shadow:4px 4px 0 var(--eos-line);padding:14px 16px 12px;box-sizing:border-box;z-index:2;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}',
    '.eos-kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--eos-muted);display:flex;justify-content:space-between;gap:8px}',
    '.eos-title{margin:4px 0 6px;font-size:19px;line-height:1.25;font-weight:700;letter-spacing:-.01em}',
    '.eos-body{margin:0;font-size:14.5px;color:var(--eos-ink)}',
    '.eos-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
    '.eos-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--eos-line);padding:1px 8px 1px 6px;font-size:12.5px;font-weight:600;background:var(--eos-paper)}',
    '.eos-chip i{width:9px;height:9px;border-radius:50%;display:inline-block}',
    '.eos-rels{margin:8px 0 0;padding:0;list-style:none;font-size:12.5px;color:var(--eos-muted)}',
    '.eos-rels li{margin:2px 0}.eos-rels b{color:var(--eos-ink);font-weight:600}.eos-rels em{font-style:normal;border-bottom:1.5px dashed currentColor;color:var(--eos-ink)}',
    '.eos-link{display:inline-block;margin-top:10px;font-weight:700;color:inherit}',
    '.eos-ctrl{display:flex;align-items:center;gap:6px;margin-top:12px}',
    '.eos-btn{appearance:none;border:1.5px solid var(--eos-ink);background:var(--eos-paper);color:var(--eos-ink);font:inherit;font-size:13px;font-weight:600;height:32px;min-width:32px;padding:0 9px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
    '.eos-btn:hover{background:var(--eos-ink);color:var(--eos-paper)}',
    '.eos-btn:focus-visible{outline:2px solid var(--eos-ink);outline-offset:2px}',
    '.eos-btn[aria-pressed="true"]{background:var(--eos-ink);color:var(--eos-paper)}',
    '.eos-dots{flex:1;display:flex;gap:3px;align-items:center;min-width:0}',
    '.eos-dot{flex:1;height:4px;background:var(--eos-line);border:0;padding:0;cursor:pointer;position:relative;min-width:0}',
    '.eos-dot.eos-done{background:var(--eos-ink)}',
    '.eos-dot span{position:absolute;left:0;top:0;bottom:0;background:var(--eos-ink)}',
    '.eos-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '@media (max-width:720px){.eos-card{position:relative;left:auto;bottom:auto;width:auto;margin:0;border-width:1.5px 0 0;box-shadow:none;max-height:46%;overflow:auto;padding:12px 16px}',
    '.eos-title{font-size:17px}.eos-body{font-size:14px}}'
  ].join('');

  function injectCss() {
    if (document.getElementById('eos-style')) return;
    var s = document.createElement('style');
    s.id = 'eos-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  var FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  var TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function hexA(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function el(tag, cls, parent) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---------------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------------

  function mount(host, options) {
    if (!host || host.__eos) return host && host.__eos;
    var opts = options || {};
    injectCss();

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var mapUrl = opts.mapUrl === undefined
      ? 'https://microsoft.github.io/Ontology-Playground/#/catalogue/community/daocoding/elements-of-software'
      : opts.mapUrl;

    // ---- DOM ---------------------------------------------------------------
    var root = el('div', 'eos-root', host);
    root.tabIndex = 0;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Elements of Software: an animated tour of a software business ontology');
    if (opts.theme) root.setAttribute('data-theme', opts.theme);

    var stage = el('div', 'eos-stage', root);
    var canvas = el('canvas', null, stage);
    canvas.setAttribute('aria-hidden', 'true');
    var tip = el('div', 'eos-tip', stage);

    var card = el('div', 'eos-card', root);
    card.setAttribute('aria-live', 'polite');
    var kicker = el('div', 'eos-kicker', card);
    var kStep = el('span', null, kicker);
    var kName = el('span', null, kicker);
    kName.textContent = 'Elements of Software';
    var title = el('h2', 'eos-title', card);
    var body = el('p', 'eos-body', card);
    var chips = el('div', 'eos-chips', card);
    var rels = el('ul', 'eos-rels', card);
    var link = el('a', 'eos-link', card);
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = 'Open the interactive graph →';

    var ctrl = el('div', 'eos-ctrl', card);
    var bPrev = el('button', 'eos-btn', ctrl);
    bPrev.type = 'button'; bPrev.textContent = '‹'; bPrev.setAttribute('aria-label', 'Previous stop');
    var bPlay = el('button', 'eos-btn', ctrl);
    bPlay.type = 'button';
    var bNext = el('button', 'eos-btn', ctrl);
    bNext.type = 'button'; bNext.textContent = '›'; bNext.setAttribute('aria-label', 'Next stop');
    var dots = el('div', 'eos-dots', ctrl);
    var bMap = el('button', 'eos-btn', ctrl);
    bMap.type = 'button'; bMap.textContent = 'Map'; bMap.title = 'Show the ontology graph over the building';
    bMap.setAttribute('aria-pressed', 'false');

    var dotEls = TOUR.map(function (s, i) {
      var d = el('button', 'eos-dot', dots);
      d.type = 'button';
      d.setAttribute('aria-label', 'Stop ' + (i + 1) + ': ' + s.title);
      d.appendChild(el('span'));
      d.addEventListener('click', function () { go(i, true); });
      return d;
    });

    var ctx = canvas.getContext('2d');

    // ---- state -------------------------------------------------------------
    var step = clamp(opts.start | 0, 0, TOUR.length - 1);
    var playing = opts.autoplay !== false && !reduced;
    var stepClock = 0;
    var mapOn = false, mapK = 0;
    var t = 0;                 // ambient animation time (s)
    var vw = 1, vh = 1, dpr = 1, insetL = 0, insetB = 0;
    var cam = { x: W / 2, y: H / 2, s: 0.4 };
    var free = false;          // user has taken over the camera
    var hoverRoom = null;
    var focusK = 0;            // 0..1 fade for the focus highlight
    var visible = true;
    var P = { paper: '#fbfaf6', ink: '#1c1c1c', soft: 'rgba(28,28,28,.08)', faint: 'rgba(28,28,28,.16)', dark: false };
    var px = 1;                // one screen pixel in world units
    var MAX_ZOOM = 3;
    var DYN = {};              // arrow endpoints that follow moving things

    function stepDuration(i) {
      var s = TOUR[i];
      var words = (s.title + ' ' + s.body).split(/\s+/).length;
      return Math.max(8, words / 3.3 + 2.5);
    }

    // ---- caption card --------------------------------------------------------
    function renderCard() {
      var s = TOUR[step];
      kStep.textContent = (step + 1) + ' / ' + TOUR.length;
      title.textContent = s.title;
      body.textContent = s.body;

      chips.textContent = '';
      s.ents.forEach(function (name) {
        var e = ENTITIES[name];
        var c = el('span', 'eos-chip', chips);
        var dot = el('i', null, c);
        dot.style.background = e.color;
        c.appendChild(document.createTextNode(e.icon + ' ' + name));
        c.title = name + ' — properties: ' + e.props.join(', ');
      });
      chips.style.display = s.ents.length ? '' : 'none';

      rels.textContent = '';
      var seen = {};
      s.rels.forEach(function (r) {
        var key = r.from + r.label + r.to;
        if (seen[key]) return;
        seen[key] = 1;
        var li = el('li', null, rels);
        var a = el('b', null, li); a.textContent = r.from;
        li.appendChild(document.createTextNode(' — '));
        var m = el('em', null, li); m.textContent = r.label;
        li.appendChild(document.createTextNode(' → '));
        var b = el('b', null, li); b.textContent = r.to;
      });
      rels.style.display = s.rels.length ? '' : 'none';

      if (s.outro) {
        var nE = Object.keys(ENTITIES).length;
        body.textContent = s.body + ' ' + nE + ' entity types, ' + RELATIONS.length + ' relationships.';
      }
      link.style.display = s.outro && mapUrl ? '' : 'none';
      if (mapUrl) link.href = mapUrl;

      dotEls.forEach(function (d, i) {
        d.className = 'eos-dot' + (i < step ? ' eos-done' : '');
        d.setAttribute('aria-current', i === step ? 'step' : 'false');
        d.firstChild.style.width = '0';
      });
      bPrev.disabled = step === 0;
      bPlay.textContent = playing ? '❚❚' : '▶';
      bPlay.setAttribute('aria-label', playing ? 'Pause tour' : 'Play tour');
      layout();
    }

    function go(i, manual) {
      step = mod(i, TOUR.length);
      stepClock = 0;
      free = false;
      focusK = 0;
      if (manual && reduced) playing = false;
      renderCard();
      if (reduced) snapCamera();
    }

    // ---- camera --------------------------------------------------------------
    function fit(r) {
      // Fit rect r into whichever free region (above or beside the card) is larger.
      var pad = 0.94;
      var regions = [[0, 0, vw, vh - insetB], [insetL, 0, vw - insetL, vh]];
      var best = null;
      regions.forEach(function (g) {
        if (g[2] < 40 || g[3] < 40) return;
        var s = Math.min(g[2] / r[2], g[3] / r[3]) * pad;
        if (!best || s > best.s) {
          best = { s: s, x: r[0] + r[2] / 2 - (g[0] + g[2] / 2 - vw / 2) / s, y: r[1] + r[3] / 2 - (g[1] + g[3] / 2 - vh / 2) / s };
        }
      });
      best = best || { s: Math.min(vw / r[2], vh / r[3]), x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 };
      if (best.s > MAX_ZOOM) {
        // keep the rect centred in its region at the capped zoom
        var g2 = best.s;
        best.x = r[0] + r[2] / 2 + (best.x - r[0] - r[2] / 2) * g2 / MAX_ZOOM;
        best.y = r[1] + r[3] / 2 + (best.y - r[1] - r[3] / 2) * g2 / MAX_ZOOM;
        best.s = MAX_ZOOM;
      }
      return best;
    }
    function targetCam() {
      var f = fit(TOUR[step].rect);
      if (!reduced && !free) {
        // slow drift, like a camera sliding over a print
        var d = 1 + 0.025 * Math.sin(t * 0.21);
        f.s *= d;
        f.x += Math.sin(t * 0.13) * 8 / d;
        f.y += Math.cos(t * 0.17) * 5 / d;
      }
      return f;
    }
    function snapCamera() { var f = targetCam(); cam.x = f.x; cam.y = f.y; cam.s = f.s; }
    function toWorld(sx, sy) { return [(sx - vw / 2) / cam.s + cam.x, (sy - vh / 2) / cam.s + cam.y]; }

    function layout() {
      var r = stage.getBoundingClientRect();
      vw = Math.max(1, r.width); vh = Math.max(1, r.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
      var overlay = getComputedStyle(card).position === 'absolute';
      insetL = overlay ? card.offsetWidth + 24 : 0;
      insetB = overlay ? card.offsetHeight + 24 : 0;
    }

    // ---- input -----------------------------------------------------------------
    var pointers = {}, drag = null, moved = 0;
    function roomAt(wx, wy) {
      for (var i = 0; i < ROOMS.length; i++) {
        var q = ROOMS[i];
        if (wx >= q.x && wx < q.x + q.w && wy >= q.y && wy < q.y + q.h) return q;
      }
      return null;
    }
    function local(e) { var r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }

    stage.addEventListener('pointerdown', function (e) {
      stage.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = local(e);
      moved = 0;
      var ids = Object.keys(pointers);
      if (ids.length === 1) drag = { p: pointers[e.pointerId] };
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        drag = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s };
      }
    });
    stage.addEventListener('pointermove', function (e) {
      var p = local(e);
      if (!pointers[e.pointerId]) {
        var w = toWorld(p[0], p[1]);
        hoverRoom = roomAt(w[0], w[1]);
        stage.classList.toggle('eos-hover', !!hoverRoom);
        if (hoverRoom) {
          tip.textContent = (hoverRoom.ent ? ENTITIES[hoverRoom.ent].icon + ' ' : '') + hoverRoom.name;
          tip.style.left = p[0] + 'px'; tip.style.top = p[1] + 'px';
        }
        tip.classList.toggle('eos-on', !!hoverRoom);
        return;
      }
      var prev = pointers[e.pointerId];
      pointers[e.pointerId] = p;
      var ids = Object.keys(pointers);
      if (ids.length === 2 && drag && drag.pinch) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (drag.s * d / drag.pinch) / cam.s);
        moved += 10;
        return;
      }
      var dx = p[0] - prev[0], dy = p[1] - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) {
        takeOver();
        stage.classList.add('eos-drag');
        cam.x -= dx / cam.s; cam.y -= dy / cam.s;
      }
    });
    function endPointer(e) {
      var p = pointers[e.pointerId];
      delete pointers[e.pointerId];
      stage.classList.remove('eos-drag');
      if (p && moved <= 6 && e.type === 'pointerup') {
        var w = toWorld(p[0], p[1]);
        var q = roomAt(w[0], w[1]);
        if (q) { playing = false; go(q.step, true); }
      }
      if (!Object.keys(pointers).length) drag = null;
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('pointerleave', function () { tip.classList.remove('eos-on'); hoverRoom = null; });
    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      var p = local(e);
      zoomAt(p[0], p[1], Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)));
    }, { passive: false });

    function takeOver() { free = true; if (playing) { playing = false; renderCard(); } }
    function zoomAt(sx, sy, k) {
      takeOver();
      var before = toWorld(sx, sy);
      cam.s = clamp(cam.s * k, 0.15, 6);
      var after = toWorld(sx, sy);
      cam.x += before[0] - after[0]; cam.y += before[1] - after[1];
    }

    bPrev.addEventListener('click', function () { go(step - 1, true); });
    bNext.addEventListener('click', function () { go(step + 1, true); });
    bPlay.addEventListener('click', function () {
      playing = !playing;
      if (playing && step === TOUR.length - 1) go(0); else { free = false; renderCard(); }
    });
    bMap.addEventListener('click', function () { mapOn = !mapOn; bMap.setAttribute('aria-pressed', String(mapOn)); });
    root.addEventListener('keydown', function (e) {
      if (e.target !== root && e.target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;
      if (e.key === 'ArrowRight') go(step + 1, true);
      else if (e.key === 'ArrowLeft') go(step - 1, true);
      else if (e.key === ' ') { playing = !playing; free = false; renderCard(); }
      else if (e.key === 'Home' || e.key === 'Escape') go(0, true);
      else if (e.key === 'm' || e.key === 'M') bMap.click();
      else return;
      e.preventDefault();
    });

    var ro = window.ResizeObserver ? new ResizeObserver(function () { layout(); }) : null;
    if (ro) { ro.observe(stage); ro.observe(card); } else window.addEventListener('resize', layout);
    if (window.IntersectionObserver) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(root);
    }

    // ---- palette -------------------------------------------------------------
    function readPalette() {
      var cs = getComputedStyle(root);
      var paper = cs.getPropertyValue('--eos-paper').trim() || '#fbfaf6';
      var ink = cs.getPropertyValue('--eos-ink').trim() || '#1c1c1c';
      if (paper === P.paper && ink === P.ink) return;
      P.paper = paper; P.ink = ink;
      P.soft = hexA(ink, 0.07); P.faint = hexA(ink, 0.17); P.mid = hexA(ink, 0.45);
      P.dark = parseInt(paper.slice(1, 3), 16) < 128;
    }

    // =========================================================================
    // Drawing primitives (world units)
    // =========================================================================

    function lw(b) { ctx.lineWidth = Math.max(b, 0.75 * px); }
    function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    function box(x, y, w, h, fill) {
      if (fill !== false) { ctx.fillStyle = fill || P.paper; ctx.fillRect(x, y, w, h); }
      ctx.strokeRect(x, y, w, h);
    }
    function circle(x, y, r, fill) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      if (fill !== false) { ctx.fillStyle = fill || P.paper; ctx.fill(); }
      ctx.stroke();
    }
    function poly(pts, fill) {
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      if (fill !== false) { ctx.fillStyle = fill || P.paper; ctx.fill(); }
      ctx.stroke();
    }
    function text(s, x, y, size, align, weight, font) {
      ctx.font = (weight || 600) + ' ' + size + 'px ' + (font || FONT);
      ctx.textAlign = align || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = P.ink;
      ctx.fillText(s, x, y);
    }
    function textW(s, size, weight, font) {
      ctx.font = (weight || 600) + ' ' + size + 'px ' + (font || FONT);
      return ctx.measureText(s).width;
    }
    function hatch(x, y, w, h, gap, width) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.beginPath();
      for (var i = -h; i < w; i += gap) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); }
      lw(width || 0.7); ctx.stroke();
      ctx.restore();
    }
    function hatchPoly(pts, gap, width) {
      var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
      for (var i = 0; i < pts.length; i += 2) {
        minX = Math.min(minX, pts[i]); maxX = Math.max(maxX, pts[i]);
        minY = Math.min(minY, pts[i + 1]); maxY = Math.max(maxY, pts[i + 1]);
      }
      ctx.save();
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (var j = 2; j < pts.length; j += 2) ctx.lineTo(pts[j], pts[j + 1]);
      ctx.closePath(); ctx.clip();
      hatch(minX, minY, maxX - minX, maxY - minY, gap, width);
      ctx.restore();
    }
    function vlines(x, y, w, h, gap, alpha) {
      ctx.save();
      ctx.globalAlpha *= alpha == null ? 1 : alpha;
      ctx.beginPath();
      for (var i = x + gap; i < x + w; i += gap) { ctx.moveTo(i, y); ctx.lineTo(i, y + h); }
      lw(0.7); ctx.stroke();
      ctx.restore();
    }
    function hlines(x, y, w, h, gap) {
      ctx.beginPath();
      for (var i = y + gap; i < y + h; i += gap) { ctx.moveTo(x, i); ctx.lineTo(x + w, i); }
      ctx.stroke();
    }
    function sign(cx, y, label, size, accent) {
      size = size || 10;
      var w = textW(label, size, 700) + 14 + (accent ? 10 : 0), h = size + 9;
      lw(1.4);
      box(cx - w / 2, y, w, h);
      if (accent) {
        ctx.fillStyle = accent;
        ctx.fillRect(cx - w / 2 + 5, y + h / 2 - 3, 6, 6);
      }
      text(label, cx + (accent ? 5 : 0), y + h / 2 + 0.5, size, 'center', 700);
      return w;
    }
    function tag(cx, cy, label, size) {
      var w = textW(label, size, 800) + 6, h = size + 4;
      ctx.fillStyle = P.paper;
      ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
      text(label, cx, cy + 0.5, size, 'center', 800);
    }
    function hangSign(cx, ceil, label, accent) {
      lw(1);
      var w = textW(label, 10, 700) + 24;
      line(cx - w / 2 + 8, ceil, cx - w / 2 + 8, ceil + 10);
      line(cx + w / 2 - 8, ceil, cx + w / 2 - 8, ceil + 10);
      sign(cx, ceil + 10, label, 10, accent);
    }
    function lamp(x, ceil, len) {
      lw(1);
      line(x, ceil, x, ceil + len);
      poly([x - 9, ceil + len + 9, x - 4, ceil + len, x + 4, ceil + len, x + 9, ceil + len + 9]);
      ctx.save();
      ctx.globalAlpha = P.dark ? 0.1 : 0.05;
      ctx.fillStyle = P.dark ? '#fff3c4' : P.ink;
      ctx.beginPath();
      ctx.moveTo(x - 9, ceil + len + 9); ctx.lineTo(x + 9, ceil + len + 9);
      ctx.lineTo(x + 38, ceil + len + 80); ctx.lineTo(x - 38, ceil + len + 80);
      ctx.fill();
      ctx.restore();
    }
    function windowFrame(x, y, w, h) {
      lw(1.2);
      box(x, y, w, h);
      line(x + w / 2, y, x + w / 2, y + h);
      line(x, y + h / 2, x + w, y + h / 2);
      ctx.save();
      ctx.globalAlpha = 0.5;
      lw(0.7);
      line(x + 4, y + h / 2 - 4, x + w / 2 - 6, y + 4);
      line(x + w / 2 + 4, y + h - 4, x + w - 6, y + h / 2 + 4);
      ctx.restore();
    }
    function frameBoard(x, y, w, h) { lw(1.2); box(x, y, w, h); lw(0.8); box(x + 3, y + 3, w - 6, h - 6, false); }

    // A person, feet at (x, y). o: { walk, seated, arm, flip, badge, cap, color, s }
    function person(x, y, o) {
      o = o || {};
      var s = o.s || 1;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(o.flip ? -s : s, s);
      lw(1.5);
      ctx.lineCap = 'round';
      var headY;
      if (o.seated) {
        line(-2, -16, 9, -16); line(9, -16, 9, -1);
        line(2, -16, 13, -15); line(13, -15, 13, -1);
        poly([-6, -34, 5, -34, 7, -15, -8, -15]);
        line(-0.5, -32, 0, -16);
        headY = -40;
      } else {
        var sw = o.walk == null ? 0 : Math.sin(o.walk) * 5;
        line(-3, -16, -3 + sw, 0); line(3, -16, 3 - sw, 0);
        line(-3 + sw, 0, 0 + sw, 0); line(3 - sw, 0, 6 - sw, 0);
        poly([-6, -37, 6, -37, 9, -14, -9, -14]);
        line(0, -35, 0, -15);
        headY = -43;
      }
      // arms
      var shY = headY + 9;
      var arm = o.arm || 'down';
      if (arm === 'down') { line(-6, shY, -9, shY + 16); line(6, shY, 9, shY + 16); }
      else if (arm === 'up') { line(-6, shY, -9, shY + 16); line(6, shY, 13, shY - 10); }
      else if (arm === 'forward') { line(-6, shY, -9, shY + 16); line(6, shY, 17, shY + 4); }
      else if (arm === 'type') {
        var j = Math.sin(t * 14 + x) * 1.2;
        line(5, shY + 1, 14, shY + 9 + j); line(-3, shY + 1, 10, shY + 10 - j);
      } else if (arm === 'hold') { line(-6, shY, -9, shY + 16); line(6, shY, 14, shY + 8); line(14, shY + 8, 18, shY + 3); }
      // head
      circle(0, headY, 5.5);
      ctx.beginPath();
      ctx.arc(0, headY, 5.5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fillStyle = P.ink; ctx.fill();
      if (o.cap) { ctx.fillRect(-6, headY - 6, 12, 2.5); }
      if (o.badge) {
        ctx.fillStyle = o.badge;
        ctx.fillRect(1.5, shY + 3, 4, 4);
        lw(0.6); ctx.strokeRect(1.5, shY + 3, 4, 4);
      }
      ctx.restore();
    }

    // A small robot, wheels at (x, y)
    function robot(x, y, o) {
      o = o || {};
      ctx.save();
      ctx.translate(x, y);
      if (o.flip) ctx.scale(-1, 1);
      lw(1.5);
      ctx.lineCap = 'round';
      box(-9, -10, 18, 7);
      circle(-5, -3, 3); circle(5, -3, 3);
      box(-8, -30, 16, 20);
      line(-4, -22, 4, -22); line(-4, -18, 4, -18);
      box(-7, -43, 14, 12);
      ctx.fillStyle = P.ink;
      ctx.fillRect(-5, -39, 10, 3.5);
      ctx.fillStyle = ENTITIES.Agent.color;
      var blink = Math.sin(t * 3 + x) > -0.6;
      if (blink) { ctx.fillRect(-3.5, -38.5, 2.5, 2.5); ctx.fillRect(1.5, -38.5, 2.5, 2.5); }
      line(0, -43, 0, -49);
      circle(0, -50.5, 1.8, Math.sin(t * 5 + x) > 0 ? ENTITIES.Agent.color : P.paper);
      var arm = o.arm || 'down';
      if (arm === 'type') {
        var j = Math.sin(t * 16 + x) * 1.2;
        line(8, -26, 16, -20 + j); line(-8, -26, 8, -18 - j);
      } else if (arm === 'forward') { line(8, -26, 18, -24); line(-8, -26, -11, -15); }
      else { line(8, -26, 11, -15); line(-8, -26, -11, -15); }
      ctx.restore();
    }

    function gear(x, y, r, n, a) {
      var tw = Math.PI / n;
      ctx.beginPath();
      for (var k = 0; k < n; k++) {
        var b = a + k * 2 * tw;
        var r0 = r * 0.8;
        ctx.lineTo(x + Math.cos(b - tw * 0.5) * r0, y + Math.sin(b - tw * 0.5) * r0);
        ctx.lineTo(x + Math.cos(b - tw * 0.3) * r, y + Math.sin(b - tw * 0.3) * r);
        ctx.lineTo(x + Math.cos(b + tw * 0.3) * r, y + Math.sin(b + tw * 0.3) * r);
        ctx.lineTo(x + Math.cos(b + tw * 0.5) * r0, y + Math.sin(b + tw * 0.5) * r0);
      }
      ctx.closePath();
      ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();
      circle(x, y, r * 0.32);
      for (var s = 0; s < 3; s++) {
        var c = a + s * TAU / 3;
        line(x + Math.cos(c) * r * 0.32, y + Math.sin(c) * r * 0.32, x + Math.cos(c) * r * 0.66, y + Math.sin(c) * r * 0.66);
      }
      circle(x, y, 2.2, P.ink);
    }

    // conveyor belt: top surface at y, moving with given speed (+ right)
    function belt(x1, x2, y, speed, floor) {
      lw(1.3);
      box(x1, y, x2 - x1, 9);
      var off = mod(t * speed, 18);
      for (var x = x1 + 7; x < x2 - 3; x += 18) {
        circle(x, y + 4.5, 3.6);
        var a = t * speed / 3.6;
        line(x, y + 4.5, x + Math.cos(a) * 3.6, y + 4.5 + Math.sin(a) * 3.6);
      }
      lw(0.8);
      for (var m = x1 + off; m < x2; m += 18) line(m, y, m + 2, y - 0.01);
      if (floor) {
        lw(1.2);
        for (var p = x1 + 12; p < x2; p += 80) { line(p, y + 9, p - 4, floor); line(p, y + 9, p + 4, floor); }
      }
    }

    function taskCard(x, y, w, h, o) {
      o = o || {};
      lw(1.1);
      box(x, y, w, h);
      ctx.fillStyle = ENTITIES.Task.color;
      ctx.fillRect(x + 1, y + 1, 3, h - 2);
      lw(0.7);
      for (var i = 1; i <= 3; i++) line(x + 7, y + i * h / 4.3, x + w - (i === 3 ? 12 : 5), y + i * h / 4.3);
      if (o.mark) {
        lw(0.9);
        var mx = x + w - 6, my = y + h - 6;
        if (o.mark === 'r') { box(mx - 3.5, my - 3.5, 7, 7); ctx.fillStyle = ENTITIES.Agent.color; ctx.fillRect(mx - 2, my - 1, 4, 1.6); }
        else { circle(mx, my - 1, 2.4); line(mx - 3.5, my + 3.5, mx + 3.5, my + 3.5); }
      }
    }

    function monitor(x, y, w, h) {
      lw(1.2);
      box(x, y, w, h);
      line(x + w / 2, y + h, x + w / 2, y + h + 6);
      line(x + w / 2 - 6, y + h + 6, x + w / 2 + 6, y + h + 6);
    }

    function desk(x, y, w, floor) {
      lw(1.3);
      box(x, y, w, 5);
      line(x + 4, y + 5, x + 4, floor); line(x + w - 4, y + 5, x + w - 4, floor);
    }

    function chair(x, floor) {
      lw(1.2);
      line(x - 8, floor - 17, x + 4, floor - 17);
      line(x - 8, floor - 17, x - 9, floor - 36);
      line(x - 2, floor - 17, x - 2, floor - 4);
      line(x - 8, floor - 1, x + 4, floor - 1);
    }

    function crate(x, y, w, h) {
      lw(1.2);
      box(x, y, w, h);
      lw(0.7);
      line(x, y, x + w, y + h); line(x + w, y, x, y + h);
      line(x, y + h / 2, x + w, y + h / 2);
    }

    function plant(x, floor) {
      lw(1.1);
      poly([x - 7, floor - 14, x + 7, floor - 14, x + 5, floor, x - 5, floor]);
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x, floor - 14);
        ctx.quadraticCurveTo(x + i * 6, floor - 30, x + i * 9, floor - 34 + Math.abs(i) * 4);
        ctx.stroke();
      }
    }

    function stairs(x, floor, w, h, dir) {
      lw(1.1);
      var n = 9, sw = w / n, sh = h / n;
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var sx = dir > 0 ? x + i * sw : x + w - i * sw;
        ctx.moveTo(sx, floor - i * sh); ctx.lineTo(sx, floor - (i + 1) * sh);
        ctx.lineTo(sx + dir * sw, floor - (i + 1) * sh);
      }
      ctx.stroke();
      line(dir > 0 ? x : x + w, floor - 26, dir > 0 ? x + w : x, floor - h - 26);
    }

    // =========================================================================
    // The building shell
    // =========================================================================

    function drawShell() {
      ctx.strokeStyle = P.ink;
      ctx.lineJoin = 'round';

      // --- ground & earth
      lw(1.4);
      line(40, GROUND, W - 40, GROUND);
      ctx.save();
      ctx.globalAlpha = 0.55;
      hatch(60, GROUND, W - 120, 210, 9, 0.7);
      ctx.restore();
      // grass ticks
      lw(0.8);
      for (var g = 60; g < W - 60; g += 13) {
        if (g > X0 - 10 && g < X1 + 10) continue;
        line(g, GROUND, g - 2, GROUND - 4); line(g + 3, GROUND, g + 4, GROUND - 5);
      }

      // --- roofs
      lw(1.6);
      // left gable
      var lg = [160, 300, 410, 150, 660, 300];
      poly(lg);
      hatchPoly(lg, 7, 0.6);
      poly([300, 300, 410, 214, 520, 300]);
      vlines(300, 214, 220, 86, 8, 0.6);
      lw(1.3); circle(410, 258, 16); line(394, 258, 426, 258); line(410, 242, 410, 274);
      // sawtooth middle
      for (var i = 0; i < 4; i++) {
        var sx = 640 + i * 162.5;
        var tooth = [sx, 300, sx, 230, sx + 162.5, 300];
        lw(1.5);
        poly(tooth);
        hatchPoly([sx + 4, 300, sx + 4, 240, sx + 158, 299], 6, 0.55);
        lw(1.1);
        box(sx + 2, 236, 6, 60);
      }
      // chimney
      lw(1.6);
      poly([1252, 300, 1258, 110, 1290, 110, 1296, 300]);
      vlines(1254, 112, 40, 186, 6, 0.6);
      box(1250, 102, 48, 10);
      lw(1.2);
      circle(1274, 170, 9);
      ctx.save(); ctx.fillStyle = ENTITIES.Party.color; ctx.beginPath(); ctx.arc(1274, 170, 5, 0, TAU); ctx.fill(); ctx.restore();
      // right gable
      var rg = [1272, 300, 1455, 178, 1640, 300];
      lw(1.6);
      poly(rg);
      hatchPoly(rg, 7, 0.6);
      windowFrame(1430, 238, 50, 40);
      // rooftop sign
      lw(1.3);
      line(860, 230, 860, 262); line(1070, 230, 1070, 262);
      line(860, 262, 850, 300); line(1070, 262, 1080, 300);
      box(820, 196, 290, 36);
      text('ELEMENTS OF SOFTWARE', 965, 214.5, 17, 'center', 800);

      // smoke
      for (var k = 0; k < 7; k++) {
        var age = mod(t * 0.9 + k * 1.15, 8);
        var a = 1 - age / 8;
        ctx.save();
        ctx.globalAlpha = a;
        lw(1.1);
        circle(1274 + age * 22 + Math.sin(age * 1.7 + k) * 5, 92 - age * 11, 7 + age * 3.2);
        ctx.restore();
      }

      // --- room back walls
      ROOMS.forEach(function (q) {
        if (q.id === 'audit') return;
        ctx.fillStyle = P.paper;
        ctx.fillRect(q.x, q.y, q.w, q.h);
        vlines(q.x, q.y + 5, q.w, q.h - 10, 7, 0.22);
      });

      // --- audit vault (underground)
      var A = ROOMS[16];
      ctx.fillStyle = P.paper;
      ctx.fillRect(A.x, A.y, A.w, A.h);
      ctx.save(); ctx.globalAlpha = 0.18; hlines(A.x, A.y, A.w, A.h, 9); ctx.restore();
      ctx.fillStyle = P.ink;
      ctx.fillRect(A.x - 10, A.y - 6, A.w + 20, 8);
      ctx.fillRect(A.x - 10, A.y + A.h, A.w + 20, 10);
      ctx.fillRect(A.x - 10, A.y - 6, 10, A.h + 16);
      ctx.fillRect(A.x + A.w, A.y - 6, 10, A.h + 16);

      // --- floor slabs and outer walls
      ctx.fillStyle = P.ink;
      FLOORS.forEach(function (fy) { ctx.fillRect(X0 - 6, fy - 5, X1 - X0 + 12, 10); });
      ctx.fillRect(X0 - 6, 300, 12, GROUND - 300 + 5);
      ctx.fillRect(X1 - 6, 300, 12, 960 - 300);
      ctx.fillRect(X1 - 6, 960, 12, 120); // lobby wall above the revolving door

      // interior partitions with door gaps at floor level
      function part(x, top, bottom, gap) {
        ctx.fillStyle = P.ink;
        ctx.fillRect(x - 4, top, 8, bottom - top - (gap || 0));
      }
      part(640, 300, 520, 60);
      part(960, 300, 520, 60);
      part(1290, 300, 520, 0);
      part(480, 520, 740, 46);
      part(1050, 520, 740, 46);
      part(1320, 520, 740, 0);
      part(470, 740, 960, 46);
      part(1040, 740, 960, 60);
      part(1340, 740, 960, 0);
      part(560, 960, 1180, 40);
      part(900, 960, 1180, 40);
      part(1220, 960, 1180, 60);

      // --- outside the building: left tree + bench, right van
      lw(1.3);
      line(96, GROUND, 96, GROUND - 70);
      for (var b = 0; b < 5; b++) {
        circle(96 + Math.cos(b * 1.3) * 22, GROUND - 92 + Math.sin(b * 1.9) * 16, 20);
      }
      lw(1.2);
      box(1700, GROUND - 44, 70, 34);
      poly([1700, GROUND - 44, 1680, GROUND - 32, 1676, GROUND - 10, 1700, GROUND - 10]);
      circle(1690, GROUND - 6, 7); circle(1752, GROUND - 6, 7);
      text('DELIVERY', 1735, GROUND - 28, 8, 'center', 800);
    }

    // =========================================================================
    // Rooms
    // =========================================================================

    function F(q) { return q.y + q.h - 5; }   // floor line of a room
    function C(q) { return q.y + 5; }         // ceiling line

    function drawPartyHall(q) {
      var fl = F(q), ce = C(q);
      windowFrame(210, 340, 50, 60);
      windowFrame(560, 340, 50, 60);
      lamp(300, ce, 20); lamp(520, ce, 20);
      // banner
      lw(1.5);
      box(300, 330, 220, 40);
      ctx.fillStyle = ENTITIES.Party.color;
      ctx.fillRect(301, 331, 8, 38);
      text('PARTY', 410, 343, 14, 'center', 800);
      text('anyone who can act', 410, 359, 9, 'center', 600);
      line(320, ce, 320, 330); line(500, ce, 500, 330);
      // stage
      lw(1.4);
      box(232, fl - 12, 346, 12);
      ctx.save(); ctx.globalAlpha = 0.6; hatch(232, fl - 12, 346, 12, 5, 0.6); ctx.restore();
      // three kinds of party
      person(292, fl - 12, { arm: 'up', badge: ENTITIES.Person.color });
      // organization: a small building on a cart
      lw(1.3);
      var ox = 410, oy = fl - 12;
      box(ox - 18, oy - 38, 36, 32);
      poly([ox - 21, oy - 38, ox, oy - 52, ox + 21, oy - 38]);
      for (var r = 0; r < 2; r++) for (var c = 0; c < 3; c++) box(ox - 13 + c * 10, oy - 32 + r * 12, 6, 7);
      line(ox, oy - 52, ox, oy - 64);
      ctx.fillStyle = ENTITIES.Organization.color;
      ctx.beginPath(); ctx.moveTo(ox, oy - 64); ctx.lineTo(ox + 10 + Math.sin(t * 4) * 2, oy - 61); ctx.lineTo(ox, oy - 58); ctx.fill();
      circle(ox - 12, oy - 3, 3); circle(ox + 12, oy - 3, 3);
      line(ox - 18, oy - 6, ox + 18, oy - 6);
      robot(528, fl - 12);
      // operator with a remote
      person(592, fl, { arm: 'hold', flip: true, badge: ENTITIES.Person.color });
      lw(1); box(572, fl - 30, 5, 8);
      ctx.save();
      for (var w = 0; w < 3; w++) {
        var k = mod(t * 1.2 + w / 3, 1);
        ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.arc(572, fl - 30, 6 + k * 22, Math.PI * 0.85, Math.PI * 1.15); ctx.stroke();
      }
      ctx.restore();
      // captions on the stage front
      tag(292, fl - 6, 'PERSON', 7);
      tag(410, fl - 6, 'ORGANIZATION', 7);
      tag(528, fl - 6, 'AGENT', 7);
      // generalization: each kind is a Party (UML hollow arrowheads)
      lw(0.9);
      ctx.save(); ctx.globalAlpha = 0.6; ctx.setLineDash([3, 3]);
      line(294, fl - 66, 345, 378); line(410, fl - 80, 410, 378); line(526, fl - 70, 475, 378);
      ctx.restore();
      [[345, 371], [410, 371], [475, 371]].forEach(function (p) { poly([p[0] - 4, p[1] + 7, p[0], p[1], p[0] + 4, p[1] + 7]); });
      plant(214, fl);
    }

    var ROLES = [['LEAD', 'ACME'], ['CUSTOMER', 'ACME'], ['VENDOR', 'GLOBEX'], ['EMPLOYEE', 'INITECH']];
    function drawRoleDesk(q) {
      var fl = F(q), ce = C(q);
      lamp(800, ce, 16);
      hangSign(720, ce, 'ROLE DESK', ENTITIES.Role.color);
      // badge rack
      frameBoard(734, 352, 122, 62);
      function badgeAt(i) { return [744 + (i % 2) * 54, 360 + Math.floor(i / 2) * 26]; }
      ROLES.forEach(function (r, i) {
        var b = badgeAt(i), bx = b[0], by = b[1];
        lw(0.8); line(bx + 23, by - 2, bx + 23, by + 2);
        lw(1); box(bx, by + 2, 46, 18);
        ctx.fillStyle = ENTITIES.Role.color; ctx.fillRect(bx + 1, by + 3, 44, 4);
        text(r[0], bx + 23, by + 14, 6.5, 'center', 800);
      });
      // counter + clerk
      person(915, fl - 20, { arm: 'forward', flip: true, badge: ENTITIES.Person.color, s: 0.95 });
      lw(1.4);
      box(860, fl - 42, 90, 42);
      ctx.save(); ctx.globalAlpha = 0.6; hatch(860, fl - 42, 90, 42, 6, 0.6); ctx.restore();
      box(866, fl - 52, 40, 12);
      ctx.fillStyle = ENTITIES.Organization.color; ctx.fillRect(867, fl - 51, 4, 10);
      text('@ ORG', 888, fl - 46, 6.5, 'center', 800);
      // the visitor: same person, a new role each visit
      var cyc = 9, c = Math.floor(t / cyc), u = t - c * cyc, x, walking = true, flip = false;
      if (u < 3) x = lerp(706, 840, ease(u / 3));
      else if (u < 5) { x = 840; walking = false; }
      else if (u < 8) { x = lerp(840, 706, ease((u - 5) / 3)); flip = true; }
      else { x = 706; walking = false; }
      var ri = (u < 4 ? c : c + 1) % ROLES.length, role = ROLES[ri];
      var rb = badgeAt(ri);
      DYN.plays = [x + (flip ? -6 : 6), fl - 74, rb[0] + 23, rb[1] + 22];
      DYN.at = [rb[0] + (ri % 2 ? 46 : 0), rb[1] + 12, 880, fl - 54];
      person(x, fl, { walk: walking ? t * 9 : null, flip: flip, arm: u > 3 && u < 5 ? 'forward' : 'down', badge: ENTITIES.Role.color });
      // floating tag
      var tagW = textW(role[0] + ' @ ' + role[1], 7, 800) + 12;
      lw(1);
      box(x - tagW / 2, fl - 72, tagW, 13);
      text(role[0] + ' @ ' + role[1], x, fl - 65.5, 7, 'center', 800);
      line(x, fl - 59, x, fl - 52);
      if (u > 3.6 && u < 4.4) {
        ctx.save(); ctx.globalAlpha = 1 - Math.abs(u - 4) / 0.4;
        lw(1);
        for (var i = 0; i < 6; i++) { var a = i * TAU / 6; line(x + Math.cos(a) * 18, fl - 66 + Math.sin(a) * 11, x + Math.cos(a) * 24, fl - 66 + Math.sin(a) * 15); }
        ctx.restore();
      }
    }

    function drawTeamRoom(q) {
      var fl = F(q), ce = C(q);
      lamp(1060, ce, 16); lamp(1200, ce, 16);
      // team sign + org plaque
      lw(1.3);
      box(1078, 340, 94, 26);
      ctx.fillStyle = ENTITIES.Team.color; ctx.fillRect(1079, 341, 5, 24);
      text('TEAM · PLATFORM', 1128, 353, 8, 'center', 800);
      box(1236, 342, 44, 22);
      text('ACME', 1258, 353, 8, 'center', 800);
      // whiteboard with stickies
      frameBoard(985, 336, 74, 50);
      for (var i = 0; i < 6; i++) {
        var sx = 992 + (i % 3) * 21, sy = 344 + Math.floor(i / 3) * 18;
        lw(0.8); box(sx, sy, 14, 12, i === 2 ? hexA(ENTITIES.Team.color, 0.35) : P.paper);
      }
      // desks with members
      desk(990, fl - 34, 120, fl);
      desk(1160, fl - 34, 110, fl);
      monitor(1006, fl - 58, 30, 20); monitor(1066, fl - 58, 30, 20);
      monitor(1196, fl - 58, 30, 20);
      chair(1015, fl); chair(1075, fl); chair(1205, fl);
      person(1012, fl, { seated: true, arm: 'type', badge: ENTITIES.Person.color });
      person(1072, fl, { seated: true, arm: 'type', badge: ENTITIES.Person.color });
      robot(1240, fl, { arm: 'type', flip: true });
      plant(1275, fl - 34);
    }

    function drawPermissions(q) {
      var fl = F(q), ce = C(q);
      lamp(1400, ce, 16);
      hangSign(1560, ce, 'PERMISSIONS', ENTITIES.Permission.color);
      // key cabinet
      frameBoard(1310, 360, 74, 74);
      var labels = ['VIEW', 'EDIT', 'ADMIN'];
      for (var i = 0; i < 3; i++) {
        var ky = 376 + i * 20;
        lw(1); circle(1322, ky, 2, P.ink);
        keyShape(1322, ky + 3, Math.sin(t * 2 + i) * 0.15);
        text(labels[i], 1360, ky + 5, 7, 'center', 800);
      }
      // vault door
      lw(1.6);
      box(1508, 352, 88, 110);
      circle(1552, 407, 26);
      for (var s = 0; s < 4; s++) { var a = t * 0.3 + s * TAU / 4; line(1552, 407, 1552 + Math.cos(a) * 22, 407 + Math.sin(a) * 22); }
      circle(1552, 407, 6, P.ink);
      // clerk handing keys
      person(1400, fl, { arm: 'forward', badge: ENTITIES.Person.color });
      robot(1470, fl, { flip: true, arm: 'forward' });
      person(1572, fl, { flip: true, arm: 'forward', badge: ENTITIES.Person.color });
      // a key in flight, alternating recipients
      var per = 4, c = Math.floor(t / per), u = (t - c * per) / per;
      if (u < 0.7) {
        var k = ease(u / 0.7), tx = c % 2 ? 1572 - 14 : 1470 - 16, ty = fl - 24;
        var kx = lerp(1416, tx, k), ky2 = lerp(fl - 30, ty, k) - Math.sin(k * Math.PI) * 30;
        keyShape(kx, ky2, k * 3);
        text(c % 2 ? 'EDIT' : 'VIEW', kx, ky2 - 10, 6.5, 'center', 800);
      }
    }
    function keyShape(x, y, a) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      lw(1.1);
      circle(0, 0, 3.2);
      line(0, 3.2, 0, 14); line(0, 10, 3, 10); line(0, 13, 3, 13);
      ctx.fillStyle = ENTITIES.Permission.color;
      ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // the pneumatic tube from the document room to the project room
    var TUBE = [[1452, 590], [1452, 548], [262, 548], [262, 586]];
    var TUBE_LEN = (function () {
      var L = 0;
      for (var i = 1; i < TUBE.length; i++) L += Math.hypot(TUBE[i][0] - TUBE[i - 1][0], TUBE[i][1] - TUBE[i - 1][1]);
      return L;
    })();
    function alongTube(d) {
      for (var i = 1; i < TUBE.length; i++) {
        var a = TUBE[i - 1], b = TUBE[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= L) return [lerp(a[0], b[0], d / L), lerp(a[1], b[1], d / L)];
        d -= L;
      }
      return TUBE[TUBE.length - 1];
    }
    function drawTube() {
      ctx.lineJoin = 'round';
      ctx.beginPath();
      TUBE.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      lw(9); ctx.strokeStyle = P.ink; ctx.stroke();
      lw(6); ctx.strokeStyle = P.paper; ctx.stroke();
      ctx.strokeStyle = P.ink;
      // bands
      lw(1);
      for (var x = 300; x < 1440; x += 70) line(x, 543, x, 553);
      // capsules
      for (var k = 0; k < 4; k++) {
        var d = mod(t * 140 + k * TUBE_LEN / 4, TUBE_LEN);
        var p = alongTube(d);
        ctx.fillStyle = ENTITIES.Document.color;
        ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, TAU); ctx.fill();
      }
    }

    function drawProjects(q) {
      var fl = F(q), ce = C(q);
      lamp(370, ce + 10, 12);
      hangSign(400, ce + 8, 'PROJECTS', ENTITIES.Project.color);
      // corkboard with project folders
      frameBoard(196, 600, 150, 74);
      var names = ['LAUNCH', 'MIGRATE', 'HIRING'];
      names.forEach(function (n, i) {
        var fx = 206 + i * 46, fy = 612;
        lw(1.1);
        poly([fx, fy + 4, fx + 12, fy + 4, fx + 15, fy, fx + 38, fy, fx + 38, fy + 46, fx, fy + 46]);
        ctx.fillStyle = ENTITIES.Project.color; ctx.fillRect(fx + 1, fy + 5, 3, 40);
        text(n, fx + 20, fy + 14, 6, 'center', 800);
        // task cards pinned inside
        for (var j = 0; j < 2 + (i % 2); j++) { lw(0.7); box(fx + 8, fy + 20 + j * 8, 22, 6); }
      });
      // document tray under the tube outlet
      lw(1.2); box(246, 590, 34, 8);
      var tray = Math.floor(t * 140 / (TUBE_LEN / 4)) % 4;
      for (var p = 0; p < 2 + tray % 2; p++) { lw(0.8); box(250 + p * 3, 584 - p * 2, 22, 6); }
      // incoming slot for task cards
      lw(1.2); box(452, fl - 44, 22, 22, P.ink);
      // project lead
      person(380, fl, { arm: 'up', flip: true, badge: ENTITIES.Person.color });
      desk(300, fl - 32, 70, fl);
      monitor(318, fl - 54, 30, 20);
    }

    function drawTaskLine(q) {
      var fl = F(q), ce = C(q);
      lamp(600, ce + 14, 10); lamp(900, ce + 14, 10);
      hangSign(560, ce + 14, 'TASKS', ENTITIES.Task.color);
      var by = fl - 34;
      belt(476, 1110, by, -38, fl);
      // assignment stamp
      var stampX = 760;
      var period = 3.2, speed = 38, startX = 1086;
      var nearest = 1e9;
      var cards = [];
      for (var j = 0; j < 9; j++) {
        var k = Math.floor(t / period) - j;
        var age = t - k * period;
        var x = startX - age * speed;
        if (x < 470) continue;
        var drop = clamp(age / 0.45, 0, 1);
        cards.push({ k: k, x: x, y: lerp(by - 64, by - 24, ease(drop)) });
        nearest = Math.min(nearest, Math.abs(x + 17 - stampX));
      }
      var press = clamp(1 - nearest / 14, 0, 1);
      // stamp machine
      lw(1.3);
      box(stampX - 18, ce + 40, 36, 30);
      text('ASSIGN', stampX, ce + 55, 7, 'center', 800);
      line(stampX - 3, ce + 70, stampX - 3, by - 44 + press * 14);
      line(stampX + 3, ce + 70, stampX + 3, by - 44 + press * 14);
      box(stampX - 10, by - 44 + press * 14, 20, 8);
      cards.forEach(function (c) {
        var mark = c.x + 17 < stampX ? (c.k % 2 ? 'p' : 'r') : null;
        taskCard(c.x, c.y, 34, 24, { mark: mark });
        if (mod(c.k, 3) !== 1) {
          // subtasks ride on top, tied to the parent
          lw(0.8); line(c.x + 10, c.y, c.x + 10, c.y - 4);
          taskCard(c.x + 4, c.y - 16, 18, 12);
          if (mod(c.k, 3) === 0) { line(c.x + 26, c.y, c.x + 26, c.y - 4); taskCard(c.x + 20, c.y - 16, 16, 12); }
        }
      });
      // the two kinds of assignee standing by the belt
      person(640, fl, { arm: 'forward', badge: ENTITIES.Person.color });
      robot(880, fl, { flip: true, arm: 'forward' });
      // "task / subtask" legend on the wall
      frameBoard(930, ce + 34, 100, 54);
      taskCard(946, ce + 60, 30, 20);
      lw(0.8); line(954, ce + 60, 954, ce + 56);
      taskCard(948, ce + 42, 18, 13);
      text('subtask', 1004, ce + 49, 7, 'center', 700);
      text('parent', 1004, ce + 70, 7, 'center', 700);
    }

    function drawAutomation(q) {
      var fl = F(q), ce = C(q);
      lamp(1240, ce + 14, 10);
      hangSign(1230, ce + 14, 'AUTOMATION', ENTITIES.Automation.color);
      // machine body
      lw(1.6);
      box(1078, 574, 140, 104);
      ctx.save(); ctx.globalAlpha = 0.5; hatch(1078, 660, 140, 18, 5, 0.6); ctx.restore();
      gear(1112, 604, 20, 10, t * 1.2);
      gear(1143, 624, 13, 8, -t * 1.85 + 0.2);
      gear(1112, 642, 11, 7, -t * 2.2);
      // rule panel
      lw(1.1); box(1160, 584, 50, 46);
      text('WHEN', 1170, 593, 6, 'left', 800);
      text('IF', 1170, 606, 6, 'left', 800);
      text('THEN', 1170, 619, 6, 'left', 800);
      ctx.fillStyle = ENTITIES.Automation.color;
      [593, 606, 619].forEach(function (y, i) { if (Math.sin(t * 2 - i) > 0) ctx.fillRect(1196, y - 2.5, 8, 5); });
      // enabled lever
      lw(1.4); line(1170, 650, 1186, 638); circle(1186, 638, 3, P.ink);
      text('ON', 1200, 650, 6.5, 'center', 800);
      // chute onto the belt
      lw(1.3);
      poly([1074, 640, 1074, 610, 1100, 610, 1100, fl - 70]);
      // mechanic with a wrench
      person(1282, fl, { arm: 'forward', flip: true, badge: ENTITIES.Person.color, cap: true });
      lw(1.4); line(1262, fl - 30, 1254, fl - 38);
    }

    function drawDocuments(q) {
      var fl = F(q), ce = C(q);
      hangSign(1560, ce + 14, 'DOCUMENTS', ENTITIES.Document.color);
      // filing cabinet with four kinds
      lw(1.4);
      box(1338, fl - 104, 52, 104);
      ['DOC', 'FILE', 'NOTE', 'TEMPL.'].forEach(function (k, i) {
        lw(1); box(1342, fl - 100 + i * 25, 44, 21);
        line(1358, fl - 86 + i * 25, 1370, fl - 86 + i * 25);
        text(k, 1364, fl - 93 + i * 25, 6.5, 'center', 800);
      });
      // printer feeding the tube
      lw(1.3);
      box(1430, 590, 44, 24);
      var feed = mod(t * 0.9, 1);
      box(1438, 590 - feed * 10, 28, 10);
      // writing desk: a person and an agent both author
      desk(1410, fl - 34, 190, fl);
      monitor(1436, fl - 58, 28, 20); monitor(1538, fl - 58, 28, 20);
      chair(1446, fl); chair(1578, fl);
      person(1446, fl, { seated: true, arm: 'type', badge: ENTITIES.Person.color });
      robot(1572, fl, { arm: 'type', flip: true });
      // a page with a byline
      lw(1); box(1496, fl - 52, 22, 18);
      ctx.save(); ctx.globalAlpha = 0.7; lw(0.6); hlines(1499, fl - 52, 16, 18, 4); ctx.restore();
    }

    function drawProducts(q) {
      var fl = F(q), ce = C(q);
      hangSign(250, ce, 'PRODUCTS', ENTITIES.Product.color);
      // spotlight
      ctx.save();
      ctx.globalAlpha = P.dark ? 0.1 : 0.06;
      ctx.fillStyle = P.dark ? '#fff3c4' : P.ink;
      ctx.beginPath(); ctx.moveTo(330, ce); ctx.lineTo(350, ce); ctx.lineTo(400, fl); ctx.lineTo(280, fl); ctx.fill();
      ctx.restore();
      // shelves
      lw(1.3);
      var shelves = [
        [790, 'APP', [['CRM', '$49'], ['Mobile', '$9'], ['API', '$99']]],
        [842, 'SERVICE', [['Setup', '$900'], ['Training', '$400'], ['Support', '$1,200']]],
        [894, 'PLAN', [['Basic', '$9/mo'], ['Pro', '$19/mo'], ['Team', '$49/mo']]]
      ];
      shelves.forEach(function (s, i) {
        var y = s[0];
        line(200, y + 22, 452, y + 22);
        for (var b = 0; b < 3; b++) {
          var bx = 208 + b * 82, item = s[2][b];
          lw(1.1);
          box(bx, y - 4, 46, 26);
          ctx.fillStyle = ENTITIES.Product.color; ctx.fillRect(bx + 1, y - 3, 44, 4);
          text(item[0], bx + 23, y + 8, 7, 'center', 800);
          text('kind: ' + s[1].toLowerCase(), bx + 23, y + 16, 4.5, 'center', 600);
          lw(0.8);
          box(bx + 50, y + 4, 26, 11);
          text(item[1], bx + 63, y + 9.5, 5, 'center', 800);
        }
        lw(1.3);
        if (i === 0) { line(200, y - 30, 200, fl); line(452, y - 30, 452, fl); }
      });
    }

    var STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'WON'];
    function drawDeals(q) {
      var fl = F(q), ce = C(q);
      lamp(620, ce, 14); lamp(880, ce, 14);
      hangSign(540, ce, 'DEALS', ENTITIES.Deal.color);
      var by = fl - 30;
      belt(480, 960, by, 45, fl);
      var gates = [560, 680, 800, 920];
      gates.forEach(function (gx, i) {
        lw(1.5);
        line(gx - 22, by, gx - 22, by - 72);
        line(gx + 22, by, gx + 22, by - 72);
        ctx.beginPath(); ctx.arc(gx, by - 72, 22, Math.PI, 0); ctx.stroke();
        var w = textW(STAGES[i], 7, 800) + 10;
        lw(1); box(gx - w / 2, by - 106, w, 13, i === 3 ? hexA(ENTITIES.Deal.color, 0.3) : P.paper);
        text(STAGES[i], gx, by - 99.5, 7, 'center', 800);
      });
      // crates: one deal each, carrying its stage as a label
      var period = 6, speed = 45;
      for (var j = 0; j < 4; j++) {
        var k = Math.floor(t / period) - j;
        var x = 486 + (t - k * period) * speed;
        if (x > 932) continue;
        var passed = 0;
        gates.forEach(function (gx) { if (x + 14 > gx) passed++; });
        var stage = STAGES[Math.max(0, passed - 1)];
        crate(x, by - 26, 28, 26);
        var lab = 'stage: ' + stage;
        var w = textW(lab, 6, 800) + 8;
        lw(0.8); box(x + 14 - w / 2, by - 40, w, 10);
        text(lab, x + 14, by - 35, 6, 'center', 800);
        lw(0.7); line(x + 14, by - 30, x + 14, by - 26);
      }
      // the counterparty, shaking hands with sales
      person(986, fl, { arm: 'forward', badge: ENTITIES.Person.color });
      person(1014, fl, { arm: 'forward', flip: true, badge: ENTITIES.Organization.color });
      text('SALES', 986, fl - 56, 6.5, 'center', 800);
      text('CLIENT', 1014, fl - 66, 6.5, 'center', 800);
    }

    function drawInteractions(q) {
      var fl = F(q), ce = C(q);
      hangSign(1268, ce, 'INTERACTIONS', ENTITIES.Interaction.color);
      // phone booth
      lw(1.4);
      box(1058, fl - 108, 46, 108);
      box(1064, fl - 100, 34, 56);
      text('CALL', 1081, fl - 100 + 64, 6.5, 'center', 800);
      var ring = Math.sin(t * 22) * (mod(t, 3) < 1 ? 1.5 : 0);
      lw(1.1); box(1074 + ring, fl - 84, 14, 9);
      person(1082, fl - 2, { arm: 'hold', s: 0.9, badge: ENTITIES.Person.color });
      // mail slot and laptop chat
      lw(1.2);
      box(1124, fl - 92, 40, 26);
      line(1124, fl - 92, 1144, fl - 78); line(1164, fl - 92, 1144, fl - 78);
      desk(1118, fl - 40, 70, fl);
      lw(1.1); poly([1132, fl - 40, 1136, fl - 54, 1166, fl - 54, 1170, fl - 40]);
      // meeting table with two people and an agent: one interaction
      lw(1.3);
      box(1210, fl - 34, 90, 5);
      line(1255, fl - 29, 1255, fl);
      person(1222, fl, { arm: 'forward', badge: ENTITIES.Person.color });
      robot(1262, fl - 34);
      person(1292, fl, { arm: 'forward', flip: true, badge: ENTITIES.Person.color });
      // conversation bubbles drifting toward the deal they are about
      var srcs = [[1086, fl - 95, 'call'], [1144, fl - 98, 'email'], [1150, fl - 64, 'chat'], [1255, fl - 92, 'meeting']];
      for (var k = 0; k < 6; k++) {
        var per = 6, phase = mod(t + k * per / 6, per) / per;
        var s = srcs[k % 4];
        var x = lerp(s[0], 1046, ease(phase)), y = s[1] - Math.sin(phase * Math.PI) * 26;
        ctx.save(); ctx.globalAlpha = 1 - Math.pow(phase, 3);
        var w = textW(s[2], 6.5, 800) + 10;
        lw(1);
        box(x - w / 2, y - 7, w, 13, phase > 0.02 ? P.paper : P.paper);
        poly([x - 3, y + 6, x, y + 10, x + 3, y + 6], P.paper);
        ctx.fillStyle = ENTITIES.Interaction.color; ctx.fillRect(x - w / 2 + 1, y - 6, 2.5, 11);
        text(s[2], x + 1, y - 0.5, 6.5, 'center', 800);
        ctx.restore();
      }
    }

    function drawViews(q) {
      var fl = F(q), ce = C(q);
      hangSign(1560, ce, 'SAVED VIEWS', ENTITIES.SavedView.color);
      var y = ce + 38;
      // kanban
      monitor(1356, y, 76, 54);
      for (var c = 0; c < 3; c++) {
        lw(0.6); line(1356 + (c + 1) * 25.3, y + 3, 1356 + (c + 1) * 25.3, y + 51);
      }
      var mv = mod(t / 2.5, 3);
      for (var n = 0; n < 5; n++) {
        var col = n < 2 ? 0 : n < 4 ? 1 : 2;
        if (n === 1) col = Math.floor(mv);
        lw(0.8); box(1360 + col * 25.3, y + 6 + (n % 2) * 12 + (n > 3 ? 24 : 0), 17, 8, n === 1 ? hexA(ENTITIES.Task.color, 0.45) : P.paper);
      }
      text('layout: kanban', 1394, y + 70, 6.5, 'center', 800);
      // table
      monitor(1442, y, 76, 54);
      lw(0.6); hlines(1442, y, 76, 54, 9); line(1470, y, 1470, y + 54);
      text('layout: table', 1480, y + 70, 6.5, 'center', 800);
      // calendar
      monitor(1528, y, 76, 54);
      lw(0.6);
      for (var i = 1; i < 7; i++) line(1528 + i * 10.85, y, 1528 + i * 10.85, y + 54);
      hlines(1528, y, 76, 54, 13.5);
      ctx.fillStyle = hexA(ENTITIES.SavedView.color, 0.6);
      ctx.fillRect(1528 + 3 * 10.85 + 1, y + 13.5 + 1, 9, 12);
      text('layout: calendar', 1566, y + 70, 6.5, 'center', 800);
      // console + owner
      desk(1440, fl - 34, 120, fl);
      chair(1546, fl);
      person(1546, fl, { seated: true, arm: 'type', badge: ENTITIES.Person.color });
      lw(1); box(1470, fl - 46, 40, 12);
      text('SAVE VIEW', 1490, fl - 40, 5.5, 'center', 800);
    }

    function drawSubscriptions(q) {
      var fl = F(q), ce = C(q);
      hangSign(250, ce, 'SUBSCRIPTIONS', ENTITIES.Subscription.color);
      var cx = 370, cy = 1068, r = 66;
      var per = 6, a = t / per * TAU;
      // stand
      lw(1.6);
      poly([cx - 40, fl, cx, cy, cx + 40, fl], false);
      lw(1.5);
      circle(cx, cy, r);
      circle(cx, cy, r - 8, false);
      for (var s = 0; s < 8; s++) { var b = a + s * TAU / 8; line(cx + Math.cos(b) * 14, cy + Math.sin(b) * 14, cx + Math.cos(b) * (r - 8), cy + Math.sin(b) * (r - 8)); }
      circle(cx, cy, 16, hexA(ENTITIES.Subscription.color, 0.45));
      text('RENEWS', cx, cy, 6, 'center', 800);
      // riders: the product it is for, the party that holds it
      var pa = a - Math.PI / 2, ha = a + Math.PI / 2;
      lw(1.1);
      var px1 = cx + Math.cos(pa) * r, py1 = cy + Math.sin(pa) * r;
      box(px1 - 11, py1 - 9, 22, 18);
      ctx.fillStyle = ENTITIES.Product.color; ctx.fillRect(px1 - 10, py1 - 8, 20, 3);
      text('PLAN', px1, py1 + 2.5, 5.5, 'center', 800);
      var hx = cx + Math.cos(ha) * r, hy = cy + Math.sin(ha) * r;
      circle(hx, hy, 9, hexA(ENTITIES.Person.color, 0.35));
      circle(hx, hy - 2.5, 2.6); line(hx - 4, hy + 4, hx + 4, hy + 4);
      // the holder, watching
      person(272, fl, { arm: 'up', badge: ENTITIES.Role.color });
      text('CUSTOMER', 272, fl - 58, 6.5, 'center', 800);
      // chute: an invoice falls out at every renewal
      lw(1.3);
      poly([440, 1060, 470, 1060, 520, fl - 26], false);
    }

    function invoiceAt(k) {
      // every renewal (6 s) prints one invoice that rides the belt to payments
      var period = 6, age = t - k * period;
      return { x: 470 + age * 62, age: age, paid: false };
    }
    function drawInvoicesAndPayments() {
      var flI = F(ROOMS[13]), ce = C(ROOMS[13]);
      hangSign(640, ce, 'INVOICES', ENTITIES.Invoice.color);
      hangSign(1140, ce, 'PAYMENTS', ENTITIES.Payment.color);
      var by = flI - 26;
      belt(500, 1200, by, 62, flI);
      // press
      var pressX = 730;
      var near = 1e9, nearPay = 1e9, payX = 1010;
      var docs = [];
      for (var j = 0; j < 4; j++) {
        var k = Math.floor(t / 6) - j;
        var d = invoiceAt(k);
        if (d.x > 1180 || d.x < 470) continue;
        docs.push({ k: k, x: d.x });
        near = Math.min(near, Math.abs(d.x + 13 - pressX));
        nearPay = Math.min(nearPay, Math.abs(d.x + 13 - payX));
      }
      var press = clamp(1 - near / 12, 0, 1);
      lw(1.5);
      box(pressX - 34, ce + 26, 68, 40);
      ctx.save(); ctx.globalAlpha = 0.5; hatch(pressX - 34, ce + 26, 68, 40, 6, 0.6); ctx.restore();
      lw(1.3); box(pressX - 22, ce + 34, 44, 18);
      text('INVOICE', pressX, ce + 43, 7, 'center', 800);
      line(pressX - 26, ce + 66, pressX - 26, by); line(pressX + 26, ce + 66, pressX + 26, by);
      lw(1.4);
      line(pressX, ce + 66, pressX, by - 36 + press * 10);
      box(pressX - 14, by - 36 + press * 10, 28, 8);
      // register + cashier
      lw(1.4);
      box(payX - 26, by - 74, 52, 36);
      box(payX - 20, by - 70, 26, 12);
      text('$', payX - 7, by - 64, 8, 'center', 800);
      for (var kk = 0; kk < 3; kk++) circle(payX + 12, by - 66 + kk * 9, 2.4);
      line(payX - 8, by - 38, payX - 8, by - 30);
      person(1080, flI, { arm: 'forward', flip: true, badge: ENTITIES.Person.color });
      // card reader
      lw(1.1); box(1112, flI - 52, 14, 22);
      ctx.fillStyle = ENTITIES.Payment.color; ctx.fillRect(1114, flI - 49, 10, 5);
      // binder for settled invoices
      lw(1.3); box(1180, flI - 60, 30, 60);
      for (var bb = 0; bb < 4; bb++) { lw(0.8); line(1184 + bb * 6, flI - 56, 1184 + bb * 6, flI - 4); }
      // invoices
      docs.forEach(function (dd) {
        var paid = dd.x + 13 > payX;
        lw(1);
        box(dd.x, by - 18, 26, 18, paid ? hexA(ENTITIES.Payment.color, 0.3) : P.paper);
        text('INV', dd.x + 13, by - 13, 5.5, 'center', 800);
        lw(0.6); line(dd.x + 4, by - 8, dd.x + 22, by - 8); line(dd.x + 4, by - 4, dd.x + 16, by - 4);
        if (dd.x + 13 > pressX) text('$49', dd.x + 21, by - 4.5, 4.5, 'center', 800);
        if (paid) {
          ctx.save(); ctx.translate(dd.x + 13, by - 9); ctx.rotate(-0.25);
          lw(1); ctx.strokeStyle = P.ink; ctx.strokeRect(-12, -4.5, 24, 9);
          text('PAID', 0, 0.5, 6, 'center', 900);
          ctx.restore();
        }
      });
      // coin dropping as an invoice reaches the register
      var cp = clamp(1 - nearPay / 30, 0, 1);
      if (cp > 0) {
        var cy = by - 38 + (1 - cp) * 0 + cp * 18;
        circle(payX - 8, cy, 4, hexA(ENTITIES.Payment.color, 0.8));
      }
    }

    function drawLobby(q) {
      var fl = F(q), ce = C(q);
      lamp(1340, ce, 20); lamp(1500, ce, 20);
      sign(1420, ce + 30, 'WELCOME', 12);
      // reception
      lw(1.4);
      box(1260, fl - 40, 90, 40);
      ctx.save(); ctx.globalAlpha = 0.5; hatch(1260, fl - 40, 90, 40, 6, 0.6); ctx.restore();
      person(1300, fl - 40, { arm: 'forward', badge: ENTITIES.Person.color, s: 0.9 });
      // revolving door in the outer wall
      lw(1.4);
      line(X1 - 6, 1080, X1 - 6, fl);
      line(X1 + 6, 1080, X1 + 6, fl);
      lw(1.2);
      line(X1, 1084, X1, fl);
      for (var p = 0; p < 3; p++) {
        var a = t * 0.8 + p * Math.PI / 3;
        var dx = Math.cos(a) * 28;
        line(X1 + dx, 1084, X1 + dx, fl);
      }
      ctx.save(); ctx.globalAlpha = 0.25; hatch(X1 - 30, 1082, 60, fl - 1082, 10, 0.5); ctx.restore();
      // visitors walking in
      for (var k = 0; k < 2; k++) {
        var u = mod(t / 14 + k / 2, 1);
        var vx = lerp(1600, 1380, u);
        ctx.save(); ctx.globalAlpha = u < 0.06 ? u / 0.06 : u > 0.92 ? (1 - u) / 0.08 : 1;
        if (k) robot(vx, fl, { flip: true }); else person(vx, fl, { walk: t * 9, flip: true, badge: ENTITIES.Organization.color });
        ctx.restore();
      }
      plant(1580, fl); plant(1240, fl);
    }

    var LEDGER = [
      'Ana · Person · created Task #311',
      'Agent-7 · Agent · sent Interaction (email)',
      'Rules-bot · Automation · created Task #312',
      'Ben · Person · edited Document "Spec"',
      'ACME · Organization · paid Invoice INV-0042',
      'Agent-7 · Agent · moved Deal → PROPOSAL',
      'Ana · Person · granted Permission EDIT',
      'Kim · Person · saved View "My week"'
    ];
    function drawAudit(q) {
      var x0 = q.x, y0 = q.y, w = q.w, h = q.h;
      sign(x0 + w / 2, y0 + 14, 'AUDIT VAULT · append-only', 10, ENTITIES.AuditEvent.color);
      lamp(x0 + 400, y0, 10); lamp(x0 + 800, y0, 10);
      // archive shelves
      for (var s = 0; s < 2; s++) {
        var sy = y0 + 48 + s * 34;
        lw(1.2); line(x0 + 20, sy + 24, x0 + 240, sy + 24);
        for (var b = 0; b < 9; b++) { lw(0.9); box(x0 + 24 + b * 24, sy + 2, 18, 22); }
        lw(1.2); line(x0 + w - 240, sy + 24, x0 + w - 20, sy + 24);
        for (var c = 0; c < 9; c++) { lw(0.9); box(x0 + w - 236 + c * 24, sy + 2, 18, 22); }
      }
      // ledger tape
      var ty = y0 + 76, tx0 = x0 + 270, tx1 = x0 + w - 270;
      lw(1.4);
      circle(tx0 - 12, ty + 12, 14); circle(tx1 + 12, ty + 12, 14);
      circle(tx0 - 12, ty + 12, 4, P.ink); circle(tx1 + 12, ty + 12, 4, P.ink);
      box(tx0, ty, tx1 - tx0, 26);
      ctx.save();
      ctx.beginPath(); ctx.rect(tx0, ty, tx1 - tx0, 26); ctx.clip();
      var entryW = 250, off = t * 24;
      var first = Math.floor(off / entryW);
      for (var e = first; e < first + Math.ceil((tx1 - tx0) / entryW) + 2; e++) {
        var ex = tx1 - (e * entryW - off) - entryW;
        lw(0.7); line(ex, ty + 3, ex, ty + 23);
        var mins = 14 + e;
        var stamp = '09:' + (mins % 60 < 10 ? '0' : '') + (mins % 60);
        text(stamp, ex + 8, ty + 13.5, 7, 'left', 800, MONO);
        text(LEDGER[mod(e, LEDGER.length)], ex + 40, ty + 13.5, 7, 'left', 600, MONO);
      }
      ctx.restore();
      // stamping head at the right end of the tape
      lw(1.4);
      box(tx1 - 40, ty - 34, 34, 24);
      line(tx1 - 23, ty - 10, tx1 - 23, ty - 3 + (mod(t * 24, entryW) < 12 ? 3 : 0));
      text('LOG', tx1 - 23, ty - 22, 7, 'center', 800);
      // a keeper with a lantern
      person(x0 + w / 2, y0 + h - 6, { arm: 'hold', badge: ENTITIES.AuditEvent.color });
      text('nothing is ever erased', x0 + w / 2 + 16, y0 + h - 30, 8, 'left', 700);
    }

    // audit risers: slips falling from every floor into the vault
    function drawRisers() {
      var pipes = [[166, 1196 + 20, 300], [1634, 1196 + 20, 1500]];
      pipes.forEach(function (p) {
        var x = p[0];
        ctx.beginPath();
        ctx.moveTo(x, 330); ctx.lineTo(x, p[1]); ctx.lineTo(p[2], p[1]);
        lw(9); ctx.strokeStyle = P.ink; ctx.stroke();
        lw(6); ctx.strokeStyle = P.paper; ctx.stroke();
        ctx.strokeStyle = P.ink;
        lw(1.1);
        [410, 630, 850, 1070].forEach(function (y) { line(x - 8, y, x + 8, y); line(x - 8, y + 4, x + 8, y + 4); });
        for (var k = 0; k < 5; k++) {
          var d = mod(t * 90 + k * 230 + x, 1150);
          var px1, py1;
          var vert = p[1] - 330;
          if (d < vert) { px1 = x; py1 = 330 + d; } else { px1 = x + (p[2] > x ? 1 : -1) * (d - vert); py1 = p[1]; if (Math.abs(px1 - x) > Math.abs(p[2] - x)) continue; }
          ctx.fillStyle = ENTITIES.AuditEvent.color;
          ctx.fillRect(px1 - 2.5, py1 - 2, 5, 4);
        }
      });
    }

    function drawRooms() {
      drawTube();
      drawPartyHall(ROOMS[0]);
      drawRoleDesk(ROOMS[1]);
      drawTeamRoom(ROOMS[2]);
      drawPermissions(ROOMS[3]);
      drawProjects(ROOMS[4]);
      drawTaskLine(ROOMS[5]);
      drawAutomation(ROOMS[6]);
      drawDocuments(ROOMS[7]);
      drawProducts(ROOMS[8]);
      drawDeals(ROOMS[9]);
      drawInteractions(ROOMS[10]);
      drawViews(ROOMS[11]);
      drawSubscriptions(ROOMS[12]);
      drawInvoicesAndPayments();
      drawLobby(ROOMS[15]);
      drawAudit(ROOMS[16]);
      drawRisers();
    }

    // =========================================================================
    // Overlays: step arrows, focus highlight, ontology map
    // =========================================================================

    function arrow(x1, y1, x2, y2, bend, color, label, k) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      var dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
      var b = bend == null ? Math.min(40, d * 0.22) : bend;
      var cx = mx - dy / d * b, cy = my + dx / d * b;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.strokeStyle = color;
      lw(2.2);
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -t * 18;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      var ang = Math.atan2(y2 - cy, x2 - cx);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(ang - 0.42) * 9, y2 - Math.sin(ang - 0.42) * 9);
      ctx.lineTo(x2 - Math.cos(ang + 0.42) * 9, y2 - Math.sin(ang + 0.42) * 9);
      ctx.fill();
      circle(x1, y1, 2.6, color);
      if (label) {
        var lx = 0.25 * x1 + 0.5 * cx + 0.25 * x2, ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
        pill(lx, ly, label, color);
      }
      ctx.restore();
    }
    function pill(x, y, label, color, size) {
      size = size || 8;
      var w = textW(label, size, 800) + 10, h = size + 6;
      ctx.fillStyle = P.paper;
      ctx.strokeStyle = color;
      lw(1.4);
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(x - w / 2, y - h / 2, w, h);
      ctx.fill(); ctx.stroke();
      ctx.font = '800 ' + size + 'px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = P.dark ? P.ink : color;
      ctx.fillText(label, x, y + 0.5);
      ctx.strokeStyle = P.ink;
    }

    function drawFocus() {
      var s = TOUR[step];
      if (s.map || !s.ents.length) return;
      // dim everything outside the stop's rect a little, tint its rooms
      var r = s.rect;
      ctx.save();
      ctx.globalAlpha = 0.5 * focusK;
      ctx.fillStyle = P.paper;
      ctx.beginPath();
      ctx.rect(-500, -500, W + 1000, H + 1000);
      ctx.rect(r[0] + r[2], r[1], -r[2], r[3]);
      ctx.fill('evenodd');
      ctx.restore();
      ROOMS.forEach(function (q) {
        if (q.step !== step) return;
        var col = q.ent ? ENTITIES[q.ent].color : P.ink;
        ctx.save();
        ctx.globalAlpha = focusK;
        ctx.strokeStyle = col;
        lw(3);
        ctx.strokeRect(q.x + 7, q.y + 7, q.w - 14, q.h - 14);
        ctx.restore();
      });
      s.rels.forEach(function (rel) {
        var p = rel.dyn ? DYN[rel.dyn] : rel.pts;
        if (!p) return;
        arrow(p[0], p[1], p[2], p[3], rel.bend, ENTITIES[rel.from].color, rel.label, focusK);
      });
    }

    function drawMap(k) {
      if (k <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = 0.72 * k;
      ctx.fillStyle = P.paper;
      ctx.fillRect(-500, -500, W + 1000, H + 1000);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = k;
      // edges
      RELATIONS.forEach(function (r, i) {
        var a = ANCHORS[r[0]], b = ANCHORS[r[2]];
        var col = ENTITIES[r[0]].color;
        if (r[0] === r[2]) {
          ctx.strokeStyle = col; lw(2);
          ctx.beginPath(); ctx.arc(a[0] + 30, a[1] - 26, 22, 0, TAU); ctx.stroke();
          pill(a[0] + 56, a[1] - 46, r[1], col, 8);
          return;
        }
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        var sx = a[0] + dx / d * 26, sy = a[1] + dy / d * 26, ex = b[0] - dx / d * 28, ey = b[1] - dy / d * 28;
        arrow(sx, sy, ex, ey, (i % 2 ? 1 : -1) * Math.min(60, d * 0.12), col, null, 1);
      });
      // labels after edges so they sit on top
      RELATIONS.forEach(function (r, i) {
        if (r[0] === r[2]) return;
        var a = ANCHORS[r[0]], b = ANCHORS[r[2]];
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        var bend = (i % 2 ? 1 : -1) * Math.min(60, d * 0.12);
        var mx = (a[0] + b[0]) / 2 - dy / d * bend * 0.5, my = (a[1] + b[1]) / 2 + dx / d * bend * 0.5;
        pill(mx, my, r[1], ENTITIES[r[0]].color, 8);
      });
      // subclass links
      ['Person', 'Organization', 'Agent'].forEach(function (n) {
        var a = ANCHORS[n], b = ANCHORS.Party;
        ctx.strokeStyle = P.ink; lw(1.6);
        ctx.setLineDash([3, 3]); line(a[0], a[1] - 24, b[0] + (a[0] - b[0]) * 0.3, b[1] + 26); ctx.setLineDash([]);
      });
      // nodes
      Object.keys(ANCHORS).forEach(function (n) {
        var p = ANCHORS[n], e = ENTITIES[n];
        var R = n === 'Party' ? 30 : 24;
        ctx.strokeStyle = e.color; lw(3);
        circle(p[0], p[1], R, P.paper);
        ctx.font = (n === 'Party' ? 24 : 18) + 'px ' + FONT;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = P.ink;
        ctx.fillText(e.icon, p[0], p[1] + 1);
        ctx.strokeStyle = P.ink;
        var w = textW(n, 10, 800) + 10;
        ctx.fillStyle = e.color;
        ctx.fillRect(p[0] - w / 2, p[1] + R + 3, w, 15);
        ctx.font = '800 10px ' + FONT;
        ctx.fillStyle = '#fff';
        ctx.fillText(n, p[0], p[1] + R + 11);
      });
      ctx.restore();
    }

    // =========================================================================
    // Frame loop
    // =========================================================================

    var last = 0;
    function frame(now) {
      requestAnimationFrame(frame);
      if (!visible || document.hidden) { last = now; return; }
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      t += dt * (reduced ? 0.35 : 1);

      if (playing) {
        stepClock += dt;
        var dur = stepDuration(step);
        var bar = dotEls[step].firstChild;
        bar.style.width = clamp(stepClock / dur, 0, 1) * 100 + '%';
        if (stepClock >= dur) {
          if (step === TOUR.length - 1) { playing = false; renderCard(); }
          else go(step + 1);
        }
      }

      if (!free) {
        var f = targetCam();
        var k = reduced ? 1 : 1 - Math.exp(-dt * 2.2);
        // zoom in log space so wide <-> tight moves feel even
        cam.s = Math.exp(lerp(Math.log(cam.s), Math.log(f.s), k));
        cam.x = lerp(cam.x, f.x, k);
        cam.y = lerp(cam.y, f.y, k);
      }
      focusK = Math.min(1, focusK + dt * 1.6);
      var wantMap = mapOn || TOUR[step].map ? 1 : 0;
      mapK = reduced ? wantMap : lerp(mapK, wantMap, 1 - Math.exp(-dt * (TOUR[step].map ? 0.9 : 3)));

      readPalette();
      px = 1 / cam.s;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = P.paper;
      ctx.fillRect(0, 0, vw, vh);
      ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (vw / 2 - cam.x * cam.s), dpr * (vh / 2 - cam.y * cam.s));
      ctx.strokeStyle = P.ink;
      ctx.lineCap = 'butt';
      drawShell();
      drawRooms();
      drawFocus();
      drawMap(mapK);
      if (hoverRoom && free) {
        ctx.save(); ctx.strokeStyle = P.ink; lw(2); ctx.setLineDash([5, 4]);
        ctx.strokeRect(hoverRoom.x + 6, hoverRoom.y + 6, hoverRoom.w - 12, hoverRoom.h - 12);
        ctx.restore();
      }
    }

    readPalette();
    renderCard();
    layout();
    snapCamera();
    // open on the whole building, slightly pulled back
    cam.s *= 0.9;
    requestAnimationFrame(frame);

    var api = {
      go: function (i) { go(i, true); },
      play: function () { playing = true; free = false; renderCard(); },
      pause: function () { playing = false; renderCard(); },
      element: root
    };
    host.__eos = api;
    return api;
  }

  function autoMount() {
    var hosts = document.querySelectorAll('#eos-scene, [data-eos-scene]');
    for (var i = 0; i < hosts.length; i++) {
      var h = hosts[i];
      mount(h, {
        autoplay: h.getAttribute('data-autoplay') !== 'false',
        theme: h.getAttribute('data-theme') || undefined,
        mapUrl: h.hasAttribute('data-map-url') ? h.getAttribute('data-map-url') : undefined
      });
    }
  }

  window.ElementsOfSoftware = { mount: mount, ontology: { entities: ENTITIES, relations: RELATIONS } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})();
