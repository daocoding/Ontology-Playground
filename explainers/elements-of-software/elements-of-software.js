/*!
 * Elements of Software — a day at a software company, cut open
 *
 * A plain-JavaScript, dependency-free animation that explains the
 * "Elements of Software" ontology (catalogue/community/daocoding/
 * elements-of-software) to people who know their own job but not the rest
 * of the company, and have never read an ontology.
 *
 * The building is an ordinary software company with its walls cut away:
 * engineering on one floor, product, IT, sales, customer success, support,
 * finance and the kitchen around it. Everyone is at work, and the screens
 * show what they are doing: the sprint board, a pull request and its CI
 * checks, the CRM pipeline, a video demo, a RevOps workflow, billing, the
 * helpdesk, the audit log. Records travel between floors the way they do in
 * real life, through the network to the cloud and back.
 *
 * The tour follows one deal through one day. Small tags name the things the
 * software keeps track of (a Person, a Deal, a Task, a Permission...), and
 * the caption explains them. The last stop fades the building into the
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

  var W = 1800, H = 1460;
  var X0 = 180, X1 = 1620, CORE = 1540;   // stairs and network riser live in the core
  var TOPS = [260, 480, 700, 920, 1140];  // top of each storey, 5th floor down to ground
  var GROUND = 1360;
  var RISER = 1606;
  var CLOUD = { x: 1150, y: 100 };
  var DESK = 36;                          // desk height; standing desks are 46
  function FLR(i) { return TOPS[i] + 215; }   // where feet go
  function CEI(i) { return TOPS[i] + 5; }     // underside of the slab above

  function room(id, name, x, y, w, h, step) {
    return { id: id, name: name, x: x, y: y, w: w, h: h, step: step };
  }

  // `step` is the tour stop a click on the room takes you to.
  var ROOMS = [
    room('product', 'Product & Design', 180,  260,  580, 220, 3),
    room('it',      'IT & Security',    760,  260,  360, 220, 7),
    room('lead',    'Leadership',       1120, 260,  420, 220, 0),
    room('standup', 'Engineering · stand-up corner', 180, 480, 290, 220, 4),
    room('eng',     'Engineering',      470,  480,  670, 220, 5),
    room('oncall',  'Engineering · on-call', 1140, 480, 400, 220, 8),
    room('sales',   'Sales',            180,  700,  640, 220, 2),
    room('demo',    'Demo room',        820,  700,  280, 220, 1),
    room('cs',      'Customer Success', 1100, 700,  440, 220, 9),
    room('support', 'Support',          180,  920,  680, 220, 11),
    room('finance', 'Finance & RevOps', 860,  920,  680, 220, 10),
    room('lobby',   'Reception',        180,  1140, 440, 220, 0),
    room('kitchen', 'Kitchen',          620,  1140, 580, 220, 6),
    room('booths',  'Phone booths',     1200, 1140, 340, 220, 0),
    room('core',    'Stairs & network riser', 1540, 260, 80, 1100, 0)
  ];

  // Screens that matter to the story, as content rectangles [x, y, w, h].
  // Desk monitors sit exactly on their desks: bottom = floor - desk - 7.
  var S = {
    anaDoc: [252, 374, 80, 48], anaBoard: [338, 374, 80, 48],
    moDesign: [496, 384, 112, 48],
    leeAccess: [916, 384, 84, 48], leeAudit: [1006, 384, 88, 48],
    leadTV: [1290, 300, 120, 66],
    standupTV: [200, 512, 160, 92],
    kaiL: [506, 604, 84, 48], kaiR: [596, 604, 88, 48],
    junL: [726, 604, 84, 48], junR: [816, 604, 84, 48],
    ivyL: [946, 604, 84, 48], ivyR: [1036, 604, 84, 48],
    oncLat: [1150, 515, 118, 68], oncErr: [1278, 515, 118, 68], oncDep: [1406, 515, 124, 68],
    salesTV: [200, 734, 120, 70],
    lin: [418, 828, 60, 44], tom: [512, 828, 60, 44],
    raviCRM: [622, 820, 100, 52], raviChat: [728, 820, 76, 52],
    demoTV: [846, 728, 156, 92],
    tessBoard: [1146, 820, 100, 52], tessCall: [1252, 820, 76, 52],
    ola: [1376, 828, 76, 44],
    queueTV: [200, 952, 130, 72],
    miaT: [376, 1040, 100, 52], miaC: [482, 1040, 76, 52],
    noorT: [616, 1040, 100, 52], noorG: [722, 1040, 76, 52],
    samWF: [906, 1040, 100, 52], samG: [1012, 1040, 76, 52],
    priBill: [1136, 1040, 100, 52], priSheet: [1242, 1040, 76, 52]
  };
  function mid(r) { return [r[0] + r[2] / 2, r[1] + r[3] / 2]; }

  // Where each entity type "lives" in the building, for the graph overlay.
  var ANCHORS = {
    Party: [1150, 100], Person: [560, 650], Organization: [930, 790], Agent: [780, 560],
    Role: [560, 860], Team: [380, 640], Task: [270, 580], Project: [420, 330], Document: [292, 420],
    Product: [420, 780], Deal: [700, 780], Interaction: [1030, 860],
    Permission: [880, 330], AuditEvent: [1050, 420],
    Automation: [960, 1010], Subscription: [1180, 1000], Invoice: [1320, 1080], Payment: [1470, 1010],
    SavedView: [660, 1000]
  };

  // ---------------------------------------------------------------------------
  // The tour: one deal, one day
  // ---------------------------------------------------------------------------
  // time: the clock. rect, or shots [[atSecond, rect], ...]: where the camera
  // looks. story: what happens. note: what the software records. ents / rels:
  // chips under "In the model". A rel with `dyn` is also drawn in the scene
  // as an arrow between two things you can see. min: seconds the story needs.

  var TOUR = [
    {
      time: '08:55', rect: [120, 10, 1560, 1420],
      title: 'A day at a software company',
      story: 'This is Acme Cloud with its walls cut away. Engineering is on the fourth floor. Product, IT, sales, customer success, support and finance work around it. Follow one deal through the day and see how everyone\'s work connects.',
      note: 'Under every tool on these screens (the CRM, the issue board, the helpdesk, billing) sit the same few kinds of thing. Small tags will name them as they show up.',
      ents: [], rels: []
    },
    {
      time: '09:10', rect: [750, 712, 370, 214], min: 12,
      title: 'The demo',
      story: 'Ravi from Sales demos the product on a video call to Dana, who runs IT at Globex. Dana likes it, with one condition: "We can\'t sign without single sign-on."',
      note: 'Dana is a Person and Globex is an Organization. Both are Parties: anyone who can act. In Acme\'s CRM Dana is a Lead, which is a Role Dana plays, not a kind of person. The call is an Interaction involving both of them.',
      ents: ['Person', 'Organization', 'Party', 'Role', 'Interaction'],
      rels: [
        { from: 'Party', label: 'plays', to: 'Role', dyn: 'plays' },
        { from: 'Role', label: 'at', to: 'Organization' },
        { from: 'Interaction', label: 'involves', to: 'Party', dyn: 'involves' }
      ]
    },
    {
      time: '09:30', rect: [555, 762, 300, 168], min: 13,
      title: 'The deal',
      story: 'Back at the desk, Ravi drags the Globex deal to Proposal and notes "SSO!". Then he asks in #product whether SSO is on the roadmap. The message travels up to the cloud and down to the fifth floor.',
      note: 'The CRM card is a Deal, with Dana, for the Pro plan, which is a Product. Moving it to Proposal didn\'t make it a different record. Stage is just a property, and the call is linked to the deal.',
      ents: ['Deal', 'Product', 'Party', 'Interaction'],
      rels: [
        { from: 'Deal', label: 'with', to: 'Party', dyn: 'dealWith' },
        { from: 'Deal', label: 'for', to: 'Product', dyn: 'dealFor' },
        { from: 'Interaction', label: 'regarding', to: 'Deal' }
      ]
    },
    {
      time: '09:45', rect: [182, 338, 390, 145], min: 13,
      title: 'A spec and a project',
      story: 'Ana, the product manager, writes a one-page spec for SSO and creates the project on the Platform team\'s board, with tickets under it. Mo starts designing the new sign-in screen.',
      note: 'The spec is a Document attached to a Project. Tickets are Tasks that belong to the Project. A sub-ticket isn\'t a special type: it\'s a Task whose parent is another Task. The project is owned by a Team.',
      ents: ['Document', 'Project', 'Task', 'Team'],
      rels: [
        { from: 'Document', label: 'attached to', to: 'Project', dyn: 'attached' },
        { from: 'Task', label: 'belongs to', to: 'Project', dyn: 'belongs' },
        { from: 'Task', label: 'subtask of', to: 'Task', dyn: 'subtask' },
        { from: 'Project', label: 'owned by', to: 'Team' }
      ]
    },
    {
      time: '10:00', rect: [182, 488, 410, 212], min: 12,
      title: 'Stand-up',
      story: 'The Platform team gathers at the board: yesterday, today, blockers. Kai takes SSO-12, the login flow. agent-7, the team\'s coding agent, takes SSO-13, the SAML callback, and Kai is responsible for its work.',
      note: 'Kai is a Person and a member of a Team. Each ticket is assigned to a Party. That can be a person or an agent, and the model doesn\'t change. agent-7 is an Agent operated by Kai.',
      ents: ['Team', 'Person', 'Agent', 'Task'],
      rels: [
        { from: 'Person', label: 'member of', to: 'Team', dyn: 'memberOf' },
        { from: 'Task', label: 'assigned to', to: 'Party', dyn: 'assignedA' },
        { from: 'Task', label: 'assigned to', to: 'Party', dyn: 'assignedB' },
        { from: 'Agent', label: 'operated by', to: 'Party' }
      ]
    },
    {
      time: '11:30', rect: [466, 568, 330, 134], min: 14,
      title: 'Code, review, merge',
      story: 'agent-7 opens a pull request for SSO-13. CI runs the build, unit and end-to-end tests, all green. Kai reads the diff, leaves one comment, approves, and it merges. The ticket moves to Done by itself.',
      note: 'Code and pull requests have their own models. This one tracks the work: the Task\'s status went from In review to Done, and the record shows an agent did it.',
      ents: ['Task', 'Agent', 'Person'],
      rels: [{ from: 'Task', label: 'assigned to', to: 'Party', dyn: 'assigned5' }]
    },
    {
      time: '12:30', rect: [780, 1200, 310, 160],
      title: 'Lunch',
      story: 'Lunch in the kitchen. Platform, Sales and Support share a table, and someone is losing at ping-pong. This is where Kai hears that a whole deal is waiting on SSO.',
      note: 'Each team is part of one Organization, Acme Cloud, and each person is a member of one or more teams. Globex is an Organization in the same model, and so is Acme.',
      ents: ['Team', 'Organization', 'Person'],
      rels: [
        { from: 'Team', label: 'part of', to: 'Organization', dyn: 'partA' },
        { from: 'Team', label: 'part of', to: 'Organization', dyn: 'partB' },
        { from: 'Team', label: 'part of', to: 'Organization', dyn: 'partC' },
        { from: 'Person', label: 'member of', to: 'Team', dyn: 'member6' }
      ]
    },
    {
      time: '13:15', rect: [862, 352, 250, 128], min: 13,
      title: 'Access, on the record',
      story: 'To ship SSO, agent-7 needs to deploy to production, and it doesn\'t have that right. Kai files an access request. Lee in IT checks it and approves it for 30 days.',
      note: 'The grant is a Permission given to a Party, here an agent. Because it is a record, anyone can ask later who could deploy to production, and since when.',
      ents: ['Permission', 'Agent', 'Person'],
      rels: [
        { from: 'Permission', label: 'granted to', to: 'Party', dyn: 'granted' },
        { from: 'Agent', label: 'operated by', to: 'Party' }
      ]
    },
    {
      time: '14:30', shots: [[0, [1140, 500, 400, 200]], [5.5, [555, 762, 300, 168]]], min: 15,
      title: 'Ship it, sign it',
      story: 'The deploy pipeline goes green all the way to production. Ravi tells Dana that SSO is live. An hour later the contract comes back signed, Ravi drags the deal to Won, and someone hits the sales gong.',
      note: 'It\'s the same Person with a new Role: Dana goes from Lead to Customer, and nothing about Dana is copied. The deal\'s stage changes to Won.',
      ents: ['Deal', 'Role', 'Person'],
      rels: [{ from: 'Party', label: 'plays', to: 'Role', dyn: 'plays8' }]
    },
    {
      time: '14:31', shots: [[0, [866, 1006, 260, 136]], [4.4, [600, 10, 1080, 1140]], [9, [1108, 792, 250, 134]]], min: 16,
      title: 'The follow-up does itself',
      story: 'Months ago, Sam in RevOps built a workflow: when a deal is won, start billing, open an onboarding project for Customer Success and post in #wins. It runs now, in the cloud, and nobody has to retype anything.',
      note: 'The workflow is an Automation maintained by Sam. It creates Tasks, here Tess\'s onboarding checklist for Globex, and sets up the Subscription in billing.',
      ents: ['Automation', 'Task', 'Person'],
      rels: [
        { from: 'Automation', label: 'creates', to: 'Task', dyn: 'creates' },
        { from: 'Automation', label: 'maintained by', to: 'Party', dyn: 'maintained' }
      ]
    },
    {
      time: '15:00', rect: [1058, 1006, 336, 136], min: 12,
      title: 'Billing',
      story: 'In Finance, Priya sees Globex appear in billing. The first invoice goes out automatically, the card payment clears a few minutes later, and monthly recurring revenue goes up by $2,000.',
      note: 'The Subscription is held by Globex and is for the Pro plan. Each Invoice bills a Subscription, and each Payment settles an Invoice. That\'s the whole recurring-revenue story.',
      ents: ['Subscription', 'Invoice', 'Payment', 'Party', 'Product'],
      rels: [
        { from: 'Subscription', label: 'held by', to: 'Party', dyn: 'heldBy' },
        { from: 'Subscription', label: 'for', to: 'Product' },
        { from: 'Invoice', label: 'bills', to: 'Subscription', dyn: 'bills' },
        { from: 'Payment', label: 'settles', to: 'Invoice', dyn: 'settles' }
      ]
    },
    {
      time: '16:00', rect: [318, 1006, 420, 136], min: 13,
      title: 'Support',
      story: 'Dana\'s first ticket arrives: "How do I turn on SSO for everyone?" The support bot drafts an answer, and Mia checks it and sends it. Noor saves a view of open Globex tickets so the new customer gets extra attention this week.',
      note: 'The email is another Interaction, involving Dana and Mia. The saved list is a SavedView created by Noor. It\'s a way of looking at records, kept as a record of its own.',
      ents: ['Interaction', 'SavedView', 'Agent', 'Person'],
      rels: [
        { from: 'Interaction', label: 'involves', to: 'Party', dyn: 'involves11' },
        { from: 'SavedView', label: 'created by', to: 'Party', dyn: 'createdBy' }
      ]
    },
    {
      time: '17:30', rect: [862, 352, 250, 128], min: 13,
      title: 'The audit log',
      story: 'Before heading home, Lee skims the audit log for the security review. The whole day is there: who moved the deal, who merged the code, who granted the access, who paid.',
      note: 'Each row is an AuditEvent performed by a Party, which can be a person, an agent or an organization. When agents work alongside people, this is how anyone can check what happened.',
      ents: ['AuditEvent', 'Party'],
      rels: [{ from: 'AuditEvent', label: 'performed by', to: 'Party', dyn: 'performed' }]
    },
    {
      time: '18:00', rect: [120, 10, 1560, 1420], map: true,
      title: 'The same day, as a map',
      story: 'Now take the building away and keep only what the software tracks.',
      note: 'Each kind of thing you saw is an entity type, and each arrow is a relationship. Count how many arrows end at Party.',
      ents: [], rels: [], outro: true
    }
  ];

  // Who looks like what. Most people are at their desks most of the time.
  var LOOK = {
    kai:   { hair: 'short', glasses: true, top: 'hoodie' },
    jun:   { hair: 'long', top: 'hoodie' },
    ivy:   { hair: 'bun', top: 'tee' },
    raj:   { hair: 'curly', top: 'tee', headphones: true },
    ben:   { hair: 'short', top: 'hoodie' },
    ravi:  { hair: 'short', top: 'shirt' },
    lin:   { hair: 'long', top: 'shirt', headset: true },
    tom:   { hair: 'curly', top: 'tee', headset: true },
    sol:   { hair: 'bald', glasses: true, top: 'shirt' },
    ana:   { hair: 'bun', top: 'shirt' },
    mo:    { hair: 'curly', glasses: true, top: 'tee' },
    lee:   { hair: 'bald', glasses: true, top: 'shirt' },
    zoe:   { hair: 'long', top: 'shirt' },
    pat:   { hair: 'short', top: 'shirt' },
    tess:  { hair: 'long', top: 'shirt', headset: true },
    ola:   { hair: 'bun', top: 'tee' },
    mia:   { hair: 'bun', top: 'tee', headset: true },
    noor:  { hair: 'curly', top: 'shirt' },
    sam:   { hair: 'short', top: 'tee', cap: true },
    priya: { hair: 'long', glasses: true, top: 'shirt' },
    jo:    { hair: 'short', top: 'shirt' },
    dana:  { hair: 'long', top: 'shirt' },
    kim:   { hair: 'short', glasses: true, top: 'shirt' },
    rider: { hair: 'cap', top: 'tee' },
    g1: { hair: 'curly', top: 'shirt' }, g2: { hair: 'short', top: 'tee' }, g3: { hair: 'long', top: 'hoodie' },
    g4: { hair: 'bun', glasses: true, top: 'shirt' }, g5: { hair: 'bald', top: 'tee' }
  };
  var STANDUP = { kai: 1, jun: 1, ivy: 1, ana: 1 };
  var LUNCH = { kai: 1, jun: 1, ravi: 1, lin: 1, mia: 1 };

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
    '.eos-kicker b{color:var(--eos-ink);font-weight:700;font-variant-numeric:tabular-nums}',
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
  var OK = '#27AE60', RUN = '#E6A100', BAD = '#D64541', MERGED = '#8E44AD', GREY = '#8a8a8a';

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
  function hours(hhmm) { var p = hhmm.split(':'); return +p[0] + p[1] / 60; }
  // deterministic wobble for charts and blinking lights
  function noise(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

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
    el('h3', null, model).textContent = 'In the model';
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
      d.setAttribute('aria-label', 'Stop ' + (i + 1) + ', ' + s.time + ': ' + s.title);
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
    var sunH = hours(TOUR[step].time);
    var vw = 1, vh = 1, dpr = 1, insetL = 0, insetB = 0;
    var cam = { x: W / 2, y: H / 2, s: 0.4 };
    var free = false;          // user has taken over the camera
    var hoverRoom = null;
    var focusK = 0;            // 0..1 fade-in for this stop's tags and arrows
    var visible = true;
    var P = { paper: '#fbfaf6', ink: '#1c1c1c', soft: 'rgba(28,28,28,.07)', faint: 'rgba(28,28,28,.17)', mid: 'rgba(28,28,28,.45)', dark: false };
    var px = 1;                // one screen pixel in world units
    var MAX_ZOOM = 3;
    var DYN = {};              // arrow endpoints that follow moving things
    var TAGS = [];             // entity tags collected while drawing a frame
    var PACKETS = [];          // story packets collected while drawing a frame
    var cloudFlash = {};       // which cloud apps a packet is passing through

    function stepDuration(i) {
      var s = TOUR[i];
      var words = (s.title + ' ' + s.story + ' ' + s.note).split(/\s+/).length;
      return Math.max(s.min || 0, 11, words / 3.4 + 3);
    }

    // story helpers
    function at(i) { return step === i; }
    function seg(a, b) { return clamp((ct - a) / (b - a), 0, 1); }
    function here(who) {
      if (at(4) && STANDUP[who]) return false;
      if (at(6) && LUNCH[who]) return false;
      if (at(1) && who === 'ravi') return false;
      return true;
    }

    // ---- caption card --------------------------------------------------------
    function renderCard() {
      var s = TOUR[step];
      kStep.textContent = (step + 1) + ' / ' + TOUR.length + ' · ';
      el('b', null, kStep).textContent = s.time;
      title.textContent = s.title;
      body.textContent = s.story;
      note.textContent = s.outro
        ? s.note + ' ' + Object.keys(ENTITIES).length + ' entity types, ' + RELATIONS.length + ' relationships.'
        : s.note;

      chips.textContent = '';
      s.ents.forEach(function (name) {
        var e = ENTITIES[name];
        var c = el('span', 'eos-chip', chips);
        el('i', null, c).style.background = e.color;
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
      ct = reduced ? 40 : 0;   // under reduced motion, show each stop's end state
      DYN = {};
      free = false;
      focusK = 0;
      if (manual && reduced) playing = false;
      renderCard();
      if (reduced) { sunH = hours(TOUR[step].time); snapCamera(); }
    }

    // ---- camera --------------------------------------------------------------
    function currentRect() {
      var s = TOUR[step];
      if (!s.shots) return s.rect;
      var r = s.shots[0][1];
      s.shots.forEach(function (sh) { if (ct >= sh[0]) r = sh[1]; });
      return r;
    }
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
      var f = fit(currentRect());
      if (!reduced && !free) {
        var d = 1 + 0.02 * Math.sin(t * 0.21);
        f.s *= d;
        f.x += Math.sin(t * 0.13) * 6 / d;
        f.y += Math.cos(t * 0.17) * 4 / d;
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

    function lw(b) { ctx.lineWidth = Math.max(b, 0.7 * px); }
    function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    function box(x, y, w, h, fill) {
      if (fill !== false) { ctx.fillStyle = fill || P.paper; ctx.fillRect(x, y, w, h); }
      ctx.strokeRect(x, y, w, h);
    }
    function fillRect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
    function rbox(x, y, w, h, r, fill, stroke) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke !== false) ctx.stroke();
    }
    function circle(x, y, r, fill) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      if (fill !== false) { ctx.fillStyle = fill || P.paper; ctx.fill(); }
      ctx.stroke();
    }
    function dot(x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    function poly(pts, fill) {
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
      for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      if (fill !== false) { ctx.fillStyle = fill || P.paper; ctx.fill(); }
      ctx.stroke();
    }
    function text(s, x, y, size, align, weight, font, color) {
      ctx.font = (weight || 600) + ' ' + size + 'px ' + (font || FONT);
      ctx.textAlign = align || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color || P.ink;
      ctx.fillText(s, x, y);
    }
    function textW(s, size, weight, font) {
      ctx.font = (weight || 600) + ' ' + size + 'px ' + (font || FONT);
      return ctx.measureText(s).width;
    }
    function fitText(s, maxW, size, weight, font) {
      if (textW(s, size, weight, font) <= maxW) return s;
      while (s.length > 1 && textW(s + '…', size, weight, font) > maxW) s = s.slice(0, -1);
      return s + '…';
    }
    function hatch(x, y, w, h, gap, width) {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.beginPath();
      for (var i = -h; i < w; i += gap) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); }
      lw(width || 0.7); ctx.stroke();
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
      line(cx - w / 2 + 8, ceil, cx - w / 2 + 8, ceil + 8);
      line(cx + w / 2 - 8, ceil, cx + w / 2 - 8, ceil + 8);
      sign(cx, ceil + 8, label, 10);
    }
    // linear office light with a soft cone
    function light(x, ceil) {
      lw(1);
      line(x - 12, ceil, x - 12, ceil + 6); line(x + 12, ceil, x + 12, ceil + 6);
      box(x - 20, ceil + 6, 40, 4);
      ctx.save();
      ctx.globalAlpha = P.dark ? 0.08 : 0.04;
      ctx.fillStyle = P.dark ? '#fff3c4' : P.ink;
      ctx.beginPath();
      ctx.moveTo(x - 20, ceil + 10); ctx.lineTo(x + 20, ceil + 10);
      ctx.lineTo(x + 52, ceil + 96); ctx.lineTo(x - 52, ceil + 96);
      ctx.fill();
      ctx.restore();
    }
    // a window looking out at the city
    function cityWindow(x, y, w, h) {
      lw(1.3);
      box(x, y, w, h);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      lw(0.8);
      var bx = x - 6;
      for (var i = 0; bx < x + w; i++) {
        var bw = 14 + noise(i + x) * 18, bh = h * (0.25 + noise(i * 3 + x) * 0.5);
        box(bx, y + h - bh, bw, bh + 1, false);
        for (var r = y + h - bh + 5; r < y + h - 3; r += 6) for (var c = bx + 3; c < bx + bw - 3; c += 5) fillRect(c, r, 2, 2, P.faint);
        bx += bw + 2;
      }
      ctx.restore();
      lw(1.3);
      line(x + w / 2, y, x + w / 2, y + h);
    }
    function plant(x, floor, big) {
      var k = big ? 1.4 : 1;
      lw(1.1);
      poly([x - 7 * k, floor - 14 * k, x + 7 * k, floor - 14 * k, x + 5 * k, floor, x - 5 * k, floor]);
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x, floor - 14 * k);
        ctx.quadraticCurveTo(x + i * 6 * k, floor - 30 * k, x + i * 9 * k, (floor - 34 * k) + Math.abs(i) * 4 * k);
        ctx.stroke();
      }
    }
    function mug(x, y, steam) {
      lw(1);
      box(x - 3.5, y - 7, 7, 7);
      ctx.beginPath(); ctx.arc(x + 4.5, y - 3.5, 2.2, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      if (!steam) return;
      ctx.save();
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
    function bubble(x, y, s, color, size) {
      size = size || 6.5;
      var w = textW(s, size, 700) + 10, h = size + 7;
      lw(1);
      rbox(x - w / 2, y - h / 2, w, h, 3, P.paper);
      poly([x - 3, y + h / 2, x, y + h / 2 + 4, x + 3, y + h / 2]);
      fillRect(x - 3, y + h / 2 - 1, 6, 1.5, P.paper);
      if (color) fillRect(x - w / 2 + 1.5, y - h / 2 + 1.5, 2.5, h - 3, color);
      text(s, x + 1, y + 0.5, size, 'center', 700);
    }

    // A person, feet at (x, y). o: look + { walk, seated, arm, flip, badge, s, prop }
    function person(x, y, o) {
      o = o || {};
      var s = (o.s || 1) * 1.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(o.flip ? -s : s, s);
      lw(1.3);
      ctx.lineCap = 'round';
      var headY, shY, hipY;
      if (o.seated) {
        hipY = -17; shY = -35; headY = -42;
        line(-1, hipY, 11, hipY); line(11, hipY, 11, -1); line(11, -1, 14, -1);
        line(1, hipY + 1.5, 13, hipY + 1.5); line(13, hipY + 1.5, 13.5, -1);
      } else {
        hipY = -18; shY = -37; headY = -44;
        var sw = o.walk == null ? 0 : Math.sin(o.walk) * 5;
        line(-2.5, hipY, -2.5 + sw, -1); line(2.5, hipY, 2.5 - sw, -1);
        line(-2.5 + sw, -1, 0.5 + sw, -1); line(2.5 - sw, -1, 5.5 - sw, -1);
      }
      // torso
      ctx.beginPath();
      ctx.moveTo(-6, shY + 3); ctx.quadraticCurveTo(-6, shY, -3.5, shY);
      ctx.lineTo(3.5, shY); ctx.quadraticCurveTo(6, shY, 6, shY + 3);
      ctx.lineTo(5.5, hipY); ctx.lineTo(-5.5, hipY); ctx.closePath();
      ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();
      lw(0.8);
      if (o.top === 'hoodie') { line(-3, hipY - 5, 3, hipY - 5); line(-1.5, shY + 1, -1.5, shY + 6); line(1.5, shY + 1, 1.5, shY + 6); }
      else if (o.top === 'shirt') { line(-2.5, shY, 0, shY + 4); line(0, shY + 4, 2.5, shY); line(0, shY + 4, 0, hipY); }
      else { line(-5.8, shY + 6, -3.5, shY + 6); line(5.8, shY + 6, 3.5, shY + 6); }
      lw(1.3);
      // arms
      var sy = shY + 2, arm = o.arm || 'down';
      if (arm === 'down') { line(-6, sy, -8, sy + 15); line(6, sy, 8, sy + 15); }
      else if (arm === 'up') { line(-6, sy, -8, sy + 15); line(6, sy, 12, sy - 11); }
      else if (arm === 'point') { line(-6, sy, -8, sy + 15); line(6, sy, 16, sy - 6); }
      else if (arm === 'forward') { line(-6, sy, -8, sy + 15); line(6, sy, 16, sy + 5); }
      else if (arm === 'type') {
        var j = Math.sin(t * 14 + x) * 1.2;
        line(5, sy + 1, 14, sy + 10 + j); line(-3, sy + 1, 10, sy + 11 - j);
      } else if (arm === 'phone') { line(-6, sy, -8, sy + 15); line(6, sy, 9, sy + 7); line(9, sy + 7, 5, sy - 5); }
      else if (arm === 'hold') { line(-6, sy, -8, sy + 15); line(6, sy, 13, sy + 9); line(13, sy + 9, 17, sy + 4); }
      else if (arm === 'cheer') { line(-6, sy, -11, sy - 11); line(6, sy, 11, sy - 11); }
      else if (arm === 'paddle') { line(-6, sy, -8, sy + 15); var a = Math.sin(t * 5 + x) * 0.6; line(6, sy, 6 + Math.cos(a) * 11, sy + 3 + Math.sin(a) * 6); }
      else if (arm === 'eat') { line(-6, sy, -8, sy + 15); var e = mod(t * 0.8 + x, 2) < 1; line(6, sy, 13, sy + (e ? -3 : 8)); }
      if (o.prop === 'mug') mug(14, sy + 4, true);
      if (o.prop === 'box') { lw(1.1); box(6, sy + 2, 14, 11); }
      // head and hair
      lw(1.3);
      circle(0, headY, 5.5);
      ctx.fillStyle = P.ink;
      var hair = o.hair || 'short';
      if (hair !== 'bald') { ctx.beginPath(); ctx.arc(0, headY, 5.6, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); }
      if (hair === 'long') { ctx.fillRect(-6.1, headY - 1, 2.2, 9); ctx.fillRect(3.9, headY - 1, 2.2, 9); }
      if (hair === 'bun') { ctx.beginPath(); ctx.arc(-1, headY - 6.5, 2.6, 0, TAU); ctx.fill(); }
      if (hair === 'curly') for (var c = 0; c < 6; c++) { var ca = Math.PI * (1.02 + c * 0.19); ctx.beginPath(); ctx.arc(Math.cos(ca) * 5.4, headY + Math.sin(ca) * 5.4, 2, 0, TAU); ctx.fill(); }
      if (hair === 'cap' || o.cap) { ctx.fillRect(-6, headY - 4.5, 12, 2.2); ctx.fillRect(4, headY - 3.5, 5, 1.6); }
      if (o.glasses) { lw(0.8); circle(-2.2, headY + 0.5, 1.6, false); circle(2.6, headY + 0.5, 1.6, false); line(-0.6, headY + 0.5, 1, headY + 0.5); }
      if (o.headset) { lw(1); ctx.beginPath(); ctx.arc(0, headY, 7.3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); line(6.4, headY - 1, 7, headY + 4); line(7, headY + 4, 3, headY + 5); }
      if (o.headphones) { lw(1.2); ctx.beginPath(); ctx.arc(0, headY, 7.3, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); fillRect(-8, headY - 2, 3, 5, P.ink); fillRect(5, headY - 2, 3, 5, P.ink); }
      if (o.badge) { fillRect(1.5, sy + 4, 4.5, 4.5, o.badge); lw(0.5); ctx.strokeRect(1.5, sy + 4, 4.5, 4.5); }
      ctx.restore();
    }
    function look(name, extra) {
      var o = {}, k, base = LOOK[name] || {};
      for (k in base) o[k] = base[k];
      for (k in extra) o[k] = extra[k];
      return o;
    }

    // ---- furniture -------------------------------------------------------------
    function desk(x, w, floor, top) {
      top = top || DESK;
      lw(1.3);
      box(x, floor - top, w, 4);
      line(x + 4, floor - top + 4, x + 4, floor); line(x + w - 4, floor - top + 4, x + w - 4, floor);
      box(x + w - 34, floor - top + 4, 28, 14, false);
    }
    function chair(x, floor, flip) {
      var d = flip ? -1 : 1;
      lw(1.2);
      line(x - 8 * d, floor - 19, x + 5 * d, floor - 19);
      line(x - 8 * d, floor - 19, x - 10 * d, floor - 42);
      line(x - 1 * d, floor - 19, x - 1 * d, floor - 6);
      line(x - 9, floor - 5, x + 7, floor - 5);
      circle(x - 9, floor - 2.5, 2, false); circle(x + 7, floor - 2.5, 2, false);
    }
    // a monitor; content drawn by fn(x, y, w, h) inside the bezel
    function monitor(r, fn, stand) {
      var x = r[0] - 2, y = r[1] - 2, w = r[2] + 4, h = r[3] + 4;
      lw(1.6);
      rbox(x, y, w, h, 1.5, P.paper);
      if (stand !== false) {
        lw(1.3);
        line(x + w / 2, y + h, x + w / 2, y + h + 5);
        line(x + w / 2 - 8, y + h + 5, x + w / 2 + 8, y + h + 5);
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(r[0], r[1], r[2], r[3]); ctx.clip();
      if (fn) fn(r[0], r[1], r[2], r[3]);
      ctx.restore();
      ctx.strokeStyle = P.ink;
    }
    function tv(r, fn) {
      lw(2.2);
      rbox(r[0] - 3, r[1] - 3, r[2] + 6, r[3] + 6, 2, P.paper);
      lw(1); line(r[0] + r[2] / 2 - 10, r[1] - 3, r[0] + r[2] / 2 - 10, r[1] - 9); line(r[0] + r[2] / 2 + 10, r[1] - 3, r[0] + r[2] / 2 + 10, r[1] - 9);
      monitor(r, fn, false);
    }
    // a desk with screens; `who` sits on the left, facing them
    function workstation(x, floor, screens, who, o) {
      o = o || {};
      var top = o.standing ? 46 : DESK;
      var last = screens[screens.length - 1].r;
      var w = last[0] + last[2] + 10 - x;
      if (!o.standing) chair(x + 12, floor);
      if (who) {
        if (o.standing) person(x - 12, floor, look(who, { arm: o.arm || 'type' }));
        else person(x + 12, floor, look(who, { seated: true, arm: o.arm || 'type' }));
      }
      desk(x, w, floor, top);
      screens.forEach(function (sc) { monitor(sc.r, sc.fn); });
      lw(1); box(x + 26, floor - top - 4, 30, 3, false);
      if (o.mug) mug(x + w - 10, floor - top, false);
    }

    // =========================================================================
    // Screen UIs: what people are actually looking at
    // =========================================================================

    function uiBar(x, y, w, label, u, right) {
      fillRect(x, y, w, 6.5 * u, P.soft);
      text(fitText(label, w - (right ? 22 : 8) * u, 3.8 * u, 800), x + 3 * u, y + 3.4 * u, 3.8 * u, 'left', 800);
      if (right) text(right, x + w - 3 * u, y + 3.4 * u, 3.4 * u, 'right', 700, null, P.mid);
    }
    function avatar(x, y, r, kind, letter) {
      lw(Math.max(0.5, r * 0.25));
      if (kind === 'r') {
        rbox(x - r, y - r, 2 * r, 2 * r, r * 0.35, hexA(ENTITIES.Agent.color, 0.25));
        fillRect(x - r * 0.55, y - r * 0.2, r * 0.35, r * 0.35, ENTITIES.Agent.color);
        fillRect(x + r * 0.2, y - r * 0.2, r * 0.35, r * 0.35, ENTITIES.Agent.color);
      } else if (kind === 'o') {
        box(x - r, y - r * 0.7, 2 * r, r * 1.7, hexA(ENTITIES.Organization.color, 0.2));
      } else {
        circle(x, y, r, hexA(ENTITIES.Person.color, 0.18));
        if (letter) text(letter, x, y + r * 0.08, r * 1.15, 'center', 800);
      }
    }
    function icon(x, y, r, state) {
      lw(Math.max(0.5, r * 0.35));
      if (state === 'ok') {
        dot(x, y, r, hexA(OK, 0.2));
        ctx.strokeStyle = OK;
        ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x - r * 0.1, y + r * 0.45); ctx.lineTo(x + r * 0.55, y - r * 0.4); ctx.stroke();
      } else if (state === 'run') {
        ctx.strokeStyle = RUN;
        ctx.beginPath(); ctx.arc(x, y, r * 0.75, t * 6, t * 6 + 4.2); ctx.stroke();
      } else if (state === 'fail') {
        dot(x, y, r, hexA(BAD, 0.2));
        ctx.strokeStyle = BAD; line(x - r * 0.4, y - r * 0.4, x + r * 0.4, y + r * 0.4); line(x + r * 0.4, y - r * 0.4, x - r * 0.4, y + r * 0.4);
      } else if (state === 'lock') {
        ctx.strokeStyle = GREY; box(x - r * 0.6, y - r * 0.1, r * 1.2, r * 0.9, false);
        ctx.beginPath(); ctx.arc(x, y - r * 0.1, r * 0.4, Math.PI, 0); ctx.stroke();
      } else {
        ctx.strokeStyle = GREY; circle(x, y, r * 0.7, false);
      }
      ctx.strokeStyle = P.ink;
    }
    function chip(x, y, label, color, u, solid) {
      var s = 3.3 * u, w = textW(label, s, 800) + 4 * u, h = 5.2 * u;
      ctx.strokeStyle = color;
      lw(0.6 * u);
      rbox(x, y - h / 2, w, h, h / 2, solid ? color : hexA(color, 0.15));
      text(label, x + w / 2, y + 0.2 * u, s, 'center', 800, null, solid ? '#fff' : (P.dark ? P.ink : color));
      ctx.strokeStyle = P.ink;
      return w;
    }
    function textLines(x, y, w, n, gap, u, seed) {
      lw(0.9 * u);
      ctx.strokeStyle = P.faint;
      for (var i = 0; i < n; i++) line(x, y + i * gap, x + w * (0.45 + noise(seed + i) * 0.55), y + i * gap);
      ctx.strokeStyle = P.ink;
    }

    var CODE = [
      [0, 'export async function', 'samlCallback(req) {'],
      [1, 'const assertion =', 'await idp.verify(req.body)'],
      [1, 'if (!assertion.valid)', 'throw new AuthError()'],
      [1, 'const user =', 'await users.findOrCreate({'],
      [2, 'email:', 'assertion.email,'],
      [2, 'org:', 'assertion.orgId })'],
      [1, 'audit.log(', '"sso.login", user)'],
      [1, 'return', 'session.start(user)'],
      [0, '}', '']
    ];
    function uiCode(x, y, w, h, o) {
      o = o || {};
      var u = h / 48;
      uiBar(x, y, w, o.file || 'auth/saml.ts', u, o.branch);
      var lines = o.lines || CODE, lh = (h - 9 * u) / lines.length;
      var shown = o.typed == null ? lines.length : Math.max(1, Math.ceil(o.typed * lines.length));
      for (var i = 0; i < shown; i++) {
        var L = lines[i], ly = y + 8.5 * u + i * lh + lh / 2;
        if (o.diff && i >= 3 && i <= 6) {
          fillRect(x, ly - lh / 2, w, lh, hexA(OK, 0.13));
          text('+', x + 7.5 * u, ly, 3.4 * u, 'left', 800, MONO, OK);
        }
        text(String(i + 41), x + 1.5 * u, ly, 2.8 * u, 'left', 600, MONO, P.mid);
        var lx = x + 11 * u + L[0] * 4 * u;
        text(L[1], lx, ly, 3.2 * u, 'left', 700, MONO, ENTITIES.Agent.color);
        text(L[2], lx + textW(L[1] + ' ', 3.2 * u, 700, MONO), ly, 3.2 * u, 'left', 500, MONO);
      }
      if (o.typed != null && o.typed < 1 && Math.sin(t * 8) > 0) {
        var cy = y + 8.5 * u + (shown - 1) * lh;
        fillRect(x + w * 0.6, cy + lh * 0.2, 1 * u, lh * 0.6, P.ink);
      }
      if (o.comment) {
        var bx = x + w * 0.4, by = y + 8.5 * u + 2.5 * lh, bw = w * 0.58;
        lw(0.7 * u);
        ctx.strokeStyle = RUN;
        rbox(bx, by, bw, 9 * u, 1.5 * u, P.paper);
        ctx.strokeStyle = P.ink;
        avatar(bx + 4 * u, by + 4.5 * u, 2.4 * u, 'p', 'K');
        text(fitText(o.comment, bw - 9 * u, 3 * u, 600), bx + 8 * u, by + 4.6 * u, 3 * u, 'left', 600);
      }
    }
    function uiTerminal(x, y, w, h) {
      var u = h / 48;
      fillRect(x, y, w, h, '#232323');
      var rows = [['$ npm test', '#ddd'], ['✓ 214 passed · 12.4s', '#6fdc8c'], ['$ git push origin plt-198', '#ddd'], ['→ CI started', '#f0c35a'], ['$', '#ddd']];
      rows.forEach(function (r, i) { text(r[0], x + 3 * u, y + 7 * u + i * 8 * u, 3.3 * u, 'left', 600, MONO, r[1]); });
      if (Math.sin(t * 8) > 0) fillRect(x + 7 * u, y + 37 * u - 2 * u, 2 * u, 4 * u, '#ddd');
    }
    function uiChat(x, y, w, h, o) {
      var u = h / 48;
      var sw = w * 0.27;
      fillRect(x, y, sw, h, P.soft);
      var chans = o.channels || ['eng-platform', 'product', 'deals', 'wins', 'support'];
      chans.forEach(function (c, i) {
        var cy = y + 6 * u + i * 6.5 * u;
        if (c === o.channel) fillRect(x, cy - 3 * u, sw, 6 * u, P.faint);
        text(fitText('# ' + c, sw - 3 * u, 3 * u, 700), x + 2 * u, cy, 3 * u, 'left', c === o.channel ? 800 : 600);
      });
      var mx = x + sw + 3 * u;
      uiBar(x + sw, y, w - sw, '# ' + o.channel, u);
      var msgs = o.msgs || [];
      var rowH = 12 * u, by = y + h - 2 * u;
      for (var i = msgs.length - 1, n = 0; i >= 0 && n < 3; i--, n++) {
        var m = msgs[i], my = by - (n + 1) * rowH;
        if (m.hot) fillRect(x + sw, my - 0.5 * u, w - sw, rowH, hexA(m.hot, 0.14));
        avatar(mx + 2.6 * u, my + 3.5 * u, 2.6 * u, m.k || 'p', m.n[0]);
        text(m.n, mx + 7 * u, my + 2.6 * u, 3.1 * u, 'left', 800);
        text(fitText(m.s, w - sw - 11 * u, 3 * u, 500), mx + 7 * u, my + 7.2 * u, 3 * u, 'left', 500);
        m.box = [x + sw, my - 0.5 * u, w - sw, rowH];
      }
    }
    function uiBoard(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, o.title, u, o.right);
      var cols = o.cols, cw = w / cols.length;
      cols.forEach(function (c, i) {
        text(fitText(c, cw - 3 * u, 2.9 * u, 800), x + i * cw + 2 * u, y + 10 * u, 2.9 * u, 'left', 800, null, P.mid);
        if (i) { lw(0.5 * u); ctx.strokeStyle = P.faint; line(x + i * cw, y + 7.5 * u, x + i * cw, y + h); ctx.strokeStyle = P.ink; }
      });
      var ch = (o.cardH || 7.6) * u, pitch = (o.pitch || 8.8) * u, top = y + 13 * u;
      (o.cards || []).forEach(function (c) {
        var cx = x + c.c * cw + 1.5 * u + (c.indent ? 3 * u : 0), cy = top + c.r * pitch;
        var cwid = cw - 3 * u - (c.indent ? 3 * u : 0);
        var col = c.color || ENTITIES.Task.color;
        lw(c.hot ? 0.9 * u : 0.5 * u);
        if (c.hot) ctx.strokeStyle = col;
        rbox(cx, cy, cwid, ch, 1 * u, c.hot ? hexA(col, 0.15) : P.paper);
        ctx.strokeStyle = P.ink;
        text(c.key, cx + 1.6 * u, cy + ch * 0.3, 2.7 * u, 'left', 800, null, P.mid);
        text(fitText(c.s, cwid - (c.who ? 8 : 3) * u, 2.9 * u, 600), cx + 1.6 * u, cy + ch * 0.72, 2.9 * u, 'left', 600);
        if (c.who) avatar(cx + cwid - 3.2 * u, cy + ch / 2, 2.3 * u, c.who[0], c.who[1]);
        c.box = [cx, cy, cwid, ch];
      });
    }
    function uiPR(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, '#482 Add SAML callback · SSO-13', u);
      var state = o.merged ? ['Merged', MERGED] : ['Open', OK];
      var cw = chip(x + 2 * u, y + 11 * u, state[0], state[1], u, true);
      avatar(x + cw + 6 * u, y + 11 * u, 2.5 * u, 'r');
      text('agent-7 wants to merge 3 commits', x + cw + 10 * u, y + 11 * u, 3 * u, 'left', 600);
      o.authorAt = [x + cw + 6 * u, y + 11 * u];
      (o.checks || []).forEach(function (c, i) {
        var cy = y + 18 * u + i * 5.4 * u;
        icon(x + 4 * u, cy, 2 * u, c[1]);
        text(c[0], x + 8 * u, cy, 3.1 * u, 'left', 600);
        text(c[1] === 'ok' ? 'passed' : c[1] === 'run' ? 'running…' : c[1] === 'fail' ? 'failed' : 'queued', x + w * 0.5, cy, 2.9 * u, 'left', 600, null, P.mid);
      });
      var ry = y + h - 6.5 * u;
      avatar(x + 4 * u, ry, 2.5 * u, 'p', 'K');
      var rv = o.review === 'approved' ? ['Kai approved', OK] : o.review === 'comment' ? ['Kai commented', RUN] : ['Review requested', null];
      text(rv[0], x + 8 * u, ry, 3.1 * u, 'left', 700, null, rv[1] || P.mid);
      var btn = o.merged ? ['Merged', MERGED] : ['Merge', OK];
      var bw = textW(btn[0], 3.4 * u, 800) + 6 * u, on = o.mergeable || o.merged;
      ctx.strokeStyle = on ? btn[1] : GREY; lw(0.6 * u);
      rbox(x + w - bw - 2 * u, ry - 3.4 * u, bw, 6.8 * u, 1.2 * u, on ? btn[1] : P.paper);
      text(btn[0], x + w - bw / 2 - 2 * u, ry, 3.4 * u, 'center', 800, null, on ? '#fff' : P.mid);
      ctx.strokeStyle = P.ink;
    }
    function uiPipeline(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, o.title || 'deploy · main', u, o.right);
      var st = o.stages, n = st.length, bw = (w - 6 * u) / n - 3 * u;
      st.forEach(function (s, i) {
        var bx = x + 3 * u + i * (bw + 3 * u), by = y + 14 * u, bh = 14 * u;
        var col = s[1] === 'ok' ? OK : s[1] === 'run' ? RUN : s[1] === 'fail' ? BAD : GREY;
        ctx.strokeStyle = col; lw(0.8 * u);
        rbox(bx, by, bw, bh, 1.5 * u, s[1] === 'ok' ? hexA(OK, 0.12) : P.paper);
        ctx.strokeStyle = P.ink;
        icon(bx + bw / 2, by + bh * 0.36, 2.4 * u, s[1]);
        text(fitText(s[0], bw - 1 * u, 2.8 * u, 700), bx + bw / 2, by + bh * 0.78, 2.8 * u, 'center', 700);
        if (i < n - 1) { lw(0.7 * u); line(bx + bw, by + bh / 2, bx + bw + 3 * u, by + bh / 2); }
      });
      if (o.footer) text(fitText(o.footer, w - 6 * u, 3.1 * u, 600), x + 3 * u, y + h - 8 * u, 3.1 * u, 'left', 600, null, P.mid);
    }
    function uiGraph(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, o.title, u, o.value);
      var gx = x + 3 * u, gy = y + 10 * u, gw = w - 6 * u, gh = h - 14 * u;
      lw(0.4 * u); ctx.strokeStyle = P.faint;
      for (var i = 1; i < 4; i++) line(gx, gy + gh * i / 4, gx + gw, gy + gh * i / 4);
      if (o.limit) { ctx.strokeStyle = BAD; ctx.setLineDash([2 * u, 2 * u]); line(gx, gy + gh * 0.25, gx + gw, gy + gh * 0.25); ctx.setLineDash([]); }
      ctx.strokeStyle = o.color || P.ink; lw(0.9 * u);
      ctx.beginPath();
      var N = 28, shift = Math.floor(t * (o.speed || 2));
      for (var k = 0; k <= N; k++) {
        var v = 0.5 + (noise(k + shift + (o.seed || 0)) - 0.5) * 0.5 + (o.trend || 0) * k / N;
        ctx.lineTo(gx + gw * k / N, gy + gh * (1 - clamp(v, 0.05, 0.95)));
      }
      ctx.stroke();
      ctx.strokeStyle = P.ink;
    }
    function uiCRM(x, y, w, h, o) {
      var u = h / 52;
      var pw = o.panel ? w * 0.34 : 0, bw = w - pw;
      uiBar(x, y, w, 'CRM · Pipeline Q4', u, '$1.4M');
      var cols = ['LEAD', 'DEMO', 'PROPOSAL', 'WON'], cw = bw / 4;
      cols.forEach(function (c, i) {
        text(c, x + i * cw + 1.5 * u, y + 10.5 * u, 2.6 * u, 'left', 800, null, i === 3 ? OK : P.mid);
        if (i) { lw(0.5 * u); ctx.strokeStyle = P.faint; line(x + i * cw, y + 8 * u, x + i * cw, y + h); ctx.strokeStyle = P.ink; }
      });
      (o.deals || []).forEach(function (d) {
        var cx = x + d.c * cw + 1.2 * u, cy = y + 14 * u + d.r * 12 * u, cwid = cw - 2.4 * u;
        lw(d.hot ? 0.9 * u : 0.5 * u);
        if (d.hot) ctx.strokeStyle = ENTITIES.Deal.color;
        rbox(cx, cy, cwid, 10 * u, 1 * u, d.hot ? hexA(ENTITIES.Deal.color, 0.18) : P.paper);
        ctx.strokeStyle = P.ink;
        text(fitText(d.n, cwid - 2 * u, 3 * u, 800), cx + 1.5 * u, cy + 3.2 * u, 3 * u, 'left', 800);
        text(fitText(d.amt, cwid - 2 * u, 2.6 * u, 600), cx + 1.5 * u, cy + 7.2 * u, 2.6 * u, 'left', 600, null, P.mid);
        d.box = [cx, cy, cwid, 10 * u];
      });
      if (o.panel) {
        var p = o.panel, p0 = x + bw;
        fillRect(p0, y + 6.5 * u, pw, h - 6.5 * u, P.soft);
        text('CONTACT', p0 + 2 * u, y + 11 * u, 2.6 * u, 'left', 800, null, P.mid);
        avatar(p0 + 4.5 * u, y + 17.5 * u, 3 * u, 'p', 'D');
        text('Dana O.', p0 + 9 * u, y + 16 * u, 3.1 * u, 'left', 800);
        text('Globex', p0 + 9 * u, y + 20 * u, 2.7 * u, 'left', 600, null, P.mid);
        text('ROLE', p0 + 2 * u, y + 27 * u, 2.6 * u, 'left', 800, null, P.mid);
        chip(p0 + 2 * u, y + 32 * u, p.role, ENTITIES.Role.color, u, p.role === 'Customer');
        text('NEXT', p0 + 2 * u, y + 39 * u, 2.6 * u, 'left', 800, null, P.mid);
        text(fitText(p.next, pw - 3 * u, 2.7 * u, 600), p0 + 2 * u, y + 44 * u, 2.7 * u, 'left', 600);
        o.panelAt = { contact: [p0 + 4.5 * u, y + 17.5 * u], role: [p0 + 4 * u, y + 32 * u], x: p0, w: pw };
      }
    }
    // a head-and-shoulders tile for video calls
    function face(x, y, w, h, who, speaking, label, u) {
      fillRect(x, y, w, h, P.soft);
      var lk = LOOK[who] || {};
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      var cx = x + w / 2, cy = y + h * 0.46, r = h * 0.19;
      lw(0.9 * u);
      ctx.beginPath(); ctx.arc(cx, y + h + r * 0.8, r * 2.2, Math.PI, 0); ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();
      circle(cx, cy, r);
      ctx.fillStyle = P.ink;
      if (lk.hair !== 'bald') { ctx.beginPath(); ctx.arc(cx, cy, r * 1.02, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); }
      if (lk.hair === 'long') { ctx.fillRect(cx - r * 1.1, cy - r * 0.2, r * 0.4, r * 1.6); ctx.fillRect(cx + r * 0.7, cy - r * 0.2, r * 0.4, r * 1.6); }
      if (lk.glasses) { lw(0.6 * u); circle(cx - r * 0.4, cy + r * 0.1, r * 0.28, false); circle(cx + r * 0.4, cy + r * 0.1, r * 0.28, false); }
      if (speaking) { var m = Math.abs(Math.sin(t * 9)) * r * 0.18; fillRect(cx - r * 0.25, cy + r * 0.45, r * 0.5, 0.6 * u + m, P.ink); }
      ctx.restore();
      if (speaking) { ctx.strokeStyle = OK; lw(1 * u); ctx.strokeRect(x + 0.5 * u, y + 0.5 * u, w - u, h - u); ctx.strokeStyle = P.ink; }
      fillRect(x + 1 * u, y + h - 5.5 * u, textW(label, 2.8 * u, 700) + 3 * u, 4.5 * u, 'rgba(0,0,0,.55)');
      text(label, x + 2.5 * u, y + h - 3.2 * u, 2.8 * u, 'left', 700, null, '#fff');
    }
    function uiCall(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, o.title || 'Video call', u, o.right);
      var tiles = o.tiles, cols = tiles.length > 2 ? 2 : tiles.length, rows = Math.ceil(tiles.length / cols);
      var tw = (w - 3 * u) / cols - 1 * u, th = (h - 15 * u) / rows - 1 * u;
      tiles.forEach(function (tl, i) {
        var tx = x + 1.5 * u + (i % cols) * (tw + 1 * u), ty = y + 7.5 * u + Math.floor(i / cols) * (th + 1 * u);
        if (tl.share) {
          fillRect(tx, ty, tw, th, P.soft);
          text(tl.share, tx + 2 * u, ty + 4 * u, 2.8 * u, 'left', 800);
          textLines(tx + 2 * u, ty + 8 * u, tw * 0.6, 2, 3 * u, u, 3);
          lw(0.6 * u); rbox(tx + 2 * u, ty + th - 8 * u, tw * 0.62, 5 * u, 1 * u, hexA(ENTITIES.Product.color, 0.25));
          text('Continue with SSO', tx + 3 * u, ty + th - 5.5 * u, 2.6 * u, 'left', 700);
        } else face(tx, ty, tw, th, tl.who, tl.speak, tl.label, u);
        tl.box = [tx, ty, tw, th];
      });
      [GREY, GREY, BAD].forEach(function (c, i) { dot(x + w / 2 - 6 * u + i * 6 * u, y + h - 4 * u, 1.8 * u, c); });
    }
    function uiDoc(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, o.file || 'Docs', u, o.right);
      text(fitText(o.title, w - 6 * u, 4.3 * u, 800), x + 3 * u, y + 12.5 * u, 4.3 * u, 'left', 800);
      var shown = o.p == null ? 1 : o.p;
      var sections = o.sections || ['Problem', 'Goals', 'Out of scope'];
      sections.forEach(function (s, i) {
        if (i / sections.length > shown) return;
        var sy = y + 20 * u + i * 9.5 * u;
        text(s, x + 3 * u, sy, 3.2 * u, 'left', 800);
        textLines(x + 3 * u, sy + 4 * u, w - 8 * u, 2, 2.6 * u, u, i * 5 + 1);
      });
    }
    function uiDesign(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, 'Design · Sign-in v2', u, '100%');
      fillRect(x, y + 6.5 * u, w * 0.14, h, P.soft);
      for (var i = 0; i < 5; i++) fillRect(x + 2 * u, y + 10 * u + i * 5 * u, w * 0.14 - 4 * u, 2 * u, P.faint);
      [0, 1].forEach(function (k) {
        var ax = x + w * 0.2 + k * w * 0.38, ay = y + 9 * u, aw = w * 0.3, ah = h - 11 * u;
        lw(0.8 * u); rbox(ax, ay, aw, ah, 2 * u, P.paper);
        text(k ? 'Your company' : 'Sign in', ax + aw / 2, ay + 5.5 * u, 3.2 * u, 'center', 800);
        lw(0.5 * u);
        if (!k) { rbox(ax + 3 * u, ay + 10 * u, aw - 6 * u, 4.5 * u, 1 * u, P.paper); rbox(ax + 3 * u, ay + 16 * u, aw - 6 * u, 4.5 * u, 1 * u, P.paper); }
        else { rbox(ax + 3 * u, ay + 10 * u, aw - 6 * u, 4.5 * u, 1 * u, P.paper); text('globex.com', ax + 4.5 * u, ay + 12.3 * u, 2.6 * u, 'left', 600, null, P.mid); }
        var hot = k === 0 && o.hot;
        ctx.strokeStyle = hot ? ENTITIES.Product.color : P.ink;
        rbox(ax + 2 * u, ay + ah - 9 * u, aw - 4 * u, 5.5 * u, 1.2 * u, hot ? hexA(ENTITIES.Product.color, 0.3) : P.soft);
        ctx.strokeStyle = P.ink;
        text(k ? 'Continue' : 'Continue with SSO', ax + aw / 2, ay + ah - 6.2 * u, 2.5 * u, 'center', 700);
      });
      var cx = x + w * 0.32 + Math.sin(t * 0.7) * w * 0.14, cy = y + h * 0.62 + Math.cos(t * 0.9) * h * 0.2;
      ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 3 * u, cy + 7 * u); ctx.lineTo(cx + 4 * u, cy + 3.5 * u); ctx.lineTo(cx + 7 * u, cy + 3 * u); ctx.closePath(); ctx.fill();
    }
    function uiTickets(x, y, w, h, o) {
      var u = h / 52;
      uiBar(x, y, w, 'Helpdesk', u, o.right);
      var sw = w * 0.3;
      fillRect(x, y + 6.5 * u, sw, h, P.soft);
      text('VIEWS', x + 2 * u, y + 11 * u, 2.6 * u, 'left', 800, null, P.mid);
      (o.views || []).forEach(function (v, i) {
        var vy = y + 16.5 * u + i * 6 * u;
        if (v.hot) { lw(0.7 * u); ctx.strokeStyle = ENTITIES.SavedView.color; rbox(x + 1 * u, vy - 2.8 * u, sw - 2 * u, 5.6 * u, 1 * u, hexA(ENTITIES.SavedView.color, 0.2)); ctx.strokeStyle = P.ink; }
        text(fitText(v.n, sw - 8 * u, 2.8 * u, v.cur ? 800 : 600), x + 2.5 * u, vy, 2.8 * u, 'left', v.cur ? 800 : 600);
        text(String(v.count), x + sw - 2 * u, vy, 2.6 * u, 'right', 700, null, P.mid);
        v.box = [x, vy - 3 * u, sw, 6 * u];
      });
      var lx = x + sw + 2 * u, lw0 = w - sw - 3 * u;
      (o.rows || []).forEach(function (r, i) {
        var ry = y + 8.5 * u + i * 8.5 * u;
        if (r.hot) fillRect(x + sw, ry - 0.5 * u, w - sw, 8 * u, hexA(ENTITIES.Interaction.color, 0.12));
        text('#' + r.id, lx, ry + 2.4 * u, 2.5 * u, 'left', 700, null, P.mid);
        text(fitText(r.s, lw0 - 14 * u, 2.9 * u, 700), lx, ry + 5.9 * u, 2.9 * u, 'left', 700);
        chip(lx + lw0 - 12 * u, ry + 3 * u, r.st, r.st === 'Solved' ? OK : r.st === 'New' ? ENTITIES.Interaction.color : GREY, u * 0.8, false);
        r.box = [x + sw, ry - 0.5 * u, w - sw, 8 * u];
      });
      if (o.draft) {
        var dy = y + h - 14 * u;
        lw(0.7 * u); ctx.strokeStyle = ENTITIES.Agent.color;
        rbox(lx - 1 * u, dy, lw0 + 1 * u, 13 * u, 1.5 * u, P.paper);
        ctx.strokeStyle = P.ink;
        avatar(lx + 2.5 * u, dy + 3.5 * u, 2.2 * u, 'r');
        text('Suggested reply · support bot', lx + 6 * u, dy + 3.5 * u, 2.6 * u, 'left', 800);
        text(fitText(o.draft, lw0 - 3 * u, 2.7 * u, 600), lx + 1 * u, dy + 9 * u, 2.7 * u, 'left', 600);
        o.draftAt = [lx + 2.5 * u, dy + 3.5 * u];
      }
    }
    function uiBilling(x, y, w, h, o) {
      var u = h / 52;
      uiBar(x, y, w, 'Billing', u, 'live');
      text('MRR', x + 3 * u, y + 11 * u, 2.6 * u, 'left', 800, null, P.mid);
      text(o.mrr, x + 3 * u, y + 17 * u, 5.4 * u, 'left', 800, null, o.bump ? OK : null);
      ctx.strokeStyle = OK; lw(0.8 * u); ctx.beginPath();
      for (var k = 0; k <= 10; k++) ctx.lineTo(x + w * 0.52 + k * w * 0.044, y + 18 * u - k * 0.8 * u - noise(k) * 2 * u - (o.bump && k === 10 ? 3 * u : 0));
      ctx.stroke(); ctx.strokeStyle = P.ink;
      (o.rows || []).forEach(function (r, i) {
        var ry = y + 24 * u + i * 7 * u;
        if (r.hot) fillRect(x, ry - 3.3 * u, w, 6.6 * u, hexA(r.hot, 0.16));
        text(r.k, x + 2 * u, ry, 2.5 * u, 'left', 800, null, P.mid);
        text(fitText(r.n, w * 0.48, 2.9 * u, 700), x + 10 * u, ry, 2.9 * u, 'left', 700);
        text(r.amt, x + w * 0.74, ry, 2.9 * u, 'right', 700);
        if (r.st) chip(x + w * 0.77, ry, r.st, r.st === 'Paid' || r.st === 'Active' ? OK : RUN, u * 0.8, r.st === 'Paid');
        r.box = [x, ry - 3.3 * u, w, 6.6 * u];
      });
    }
    function uiWorkflow(x, y, w, h, o) {
      var u = h / 52;
      uiBar(x, y, w, 'Workflow · won deal', u, o.on ? 'ON' : '');
      var steps = [['WHEN', 'Deal stage → Won'], ['THEN', 'Start subscription'], ['THEN', 'Create onboarding tasks'], ['THEN', 'Post in #wins']];
      steps.forEach(function (s, i) {
        var sy = y + 9 * u + i * 10 * u, done = (o.done || 0) > i;
        lw(done ? 0.9 * u : 0.5 * u);
        ctx.strokeStyle = done ? OK : P.ink;
        rbox(x + 3 * u, sy, w - 6 * u, 7.6 * u, 1.2 * u, done ? hexA(OK, 0.1) : P.paper);
        ctx.strokeStyle = P.ink;
        text(s[0], x + 5 * u, sy + 3.8 * u, 2.5 * u, 'left', 800, null, P.mid);
        text(fitText(s[1], w - 26 * u, 3 * u, 700), x + 14 * u, sy + 3.8 * u, 3 * u, 'left', 700);
        icon(x + w - 7 * u, sy + 3.8 * u, 2 * u, done ? 'ok' : (o.done === i && o.running ? 'run' : 'wait'));
        if (i < steps.length - 1) { lw(0.6 * u); line(x + 9 * u, sy + 7.6 * u, x + 9 * u, sy + 10 * u); }
      });
      text(o.footer || 'owner: Sam', x + 3 * u, y + h - 3.5 * u, 2.6 * u, 'left', 600, null, P.mid);
      o.stepAt = function (i) { return [x + w - 7 * u, y + 9 * u + i * 10 * u + 3.8 * u]; };
    }
    function uiAccess(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, 'Access requests', u, o.state === 'pending' ? '1 open' : '0 open');
      if (o.state === 'none') { text('Nothing waiting 🎉', x + w / 2, y + h / 2 + 3 * u, 3.2 * u, 'center', 600, null, P.mid); return; }
      var cy = y + 9 * u;
      lw(0.7 * u); rbox(x + 2.5 * u, cy, w - 5 * u, h - 11.5 * u, 1.5 * u, P.paper);
      avatar(x + 7 * u, cy + 5.5 * u, 2.8 * u, 'r');
      text('agent-7 (bot)', x + 11.5 * u, cy + 4.2 * u, 3.2 * u, 'left', 800);
      text('operated by Kai · Platform', x + 11.5 * u, cy + 8.2 * u, 2.7 * u, 'left', 600, null, P.mid);
      text('wants', x + 5 * u, cy + 14 * u, 2.8 * u, 'left', 600, null, P.mid);
      chip(x + 13 * u, cy + 14 * u, 'deploy · production', ENTITIES.Permission.color, u, false);
      text('Reason: ship SSO-13 for Globex', x + 5 * u, cy + 20 * u, 2.8 * u, 'left', 600);
      if (o.state === 'approved') {
        chip(x + 5 * u, cy + 27.5 * u, '✓ Granted by Lee · 30 days', OK, u, true);
      } else {
        var press = o.press ? 0.5 * u : 0;
        ctx.strokeStyle = OK; rbox(x + 5 * u, cy + 24.5 * u + press, 18 * u, 6 * u, 1 * u, OK); ctx.strokeStyle = P.ink;
        text('Approve', x + 14 * u, cy + 27.5 * u + press, 3.1 * u, 'center', 800, null, '#fff');
        rbox(x + 25 * u, cy + 24.5 * u, 14 * u, 6 * u, 1 * u, P.paper);
        text('Deny', x + 32 * u, cy + 27.5 * u, 3.1 * u, 'center', 700, null, P.mid);
      }
      o.agentAt = [x + 7 * u, cy + 5.5 * u];
      o.permAt = [x + 30 * u, cy + 14 * u];
    }
    var AUDIT = [
      ['09:31', 'p', 'Ravi', 'moved Deal Globex → Proposal'],
      ['10:04', 'p', 'Kai', 'assigned SSO-13 to agent-7'],
      ['11:41', 'r', 'agent-7', 'merged PR #482'],
      ['13:22', 'p', 'Lee', 'granted deploy:prod to agent-7'],
      ['14:30', 'r', 'agent-7', 'deployed v2.31 to production'],
      ['14:31', 'p', 'Ravi', 'moved Deal Globex → Won'],
      ['14:52', 'o', 'Globex', 'paid Invoice INV-0042'],
      ['16:07', 'p', 'Noor', 'saved View "Globex · open"']
    ];
    function uiAudit(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, 'Audit log', u, 'today');
      var rh = 4.8 * u;
      AUDIT.forEach(function (r, i) {
        var ry = y + 9.5 * u + i * rh;
        var hot = o.hl === i;
        if (hot) fillRect(x, ry - rh / 2, w, rh, hexA(ENTITIES.AuditEvent.color, 0.3));
        text(r[0], x + 1.5 * u, ry, 2.5 * u, 'left', 600, MONO, P.mid);
        avatar(x + 13.5 * u, ry, 1.7 * u, r[1], r[2][0]);
        text(fitText(r[2] + ' ' + r[3], w - 18 * u, 2.6 * u, 600), x + 16.5 * u, ry, 2.6 * u, 'left', 600);
        if (hot) o.hlAt = { row: [x + w - 4 * u, ry], who: [x + 13.5 * u, ry] };
      });
    }
    function uiMetrics(x, y, w, h) {
      var u = h / 48;
      uiBar(x, y, w, 'Company · this quarter', u);
      [['ARR', '$2.21M'], ['NRR', '118%'], ['NPS', '52']].forEach(function (m, i) {
        var mx = x + 3 * u + i * w / 3;
        text(m[0], mx, y + 12 * u, 2.8 * u, 'left', 800, null, P.mid);
        text(m[1], mx, y + 19 * u, 5 * u, 'left', 800);
      });
      for (var k = 0; k < 12; k++) {
        var bh = (8 + k * 1.4 + noise(k) * 4) * u;
        fillRect(x + 3 * u + k * (w - 6 * u) / 12, y + h - 3 * u - bh, (w - 6 * u) / 12 - 1.5 * u, bh, k === 11 ? OK : P.faint);
      }
    }
    function uiQueue(x, y, w, h) {
      var u = h / 48;
      uiBar(x, y, w, 'Support · live', u);
      [['OPEN', String(21 + Math.floor(mod(t / 9, 4)))], ['SLA', '98%'], ['CSAT', '4.8']].forEach(function (m, i) {
        var mx = x + 3 * u + i * w / 3;
        text(m[0], mx, y + 12 * u, 2.8 * u, 'left', 800, null, P.mid);
        text(m[1], mx, y + 19 * u, 5 * u, 'left', 800);
      });
      for (var k = 0; k < 16; k++) {
        var bh = (4 + noise(k + Math.floor(t / 3)) * 14) * u;
        fillRect(x + 3 * u + k * (w - 6 * u) / 16, y + h - 3 * u - bh, (w - 6 * u) / 16 - 1 * u, bh, P.faint);
      }
    }
    function uiLeaderboard(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, 'Q4 · closed won', u, o.won ? '+$24k' : '');
      [['Ravi', 0.62 + (o.won ? 0.16 : 0)], ['Lin', 0.55], ['Tom', 0.41], ['Ola', 0.33]].forEach(function (r, i) {
        var ry = y + 12 * u + i * 8.5 * u;
        text(r[0], x + 3 * u, ry, 3.1 * u, 'left', 700);
        fillRect(x + 16 * u, ry - 2 * u, (w - 20 * u) * r[1], 4 * u, i === 0 && o.won ? ENTITIES.Deal.color : P.faint);
      });
    }
    function uiSheet(x, y, w, h) {
      var u = h / 48;
      uiBar(x, y, w, 'Q4 forecast.xlsx', u);
      lw(0.4 * u); ctx.strokeStyle = P.faint;
      for (var c = 0; c < 5; c++) line(x + c * w / 5, y + 6.5 * u, x + c * w / 5, y + h);
      for (var r = 0; r < 8; r++) line(x, y + 6.5 * u + r * 5.5 * u, x + w, y + 6.5 * u + r * 5.5 * u);
      ctx.strokeStyle = P.ink;
      for (var rr = 1; rr < 8; rr++) for (var cc = 1; cc < 5; cc++) text(Math.floor(10 + noise(rr * 9 + cc) * 90) + 'k', x + (cc + 1) * w / 5 - 1.5 * u, y + 6.5 * u + rr * 5.5 * u + 2.8 * u, 2.6 * u, 'right', 500, MONO);
    }
    function uiList(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, o.title, u);
      for (var i = 0; i < 5; i++) {
        var ry = y + 11 * u + i * 7.5 * u;
        avatar(x + 4 * u, ry, 2.2 * u, 'p', o.letters ? o.letters[i] : '');
        textLines(x + 8.5 * u, ry, w - 14 * u, 1, 0, u, i * 7 + (o.seed || 0));
      }
    }

    // =========================================================================
    // The building shell
    // =========================================================================

    var CLOUD_APPS = ['CRM', 'Board', 'Repo', 'CI', 'Chat', 'Docs', 'Helpdesk', 'Billing', 'Workflows', 'Access', 'Audit log'];

    function drawSky() {
      // the sun crosses the sky as the day goes on
      var a = Math.PI * (1 - clamp((sunH - 6.5) / 13, 0, 1));
      var sx = 880 + Math.cos(a) * 680, sy = 225 - Math.sin(a) * 185;
      lw(1.3);
      circle(sx, sy, 16, P.paper);
      for (var i = 0; i < 12; i++) {
        var b = i * TAU / 12 + t * 0.05;
        line(sx + Math.cos(b) * 21, sy + Math.sin(b) * 21, sx + Math.cos(b) * 28, sy + Math.sin(b) * 28);
      }
      // the cloud, where the company's tools actually run
      var cx = CLOUD.x, cy = CLOUD.y;
      var puffs = [[-230, 18, 46], [-170, -12, 54], [-90, -34, 62], [0, -40, 66], [90, -30, 60], [170, -10, 52], [228, 16, 44]];
      ctx.beginPath();
      puffs.forEach(function (p) { ctx.moveTo(cx + p[0] + p[2], cy + p[1]); ctx.arc(cx + p[0], cy + p[1], p[2], 0, TAU); });
      ctx.rect(cx - 230, cy + 10, 460, 52);
      ctx.fillStyle = P.paper; ctx.fill();
      lw(1.4);
      puffs.forEach(function (p, i) {
        ctx.beginPath();
        var from = i === 0 ? Math.PI * 0.5 : Math.PI * 0.95, to = i === puffs.length - 1 ? Math.PI * 2.5 : Math.PI * 2.05;
        ctx.arc(cx + p[0], cy + p[1], p[2], from, to); ctx.stroke();
      });
      ctx.fillStyle = P.paper; ctx.fillRect(cx - 226, cy + 10, 452, 50);
      line(cx - 230, cy + 64, cx + 228, cy + 60);
      text('THE CLOUD · where the company\'s apps run', cx, cy - 50, 8.5, 'center', 800, null, P.mid);
      var x = cx - 212, y = cy - 32;
      CLOUD_APPS.forEach(function (name) {
        var w = textW(name, 9, 800) + 16;
        if (x + w > cx + 214) { x = cx - 190; y += 24; }
        var hot = cloudFlash[name] || 0;
        lw(hot ? 1.8 : 1.1);
        ctx.strokeStyle = hot ? ENTITIES.Party.color : P.ink;
        rbox(x, y, w, 18, 9, hot ? hexA(ENTITIES.Party.color, 0.12 + 0.25 * hot) : P.paper);
        ctx.strokeStyle = P.ink;
        text(name, x + w / 2, y + 9.5, 9, 'center', 800);
        x += w + 6;
      });
      // link from the roof antenna
      ctx.save(); ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 20; lw(1.2);
      line(RISER, 160, cx + 236, cy + 40);
      ctx.restore();
    }

    function drawShell() {
      ctx.strokeStyle = P.ink;
      ctx.lineJoin = 'round';
      // ground, street and earth
      lw(1.4);
      line(30, GROUND, W - 30, GROUND);
      ctx.save(); ctx.globalAlpha = 0.5; hatch(50, GROUND, W - 100, 90, 9, 0.7); ctx.restore();
      // street lamp, tree, bike
      lw(1.3); line(70, GROUND, 70, GROUND - 120); line(70, GROUND - 120, 92, GROUND - 120); box(88, GROUND - 120, 12, 5);
      line(130, GROUND, 130, GROUND - 60);
      for (var b = 0; b < 5; b++) circle(130 + Math.cos(b * 1.3) * 18, GROUND - 78 + Math.sin(b * 1.9) * 13, 16);
      lw(1.2); circle(1660, GROUND - 9, 9, false); circle(1694, GROUND - 9, 9, false);
      line(1660, GROUND - 9, 1676, GROUND - 24); line(1676, GROUND - 24, 1694, GROUND - 9); line(1676, GROUND - 24, 1684, GROUND - 30);

      // roof: parapet, plant, solar, sign, antenna
      ctx.fillStyle = P.ink;
      ctx.fillRect(X0 - 8, TOPS[0] - 14, X1 - X0 + 16, 14);
      lw(1.3);
      [250, 340].forEach(function (ux) {
        box(ux, TOPS[0] - 50, 72, 36);
        circle(ux + 22, TOPS[0] - 32, 12);
        for (var k = 0; k < 3; k++) { var a = t * 4 + k * TAU / 3; line(ux + 22, TOPS[0] - 32, ux + 22 + Math.cos(a) * 10, TOPS[0] - 32 + Math.sin(a) * 10); }
        hlines(ux + 40, TOPS[0] - 48, 28, 32, 5);
      });
      for (var p = 0; p < 6; p++) {
        var sx = 470 + p * 48;
        poly([sx, TOPS[0] - 14, sx + 40, TOPS[0] - 14, sx + 34, TOPS[0] - 40, sx - 6, TOPS[0] - 40]);
        lw(0.6); line(sx + 13, TOPS[0] - 14, sx + 7, TOPS[0] - 40); line(sx + 27, TOPS[0] - 14, sx + 21, TOPS[0] - 40); lw(1.3);
      }
      lw(1.3);
      line(1260, TOPS[0] - 14, 1260, TOPS[0] - 30); line(1480, TOPS[0] - 14, 1480, TOPS[0] - 30);
      box(1230, TOPS[0] - 70, 280, 40);
      text('acme cloud', 1370, TOPS[0] - 50, 22, 'center', 800);
      lw(1.6); line(RISER, TOPS[0] - 14, RISER, 160);
      line(RISER - 10, 190, RISER + 10, 190); line(RISER - 7, 175, RISER + 7, 175);
      dot(RISER, 158, 3.5, mod(t, 1.2) < 0.6 ? BAD : P.faint);

      // back walls
      ROOMS.forEach(function (q) {
        ctx.fillStyle = P.paper;
        ctx.fillRect(q.x, q.y, q.w, q.h);
        if (q.id !== 'core') vlines(q.x, q.y + 5, q.w, q.h - 10, 9, 0.1);
      });

      // floor slabs and outer walls
      ctx.fillStyle = P.ink;
      TOPS.concat([GROUND]).forEach(function (fy) { ctx.fillRect(X0 - 8, fy - 5, X1 - X0 + 16, 10); });
      ctx.fillRect(X0 - 8, TOPS[0], 12, GROUND - TOPS[0] - 110);   // left wall, open at the front door
      ctx.fillRect(X1 - 4, TOPS[0], 12, GROUND - TOPS[0]);
      // walls between rooms, and glass where people can see through
      function wall(x, i, gap) { ctx.fillStyle = P.ink; ctx.fillRect(x - 3, TOPS[i] + 5, 6, 210 - (gap || 0)); }
      function glass(x, i) {
        lw(1); ctx.strokeStyle = P.ink;
        line(x - 2, TOPS[i] + 5, x - 2, FLR(i)); line(x + 2, TOPS[i] + 5, x + 2, FLR(i));
        ctx.save(); ctx.globalAlpha = 0.35; lw(0.7);
        for (var g = TOPS[i] + 30; g < FLR(i) - 20; g += 50) line(x - 2, g + 10, x + 2, g);
        ctx.restore();
      }
      wall(760, 0, 64); wall(1120, 0, 64);
      for (var f = 0; f < 5; f++) wall(CORE, f, 64);
      glass(820, 2); glass(1100, 2);
      wall(860, 3, 64);
      wall(620, 4, 64); glass(1200, 4);
    }

    // ---- stairs and the network riser ----------------------------------------------
    function drawCore() {
      for (var i = 0; i < 5; i++) {
        var top = TOPS[i] + 5, fl = FLR(i), mid1 = (top + fl) / 2 + 10;
        lw(1.1);
        ctx.beginPath();
        for (var s = 0; s < 8; s++) {
          var sx = CORE + 6 + s * 6, sy = fl - s * (fl - mid1) / 8;
          ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - (fl - mid1) / 8); ctx.lineTo(sx + 6, sy - (fl - mid1) / 8);
        }
        ctx.stroke();
        lw(1.4); line(CORE + 4, mid1, CORE + 60, mid1);
        ctx.save(); ctx.globalAlpha = 0.5; lw(1);
        ctx.beginPath();
        for (var s2 = 0; s2 < 8; s2++) {
          var sx2 = CORE + 54 - s2 * 6, sy2 = mid1 - s2 * (mid1 - top - 4) / 8;
          ctx.moveTo(sx2, sy2); ctx.lineTo(sx2, sy2 - (mid1 - top - 4) / 8); ctx.lineTo(sx2 - 6, sy2 - (mid1 - top - 4) / 8);
        }
        ctx.stroke();
        ctx.restore();
        // network closet
        lw(1); box(CORE + 30, top + 18, 18, 26);
        for (var l = 0; l < 4; l++) fillRect(CORE + 33, top + 22 + l * 5, 3, 2, noise(l + i * 7 + Math.floor(t * 3)) > 0.4 ? OK : P.faint);
      }
      lw(3); line(RISER, TOPS[0] - 14, RISER, TOPS[4] + 16);
      // cable trays along every ceiling
      for (var f = 0; f < 5; f++) {
        var y = TOPS[f] + 13;
        ctx.save(); ctx.globalAlpha = 0.6; lw(1.2); line(X0 + 6, y, RISER, y); ctx.restore();
        lw(0.7);
        for (var hx = X0 + 40; hx < CORE; hx += 120) line(hx, TOPS[f] + 5, hx, y);
      }
      // someone taking the stairs
      var u = mod(t / 7, 1), fi = 1;
      var tp = TOPS[fi] + 5, fb = FLR(fi), md = (tp + fb) / 2 + 10;
      if (u < 0.5) person(CORE + 8 + u * 2 * 48, fb - u * 2 * (fb - md) + 1, look('g4', { walk: t * 9, s: 0.85 }));
      else person(CORE + 56 - (u - 0.5) * 2 * 48, md - (u - 0.5) * 2 * (md - tp - 4) + 1, look('g4', { walk: t * 9, flip: true, s: 0.85 }));
    }

    // ---- packets: records travelling through the network ---------------------------------
    function floorOf(y) { for (var i = 0; i < 5; i++) if (y < FLR(i) + 4) return i; return 4; }
    function upPath(p) {
      var f = floorOf(p[1]), cy = TOPS[f] + 13;
      return [[p[0], p[1]], [p[0], cy], [RISER, cy], [RISER, 160], [CLOUD.x + 236, CLOUD.y + 40], [CLOUD.x, CLOUD.y + 20]];
    }
    function route(src, dst) {
      var a = src ? upPath(src) : [[CLOUD.x, CLOUD.y + 20]];
      var b = dst ? upPath(dst).reverse() : [];
      return a.concat(b.slice(1));
    }
    function pathLen(pts) { var L = 0; for (var i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
    function along(pts, d) {
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (d <= L) return [lerp(a[0], b[0], d / L), lerp(a[1], b[1], d / L)];
        d -= L;
      }
      return pts[pts.length - 1];
    }
    // background chatter: messages, builds, syncs
    var AMBIENT = [
      [S.kaiR, S.junR], [S.raviChat, S.miaC], [S.samG, S.raviCRM], [S.ivyL, null], [null, S.oncLat],
      [S.tessCall, S.ola], [S.priSheet, S.leadTV], [S.noorT, null], [null, S.lin], [S.anaBoard, S.standupTV]
    ].map(function (p) { return route(p[0] && mid(p[0]), p[1] && mid(p[1])); });
    var SPEED = 760;
    // a story packet; returns how far it has got (0..1)
    function storyPacket(src, dst, t0, color, app) {
      var r = route(src, dst), L = pathLen(r);
      var d = (ct - t0) * SPEED;
      if (d < 0) return 0;
      if (d > L) return 1;
      var p = along(r, d);
      PACKETS.push([p[0], p[1], color]);
      var upL = src ? pathLen(upPath(src)) : 0;
      if (Math.abs(d - upL) < 300) cloudFlash[app] = 1 - Math.abs(d - upL) / 300;
      return d / L;
    }
    function arrival(src, dst, t0) { return t0 + pathLen(route(src, dst)) / SPEED; }
    function drawPackets() {
      AMBIENT.forEach(function (r, k) {
        var L = pathLen(r), d = mod(t * 380 + k * 977, L + 1400);
        if (d > L) return;
        var p = along(r, d);
        ctx.save(); ctx.globalAlpha = 0.6; fillRect(p[0] - 2, p[1] - 2, 4, 4, P.ink); ctx.restore();
      });
      PACKETS.forEach(function (p) {
        ctx.save(); ctx.globalAlpha = 0.3; fillRect(p[0] - 7, p[1] - 7, 14, 14, p[2]); ctx.restore();
        fillRect(p[0] - 4, p[1] - 4, 8, 8, p[2]);
      });
    }

    // =========================================================================
    // Story state
    // =========================================================================

    // Timings that depend on how long a packet takes to get somewhere.
    var T = {
      chat2: 4,                                                    // Ravi's question leaves
      req7: arrival(mid(S.kaiR), mid(S.leeAccess), 0),             // access request lands
      email11: arrival(null, mid(S.miaT), 0),                      // Dana's email lands
      pr5: arrival(null, mid(S.kaiR), 0.3),                        // the PR notification lands
      inv10: arrival(null, mid(S.priBill), 1),                     // invoice created
      pay10: arrival(null, mid(S.priBill), 5)                      // payment confirmed
    };
    T.approve7 = T.req7 + 3;
    T.board3 = arrival(mid(S.anaBoard), mid(S.standupTV), 9.2);           // project shows up on the team board
    T.pr5done = T.pr5 + 8.2;

    function dealCol() {
      // 1 = DEMO, 2 = PROPOSAL, 3 = WON
      if (step < 2) return 1;
      if (at(2)) return 1 + ease(seg(1, 2.2));
      if (step < 8) return 2;
      if (at(8)) return 2 + ease(seg(9, 10.2));
      return 3;
    }
    function won() { return step > 8 || (at(8) && ct > 10.2); }
    function ssoTickets() {
      // cards for the SSO project: [key, title, column, assignee, kind]
      if (step < 3) return [];
      var list = [['SSO-12', 'Login flow', 0, null], ['SSO-13', 'SAML callback', 0, null], ['SSO-14', 'Parse IdP metadata', 0, null, 'sub']];
      if (at(3) && ct < T.board3) return [];
      if (step >= 4) {
        var k = at(4) ? ct > 3.6 : true, k2 = at(4) ? ct > 6.1 : true;
        if (k) { list[0][3] = ['p', 'K']; list[0][2] = 1; }
        if (k2) { list[1][3] = ['r', '7']; list[1][2] = 1; list[2][3] = ['r', '7']; list[2][2] = 1; }
      }
      if (step >= 5) {
        var c = at(5) ? (ct < T.pr5 ? 1 : ct < T.pr5done + 0.6 ? 2 : 3) : 3;
        list[1][2] = c; list[2][2] = c;
      }
      return list;
    }

    // =========================================================================
    // Rooms
    // =========================================================================

    // ---- 5th floor: Product & Design, IT, Leadership -------------------------------
    function drawProduct() {
      var fl = FLR(0), ce = CEI(0);
      hangSign(560, ce + 14, 'PRODUCT & DESIGN');
      light(320, ce + 14); light(600, ce + 14);
      // whiteboard with a user journey
      lw(1.3); box(196, 292, 134, 66);
      for (var i = 0; i < 4; i++) {
        var sx = 204 + i * 31;
        fillRect(sx, 300, 22, 16, i === 2 ? hexA(ENTITIES.Product.color, 0.35) : hexA('#F7DC6F', 0.6));
        lw(0.7); ctx.strokeRect(sx, 300, 22, 16);
        if (i < 3) line(sx + 23, 308, sx + 30, 308);
      }
      text('sign-in journey', 263, 330, 7, 'center', 700);
      lw(0.8); ctx.beginPath(); ctx.moveTo(206, 346); ctx.quadraticCurveTo(260, 330, 320, 350); ctx.stroke();
      // roadmap poster
      lw(1.3); box(345, 292, 140, 60);
      text('Q4 ROADMAP', 352, 300, 6.5, 'left', 800);
      [['Billing v2', 0.05, 0.5], ['Mobile', 0.3, 0.9], ['SSO', 0.45, 0.95]].forEach(function (b, k) {
        if (b[0] === 'SSO' && !(step > 3 || (at(3) && ct > 7))) return;
        var y = 310 + k * 13;
        text(b[0], 352, y + 4, 5.5, 'left', 700);
        fillRect(392 + b[1] * 86, y, (b[2] - b[1]) * 86, 8, b[0] === 'SSO' ? hexA(ENTITIES.Project.color, 0.55) : P.faint);
      });
      // Ana's standing desk: the spec and the new project
      var p3 = at(3);
      var docP = p3 ? seg(0.5, 4.5) : step > 3 ? 1 : 0.35;
      var cards;
      if (p3) {
        cards = [];
        if (ct > 5.2) cards.push({ c: 0, r: 0, key: 'PROJECT', s: 'SSO for Pro', hot: true, color: ENTITIES.Project.color });
        if (ct > 6) cards.push({ c: 0, r: 1, key: 'SSO-12', s: 'Login flow', hot: true });
        if (ct > 6.9) cards.push({ c: 0, r: 2, key: 'SSO-13', s: 'SAML callback', hot: true });
        if (ct > 7.8) cards.push({ c: 0, r: 3, key: 'SSO-14', s: 'Parse IdP metadata', hot: true, indent: true });
      } else {
        cards = [{ c: 0, r: 0, key: 'BIL-88', s: 'Proration', who: ['p', 'J'] }, { c: 1, r: 0, key: 'MOB-12', s: 'Push opt-in', who: ['p', 'I'] }];
        if (step > 3) cards.push({ c: 2, r: 0, key: 'PROJECT', s: 'SSO for Pro', hot: true, color: ENTITIES.Project.color });
      }
      var docO = { file: 'Docs · Specs', title: step >= 3 ? 'SSO for Pro · spec' : 'Billing v2 · spec', p: docP };
      var brdO = { title: 'Platform · projects', cols: p3 ? ['NEW PROJECT · SSO'] : ['BACKLOG', 'NEXT', 'NOW'], cards: cards, cardH: 8, pitch: 8.8 };
      workstation(226, FLR(0), [
        { r: S.anaDoc, fn: function (x, y, w, h) { uiDoc(x, y, w, h, docO); } },
        { r: S.anaBoard, fn: function (x, y, w, h) { uiBoard(x, y, w, h, brdO); } }
      ], here('ana') ? 'ana' : null, { standing: true, arm: p3 && ct > 0.5 && ct < 4.5 ? 'type' : 'forward' });
      // Mo designs the new sign-in screen
      workstation(470, fl, [{ r: S.moDesign, fn: function (x, y, w, h) { uiDesign(x, y, w, h, { hot: step >= 3 }); } }], 'mo', { mug: true });
      plant(690, fl, true);
      lw(1.2); ctx.beginPath(); ctx.ellipse(732, fl - 12, 20, 12, 0, Math.PI, 0); ctx.lineTo(752, fl); ctx.lineTo(712, fl); ctx.closePath(); ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();

      if (p3) {
        var doc = S.anaDoc, brd = S.anaBoard, right = brd[0] + brd[2];
        tag(doc[0] + 34, doc[1] - 16, 'Document', 'SSO spec', doc[0] + 20, doc[1] + 12);
        tag(214, fl - 78, 'Person', 'Ana');
        var at0 = function (key) { for (var i = 0; i < cards.length; i++) if (cards[i].key === key && cards[i].box) return cards[i].box; return null; };
        var pb = at0('PROJECT'), b12 = at0('SSO-12'), b14 = at0('SSO-14'), b13 = at0('SSO-13');
        if (pb) {
          tag(right + 50, brd[1] - 16, 'Project', 'SSO', pb[0] + pb[2] - 4, pb[1] + 3);
          DYN.attached = [doc[0] + 64, doc[1] - 16, right + 14, brd[1] - 16];
        }
        if (b12) {
          tag(right + 52, brd[1] + 22, 'Task', 'SSO-12', b12[0] + b12[2] - 2, b12[1] + b12[3] / 2);
          DYN.belongs = [right + 60, brd[1] + 15, right + 60, brd[1] - 9];
        }
        if (b14 && b13) {
          tag(right + 56, brd[1] + 54, 'Task', 'SSO-14, a sub-ticket', b14[0] + b14[2] - 2, b14[1] + b14[3] / 2);
          DYN.subtask = [right + 20, brd[1] + 47, b13[0] + b13[2] + 1, b13[1] + b13[3] / 2];
        }
        if (ct > 9.2) storyPacket(mid(S.anaBoard), mid(S.standupTV), 9.2, ENTITIES.Project.color, 'Board');
      }
    }

    function drawIT() {
      var fl = FLR(0), ce = CEI(0);
      hangSign(830, ce + 14, 'IT & SECURITY');
      light(1010, ce + 14);
      // laptops charging for new hires
      for (var s = 0; s < 3; s++) {
        var sy = 300 + s * 26;
        lw(1.2); line(776, sy + 22, 878, sy + 22);
        for (var l = 0; l < 4; l++) {
          lw(0.9); box(780 + l * 24, sy + 6, 18, 16);
          dot(789 + l * 24, sy + 18, 1.5, noise(l + s * 4 + Math.floor(t * 0.5)) > 0.3 ? OK : RUN);
        }
      }
      text('new-hire laptops', 827, 384, 6, 'center', 700, null, P.mid);
      var p7 = at(7), p12 = at(12);
      var accState = p7 ? (ct < T.req7 ? 'none' : ct < T.approve7 ? 'pending' : 'approved') : 'none';
      var acc = { state: accState, press: p7 && ct > T.approve7 - 0.4 && ct < T.approve7 };
      var aud = { hl: p12 ? Math.floor(ct / 1.9) % AUDIT.length : null };
      workstation(890, fl, [
        { r: S.leeAccess, fn: function (x, y, w, h) { uiAccess(x, y, w, h, acc); } },
        { r: S.leeAudit, fn: function (x, y, w, h) { uiAudit(x, y, w, h, aud); } }
      ], 'lee', { arm: p7 && ct > T.approve7 - 0.6 && ct < T.approve7 + 0.3 ? 'forward' : 'type', mug: true });
      lw(1); box(1100, fl - 70, 10, 14); dot(1105, fl - 65, 1.5, mod(t, 2) < 1 ? OK : P.faint);

      var la = S.leeAccess, ld = S.leeAudit;
      if (p7) {
        storyPacket(mid(S.kaiR), mid(la), 0, ENTITIES.Permission.color, 'Access');
        tag(902, fl - 76, 'Person', 'Lee');
        if (accState !== 'none' && acc.agentAt) {
          tag(la[0] + 6, la[1] - 18, 'Agent', 'agent-7', acc.agentAt[0], acc.agentAt[1]);
          if (accState === 'approved') {
            tag(la[0] + la[2] / 2 + 6, la[1] + la[3] + 36, 'Permission', 'deploy · production', acc.permAt[0], acc.permAt[1]);
            DYN.granted = [la[0] + la[2] / 2 - 30, la[1] + la[3] + 29, la[0] - 2, la[1] - 18];
            storyPacket(mid(la), mid(S.oncDep), T.approve7 + 0.4, OK, 'Access');
          }
        }
      }
      if (p12 && aud.hlAt) {
        var row = AUDIT[aud.hl], kind = { p: 'Person', r: 'Agent', o: 'Organization' }[row[1]];
        tag(ld[0] + ld[2] / 2, ld[1] - 18, 'AuditEvent', row[0], aud.hlAt.row[0], aud.hlAt.row[1]);
        tag(ld[0] + 20, ld[1] + ld[3] + 36, kind, row[2], aud.hlAt.who[0], aud.hlAt.who[1]);
        DYN.performed = [ld[0] + ld[2] / 2 + 30, ld[1] - 11, ld[0] + 44, ld[1] + ld[3] + 29];
        tag(902, fl - 76, 'Person', 'Lee');
      }
    }

    function drawLeadership() {
      var fl = FLR(0), ce = CEI(0);
      hangSign(1460, ce + 14, 'LEADERSHIP');
      cityWindow(1136, 296, 130, 108);
      tv(S.leadTV, function (x, y, w, h) { uiMetrics(x, y, w, h); });
      lw(1.3); ctx.beginPath(); ctx.ellipse(1350, fl - 36, 32, 4, 0, 0, TAU); ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();
      line(1350, fl - 32, 1350, fl); line(1336, fl, 1364, fl);
      chair(1306, fl); chair(1394, fl, true);
      person(1306, fl, look('zoe', { seated: true, arm: 'forward' }));
      person(1394, fl, look('pat', { seated: true, flip: true, arm: 'down' }));
      mug(1360, fl - 40, true);
      if (mod(t, 8) < 4) bubble(1316, fl - 80, 'How\'s the team doing?'); else bubble(1384, fl - 80, 'Busy week. Good busy.');
      lw(1.2); box(1452, 300, 76, 170);
      for (var s = 0; s < 4; s++) {
        line(1452, 340 + s * 34, 1528, 340 + s * 34);
        for (var b = 0; b < 7; b++) { lw(0.8); box(1456 + b * 10, 316 + s * 34 + (b % 3), 8, 24 - (b % 3)); }
        lw(1.2);
      }
    }

    // ---- 4th floor: Engineering --------------------------------------------------------
    function drawEngineering() {
      var fl = FLR(1), ce = CEI(1);
      hangSign(800, ce + 14, 'ENGINEERING · PLATFORM TEAM');
      light(560, ce + 14); light(1040, ce + 14);
      // the sprint board on the stand-up TV
      var cards = [
        { c: 1, r: 0, key: 'PLT-201', s: 'Flaky e2e test', who: ['p', 'I'] },
        { c: 2, r: 0, key: 'PLT-198', s: 'Rate limiter', who: ['p', 'J'] },
        { c: 3, r: 0, key: 'PLT-190', s: 'Upgrade Node', who: ['r', '7'] }
      ];
      var used = [0, 1, 1, 1];
      ssoTickets().forEach(function (tk) {
        var c = tk[2];
        cards.push({ c: c, r: used[c]++, key: tk[0], s: tk[1], who: tk[3], hot: true, indent: tk[4] === 'sub' });
      });
      var board = { title: 'Platform · Sprint 42', right: step >= 3 ? 'SSO' : '', cols: ['TO DO', 'IN PROGRESS', 'IN REVIEW', 'DONE'], cards: cards, cardH: 7.6, pitch: 8.8 };
      tv(S.standupTV, function (x, y, w, h) { uiBoard(x, y, w, h, board); });
      if (at(4)) {
        var speaker = ct < 3 ? 'ivy' : ct < 5.5 ? 'kai' : 'jun';
        [['ivy', 230], ['kai', 280], ['jun', 330], ['ana', 384]].forEach(function (p) {
          person(p[1], fl, look(p[0], { arm: p[0] === speaker ? 'point' : 'down', flip: p[1] > 300 && p[0] !== speaker }));
        });
        var said = ct < 3 ? 'Fixed the flaky test. No blockers.' : ct < 5.5 ? 'I\'ll take SSO-12, the login flow.' : 'agent-7 takes SSO-13. Kai reviews.';
        bubble({ ivy: 236, kai: 290, jun: 340 }[speaker], fl - 86, said);
      } else {
        lw(1.3);
        box(206, fl - 26, 110, 14); box(206, fl - 44, 14, 32); box(302, fl - 44, 14, 32);
        if (!at(6)) {
          person(246, fl - 4, look('ben', { seated: true, arm: 'type' }));
          lw(1.1); poly([258, fl - 30, 282, fl - 30, 286, fl - 46, 262, fl - 46]);
        }
      }
      plant(452, fl, true);
      // Kai's desk: code on the left, chat or the pull request on the right
      var p5 = at(5);
      var pr = { checks: [['build', 'ok'], ['unit tests', 'ok'], ['e2e tests', 'ok'], ['lint', 'ok']], review: 'approved', merged: true };
      if (p5) {
        var s0 = T.pr5;
        pr.checks = [['build', ct < s0 + 1.2 ? 'run' : 'ok'], ['unit tests', ct < s0 + 1.2 ? 'wait' : ct < s0 + 2.8 ? 'run' : 'ok'], ['e2e tests', ct < s0 + 1.5 ? 'wait' : ct < s0 + 4.2 ? 'run' : 'ok'], ['lint', ct < s0 + 1 ? 'wait' : 'ok']];
        pr.review = ct < s0 + 5 ? null : ct < s0 + 6.8 ? 'comment' : 'approved';
        pr.mergeable = ct > s0 + 6.8;
        pr.merged = ct > T.pr5done;
      }
      var showPR = p5 && ct > T.pr5;
      var chat = { channel: 'eng-platform', msgs: [
        { n: 'Ivy', s: 'e2e is green again 🎉' },
        { n: 'Jun', s: 'stand-up in 5' }
      ] };
      if (p5) chat.msgs.push({ n: 'agent-7', k: 'r', s: 'Opened #482 for SSO-13', hot: ENTITIES.Agent.color });
      workstation(480, fl, [
        { r: S.kaiL, fn: function (x, y, w, h) { uiCode(x, y, w, h, p5 ? { file: '#482 · auth/saml.ts', branch: 'diff', diff: true, comment: ct > T.pr5 + 5 ? 'Handle expired assertions?' : null } : { file: 'login/LoginForm.tsx', branch: step >= 4 ? 'sso-12' : 'main', typed: 0.5 + 0.5 * mod(t / 16, 1), lines: [[0, 'export function', 'LoginForm() {'], [1, 'const [email, set] =', 'useState("")'], [1, 'const sso =', 'useSsoLookup(email)'], [1, 'return', '<Form>'], [2, '<Email', 'onChange={set} />'], [2, '{sso &&', '<SsoButton />}'], [1, '</Form>', ''], [0, '}', '']] }); } },
        { r: S.kaiR, fn: function (x, y, w, h) { if (showPR) uiPR(x, y, w, h, pr); else uiChat(x, y, w, h, chat); } }
      ], here('kai') ? 'kai' : null, { mug: true });
      workstation(700, fl, [
        { r: S.junL, fn: function (x, y, w, h) { uiCode(x, y, w, h, { file: 'ratelimit/bucket.go', branch: 'plt-198', lines: [[0, 'func', '(b *Bucket) Take() bool {'], [1, 'b.mu.Lock()', ''], [1, 'defer', 'b.mu.Unlock()'], [1, 'b.refill()', ''], [1, 'if', 'b.tokens < 1 {'], [2, 'return', 'false'], [1, '}', ''], [1, 'b.tokens--', ''], [0, '}', '']] }); } },
        { r: S.junR, fn: function (x, y, w, h) { uiTerminal(x, y, w, h); } }
      ], here('jun') ? 'jun' : null);
      // the office dog
      lw(1.2);
      ctx.beginPath(); ctx.ellipse(880, fl - 8, 14, 7, 0, 0, TAU); ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();
      circle(868, fl - 12, 5.5); fillRect(864, fl - 17, 3, 6, P.ink);
      line(894, fl - 9, 900 + Math.sin(t * 6) * 3, fl - 15);
      workstation(920, fl, [
        { r: S.ivyL, fn: function (x, y, w, h) { uiGraph(x, y, w, h, { title: 'api p95 latency', value: '182 ms', seed: 4, speed: 1.5 }); } },
        { r: S.ivyR, fn: function (x, y, w, h) { uiCode(x, y, w, h, { file: 'e2e/checkout.spec.ts', branch: 'plt-201', typed: 0.5 + 0.5 * mod(t / 14, 1), lines: [[0, 'test(', '"checkout works", async () => {'], [1, 'await', 'page.goto("/cart")'], [1, 'await', 'page.click("Pay")'], [1, 'await', 'expect(toast).toBeVisible()'], [0, '})', '']] }); } }
      ], here('ivy') ? 'ivy' : null, { mug: true });

      if (at(4)) {
        var tvr = S.standupTV;
        var find = function (k) { for (var i = 0; i < cards.length; i++) if (cards[i].key === k) return cards[i].box; return null; };
        tag(tvr[0] + 50, tvr[1] - 18, 'Team', 'Platform');
        tag(280, fl - 2, 'Person', 'Kai');
        DYN.memberOf = [266, fl - 66, tvr[0] + 24, tvr[1] - 11];
        var c12 = find('SSO-12'), c13 = find('SSO-13');
        if (ct > 3.6 && c12) { tag(tvr[0] + tvr[2] + 40, tvr[1] + 34, 'Task', 'SSO-12', c12[0] + c12[2], c12[1] + c12[3] / 2); DYN.assignedA = [tvr[0] + tvr[2] + 30, tvr[1] + 41, 292, fl - 64]; }
        if (ct > 6.1 && c13) {
          tag(tvr[0] + tvr[2] + 44, tvr[1] + 66, 'Agent', 'agent-7', c13[0] + c13[2] - 3, c13[1] + c13[3] / 2);
          DYN.assignedB = [tvr[0] + tvr[2] + 74, tvr[1] + 41, tvr[0] + tvr[2] + 74, tvr[1] + 59];
        }
      }
      if (p5) {
        var kr = S.kaiR;
        tag(492, fl - 2, 'Person', 'Kai');
        storyPacket(null, mid(kr), 0.3, ENTITIES.Agent.color, 'Repo');
        if (showPR && pr.authorAt) {
          tag(kr[0] + 20, kr[1] - 18, 'Agent', 'agent-7', pr.authorAt[0], pr.authorAt[1]);
          tag(kr[0] + kr[2] + 30, kr[1] + 10, 'Task', ct > T.pr5done + 0.6 ? 'SSO-13 · Done' : 'SSO-13 · In review', kr[0] + kr[2] - 6, kr[1] + 3);
          DYN.assigned5 = [kr[0] + kr[2] + 22, kr[1] + 3, kr[0] + 48, kr[1] - 18];
        }
        storyPacket(mid(kr), mid(S.standupTV), T.pr5done + 0.2, ENTITIES.Task.color, 'Board');
      }
    }

    function drawOnCall() {
      var fl = FLR(1);
      var p8 = at(8);
      var stages = [['build', 'ok'], ['staging', 'ok'], ['approval', 'ok'], ['prod', 'ok']], foot = 'v2.30 live';
      if (step >= 5 && step < 8) { stages = [['build', 'ok'], ['staging', 'ok'], ['approval', at(7) && ct > T.approve7 + 1 ? 'ok' : 'lock'], ['prod', 'wait']]; foot = 'v2.31 · waiting for deploy rights'; }
      if (at(7) && ct > T.approve7 + 1) foot = 'v2.31 · ready to ship';
      if (p8) { stages = [['build', 'ok'], ['staging', 'ok'], ['approval', 'ok'], ['prod', ct < 0.8 ? 'wait' : ct < 3.6 ? 'run' : 'ok']]; foot = ct > 3.6 ? 'v2.31 live · agent-7 · 14:30' : 'deploying v2.31…'; }
      if (step > 8) foot = 'v2.31 live · agent-7 · 14:30';
      tv(S.oncLat, function (x, y, w, h) { uiGraph(x, y, w, h, { title: 'p95 latency', value: '182 ms', seed: 1, limit: true }); });
      tv(S.oncErr, function (x, y, w, h) { uiGraph(x, y, w, h, { title: 'errors / min', value: '0.4', seed: 9, color: BAD, speed: 3 }); });
      tv(S.oncDep, function (x, y, w, h) { uiPipeline(x, y, w, h, { title: 'deploy · SSO (v2.31)', stages: stages, footer: foot }); });
      desk(1260, 200, fl);
      lw(1.2); poly([1300, fl - DESK, 1340, fl - DESK, 1346, fl - DESK - 26, 1306, fl - DESK - 26]);
      chair(1250, fl);
      person(1250, fl, look('raj', { seated: true, arm: at(6) ? 'eat' : 'type' }));
      lw(1); box(1380, fl - DESK - 10, 30, 10);
      text('ON CALL', 1395, fl - DESK - 5, 4.5, 'center', 800, null, BAD);
      var buzz = mod(t, 11) < 0.8;
      lw(1); box(1420 + (buzz ? Math.sin(t * 60) : 0), fl - DESK - 8, 12, 8);
      plant(1500, fl, true);
      if (p8 && ct < 5.5) {
        var dep = S.oncDep;
        tag(dep[0] + dep[2] / 2 - 10, dep[1] + dep[3] + 22, 'Agent', 'agent-7 deploys', dep[0] + dep[2] - 14, dep[1] + 30);
        tag(1250, fl - 2, 'Person', 'Raj, on call');
      }
    }

    // ---- 3rd floor: Sales, demo room, Customer Success ------------------------------------
    function drawSales() {
      var fl = FLR(2), ce = CEI(2);
      hangSign(560, ce + 14, 'SALES');
      light(450, ce + 14); light(700, ce + 14);
      var w0n = won();
      tv(S.salesTV, function (x, y, w, h) { uiLeaderboard(x, y, w, h, { won: w0n }); });
      // the gong
      var ring = at(8) && ct > 10.4 && ct < 13;
      lw(1.4);
      line(334, fl, 340, fl - 100); line(370, fl, 364, fl - 100); line(336, fl - 100, 368, fl - 100);
      ctx.save(); ctx.translate(352, fl - 64); ctx.rotate(ring ? Math.sin(t * 25) * 0.15 : 0);
      line(0, -36, 0, -22); circle(0, 0, 22, hexA('#D4A017', ring ? 0.5 : 0.2)); circle(0, 0, 8, false);
      ctx.restore();
      if (ring) { ctx.save(); ctx.globalAlpha = 0.6; for (var w = 0; w < 3; w++) { lw(1); ctx.beginPath(); ctx.arc(352, fl - 64, 28 + w * 8 + mod(t * 20, 8), -0.6, 0.6); ctx.stroke(); } ctx.restore(); }
      // SDRs on calls
      workstation(392, fl, [{ r: S.lin, fn: function (x, y, w, h) { uiList(x, y, w, h, { title: 'Call list', letters: 'NTCLF', seed: 2 }); } }], here('lin') ? 'lin' : null, { arm: 'phone' });
      workstation(486, fl, [{ r: S.tom, fn: function (x, y, w, h) { uiList(x, y, w, h, { title: 'Sequences', letters: 'ABCDE', seed: 5 }); } }], 'tom', { arm: 'phone' });
      if (here('lin') && mod(t, 9) < 4) bubble(410, fl - 80, ['Hi, it\'s Lin from Acme!', 'Do you have 15 minutes?', 'Great, I\'ll send an invite.'][Math.floor(t / 9) % 3]);
      // Ravi: CRM and chat
      var p2 = at(2), p8 = at(8);
      var chat = { channel: 'product', msgs: [{ n: 'Mo', s: 'New sign-in mocks are up' }, { n: 'Ana', s: 'Roadmap review at 2' }] };
      if (step >= 2) chat.msgs.push({ n: 'Ravi', s: 'Is SSO on the roadmap? Globex ($24k) needs it 🙏', hot: p2 ? ENTITIES.Deal.color : null });
      if (step > 2 || (p2 && ct > 10)) chat.msgs.push({ n: 'Ana', s: 'On it. Spec today, Platform starts tomorrow.' });
      if (p2 && ct < T.chat2) chat.msgs.pop();
      if (w0n || (at(9) && ct > 6)) chat = { channel: 'wins', msgs: [{ n: 'Lin', s: 'Northwind renewed 🙌' }, { n: 'Ravi', s: 'Globex signed! Pro, $24k ARR 🎉', hot: ENTITIES.Deal.color }] };
      if (step > 9 || (at(9) && ct > 6)) chat.msgs.push({ n: 'workflow', k: 'r', s: 'Closed won: Globex · Pro → onboarding', hot: ENTITIES.Automation.color });
      var c = dealCol();
      var deals = [
        { c: 0, r: 0, n: 'Northwind', amt: '$8k' }, { c: 0, r: 1, n: 'Tailspin', amt: '$12k' },
        { c: 1, r: 0, n: 'Contoso', amt: '$40k' }, { c: 2, r: 0, n: 'Litware', amt: '$18k' }, { c: 3, r: 0, n: 'Fabrikam', amt: '$30k' },
        { c: c, r: 1, n: 'Globex', amt: step >= 2 && step < 8 ? 'Pro · $24k · SSO!' : 'Pro · $24k', hot: true }
      ];
      var crm = { deals: deals, panel: { role: won() ? 'Customer' : 'Lead', next: w0n ? 'Kickoff with CS' : step >= 2 ? 'Waiting on SSO' : 'Demo 9:10' } };
      workstation(596, fl, [
        { r: S.raviCRM, fn: function (x, y, w, h) { uiCRM(x, y, w, h, crm); } },
        { r: S.raviChat, fn: function (x, y, w, h) { uiChat(x, y, w, h, chat); } }
      ], here('ravi') ? 'ravi' : null, { arm: p8 && ct > 8.4 && ct < 10.2 ? 'forward' : p8 && ct > 10.4 ? 'cheer' : 'type', mug: true });

      var r = S.raviCRM, g = deals[5].box, pa = crm.panelAt;
      if (p2 && g) {
        tag(r[0] + 22, r[1] - 18, 'Deal', ct > 2.2 ? 'stage: Proposal' : 'stage: Demo', g[0] + g[2] / 2, g[1]);
        tag(r[0] - 8, r[1] + r[3] + 30, 'Product', 'Pro plan', g[0] + 6, g[1] + g[3] - 2);
        tag(r[0] + r[2] + 18, r[1] - 40, 'Person', 'Dana', pa.contact[0], pa.contact[1]);
        DYN.dealWith = [r[0] + 54, r[1] - 25, r[0] + r[2] - 10, r[1] - 40];
        DYN.dealFor = [r[0] - 4, r[1] - 11, r[0] - 8, r[1] + r[3] + 23];
        storyPacket(mid(S.raviChat), mid(S.anaBoard), T.chat2, ENTITIES.Deal.color, 'Chat');
      }
      if (p8 && ct > 5.5 && g) {
        tag(r[0] + 22, r[1] - 18, 'Deal', w0n ? 'stage: Won' : 'stage: Proposal', g[0] + g[2] / 2, g[1]);
        tag(pa.x + pa.w / 2, r[1] + r[3] + 30, 'Role', won() ? 'Customer' : 'Lead', pa.role[0], pa.role[1]);
        tag(pa.x + pa.w / 2 + 10, r[1] - 40, 'Person', 'Dana', pa.contact[0], pa.contact[1]);
        DYN.plays8 = [pa.x + pa.w / 2 + 40, r[1] - 33, pa.x + pa.w / 2 + 40, r[1] + r[3] + 23];
        storyPacket(mid(S.raviCRM), null, 10.3, ENTITIES.Deal.color, 'CRM');
      }
    }

    function drawDemo() {
      var fl = FLR(2), ce = CEI(2);
      text('DEMO ROOM', 1052, ce + 22, 8, 'center', 800, null, P.mid);
      var p1 = at(1);
      var call = p1
        ? { title: 'Acme × Globex · demo', right: '24:13', tiles: [
            { who: 'dana', label: 'Dana · Globex', speak: ct > 5 && ct < 9 },
            { who: 'kim', label: 'Kim · Globex', speak: false },
            { share: 'Acme · sign-in' },
            { who: 'ravi', label: 'Ravi · Acme', speak: ct < 5 }
          ] }
        : { title: 'Weekly sync', tiles: [{ who: 'ola', label: 'Ola', speak: mod(t, 6) < 3 }, { who: 'tess', label: 'Tess' }, { who: 'pat', label: 'Pat', speak: mod(t, 6) >= 3 }, { who: 'zoe', label: 'Zoe' }] };
      tv(S.demoTV, function (x, y, w, h) { uiCall(x, y, w, h, call); });
      lw(1); box(918, S.demoTV[1] - 12, 12, 5); dot(924, S.demoTV[1] - 9.5, 1.4, BAD);
      lw(1.3); box(850, fl - 36, 230, 4); line(870, fl - 32, 870, fl); line(1060, fl - 32, 1060, fl);
      chair(866, fl); chair(1066, fl, true);
      if (p1) {
        person(866, fl, look('ravi', { seated: true, arm: ct < 5 ? 'forward' : 'down' }));
        person(1066, fl, look('sol', { seated: true, flip: true, arm: 'type' }));
        lw(1.1); poly([1030, fl - 36, 1058, fl - 36, 1062, fl - 54, 1034, fl - 54]);
        if (ct > 5.2) bubble(924, fl - 66, '"We can\'t sign without SSO."', ENTITIES.Interaction.color, 7);
        var tv0 = S.demoTV, d = call.tiles[0].box;
        if (d) {
          tag(tv0[0] - 34, tv0[1] + 16, 'Person', 'Dana', d[0] + 6, d[1] + 10);
          tag(tv0[0] - 34, tv0[1] + 76, 'Organization', 'Globex', d[0] + 6, d[1] + d[3] - 4);
          tag(tv0[0] + tv0[2] + 36, tv0[1] + 20, 'Interaction', 'video call');
          if (ct > 2) { tag(tv0[0] - 34, tv0[1] + 46, 'Role', 'Lead at Acme'); DYN.plays = [tv0[0] - 70, tv0[1] + 23, tv0[0] - 70, tv0[1] + 39]; }
          DYN.involves = [tv0[0] + tv0[2] + 30, tv0[1] + 27, 878, fl - 64];
          tag(866, fl - 2, 'Person', 'Ravi');
        }
      } else {
        person(866, fl, look('g5', { seated: true, arm: 'forward' }));
      }
      ctx.save(); ctx.globalAlpha = 0.45; text('acme', 1052, ce + 42, 10, 'center', 800); ctx.restore();
    }

    function drawCS() {
      var fl = FLR(2), ce = CEI(2);
      hangSign(1460, ce + 14, 'CUSTOMER SUCCESS');
      light(1240, ce + 14);
      lw(1.2); box(1360, 732, 160, 52);
      text('Customer health', 1366, 740, 6, 'left', 800);
      for (var k = 0; k < 10; k++) fillRect(1366 + k * 15, 778 - (10 + noise(k + 3) * 24), 10, 10 + noise(k + 3) * 24, k > 7 ? hexA(OK, 0.5) : P.faint);
      var p9 = at(9), shown = step > 9 ? 3 : p9 ? Math.floor(clamp((ct - 9.4) / 0.8, 0, 3)) : 0;
      var cards = [
        { c: 0, r: 0, key: 'TAILSPIN', s: 'Kickoff call', who: ['p', 'T'] },
        { c: 1, r: 0, key: 'CONTOSO', s: 'Data import', who: ['p', 'O'] },
        { c: 2, r: 0, key: 'LITWARE', s: 'Live 🎉', who: ['p', 'T'] }
      ];
      var tasks = ['Kickoff call', 'Turn on SSO', 'Admin training'];
      for (var i = 0; i < shown; i++) cards.push({ c: 0, r: i + 1, key: 'GLOBEX', s: tasks[i], who: ['p', 'T'], hot: true });
      var brd = { title: 'Onboarding', cols: ['KICKOFF', 'SETUP', 'LIVE'], cards: cards, cardH: 8.6, pitch: 9.6 };
      workstation(1120, fl, [
        { r: S.tessBoard, fn: function (x, y, w, h) { uiBoard(x, y, w, h, brd); } },
        { r: S.tessCall, fn: function (x, y, w, h) { uiCall(x, y, w, h, { title: 'Contoso · check-in', tiles: [{ who: 'kim', label: 'Contoso', speak: mod(t, 5) < 2.5 }, { who: 'tess', label: 'Tess', speak: mod(t, 5) >= 2.5 }] }); } }
      ], 'tess', { arm: 'type' });
      workstation(1350, fl, [{ r: S.ola, fn: function (x, y, w, h) { uiList(x, y, w, h, { title: 'Renewals · Q1', letters: 'NCFLT', seed: 8 }); } }], 'ola');
      if (p9 && shown > 0 && cards[3].box) {
        var b = S.tessBoard, c0 = cards[3].box;
        tag(b[0] + 30, b[1] - 18, 'Task', 'Kickoff call · Globex', c0[0] + c0[2] / 2, c0[1] + 2);
        tag(1132, fl - 2, 'Person', 'Tess');
      }
    }

    // ---- 2nd floor: Support, Finance & RevOps ----------------------------------------------
    function drawSupport() {
      var fl = FLR(3), ce = CEI(3);
      hangSign(560, ce + 14, 'SUPPORT');
      light(460, ce + 14); light(700, ce + 14);
      tv(S.queueTV, function (x, y, w, h) { uiQueue(x, y, w, h); });
      lw(1.2); box(380, 950, 140, 34); text('Every ticket is a person.', 450, 967, 7, 'center', 700);
      var p11 = at(11);
      var arrived = step > 11 || (p11 && ct > T.email11);
      var solved = step > 11 || (p11 && ct > T.email11 + 4.8);
      var rows = [
        { id: '3298', s: 'CSV export is slow', st: 'Open' },
        { id: '3297', s: 'Invoice address change', st: 'Open' },
        { id: '3295', s: 'Can\'t reset password', st: 'Solved' }
      ];
      if (arrived) rows.unshift({ id: '3301', s: 'Turn on SSO for everyone? · Dana', st: solved ? 'Solved' : 'New', hot: p11 });
      var mia = { right: 'Mia', views: [{ n: 'My open', count: 7, cur: true }, { n: 'Unassigned', count: 4 }, { n: 'Urgent', count: 1 }], rows: rows.slice(0, 4) };
      if (p11 && arrived && !solved && ct > T.email11 + 1) mia.draft = 'Hi Dana! Settings → Security → SSO, then…';
      var saved = step > 11 || (p11 && ct > T.email11 + 6.4);
      var noor = { right: 'Noor', views: [{ n: 'All open', count: 23, cur: !saved }, { n: 'Urgent', count: 1 }], rows: rows.slice(0, 4).map(function (r) { var c = {}; for (var k in r) c[k] = r[k]; c.hot = false; return c; }) };
      if (saved) noor.views.push({ n: 'Globex · open', count: 1, hot: p11, cur: true });
      workstation(350, fl, [
        { r: S.miaT, fn: function (x, y, w, h) { uiTickets(x, y, w, h, mia); } },
        { r: S.miaC, fn: function (x, y, w, h) { uiChat(x, y, w, h, { channel: 'support', msgs: [{ n: 'Noor', s: 'New customer: Globex. Watch their queue.' }, { n: 'Mia', s: '👍' }] }); } }
      ], here('mia') ? 'mia' : null, { mug: true, arm: p11 && ct > T.email11 + 3.6 && ct < T.email11 + 4.8 ? 'forward' : 'type' });
      workstation(590, fl, [
        { r: S.noorT, fn: function (x, y, w, h) { uiTickets(x, y, w, h, noor); } },
        { r: S.noorG, fn: function (x, y, w, h) { uiGraph(x, y, w, h, { title: 'first reply time', value: '14 min', seed: 6 }); } }
      ], 'noor', { arm: p11 && ct > T.email11 + 5.6 && ct < T.email11 + 6.6 ? 'forward' : 'type' });
      if (p11) {
        storyPacket(null, mid(S.miaT), 0, ENTITIES.Interaction.color, 'Helpdesk');
        var mt = S.miaT, nt = S.noorT;
        if (arrived && rows[0].box) {
          tag(mt[0] + 20, mt[1] - 18, 'Interaction', 'email from Dana', rows[0].box[0] + rows[0].box[2] / 2, rows[0].box[1] + 2);
          tag(362, fl - 2, 'Person', 'Mia');
          DYN.involves11 = [mt[0] - 20, mt[1] - 11, 360, fl - 66];
        }
        if (mia.draftAt) tag(mt[0] - 40, mt[1] + 30, 'Agent', 'support bot', mia.draftAt[0], mia.draftAt[1]);
        if (saved && noor.views[2] && noor.views[2].box) {
          var vb = noor.views[2].box;
          tag(nt[0] + 30, nt[1] - 18, 'SavedView', 'Globex · open', vb[0] + vb[2] - 4, vb[1] + vb[3] / 2);
          tag(602, fl - 2, 'Person', 'Noor');
          DYN.createdBy = [nt[0] + 2, nt[1] - 11, 606, fl - 66];
        }
      }
    }

    function drawFinance() {
      var fl = FLR(3), ce = CEI(3);
      hangSign(1440, ce + 14, 'FINANCE & REVOPS');
      light(1000, ce + 14); light(1230, ce + 14);
      cityWindow(1400, 962, 126, 82);
      var p9 = at(9), p10 = at(10);
      // Sam's workflow
      var wf = { on: true, done: 0 };
      if (p9) { wf.done = Math.floor(clamp((ct - 0.8) / 0.9, 0, 4)); wf.running = wf.done < 4 && ct > 0.4; wf.footer = 'owner: Sam · running now'; }
      else if (step > 9) { wf.done = 4; wf.footer = 'owner: Sam · ran 14:31 ✓'; }
      else wf.footer = 'owner: Sam · last run Monday';
      workstation(880, fl, [
        { r: S.samWF, fn: function (x, y, w, h) { uiWorkflow(x, y, w, h, wf); } },
        { r: S.samG, fn: function (x, y, w, h) { uiGraph(x, y, w, h, { title: 'win rate', value: '27%', seed: 12, trend: 0.15 }); } }
      ], 'sam', { mug: true });
      // Priya's billing
      var hasSub = step > 9 || (p9 && ct > 7);
      var invSt = !p10 ? (step > 10 ? 'Paid' : null) : ct < T.inv10 ? null : ct < T.pay10 ? 'Open' : 'Paid';
      var paid = step > 10 || (p10 && ct > T.pay10);
      var rows = [{ k: 'SUB', n: 'Northwind · Basic', amt: '$900', st: 'Active' }];
      if (hasSub) rows.unshift({ k: 'SUB', n: 'Globex · Pro', amt: '$2,000', st: 'Active', hot: p10 ? ENTITIES.Subscription.color : null });
      if (invSt) rows.push({ k: 'INV', n: 'INV-0042 · Globex', amt: '$2,000', st: invSt, hot: p10 ? ENTITIES.Invoice.color : null });
      if (paid) rows.push({ k: 'PAY', n: 'Card ••4242', amt: '$2,000', st: 'Paid', hot: p10 ? ENTITIES.Payment.color : null });
      var bill = { mrr: paid ? '$184,200' : '$182,200', bump: p10 && paid, rows: rows };
      workstation(1110, fl, [
        { r: S.priBill, fn: function (x, y, w, h) { uiBilling(x, y, w, h, bill); } },
        { r: S.priSheet, fn: function (x, y, w, h) { uiSheet(x, y, w, h); } }
      ], 'priya', { mug: true });
      lw(1.3); box(1340, fl - 40, 44, 40); box(1344, fl - 52, 36, 12);
      if (mod(t, 13) < 2) { var k = mod(t, 13) / 2; box(1350, fl - 52 - k * 10, 24, 10); }
      plant(1528, fl);

      var sw = S.samWF, pb = S.priBill;
      if (p9) {
        tag(sw[0] + 40, sw[1] - 18, 'Automation', 'won deal → onboarding');
        tag(892, fl - 2, 'Person', 'Sam');
        DYN.maintained = [sw[0] - 4, sw[1] - 11, 892, fl - 66];
        if (wf.done >= 3 && wf.stepAt) { var sa = wf.stepAt(2); DYN.creates = [sw[0] + 92, sw[1] - 11, sa[0] + 2, sa[1] - 3]; }
        storyPacket(null, mid(sw), 0, ENTITIES.Automation.color, 'Workflows');
        storyPacket(mid(sw), mid(pb), 4.6, ENTITIES.Subscription.color, 'Billing');
        storyPacket(mid(sw), mid(S.tessBoard), 5, ENTITIES.Task.color, 'Board');
        storyPacket(mid(sw), mid(S.raviChat), 5.4, ENTITIES.Automation.color, 'Chat');
      }
      if (p10) {
        var R = function (key) { for (var i = 0; i < rows.length; i++) if (rows[i].k === key && rows[i].hot) return rows[i].box; return null; };
        var bs = R('SUB'), bi = R('INV'), bp = R('PAY');
        tag(1122, fl - 2, 'Person', 'Priya');
        if (bs) {
          tag(pb[0] - 50, pb[1] - 18, 'Subscription', 'Globex · Pro', bs[0] + 4, bs[1] + bs[3] / 2);
          tag(pb[0] - 50, pb[1] + 28, 'Organization', 'Globex');
          DYN.heldBy = [pb[0] - 70, pb[1] - 11, pb[0] - 70, pb[1] + 21];
        }
        if (bi) {
          tag(pb[0] + pb[2] + 70, pb[1] - 18, 'Invoice', 'INV-0042', bi[0] + bi[2] - 4, bi[1] + bi[3] / 2);
          DYN.bills = [pb[0] + pb[2] + 30, pb[1] - 25, pb[0] - 16, pb[1] - 25];
        }
        if (bp) {
          tag(pb[0] + pb[2] + 70, pb[1] + pb[3] + 30, 'Payment', 'card', bp[0] + bp[2] - 4, bp[1] + bp[3] / 2);
          DYN.settles = [pb[0] + pb[2] + 90, pb[1] + pb[3] + 23, pb[0] + pb[2] + 90, pb[1] - 11];
        }
        storyPacket(null, mid(pb), 1, ENTITIES.Invoice.color, 'Billing');
        storyPacket(null, mid(pb), 5, ENTITIES.Payment.color, 'Billing');
      }
    }

    // ---- Ground floor: Reception, kitchen, phone booths ---------------------------------------
    function drawLobby() {
      var fl = FLR(4), ce = CEI(4);
      lw(1.5);
      ctx.beginPath(); ctx.arc(318, 1194, 12, Math.PI * 0.9, Math.PI * 1.9); ctx.arc(338, 1188, 15, Math.PI * 1.15, Math.PI * 2.05); ctx.arc(358, 1196, 10, Math.PI * 1.4, Math.PI * 0.5); ctx.lineTo(310, 1206); ctx.closePath(); ctx.stroke();
      text('acme cloud', 440, 1196, 18, 'center', 800);
      light(260, ce + 4); light(520, ce + 4);
      // glass front door
      lw(1.2);
      line(X0 - 6, 1250, X0 - 6, fl); line(X0 + 6, 1250, X0 + 6, fl);
      ctx.save(); ctx.globalAlpha = 0.3; hatch(X0 - 6, 1250, 12, fl - 1250, 8, 0.6); ctx.restore();
      // reception
      person(440, fl, look('jo', { arm: 'type' }));
      lw(1.4); box(390, fl - 44, 110, 44);
      ctx.save(); ctx.globalAlpha = 0.4; hatch(390, fl - 44, 110, 44, 7, 0.5); ctx.restore();
      monitor([470, fl - 70, 26, 18], function (x, y, w, h) { textLines(x + 2, y + 4, w - 4, 3, 4, 1, 3); });
      // visitor kiosk
      lw(1.3); line(548, fl, 548, fl - 40); line(538, fl, 558, fl); box(536, fl - 58, 24, 18);
      text('Sign in', 548, fl - 49, 4.5, 'center', 800);
      // sofa with a visitor
      lw(1.3); box(206, fl - 24, 96, 14); box(206, fl - 42, 96, 18);
      person(250, fl - 8, look('g1', { seated: true, arm: 'hold' }));
      // a rider dropping off lunch
      var u = mod(t / 18, 1);
      if (u < 0.45) person(lerp(150, 520, u / 0.45), fl, look('rider', { walk: t * 9, prop: 'box' }));
      else if (u > 0.55) person(lerp(520, 150, (u - 0.55) / 0.45), fl, look('rider', { walk: t * 9, flip: true }));
      plant(600, fl, true);
    }

    function drawKitchen() {
      var fl = FLR(4), ce = CEI(4);
      hangSign(760, ce + 14, 'KITCHEN');
      light(900, ce + 14); light(1110, ce + 14);
      lw(1.3); box(636, 1180, 164, 34); line(718, 1180, 718, 1214);
      box(636, fl - 44, 164, 44); line(700, fl - 44, 700, fl); line(760, fl - 44, 760, fl);
      box(652, fl - 84, 34, 40); box(658, fl - 64, 22, 10, P.soft);
      if (mod(t, 6) < 3) mug(669, fl - 46, true);
      box(806, fl - 150, 44, 150); line(806, fl - 100, 850, fl - 100); line(844, fl - 140, 844, fl - 112); line(844, fl - 92, 844, fl - 60);
      ctx.save(); ctx.globalAlpha = 0.6; text('ship · learn · repeat', 980, 1196, 12, 'center', 800); ctx.restore();
      // the long table
      lw(1.3); box(870, fl - 34, 170, 4); line(886, fl - 30, 886, fl); line(1024, fl - 30, 1024, fl);
      if (at(6)) {
        lw(1); box(920, fl - 40, 30, 6); box(960, fl - 40, 30, 6); box(925, fl - 46, 30, 6, hexA('#E67E22', 0.2));
        person(856, fl, look('mia', { seated: true, arm: 'eat' }));
        person(884, fl, look('kai', { seated: true, arm: 'eat' }));
        person(914, fl, look('jun', { seated: true, arm: 'down' }));
        person(1000, fl, look('ravi', { seated: true, flip: true, arm: 'eat' }));
        person(1030, fl, look('lin', { seated: true, flip: true, arm: 'down' }));
        var talk = Math.floor(ct / 2.8) % 3;
        if (ct > 0.6) bubble(talk === 1 ? 900 : 1000, fl - 78, ['Globex is waiting on SSO 😬', 'Merged this morning. Ships after lunch.', 'Then the next pizza is on me.'][talk]);
        tag(900, fl - 106, 'Team', 'Platform');
        tag(1052, fl - 104, 'Team', 'Sales');
        tag(820, fl - 132, 'Team', 'Support');
        tag(980, 1222, 'Organization', 'Acme Cloud');
        DYN.partA = [920, fl - 113, 960, 1229];
        DYN.partB = [1052, fl - 111, 1020, 1229];
        DYN.partC = [830, fl - 139, 930, 1222];
        DYN.member6 = [884, fl - 56, 892, fl - 99];
        tag(884, fl - 2, 'Person', 'Kai');
      } else {
        person(900, fl, look('g2', { seated: true, arm: 'type' }));
        lw(1.1); poly([930, fl - 34, 958, fl - 34, 962, fl - 52, 934, fl - 52]);
      }
      // someone always waiting for coffee
      person(730, fl, look('g3', { flip: true, prop: 'mug', arm: 'hold' }));
      // ping-pong
      lw(1.3); box(1060, fl - 34, 120, 4); line(1120, fl - 42, 1120, fl - 30); line(1070, fl - 30, 1070, fl); line(1170, fl - 30, 1170, fl);
      person(1046, fl, look('g5', { arm: 'paddle' }));
      person(1190, fl, look('g4', { arm: 'paddle', flip: true }));
      var bp = mod(t * 0.9, 2), bx = bp < 1 ? lerp(1060, 1180, bp) : lerp(1180, 1060, bp - 1), by = fl - 44 - Math.sin(mod(bp, 1) * Math.PI) * 26;
      lw(1); circle(bx, by, 2.2, P.paper);
    }

    function drawBooths() {
      var fl = FLR(4), ce = CEI(4);
      text('PHONE BOOTHS', 1370, ce + 20, 8, 'center', 800, null, P.mid);
      [[1220, 'g1', 'Can you hear me now?'], [1348, 'g3', 'Thursday works for me.']].forEach(function (b, i) {
        var x = b[0];
        lw(1.6); box(x, fl - 130, 100, 130, false);
        ctx.save(); ctx.globalAlpha = 0.25; hatch(x + 2, fl - 128, 96, 126, 14, 0.6); ctx.restore();
        light(x + 50, fl - 130);
        chair(x + 40, fl);
        person(x + 40, fl, look(b[1], { seated: true, arm: 'phone' }));
        if (mod(t + i * 3, 7) < 3) bubble(x + 50, fl - 90, b[2]);
      });
      lw(1.2); box(1468, fl - 120, 62, 120);
      for (var s = 0; s < 3; s++) { line(1468, fl - 80 + s * 40, 1530, fl - 80 + s * 40); box(1474 + s * 6, fl - 112 + s * 40, 22, 26); }
    }

    function drawRooms() {
      drawCore();
      drawProduct();
      drawIT();
      drawLeadership();
      drawEngineering();
      drawOnCall();
      drawSales();
      drawDemo();
      drawCS();
      drawSupport();
      drawFinance();
      drawLobby();
      drawKitchen();
      drawBooths();
    }

    // =========================================================================
    // Overlays: tags, focus, relation arrows, the ontology map
    // =========================================================================

    // An entity tag: the bridge between something in the building and the model.
    // (lx, ly) optionally points a thin leader line at the exact thing.
    function tag(x, y, ent, label, lx, ly) { TAGS.push([x, y, ent, label, lx, ly]); }
    function drawTags() {
      var s = Math.max(6.5, 10.5 * px);
      TAGS.forEach(function (g) {
        var e = ENTITIES[g[2]];
        var label = g[2] + (g[3] ? ' · ' + g[3] : '');
        var w = textW(label, s, 800) + s * 2.4, h = s * 1.9;
        var x = g[0] - w / 2, y = g[1] - h / 2;
        ctx.save();
        ctx.globalAlpha *= focusK;
        if (g[4] != null) {
          var ax = clamp(g[4], x, x + w), ay = clamp(g[5], y, y + h);
          ctx.strokeStyle = e.color; lw(Math.max(1, 1.2 * px));
          line(ax, ay, g[4], g[5]);
          dot(g[4], g[5], Math.max(1.8, 2.4 * px), e.color);
        }
        ctx.strokeStyle = e.color;
        lw(Math.max(1.4, 1.6 * px));
        rbox(x, y, w, h, s * 0.4, P.paper);
        dot(x + s * 0.95, g[1], s * 0.38, e.color);
        text(label, x + s * 1.7, g[1] + 0.5, s, 'left', 800);
        ctx.restore();
      });
      ctx.strokeStyle = P.ink;
    }

    function arrow(x1, y1, x2, y2, bend, color, label, k) {
      var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      var dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
      var b = bend == null ? Math.min(40, d * 0.22) : bend;
      var cx = mx - dy / d * b, cy = my + dx / d * b;
      var head = Math.max(7, 9 * px);
      ctx.save();
      ctx.globalAlpha *= k;
      ctx.strokeStyle = color;
      lw(Math.max(1.8, 2 * px));
      ctx.setLineDash([5 * Math.max(1, px), 4 * Math.max(1, px)]);
      ctx.lineDashOffset = -t * 18;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      var ang = Math.atan2(y2 - cy, x2 - cx);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(ang - 0.42) * head, y2 - Math.sin(ang - 0.42) * head);
      ctx.lineTo(x2 - Math.cos(ang + 0.42) * head, y2 - Math.sin(ang + 0.42) * head);
      ctx.fill();
      if (label) pill(0.25 * x1 + 0.5 * cx + 0.25 * x2, 0.25 * y1 + 0.5 * cy + 0.25 * y2, label, color);
      ctx.restore();
    }
    function pill(x, y, label, color, size) {
      size = size || Math.max(6.5, 10 * px);
      var w = textW(label, size, 800) + size * 1.3, h = size * 1.75;
      ctx.strokeStyle = color;
      lw(Math.max(1.2, 1.4 * px));
      rbox(x - w / 2, y - h / 2, w, h, h / 2, P.paper);
      text(label, x, y + 0.5, size, 'center', 800, null, P.dark ? P.ink : color);
      ctx.strokeStyle = P.ink;
    }

    function drawFocus() {
      var s = TOUR[step];
      if (s.map || !s.ents.length) return;
      var r = currentRect();
      ctx.save();
      ctx.globalAlpha = 0.45 * focusK;
      ctx.fillStyle = P.paper;
      ctx.beginPath();
      ctx.rect(-600, -600, W + 1200, H + 1200);
      ctx.rect(r[0] + r[2], r[1], -r[2], r[3]);
      ctx.fill('evenodd');
      ctx.restore();
    }
    function drawStepArrows() {
      TOUR[step].rels.forEach(function (rel) {
        var p = rel.dyn ? DYN[rel.dyn] : null;
        if (!p) return;
        arrow(p[0], p[1], p[2], p[3], null, ENTITIES[rel.from].color, rel.label, focusK);
      });
    }

    function drawMap(k) {
      if (k <= 0.001) return;
      ctx.save();
      ctx.globalAlpha = 0.78 * k;
      ctx.fillStyle = P.paper;
      ctx.fillRect(-600, -600, W + 1200, H + 1200);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = k;
      function bendFor(i, d) { return (i % 2 ? 1 : -1) * Math.min(60, d * 0.12); }
      RELATIONS.forEach(function (r, i) {
        var a = ANCHORS[r[0]], b = ANCHORS[r[2]];
        var col = ENTITIES[r[0]].color;
        if (r[0] === r[2]) {
          ctx.strokeStyle = col; lw(2);
          ctx.beginPath(); ctx.arc(a[0] - 30, a[1] - 26, 22, 0, TAU); ctx.stroke();
          return;
        }
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        arrow(a[0] + dx / d * 26, a[1] + dy / d * 26, b[0] - dx / d * 34, b[1] - dy / d * 34, bendFor(i, d), col, null, 1);
      });
      RELATIONS.forEach(function (r, i) {
        var a = ANCHORS[r[0]], b = ANCHORS[r[2]];
        if (r[0] === r[2]) { pill(a[0] - 56, a[1] - 46, r[1], ENTITIES[r[0]].color, 8); return; }
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), bend = bendFor(i, d);
        pill((a[0] + b[0]) / 2 - dy / d * bend * 0.5, (a[1] + b[1]) / 2 + dx / d * bend * 0.5, r[1], ENTITIES[r[0]].color, 8);
      });
      ['Person', 'Organization', 'Agent'].forEach(function (n) {
        var a = ANCHORS[n], b = ANCHORS.Party;
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        ctx.strokeStyle = P.ink; lw(1.6);
        ctx.setLineDash([3, 3]); line(a[0] + dx / d * 26, a[1] + dy / d * 26, b[0] - dx / d * 38, b[1] - dy / d * 38); ctx.setLineDash([]);
        pill(a[0] + dx * 0.16, a[1] + dy * 0.16, 'is a', P.ink, 7);
      });
      Object.keys(ANCHORS).forEach(function (n) {
        var p = ANCHORS[n], e = ENTITIES[n];
        var R = n === 'Party' ? 32 : 24;
        ctx.strokeStyle = e.color; lw(3);
        circle(p[0], p[1], R, P.paper);
        ctx.font = (n === 'Party' ? 26 : 18) + 'px ' + FONT;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = P.ink;
        ctx.fillText(e.icon, p[0], p[1] + 1);
        ctx.strokeStyle = P.ink;
        var w = textW(n, 10, 800) + 10;
        fillRect(p[0] - w / 2, p[1] + R + 3, w, 15, e.color);
        text(n, p[0], p[1] + R + 11, 10, 'center', 800, null, '#fff');
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
      sunH = lerp(sunH, hours(TOUR[step].time), reduced ? 1 : 1 - Math.exp(-dt * 1.5));

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
      TAGS = []; PACKETS = []; cloudFlash = {};
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = P.paper;
      ctx.fillRect(0, 0, vw, vh);
      ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (vw / 2 - cam.x * cam.s), dpr * (vh / 2 - cam.y * cam.s));
      ctx.strokeStyle = P.ink;
      ctx.lineCap = 'butt';
      drawShell();
      drawRooms();
      drawPackets();
      drawSky();
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
