# Elements of Software — animated explainer

A self-contained, plain-JavaScript animation that explains the
[Elements of Software](https://github.com/microsoft/Ontology-Playground/pull/86)
community ontology to people who have never read an ontology.

The scene is a hand-drawn cutaway of a software company. Each entity type has
its own room, and the relationships play out as things you can watch:

- task cards are stamped with an assignee as they ride a conveyor
- a deal crate keeps its identity while its `stage` label changes at each gate
- the subscription wheel prints an invoice on every turn, and a payment settles it
- a visitor's badge changes from Lead to Customer to Vendor, but the visitor stays the same

A camera tour visits each room with a caption that names the entity types and
relationships in view. The last stop fades the building into the ontology
graph itself.

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
changes, update the lists, then the matching room and `TOUR` entry.
