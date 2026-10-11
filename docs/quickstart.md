# Run and Test

## Requirements

- Node.js 22 or 24 and npm.
- Docker with Compose v2 for the local database, or an existing isolated MariaDB 11.4 database.
- Internet for the first dependency download and the original interface's external CSS/JavaScript libraries.

Run these commands from the repository root:

```sh
npm ci
npm run setup
docker compose up -d --wait
npm run seed
npm start
```

Open **http://localhost:3030/login**. The setup command creates a private `.env` with random credentials and preserves an existing file. The database is published only on `127.0.0.1:3307`; it is not a public service.

## Demo Accounts

| Account | Role |
| --- | --- |
| `admin@example.test` | Administrator; opens `/policy` |
| `customer@example.test` | Customer; cannot modify policies |

Both synthetic accounts use the `DEMO_PASSWORD` in your local `.env`. To display it in your terminal:

```sh
node --env-file=.env -p "process.env.DEMO_PASSWORD"
```

The seed creates missing demo accounts and a sample product. Running it again does not overwrite accounts or duplicate the product. These are fictional laboratory records, not original users or transactions.

## Five-Minute Walkthrough

1. Log in as the administrator and open `/policy`.
2. Inspect age, country and schedule settings. Defaults leave policies inactive so the first login does not need geolocation services. Decline browser location access if not testing geographic rules.
3. Set a minimum age and save. Reload to check persistence.
4. Log out and log in as the customer. The policy management page/API must reject this account.
5. Keep geographic rules disabled for an offline demonstration. Real geographic checks may depend on browser permission, IP lookup and external reverse geocoding.

In a second terminal, while the app is running:

```sh
npm test
npm run smoke
```

`npm test` covers policy authorization and login route reachability without a database. `npm run smoke` uses the real running application and SQL database: health, login, session cookie, policy read/write and customer rejection. It sets the demo age policy to inactive with bounds 18-90; use it only on the laboratory database.

## Existing MariaDB Instead of Docker

Create a new empty database and a dedicated database user, import `database/schema.sql`, then edit `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` and `DB_NAME` in `.env`. Run `npm run seed` and `npm start`. Do not import into a database containing real information.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `.env` missing | Run `npm run setup` before `npm start`. |
| Docker not found/unavailable | Install/start Docker, or use the existing-database option. |
| `ECONNREFUSED` or health returns 503 | Check `docker compose ps`, database health and `.env` port. |
| Tables missing | Schema initializes on the first creation of the Compose database volume. Import it manually only into an empty lab database. |
| Login fails after changing `.env` | Existing seeded password hashes are preserved; use the password used for the original seed. |
| Port 3030 already occupied | Set `PORT` in `.env`; use the resulting URL. |
| Some storefront pictures missing | Third-party storefront assets were excluded. Policy figures remain in the repository; this is not a complete commercial store theme. |

Stop Node with Ctrl+C. `docker compose stop` stops the local database without deleting its records.

## Scope and Verification

The portfolio edition adds repeatable configuration, fictional seed records, policy authorization tests and dependency updates. Clean npm installation, SQL schema import, repeated seeding, real admin/customer logins and policy read/write were tested on Windows with Node 24 and a temporary MariaDB 11.4.10 instance. The Docker container route is provided but was not executed on the review machine.

This does not certify every checkout, payment, geographic or upload route. The source remains an academic prototype, not a production security product. The historical implementation includes legacy authentication paths and policy-error fallbacks that require a broader security review before deployment. The optional `AI/` experiment is excluded from the quickstart because its dataset and trained model are not distributed. The P model is studied separately with the P language toolchain.

References: [Node environment-file support](https://nodejs.org/api/cli.html#--env-filefile), [Compose startup readiness](https://docs.docker.com/compose/how-tos/startup-order/).
