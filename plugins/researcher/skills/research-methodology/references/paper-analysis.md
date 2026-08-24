# Paper Analysis Reference

This reference provides detailed guidance on the three-pass reading method and techniques for extracting key information from academic papers.

## The Three-Pass Method

The three-pass method is a systematic approach to reading academic papers that balances thoroughness with efficiency.

### Pass 1: Bird's Eye View (5-10 minutes)

**Goal**: Determine if the paper is worth reading in detail.

**What to Read**:
1. Title and abstract
2. Introduction (first and last paragraphs)
3. Section headings
4. Figures and tables (captions only)
5. Conclusion
6. References (scan for familiar names)

**Questions to Answer**:
- [ ] What type of paper is this? (empirical, theoretical, survey, system)
- [ ] What problem does it address?
- [ ] What are the main claims/contributions?
- [ ] Is this relevant to my research question?
- [ ] Should I continue to Pass 2?

**Note-Taking Template**:
```markdown
## Pass 1 Notes: <Title>

**Category**: <empirical|theoretical|survey|system>
**Main Contribution**: <1 sentence>
**Relevance**: <1-5>/5
**Continue?**: Yes/No
**Reason**: <Why continue or not>
```

### Pass 2: Detailed Understanding (30-60 minutes)

**Goal**: Understand the paper's overall argument and approach.

**What to Do**:
1. Read the entire paper, but don't get stuck on proofs/equations
2. Mark key concepts, equations, and references
3. Annotate figures and tables
4. Identify unfamiliar terms for later lookup
5. Note connections to other papers

**What to Identify**:

**Structure Analysis**:
- What's the logical flow of the argument?
- How do sections connect to each other?
- What evidence supports each claim?

**Strengths**:
- Novel contributions
- Strong experimental design
- Clear presentation
- Practical applicability

**Weaknesses**:
- Unsupported claims
- Missing comparisons
- Unclear methodology
- Limited evaluation

**Note-Taking Template**:
```markdown
## Pass 2 Notes: <Title>

### Argument Structure
1. <Section 1>: <Purpose/Claim>
2. <Section 2>: <Purpose/Claim>
...

### Key Figures
- Figure N: <What it shows, why important>

### Key Tables
- Table N: <What it shows, why important>

### Strengths
- <Strength 1>
- <Strength 2>

### Weaknesses
- <Weakness 1>
- <Weakness 2>

### Questions
- <Question 1>
- <Question 2>

### Unfamiliar Terms
- <Term>: <Quick definition>
```

### Pass 3: Deep Analysis (1-2 hours)

**Goal**: Thoroughly understand every detail, as if you need to implement or reproduce the work.

**What to Do**:
1. Understand every equation, proof, and algorithm
2. Mentally reconstruct the approach step-by-step
3. Identify implicit assumptions
4. Think about what's missing or could be improved
5. Extract implementation details

**Deep Analysis Checklist**:
- [ ] Can I explain each equation in plain English?
- [ ] Do I understand why each design choice was made?
- [ ] Could I implement this from the paper alone?
- [ ] What are the key hyperparameters and their values?
- [ ] What assumptions does this rely on?
- [ ] What are the limitations?
- [ ] How does this compare to alternatives?

## Equation Analysis

### How to Document Equations

For each significant equation:

```markdown
### Equation N: <Descriptive Name>

**LaTeX**: $<equation>$

**Plain English**: <What this computes in simple terms>

**Variables**:
| Symbol | Meaning | Type/Dimensions |
|--------|---------|-----------------|
| X | Input tensor | [batch, seq_len, dim] |
| W | Weight matrix | [dim, hidden] |

**Intuition**: <Why this formulation makes sense>

**Assumptions**: <What must be true for this to work>

**Connection**: <How it relates to other equations>
```

### Example Equation Analysis

```markdown
### Equation 3: Scaled Dot-Product Attention

**LaTeX**: $\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$

**Plain English**:
Compute attention by taking dot products between queries and keys to get similarity scores, scale them down by the square root of the key dimension, apply softmax to get weights, then use those weights to combine the values.

**Variables**:
| Symbol | Meaning | Type/Dimensions |
|--------|---------|-----------------|
| Q | Query matrix | [batch, n_heads, seq_len, d_k] |
| K | Key matrix | [batch, n_heads, seq_len, d_k] |
| V | Value matrix | [batch, n_heads, seq_len, d_v] |
| d_k | Key/query dimension | scalar |

**Intuition**:
- Dot product measures similarity between queries and keys
- Scaling by √d_k prevents dot products from growing large with dimension
- Large dot products would push softmax into regions with tiny gradients
- Softmax converts scores to a probability distribution
- Final multiplication retrieves weighted sum of values

**Assumptions**:
- Q, K, V have already been linearly projected
- d_k = d_v is common but not required

**Connection**:
This is the core attention mechanism; multi-head attention runs this in parallel across heads.
```

## Algorithm Extraction

### Pseudo-Code Guidelines

Good pseudo-code should be:
- **Implementable**: Clear enough to code from
- **Readable**: Use meaningful variable names
- **Annotated**: Comments explain why, not just what
- **Complete**: Include initialization, edge cases

### Pseudo-Code Template

