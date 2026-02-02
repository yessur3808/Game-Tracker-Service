
# Example API usage (curl)

Assumes:
- Service: `http://localhost:3000`
- Admin key header: `X-Admin-Key: change-me`

---

## 1) Create a game (admin)

```bash
curl -X POST "http://localhost:3000/admin/games" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: change-me" \
  -d '{
    "reason": "initial add",
    "game": {
      "id": "elden-ring-shadow",
      "name": "Elden Ring: Shadow",
      "category": { "type": "dlc" },
      "platforms": ["PC", "PS5", "XSX"],
      "availability": "upcoming",
      "release": {
        "status": "upcoming",
        "isOfficial": true,
        "confidence": "official",
        "announced_window": { "label": "2026", "year": 2026 },
        "sources": []
      },
      "sources": []
    }
  }'

```



## 2) Add a manual source (admin)

```bash
curl -X POST "http://localhost:3000/admin/games/elden-ring-shadow/manual-sources" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: change-me" \
  -d '{
    "scope": "release",
    "reason": "official announcement page",
    "source": {
      "type": "official_site",
      "name": "Official Site",
      "url": "https://example.com/announcement",
      "isOfficial": true,
      "reliability": "high",
      "retrievedAt": "2026-01-30T00:00:00.000Z",
      "claim": "Releases in 2026"
    }
  }'

```

## 3) Create an override (admin)

```bash
curl -X POST "http://localhost:3000/admin/games/elden-ring-shadow/overrides" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: change-me" \
  -d '{
    "reason": "Confirmed by publisher: Q4 2026",
    "patch": {
      "release": {
        "status": "upcoming",
        "isOfficial": true,
        "confidence": "official",
        "announced_window": { "label": "2026-Q4", "year": 2026, "quarter": 4 },
        "sources": []
      }
    }
  }'

```




## 4) Read composed game (public)

```bash
curl "http://localhost:3000/games/elden-ring-shadow"
```


## 5) View audit log (admin)

```bash
curl "http://localhost:3000/admin/audit?entityType=game&entityId=elden-ring-shadow&limit=50" \
  -H "X-Admin-Key: change-me"
```

---
