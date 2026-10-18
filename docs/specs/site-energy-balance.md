# Site energy balance (production, storage and grid, per 30-minute slot)

> **Living specification — source of truth.** This document specifies the **site energy balance**: how
> the core combines, for one electric meter, every production source, every storage device and the
> meter's own import and export into a 30-minute allocation of energy flows (production to home,
> production to storage, storage to grid…), how it values those flows with the meter's contract
> (including the time-shift gain of storage), where the results are stored, and how they reach the
> energy monitoring screens and the dashboard. **Rule: any PR that changes one of these behaviors or
> contracts modifies this file in the same diff** — spec first, code second.
>
> Status: **proposed** — submitted for review before any code. Nothing here is implemented.
>
> It builds on `docs/specs/energy-contracts.md` (contracts, engine, cost job) and
> `docs/specs/energy-hierarchy.md` (meters, root resolution), and adds a feature category designed
> under `docs/specs/device-feature-categories.md`, whose checklist section D answers. It uses the
> measurement categories as they are (`energy-production-sensor`, `battery-storage`, `grid-sensor`,
> `home-output-sensor`) and needs no external-integration capability: an integration only publishes
> the standard features of its devices.

## Context

### The problem, on a real site

A three-phase house in France, one Linky main meter read through teleinformation, a Tempo contract
(previously Base, then peak / off-peak), and three energy integrations that know nothing of each
other:

- **17 plug-in storage units** (one external integration). Some are **AC-coupled only** (no PV
  input: they charge from the AC socket they are plugged into), others carry **their own PV
  inputs** (DC-coupled: the panels reach the battery without crossing the house AC wiring);
- **PV micro-inverters without any battery** (another integration), injecting straight into the
  house wiring;
- the **main meter**, which only sees the net exchange with the grid: import (`east`) and export
  (`eait`).

Every figure Gladys can compute today is a **per-device** figure, and per device the accounting is
wrong as soon as production and storage live in different devices. At noon, the micro-inverters
produce 1.5 kWh in a slot, the house draws 0.4 kWh and an AC-coupled battery absorbs 0.9 kWh: the
meter exports 0.2 kWh and imports nothing. Seen from the battery alone, 0.9 kWh came **from the AC
socket**, and any per-device valuation (the battery's integration reading the price of its device,
`capabilities/energy-prices.md`, or a cost feature derived from a charge index) prices it as grid
energy bought at the peak price. Seen from the site, those 0.9 kWh were **solar surplus that would
otherwise have been exported for nothing**. The battery's evening discharge then shows a loss where
the site made a gain (worked example, B.4).

Only a **site-level** balance — all production sources of any integration, all storage devices,
and the import and export of the meter that bills the site — can attribute each kWh correctly.

### What exists today (master, October 2026)

| Building block | File(s) | What it gives | Limit for a balance |
| --- | --- | --- | --- |
| Consumption from indexes | `energy-monitoring.calculateEnergyFromIndex.js`, kind `CONSUMPTION` | 30-minute `thirty-minutes-consumption` states from the deltas of the indexes of `ENERGY_INDEX_FEATURE_TYPES` (`energy-sensor`/`index`, `energy`, `switch`/`energy`, `teleinformation`/`east`, `easf01`…`easf10`) | The whole delta since the last processed state lands in the current slot (no split at the slot boundaries): two devices polled at different rhythms are not aligned on the same slots |
| Production from indexes | same file, kind `PRODUCTION` (`PRODUCTION_INDEX_FEATURE_TYPES`) | `energy-production-sensor`/`thirty-minutes-production` states, only when such a feature already exists under the index | Nothing derives that feature (no `addEnergyFeatures` equivalent); `thirty-minutes-production-revenue` and `daily-production-revenue` are declared and never written |
| Cost job | `energy-monitoring.calculateCostFrom.js` | Each consumption interval priced by the active contract of its root meter, energy only, demand on the meter's own features | Prices consumption features only; knows nothing of production, storage or export |
| Contracts | `docs/specs/energy-contracts.md` | `t_energy_contract`, rule engine, calendars, bounded recalculation (`recalculation.schedule.js`) | `direction: production` is reserved and **refused** by the API in v1; net metering and buy-back are non-goals |
| Hierarchy | `docs/specs/energy-hierarchy.md` | The root meter of a device, the main meter | Production features are outside it; a battery publishing only `battery-storage` features has no attachment feature and can never be attached |
| Storage taxonomy | `battery-storage` (`charge-index`, `discharge-index`, `battery-energy-remaining`…), `home-output-sensor`, `grid-sensor` | The measurements every storage device can publish | No consumer in the core: no pipeline reads `charge-index`, `discharge-index`, `grid-sensor`/`input-index` / `output-index` or `home-output-sensor`/`index` |
| Price read (open PR, `capabilities/energy-prices.md`) | `energyContract.getMeterPrices`, `getDeviceElectricMeterId` | The price per kWh of each 30-minute slot of a meter, and the meter a device is on | Gives a device-level valuation, which is exactly what is wrong for an AC-coupled battery |

### Scoping decisions

- **One balance per electric meter.** The meter is what bills the site (its contract prices the
  import); the balance is the site behind it. No new "site" object in the data model.
- **Computed by the core, from standard features only.** Whatever integration publishes a PV
  inverter, a battery or a meter, the balance reads `energy-production-sensor`, `battery-storage`,
  `grid-sensor` and `teleinformation` features. No integration has to know another one.
- **Stored as device feature states** of a core-owned "site balance" device (A.3), so the existing
  DuckDB aggregation, the `energy-consumption` widget, the charts and the history retention work
  on it unchanged.
- **Energy first, money second.** Phase 1 delivers the kWh allocation, which needs no price;
  phase 2 values it; phase 3 replaces the v1 resale setting by production contracts (Delivery
  plan).
- **Import and export are always priced separately.** This is not net metering (the non-goal of
  the contracts spec stands): exported kWh never offset imported kWh.

## A. Model

### A.1 The site and its members

- **Site**: an electric meter in the sense of `energy-hierarchy.md` B (a device carrying at least one
  consumption contract) on which the user **enabled** the balance (B.11.2). Opt-in: an installation
  without production or storage gains nothing from it, and enabling creates a device and its
  features.
