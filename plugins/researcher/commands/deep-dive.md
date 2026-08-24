---
description: "Phase 4: Three-pass deep analysis of selected papers with equation explanations and pseudo-code extraction"
allowed-tools:
  - Read
  - Write
  - Glob
  - WebFetch
  - WebSearch
  - AskUserQuestion
arguments:
  - name: session
    description: "The research session slug (auto-detected from most recent if not provided)"
    required: false
  - name: paper
    description: "Specific paper ID to analyze (analyzes all selected if not provided)"
    required: false
---

# Phase 4: Deep Dive

You are executing Phase 4 of the research funnel methodology. Your goal is to perform thorough three-pass analysis of each selected paper, extracting key insights, explaining equations, and generating pseudo-code.

## Input

{{#if session}}
**Session**: {{session}}
{{else}}
**Session**: Auto-detect from most recent session in `./research/`
{{/if}}

{{#if paper}}
**Specific Paper**: {{paper}}
{{else}}
**Papers**: All selected papers from Phase 3
{{/if}}

## Instructions

### Step 1: Load Previous Phases

1. Load `phase-1-define.md` for research question context
2. Load `phase-3-filter.md` for selected papers list
3. Verify both exist before proceeding

### Step 2: Three-Pass Reading Method

For each selected paper, apply the three-pass method:

#### Pass 1: Bird's Eye View (5-10 minutes)
- Read title, abstract, introduction, section headings, conclusion
- Identify the paper's category (empirical, theoretical, survey, etc.)
- Note the main contribution claims
- Assess: Should this paper remain in our selection?

#### Pass 2: Detailed Understanding (30-60 minutes)
- Read the entire paper, skipping proofs/equations on first read
- Mark key figures and tables
- Note unfamiliar terms and references
- Understand the overall argument structure
- Identify strengths and weaknesses

#### Pass 3: Deep Analysis (1-2 hours)
- Understand every equation, proof, and algorithm
- Mentally reconstruct the approach
- Identify implicit assumptions
- Note what's missing or could be improved
- Extract implementation details

### Step 3: Extract and Explain Equations

For each significant equation in the paper:

1. **State the equation** in LaTeX or Unicode math
2. **Explain in plain English** what it computes
3. **Define all variables** with their meanings and dimensions
4. **Provide intuition** for why this formulation makes sense
5. **Note any assumptions** or constraints

Example format:
```
### Equation 3: Attention Score Computation

**Equation**: score(Q, K) = (Q · K^T) / √d_k

**Plain English**: The attention score measures how relevant each key is to the query by computing their dot product, then scaling by the square root of the key dimension to prevent the values from becoming too large.

**Variables**:
- Q: Query matrix [batch, seq_len, d_k]
- K: Key matrix [batch, seq_len, d_k]
- d_k: Dimension of keys (scalar)

**Intuition**: Dot product measures similarity; scaling prevents softmax saturation.

**Assumptions**: Assumes Q and K are already projected from input embeddings.
```

### Step 4: Generate Pseudo-Code

For each algorithm or method:

1. **Write clear pseudo-code** that captures the essence
2. **Annotate with comments** explaining key steps
3. **Note implementation choices** and alternatives
4. **Identify complexity** (time and space)

### Step 5: Assess Reproducibility

For each paper, evaluate:

- **Code availability**: Official implementation? Third-party?
- **Data availability**: Datasets accessible?
- **Hyperparameters**: Fully specified?
- **Compute requirements**: What hardware needed?
- **Missing details**: What would you need to ask authors?

### Step 6: Write Output

Create `./research/<session>/phase-4-deep-dive.md`:

```markdown
# Deep Dive Analysis: <Session>

**Session**: <session-slug>
**Created**: <ISO timestamp>
**Phase**: 4 - Deep Dive
**Based on**: phase-3-filter.md

---

## Paper 1: <Title>

**ID**: <P#>
**Reading Priority**: <Primary/Secondary>
**Analysis Date**: <timestamp>

### Pass 1: Overview

**Category**: <Empirical/Theoretical/Survey/System>
**Main Contribution**: <1-2 sentences>
**Key Claims**:
1. <Claim 1>
2. <Claim 2>

**Recommendation**: <Continue/Demote/Replace>

### Pass 2: Structure

**Argument Flow**:
1. <Section 1>: <Purpose>
2. <Section 2>: <Purpose>
...

**Key Figures**:
- Figure <n>: <What it shows and why important>

**Key Tables**:
- Table <n>: <What it shows and why important>

**Strengths**:
- <Strength 1>
- <Strength 2>

**Weaknesses**:
- <Weakness 1>
- <Weakness 2>

### Pass 3: Deep Analysis

#### Key Equations

##### Equation 1: <Name>

**Equation**: <LaTeX or Unicode>

**Plain English**: <Explanation>

**Variables**:
- <var>: <meaning> [<dimensions>]

**Intuition**: <Why this works>

**Assumptions**: <Constraints>

[Repeat for significant equations...]

#### Algorithms

##### Algorithm 1: <Name>

**Purpose**: <What it achieves>

```
Algorithm: <Name>
Input: <inputs with types>
Output: <outputs with types>

1. <Step 1>  // <Comment>
2. <Step 2>  // <Comment>
3. for each <item> in <collection>:
4.     <Step>  // <Comment>
5. return <output>
```

**Complexity**: Time O(<>), Space O(<>)

**Implementation Notes**: <Key choices>

[Repeat for algorithms...]

### Reproducibility Assessment

| Aspect | Status | Notes |
|--------|--------|-------|
| Official Code | ✅/❌/⚠️ | <link or note> |
| Third-party Code | ✅/❌/⚠️ | <link or note> |
| Datasets | ✅/❌/⚠️ | <availability> |
| Hyperparameters | ✅/❌/⚠️ | <completeness> |
| Compute Specified | ✅/❌/⚠️ | <requirements> |

**Missing for Reproduction**:
- <Item 1>
- <Item 2>

### Key Takeaways

1. <Takeaway 1>
2. <Takeaway 2>
3. <Takeaway 3>

### Questions/Follow-ups

- <Question for authors or further research>

---

[Repeat for each paper...]

---

## Cross-Paper Observations

<Initial observations about how papers relate to each other>

## Next Phase

Run `/researcher:synthesize` to create comparison matrix and technical proposal.
```

## Execution

1. Load Phase 1 and Phase 3 outputs
2. For each selected paper:
   - Attempt to fetch full content via WebFetch if accessible
   - If not accessible, work with abstract and any available excerpts
   - Apply three-pass method
   - Extract and explain equations
   - Generate pseudo-code
   - Assess reproducibility
3. Note cross-paper observations
4. Write the output file
5. Summarize findings and suggest running Phase 5

## Tips for Effective Deep Dive

- Don't skip Pass 1 even for papers you think you know
- In Pass 2, draw diagrams if they help you understand
- In Pass 3, try to find flaws - this deepens understanding
- For equations, explain to yourself as if teaching someone else
- Pseudo-code should be implementable, not just a summary
- Note what surprised you - these often become key insights
