#!/bin/bash

echo "🔍 Testing OpenTelemetry Integration"
echo "===================================="
echo ""

# Check Jaeger is running
echo "1. Checking Jaeger..."
if curl -s http://localhost:16686 | grep -q "Jaeger UI"; then
    echo "   ✅ Jaeger UI is accessible at http://localhost:16686"
else
    echo "   ❌ Jaeger UI is not accessible"
    echo "   Run: docker compose up -d"
    exit 1
fi

# Check OTLP endpoint
echo ""
echo "2. Checking OTLP endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4318/v1/traces)
if [ "$HTTP_CODE" = "405" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ OTLP endpoint is ready at http://localhost:4318"
else
    echo "   ❌ OTLP endpoint not responding (code: $HTTP_CODE)"
    exit 1
fi

# Check TypeScript compilation
echo ""
echo "3. Checking TypeScript compilation..."
if bun run typecheck > /dev/null 2>&1; then
    echo "   ✅ All packages compile without errors"
else
    echo "   ❌ TypeScript errors found"
    exit 1
fi

echo ""
echo "🎉 All checks passed!"
echo ""
echo "Next steps:"
echo "  1. Start dev servers: bun run dev"
echo "  2. Open app: http://localhost:5173"
echo "  3. Create some users"
echo "  4. View traces: http://localhost:16686"
echo ""
