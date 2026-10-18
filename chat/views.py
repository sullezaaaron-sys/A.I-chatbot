import json
from pathlib import Path

import requests
from django.conf import settings
from django.http import FileResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST

STATIC_DIR = Path(__file__).parent / "static" / "chat"
API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

SYSTEM_PROMPT = (
    "You are a friendly class assistant for students. Explain things in simple, "
    "clear terms with short steps or examples. Keep answers age-appropriate, "
    "accurate and concise. If a request is unsafe or unrelated to learning, "
    "politely steer the student back to schoolwork."
)


def index(request):
    return render(request, "chat/index.html")


def manifest(request):
    return FileResponse(open(STATIC_DIR / "manifest.json", "rb"), content_type="application/manifest+json")


def service_worker(request):
    resp = FileResponse(open(STATIC_DIR / "sw.js", "rb"), content_type="application/javascript")
    resp["Service-Worker-Allowed"] = "/"
    resp["Cache-Control"] = "no-cache"
    return resp


@require_GET
def status(request):
    """Safe diagnostics: never returns the key itself."""
    key = settings.GEMINI_API_KEY
    return JsonResponse({
        "key_loaded": bool(key),
        "key_length": len(key),
        "key_prefix": key[:3] if key else "",
        "model": settings.GEMINI_MODEL,
        "fallbacks": settings.GEMINI_FALLBACK_MODELS,
    })


def _google_message(resp):
    try:
        return resp.json()["error"]["message"]
    except Exception:
        return resp.text[:200]


@require_POST
def chat_api(request):
    if not settings.GEMINI_API_KEY:
        return JsonResponse(
            {"error": "Server is missing GEMINI_API_KEY. Put it in the .env file next to manage.py, then restart the server."},
            status=500,
        )

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid request."}, status=400)

    message = (data.get("message") or "").strip()
    if not message:
        return JsonResponse({"error": "Please type a question."}, status=400)

    contents = []
    for turn in (data.get("history") or [])[-10:]:
        role = "user" if turn.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": str(turn.get("text", ""))[:4000]}]})
    contents.append({"role": "user", "parts": [{"text": message[:4000]}]})

    payload = {"system_instruction": {"parts": [{"text": SYSTEM_PROMPT}]}, "contents": contents}
    headers = {"x-goog-api-key": settings.GEMINI_API_KEY, "Content-Type": "application/json"}

    models, seen = [], set()
    for m in [settings.GEMINI_MODEL] + settings.GEMINI_FALLBACK_MODELS:
        if m and m not in seen:
            seen.add(m)
            models.append(m)

    last = None
    for model in models:
        try:
            r = requests.post(f"{API_BASE}/{model}:generateContent", headers=headers, json=payload, timeout=40)
        except requests.RequestException:
            return JsonResponse({"error": "Could not reach Google. Check your internet connection."}, status=502)

        if r.ok:
            try:
                parts = r.json()["candidates"][0]["content"]["parts"]
                text = "".join(p.get("text", "") for p in parts).strip()
            except (KeyError, IndexError, ValueError):
                text = ""
            return JsonResponse({"reply": text or "Sorry, I couldn't answer that. Try rephrasing.", "model": model})

        last = r
        if r.status_code in (404, 429):   # retired model or quota used up: try the next one
            continue
        break

    code = last.status_code
    detail = _google_message(last)
    if code == 401:
        msg = f"Google rejected the API key (401): {detail}"
    elif code == 403:
        msg = f"Google denied access (403): {detail}"
    elif code == 404:
        msg = f"Model not found (404). Change GEMINI_MODEL in .env. {detail}"
    elif code == 429:
        msg = "Free-tier limit reached (429). Wait a minute and try again."
    else:
        msg = f"Gemini error ({code}): {detail}"
    return JsonResponse({"error": msg}, status=502)
