This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Authentication configuration

Vercel deployments with no `AUTH_*` variables use the public demonstration
account `Ruoting` / `dmr2026`. Local development uses the same account. This
fallback is intended only for non-sensitive demonstrations.

For private deployments, configure all three server-only variables. A complete
configuration overrides the demo account; a partial configuration fails closed.
Generate a random `AUTH_SECRET` of at least 32 characters, and never expose these
values with a `NEXT_PUBLIC_` prefix.

```bash
AUTH_USERNAME=...
AUTH_PASSWORD=...
AUTH_SECRET=...
```

Production environments other than Vercel fail closed when these variables are
absent. Do not deploy restricted or unpublished data with the public demo
credentials enabled.

## Data architecture

Large common annotation maps remain server-side and are parsed once per server
process. The browser requests compact, validated per-gene DTOs from
`/api/data/genes`; the scientifically aligned PTSD probe shards are loaded on
demand with concurrent-request deduplication and a bounded LRU cache. Treatment
probe tracks remain hidden until matching unfiltered responder-versus-
non-responder DMP exports are supplied.

Treatment result data is generated from the versioned study CSV exports:

```bash
npm run import:treatment -- /path/to/IPW_DMP_Analysis_2026_v2_CD4T_arrayWeights
```

The importer validates all expected source files, row counts, columns,
probability/count bounds, duplicate genes, N8+ selection criteria, and exact
agreement between selected rows and their AllGenes context rows before
replacing `public/data/mdma/dmrData.json`.

PTSD subtype data can be regenerated with:

```bash
npm run import:ptsd -- /path/to/result_10pct_na_meta
```

The PTSD importer preserves all four observed subtype statistics for every
selected gene and validates the source adjusted-threshold partitions.

## Scientific interpretation

Read the versioned [scientific data dictionary and display methods](docs/scientific-data-dictionary-v1.md)
before interpreting or exporting results. It defines combined versus
visit-specific views, missing-value handling, direction rules, P/FDR fields,
and the distinct probe denominators. It also lists upstream methods and
provenance metadata that are not present in the shipped dataset.

You can start editing the landing page in `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
