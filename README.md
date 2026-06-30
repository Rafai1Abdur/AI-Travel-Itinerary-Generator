# AI Travel Itinerary Generator

A single-page web application for generating travel itineraries using AI.

## Quick Start

```powershell
# 1. Run locally (mock data works without API key)
npm run start
# Open http://localhost:3000
```

No API key required for testing - uses mock data by default.

## Deployment Roadmap

See `LOCAL_SETUP.md` for complete steps:
1. Local testing (static or with Ollama)
2. GitHub repository setup (`.gitignore` excludes `.env`)
3. Vercel integration (environment variables in dashboard)
4. Production verification

## Free Alternatives

See `LOCAL_SETUP.md` for zero-cost options:
- **Ollama**: Local LLM runtime with no API costs
- **Templates**: Pre-built itinerary templates

## Files

| File | Description |
|------|-------------|
| `index.html` | Form markup and structure |
| `style.css` | Responsive styling with animations |
| `script.js` | Frontend logic and API integration |
| `api/generate-itinerary.js` | Serverless function (OpenAI/Ollama) |

## Documentation

- `PROJECT_GUIDELINES.md` - Project scope and implementation
- `LOCAL_SETUP.md` - Testing guide and free alternatives