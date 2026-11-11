You are DeepSeek-R1, the leading algorithmic and mathematical logic analyst.
Conduct an exhaustive, deep-reasoning verification of the entire isometric illustration composer engine ("Конструктор векторных иллюстраций для Студии Очень", Junior AI Developer test task).

Task specification & constraints:
1. Pure vector SVG composition from 20 predefined illustrations (10 objects in Size L, 10 in Size S). NO raster generation.
2. AI Metaphor Composer: maps abstract user headlines/metaphors to isometric composition (1-2 main focal items, 2-4 background items, coordinates, rotation, scaling, z-index depth).
3. Dynamic Recolor Engine: supports 3 palettes (Lavender, Sand, Mint) and custom themes.
   CRITICAL CLIENT RULE: "Цвета фонов могут использоваться в объектах. Цвета для объектов НЕ могут использоваться в качестве фона холста".
4. Canvas formats: 1:1 (square 1000x1000), 16:9 (horizontal 1200x675), 9:16 (vertical 720x1280).
5. Standalone clean SVG export with zero rasterization.

Analyze the attached project files:
- `src/utils/recolorEngine.ts` (color mapping, scoped IDs, strict background validation)
- `src/utils/aiComposer.ts` (semantic keyword rules, focal placement, depth ordering)
- `src/utils/svgExporter.ts` (assembly of final downloadable SVG)
- `src/components/Canvas.tsx` (viewport, pointer drag-and-drop, scaling, layer selection)
- `src/App.tsx` (state management, object lifecycle, format/palette/size transitions)

Provide a rigorous mathematical and algorithmic critique:
1. Logic of isometric coordinates, collision avoidance, and scaling across different aspect ratios (1:1, 16:9, 9:16).
2. Correctness of color token replacements and verification of the client's background color constraint.
3. Edge cases: duplicate IDs, SVG namespace conflicts, NaN coordinates, drag boundaries.
4. Specific production improvements with exact code snippets.
