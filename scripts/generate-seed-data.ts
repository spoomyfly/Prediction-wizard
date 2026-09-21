// One-off generator for the static placeholder seed data under public/data/.
//
// IMPORTANT: team lists, ratings and results here are ILLUSTRATIVE
// PLACEHOLDERS, not a live feed. Real UEFA 2026/27 draws and Elo ratings
// were not available to this generator (no live data source configured —
// see README "Ограничения" and docs/strength-params.md for the intended
// real sources: ClubElo, The Odds API, OpenDota, etc). Run with:
//   npm run generate-seed-data

import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { mulberry32, hashSeed } from '../src/engine/rng'
import { sampleFootballScore } from '../src/engine/models/poisson'
import { sampleSeries } from '../src/engine/models/series'
import { buildLeaguePhaseFixtures } from '../src/engine/fixtureGenerator'
import type { Team } from '../src/engine/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataRoot = path.join(__dirname, '..', 'public', 'data')

interface TeamSeed {
  name: string
  country: string
  elo: number
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function ratingsFromElo(elo: number) {
  const strength = (elo - 1700) / 300
  const attack = Math.min(1.7, Math.max(0.55, 1 + strength * 0.35))
  const defense = Math.min(1.5, Math.max(0.55, 1 - strength * 0.3))
  return { attack, defense }
}

function buildTeams(seeds: TeamSeed[], idPrefix: string, rng: () => number): Team[] {
  return seeds.map((seed) => {
    const { attack, defense } = ratingsFromElo(seed.elo)
    return {
      id: `${idPrefix}-${slugify(seed.name)}`,
      name: seed.name,
      country: seed.country,
      elo: seed.elo,
      attack,
      defense,
      clubCoefficient: Math.round(seed.elo / 10) / 10,
      disciplinaryPoints: Math.floor(rng() * 4),
    }
  })
}

function writeJson(dir: string, file: string, data: unknown) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2) + '\n')
}

// --- Football team pools (illustrative composition of well-known clubs) ---

const uclTeams: TeamSeed[] = [
  ['Real Madrid', 'ESP', 2080], ['Manchester City', 'ENG', 2065], ['Bayern Munich', 'GER', 2040],
  ['Paris Saint-Germain', 'FRA', 2020], ['Liverpool', 'ENG', 2010], ['Inter', 'ITA', 1970],
  ['Barcelona', 'ESP', 1985], ['Bayer Leverkusen', 'GER', 1930], ['Atletico Madrid', 'ESP', 1940],
  ['Atalanta', 'ITA', 1890], ['Juventus', 'ITA', 1900], ['Borussia Dortmund', 'GER', 1895],
  ['Benfica', 'POR', 1850], ['Arsenal', 'ENG', 1975], ['Club Brugge', 'BEL', 1780],
  ['Shakhtar Donetsk', 'UKR', 1770], ['Milan', 'ITA', 1885], ['Feyenoord', 'NED', 1810],
  ['Sporting CP', 'POR', 1860], ['PSV Eindhoven', 'NED', 1820], ['Celtic', 'SCO', 1740],
  ['RB Leipzig', 'GER', 1875], ['Young Boys', 'SUI', 1690], ['Stuttgart', 'GER', 1820],
  ['Sparta Prague', 'CZE', 1710], ['Salzburg', 'AUT', 1790], ['Dinamo Zagreb', 'CRO', 1720],
  ['Monaco', 'FRA', 1830], ['Aston Villa', 'ENG', 1850], ['Bologna', 'ITA', 1750],
  ['Girona', 'ESP', 1770], ['Slovan Bratislava', 'SVK', 1650], ['Brest', 'FRA', 1740],
  ['Sturm Graz', 'AUT', 1660], ['Lille', 'FRA', 1790], ['Red Star Belgrade', 'SRB', 1700],
].map(([name, country, elo]) => ({ name: name as string, country: country as string, elo: elo as number }))

