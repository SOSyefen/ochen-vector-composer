<reasoning>
I'm planning a critical review of aiComposer.ts and Canvas.tsx and will answer in Russian with complete, production-ready code. I'm starting with the clipped shadows problem in Canvas.tsx, where the outer SVG's overflow-hidden clips at the artboard edge, which is expected, but the object shadows need checking too.

I'm looking at why the shadows get cut off, and the SVG extraction in Canvas.tsx looks suspicious: the regex grabs only the inner markup and drops the root svg's attributes, and the non-greedy match could stop at a nested closing tag. I'm also checking whether Figma's clip-path on the frame and the filter region are what cut the drop shadows at straight edges.

I'm checking whether the viewBox's min-x and min-y offsets are being dropped, since the code only seems to keep the width and height. The inner content is injected without any viewBox clipping, so the cut must come from the source asset itself, such as a clip path baked in during export, or from how the scoped ids get replaced.

I'm checking the scoped id replacement, which handles double-quoted attributes correctly but misses single-quoted ones. I'm also looking at a possible side effect: the recolor pass might be changing fill colors inside `<mask>` and `<clipPath>` elements, which could alter how the shadows are clipped.

I'm now weighing why the shadows are cut in straight lines: the likely cause is a clip-path from Figma's "Clip content" on the frame, or a filter region that is too small, both baked into the source SVG rather than introduced by the parsing code. Since I can't inspect svgRegistry or the actual assets, I'll rank the probable causes and suggest a way to confirm each one.

I'm working through why the shadows are cut in straight lines, and the likely culprit is a clip-path that Figma baked into the export when "Clip content" was on the frame, with its rect matching the artboard. Stripping that root clip or re-exporting without it might recover the full shadow geometry, though I can't confirm without seeing the actual assets.

I'm now checking whether the viewBox's min-x and min-y offsets are being ignored, since the hit rect and selection only use the width and height, which would throw off positioning if the origin isn't zero. I'm also looking at whether the artboard edge is what cuts the shadows: objects placed near the horizontal limits of the canvas could extend past it and get clipped in a straight line.

I'm now going through the remaining causes of the straight-line cut: the artboard's overflow clip hitting objects placed too close to the edge, and the possibility that the source export's filter region is too small for the drop shadow.

