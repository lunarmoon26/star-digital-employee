# Changelog

All notable changes to Star Digital Employee are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Product contract, target architecture, implementation roadmap, and initial
  architecture decision records for the digital employee platform.
- Versioned `Employee` recipe contract and validation CLI foundation.
- Pinned open capability supply-chain contract for Agent Skills and Cordis npm
  plugins.
- Deterministic capability compiler with local, exact-Git, and exact-npm skill
  resolution, canonical locks, content-addressed skill roots, and DSH profile
  inputs.
- Digest-pinned Harness image generation with a frozen DSH runtime graph,
  idempotent writable-state activation, and an outbound-guarded DSH Web host smoke.
- Kubernetes topology decision (ADR 0008) and the hardened `employee-harness`
  Helm chart with static contract tests for the verified container constraints.

### Changed
- Removed the obsolete capability-migration milestone and legacy Claude marketplace
  content after the product-history reset.

[Unreleased]: https://github.com/lunarmoon26/star-digital-employee/commits/main
