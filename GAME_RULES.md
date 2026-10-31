# Murlan — Proposed Baseline Rules

**Status:** implementation baseline for the first playable prototype. Murlan is played with local variations; confirm the options against the user's usual table before treating this as the definitive house ruleset.

## 1. Players and modes
- Exactly four seats.
- `2v2`: seats 0 and 2 are partners; seats 1 and 3 are partners.
- `Individual`: each seat competes independently.
- The same turn engine and card rules are used in both modes. Only team relationships and scoring differ.

## 2. Deck and dealing
- 54 cards: standard 52-card deck plus a black joker and a red/colored joker.
- Rank order, weakest to strongest: 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2, black joker, red joker.
- Deal all cards to four players: two players receive 14 and two receive 13.
- Dealer/deal rotation should be deterministic and testable.
- First-hand opening rule is configurable. Proposed default: player holding 3♠ opens, and the first combination must include 3♠.

## 3. Legal combinations
The baseline supports:
1. Single: one card.
2. Pair: two cards of equal rank.
3. Triple: three cards of equal rank.
4. Straight/scale (`kolor`): five or more consecutive ranks, suits may differ.
5. Bomb: four cards of equal rank.
6. Flush: a straight/scale of five or more consecutive cards all in the same suit.

Jokers:
- Jokers may be played as singles.
- Jokers cannot be used in straights or flushes.
- Jokers are distinct; red joker ranks above black joker.

## 4. Beating combinations
- Single beats single with a higher-ranked card.
- Pair beats pair with a higher pair rank.
- Triple beats triple with a higher triple rank.
- Straight beats only a straight of the same length with a higher top rank.
- Bomb beats ordinary combinations and can be beaten by a higher bomb.
- Flush beats a bomb and can be beaten only by a higher flush.
- A combination must otherwise match the previous combination's type and card count.
- Never allow a straight to beat a longer or shorter straight merely because its top card is higher.

**Important variant switch:** some published rule descriptions omit flush entirely or say a bomb can only be beaten by a higher bomb. Keep `flushEnabled` and `flushBeatsBomb` as rules configuration options. Proposed default: both `true`.

## 5. Straight edge cases
- Aces can be high or low.
- In a scale, 2 counts as 2 even though it is the strongest standard single: 2-3-4-5-6-7 is legal, and so is 2-3-4-5-6-7-8-9-10-J-Q-K-A.
- Low ace sequence: A-2-3-4-5 and longer A-2-3-… (for example A-2-3-4-5-6-7).
- High ace sequence: 10-J-Q-K-A (Ace is the top card).
- Do not wrap sequences. Q-K-A-2-3 is invalid. A-2-3-…-Q-K-A is invalid (Ace cannot be both ends).
- Jokers cannot complete or substitute into a straight.
- Compare straight strength by its top card under the selected sequence interpretation.
- If a straight has multiple possible interpretations, choose the legal interpretation that gives it the correct lowest/highest comparison according to the explicit sequence; add tests.

## 6. Turn and trick flow
- The opening player leads a legal combination.
- Moving clockwise, each active player may either:
  - play a legal combination that beats the current combination, or
  - pass.
- Passing does not permanently remove a player from the current trick; a player who passed may act again if the trick continues before it closes.
- Once all other active players have passed, the last player who successfully played cards wins the trick and leads a new trick.
- Players who have emptied their hands are finished and are skipped in subsequent turns.
- A hand ends when three players have finished and one player remains with cards.
- The engine must avoid waiting for players who have already finished.
- A player cannot pass when leading an empty trick unless a house-rule option explicitly allows it.

## 7. Finishing order and points
Proposed baseline:
- First to empty their hand: 3 points.
- Second: 2 points.
- Third: 1 point.
- Last remaining: 0 points.
- Default match target: 21 points.
- If two or more players/teams cross the target in the same hand, increase the target by 10 and continue (21 → 31 → 41 → 51). Make this tie policy configurable if needed.

### Individual mode
- Award each player points based on their finishing position.
- Match winner is the first player to reach the target after the hand is scored, subject to the tie rule above.

### 2v2 mode
- Partners sit opposite: seats 0+2 and 1+3.
- Add each partner's earned points to their team's total.
- Team winner is the first team to reach the target, subject to the tie rule above.
- Do not award a separate bonus for the first teammate finishing unless explicitly configured.

## 8. Between-hand card exchange
This is a known variant point and must be configurable.
- Enabled by default (`cardExchangeEnabled = true`). Same policy in 2v2 and individual.
- The first hand of a match has no exchange.
- After the next hand is dealt, last place gives their highest card (jokers included) to first place.
- First place then chooses any other card from their hand to give last place. Bots automatically return their lowest rank 3–10, or their lowest remaining card if they hold none.
- If last place is dealt both jokers, there is no exchange.
- Disable the flag to skip the swap without changing deal or scoring.

## 9. Opening card and first trick
- Proposed default first hand: holder of 3♠ opens and must include 3♠ in the first play.
- Later hands after a completed exchange: last place (who received first place’s chosen card) leads.
- Later hands when last place was dealt both jokers: first place leads and no exchange happens.
- If exchange is disabled, the previous hand’s first finisher leads.
- Do not assume the first card is 3♠ for every hand.

## 10. UX rules
- Never let a player submit an illegal combination.
- Explain why a selected play is invalid (wrong combination, wrong size, not high enough, etc.).
- Display pass status and whose turn it is.
- Show teammates clearly in 2v2 without exposing hidden cards.
- Provide a rules/help screen explaining the active rule configuration.
- Provide an optional "show legal moves" helper for new players.

## 11. Required rule configuration
Create a typed `RulesConfig` object, persisted with each match:
- `flushEnabled: boolean` (default true)
- `flushBeatsBomb: boolean` (default true)
- `aceLowStraightEnabled: boolean` (default true)
- `aceHighStraightEnabled: boolean` (default true)
- `firstLeadMustContainThreeOfSpades: boolean` (default true)
- `cardExchangeEnabled: boolean` (default true)
- `targetScore: number` (default 21)
- `tieTargetIncrement: number` (default 10)
- `pointsByFinishOrder: [3, 2, 1, 0]`
- `allowReentryAfterPass: boolean` (default true)

## 12. Required tests
At minimum test:
- Deck has exactly 54 unique cards.
- Correct rank ordering including both jokers.
- Four hands contain all cards, with sizes 14, 14, 13, 13.
- Singles, pairs, triples, straights, bombs and flush detection.
- Invalid duplicates, invalid sequences, joker restrictions, ace-low and ace-high sequences.
- Same-type/same-size comparison.
- Bomb and flush override rules.
- Passing, re-entry after pass, trick closure, and lead transfer.
- Finished players are skipped.
- Hand ends when one player remains.
- Individual and 2v2 scoring.
- Target score and tie-target increase.
- Deterministic behavior with seeded shuffle.

## 13. Open decisions to confirm before public release
1. Is flush actually used at the user's table? If yes, does it beat bombs?
2. Is card exchange used after each hand? Which player gives to whom, and what card is returned?
3. Is 3♠ the required opening card? Or is it another low card?
4. How are ties handled if multiple players finish on the same play?
5. Does 2v2 have any special team bonus/scoring beyond adding partners' points?
6. Confirmed: 2 counts as 2 in any scale (2-3-4-5-6-7 and 2-…-A). Ace-low A-2-3-… is also legal. Ace cannot wrap both ends.

Do not block prototype development on these questions. Keep uncertain rules configurable and document defaults.
