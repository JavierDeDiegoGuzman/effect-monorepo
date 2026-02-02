# Documentation Index

Welcome to the Effect RPC Monorepo documentation!

## 🚀 Getting Started

**New here?** Start with:
1. Main [README.md](../README.md) - Installation and quick start
2. [Tracing Guide](./observability/tracing.md) - Learn the simplified tracing approach

## 📖 Documentation Structure

### 🔍 Observability
Learn about distributed tracing, metrics, and Jaeger.

- **[📘 Tracing Guide](./observability/tracing.md)** ⭐ **START HERE**
- [Observability Overview](./observability/OBSERVABILITY.md) - Architecture
- [Telemetry Setup](./observability/TELEMETRY.md) - OpenTelemetry configuration  
- [Jaeger UI Guide](./observability/jaeger-ui.md) - Web interface
- [Jaeger CLI](./observability/jaeger-cli.md) - Command-line tools
- [View Traces](./observability/view-traces.md) - Quick reference

### 🛠️ Development
For developers working on this monorepo.

- [Complete Guide](./development/COMPLETE_GUIDE.md) - Comprehensive patterns
- [AI Agents Guide](./development/AGENTS.md) - For AI assistants
- [Dev Logs](./development/DEV-LOGS.md) - Troubleshooting

### 📦 Package Documentation
Individual package READMEs:

- [CLI Package](../packages/cli/README.md) - Command-line tool
- [Contract Package](../packages/contract/) - Shared schemas
- [Server Package](../packages/server/) - Backend server
- [App Package](../packages/app/) - React frontend

### 🗄️ Legacy
Outdated documentation (kept for reference):

- [Legacy Docs](./legacy/README.md) - Old wide events implementation

## 🎯 Quick Links

| I want to... | Go to... |
|--------------|----------|
| Add tracing to my handler | [Tracing Guide](./observability/tracing.md) |
| View traces in Jaeger | [Jaeger UI Guide](./observability/jaeger-ui.md) |
| Understand the architecture | [Complete Guide](./development/COMPLETE_GUIDE.md) |
| Use the CLI tool | [CLI Package](../packages/cli/README.md) |
| Help as an AI agent | [AI Agents Guide](./development/AGENTS.md) |

## 🌟 Highlights

### Simplified Tracing Pattern

We use Effect's built-in primitives (no custom infrastructure):

```typescript
Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan("rpc.method", "CreateUser")
  const user = yield* createUser(payload)
  yield* Effect.annotateCurrentSpan("user.id", user.id)
  return user
}).pipe(
  Effect.withSpan("RPC.CreateUser"),
  Effect.tapError((error: unknown) =>
    Effect.annotateCurrentSpan({
      "error": true,
      "error.message": String(error),
    })
  )
)
```

See [Tracing Guide](./observability/tracing.md) for details.

## 📝 Contributing

When adding new documentation:
- Place observability docs in `docs/observability/`
- Place development docs in `docs/development/`
- Update this index
- Link from main README.md

---

**Questions?** Check [Dev Logs](./development/DEV-LOGS.md) for common issues.
