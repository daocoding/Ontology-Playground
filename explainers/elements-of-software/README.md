# Elements of Software — animated explainer

A self-contained, plain-JavaScript animation that explains the
[Elements of Software](https://github.com/microsoft/Ontology-Playground/pull/86)
community ontology to people who have never read an ontology.

The scene is a hand-drawn cutaway of an ordinary software company, Acme
Cloud. The rooms are where the work happens: the Platform team's floor with
its stand-up board, desks and on-call dashboards, plus product and design, IT
and security, leadership, sales, a demo room, customer success, support,
finance and RevOps, reception, the kitchen and the phone booths. Everyone is
busy, and the screens show what they're doing: code, a pull request with its
CI checks, a deploy pipeline, the CRM pipeline, a video call, a spec, the
helpdesk, a RevOps workflow, billing and the audit log. Records travel between
floors the way they do in real life, as packets up the network riser to the
cloud where the company's apps run, and back down to someone else's screen.

The tour follows one deal through one day:

| Time | What happens |
|---|---|
| 09:10 | Sales demos to Dana at Globex on a video call: "We can't sign without SSO." |
| 09:30 | The deal moves to Proposal in the CRM, and sales asks #product about SSO. |
| 09:45 | The PM writes a spec and creates the SSO project and tickets. |
| 10:00 | Stand-up: Kai takes one ticket, and the coding agent agent-7 takes another. |
| 11:30 | agent-7 opens a PR, CI goes green, Kai reviews, and it merges. |
| 12:30 | Lunch: Platform, Sales and Support at one table. |
| 13:15 | IT approves agent-7's request for production deploy rights. |
| 14:30 | SSO ships, Globex signs, the deal moves to Won, and the gong rings. |
| 14:31 | A RevOps workflow starts billing and creates onboarding tasks. |
| 15:00 | Finance sees the subscription, the invoice and the payment. |
| 16:00 | Dana's first support ticket, and a saved view for Globex. |
| 17:30 | Security reads the day back from the audit log. |

As things happen, small tags name what the software keeps track of, such as
`Person · Dana`, `Deal · stage: Won`, `Agent · agent-7` or
`Permission · deploy · production`. Dashed arrows show the relationships
between them. The caption tells the story first, then explains it under
**In the model**. The last stop fades the building into the ontology graph
itself.

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
plays out that part of the story. Each room's `draw…` function adds its own
tags, arrows and network packets while its stop is active.
