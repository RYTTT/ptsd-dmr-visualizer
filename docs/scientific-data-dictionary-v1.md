# Scientific data dictionary and display methods — version 1.0

**Document version:** 1.2
**Application contract:** `scientific-data-v1`  
**Last updated:** 2026-08-09

This document defines what the application can infer from the shipped JSON. It
does not substitute for the upstream statistical analysis plan. Items marked
**not supplied** are required before these results can be independently
reproduced or used in a scientific publication.

## Analysis contexts and comparison groups

### PTSD atlas

- **Cross-subtype** records contain one combined P value (`crossP`), one combined
  FDR (`crossFdr`), and observed statistics for SSS, ADS, ICF, and ISS.
- **Subtype-selected** records met the source FDR < 0.05 rule in exactly one of
  SSS, ADS, ICF, or ISS. Every record retains observed P, FDR, Δβ, direction,
  and significant-probe counts for all four subtypes. Nominal P < 0.05 in a
  comparison subtype does not mean that subtype met the adjusted selection rule.
- The precise phenotype definitions, comparison group coding, sample sizes,
  covariates, subtype derivation, and cross-subtype combination method are
  **not supplied** in the application data.

### Treatment atlas

- **All treatments combined** records are the top-level `crossCohort` results.
  Their P value, FDR, Δβ, direction, and probe counts are combined fields and are
  **not Baseline or Follow-up results**. The application shows this result in a
  separate card and hides the visit control in this view.
- The combined source also provides a component P value, count-weighted Top-3
  Δβ, direction, and positive/negative probe summaries for each treatment
  study. The application reports only the factual count of 1/3, 2/3, or 3/3
  component P values below 0.05 and separately states whether the three
  component mean Δβ signs agree. Combined significance is never labeled a
  common or replicated effect.
- **Genes meeting this screen** are supplied separately for Baseline (`Pre`) and
  Follow-up (`FUP`) under MDMA, ketamine, and CPT. A row is included when
  `N_Sig_Probes_p05 >= 8` and `Gene_FDR < 0.05`.
- **Visit context** comes from the six `AllGenes` files. For any selected gene,
  the chart looks up its source-backed Baseline and Follow-up rows. A bar can be
  visible even when that row has fewer than eight probes with nominal P < 0.05.
  Missing context is not converted to zero.
- The source filenames label all six cohort/timepoint analyses as responder
  versus non-responder comparisons.
  Exact outcome definitions, visit windows, sample sizes, cohort inclusion
  rules, covariates, and IPW construction are **not supplied**.
- These between-group contrasts do not by themselves establish treatment-caused
  change, longitudinal restoration, or “remethylation.”

## Field definitions

| Field | Scope | Application interpretation |
|---|---|---|
| `gene` | all records | Gene symbol or source feature identifier. |
| `chr` | PTSD/track | Chromosome label as supplied; the validator does not add or remove a `chr` prefix. |
| `deltaBeta` | result/measurement | Difference in methylation proportion (responder minus non-responder for the treatment study files). For treatment study/visit rows, the app derives a count-weighted mean from the positive and negative Top-3 means. It is not a fold change and has no physical unit. The cross-subtype PTSD volcano uses an explicitly labeled display-only arithmetic mean of the four subtype Δβ summaries because no source combined Δβ was supplied. |
| `direction` | result/measurement | `Hypermethylated`, `Hypomethylated`, or `Mixed`; `null` means unavailable after normalization. |
| `fdr`, `crossFdr` | result | Multiple-testing adjusted probability in [0, 1]. The adjustment method and tested family are **not supplied**. |
| `pValue`, `crossP` | result | Unadjusted/combined P value in [0, 1]. The cross-result combination method is **not supplied**. |
| `cohortPValues` | treatment combined result | The MDMA, ketamine, and CPT component P values supplied by `Meta_Analysis_Gene_Level_DMRs_Top3_FULL.csv`. These are distinct from the six visit-specific analyses. |
| `cohortComponents` | treatment combined result | Source component P, count-weighted Top-3 Δβ, direction, and positive/negative counts and means for MDMA, ketamine, and CPT. |
| `nCohortsNominal` | treatment combined result | Number of the three component P values below 0.05; this is not a replication claim. |
| `componentSignsConsistent` | treatment combined result | Whether all three component mean Δβ values have the same nonzero sign. Mixed probe patterns remain visible separately. |
| `totalProbes` | DMR result | Number of probes tested or represented for that DMR record. This is labeled “DMR tested probes,” not “all EPIC probes.” |
| `nSigProbes` | treatment result | Number of mapped gene probes with nominal P < 0.05 (`N_Sig_Probes_p05`). The N8+ registry requires at least eight. |
| `nPosTop3`, `nNegTop3` | treatment result | Positive- and negative-effect probe counts among the Top-3 Fisher summary probes. Counts sum to 1–3. |
| `avgPosDeltaBeta`, `avgNegDeltaBeta` | treatment result | Separate mean positive and negative Δβ values among the corresponding Top-3 probes; null when that direction count is zero. |
| `nSubtypesSig` | PTSD cross result | Number of the four subtype results with reported FDR < 0.05. The importer verifies this equality for every cross-subtype record. |
| `avgPosLogFC`, `avgNegLogFC` | PTSD result | Supplied positive/negative probe-group means used to show opposing directions. Despite the source name `logFC`, the UI presents these as Δβ summaries; the upstream naming/mapping should be confirmed. |
| `nPosTop3`, `nNegTop3` | PTSD result | Counts of positive and negative probes among the up-to-three summarized probes. |
| `*_P`, `*_FDR`, `*_logFC` | probe shard | Probe-level P value, adjusted P value, and source effect field for an analysis key. Missing triplets remain unavailable. |

