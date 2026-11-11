<reasoning>
I'm going through the recolor engine now, starting with the hex normalization. It handles uppercase names like WHITE and BLACK and 3-digit hex, but it misses rgb() strings, named colors, and 8-digit hex.

Next I'm checking the palette-related constants: the approved system backgrounds, and the forbidden canvas colors, which include the object colors. I notice the forbidden list is hardcoded, so custom palettes are not covered. A custom palette could set its background equal to its own primary accent, and `validatePalette` only checks the background against the global forbidden set, not against the palette's other roles.

Now I'm working through what a custom palette could get wrong: its background might equal one of its own object colors, and the current check only tests it against the global forbidden list. A more robust rule would treat every non-background role as an object color, and also compare colors perceptually rather than by exact hex match.

I'm checking whether `isAllowedCanvasBg` can be bypassed: it passes for a custom palette's background whenever `validatePalette` accepts it, and `App` hands `setCanvasBg` straight to the Sidebar with no guard of its own. So the real check depends on whether the Sidebar validates before calling it, which I can't see from here.

Next I'm looking at what `App` does with the canvas background: the state setter is unguarded, and `handlePaletteChange` assigns a palette's background without calling `validatePalette`. The export path also writes `canvasBg` straight into the SVG `fill` attribute with no escaping or compliance check.

Now I'm checking the color mapping for a collision bug: the replacement loop applies each source-to-target swap in sequence on the same string, so a target produced by one swap could match a later source and be swapped again. I'm walking through the Sand targets against the source list to see whether any of them clash.

I'm checking the Sand and Mint target colors against the source list for collisions, and the sequential swap order looks safe for those two built-in palettes. The real risk is with custom palettes, where one swap's target could match a later source and be replaced a second time, so I'm working through a concrete case of that.

I'm now checking whether the color swaps can collide with each other. Since the replacements run one after another on the same string, a target produced by an early swap could match a later source and get swapped again. The built-in Sand and Mint palettes look safe, but a custom palette could reuse a source color as a target, causing double-mapping or even a swapped pair of highlight and tertiary colors to revert.

Now I'm looking at the hex matching. The regex is case-insensitive, so the uppercase `WHITE` key is covered, but 3-digit shorthand like `#fff` is not, and optimized SVGs often shorten `#FFFFFF` that way.

I'm noticing the style-matching regex only catches a color when it's followed by `;` or a double quote, so `fill:#AA9BF0}` in a `<style>` block or single-quoted style attributes would slip through. I'm also thinking about `stop-color` and `flood-color` in gradients, plus `!important`, which all go unhandled.

I'm looking at the regex approach for matching colors in the SVG. A pattern that covers 6-digit and 3-digit hex plus the white keyword, applied anywhere in the attributes or style, would catch the cases the current style matcher misses, though it could in principle hit hex strings in unrelated places.

Now I'm looking at a DOM parser as a way to handle named white without matching inside unrelated IDs or attributes.

I'm working out the color matching: a single regex can catch 8-, 6- and 3-digit hex, plus the white keyword, provided the keyword only matches as a whole token outside of id-like strings. I'm also weighing whether a DOM parser would be cleaner than a regex for limiting the match to fill, stroke, stop-color, flood-color, color and style declarations. Sketching the regex with lookbehind and lookahead guards now.

Now I'm looking at how the color replacement should be restricted to the right spots in the SVG: color attributes like fill and stroke, style declarations, and style blocks. That way a bare "white" inside an id or other text won't get swapped. I'm weighing a two-step approach against a DOM-based one, since the DOM version would be cleaner but might cost too much when it runs on every render.

Now I'm turning to the scoping of SVG ids, and I'm about to look at the regex that matches them.

I'm checking the `id` regex next. The `\b` before `id=` also matches inside `data-id=` and `xml:id`, so it would collect those too, and the replacement would then rewrite `data-id` values as well, which is harmless in most cases but still incorrect. A pattern like `grid=` doesn't match because the `r` before `id` blocks the word boundary.

I'm now checking how the id replacement handles quoting. The `href` rewrite only catches the double-quoted form, so `href='#id'` is missed, and single-quoted `id='x'` values get collected by the regex but never replaced.

I'm now checking how the id replacement handles quoting: the replacement only matches double-quoted `id="x"`, so single-quoted ids get collected but never rewritten, while their `url(#x)` references still get renamed, which leaves dangling references. I'm also noting that class selectors in inline `<style>` blocks are global, so two objects exporting the same class names like `.cls-1` would override each other's fills.

I'm checking the instance IDs next, since the prefix is built from a sanitized instanceId and a collision could happen if two objects are created in the same millisecond with `Date.now()`.

I'm checking whether duplicated objects can end up with the same instance ID. Two copies made within the same millisecond would both get `obj_${Date.now()}_${illustrationId}`, so their IDs collide and the scoped SVG IDs collide with them.

I'm checking the instance IDs next, and the concern is that duplicates pick up the same `obj_${Date.now()}_${illustrationId}` prefix, so their scoped SVG IDs would collide. I'm also noting that the exported group ID isn't sanitized, though I don't see that causing a real problem.

I'm now checking the thumbnails elsewhere in the app, which render the same illustrations without an instance ID, so their raw SVG IDs stay unscoped. That could give duplicate IDs in the document, since several thumbnails of one illustration would share names like `clip0_...`, and I can't see the Sidebar code to confirm how it's rendered.

Still working through the ID scoping, and now I'm looking at a single-pass callback version so the replacements can't chain into each other.

Still working on the ID scoping, now sketching a single-pass rewrite that collects ids from whitespace-preceded `id=` attributes and then rewrites them in `url(#...)` and `href` references in one regex.

Still working on the ID scoping, now looking at how to handle the `#ID` selectors in `<style>` blocks. I'm building one combined regex that rewrites id attributes, `url(#...)` references, and `href` targets in a single pass.

Now I'm writing the capture groups for the combined regex, covering the id attribute, the url() reference, and the href target, each with its own quote handling.

Still working on the ID scoping, now writing the replacer that handles the three cases: id attributes, url() references, and href targets, each with its own quote handling.

Still writing the class scoping for the style blocks, collecting class names from the class attributes so they can be prefixed.

Still writing class scoping...

I'm now checking the recolor regex, which gets compiled fresh on every call for each object on every render, so that's a performance cost I should note. I'm also looking at the style rules inside the SVG's `<style>` blocks, since they apply across the whole document and their color values need to be caught too.

Next I'm flagging that the custom target colors aren't validated before they go into `fill="..."` attributes, so a crafted value containing a quote could break out and inject markup, which matters because the output is rendered with `dangerouslySetInnerHTML`. I'd run every target through the hex normalizer and a strict pattern check before use. I also want to look at the palette mapping, since the Sand palette's tertiary and soft-fill roles don't line up with what the Lavender roles mean.

I'm now checking the palette mapping for the Lavender source, where the `bg` role color `#D7CDF5` is also used for object shapes. Objects built from that color would blend into a canvas with the same background and disappear, and the same could happen with white fills on a white canvas.

Now I'm checking whether the background check, `isAllowedCanvasBg`, actually accepts only the approved system backgrounds.


</reasoning>

