# Steam Game Recommender System

## Project Overview
A game recommender system built on two Steam datasets, presented as a static web dashboard
hosted on GitHub Pages. The recommender uses **baseline-adjusted item-item Pearson correlation
collaborative filtering** — an improvement over the user-user CF methods used in earlier
versions (v1, v2), switched to item-item because the user-user similarity matrix was too sparse
and produced RMSE worse than the baseline estimate alone.

---

## Directory Structure
```
recommender-system/
├── data_merger.ipynb                   ✅ DONE
├── recommender.ipynb                   ✅ DONE
├── summary.md
├── README.md
├── input/
│   ├── steam-200k.csv                  ✅ headers fixed
│   ├── games_in_detail_version.csv     ⚠️ DO NOT USE (column misalignment bug)
│   ├── games_in_detail_version.json
│   └── games_in_detail_version_clean.csv  ✅ USE THIS
├── output/
│   ├── steam_merged.csv                ✅ DONE (produced by data_merger.ipynb)
│   ├── recommendations.json            ✅ DONE (produced by recommender.ipynb)
│   ├── games_metadata.json             ✅ DONE (produced by recommender.ipynb)
│   └── play_history.json               ✅ DONE (produced by recommender.ipynb)
└── docs/                               ✅ DONE — live on GitHub Pages
    └── index.html
```

---

## Tech Stack
```
pandas + numpy          → data processing
scipy                   → sparse matrix
sklearn                 → item-item Pearson similarity (cosine_similarity on centered vectors)
tqdm                    → progress bars during recommendation generation
```

Install:
```bash
pip install pandas numpy scipy scikit-learn tqdm
```

---

## What's Done

### ✅ Step 1 — data_merger.ipynb

Merges `steam-200k.csv` (play/rating data) with `games_in_detail_version_clean.csv`
(game metadata) into `output/steam_merged.csv`.

**Key decisions made:**

**Rating scale:** Hours played → 1–5 rating
| Hours | Rating |
|-------|--------|
| 0–<1  | 1      |
| 1–<5  | 2      |
| 5–<20 | 3      |
| 20–<100 | 4    |
| 100+  | 5      |

**Sparse user filter:** Users with fewer than 3 games played are dropped.

**Name matching pipeline (3 stages):**
1. **Normalise** — lowercase, strip `®™©:`, collapse whitespace
2. **Manual map** — CoD `- Multiplayer` variants mapped to their base game entry
3. **Fuzzy matching** (rapidfuzz, `WRatio`, score cutoff 92) with 4 guards:
   - Number guard — rejects if digit/Roman numeral tokens differ (blocks sequel confusion)
   - Edition guard — rejects if variant words differ (`redux`, `remastered`, `hd`, `vietnam`, `zombies` etc.)
   - Word-swap guard — rejects if same words in different order (`strike vector` vs `vector strike`)
   - Length-ratio guard — rejects if name lengths differ by more than 33% (blocks garbage matches)

**Deduplication:** Games metadata deduplicated by `title_norm`, keeping the entry
with the highest `total_reviews` when duplicates exist. This prevented row inflation
(without this: 61,280 → 64,523 rows due to duplicate title entries in the games CSV).

**Final output stats:**
| Metric | Value |
|--------|-------|
| Total rows | 61,280 |
| Unique users | 3,466 |
| Unique games | 3,600 |
| Match rate (exact) | 69.0% |
| Match rate (after fuzzy) | 71.4% |
| Columns | 20 |

**Columns in steam_merged.csv:**
`user_id, game, hours_played, rating, app_id, game_title, release_date, price,
description, cover_image_url, positive_reviews, negative_reviews, avg_playtime_mins,
developers, publishers, categories, genres, tags, review_score_pct, total_reviews`

**Known unmatched games (not in metadata CSV under any name):**
- Counter-Strike: Global Offensive (1,102 users)
- Robocraft, Heroes & Generals, GTA V, GTA IV, Tomb Raider, Dead Island,
  Metro 2033, Borderlands, Deus Ex: Human Revolution, and others

These games still receive/generate recommendations — they just won't have cover art
or metadata in the dashboard display.

---

### ✅ Step 2 — recommender.ipynb

**Algorithm: Baseline-Adjusted Item-Item Pearson Correlation CF (v3)**

Earlier versions (v1, v2) used user-user CF. The user-user similarity matrix
(3,270 × 3,270) was too sparse — most user pairs share very few games in common —
and produced RMSE worse than the baseline estimate alone. Item-item CF operates on a
much smaller, denser matrix (791 × 791 popular games) and is more stable because
item similarity averages over many users rather than relying on a handful of neighbours.

| | User-User CF (v1/v2) | Item-Item CF (v3) |
|---|---|---|
| Similarity matrix size | 3,270 × 3,270 users | 791 × 791 popular games |
| Co-rating density | Very sparse | Much denser |
| Stability | Unstable | Stable |
| RMSE result | Worse than baseline | Beats baseline |

