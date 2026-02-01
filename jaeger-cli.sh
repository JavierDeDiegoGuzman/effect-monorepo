#!/bin/bash

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

JAEGER_URL="http://localhost:16686"

echo -e "${BLUE}🔍 Jaeger Trace Explorer${NC}"
echo "================================"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Function to list services
list_services() {
    echo -e "${GREEN}📋 Available Services:${NC}"
    curl -s "${JAEGER_URL}/api/services" | jq -r '.data[]' | while read service; do
        echo "  • $service"
    done
    echo ""
}

# Function to get recent traces for a service
get_traces() {
    local service=$1
    local limit=${2:-5}
    
    echo -e "${GREEN}📊 Recent Traces for ${YELLOW}$service${NC} (limit: $limit):"
    echo ""
    
    curl -s "${JAEGER_URL}/api/traces?service=${service}&limit=${limit}" | \
    jq -r '.data[] | "
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TraceID: \(.traceID[0:16])...
Duration: \((.spans | map(.duration) | max) / 1000)ms
Spans: \(.spans | length)
Operations:
\(.spans | map("  → \(.operationName) (\(.duration/1000)ms)") | join("\n"))
"'
}

# Function to get trace details
get_trace_details() {
    local trace_id=$1
    
    echo -e "${GREEN}🔎 Trace Details for ${YELLOW}$trace_id${NC}:"
    echo ""
    
    curl -s "${JAEGER_URL}/api/traces/${trace_id}" | \
    jq -r '.data[0] | "
TraceID: \(.traceID)
Total Spans: \(.spans | length)
Duration: \((.spans | map(.duration) | max) / 1000)ms
Services: \([.spans[].process.serviceName] | unique | join(", "))

Span Timeline:
\(.spans | sort_by(.startTime) | map("
  [\(.startTime)] \(.operationName)
    Service: \(.process.serviceName)
    Duration: \(.duration/1000)ms
    Tags: \(.tags | map("\(.key)=\(.value)") | join(", "))
") | join("\n"))
"'
}

# Function to search traces with filters
search_traces() {
    local service=$1
    local operation=$2
    local limit=${3:-10}
    
    echo -e "${GREEN}🔍 Searching Traces:${NC}"
    echo "  Service: $service"
    echo "  Operation: $operation"
    echo ""
    
    curl -s "${JAEGER_URL}/api/traces?service=${service}&operation=${operation}&limit=${limit}" | \
    jq -r '.data[] | "
TraceID: \(.traceID[0:16])... | Duration: \((.spans | map(.duration) | max) / 1000)ms | Spans: \(.spans | length)
"'
}

# Function to show operations for a service
show_operations() {
    local service=$1
    
    echo -e "${GREEN}⚙️  Operations for ${YELLOW}$service${NC}:"
    echo ""
    
    curl -s "${JAEGER_URL}/api/services/${service}/operations" | \
    jq -r '.data[] | "  • \(.)"'
    echo ""
}

# Function to show metrics
show_metrics() {
    echo -e "${GREEN}📈 Trace Statistics:${NC}"
    echo ""
    
    for service in $(curl -s "${JAEGER_URL}/api/services" | jq -r '.data[]' | grep -v jaeger); do
        local count=$(curl -s "${JAEGER_URL}/api/traces?service=${service}&limit=100" | jq '.data | length')
        echo "  $service: $count traces (last 100)"
    done
    echo ""
}

# Main menu
case "${1}" in
    services|s)
        list_services
        ;;
    traces|t)
        if [ -z "$2" ]; then
            echo -e "${RED}Usage: $0 traces <service> [limit]${NC}"
            exit 1
        fi
        get_traces "$2" "${3:-5}"
        ;;
    trace|td)
        if [ -z "$2" ]; then
            echo -e "${RED}Usage: $0 trace <trace_id>${NC}"
            exit 1
        fi
        get_trace_details "$2"
        ;;
    search|sr)
        if [ -z "$2" ] || [ -z "$3" ]; then
            echo -e "${RED}Usage: $0 search <service> <operation> [limit]${NC}"
            exit 1
        fi
        search_traces "$2" "$3" "${4:-10}"
        ;;
    operations|ops)
        if [ -z "$2" ]; then
            echo -e "${RED}Usage: $0 operations <service>${NC}"
            exit 1
        fi
        show_operations "$2"
        ;;
    metrics|m)
        show_metrics
        ;;
    server)
        get_traces "effect-rpc-server" "${2:-5}"
        ;;
    client)
        get_traces "effect-rpc-client" "${2:-5}"
        ;;
    *)
        echo -e "${YELLOW}Usage:${NC}"
        echo "  $0 services              - List all services"
        echo "  $0 server [limit]        - Show server traces (shortcut)"
        echo "  $0 client [limit]        - Show client traces (shortcut)"
        echo "  $0 traces <service> [n]  - Show recent traces for service"
        echo "  $0 trace <trace_id>      - Show detailed trace info"
        echo "  $0 operations <service>  - Show operations for service"
        echo "  $0 search <svc> <op> [n] - Search traces by operation"
        echo "  $0 metrics               - Show trace statistics"
        echo ""
        echo -e "${YELLOW}Examples:${NC}"
        echo "  $0 services"
        echo "  $0 server 10"
        echo "  $0 client"
        echo "  $0 operations effect-rpc-server"
        echo "  $0 search effect-rpc-server RPC.CreateUser"
        echo ""
        ;;
esac
