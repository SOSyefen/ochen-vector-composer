<reasoning>
I'm auditing the code in Russian and aiming for real bugs rather than surface nits. I'm starting with recolorEngine, where `isAllowedCanvasBg` returns true for any color not on the forbidden list, which makes it permissive by default. I also suspect custom palette object colors aren't being checked against the background.

I'm checking the palette rules now: `activePalette` is never actually enforced, and the custom palette's own object colors aren't validated against the background list. I'm also weighing whether white counts as an allowed background when it's also an object color in every palette, since that depends on what the spec permits.

I'm checking the `recolorSvg` replacement logic, which substitutes colors one role at a time. I suspect that if one role's target color matches another role's source color, the later substitution will overwrite it, so I'm working through the Sand palette values to confirm.

I'm checking the color collision risk in recolorSvg. I've confirmed that the Sand and Mint palettes have no target color that matches a later source color, so substitution is safe for them, and I'm now looking at whether custom palettes could produce a collision.

I'm checking the `stop-color` gradient case next: the recolor regex only matches `fill` and `stroke` attributes and style properties, so gradient stops with hardcoded lavender would stay unchanged.

I'm looking at the gradient case now: the recolor regex only touches `fill` and `stroke` attributes and style properties, so `stop-color` values in gradients would keep their hardcoded lavender. I'm also noting that CSS blocks and single-quoted style attributes slip past the patterns, and that any gray or other off-palette colors in the source SVG get left untouched without warning.

I'm checking how the scoped IDs get rewritten inside the SVG, since a plain `id="x"` replace could be fine but the single-quoted and `<style>` references might not be covered.

I'm checking the `url("#id")` references and whether the scoped IDs could collide with each other or with the instance IDs, since the exporter and the App build those IDs in different places.

I'm checking the instance and clip IDs for collisions, which is fine since they're replaced per instance. I'm also noting that Figma's `clipPath` IDs need scoping, and that the export's group IDs start with a valid prefix. Next I'm looking at the Canvas recolor step, which runs on every render and could be memoized.

I'm looking at the Canvas component now, and the recolor step runs on every render, so I'm thinking about memoizing it per object. Pointer dragging has a gap too: without pointer capture, releasing outside the container could leave the drag stuck, so I'll switch to setPointerCapture.

I'm checking the Canvas click handling now, and there's a likely bug: a click on an object sets it as selected, but the click event still bubbles up to the container's handler, which deselects it. Unless something stops that, selection on canvas click would be wiped out right away.

I'm noting that the Canvas click handling has a real bug: a click on an object selects it, but the click still bubbles up to the container and clears the selection. Pointer-move updates also rebuild the whole object array on every event, so I'm thinking about throttling those with requestAnimationFrame. The rotation control only offers 15° steps, which I'm flagging as a limitation.

I'm noting that the root `<svg>` attributes, like `fill="none"`, get dropped by the extraction regex, and that Figma exports usually put that attribute on the root element. Nested `<svg>` tags would also break the lazy match, so I'm flagging the extraction as fragile.

I'm now checking how the root `<svg>` attributes get dropped during extraction, since things like `fill="none"` inherited by unstyled paths would change rendering. I'm also noting that a non-zero viewBox origin gets ignored, which shifts the content, and that the nested `<svg>` with its own viewBox would preserve it.

I'm moving on to the exporter now, where the transform and object markup logic duplicates what Canvas does, so I'd pull that into shared helpers. I'm also noting a few smaller issues: the `<style>` block is unnecessary for SVG and should go, and the canvas background color is written into the output without validation, so it needs a hex check.

I'm looking at the exporter's `xlink:href` usage: if the source SVG uses it without declaring `xmlns:xlink`, the output would be invalid XML, so the file wouldn't open in a standalone browser view. I'm also worried about embedded raster `<image>` elements, which would break the no-raster requirement, so I'll need a guard that rejects them.

I'm moving on to the aiComposer, where the matching is really just keyword substring lookup with first-match-wins, so the order of the rules biases the results. I'm noting that short Russian keywords like "иде" can match inside longer words such as "видео", which would cause false hits.

I'm checking the aiComposer keyword matching now, which is plain substring lookup with first-match-wins, so rule order skews the results. Short Russian keywords like "иде" can hit inside longer words such as "видео", and English ones like "crypt" can hit inside "скрипт", sending a dev request to fintech.

I'm reviewing the aiComposer next, where the matching is plain substring lookup with first-match-wins, so rule order skews the results. I'd score the rules rather than stop at the first hit. I'm also thinking this is labeled AI but is entirely deterministic, which a reviewer for a junior AI developer role would likely flag. An LLM with structured JSON output constrained to the 20 IDs, plus a keyword fallback, would fit better, as long as the output gets validated against that enum. Finally, the fixed pixel offsets look fine for the canvas sizes, but nothing checks whether the primary and secondary objects actually overlap once their real sizes are applied.

I'm checking the composer's fixed offsets against the object sizes, since nothing verifies the primary and secondary objects actually fit or overlap once real sizes apply. I also want to confirm the variant picks the secondary focal by slot position rather than by meaning, and that no object repeats across the primary and supporting slots within each rule. Every rule seems to avoid duplicates, and the rotation stays at zero, so the compositions come out static and deterministic.

I'm checking the App component next, where switching from square to vertical format doesn't relayout the objects, so anything past the new 720px width falls off the canvas. I'm considering remapping coordinates proportionally or regenerating the composition when the format changes.

I'm checking the App's ID-based handlers next. The new-object zIndex uses `objects.length + 1`, which lands below the generated objects that already sit at higher values, so an added object can appear behind everything. I'm also looking at the send-backward logic, where clamping at zero can leave several objects tied, and the duplicate handler, which may read stale state from the `objects` closure.

I'm noting that the palette upload path isn't visible in the code I've read, and that `CompositionState` is defined but never used since the App keeps separate state hooks. I also want to flag that palette changes set the canvas background straight from the palette without running validation first. The bigger gaps are the lack of undo/redo and persistence, plus no Delete key handling in the canvas.

I'm checking whether the Background variants are separate SVG files, which would push the asset count past the 20 the spec allows, or whether they're derived in code. I'm also worried that recoloring assumes every asset uses the Lavender palette, so I want a build-time test that extracts colors from each file.

I'm checking whether the canvas background rule is really a whitelist: right now `isAllowedCanvasBg` allows anything not on the forbidden list, so an arbitrary color like #123456 would pass. I'd switch to default-deny, built from the union of all palettes' bg roles, and derive the forbidden object colors from the palettes too instead of hardcoding them.

I'm weighing whether white counts as a background color, since the codebase approves it but the palettes may not list it. Sand's soft fill is the same #BEEBEB as Mint's background, so a bg color can also appear inside objects, which means a derived forbidden list would wrongly block it. The cleaner rule is a whitelist of background colors, and I need to confirm with the brief whether white belongs on that list.

Now I'm drafting the code fixes: a rewritten recolor engine, a shared object renderer, and a cleaned-up exporter.

Still writing the shared module and the related patches...

Still writing the shared composition module...

Still writing the DOM-based recolor module...

Still writing the recolor engine and shared renderer...

Still writing the recolor module...

Still writing the palette and background helpers...


</reasoning>

None