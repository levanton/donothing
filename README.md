# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Testing

Run the test suite before shipping any change that touches data, UI, or
shared helpers:

```bash
npm test           # one-shot run
npm run test:watch # re-run on save during development
npm run test:coverage
```

The suite uses **Jest** with the `jest-expo` preset. Tests live under
`test/` and mirror the source tree:

- `test/lib/` — pure helpers (format, mood, weekdays, conflicts,
  benefits, schemas, stats, milestones, journey-tags, paywall-config,
  theme).
- `test/db/` — DB layer (migrations, sessions, scheduled-blocks,
  milestones, settings, notification state, wipe). These run against an
  **in-memory `better-sqlite3`** that mocks `expo-sqlite`, so they
  exercise real SQL, constraints, and triggers.
- `test/components/` — React Native smoke tests via
  `@testing-library/react-native`.

When you add a new module:

- **lib helper** → drop a sibling `*.test.ts` under `test/lib/`.
- **DB write/read** → add a Zod schema in `lib/db/schemas.ts`, a test in
  `test/lib/schemas.test.ts`, and an integration test in `test/db/`
  using the `loadDbModules` / `resetDbState` helpers from
  `test/db/helpers.ts`.
- **Native module** → stub it in `test/jest.setup.ts` so component
  tests don't blow up.

### Automated runs

The suite runs in two places automatically:

1. **GitHub Actions** (`.github/workflows/test.yml`) — on every push to
   `master` and every PR. Runs `npm run typecheck` + `npm test --ci`.
   If it goes red, fix it before merging.
2. **Husky pre-push hook** (`.husky/pre-push`) — runs typecheck + tests
   locally before any `git push`. Activated automatically after
   `npm install` via the `prepare` script. Override for genuine
   emergencies with `git push --no-verify`.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
