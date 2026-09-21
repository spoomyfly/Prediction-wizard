import type { CompetitionConfig, Fixture, MatchResult, Team } from '../types'
import type { RandomFn } from '../rng'

/**
 * TODO: Double-elimination bracket format (TI playoffs, upper/lower bracket).
 *
 * Planned behaviour once implemented:
 * - Take the seeding produced by swiss.ts as the bracket's starting order.
 * - Simulate each series with `models/series.ts` (sampleSeries), respecting
 *   the per-round best-of length from the config (Bo3 upper/lower rounds,
 *   Bo5 grand final are typical for TI).
 * - Losers drop from upper bracket to lower bracket per standard
 *   double-elimination routing; track final placement, not just the winner,
 *   since the simulator reports a probability distribution over places.
 *
 * Left unimplemented for now, see swiss.ts for the corresponding note.
 */
export function simulateDoubleElimOnce(
  _teams: Team[],
  _fixtures: Fixture[],
  _playedResults: MatchResult[],
  _config: CompetitionConfig,
  _rng: RandomFn,
): string[] {
  throw new Error('Double-elimination format simulation is not implemented yet (see TODO in doubleElim.ts)')
}