- **Site of a device** (`energyBalance.getDeviceSite(device)`): the meter returned by
  `energyContract.getDeviceElectricMeterId(device)` — the rule introduced by the price-read PR
  (`energy-hierarchy.md`, "Meter of a device"): the root meter of its first attachment feature,
  and **the main meter** for a device without any energy source feature (a battery publishing only
  `battery-storage` features, a PV inverter publishing only `energy-production-sensor` features).
  If that PR has not landed, phase 1 introduces the same function with the same rule. On a
  single-meter installation (the general case) every production and storage device of the instance
  belongs to the one site. Attaching a production-only or storage-only device to a **second**
  meter is not possible today (D.1 of the hierarchy spec requires an attachment feature): open
  question 4.
- **Members of a site** (auto-proposed, user-editable, B.11.2): every feature of the devices of the
  site matching one of the **input roles** of A.2. The user can exclude a feature (a production
  measured twice: a clamp on the PV line and the inverter itself); the exclusion list is stored on
  the site device (A.5). An excluded feature is never read.

### A.2 Inputs: which existing features feed the balance

All inputs are **cumulative energy indexes** (kWh, Wh) read from their raw states, or, for the meter
only, a 30-minute consumption an integration feeds itself. Power features are never integrated
(C, open question 5).

| Role | Symbol | Accepted features, in order of preference | Read on |
| --- | --- | --- | --- |
| Import | `I` | the meter's root feature (`energyContract.getMeterRootFeatureId`: `teleinformation`/`east` before `easf01`…, `energy-sensor`/`index` or `energy`), else `grid-sensor`/`input-index`, else `energy-sensor`/`thirty-minutes-consumption` fed by an integration (Enedis-like load curve, taken slot by slot as is) | the **site meter device only** |
| Export | `E` | `teleinformation`/`eait`, else `grid-sensor`/`output-index`; the user may pick another index of the meter device (B.11.2) | the **site meter device only** |
| Production | `P_d` | `energy-production-sensor`/`index` (else an existing `thirty-minutes-production` fed by an integration) | every member device, the meter excluded |
| Storage charge | `C_d` | `battery-storage`/`charge-index` | every member device |
| Storage discharge | `D_d` | `battery-storage`/`discharge-index` | every member device |

Rules:

