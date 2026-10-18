# AI Assistant (Django + Gemini + PWA) - v2

## Setup
1. `python -m venv venv` and activate it (`venv\Scripts\activate` on Windows)
2. `pip install -r requirements.txt`
3. Create a key at https://aistudio.google.com/apikey
4. Copy `.env.example` to `.env`, paste your key (no quotes, no spaces). Never commit `.env`.
5. `python manage.py runserver` then open http://127.0.0.1:8000

## Diagnostics
- Click the ⓘ button in the app: it shows whether the key was loaded (length and first 3 characters only).
- Errors from Google (401/403/404/429) are shown in the chat bubble.
- If the main model returns 404 or 429, the server tries GEMINI_FALLBACK_MODELS automatically.

## PWA
- DevTools > Application: check Manifest and Service Workers
- Network tab > Offline: the banner appears and the saved chat stays readable
- After updating the files, unregister the old service worker once (Application > Service Workers > Unregister) and hard refresh.
