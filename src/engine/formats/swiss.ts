import type { CompetitionConfig, Fixture, MatchResult, Team } from '../types'
import type { RandomFn } from '../rng'

/**
 * TODO: Swiss-system format (used by e.g. The International's group stage).
 *
 * Planned behaviour once implemented:
 * - Pair teams each round by current score bucket, avoiding rematches
 *   where the ruleset forbids them.
 * - Each round's matches are Bo1/Bo2/Bo3 series simulated via
 *   `models/series.ts` (sampleSeries), noise-adjusted per run via
 *   `noise.ts` the same way leaguePhase.ts does.
 * - Stop once every team reaches the win/loss threshold that decides
 *   advancement/elimination, and return final standings/seeding for the
 *   playoff bracket (see doubleElim.ts).
 *
 * Left unimplemented for now: the TI competition config only exposes
 * team ratings for the read-only "Сила команд" page; the results page
 * shows a "формат в разработке" placeholder until this lands.
 */
export function simulateSwissOnce(
  _teams: Team[],
  _fixtures: Fixture[],
  _playedResults: MatchResult[],
  _config: CompetitionConfig,
  _rng: RandomFn,
): string[] {
  throw new Error('Swiss format simulation is not implemented yet (see TODO in swiss.ts)')
}
