// Daily data-refresh entry point, run by .github/workflows/update-data.yml.
//
// STATUS: structural stub. The actual HTTP calls to external sources are
// NOT implemented — this build has no API keys/access configured. What's
// here is the intended pipeline shape (fetch -> normalize -> diff -> write),
// so wiring up a real source later is a matter of filling in fetchXxx()
// below, not restructuring the workflow.
//
// Real sources to wire up (see docs/strength-params.md for details/caveats):
//   - Football ratings:  ClubElo (http://api.clubelo.com/YYYY-MM-DD), The Odds API
//   - Football fixtures: football-data.org, API-Football, openfootball
//   - Dota 2 ratings:     OpenDota API (/teams), STRATZ API (GraphQL)
//   - Dota 2 results:     OpenDota API (/proMatches), Liquipedia
//
// API keys must only ever live in GitHub Secrets (passed as env vars to this
// script by the workflow) — never commit them, never send them to the
// frontend bundle.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataRoot = path.join(__dirname, '..', 'public', 'data')

interface UpdateTarget {
  competitionId: string
  // TODO: fetchRatings(competitionId) -> RatingsFile, once a real source is wired up.
}

const targets: UpdateTarget[] = [
  { competitionId: 'ucl-2026-27' },
  { competitionId: 'uel-2026-27' },
  { competitionId: 'uecl-2026-27' },
  { competitionId: 'ti-2026' },
]

function readCurrent(competitionId: string, file: string): string {
  return readFileSync(path.join(dataRoot, competitionId, file), 'utf-8')
}

async function updateOne(target: UpdateTarget): Promise<boolean> {
  // TODO: replace with a real fetch + normalize step, e.g.:
  //   const ratings = await fetchClubEloRatings(target.competitionId)
  //   const next = JSON.stringify(ratings, null, 2) + '\n'
  const current = readCurrent(target.competitionId, 'ratings.json')
  const next = current // no-op until a real source is implemented

  if (next === current) return false
  writeFileSync(path.join(dataRoot, target.competitionId, 'ratings.json'), next)
  return true
}

async function main() {
  // The workflow decides whether to commit by running `git status` after
  // this script exits, so all this needs to do is write whatever changed.
  for (const target of targets) {
    const changed = await updateOne(target)
    console.log(`${target.competitionId}: ${changed ? 'updated' : 'no change'}`)
  }
}

main()