const uelTeams: TeamSeed[] = [
  ['Manchester United', 'ENG', 1880], ['Tottenham Hotspur', 'ENG', 1860], ['Roma', 'ITA', 1830],
  ['Lazio', 'ITA', 1810], ['Ajax', 'NED', 1790], ['Real Sociedad', 'ESP', 1780],
  ['Real Betis', 'ESP', 1760], ['Porto', 'POR', 1820], ['Fenerbahce', 'TUR', 1790],
  ['Galatasaray', 'TUR', 1800], ['Besiktas', 'TUR', 1720], ['Rangers', 'SCO', 1710],
  ['Olympiacos', 'GRE', 1740], ['PAOK', 'GRE', 1700], ['Ferencvaros', 'HUN', 1650],
  ['Malmo', 'SWE', 1610], ['Union Saint-Gilloise', 'BEL', 1720], ['Anderlecht', 'BEL', 1690],
  ['Nice', 'FRA', 1750], ['Lyon', 'FRA', 1780], ['Viktoria Plzen', 'CZE', 1670],
  ['Slavia Prague', 'CZE', 1730], ['FCSB', 'ROU', 1640], ['Qarabag', 'AZE', 1660],
  ['Maccabi Tel Aviv', 'ISR', 1650], ['Hoffenheim', 'GER', 1740], ['Braga', 'POR', 1750],
  ['Vitoria Guimaraes', 'POR', 1690], ['Twente', 'NED', 1700], ['AZ Alkmaar', 'NED', 1720],
  ['Elfsborg', 'SWE', 1580], ['Midtjylland', 'DEN', 1700], ['Bodo/Glimt', 'NOR', 1710],
  ['Heidenheim', 'GER', 1650], ['Rigas FS', 'LAT', 1500], ['Cercle Brugge', 'BEL', 1620],
].map(([name, country, elo]) => ({ name: name as string, country: country as string, elo: elo as number }))

const ueclTeams: TeamSeed[] = [
  ['Chelsea', 'ENG', 1830], ['Fiorentina', 'ITA', 1770], ['Real Sociedad B', 'ESP', 1560],
  ['Rapid Vienna', 'AUT', 1680], ['Legia Warsaw', 'POL', 1640], ['Jagiellonia', 'POL', 1590],
  ['APOEL', 'CYP', 1560], ['Molde', 'NOR', 1650], ['Vikingur Reykjavik', 'ISL', 1480],
  ['Djurgardens', 'SWE', 1600], ['Cukaricki', 'SRB', 1520], ['Pafos', 'CYP', 1540],
  ['Zrinjski Mostar', 'BIH', 1500], ['Lugano', 'SUI', 1570], ['Astana', 'KAZ', 1520],
  ['The New Saints', 'WAL', 1380], ['Shamrock Rovers', 'IRL', 1500], ['Larne', 'NIR', 1420],
  ['Noah', 'ARM', 1470], ['Petrocub', 'MDA', 1440], ['Backa Topola', 'SRB', 1500],
  ['Omonia', 'CYP', 1550], ['Santa Clara', 'POR', 1560], ['Gent', 'BEL', 1690],
  ['Utrecht', 'NED', 1610], ['Heerenveen', 'NED', 1560], ['Hacken', 'SWE', 1580],
  ['Silkeborg', 'DEN', 1560], ['Jablonec', 'CZE', 1520], ['Ruzomberok', 'SVK', 1470],
  ['Zilina', 'SVK', 1500], ['Vitesse', 'NED', 1540], ['Lech Poznan', 'POL', 1650],
  ['Aris Limassol', 'CYP', 1530], ['Panathinaikos', 'GRE', 1690], ['AEK Larnaca', 'CYP', 1550],
].map(([name, country, elo]) => ({ name: name as string, country: country as string, elo: elo as number }))

const tiTeams: TeamSeed[] = [
  ['Team Spirit', 'RUS', 1950], ['Team Falcons', 'KSA', 1930], ['Gaimin Gladiators', 'GBR', 1870],
  ['Xtreme Gaming', 'CHN', 1900], ['Tundra Esports', 'GBR', 1880], ['BetBoom Team', 'RUS', 1830],
  ['Team Liquid', 'NED', 1840], ['PSG.LGD', 'CHN', 1860], ['Shopify Rebellion', 'USA', 1780],
  ['Azure Ray', 'CHN', 1770], ['Nigma Galaxy', 'UAE', 1760], ['9Pandas', 'EUR', 1720],
  ['Talon Esports', 'THA', 1700], ['Beastcoast', 'PER', 1710], ['HEROIC', 'EUR', 1690],
  ['OG', 'EUR', 1750], ['Aurora Gaming', 'EEU', 1800], ['Wildcard Gaming', 'SEA', 1650],
].map(([name, country, elo]) => ({ name: name as string, country: country as string, elo: elo as number }))

// --- Build & write each competition's data ---

