# Research Methodology Skill

This skill provides knowledge about the 5-phase research funnel methodology for systematic literature review and technical research.

## When to Use This Skill

Use this skill when:
- Conducting systematic literature reviews
- Researching technical topics or academic papers
- Needing to understand and compare multiple approaches to a problem
- Creating research proposals or technical recommendations
- The user mentions "research," "literature review," "paper analysis," or "technical survey"

## The 5-Phase Research Funnel

### Overview

The research funnel is a systematic methodology for transforming vague problems into actionable technical proposals:

```
Phase 1: DEFINE      → Refine problem into research question
    ↓                   Output: Keywords, search queries, constraints
Phase 2: DISCOVER    → Broad sweep to find papers
    ↓                   Output: 15-30 candidate papers
Phase 3: FILTER      → 10-second scan to select
    ↓                   Output: 3-5 selected papers
Phase 4: DEEP-DIVE   → Three-pass paper analysis
    ↓                   Output: Equations, pseudo-code, insights
Phase 5: SYNTHESIZE  → Comparison matrix & proposal
                        Output: Technical recommendation
```

### Phase Details

#### Phase 1: Problem Definition

**Goal**: Transform a vague problem into a focused, answerable research question.

**Key Activities**:
- Clarify what's actually being asked
- Define scope boundaries (in/out of scope)
- Generate keyword taxonomy:
  - Primary keywords (core concepts)
  - Secondary keywords (related terms, synonyms)
  - Academic keywords (technical terminology)
  - Exclusion keywords (filter irrelevant results)
- Construct optimized search queries for different databases
- Document constraints (date range, requirements, domains)

**Success Criteria**: The research question should be specific enough that you'll know when you've answered it.

#### Phase 2: Discovery

**Goal**: Cast a wide net to find all potentially relevant papers and resources.

**Key Activities**:
- Execute search queries across multiple databases
- Identify 15-30 candidate papers
- Categorize by type (academic, preprint, blog, code)
- Assign tracking IDs (UUIDs)
- Note papers that need manual search

**Search Sources**:
- Google Scholar: Comprehensive academic coverage
- arXiv: Cutting-edge preprints
- Semantic Scholar: AI-optimized academic search
- GitHub: Code implementations
- General web: Tutorials, discussions

**Success Criteria**: You have enough candidates to ensure you won't miss important work.

#### Phase 3: Filter

**Goal**: Rapidly evaluate candidates and select the most valuable papers for deep analysis.

**Key Activities**:
- Apply 10-second scan to each paper
- Score on relevance, depth, novelty, clarity, reproducibility
- Select 3-5 papers ensuring diversity
- Document rejection reasons

**10-Second Scan Checklist**:
1. Title and abstract relevant?
2. From reputable venue?
3. Within date range?
4. Accessible (not paywalled)?
5. Something unique to offer?

**Success Criteria**: Selected papers collectively answer the research question.

#### Phase 4: Deep Dive

**Goal**: Thoroughly understand each selected paper through systematic analysis.

**The Three-Pass Method**:

**Pass 1 - Bird's Eye View** (5-10 min):
- Read title, abstract, intro, headings, conclusion
- Identify paper category and main claims
- Decide if paper should stay in selection

**Pass 2 - Detailed Understanding** (30-60 min):
- Read entire paper, skip proofs/equations initially
- Mark key figures and tables
- Note unfamiliar terms
- Identify strengths and weaknesses

**Pass 3 - Deep Analysis** (1-2 hours):
- Understand every equation and algorithm
- Extract implementation details
- Identify assumptions and limitations
- Generate pseudo-code

**Key Outputs**:
- Equation explanations (LaTeX → plain English)
- Algorithm pseudo-code
- Reproducibility assessment
- Key takeaways and questions

**Success Criteria**: You could explain the paper to someone else and implement the key ideas.

#### Phase 5: Synthesis

**Goal**: Combine insights from all phases into actionable recommendations.

**Key Activities**:
- Build comparison matrix across multiple dimensions
- Identify patterns, trade-offs, gaps, trends
- Develop multiple approach options
- Make recommendation with roadmap

**Comparison Dimensions**:
- Performance: accuracy, speed, complexity, scalability
- Implementation: code available, language, dependencies
- Resources: data requirements, hardware, time
- Maturity: citations, implementations, production use

**Proposal Structure**:
1. Executive summary
2. Background and literature landscape
3. Multiple approach options (conservative to innovative)
4. Recommendation with justification
5. Implementation roadmap
6. Success metrics and risk mitigation

**Success Criteria**: The proposal is actionable and well-justified by the research.

## Output Format

Each phase produces a Markdown file stored in `./research/<session-slug>/`:

- `phase-1-define.md` - Research question, keywords, search queries
- `phase-2-discover.md` - Candidate papers list with metadata
- `phase-3-filter.md` - Selected papers with scoring rationale
- `phase-4-deep-dive.md` - Detailed analysis, equations, pseudo-code
- `phase-5-synthesize.md` - Comparison matrix and technical proposal

## Session Management

- **Session slug**: Auto-generated from topic (URL-safe, kebab-case)
- **Session directory**: `./research/<session-slug>/`
- **Phase chaining**: Each phase auto-detects previous phase output
- **Override**: Use `--session <slug>` to specify session explicitly

## Best Practices

### For Effective Searches
- Use Boolean operators: AND, OR, NOT
- Use quotes for exact phrases
- Include synonyms and related terms
- Try both specific and broader queries
- Check "Related Work" sections for citations

### For Paper Selection
- Balance classic/seminal works with recent innovations
- Include papers with different approaches
- Don't just pick highest-cited papers
- Consider reproducibility and code availability

### For Deep Analysis
- Don't skip passes, even for familiar papers
- Explain equations as if teaching someone else
- Pseudo-code should be implementable
- Note what surprises you

### For Synthesis
- Let data drive conclusions
- Be honest about uncertainties
- Make trade-offs explicit
- Consider multiple audiences

## Related Commands

- `/researcher:define` - Start Phase 1
- `/researcher:discover` - Execute Phase 2
- `/researcher:filter` - Execute Phase 3
- `/researcher:deep-dive` - Execute Phase 4
- `/researcher:synthesize` - Execute Phase 5

## References

See the reference files for detailed guidance:
- `references/search-strategies.md` - Database-specific search techniques
- `references/paper-analysis.md` - Detailed three-pass method
- `references/synthesis-templates.md` - Templates for comparison and proposals
