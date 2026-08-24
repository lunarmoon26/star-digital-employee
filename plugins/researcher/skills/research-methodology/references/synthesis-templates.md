# Synthesis Templates Reference

This reference provides templates and frameworks for synthesizing research findings into comparison matrices, pattern analysis, and technical proposals.

## Comparison Matrix Templates

### Performance Metrics Matrix

Compare papers on quantitative performance:

```markdown
| Paper | Task/Dataset | Primary Metric | Secondary Metric | Baseline Δ |
|-------|--------------|----------------|------------------|------------|
| Paper A | ImageNet | 85.2% acc | 12.3M params | +2.1% |
| Paper B | ImageNet | 84.8% acc | 8.1M params | +1.7% |
| Paper C | ImageNet | 86.1% acc | 25.5M params | +3.0% |
```

### Complexity Analysis Matrix

Compare computational characteristics:

```markdown
| Paper | Time Complexity | Space Complexity | FLOPs | Latency |
|-------|-----------------|------------------|-------|---------|
| Paper A | O(n²d) | O(n²) | 12.4G | 45ms |
| Paper B | O(nd²) | O(nd) | 8.2G | 32ms |
| Paper C | O(n log n · d) | O(n) | 6.1G | 28ms |
```

### Implementation Readiness Matrix

Compare practical factors:

```markdown
| Paper | Code | Framework | Dependencies | Docs | Tests | License |
|-------|------|-----------|--------------|------|-------|---------|
| Paper A | ✅ Official | PyTorch | 5 | ⭐⭐⭐ | ✅ | MIT |
| Paper B | ⚠️ 3rd party | TensorFlow | 12 | ⭐⭐ | ❌ | Apache |
| Paper C | ❌ None | - | - | - | - | - |
```

### Research Maturity Matrix

Compare academic standing:

```markdown
| Paper | Year | Venue | Citations | H-Index Authors | Follow-up Work |
|-------|------|-------|-----------|-----------------|----------------|
| Paper A | 2020 | NeurIPS | 2,450 | 45, 38 | 15 papers |
| Paper B | 2022 | ICML | 312 | 28, 22 | 4 papers |
| Paper C | 2023 | arXiv | 45 | 15 | - |
```

### Resource Requirements Matrix

Compare what's needed to use the approach:

```markdown
| Paper | Min GPU | Training Data | Training Time | Inference HW |
|-------|---------|---------------|---------------|--------------|
| Paper A | V100 32GB | 10M samples | 48 GPU-hours | CPU OK |
| Paper B | A100 40GB | 100M samples | 200 GPU-hours | GPU required |
| Paper C | 4x A100 | 1B samples | 2000 GPU-hours | GPU required |
```

### Combined Multi-Dimensional Matrix

Full comparison across all dimensions:

```markdown
| Dimension | Paper A | Paper B | Paper C | Best |
|-----------|---------|---------|---------|------|
| **Performance** | | | | |
| Accuracy | 85.2% | 84.8% | 86.1% | C |
| Speed | 45ms | 32ms | 28ms | C |
| Memory | 8.2GB | 12.1GB | 4.5GB | C |
| **Implementation** | | | | |
| Code Quality | ⭐⭐⭐ | ⭐⭐ | ⭐ | A |
| Ease of Use | Easy | Medium | Hard | A |
| **Resources** | | | | |
| Training Cost | $500 | $2,000 | $10,000 | A |
| Data Required | 10M | 100M | 1B | A |
| **Maturity** | | | | |
| Citations | 2,450 | 312 | 45 | A |
| Production Use | Yes | Limited | No | A |
```

## Pattern Analysis Templates

### Theme Identification Template

```markdown
## Common Themes

### Theme 1: <Theme Name>

**Description**: <What this theme represents>

**Evidence**:
| Paper | How It Manifests |
|-------|-----------------|
| Paper A | <Specific example> |
| Paper B | <Specific example> |

**Implications**: <What this means for the field/our work>

---

### Theme 2: <Theme Name>
[Repeat structure...]
```

### Trade-off Analysis Template

```markdown
## Trade-off Analysis

### Trade-off 1: <Accuracy vs Speed>

**Description**: Improving accuracy tends to require more computation.

**Spectrum**:
```
Fast/Less Accurate ←――――――――――→ Slow/More Accurate
    Paper B           Paper A         Paper C
```

**Options**:
| Choice | Pros | Cons | When to Choose |
|--------|------|------|----------------|
| Favor Speed | Real-time possible | Lower quality | Latency-critical apps |
| Favor Accuracy | Best results | Slow inference | Batch processing OK |
| Balanced | Reasonable both | Neither optimal | General purpose |

**Our Context**: <Which end of spectrum fits our needs>

---

### Trade-off 2: <Simplicity vs Flexibility>
[Repeat structure...]
```

### Gap Analysis Template

```markdown
## Research Gaps

### Gap 1: <Gap Name>

**Description**: <What's missing in current research>

**Evidence**:
- Paper A: <How it fails to address this>
- Paper B: <How it fails to address this>

**Impact**: <Why this gap matters>

**Potential Approaches**:
1. <Approach to fill gap>
2. <Approach to fill gap>

**Difficulty**: <Easy/Medium/Hard>

---

### Gap 2: <Gap Name>
[Repeat structure...]
```

### Trend Analysis Template

