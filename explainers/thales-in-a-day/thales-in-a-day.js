/*!
 * Thales in a day — a school day, cut open
 *
 * A plain-JavaScript, dependency-free animation of one day at a Thales
 * Academy elementary campus, drawn from the outside of the building: two
 * brick wings, the white columned portico and the sign over the door. The
 * front wall is lifted off to show six homerooms (kindergarten to fifth
 * grade, twenty students each), a science lab, a library, the front office
 * and the multipurpose room, with the playground and the carpool lane
 * outside.
 *
 * The tour follows the day from drop-off to the last car at dismissal.
 * Small tags name what the school keeps track of (a Class, an Enrollment,
 * an Attendance record, a Lesson, a Pickup...), and the caption explains
 * them. The last stop fades the building into the graph of that model.
 *
 * An illustration: the people, names, numbers and times are made up.
 *
 * Usage:
 *   <div id="thales-scene" style="height:100vh"></div>
 *   <script src="thales-in-a-day.js"></script>
 *
 * Any element with id="thales-scene" or a data-thales-scene attribute is
 * mounted automatically. To mount by hand:
 *   ThalesInADay.mount(element, { autoplay: true });
 *
 * Everything is drawn with the Canvas 2D API at runtime: no images, fonts,
 * libraries or network requests.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // The model: what a school keeps track of in a day
  // ---------------------------------------------------------------------------

  var ENTITIES = {
    School:     { icon: '🏫', color: '#1F4E79', props: ['name', 'address'] },
    GradeLevel: { icon: '🔢', color: '#2E86AB', props: ['name', 'order'] },
    Class:      { icon: '👥', color: '#16A085', props: ['name', 'schoolYear', 'capacity'] },
    Classroom:  { icon: '🚪', color: '#9A7D0A', props: ['roomNumber', 'kind'] },
    Person:     { icon: '👤', color: '#3498DB', props: ['fullName', 'birthDate'] },
    Role:       { icon: '🎫', color: '#9B59B6', props: ['kind', 'validFrom', 'validTo'] },
    Enrollment: { icon: '🧾', color: '#5D6D7E', props: ['startDate', 'status'] },
    Subject:    { icon: '📚', color: '#D35400', props: ['name'] },
    Period:     { icon: '🕘', color: '#34495E', props: ['name', 'start', 'end'] },
    Lesson:     { icon: '📝', color: '#27AE60', props: ['number', 'date', 'topic'] },
    Assignment: { icon: '📄', color: '#7F8C8D', props: ['title', 'dueDate'] },
    Assessment: { icon: '✅', color: '#C0392B', props: ['score', 'mastered', 'date'] },
    Attendance: { icon: '🗓️', color: '#8E44AD', props: ['date', 'status'] },
    Message:    { icon: '✉️', color: '#E91E8C', props: ['sentAt', 'body'] },
    Pickup:     { icon: '🚗', color: '#B7950B', props: ['time', 'carNumber'] }
  };

  // [from, label, to]
  var RELATIONS = [
    ['Person', 'plays', 'Role'],
    ['Role', 'at', 'School'],
    ['Person', 'guardian of', 'Person'],
    ['GradeLevel', 'at', 'School'],
    ['Class', 'at', 'GradeLevel'],
    ['Class', 'meets in', 'Classroom'],
    ['Class', 'taught by', 'Person'],
    ['Enrollment', 'of', 'Person'],
    ['Enrollment', 'in', 'Class'],
    ['Period', 'at', 'School'],
    ['Lesson', 'for', 'Class'],
    ['Lesson', 'of', 'Subject'],
    ['Lesson', 'during', 'Period'],
    ['Lesson', 'taught by', 'Person'],
    ['Lesson', 'held in', 'Classroom'],
    ['Assignment', 'from', 'Lesson'],
    ['Assessment', 'of', 'Person'],
    ['Assessment', 'on', 'Lesson'],
    ['Attendance', 'of', 'Person'],
    ['Attendance', 'for', 'Class'],
    ['Message', 'from', 'Person'],
    ['Message', 'to', 'Person'],
    ['Message', 'about', 'Person'],
    ['Pickup', 'of', 'Person'],
    ['Pickup', 'by', 'Person'],
    ['Pickup', 'released by', 'Person']
  ];

  // ---------------------------------------------------------------------------
  // The campus (world units; the whole drawing is W x H)
  // ---------------------------------------------------------------------------

  var W = 2060, H = 1060;
  var X0 = 340, X1 = 1740;            // main building
  var CX0 = 900, CX1 = 1180;          // centre block with the portico
  var TOPS = [440, 660];              // upstairs, ground floor
  var GROUND = 880;
  var MPR = { x: 1740, y: 500, w: 280, h: 380 };
  var SPOT = 960;                     // where the first car stops in front of the portico
  function FLR(f) { return TOPS[f] + 215; }
  function CEI(f) { return TOPS[f] + 5; }

  function room(id, name, x, y, w, h, step) { return { id: id, name: name, x: x, y: y, w: w, h: h, step: step }; }

  var ROOMS = [
    room('r201', 'Room 201 · 4th grade', 340, 440, 280, 220, 7),
    room('lab', 'Science lab', 620, 440, 280, 220, 7),
    room('front', 'Thales Academy', 900, 380, 280, 280, 0),
    room('r203', 'Room 203 · 5th grade', 1180, 440, 280, 220, 8),
    room('lib', 'Library', 1460, 440, 280, 220, 0),
    room('r101', 'Room 101 · Kindergarten', 340, 660, 280, 220, 9),
    room('r102', 'Room 102 · 1st grade', 620, 660, 280, 220, 3),
    room('office', 'Front office', 900, 660, 280, 220, 11),
    room('r103', 'Room 103 · 2nd grade', 1180, 660, 280, 220, 2),
    room('r104', 'Room 104 · 3rd grade', 1460, 660, 280, 220, 4),
    room('mpr', 'Multipurpose room', 1740, 500, 280, 380, 6),
    room('play', 'Playground', 20, 640, 310, 240, 5),
    room('car', 'Carpool lane', 340, 880, 1400, 90, 10)
  ];

  // The six homerooms
  var HOMEROOMS = {
    r101: { x: 340, f: 1, num: '101', grade: 'Kindergarten', teacher: 'grant', tname: 'Ms. Grant', n: 20 },
    r102: { x: 620, f: 1, num: '102', grade: '1st grade', teacher: 'lopez', tname: 'Mr. Lopez', n: 20 },
    r103: { x: 1180, f: 1, num: '103', grade: '2nd grade', teacher: 'diaz', tname: 'Mrs. Diaz', n: 20, absent: 13 },
    r104: { x: 1460, f: 1, num: '104', grade: '3rd grade', teacher: 'reed', tname: 'Ms. Reed', n: 20 },
    r201: { x: 340, f: 0, num: '201', grade: '4th grade', teacher: 'hale', tname: 'Mr. Hale', n: 20 },
    r203: { x: 1180, f: 0, num: '203', grade: '5th grade', teacher: 'kim', tname: 'Mrs. Kim', n: 20 }
  };

  // Where each entity type "lives" on campus, for the graph overlay.
  var ANCHORS = {
    School: [1040, 420], Period: [560, 470], GradeLevel: [1520, 470], Classroom: [1040, 580],
    Lesson: [640, 650], Class: [1440, 650], Subject: [330, 680], Assignment: [360, 880],
    Message: [560, 830], Assessment: [800, 920], Person: [1040, 800], Role: [1210, 960],
    Pickup: [1500, 930], Enrollment: [1260, 730], Attendance: [1720, 790]
  };

  // ---------------------------------------------------------------------------
  // The tour: one school day
  // ---------------------------------------------------------------------------

  var TOUR = [
    {
      time: '07:30', rect: [0, 250, 2060, 760],
      title: 'Thales in a day',
      story: 'A Thales Academy campus with the front wall lifted off: six homerooms from kindergarten to fifth grade, twenty students in each, plus a science lab, a library, the front office and the multipurpose room. Follow one school day from the first car in the carpool line to the last.',
      note: 'A school runs on a few kinds of record: who is enrolled where, what was taught, who was here, how they did, and who took them home. Small tags name each one as it shows up. People, names and times here are made up.',
      ents: [], rels: []
    },
    {
      time: '07:40', rect: [820, 680, 600, 350], prect: [860, 640, 420, 420], min: 16, still: 9,
      title: 'Drop-off',
      story: 'Cars line up under the white columns. Mr. Ward, the headmaster, opens doors and says good morning. Ava hops out of car 214, her dad waves, and she heads inside with 119 other children in polos and khakis.',
      note: 'Ava, her dad and Mr. Ward are each a Person. What they are to the school is a Role they play: Student, Guardian, Staff. Mr. Ortiz being Ava\'s guardian is a relationship between two people, not a kind of person.',
      ents: ['Person', 'Role', 'School'],
      rels: [
        { from: 'Person', label: 'plays', to: 'Role', dyn: 'playsA' },
        { from: 'Person', label: 'plays', to: 'Role', dyn: 'playsB' },
        { from: 'Person', label: 'guardian of', to: 'Person', dyn: 'guardian' },
        { from: 'Role', label: 'at', to: 'School' }
      ]
    },
    {
      time: '07:55', rect: [1180, 660, 280, 220], min: 13,
      title: 'Homeroom',
      story: 'In Room 103 the second grade stands for the Pledge. Then Mrs. Diaz takes the roll on her laptop: nineteen here, one empty desk. Mateo is home sick today.',
      note: 'These twenty children are a Class (2nd grade) that meets in Classroom 103. Each child\'s place in it is an Enrollment. Roll call creates one Attendance record per child: 19 present, 1 absent.',
      ents: ['Class', 'Enrollment', 'Attendance', 'Classroom', 'GradeLevel'],
      rels: [
        { from: 'Enrollment', label: 'in', to: 'Class', dyn: 'enrolIn' },
        { from: 'Attendance', label: 'of', to: 'Person', dyn: 'attOf' },
        { from: 'Class', label: 'meets in', to: 'Classroom', dyn: 'meetsIn' },
        { from: 'Class', label: 'at', to: 'GradeLevel' }
      ]
    },
    {
      time: '08:10', rect: [620, 660, 280, 220], min: 12,
      title: 'Reading, the Direct Instruction way',
      story: 'Mr. Lopez sits with a reading group of six. Point, pause, signal, and six voices answer together: "sat!" The other fourteen work through their reading sheets. The script is fast, and every child answers every time.',
      note: 'This is Lesson 87 of Reading, for the 1st grade Class, during first period, taught by Mr. Lopez. A Lesson ties a Subject, a Class, a Period and a teacher together, so the school knows what was taught, to whom and when.',
      ents: ['Lesson', 'Subject', 'Period', 'Class'],
      rels: [
        { from: 'Lesson', label: 'of', to: 'Subject', dyn: 'lessonOf' },
        { from: 'Lesson', label: 'during', to: 'Period', dyn: 'during' },
        { from: 'Lesson', label: 'taught by', to: 'Person', dyn: 'lessonBy' },
        { from: 'Lesson', label: 'for', to: 'Class' }
      ]
    },
    {
      time: '09:20', rect: [1460, 660, 280, 220], min: 13,
      title: 'Math, then on your own',
      story: 'Ms. Reed works examples on the board and the class answers on her signal. Then it\'s workbook time: page 112, problems 1 to 10, while Ms. Reed walks the rows checking work. Upstairs, fifth grade is in the gym for PE.',
      note: 'The workbook page is an Assignment from today\'s math Lesson. The Class is taught by Ms. Reed, a Person playing the Teacher role.',
      ents: ['Assignment', 'Lesson', 'Class', 'Person'],
      rels: [
        { from: 'Assignment', label: 'from', to: 'Lesson', dyn: 'assignFrom' },
        { from: 'Class', label: 'taught by', to: 'Person', dyn: 'taughtBy' }
      ]
    },
    {
      time: '10:15', rect: [10, 670, 350, 225], min: 11,
      title: 'Recess',
      story: 'Kindergarten and first grade, forty children, burst onto the playground. Swings, the slide, a game of tag. Coach Cole counts heads by the fence.',
      note: 'Recess is a Period in the daily schedule, just like first-period reading or lunch. The schedule belongs to the School, which is why every Lesson can point at the Period it happens in.',
      ents: ['Period', 'School'],
      rels: [{ from: 'Period', label: 'at', to: 'School', dyn: 'periodAt' }]
    },
    {
      time: '11:30', rect: [1735, 495, 300, 390], min: 11,
      title: 'Lunch',
      story: 'Third, fourth and fifth grade eat in the multipurpose room. Each class has its own long table, twenty to a table. Lunchboxes open and the noise level rises.',
      note: 'Each table is a Class, each Class belongs to a GradeLevel, and each GradeLevel belongs to the School. Sixty students, three classes, three grade levels, one school.',
      ents: ['Class', 'GradeLevel', 'School'],
      rels: [
        { from: 'Class', label: 'at', to: 'GradeLevel', dyn: 'classAt' },
        { from: 'GradeLevel', label: 'at', to: 'School', dyn: 'gradeAt' }
      ]
    },
    {
      time: '12:40', rect: [340, 440, 560, 222], min: 11,
      title: 'Science lab',
      story: 'Fourth grade heads next door to the science lab: a battery, a bulb, and which materials make the light come on. Room 201 sits empty for the hour.',
      note: 'The Class meets in Classroom 201, but this Lesson is held in the lab. Recording where a class lives separately from where each lesson happens is what lets one lab serve every grade.',
      ents: ['Classroom', 'Lesson', 'Class'],
      rels: [
        { from: 'Lesson', label: 'held in', to: 'Classroom', dyn: 'heldIn' },
        { from: 'Class', label: 'meets in', to: 'Classroom', dyn: 'meetsIn7' }
      ]
    },
    {
      time: '13:30', rect: [1180, 440, 280, 220], min: 13,
      title: 'Mastery test',
      story: 'Fifth grade takes the unit test in silence. Afterwards Mrs. Kim enters the scores: eighteen of twenty above the mastery line. Ben and Zoe will get a firm-up lesson tomorrow.',
      note: 'Each score is an Assessment of one student on one Lesson. That makes twenty Assessments, one per enrolled child, and the two below mastery are easy to find.',
      ents: ['Assessment', 'Person', 'Lesson'],
      rels: [
        { from: 'Assessment', label: 'of', to: 'Person', dyn: 'assessOf' },
        { from: 'Assessment', label: 'on', to: 'Lesson', dyn: 'assessOn' }
      ]
    },
    {
      time: '14:20', shots: [[0, [340, 660, 280, 220]], [5.2, [330, 640, 1420, 250]], [9, [1460, 660, 280, 220]]], min: 15,
      title: 'A note home',
      story: 'Quiet time in kindergarten. Ms. Grant sends a note home: "Leo read his first sentence today!" It goes to Leo\'s guardian, who happens to teach third grade at the other end of the hall.',
      note: 'A Message is from one Person, to another, about a third: from Ms. Grant, to Ms. Reed, about Leo.',
      ents: ['Message', 'Person'],
      rels: [
        { from: 'Message', label: 'from', to: 'Person', dyn: 'msgFrom' },
        { from: 'Message', label: 'about', to: 'Person', dyn: 'msgAbout' },
        { from: 'Message', label: 'to', to: 'Person', dyn: 'msgTo' }
      ]
    },
    {
      time: '15:00', rect: [700, 680, 720, 350], prect: [740, 640, 560, 440], min: 18, still: 12,
      title: 'Dismissal',
      story: 'The bell. Cars wind around the building with numbers on the dashboard. Mr. Ward calls them into a walkie-talkie and each child walks out to the right car. Ms. Reed collects Leo from kindergarten and heads out too.',
      note: 'Each hand-off is a Pickup: of a student, by a guardian, released by a staff member. Ms. Reed is one Person with two Roles, Teacher and Guardian, and nothing about Ms. Reed has to be copied.',
      ents: ['Pickup', 'Person', 'Role'],
      rels: [
        { from: 'Pickup', label: 'of', to: 'Person', dyn: 'pickOf' },
        { from: 'Pickup', label: 'by', to: 'Person', dyn: 'pickBy' },
        { from: 'Pickup', label: 'released by', to: 'Person', dyn: 'pickRel' },
        { from: 'Person', label: 'plays', to: 'Role', dyn: 'reedT' },
        { from: 'Person', label: 'plays', to: 'Role', dyn: 'reedG' }
      ]
    },
    {
      time: '16:00', rect: [900, 660, 280, 220], min: 11,
      title: 'Closing the day',
      story: 'The last car pulls away. In the front office Mrs. Patel closes out the day: 119 of 120 present, 119 picked up, every one by someone on the list. The custodian is already mopping the front porch.',
      note: 'Because each Attendance and each Pickup is its own record, a question like "who took Leo home on Tuesday?" has an exact answer, and so does "who was absent this week?"',
      ents: ['Attendance', 'Pickup', 'School'],
      rels: [
        { from: 'Attendance', label: 'of', to: 'Person' },
        { from: 'Pickup', label: 'by', to: 'Person' }
      ]
    },
    {
      time: '17:00', rect: [0, 250, 2060, 760], map: true,
      title: 'The same day, as a map',
      story: 'Take the building away and keep only what the school keeps track of.',
      note: 'Each kind of thing you saw is an entity type, and each arrow is a relationship. Most arrows end at Person: student, teacher, guardian or staff.',
      ents: [], rels: [], outro: true
    }
  ];

  var LOOK = {
    grant: { hair: 'bun' }, lopez: { hair: 'short', glasses: true }, diaz: { hair: 'long' },
    reed: { hair: 'long', glasses: true }, hale: { hair: 'bald', glasses: true }, kim: { hair: 'bun', glasses: true },
    patel: { hair: 'long' }, ward: { hair: 'short', tie: true }, lib: { hair: 'curly', glasses: true },
    cole: { hair: 'cap' }, cust: { hair: 'cap' }, ortiz: { hair: 'short' }
  };

  // Students: deterministic looks from an index
  var KHAIR = ['short', 'pony', 'long', 'curly', 'short', 'pigtails', 'buzz', 'bun', 'long', 'short'];
  var POLO = ['#2C3E70', '#FFFFFF', '#8EC5E8', '#8B2F3C', '#3C7A55', '#FFFFFF', '#E8C547', '#2C3E70'];
  var NAMES = ['Ava', 'Noah', 'Mia', 'Eli', 'Ruby', 'Owen', 'Lily', 'Jack', 'Nora', 'Leo', 'Ivy', 'Sam', 'Emma', 'Mateo', 'Zoe', 'Ben', 'Grace', 'Luke', 'Ella', 'Max'];
  var SCORES = [92, 88, 95, 84, 90, 72, 86, 91, 97, 83, 89, 94, 81, 87, 93, 68, 85, 90, 88, 96];   // 5th grade test: Ben (5) and Zoe (15) below 80

  // ---------------------------------------------------------------------------
  // Styles (injected once)
  // ---------------------------------------------------------------------------

  var CSS = [
    '.tia-root{--tia-paper:#fbfaf6;--tia-ink:#1c1c1c;--tia-muted:#5d5d5d;--tia-card:rgba(251,250,246,.94);--tia-line:rgba(28,28,28,.18);',
    'position:relative;width:100%;height:100%;min-height:420px;display:flex;flex-direction:column;background:var(--tia-paper);color:var(--tia-ink);',
    'font:15px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden;outline:none;-webkit-tap-highlight-color:transparent}',
    '@media (prefers-color-scheme:dark){.tia-root:not([data-theme="light"]){--tia-paper:#151515;--tia-ink:#e9e6df;--tia-muted:#a7a39b;--tia-card:rgba(21,21,21,.93);--tia-line:rgba(233,230,223,.2)}}',
    '.tia-root[data-theme="dark"]{--tia-paper:#151515;--tia-ink:#e9e6df;--tia-muted:#a7a39b;--tia-card:rgba(21,21,21,.93);--tia-line:rgba(233,230,223,.2)}',
    '.tia-stage{position:relative;flex:1 1 auto;min-height:0;touch-action:none;cursor:grab}',
    '.tia-stage.tia-hover{cursor:pointer}.tia-stage.tia-drag{cursor:grabbing}',
    '.tia-stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}',
    '.tia-tip{position:absolute;pointer-events:none;padding:3px 8px;border:1px solid var(--tia-ink);background:var(--tia-paper);font-size:12px;font-weight:600;white-space:nowrap;transform:translate(-50%,-130%);opacity:0;transition:opacity .12s}',
    '.tia-tip.tia-on{opacity:1}',
    '.tia-card{position:absolute;left:16px;bottom:16px;width:min(440px,calc(100% - 32px));background:var(--tia-card);border:1.5px solid var(--tia-ink);box-shadow:4px 4px 0 var(--tia-line);padding:14px 16px 12px;box-sizing:border-box;z-index:2;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}',
    '.tia-kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--tia-muted);display:flex;justify-content:space-between;gap:8px}',
    '.tia-kicker b{color:var(--tia-ink);font-weight:700;font-variant-numeric:tabular-nums}',
    '.tia-title{margin:4px 0 6px;font-size:19px;line-height:1.25;font-weight:700;letter-spacing:-.01em}',
    '.tia-body{margin:0;font-size:14.5px;color:var(--tia-ink)}',
    '.tia-model{margin-top:10px;padding-top:8px;border-top:1px dashed var(--tia-line)}',
    '.tia-model h3{margin:0 0 3px;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--tia-muted);font-weight:700}',
    '.tia-note{margin:0;font-size:13.5px;color:var(--tia-ink)}',
    '.tia-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '.tia-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--tia-line);padding:1px 8px 1px 6px;font-size:12.5px;font-weight:600;background:var(--tia-paper)}',
    '.tia-chip i{width:9px;height:9px;border-radius:50%;display:inline-block}',
    '.tia-rels{margin:8px 0 0;padding:0;list-style:none;font-size:12.5px;color:var(--tia-muted)}',
    '.tia-rels li{margin:2px 0}.tia-rels b{color:var(--tia-ink);font-weight:600}.tia-rels em{font-style:normal;border-bottom:1.5px dashed currentColor;color:var(--tia-ink)}',
    '.tia-ctrl{display:flex;align-items:center;gap:6px;margin-top:12px}',
    '.tia-btn{appearance:none;border:1.5px solid var(--tia-ink);background:var(--tia-paper);color:var(--tia-ink);font:inherit;font-size:13px;font-weight:600;height:32px;min-width:32px;padding:0 9px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}',
    '.tia-btn:hover{background:var(--tia-ink);color:var(--tia-paper)}',
    '.tia-btn:focus-visible{outline:2px solid var(--tia-ink);outline-offset:2px}',
    '.tia-btn[aria-pressed="true"]{background:var(--tia-ink);color:var(--tia-paper)}',
    '.tia-dots{flex:1;display:flex;gap:3px;align-items:center;min-width:0}',
    '.tia-dot{flex:1;height:4px;background:var(--tia-line);border:0;padding:0;cursor:pointer;position:relative;min-width:0}',
    '.tia-dot.tia-done{background:var(--tia-ink)}',
    '.tia-dot span{position:absolute;left:0;top:0;bottom:0;background:var(--tia-ink)}',
    '@media (max-width:720px){.tia-card{position:relative;left:auto;bottom:auto;width:auto;margin:0;border-width:1.5px 0 0;box-shadow:none;max-height:48%;overflow:auto;padding:12px 16px}',
    '.tia-title{font-size:17px}.tia-body{font-size:14px}.tia-note{font-size:13px}}'
  ].join('');

  function injectCss() {
    if (document.getElementById('tia-style')) return;
    var s = document.createElement('style');
    s.id = 'tia-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------------------------------------------------------------------------
  // Small helpers
  // ---------------------------------------------------------------------------

  var FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  var SERIF = 'Georgia, "Times New Roman", serif';
  var TAU = Math.PI * 2;
  var OK = '#27AE60', BAD = '#D64541', RUN = '#E6A100', GREY = '#8a8a8a';
  var BRICK = '#A0522D';

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
  function noise(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  // ---------------------------------------------------------------------------
  // Scene
  // ---------------------------------------------------------------------------

  function mount(host, options) {
    if (!host || host.__tia) return host && host.__tia;
    var opts = options || {};
    injectCss();

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---- DOM ---------------------------------------------------------------
    var root = el('div', 'tia-root', host);
    root.tabIndex = 0;
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Thales in a day: an animated school day, explaining what the school keeps track of');
    if (opts.theme) root.setAttribute('data-theme', opts.theme);

    var stage = el('div', 'tia-stage', root);
    var canvas = el('canvas', null, stage);
    canvas.setAttribute('aria-hidden', 'true');
    var tip = el('div', 'tia-tip', stage);

    var card = el('div', 'tia-card', root);
    card.setAttribute('aria-live', 'polite');
    var kicker = el('div', 'tia-kicker', card);
    var kStep = el('span', null, kicker);
    el('span', null, kicker).textContent = 'Thales in a day';
    var title = el('h2', 'tia-title', card);
    var body = el('p', 'tia-body', card);
    var model = el('div', 'tia-model', card);
    el('h3', null, model).textContent = 'In the model';
    var note = el('p', 'tia-note', model);
    var chips = el('div', 'tia-chips', model);
    var rels = el('ul', 'tia-rels', model);

    var ctrl = el('div', 'tia-ctrl', card);
    var bPrev = el('button', 'tia-btn', ctrl);
    bPrev.type = 'button'; bPrev.textContent = '‹'; bPrev.setAttribute('aria-label', 'Previous stop');
    var bPlay = el('button', 'tia-btn', ctrl);
    bPlay.type = 'button';
    var bNext = el('button', 'tia-btn', ctrl);
    bNext.type = 'button'; bNext.textContent = '›'; bNext.setAttribute('aria-label', 'Next stop');
    var dots = el('div', 'tia-dots', ctrl);
    var bMap = el('button', 'tia-btn', ctrl);
    bMap.type = 'button'; bMap.textContent = 'Map'; bMap.title = 'Show the model as a graph over the building';
    bMap.setAttribute('aria-pressed', 'false');

    var dotEls = TOUR.map(function (s, i) {
      var d = el('button', 'tia-dot', dots);
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
    var stepClock = 0, ct = reduced ? TOUR[step].still || 40 : 0;
    var mapOn = false, mapK = 0;
    var t = 0;
    var sunH = hours(TOUR[step].time);
    var vw = 1, vh = 1, dpr = 1, insetL = 0, insetB = 0;
    var cam = { x: W / 2, y: H / 2, s: 0.4 };
    var free = false, hoverRoom = null, focusK = 0, visible = true;
    var P = { paper: '#fbfaf6', ink: '#1c1c1c', soft: 'rgba(28,28,28,.07)', faint: 'rgba(28,28,28,.17)', mid: 'rgba(28,28,28,.45)', dark: false };
    var px = 1;
    var MAX_ZOOM = 3.4;
    var DYN = {}, TAGS = [];

    function stepDuration(i) {
      var s = TOUR[i];
      var words = (s.title + ' ' + s.story + ' ' + s.note).split(/\s+/).length;
      return Math.max(s.min || 0, 11, words / 3.4 + 3);
    }
    function at(i) { return step === i; }
    function seg(a, b) { return clamp((ct - a) / (b - a), 0, 1); }

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
        var c = el('span', 'tia-chip', chips);
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
      dotEls.forEach(function (d, i) {
        d.className = 'tia-dot' + (i < step ? ' tia-done' : '');
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
      ct = reduced ? TOUR[step].still || 40 : 0;   // reduced motion: hold one telling moment of the stop
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
      if (vw < 600 && s.prect) return s.prect;
      if (!s.shots) return s.rect;
      var r = s.shots[0][1];
      s.shots.forEach(function (sh) { if (ct >= sh[0]) r = sh[1]; });
      return r;
    }
    function fit(r) {
      var pad = 0.94;
      var regions = [[0, 0, vw, vh - insetB], [insetL, 0, vw - insetL, vh]];
      var best = null;
      regions.forEach(function (g) {
        if (g[2] < 40 || g[3] < 40) return;
        var s = Math.min(g[2] / r[2], g[3] / r[3]) * pad;
        if (!best || s > best.s) best = { s: s, x: r[0] + r[2] / 2 - (g[0] + g[2] / 2 - vw / 2) / s, y: r[1] + r[3] / 2 - (g[1] + g[3] / 2 - vh / 2) / s };
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
        f.x += Math.sin(t * 0.13) * 5 / d;
        f.y += Math.cos(t * 0.17) * 3 / d;
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
      if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; drag = { pinch: Math.hypot(a[0] - b[0], a[1] - b[1]), s: cam.s }; }
    });
    stage.addEventListener('pointermove', function (e) {
      var p = local(e);
      if (!pointers[e.pointerId]) {
        var w = toWorld(p[0], p[1]);
        hoverRoom = roomAt(w[0], w[1]);
        stage.classList.toggle('tia-hover', !!hoverRoom);
        if (hoverRoom) { tip.textContent = hoverRoom.name; tip.style.left = p[0] + 'px'; tip.style.top = p[1] + 'px'; }
        tip.classList.toggle('tia-on', !!hoverRoom);
        return;
      }
      var prev = pointers[e.pointerId];
      pointers[e.pointerId] = p;
      var ids = Object.keys(pointers);
      if (ids.length === 2 && drag && drag.pinch) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (drag.s * Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.pinch) / cam.s);
        moved += 10;
        return;
      }
      var dx = p[0] - prev[0], dy = p[1] - prev[1];
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > 6) { takeOver(); stage.classList.add('tia-drag'); cam.x -= dx / cam.s; cam.y -= dy / cam.s; }
    });
    function endPointer(e) {
      var p = pointers[e.pointerId];
      delete pointers[e.pointerId];
      stage.classList.remove('tia-drag');
      if (p && moved <= 6 && e.type === 'pointerup') {
        var w = toWorld(p[0], p[1]), q = roomAt(w[0], w[1]);
        if (q) { playing = false; go(q.step, true); }
      }
      if (!Object.keys(pointers).length) drag = null;
    }
    stage.addEventListener('pointerup', endPointer);
    stage.addEventListener('pointercancel', endPointer);
    stage.addEventListener('pointerleave', function () { tip.classList.remove('tia-on'); hoverRoom = null; });
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
    if (window.IntersectionObserver) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; }).observe(root);

    function readPalette() {
      var cs = getComputedStyle(root);
      var paper = cs.getPropertyValue('--tia-paper').trim() || '#fbfaf6';
      var ink = cs.getPropertyValue('--tia-ink').trim() || '#1c1c1c';
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
    function textW(s, size, weight, font) { ctx.font = (weight || 600) + ' ' + size + 'px ' + (font || FONT); return ctx.measureText(s).width; }
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
    // brick, as seen in the photo: a warm fill with coursing lines
    function brick(x, y, w, h) {
      ctx.save();
      ctx.fillStyle = hexA(BRICK, P.dark ? 0.35 : 0.22);
      ctx.fillRect(x, y, w, h);
      ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      ctx.strokeStyle = hexA(BRICK, P.dark ? 0.7 : 0.45);
      lw(0.6);
      ctx.beginPath();
      for (var r = 0, yy = y + 5; yy < y + h; yy += 5, r++) {
        ctx.moveTo(x, yy); ctx.lineTo(x + w, yy);
        for (var xx = x + (r % 2 ? 6 : 0); xx < x + w; xx += 12) { ctx.moveTo(xx, yy - 5); ctx.lineTo(xx, yy); }
      }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = P.ink;
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
    function clock(x, y, r) {
      lw(1.2); circle(x, y, r);
      var hh = sunH, a1 = (hh % 12) / 12 * TAU - Math.PI / 2, a2 = (hh % 1) * TAU - Math.PI / 2;
      lw(1.3); line(x, y, x + Math.cos(a1) * r * 0.5, y + Math.sin(a1) * r * 0.5);
      lw(0.9); line(x, y, x + Math.cos(a2) * r * 0.8, y + Math.sin(a2) * r * 0.8);
      for (var i = 0; i < 12; i++) { var a = i * TAU / 12; fillRect(x + Math.cos(a) * r * 0.82 - 0.5, y + Math.sin(a) * r * 0.82 - 0.5, 1, 1, P.ink); }
    }
    function flag(x, y, s) {
      s = s || 1;
      lw(1); line(x, y, x, y + 46 * s);
      var w = 24 * s, h = 15 * s, wave = Math.sin(t * 2 + x) * 1.2;
      ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
      for (var i = 0; i < 7; i++) fillRect(x, y + i * h / 6.5, w, h / 13, hexA(BAD, 0.65));
      fillRect(x, y, w * 0.42, h * 0.54, hexA('#2C3E70', 0.75));
      ctx.restore();
      lw(0.7); ctx.strokeRect(x, y + wave * 0.2, w, h);
    }
    function plant(x, floor, k) {
      k = k || 1;
      lw(1.1);
      poly([x - 7 * k, floor - 14 * k, x + 7 * k, floor - 14 * k, x + 5 * k, floor, x - 5 * k, floor]);
      for (var i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(x, floor - 14 * k);
        ctx.quadraticCurveTo(x + i * 6 * k, floor - 30 * k, x + i * 9 * k, floor - 34 * k + Math.abs(i) * 4 * k);
        ctx.stroke();
      }
    }
    function tree(x, ground, k) {
      lw(1.3);
      line(x, ground, x, ground - 70 * k);
      for (var b = 0; b < 6; b++) circle(x + Math.cos(b * 1.1) * 24 * k, ground - 96 * k + Math.sin(b * 1.7) * 18 * k, 22 * k);
    }

    // An adult, feet at (x, y), facing us. o: look + { walk, seated, arm, flip, s, prop }
    function person(x, y, o) {
      o = o || {};
      var s = (o.s || 1) * 1.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(o.flip ? -s : s, s);
      lw(1.3);
      ctx.lineCap = 'round';
      var headY, shY, hipY, hr = o.kid ? 6.6 : 5.5;
      if (o.seated) {
        hipY = -17; shY = -35; headY = -42;
        line(-1, hipY, 11, hipY); line(11, hipY, 11, -1); line(11, -1, 14, -1);
        line(1, hipY + 1.5, 13, hipY + 1.5); line(13, hipY + 1.5, 13.5, -1);
      } else {
        hipY = -18; shY = -37; headY = o.kid ? -45 : -44;
        var sw = o.walk == null ? 0 : Math.sin(o.walk) * 5;
        lw(1.6); ctx.strokeStyle = o.kid ? hexA('#8B7A55', 1) : P.ink;
        line(-2.5, hipY, -2.5 + sw, -1); line(2.5, hipY, 2.5 - sw, -1);
        ctx.strokeStyle = P.ink; lw(1.3);
        line(-2.5 + sw, -1, 0.5 + sw, -1); line(2.5 - sw, -1, 5.5 - sw, -1);
      }
      ctx.beginPath();
      ctx.moveTo(-6, shY + 3); ctx.quadraticCurveTo(-6, shY, -3.5, shY);
      ctx.lineTo(3.5, shY); ctx.quadraticCurveTo(6, shY, 6, shY + 3);
      ctx.lineTo(5.5, hipY); ctx.lineTo(-5.5, hipY); ctx.closePath();
      ctx.fillStyle = o.shirt || P.paper; ctx.fill(); ctx.stroke();
      lw(0.8);
      if (o.tie) { line(0, shY, 0, shY + 10); poly([-1.2, shY + 9, 1.2, shY + 9, 0, shY + 13], P.ink); }
      else if (o.kid) { line(-2, shY, 0, shY + 3); line(0, shY + 3, 2, shY); }
      lw(1.3);
      var sy = shY + 2, arm = o.arm || 'down';
      if (arm === 'down') { line(-6, sy, -8, sy + 15); line(6, sy, 8, sy + 15); }
      else if (arm === 'up') { line(-6, sy, -8, sy + 15); line(6, sy, 12, sy - 12); }
      else if (arm === 'wave') { line(-6, sy, -8, sy + 15); var wv = Math.sin(t * 8) * 3; line(6, sy, 12 + wv, sy - 12); }
      else if (arm === 'point') { line(-6, sy, -8, sy + 15); line(6, sy, 17, sy - 7); }
      else if (arm === 'forward') { line(-6, sy, -8, sy + 15); line(6, sy, 16, sy + 5); }
      else if (arm === 'type') { var j = Math.sin(t * 14 + x) * 1.2; line(5, sy + 1, 14, sy + 10 + j); line(-3, sy + 1, 10, sy + 11 - j); }
      else if (arm === 'radio') { line(-6, sy, -8, sy + 15); line(6, sy, 9, sy + 7); line(9, sy + 7, 5, sy - 5); fillRect(3.5, sy - 9, 3, 6, P.ink); }
      else if (arm === 'hold') { line(-6, sy, -8, sy + 15); line(6, sy, 13, sy + 9); line(13, sy + 9, 17, sy + 4); }
      else if (arm === 'hand') { line(-6, sy, -8, sy + 15); line(6, sy, 11, sy + 16); }
      else if (arm === 'run') { var r = Math.sin(t * 10 + x) * 6; line(-6, sy, -9 - r * 0.5, sy + 12); line(6, sy, 9 + r * 0.5, sy + 10); }
      else if (arm === 'cheer') { line(-6, sy, -11, sy - 11); line(6, sy, 11, sy - 11); }
      else if (arm === 'mop') { line(-6, sy, -8, sy + 15); line(6, sy, 12, sy + 8); lw(1.4); line(14, sy - 12, 22, -2); lw(1); box(14, -3, 16, 3, P.paper); for (var m = 0; m < 4; m++) line(16 + m * 4, 0, 15 + m * 4, 2); lw(1.3); }
      if (o.prop === 'book') { lw(1); box(8, sy + 4, 11, 8); line(13.5, sy + 4, 13.5, sy + 12); }
      if (o.prop === 'backpack') { lw(1); rbox(-11, sy + 1, 6, 11, 1.5, hexA('#2C3E70', 0.4)); }
      if (o.prop === 'whistle') { lw(0.8); line(-2, shY, 1, shY + 6); dot(1, shY + 7, 1.2, P.ink); }
      lw(1.3);
      circle(0, headY, hr);
      ctx.fillStyle = P.ink;
      var hair = o.hair || 'short';
      if (hair !== 'bald' && hair !== 'buzz') { ctx.beginPath(); ctx.arc(0, headY, hr + 0.1, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); }
      if (hair === 'long' || hair === 'pony') { ctx.fillRect(-hr - 0.6, headY - 1, 2.2, 9); ctx.fillRect(hr - 1.6, headY - 1, 2.2, 9); }
      if (hair === 'bun') { ctx.beginPath(); ctx.arc(-1, headY - hr - 1, 2.6, 0, TAU); ctx.fill(); }
      if (hair === 'pigtails') { ctx.beginPath(); ctx.arc(-hr - 1.5, headY - 1, 2.2, 0, TAU); ctx.arc(hr + 1.5, headY - 1, 2.2, 0, TAU); ctx.fill(); }
      if (hair === 'curly') for (var c = 0; c < 6; c++) { var ca = Math.PI * (1.02 + c * 0.19); ctx.beginPath(); ctx.arc(Math.cos(ca) * hr, headY + Math.sin(ca) * hr, 2, 0, TAU); ctx.fill(); }
      if (hair === 'cap') { ctx.fillRect(-6, headY - 4.5, 12, 2.2); ctx.fillRect(4, headY - 3.5, 5, 1.6); }
      if (o.glasses) { lw(0.8); circle(-2.2, headY + 0.5, 1.6, false); circle(2.6, headY + 0.5, 1.6, false); line(-0.6, headY + 0.5, 1, headY + 0.5); }
      ctx.restore();
    }
    function look(name, extra) {
      var o = {}, k, base = LOOK[name] || {};
      for (k in base) o[k] = base[k];
      for (k in extra) o[k] = extra[k];
      return o;
    }
    function polo(i) { var c = POLO[i % POLO.length]; return c === '#FFFFFF' ? P.paper : hexA(c, 0.42); }
    // a running or walking child, seen from the side
    function kid(x, y, i, o) {
      o = o || {};
      o.kid = true; o.hair = o.hair || KHAIR[i % KHAIR.length]; o.shirt = polo(i);
      o.s = (o.s || 1) * 0.62;
      person(x, y, o);
    }

    // A child seen from behind: at a desk, or standing. y = floor under them.
    function kidBack(x, y, s, i, o) {
      o = o || {};
      var hair = KHAIR[(i * 3 + 1) % KHAIR.length];
      ctx.save();
      ctx.translate(x, y); ctx.scale(s, s);
      ctx.lineCap = 'round';
      var stand = o.stand, hip = stand ? -18 : -12, sh = hip - 16, hy = sh - 7 + (o.down ? 1.5 : 0);
      if (o.desk !== false && !stand) {
        lw(1.1);
        box(-16, hip - 11, 32, 4);
        line(-14, hip - 7, -14, 0); line(14, hip - 7, 14, 0);
        if (o.paper) fillRect(-9, hip - 13, 14, 2, P.ink);
      }
      if (stand) { lw(2.4); ctx.strokeStyle = hexA(i % 3 ? '#B9A06E' : '#2C3E70', 0.9); line(-3, hip, -3, -1); line(3, hip, 3, -1); ctx.strokeStyle = P.ink; }
      lw(1.1);
      ctx.beginPath();
      ctx.moveTo(-7, sh + 3); ctx.quadraticCurveTo(-7, sh, -4, sh); ctx.lineTo(4, sh); ctx.quadraticCurveTo(7, sh, 7, sh + 3);
      ctx.lineTo(6, hip); ctx.lineTo(-6, hip); ctx.closePath();
      ctx.fillStyle = polo(i); ctx.fill(); ctx.stroke();
      var arm = o.arm || 'down';
      if (arm === 'up') { line(6, sh + 2, 10, sh - 14); circle(10.3, sh - 15.6, 1.7); }
      else if (arm === 'write') { line(-7, sh + 3, -10, sh + 8); line(7, sh + 3, 10, sh + 8); }
      else if (arm === 'heart') { line(-7, sh + 3, -8, hip - 1); line(7, sh + 3, 10, sh + 7); line(10, sh + 7, 3, sh + 5); }
      else { line(-7, sh + 3, -8, hip - 1); line(7, sh + 3, 8, hip - 1); }
      if (o.backpack) { lw(1); rbox(-6, sh + 2, 12, 12, 2, hexA('#2C3E70', 0.45)); }
      if (!stand && o.chair !== false) {
        lw(1); rbox(-7.5, hip - 9, 15, 8, 1.5, P.paper);
        line(-6, hip - 1, -6, 0); line(6, hip - 1, 6, 0);
      }
      lw(1.1);
      circle(0, hy, 5.8);
      ctx.fillStyle = P.ink;
      if (hair === 'buzz') { ctx.save(); ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(0, hy, 5.9, Math.PI * 0.85, Math.PI * 2.15); ctx.fill(); ctx.restore(); }
      else { ctx.beginPath(); ctx.arc(0, hy, 6, Math.PI * 0.78, Math.PI * 2.22); ctx.closePath(); ctx.fill(); }
      if (hair === 'long') ctx.fillRect(-5.5, hy, 11, 8);
      if (hair === 'pony') { ctx.beginPath(); ctx.ellipse(0, hy + 6, 2.2, 4.5, 0, 0, TAU); ctx.fill(); }
      if (hair === 'pigtails') { ctx.beginPath(); ctx.arc(-6.5, hy + 3, 2.3, 0, TAU); ctx.arc(6.5, hy + 3, 2.3, 0, TAU); ctx.fill(); }
      if (hair === 'bun') { ctx.beginPath(); ctx.arc(0, hy - 6, 2.6, 0, TAU); ctx.fill(); }
      if (hair === 'curly') for (var c = 0; c < 7; c++) { var a = Math.PI * (0.8 + c * 0.24); ctx.beginPath(); ctx.arc(Math.cos(a) * 5.6, hy + Math.sin(a) * 5.6, 2.1, 0, TAU); ctx.fill(); }
      ctx.restore();
    }
    // a child facing us across a table (lunch): only the top half shows
    function kidFront(x, y, s, i, o) {
      o = o || {};
      ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
      lw(1.1);
      ctx.beginPath(); ctx.moveTo(-7, -14); ctx.quadraticCurveTo(-7, -17, -4, -17); ctx.lineTo(4, -17); ctx.quadraticCurveTo(7, -17, 7, -14); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.closePath();
      ctx.fillStyle = polo(i); ctx.fill(); ctx.stroke();
      var e = mod(t * 0.7 + i * 0.37, 2) < 1 && o.eat;
      line(7, -14, 10, e ? -20 : -4);
      circle(0, -24, 5.8);
      ctx.fillStyle = P.ink;
      var hair = KHAIR[(i * 5 + 2) % KHAIR.length];
      if (hair !== 'buzz') { ctx.beginPath(); ctx.arc(0, -24, 5.9, Math.PI * 1.02, Math.PI * 1.98); ctx.closePath(); ctx.fill(); }
      if (hair === 'long' || hair === 'pony') { ctx.fillRect(-6.5, -25, 2.2, 8); ctx.fillRect(4.3, -25, 2.2, 8); }
      if (hair === 'pigtails') { ctx.beginPath(); ctx.arc(-7.5, -25, 2.1, 0, TAU); ctx.arc(7.5, -25, 2.1, 0, TAU); ctx.fill(); }
      if (o.talk && mod(t + i, 4) < 1.2) { ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(0, -21.5, 1.6, 1.1 + Math.abs(Math.sin(t * 9)) * 0.8, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }

    // Seats in a homeroom: 5 across, 4 deep, receding toward the board.
    function seats(x, fl) {
      var list = [];
      for (var r = 3; r >= 0; r--) for (var c = 0; c < 5; c++) {
        var sp = 37 - r * 3;
        list.push({ i: r * 5 + c, r: r, c: c, x: x + 100 + (c - 2) * sp, y: fl - 6 - r * 15, s: 1 - r * 0.07 });
      }
      return list;   // back row first, so front rows draw on top
    }

    // ---- UI on laptops ------------------------------------------------------------------
    function uiBar(x, y, w, label, u, right) {
      fillRect(x, y, w, 6.5 * u, P.soft);
      text(fitText(label, w - (right ? 22 : 8) * u, 3.8 * u, 800), x + 3 * u, y + 3.4 * u, 3.8 * u, 'left', 800);
      if (right) text(right, x + w - 3 * u, y + 3.4 * u, 3.4 * u, 'right', 700, null, P.mid);
    }
    function icon(x, y, r, state) {
      lw(Math.max(0.5, r * 0.35));
      if (state === 'ok') {
        dot(x, y, r, hexA(OK, 0.22)); ctx.strokeStyle = OK;
        ctx.beginPath(); ctx.moveTo(x - r * 0.5, y); ctx.lineTo(x - r * 0.1, y + r * 0.45); ctx.lineTo(x + r * 0.55, y - r * 0.4); ctx.stroke();
      } else if (state === 'fail') {
        dot(x, y, r, hexA(BAD, 0.22)); ctx.strokeStyle = BAD;
        line(x - r * 0.4, y - r * 0.4, x + r * 0.4, y + r * 0.4); line(x + r * 0.4, y - r * 0.4, x - r * 0.4, y + r * 0.4);
      } else { ctx.strokeStyle = GREY; circle(x, y, r * 0.7, false); }
      ctx.strokeStyle = P.ink;
    }
    function chip(x, y, label, color, u, solid) {
      var s = 3.3 * u, w = textW(label, s, 800) + 4 * u, h = 5.2 * u;
      ctx.strokeStyle = color; lw(0.6 * u);
      rbox(x, y - h / 2, w, h, h / 2, solid ? color : hexA(color, 0.15));
      text(label, x + w / 2, y + 0.2 * u, s, 'center', 800, null, solid ? '#fff' : (P.dark ? P.ink : color));
      ctx.strokeStyle = P.ink;
      return w;
    }
    function textLines(x, y, w, n, gap, u, seed) {
      lw(0.9 * u); ctx.strokeStyle = P.faint;
      for (var i = 0; i < n; i++) line(x, y + i * gap, x + w * (0.45 + noise(seed + i) * 0.55), y + i * gap);
      ctx.strokeStyle = P.ink;
    }
    function uiRoster(x, y, w, h, o) {
      var u = h / 48;
      var marked = o.marked, present = 0;
      for (var k = 0; k < Math.min(marked, 20); k++) if (k !== o.absent) present++;
      uiBar(x, y, w, 'Attendance · ' + o.room, u, marked > 0 ? present + ' / 20 here' : 'not taken');
      var cw = (w - 2 * u) / 5, ch = (h - 9 * u) / 4;
      for (var i = 0; i < 20; i++) {
        var cx = x + 1 * u + (i % 5) * cw, cy = y + 8 * u + Math.floor(i / 5) * ch;
        var st = i >= marked ? 'wait' : i === o.absent ? 'fail' : 'ok';
        if (i === o.absent && i < marked) fillRect(cx, cy, cw - 0.5 * u, ch - 0.5 * u, hexA(BAD, 0.12));
        icon(cx + 2.8 * u, cy + ch / 2, 1.8 * u, st);
        text(fitText(NAMES[i], cw - 6 * u, 2.7 * u, 600), cx + 5.5 * u, cy + ch / 2, 2.7 * u, 'left', 600);
        if (i === o.absent) o.absentAt = [cx + 2.8 * u, cy + ch / 2];
        if (i === 0) o.firstAt = [cx + cw - 2 * u, cy + ch / 2];
      }
    }
    function uiGradebook(x, y, w, h, o) {
      var u = h / 48;
      var shown = o.shown, passed = 0;
      for (var k = 0; k < shown; k++) if (SCORES[k] >= 80) passed++;
      uiBar(x, y, w, 'Unit 6 test · 5th grade', u, shown ? passed + ' / ' + shown + ' mastered' : '');
      var gx = x + 3 * u, gy = y + 9 * u, gw = w - 6 * u, gh = h - 15 * u, bw = gw / 20;
      ctx.strokeStyle = BAD; lw(0.5 * u); ctx.setLineDash([1.5 * u, 1.5 * u]);
      var my = gy + gh * (1 - 0.8 / 1.0);
      line(gx, my, gx + gw, my); ctx.setLineDash([]); ctx.strokeStyle = P.ink;
      text('mastery 80%', gx + gw, my - 2 * u, 2.4 * u, 'right', 700, null, BAD);
      for (var i = 0; i < shown; i++) {
        var v = SCORES[i] / 100, bh = gh * v, bx = gx + i * bw;
        fillRect(bx + 0.4 * u, gy + gh - bh, bw - 0.8 * u, bh, v < 0.8 ? hexA(BAD, 0.6) : hexA(OK, 0.45));
        if (i === 5) o.benAt = [bx + bw / 2, gy + gh - bh];
        text(NAMES[i][0], bx + bw / 2, gy + gh + 2.6 * u, 2.3 * u, 'center', 700, null, P.mid);
      }
    }
    function uiMessage(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, 'Message to family', u, o.sent ? 'sent' : 'draft');
      text('To:', x + 3 * u, y + 11 * u, 2.9 * u, 'left', 800, null, P.mid);
      text('Ms. Reed (Leo\'s guardian)', x + 10 * u, y + 11 * u, 2.9 * u, 'left', 700);
      text('About:', x + 3 * u, y + 16.5 * u, 2.9 * u, 'left', 800, null, P.mid);
      chip(x + 13 * u, y + 16.5 * u, 'Leo · Kindergarten', ENTITIES.Person.color, u * 0.85, false);
      lw(0.5 * u); rbox(x + 3 * u, y + 21 * u, w - 6 * u, 15 * u, 1 * u, P.paper);
      var msg = 'Leo read his first sentence today! 🎉';
      var n = Math.floor(msg.length * clamp(o.typed, 0, 1));
      text(msg.slice(0, n), x + 5 * u, y + 25.5 * u, 3.1 * u, 'left', 600);
      var bw = 16 * u;
      ctx.strokeStyle = o.sent ? OK : ENTITIES.Message.color;
      rbox(x + w - bw - 3 * u, y + h - 9.5 * u, bw, 6.5 * u, 1.2 * u, o.sent ? OK : ENTITIES.Message.color);
      ctx.strokeStyle = P.ink;
      text(o.sent ? 'Sent ✓' : 'Send', x + w - bw / 2 - 3 * u, y + h - 6.2 * u, 3.1 * u, 'center', 800, null, '#fff');
      o.toAt = [x + 10 * u, y + 11 * u]; o.aboutAt = [x + 13 * u, y + 16.5 * u];
    }
    function uiInbox(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, 'Messages', u, o.fresh ? '1 new' : '');
      var rows = [['Front office', 'Field trip forms due Friday'], ['Coach Cole', 'Field day sign-ups']];
      if (o.fresh) rows.unshift(['Ms. Grant', 'Leo read his first sentence today! 🎉', true]);
      rows.forEach(function (r, i) {
        var ry = y + 9 * u + i * 12 * u;
        if (r[2]) fillRect(x, ry - 1 * u, w, 11 * u, hexA(ENTITIES.Message.color, 0.14));
        text(r[0], x + 3 * u, ry + 2.5 * u, 3 * u, 'left', 800);
        text(fitText(r[1], w - 6 * u, 2.8 * u, 600), x + 3 * u, ry + 7 * u, 2.8 * u, 'left', 600);
        if (r[2]) o.freshAt = [x + w - 4 * u, ry + 4 * u];
      });
    }
    function uiDash(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, 'Today', u, o.closed ? 'closed out ✓' : 'live');
      var tiles = [['Present', o.present], ['Picked up', o.picked], ['Tests scored', '20'], ['Notes home', '14']];
      tiles.forEach(function (tl, i) {
        var tx = x + 2 * u + (i % 2) * (w / 2), ty = y + 9 * u + Math.floor(i / 2) * 19 * u;
        rbox(tx, ty, w / 2 - 4 * u, 17 * u, 1.5 * u, P.paper);
        text(tl[0], tx + 2.5 * u, ty + 4 * u, 2.8 * u, 'left', 800, null, P.mid);
        text(tl[1], tx + 2.5 * u, ty + 11 * u, 5.5 * u, 'left', 800);
        if (i === 0) o.presentAt = [tx + w / 2 - 6 * u, ty + 11 * u];
        if (i === 1) o.pickedAt = [tx + w / 2 - 6 * u, ty + 11 * u];
      });
    }
    function uiPlan(x, y, w, h, o) {
      var u = h / 48;
      uiBar(x, y, w, o.title || 'Lesson plan', u);
      textLines(x + 3 * u, y + 12 * u, w - 6 * u, 6, 5 * u, u, o.seed || 1);
    }
    function laptop(r, fn) {
      lw(1.5);
      rbox(r[0] - 2, r[1] - 2, r[2] + 4, r[3] + 4, 1.5, P.paper);
      poly([r[0] - 6, r[1] + r[3] + 2, r[0] + r[2] + 6, r[1] + r[3] + 2, r[0] + r[2] + 10, r[1] + r[3] + 7, r[0] - 10, r[1] + r[3] + 7]);
      ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2], r[3]); ctx.clip();
      if (fn) fn(r[0], r[1], r[2], r[3]);
      ctx.restore();
      ctx.strokeStyle = P.ink;
    }

    // =========================================================================
    // Campus
    // =========================================================================

    function drawSky() {
      var a = Math.PI * (1 - clamp((sunH - 6.5) / 13, 0, 1));
      var sx = 1030 + Math.cos(a) * 900, sy = 380 - Math.sin(a) * 110;
      lw(1.3);
      circle(sx, sy, 18, P.paper);
      for (var i = 0; i < 12; i++) {
        var b = i * TAU / 12 + t * 0.05;
        line(sx + Math.cos(b) * 24, sy + Math.sin(b) * 24, sx + Math.cos(b) * 31, sy + Math.sin(b) * 31);
      }
      [[300, 300, 1], [1500, 280, 1.3], [900, 320, 0.8]].forEach(function (c, k) {
        var cx = mod(c[0] + t * (6 + k * 3), W + 300) - 150, cy = c[1], s = c[2];
        ctx.beginPath();
        ctx.arc(cx - 26 * s, cy + 4 * s, 16 * s, Math.PI * 0.5, Math.PI * 1.5);
        ctx.arc(cx - 6 * s, cy - 10 * s, 20 * s, Math.PI, Math.PI * 1.9);
        ctx.arc(cx + 20 * s, cy - 2 * s, 16 * s, Math.PI * 1.2, Math.PI * 0.5);
        ctx.closePath();
        ctx.fillStyle = P.paper; ctx.fill(); lw(1.1); ctx.stroke();
      });
    }

    function drawGrounds() {
      // trees behind the building
      tree(2040, GROUND, 1.1); tree(1990, GROUND - 380, 0.6);
      // ground line, lawn and the carpool road in front
      lw(1.4); line(0, GROUND, W, GROUND);
      lw(1); line(0, GROUND + 8, W, GROUND + 8);
      fillRect(0, GROUND + 8, W, 60, P.soft);
      ctx.save(); ctx.setLineDash([16, 14]); lw(1.4); line(0, GROUND + 38, W, GROUND + 38); ctx.restore();
      lw(1.2); line(0, GROUND + 68, W, GROUND + 68);
      ctx.save(); ctx.globalAlpha = 0.45; hatch(0, GROUND + 70, W, H - GROUND - 70, 10, 0.6); ctx.restore();
      text('← CARPOOL LANE', 300, GROUND + 22, 9, 'left', 800, null, P.mid);
      text('← CARPOOL LANE', 1740, GROUND + 22, 9, 'right', 800, null, P.mid);
    }

    function drawShell() {
      ctx.strokeStyle = P.ink;
      // wings' brick parapet
      brick(X0 - 8, TOPS[0] - 26, CX0 - X0 + 8, 26);
      brick(CX1, TOPS[0] - 26, X1 - CX1 + 8, 26);
      lw(1.3); line(X0 - 10, TOPS[0] - 26, CX0, TOPS[0] - 26); line(CX1, TOPS[0] - 26, X1 + 10, TOPS[0] - 26);
      box(X0 - 12, TOPS[0] - 30, CX0 - X0 + 12, 4, P.paper); box(CX1, TOPS[0] - 30, X1 - CX1 + 12, 4, P.paper);
      // multipurpose room shell
      brick(MPR.x, MPR.y - 24, MPR.w + 8, 24);
      box(MPR.x - 2, MPR.y - 28, MPR.w + 12, 4, P.paper);
      // back walls of every room
      ROOMS.forEach(function (q) {
        if (q.id === 'front' || q.id === 'play' || q.id === 'car') return;
        ctx.fillStyle = P.paper; ctx.fillRect(q.x, q.y, q.w, q.h);
        vlines(q.x, q.y + 5, q.w, q.h - 10, 10, 0.08);
        // where the far wall meets the floor
        ctx.save(); ctx.globalAlpha = 0.35; lw(0.8); line(q.x + 6, q.y + q.h - 64, q.x + q.w - 6, q.y + q.h - 64); ctx.restore();
      });
      // slabs and walls (the cut)
      ctx.fillStyle = P.ink;
      [TOPS[0], TOPS[1], GROUND].forEach(function (y) {
        ctx.fillRect(X0 - 8, y - 5, CX0 - X0 + 8, 10);
        ctx.fillRect(CX1, y - 5, X1 - CX1 + 8, 10);
      });
      ctx.fillRect(CX0, TOPS[1] - 5, CX1 - CX0, 10);
      ctx.fillRect(CX0, GROUND - 5, CX1 - CX0, 10);
      ctx.fillRect(MPR.x, MPR.y - 5, MPR.w + 8, 10);
      ctx.fillRect(MPR.x, GROUND - 5, MPR.w + 8, 10);
      ctx.fillRect(MPR.x + MPR.w, MPR.y, 8, GROUND - MPR.y);
      // outer walls, with brick showing in the cut
      brick(X0 - 14, TOPS[0], 10, GROUND - TOPS[0]);
      ctx.fillStyle = P.ink; ctx.fillRect(X0 - 4, TOPS[0], 6, GROUND - TOPS[0]);
      ctx.fillRect(X1 - 3, TOPS[0], 6, MPR.y - TOPS[0]);
      // walls between rooms (doorways at the bottom)
      function wall(x, f) { ctx.fillStyle = P.ink; ctx.fillRect(x - 3, TOPS[f] + 5, 6, 140); }
      wall(620, 0); wall(620, 1); wall(1460, 0); wall(1460, 1);
      wall(CX0, 0); wall(CX1, 0); wall(CX0, 1); wall(CX1, 1);
      wall(X1, 1);
    }

    // The front of the centre block, as in the photo: sign, windows, portico.
    function drawFacade() {
      var top = 380;
      brick(CX0, top, CX1 - CX0, TOPS[1] - top);
      lw(1.3);
      box(CX0 - 4, top - 6, CX1 - CX0 + 8, 8, P.paper);
      line(CX0, top, CX0, TOPS[1]); line(CX1, top, CX1, TOPS[1]);
      // the sign
      lw(1.2); box(985, 404, 110, 20, P.paper);
      text('THALES ACADEMY', 1040, 414.5, 9.5, 'center', 700, SERIF);
      // upstairs windows with white trim
      [918, 1124].forEach(function (wx) {
        lw(1.3); box(wx - 4, 450, 46, 4, P.paper); box(wx, 454, 38, 70, P.paper);
        lw(0.8); line(wx + 19, 454, wx + 19, 524); line(wx, 478, wx + 38, 478); line(wx, 501, wx + 38, 501);
        lw(1.3); box(wx - 4, 524, 46, 5, P.paper);
      });
      lw(1.3); box(990, 440, 100, 4, P.paper);
    }
    function drawPortico() {
      // pediment and entablature
      lw(1.5);
      poly([928, 618, 1040, 566, 1152, 618]);
      ctx.save(); ctx.globalAlpha = 0.3; lw(0.6); poly([946, 612, 1040, 572, 1134, 612], false); ctx.restore();
      box(924, 618, 232, 14, P.paper);
      box(920, 632, 240, 8, P.paper);
      // four columns, fluted
      [944, 992, 1088, 1136].forEach(function (cx) {
        lw(1.3);
        box(cx - 11, 640, 22, 6, P.paper);
        box(cx - 8, 646, 16, GROUND - 660, P.paper);
        ctx.save(); ctx.globalAlpha = 0.4; lw(0.6);
        line(cx - 3.5, 648, cx - 3.5, GROUND - 16); line(cx, 648, cx, GROUND - 16); line(cx + 3.5, 648, cx + 3.5, GROUND - 16);
        ctx.restore();
        lw(1.3); box(cx - 11, GROUND - 14, 22, 9, P.paper);
      });
      // front steps
      lw(1.2); box(912, GROUND - 5, 256, 5, P.paper); box(904, GROUND, 272, 5, P.paper);
      // lanterns
      [960, 1120].forEach(function (lx) { lw(1); box(lx - 3, 676, 6, 9, P.paper); line(lx, 670, lx, 676); });
    }

    // ---- a homeroom ------------------------------------------------------------------
    // state: 'arrive' | 'pledge' | 'lesson' | 'reading' | 'math' | 'work' | 'test' | 'quiet' | 'empty' | 'gone'
    function roomState(id) {
      var s = step;
      if (s <= 1) return 'arrive';
      if (s === 2) return ct < 4 ? 'pledge' : 'lesson';
      if (s === 3) return id === 'r102' ? 'group' : 'lesson';
      if (s === 4) return id === 'r104' ? (ct < 6 ? 'math' : 'work') : id === 'r203' ? 'empty' : 'lesson';
      if (s === 5) return id === 'r101' || id === 'r102' ? 'empty' : 'lesson';
      if (s === 6) return id === 'r104' || id === 'r201' || id === 'r203' ? 'empty' : 'lesson';
      if (s === 7) return id === 'r201' ? 'empty' : 'lesson';
      if (s === 8) return id === 'r203' ? 'test' : 'lesson';
      if (s === 9) return id === 'r101' ? 'quiet' : id === 'r104' ? 'work' : 'lesson';
      return 'gone';
    }
    var BOARDS = {
      r101: ['Aa  Bb  Cc  Dd', 'cat · sat · mat'],
      r102: ['READING  ·  Lesson 87', 'sat   mat   sam   ā'],
      r103: ['SPELLING', 'rain · train · chain'],
      r104: ['MATH  ·  Lesson 64', '24 × 3 = ?    48 ÷ 6 = ?'],
      r201: ['HISTORY', 'Mayflower · 1620'],
      r203: ['GRAMMAR', 'subject · verb · object']
    };
    function homeroom(id) {
      var R = HOMEROOMS[id], x = R.x, fl = FLR(R.f), ce = CEI(R.f);
      var st = roomState(id);
      // back wall
      var bx = x + 30, by = ce + 30, bw = 150, bh = 62;
      var lines = BOARDS[id];
      if (id === 'r203' && st === 'test') lines = ['UNIT 6 TEST', 'Quiet, please. Eyes on your own paper.'];
      if (id === 'r104' && (st === 'work' || (at(4) && ct > 5))) lines = ['Workbook p.112', 'Problems 1–10'];
      if (st === 'gone' || st === 'arrive') lines = st === 'arrive' ? ['Good morning!', 'Unpack · sharpen · sit'] : ['See you tomorrow!', ''];
      lw(1.6); box(bx, by, bw, bh, P.paper);
      lw(1); box(bx - 4, by + bh, bw + 8, 3, P.paper);
      text(lines[0], bx + bw / 2, by + 20, 8.5, 'center', 800);
      text(lines[1], bx + bw / 2, by + 40, 7.5, 'center', 600);
      R.board = [bx, by, bw, bh];
      // alphabet strip, flag, clock, door with the room sign over it
      lw(0.8); for (var a = 0; a < 9; a++) box(x + 20 + a * 18, ce + 12, 14, 10, P.paper);
      flag(x + 190, ce + 30, 0.9);
      clock(x + 262, ce + 22, 9);
      roomSign(x + 237, ce + 47, 'Room ' + R.num, R.grade);
      lw(1.3); box(x + 220, ce + 60, 34, fl - 64 - ce - 60, P.paper); dot(x + 226, ce + 60 + (fl - 64 - ce - 60) / 2, 1.5, P.ink);
      // the teacher, up front by the board
      var T = { s: 0.82 };
      if ((st === 'lesson' || st === 'math' || st === 'pledge' || st === 'arrive') && !teacherSeated(id)) {
        T.x = x + 60 + (Math.sin(t * 0.3 + x) * 0.5 + 0.5) * 100;
        T.arm = st === 'math' ? (mod(ct, 2.4) < 1.5 ? 'point' : 'down') : st === 'pledge' ? 'hand' : mod(t + x, 6) < 3 ? 'point' : 'down';
        if (st === 'math') T.x = x + 60 + seg(0, 6) * 60;
        person(T.x, fl - 66, look(R.teacher, { s: 0.82, arm: T.arm, flip: T.x > x + 120 }));
      }
      if (st === 'group') readingGroup(R, x, fl);
      // the class
      var list = seats(x, fl);
      var kidsHere = st !== 'empty' && st !== 'gone';
      list.forEach(function (sp) {
        var i = sp.i;
        if (st === 'group' && sp.c <= 1 && sp.r >= 1) return;       // their desks are pushed back for the reading group
        if (R.absent === i || !kidsHere || (st === 'arrive' && noise(i + x) > 0.35)) { emptyDesk(sp); return; }
        var o = { desk: true };
        if (st === 'pledge') { o.stand = true; o.arm = 'heart'; }
        else if (st === 'arrive') { o.stand = true; o.backpack = true; }
        else if (st === 'test' || st === 'work' || st === 'quiet' || st === 'group') { o.arm = 'write'; o.down = true; o.paper = true; }
        else if (st === 'lesson' && noise(i + Math.floor(t / 3) + x) > 0.86) o.arm = 'up';
        kidBack(sp.x, sp.y, sp.s, i, o);
        sp.drawn = true;
      });
      R.seats = list;
      // the teacher walking the rows
      if ((st === 'work' || st === 'test') && !teacherSeated(id)) {
        var wx = x + 40 + (Math.sin(t * 0.25 + x) * 0.5 + 0.5) * 150;
        person(wx, fl - 22, look(R.teacher, { s: 0.92, arm: 'down', walk: t * 4, flip: Math.cos(t * 0.25 + x) < 0 }));
        T.x = wx;
      }
      // choral answers on the teacher's signal
      if ((st === 'lesson' && mod(t + x * 0.01, 7) < 1.2) || (st === 'math' && mod(ct, 2.4) > 1.5)) {
        var ans = st === 'math' ? (Math.floor(ct / 2.4) % 2 ? '8!' : '72!') : ['Yes!', 'Seven!', 'True!', '1620!'][Math.floor(t / 7 + x) % 4];
        bubble(x + 112, fl - 104, ans, ENTITIES.Lesson.color, 7);
      }
      // teacher's desk at the back, nearest us, with the laptop
      lw(1.3); box(x + 206, fl - 34, 66, 4, P.paper); line(x + 210, fl - 30, x + 210, fl); line(x + 268, fl - 30, x + 268, fl);
      R.laptop = [x + 208, fl - 86, 62, 40];
      R.T = T;
      return st;
    }
    function emptyDesk(sp) {
      ctx.save(); ctx.translate(sp.x, sp.y); ctx.scale(sp.s, sp.s);
      lw(1.1); box(-16, -23, 32, 4); line(-14, -19, -14, 0); line(14, -19, 14, 0);
      lw(1); rbox(-7.5, -21, 15, 8, 1.5, P.paper); line(-6, -13, -6, 0); line(6, -13, 6, 0);
      ctx.restore();
    }

    function drawHomerooms() {
      Object.keys(HOMEROOMS).forEach(function (id) {
        var R = HOMEROOMS[id], st = homeroom(id);
        // the default laptop screen
        var fn = function (x, y, w, h) { uiPlan(x, y, w, h, { title: (R.num === '102' ? 'Reading' : R.num === '104' ? 'Math' : 'Plan') + ' · ' + R.grade, seed: R.x }); };
        if (id === 'r103' && step >= 2) fn = function (x, y, w, h) { uiRoster(x, y, w, h, R.roster = { room: 'Room 103', marked: at(2) ? Math.floor(clamp((ct - 4) * 4, 0, 20)) : 20, absent: 13 }); };
        if (id === 'r203' && (at(8) || step > 8)) fn = function (x, y, w, h) { uiGradebook(x, y, w, h, R.grades = { shown: at(8) ? Math.floor(clamp((ct - 5) * 3.5, 0, 20)) : 20 }); };
        if (id === 'r101' && at(9)) fn = function (x, y, w, h) { uiMessage(x, y, w, h, R.msg = { typed: seg(1, 4), sent: ct > 4.8 }); };
        if (id === 'r104' && (at(9) || step === 10)) fn = function (x, y, w, h) { uiInbox(x, y, w, h, R.inbox = { fresh: at(9) ? ct > 8 : true }); };
        if (st !== 'gone' || id === 'r101') laptop(R.laptop, fn); else laptop(R.laptop, null);
        // teachers who sit at the laptop for their story
        if (teacherSeated(id)) {
          person(R.x + 196, FLR(R.f), look(R.teacher, { seated: true, arm: 'type' }));
          R.T = { x: R.x + 196, seated: true };
        }
      });
    }

    function teacherSeated(id) {
      return (id === 'r103' && at(2) && ct > 3.4) || (id === 'r203' && at(8) && ct > 4.4) ||
        (id === 'r101' && at(9)) || (id === 'r104' && at(9) && ct > 8);
    }
    function roomSign(cx, cy, a, b) {
      lw(1); box(cx - 20, cy - 7, 40, 14, P.paper);
      text(a, cx, cy - 2.3, 5, 'center', 800);
      text(b, cx, cy + 3.4, 3.6, 'center', 600, null, P.mid);
    }

    // ---- 1st grade small group (Direct Instruction) -----------------------------------
    // Mr. Lopez at the kidney table in the front corner, six readers around it.
    function readingGroup(R, x, fl) {
      var signal = mod(ct, 3) < 1.7, cx = x + 46;
      person(cx, fl - 58, look('lopez', { seated: true, s: 0.82, arm: signal ? 'point' : 'down' }));
      lw(1.3); ctx.beginPath(); ctx.ellipse(cx, fl - 62, 38, 5, 0, 0, TAU); ctx.fillStyle = P.paper; ctx.fill(); ctx.stroke();
      lw(1); box(cx - 8, fl - 68, 16, 5, P.paper); line(cx, fl - 68, cx, fl - 63);
      [[x + 14, fl - 50], [x + 27, fl - 42], [x + 40, fl - 36], [x + 53, fl - 36], [x + 66, fl - 42], [x + 79, fl - 50]].forEach(function (g, k) {
        kidBack(g[0], g[1], 0.8, 20 + k, { desk: false, arm: !signal && k % 2 ? 'up' : 'down' });
      });
      if (!signal) bubble(cx + 16, fl - 90, 'sat!', ENTITIES.Lesson.color, 8);
      else if (mod(ct, 3) < 1.2) bubble(cx + 34, fl - 106, 'What word?', null, 6.5);
      R.group = [cx, fl - 62];
    }

    // ---- science lab --------------------------------------------------------------------
    function drawLab() {
      var x = 620, fl = FLR(0), ce = CEI(0);
      var inUse = at(7);
      lw(1.6); box(x + 30, ce + 30, 150, 62, P.paper);
      lw(1); box(x + 26, ce + 92, 158, 3, P.paper);
      text('SCIENCE · Circuits', x + 105, ce + 46, 8.5, 'center', 800);
      // battery and bulb diagram
      lw(1.1); box(x + 70, ce + 64, 14, 18); line(x + 84, ce + 68, x + 120, ce + 68); line(x + 84, ce + 78, x + 120, ce + 78);
      circle(x + 126, ce + 73, 6, inUse && mod(t, 2) < 1.4 ? hexA('#F7DC6F', 0.9) : P.paper);
      text('Room 202 · Science lab', x + 6, ce + 104, 6.5, 'left', 800, null, P.mid);
      // shelves with beakers
      lw(1); box(x + 200, ce + 26, 66, 70, P.paper); line(x + 200, ce + 50, x + 266, ce + 50); line(x + 200, ce + 74, x + 266, ce + 74);
      for (var b = 0; b < 6; b++) { poly([x + 206 + b * 10, ce + 48, x + 212 + b * 10, ce + 48, x + 211 + b * 10, ce + 38, x + 207 + b * 10, ce + 38]); }
      clock(x + 232, ce + 112, 9);
      // four benches of five
      for (var r = 3; r >= 0; r--) {
        var y = fl - 6 - r * 15, s = 1 - r * 0.07, sp = 40 - r * 3;
        lw(1.2); box(x + 112 - 2.5 * sp, y - 12 * s - 11, 5 * sp, 4, P.paper);
        for (var c = 0; c < 5; c++) {
          var kx = x + 112 + (c - 2) * sp;
          if (inUse) {
            kidBack(kx, y, s, 40 + r * 5 + c, { desk: false, arm: (r + c) % 3 === 0 ? 'write' : 'down' });
            if (c % 2 === 0) { var lit = mod(t + r + c, 3) < 2; dot(kx + sp / 2, y - 12 * s - 14, 2.2, lit ? '#F2C40F' : P.faint); }
          }
        }
      }
      if (inUse) person(x + 230, fl - 22, look('hale', { s: 0.92, arm: 'point', flip: true }));
    }

    // ---- library -------------------------------------------------------------------------
    function drawLibrary() {
      var x = 1460, fl = FLR(0), ce = CEI(0);
      for (var s = 0; s < 3; s++) {
        var sx = x + 14 + s * 86;
        lw(1.2); box(sx, ce + 20, 78, 110, P.paper);
        for (var r = 0; r < 4; r++) {
          line(sx, ce + 46 + r * 27, sx + 78, ce + 46 + r * 27);
          for (var b = 0; b < 9; b++) { lw(0.7); box(sx + 3 + b * 8, ce + 24 + r * 27 + (b % 3), 6, 22 - (b % 3), b % 4 === 0 ? hexA('#8B2F3C', 0.25) : P.paper); }
          lw(1.2);
        }
      }
      text('LIBRARY', x + 140, ce + 14, 7, 'center', 800, null, P.mid);
      // rug and readers
      lw(1); ctx.beginPath(); ctx.ellipse(x + 110, fl - 12, 80, 10, 0, 0, TAU); ctx.fillStyle = hexA('#2E86AB', 0.12); ctx.fill(); ctx.stroke();
      if (step >= 2 && step <= 9 && !at(6)) for (var k = 0; k < 4; k++) kidBack(x + 60 + k * 32, fl - 10, 0.85, 70 + k, { desk: false, chair: false, arm: 'write' });
      lw(1.3); box(x + 200, fl - 36, 66, 4, P.paper); line(x + 204, fl - 32, x + 204, fl); line(x + 262, fl - 32, x + 262, fl);
      if (step < 10) person(x + 232, fl - 36, look('lib', { s: 0.8, arm: 'type' }));
    }

    // ---- front office --------------------------------------------------------------------
    function drawOffice() {
      var x = CX0, fl = FLR(1), ce = CEI(1);
      text('FRONT OFFICE', x + 140, ce + 14, 7, 'center', 800, null, P.mid);
      clock(x + 140, ce + 34, 10);
      // trophy case and headmaster's door
      lw(1.2); box(x + 18, ce + 50, 54, 90, P.paper);
      for (var s = 0; s < 3; s++) { line(x + 18, ce + 80 + s * 20, x + 72, ce + 80 + s * 20); circle(x + 34 + s * 10, ce + 74 + s * 20, 4, hexA('#D4A017', 0.4)); }
      box(x + 206, ce + 56, 40, fl - 64 - ce - 56, P.paper);
      box(x + 212, ce + 64, 28, 8, P.paper); text('Headmaster', x + 226, ce + 68, 3.8, 'center', 800);
      // front desk with Mrs. Patel
      var dash = { present: step >= 2 ? (step >= 11 ? '119 / 120' : '119 / 120') : '—', picked: step >= 11 ? '119 / 119' : at(10) ? Math.floor(clamp(ct * 8, 0, 119)) + ' / 119' : '0 / 119', closed: step >= 11 };
      person(x + 112, fl - 40, look('patel', { s: 0.9, arm: 'type' }));
      lw(1.4); box(x + 102, fl - 42, 82, 42, P.paper);
      ctx.save(); ctx.globalAlpha = 0.35; hatch(x + 102, fl - 42, 82, 42, 7, 0.5); ctx.restore();
      var scr = [x + 122, fl - 88, 56, 38];
      laptop(scr, function (a, b, c, d) { uiDash(a, b, c, d, dash); });
      // Mr. Ward is inside between the carpool rushes
      if (step >= 2 && step <= 9) person(x + 236, fl, look('ward', { arm: 'down', flip: true }));
      return { dash: dash, scr: scr };
    }

    // ---- multipurpose room ---------------------------------------------------------------
    function drawMPR() {
      var x = MPR.x, fl = GROUND - 5, ce = MPR.y + 5;
      // high windows, stage, banner, hoop
      for (var w = 0; w < 4; w++) { lw(1.1); box(x + 20 + w * 64, ce + 18, 44, 40, P.paper); line(x + 42 + w * 64, ce + 18, x + 42 + w * 64, ce + 58); }
      lw(1.4); box(x + 6, fl - 150, 90, 120, P.paper);
      ctx.save(); ctx.globalAlpha = 0.25; vlines(x + 8, fl - 148, 86, 116, 5, 1); ctx.restore();
      box(x + 6, fl - 30, 90, 30, P.paper);
      lw(1.2); box(x + 106, ce + 72, 140, 20, P.paper);
      text('THALES ACADEMY', x + 176, ce + 82.5, 9, 'center', 700, SERIF);
      lw(1.4); line(x + 270, ce + 90, x + 258, ce + 100); box(x + 240, ce + 96, 20, 16, P.paper); ctx.beginPath(); ctx.ellipse(x + 250, ce + 116, 10, 3, 0, 0, TAU); ctx.stroke();
      clock(x + 150, ce + 120, 10);
      var p6 = at(6), p4 = at(4);
      if (p6) {
        // three long tables, one class each, twenty to a table
        var tabs = [];
        [[2, fl - 150, 0.78, '5th'], [1, fl - 86, 0.88, '4th'], [0, fl - 20, 1, '3rd']].forEach(function (tb) {
          var y = tb[1], s = tb[2], tx0 = x + 140 - 120 * s, tw = 240 * s;
          for (var k = 0; k < 10; k++) kidFront(tx0 + 12 * s + k * 24 * s, y - 8 * s, s, tb[0] * 20 + k, { eat: true, talk: true });
          lw(1.3); box(tx0, y - 8 * s, tw, 5 * s, P.paper);
          line(tx0 + 8, y - 3 * s, tx0 + 8, y + 10 * s); line(tx0 + tw - 8, y - 3 * s, tx0 + tw - 8, y + 10 * s);
          for (var k2 = 0; k2 < 10; k2++) { lw(1); box(tx0 + 8 * s + k2 * 24 * s, y - 13 * s, 8 * s, 5 * s, hexA(POLO[(k2 + tb[0]) % POLO.length], 0.4)); }
          for (var k3 = 0; k3 < 10; k3++) kidBack(tx0 + 24 * s + k3 * 24 * s, y + 14 * s, s, tb[0] * 20 + 10 + k3, { desk: false, chair: false });
          tabs.push([x + 140, y - 8 * s, tb[3]]);
        });
        if (mod(t, 5) < 2.5) bubble(x + 70, fl - 190, 'Trade you my apple?'); else bubble(x + 210, fl - 124, 'Field day is Friday!');
        return tabs;
      }
      if (p4) {
        // fifth grade PE: laps and a ball
        for (var k4 = 0; k4 < 20; k4++) {
          var ph = k4 / 20 * TAU + t * 0.6, rx = x + 150 + Math.cos(ph) * 105, ry = fl - 30 + Math.sin(ph) * 22;
          kid(rx, ry, k4, { walk: t * 12 + k4, arm: 'run', flip: Math.sin(ph) < 0, s: 1 - (Math.sin(ph) * 0.5 + 0.5) * 0.12 });
        }
        person(x + 120, fl - 60, look('cole', { s: 0.85, arm: 'point', prop: 'whistle' }));
        return null;
      }
      // folded tables and stacked chairs otherwise
      for (var f = 0; f < 4; f++) { lw(1.2); box(x + 120 + f * 12, fl - 76, 6, 76, P.paper); }
      for (var c = 0; c < 5; c++) { lw(1); box(x + 190, fl - 16 - c * 6, 26, 5, P.paper); }
      if (at(5)) person(x + 230 - Math.sin(t * 0.5) * 30, fl, look('cust', { arm: 'hold', flip: true }));
      return null;
    }

    // ---- playground ---------------------------------------------------------------------
    function drawPlayground() {
      var fl = GROUND;
      // fence
      lw(1); line(14, fl - 24, 330, fl - 24);
      for (var fx = 14; fx <= 330; fx += 22) line(fx, fl - 28, fx, fl);
      // play structure with slide and ladder
      lw(1.4);
      line(50, fl, 50, fl - 70); line(110, fl, 110, fl - 70); box(46, fl - 74, 68, 6, P.paper);
      poly([46, fl - 74, 80, fl - 104, 114, fl - 74], P.paper);
      ctx.beginPath(); ctx.moveTo(110, fl - 70); ctx.quadraticCurveTo(140, fl - 40, 160, fl - 4); ctx.lineTo(166, fl - 4); ctx.quadraticCurveTo(146, fl - 40, 116, fl - 72); ctx.stroke();
      for (var l = 0; l < 6; l++) line(50, fl - 10 - l * 11, 60, fl - 10 - l * 11);
      line(60, fl, 60, fl - 70);
      // swing set
      lw(1.4); line(190, fl, 214, fl - 100); line(238, fl, 214, fl - 100); line(270, fl, 294, fl - 100); line(318, fl, 294, fl - 100); line(214, fl - 100, 294, fl - 100);
      var rec = at(5);
      [230, 254, 278].forEach(function (sx, k) {
        var a = Math.sin(t * 2.2 + k * 1.3) * (rec ? 0.5 : 0.06);
        var ex = sx + Math.sin(a) * 60, ey = fl - 100 + Math.cos(a) * 60;
        lw(0.9); line(sx - 3, fl - 100, ex - 3, ey); line(sx + 3, fl - 100, ex + 3, ey);
        lw(1.3); line(ex - 6, ey, ex + 6, ey);
        if (rec) { ctx.save(); ctx.translate(ex, ey + 4); ctx.rotate(-a * 0.6); kid(0, 0, 50 + k, { seated: true, arm: 'up' }); ctx.restore(); }
      });
      if (!rec) return;
      // forty children: on the structure, the slide, and running about
      kid(80, fl - 74, 60, { arm: 'cheer' });
      kid(64, fl - 74, 61, { arm: 'up' });
      var sl = mod(t * 0.5, 1); kid(lerp(118, 158, sl), lerp(fl - 66, fl - 6, sl * sl), 62, { seated: true, arm: 'cheer' });
      var groups = [];
      for (var k = 0; k < 34; k++) {
        var depth = noise(k * 3.1), ph = t * (0.5 + noise(k) * 0.8) + k;
        var kx = 20 + noise(k * 7.7) * 300 + Math.sin(ph) * 22, ky = fl - 6 - depth * 34;
        groups.push([ky, kx, k, Math.cos(ph) < 0, 1 - depth * 0.25]);
      }
      groups.sort(function (a, b) { return a[0] - b[0]; });
      groups.forEach(function (g) { kid(g[1], g[0], 70 + g[2], { walk: t * 10 + g[2], arm: g[2] % 4 ? 'run' : 'up', flip: g[3], s: g[4] }); });
      person(300, fl, look('cole', { arm: 'point', flip: true, prop: 'whistle' }));
      if (mod(t, 6) < 2.5) bubble(300, fl - 80, 'Thirty-nine, forty!');
    }

    // ---- carpool ----------------------------------------------------------------------------
    var V = 210, SLOT = 112, LANE = GROUND + 58;
    function car(x, y, o) {
      var c = o.color;
      lw(1.4);
      ctx.beginPath();
      ctx.moveTo(x - 48, y - 12); ctx.lineTo(x - 46, y - 24); ctx.lineTo(x - 26, y - 27); ctx.lineTo(x - 14, y - 41);
      ctx.lineTo(x + 30, y - 41); ctx.lineTo(x + 40, y - 27); ctx.lineTo(x + 48, y - 25); ctx.lineTo(x + 48, y - 10); ctx.closePath();
      ctx.fillStyle = hexA(c, 0.32); ctx.fill(); ctx.stroke();
      poly([x - 12, y - 38, x + 6, y - 38, x + 6, y - 28, x - 22, y - 28]);
      poly([x + 9, y - 38, x + 28, y - 38, x + 36, y - 28, x + 9, y - 28]);
      // driver, and a child in the back once picked up
      lw(1); circle(x - 4, y - 32, 3.4); ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x - 4, y - 32, 3.5, Math.PI, TAU); ctx.fill();
      if (o.rider) { lw(1); circle(x + 20, y - 31, 3); ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(x + 20, y - 31, 3.1, Math.PI, TAU); ctx.fill(); }
      // number card on the dash
      if (o.num) { lw(0.8); box(x - 21, y - 36, 12, 7, P.paper); text(String(o.num), x - 15, y - 32.4, 4.6, 'center', 800); }
      [x - 30, x + 30].forEach(function (wx) {
        lw(1.4); circle(wx, y - 8, 8);
        var a = -x / 8; lw(0.9); line(wx, y - 8, wx + Math.cos(a) * 6, y - 8 + Math.sin(a) * 6);
      });
      return { driver: [x - 4, y - 32], rider: [x + 20, y - 31], x: x };
    }
    var CAR_COLORS = ['#8B2F3C', '#3C7A55', '#8EC5E8', '#E8C547', '#BBBBBB', '#2C3E70'];
    var CAR_NUMS = [214, 237, 260, 118, 152, 305, 331, 342, 376, 403, 415, 428];

    // The carpool line: cars pull up three at a time under the portico, children get
    // out (or in), and the batch drives off. Car 214 (Ava's) is always the first car.
    function carpool(mode) {
      var out = { calling: null }, batches = 4;
      var first = mode === 'drop' ? 16 : 15, gap = 7;
      function dep(b) { return first + b * gap; }
      function arrive(b) { return b === 0 ? (mode === 'drop' ? 1.2 : 2) : dep(b - 1) + 2; }
      var entry = mode === 'drop' ? 1 : 3;
      var shift0 = entry * (1 - ease(ct / arrive(0)));
      for (var j = batches * 3 - 1; j >= 0; j--) {
        var b = Math.floor(j / 3), s = j % 3, shift = 0;
        for (var k = 0; k < b; k++) shift += 3 * ease((ct - dep(k) - 0.6) / 1.6);
        var x, gone = ct - dep(b);
        if (gone > 0) x = SPOT + s * SLOT - (gone < 1 ? V * gone * gone / 2 : V * (gone - 0.5));
        else x = SPOT + (j - shift + shift0) * SLOT;
        if (x < -120 || x > W + 120) continue;
        var A = arrive(b), kt = ct - A - 0.4 - s * 0.7;     // this child's clock
        var rider = mode === 'pick' && kt > 2.2;
        var c = car(x, LANE, { color: CAR_COLORS[j % CAR_COLORS.length], num: CAR_NUMS[j], rider: rider });
        if (j === 0) { out.car = c; out.leaving = gone > 0; }
        if (mode === 'pick' && kt > -1 && kt < 1.5 && gone < 0) out.calling = CAR_NUMS[j];
        if (kt < 0 || gone > 0 && mode === 'drop' && j !== 0) continue;
        var walk = { walk: t * 9, prop: 'backpack' }, kx, ky, kidI = j === 0 ? 0 : 100 + j;
        if (mode === 'drop') {
          var stepX = 1010 + s * 26;
          if (j === 0 && kt > 2.2) {
            // Ava says good morning to Mr. Ward, then goes in when her dad leaves
            var inT = ct - dep(0);
            if (inT > 1.2) continue;
            kx = inT > 0 ? lerp(1084, 1040, inT / 1.2) : lerp(stepX, 1084, clamp((kt - 2.2) / 1.2, 0, 1));
            ky = GROUND - 4;
            ctx.save(); if (inT > 0) ctx.globalAlpha = 1 - inT / 1.2;
            kid(kx, ky, kidI, { walk: kt < 3.4 || inT > 0 ? t * 9 : null, prop: 'backpack', arm: kt > 3.4 && inT <= 0 && mod(t, 3) < 1.2 ? 'up' : 'down', flip: inT > 0 });
            ctx.restore();
            out.kid = [kx, ky];
            continue;
          }
          if (kt > 3.2) continue;
          var q = clamp(kt / 2.2, 0, 1);
          kx = lerp(c.x + 4, stepX, q); ky = lerp(LANE - 6, GROUND - 4, ease(q));
          if (kt > 2.2) { kx = lerp(stepX, 1040, (kt - 2.2) / 1); ky = GROUND - 6; }
          ctx.save(); ctx.globalAlpha = kt > 2.2 ? 1 - (kt - 2.2) : 1;
          kid(kx, ky, kidI, { walk: t * 9, prop: 'backpack', arm: kt < 0.5 ? 'wave' : 'down', s: lerp(1.08, 0.95, q) });
          ctx.restore();
          if (j === 0) out.kid = [kx, ky];
        } else {
          if (kt > 2.2) continue;
          var q2 = clamp(kt / 2.2, 0, 1);
          kx = lerp(980 - s * 16, c.x + 4, q2); ky = lerp(GROUND - 4, LANE - 6, ease(q2));
          kid(kx, ky, kidI, { walk: t * 9, prop: 'backpack', s: lerp(0.95, 1.08, q2), flip: c.x > kx });
          if (j === 0) out.kid = [kx, ky];
        }
      }
      // how many children have walked to a car so far
      var picked = 0;
      for (var jj = 0; jj < batches * 3; jj++) if (ct - arrive(Math.floor(jj / 3)) - 0.4 - (jj % 3) * 0.7 > 0) picked++;
      out.picked = picked;
      out.inCar = mode === 'pick' && ct - arrive(0) - 0.4 > 2.2;
      return out;
    }

    // =========================================================================
    // Story beats that cross rooms
    // =========================================================================

    function drawStory(office) {
      var fl1 = FLR(1);
      // drop-off and dismissal at the portico
      if (at(1) || at(10)) {
        var pick = at(10), cp = carpool(pick ? 'pick' : 'drop');
        var ward = [pick ? 1160 : 1104, GROUND - 2];
        if (pick) {
          // children waiting on the steps, fewer as cars come
          var left = Math.max(3, 14 - cp.picked);
          for (var w = 0; w < left; w++) kidBack(912 + w * 15, GROUND - 6, 0.85, 120 + w, { desk: false, chair: false, backpack: true, stand: true });
        }
        person(ward[0], ward[1], look('ward', { arm: pick ? 'radio' : cp.kid && Math.abs(cp.kid[0] - 1084) < 2 && mod(t, 3) < 1.2 ? 'up' : 'wave', flip: true }));
        if (!pick && mod(t, 5) < 2.4) bubble(ward[0], ward[1] - 74, 'Good morning!');
        if (pick && cp.calling) bubble(ward[0], ward[1] - 74, cp.calling + '!');
        var dr = cp.car && !cp.leaving ? cp.car.driver : null;
        if (!pick && cp.kid && dr) {
          var ak = cp.kid, th = tagSize() * 1.9, ax = 1066 - tagW('Person', 'Ava') / 2, wx = ward[0] + 14 + tagW('Person', 'Mr. Ward') / 2;
          var ox = dr[0] - 10, oy = GROUND + 98;
          tag(ax, GROUND - 62, 'Person', 'Ava', ak[0], ak[1] - 38);
          tag(ax, GROUND - 62 - th * 1.9, 'Role', 'Student');
          tag(ox, oy, 'Person', 'Mr. Ortiz', dr[0], dr[1]);
          tag(ox, oy + th * 1.9, 'Role', 'Guardian');
          tag(wx, GROUND - 62, 'Person', 'Mr. Ward', ward[0] + 4, ward[1] - 50);
          tag(wx, GROUND - 62 - th * 1.9, 'Role', 'Staff');
          DYN.playsA = [ax, GROUND - 62 - th / 2, ax, GROUND - 62 - th * 1.4];
          DYN.playsB = [ox, oy + th / 2, ox, oy + th * 1.4];
          DYN.guardian = [ox + 20, oy - th / 2, ax - 10, GROUND - 62 + th / 2];
        }
        if (pick && dr && cp.kid !== undefined || pick && dr && cp.inCar) {
          var ap = cp.inCar ? cp.car.rider : [cp.kid[0], cp.kid[1] - 30], th2 = tagSize() * 1.9;
          var py0 = GROUND + 98, py1 = py0 + th2 * 2;
          var avx = dr[0] + 10 + tagW('Person', 'Ava') / 2, orx = dr[0] - 6 - tagW('Person', 'Mr. Ortiz') / 2;
          tag(dr[0] + 4, py0, 'Pickup', 'car 214 · 3:04 pm', dr[0] + 4, LANE - 4);
          tag(avx, py1, 'Person', 'Ava', ap[0], ap[1]);
          tag(orx, py1, 'Person', 'Mr. Ortiz', dr[0], dr[1]);
          tag(ward[0] + 14 + tagW('Person', 'Mr. Ward') / 2, GROUND - 64, 'Person', 'Mr. Ward', ward[0] + 4, ward[1] - 50);
          DYN.pickOf = [dr[0] + 20, py0 + th2 / 2, avx, py1 - th2 / 2];
          DYN.pickBy = [dr[0] - 12, py0 + th2 / 2, orx, py1 - th2 / 2];
          DYN.pickRel = [dr[0] + 40, py0 - th2 / 2, ward[0] + 16, GROUND - 64 + th2 / 2];
        }
        if (pick && ct > 6) {
          // Ms. Reed walks Leo out the front door
          var k = seg(6, 12), rx = lerp(1030, 800, k), ry = lerp(GROUND - 4, GROUND + 6, clamp(k * 3, 0, 1));
          var moving = k < 1;
          person(rx, ry, look('reed', { walk: moving ? t * 7 : null, arm: 'hand', flip: true }));
          kid(rx - 15, ry, 9, { walk: moving ? t * 8 : null, prop: 'backpack', flip: true, hair: 'short' });
          var th3 = tagSize() * 1.9, rtx = rx - 4 - tagW('Role', 'Teacher · 3rd grade') / 2, rgx = rx + 4 + tagW('Role', 'Guardian · of Leo') / 2, ryy = ry - 84 - th3 * 2;
          tag(rx, ry - 84, 'Person', 'Ms. Reed', rx, ry - 58);
          tag(rtx, ryy, 'Role', 'Teacher · 3rd grade');
          tag(rgx, ryy, 'Role', 'Guardian · of Leo');
          DYN.reedT = [rx - 14, ry - 84 - th3 / 2, rtx + 10, ryy + th3 / 2];
          DYN.reedG = [rx + 14, ry - 84 - th3 / 2, rgx - 10, ryy + th3 / 2];
        }
      } else {
        // light traffic the rest of the day
        var u2 = mod(t, 14) * V;
        if (step !== 12) car(W + 80 - u2, GROUND + 58, { color: '#BBBBBB' });
      }

      // 2nd grade homeroom: the roll
      if (at(2)) {
        var R = HOMEROOMS.r103, fl = FLR(1);
        var empty = R.seats.filter(function (s) { return s.i === 13; })[0];
        tag(R.x + 112, fl - 120, 'Class', '2nd grade · 20');
        tag(R.x + 54, R.board[1] - 8, 'Classroom', 'Room 103', R.x + 30, R.board[1] + 98);
        tag(R.x + 160, fl - 8, 'GradeLevel', '2nd', R.x + 112, fl - 18);
        DYN.meetsIn = [R.x + 80, fl - 127, R.x + 54, R.board[1] - 1];
        if (R.roster && R.roster.absentAt && ct > 7.5) {
          tag(R.laptop[0] + 20, R.laptop[1] - 14, 'Attendance', 'Mateo · absent', R.roster.absentAt[0], R.roster.absentAt[1]);
          tag(empty.x - 40, empty.y + 4, 'Person', 'Mateo (empty desk)', empty.x, empty.y - 20);
          DYN.attOf = [R.laptop[0] - 10, R.laptop[1] - 8, empty.x - 30, empty.y - 4];
          tag(R.laptop[0] + 30, R.laptop[1] + 60, 'Enrollment', 'Ava in 2nd grade', R.roster.firstAt[0], R.roster.firstAt[1]);
          DYN.enrolIn = [R.laptop[0] - 10, R.laptop[1] + 60, R.x + 150, fl - 120];
        }
      }
      // 1st grade reading group
      if (at(3)) {
        var R1 = HOMEROOMS.r102, f1 = FLR(1);
        var ce1 = CEI(1);
        tag(R1.x + 150, f1 - 104, 'Lesson', 'Reading · 87', R1.x + 72, f1 - 62);
        tag(R1.x + 105, R1.board[1] - 8, 'Subject', 'Reading', R1.x + 78, R1.board[1] + 16);
        tag(R1.x + 226, ce1 + 12, 'Period', '1st · 8:10', R1.x + 256, ce1 + 22);
        tag(R1.x + 40, f1 - 126, 'Person', 'Mr. Lopez', R1.x + 44, f1 - 100);
        tag(R1.x + 120, f1 - 2, 'Class', '1st grade · 20');
        DYN.lessonOf = [R1.x + 146, f1 - 110, R1.x + 120, R1.board[1] - 2];
        DYN.during = [R1.x + 172, f1 - 110, R1.x + 214, ce1 + 18];
        DYN.lessonBy = [R1.x + 116, f1 - 106, R1.x + 68, f1 - 124];
      }
      // 3rd grade math
      if (at(4)) {
        var R3 = HOMEROOMS.r104, f3 = FLR(1);
        var walking = ct >= 6, py = walking ? f3 - 88 : f3 - 126, hy = walking ? f3 - 72 : f3 - 110;
        tag(R3.x + 105, R3.board[1] - 8, 'Lesson', 'Math · 64', R3.board[0] + 40, R3.board[1] + 6);
        if (ct > 5) {
          tag(R3.x + 228, f3 - 100, 'Assignment', 'p.112 #1–10', R3.board[0] + R3.board[2] - 30, R3.board[1] + 40);
          DYN.assignFrom = [R3.x + 222, f3 - 106, R3.x + 140, R3.board[1] - 4];
        }
        tag(R3.x + 100, f3 - 2, 'Class', '3rd grade · 20');
        tag(R3.T.x, py, 'Person', 'Ms. Reed', R3.T.x, hy);
        DYN.taughtBy = [R3.x + 100, f3 - 9, R3.T.x - 10, py + 6];
      }
      // playground
      if (at(5)) {
        tag(120, GROUND - 156, 'Period', 'Recess · 10:15', X0 - 32, TOPS[1] + 64);
        tag(250, TOPS[1] + 34, 'School', 'Thales Academy', X0 - 12, TOPS[1] + 44);
        DYN.periodAt = [150, GROUND - 163, 214, TOPS[1] + 41];
      }
      // science lab
      if (at(7)) {
        tag(620 + 105, CEI(0) + 16, 'Lesson', 'Science · circuits', 620 + 105, CEI(0) + 40);
        tag(620 + 170, FLR(0) + 2, 'Classroom', 'Lab · 202', 620 + 60, FLR(0) - 30);
        tag(340 + 140, FLR(0) - 70, 'Class', '4th grade · in the lab now');
        tag(340 + 110, CEI(0) + 104, 'Classroom', 'Room 201 (empty)');
        DYN.heldIn = [620 + 150, CEI(0) + 23, 620 + 180, FLR(0) - 5];
        DYN.meetsIn7 = [340 + 140, FLR(0) - 77, 340 + 110, CEI(0) + 111];
      }
      // fifth grade test
      if (at(8)) {
        var R5 = HOMEROOMS.r203, f5 = FLR(0);
        if (R5.grades && R5.grades.benAt && R5.grades.shown > 5) {
          var ben = R5.seats.filter(function (s) { return s.i === 5; })[0];
          tag(R5.laptop[0] + 20, R5.laptop[1] - 14, 'Assessment', 'Ben · 72%', R5.grades.benAt[0], R5.grades.benAt[1]);
          tag(ben.x - 20, ben.y + 2, 'Person', 'Ben', ben.x, ben.y - 34);
          DYN.assessOf = [R5.laptop[0] - 10, R5.laptop[1] - 8, ben.x + 10, ben.y - 4];
        }
        tag(R5.x + 105, R5.board[1] - 8, 'Lesson', 'Unit 6 test', R5.board[0] + 40, R5.board[1] + 6);
        if (R5.grades && R5.grades.shown > 5) DYN.assessOn = [R5.laptop[0] + 10, R5.laptop[1] - 21, R5.x + 150, R5.board[1] - 8];
      }
      // a note home: across the ground floor
      if (at(9)) {
        var K = HOMEROOMS.r101, Q = HOMEROOMS.r104, fk = FLR(1);
        if (K.msg) {
          tag(K.laptop[0] + 10, K.laptop[1] - 16, 'Message', 'note home', K.laptop[0] + 20, K.laptop[1] + 6);
          tag(K.x + 150, fk - 128, 'Person', 'Ms. Grant', K.x + 196, fk - 52);
          var leo = K.seats.filter(function (s) { return s.i === 9; })[0];
          tag(leo.x - 10, leo.y + 4, 'Person', 'Leo', leo.x, leo.y - 30);
          DYN.msgFrom = [K.laptop[0] - 10, K.laptop[1] - 23, K.x + 150, fk - 121];
          DYN.msgAbout = [K.laptop[0] - 20, K.laptop[1] - 10, leo.x + 10, leo.y - 3];
        }
        // the note travels along the corridor
        if (ct > 4.8 && ct < 9) {
          var k2 = ease(seg(4.8, 8.6));
          var path = [[K.laptop[0] + 30, K.laptop[1]], [K.laptop[0] + 30, TOPS[1] + 22], [Q.laptop[0] + 30, TOPS[1] + 22], [Q.laptop[0] + 30, Q.laptop[1]]];
          var L = 0, segs = [];
          for (var p = 1; p < path.length; p++) { var d = Math.hypot(path[p][0] - path[p - 1][0], path[p][1] - path[p - 1][1]); segs.push(d); L += d; }
          var dd = k2 * L, q = path[0];
          for (var s2 = 0; s2 < segs.length; s2++) { if (dd <= segs[s2]) { var a0 = path[s2], b0 = path[s2 + 1]; q = [lerp(a0[0], b0[0], dd / segs[s2]), lerp(a0[1], b0[1], dd / segs[s2])]; break; } dd -= segs[s2]; }
          lw(1); box(q[0] - 9, q[1] - 6, 18, 12, hexA(ENTITIES.Message.color, 0.3)); line(q[0] - 9, q[1] - 6, q[0], q[1] + 1); line(q[0] + 9, q[1] - 6, q[0], q[1] + 1);
          tag(q[0], q[1] - 20, 'Message', 'to Leo\'s guardian');
        }
        if (ct > 8.6 && Q.inbox) {
          tag(Q.laptop[0] + 10, Q.laptop[1] - 16, 'Message', 'from Ms. Grant', Q.inbox.freshAt ? Q.inbox.freshAt[0] : Q.laptop[0], Q.inbox.freshAt ? Q.inbox.freshAt[1] : Q.laptop[1]);
          tag(Q.x + 120, fk - 130, 'Person', 'Ms. Reed · Leo\'s guardian', Q.x + 196, fk - 52);
          DYN.msgTo = [Q.laptop[0] - 10, Q.laptop[1] - 23, Q.x + 150, fk - 123];
        }
      }
      // closing the day: the custodian mops the porch
      if (at(11) || step > 11) {
        var mx = 1112 + Math.sin(t * 0.5) * 22;
        person(mx, GROUND - 4, look('cust', { arm: 'mop', flip: Math.cos(t * 0.5) < 0, s: 0.95 }));
      }
      if (at(11) && office) {
        tag(office.scr[0] + 10, office.scr[1] - 16, 'Attendance', '119 present today', office.dash.presentAt[0], office.dash.presentAt[1]);
        tag(office.scr[0] + 20, office.scr[1] + office.scr[3] + 52, 'Pickup', '119 hand-offs', office.dash.pickedAt[0], office.dash.pickedAt[1]);
        tag(CX0 + 70, CEI(1) + 26, 'School', 'Thales Academy');
      }
    }

    function drawLunchTags(tabs) {
      if (!at(6) || !tabs) return;
      tag(MPR.x + 140, tabs[0][1] - 40, 'Class', '5th grade · 20');
      tag(MPR.x + 70, tabs[1][1] - 34, 'Class', '4th grade · 20');
      tag(MPR.x + 140, tabs[2][1] - 34, 'Class', '3rd grade · 20');
      tag(MPR.x + 228, tabs[0][1] - 76, 'GradeLevel', '5th');
      tag(MPR.x + 176, MPR.y + 64, 'School', 'Thales Academy');
      DYN.classAt = [MPR.x + 190, tabs[0][1] - 47, MPR.x + 214, tabs[0][1] - 69];
      DYN.gradeAt = [MPR.x + 240, tabs[0][1] - 83, MPR.x + 214, MPR.y + 71];
    }

    function drawBell() {
      var x = X0 - 32, y = TOPS[1] + 56, ring = (at(5) || at(10)) && ct < 3.5 && !reduced;
      lw(1.2); line(X0 - 14, y - 6, x, y - 6); line(x, y - 6, x, y - 3);
      ctx.save(); ctx.translate(x, y - 3); ctx.rotate(ring ? Math.sin(t * 30) * 0.25 : 0);
      ctx.beginPath(); ctx.moveTo(-7, 13); ctx.quadraticCurveTo(-7, 0, 0, 0); ctx.quadraticCurveTo(7, 0, 7, 13); ctx.closePath();
      ctx.fillStyle = hexA('#D4A017', 0.5); ctx.fill(); ctx.stroke();
      dot(0, 15, 2, P.ink);
      ctx.restore();
      if (ring) { lw(1); for (var k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(x, y + 6, 14 + k * 6, Math.PI * 0.7, Math.PI * 1.3); ctx.stroke(); } }
    }

    function drawScene() {
      drawSky();
      drawGrounds();
      drawShell();
      drawFacade();
      drawLab();
      drawLibrary();
      drawHomerooms();
      var office = drawOffice();
      var tabs = drawMPR();
      drawPortico();
      drawPlayground();
      drawBell();
      drawStory(office);
      drawLunchTags(tabs);
    }

    // =========================================================================
    // Overlays: tags, focus, relation arrows, the map
    // =========================================================================

    function tag(x, y, ent, label, lx, ly) { TAGS.push([x, y, ent, label, lx, ly]); }
    function tagSize() { return Math.max(4.6, 10.5 * px); }
    function tagW(ent, label) { var s = tagSize(); return textW(ent + ' · ' + label, s, 800) + s * 2.4; }
    function drawTags() {
      var s = tagSize();
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
      var cx = mx - dy / d * b, cy = my + dx / d * b, head = Math.max(7, 9 * px);
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
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - Math.cos(ang - 0.42) * head, y2 - Math.sin(ang - 0.42) * head);
      ctx.lineTo(x2 - Math.cos(ang + 0.42) * head, y2 - Math.sin(ang + 0.42) * head);
      ctx.fill();
      if (label) pill(0.25 * x1 + 0.5 * cx + 0.25 * x2, 0.25 * y1 + 0.5 * cy + 0.25 * y2, label, color);
      ctx.restore();
    }
    function pill(x, y, label, color, size) {
      size = size || Math.max(4.4, 10 * px);
      var w = textW(label, size, 800) + size * 1.3, h = size * 1.75;
      ctx.strokeStyle = color; lw(Math.max(1.2, 1.4 * px));
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
    // The model as a graph. Drawn in screen space: over the building on wide screens,
    // stretched to fill the stage on phones, where the building is too small to hang it on.
    function mapPoints(narrow) {
      var pts = {}, names = Object.keys(ANCHORS);
      if (!narrow) {
        names.forEach(function (n) { pts[n] = [(ANCHORS[n][0] - cam.x) * cam.s + vw / 2, (ANCHORS[n][1] - cam.y) * cam.s + vh / 2]; });
        return pts;
      }
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      names.forEach(function (n) { var a = ANCHORS[n]; x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]); });
      var padX = 44, padT = 30, padB = 44;
      names.forEach(function (n) {
        var a = ANCHORS[n];
        pts[n] = [padX + (a[0] - x0) / (x1 - x0) * (vw - 2 * padX), padT + (a[1] - y0) / (y1 - y0) * (vh - padT - padB)];
      });
      return pts;
    }
    function drawMap(k) {
      if (k <= 0.001) return;
      var narrow = vw < 600, pts = mapPoints(narrow), keepPx = px;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      px = 1;
      ctx.save(); ctx.globalAlpha = (narrow ? 0.9 : 0.78) * k; ctx.fillStyle = P.paper; ctx.fillRect(0, 0, vw, vh); ctx.restore();
      ctx.globalAlpha = k;
      var R0 = narrow ? 12 : 15, lab = narrow ? 9 : 10.5, pl = narrow ? 8 : 9;
      function bendFor(i, d) { return (i % 2 ? 1 : -1) * Math.min(40, d * 0.12); }
      RELATIONS.forEach(function (r, i) {
        var a = pts[r[0]], b = pts[r[2]], col = ENTITIES[r[0]].color;
        if (r[0] === r[2]) { ctx.strokeStyle = col; lw(2); ctx.beginPath(); ctx.arc(a[0] - R0 * 1.4, a[1] - R0 * 1.2, R0 * 0.9, 0, TAU); ctx.stroke(); return; }
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), rb = (r[2] === 'Person' ? 1.35 : 1) * R0 + 4;
        arrow(a[0] + dx / d * (R0 + 2), a[1] + dy / d * (R0 + 2), b[0] - dx / d * rb, b[1] - dy / d * rb, bendFor(i, d), col, null, 1);
      });
      RELATIONS.forEach(function (r, i) {
        var a = pts[r[0]], b = pts[r[2]];
        if (r[0] === r[2]) { pill(a[0] - R0 * 2.3, a[1] - R0 * 2.3, r[1], ENTITIES[r[0]].color, pl); return; }
        var dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy), bend = bendFor(i, d);
        pill((a[0] + b[0]) / 2 - dy / d * bend * 0.5, (a[1] + b[1]) / 2 + dx / d * bend * 0.5, r[1], ENTITIES[r[0]].color, pl);
      });
      Object.keys(pts).forEach(function (n) {
        var p = pts[n], e = ENTITIES[n], R = n === 'Person' ? R0 * 1.35 : R0;
        ctx.strokeStyle = e.color; lw(2.5);
        circle(p[0], p[1], R, P.paper);
        ctx.font = R * 1.05 + 'px ' + FONT;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.ink;
        ctx.fillText(e.icon, p[0], p[1] + 1);
        ctx.strokeStyle = P.ink;
        var w = textW(n, lab, 800) + lab;
        fillRect(p[0] - w / 2, p[1] + R + 2, w, lab * 1.5, e.color);
        text(n, p[0], p[1] + R + 2 + lab * 0.78, lab, 'center', 800, null, '#fff');
      });
      px = keepPx;
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
      if (!reduced) ct += dt;
      sunH = lerp(sunH, hours(TOUR[step].time), reduced ? 1 : 1 - Math.exp(-dt * 1.5));
      if (playing) {
        stepClock += dt;
        var dur = stepDuration(step);
        dotEls[step].firstChild.style.width = clamp(stepClock / dur, 0, 1) * 100 + '%';
        if (stepClock >= dur) { if (step === TOUR.length - 1) { playing = false; renderCard(); } else go(step + 1); }
      }
      if (!free) {
        var f = targetCam(), k = reduced ? 1 : 1 - Math.exp(-dt * 2.2);
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
      DYN = {};
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = P.paper;
      ctx.fillRect(0, 0, vw, vh);
      ctx.setTransform(dpr * cam.s, 0, 0, dpr * cam.s, dpr * (vw / 2 - cam.x * cam.s), dpr * (vh / 2 - cam.y * cam.s));
      ctx.strokeStyle = P.ink;
      ctx.lineCap = 'butt';
      ctx.lineJoin = 'round';
      drawScene();
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
    host.__tia = api;
    return api;
  }

  function autoMount() {
    var hosts = document.querySelectorAll('#thales-scene, [data-thales-scene]');
    for (var i = 0; i < hosts.length; i++) {
      var h = hosts[i];
      mount(h, { autoplay: h.getAttribute('data-autoplay') !== 'false', theme: h.getAttribute('data-theme') || undefined });
    }
  }

  window.ThalesInADay = { mount: mount, model: { entities: ENTITIES, relations: RELATIONS } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', autoMount);
  else autoMount();
})();
