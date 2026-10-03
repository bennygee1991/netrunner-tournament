# Organizer guide

How to run a season on Netrunner Circuit, from setup to prizes. Everything works on a phone.
The **Admin** link appears in the menu when you're logged in as an organizer.

## The shape of a season

- **4 events, one every 2 weeks.** Events 1-2 feed the **Month 1** leaderboard and events 3-4 feed **Month 2**. All four feed the **Season** leaderboard.
- **League points per event:** champion 10 · finalist 7 · top 4 5 · top 8 3 · everyone else who entered 1. Events without a cut use the final Swiss rank with the same table.
- **End of season:** you hand out prizes, archive the season to **Past seasons**, and start the next one. Accounts, trophies and player histories are kept.

The full player-facing rules are on the site's **Rules** page and always match what the site does.

## 1. Start a season

1. Go to **Admin → Season → Start a season**.
2. Enter a name and the date of the first event, then click **Create season**. This creates four events, two weeks apart.
3. Fill in the **Prizes** for Month 1, Month 2 and the Season, then click **Save prizes**. Players see them on the leaderboards.

## 2. Set up each event

Open the event from **Admin → Season**. Under **Event setup** you can set:
- **Name, date, leaderboard month.** You can change these at any time.
- **Match format:**
  - **Single-sided:** 1 game per round, about 40-45 minutes. The site picks who plays Corp so each player's sides stay even.
  - **Double-sided:** 2 games per round, about 65-70 minutes. A coin flip decides game 1's sides, then they swap.
- **Swiss rounds:** leave empty for the recommended number (it depends on how many players turn up), or set 1-9.
- **Top cut:** none, top 4 or top 8. If fewer players turn up, the cut shrinks to fit. Top 8 is single elimination, a house rule; official NSG top 8s are double elimination.

Format, rounds and cut lock once the event starts.

## 3. Sign-ups

- Players sign up on the home page, after creating an account with their runner name.
- On the event's admin page, **Pending sign-ups** lists them. Use **Approve**, **Reject** or **Approve all**.
- **Add player** adds people on the day:
  - Type an existing runner name to add that account.
  - Type any other name to add a **walk-in guest**.
- The ✕ next to an entrant removes them, before the event starts only.
- A walk-in who registers later can keep their results: go to **Admin → Players**, open their new account, and under **Link walk-in results** type the walk-in name exactly as you entered it.

## 4. Run the event

The **Next step** card always shows the one button you need.

1. **Start Swiss.** Round 1 is paired at random. With an odd number of players, one gets a bye, worth a win.
2. **Enter results** by tapping the winner, or **Tie**. Tap the same button again to clear a mistake. Each player's side (Corp or Runner) is shown under their name. Double-sided rounds have two rows (game 1 and game 2).
3. When every result is in, tap **Pair round 2**, and so on. Players who have the same score meet; the same two players never meet twice unless there's no other way.
4. After the last Swiss round, tap **Start top 4/8 cut**, or **Finish event** if there's no cut.
5. In the cut, tap each winner. The next round is paired automatically and the final finishes the event. A tied cut game advances the higher seed.

Players can follow along on the public event page, which refreshes itself every 20 seconds.

## 5. Fixing mistakes

All of these are on the event's admin page and recorded in **Admin → Audit**.

| Situation | What to do |
| --- | --- |
| Wrong result in the current round | Tap the right player (or tap the wrong one again to clear it). |
| Wrong result in an earlier round | Swiss card → **Repair an earlier round's results**. Fix it; standings update and pairings stay. |
| Someone arrives late | **Add player**. They join the next round with zero points. To include them in the current round, use **Restart round**. |
| Someone leaves | ✕ next to their name (**Drop**). They stay in the standings but are not paired again and can't make the cut. ↩ undoes it. |
| Pairings need redoing | **Fix mistakes → Restart round** (tap twice). The round is paired again; any results already entered in it are discarded. |
| A round was paired too early | **Fix mistakes → Undo round** (tap twice). |
| A finished event needs changes | **Fix mistakes → Reopen event**. Its league points are removed until you finish it again. |
| Start an event over | **Fix mistakes → Reset event**: type the event name to confirm. Entrants are kept. |

## 6. Players and passwords

On **Admin → Players** you can:
- **Issue a temporary password** to a player who forgot theirs. It's shown once; read it to them, and they choose a new one when they log in.
- **Rename** a player (to fix typos).
- **Disable** an account (they can't log in) or **enable** it again.
- **Delete** an account: type their runner name to confirm. Their past results stay under the name "Deleted player XXXX".

## 7. End of season

1. Finish the last event.
2. Hand out the prizes shown on the leaderboards.
3. **Admin → Dashboard → Download backup.**
4. Go to **Admin → Season → End of season**, type the season name, and click **Archive season & reset**. This:
   - saves the three leaderboards to **Leaderboards → Past**;
   - awards the season champion, runner-up and 3rd place trophies;
   - clears the events, ready for the next season.
5. Start the next season (step 1).

**Reset everything** (on the same page) wipes all seasons, results, past seasons and trophies. Use
it only to start completely fresh, for example after testing. You have to type `RESET`. Tick the
box if you also want to delete all player accounts; admin accounts are always kept.

## Trophies players can earn

- 🏆 Season champion, 🥈 runner-up, 🥉 3rd place: from the Season board when you archive the season.
- ⭐ Event champion: whenever an event finishes.
- 🔌 Jacked in: played a first league event.
- 🎖️ Veteran: played 10 league events.
- 🛡️ Flawless Swiss: finished an event's Swiss rounds without losing a game.
