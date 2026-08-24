# Researcher Plugin

A Claude Code plugin implementing a 5-phase research funnel methodology for systematic literature review and technical research.

## Overview

The researcher plugin provides a structured approach to technical research, transforming vague problem statements into actionable technical proposals through five distinct phases:

```
DEFINE → DISCOVER → FILTER → DEEP-DIVE → SYNTHESIZE
```

Each phase produces reusable documents (both Markdown and JSON) that can be used as prompts for subsequent phases or shared with other AI research agents.

## Installation

```bash
claude --plugin-dir ./plugins/researcher
```

Or add to your Claude Code configuration:

```json
{
  "plugins": ["./plugins/researcher"]
}
```

## Quick Start

### Start a New Research Session

```
/researcher:define "How can I improve transformer attention efficiency?"
```

This creates a new session in `./research/transformer-attention-efficiency/` with:
- Refined research question
- Keyword taxonomy
- Optimized search queries for multiple databases

### Continue Through the Funnel

```
/researcher:discover                    # Find 15-30 candidate papers
/researcher:filter                      # Select 3-5 best papers
/researcher:deep-dive                   # Three-pass analysis
/researcher:synthesize                  # Create technical proposal
```

Each command automatically detects the most recent session, or you can specify:

```
/researcher:discover --session transformer-attention-efficiency
```

### Use the Research Assistant

For autonomous multi-phase research:

```
Research transformer attention efficiency completely
Continue research on transformer-attention-efficiency
What research sessions do I have?
```

## Commands

| Command | Phase | Purpose | Output |
|---------|-------|---------|--------|
| `/researcher:define` | 1 | Refine problem into research question | Keywords, queries, constraints |
| `/researcher:discover` | 2 | Broad search sweep | 15-30 candidate papers |
| `/researcher:filter` | 3 | 10-second scan selection | 3-5 selected papers |
| `/researcher:deep-dive` | 4 | Three-pass paper analysis | Equations, pseudo-code, insights |
| `/researcher:synthesize` | 5 | Comparison & proposal | Technical recommendation |

## Output Structure

All research outputs are stored in `./research/<session-slug>/`:

```
./research/transformer-attention-efficiency/
├── phase-1-define.md           # Research question, keywords, queries
├── phase-2-discover.md         # Candidate papers list
├── phase-3-filter.md           # Selected papers with scores
├── phase-4-deep-dive.md        # Detailed analysis with equations
└── phase-5-synthesize.md       # Comparison matrix and proposal
```

## The 5-Phase Methodology

### Phase 1: Define

Transform a vague problem into a focused research question with:
- **Scope definition**: What's in/out of scope
- **Keyword taxonomy**: Primary, secondary, academic, exclusion keywords
- **Search queries**: Optimized for Google Scholar, arXiv, Semantic Scholar, GitHub
- **Constraints**: Date range, requirements, domain restrictions

### Phase 2: Discover

Execute a broad search sweep to find all potentially relevant papers:
- Run automated web searches
- Collect 15-30 candidate papers
- Assign tracking IDs for cross-phase reference
- Document manual searches needed

### Phase 3: Filter

Apply rapid evaluation to select the best papers:
- 10-second scan for quick assessment
- Scoring matrix (relevance, depth, novelty, clarity, reproducibility)
- Select 3-5 papers ensuring diversity
- Document rejection reasons

### Phase 4: Deep Dive

Thoroughly analyze each selected paper using the three-pass method:

**Pass 1** (5-10 min): Bird's eye view - title, abstract, conclusion
**Pass 2** (30-60 min): Detailed understanding - full read, mark key points
**Pass 3** (1-2 hours): Deep analysis - equations, algorithms, assumptions

Key outputs:
- Equation explanations (LaTeX → plain English)
- Algorithm pseudo-code
- Reproducibility assessment
- Key takeaways and questions

### Phase 5: Synthesize

Combine all phases into actionable recommendations:
- **Comparison matrix**: Performance, implementation, resources, maturity
- **Pattern analysis**: Themes, trade-offs, gaps, trends
- **Technical proposal**: Multiple options with pros/cons
- **Recommendation**: Justified choice with roadmap and risk assessment

## Tips for Best Results

### For Better Discovery
- Be specific in your initial topic
- Review and edit Phase 1 keywords before discovery
- Supplement automated searches with manual searches for arXiv/Scholar

### For Better Selection
- Trust your 10-second scan instincts
- Balance classic papers with recent innovations
- Ensure selected papers offer complementary perspectives

### For Better Analysis
- Don't skip Pass 1 even for papers you think you know
- Explain equations as if teaching someone
- Note what surprises you - these become insights

### For Better Synthesis
- Let data drive conclusions
- Be honest about uncertainties
- Make trade-offs explicit

## Skill Reference

The plugin includes a `research-methodology` skill with detailed guidance:
- `SKILL.md`: Core methodology overview
- `references/search-strategies.md`: Database-specific search techniques
- `references/paper-analysis.md`: Three-pass reading method details
- `references/synthesis-templates.md`: Comparison and proposal templates

## Research Assistant Agent

The `research-assistant` agent provides autonomous research capabilities:
- Full automation: Run all 5 phases end-to-end
- Session continuation: Resume interrupted research
- Phase execution: Run specific phases on demand
- Session management: List and inspect sessions

## License

MIT

## Contributing

Contributions welcome! Please see the main repository contributing guidelines.
