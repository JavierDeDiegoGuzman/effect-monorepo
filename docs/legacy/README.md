# Legacy Documentation

⚠️ **OUTDATED** - These documents describe an old implementation that has been replaced.

## What Changed

The original implementation used a complex "wide events" system with FiberRef-based state management (`wideEvent.ts`). This has been **replaced with a simpler approach** using Effect's built-in tracing primitives.

### Old Approach (Deprecated)
- Complex `wideEvent.ts` with FiberRef state management
- Helper functions: `addRpcContext`, `addUserContext`, `addFeatureFlags`, `emitWideEvent`
- Custom wide event infrastructure

### New Approach (Current)
- Simple `Effect.annotateCurrentSpan` for all annotations
- Direct `Effect.tapError` for error handling
- No intermediate state management
- More Effect-idiomatic

## Current Documentation

See **[docs/observability/tracing.md](../observability/tracing.md)** for the current implementation.

---

## Files in this folder

- **LOGGING_SUCKS.md** - Original wide events concept (outdated code examples)
- **WIDE_EVENTS_GUIDE.md** - Implementation guide for old system
- **WIDE_EVENTS_QUERIES.md** - Query examples (concepts still valid, implementation changed)

These are kept for historical reference only.
