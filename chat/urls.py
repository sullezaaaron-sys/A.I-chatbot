from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("api/chat/", views.chat_api, name="chat_api"),
    path("api/status/", views.status, name="status"),
    path("sw.js", views.service_worker, name="sw"),
    path("manifest.json", views.manifest, name="manifest"),
]