function generateFootballCompetition(opts: {
  id: string
  idPrefix: string
  seeds: TeamSeed[]
  matchesPerTeam: number
  playedMatchdays: number
  avgGoals: number
  homeAdv: number
}) {
  const rng = mulberry32(hashSeed(`${opts.id}-teams`))
  const teams = buildTeams(opts.seeds, opts.idPrefix, rng)
  const fixtures = buildLeaguePhaseFixtures(teams.map((t) => t.id), opts.matchesPerTeam, opts.idPrefix)
  const teamById = new Map(teams.map((t) => [t.id, t]))

  const resultRng = mulberry32(hashSeed(`${opts.id}-results`))
  const results = fixtures
    .filter((f) => f.matchday <= opts.playedMatchdays)
    .map((f) => {
      const home = teamById.get(f.homeTeamId)!
      const away = teamById.get(f.awayTeamId)!
      const { homeGoals, awayGoals } = sampleFootballScore(resultRng, home, away, {
        avgGoals: opts.avgGoals,
        homeAdv: opts.homeAdv,
      })
      return { fixtureId: f.id, homeGoals, awayGoals }
    })

  const dir = path.join(dataRoot, opts.id)
  writeJson(
    dir,
    'teams.json',
    teams.map(({ id, name, country, clubCoefficient, disciplinaryPoints }) => ({
      id,
      name,
      country,
      clubCoefficient,
      disciplinaryPoints,
    })),
  )
  writeJson(
    dir,
    'ratings.json',
    {
      asOf: '2026-09-21',
      source: 'placeholder',
      note: 'Иллюстративные рейтинги-заглушки, не живой фид ClubElo/The Odds API — см. docs/strength-params.md.',
      teams: teams.map(({ id, elo, attack, defense }) => ({ id, elo, attack, defense })),
    },
  )
  writeJson(dir, 'fixtures.json', fixtures)
  writeJson(dir, 'results.json', results)

  console.log(`${opts.id}: ${teams.length} teams, ${fixtures.length} fixtures, ${results.length} played`)
}

generateFootballCompetition({
  id: 'ucl-2026-27',
  idPrefix: 'ucl',
  seeds: uclTeams,
  matchesPerTeam: 8,
  playedMatchdays: 2,
  avgGoals: 1.4,
  homeAdv: 1.15,
})

generateFootballCompetition({
  id: 'uel-2026-27',
  idPrefix: 'uel',
  seeds: uelTeams,
  matchesPerTeam: 8,
  playedMatchdays: 2,
  avgGoals: 1.45,
  homeAdv: 1.15,
})

generateFootballCompetition({
  id: 'uecl-2026-27',
  idPrefix: 'uecl',
  seeds: ueclTeams,
  matchesPerTeam: 6,
  playedMatchdays: 1,
  avgGoals: 1.5,
  homeAdv: 1.15,
})

// --- The International 2026 (demo only — Swiss/double-elim not simulated yet) ---

function generateTi() {
  const rng = mulberry32(hashSeed('ti-2026-teams'))
  const teams = buildTeams(tiTeams, 'ti', rng)
  const teamById = new Map(teams.map((t) => [t.id, t]))

  // Demo Swiss round 1: pair teams by seed order (1v10, 2v11, ...), Bo1.
  const half = teams.length / 2
  const fixtures = Array.from({ length: half }, (_, i) => ({
    id: `ti-r1-${i}`,
    matchday: 1,
    homeTeamId: teams[i].id,
    awayTeamId: teams[i + half].id,
  }))

  // Reveal results for the first half of round 1 only, hide the rest — a
  // "partially hidden results" demo as suggested for a finished/ongoing event.
  const resultRng = mulberry32(hashSeed('ti-2026-results'))
  const results = fixtures.slice(0, Math.ceil(fixtures.length / 2)).map((f) => {
    const home = teamById.get(f.homeTeamId)!
    const away = teamById.get(f.awayTeamId)!
    const { homeMapWins, awayMapWins } = sampleSeries(resultRng, home, away, 1)
    return { fixtureId: f.id, homeMapWins, awayMapWins }
  })

  const dir = path.join(dataRoot, 'ti-2026')
  writeJson(
    dir,
    'teams.json',
    teams.map(({ id, name, country }) => ({ id, name, country })),
  )
  writeJson(dir, 'ratings.json', {
    asOf: '2026-09-21',
    source: 'placeholder',
    note: 'Иллюстративные рейтинги Эло-заглушки, не живой фид OpenDota/STRATZ — см. docs/strength-params.md.',
    teams: teams.map(({ id, elo }) => ({ id, elo })),
  })
  writeJson(dir, 'fixtures.json', fixtures)
  writeJson(dir, 'results.json', results)

  console.log(`ti-2026: ${teams.length} teams, ${fixtures.length} demo fixtures, ${results.length} revealed`)
}

generateTi()
