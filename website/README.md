# TILDA Schemas website

Astro + Keystatic docs site for [tilda-schemas](https://github.com/FixMyBerlin/tilda-schemas).

Follows the FMC [`keystatic-astro`](https://github.com/FixMyBerlin/fixmyskills) skill:
dual-file collections under `cms/`, Content Layer only, Keystatic **off** in production CI.

## Local

```bash
cp .env.example.local .env
bun install   # from repo root
bun run dev   # from website/ — Keystatic at /keystatic
```

## Production (GitHub Pages)

Built by [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) with
`ASTRO_ENABLE_KEYSTATIC=false`. Site URL: `https://fixmyberlin.github.io/tilda-schemas/`.

Enable **Settings → Pages → Source: GitHub Actions** after the first workflow run.
