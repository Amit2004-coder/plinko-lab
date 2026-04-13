# 🎰 Plinko Lab — Provably Fair

Interactive Plinko game with cryptographic commit-reveal fairness, canvas animation, Web Audio sounds, and a public verifier page.

Built for the **Daphnis Labs Full-Stack Developer Intern** take-home assignment.

---

## Quick Start

```bash
git clone <repo>
cd plinko-lab
npm install

# .env.local
echo 'DATABASE_URL="file:dev.db"' > .env.local

npm run dev          # → http://localhost:3000
npm test             # 29 tests, all passing
npm run build        # production build (0 errors, 0 warnings)
npm run start        # serve production build
```

---

## Architecture

```
lib/crypto.ts   SHA-256 wrappers for commit + combinedSeed
lib/prng.ts     xorshift32 PRNG, seeded from first 4 bytes of hex digest
lib/engine.ts   Peg map generation + deterministic drop simulation
lib/db.ts       SQLite via @libsql/client (no binary engine needed)

app/page.tsx               Main game (3-step API flow + canvas board)
app/verify/page.tsx        Public verifier form
app/api/rounds/commit      POST – create round, return commitHex
app/api/rounds/[id]/start  POST – run engine, store result (no seed revealed)
app/api/rounds/[id]/reveal POST – expose serverSeed after animation
app/api/rounds/[id]        GET  – full round data
app/api/verify             GET  – stateless recompute for verifier
app/api/rounds             GET  – recent rounds log

components/PlinkoBoard.tsx  Canvas animation (60fps arc interpolation)
components/useSounds.ts     Web Audio API peg ticks + landing SFX
components/Confetti.tsx     CSS particle celebrations
components/RoundLog.tsx     Live session round history
```

---

## Fairness Specification

### Hash: SHA-256 (Node.js crypto)
```
commitHex    = SHA256(serverSeed + ":" + nonce)
combinedSeed = SHA256(serverSeed + ":" + clientSeed + ":" + nonce)
```

### PRNG: xorshift32
Seed = first 4 bytes of combinedSeed, big-endian uint32:
```
state ^= state << 13
state ^= state >>> 17
state ^= state << 5
rand() = (state >>> 0) / 0x100000000  // → [0, 1)
```

### Peg Map (12 rows)
Row r has r+1 pegs:
```
raw      = 0.5 + (rand() - 0.5) * 0.2
leftBias = round(raw × 1,000,000) / 1,000,000   // 6 dp, stable hash
```

### Drop
```
adj = (dropColumn - 6) × 0.01
for r in 0..11:
  bias′ = clamp(pegMap[r][min(pos,r)].leftBias + adj, 0, 1)
  if rand() < bias′ → Left else → Right, pos++
binIndex = pos
```

Same PRNG stream for both peg map and drop — verifier reproduces exactly.

---

## Test Vectors (all verified in npm test)

| | |
|---|---|
| commitHex | `bb9acdc67f3f18f3345236a01f0e5072596657a9005c7d8a22cff061451a6b34` |
| combinedSeed | `e1dddf77de27d395ea2be2ed49aa2a59bd6bf12ee8d350c16c008abd406c07e0` |
| rand()[0..4] | `0.1106166649, 0.7625129214, 0.0439292176, 0.4578678815, 0.3438999297` |
| Row 0 bias | `[0.422123]` |
| binIndex (col 6) | `6` |

---

## Easter Eggs
- `T` — TILT mode (arcade rotation + sepia filter)
- `G` — Debug grid (peg leftBias overlay)
- 3× center bins → Golden Ball trail
- Type `open sesame` → Dungeon/torchlight theme

---

## AI Usage

Claude (Anthropic) assisted with architecture, all lib/* files, API routes, canvas animation, and test scaffolding. I verified all PRNG values manually, tuned canvas arc math, fixed stale-closure keyboard bug, replaced Prisma with libsql (no binary deps), and added the integration test suite. Prompts included: "implement xorshift32 matching these test vectors", "Next.js canvas component animating a ball through a triangular peg grid", "Jest tests for every spec vector".

---

## Time Log

Spec + architecture 30m · Crypto+PRNG 40m · Test vectors 20m · Engine 30m · DB layer 30m · API routes 40m · Canvas board 90m · Game page 60m · Verifier page 30m · Sounds+FX+easter eggs 35m · Tests 35m · Build fixes 20m · README 25m = **~8h total**

---

## What I'd Do Next

Fixed-timestep Matter.js physics · WebSocket live round feed · Downloadable audit CSV · Postgres for production · Playwright E2E tests · Rate limiting · Animated bias reveal post-serverSeed · Mobile haptics
