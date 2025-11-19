# Strategy Program (CLMM Idle Liquidity manager)

This project implements an automated liquidity-management strategy for Solana concentrated-liquidity AMMs. The idea is simple:
**When a user’s Raydium CLMM position goes out of range, the program automatically pulls liquidity out and deploys the tokens somewhere else to earn 
yield (currently Meteora). When the price comes back into range, the liquidity is restored back into Raydium.**

Different DEXes structure their accounts and math differently, so the program is designed in a way where each protocol gets its own implementation path.
For now, the deployed logic supports **Raydium CLMM** only, but the codebase is written with the intention of adding additional protocols (Orca, etc.) separately.

---

## Overview

A user supplies a Raydium position NFT. The program verifies everything (pool state, personal position state, token mints, etc.), takes custody of the position NFT, and begins tracking the user's state in its own account.

When the user creates the position in the program the server would suggest a calculated threshold that would be enforced when the bot wants to add/remove the liquidity in order to allow for optimal additions and removals.

Whenever the position goes out of the user-specified threshold range, the keeper bot would trigger a “decrease liquidity” action and deposits
Whenever the price comes back within the threshold, the keeper would trigger “increase liquidity”.

The movement looks like this:

### Out of range → Decrease liquidity

* Pull liquidity out of Raydium
* Raydium returns only **one token** (since out-of-range positions hold 100% of one side)
* Deposit that token into a Meteora vault
* Update the user’s internal accounting


### Back in range → Increase liquidity

* Withdraw the previously deposited tokens from Meteora
* If price is *still* within threshold but *not yet* inside the actual tick range, we can still add liquidity with one token
* If the price moves quickly within the user’s tick range, raydium(and CLMMs in general) require providing both tokens; if that isn’t possible we do it anyways
  utilizing tokens from the protocol's reserves, this is so the user does not miss any fees that would be generated from their original position in raydium
  so it would be as if it never left and their share of the pool stays the same or increases
* Re-add liquidity to Raydium
* Update the user’s internal accounting

### Closing a position

The user can stop using the strategy at any time.
`user_close_position`:

1. Withdraws liquidity from Meteora (if any was deployed there)
2. Reconstructs the Raydium position by depositing the withdrawn tokens
3. Returns the Raydium NFT to the user
4. Clears internal state

### Keeper incentives

Keepers earn credits for performing increase/decrease actions so the system is expected to be maintained automatically.

---

## Instructions

### Admin Instructions

* **admin_initialize_config** – Initialize global settings (keeper fees, thresholds, etc.)
* **admin_change_config** – Update config
* **admin_whitelist_mint / admin_unwhitelist_mint** – Restrict which token mints can be used
* **admin_withdraw_sol / admin_withdraw_tokens** – Emergency or administrative withdrawals

### User Instructions

* **user_create_position_from_raydium**

  * User provides their Raydium position NFT
  * Program verifies all state is linked (nft mints, vaults, pool state, user position state)
  * Verifies selected thresholds
  * Transfers NFT ownership to the program
  * Stores user state

* **user_close_position**

  * Withdraws tokens from Meteora (if any)
  * Re-adds liquidity into Raydium if needed
  * Returns the NFT back to the user
  * Clears state

### Keeper Instructions

* **keeper_decrease_liquidity_position**

  * Triggered when price leaves the (user/server)-specified threshold
  * Pull liquidity out of Raydium
  * Deposit resulting token into Meteora
  * Update accounting

* **keeper_increase_liquidity_position**

  * Triggered when price returns within the threshold
  * Withdraw from Meteora
  * Attempt to deposit back into Raydium
  * Update accounting

* **keeper_withdraw_rewards**

  * Keepers collect accumulated credits

---

## How Thresholds Work

The user specifies a **threshold range** when creating their strategy account.
This range must fully cover the actual Raydium position’s tick range.
This allows the program to:

* Detect when a position is “about to go out of range”
* Perform clean single-sided deposits/withdraws on Raydium
* Avoid cases where the position is inside Raydium range but the keeper logic is incorrectly triggered

The strategy *only* decreases liquidity when the price leaves the threshold.
The strategy *only* increases liquidity when the price returns inside the threshold.
The exception to ths is when the user pulls it out themselves by closing their position(returning it back to raydium)

Additionally two separate threshold ranges are specified, one for when it would be valid to be pulled out
of the raydium(the out threshold) and one for when the price would be put back in(the in threshold), they could
also be the same, they are kept separate to capture possibly more complex scenarios.
Putting all this together there would be the 7 divisions 1 | 2 | 3 | 4 | 5 | 6 | 7,  

Position 1 and 7 are where the price/tick is completely out of range of the thresholds and the user's range

Position 2 and 6 are the out thresholds where when it gets to it s valid for the keeper pull it out of raydium into meteora

Position 3 and 5 are the in thresholds where when it gets to it s valid for the keeper pull it out of meteora and put it back into raydium
it is also possible for 2-6 to be the same as 3-5

Lastly the position 4 is the user's actual price/tick range from raydium, the bots are expected to perform all action outside of this range
because doing so would allow them to work with only one token which simplifies the process of depositing and withdrawing from/to meteora and raydium
in the case where the bots don't act quickly enough, raydium(and CLMM pools in general) would require some of the other token to be deposited as well,
not doing so would mean that the user's token could not be deposited back into raydium, to handle this case it is expected that some reserves would be held
that would aid the operation, but it is expected to be rare as the protocol is expected to be running their own bots as well, bots are also penalized for 
missing the previous ranges by halving their rewards.

Given that all these invariants are maintained it is not hard to show that the user's share of the pool(where they initially provided liquidity) would not 
decrease and would only stay the same or increase

---

## Protocol-Specific Design

Raydium, Orca and others use different account layouts and different price/tick conventions.
There is no universal interface for CLMMs on Solana.
This program intentionally implements each protocol separately.
Right now, only Raydium is included.

---

## Current Status

* Raydium support: **working**
* Meteora integration for LP storage: **working**
* Keeper incentives: **implemented**
* Orca (or others): planned, they would be added as separate implementations to this version or in the next

---
