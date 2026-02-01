# Guía Visual: Cómo usar Jaeger UI

Tu setup actual funciona perfectamente. Solo necesitas aprender a navegar la UI de Jaeger.

## Página Principal: Search

### URL: http://localhost:16686

**Campos principales**:

```
┌─────────────────────────────────────────────┐
│ Service:    [effect-rpc-server      ▼]     │ ← Selecciona tu servicio
│                                              │
│ Operation:  [all                    ▼]     │ ← Filtra por operación específica
│             • RPC.CreateUser                │   (GetUsers, CreateUser, etc.)
│             • RPC.GetUsers                  │
│             • http.server POST              │
│                                              │
│ Tags:       [+ Add tag]                     │ ← Filtros avanzados
│             ┌─────────────────────────┐     │
│             │ user.subscription=premium│     │ ← Ejemplo de filtro
│             └─────────────────────────┘     │
│                                              │
│ Lookback:   [Last 1 Hour           ▼]     │ ← Rango de tiempo
│                                              │
│         [Find Traces]                        │ ← Buscar
└─────────────────────────────────────────────┘
```

## Ver Logs vs. Ver Trazas

### Logs (en terminal)
Los logs aparecen en la terminal donde ejecutaste `bun run dev`:

```bash
[21:28:16.309] INFO (#23): Wide Event
  request_id: "req_abc123"
  trace_id: "d1bdfa4de01027d4"
  user: {
    id: "5",
    subscription: "free",
    account_age_days: 0
  }
  rpc: {
    method: "CreateUser",
    operation_type: "mutation"
  }
  outcome: "success"
```

**Para ver logs estructurados mejor**: usa `| jq` para formatear JSON

```bash
bun packages/server/src/index.ts 2>&1 | grep "Wide Event" | jq .
```

### Trazas (en Jaeger UI)

Las trazas son **visualizaciones interactivas** del flujo de requests.

## Ejemplo Práctico: Buscar CreateUser

### Paso 1: Ir a Search
http://localhost:16686

### Paso 2: Seleccionar Service
```
Service: effect-rpc-server
```

### Paso 3: Seleccionar Operation
```
Operation: RPC.CreateUser
```

### Paso 4: Click "Find Traces"

### Resultado: Lista de trazas
```
┌──────────────────────────────────────────────────────────────┐
│ effect-rpc-server: RPC.CreateUser                            │
│ ════════════════════════════════════════════════════════════ │
│                                                               │
│ Trace ID: d1bdfa4de...  │ Duration: 27ms │ Spans: 5         │
│ ▼ 2024-01-15 10:23:45   │                │                   │
│                                                               │
│ Trace ID: e78b53fd7a...  │ Duration: 14ms │ Spans: 5         │
│ ▼ 2024-01-15 10:15:32   │                │                   │
└──────────────────────────────────────────────────────────────┘
        ↑ Click aquí para expandir
```

### Paso 5: Click en una traza

Verás la **Timeline** de spans:

```
Trace Timeline (27ms total):
═══════════════════════════════════════════════════════════════

RpcClient.CreateUser ═══════════════════════════════════════  27ms
  ├─ http.client POST ═══════════════════════════════════    14ms
  │   └─ http.server POST ════════════                       4ms
  │       └─ RpcServer.CreateUser ═══                        2ms
  │           └─ RPC.CreateUser ══                           1.5ms

Browser                    Network         Server
```

### Paso 6: Expandir un span

Click en `RPC.CreateUser` para ver **todos los tags** (wide event fields):

```
┌─────────────────────────────────────────────────────────┐
│ Span: RPC.CreateUser                                     │
│ Duration: 1.566ms                                        │
│ ───────────────────────────────────────────────────────  │
│ Tags:                                                    │
│   rpc.method: CreateUser                                │
│   operation.type: mutation                              │
│   user.id: 5                                            │
│   user.name: javier                                     │
│   user.email: javier@tests.es                           │
│   user.subscription: free                               │
│   user.account_age_days: 0                              │
│   user.lifetime_value_cents: 0                          │
│   feature_flag.new_user_onboarding_flow: true          │
│   feature_flag.auto_assign_free_trial: false           │
│   feature_flag.send_welcome_email: true                │
│   outcome: success                                      │
│   otel.scope.name: effect-rpc-server                   │
│ ───────────────────────────────────────────────────────  │
│ Logs:                                                    │
│   [10:23:45.717] User created {userId: "5", name: "..."}│
└─────────────────────────────────────────────────────────┘
```

**Aquí está tu wide event completo!** 👆

## Búsquedas Avanzadas con Tags

### Ejemplo 1: Errores de usuarios premium

```
Service: effect-rpc-server
Tags:
  - outcome=error
  - user.subscription=premium
```

Click "Find Traces" → Solo verás errores de usuarios premium

### Ejemplo 2: Requests con feature flag específico

