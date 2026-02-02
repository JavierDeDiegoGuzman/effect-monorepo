# Observability Documentation

Learn how to use OpenTelemetry tracing, metrics, and Jaeger in this monorepo.

## Quick Links

- **[Tracing Guide](./tracing.md)** ⭐ - Start here! Simplified tracing with Effect
- **[Observability Overview](./OBSERVABILITY.md)** - High-level architecture
- **[Telemetry Setup](./TELEMETRY.md)** - OpenTelemetry configuration
- **[Jaeger UI Guide](./jaeger-ui.md)** - How to use the Jaeger web interface
- **[Jaeger CLI](./jaeger-cli.md)** - Command-line tools for Jaeger
- **[View Traces](./view-traces.md)** - Quick guide to viewing traces

## Getting Started

1. **Start Jaeger**:
   ```bash
   docker compose up -d
   ```

2. **Run the app**:
   ```bash
   bun run dev
   ```

3. **View traces**:
   Open http://localhost:16686

4. **Read the tracing guide**:
   See [tracing.md](./tracing.md) for patterns and examples.
