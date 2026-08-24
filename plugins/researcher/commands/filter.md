---
description: "Phase 3: Apply 10-second scan to filter candidates down to 3-5 high-value papers"
allowed-tools:
  - Read
  - Write
  - Glob
  - WebFetch
  - AskUserQuestion
arguments:
  - name: session
    description: "The research session slug (auto-detected from most recent if not provided)"
    required: false
  - name: count
    description: "Number of papers to select (default: 5)"
    required: false
---

# Phase 3: Filter

You are executing Phase 3 of the research funnel methodology. Your goal is to apply rapid evaluation criteria to filter 15-30 candidates down to 3-5 high-value papers for deep analysis.

## Input

{{#if session}}
**Session**: {{session}}
{{else}}
**Session**: Auto-detect from most recent session in `./research/`
{{/if}}

**Target Selection Count**: {{count | default: "5"}}

## Instructions

### Step 1: Load Previous Phases

1. Load `phase-1-define.md` for research question context
2. Load `phase-2-discover.md` for candidate list
3. Verify both exist before proceeding

### Step 2: Apply 10-Second Scan

For each candidate from Phase 2, quickly evaluate using these criteria:

#### Primary Filters (Must Pass)
- [ ] **Relevance**: Directly addresses the research question
- [ ] **Recency**: Within acceptable date range (or seminal work)
- [ ] **Accessibility**: Can actually access the full content

#### Quality Indicators
- **Citation count** (if available): High citations suggest impact
- **Venue quality**: Top conferences/journals score higher
- **Author reputation**: Known researchers in the field
- **Abstract quality**: Clear problem statement and contributions

#### Practical Factors
- **Code availability**: Implementation to study
- **Reproducibility signals**: Clear methodology, datasets mentioned
- **Length/depth**: Appropriate for the type of contribution

### Step 3: Score and Rank

Create a scoring matrix:

| Criterion | Weight | Score (1-5) |
|-----------|--------|-------------|
| Relevance to question | 3x | |
| Technical depth | 2x | |
| Novelty/contribution | 2x | |
| Clarity/accessibility | 1x | |
| Reproducibility | 1x | |
| Code/data available | 1x | |

**Total Score** = Σ(Weight × Score)

### Step 4: Select Top Papers

1. Rank all candidates by total score
2. Select top N papers (default: 5)
3. Ensure diversity:
   - Mix of approaches/methods
   - Mix of publication types if appropriate
   - Include at least one recent paper

### Step 5: Document Rejections

For each rejected paper, briefly note why:
- "Too tangential - focuses on X not Y"
- "Superseded by newer paper Z"
- "Paywalled with no alternatives"
- "Low quality/predatory venue"

### Step 6: Write Output

Create `./research/<session>/phase-3-filter.md`:

```markdown
# Filter Results: <Session>

**Session**: <session-slug>
**Created**: <ISO timestamp>
**Phase**: 3 - Filter
**Based on**: phase-2-discover.md

## Selection Summary

- **Candidates evaluated**: <n>
- **Papers selected**: <n>
- **Papers rejected**: <n>

## Selected Papers

### 1. <Title> ⭐ [Highest Score]

- **ID**: <P#>
- **Score**: <total>/50
- **Why Selected**: <1-2 sentence justification>

| Criterion | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Relevance | 3x | <n> | <n> |
| Technical depth | 2x | <n> | <n> |
| Novelty | 2x | <n> | <n> |
| Clarity | 1x | <n> | <n> |
| Reproducibility | 1x | <n> | <n> |
| Code available | 1x | <n> | <n> |

**Reading Priority**: <Primary/Secondary>
**Expected Contribution**: <What we hope to learn>

[Repeat for each selected paper...]

## Rejected Papers

### Quick Rejections (Did not pass primary filters)

| ID | Title | Rejection Reason |
|----|-------|------------------|
| <P#> | <Title> | <Reason> |

### Scored but Not Selected

| ID | Title | Score | Why Not Selected |
|----|-------|-------|------------------|
| <P#> | <Title> | <n>/50 | <Reason> |

## Selection Rationale

<Paragraph explaining the overall selection strategy and how these papers complement each other>

## Gaps in Selection

<Any areas of the research question not well covered by selected papers>

## Next Phase

Run `/researcher:deep-dive` to perform three-pass analysis on selected papers.
```

## Execution

1. Load Phase 1 and Phase 2 outputs
2. For each candidate, apply the 10-second scan
3. Score each paper that passes primary filters
4. Select top papers ensuring diversity
5. Document all rejections with reasons
6. Write the output file
7. Summarize selection and suggest running Phase 4

## Tips for Effective Filtering

- Trust your initial instincts from the 10-second scan
- Prioritize papers that can teach you something unique
- Don't just pick the highest-cited papers - include innovative newer work
- Consider how papers will work together in synthesis
- It's okay to adjust selection after starting deep-dive if needed
