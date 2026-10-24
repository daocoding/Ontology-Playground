/*!
 * Elements of Software — a day at a software company, cut open
 *
 * A plain-JavaScript, dependency-free animation that explains the
 * "Elements of Software" ontology (catalogue/community/daocoding/
 * elements-of-software) to people who have never read one.
 *
 * The building is an ordinary software company: reception, sales, a
 * meeting room, operations, engineering, IT, finance, a mailroom, support
 * and an archive. People and machines work in every room all the time.
 * The tour follows one customer, Dana, through a day there. As the camera
 * moves, small tags name the things the software keeps track of (a Person,
 * a Deal, a Task, an Invoice...), and the caption explains them. The last
 * stop fades the building into the ontology graph itself.
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
  // floor (walking) line and ceiling line of each storey
  var FL = { A: 515, B: 735, C: 955, D: 1175 };
  var CE = { A: 305, B: 525, C: 745, D: 965 };
  var SH0 = 620, SH1 = 680;           // the lift shaft

  function room(id, name, x, y, w, h, step) {
    return { id: id, name: name, x: x, y: y, w: w, h: h, step: step };
  }

  // Ordinary departments. `step` is the tour stop a click takes you to.
  var ROOMS = [
    room('server',    'Server room',    180,  300, 440, 220, 7),
    room('eng',       'Engineering',    680,  300, 560, 220, 6),
    room('it',        'IT & Security',  1240, 300, 380, 220, 7),
    room('studio',    'Product studio', 180,  520, 440, 220, 2),
    room('ops',       'Operations',     680,  520, 560, 220, 5),
    room('support',   'Support',        1240, 520, 380, 220, 9),
    room('sales',     'Sales',          180,  740, 440, 220, 2),
    room('meeting',   'Meeting room',   680,  740, 420, 220, 3),
    room('contracts', 'Contracts',      1100, 740, 520, 220, 4),
    room('lobby',     'Reception',      180,  960, 440, 220, 1),
    room('mail',      'Mailroom',       680,  960, 420, 220, 8),
    room('finance',   'Finance',        1100, 960, 520, 220, 8),
    room('lift',      'Lift',           620,  300, 60,  880, 1),
    room('archive',   'Archive',        300,  1196, 1200, 170, 10)
  ];

  // Where each entity type "lives" in the building, for the graph overlay.
  var ANCHORS = {
    Party: [650, 640], Person: [262, 1078], Role: [410, 1040], Organization: [560, 1078],
    Agent: [400, 400], Team: [1050, 352], Project: [850, 400], Permission: [1430, 400],
    Product: [330, 600], Task: [900, 640], Automation: [1150, 615], SavedView: [1420, 630],
    Deal: [330, 830], Interaction: [800, 830], Document: [1010, 860],
    Subscription: [1510, 1060], Invoice: [1270, 1075], Payment: [860, 1075],
    AuditEvent: [900, 1280]
  };

  // ---------------------------------------------------------------------------
  // The tour: one customer, one day
  // ---------------------------------------------------------------------------
  // rect: camera target [x, y, w, h]. story: what happens. note: what the
  // software records. ents / rels: chips under "In the model". A rel with
  // `pts` [x1, y1, x2, y2] or `dyn` (a moving endpoint) is also drawn in the
  // scene as an arrow.

  var TOUR = [
    {
      rect: [120, 40, 1560, 1340],
      title: 'A day at a software company',
      story: 'This is Acme Cloud, cut open. People and machines are at work in every room: selling, building, answering questions, sending invoices. Follow one customer, Dana, through a day here.',
      note: 'Every business app, whether a CRM, a project tool or a billing system, keeps track of the same few kinds of thing. Watch for the little tags.',
      ents: [], rels: []
    },
    {
      rect: [130, 955, 570, 230],
      title: 'Dana arrives',
      story: 'Dana works at Globex and has come to see Acme\'s product. Reception prints a visitor badge that says LEAD, and Dana heads for the lift.',
      note: 'Dana is a Person and Globex is an Organization. Both are Parties, meaning anyone who can act. LEAD is not a kind of person: it is a Role that Dana plays at Acme, for now.',
      ents: ['Person', 'Organization', 'Party', 'Role'],
      rels: [
        { from: 'Party', label: 'plays', to: 'Role', dyn: 'plays' },
        { from: 'Role', label: 'at', to: 'Organization', dyn: 'at' }
      ]
    },
    {
      rect: [175, 515, 650, 450],
      title: 'A deal is opened',
      story: 'On the sales floor, Ravi starts a folder for Globex and the Pro plan. As the talks go well, the same folder moves across the board: Lead, Qualified, Proposal. Upstairs, the product studio designs the plans.',
      note: 'The folder is a Deal, with Globex, for a Product. It never turns into a different thing as it moves. Its stage is just a property.',
      ents: ['Deal', 'Product', 'Party'],
      rels: [
        { from: 'Deal', label: 'for', to: 'Product', dyn: 'dealFor' },
        { from: 'Deal', label: 'with', to: 'Party', dyn: 'dealWith' }
      ]
    },
    {
      rect: [675, 735, 430, 230],
      title: 'The meeting',
      story: 'Dana and Ravi talk through the proposal. An AI agent sits in and writes up the notes.',
      note: 'The meeting is an Interaction that involves the people in it and is about the deal. The notes are a Document written by the agent. The agent is a Party too, run on Ravi\'s behalf.',
      ents: ['Interaction', 'Document', 'Agent', 'Deal'],
      rels: [
        { from: 'Interaction', label: 'involves', to: 'Party', dyn: 'involvesA' },
        { from: 'Interaction', label: 'regarding', to: 'Deal', dyn: 'regarding' },
        { from: 'Document', label: 'authored by', to: 'Party' },
        { from: 'Agent', label: 'operated by', to: 'Party' }
      ]
    },
    {
      rect: [1095, 735, 530, 230],
      title: 'Signed',
      story: 'Dana signs. Omar stamps the contract, and the badge is swapped: LEAD becomes CUSTOMER. A new card for Globex drops through the floor to Finance.',
      note: 'It is the same Person with a new Role, and nothing about Dana had to be copied. The signature creates a Subscription, held by Globex, for the Pro plan.',
      ents: ['Role', 'Subscription', 'Product', 'Party'],
      rels: [
        { from: 'Party', label: 'plays', to: 'Role' },
        { from: 'Subscription', label: 'held by', to: 'Party', dyn: 'heldBy' },
        { from: 'Subscription', label: 'for', to: 'Product' }
      ]
    },
    {
      rect: [675, 515, 570, 230],
      title: 'A rule kicks in',
      story: 'In Operations, a machine that Sam looks after notices the win. The rule says: when a deal is won and the plan is Pro, create the onboarding work. Three cards roll out, each stamped with who will do it, and go up the tube.',
      note: 'The rule is an Automation, maintained by Sam. It creates Tasks. A big task carries its subtasks, and a subtask is just a Task with a parent.',
      ents: ['Automation', 'Task', 'Party'],
      rels: [
        { from: 'Automation', label: 'creates', to: 'Task', dyn: 'creates' },
        { from: 'Automation', label: 'maintained by', to: 'Party', dyn: 'maintained' },
        { from: 'Task', label: 'subtask of', to: 'Task', dyn: 'subtask' }
      ]
    },
    {
      rect: [675, 295, 570, 230],
      title: 'Engineering gets to work',
      story: 'The cards pop out upstairs and go onto the Onboard Globex board, which belongs to the Platform team. Kai takes one card and Agent-7 takes another. The setup guide is pinned beside them.',
      note: 'The board is a Project owned by a Team, and Kai is a member. Tasks belong to the Project and are assigned to a Party: a person or an agent, with no difference in the model. The guide is a Document attached to the Project.',
      ents: ['Project', 'Team', 'Task', 'Document', 'Person', 'Agent'],
      rels: [
        { from: 'Project', label: 'owned by', to: 'Team', dyn: 'ownedBy' },
        { from: 'Person', label: 'member of', to: 'Team', dyn: 'memberOf' },
        { from: 'Task', label: 'assigned to', to: 'Party', dyn: 'assignedA' },
        { from: 'Task', label: 'assigned to', to: 'Party', dyn: 'assignedB' },
        { from: 'Task', label: 'belongs to', to: 'Project' },
        { from: 'Document', label: 'attached to', to: 'Project', dyn: 'attached' }
      ]
    },
    {
      rect: [940, 295, 685, 230],
      title: 'A key for the agent',
      story: 'To set up Globex\'s account, Agent-7 needs access it doesn\'t have. Lee in IT takes the EDIT key from the cabinet and hands it over.',
      note: 'The key is a Permission granted to a Party. Because it is a record, anyone can ask later who could change what, and since when. The answer covers people and agents alike.',
      ents: ['Permission', 'Agent', 'Party'],
      rels: [
        { from: 'Permission', label: 'granted to', to: 'Party', dyn: 'granted' },
        { from: 'Agent', label: 'operated by', to: 'Party', dyn: 'operated7' }
      ]
    },
    {
      rect: [830, 955, 795, 230],
      title: 'Month end',
      story: 'A month later the calendar flips and the Finance wheel turns to Globex\'s card. Priya prints an invoice and sends it out through the mailroom. A payment comes back in, and the invoice is stamped PAID.',
      note: 'The Invoice bills the Subscription, and the Payment settles the Invoice. The whole recurring-revenue story is those two arrows.',
      ents: ['Subscription', 'Invoice', 'Payment'],
      rels: [
        { from: 'Invoice', label: 'bills', to: 'Subscription', dyn: 'bills' },
        { from: 'Payment', label: 'settles', to: 'Invoice', dyn: 'settles' }
      ]
    },
    {
      rect: [1235, 515, 390, 230],
      title: 'Dana has a question',
      story: 'An email from Dana shoots up the tube into Support, and Mia answers it. Then Noor saves a screen that shows only Globex\'s open questions, so nothing gets missed.',
      note: 'The email is another Interaction, involving Dana and Mia. The saved screen is a SavedView created by Noor: a way of looking at records, kept as a record itself.',
      ents: ['Interaction', 'SavedView', 'Person'],
      rels: [
        { from: 'Interaction', label: 'involves', to: 'Party', dyn: 'involvesMia' },
        { from: 'SavedView', label: 'created by', to: 'Party', dyn: 'createdBy' }
      ]
    },
    {
      rect: [560, 1222, 700, 140],
      title: 'The building remembers',
      story: 'Down in the archive, a tape has been running all day. The badge, the deal, the tasks, the key and the invoice all left a line on it.',
      note: 'Each line is an AuditEvent performed by a Party: who did what, and when. Nothing is ever erased, so when agents work alongside people, trust can be checked instead of assumed.',
      ents: ['AuditEvent', 'Party'],
      rels: [{ from: 'AuditEvent', label: 'performed by', to: 'Party', dyn: 'performed' }]
    },
    {
      rect: [120, 40, 1560, 1340],
      map: true,
      title: 'The same day, as a map',
      story: 'Now take the building away and keep only what the software tracks.',
      note: 'Each kind of thing you saw is an entity type, and each arrow is a relationship. Count how many arrows end at Party.',
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
    '.eos-model{margin-top:10px;padding-top:8px;border-top:1px dashed var(--eos-line)}',
    '.eos-model h3{margin:0 0 3px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--eos-muted);font-weight:700}',
    '.eos-note{margin:0;font-size:13.5px;color:var(--eos-ink)}',
    '.eos-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
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
    '@media (max-width:720px){.eos-card{position:relative;left:auto;bottom:auto;width:auto;margin:0;border-width:1.5px 0 0;box-shadow:none;max-height:48%;overflow:auto;padding:12px 16px}',
    '.eos-title{font-size:17px}.eos-body{font-size:14px}.eos-note{font-size:13px}}'
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
  function ease(k) { k = clamp(k, 0, 1); return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
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
  // a cheap deterministic flicker, for server lights
  function flick(i, t) { return Math.sin(i * 12.9898 + Math.floor(t * 3 + i * 0.37) * 78.233) > 0.1; }

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
    root.setAttribute('aria-label', 'Elements of Software: an animated day at a software company, explaining its ontology');
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
    var model = el('div', 'eos-model', card);
    var modelH = el('h3', null, model);
    modelH.textContent = 'In the model';
    var note = el('p', 'eos-note', model);
    var chips = el('div', 'eos-chips', model);
    var rels = el('ul', 'eos-rels', model);
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
    var stepClock = 0;         // time spent on this stop while playing (drives autoplay)
    var ct = 0;                // time since this stop began (drives its story)
    var mapOn = false, mapK = 0;
    var t = 0;                 // ambient animation time (s)
    var vw = 1, vh = 1, dpr = 1, insetL = 0, insetB = 0;
    var cam = { x: W / 2, y: H / 2, s: 0.4 };
    var free = false;          // user has taken over the camera
    var hoverRoom = null;
    var focusK = 0;            // 0..1 fade-in for this stop's tags and arrows
    var visible = true;
    var P = { paper: '#fbfaf6', ink: '#1c1c1c', soft: 'rgba(28,28,28,.08)', faint: 'rgba(28,28,28,.16)', dark: false };
    var px = 1;                // one screen pixel in world units
    var MAX_ZOOM = 3;
    var DYN = {};              // arrow endpoints that follow moving things
    var TAGS = [];             // entity tags collected while drawing a frame

    function stepDuration(i) {
      var s = TOUR[i];
      var words = (s.title + ' ' + s.story + ' ' + s.note).split(/\s+/).length;
      return Math.max(12, words / 3.4 + 3);
    }

    // story helpers
    function at(i) { return step === i; }
    function seg(a, b) { return clamp((ct - a) / (b - a), 0, 1); }

    // ---- caption card --------------------------------------------------------
    function renderCard() {
      var s = TOUR[step];
      kStep.textContent = (step + 1) + ' / ' + TOUR.length;
      title.textContent = s.title;
      body.textContent = s.story;
      note.textContent = s.note;
      if (s.outro) {
        note.textContent = s.note + ' ' + Object.keys(ENTITIES).length + ' entity types, ' + RELATIONS.length + ' relationships.';
      }

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
        el('b', null, li).textContent = r.from;
        li.appendChild(document.createTextNode(' — '));
        el('em', null, li).textContent = r.label;
        li.appendChild(document.createTextNode(' → '));
        el('b', null, li).textContent = r.to;
      });
      rels.style.display = s.rels.length ? '' : 'none';

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
      ct = reduced ? 30 : 0;   // under reduced motion, show each stop's end state
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
          tip.textContent = hoverRoom.name;
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
    function sign(cx, y, label, size) {
      size = size || 10;
      var w = textW(label, size, 700) + 14, h = size + 9;
      lw(1.4);
      box(cx - w / 2, y, w, h);
      text(label, cx, y + h / 2 + 0.5, size, 'center', 700);
      return w;
    }
    function hangSign(cx, ceil, label) {
      lw(1);
      var w = textW(label, 10, 700) + 14;
      line(cx - w / 2 + 8, ceil, cx - w / 2 + 8, ceil + 10);
      line(cx + w / 2 - 8, ceil, cx + w / 2 - 8, ceil + 10);
      sign(cx, ceil + 10, label, 10);
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

    // A person, feet at (x, y).
    // o: { walk, seated, arm, flip, badge, cap, headset, bag, s }
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
      var shY = headY + 9;
      var arm = o.arm || 'down';
      if (arm === 'down') { line(-6, shY, -9, shY + 16); line(6, shY, 9, shY + 16); }
      else if (arm === 'up') { line(-6, shY, -9, shY + 16); line(6, shY, 13, shY - 10); }
      else if (arm === 'forward') { line(-6, shY, -9, shY + 16); line(6, shY, 17, shY + 4); }
      else if (arm === 'type') {
        var j = Math.sin(t * 14 + x) * 1.2;
        line(5, shY + 1, 14, shY + 9 + j); line(-3, shY + 1, 10, shY + 10 - j);
      } else if (arm === 'phone') { line(-6, shY, -9, shY + 16); line(6, shY, 9, shY + 6); line(9, shY + 6, 5, shY - 5); }
      else if (arm === 'hold') { line(-6, shY, -9, shY + 16); line(6, shY, 14, shY + 8); line(14, shY + 8, 18, shY + 3); }
      else if (arm === 'cheer') { line(-6, shY, -12, shY - 10); line(6, shY, 12, shY - 10); }
      circle(0, headY, 5.5);
      ctx.beginPath();
      ctx.arc(0, headY, 5.5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fillStyle = P.ink; ctx.fill();
      if (o.cap) ctx.fillRect(-6, headY - 6, 12, 2.5);
      if (o.headset) {
        lw(1);
        ctx.beginPath(); ctx.arc(0, headY, 7.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        line(6.5, headY - 2, 7, headY + 4); line(7, headY + 4, 3, headY + 5);
      }
      if (o.badge) {
        ctx.fillStyle = o.badge;
        ctx.fillRect(1.5, shY + 3, 4.5, 4.5);
        lw(0.6); ctx.strokeRect(1.5, shY + 3, 4.5, 4.5);
      }
      if (o.bag) {
        lw(1.1);
        box(-15, shY + 12, 11, 8);
        line(-12, shY + 12, -12, shY + 10); line(-12, shY + 10, -7, shY + 10); line(-7, shY + 10, -7, shY + 12);
        ctx.fillStyle = o.bag; ctx.fillRect(-14, shY + 15, 9, 2);
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
      if (Math.sin(t * 3 + x) > -0.6) { ctx.fillRect(-3.5, -38.5, 2.5, 2.5); ctx.fillRect(1.5, -38.5, 2.5, 2.5); }
      line(0, -43, 0, -49);
      circle(0, -50.5, 1.8, Math.sin(t * 5 + x) > 0 ? ENTITIES.Agent.color : P.paper);
      var arm = o.arm || 'down';
      if (arm === 'type') {
        var j = Math.sin(t * 16 + x) * 1.2;
        line(8, -26, 16, -20 + j); line(-8, -26, 8, -18 - j);
      } else if (arm === 'forward') { line(8, -26, 18, -24); line(-8, -26, -11, -15); }
      else { line(8, -26, 11, -15); line(-8, -26, -11, -15); }
      if (o.key) keyShape(13, -18, 0.4);
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
      for (var x = x1 + 7; x < x2 - 3; x += 18) {
        circle(x, y + 4.5, 3.6);
        var a = t * speed / 3.6;
        line(x, y + 4.5, x + Math.cos(a) * 3.6, y + 4.5 + Math.sin(a) * 3.6);
      }
      if (floor) {
        lw(1.2);
        for (var p = x1 + 12; p < x2; p += 80) { line(p, y + 9, p - 4, floor); line(p, y + 9, p + 4, floor); }
      }
    }

    function taskCard(x, y, w, h, o) {
      o = o || {};
      lw(o.hot ? 1.6 : 1.1);
      if (o.hot) ctx.strokeStyle = ENTITIES.Task.color;
      box(x, y, w, h, o.hot ? hexA(ENTITIES.Task.color, 0.18) : P.paper);
      ctx.strokeStyle = P.ink;
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

    function monitor(x, y, w, h, kind) {
      lw(1.2);
      box(x, y, w, h);
      line(x + w / 2, y + h, x + w / 2, y + h + 6);
      line(x + w / 2 - 6, y + h + 6, x + w / 2 + 6, y + h + 6);
      if (kind === 'code') {
        lw(0.7);
        for (var i = 0; i < 4; i++) {
          var len = 6 + mod(i * 7 + Math.floor(t * 1.5 + x), 9) * 1.4;
          line(x + 3 + (i % 2) * 4, y + 4 + i * 4, x + 3 + (i % 2) * 4 + len, y + 4 + i * 4);
        }
      } else if (kind === 'chart') {
        lw(0.8);
        ctx.beginPath();
        for (var k = 0; k <= 6; k++) ctx.lineTo(x + 3 + k * (w - 6) / 6, y + h - 4 - (Math.sin(k * 1.3 + x) * 0.5 + 0.5) * (h - 8));
        ctx.stroke();
      }
    }

    function desk(x, y, w, floor) {
      lw(1.3);
      box(x, y, w, 5);
      line(x + 4, y + 5, x + 4, floor); line(x + w - 4, y + 5, x + w - 4, floor);
    }

    function chair(x, floor, flip) {
      lw(1.2);
      var d = flip ? -1 : 1;
      line(x - 8 * d, floor - 17, x + 4 * d, floor - 17);
      line(x - 8 * d, floor - 17, x - 9 * d, floor - 36);
      line(x - 2 * d, floor - 17, x - 2 * d, floor - 4);
      line(x - 8 * d, floor - 1, x + 4 * d, floor - 1);
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

    function mug(x, y) {
      lw(1);
      box(x - 3.5, y - 7, 7, 7);
      ctx.beginPath(); ctx.arc(x + 4.5, y - 3.5, 2.2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (var i = 0; i < 2; i++) {
        var k = mod(t * 0.6 + i * 0.5, 1);
        ctx.globalAlpha = 0.6 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(x - 1 + i * 2, y - 9 - k * 12);
        ctx.quadraticCurveTo(x + 2 + i * 2, y - 12 - k * 12, x - 1 + i * 2, y - 15 - k * 12);
        ctx.stroke();
      }
      ctx.restore();
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

    function envelope(x, y, w, color) {
      var h = w * 0.66;
      lw(1);
      box(x - w / 2, y - h / 2, w, h, color || P.paper);
      line(x - w / 2, y - h / 2, x, y + h * 0.1); line(x + w / 2, y - h / 2, x, y + h * 0.1);
    }

    function paper(x, y, w, h, label, fill) {
      lw(1);
      box(x, y, w, h, fill || P.paper);
      if (label) text(label, x + w / 2, y + 5, Math.min(5.5, w / 4), 'center', 800);
      ctx.save(); ctx.globalAlpha = 0.6; lw(0.6);
      for (var i = y + (label ? 10 : 4); i < y + h - 2; i += 3.5) line(x + 3, i, x + w - 3, i);
      ctx.restore();
    }

    function pipePath(pts, width) {
      ctx.beginPath();
      pts.forEach(function (p, i) { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); });
      ctx.lineJoin = 'round';
      lw(width + 3); ctx.strokeStyle = P.ink; ctx.stroke();
      lw(width); ctx.strokeStyle = P.paper; ctx.stroke();
      ctx.strokeStyle = P.ink;
    }
    function pathLen(pts) {
      var L = 0;
      for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      return L;
    }
    function along(pts, d) {
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= L) return [lerp(a[0], b[0], d / L), lerp(a[1], b[1], d / L)];
        d -= L;
      }
      return pts[pts.length - 1];
    }

    // An entity tag: the bridge between a thing in the building and the model.
    function tag(x, y, ent, label) { TAGS.push([x, y, ent, label]); }
    function drawTags() {
      TAGS.forEach(function (g) {
        var e = ENTITIES[g[2]], s = 7.5;
        var label = g[2] + (g[3] ? ' · ' + g[3] : '');
        var w = textW(label, s, 800) + 18, h = s + 7;
        var x = g[0] - w / 2, y = g[1] - h / 2;
        ctx.save();
        ctx.globalAlpha *= focusK;
        ctx.fillStyle = P.paper;
        ctx.strokeStyle = e.color;
        lw(1.5);
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, 3); else ctx.rect(x, y, w, h);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = e.color;
        ctx.beginPath(); ctx.arc(x + 7, g[1], 2.8, 0, TAU); ctx.fill();
        ctx.font = '800 ' + s + 'px ' + FONT;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillStyle = P.ink;
        ctx.fillText(label, x + 13, g[1] + 0.5);
        ctx.restore();
      });
      ctx.strokeStyle = P.ink;
    }

    // =========================================================================
    // The building shell
    // =========================================================================

    function drawShell() {
      ctx.strokeStyle = P.ink;
      ctx.lineJoin = 'round';

      // ground & earth
      lw(1.4);
      line(40, GROUND, W - 40, GROUND);
      ctx.save();
      ctx.globalAlpha = 0.55;
      hatch(60, GROUND, W - 120, 210, 9, 0.7);
      ctx.restore();
      lw(0.8);
      for (var g = 60; g < W - 60; g += 13) {
        if (g > X0 - 60 && g < X1 + 10) continue;
        line(g, GROUND, g - 2, GROUND - 4); line(g + 3, GROUND, g + 4, GROUND - 5);
      }
      // path to the front door
      lw(1); line(40, GROUND + 6, X0, GROUND + 6);

      // roofs
      lw(1.6);
      var lg = [160, 300, 410, 150, 660, 300];
      poly(lg);
      hatchPoly(lg, 7, 0.6);
      poly([300, 300, 410, 214, 520, 300]);
      vlines(300, 214, 220, 86, 8, 0.6);
      lw(1.3); circle(410, 258, 16); line(394, 258, 426, 258); line(410, 242, 410, 274);
      for (var i = 0; i < 4; i++) {
        var sx = 640 + i * 162.5;
        lw(1.5);
        poly([sx, 300, sx, 230, sx + 162.5, 300]);
        hatchPoly([sx + 4, 300, sx + 4, 240, sx + 158, 299], 6, 0.55);
        lw(1.1);
        box(sx + 2, 236, 6, 60);
      }
      lw(1.6);
      poly([1252, 300, 1258, 110, 1290, 110, 1296, 300]);
      vlines(1254, 112, 40, 186, 6, 0.6);
      box(1250, 102, 48, 10);
      var rg = [1272, 300, 1455, 178, 1640, 300];
      lw(1.6);
      poly(rg);
      hatchPoly(rg, 7, 0.6);
      windowFrame(1430, 238, 50, 40);
      // company sign
      lw(1.3);
      line(860, 232, 860, 262); line(1070, 232, 1070, 262);
      line(860, 262, 850, 300); line(1070, 262, 1080, 300);
      box(830, 194, 270, 38);
      text('ACME CLOUD', 965, 210, 18, 'center', 800);
      text('software, since 2009', 965, 225, 7, 'center', 600);

      // smoke
      for (var k = 0; k < 7; k++) {
        var age = mod(t * 0.9 + k * 1.15, 8);
        ctx.save();
        ctx.globalAlpha = 1 - age / 8;
        lw(1.1);
        circle(1274 + age * 22 + Math.sin(age * 1.7 + k) * 5, 92 - age * 11, 7 + age * 3.2);
        ctx.restore();
      }

      // room back walls
      ROOMS.forEach(function (q) {
        if (q.id === 'archive' || q.id === 'lift') return;
        ctx.fillStyle = P.paper;
        ctx.fillRect(q.x, q.y, q.w, q.h);
        vlines(q.x, q.y + 5, q.w, q.h - 10, 7, 0.22);
      });
      ctx.fillStyle = P.paper;
      ctx.fillRect(SH0, 300, SH1 - SH0, GROUND - 300);

      // archive (underground)
      var A = ROOMS[13];
      ctx.fillStyle = P.paper;
      ctx.fillRect(A.x, A.y, A.w, A.h);
      ctx.save(); ctx.globalAlpha = 0.18; hlines(A.x, A.y, A.w, A.h, 9); ctx.restore();
      ctx.fillStyle = P.ink;
      ctx.fillRect(A.x - 10, A.y - 6, A.w + 20, 8);
      ctx.fillRect(A.x - 10, A.y + A.h, A.w + 20, 10);
      ctx.fillRect(A.x - 10, A.y - 6, 10, A.h + 16);
      ctx.fillRect(A.x + A.w, A.y - 6, 10, A.h + 16);

      // floor slabs (they stop at the lift shaft) and outer walls
      ctx.fillStyle = P.ink;
      FLOORS.forEach(function (fy, n) {
        if (n === 0 || n === FLOORS.length - 1) { ctx.fillRect(X0 - 6, fy - 5, X1 - X0 + 12, 10); return; }
        ctx.fillRect(X0 - 6, fy - 5, SH0 - X0 + 6, 10);
        ctx.fillRect(SH1, fy - 5, X1 - SH1 + 6, 10);
      });
      ctx.fillRect(X0 - 6, 300, 12, 1080 - 300);        // left wall, above the front door
      ctx.fillRect(X1 - 6, 300, 12, GROUND - 300 + 5);

      // partitions with doorways at floor level
      function part(x, top, bottom, gap) { ctx.fillRect(x - 4, top, 8, bottom - top - (gap || 0)); }
      part(1240, 300, 520, 56);
      part(1240, 520, 740, 0);
      part(1100, 740, 960, 56);
      part(1100, 960, 1180, 56);
      // lift shaft walls, open at every landing
      for (var f = 0; f < 4; f++) {
        part(SH0, FLOORS[f], FLOORS[f + 1], 58);
        part(SH1, FLOORS[f], FLOORS[f + 1], 58);
      }

      // outside: tree by the path, delivery van round the back
      lw(1.3);
      line(70, GROUND, 70, GROUND - 70);
      for (var b = 0; b < 5; b++) circle(70 + Math.cos(b * 1.3) * 22, GROUND - 92 + Math.sin(b * 1.9) * 16, 20);
      lw(1.2);
      box(1700, GROUND - 44, 70, 34);
      poly([1700, GROUND - 44, 1680, GROUND - 32, 1676, GROUND - 10, 1700, GROUND - 10]);
      circle(1690, GROUND - 6, 7); circle(1752, GROUND - 6, 7);
      text('POST', 1735, GROUND - 28, 8, 'center', 800);
      // front door awning
      lw(1.3);
      poly([X0 - 34, 1066, X0 + 6, 1066, X0 + 6, 1076, X0 - 28, 1076]);
      line(X0 - 30, 1076, X0 - 30, GROUND);
    }

    // ---- the lift --------------------------------------------------------------
    var LEVELS = [FL.D, FL.C, FL.B, FL.A];
    function liftY() {
      if (at(1)) {
        if (ct < 8) return { y: FL.D, still: true };
        if (ct < 11) return { y: lerp(FL.D, FL.C, ease((ct - 8) / 3)), still: false };
        return { y: FL.C, still: true };
      }
      // otherwise it potters between floors
      var plan = [[0, 4, FL.D, FL.D], [4, 7, FL.D, FL.B], [7, 11, FL.B, FL.B], [11, 13, FL.B, FL.A],
                  [13, 17, FL.A, FL.A], [17, 20, FL.A, FL.C], [20, 24, FL.C, FL.C], [24, 26, FL.C, FL.D]];
      var u = mod(t, 26);
      for (var i = 0; i < plan.length; i++) {
        var p = plan[i];
        if (u < p[1]) return { y: lerp(p[2], p[3], ease((u - p[0]) / (p[1] - p[0]))), still: p[2] === p[3] };
      }
      return { y: FL.D, still: true };
    }
    function drawLift(rider) {
      var L = liftY(), yb = L.y;
      lw(0.8);
      ctx.save(); ctx.globalAlpha = 0.5;
      line(SH0 + 8, 300, SH0 + 8, GROUND); line(SH1 - 8, 300, SH1 - 8, GROUND);
      ctx.restore();
      // pulley in the roof
      lw(1.3); circle(650, 290, 9); circle(650, 290, 2, P.ink);
      line(641, 290, 641, yb - 66); line(659, 290, 659, yb - 66);
      // landing lamps
      LEVELS.forEach(function (fy) {
        circle(650, fy - 70, 2.4, L.still && Math.abs(L.y - fy) < 1 ? ENTITIES.Party.color : P.paper);
      });
      // cab
      lw(1.5);
      box(SH0 + 9, yb - 64, SH1 - SH0 - 18, 64);
      if (rider) rider(650, yb);
      lw(1.2);
      if (L.still) { line(SH0 + 13, yb - 62, SH0 + 13, yb); line(SH1 - 13, yb - 62, SH1 - 13, yb); }
      else { ctx.save(); ctx.globalAlpha = 0.6; hatch(SH0 + 9, yb - 64, SH1 - SH0 - 18, 64, 5, 0.6); ctx.restore(); line(650, yb - 64, 650, yb); }
    }

    // =========================================================================
    // Rooms: places where work happens
    // =========================================================================

    // -- Dana's day ----------------------------------------------------------
    var GLOBEX = ENTITIES.Organization.color;
    function danaBadge() {
      if (step < 4) return 'LEAD';
      if (at(4)) return ct < 5 ? 'LEAD' : 'CUSTOMER';
      return 'CUSTOMER';
    }
    function drawDana(x, fl, o) {
      o = o || {};
      person(x, fl, {
        walk: o.walk, flip: o.flip, seated: o.seated, arm: o.arm,
        badge: o.noBadge ? null : ENTITIES.Role.color, bag: o.seated ? null : GLOBEX
      });
    }

    // -- Server room -----------------------------------------------------------
    function drawServerRoom() {
      var fl = FL.A, ce = CE.A;
      hangSign(560, ce, 'SERVER ROOM');
      lw(1); line(196, ce + 14, 420, ce + 14);
      for (var r = 0; r < 4; r++) {
        var rx = 200 + r * 54;
        lw(1.5);
        box(rx, 346, 44, fl - 346);
        line(rx + 22, ce + 14, rx + 22, 346);
        for (var u = 0; u < 12; u++) {
          var uy = 352 + u * 13;
          lw(0.8); box(rx + 4, uy, 36, 10);
          ctx.fillStyle = flick(r * 20 + u, t) ? ENTITIES.Agent.color : P.paper;
          ctx.fillRect(rx + 32, uy + 3, 4, 4);
          ctx.fillStyle = flick(r * 20 + u + 7, t * 1.7) ? P.ink : P.paper;
          ctx.fillRect(rx + 26, uy + 3, 3, 4);
        }
      }
      // cooling fan
      lw(1.3); circle(450, 365, 18);
      for (var b = 0; b < 4; b++) {
        var a = t * 6 + b * TAU / 4;
        line(450, 365, 450 + Math.cos(a) * 15, 365 + Math.sin(a) * 15);
      }
      // agents resting on their docks
      [480, 548].forEach(function (x, i) {
        lw(1.2); box(x - 16, fl - 6, 32, 6);
        robot(x, fl - 6, { arm: i ? 'down' : 'type', flip: !!i });
        ctx.fillStyle = ENTITIES.Agent.color;
        var ch = mod(t * 0.2 + i * 0.5, 1);
        ctx.fillRect(x - 13, fl - 4, 26 * ch, 2);
      });
      lw(1); box(586, fl - 40, 20, 40);
      text('UPS', 596, fl - 32, 5, 'center', 800);
    }

    // -- Engineering -----------------------------------------------------------
    var ENG_SLOTS = [[852, 372], [852, 392], [852, 412]];
    function drawEngineering() {
      var fl = FL.A, ce = CE.A;
      hangSign(1190, ce, 'ENGINEERING');
      lamp(900, ce, 12); lamp(1120, ce, 12);
      // tube from Operations comes up through the floor into a tray
      pipePath([[715, 520], [715, 478]], 7);
      lw(1.2); box(698, 466, 34, 9);
      // project board
      frameBoard(745, 336, 205, 100);
      lw(0.8); line(847, 342, 847, 430);
      text('BILLING V2', 796, 351, 6.5, 'center', 800);
      for (var i = 0; i < 3; i++) taskCard(760 + (i % 2) * 40, 362 + Math.floor(i / 2) * 24, 34, 20, { mark: i % 2 ? 'r' : 'p' });
      var onboarding = step >= 6;
      if (onboarding) {
        text('ONBOARD GLOBEX', 898, 351, 6.5, 'center', 800);
        ctx.fillStyle = ENTITIES.Project.color; ctx.fillRect(851, 357, 94, 2);
        var marks = ['p', 'r', 'p'];
        for (var c = 0; c < 3; c++) {
          var slot = ENG_SLOTS[c];
          var x = slot[0], y = slot[1];
          if (at(6)) {
            var k = seg(0.6 + c * 2, 2 + c * 2);
            if (k <= 0) continue;
            x = lerp(708, slot[0], ease(k)); y = lerp(452, slot[1], ease(k)) - Math.sin(k * Math.PI) * 30;
          }
          taskCard(x, y, 34, 18, { mark: marks[c], hot: true });
          if (c === 0) { lw(0.8); taskCard(x + 38, y + 2, 16, 12, { hot: true }); }
        }
        // the setup guide pinned beside the board
        paper(956, 340, 22, 28, 'GUIDE', hexA(ENTITIES.Document.color, 0.25));
      } else {
        ctx.save(); ctx.globalAlpha = 0.35; text('(empty)', 898, 390, 6.5, 'center', 700); ctx.restore();
      }
      // team banner
      lw(1.3); box(995, 334, 120, 24);
      ctx.fillStyle = ENTITIES.Team.color; ctx.fillRect(996, 335, 5, 22);
      text('TEAM PLATFORM', 1058, 346, 7.5, 'center', 800);
      // Ana at the board
      person(830, fl, { arm: 'up', badge: ENTITIES.Person.color });
      // Kai and Agent-7 at their desks
      desk(990, fl - 34, 110, fl);
      monitor(1018, fl - 58, 32, 20, 'code');
      chair(1030, fl);
      person(1030, fl, { seated: true, arm: 'type', badge: ENTITIES.Person.color });
      mug(1075, fl - 34);
      desk(1118, fl - 34, 110, fl);
      monitor(1142, fl - 58, 32, 20, 'code');
      robot(1180, fl, { arm: step === 7 && ct > 1.6 && ct < 4.6 ? 'forward' : 'type', flip: true, key: step > 7 || (at(7) && ct > 4.6) });

      if (at(6)) {
        tag(848, 326, 'Project', 'Onboard Globex');
        tag(1055, 324, 'Team', 'Platform');
        tag(1030, fl - 66, 'Person', 'Kai');
        tag(1180, fl - 76, 'Agent', 'Agent-7');
        if (ct > 1.5) tag(800, 452, 'Task', '');
        tag(967, 378, 'Document', 'guide');
        DYN.ownedBy = [940, 340, 1000, 346];
        DYN.memberOf = [1022, fl - 52, 1030, 360];
        if (ct > 2) DYN.assignedA = [886, 381, 1018, fl - 44]; else delete DYN.assignedA;
        if (ct > 4) DYN.assignedB = [886, 401, 1170, fl - 44]; else delete DYN.assignedB;
        DYN.attached = [956, 356, 945, 372];
      }
      if (at(7)) {
        tag(1180, fl - 76, 'Agent', 'Agent-7');
        tag(1030, fl - 66, 'Person', 'Kai');
        DYN.operated7 = [1170, fl - 50, 1040, fl - 52];
      }
    }

    // -- IT & Security ---------------------------------------------------------
    function drawIT() {
      var fl = FL.A, ce = CE.A;
      hangSign(1540, ce, 'IT & SECURITY');
      lamp(1400, ce, 14);
      frameBoard(1262, 346, 76, 84);
      var labels = ['VIEW', 'EDIT', 'ADMIN'];
      var handing = at(7) && ct > 1 && ct < 4.6;
      for (var i = 0; i < 3; i++) {
        var ky = 362 + i * 22;
        lw(1); circle(1276, ky, 2, P.ink);
        if (!(i === 1 && (handing || step > 7 || (at(7) && ct >= 4.6)))) keyShape(1276, ky + 3, Math.sin(t * 2 + i) * 0.12);
        text(labels[i], 1312, ky + 6, 7, 'center', 800);
      }
      // security monitors
      for (var m = 0; m < 3; m++) {
        monitor(1360 + m * 44, 352, 36, 24);
        lw(1);
        var lx = 1378 + m * 44;
        box(lx - 5, 364, 10, 8);
        ctx.beginPath(); ctx.arc(lx, 364, 3.5, Math.PI, 0); ctx.stroke();
      }
      // secure door with keypad
      lw(1.6); box(1546, fl - 96, 56, 96);
      lw(1); box(1530, fl - 62, 10, 14);
      ctx.fillStyle = mod(t, 2) < 1 ? ENTITIES.Permission.color : P.paper; ctx.fillRect(1532, fl - 60, 6, 3);
      // Lee
      var leeX = 1352;
      person(leeX, fl, { flip: true, arm: handing ? 'forward' : 'down', badge: ENTITIES.Person.color, cap: true });
      desk(1420, fl - 34, 100, fl);
      monitor(1450, fl - 58, 30, 20, 'chart');
      if (at(7)) {
        var kx, ky2;
        if (ct > 1 && ct < 2) { kx = lerp(1276, leeX - 16, ease(ct - 1)); ky2 = lerp(387, fl - 34, ease(ct - 1)); }
        else if (ct >= 2 && ct < 4.6) {
          var k = ease((ct - 2) / 2.6);
          kx = lerp(leeX - 16, 1194, k); ky2 = lerp(fl - 34, fl - 22, k) - Math.sin(k * Math.PI) * 26;
        }
        if (kx != null) { keyShape(kx, ky2, ct * 3); tag(kx, ky2 - 14, 'Permission', 'EDIT'); }
        if (ct >= 4.6) tag(1262, fl - 44, 'Permission', 'EDIT');
        tag(leeX, fl - 70, 'Person', 'Lee');
        DYN.granted = ct >= 4.6 ? [1226, fl - 38, 1194, fl - 26] : null;
        if (!DYN.granted) delete DYN.granted;
      }
    }

    // -- Product studio ------------------------------------------------------------
    var PLANS = [['Basic', '$9/mo', 'plan'], ['Pro', '$19/mo', 'plan'], ['Team', '$49/mo', 'plan'], ['Setup', '$900', 'service']];
    function drawStudio() {
      var fl = FL.B, ce = CE.B;
      hangSign(560, ce, 'PRODUCT STUDIO');
      lamp(300, ce, 10);
      frameBoard(196, 556, 244, 76);
      PLANS.forEach(function (p, i) {
        var x = 206 + i * 58, y = 566;
        var hot = p[0] === 'Pro' && (at(2) || at(4));
        lw(hot ? 1.8 : 1.1);
        if (hot) ctx.strokeStyle = ENTITIES.Product.color;
        box(x, y, 50, 56, hot ? hexA(ENTITIES.Product.color, 0.2) : P.paper);
        ctx.strokeStyle = P.ink;
        ctx.fillStyle = ENTITIES.Product.color; ctx.fillRect(x + 1, y + 1, 48, 4);
        text(p[0], x + 25, y + 18, 8.5, 'center', 800);
        text(p[1], x + 25, y + 33, 7, 'center', 700);
        text(p[2], x + 25, y + 46, 5.5, 'center', 600);
      });
      // drafting table with a designer sketching
      lw(1.3);
      poly([470, fl - 54, 560, fl - 66, 562, fl - 60, 472, fl - 48]);
      line(500, fl - 50, 494, fl); line(540, fl - 56, 546, fl);
      var sk = mod(t * 0.4, 1);
      lw(0.8);
      ctx.beginPath();
      for (var s = 0; s <= 10 * sk; s++) ctx.lineTo(482 + s * 6, fl - 56 - s * 0.6 + Math.sin(s * 1.7) * 2);
      ctx.stroke();
      person(586, fl, { flip: true, arm: 'forward', badge: ENTITIES.Person.color });
      // a designer testing a prototype
      desk(216, fl - 34, 130, fl);
      lw(1.1); box(250, fl - 52, 12, 18); box(252, fl - 49, 8, 12);
      chair(296, fl);
      person(296, fl, { seated: true, arm: 'type', badge: ENTITIES.Person.color });
      monitor(306, fl - 58, 30, 20, 'chart');
      plant(380, fl);
      if (at(2)) tag(290, 546, 'Product', 'Pro plan');
    }

    // -- Operations ------------------------------------------------------------
    // Cards: ambient ones from other rules, and three for Globex in stop 5.
    function opsCards() {
      var list = [];
      var period = 7;
      if (!at(5)) {
        for (var j = 0; j < 3; j++) {
          var k = Math.floor(t / period) - j;
          list.push({ age: t - k * period, k: k, hot: false });
        }
      } else {
        [2, 3.6, 5.2].forEach(function (s, i) { list.push({ age: ct - s, k: i, hot: true }); });
      }
      return list;
    }
    function drawOps() {
      var fl = FL.B, ce = CE.B;
      hangSign(760, ce, 'OPERATIONS');
      lamp(880, ce, 12);
      var by = fl - 34;
      // the rules machine
      lw(1.6);
      box(1076, 566, 150, 112);
      ctx.save(); ctx.globalAlpha = 0.5; hatch(1076, 660, 150, 18, 5, 0.6); ctx.restore();
      var fire = at(5) && ct > 1 && ct < 6;
      var spin = fire ? 3 : 1;
      gear(1104, 596, 18, 10, t * 1.2 * spin);
      gear(1131, 615, 12, 8, -t * 1.8 * spin + 0.2);
      gear(1104, 632, 10, 7, -t * 2.2 * spin);
      lw(1.1); box(1146, 576, 72, 52);
      var rows = at(5) || step > 5 ? ['WHEN deal won', 'IF plan = Pro', 'THEN add tasks'] : ['WHEN …', 'IF …', 'THEN …'];
      rows.forEach(function (r, i) {
        text(r, 1151, 586 + i * 14, 5.6, 'left', 800);
        ctx.fillStyle = fire && Math.sin(t * 8 - i) > 0 ? ENTITIES.Automation.color : P.faint;
        ctx.fillRect(1210, 583 + i * 14, 5, 5);
      });
      lw(1.4); line(1160, 650, 1176, 638); circle(1176, 638, 3, P.ink);
      text('ON', 1192, 650, 6.5, 'center', 800);
      // chute down to the belt
      lw(1.3);
      poly([1074, 650, 1074, 626, 1094, 626, 1094, by - 40], false);
      belt(724, 1080, by, -45, fl);
      // assignment stamp
      var stampX = 930;
      var cards = opsCards();
      var nearest = 1e9;
      cards.forEach(function (c) { c.x = 1066 - Math.max(0, c.age - 0.5) * 45; nearest = Math.min(nearest, Math.abs(c.x + 17 - stampX)); });
      var press = clamp(1 - nearest / 14, 0, 1);
      lw(1.3);
      box(stampX - 18, ce + 34, 36, 26);
      text('ASSIGN', stampX, ce + 47, 6.5, 'center', 800);
      line(stampX - 3, ce + 60, stampX - 3, by - 46 + press * 14);
      line(stampX + 3, ce + 60, stampX + 3, by - 46 + press * 14);
      box(stampX - 10, by - 46 + press * 14, 20, 8);
      // tube up to engineering
      pipePath([[715, by - 2], [715, 520]], 7);
      lw(1.2); poly([700, by - 2, 730, by - 2, 724, by - 12, 706, by - 12]);
      var first = null;
      cards.forEach(function (c) {
        if (c.age < 0) return;
        var y = c.age < 0.5 ? lerp(by - 60, by - 22, ease(c.age / 0.5)) : by - 22;
        if (c.x < 724) {
          // riding the tube up
          var up = (724 - c.x) / 45 * 140;
          if (up > by - 520) return;
          ctx.fillStyle = ENTITIES.Task.color;
          ctx.fillRect(712, by - 6 - up, 6, 6);
          return;
        }
        var mark = c.x + 17 < stampX ? (c.k % 2 ? 'r' : 'p') : null;
        taskCard(c.x, y, 34, 22, { mark: mark, hot: c.hot });
        if (c.k % 3 === 0) {
          lw(0.8); line(c.x + 10, y, c.x + 10, y - 4);
          taskCard(c.x + 4, y - 15, 18, 11, { hot: c.hot });
          line(c.x + 26, y, c.x + 26, y - 4);
          taskCard(c.x + 20, y - 15, 15, 11, { hot: c.hot });
          if (c.hot && !first) first = c;
        }
      });
      // Sam keeps the machine running
      person(1048, fl, { flip: true, arm: 'up', badge: ENTITIES.Person.color, cap: true });
      lw(1.4); line(1036, fl - 44, 1030, fl - 52); circle(1029, fl - 54, 2.5, false);
      // wall-mounted status screens
      lw(1.2); line(780, ce + 70, 890, ce + 70);
      monitor(790, ce + 38, 40, 26, 'chart');
      monitor(838, ce + 38, 40, 26, 'chart');

      if (at(5)) {
        tag(1150, 556, 'Automation', 'onboarding rule');
        tag(990, fl - 76, 'Person', 'Sam');
        DYN.maintained = [1170, 678, 1058, fl - 46];
        if (first && first.x > 760) {
          tag(first.x + 17, by - 72, 'Task', 'Onboard Globex');
          DYN.creates = [1080, 640, first.x + 30, by - 26];
          DYN.subtask = [first.x + 14, by - 39, first.x + 6, by - 20];
        } else { delete DYN.creates; delete DYN.subtask; }
      }
    }

    // -- Support -----------------------------------------------------------------
    var MAILTUBE = [[1060, 1012], [1060, 980], [1656, 980], [1656, 562], [1612, 562]];
    var MAILTUBE_LEN = pathLen(MAILTUBE);
    function drawSupport() {
      var fl = FL.B, ce = CE.B;
      hangSign(1560, ce, 'SUPPORT');
      // wall screen: a view of tickets
      var saved = step > 9 || (at(9) && ct > 7);
      lw(1.5); box(1262, 550, 176, 82);
      lw(1); line(1262, 562, 1438, 562);
      text(saved ? '★ GLOBEX · OPEN' : 'ALL TICKETS', 1268, 556.5, 6, 'left', 800);
      for (var c = 0; c < 3; c++) {
        lw(0.6); line(1262 + (c + 1) * 58.7, 562, 1262 + (c + 1) * 58.7, 632);
        var n = saved ? (c === 2 ? 0 : 1) : 3 - c + (c === 0 ? 1 : 0);
        for (var i = 0; i < n; i++) {
          lw(0.8);
          box(1268 + c * 58.7, 568 + i * 14, 46, 10, saved ? hexA(ENTITIES.Organization.color, 0.25) : P.paper);
        }
      }
      // tube outlet from the mailroom
      lw(1.2); box(1584, 570, 30, 8);
      // desks with headsets
      desk(1262, fl - 34, 200, fl);
      monitor(1288, fl - 60, 32, 22, 'chart');
      monitor(1390, fl - 60, 32, 22, 'chart');
      chair(1300, fl); chair(1402, fl);
      person(1300, fl, { seated: true, arm: 'type', headset: true, badge: ENTITIES.Person.color });
      person(1402, fl, { seated: true, arm: 'type', headset: true, badge: ENTITIES.Person.color });
      var noorArm = at(9) && ct > 6 && ct < 8 ? 'up' : 'down';
      person(1520, fl, { flip: true, arm: noorArm, badge: ENTITIES.Person.color });
      mug(1440, fl - 34);
      if (at(9)) {
        // Dana's email: up the tube, onto Mia's screen
        if (ct > 1.4 && ct < 3) {
          var k = ease((ct - 1.4) / 1.6);
          envelope(lerp(1598, 1304, k), lerp(566, fl - 74, k) - Math.sin(k * Math.PI) * 18, 12, hexA(ENTITIES.Interaction.color, 0.3));
        }
        if (ct >= 3) {
          bubble(1304, fl - 86, 'How do I add users? —Dana', ENTITIES.Interaction.color);
          tag(1304, fl - 106, 'Interaction', 'email');
          DYN.involvesMia = [1290, fl - 80, 1294, fl - 48];
        }
        if (ct > 5) bubble(1360, fl - 68, 'Settings → Team → Invite', null);
        tag(1300, fl - 4, 'Person', 'Mia');
        tag(1520, fl - 68, 'Person', 'Noor');
        if (saved) {
          tag(1350, 542, 'SavedView', 'Globex · open');
          DYN.createdBy = [1438, 600, 1510, fl - 50];
        }
      }
    }
    function bubble(x, y, s, color) {
      var w = textW(s, 6, 700) + 10;
      lw(1);
      box(x - w / 2, y - 6, w, 12);
      poly([x - 3, y + 6, x, y + 10, x + 3, y + 6]);
      if (color) { ctx.fillStyle = color; ctx.fillRect(x - w / 2 + 1, y - 5, 2.5, 10); }
      text(s, x + 1, y + 0.5, 6, 'center', 700);
    }

    // -- Sales -----------------------------------------------------------------
    var STAGES = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'WON'];
    var COLX = [232, 300, 368, 436];
    var OTHER_DEALS = [[0, 0, 'NORTHWIND'], [0, 1, 'TAILSPIN'], [1, 0, 'CONTOSO'], [2, 0, 'LITWARE'], [3, 0, 'FABRIKAM']];
    function folder(x, y, label, hot) {
      lw(hot ? 1.6 : 1);
      if (hot) ctx.strokeStyle = ENTITIES.Deal.color;
      poly([x, y + 3, x + 10, y + 3, x + 12, y, x + 56, y, x + 56, y + 15, x, y + 15], hot ? hexA(ENTITIES.Deal.color, 0.3) : P.paper);
      ctx.strokeStyle = P.ink;
      text(label, x + 28, y + 9, 5.5, 'center', 800);
    }
    // where the Globex folder is right now
    function globexFolder() {
      if (step < 2) return null;
      if (at(2)) {
        if (ct < 1) return null;
        var col = 0, k = 1;
        if (ct > 4.5) { col = 1; k = seg(4.5, 5.3); }
        if (ct > 8) { col = 2; k = seg(8, 8.8); }
        var x = lerp(COLX[Math.max(0, col - 1)], COLX[col], ease(k)) - 28;
        return { place: 'board', x: x, y: 798 + (col === 0 ? 2 : 1) * 18 - (col === 0 ? 0 : 0), col: col };
      }
      if (at(3)) return { place: 'meeting' };
      if (at(4)) return { place: 'contracts' };
      return { place: 'board', x: COLX[3] - 28, y: 816, col: 3 };
    }
    function drawSales() {
      var fl = FL.C, ce = CE.C;
      hangSign(560, ce, 'SALES');
      lamp(350, ce, 8);
      frameBoard(196, 768, 276, 112);
      STAGES.forEach(function (s, i) {
        text(s, COLX[i], 782, 6.5, 'center', 800);
        if (i) { lw(0.7); line(COLX[i] - 34, 776, COLX[i] - 34, 874); }
      });
      OTHER_DEALS.forEach(function (d) { folder(COLX[d[0]] - 28, 798 + d[1] * 18, d[2], false); });
      var g = globexFolder();
      if (g && g.place === 'board') folder(g.x, g.y, 'GLOBEX · PRO', true);
      // the bell that rings when a deal is won
      var ring = at(4) && ct > 5 && ct < 8;
      lw(1.2);
      ctx.save(); ctx.translate(598, 786); ctx.rotate(ring ? Math.sin(t * 30) * 0.4 : 0);
      poly([-7, 10, -5, 0, 5, 0, 7, 10]); circle(0, 12, 2, P.ink);
      ctx.restore();
      line(598, ce, 598, 786);
      // Ravi: at the board in stop 2, at his desk otherwise
      desk(486, fl - 34, 120, fl);
      monitor(512, fl - 58, 30, 20, 'chart');
      lw(1.1); box(560, fl - 40, 12, 6);
      var raviHere = !(at(3) || at(4));
      if (at(2)) {
        var rx = g ? g.x + 70 : 486;
        person(clamp(rx, 300, 520), fl, { arm: g ? 'up' : 'down', flip: true, badge: ENTITIES.Person.color });
      } else if (raviHere) {
        chair(530, fl);
        person(530, fl, { seated: true, arm: 'phone', badge: ENTITIES.Person.color });
      }
      // Lin on the phone at the other end
      chair(560, fl, true);
      person(580, fl, { seated: true, flip: true, arm: 'phone', badge: ENTITIES.Person.color });
      if (at(2) && g) {
        tag(g.x + 28, g.y + 26, 'Deal', 'stage: ' + STAGES[g.col]);
        DYN.dealFor = [g.x + 20, g.y, 262 + 25, 622];
        DYN.dealWith = [g.x + 56, g.y + 8, 744, fl - 44];
      }
    }

    // -- Meeting room ----------------------------------------------------------
    function drawMeeting() {
      var fl = FL.C, ce = CE.C;
      hangSign(1030, ce, 'MEETING ROOM');
      lamp(890, ce, 14);
      // wall screen
      lw(1.4); box(760, 764, 120, 56);
      if (at(3)) {
        text('PROPOSAL', 820, 780, 8, 'center', 800);
        text('Globex · Pro plan', 820, 794, 6.5, 'center', 700);
        lw(0.6); line(780, 806, 860, 806); line(780, 812, 840, 812);
      } else { monitor(760, 764, 120, 56, 'chart'); }
      windowFrame(980, 776, 40, 50);
      // table and chairs
      lw(1.3);
      box(770, fl - 36, 250, 6);
      line(800, fl - 30, 800, fl); line(990, fl - 30, 990, fl);
      chair(752, fl); chair(1030, fl, true);
      var meeting = at(3);
      if (at(2) || meeting) {
        // Dana, waiting then meeting
        drawDana(752, fl, { seated: true, arm: meeting ? 'forward' : 'down' });
        mug(786, fl - 36);
      }
      if (meeting) {
        person(1030, fl, { seated: true, flip: true, arm: 'hold', badge: ENTITIES.Person.color });
        lw(1); poly([1002, fl - 46, 1014, fl - 46, 1015, fl - 34, 1001, fl - 34], hexA(ENTITIES.Deal.color, 0.3));
        // the note-taking agent
        robot(890, fl - 36, { arm: 'type' });
        var talk = Math.floor(ct / 2.2) % 2;
        if (ct > 0.8) bubble(talk ? 990 : 790, fl - 84, talk ? 'Pro has SSO, yes.' : 'Does Pro include SSO?', ENTITIES.Interaction.color);
        if (ct > 4) {
          var k = ease(seg(4, 6));
          paper(lerp(878, 842, k), lerp(fl - 74, fl - 54, k), 20, 18, 'NOTES', hexA(ENTITIES.Document.color, 0.3));
        }
        tag(920, fl - 116, 'Interaction', 'meeting');
        tag(752, fl - 6, 'Person', 'Dana');
        tag(1030, fl - 6, 'Person', 'Ravi');
        tag(895, fl - 12, 'Agent', 'note-taker');
        DYN.involvesA = [878, fl - 110, 762, fl - 54];
        DYN.regarding = [968, fl - 110, 1008, fl - 50];
        if (ct > 6) tag(832, fl - 66, 'Document', 'notes');
      } else if (!at(2)) {
        // an internal stand-up when Dana isn't here
        person(810, fl, { arm: 'forward', badge: ENTITIES.Person.color });
        person(960, fl, { flip: true, arm: 'down', badge: ENTITIES.Person.color });
        if (mod(t, 6) < 3) bubble(810, fl - 64, 'Ship it Friday?', null);
        else bubble(960, fl - 64, 'Friday works.', null);
      }
      if (at(2)) {
        tag(752, fl - 62, 'Person', 'Dana');
      }
    }

    // -- Contracts -------------------------------------------------------------
    function drawContracts() {
      var fl = FL.C, ce = CE.C;
      hangSign(1180, ce, 'CONTRACTS');
      lamp(1310, ce, 14);
      // binders
      for (var s = 0; s < 2; s++) {
        var sy = 784 + s * 40;
        lw(1.2); line(1440, sy + 30, 1600, sy + 30);
        for (var b = 0; b < 11; b++) { lw(0.9); box(1444 + b * 14, sy + (b % 3 === 0 ? 4 : 0), 10, 30 - (b % 3 === 0 ? 4 : 0)); }
      }
      // hopper and chute down to Finance
      lw(1.3); poly([1550, 900, 1590, 900, 1578, 916, 1562, 916]);
      pipePath([[1570, 916], [1570, 1004]], 8);
      // Omar behind the desk
      var stamp = at(4) && ct > 3.8 && ct < 4.6;
      person(1380, fl, { flip: true, arm: stamp ? 'up' : 'forward', badge: ENTITIES.Person.color });
      desk(1220, fl - 36, 170, fl);
      ctx.save(); ctx.globalAlpha = 0.5; hatch(1220, fl - 31, 170, 31, 6, 0.5); ctx.restore();
      paper(1292, fl - 52, 34, 16, 'CONTRACT');
      if (at(4) || step > 4) {
        ctx.save(); ctx.translate(1320, fl - 44); ctx.rotate(-0.2);
        if (step > 4 || ct > 4) { lw(1); ctx.strokeStyle = ENTITIES.Subscription.color; ctx.strokeRect(-8, -3, 16, 7); ctx.strokeStyle = P.ink; }
        ctx.restore();
      }
      lw(1.2); box(1350, fl - 46 + (stamp ? 4 : 0), 10, 6); line(1355, fl - 46 + (stamp ? 4 : 0), 1355, fl - 52 + (stamp ? 4 : 0));
      if (at(4)) {
        var g = globexFolder();
        if (g) folder(1226, fl - 51, 'GLOBEX · PRO', true);
        // Dana walks in from the meeting room and signs
        var dx = lerp(1060, 1204, ease(seg(0, 2.5)));
        var walking = ct < 2.5;
        drawDana(dx, fl, { walk: walking ? t * 9 : null, arm: ct > 2.5 && ct < 3.8 ? 'forward' : 'down' });
        // Ravi follows and cheers at the end
        person(lerp(1030, 1150, ease(seg(0.4, 2.8))), fl, { walk: ct < 2.8 ? t * 9 : null, arm: ct > 5 ? 'cheer' : 'down', badge: ENTITIES.Person.color });
        // sparkle as the badge changes
        if (ct > 4.8 && ct < 5.6) {
          ctx.save(); ctx.globalAlpha = 1 - Math.abs(ct - 5.2) / 0.4;
          lw(1);
          for (var i = 0; i < 6; i++) { var a = i * TAU / 6; line(dx + 4 + Math.cos(a) * 9, fl - 30 + Math.sin(a) * 9, dx + 4 + Math.cos(a) * 14, fl - 30 + Math.sin(a) * 14); }
          ctx.restore();
        }
        tag(dx, fl - 72, 'Role', danaBadge() + ' @ Acme');
        // the subscription card: written, then dropped to Finance
        if (ct > 6) {
          var k1 = ease(seg(6, 7.4)), k2 = ease(seg(7.6, 9.4));
          var cx = lerp(1320, 1570, k1), cy = lerp(fl - 70, 896, k1) + k2 * 110;
          if (k2 < 1) {
            lw(1.2); box(cx - 16, cy - 9, 32, 18, hexA(ENTITIES.Subscription.color, 0.35));
            text('GLOBEX', cx, cy - 2, 5.5, 'center', 800);
            text('PRO · monthly', cx, cy + 4.5, 4.5, 'center', 700);
            tag(cx, cy - 20, 'Subscription', 'Pro, monthly');
            DYN.heldBy = [cx - 16, cy, dx + 8, fl - 44];
          } else delete DYN.heldBy;
        }
      } else {
        // Omar's paperwork when no one is signing
        person(1250, fl, { arm: 'forward', badge: ENTITIES.Person.color });
      }
    }

    // -- Reception -------------------------------------------------------------
    function danaInLobby() {
      // returns Dana's x and pose during stop 1, or null once in the lift
      if (!at(1)) return null;
      if (ct < 3.5) return { x: lerp(110, 506, ease(ct / 3.5)), walk: true, flip: false };
      if (ct < 6) return { x: 506, walk: false, flip: true, arm: ct > 4.8 ? 'forward' : 'down' };
      if (ct < 7.6) return { x: lerp(506, 650, ease((ct - 6) / 1.6)), walk: true, flip: false };
      return null;
    }
    function drawLobby() {
      var fl = FL.D, ce = CE.D;
      sign(400, ce + 24, 'ACME CLOUD · RECEPTION', 11);
      lamp(300, ce, 22); lamp(500, ce, 22);
      windowFrame(540, 1010, 50, 54);
      // revolving door in the front wall
      lw(1.4);
      line(X0 - 8, 1080, X0 - 8, fl); line(X0 + 8, 1080, X0 + 8, fl);
      lw(1.2);
      for (var p = 0; p < 3; p++) {
        var dx = Math.cos(t * 0.8 + p * Math.PI / 3) * 22;
        line(X0 + dx, 1084, X0 + dx, fl);
      }
      ctx.save(); ctx.globalAlpha = 0.25; hatch(X0 - 24, 1082, 48, fl - 1082, 10, 0.5); ctx.restore();
      // waiting seats with a visitor reading
      chair(560, fl, true);
      person(576, fl, { seated: true, flip: true, arm: 'hold', badge: ENTITIES.Role.color });
      plant(605, fl);
      plant(214, fl);
      // reception desk and Jo
      var printing = at(1) && ct > 3.8 && ct < 4.8;
      person(430, fl, { arm: at(1) && ct > 4.6 && ct < 5.6 ? 'forward' : 'type', badge: ENTITIES.Person.color });
      lw(1.4);
      box(370, fl - 42, 110, 42);
      ctx.save(); ctx.globalAlpha = 0.5; hatch(370, fl - 42, 110, 42, 6, 0.6); ctx.restore();
      lw(1.1); box(380, fl - 54, 28, 12);
      text('BADGES', 394, fl - 48, 4.5, 'center', 800);
      monitor(440, fl - 66, 26, 18, 'chart');
      var d = danaInLobby();
      if (printing) {
        var k = seg(3.8, 4.8);
        lw(1); box(386, fl - 54 - k * 10, 14, 10, hexA(ENTITIES.Role.color, 0.4));
      }
      if (at(1) && ct >= 4.8 && ct < 5.6) {
        var k2 = ease(seg(4.8, 5.6));
        lw(1); box(lerp(390, 496, k2), fl - 62 + k2 * 12, 12, 9, hexA(ENTITIES.Role.color, 0.4));
      }
      if (d) {
        drawDana(d.x, fl, { walk: d.walk ? t * 9 : null, flip: d.flip, arm: d.arm, noBadge: ct < 5.6 });
        var side = d.x > 540 ? -1 : 1;
        tag(d.x, fl - 66, 'Person', 'Dana');
        tag(d.x + (d.flip ? 40 : -40), fl - 10, 'Organization', 'Globex');
        if (ct >= 5.6) {
          var rx = d.x + side * 78, ry = fl - 46;
          tag(rx, ry, 'Role', 'LEAD @ Acme');
          DYN.plays = [d.x + side * 7, fl - 30, rx - side * 42, ry + 3];
          DYN.at = [rx, ry - 8, 520, ce + 34];
        } else { delete DYN.plays; delete DYN.at; }
      } else if (at(1)) {
        delete DYN.plays; delete DYN.at;
      }
    }

    // -- Mailroom ----------------------------------------------------------------
    function drawMailroom() {
      var fl = FL.D, ce = CE.D;
      hangSign(760, ce, 'MAILROOM');
      // pigeonholes
      frameBoard(700, 996, 120, 92);
      for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) {
        lw(0.7); box(704 + c * 28, 1000 + r * 21, 28, 21, false);
        if ((r * 4 + c + Math.floor(t / 3)) % 3) { lw(0.8); box(708 + c * 28, 1010 + r * 21, 18, 10); }
      }
      // Bo sorts the post
      person(842, fl, { flip: true, arm: mod(t, 2) < 1 ? 'up' : 'forward', badge: ENTITIES.Person.color });
      // counter with out/in trays
      lw(1.4); box(870, fl - 40, 130, 40);
      lw(1.1); box(880, fl - 48, 44, 8); box(946, fl - 48, 44, 8);
      text('OUT', 902, fl - 54, 6, 'center', 800);
      text('IN', 968, fl - 54, 6, 'center', 800);
      // mail tube intake (to Support, via the outside wall)
      lw(1.2); poly([1046, 1012, 1074, 1012, 1068, 1024, 1052, 1024]);
      // sacks
      lw(1.2); poly([1020, fl, 1016, fl - 26, 1030, fl - 34, 1044, fl - 26, 1040, fl]);
      // belt through the doorway to Finance
      belt(1000, 1280, fl - 22, at(8) && ct > 8.4 ? 40 : -40, null);
      // envelopes riding the tube now and then
      for (var k = 0; k < 2; k++) {
        if (at(9)) break;
        var dd = mod(t * 110 + k * MAILTUBE_LEN / 2, MAILTUBE_LEN * 1.6);
        if (dd > MAILTUBE_LEN) continue;
        var p = along(MAILTUBE, dd);
        ctx.fillStyle = ENTITIES.Interaction.color; ctx.fillRect(p[0] - 3, p[1] - 2, 6, 4);
      }
      if (at(9) && ct < 1.6) {
        var q = along(MAILTUBE, seg(0, 1.6) * MAILTUBE_LEN);
        ctx.fillStyle = ENTITIES.Interaction.color; ctx.fillRect(q[0] - 4, q[1] - 3, 8, 6);
      }
    }

    // -- Finance -------------------------------------------------------------------
    function wheelAngle() {
      // the subscriptions wheel clicks round, one card at a time
      var stepA = TAU / 10;
      if (at(8)) return -Math.PI / 2 + stepA * (1 - ease(seg(1, 2)));
      if (at(4) || step < 4) return -Math.PI / 2 + stepA * Math.floor(t / 5) + stepA * ease(mod(t, 5) - 4);
      return -Math.PI / 2 + stepA;
    }
    function drawFinance() {
      var fl = FL.D, ce = CE.D;
      hangSign(1180, ce, 'FINANCE');
      lamp(1300, ce, 14);
      // calendar
      lw(1.2); box(1134, 996, 40, 40);
      ctx.fillStyle = ENTITIES.Invoice.color; ctx.fillRect(1135, 997, 38, 8);
      var month = step < 8 || (at(8) && ct < 1) ? 'OCT' : 'NOV';
      text(month, 1154, 1018, 10, 'center', 800);
      // subscriptions wheel
      var wx = 1510, wy = 1068, R = 54;
      lw(1.6); poly([wx - 34, fl, wx, wy, wx + 34, fl], false);
      circle(wx, wy, R);
      circle(wx, wy, 12, hexA(ENTITIES.Subscription.color, 0.45));
      var a0 = wheelAngle();
      var hasGlobex = step > 4 || (at(4) && ct > 9.4);
      for (var i = 0; i < 10; i++) {
        var a = a0 + i * TAU / 10;
        var cx = wx + Math.cos(a) * (R - 12), cy = wy + Math.sin(a) * (R - 12);
        lw(0.9); line(wx + Math.cos(a) * 12, wy + Math.sin(a) * 12, cx, cy);
        var gl = i === 0 && hasGlobex;
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a + Math.PI / 2);
        lw(gl ? 1.5 : 0.9);
        if (gl) ctx.strokeStyle = ENTITIES.Subscription.color;
        box(-8, -5, 16, 10, gl ? hexA(ENTITIES.Subscription.color, 0.45) : P.paper);
        ctx.restore();
        ctx.strokeStyle = P.ink;
      }
      text('SUBSCRIPTIONS', wx, fl - 4, 5.5, 'center', 800);
      // Priya at her desk, with the printer
      desk(1214, fl - 34, 150, fl);
      monitor(1236, fl - 58, 30, 20, 'chart');
      chair(1290, fl);
      person(1290, fl, { seated: true, arm: 'type', badge: ENTITIES.Person.color });
      lw(1.3); box(1380, fl - 70, 40, 22); line(1384, fl - 48, 1384, fl); line(1416, fl - 48, 1416, fl);
      text('PRINT', 1400, fl - 59, 5.5, 'center', 800);
      // card reader
      lw(1.1); box(1340, fl - 46, 10, 12);

      if (at(8)) {
        var invY = fl - 46;
        // printer: two copies, one stays, one goes out
        if (ct > 2.2) {
          var p1 = ease(seg(2.2, 3.4));
          var copyX = lerp(1386, 1312, p1), copyY = lerp(fl - 80, invY, p1);
          var paid = ct > 11.2;
          paper(copyX, copyY, 22, 14, paid ? 'PAID' : 'INV', paid ? hexA(ENTITIES.Payment.color, 0.35) : hexA(ENTITIES.Invoice.color, 0.25));
          tag(copyX + 10, copyY - 12, 'Invoice', 'INV-0042 · $19');
          DYN.bills = [copyX + 22, copyY + 4, wx - 6, wy - R + 4];
        }
        if (ct > 3.6 && ct < 7.4) {
          var p2 = seg(3.6, 7);
          var ex = lerp(1300, 900, p2);
          paper(ex, fl - 36, 18, 13, 'INV', hexA(ENTITIES.Invoice.color, 0.25));
        }
        if (ct > 7 && ct < 8.2) { ctx.save(); ctx.globalAlpha = 1 - seg(7.4, 8.2); envelope(902, fl - 54, 14); ctx.restore(); }
        // the payment comes back in
        if (ct > 8.4 && ct < 11.2) {
          var p3 = ease(seg(8.4, 11.2));
          var px1 = p3 < 0.15 ? 968 : lerp(968, 1320, (p3 - 0.15) / 0.85);
          var py1 = p3 < 0.15 ? fl - 54 : fl - 30 - (px1 > 1290 ? (px1 - 1290) : 0);
          envelope(px1, py1, 14, hexA(ENTITIES.Payment.color, 0.5));
          tag(px1, py1 - 16, 'Payment', '$19');
          DYN.settles = [px1 + 7, py1 - 4, 1318, fl - 44];
        } else delete DYN.settles;
        tag(wx, wy - R - 14, 'Subscription', 'Globex');
        tag(1290, fl - 6, 'Person', 'Priya');
      }
    }

    // -- Archive -------------------------------------------------------------------
    var LEDGER = [
      ['09:02', 'p', 'Jo', 'created Role LEAD for Dana'],
      ['09:10', 'p', 'Ravi', 'opened Deal GLOBEX · PRO'],
      ['10:40', 'r', 'Note-taker', 'wrote Document "Meeting notes"'],
      ['11:05', 'p', 'Dana', 'signed Subscription PRO'],
      ['11:05', 'p', 'Omar', 'changed Role LEAD → CUSTOMER'],
      ['11:06', 'p', 'Sam\'s rule', 'created 3 Tasks'],
      ['11:30', 'p', 'Lee', 'granted Permission EDIT to Agent-7'],
      ['12:15', 'r', 'Agent-7', 'closed Task "Import users"'],
      ['09:00', 'p', 'Priya', 'issued Invoice INV-0042'],
      ['09:41', 'o', 'Globex', 'paid Invoice INV-0042'],
      ['14:20', 'p', 'Noor', 'saved View "Globex · open"']
    ];
    function drawArchive() {
      var q = ROOMS[13];
      var x0 = q.x, y0 = q.y, w = q.w, h = q.h;
      sign(x0 + w / 2, y0 + 14, 'ARCHIVE', 10);
      lamp(x0 + 400, y0, 10); lamp(x0 + 800, y0, 10);
      for (var s = 0; s < 2; s++) {
        var sy = y0 + 48 + s * 34;
        lw(1.2); line(x0 + 20, sy + 24, x0 + 240, sy + 24);
        for (var b = 0; b < 9; b++) { lw(0.9); box(x0 + 24 + b * 24, sy + 2, 18, 22); }
        lw(1.2); line(x0 + w - 240, sy + 24, x0 + w - 20, sy + 24);
        for (var c = 0; c < 9; c++) { lw(0.9); box(x0 + w - 236 + c * 24, sy + 2, 18, 22); }
      }
      // the tape
      var ty = y0 + 76, tx0 = x0 + 270, tx1 = x0 + w - 270;
      lw(1.4);
      circle(tx0 - 12, ty + 12, 14); circle(tx1 + 12, ty + 12, 14);
      circle(tx0 - 12, ty + 12, 4, P.ink); circle(tx1 + 12, ty + 12, 4, P.ink);
      box(tx0, ty, tx1 - tx0, 26);
      ctx.save();
      ctx.beginPath(); ctx.rect(tx0, ty, tx1 - tx0, 26); ctx.clip();
      var entryW = 260, off = t * 22;
      var first = Math.floor(off / entryW);
      var hit = null;
      for (var e = first; e < first + Math.ceil((tx1 - tx0) / entryW) + 2; e++) {
        var ex = tx1 - (e * entryW - off) - entryW;
        var L = LEDGER[mod(e, LEDGER.length)];
        lw(0.7); line(ex, ty + 3, ex, ty + 23);
        text(L[0], ex + 6, ty + 13.5, 6.5, 'left', 800, MONO);
        // who: a person, an agent or an organization, all Parties
        var ix = ex + 38, iy = ty + 13;
        lw(0.9);
        if (L[1] === 'r') { box(ix - 3.5, iy - 3.5, 7, 7); ctx.fillStyle = ENTITIES.Agent.color; ctx.fillRect(ix - 2, iy - 1, 4, 1.6); }
        else if (L[1] === 'o') { box(ix - 3.5, iy - 3, 7, 7); line(ix - 4.5, iy - 3, ix, iy - 6); line(ix, iy - 6, ix + 4.5, iy - 3); }
        else { circle(ix, iy - 1.5, 2.4); line(ix - 3.5, iy + 3.5, ix + 3.5, iy + 3.5); }
        text(L[2] + ' ' + L[3], ex + 46, ty + 13.5, 6.5, 'left', 600, MONO);
        if (!hit && ex > tx0 + 120 && ex < tx1 - 300) hit = [ex, ix, iy, L];
      }
      ctx.restore();
      lw(1.4);
      box(tx1 - 40, ty - 34, 34, 24);
      line(tx1 - 23, ty - 10, tx1 - 23, ty - 3 + (mod(t * 22, entryW) < 12 ? 3 : 0));
      text('LOG', tx1 - 23, ty - 22, 7, 'center', 800);
      person(x0 + w / 2, y0 + h - 6, { arm: 'hold', badge: ENTITIES.Person.color });
      text('nothing is ever erased', x0 + w / 2 + 16, y0 + h - 30, 8, 'left', 700);
      if (at(10) && hit) {
        var who = { r: 'Agent', o: 'Organization', p: 'Person' }[hit[3][1]];
        tag(hit[0] + 130, ty + 42, 'AuditEvent', hit[3][0]);
        tag(hit[1], ty - 18, who, hit[3][2]);
        DYN.performed = [hit[0] + 100, ty + 34, hit[1] + 12, ty - 12];
      }
    }

    // audit pipes: a slip drops from every floor into the archive
    function drawRisers() {
      var pipes = [[166, 1216, 300], [1634, 1216, 1500]];
      pipes.forEach(function (p) {
        var x = p[0];
        pipePath([[x, 330], [x, p[1]], [p[2], p[1]]], 6);
        lw(1.1);
        [410, 630, 850, 1070].forEach(function (y) { line(x - 8, y, x + 8, y); line(x - 8, y + 4, x + 8, y + 4); });
        var vert = p[1] - 330, horiz = Math.abs(p[2] - x);
        for (var k = 0; k < 5; k++) {
          var d = mod(t * 90 + k * 230 + x, 1150);
          var q;
          if (d < vert) q = [x, 330 + d];
          else if (d - vert < horiz) q = [x + (p[2] > x ? 1 : -1) * (d - vert), p[1]];
          else continue;
          ctx.fillStyle = ENTITIES.AuditEvent.color;
          ctx.fillRect(q[0] - 2.5, q[1] - 2, 5, 4);
        }
      });
      // the mail tube runs up the outside to Support
      pipePath(MAILTUBE, 6);
    }

    function drawRooms() {
      drawRisers();
      drawServerRoom();
      drawEngineering();
      drawIT();
      drawStudio();
      drawOps();
      drawSupport();
      drawSales();
      drawMeeting();
      drawContracts();
      drawLobby();
      drawMailroom();
      drawFinance();
      drawArchive();
      drawLift(at(1) && ct >= 7.6 ? function (x, yb) { drawDana(x, yb, {}); } : null);
    }

    // =========================================================================
    // Overlays: focus, relation arrows, the ontology map
    // =========================================================================

    function arrow(x1, y1, x2, y2, bend, color, label, k) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      var dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
      var b = bend == null ? Math.min(40, d * 0.22) : bend;
      var cx = mx - dy / d * b, cy = my + dx / d * b;
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.strokeStyle = color;
      lw(2);
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -t * 18;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      var ang = Math.atan2(y2 - cy, x2 - cx);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(ang - 0.42) * 8, y2 - Math.sin(ang - 0.42) * 8);
      ctx.lineTo(x2 - Math.cos(ang + 0.42) * 8, y2 - Math.sin(ang + 0.42) * 8);
      ctx.fill();
      circle(x1, y1, 2.4, color);
      if (label) pill(0.25 * x1 + 0.5 * cx + 0.25 * x2, 0.25 * y1 + 0.5 * cy + 0.25 * y2, label, color);
      ctx.restore();
    }
    function pill(x, y, label, color, size) {
      size = size || 7.5;
      var w = textW(label, size, 800) + 10, h = size + 6;
      ctx.fillStyle = P.paper;
      ctx.strokeStyle = color;
      lw(1.3);
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
      var r = s.rect;
      ctx.save();
      ctx.globalAlpha = 0.5 * focusK;
      ctx.fillStyle = P.paper;
      ctx.beginPath();
      ctx.rect(-500, -500, W + 1000, H + 1000);
      ctx.rect(r[0] + r[2], r[1], -r[2], r[3]);
      ctx.fill('evenodd');
      ctx.restore();
    }
    function drawStepArrows() {
      var s = TOUR[step];
      s.rels.forEach(function (rel) {
        var p = rel.dyn ? DYN[rel.dyn] : rel.pts;
        if (!p) return;
        arrow(p[0], p[1], p[2], p[3], rel.bend == null ? null : rel.bend, ENTITIES[rel.from].color, rel.label, focusK);
      });
    }

    function drawMap(k) {
      if (k <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = 0.74 * k;
      ctx.fillStyle = P.paper;
      ctx.fillRect(-500, -500, W + 1000, H + 1000);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = k;
      function bendFor(i, d) { return (i % 2 ? 1 : -1) * Math.min(60, d * 0.12); }
      RELATIONS.forEach(function (r, i) {
        var a = ANCHORS[r[0]], b = ANCHORS[r[2]];
        var col = ENTITIES[r[0]].color;
        if (r[0] === r[2]) {
          ctx.strokeStyle = col; lw(2);
          ctx.beginPath(); ctx.arc(a[0] + 30, a[1] - 26, 22, 0, TAU); ctx.stroke();
          return;
        }
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        arrow(a[0] + dx / d * 26, a[1] + dy / d * 26, b[0] - dx / d * 30, b[1] - dy / d * 30, bendFor(i, d), col, null, 1);
      });
      RELATIONS.forEach(function (r, i) {
        var a = ANCHORS[r[0]], b = ANCHORS[r[2]];
        if (r[0] === r[2]) { pill(a[0] + 56, a[1] - 46, r[1], ENTITIES[r[0]].color, 8); return; }
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), bend = bendFor(i, d);
        pill((a[0] + b[0]) / 2 - dy / d * bend * 0.5, (a[1] + b[1]) / 2 + dx / d * bend * 0.5, r[1], ENTITIES[r[0]].color, 8);
      });
      ['Person', 'Organization', 'Agent'].forEach(function (n) {
        var a = ANCHORS[n], b = ANCHORS.Party;
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        ctx.strokeStyle = P.ink; lw(1.6);
        ctx.setLineDash([3, 3]); line(a[0] + dx / d * 26, a[1] + dy / d * 26, b[0] - dx / d * 34, b[1] - dy / d * 34); ctx.setLineDash([]);
        pill(a[0] + dx * 0.3, a[1] + dy * 0.3, 'is a', P.ink, 7);
      });
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
      ct += dt;

      if (playing) {
        stepClock += dt;
        var dur = stepDuration(step);
        dotEls[step].firstChild.style.width = clamp(stepClock / dur, 0, 1) * 100 + '%';
        if (stepClock >= dur) {
          if (step === TOUR.length - 1) { playing = false; renderCard(); }
          else go(step + 1);
        }
      }

      if (!free) {
        var f = targetCam();
        var k = reduced ? 1 : 1 - Math.exp(-dt * 2.2);
        cam.s = Math.exp(lerp(Math.log(cam.s), Math.log(f.s), k));
        cam.x = lerp(cam.x, f.x, k);
        cam.y = lerp(cam.y, f.y, k);
      }
      focusK = Math.min(1, focusK + dt * 1.6);
      var wantMap = mapOn || TOUR[step].map ? 1 : 0;
      mapK = reduced ? wantMap : lerp(mapK, wantMap, 1 - Math.exp(-dt * (TOUR[step].map ? 0.9 : 3)));

      readPalette();
      px = 1 / cam.s;
      TAGS = [];
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = P.paper;
      ctx.fillRect(0, 0, vw, vh);
      ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (vw / 2 - cam.x * cam.s), dpr * (vh / 2 - cam.y * cam.s));
      ctx.strokeStyle = P.ink;
      ctx.lineCap = 'butt';
      drawShell();
      drawRooms();
      drawFocus();
      if (!TOUR[step].map) { drawStepArrows(); drawTags(); }
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
