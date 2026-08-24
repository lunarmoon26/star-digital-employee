---
description: "Phase 2: Execute broad search sweep to find 15-30 candidate papers and resources"
allowed-tools:
  - Read
  - Write
  - Glob
  - WebSearch
  - WebFetch
  - Bash
  - AskUserQuestion
arguments:
  - name: session
    description: "The research session slug (auto-detected from most recent if not provided)"
    required: false
---

# Phase 2: Discovery

You are executing Phase 2 of the research funnel methodology. Your goal is to execute a broad search sweep and identify 15-30 candidate papers/resources for further evaluation.

## Input

{{#if session}}
**Session**: {{session}}
{{else}}
**Session**: Auto-detect from most recent session in `./research/`
{{/if}}

## Instructions

### Step 1: Load Phase 1 Output

1. If `--session` is provided, load `./research/<session>/phase-1-define.md`
2. Otherwise, find the most recent session by checking modification times in `./research/*/`
3. Verify Phase 1 output exists before proceeding
4. If not found, instruct user to run `/researcher:define` first

### Step 2: Execute Web Searches

Using the search queries from Phase 1, execute searches with WebSearch tool:

1. **Prioritize searches that WebSearch can handle**:
   - General academic queries
   - Topic-specific searches
   - Recent developments

2. **For each search**, record:
   - Query used
   - Number of results found
   - Top candidates identified

3. **Note manual searches needed**:
   - arXiv (may need manual browsing)
   - Google Scholar (may need direct access)
   - Semantic Scholar API

### Step 3: Collect Candidates

For each potential paper/resource found:

1. **Assign a short ID** for tracking across phases (e.g., P1, P2, P3...)
2. **Record basic metadata**:
   - Title
   - Authors
   - Year
   - Source/venue
   - URL/DOI
   - Abstract (if available)

3. **Categorize by source type**:
   - Academic paper (peer-reviewed)
   - Preprint
   - Technical report
   - Blog post/tutorial
   - Code repository
   - Documentation

### Step 4: Initial Relevance Assessment

For each candidate, provide:
- **Relevance score** (1-5): How well does it match the research question?
- **Availability**: Open access, paywalled, code available?
- **Quick notes**: Why this might be valuable

### Step 5: Write Output

Create `./research/<session>/phase-2-discover.md`:

```markdown
# Discovery Results: <Session>

**Session**: <session-slug>
**Created**: <ISO timestamp>
**Phase**: 2 - Discovery
**Based on**: phase-1-define.md

## Search Execution Summary

### Automated Searches Completed
| Platform | Query | Results Found | Candidates Selected |
|----------|-------|---------------|---------------------|
| <platform> | <query> | <n> | <n> |

### Manual Searches Recommended
- [ ] arXiv: <specific search to run>
- [ ] Google Scholar: <specific search to run>
- [ ] <other platform>: <search>

## Candidate Papers

### Academic Papers (Peer-Reviewed)

#### P1. <Title>
- **Authors**: <Author list>
- **Year**: <Year>
- **Venue**: <Journal/Conference>
- **URL**: <URL or DOI>
- **Relevance**: <1-5>/5
- **Availability**: <Open/Paywalled/Code>
- **Abstract**: <Abstract or summary>
- **Notes**: <Why this is relevant>

[Repeat for each paper...]

### Preprints

[Same format...]

### Technical Resources

[Blog posts, tutorials, code repos...]

## Summary Statistics

- **Total candidates found**: <n>
- **Academic papers**: <n>
- **Preprints**: <n>
- **Technical resources**: <n>
- **Average relevance score**: <n>

## Gaps Identified

<Any areas where searches didn't return good results>

## Next Phase

Run `/researcher:filter` to apply the 10-second scan and select 3-5 papers for deep analysis.
```

## Execution

1. Load Phase 1 output
2. Execute automated searches using WebSearch
3. For searches that fail or need manual execution, document them clearly
4. Collect and organize candidates
5. Write the output file
6. Summarize findings and recommend manual follow-up searches
7. Suggest running Phase 3

## Tips for Effective Discovery

- Cast a wide net initially - it's better to have more candidates than fewer
- Include both seminal/classic papers and recent work
- Don't ignore negative results or critiques
- Look for survey papers that can point to other relevant work
- Check "Related Work" sections of highly relevant papers via WebFetch