- **Only the site meter measures the grid.** A `grid-sensor` feature on any other device (a
  plug-in battery's AC port, an EM clamp on a sub-circuit) is the exchange **of that device**, by
  the taxonomy's own definition (rule 2: "a plug-in battery's grid port… publish here"); it is
  never read as the site's import or export.
- **A site cannot be computed without both `I` and `E`.** A meter without an export index sees a
  surplus as zero and would turn every exported kWh into house consumption: the site status is
  `meter_incomplete` (B.11.1) and nothing is written.
- **A storage device counts only with both indexes.** A device with `charge-index` and no
  `discharge-index` (or the reverse) is listed in the composition with a warning and not read: half
  a battery breaks the conservation of every slot.
- **`home-output-sensor` is not an input in v1.** The balance works at the terminals of the
  battery (`charge-index` / `discharge-index`, what the storage taxonomy guarantees); the conversion
  losses of a storage inverter therefore land in the house consumption `L` (they are energy the
  site really drew). Using the AC-side indexes when a device publishes them (its home output and
  its port input) to move those losses into storage is a later refinement (C).
- **A device's production is whatever its integration publishes as production**: the AC output of a
  micro-inverter, the PV input of a DC-coupled battery. The balance does not need to know which:
  B.2 handles the DC-coupled case from the fact that one device publishes both production and
  storage.

### A.3 Where the site features live — options and decision

| Option | Description | Verdict |
| --- | --- | --- |
| **A. A "site balance" device owned by the core** | One device per enabled site, `service_id` = the `energy-monitoring` service, `external_id` `energy-monitoring:site-balance:<meter device id>` (the meter id never changes, the external id is stable), no room, named "Site balance — <meter name>"; its features are the `energy-balance` types of A.4 | **Chosen** |
| B. Features added to the meter device | The balance features hang off the Linky / MQTT / Enedis device | Rejected: the meter belongs to its integration, whose next discovery "Update" rewrites the feature list; an external integration would see core features in its own device diff; and the meter would then carry two different kinds of truth (measured and allocated) |
| C. Dedicated tables (`t_energy_balance_slot`…) | One row per slot and site with every flow and value | Rejected for v1: a migration, and none of what features give for free (DuckDB storage and aggregation `getConsumptionByDates`, `energy-consumption` widget, charts, history purge, backups, scene triggers on a feature); to reconsider only if the states prove too slow (B.10.3) |
| D. The house (`t_house`) as the site | A house would own its balance | Rejected: nothing links a house to a meter, a house may have two meters, and the meter is the billing unit |

Consequences of option A:

- the site device is created when the user enables the balance and deleted when they disable it
  (its states with it, after a confirmation) or when the meter device is deleted; it survives the
  meter losing its last contract (status `no_contract`, nothing computed, the history kept);
- the device **has no energy source feature**: the hierarchy, the cost job, `addEnergyFeatures` and
  `addConsumptionCostFeatures` never see it (its category is not in `ENERGY_INDEX_FEATURE_TYPES`
  nor `isConsumptionFeature`), it never appears on the "My devices" page and it is never priced as
  a consumer — this is why its features cannot be `energy-sensor` consumptions (they would be
  attached to the main meter and their costs counted twice);
- its features never carry an `energy_parent_id`;
- `energy-balance` features are **written by the core only**: a device save from any other service
  carrying one is refused (`400`, the device validation), like a derived energy feature an
  integration may not publish (`matchDerivedEnergyFeature`).

### A.4 The `energy-balance` category and its types

`DEVICE_FEATURE_CATEGORIES.ENERGY_BALANCE = 'energy-balance'`. Every type is **one atomic value per
30-minute slot**, a state stamped at the **end** of the slot (the convention of
`thirty-minutes-consumption`), `keep_history: true`, `read_only: true`, `has_feedback: false`.

**Energy flows** (phase 1, unit `kilowatt-hour`, value ≥ 0): the cells of the source × sink matrix
of the site, three sources (production, storage, grid) and three sinks (home, storage, grid).

| Type | Flow |
| --- | --- |
| `production-to-home` | production consumed directly by the house (direct self-consumption) |
| `production-to-storage` | production stored |
| `production-to-grid` | production exported |
| `storage-to-home` | storage discharge consumed by the house |
| `storage-to-storage` | discharge of one storage device absorbed by another one in the same slot |
| `storage-to-grid` | storage discharge exported |
| `grid-to-home` | import consumed by the house |
| `grid-to-storage` | import stored |
| `unmeasured-production` | diagnostic: energy the measured sources cannot explain, allocated as production (B.3); non-zero means a production source is missing, excluded or lagging |

There is no `grid-to-grid` cell (an export always comes from a local source, B.3) and no
"home consumption" type: it is the sum of the three `*-to-home` flows, computed at display (rule 5,
one atomic value per feature).

**Values** (phase 2, unit the currency of the meter's contract: `euro`, `dollar`…; value ≥ 0 except
where a calendar price is negative, as in the contracts spec):

| Type | Value of the slot |
| --- | --- |
| `grid-to-home-cost` | share of the meter's cost of the slot for `grid-to-home` |
| `grid-to-storage-cost` | share of the meter's cost of the slot for `grid-to-storage` |
| `production-to-home-value` | avoided import: `production-to-home` × import price |
| `production-to-storage-value` | opportunity value of the stored production: `production-to-storage` × resale price (0 without resale) |
| `production-to-grid-value` | resale revenue of exported production (0 without resale) |
| `storage-to-home-value` | avoided import: `storage-to-home` × import price |
| `storage-to-grid-value` | resale revenue of exported storage (0 without resale) |
| `storage-released-cost` | acquisition cost of the energy that left the stock this slot (B.6) |

**Stock** (phase 2, the persistence of B.6): `storage-stock-energy` (kWh, ≥ 0, the energy in the
site's stock at the end of the slot, measured at the charge terminals) and `storage-stock-cost`
(currency, the acquisition cost of that stock). Their ratio is the weighted average cost of the
stored energy, a figure the user can chart.

Adding types later is non-breaking, so phase 1 ships the nine energy types alone; phase 2 adds the
ten others.

### A.5 Site configuration (parameters of the site device)

Stored as `t_device_param` rows of the site device (core-owned, no migration):

| Param | Content |
| --- | --- |
| `ENERGY_BALANCE_EXCLUDED_FEATURES` | JSON array of the feature ids the user excluded (A.1) |
| `ENERGY_BALANCE_EXPORT_FEATURE` | feature id of the export index when the user overrode the automatic choice (A.2) |
| `ENERGY_BALANCE_EFFICIENCY` | the user's round-trip efficiency override (0.5–1), absent = estimated (B.6) |
| `ENERGY_BALANCE_RESALE` | phase 2: JSON array of resale periods `{ "valid_from": "YYYY-MM-DD", "price": 0.04, "currency": "EUR" }`, empty = resale disabled (B.7) |
| `ENERGY_BALANCE_LAST_SLOT` | the end of the last slot written by the 30-minute job (B.10.1) |

## B. Detailed design

### B.1 Slots, clock and energy per slot

- **Slots** are the 30-minute slots of the **local clock of the meter's active contract** (UTC
  `:15` / `:45` boundaries in a `:45` zone, as in `capabilities/energy-prices.md`), identified by
  their UTC start; a state is stamped at the slot end. A clock-change day has 46 or 50 slots and
  needs no special case: the slots are instants, the day totals are the DuckDB aggregation in the
  local timezone, as for consumption. 15-minute contracts keep 30-minute balance slots (the meter
  data, like the cost job).
- **Energy of a cumulative index over a slot** = index at the slot end − index at the slot start,
  where the **index at a boundary** is interpolated linearly between the last state at or before it
  and the first state after it. This is the deliberate difference with the consumption pipeline
  (which puts the whole delta since the last state into the current slot): a meter reporting every
  second, a battery polled every minute and a cloud inverter reporting every 15 minutes are all cut
  at the same instants, so their slots are comparable. The read is one DuckDB query per feature
  and window (an `ASOF JOIN` of the boundaries onto the states), never the raw states in Node.
- **Gaps.** A boundary whose two surrounding states are more than **2 hours** apart is not
  interpolated: the energy of the gap is not spread, the feature is **missing** for the slots of the
  gap (job warning `missing_source`, counted per feature). A boundary with no state after it yet is
  **pending**: the slot is computed with what is known and recomputed by the next runs (B.10.1).
- **Counter resets** (negative delta between two states) contribute 0, as in the consumption
  pipeline, with a warning.
- **A 30-minute consumption fed by an integration** (meter role `I` only) is taken as the slot's
  import; a missing state is a missing slot.
- **Meter lag.** Devices report late (cloud polling, a phone gateway): the 30-minute job therefore
  recomputes the **last 4 slots** at every run (B.10.1), and the 11:10 / 16:10 runs recompute the
  previous day, so a lag up to 2 hours heals itself and late daily data is taken.
- **Missing meter slot.** When `I` or `E` is missing or pending for a slot after the lag window, no
  state is written for that slot: the balance never invents the grid exchange. The coverage of a
  period (slots written / slots in the period) is shown with its totals (B.11.2).
- **Missing device data** (a battery offline for 3 hours): the slot is still computed without it;
  its absence shows as house consumption (a missing discharge) or as `unmeasured-production` (a
  missing production that was exported), and the job warning names the feature.

### B.2 Site quantities of a slot

For each slot, from the member features (A.2), all in kWh and ≥ 0:

1. **DC-coupled pre-allocation.** For each device `d` publishing **both** production and storage,
   its own production charges its own battery first: `own_d = min(P_d, C_d)`, booked as
   `production-to-storage`; the remainders `P_d − own_d` and `C_d − own_d` go to the site totals.
   Reason: DC-coupled panels reach their battery without crossing the AC bus, so a house importing
   at that moment must not turn that charge into grid charging. A device publishing production
   without storage (a micro-inverter) or storage without production (an AC-coupled battery) has
   `own_d = 0`.
2. **Site totals**: `P = Σ (P_d − own_d)`, `C = Σ (C_d − own_d)`, `D = Σ D_d`, `I`, `E` from the meter.

Whether a battery is AC- or DC-coupled is never configured: it follows from the features its
integration publishes.

### B.3 The allocation

**Unmeasured source.** The bus of the site obeys `I + P + D = E + C + L`, with `L` the house
consumption, the only unknown. Two situations cannot happen with complete, synchronous data: an
export larger than the local sources (`E > P + D`), and sinks larger than every source
(`E + C > I + P + D`, i.e. `L < 0`). Both mean a production source is missing (a PV inverter not
in Gladys, excluded, offline) or lagging. The core then adds an **unmeasured production**:

```
U = max(0, E − P − D, (E + C) − (I + P + D))
P* = P + U
L  = I + P* + D − E − C          (≥ 0 by construction of U)
```

`U` is written as `unmeasured-production` and allocated as production: the most likely cause of
energy appearing from nowhere is a source the core does not see, and treating it as grid energy
would charge the user for it.

**Priority order.** Sources `P*`, `D`, `I`; sinks `E`, `L`, `C`; `ΣSources = ΣSinks` by
construction of `L`. The core fills the cells **in this order**, each one taking
`min(remaining source, remaining sink)`:

| # | Cell | Why this rank |
| --- | --- | --- |
| 1 | production → grid | The export is a fact of the meter and can only come from a local source: production first. This makes `production-to-grid` the exported production, so the self-consumption rate `1 − production-to-grid / production` is the standard definition (production minus injection). |
| 2 | storage → grid | The rest of the export comes from storage (a forced discharge, or a battery feeding a phase that exports on a non-netting meter). |
| 3 | production → home | Direct self-consumption before anything else: a controller charges on surplus, i.e. after the house load. |
| 4 | storage → home | |
| 5 | production → storage | Surplus production stored: this is the AC-coupled battery charging at noon from the micro-inverters. |
| 6 | storage → storage | One device discharging while another charges (17 units are not always in the same state). |
| 7 | grid → home | The import covers what the local sources could not. |
| 8 | grid → storage | Grid charging: what remains of the charge once the local surplus is used. |

**Closure.** Cells 1–2 cover `E` entirely (`E ≤ P* + D` by construction of `U`). After cell 8 every
source and sink is exhausted: a remaining local source would mean `L` and `C` are full while the
import is unused, which `ΣSources = ΣSinks` forbids (the converse holds for a remaining import). The
implementation asserts it (residues below 1e-9 kWh are rounded away, a larger one is a bug and
fails the slot with an error).

**Intra-slot timing.** A 30-minute slot is the resolution of the meter data, not of reality: a
cloud passing can make the meter import and export in the same slot. Ranking the export first
(cells 1–2) is what keeps such a slot truthful: 2 kWh produced, 2 kWh consumed, 1 kWh imported and
1 kWh exported gives 1 kWh self-consumed, 1 kWh exported, 1 kWh imported for the house — not a
fictitious "2 kWh self-consumed, 1 kWh passed through".

**Three-phase sites.** The balance uses the meter's import and export as the meter counts and bills
them. A meter netting the phases sees only the net exchange; a non-netting one may import on a
phase while exporting on another, which the algorithm handles like intra-slot timing (export
attributed to local sources first, the import to the house). Since `I` and `E` are taken as billed,
the money figures are exact either way; only the kWh labels of a non-netting site are a 30-minute,
whole-site approximation. Per-phase balances are a non-goal (C).

### B.4 Worked example (energy)

Illustrative peak / off-peak contract: off-peak 22:00–06:00 at 0.1696 €/kWh, peak at 0.2146 €/kWh.
One AC-coupled battery, micro-inverters without battery, no resale, a round-trip efficiency of 0.9.
All values in kWh per slot.

| Slot (local) | Meter `I` / `E` | Micro-inverters `P` | Battery `C` / `D` | House `L` (derived) | Flows |
| --- | --- | --- | --- | --- | --- |
| S1 03:00 (off-peak) | 1.3 / 0 | 0 | 1.0 / 0 | 0.3 | grid → home 0.3, grid → storage 1.0 |
| S2 12:00 (peak) | 0 / 0.2 | 1.5 | 0.9 / 0 | 0.4 | production → grid 0.2, production → home 0.4, **production → storage 0.9** |
| S3 12:30 (peak, cloud) | 0.4 / 0.1 | 0.6 | 0.4 / 0 | 0.5 | production → grid 0.1, production → home 0.5, grid → storage 0.4 |
| S4 19:00 (peak) | 0.2 / 0 | 0 | 0 / 1.0 | 1.2 | storage → home 1.0, grid → home 0.2 |

Totals: production 2.1 kWh, of which 0.9 directly self-consumed, 0.9 stored and 0.3 exported for
nothing (the "given to the grid" figure); 1.4 kWh stored from the grid during the off-peak night
and the cloud; 1.0 kWh discharged to the house. Self-consumption rate 1 − 0.3 / 2.1 = 85.7 %;
self-sufficiency (house 2.4 kWh, 0.5 from the grid) 1 − 0.5 / 2.4 = 79.2 %. S2 is the user's case:
the battery's 0.9 kWh "from the socket" are solar surplus. The same slots valued in B.8.

### B.5 Edge cases

| Case | Behavior |
| --- | --- |
| AC-coupled battery charging from another integration's PV | cell 5 (production → storage), B.4 S2 |
| DC-coupled battery charging from its own panels while the house imports | B.2 pre-allocation: production → storage, the import to the house |
| Battery forced to charge from the grid during off-peak | cells 7–8: grid → storage, valued at the off-peak price (B.6) |
| Simultaneous charge and export | cell 1 then cell 5: the surplus beyond the export is stored, and a charge with no local source left is grid charging |
| Several batteries, one charging, one discharging | cell 6, `storage-to-storage`: the energy stays in the site stock (B.6), only the losses cost |
| Battery discharging while the site exports | cells 1–2: production is exported first, the discharge goes to the house as far as the house consumes |
| Production device without index (power only) | not read (composition warning); its exported energy shows as `unmeasured-production`, its self-consumed energy disappears from the house consumption |
| Storage device without index, or with one index only | not read (composition warning); A.2 |
| Off-grid / backup output of a storage device | its loads are fed by the discharge and are part of `L`, which is what they are |
| Feature measured twice (a clamp and the inverter) | the user excludes one (A.1); until then the production is counted twice and `L` overestimated |
| Meter without export index | site `meter_incomplete`, nothing computed (A.2) |
| Missing or pending meter slot, missing device data, counter reset, gap over 2 hours | B.1 |
| Clock change | B.1: 46 / 50 slots, no special case |
| Device clocks | states are dated at reception by the core for live integrations; an integration posting dated states with a skewed clock shifts its energy between slots, which interpolation cannot fix |
| A device moves to another meter (multi-meter sites) | its features leave one site and join the other from the next computed slot; a recalculation of both sites from the move is requested (B.10.2) |

### B.6 Storage stock: the cost of stored energy (phase 2)

Storage shifts energy in time; its gain is the value of the energy when it comes out minus what it
cost when it went in. The site keeps **one stock** (not one per battery: on a shared AC bus nothing
says which unit absorbed which surplus, and the economics are the site's):

- **Entries** (each slot): `grid-to-storage` at the meter's cost of that energy (the
  `grid-to-storage-cost` of B.7), `production-to-storage` at its **opportunity value** — the resale
  price of the slot when resale is enabled, else **0**: solar surplus stored instead of being given
  away cost nothing. The stock adds the kWh and the cost: `stock_kwh += in`, `stock_cost += cost`.
- **Exits.** A discharge `X = storage-to-home + storage-to-grid` releases `X / η` kWh from the
  stock (`η` the round-trip efficiency): the losses are charged to the energy that comes out, which
  is what they are. The released cost is `stock_cost × released / stock_kwh` (weighted average
  cost), written as `storage-released-cost`. `storage-to-storage` energy leaves and re-enters the
  stock: only its losses (`X_ss × (1/η − 1)` kWh) leave, **their cost stays in the stock** (the
  average cost rises).
- **Untracked energy.** A discharge larger than the stock (the batteries were charged before the
  balance started, or after a reset) releases what the stock holds; the rest is **untracked** and
  released at its own use value (the price it is valued at, B.7), so it shows **no gain and no
  loss** — the conservative choice: the balance never claims a gain on energy whose cost it does
  not know.
- **Efficiency `η`**: the user's override (A.5) if any; else the ratio of the site's discharge to
  its charge over the 30 days before the slot's local day (`Σ D / Σ C` of the stored flows),
  clamped to 0.5–1, and **0.9** while less than 7 days of data exist. Computed once per local day
  from stored states, so a replay gives the same values. Self-discharge and standby draw are not
  modelled: they show in the estimated `η`.
- **Persistence**: `storage-stock-energy` and `storage-stock-cost` are written at every slot. A
  recalculation from an instant restarts from the stock states of the slot ending at that instant
  (zero stock when there is none), so no checkpoint table is needed.
- **Reset** (`POST …/reset_stock`, B.11.1): the stock is set to zero at the given instant and the
  balance recomputed from there; the energy left in the batteries becomes untracked. For a user who
  changes the batteries or wants to start a clean year.

### B.7 Valuation per slot (phase 2)

- **Import price `p`** of a slot: the unit price per kWh of the meter's active contract at the slot
  start, energy only, taxes included (`energyContract.getMeterPrices`, the function of the
  price-read PR, which handles tiers on the real accumulations, 15-minute calendars, Tempo days,
  contract changes inside a window; phase 2 introduces it if that PR has not landed). A `delegated`
  contract cannot price a past instant: `p` is then the meter's own cost of the slot divided by its
  import when `I > 0`, else unknown — the avoided-import values of that slot are not written and
  the job counts a `price_unknown` warning.
- **Grid costs** are **not** recomputed: `grid-to-home-cost` and `grid-to-storage-cost` split the
  meter's stored cost of the slot (its `thirty-minutes-consumption-cost` state, written by the cost
  job) pro rata of the kWh. Their sum is the meter's cost, exactly — tiers, spot prices, a
  delegated contract and demand charges included. A meter whose cost is only daily uses `p × kWh`.
