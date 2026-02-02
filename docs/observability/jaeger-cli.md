# 🔍 Jaeger CLI Tool

Script de línea de comandos para explorar trazas de OpenTelemetry en Jaeger sin necesidad de abrir el UI.

## 📋 Requisitos

```bash
# Instalar jq (parser JSON)
brew install jq  # macOS
```

## 🚀 Uso Rápido

```bash
# Ver todos los comandos disponibles
./jaeger-cli.sh

# Listar servicios
./jaeger-cli.sh services

# Ver trazas del servidor (últimas 5)
./jaeger-cli.sh server

# Ver trazas del cliente (últimas 10)
./jaeger-cli.sh client 10

# Ver operaciones disponibles
./jaeger-cli.sh operations effect-rpc-server

# Ver estadísticas
./jaeger-cli.sh metrics
```

## 📖 Comandos Completos

### 1. Listar Servicios
```bash
./jaeger-cli.sh services
```
Output:
```
📋 Available Services:
  • effect-rpc-server
  • effect-rpc-client
```

### 2. Ver Trazas del Servidor (shortcut)
```bash
./jaeger-cli.sh server [limit]
```
Muestra las últimas N trazas del servidor con duración y spans.

### 3. Ver Trazas del Cliente (shortcut)
```bash
./jaeger-cli.sh client [limit]
```
Muestra las últimas N trazas del cliente.

### 4. Ver Trazas de Cualquier Servicio
```bash
./jaeger-cli.sh traces <service> [limit]
```
Ejemplo:
```bash
./jaeger-cli.sh traces effect-rpc-server 10
```

### 5. Ver Detalle de un Trace Específico
```bash
./jaeger-cli.sh trace <trace_id>
```
Ejemplo:
```bash
./jaeger-cli.sh trace 30ae4a455a0d30aece2660054e407525
```

Muestra:
- TraceID completo
- Duración total
- Número de spans
- Timeline detallado con tags

### 6. Ver Operaciones de un Servicio
```bash
./jaeger-cli.sh operations <service>
```
Ejemplo:
```bash
./jaeger-cli.sh operations effect-rpc-server
```
Output:
```
⚙️  Operations for effect-rpc-server:
  • RPC.CreateUser
  • RPC.GetUsers
  • RPC.SubscribeEvents
  • http.server POST
  • http.server OPTIONS
```

### 7. Buscar Trazas por Operación
```bash
./jaeger-cli.sh search <service> <operation> [limit]
```
Ejemplo:
```bash
./jaeger-cli.sh search effect-rpc-server RPC.CreateUser 5
```

### 8. Ver Métricas/Estadísticas
```bash
./jaeger-cli.sh metrics
```
Output:
```
📈 Trace Statistics:
  effect-rpc-server: 9 traces (last 100)
  effect-rpc-client: 5 traces (last 100)
```

## 🎯 Ejemplos de Uso

### Monitoreo en Tiempo Real
```bash
# Ver traces del servidor actualizados cada 2 segundos
watch -n 2 './jaeger-cli.sh server 5'
```

### Debugging de un Problema
```bash
# 1. Ver qué operaciones existen
./jaeger-cli.sh operations effect-rpc-server

# 2. Buscar traces de una operación específica
./jaeger-cli.sh search effect-rpc-server RPC.CreateUser 10

# 3. Ver detalle de un trace problemático
./jaeger-cli.sh trace <trace_id_from_previous_output>
```

### Análisis de Performance
```bash
# Ver las últimas 20 trazas del servidor ordenadas por duración
./jaeger-cli.sh server 20 | grep "Duration:" | sort -k2 -n
```

### Verificar Distributed Tracing
```bash
# Ver mismo trace desde cliente y servidor
TRACE_ID="30ae4a455a0d30aece2660054e407525"
./jaeger-cli.sh trace $TRACE_ID
```

## 🔗 Integración con otros comandos

### Extraer TraceIDs
```bash
# Obtener todos los TraceIDs del servidor
curl -s "http://localhost:16686/api/traces?service=effect-rpc-server&limit=100" | \
  jq -r '.data[].traceID'
```

### Filtrar por duración
```bash
# Encontrar traces lentos (>10ms)
curl -s "http://localhost:16686/api/traces?service=effect-rpc-server&limit=100" | \
  jq '.data[] | select((.spans | map(.duration) | max) > 10000) | .traceID'
```

### Contar operaciones
```bash
# Contar cuántas veces se llamó cada operación
curl -s "http://localhost:16686/api/traces?service=effect-rpc-server&limit=100" | \
  jq -r '.data[].spans[].operationName' | sort | uniq -c | sort -nr
```

## 🎨 Output con Colores

El script usa colores para mejor legibilidad:
- 🔵 **Azul**: Headers
- 🟢 **Verde**: Información exitosa
- 🟡 **Amarillo**: Warnings/énfasis
- 🔴 **Rojo**: Errores

## 🐛 Troubleshooting

### Error: jq not found
```bash
brew install jq
```

### Error: Cannot connect to Jaeger
Verifica que Jaeger esté corriendo:
```bash
docker ps | grep jaeger
curl http://localhost:16686/api/services
```

### No hay traces
Asegúrate de que la aplicación esté corriendo y generando tráfico:
```bash
bun run dev
```

## 🚀 Tips Avanzados

### Crear alias
Añade a tu `.bashrc` o `.zshrc`:
```bash
alias jt='./jaeger-cli.sh'
alias jts='./jaeger-cli.sh server'
alias jtc='./jaeger-cli.sh client'
```

Luego:
```bash
jts 10      # Ver 10 traces del servidor
jtc         # Ver traces del cliente
jt metrics  # Ver métricas
```

### Monitoreo Continuo
```bash
# Terminal 1: Monitorear server
watch -n 1 './jaeger-cli.sh server 5'

# Terminal 2: Monitorear client
watch -n 1 './jaeger-cli.sh client 5'

# Terminal 3: Métricas
watch -n 5 './jaeger-cli.sh metrics'
```

## 📚 API de Jaeger

El script usa la API REST de Jaeger:
- **Servicios**: `GET /api/services`
- **Trazas**: `GET /api/traces?service=<name>&limit=<n>`
- **Trace específico**: `GET /api/traces/<trace_id>`
- **Operaciones**: `GET /api/services/<service>/operations`

Documentación: https://www.jaegertracing.io/docs/latest/apis/

## 🎉 ¡Disfruta explorando tus trazas!
