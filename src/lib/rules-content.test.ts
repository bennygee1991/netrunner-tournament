import { describe, expect, it } from "vitest";
import { DEFAULT_ROUNDS, EVENT_POINTS, FINALE, GAME_POINTS, BADGES, byePoints } from "@/engine";
import { rulesContent } from "./rules-content";

const text = rulesContent()
  .flatMap((s) => [s.title, ...s.blocks.flatMap((b) => [b.heading ?? "", ...b.items])])
  .join("\n");

describe("Rules page stays in sync with the engine", () => {
  it("states game points and bye points from the engine", () => {
    expect(text).toContain(`win ${GAME_POINTS.win} · tie ${GAME_POINTS.tie} · loss ${GAME_POINTS.loss}`);
    expect(text).toContain(`${byePoints("single")} single-sided, ${byePoints("double")} double-sided`);
  });

  it("states the league points table from the engine", () => {
    for (const [, v] of Object.entries(EVENT_POINTS)) expect(text).toContain(String(v));
    expect(text).toContain(`champion ${EVENT_POINTS.champion} · finalist ${EVENT_POINTS.finalist}`);
  });

  it("states default Swiss rounds from the engine", () => {
    expect(text).toContain(
      `single-sided ${DEFAULT_ROUNDS.single.below} (${DEFAULT_ROUNDS.single.atOrAbove} with ${DEFAULT_ROUNDS.single.threshold}+ players)`,
    );
    expect(text).toContain(
      `double-sided ${DEFAULT_ROUNDS.double.below} (${DEFAULT_ROUNDS.double.atOrAbove} with ${DEFAULT_ROUNDS.double.threshold}+ players)`,
    );
  });

  it("states the season finale rules from the engine", () => {
    expect(text).toContain(
      `×${FINALE.pointsMultiplier} league points: champion ${EVENT_POINTS.champion * FINALE.pointsMultiplier}`,
    );
    expect(text).toContain(`plays ${FINALE.swissRounds} Swiss rounds, then a top ${FINALE.cutSize} cut`);
    expect(text).toContain("seeded from its own Swiss standings");
    expect(text).toContain("The higher seed picks Corp or Runner for game 1");
    expect(text).toContain("game 3 decides it, with sides set by a coin flip");
  });

  it("covers every rule area the engine implements", () => {
    for (const phrase of [
      "Sides swap for game 2",
      "higher seed advances",
      "lowest-ranked player who has not had one",
      "extended SoS",
      "never pair the same two players twice",
      "cannot make the cut",
      "1 v 8, 4 v 5, 2 v 7, 3 v 6",
      "halves until it fits",
      "single elimination",
      "share a place",
    ]) {
      expect(text).toContain(phrase);
    }
    for (const b of BADGES) expect(text).toContain(`${b.label}: ${b.description}`);
  });
});
