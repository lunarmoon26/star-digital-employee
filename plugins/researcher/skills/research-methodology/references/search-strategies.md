# Search Strategies Reference

This reference provides database-specific search techniques and query optimization strategies for academic research.

## General Search Principles

### Query Construction

**Boolean Operators**:
- `AND`: Both terms must appear (often implicit)
- `OR`: Either term may appear (use for synonyms)
- `NOT` / `-`: Exclude terms
- Parentheses: Group terms

**Phrase Searching**:
- Use quotes for exact phrases: `"attention mechanism"`
- Without quotes: words may appear separately

**Wildcards**:
- `*` matches zero or more characters: `optim*` → optimize, optimization, optimal
- `?` matches single character (some databases)

### Keyword Selection

**Primary Keywords** (3-5 terms):
- Core concepts central to your question
- Most specific terms for your topic
- Example: "transformer", "attention", "efficiency"

**Secondary Keywords** (5-10 terms):
- Synonyms and related concepts
- Alternative phrasings
- Example: "self-attention", "multi-head attention", "computational cost"

**Academic Keywords** (3-5 terms):
- Technical terminology from the field
- Conference/journal names
- Standard benchmarks
- Example: "BERT", "NeurIPS", "GLUE benchmark"

**Exclusion Keywords** (3-5 terms):
- Common false positive triggers
- Out-of-scope topics
- Example: "medical", "finance" (if researching general NLP)

## Database-Specific Strategies

### Google Scholar

**URL**: https://scholar.google.com

**Query Features**:
```
"exact phrase"           - Exact phrase match
author:smith             - Author search
source:"Nature"          - Source/venue filter
intitle:transformer      - Title contains word
```

**Advanced Search**:
- Use the Advanced Search form for date ranges
- "Cited by" to find related work
- "Related articles" for similar papers
- "Versions" to find preprints/postprints

**Example Queries**:
```
"attention mechanism" efficiency transformer -medical
intitle:"efficient attention" deep learning
author:vaswani "attention is all you need"
```

**Tips**:
- Scholar includes preprints, theses, reports
- Check "Cited by" for influential papers
- Use date filter for recent work
- "Related articles" helps discover more

### arXiv

**URL**: https://arxiv.org

**Query Features**:
```
ti:transformer           - Title contains
au:vaswani               - Author name
abs:"efficient attention"- Abstract contains
cat:cs.CL                - Category filter
```

**Categories for ML/AI**:
- `cs.LG` - Machine Learning
- `cs.CL` - Computation and Language
- `cs.CV` - Computer Vision
- `cs.AI` - Artificial Intelligence
- `stat.ML` - Statistics ML

**Example Queries**:
```
ti:efficient AND ti:attention AND cat:cs.LG
au:vaswani AND abs:transformer
all:"linear attention" AND cat:cs.CL
```

**Tips**:
- arXiv has newest research (preprints)
- Check multiple relevant categories
- Use date sorting for latest work
- "replacements" shows paper updates

### Semantic Scholar

**URL**: https://www.semanticscholar.org

**Features**:
- AI-powered relevance ranking
- Citation context analysis
- Author disambiguation
- API for programmatic access

**Query Features**:
```
title:efficient attention
author:Ashish Vaswani
venue:NeurIPS
year:2020-2024
```

**Filters**:
- Publication Type (Conference, Journal, etc.)
- Year range
- Open Access only
- Venue
- Fields of Study

**Example Queries**:
```
efficient transformer attention mechanism
"linear attention" deep learning
```

**Tips**:
- Good for finding highly cited papers
- "Influential Citations" highlights key works
- TLDR summaries for quick evaluation
- Research highlights show key claims

### ACM Digital Library

**URL**: https://dl.acm.org

**Query Features**:
```
Title:(efficient attention)
Abstract:transformer
Author:"Smith, John"
PublicationDate:[2020 TO *]
```

**Tips**:
- Focus on systems and applied research
- Check ACM Computing Surveys for reviews
- Good for software engineering topics

### IEEE Xplore

**URL**: https://ieeexplore.ieee.org

**Query Features**:
```
"Document Title":efficient
"Abstract":attention mechanism
"Author":Vaswani
```

**Tips**:
- Strong in hardware, systems, engineering
- Includes conference proceedings
- Good for applied/industrial work

### GitHub

**URL**: https://github.com

**Query Features**:
```
efficient attention language:python
transformer in:readme stars:>100
attention mechanism extension:py
```

**Qualifiers**:
- `language:` - Programming language
- `stars:>n` - Minimum stars
- `forks:>n` - Minimum forks
- `in:readme` - Search README files
- `extension:` - File extension
- `user:` or `org:` - Repository owner

**Example Queries**:
```
efficient attention transformer stars:>500 language:python
linear attention mechanism implementation
"flash attention" pytorch
```

**Tips**:
- Stars indicate popularity
- Check Issues and Discussions
- Look at "Used by" for adoption
- README often links to paper

### Papers With Code

**URL**: https://paperswithcode.com

**Features**:
- Links papers to code implementations
- Benchmark leaderboards
- Method comparisons
- Trend tracking

**Tips**:
- Great for finding implementations
- Check benchmark results
- See trending papers
- Compare methods side-by-side

## Query Templates

### For Survey/Overview
```
"survey" OR "review" OR "tutorial" <topic>
<topic> "state of the art" OR "recent advances"
```

### For Specific Method
```
"<method name>" <application area>
author:<inventor> <method keywords>
```

### For Comparison Studies
```
<method1> vs <method2>
"comparison" OR "benchmark" <methods>
```

### For Implementation
```
<method> implementation code
<method> github repository stars:>100
```

### For Recent Work
```
<topic> year:2023-2024
<topic> preprint OR arxiv
```

## Search Iteration Strategy

### Initial Broad Search
1. Use primary keywords only
2. Note the vocabulary used in results
3. Identify key authors and venues

### Refined Search
1. Add secondary/academic keywords from initial results
2. Apply date and venue filters
3. Use exclusion keywords to reduce noise

### Citation Chasing
1. Forward citations: "Cited by" on key papers
2. Backward citations: References in key papers
3. Related articles features

### Snowball Strategy
1. Start with 1-2 highly relevant papers
2. Check their references (backward)
3. Check who cites them (forward)
4. Repeat with newly discovered papers

## Quality Indicators

### For Papers
- Published in peer-reviewed venue
- High citation count (relative to age)
- Authors from reputable institutions
- Clear methodology section
- Available code/data

### For Code Repositories
- High star count (>100 for niche, >1000 for popular)
- Recent activity
- Good documentation
- Active issue resolution
- Used by other projects

### For Blogs/Tutorials
- Author credentials
- Technical accuracy
- Links to primary sources
- Community engagement
- Recency

## Common Pitfalls

1. **Too narrow too fast**: Start broad, narrow progressively
2. **Ignoring synonyms**: Same concept, different names
3. **Only recent papers**: Miss foundational work
4. **Only high citations**: Miss innovative new work
5. **Single database**: Each has different coverage
6. **Stopping too early**: Key papers might be on page 3
