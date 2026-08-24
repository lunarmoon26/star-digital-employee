---
description: "Phase 1: Refine a vague problem statement into a focused research question with keywords and search queries"
allowed-tools:
  - Read
  - Write
  - Glob
  - WebSearch
  - Bash
  - AskUserQuestion
arguments:
  - name: topic
    description: "The research topic or problem statement to define"
    required: true
  - name: session
    description: "Override the auto-generated session slug"
    required: false
---

# Phase 1: Problem Definition

You are executing Phase 1 of the research funnel methodology. Your goal is to transform a vague problem statement into a focused, actionable research question with comprehensive search parameters.

## Input

**Topic/Problem Statement**: {{topic}}
{{#if session}}
**Session Override**: {{session}}
{{/if}}

## Instructions

### Step 1: Generate Session Slug

Create a URL-safe slug from the topic (e.g., "transformer-attention-efficiency" from "How to improve transformer attention efficiency?"). Use the override if provided via `--session`.

### Step 2: Create Session Directory

Create the directory `./research/<session-slug>/` if it doesn't exist.

### Step 3: Analyze and Refine

Transform the input into:

1. **Refined Research Question**: A specific, answerable question
2. **Scope Definition**: What's in scope vs out of scope
3. **Success Criteria**: What would a good answer look like?

### Step 4: Generate Keywords

Create four categories of keywords:

1. **Primary Keywords**: Core concepts (3-5 terms)
2. **Secondary Keywords**: Related concepts, synonyms (5-10 terms)
3. **Academic Keywords**: Technical/academic terminology (3-5 terms)
4. **Exclusion Keywords**: Terms to filter out irrelevant results (3-5 terms)

### Step 5: Construct Search Queries

Generate optimized search queries for:

1. **Google Scholar**: Academic papers and citations
2. **arXiv**: Preprints and cutting-edge research
3. **Semantic Scholar**: AI-optimized academic search
4. **GitHub**: Code implementations and repositories
5. **General Web**: Blog posts, tutorials, discussions

### Step 6: Define Constraints

Document any constraints:
- Publication date range (default: last 5 years)
- Required characteristics (peer-reviewed, open-access, etc.)
- Domain restrictions
- Language requirements

### Step 7: Write Output

Create `./research/<session-slug>/phase-1-define.md`:

```markdown
# Research Definition: <Topic>

**Session**: <session-slug>
**Created**: <ISO timestamp>
**Phase**: 1 - Problem Definition

## Refined Research Question

<One clear, specific question>

## Scope

### In Scope
- <Item 1>
- <Item 2>

### Out of Scope
- <Item 1>
- <Item 2>

## Success Criteria

<What does a successful research outcome look like?>

## Keywords

### Primary Keywords
- <keyword 1>
- <keyword 2>

### Secondary Keywords
- <keyword 1>
- <keyword 2>

### Academic Keywords
- <keyword 1>
- <keyword 2>

### Exclusion Keywords
- <keyword 1>
- <keyword 2>

## Search Queries

### Google Scholar
```
<query 1>
<query 2>
```

### arXiv
```
<query 1>
<query 2>
```

### Semantic Scholar
```
<query 1>
<query 2>
```

### GitHub
```
<query 1>
<query 2>
```

### General Web
```
<query 1>
<query 2>
```

## Constraints

- **Date Range**: <range>
- **Requirements**: <list>
- **Domain**: <domain restrictions>

## Next Phase

Run `/researcher:discover` to begin the discovery phase using these search parameters.
```

## Execution

1. First, ask clarifying questions if the topic is too vague using AskUserQuestion
2. Generate the session slug and create the directory
3. Perform the analysis
4. Write the output file
5. Summarize what was created and suggest running Phase 2

Remember: The quality of this phase determines the success of all subsequent phases. Be thorough but focused.