```
Service: effect-rpc-server
Operation: RPC.CreateUser
Tags:
  - feature_flag.new_user_onboarding_flow=true
```

### Ejemplo 3: Requests lentos

```
Service: effect-rpc-server
Min Duration: 100ms
```

Solo muestra traces que tardaron más de 100ms

## Anatomía de una Traza

```
┌─────────────────────────────────────────────────────────────┐
│ Trace d1bdfa4de01027d4484fc7ad7c396440                      │
│                                                              │
│ Services: 2 (effect-rpc-client, effect-rpc-server)         │
│ Total Duration: 27ms                                        │
│ Total Spans: 5                                              │
│ ════════════════════════════════════════════════════════════│
│                                                              │
│ 0ms    5ms    10ms   15ms   20ms   25ms                    │
│ ├──────┼──────┼──────┼──────┼──────┼                       │
│                                                              │
│ ▼ RpcClient.CreateUser (browser)  27ms                     │
│   ▼ http.client POST (browser)    14ms                     │
│     ▼ http.server POST (server)   4ms                      │
│       ▼ RpcServer.CreateUser      2ms                      │
│         ▼ RPC.CreateUser          1.5ms ← Wide Event aquí! │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Cada span anidado** = una operación dentro de otra
**El span más interno** (`RPC.CreateUser`) tiene todos los tags del wide event

## Comparación: Logs vs. Trazas

### Logs (Terminal)
✅ **Bueno para**: Ver eventos en tiempo real, debugging local
❌ **Malo para**: Buscar en el pasado, correlacionar requests

**Ejemplo de log**:
```
[21:28:16.309] INFO: Wide Event
  request_id: req_abc123
  user: { id: "5", subscription: "free" }
  outcome: success
```

### Trazas (Jaeger)
✅ **Bueno para**: Buscar en histórico, visualizar flujo, filtrar por criterios
❌ **Malo para**: Ver eventos en tiempo real

**Ejemplo de traza**: (visual con timeline, spans anidados, todos los tags)

## Flujo de Trabajo Típico

### Desarrollo: Usa logs
```bash
bun run dev
# Mira los logs en terminal mientras desarrollas
```

### Debugging: Usa trazas
```
1. Usuario reporta issue
2. Abrir Jaeger
3. Buscar por user.email o request_id
4. Ver toda la traza con contexto completo
```

## Tips Útiles

### 1. Copiar Trace ID del log

En el log verás:
```
trace_id: "d1bdfa4de01027d4484fc7ad7c396440"
```

Copia y pega en Jaeger search bar:
```
http://localhost:16686/trace/d1bdfa4de01027d4484fc7ad7c396440
```

### 2. Comparar múltiples trazas

Abre 2 trazas en tabs diferentes del browser para comparar:
- "Con feature flag" vs. "Sin feature flag"
- "Usuario premium" vs. "Usuario free"

### 3. Usar el CLI que creamos

```bash
# Ver últimas trazas del servidor
./jaeger-cli.sh server 10

# Buscar CreateUser específicamente
./jaeger-cli.sh search effect-rpc-server RPC.CreateUser

# Ver traza detallada
./jaeger-cli.sh trace d1bdfa4de01027d4484fc7ad7c396440
```

## Ejercicio Práctico

**Vamos a crear 2 usuarios y comparar sus trazas**:

### 1. Inicia todo:
```bash
docker compose up -d
bun run dev
```

### 2. Crea usuario 1:
- Ve a http://localhost:5173
- Crea usuario "Alice"

### 3. Crea usuario 2:
- Crea usuario "Bob"

### 4. Busca en Jaeger:
- Ve a http://localhost:16686
- Service: `effect-rpc-server`
- Operation: `RPC.CreateUser`
- Lookback: Last 5 minutes
- Click "Find Traces"

**Deberías ver 2 trazas** (una por cada usuario creado)

### 5. Expande la primera traza:
- Click en la traza más reciente
- Expande el span `RPC.CreateUser`
- Mira los tags: `user.name=Bob`, `user.id=...`

### 6. Expande la segunda traza:
- Browser back
- Click en la otra traza
- Mira los tags: `user.name=Alice`, `user.id=...`

**¡Ahora entiendes cómo funcionan las trazas!**

## Resumen

### Para ver logs:
- ✅ Terminal donde corre `bun run dev`
- ✅ Tiempo real
- ✅ Output en JSON

### Para ver trazas:
- ✅ Jaeger UI: http://localhost:16686
- ✅ Histórico (últimas 24 horas por defecto)
- ✅ Búsqueda por tags, filtros, duración

### Wide Events aparecen en:
- ✅ **Logs**: Como un objeto JSON grande
- ✅ **Trazas**: Como tags individuales en el span RPC.*

**No necesitas collector** - tu setup actual ya funciona perfecto. Solo necesitas practicar con la UI.

---

**Próximo paso**: Prueba crear un usuario y busca su traza en Jaeger. Dime qué ves!