- **Resale price `r`** of a slot: phase 2, the resale period of A.5 covering the slot's local date
  (0 when none); phase 3, the active production contract of the meter (B.9).
- **Formulas**: `production-to-home-value = production-to-home × p`;
  `storage-to-home-value = storage-to-home × p`; `production-to-grid-value = production-to-grid × r`;
  `storage-to-grid-value = storage-to-grid × r`; `production-to-storage-value = production-to-storage × r`;
  `storage-released-cost` per B.6. Values rounded to 6 decimals, like the costs.

### B.8 Derived figures, the identity, and the worked example (values)

Computed at display from the stored types, per day / month / year (B.11.2):

| Figure | Formula |
| --- | --- |
| Home consumption | `production-to-home + storage-to-home + grid-to-home` |
| Production | `production-to-home + production-to-storage + production-to-grid` (unmeasured included) |
| Self-consumption rate | `1 − production-to-grid / production` |
| Self-sufficiency | `1 − grid-to-home / home consumption` |
| Solar stored vs grid stored | `production-to-storage` vs `grid-to-storage` |
| Discharge consumed vs exported | `storage-to-home` vs `storage-to-grid` |
| Self-consumption saving | `production-to-home-value` |
| Export revenue | `production-to-grid-value + storage-to-grid-value` |
| Energy given to the grid ("loss") | `production-to-grid + storage-to-grid` in kWh, **for the periods without resale**, shown as a lost-opportunity figure with value 0 |
| Storage net gain (time shift) | `storage-to-home-value + storage-to-grid-value − storage-released-cost` |

