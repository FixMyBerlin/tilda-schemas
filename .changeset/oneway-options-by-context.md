---
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

The oneway row offers its values by context, and says what each one means (`RequiredAttribute.optionMeanings`, texts in `OPTION_MEANING_TEXTS` via `optionMeaningText`):

- A way of its own offers `yes` and `no`, no longer `-1`: a way ridden against its line is reversed instead. A tagged `-1` still counts.
- A road side offers its default and `no`. On the left of a two-way road it also offers `yes` (a left lane ridden in the line's direction), and on a one-way road open to bicycles the contraflow value.
