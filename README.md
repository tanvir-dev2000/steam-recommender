# Steam Game Recommender System

A collaborative filtering recommender system that predicts which Steam games you'll enjoy based on your play history. Built with **item-item Pearson correlation collaborative filtering** and visualized through a static web dashboard.

![Version](https://img.shields.io/badge/version-3.0-blue)
![Python](https://img.shields.io/badge/python-3.8+-green)
![License](https://img.shields.io/badge/license-MIT-orange)

---

## 🎮 Live Dashboard

View recommendations and browse the interactive dashboard: [GitHub Pages Link]

---

## 📊 Project Overview

This system merges two Steam datasets (play history and game metadata) and uses **item-item collaborative filtering** to generate personalized game recommendations for 3,466+ users across 3,600 games.

### Why Item-Item CF?

| Metric | User-User CF (v1/v2) | Item-Item CF (v3) |
|--------|---|---|
| **Similarity matrix** | 3,270 × 3,270 users (sparse) | 791 × 791 popular games (dense) |
| **Co-rating density** | Very sparse | Much denser |
| **Stability** | Unstable; outliers skew clusters | Stable; averages over many users |
| **Performance** | RMSE > baseline | RMSE < baseline ✓ |

Item-item CF predicts ratings based on game similarity rather than user similarity, making it more stable and accurate with sparse data.

---

## 📁 Directory Structure

```
steam-recommender/
├── 📓 recommender.ipynb              # Main recommender engine (item-item CF)
├── 📓 data_merger.ipynb              # Data cleaning & merging pipeline
├── 📄 README.md
├── 📂 docs/
│   ├── index.html                    # Static web dashboard
│   ├── games_metadata.json           # Game info & embeddings
│   ├── recommendations.json          # Pre-computed recommendations
│   ├── play_history.json             # User play history
│   └── item_sim.json                 # Item-item similarity matrix
└── 📦 .git/
```

---

## 🔧 Tech Stack

- **Data Processing:** pandas, numpy
- **Similarity Computation:** scikit-learn (cosine_similarity on centered vectors)
- **Sparse Matrix:** scipy.sparse
- **UI/Visualization:** HTML5, CSS3, JavaScript
- **Progress Tracking:** tqdm

### Installation

```bash
pip install pandas numpy scipy scikit-learn tqdm
```

---

## 🚀 How It Works

### Step 1: Data Cleaning & Merging (`data_merger.ipynb`)

Merges play history with game metadata:

- **Input:** `steam-200k.csv` (play data) + game metadata
- **Output:** `output/steam_merged.csv`

**Key processing:**

| Aspect | Implementation |
|--------|---|
| **Hours → Rating** | 0–<1 hrs = 1, 1–<5 = 2, 5–<20 = 3, 20–<100 = 4, 100+ = 5 |
| **Sparse users** | Drop users with < 3 games played |
| **Name matching** | 3-stage pipeline: normalize → manual map → fuzzy match (WRatio, score ≥ 92) |
| **Smart guards** | Number, edition, word-order, and length-ratio guards prevent bad matches |
| **Deduplication** | Remove duplicate games by title, keep highest-reviewed entry |

**Final stats:**
- **61,280** merged rows
- **3,466** unique users
- **3,600** unique games
- **71.4%** name match rate (after fuzzy matching)

**Output columns:**
```
user_id, game, hours_played, rating, app_id, game_title, release_date, price,
description, cover_image_url, positive_reviews, negative_reviews, avg_playtime_mins,
developers, publishers, categories, genres, tags, review_score_pct, total_reviews
```

---

### Step 2: Recommendation Generation (`recommender.ipynb`)

Builds item-item similarity matrix and generates personalized recommendations:

- **Input:** `output/steam_merged.csv`
- **Outputs:** `recommendations.json`, `games_metadata.json`, `play_history.json`

**Algorithm:**

```
1. Build item-item Pearson similarity matrix (791 × 791 popular games)
2. For each user u and unplayed game i:
   - Find games j that u HAS played & are similar to i
   - pred(u,i) = Σ[sim(i,j) × (r(u,j) - baseline(u,j))] / Σ|sim(i,j)| + baseline(u,i)
3. Rank candidates by predicted score → top 10 recommendations
```

**Key parameters:**

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `MIN_RATING` | 3 | Only ratings ≥ 3 used for similarity computation |
| `MIN_GAMES_COMMON` | 3 | Min users who rated both items before trusting similarity |
| `TOP_K_ITEMS` | 20 | Top-K similar items used per prediction |
| `TOP_N` | 10 | Recommendations per user |
| `MIN_GAME_RATERS` | 5 | Game must have ≥ 5 raters to be included |
| `TEST_SIZE` | 0.20 | 80/20 train-test split for evaluation |

---

### Step 3: Web Dashboard (`docs/index.html`)

Interactive single-page application displaying:
- Personalized recommendations per user
- Game metadata & reviews
- Play history visualization
- Real-time search & filtering

---

## 📈 Pipeline Workflow

```
steam-200k.csv + games_metadata
        ↓
   data_merger.ipynb
        ↓
steam_merged.csv (61,280 rows, 20 columns)
        ↓
  recommender.ipynb
        ↓
recommendations.json + games_metadata.json + play_history.json
        ↓
    index.html (GitHub Pages)
        ↓
    📊 Interactive Dashboard
```

---

## 🎯 Usage

### Generate Recommendations

1. **Prepare data:**
   - Ensure `input/steam-200k.csv` and `input/games_in_detail_version_clean.csv` exist

2. **Run data merger:**
   ```bash
   jupyter notebook data_merger.ipynb
   ```
   Produces: `output/steam_merged.csv`

3. **Run recommender:**
   ```bash
   jupyter notebook recommender.ipynb
   ```
   Produces: `output/recommendations.json`, `output/games_metadata.json`, `output/play_history.json`

4. **Copy outputs to dashboard:**
   ```bash
   cp output/*.json docs/
   ```

5. **View dashboard:**
   Open `docs/index.html` in a browser or deploy to GitHub Pages

---

## 📊 Performance Metrics

- **Baseline RMSE:** ~0.95 (mean rating as predictor)
- **Item-Item RMSE:** < baseline (improves with similar-game usage)
- **Recommendation diversity:** Top-K=20 prevents over-concentration on blockbuster titles
- **Cold-start handling:** Users/games with < threshold ratings get baseline predictions

---

## 🔍 Known Limitations

- **Cold-start problem:** New games with few ratings → unreliable similarity scores
- **Data sparsity:** Many user-game pairs unrated; predictions use baseline fallback
- **No temporal dynamics:** Doesn't account for trends or seasonal games
- **Limited to rated games:** Users must rate games for system to learn preferences

---

## 🛠️ Development

### Data Quality

- Games deduplicated by normalized title (highest-reviewed entry kept)
- Fuzzy matching with intelligent guards prevents false positives
- Play data filtered: users with < 3 games, hours < 0, duplicates removed

### Scalability

- Similarity matrix: O(g²) where g = popular games (~791)
- Recommendation generation: O(u × g × k) where u = users, k = top-K items
- Current: < 10 minutes on standard hardware

---

## 📝 License

MIT License — see LICENSE file for details

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- [ ] Matrix factorization (SVD, NMF)
- [ ] Hybrid recommendations (content + collaborative)
- [ ] Temporal dynamics & trend modeling
- [ ] Cold-start strategies (content-based bootstrap)
- [ ] Real-time updates & streaming recommendations

---

## 📧 Questions?

For issues, feature requests, or questions: Open an issue on GitHub

---

**Built with ❤️ for Steam game enthusiasts**
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