```
Algorithm: <Name>
----------------------------------------
Purpose: <What this algorithm achieves>
Complexity: Time O(<>), Space O(<>)
----------------------------------------

Input:
  - <param1>: <description> (<type>)
  - <param2>: <description> (<type>)

Output:
  - <output>: <description> (<type>)

Constants/Hyperparameters:
  - <constant>: <value> (<meaning>)

Procedure:
1. <Step 1>                        // <Why this step>
2. <Step 2>                        // <Why this step>
3. for i = 1 to N:
4.     <Step in loop>              // <Explanation>
5.     if <condition>:
6.         <Step>                  // <Edge case handling>
7. return <result>

Notes:
- <Implementation note 1>
- <Implementation note 2>
```

### Example Algorithm Extraction

```
Algorithm: Flash Attention Forward Pass
----------------------------------------
Purpose: Compute exact attention with O(N) memory instead of O(N²)
Complexity: Time O(N²d), Space O(N)
----------------------------------------

Input:
  - Q: Query matrix (N × d)
  - K: Key matrix (N × d)
  - V: Value matrix (N × d)
  - B_r: Block size for queries
  - B_c: Block size for keys/values

Output:
  - O: Attention output (N × d)

Procedure:
1. Initialize O = 0, l = 0, m = -∞      // Output, normalizer, running max
2. Divide Q into T_r = ⌈N/B_r⌉ blocks   // Split queries into chunks
3. Divide K, V into T_c = ⌈N/B_c⌉ blocks

4. for each query block i = 1 to T_r:
5.     Load Q_i from HBM to SRAM        // High bandwidth memory to fast memory
6.     for each KV block j = 1 to T_c:
7.         Load K_j, V_j to SRAM
8.         S_ij = Q_i @ K_j^T           // Compute attention scores for block
9.         m_new = max(m_i, rowmax(S_ij))  // Update running maximum
10.        P_ij = exp(S_ij - m_new)     // Stable softmax numerator
11.        l_new = exp(m_i - m_new) * l_i + rowsum(P_ij)  // Update normalizer
12.        O_i = exp(m_i - m_new) * O_i + P_ij @ V_j      // Update output
13.        m_i = m_new, l_i = l_new     // Save state
14.    O_i = O_i / l_i                  // Final normalization
15.    Write O_i to HBM

16. return O

Notes:
- Key insight: Never materialize full N×N attention matrix
- Requires recomputation in backward pass (memory-compute tradeoff)
- Block sizes B_r, B_c chosen based on SRAM size
- Numerically stable via online softmax computation
```

## Reproducibility Assessment

### Checklist

| Aspect | Questions to Ask | Status |
|--------|------------------|--------|
| **Code** | Is official code available? Link? License? | ✅/❌/⚠️ |
| **Code Quality** | Documented? Tests? Active maintenance? | ✅/❌/⚠️ |
| **Data** | Datasets available? Preprocessing described? | ✅/❌/⚠️ |
| **Model** | Pretrained weights available? | ✅/❌/⚠️ |
| **Hyperparameters** | All hyperparameters listed? | ✅/❌/⚠️ |
| **Training Details** | Optimizer, learning rate, batch size, epochs? | ✅/❌/⚠️ |
| **Hardware** | What compute was used? How long? | ✅/❌/⚠️ |
| **Randomness** | Seeds provided? Variance reported? | ✅/❌/⚠️ |
| **Baselines** | Can baselines be reproduced? Fair comparison? | ✅/❌/⚠️ |

### Missing Information Template

```markdown
## Reproducibility Gaps

### Required to Implement
- [ ] <Missing detail 1>
- [ ] <Missing detail 2>

### Required to Match Results
- [ ] <Missing detail 1>
- [ ] <Missing detail 2>

### Questions for Authors
1. <Question 1>
2. <Question 2>

### Workarounds
- <Gap>: <Possible workaround or assumption>
```

## Common Paper Types

### Empirical Papers
- Focus on: Experiments, datasets, benchmarks
- Key sections: Experimental setup, Results, Ablations
- Extract: Hyperparameters, baselines, metrics

### Theoretical Papers
- Focus on: Proofs, analysis, bounds
- Key sections: Problem formulation, Main theorems
- Extract: Assumptions, proof techniques, implications

### Survey Papers
- Focus on: Taxonomy, comparison, trends
- Key sections: Categories, related work analysis
- Extract: Classification scheme, key papers, open problems

### System Papers
- Focus on: Architecture, implementation, deployment
- Key sections: Design, Implementation, Evaluation
- Extract: System diagram, performance numbers, lessons learned

## Note Organization

### Per-Paper Notes Structure

```
research/<session>/notes/
├── <paper-id>-pass1.md      # Quick evaluation
├── <paper-id>-pass2.md      # Detailed notes
├── <paper-id>-pass3.md      # Deep analysis
├── <paper-id>-equations.md  # Equation breakdowns
├── <paper-id>-algorithms.md # Pseudo-code
└── <paper-id>-reproduce.md  # Reproducibility notes
```

### Cross-Paper Notes

```
research/<session>/notes/
├── comparisons.md           # Side-by-side comparisons
├── questions.md             # Open questions
├── ideas.md                 # Research ideas sparked
└── glossary.md              # Term definitions
```
