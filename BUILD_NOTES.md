# BUILD NOTES — GTA 6 r19 "Kota Seja — Golden Hour Pursuit"

Built from zero in this session (recording 01a1fdc1-ecbc-773f-a095-dfc8d4af0f6b).
Every line of code was written by the agent in this session; no file was
copied from repo5/repo6/repo, repo2-4 or Halcyon. Only LICENSE and
vendor/makefun-game.ts pre-date the recording (starter kit, unmodified).

## What was built

- Hand-written software 3D renderer (`game/src/renderer3d.js`): perspective
  projection (camera pos + yaw/pitch + focal), painter's algorithm far→near,
  flat shading vs a low dusk sun. Pure canvas 2D, no WebGL, no libraries.
- Deterministic island city (`game/src/city.js`, seed 20261121): ~40 low-poly
  buildings with lit windows and rooftop boxes, beach boulevard, sea, sand,
  palms, traffic, pedestrians, 3D cars (body + cabin + wheels + lights),
  3D heli (body + tail + spinning rotor + searchlight cone), 3D people.
- Dense HUD (`game/src/hud.js`): mission panel, KSPD dispatch list, 3 wanted
  stars, money $48,250, clock, rank + RP bar, 5 weapon slots (3 LOCKED),
  3 crew abilities, circular minimap, health/armor, dialog box, speedometer,
  radio line.
- 4 frozen deterministic shots (`game/src/shots.js`): 1 chase + heli,
  2 on-foot crew meet, 3 full island map + career + garage, 4 title screen.
- Playable game (`game/src/main.js`): WASD drive/walk, mouse-drag look,
  E enter/steal car, SPACE handbrake, Q/E/R abilities, M map, ESC pause,
  wanted heat, localStorage save, `window.__sejaReady`.
- `main.ts`: packages game/ + screenshots/ + dossier.json (buildDossier);
  with `--capture` it screenshots via headless Chrome over CDP (minimal
  pure-Node WebSocket client, stdlib only), fails on any console/page error,
  enforces the 262,144 B per-shot cap, and throws unless screenshots/
  holds 3–4 images. `serve.ts`: static server for game/ (port 8130).

## Screenshots (1280x720 JPEG q80, all ≤ 262,144 B)

- shot-1-chase.jpg — 94,508 B — sha256 ddeb188fdc98dfe66c53855ff8ab57fed1a717ffdb41542138cd7262d0f1b242
- shot-2-on-foot.jpg — 104,065 B — sha256 4f935cc648164e6469986028f9792bf5b3e24f5b6b333697e3d897d193f10689
- shot-3-map.jpg — 84,743 B — sha256 c91488e2cf5ed1c046456c6843ceb412ee445e199843b7371e317a167548c617
- shot-4-title.jpg — 87,405 B — sha256 7e606de4d6a485191932cff8b229d3675a5026cd2b568f9eaf0154a1569df5ca

## Verification (all run, results below)

1. `MAKEFUN_OUTPUT_DIR=/tmp/gta-r19-verify node main.ts` — exit 0;
   dossier.json 541,989 B, sha256 c6fb28eb32efaa66c52a2f325beb44bd817f59a97b53a65a655d7958d78d031c;
   screenshots/ holds exactly 4 JPG; game/ packaged (8 files).
   A second no-capture run into /tmp/gta-r19-verify2 gave the identical
   dossier hash c6fb28eb…
2. Kit check: `node cli/makefun.mjs check --kit <kit> --repo repo7 --worktree`
   — exit 0, "4 passed, 0 failed, 17 skipped, 5 checked at submission".
   Passed here: competition_open, snapshot, license_osi, entrypoint.
   The 12 transcript-gate checks (thinking_reproduces,
   transcripts_witnessed, thinking_revised, thinking_turns, etc.) are
   SKIPPED locally by design — the kit says the site runs them on the
   sealed recordings at submission. They were NOT verified locally and
   must not be claimed as passed until the site runs them.
   The 5 "at submission" items (repo_public, repo_owner,
   repo_created_after_open, commit_in_repo, duplicate_snapshot) are the
   coordinator's job at push/submit time.
   Note: kit copy is level 30, site is at level 33 (kit suggests
   re-downloading; not done here — task forbids downloading the kit).
3. Determinism: two consecutive `--capture` runs (detA, detB) produced
   byte-identical screenshots (all 4 sha256 match, diff empty).
4. No stale files: repo7 holds only LICENSE + vendor/makefun-game.ts from
   before the recording; every other file was written in this session.
   `prompt-r19.txt` is UNTRACKED and intentionally NOT committed.
5. Interactive smoke test: served game/, loaded index.html (no ?shot) in
   headless Chrome — canvas present, no console errors.

## Anomaly (reported honestly, not hidden)

- One capture run mid-build produced dossier.json 554,349 B
  (sha256 0c32c7bf…) while the runs before and after it produced
  543,499 B and then 541,989 B. No source file changed between the
  554,349 B run and the later runs. The four consecutive runs since
  (detA, detB, verify, verify2) all produce the identical dossier
  (541,989 B, c6fb28eb…), so the current state is deterministic, but the
  single outlier is unexplained. The coordinator's kit check / server
  grade runs main.ts twice and compares bytes — that is the real gate.

## Honest visual assessment vs top 1–10

- Shot 1 and 2 are genuinely 3D now: perspective street, occluding
  buildings, shaded faces, lit windows, heli + spotlight, cars with
  depth, sea and dusk sky. A clear step up from r14's flat 2D.
- Still short of the top entries in: building detail (flat colours, big
  window quads, no textures), car detail (blocky, no reflections), no
  visible beach crowd / storefront signage, and the HUD panels cover a
  large share of the frame. The player car in shot 1 is small; the
  chase reads, but it is not a cinematic close chase-cam like the top 1–7.
- Estimated: competitive for the paid zone (top 100) if the gate passes;
  top 10 is unlikely on visuals alone.

## For the coordinator (do NOT skip)

- CHECK QUOTA BEFORE SUBMITTING. 1 slot left today (reset 07:00 WIB
  22 Nov). Verify can_submit / quota first, then push + submit.
- Do NOT push or submit from this session — coordinator's job.
- Do NOT commit prompt-r19.txt (untracked, used with --prompt-file).