**Identity** (a test and a manual check): over any period,
`Σ(production-to-*-value) + Σ(storage-to-*-value) − Σ(storage-released-cost) − Δ(storage-stock-cost)`
equals the **saving against a site without production nor storage**, `Σ(L × p) − Σ(I × p − E × r)`
(the energy part of the bill, conversion losses aside). Nothing is counted twice: stored solar is
valued once, when it is used.

**Worked example (B.4 slots, prices and η = 0.9), no resale**:

| Slot | Values (€) | Stock after the slot |
| --- | --- | --- |
| S1 | grid → home cost 0.0509, grid → storage cost 0.1696 | 1.0 kWh, 0.1696 € (0.1696 €/kWh) |
| S2 | production → home value 0.0858; stored 0.9 kWh at 0 €; 0.2 kWh given to the grid | 1.9 kWh, 0.1696 € (0.0893 €/kWh) |
| S3 | grid → storage cost 0.0858, production → home value 0.1073; 0.1 kWh given to the grid | 2.3 kWh, 0.2554 € (0.1110 €/kWh) |
| S4 | storage → home value 0.2146; released 1.0 / 0.9 = 1.111 kWh at 0.1110 € = 0.1234 €; grid → home cost 0.0429 | 1.189 kWh, 0.1320 € |

