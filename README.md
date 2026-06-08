# Medical Copilot Monorepo

This is a production-grade Turborepo monorepo for the **Medical Copilot** React Native mobile application.

## Monorepo Structure

```text
apps/
  └── mobile/          — Expo managed workflow mobile application (SDK 51+, TypeScript, NativeWind v4)
packages/
  ├── types/           — Shared TypeScript types only, no runtime dependencies
  ├── api-client/      — Typed Fetch client wrapper using @medcopilot/types
  ├── ui/              — Shared React Native components styled with NativeWind v4
  ├── utils/           — Pure utility functions, no React dependencies
  └── config/          — Shared configurations (eslint, prettier, tsconfig)
```

## Getting Started

This project uses `pnpm` workspaces. Ensure you have `pnpm` installed.

### Installing Dependencies
```bash
pnpm install
```

### Running the App
```bash
# Start the Expo Dev Server
pnpm start:mobile
```

### Pipelines
```bash
# Build all buildable workspaces
pnpm build

# Typecheck all workspaces (strict TypeScript)
pnpm typecheck

# Lint all workspaces
pnpm lint
```
