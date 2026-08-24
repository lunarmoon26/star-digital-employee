---
description: "Phase 5: Create comparison matrix and technical proposal synthesizing all research phases"
allowed-tools:
  - Read
  - Write
  - Glob
  - AskUserQuestion
arguments:
  - name: session
    description: "The research session slug (auto-detected from most recent if not provided)"
    required: false
  - name: focus
    description: "Specific aspect to focus synthesis on (optional)"
    required: false
---

# Phase 5: Synthesis

You are executing Phase 5 of the research funnel methodology. Your goal is to synthesize all previous phases into a comprehensive comparison matrix and actionable technical proposal.

## Input

{{#if session}}
**Session**: {{session}}
{{else}}
**Session**: Auto-detect from most recent session in `./research/`
{{/if}}

{{#if focus}}
**Synthesis Focus**: {{focus}}
{{/if}}

## Instructions

### Step 1: Load All Previous Phases

Load and verify all previous phase outputs exist:
1. `phase-1-define.md` - Research question and scope
2. `phase-2-discover.md` - Discovery results
3. `phase-3-filter.md` - Selection rationale
4. `phase-4-deep-dive.md` - Detailed analysis

### Step 2: Build Comparison Matrix

Create a comprehensive comparison matrix with these dimensions:

#### Core Metrics
| Paper | Accuracy | Speed | Complexity | Memory | Scalability |
|-------|----------|-------|------------|--------|-------------|

#### Implementation Factors
| Paper | Code Available | Language | Dependencies | Ease of Use |
|-------|----------------|----------|--------------|-------------|

#### Resource Requirements
| Paper | Training Data | Hardware | Training Time | Inference Time |
|-------|---------------|----------|---------------|----------------|

#### Research Characteristics
| Paper | Novelty | Maturity | Community | Extensibility |
|-------|---------|----------|-----------|---------------|

### Step 3: Identify Patterns

Analyze the comparison matrix to identify:

1. **Common themes**: What do successful approaches share?
2. **Trade-offs**: What are the fundamental tensions?
3. **Gaps**: What's missing from current approaches?
4. **Trends**: Where is the field heading?
5. **Opportunities**: What could be combined or improved?

### Step 4: Write Technical Proposal

Create a technical proposal with:

#### Executive Summary
- Problem statement (from Phase 1)
- Key findings (from Phases 2-4)
- Recommended approach

#### Background
- Literature landscape
- Current state of the art
- Key challenges

#### Proposed Approach
- **Option A**: <Conservative approach>
- **Option B**: <Moderate approach>
- **Option C**: <Aggressive/innovative approach>

For each option:
- Description
- Pros and cons
- Resource requirements
- Risk assessment

#### Recommendation
- Recommended option with justification
- Implementation roadmap
- Success metrics
- Risk mitigation strategies

### Step 5: Write Output

Create `./research/<session>/phase-5-synthesize.md`:

```markdown
# Research Synthesis: <Session>

**Session**: <session-slug>
**Created**: <ISO timestamp>
**Phase**: 5 - Synthesis
**Research Question**: <From Phase 1>

---

## Executive Summary

<2-3 paragraph summary covering:>
- The problem we investigated
- What we found across <n> papers
- Our recommendation

---

## Comparison Matrix

### Performance Metrics

| Paper | Approach | Accuracy | Speed | Complexity | Scalability |
|-------|----------|----------|-------|------------|-------------|
| <Paper 1> | <Type> | <Metric> | <Metric> | <O(n)> | <Rating> |
| <Paper 2> | <Type> | <Metric> | <Metric> | <O(n)> | <Rating> |
...

### Implementation Factors

| Paper | Code | Language | Dependencies | Ease |
|-------|------|----------|--------------|------|
| <Paper 1> | ✅/❌ | <Lang> | <Count> | <1-5> |
...

### Resource Requirements

| Paper | Min Data | GPU Required | Train Time | Inference |
|-------|----------|--------------|------------|-----------|
| <Paper 1> | <Size> | <Yes/No> | <Time> | <Time> |
...

### Research Maturity

| Paper | Year | Citations | Implementations | Production Use |
|-------|------|-----------|-----------------|----------------|
| <Paper 1> | <Year> | <Count> | <Count> | <Known uses> |
...

---

## Pattern Analysis

### Common Themes

1. **<Theme 1>**: <Description>
   - Evidence: <Papers that support this>

2. **<Theme 2>**: <Description>
   - Evidence: <Papers that support this>

### Trade-offs Identified

| Trade-off | Option A | Option B | Papers |
|-----------|----------|----------|--------|
| <Trade-off 1> | <Choice> | <Choice> | <Papers> |
| <Trade-off 2> | <Choice> | <Choice> | <Papers> |

### Gaps in Current Research

1. **<Gap 1>**: <Description and why it matters>
2. **<Gap 2>**: <Description and why it matters>

### Emerging Trends

1. **<Trend 1>**: <Direction and evidence>
2. **<Trend 2>**: <Direction and evidence>

---

## Technical Proposal

### Problem Statement

<Refined problem statement based on all research>

### Proposed Approaches

#### Option A: Conservative Approach

**Description**: <Based on most established methods>

**Key Components**:
- <Component 1 from Paper X>
- <Component 2 from Paper Y>

**Pros**:
- <Pro 1>
- <Pro 2>

**Cons**:
- <Con 1>
- <Con 2>

**Resources Required**:
- Data: <Requirements>
- Compute: <Requirements>

**Risk Level**: Low

---

#### Option B: Moderate Approach

**Description**: <Balanced combination of proven and newer methods>

[Same structure as Option A...]

**Risk Level**: Medium

---

#### Option C: Innovative Approach

**Description**: <Pushing boundaries based on latest research>

[Same structure as Option A...]

**Risk Level**: High

---

### Recommendation

**Recommended Option**: <A/B/C>

**Justification**:
<Why this option best fits the research question and constraints>

**Implementation Roadmap**:

| Phase | Deliverable | Dependencies |
|-------|-------------|--------------|
| 1 | <Deliverable> | <Deps> |
| 2 | <Deliverable> | <Deps> |
| 3 | <Deliverable> | <Deps> |

**Success Metrics**:
1. <Metric 1>: <Target>
2. <Metric 2>: <Target>

**Risk Mitigation**:

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| <Risk 1> | <H/M/L> | <H/M/L> | <Strategy> |
| <Risk 2> | <H/M/L> | <H/M/L> | <Strategy> |

---

## References

1. <Paper 1 full citation>
2. <Paper 2 full citation>
...

---

## Appendices

### A. Full Paper Summaries

[Brief summaries of each analyzed paper]

### B. Glossary

| Term | Definition |
|------|------------|
| <Term> | <Definition> |

### C. Methodology Notes

<Notes about the research process, limitations, and suggestions for future research>

---

## Session Complete

This research session is complete. All outputs are available in:
- `./research/<session>/`

To continue or expand this research:
- Add more papers: `/researcher:discover --session <session>`
- Re-analyze with new focus: `/researcher:synthesize --session <session> --focus <aspect>`
- Start fresh: `/researcher:define <new topic>`
```

## Execution

1. Load all previous phase outputs
2. Build comprehensive comparison matrix
3. Analyze patterns, trade-offs, gaps, and trends
4. Develop multiple approach options
5. Formulate recommendation with roadmap
6. Write the output file
7. Summarize the complete research session

## Tips for Effective Synthesis

- Let the data drive conclusions, not preconceptions
- Be honest about uncertainties and limitations
- Make trade-offs explicit - there's rarely a "best" approach for everything
- The proposal should be actionable, not just descriptive
- Include enough detail for someone else to execute the roadmap
- Consider multiple audiences (technical and non-technical)
