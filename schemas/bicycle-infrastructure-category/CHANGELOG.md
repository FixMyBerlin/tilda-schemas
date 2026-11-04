# Changelog — bicycle-infrastructure-category

## 0.2.0 — 2026-11-04

Synced with tilda-geo `develop` of 2026-11-04. No category value is added or removed.

- `highway=cycleway` with `traffic_sign=none` (or `no`) is a cycleway (`cycleway_adjoiningOrIsolated`,
  `_adjoining` / `_isolated` with `is_sidepath`) instead of `needsClarification` (tilda-geo `98e649800`).
  `highway=cycleway` without any `traffic_sign` stays `needsClarification`; shared and segregated foot and
  cycle paths still win.

## 0.1.0 — 2026-07-27

- Initial extraction from the TILDA LUA / TypeScript bicycle-infrastructure work:
  category enum and fixtures (including explicit-absence cases).
