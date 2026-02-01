# 👀 Cómo Ver los Traces en Jaeger

## 🎯 Traces del Servidor

Ya los estás viendo! Los traces de `effect-rpc-server` aparecen automáticamente porque el servidor exporta constantemente.

## 🌐 Traces del Cliente (Browser)

Para ver los traces del **cliente** (`effect-rpc-client`), sigue estos pasos:

### Paso 1: Abre la App en el Browser

```bash
# Asegúrate de que el servidor esté corriendo
bun run dev
```

Abre: http://localhost:5173

### Paso 2: Interactúa con la App

- Crea algunos usuarios
- Espera 5-10 segundos (el cliente exporta cada 5 segundos)

### Paso 3: Busca Traces del Cliente en Jaeger

1. Abre Jaeger UI: http://localhost:16686
2. En el dropdown de **Service**, selecciona: `effect-rpc-client`
3. Click en **"Find Traces"**

### Paso 4: Explora el Distributed Trace

Ahora deberías ver traces que muestran el **flow completo**:

```
effect-rpc-client: CreateUser (request)
  └─ HTTP POST http://localhost:3000/rpc
      └─ effect-rpc-server: RPC.CreateUser
          └─ user.create (DB operation)
```

## 🔍 Qué Buscar

### Spans del Cliente:
- **Service**: `effect-rpc-client`
- **Operations**: 
  - RPC calls to server
  - Query/mutation operations
  - Stream subscriptions

### Spans del Servidor:
- **Service**: `effect-rpc-server`
- **Operations**:
  - `RPC.GetUsers`
  - `RPC.GetUser`
  - `RPC.CreateUser`
  - `RPC.SubscribeEvents`

### Annotations en los Spans:
- `rpc.method` - Nombre del método RPC
- `operation.type` - query, mutation, stream
- `user.id`, `user.name`, `user.email` - Datos del usuario
- `result.count` - Número de resultados
- `error` - Si hubo error

## 🐛 Troubleshooting

### No veo traces del cliente?

**1. Verifica la consola del browser:**
```javascript
// Abre DevTools (F12) > Console
// Deberías ver logs de Effect
```

**2. Verifica CORS:**
```bash
curl -X OPTIONS http://localhost:4318/v1/traces \
  -H "Origin: http://localhost:5173" \
  -v 2>&1 | grep -i access-control
```

Deberías ver:
```
< Access-Control-Allow-Origin: *
```

**3. Verifica que Jaeger esté recibiendo datos:**
```bash
docker logs effect-monorepo-jaeger 2>&1 | grep -i otlp
```

**4. Espera un poco más:**
El cliente exporta cada **5 segundos**, así que ten paciencia!

### Solo veo traces OPTIONS?

Eso es normal! Los browsers envían preflight requests (OPTIONS) antes de POST.

### Los traces están desconectados?

Si ves traces del cliente y servidor por separado, puede ser que:
1. El context propagation no esté funcionando
2. Los timestamps están desfasados

Esto es raro con nuestra configuración, pero si pasa, verifica que ambos servicios estén exportando al mismo Jaeger.

## 📊 Métricas

Las métricas también se exportan! Aunque Jaeger no tiene UI para métricas por defecto.

Para ver métricas, necesitarías:
- Prometheus para scraping
- Grafana para visualización

Eso está fuera del scope de esta implementación inicial.

## 🎉 Ejemplo de Trace Perfecto

Cuando todo funcione, deberías ver algo como:

```
Timeline:
┌────────────────────────────────────────────────────┐
│ effect-rpc-client: CreateUser (50ms)               │
│   ├─ Prepare request (5ms)                         │
│   ├─ HTTP POST /rpc (40ms) ─┐                      │
│   └─ Process response (5ms)  │                     │
│                               │                     │
│   ┌───────────────────────────┘                    │
│   │ effect-rpc-server: RPC.CreateUser (35ms)       │
│   │   ├─ Validate payload (5ms)                    │
│   │   ├─ Store.create (25ms)                       │
│   │   └─ Broadcast event (5ms)                     │
└────────────────────────────────────────────────────┘
```

¡Ahora tienes **full observability** de tu stack Effect! 🚀
