#!/usr/bin/env python3
"""Enseñanza Digna — router de IA.
La PWA del colegio no se toca. Este servicio vive aparte.
Solo paga tokens de las llaves que ponga en .env
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
PROMPTS = ROOT / "prompts"
USAGE = ROOT / "uso.json"

SENSIBLE = (
    "adicc", "droga", "alcohol", "marihuana", "bullying", "acoso",
    "suic", "autoles", "abuso", "depre", "cortarse", "ire",
)


def read_prompt(name: str) -> str:
    return (PROMPTS / name).read_text(encoding="utf-8")


def load_uso() -> dict:
    if USAGE.exists():
        return json.loads(USAGE.read_text(encoding="utf-8"))
    return {"mes": "", "escuelas": {}, "maestros": {}}


def save_uso(d: dict) -> None:
    USAGE.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")


def mes_id() -> str:
    return time.strftime("%Y-%m")


def tope_ok(escuela: str, maestro: str, usd: float) -> None:
    mxn = usd * float(os.getenv("USD_MXN", "18"))
    te = float(os.getenv("TOPE_MXN_MES_ESCUELA", "8000"))
    tm = float(os.getenv("TOPE_MXN_MES_MAESTRO", "120"))
    u = load_uso()
    if u.get("mes") != mes_id():
        u = {"mes": mes_id(), "escuelas": {}, "maestros": {}}
    e = u["escuelas"].get(escuela, 0.0) + mxn
    m = u["maestros"].get(maestro, 0.0) + mxn
    if e > te:
        raise HTTPException(402, f"Tope de escuela alcanzado ({te} MXN/mes).")
    if m > tm:
        raise HTTPException(402, f"Tope de maestro alcanzado ({tm} MXN/mes).")
    u["escuelas"][escuela] = e
    u["maestros"][maestro] = m
    save_uso(u)


def estimado_usd(tokens: int, fuerte: bool) -> float:
    # aproximado para no fingir telemetría de cada proveedor
    return (tokens / 1000.0) * (0.008 if fuerte else 0.001)


class PedidoAgente(BaseModel):
    escuela_id: str = "piloto"
    maestro_id: str = "maestro"
    tarea: str = Field(..., min_length=8)
    materia: str | None = None
    grado: str | None = None
    minutos: int | None = None


class PedidoTexto(BaseModel):
    escuela_id: str = "piloto"
    usuario_id: str = "staff"
    texto: str = Field(..., min_length=8)


app = FastAPI(title="Enseñanza Digna AI Router", version="1.0")


def capa_fuerte(texto: str) -> bool:
    t = texto.lower()
    return any(k in t for k in SENSIBLE)


async def llama(system: str, user: str, fuerte: bool) -> str:
    if fuerte and os.getenv("XAI_API_KEY"):
        url = "https://api.x.ai/v1/chat/completions"
        key = os.getenv("XAI_API_KEY")
        model = os.getenv("STRONG_MODEL", "grok-2")
    elif fuerte and os.getenv("OPENAI_API_KEY"):
        url = "https://api.openai.com/v1/chat/completions"
        key = os.getenv("OPENAI_API_KEY")
        model = "gpt-4o-mini"
    elif os.getenv("GROQ_API_KEY"):
        url = "https://api.groq.com/openai/v1/chat/completions"
        key = os.getenv("GROQ_API_KEY")
        model = "llama-3.1-8b-instant"
    elif os.getenv("OPENROUTER_API_KEY"):
        url = "https://openrouter.ai/api/v1/chat/completions"
        key = os.getenv("OPENROUTER_API_KEY")
        model = os.getenv("OPENROUTER_CHEAP_MODEL", "meta-llama/llama-3.1-8b-instruct")
    elif os.getenv("OPENAI_API_KEY"):
        url = "https://api.openai.com/v1/chat/completions"
        key = os.getenv("OPENAI_API_KEY")
        model = "gpt-4o-mini"
    else:
        raise HTTPException(
            503,
            "No hay llaves. Copia .env.example a .env y paga una: GROQ, OpenRouter, xAI u OpenAI.",
        )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.3,
    }
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(url, headers=headers, json=payload)
    if r.status_code >= 400:
        raise HTTPException(r.status_code, r.text[:400])
    data = r.json()
    return data["choices"][0]["message"]["content"]


@app.get("/salud")
def salud():
    llaves = {
        "groq": bool(os.getenv("GROQ_API_KEY")),
        "openrouter": bool(os.getenv("OPENROUTER_API_KEY")),
        "xai": bool(os.getenv("XAI_API_KEY")),
        "openai": bool(os.getenv("OPENAI_API_KEY")),
        "anthropic": bool(os.getenv("ANTHROPIC_API_KEY")),
    }
    return {"ok": True, "llaves": llaves, "mes": mes_id(), "uso": load_uso()}


@app.post("/agente")
async def agente(p: PedidoAgente):
    fuerte = capa_fuerte(p.tarea)
    tope_ok(p.escuela_id, p.maestro_id, estimado_usd(800, fuerte))
    user = (
        f"Grado: {p.grado or 'no indicado'}\n"
        f"Materia: {p.materia or 'no indicada'}\n"
        f"Minutos: {p.minutos or 'no indicado'}\n\n"
        f"Pedido del maestro:\n{p.tarea}"
    )
    texto = await llama(read_prompt("sistema_maestro.txt"), user, fuerte)
    return {"modelo": "fuerte" if fuerte else "barato", "texto": texto}


@app.post("/prevencion")
async def prevencion(p: PedidoTexto):
    tope_ok(p.escuela_id, p.usuario_id, estimado_usd(900, True))
    texto = await llama(read_prompt("sistema_prevencion.txt"), p.texto, True)
    return {"modelo": "fuerte", "texto": texto}


@app.post("/aviso")
async def aviso(p: PedidoTexto):
    tope_ok(p.escuela_id, p.usuario_id, estimado_usd(400, False))
    texto = await llama(read_prompt("sistema_aviso.txt"), p.texto, False)
    return {"modelo": "barato", "texto": texto}


@app.get("/uso")
def uso(x_admin_token: str | None = Header(default=None)):
    if x_admin_token != os.getenv("ADMIN_TOKEN", "cambia-esto"):
        raise HTTPException(401, "Token admin")
    return load_uso()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("router:app", host="0.0.0.0", port=int(os.getenv("PORT", "8787")), reload=False)
