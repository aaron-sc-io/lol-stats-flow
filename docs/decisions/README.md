# Architecture decision records

Short records of decisions that agents must not quietly reverse. To change one, add a new
ADR that supersedes it; don't edit history. Format: Context / Decision / Consequences.

| #                                                     | Decision                                                            | Status   |
| ----------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| [0001](0001-build-time-snapshots.md)                  | Build-time snapshots from DDragon + CDragon; no runtime CDragon     | Accepted |
| [0002](0002-formula-compiler-and-fixed-primitives.md) | Compile CDragon formulas; bind to a fixed effect-primitive set      | Accepted |
| [0003](0003-canonical-store-derived-numbers.md)       | Store holds canonical input; every number is derived                | Accepted |
| [0004](0004-versioned-canvas-schema.md)               | Versioned canvas schema; saved canvases and share links never break | Accepted |
| [0005](0005-zero-maintenance-automation.md)           | Zero-maintenance automation; humans approve only versioning         | Accepted |
| [0006](0006-monochrome-design-system.md)              | Monochrome token-only design system                                 | Accepted |
| [0007](0007-scope-and-modeled-roster.md)              | Scope limits and the modeled roster                                 | Accepted |
