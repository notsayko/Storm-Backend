# STORM BACKEND
<img src="https://i.ibb.co/zh4vJ5N2/banner.png" width="900">
by @notsayko and @metixw


> [!WARNING]
> Back up your configuration before making changes. Incorrect environment variables or invalid configuration can prevent Storm Backend from starting. Never publish real tokens, API keys, passwords, or other secrets.

> [!TIP]
> Need help or want to discuss the project? Join the [Discord server](https://discord.gg/MCDGDH9nbR). If this README is useful to you, please **star the repository** — it really helps support more documentation and updates.

---

# Storm Backend

A private Fortnite server backend built with **Bun**, **TypeScript**, **Express**, and **MongoDB**. Storm Backend is designed to emulate selected backend services so players can connect to custom game sessions.

> **Project note:** This README summarizes the features and configuration described for the project. Actual behavior depends on the implementation and deployment configuration.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
  - [Authentication and Sessions](#authentication-and-sessions)
  - [Player Profiles and Cloud Storage](#player-profiles-and-cloud-storage)
  - [Item Shop](#item-shop)
  - [V-Bucks Rewards API](#v-bucks-rewards-api)
  - [Arena Leaderboard and Online Players](#arena-leaderboard-and-online-players)
  - [Matchmaking](#matchmaking)
  - [Discord Integration](#discord-integration)
  - [Launcher API](#launcher-api)
- [Database Collections](#database-collections)
- [Technology Stack](#technology-stack)
- [Configuration](#configuration)
- [Security Considerations](#security-considerations)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

## Overview

Storm Backend brings several services together behind one backend:

- Account authentication and session management
- Player profiles, cosmetics, and cloud settings
- A configurable item shop and purchase handling
- V-Bucks reward administration
- Arena rankings and online-player information
- WebSocket-based matchmaking
- Discord bot commands and role-based rewards
- A separate login API for custom launchers

## Features

### Authentication and Sessions

Implemented in `auth.ts`, the authentication system supports these reported flows:

- **Client Credentials** for launcher authentication
- **Password Grant** for email/password login
- **Refresh Tokens** for renewing sessions
- **Exchange Codes** for multi-platform login flows
- Optional account registration support for ProjectReboot.dev accounts

Session handling includes:

- One active device per account, with previous sessions evicted when a new session is created
- Access-token lifetime of 8 hours and refresh-token lifetime of 24 hours
- Ban checks before login
- Optional client-version restrictions

Token lifetimes and supported flows should be confirmed against the current implementation before relying on them in production.

### Player Profiles and Cloud Storage

Profile and cloud-storage handling is reported in `main.ts`.

Cloud storage supports:

- **System files** for shared configuration files, such as `.ini` files
- **User files** for player-specific settings, including `ClientSettings.sav`
- Uploading and downloading player configuration files

Reported profile commands include:

| Command | Purpose |
| --- | --- |
| `EquipBattleRoyaleCustomization` | Equip a cosmetic, emote, or other customization |
| `SetCosmeticLockerSlot` | Update a cosmetic locker slot |
| `MarkItemSeen` | Mark an item as seen and clear its “new” indicator |
| `PurchaseCatalogEntry` | Purchase an item from the catalog |
| `RemoveGiftBox` | Remove or open a received gift box |

Supported profile types are reported to include:

- `athena` — cosmetics and loadouts
- `common_core` — V-Bucks, gifts, and purchase history
- `profile0` — alternative currency
- `creative` and `collections` — creative-mode and collection data

### Item Shop

The shop implementation is reported in `main.ts`.

Its features include:

- Loading shop data from `shop.json` and `catalog.json`
- Daily and Featured shop sections
- Offers priced in V-Bucks
- Bundles containing multiple items
- Daily offer expiration at midnight
- Balance checks before purchase
- Automatic currency deduction and item delivery to the player's `athena` profile
- `CatalogPurchase` notifications

The exact rotation schedule and timezone should be verified in the shop implementation.

### V-Bucks Rewards API

The reward API is reported in `vbucks.ts`.

- Requires an API key
- Supports configurable reward reasons and amounts
- Can create a `GiftBox` in the player's profile
- Can be integrated with game servers to issue rewards automatically

Example reward configuration:

```text
Kill:25,Win:50
```

Keep the API key private. Do not commit real keys, tokens, or production credentials to the repository.

### Arena Leaderboard and Online Players

The leaderboard implementation is reported in `leaderboard.ts`.

- Ranks players by Arena Hype points
- Supports pagination, with up to 50 players per page
- Can look up a specific player's rank
- Displays Arena division information
- Exposes `/api/onlineplayers` for online-player information
- Uses WebSocket connections to track connected players

### Matchmaking

The matchmaking service is reported in `index.ts` and uses WebSockets on a separate port.

The described flow is:

```text
Connecting → Queued → SessionAssignment → Play
```

Reported behavior includes:

- Generating unique `ticketId`, `matchId`, and `sessionId` values
- Broadcasting the number of players in the queue
- Starting a countdown when players join
- Grouping queued players into a session when the countdown ends
- Cleaning up disconnected clients

The reported countdown starts at 10 seconds for the first player and decreases by 3 seconds for each additional player. Confirm the exact timing and minimum/maximum values in the implementation.

### Discord Integration

The Discord bot is reported in `index.ts` and uses Discord.js v13.

Features include:

- Synchronizing slash commands
- Showing the in-game player count in the bot's status
- Optional cross-bans between Discord and the game
- Role-based reward bundles

Reported commands:

| Command | Purpose |
| --- | --- |
| `/register` | Create an in-game account |
| `/donate` | Give V-Bucks to a player |
| `/add` | Add items to a player's account |
| `/ban` | Apply a temporary or permanent ban |
| `/unban` | Remove a ban |

Role bundles are reported in `rolebundles.ts`:

| Bundle type | Description |
| --- | --- |
| `full` | Full cosmetic bundle |
| `og` | Original-season cosmetic bundle |
| `vbucks:X` | Configurable V-Bucks amount |

Bundles may be triggered when a role is assigned or when a member joins the Discord server, depending on configuration.

### Launcher API

`launcher.ts` provides a separate login endpoint for custom launchers.

The reported flow uses email/password credentials and returns the username for display. It is separate from the main OAuth-style authentication flow.

Because this is a separate authentication path, it should use appropriate password verification, rate limiting, and error handling.

## Database Collections

Storm Backend uses MongoDB, with Mongoose reported as the object-document mapper.

| Collection | Purpose |
| --- | --- |
| `users` | Accounts, ban state, and Discord links |
| `profiles` | Items, cosmetics, V-Bucks, and loadouts |
| `friends` | Reserved for a friends system; reported as not implemented |
| `arena` | Arena Hype points and divisions |

## Technology Stack

| Technology | Role |
| --- | --- |
| Bun | JavaScript/TypeScript runtime |
| TypeScript | Application language |
| Express.js | HTTP API framework |
| MongoDB | Database |
| Mongoose | MongoDB object modeling |
| `ws` | WebSocket matchmaking |
| Discord.js v13 | Discord bot integration |
| `bcrypt` | Password hashing |
| `jsonwebtoken` | JWT handling |

## Configuration

Create a local `.env` file and configure the values required by your deployment. Do not commit this file if it contains secrets.

The following names are reported by the project description; check the source code for the exact expected formats and defaults.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `PORT` | HTTP server port; reported default is `3551` |
| `BOT_TOKEN` | Discord bot token |
| `API_KEY` | Key for the V-Bucks reward API |
| `MATCHMAKER_IP` | Matchmaker address in `IP:PORT` format |
| `GAME_SERVER_IP` | Game server addresses, separated by commas |
| `ROLE_BUNDLES` | Role-to-bundle mappings, such as `ROLE_ID:bundle_type` |
| `ENABLE_CROSS_BANS` | Enables or disables Discord/game cross-bans |
| `ENABLE_REBOOT_USER` | Controls the reported ProjectReboot.dev account support |
| `DEBUG_LOGS` | Enables or disables debug logging |

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

This is a template, not a guarantee that every variable is optional or that these example addresses match your deployment. Check the configuration loader before starting the server.

## Security Considerations

Before exposing a deployment to the internet:

- Store secrets in environment variables or a secret manager.
- Never commit `.env`, API keys, bot tokens, JWT secrets, or player credentials.
- Hash passwords using a suitable password-hashing algorithm.
- Apply strict rate limits to authentication and administrative endpoints.
- Validate and sanitize request data.
- Use HTTPS behind a properly configured reverse proxy.
- Restrict the V-Bucks administration API to trusted callers.
- Avoid logging passwords, tokens, session identifiers, or other sensitive data.
- Verify authorization on every account, profile, and moderation action.
- Keep dependencies updated and review the security implications of each integration.

The project description also reports request-size limits, security headers, IP normalization for proxy deployments, and endpoint-specific rate limiting in `security.ts`.

## Project Structure

The following is a high-level map of the files mentioned in the project description. It is not a complete directory listing.

```text
.
├── auth.ts
├── main.ts
├── vbucks.ts
├── leaderboard.ts
├── index.ts
├── launcher.ts
├── rolebundles.ts
├── config.ts
├── security.ts
├── logger.ts
├── tokens.ts
└── functions.ts
```

| File | Reported responsibility |
| --- | --- |
| `auth.ts` | Authentication and session handling |
| `main.ts` | Profiles, cloud storage, and item shop |
| `vbucks.ts` | V-Bucks reward API |
| `leaderboard.ts` | Arena rankings and online-player endpoint |
| `index.ts` | Matchmaking and Discord bot integration |
| `launcher.ts` | Custom launcher login |
| `rolebundles.ts` | Discord role-based rewards |
| `config.ts` | Environment-based configuration |
| `security.ts` | Rate limits, headers, IP handling, and request limits |
| `logger.ts` | Structured application logs |
| `tokens.ts` | JWT generation, token storage, and expiration |
| `functions.ts` | Version detection, default profiles, registration, and UUID helpers |

## Contributing

Contributions that improve documentation, reliability, testing, and security are welcome.

When submitting a change:

1. Explain what the change does and why it is needed.
2. Include reproduction steps for bug fixes.
3. Update documentation when behavior or configuration changes.
4. Never include real credentials, private player data, or production secrets in issues or pull requests.

---

**Storm Backend** — a TypeScript-based backend project for a custom Fortnite server environment.
