# Thales in a day — animated explainer

A self-contained, plain-JavaScript animation of one school day at a Thales
Academy elementary campus. It explains what a school keeps track of to people
who have never read a data model.

The scene is drawn from the front of the building: two red-brick wings, the
white columned portico, and the sign over the door. The front wall is lifted
off to show what happens inside:

- six homerooms, from kindergarten to fifth grade, with twenty students each
- a science lab, the library, the front office and the multipurpose room
- the playground and the carpool lane outside

Teachers teach at the board, children answer together on the signal, and the
laptops show the roll, the gradebook and messages home.

The tour follows the day:

| Time | What happens |
|---|---|
| 07:40 | Drop-off: Ava gets out of car 214, and Mr. Ward, the headmaster, says good morning. |
| 07:55 | Homeroom in 2nd grade: the Pledge, then the roll. 19 here, Mateo is home sick. |
| 08:10 | Reading in 1st grade: Mr. Lopez with a reading group of six, the other fourteen at their desks. |
| 09:20 | Math in 3rd grade: examples at the board, then workbook page 112. |
| 10:15 | Recess: kindergarten and 1st grade, forty children on the playground. |
| 11:30 | Lunch: 3rd, 4th and 5th grade, one long table per class. |
| 12:40 | Science lab: 4th grade wires up a battery and a bulb while Room 201 sits empty. |
| 13:30 | Mastery test in 5th grade: 18 of 20 score above the line. |
| 14:20 | A note home: Ms. Grant writes to Leo's guardian, who teaches 3rd grade down the hall. |
| 15:00 | Dismissal: Mr. Ward calls car numbers, and each child walks out to the right car. |
| 16:00 | Closing the day: 119 of 120 present, 119 picked up. |

As things happen, small tags name the records behind them, such as
`Person · Ava`, `Role · Guardian`, `Attendance · Mateo · absent`,
`Lesson · Reading · 87` or `Pickup · car 214`. Dashed arrows show the
relationships between them. The caption tells the story first, then explains
it under **In the model**. The last stop fades the building into the graph of
the model: 15 entity types and 26 relationships.

This is an illustration. The people, names, scores and times are made up, and
the schedule is a typical elementary day, not a published Thales timetable.

Everything is drawn at runtime with the Canvas 2D API. There are no images,
fonts, libraries or network requests.

## Host it

Copy `thales-in-a-day.js` to any static host. `index.html` is optional.

```html
<div id="thales-scene" style="height: 100vh"></div>
<script src="thales-in-a-day.js"></script>
```

The script mounts itself on `#thales-scene` or on any element with a
`data-thales-scene` attribute. The element needs a height, and the scene
fills it.

You can set options as data attributes or pass them to
`ThalesInADay.mount(el, options)`:

| Attribute / option | Default | Meaning |
|---|---|---|
| `data-autoplay="false"` / `autoplay: false` | `true` | Start paused. Autoplay is always off under `prefers-reduced-motion`. |
| `data-theme="light\|dark"` / `theme` | follows the OS | Force a colour scheme. |

`mount` returns `{ go(i), play(), pause(), element }`.
`ThalesInADay.model` exposes the entity types and relationships.

## Controls

- **‹ / ›**, or the arrow keys: previous or next stop
- **❚❚ / ▶**, or Space: pause or play the tour
- **Map**, or M: show the model as a graph over the building
- Click a room to jump to its stop. Drag to pan, and scroll or pinch to zoom.

With reduced motion, each stop holds one moment of its story instead of
playing it out.

## Changing the model

`ENTITIES` and `RELATIONS` at the top of the script are the whole model. The
last stop and the Map overlay are drawn from these two lists, and `ANCHORS`
places each entity type on the building for the graph. Each stop in `TOUR`
names the entities and relationships it explains. The story functions
(`drawStory`, `homeroom`, `carpool` and the room functions) add that stop's
tags and arrows while it is active.
