import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Load .env (values in .env always win over leftover system variables) ---
env_file = BASE_DIR / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ[k.strip()] = v.strip().strip('"').strip("'")

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest").strip()
GEMINI_FALLBACK_MODELS = [
    m.strip() for m in os.environ.get("GEMINI_FALLBACK_MODELS", "gemini-flash-lite-latest").split(",") if m.strip()
]

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-me")
DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = ["django.contrib.staticfiles", "chat"]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [{
    "BACKEND": "django.template.backends.django.DjangoTemplates",
    "DIRS": [],
    "APP_DIRS": True,
    "OPTIONS": {"context_processors": ["django.template.context_processors.request"]},
}]

WSGI_APPLICATION = "config.wsgi.application"
DATABASES = {}  # not required
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