Storage net gain **+0.0912 €**; self-consumption saving 0.1931 €; 0.3 kWh given to the grid.
Saving against no production nor storage: 0.5015 € − 0.3492 € = 0.1523 € = 0.1931 + 0.0912 −
0.1320 (the cost still in stock). With a **per-device** valuation, the battery's 2.3 kWh would all
be grid energy (0.1696 + 0.1931 + 0.0858 = 0.4486 €, 0.1950 €/kWh) and its discharge would show
**−0.0021 €**, a loss, for the same physical behavior. **With resale at 0.04 €/kWh**, S2 stores
0.9 kWh at 0.036 € and earns 0.008 € of export, S3 0.004 €; the released cost becomes 0.1408 €, the
storage net gain 0.0738 €, the export revenue 0.012 €, and the identity still closes (0.1643 €).

### B.9 Resale: a v1 setting, then production contracts

Valuing the export needs a resale price. Two ways:

1. **A per-site resale setting** (phase 2): a list of periods `{ valid_from, price, currency }` on
   the site device (A.5), flat price per period. It covers the common case — a fixed buy-back price
   per kWh for years (the French surplus obligation contracts) — and "no resale" (an empty list,
   the majority of plug-in installations: their surplus is a loss, shown as such). It touches
   nothing of the contracts spec: no grammar change, no lifting of the `direction: production`
   refusal, no risk for the cost job.
2. **Production contracts** (phase 3): `t_energy_contract` with `direction: production` on the
   same meter, priced by the same engine (time slots, spot calendars with negative prices, a buy-back
   that depends on the day colour), the resale price of B.7 being `getMeterPrices` on that contract.
   This is the shape the contracts spec reserved, but it requires that spec to lift its v1 refusal
   and to state that the cost job, the subscription series, the current-price widget, the scene
   trigger and the main-meter resolution ignore production contracts — a change of its own, to be
   reviewed with its owner.

**Recommendation**: (1) for phase 2, (2) as phase 3, because the balance is useful long before a
second contract direction, and (1) converts losslessly into (2) (each period becomes a production
contract with a single `fallback` price; the setting is then removed). Open question 1 asks the
maintainer to confirm or to go straight to (2).

### B.10 Jobs, recalculation and performance

#### B.10.1 Jobs (`energy-monitoring.init.js`)

