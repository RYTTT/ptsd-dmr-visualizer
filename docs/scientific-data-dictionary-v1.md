# Scientific data dictionary and display methods — version 1.0

**Document version:** 1.0  
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
- **Subtype-unique** records contain an FDR and Δβ for exactly one of SSS, ADS,
  ICF, or ISS. “Unique” describes the supplied result partition; it does not
  demonstrate a null effect in the other subtypes.
- The precise phenotype definitions, comparison group coding, sample sizes,
  covariates, subtype derivation, and cross-subtype combination method are
  **not supplied** in the application data.

### Treatment atlas

- **Pooled cross-cohort** records are the top-level `crossCohort` results. Their
  P value, FDR, Δβ, direction, and probe counts are pooled fields and are **not
  timepoint-specific**. The application therefore hides the timepoint control
  in this view.
- **Timepoint/cohort-unique** records are supplied separately for Baseline
  (`Pre`) and Follow-up (`FUP`) under MDMA, ketamine, and CPT. “Unique” describes
  the supplied partition and is not evidence of no association in another
  cohort or timepoint.
- Nested cohort/timepoint estimates can be inspected for a gene selected from
  the pooled set, but they are not substituted for the pooled statistic.
- Existing source labels describe MDMA comparisons as responder versus healthy
  comparison and ketamine/CPT comparisons as responder versus non-responder.
  Exact outcome definitions, visit windows, sample sizes, cohort inclusion
  rules, covariates, and IPW construction are **not supplied**.
- These between-group contrasts do not by themselves establish treatment-caused
  change, longitudinal restoration, or “remethylation.”

## Field definitions

| Field | Scope | Application interpretation |
|---|---|---|
| `gene` | all records | Gene symbol or source feature identifier. |
| `chr` | PTSD/track | Chromosome label as supplied; the validator does not add or remove a `chr` prefix. |
| `deltaBeta` | result/measurement | Difference in methylation proportion (case/comparison ordering follows the upstream analysis). It is not a fold change and has no physical unit. |
| `direction` | result/measurement | `Hypermethylated`, `Hypomethylated`, or `Mixed`; `null` means unavailable after normalization. |
| `fdr`, `crossFdr` | result | Multiple-testing adjusted probability in [0, 1]. The adjustment method and tested family are **not supplied**. |
| `pValue`, `crossP` | result | Unadjusted/combined P value in [0, 1]. The cross-result combination method is **not supplied**. |
| `totalProbes` | DMR result | Number of probes tested or represented for that DMR record. This is labeled “DMR tested probes,” not “all EPIC probes.” |
| `nSigProbes` | treatment result | Number of probes called significant by the upstream treatment pipeline; threshold is **not supplied**. |
| `nSubtypesSig` | PTSD cross result | Number of subtypes called significant by the upstream pipeline; threshold is **not supplied**. |
| `avgPosLogFC`, `avgNegLogFC` | PTSD result | Supplied positive/negative probe-group means used to show opposing directions. Despite the source name `logFC`, the UI presents these as Δβ summaries; the upstream naming/mapping should be confirmed. |
| `nPosTop3`, `nNegTop3` | PTSD result | Counts of positive and negative probes among the up-to-three summarized probes. |
| `*_P`, `*_FDR`, `*_logFC` | probe shard | Probe-level P value, adjusted P value, and source effect field for an analysis key. Missing triplets remain unavailable. |

## Missingness and statistical significance

The treatment source uses the exact triplet `direction: "N/A"`, `deltaBeta: 0`,
`fdr: 1` as an unavailable-value sentinel. At runtime this triplet is normalized
to `deltaBeta: null`, `fdr: null`, `direction: null`. It is displayed as
“Unavailable” or an em dash and is exported as an empty CSV cell.

An observed Δβ of zero or FDR of one is retained when its direction is an
observed classification. JavaScript nullish fallback (`??`) is used where a
fallback is appropriate; falsy fallback (`||`) is not used for measurements.
Missing is never labeled “not significant.” “Not significant” is reserved for
an observed FDR at or above the displayed threshold.

## Direction rule

Subtype-level PTSD `direction` values are authoritative probe-summary
classifications. Cross-subtype display direction uses one rule:

1. If any stored subtype direction is `Mixed`, the cross display is `Mixed`.
2. Otherwise, if all four subtype directions are identical, that common
   Hyper/Hypo direction is displayed.
3. Otherwise, the cross display is `Mixed`.

This rule intentionally does not infer concordance only from the signs of four
subtype means. Treatment direction is displayed as stored for the selected
pooled or timepoint/cohort-unique result.

## Top-three summaries and uncertainty

The PTSD result records include fields describing a top-three-probe summary.
The application displays the supplied Δβ and, for `Mixed` records, the supplied
positive and negative means/counts. The probe ranking criterion, tie handling,
whether fewer than three probes are permitted, and relationship to DMR-level
testing are **not supplied**. No confidence intervals, standard errors, or
sample-level distributions are present, so the figures do not imply uncertainty
intervals.

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
are blank and numeric zero remains `0`. Filenames state pooled versus
timepoint/cohort-unique scope.

## Provenance required from upstream

| Provenance item | Status in shipped data |
|---|---|
| Dataset release/version | **Not supplied** |
| Data-generation timestamp | **Not supplied** |
| Source repository/commit | **Not supplied** |
| Genome build and annotation release | **Not supplied** |
| Array manifest version(s) | EPIC/450K are mentioned in UI copy; exact manifest releases are **not supplied** |
| Sample sizes and exclusions | **Not supplied** |
| DMR caller, parameters, and probe ranking | **Not supplied** |
| Multiple-testing method and family | **Not supplied** |
| Cross-subtype/cross-cohort combination method | **Not supplied** |
| IPW model, estimand, diagnostics, and truncation | **Not supplied** |

These gaps should remain visible in customer/scientific-review materials until
the upstream metadata is added; they must not be filled with inferred claims.
