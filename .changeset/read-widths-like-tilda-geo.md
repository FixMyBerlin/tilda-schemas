---
'@tilda-geo/bicycle-infrastructure': minor
---

- Lengths and widths are read exactly like tilda-geo (`parse_length`, `parse_width`): the seven most common decimal commas (`2,5`, `0,5`, ...) are read, a negative length and `width=0` give no width, and only `cm`, `m` and `km` are converted.
- New exports `parseLength` and `parseWidth` so editors can use the same parser.
