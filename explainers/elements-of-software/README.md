# Elements of Software — animated explainer

A self-contained, plain-JavaScript animation that explains the
[Elements of Software](https://github.com/microsoft/Ontology-Playground/pull/86)
community ontology to people who have never read an ontology.

The scene is a hand-drawn cutaway of an ordinary software company, Acme
Cloud. Its rooms are places where work happens: reception, sales, a meeting
room, the product studio, operations, engineering, IT, support, contracts,
finance, the mailroom, a server room and an archive. People and agents work in
every room all the time.

The tour follows one customer, Dana from Globex, through a day there:

1. Dana arrives, and reception prints a LEAD badge.
2. Sales opens a deal folder and moves it across the pipeline board.
3. Dana, a sales rep and a note-taking agent meet.
4. Dana signs, the badge becomes CUSTOMER, and a subscription card drops to Finance.
5. A rule in Operations creates the onboarding tasks.
6. Engineering puts them on the project board.
7. IT hands the agent a key.
8. At month end, an invoice goes out and a payment comes back.
9. Dana emails Support, and a view is saved for Globex.
10. The archive tape has recorded every step.

As things happen, small tags name what the software keeps track of, such as
`Person · Dana`, `Deal · stage: PROPOSAL` or `Permission · EDIT`, and dashed
arrows show the relationships between them. The caption tells the story first,
then explains it under **In the model**. The last stop fades the building into
the ontology graph itself.

Everything is drawn at runtime with the Canvas 2D API. There are no images,
fonts, libraries or network requests.

## Host it

Copy `elements-of-software.js` (and optionally `index.html`) to any static
host:

```html
<div id="eos-scene" style="height: 100vh"></div>
<script src="elements-of-software.js"></script>
```

The script mounts itself on `#eos-scene` or on any element with a
`data-eos-scene` attribute. The element needs a height, and the scene fills it.

Options, as data attributes or through `ElementsOfSoftware.mount(el, options)`:

| Attribute / option | Default | Meaning |
|---|---|---|
| `data-autoplay="false"` / `autoplay: false` | `true` | Start paused. Autoplay is always off under `prefers-reduced-motion`. |
| `data-theme="light\|dark"` / `theme` | follows the OS | Force a colour scheme. |
| `data-map-url="…"` / `mapUrl` | the Ontology Playground catalogue entry | Link shown on the last stop. Set it to `""` to hide the link. |

`mount` returns `{ go(i), play(), pause(), element }`.

## Controls

- **‹ / ›**, or the arrow keys: previous or next stop
- **❚❚ / ▶**, or Space: pause or play the tour
- **Map**, or M: overlay the ontology graph on the building
- Click a room to jump to its stop. Drag to pan, and scroll or pinch to zoom.

## Keeping it in sync with the ontology

`ENTITIES` and `RELATIONS` near the top of the script mirror
`catalogue/community/daocoding/elements-of-software/ontology.rdf`. The last
stop and the Map overlay are drawn from these two lists. If the ontology
changes, update the lists, then the `TOUR` entry and the room function that
plays out that part of the story (each room's `draw…` function adds its own
tags and arrows when its stop is active).
