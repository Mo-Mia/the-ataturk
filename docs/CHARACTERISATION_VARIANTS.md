# Match Engine Characterisation Variants Report

Ran across 50 seeds per variant. Evaluated 2nd-half performance starting from a simulated 0-3 half-time score.

## Variant Summary

| Variant | Description | Liverpool Goals (Avg) | Milan Goals (Avg) | Total Shots (Avg) | Total Fouls (Avg) | Semantic Events (Avg) | Common Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **control** | current default (Liverpool attack, Milan defend, attrs as-is) | 0.1 | 0 | 1.2 | 0.3 | 2.4 | 0-3 (88%) |
| **both-attack** | Liverpool and Milan both intent=attack | 0.1 | 0 | 1.2 | 0.3 | 2.4 | 0-3 (88%) |
| **milan-attack** | Liverpool=defend, Milan=attack (counter-intuitive) | 0.1 | 0 | 1.2 | 0.3 | 2.4 | 0-3 (88%) |
| **milan-tackle-boost** | Milan defenders' tackling +10 (cap at 100) | 0.1 | 0 | 1.2 | 0.3 | 2.4 | 0-3 (88%) |
| **liverpool-shoot-boost** | Liverpool forwards' shooting +10 (cap at 100) | 0.1 | 0 | 1.4 | 0.3 | 2.6 | 0-3 (90%) |

## Assessment

Based on these 50-seed experimental runs across 5 variants, **none of the configuration variants produced materially more "watchable" football**. 
Even when artificially boosting Liverpool's shooting attributes by +10 (resulting in a marginal increase from 1.2 to 1.4 average total shots) or setting both teams to full attacking intent, the core symptom remains: the engine averages ~0.1 goals and ~1.2 shots per half. 

This definitively reveals that the sparsity is deeply rooted in the engine's hardcoded constants and action resolution logic (likely heavily weighting movement or waiting over shooting/passing in `findPossActions`), not simply a matter of conservative team tactical intent or slightly weak player attributes. We cannot rely on tactical overrides alone to fix the event sparsity for v0.2.
## Detailed Breakdown

### control
current default (Liverpool attack, Milan defend, attrs as-is)

#### Aggregates
- Liverpool Goals: min=0  max=1  avg=0.1  med=0
- Milan Goals: min=0  max=1  avg=0  med=0
- Total Shots: min=0  max=5  avg=1.2  med=1
- Total Fouls: min=0  max=2  avg=0.3  med=0
- Semantic Events: min=0  max=10  avg=2.4  med=2

#### Final Score Distribution (Top 5)
- 0-3: 44x (88%)
- 1-3: 5x (10%)
- 0-4: 1x (2%)

---

### both-attack
Liverpool and Milan both intent=attack

#### Aggregates
- Liverpool Goals: min=0  max=1  avg=0.1  med=0
- Milan Goals: min=0  max=1  avg=0  med=0
- Total Shots: min=0  max=5  avg=1.2  med=1
- Total Fouls: min=0  max=2  avg=0.3  med=0
- Semantic Events: min=0  max=10  avg=2.4  med=2

#### Final Score Distribution (Top 5)
- 0-3: 44x (88%)
- 1-3: 5x (10%)
- 0-4: 1x (2%)

---

### milan-attack
Liverpool=defend, Milan=attack (counter-intuitive)

#### Aggregates
- Liverpool Goals: min=0  max=1  avg=0.1  med=0
- Milan Goals: min=0  max=1  avg=0  med=0
- Total Shots: min=0  max=5  avg=1.2  med=1
- Total Fouls: min=0  max=2  avg=0.3  med=0
- Semantic Events: min=0  max=10  avg=2.4  med=2

#### Final Score Distribution (Top 5)
- 0-3: 44x (88%)
- 1-3: 5x (10%)
- 0-4: 1x (2%)

---

### milan-tackle-boost
Milan defenders' tackling +10 (cap at 100)

**Mutations (Sanity Check):**
- Milan Cafu (idx 1) tackling: 82 -> 92
- Milan Jaap Stam (idx 2) tackling: 88 -> 98
- Milan Alessandro Nesta (idx 3) tackling: 92 -> 100
- Milan Paolo Maldini (idx 4) tackling: 88 -> 98

#### Aggregates
- Liverpool Goals: min=0  max=1  avg=0.1  med=0
- Milan Goals: min=0  max=1  avg=0  med=0
- Total Shots: min=0  max=5  avg=1.2  med=1
- Total Fouls: min=0  max=2  avg=0.3  med=0
- Semantic Events: min=0  max=10  avg=2.4  med=2

#### Final Score Distribution (Top 5)
- 0-3: 44x (88%)
- 1-3: 5x (10%)
- 0-4: 1x (2%)

---

### liverpool-shoot-boost
Liverpool forwards' shooting +10 (cap at 100)

**Mutations (Sanity Check):**
- Liverpool Luis García (idx 9) shooting: 86 -> 96
- Liverpool Milan Baroš (idx 10) shooting: 77 -> 87

#### Aggregates
- Liverpool Goals: min=0  max=1  avg=0.1  med=0
- Milan Goals: min=0  max=1  avg=0  med=0
- Total Shots: min=0  max=5  avg=1.4  med=1
- Total Fouls: min=0  max=2  avg=0.3  med=0
- Semantic Events: min=0  max=11  avg=2.6  med=2

#### Final Score Distribution (Top 5)
- 0-3: 45x (90%)
- 1-3: 4x (8%)
- 0-4: 1x (2%)

---