```markdown
## Emerging Trends

### Trend 1: <Trend Name>

**Direction**: <What's changing and how>

**Timeline**:
```
2020: <State>
2021: <Development>
2022: <Development>
2023: <Current state>
2024+: <Projected direction>
```

**Key Papers Driving This**:
1. Paper X (2021): <Contribution>
2. Paper Y (2022): <Contribution>

**Implications for Our Work**: <How to position relative to trend>

---

### Trend 2: <Trend Name>
[Repeat structure...]
```

## Technical Proposal Templates

### Proposal Structure Template

```markdown
# Technical Proposal: <Title>

## Executive Summary

<2-3 paragraphs covering:>
- Problem and why it matters
- Key findings from research
- Recommended approach and expected outcome

## 1. Background

### 1.1 Problem Statement
<Clear statement of the problem to solve>

### 1.2 Motivation
<Why this problem is worth solving now>

### 1.3 Current Landscape
<Brief overview of existing approaches from literature>

### 1.4 Constraints
<Technical, resource, or timeline constraints>

## 2. Technical Analysis

### 2.1 Key Findings from Research
<Summarize insights from deep dive phase>

### 2.2 Comparison Summary
<Reference comparison matrix, highlight key differences>

### 2.3 Critical Success Factors
<What any solution must achieve>

## 3. Proposed Approaches

### 3.1 Option A: <Conservative>
[Use Option Template below]

### 3.2 Option B: <Balanced>
[Use Option Template below]

### 3.3 Option C: <Innovative>
[Use Option Template below]

## 4. Recommendation

### 4.1 Recommended Option
<Which option and why>

### 4.2 Justification
<Detailed reasoning>

### 4.3 Implementation Roadmap
[Use Roadmap Template below]

### 4.4 Success Metrics
[Use Metrics Template below]

### 4.5 Risk Assessment
[Use Risk Template below]

## 5. Appendices

### A. Full Comparison Matrix
### B. Paper Summaries
### C. Glossary
### D. References
```

### Option Template

```markdown
### Option X: <Name>

**Summary**: <One sentence description>

**Technical Approach**:
<Detailed description of the approach>

**Key Components**:
1. <Component 1>: Based on <Paper X>
2. <Component 2>: Based on <Paper Y>
3. <Component 3>: Novel combination

**Architecture Diagram**:
```
[Component A] → [Component B] → [Output]
      ↑              ↑
[Input]        [Component C]
```

**Pros**:
- ✅ <Advantage 1>
- ✅ <Advantage 2>
- ✅ <Advantage 3>

**Cons**:
- ❌ <Disadvantage 1>
- ❌ <Disadvantage 2>

**Resource Requirements**:
| Resource | Requirement |
|----------|-------------|
| Data | <Amount and type> |
| Compute | <Hardware needs> |
| Time | <Development/training time> |
| Team | <Skills needed> |

**Risk Level**: <Low/Medium/High>

**Best For**: <When to choose this option>
```

### Roadmap Template

```markdown
### Implementation Roadmap

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
[Setup]    [Core]      [Eval]      [Deploy]
```

| Phase | Focus | Deliverables | Dependencies | Exit Criteria |
|-------|-------|--------------|--------------|---------------|
| 1 | Setup | Environment, data pipeline | None | Can train baseline |
| 2 | Core | Implement approach | Phase 1 | Approach working |
| 3 | Evaluate | Benchmarks, ablations | Phase 2 | Meet metrics |
| 4 | Deploy | Integration, docs | Phase 3 | In production |

**Critical Path**: Phase 1 → Phase 2 → Phase 3
**Parallelizable**: Documentation can overlap with Phase 3
```

### Metrics Template

```markdown
### Success Metrics

| Metric | Target | Minimum Viable | Stretch Goal | Measurement |
|--------|--------|----------------|--------------|-------------|
| Accuracy | 90% | 85% | 95% | Test set evaluation |
| Latency | <50ms | <100ms | <20ms | P99 inference time |
| Memory | <4GB | <8GB | <2GB | Peak GPU memory |

**Primary Metric**: <Which metric matters most>

**Evaluation Protocol**:
1. <How metrics will be measured>
2. <What datasets/conditions>
3. <How often to evaluate>
```

### Risk Template

```markdown
### Risk Assessment

| Risk | Likelihood | Impact | Mitigation | Contingency |
|------|------------|--------|------------|-------------|
| Data insufficient | Medium | High | Augmentation, synthetic | Partner for data |
| Doesn't meet accuracy | Low | High | Ensemble methods | Fallback to Option A |
| Compute exceeds budget | Medium | Medium | Efficient training | Cloud spot instances |
| Key person leaves | Low | Medium | Documentation | Cross-training |

**Risk Response Plan**:

**High Priority Risks** (High likelihood OR High impact):
1. <Risk>: <Detailed mitigation plan>

**Monitoring**:
- Weekly: <What to check>
- Monthly: <What to review>
```

## Synthesis Best Practices

### Do:
- Let data drive conclusions
- Acknowledge uncertainty
- Present multiple perspectives
- Make trade-offs explicit
- Provide actionable recommendations
- Include enough detail to act on

### Don't:
- Cherry-pick supporting evidence
- Overstate confidence
- Hide limitations
- Force false consensus
- Leave decisions ambiguous
- Overwhelm with unnecessary detail

### Quality Checklist

Before finalizing synthesis:

- [ ] All papers fairly represented?
- [ ] Comparisons use consistent criteria?
- [ ] Trade-offs clearly stated?
- [ ] Gaps honestly acknowledged?
- [ ] Recommendations justified by evidence?
- [ ] Roadmap is realistic?
- [ ] Risks adequately addressed?
- [ ] Actionable next steps clear?