## Missingness and statistical significance

The treatment `AllGenes` tables contain observed rows rather than the old
`direction: "N/A"`, `deltaBeta: 0`, `fdr: 1` sentinel. A missing lookup remains
`null` and is displayed as “Not provided in the source gene-level results.” An
observed Δβ of zero or FDR of one is retained. Missing is never labeled “not
significant.” In the current generated database, all 2,441 selected genes have
all six source-backed visit results and there are no null visit cells.

All figure stars use uncorrected nominal P only: `*` for P < 0.05, `**` for
P < 0.01, and `***` for P < 0.001. FDR is retained as a reported numeric field
in tables/tooltips/exports but is not used as a figure significance threshold.

The PTSD probe-level genomic track uses the uncorrected `*_P` field on a
`−log10(P)` scale, with reference lines at nominal P = 0.05, 0.01, and 0.001.
These thresholds are descriptive and do **not** control a multiple-testing
error rate. The plot therefore pairs nominal P with probe-level Δβ and advises
independent validation; it does not use `*_FDR` to position or emphasize probe
points. The display scale is fixed at `−log10(P) = 0–8`; smaller P values are
drawn at the upper boundary while their exact values remain in the tooltip and
accessible table. This cap keeps the three reference thresholds legible and
the vertical scale comparable across genes.

Treatment probe tracks are intentionally not shown. The previously supplied
MDMA probe files compare responders with CPT healthy controls, whereas the
gene-level treatment results compare responders with non-responders. Supplied
CPT and ketamine probe exports are also filtered near P < 0.01. Re-enabling a
complete treatment probe figure requires unfiltered all-probe
responder-versus-non-responder DMP exports for all six study/visit analyses.

## Direction rule

Subtype-level PTSD `direction` values are authoritative probe-summary
classifications. Cross-subtype display direction uses one rule:

1. If any stored subtype direction is `Mixed`, the cross display is `Mixed`.
2. Otherwise, if all four subtype directions are identical, that common
   Hyper/Hypo direction is displayed.
3. Otherwise, the cross display is `Mixed`.

This rule intentionally does not infer concordance only from the signs of four
subtype means. Treatment direction is displayed as stored for the selected
combined or study/visit result.

## Top-three summaries and uncertainty

The PTSD result records include fields describing a top-three-probe summary.
The application displays the supplied Δβ and, for `Mixed` records, the supplied
positive and negative means/counts. The probe ranking criterion, tie handling,
whether fewer than three probes are permitted, and relationship to DMR-level
testing are **not supplied**. No confidence intervals, standard errors, or
sample-level distributions are present, so the figures do not imply uncertainty
intervals.

The treatment study CSVs supply positive and negative Top-3 probe counts and
their separate mean Δβ values. The application computes the weighted summary
`(N_Pos × Ave_Pos + N_Neg × Ave_Neg) / (N_Pos + N_Neg)` for tables and exports.
The visit figure draws positive and negative means separately, so a `Mixed`
pattern is not visually collapsed into a single net bar. The supplied
`Gene_Fisher_P` is shown as the nominal gene-level P value.

## Probe denominators

Three denominators must not be interchanged:

- **DMR tested probes:** result-level `totalProbes`.
- **Manifest probes:** gene-manifest `totalProbes`, the number of array probes
  annotated to the gene.
- **Probes with statistics:** manifest `probesWithStats` or the validated probe
  shard row count, depending on the component.

`nSigProbes` is a numerator, not a denominator. A gene can therefore show a DMR
tested-probe count different from its gene-manifest probe count.

## Runtime validation and exports

The application rejects malformed master data before transformation: required
collections and subtype/cohort keys, non-empty identifiers, finite effects,
P/FDR ranges, non-negative integer counts, count bounds, directions, and
duplicate genes are checked. Probe shards additionally check requested-gene
identity, chromosome presence, exact row count, unique probe IDs, positive
positions, CpG-island `start <= end`, complete analysis triplets, and P/FDR
ranges. Island arrays are not required to be position-sorted because legitimate
shipped shards are unsorted.

CSV uses RFC-style quoting for commas, quotes, and line breaks; missing values
are blank and numeric zero remains `0`. Filenames state combined versus
study/visit screen scope.

## Provenance required from upstream

| Provenance item | Status in shipped data |
|---|---|
| Dataset release/version | `IPW_DMP_Analysis_2026_v2_CD4T_arrayWeights` |
| Data-generation timestamp | Stored in generated database metadata (`generatedAt`) |
| Source repository/commit | **Not supplied** |
| Genome build and annotation release | **Not supplied** |
| Array manifest version(s) | **Not supplied**; the UI therefore uses generic array-manifest wording |
| Sample sizes and exclusions | **Not supplied** |
| DMR caller, parameters, and probe ranking | **Not supplied** |
| Multiple-testing method and family | Gene-level FDR is supplied; adjustment method/family are **not supplied** |
| Cross-subtype/cross-cohort combination method | **Not supplied** |
| IPW model, estimand, diagnostics, and truncation | **Not supplied** |

These gaps should remain visible in customer/scientific-review materials until
the upstream metadata is added; they must not be filled with inferred claims.
