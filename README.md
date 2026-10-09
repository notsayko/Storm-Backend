<img src="https://i.ibb.co/zh4vJ5N2/banner.png" width="900">

# Storm Backend

A Fortnite private-server backend built with **Bun, TypeScript, Express, and MongoDB**.

Storm Backend brings authentication, player profiles, cloud storage, the item shop, V-Bucks rewards, Arena rankings, matchmaking, and Discord integration together in one project.

> [!TIP]
> Need help? Join the [Discord server](https://discord.gg/MCDGDH9nbR). If this project is useful, please star the repository — it helps support future improvements.

> [!WARNING]
> Back up your configuration before making changes. Never publish API keys, tokens, passwords, or other secrets. Use the project responsibly and respect applicable terms of service.

---

## Backend features

<details>
<summary><strong>Authentication & sessions</strong></summary>

### What it does

Handles account sign-in and session management for supported clients.

### Supported flows

- **Client Credentials** — authenticates a launcher or client.
- **Password Grant** — signs in with email and password.
- **Refresh Token** — renews an existing session.
- **Exchange Code** — supports exchange-code login flows.

### Session management

- Enforces one active device per account by invalidating the previous session.
- Uses reported token lifetimes of **8 hours for access tokens** and **24 hours for refresh tokens**.
- Checks account bans before login.
- Can restrict specific game-client versions.

**Implementation:** `auth.ts`

</details>

<details>
<summary><strong>Player profiles & cloud storage</strong></summary>

### What it does

Stores player-owned data such as cosmetics, loadouts, gifts, currencies, and settings.

### Cloud storage

| Storage type | Purpose |
| --- | --- |
| System files | Shared configuration files, such as `.ini` files |
| User files | Player-specific settings, including `ClientSettings.sav` |

The backend supports uploading and downloading configuration files.

### Profile commands

| Command | Purpose |
| --- | --- |
| `EquipBattleRoyaleCustomization` | Equips cosmetics or emotes |
| `SetCosmeticLockerSlot` | Updates a cosmetic locker slot |
| `MarkItemSeen` | Clears an item's “new” indicator |
| `PurchaseCatalogEntry` | Processes a catalog purchase |
| `RemoveGiftBox` | Removes or opens a gift box |

### Profile types

- `athena` — cosmetics and loadouts
- `common_core` — V-Bucks, gifts, and purchase history
- `profile0` — alternative currency
- `creative` and `collections` — creative and collection data

**Implementation:** `main.ts`

</details>

<details>
<summary><strong>Item shop & catalog</strong></summary>

### What it does

Builds shop offers from the project's catalog data.

### Features

- Reads `shop.json` and `catalog.json`.
- Supports **Daily** and **Featured** sections.
- Supports V-Bucks pricing and multi-item bundles.
- Expires offers on a daily schedule.
- Checks the player's balance before a purchase.
- Deducts currency and adds purchased items to the player's `athena` profile.
- Can send a `CatalogPurchase` notification.

The exact shop rotation time and timezone depend on the implementation.

**Implementation:** `main.ts`

</details>

<details>
<summary><strong>V-Bucks rewards API</strong></summary>

### What it does

Provides an API for authorized services to grant V-Bucks rewards.

### How it works

1. A caller sends a reward request with the required API key.
2. The backend checks the configured reward reason and amount.
3. The player's currency-related profile data is updated.
4. The backend can create a `GiftBox`, depending on the implementation.

Example reward mapping:

```text
Kill:25,Win:50
```

This example means a configured `Kill` reward of 25 and `Win` reward of 50. Actual parsing rules depend on the code.

**Security:** Keep the API key private and restrict this endpoint to trusted callers.

**Implementation:** `vbucks.ts`

</details>

<details>
<summary><strong>Arena leaderboard & online players</strong></summary>

### Arena rankings

- Ranks players by Hype points.
- Supports pagination, with up to 50 players per page.
- Can look up a player's rank.
- Displays Arena division information.

### Online-player endpoint

`/api/onlineplayers` provides online-player information based on connected-player tracking.

**Implementation:** `leaderboard.ts`

</details>

<details>
<summary><strong>WebSocket matchmaking</strong></summary>

### Connection flow

```text
Connecting → Queued → SessionAssignment → Play
```

### How it works

1. A client connects to the matchmaking WebSocket service.
2. The service places the client in the queue.
3. The queue count is broadcast to connected clients.
4. The backend creates unique ticket, match, and session identifiers.
5. When the countdown ends, queued players are assigned together.
6. Disconnected clients are cleaned up.

The described countdown starts at 10 seconds for the first player and decreases by 3 seconds per additional player. Confirm timing and edge cases in the source code.

**Implementation:** `index.ts`

</details>

<details>
<summary><strong>Discord bot & role rewards</strong></summary>

### Bot features

- Synchronizes slash commands.
- Can display the current in-game player count.
- Can link Discord bans with in-game bans when cross-bans are enabled.
- Can grant configured rewards based on Discord roles.

### Reported commands

| Command | Purpose |
| --- | --- |
| `/register` | Creates an in-game account |
| `/donate` | Gives V-Bucks to a player |
| `/add` | Adds items to a player's account |
| `/ban` | Applies a temporary or permanent ban |
| `/unban` | Removes a ban |

### Role bundles

| Bundle | Purpose |
| --- | --- |
| `full` | Full cosmetic bundle |
| `og` | Original-season cosmetic bundle |
| `vbucks:X` | Configurable V-Bucks amount |

Role rewards may be triggered when a role is assigned or when a member joins, depending on configuration.

**Implementation:** `index.ts`, `rolebundles.ts`

</details>

<details>
<summary><strong>Custom launcher API</strong></summary>

Provides a separate email/password login flow for custom launchers and returns the username for display. It is separate from the main authentication service.

Because it handles credentials, it should use secure password verification, rate limiting, and generic error messages.

**Implementation:** `launcher.ts`

</details>

<details>
<summary><strong>Database & internal services</strong></summary>

### MongoDB collections

| Collection | Stored data |
| --- | --- |
| `users` | Accounts, bans, and Discord links |
| `profiles` | Cosmetics, items, currencies, and loadouts |
| `friends` | Reserved for a friends feature; reported as not implemented |
| `arena` | Hype points and divisions |

### Supporting modules

| File | Responsibility |
| --- | --- |
| `config.ts` | Loads environment-based configuration |
| `security.ts` | Rate limits, security headers, IP handling, request-size limits |
| `logger.ts` | Backend, bot, error, and debug logs |
| `tokens.ts` | JWT creation, token storage, and expiration |
| `functions.ts` | Version detection, default profiles, registration, UUID helpers |

</details>

<details>
<summary><strong>Technology stack & configuration</strong></summary>

### Stack

| Technology | Role |
| --- | --- |
| Bun | Runtime |
| TypeScript | Application language |
| Express.js | HTTP API framework |
| MongoDB + Mongoose | Database and data modeling |
| `ws` | WebSocket communication |
| Discord.js v13 | Discord bot |
| `bcrypt` | Password hashing |
| `jsonwebtoken` | JWT handling |

### Environment variables

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `PORT` | HTTP port; reported default is `3551` |
| `BOT_TOKEN` | Discord bot token |
| `API_KEY` | V-Bucks API key |
| `MATCHMAKER_IP` | Matchmaker address in `IP:PORT` format |
| `GAME_SERVER_IP` | Comma-separated game server addresses |
| `ROLE_BUNDLES` | Discord role-to-reward mapping |
| `ENABLE_CROSS_BANS` | Enables or disables cross-bans |
| `ENABLE_REBOOT_USER` | Controls the reported account integration |
| `DEBUG_LOGS` | Enables or disables debug logs |

Example template — replace placeholders with your own values:

```dotenv
MONGO_URI=mongodb://127.0.0.1:27017/storm
PORT=3551
BOT_TOKEN=replace_with_your_bot_token
API_KEY=replace_with_a_long_random_key
MATCHMAKER_IP=127.0.0.1:7000
GAME_SERVER_IP=127.0.0.1:7777
ROLE_BUNDLES=ROLE_ID:og
ENABLE_CROSS_BANS=false
ENABLE_REBOOT_USER=false
DEBUG_LOGS=false
```

This is an example template, not a guarantee that these values match your deployment. Check the configuration loader for required variables and expected formats.

</details>

---

## Installation

Install [Bun](https://bun.sh/docs/installation), then install dependencies:

```bash
bun install
```

Start the backend using the entry point configured in your project. For example:

```bash
bun run src/index.ts
```

Check the actual entry point and configure the required environment variables before running the server.

## Contributing

Contributions that improve documentation, reliability, testing, and security are welcome.

1. Fork the repository.
2. Create a branch for your changes.
3. Explain the change and how to test it.
4. Open a pull request.

Do not include real credentials, tokens, or private player data in commits or issues.

---

*Storm Backend — TypeScript backend services for a custom Fortnite server environment.*