I'm checking the filter definitions next, since Figma's drop-shadow filters use userSpaceOnUse regions that should survive the transform. The scoping step handles url(#...) references, though I'm wondering whether a filter id could be mangled by the replacement.

I'm checking the mask and filter attributes next: the Figma-style `maskUnits="userSpaceOnUse"` mask and its frame-sized x/y/width/height could clip the shadow too. I'm also verifying that the recolor pass only touches `fill` values and doesn't change anything inside those mask definitions.

I'm settling on three layers that could be clipping the shadows: a frame-level clip-path baked into the export, objects placed too close to the artboard edge, and the viewBox origin being ignored. My plan is to parse the full viewBox including its minimum offsets, strip any clip-path that only wraps a rect matching the frame, and measure real bounding boxes with getBBox() so the composer keeps objects inside a safe area.

I'm settling on writing a self-contained SVG parser, since I can't see svgRegistry or its types. I'll keep it to a helper that returns the inner markup, the full viewBox offsets, and the size, and I'll put it directly in Canvas.tsx so the change stays within the two files.

I'm thinking about how the composer should handle object sizes, since I can't see svgRegistry's types. The existing `getRawSvg` and `parseSvgViewBox` could supply dimensions, but the composer doesn't know the size parameter. I'm considering an optional measurement callback so the composer can keep objects inside the safe area without breaking the current signature.

I'm settling on a dependency-injected measurement callback for the composer, falling back to a nominal 240×240 size when none is passed, so the existing signature keeps working. The calling code in App.tsx can supply the real dimensions from the registry. Next I'm moving to the composition layout itself, since the current fixed corner slots at ±380 produce a scattered, clip-art look.

I'm weighing whether to keep the 15° rotation button, since rotating a pre-drawn isometric asset breaks its projection, and flipping it horizontally would also reverse the light and shadow direction. I'm leaning toward removing rotation and flip for iso scenes, or at least flagging the button as an art-direction violation.

I'm deciding on the scale hierarchy now: one hero object at roughly 1.3–1.6× covering a third to near half the canvas, one or two secondary pieces around 0.6–0.75 of that, and a couple of small accents. Stroke width has to scale along with the objects, so I'm checking that the outlines stay consistent at every size.

I'm weighing how big the scale steps should be, since stroke width scales with the object and a wide spread would make outlines inconsistent. Hero at about 1.3 is where I'm leaning, with secondary pieces around 0.9–1.0 and accents at 0.6–0.75, keeping the stroke ratio within roughly 1.5–2×.

I'm figuring out the composition's depth order, using each object's ground contact point rather than arbitrary indices, and I'm planning a scale hierarchy with one hero piece, a secondary piece, and accents that overlap to form a cluster.

I'm weighing whether a shared ground plate under the cluster would fit the brand rules, since it would be a computed isometric rhombus in palette colors rather than a new asset type.

I'm weighing whether to add a ground plate under the cluster, but drawing it only in Canvas would make the export diverge from what the user sees, so I'm leaning against it and keeping the composition to the objects themselves.

I'm settling on a shared helper file for the SVG preparation, since the export path needs the same sanitizing and I can't see svgRegistry.ts. Putting it in its own small module keeps Canvas and the export logic from drifting apart, and it fits the two-file scope better than importing a utility out of a component.

I'm going with a separate `src/utils/svgPrepare.ts` for the sanitizing, since export has to use the same function and I'd rather not import a helper out of a component. For the placement, I'm working on a semantic pairing layer, where objects that belong together (a pen on a notebook, a coin beside a phone, a lamp behind a book) get an affinity list that shapes the cluster.

I'm working out how the composition's scale and overlap should work: a hero piece around 1.3×, a secondary piece and a couple of accents, with the scale steps kept small enough that the stroke weights stay consistent. I'm also thinking about placing the objects along the isometric diagonals and ordering them by their ground contact point so the depth reads correctly.

I'm laying out the isometric projection for the composition: grid coordinates get mapped to the screen along the 30° diagonals, with depth taken from the sum of the grid coordinates so nearer objects draw later.

I'm checking how wide the neighboring objects land in the isometric grid: at one grid step the horizontal offset is about 0.48 of the hero's width, while the combined half-widths come to roughly 0.87, so the bounding boxes overlap heavily. Since the rhombus-shaped silhouettes leave more empty space than their boxes, the real visual overlap should be smaller than that.

I'm checking whether bounding-box overlap is a good stand-in for visual overlap, since the rhombus silhouettes leave a lot of empty corners. Overlap of about 29% of the secondary's width in box terms should look like roughly 10–15% in practice, but I can't confirm that without the real assets, so I'll make the tightness a tunable constant and plan a visual pass. I'm also considering placing each neighbor by its contact distance along the iso axis rather than by a fixed grid step, so the spacing adapts to unknown asset sizes.

I'm sizing the spacing between neighbors from the bounding boxes rather than a fixed grid step, so the gap adapts to whatever asset dimensions come through. Projecting each object's extent onto the isometric direction and scaling by one minus a target overlap gives a separation that keeps them touching without fully colliding, and I'll expose that overlap as a tunable constant since I can't see the real assets to check it.

I'm sizing each neighbor's offset from the bounding-box extents rather than a fixed grid step: distance equals the combined extents times one minus a target overlap of around 0.35–0.45, with a little seeded jitter. That keeps the objects touching without fully colliding, whatever the asset dimensions turn out to be.

I'm defining the placement directions as four isometric vectors, front-right, front-left, back-right, and back-left, and noting that depth follows the base line of each object, so tall items like a lamp in the back still draw behind what's in front. I also want every object aligned by its ground contact point rather than its bounding-box center.

I'm working out where each object's ground contact point sits, estimating it as the bottom of the bounding box lifted by about 0.29 of the footprint width, and I'll place the neighbors along the isometric directions from those ground points, so tall and short objects line up on the same base.

I'm working out the spacing between neighbors along the isometric axes: each footprint's half-extent is roughly 0.289 of its width, so the distance between two ground points scales with their combined footprints times a factor that controls how much they touch, and I'm keeping that factor just under full contact so the objects don't interpenetrate.

I'm settling the spacing constant: touching footprints along the front-right axis, with the front object's body rising over the hero's lower right face, so a factor just above or below 1 should read as objects standing side by side. Since the bounding boxes may include shadows that make them wider than the real footprint, I'll expose that factor as a tunable `SPACING` constant instead of hardcoding it.

I'm weighing two placement approaches, and the second one, sizing each gap from the actual bounding boxes, looks more robust to asset sizes I can't see yet.


</reasoning>

