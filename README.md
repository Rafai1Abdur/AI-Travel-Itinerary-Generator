# AI Travel Itinerary Generator

A single-page web application for generating travel itineraries. Two versions available:

## Version A: AI-Powered (Optional)
Uses OpenAI API or Ollama if configured, falls back to mock data.

## Version B: Template-Based (100% Free - No API Keys)
Uses pre-built templates based on selected interests. No external dependencies.

## Quick Start

```powershell
# 1. Run locally (template-based, no setup required)
node test-server.mjs
# Open http://localhost:8000
```

## Enable AI Features (Optional)

### Option 1: Ollama (Free, Local)
1. Install Ollama from https://ollama.com
2. Pull a model: `ollama pull llama3.1:8b`
3. For Vercel deployment: Ollama runs locally only (Vercel can't access localhost)

### Option 2: OpenAI API
1. Get API key from https://platform.openai.com/api-keys
2. Add to `.env`: `OPENAI_API_KEY=sk-your-key`
3. For Vercel: Add key in dashboard → Settings → Environment Variables

### Option 3: OpenRouter (Unified AI Access)
1. Get API key from https://openrouter.ai/keys
2. Add to `.env`: `OPENROUTER_API_KEY=sk-or-v1-your-key`
3. Provides access to multiple models (GPT-4, Claude, Llama, etc.)
4. For Vercel: Add key in dashboard → Settings → Environment Variables

## Files

| File | Description |
|------|-------------|
| `index.html` | Form markup and structure |
| `style.css` | Responsive styling with animations |
| `script.js` | Frontend logic and API integration |
| `api/generate-itinerary.js` | Version A: AI-powered (OpenAI/Ollama/OpenRouter) |
| `api/generate-itinerary-templates.js` | Version B: Template-based (no AI) |
| `test-server.mjs` | Local development server |
| `.env.example` | Configuration template |

## GitHub Upload

```powershell
# Initialize repository
git init
git add .
git commit -m "Initial commit"

# Add remote and push
git remote add origin https://github.com/YOUR_USERNAME/travel-itinerary-generator.git
git branch -M main
git push -u origin main
```

**Note:** `.env` is excluded via `.gitignore` - your API keys stay local.