**Full algorithm:**
```
1. Filter to ratings >= 3 (genuine interest) and build user-item matrix
2. Compute global mean μ, user biases bᵤ, game biases bᵢ
   Baseline estimate: b(u,i) = μ + bᵤ + bᵢ

3. Build item-user matrix for popular games (rated by >= 5 users)
4. Mean-center each item's ratings (Pearson centering), fill NaN → 0
5. Compute co-rater count matrix; zero out pairs with < 3 shared raters
6. Compute item-item Pearson similarity via cosine_similarity on centered vectors
   → 791 × 791 matrix

7. For each user u and unplayed candidate game i:
   pred(u,i) = b(u,i) + Σ[ sim(i,j) × (r(u,j) − b(u,j)) ]
                         ────────────────────────────────────
                                   Σ[ |sim(i,j)| ]
   where j = games user HAS played, top-K=20 most similar to i

8. Optional popularity dampening (POPULARITY_ALPHA=0.8) to reduce
   repetition of the same popular games across many users' top-10 lists

9. Rank candidates by predicted score → top 10 per user
```

**Config:**
| Parameter | Value |
|---|---|
| `MIN_RATING` | 3 |
| `MIN_GAMES_COMMON` | 3 |
| `TOP_K_ITEMS` | 20 |
| `TOP_N` | 10 |
| `MIN_GAME_RATERS` | 5 |
| `POPULARITY_ALPHA` | 0.8 |
| `TEST_SIZE` | 0.20 |

**Evaluation (train/test split 80/20):**
Three methods compared on held-out ratings:
- Baseline estimate only
- User-user Pearson CF (v2, for reference)
- Item-item Pearson CF (v3, current method)

Item-item CF beats both baseline and user-user on RMSE.

---

### ✅ Step 3 — HTML/JS Dashboard (GitHub Pages)

**Architecture:** fully static — no server, no Python at runtime.
The frontend reads the three pre-computed JSON files directly.

**Features built:**
- **Pick your games** mode — search and select games you've enjoyed; get content-similarity recommendations from the item-item matrix
- **Find by user ID** mode — enter a Steam user ID to see their personalised top-10 recommendations and full play history
- Genre filter pills for browsing the full catalogue
- Paginated browse grid with cover art cards (Load more)
- Game detail modal on click (cover image, description, price, tags, developers, review %, Steam link)
- Play history table with hours bar, rating dots, and thumbnail
- Graceful fallback for unmatched games (placeholder image + no metadata)

---

## Output Files

### `output/recommendations.json` — 5.13 MB
Pre-computed top-10 recommendations for 3,270 users.

```json
{
  "151603712": [
    {
      "n":   "Portal 2",
      "pr":  4.7731,
      "img": "https://shared.akamai.steamstatic.com/...",
      "g":   "Puzzle,Adventure",
      "rv":  97.5,
      "aid": 620
    },
    ...
  ]
}
```

| Key | Field |
|-----|-------|
| `n` | game name |
| `pr` | predicted rating (1–5) |
| `img` | cover image URL |
| `g` | genres |
| `rv` | review score % |
| `aid` | Steam app ID |

Cover image coverage: **69.3%** of recommendation slots (unmatched games have `img: null`).

---

### `output/games_metadata.json` — 1.89 MB
Metadata for 3,564 games. Used by the dashboard's browse grid and game detail modal.

```json
{
  "Portal 2": {
    "aid":   620,
    "img":   "https://shared.akamai.steamstatic.com/...",
    "g":     "Puzzle,Adventure",
    "t":     "Co-op,Puzzle,Singleplayer,...",
    "rv":    97.5,
    "price": 9.99,
    "dev":   "Valve",
    "desc":  "...",
    "rd":    "Apr 19, 2011"
  }
}
```

| Key | Field |
|-----|-------|
| `aid` | Steam app ID |
| `img` | cover image URL |
| `g` | genres |
| `t` | tags |
| `rv` | review score % |
| `price` | price (USD) |
| `dev` | developer(s) |
| `desc` | description snippet |
| `rd` | release date |

---

### `output/play_history.json` — 10.34 MB
Full play history for all 3,466 users. Used by the User ID lookup panel.

```json
{
  "151603712": [
    {
      "game":   "Cities Skylines",
      "hours":  144.0,
      "rating": 5,
      "img":    "https://shared.akamai.steamstatic.com/...",
      "genres": "Simulation,Strategy",
      "app_id": 255710
    },
    ...
  ]
}
```

---

## Deployment

**Hosting:** GitHub Pages (`docs/` folder).
All three JSON output files must be copied into `docs/` alongside `index.html`.

```
docs/
├── index.html
├── games_metadata.json
├── recommendations.json
└── play_history.json
```

`play_history.json` is 10.3 MB — well under GitHub Pages' 100 MB per-file limit.

---

## Environment
- OS: Windows
- Python: 3.13
- Python path: `C:/Users/Tanvir Rahman/AppData/Local/Programs/Python/Python313/`
- Working directory: `E:/Projects/recommender-system/`
- Editor: VS Code with Jupyter notebooks
- Deployment: GitHub Pages (static HTML/JS, no server)