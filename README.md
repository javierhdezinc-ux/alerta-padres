# Enseñanza Digna — motor de IA (aparte de la app)

La PWA del colegio **no se modifica**. Este folder es lo que se paga: tokens.

## Qué hace

| Ruta | Para quién | Modelo |
|---|---|---|
| `POST /agente` | Maestro (clase, papeleo, recado) | Barato; sube a fuerte si hay adicción/bullying |
| `POST /prevencion` | Textos para padres | Siempre fuerte |
| `POST /aviso` | Borrador de falta/conducta unidireccional | Barato |
| `GET /salud` | Ver qué llaves hay | — |
| `GET /uso` | Topes del mes (header `X-Admin-Token`) | — |

Topes por defecto: **$8,000 MXN/mes por escuela** y **$120 MXN/mes por maestro**. Se cambian en `.env`.

## Qué tienen que pagar ustedes (plataformas)

No hace falta contratar todas. Con **una barata + una fuerte** alcanza.

### Capa barata (obligatoria para no fundirse)
1. [Groq](https://console.groq.com) — llama gratis/barato, tarjeta. Llave `GROQ_API_KEY`.
2. o [OpenRouter](https://openrouter.ai) — muchos modelos, recargas chicas. `OPENROUTER_API_KEY`.

### Capa fuerte (temas sensibles)
1. [xAI / Grok](https://console.x.ai) — `XAI_API_KEY`
2. o [OpenAI](https://platform.openai.com) — `OPENAI_API_KEY`

### No es token, pero sí se paga aparte
- Hosting de **este** router: Railway / Render / un VPS México (~$5–15 USD/mes).
- Mercado Pago = los $99 del padre, no este motor.
- Donadora = crowdfunding, no este motor.

## Cómo encenderlo

```bash
cd ed-ai-router
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edita .env y pega al menos GROQ_API_KEY
python router.py
```

Prueba:

```bash
curl http://127.0.0.1:8787/salud
curl -X POST http://127.0.0.1:8787/agente \
  -H 'Content-Type: application/json' \
  -d '{"maestro_id":"m1","grado":"5°","materia":"ciencias","tarea":"Prepárame una clase de fotosíntesis de 50 minutos"}'
```

## Cómo lo usa el maestro sin tocar la PWA

Mientras el estudio entrega la v1, el maestro abre este endpoint (o un formulario web mínimo que apunte aquí). El día que exista la plataforma 21+, el mismo `/agente` se enchufa detrás del botón que ya conocen.

## Lo que este motor NO hace

- No cobra $99.
- No guarda padrones de alumnos.
- No diagnostica.
- No habla con menores.
- No es el IRE clínico (eso es otro contrato).
