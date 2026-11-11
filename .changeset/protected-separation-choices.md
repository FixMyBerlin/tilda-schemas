---
'@tilda-geo/bicycle-infrastructure': minor
'@tilda-geo/bicycle-infrastructure-tagging': minor
---

A plan entry can carry `choices`: values the mapper can pick instead of the planned one. The separation of a protected cycle lane (`separation:left`, also `cycleway:<side>:separation:left`) uses it: `bollard` stays the default, then `flex_post`, `vertical_panel`, `bump`, `fence`, `guard_rail`, `planter`, `studs` and `jersey_barrier`, ordered by use in Berlin. Every choice reaches `cyclewayOnHighwayProtected`. `PROTECTIVE_SEPARATION` has the same order now.

In the tagging package `PlannedAdd` and `PlannedChange` pass `choices` on, so an editor can show a selection instead of writing `bollard` without asking.