| Job | When | Window | Notes |
| --- | --- | --- | --- |
| 30-minute balance | in the existing `0 0,30 * * * *` job, **after** the cost calculation (values need the meter's costs) | the last 4 slots, from the stock states before the first one | `calculateBalanceFrom(from, { meterDeviceIds })`; slots replaced through `replaceHistoricalStatesFrom` in one DuckDB transaction, never deleted before the new values are computed; updates `ENERGY_BALANCE_LAST_SLOT` |
| Yesterday | in the existing 11:10 and 16:10 runs, after `calculateCostFromYesterday` | the previous local day | late cloud and supplier data |
| Recalculation | on demand, bounded 1 / 10 min / site, merging scheduler `recalculation.schedule.js` keyed `balance:<meter id>` | from the requested instant to now | triggers in B.10.2 |
| Enable / composition change | on demand, same scheduler | from the earliest slot where the meter has both import and export states, at most **1 year** back (the user can ask for more from B.11.2) | runs in 31-day chunks, job visible on the Jobs page with its warnings (`missing_source`, `price_unknown`, counters) |

#### B.10.2 Recalculation triggers

- **A cost recalculation of the meter** (`energy-contract.recalculate` handled by
  `recalculateForContracts`: a contract or calendar changed, a late consumption published, a device
  attached): once its `calculateCostFrom` is done, the balance values are recomputed from the same
  instant for the sites whose meter is concerned. The kWh flows do not depend on prices: a
  price-only recalculation rewrites the value and stock types only.
- **Resale periods changed**: from the local `valid_from` of the earliest changed period.
- **Composition, export feature or efficiency override changed**: kWh and values from the earliest
  slot of the change (the earliest data of the features added or removed, or the user's `from`).
- **A device moved between meters**: both sites, from the move.
- **Stock reset**: from the reset instant.

A recalculation always runs **forward** from its start (the stock is a chain): its cost is the
number of slots from that start to now.

#### B.10.3 Performance

- 30-minute run on the reference site (2 meter indexes, 17 storage devices × 2 indexes, ~6
  production indexes: ~42 features): 42 small DuckDB reads over 2.5 hours, 4 slots × 19 types written;
  target **< 2 s** on a Raspberry Pi 4.
- Full year: ~42 features × 12 chunks, each read returning one row per slot boundary (the `ASOF
  JOIN` of B.1 keeps the raw states in DuckDB, a battery polled every minute stores ~525,000 states
  a year); 17,520 slots × 19 types ≈ 333,000 states written; target **< 2 minutes** on a
  Raspberry Pi 4, measured and recorded in this section by the phase 1 PR.
- Volume: 19 states per slot, ~910 a day per site, the order of what two 30-minute meters already
  write with their consumption and cost.

### B.11 REST API and user interface

#### B.11.1 Routes (admin, `server/api/routes.js`, controller `energy-balance.controller.js`)

| Route | Role |
| --- | --- |
| `GET /api/v1/energy_balance` | The electric meters with their balance: `{ meter: { id, selector, name }, enabled, device_selector, status, composition }`; `status` among `ok`, `meter_incomplete`, `no_contract`, `not_enabled`; `composition` lists every candidate feature with its role, device, integration, `included`, and the warnings of A.2 |
| `POST /api/v1/energy_balance/:meter_selector/enable` | Body `{ from? }`: creates the site device and requests the initial computation (B.10); `409` if already enabled, `400 ELECTRIC_METER_HAS_NO_CONTRACT` / `METER_HAS_NO_EXPORT_INDEX` |
| `PATCH /api/v1/energy_balance/:meter_selector` | Body `{ excluded_feature_ids?, export_feature_id?, efficiency?, resale? }`, validated (known features of the site's members, efficiency 0.5–1 or `null`, resale periods with increasing `valid_from`, price ≥ 0, ISO currency equal to the meter contract's); requests the recalculation of B.10.2 |
| `GET /api/v1/energy_balance/:meter_selector/summary?from=&to=&group_by=day\|month\|year` | Per period: the sums of every type, the derived figures of B.8 and the coverage (B.1), read through the DuckDB aggregation of `getConsumptionByDates` (same period boundaries, `period_start_day` accepted) |
| `POST /api/v1/energy_balance/:meter_selector/recalculate` | Body `{ from }` (a date alone = local midnight, like `/energy_contract/recalculate`) |
| `POST /api/v1/energy_balance/:meter_selector/reset_stock` | Body `{ at }` (B.6) |
| `DELETE /api/v1/energy_balance/:meter_selector` | Disables: deletes the site device and its states |

#### B.11.2 Energy monitoring: a "Balance" tab

`/dashboard/integration/device/energy-monitoring/balance`, between "Contracts" and "Settings":

1. one card per electric meter: enable button (proposed when the site has at least one production
   or storage feature), status;
2. **composition**: the members grouped by role (meter import / export, production, storage), each
   with its device, integration and a checkbox; the warnings (half a battery, power only, a
   `grid-sensor` on a device that is not the meter: "measures this device's own port, not the
   site"); the export feature select;
3. **period view**: day / month / year selector, a flow diagram of the period (the three sources,
   the three sinks, the kWh on each link), the totals and rates of B.8, the coverage and the
   `unmeasured-production` total with a hint ("a production source may be missing");
4. phase 2: the money column (saving, export revenue, storage net gain, energy given to the grid),
   the resale periods editor, the efficiency (estimated value shown, override field), "recalculate
   from", "reset the stock".

#### B.11.3 Dashboard

- The existing **`energy-consumption`** widget works on the site features as they are (kWh or
  currency series per feature, any period): "house consumption by origin" is the three `*-to-home`
  features in one widget. The kWh mode needs no change; the currency mode reads its currency unit
  from `thirty-minutes-consumption-cost` features only (`getConsumptionByDates`), so phase 2 widens
  that to the value types of `energy-balance` (the site device has no contract, so no subscription
  series is prepended).
- Phase 2 adds an **`energy-balance`** box (config `{ electric_meter_device: <meter device selector>, period: "day" | "month" | "year" }`): the flow diagram and the main figures of the current period.
  Its `electric_meter_device` field references a device, so it lands with its entry in
  `device-migration.md` B.3 and `device.migrate` in the same diff (`dashboard-flexible-layout-and-widgets.md`).

#### B.11.4 Translations

`integration.energyMonitoring.balance.*` and the `deviceFeatureCategory` labels of the category and
its 19 types in **en, fr, de, es** (`compare-translations`); no text in the core.

## C. Non-goals

- **Net metering** (exported kWh offsetting imported kWh in the bill): still excluded, as in the
  contracts spec. Import and export are always priced separately.
- **Per-phase balance**: the meter's totals as billed (B.3).
- **Per-device attribution of the site figures** (the gain of battery n° 7): on a shared AC bus it is
  not measurable; a pro rata split could come later as display only.
- **Steering**: deciding when to charge or discharge is the job of the integrations and scenes (the
  `battery-storage` commands); the balance only reports.
- **Integrating power-only features** into energy (open question 5).
- **AC-side storage indexes** (`home-output-sensor`/`index`, the port input of a plug-in battery) to
  separate conversion losses from house consumption: later refinement, adding no type.
- **Reconciling the stock with `battery-energy-remaining`**: later; the estimated efficiency bounds
  the drift.
- **Daily-only meters** (no 30-minute import): the balance needs 30-minute slots.
- **Changing per-device costs**: the cost job still prices the consumption features of every
  device as today; the balance is the site view next to it.
- **Collective self-consumption, energy communities, several sites sharing a production**.
- **Gas, water, electric vehicles as storage** (V2H / V2G), **carbon accounting** of the flows
  (a natural extension with `grid-carbon-sensor`, not designed here).
- **Exact billing**, fixed charges: the balance is energy-only, the subscription stays a display
  series of the contract.

## D. Compliance with the taxonomy design rules

### D.1 Standards alignment (rule 3)

- **Matter** models devices and measurements, not a site accounting: Electrical Energy Measurement
  (cumulative and periodic imported / exported energy of one endpoint), Electrical Power
  Measurement, Power Topology (which describes *how* an endpoint is connected: node, tree, set,
  dynamic power flow), Device Energy Management and the energy device types (Battery Storage, Solar
  Power, Heat Pump, Water Heater). None allocates energy between sources and sinks; the inputs of
  this spec are the Gladys mirrors of those measurements (`grid-sensor`, `battery-storage`,
  `energy-production-sensor`).
- **Zigbee** (Metering cluster: delivered / received summations) adds nothing for allocations.
- **No standard covers the capability**, so it is designed from the capability: the source × sink
  matrix of a site with production and storage is what every energy manager shows, whatever the
  brand — Home Assistant's energy dashboard (grid → home, solar → battery, battery → grid…), SMA
  Sunny Portal, Victron VRM, Fronius Solar.web, Enphase Enlighten — and the self-consumption and
  self-sufficiency rates derived from it are regulatory definitions (production minus injection).
  The types use the generic words `production`, `storage`, `grid`, `home`: solar, wind or micro-hydro
  production, any storage technology.

### D.2 Two decisions open to the maintainer's call

- **Name without `-sensor`.** Rule 7 reserves the suffix for read-only measurements; these are
  read-only **computed** values, neither measurements nor commands. The derived costs of
  `energy-sensor` set a precedent the other way (computed, in a `-sensor` category). The author
  prefers `energy-balance`, since a `-sensor` name would invite integrations to publish it (open
  question 3).
- **19 types in one category.** Rule 5 warns against vendor telemetry dumps (the 17-type
  `battery-storage` draft); here each type is one atomic cell of a fixed, generic matrix (seven
  possible flows plus the storage transfer, each in kWh and in value) or one stock value, nothing
  device-specific, and the count follows from the matrix, not from a product.

### D.3 Checklist

- [x] **No brand, product or vendor name** in names or semantics (brands only in the evidence of D.1).
- [x] **Could not be mapped onto an existing category + type.** `energy-sensor` consumptions would be
  attached to the main meter and priced as consumption (counted twice, A.3); `energy-production-sensor`
  is production of a device; `grid-sensor` and `battery-storage` are measurements. The allocated
  flows are a different quantity: the share of a measured energy going from one node to another.
- [x] **The same quantity is not split across categories.** The measured import, export, production
  and storage stay in their categories on their devices; `energy-balance` holds only allocations and
  their values, on the site device only.
- [x] **Types are intrinsic** to the site balance: flows, their values, the stock of the time shift;
  home consumption and rates are sums or ratios, computed at display.
- [x] **Matter then Zigbee checked** (D.1): no counterpart; capability-first design with multi-vendor
  evidence.
- [x] **Enum-like types**: none.
- [x] **Naming**: kebab-case, English, no protocol name; the suffix question is argued (D.2).
- [x] **Names stress-tested** against hybrid inverters (DC-coupled pre-allocation, B.2), AC-coupled
  plug-in batteries, micro-inverters, sites with several batteries (`storage-to-storage`), meters
  with and without phase netting, and a future vehicle-to-home storage (it would be one more storage
  device, same types).
- [x] **Inline scope comment** on the constant: core-written only, one value per 30-minute slot
  stamped at the slot end, kWh ≥ 0 for flows, currency of the meter's contract for values, the
  boundary with `energy-sensor` (measured consumption) and `grid-sensor` (measured exchange).
- [x] **Translations** in the four locale files (B.11.4).
- [x] **Units** in `DEVICE_FEATURE_UNITS_BY_CATEGORY_AND_TYPE`: `kilowatt-hour` for the flows and
  `storage-stock-energy`, the currency units (`euro`, `dollar`…) for the values and
  `storage-stock-cost`.
- [x] **MQTT defaults / history grouping**: the category is excluded from the MQTT feature catalog
  (core-written, A.3) and from the activity history (a computed accounting, not an event).
- [x] **Tests and spec in the same diff** (Tests).

## Delivery plan

| Phase | PR | Content |
| --- | --- | --- |
| 0 | **This spec** | `docs/specs/site-energy-balance.md` and its `AGENTS.md` entry; no code. Reviewed with the maintainer, the open questions answered in this file |
| 1 | Balance in kWh | The category and its 9 energy types (constants, inline comment, units, translations), the site device, `getDeviceSite` (or reuse of `getDeviceElectricMeterId`), index-per-slot reading (B.1), the allocation (B.2–B.3), the 30-minute / yesterday / recalculation jobs, the `energy_balance` routes without money, the Balance tab (composition, flows, kWh figures) |
| 2 | Valuation | The 10 value and stock types, `getMeterPrices` if not landed, the stock (B.6), the valuation (B.7), the resale setting (B.9 option 1), the cost-recalculation hook (B.10.2), the money figures, the `energy-balance` dashboard box |
| 3 | Resale contracts | `direction: production` contracts in `energy-contracts.md` (its own spec change), the resale price read from them, the conversion of the resale setting, the setting removed |

Each phase is one PR with its tests and updates this file in the same diff; nothing in phase 1
depends on the open PRs, except the shared `getDeviceElectricMeterId` rule.

## Tests (100 % patch coverage on the server)

- **Index per slot**: interpolation at boundaries, a sparse device (15-minute states) and a dense one
  cut at the same instants, the 2-hour gap rule, a pending boundary, a counter reset, a 30-minute
  consumption meter, the 46 / 50 slots of a clock-change day, a `:45` timezone.
- **Allocation** (pure function, table-driven): every row of B.5; B.4 exactly; `U` on an export
  without source and on negative `L`; the DC-coupled pre-allocation; closure asserted on random
  consistent inputs (property test: the cells sum to the sources and the sinks, every cell ≥ 0).
- **Composition**: members by role, a `grid-sensor` on a battery ignored, half a battery ignored,
  exclusions, the export override, the main-meter rule for devices without energy source feature.
- **Stock and valuation**: B.8 worked example with and without resale; the identity on random
  sequences; untracked discharge with zero gain; `storage-to-storage` losses; `η` estimation,
  default and override; reset; restart of a recalculation from the stored stock; grid costs equal
  to the meter's cost state; a delegated contract (`price_unknown`); resale periods.
- **Jobs**: last-4-slots replacement, ordering after the cost job, the yesterday runs, the bounded
  scheduler merging requests, the trigger from `recalculateForContracts`, a missing meter slot
  writing nothing.
- **API**: each route, each refusal, admin only; the device validation refusing `energy-balance`
  features from another service.
- **Front**: Cypress spec of the Balance tab (enable, composition, period view), `compare-translations`.

## Verification (manual)

1. On a dev instance, a meter with `east` / `eait` (an MQTT device fed by hand), a peak / off-peak
   contract, an MQTT "micro-inverter" with an `energy-production-sensor`/`index` and an MQTT
   "AC battery" with `charge-index` / `discharge-index`.
2. Enable the balance: the composition lists the three devices in their roles, a `grid-sensor`
   added to the battery is shown as ignored.
3. Feed the four slots of B.4 (index values at the slot boundaries) and run the recalculation: the
   Balance tab shows exactly the flows of B.4, the rates 85.7 % and 79.2 %, and an
   `energy-consumption` widget on the three `*-to-home` features stacks 0.9 / 1.0 / 0.5 kWh.
4. Phase 2: the money figures of B.8 (storage net gain +0.0912 €, 0.3 kWh given to the grid); add a
   resale period at 0.04 €/kWh from the first day: the figures of the resale variant; change the
   contract's peak price: the values (not the kWh) are recomputed within 10 minutes.
5. Stop feeding the micro-inverter index while exporting: `unmeasured-production` appears with its
   hint; stop the meter: no slot is written and the coverage drops.

## Open questions for the maintainer

1. **Resale**: a per-site setting in phase 2 and production contracts in phase 3 (B.9,
   recommended), or production contracts directly?
2. **Site device** (A.3 option A): a core-owned device of the `energy-monitoring` service is
   acceptable, or should site-level results get their own tables (option C) despite the loss of the
   aggregation and widgets?
3. **Category name**: `energy-balance` or `energy-balance-sensor` (D.2)? And are 19 types in one
   category acceptable, or should the values be a sibling category?
4. **Multi-meter sites**: devices without energy source feature always belong to the main meter.
   Should `PATCH /device/:selector/electric_meter` (hierarchy D.1) accept them, stored as a device
   param instead of an attachment link?
5. **Power-only devices**: should the core integrate a `power` feature into energy when a device
   publishes no index (many cloud APIs give powers only), or keep the balance index-only and ask the
   integrations to publish indexes?
6. **Priority order** (B.3): export from production before storage, house before storage. Confirm,
   or make the order of cells 1–2 a site setting?
7. **Untracked energy and the initial stock** (B.6): neutral (no gain) as proposed, or valued at the
   off-peak price, or from `battery-energy-remaining` at enable time?
8. **Lost-opportunity in money**: the energy given to the grid is shown in kWh with value 0; should
   the UI also show what it would have saved if self-consumed (kWh × import price), as an
   indicative figure that is not a cash flow?
