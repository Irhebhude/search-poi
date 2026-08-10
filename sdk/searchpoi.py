"""SEARCH-POI Engine v1 — Python SDK (requests only).

    from searchpoi import SearchPOI
    poi = SearchPOI(api_key="sk_live_...")
    print(poi.semantic_search("jollof rice in Ikeja"))
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import requests

DEFAULT_BASE = "https://search-poi.pages.dev"


class SearchPOIError(RuntimeError):
    """Raised when the API returns a non-2xx response."""


class SearchPOI:
    def __init__(self, api_key: Optional[str] = None, base_url: str = DEFAULT_BASE, timeout: int = 30):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def _call(self, path: str, method: str = "GET", body: Optional[Dict[str, Any]] = None,
              params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        res = requests.request(method, self.base_url + path, json=body, params=params,
                               headers=headers, timeout=self.timeout)
        try:
            data = res.json()
        except ValueError:
            data = {}
        if not res.ok:
            raise SearchPOIError(data.get("error", f"SearchPOI request failed ({res.status_code})"))
        return data

    def config(self) -> Dict[str, Any]:
        return self._call("/api/config")

    def search(self, query: str, limit: int = 20) -> Dict[str, Any]:
        return self._call("/api/search", params={"q": query, "limit": limit})

    def semantic_search(self, query: str, limit: int = 20) -> Dict[str, Any]:
        return self._call("/api/semantic-search", "POST", {"query": query, "limit": limit})

    def ask(self, query: str, mode: str = "default") -> Dict[str, Any]:
        return self._call("/api/v1/query", "POST", {"query": query, "mode": mode})

    def support(self, email: str, message: str) -> Dict[str, Any]:
        return self._call("/api/support/tickets", "POST", {"email": email, "message": message})

    def track(self, path: str, user_id: Optional[str] = None) -> Dict[str, Any]:
        return self._call("/api/analytics/events", "POST", {"path": path, "user_id": user_id})
