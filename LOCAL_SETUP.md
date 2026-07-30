# Local Testing Environment Setup Guide

## Prerequisites

- Node.js 18+ installed
- Vercel CLI installed globally (`npm install -g vercel`)
- Git installed
- Optional: OpenAI API key, OpenRouter API key, OR Ollama for local AI (see Step 3)

## Step 1: Environment Configuration (Optional)

1. Create `.env` file in project root:
```powershell
Copy-Item -Path ".env.example" -Destination ".env"
```

2. Edit `.env` and add your API Key. Available options:
```
# OpenAI (requires billing account)
OPENAI_API_KEY=sk-your-key

# OpenRouter (unified access to multiple models)
OPENROUTER_API_KEY=sk-or-v1-your-key

# Ollama (local, free - no key needed)
# Just make sure Ollama is running on localhost:11434
```

## Step 2: Dependency Management

```powershell
# Install dependencies (if any)
npm install
```

Note: Current setup uses native fetch, no external dependencies required.

## Step 3: Local Service Emulation

Start Vercel dev server (emulates production environment):
```powershell
npm run start
```

**If you see PowerShell execution policy errors:**
```powershell
# Temporary fix (current session only)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
npm run start
```

Or bypass for single command:
```powershell
& npm run start
```

This runs:
- HTTP server on `http://localhost:3000`
- Serverless function emulation at `/api/generate-itinerary`
- Same routing as production

Alternative for frontend-only testing:
```powershell
# Install http-server for static file serving
npm install -g http-server
http-server -p 8000
```
Note: API calls will fail without the proxy.

## Step 4: Testing Procedures

### Manual Testing Workflow

1. Open `http://localhost:3000` in browser
2. Fill form with test data:
   - Destination: "Paris, France"
   - Dates: Valid range (end > start)
   - Budget: "moderate"
   - Travelers: 2
   - Style: "couple"
   - Interests: "culture", "food"

3. Submit form and verify:
   - Loading skeleton appears
   - API call completes within 10 seconds
   - Day cards fade in with staggered delay
   - All activities rendered correctly

### Automated Testing Setup

Current `package.json` includes these scripts:
```json
"scripts": {
  "start": "vercel dev",
  "start:static": "npx http-server -p 8000"
}
```

### Parity Validation Checklist

- [ ] Environment variables load correctly
- [ ] API endpoint path matches production (`/api/generate-itinerary`)
- [ ] CORS headers handled by Vercel dev
- [ ] Same Node.js version as deployment target
- [ ] Cold start behavior tested (production serverless functions may be slower)

## Step 5: Debugging & Troubleshooting

### Common Issues

**PowerShell Execution Policy Errors**
```powershell
# Temporary fix for current session
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force

# Or bypass for single npm command
cmd /c "npm run start"
```

**Vercel Not Found**
```powershell
# Install Vercel CLI globally
npm install -g vercel

# Or use npx for one-off command
npx vercel dev
```

**Recursive Invocation Error**
```
Error: `vercel dev` must not recursively invoke itself.
```
Fix: Use `npm run start` instead of `npm run dev`, or rename the script in package.json to avoid `vercel dev` being nested inside itself.

**If error persists after linking:**
```powershell
# Remove .vercel folder and re-link
Remove-Item -Recurse -Force .vercel/
vercel link  # Re-run link, select same project
```

**Alternative: Static Testing Without Vercel**
If Vercel CLI installation is blocked:
```powershell
# Install http-server globally
npm install -g http-server

# Run static server (no API - form only)
npx http-server -p 8000
```

**API Key Not Loading**
```powershell
# Verify Vercel reads env
npx vercel dev --debug
```

**CORS Errors**
- Ensure fetch URL is relative: `/api/generate-itinerary`

**JSON Parsing Errors**
- Check browser Network tab for raw response
- Add `console.log(itinerary)` in script.js to inspect

**Build Failures**
```powershell
# Check for syntax errors
npx tsc --noEmit
```

## Step 6: Production Parity Commands

```powershell
# Preview deployment (mirrors production)
vercel

# Test with production build
vercel --prod

# View function logs
vercel logs your-deployment-url
```

## Step 7: Cleanup

Stop the dev server: `Ctrl+C` in terminal

Remove any test deployment:
```powershell
vercel remove
```

## Step 8: Vercel Authentication & Deployment

**Note:** If PowerShell blocks Vercel commands, use:
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process -Force
```
or prefix commands: `& vercel login`

### First-Time Authentication

1. Log in to Vercel:
```powershell
vercel login
# Enter your email, check email for confirmation token
```

2. Link project to Vercel account:
```powershell
vercel link
# Select or create a Vercel project
# Creates .vercel folder with configuration
```

### Deploy to Production

```powershell
# One-time setup
vercel

# Subsequent deployments
vercel --prod
```

### Environment Variables for Production

After linking, set your API key in Vercel dashboard:
1. Go to https://vercel.com/dashboard
2. Select your project
3. Navigate to Settings > Environment Variables
4. Add one of the following keys:
   - `OPENAI_API_KEY` (https://platform.openai.com/api-keys)
   - `OPENROUTER_API_KEY` (https://openrouter.ai/keys)
5. Redeploy

Or via CLI:
```powershell
vercel env add OPENAI_API_KEY production
vercel env add OPENROUTER_API_KEY production
```

### Verify Deployment

1. Check deployment status:
```powershell
vercel ls
```

2. Test production endpoint:
```powershell
# Get your deployment URL from vercel ls output
curl https://your-project.vercel.app/api/generate-itinerary
```

3. View real-time logs:
```powershell
vercel logs your-project.vercel.app --since 1h
```

## Testing Plan

### Local Testing

**Frontend Unit Tests**
- Form validation logic in `script.js`
- Input sanitization function
- DOM rendering function

**Integration Tests**
- Mock API responses with hardcoded JSON
- Test loading state transitions
- Verify error handling paths

**Commands**
```powershell
# Static testing (no API required)
npm run start:static
# Then manually test form validation with browser dev tools

# Full-stack local testing (requires .env with OPENAI_API_KEY)
npm run start
```

### Integration Testing

**API Layer**
- Test endpoint returns valid JSON structure
- Validate 400/500 error responses
- Mock OpenAI SDK to avoid API costs during testing

**Test Script**
```powershell
# Create test file: api/test.js
node -e "console.log(JSON.stringify({days:[{day:'Day 1',date:'June 15',activities:[{time:'Morning',name:'Test',description:'Test activity'}]}]))"
# Verify response matches expected structure
```

### Deployment Verification

**Pre-deploy Checklist**
- [ ] All files in `.gitignore` are excluded
- [ ] `vercel --prod` deploys successfully
- [ ] Production URL returns valid responses

**Post-deploy Tests**
- Load deployed URL in incognito browser
- Submit full form and verify end-to-end flow
- Check API function logs in Vercel dashboard
- Test mobile responsiveness

## Cost Analysis: OpenAI API

**Current Implementation (OpenAI)**
- `gpt-4.1-mini`: ~$0.0007 per 1K tokens (input), ~$0.0021 per 1K tokens (output)
- Average itinerary: ~500 tokens input + ~1500 tokens output = ~$0.0036 per request
- No subscription required - pay-per-use

**Free/Open-Source Alternatives**

### Option 1: Mock Data (No Cost)
```javascript
// Add to api/generate-itinerary.js for testing
const mockItinerary = {
  days: Array.from({length: 5}, (_, i) => ({
    day: `Day ${i + 1}`,
    date: new Date(Date.now() + i * 86400000).toDateString(),
    activities: [
      { time: 'Morning', name: 'Sightseeing', description: 'Explore local landmarks' },
      { time: 'Afternoon', name: 'Lunch', description: 'Try local cuisine' },
      { time: 'Evening', name: 'Relaxation', description: 'Rest at accommodation' }
    ]
  }))
};
```

### Option 2: Ollama (Local LLM - Completely Free)

**Is Ollama Free?**
Yes. Ollama is 100% free for local use with no subscriptions, no token limits, and no tiered pricing. You only need to download models (~3-8GB storage depending on model). Run unlimited requests locally at no cost.

**Step-by-Step Installation (Windows)**

1. Download Ollama installer:
```powershell
# Visit https://ollama.com/download/windows and download the .exe
# Or use PowerShell to download directly:
Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile "OllamaSetup.exe"
```

2. Install Ollama:
- Run `OllamaSetup.exe` as Administrator
- Follow installation wizard
- Ollama starts automatically as a background service

3. Verify installation:
```powershell
ollama --version
```

4. Pull a model (download once, use forever):
```powershell
# Llama 3.1 8B (recommended balance of quality/performance)
ollama pull llama3.1:8b

# Or smaller model for less powerful machines
ollama pull llama3.1:8b-instruct-q4_0
```

5. Test the model:
```powershell
ollama run llama3.1:8b
# Type 'hello' and press Enter to test
# Press Ctrl+D to exit
```

**Modifying API for Ollama**

Replace `api/generate-itinerary.js`:
```javascript
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { destination, startDate, endDate, budget, travelers, travelStyle, interests } = req.body;

    if (!destination || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const prompt = `Generate a detailed day-by-day travel itinerary for ${destination} from ${startDate} to ${endDate}. Budget: ${budget}. Travelers: ${travelers}. Style: ${travelStyle}. Interests: ${interests.join(', ')}. Return ONLY valid JSON: { "days": [{ "day": "Day 1", "date": "June 15", "activities": [{ "time": "Morning", "name": "Activity", "description": "Description" }] }]}`;

        const response = await fetch('http://localhost:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.1:8b',
                messages: [
                    { role: 'system', content: 'You are a travel expert. Output only valid JSON.' },
                    { role: 'user', content: prompt }
                ],
                format: 'json'
            })
        });

        const result = await response.json();
        const itinerary = JSON.parse(result.message.content);
        res.status(200).json(itinerary);
    } catch (error) {
        console.error('Ollama Error:', error);
        res.status(500).json({ error: 'Failed to generate itinerary' });
    }
}
```

**Important Notes for Ollama:**
- Must run `ollama serve` (usually autostart on Windows)
- First request may take 5-10 seconds (model warm-up)
- Models require 3-8GB disk space
- No internet required after initial model download
- **Cannot deploy to cloud hosting** - requires local machine running Ollama

### Option 3: Template-based Itineraries (Zero-Cost)

Replace AI entirely with pre-built templates:
```javascript
// api/generate-itinerary.js - No AI, no costs
const templates = {
    culture: {
        Morning: 'Visit museums and historical sites',
        Afternoon: 'Explore cultural districts',
        Evening: 'Attend cultural performances'
    },
    food: {
        Morning: 'Local breakfast spot',
        Afternoon: 'Food tour or market visit',
        Evening: 'Traditional dinner restaurant'
    }
};

const activities = req.body.interests.flatMap(interest => 
    Object.entries(templates[interest] || {}).map(([time, desc]) => ({ time, name: interest, description: desc }))
);

const response = {
    days: Array.from({length: req.body.days || 5}, (_, i) => ({
        day: `Day ${i + 1}`,
        date: new Date(new Date(startDate).getTime() + i * 86400000).toDateString(),
        activities
    }))
};
```

### Option 4: GitHub Copilot API (If Available)

Free tier for GitHub users with public repositories. Requires GitHub authentication but no additional API costs beyond hosting.

## Recommendation

- **Development/Testing**: Use Ollama for zero-cost iteration
- **Production**: Keep OpenAI (pay-per-use) or use template-based approach
- **Hybrid**: Use mock data for frontend testing, Ollama for local full-stack testing

## Deployment Roadmap

### Phase 1: Local Testing (No API Required)
```powershell
# Static testing to validate frontend
npm run start:static
# Open http://localhost:8000
# Test form validation, styling, animations
```

### Phase 2: Local Full-Stack Testing
```powershell
# With Ollama (zero cost)
# Follow Ollama setup in Step 4 of this guide
npm run start
```

### Phase 3: GitHub Repository Setup
```powershell
# Initialize repository (if not already)
git init

# Verify .gitignore excludes these:
# .env, node_modules/, .vercel/, package-lock.json

# Create initial commit
git add index.html style.css script.js api/ package.json vercel.json .gitignore README.md .env.example
git commit -m "Initial project structure"
```

### Phase 4: Connect to GitHub
```powershell
# Create repository on GitHub (via web UI)
# Add remote
git remote add origin https://github.com/your-username/travel-itinerary.git

# Push
git branch -M main
git push -u origin main
```

### Phase 5: Vercel Integration
```powershell
# Import from GitHub in Vercel dashboard
# OR run:
vercel --prod  # Auto-detects GitHub connection
```

### Phase 6: Production Environment Variables
- In Vercel dashboard: Settings > Environment Variables
- Add: `OPENAI_API_KEY` (without quotes)
- Value: Your actual OpenAI API key

## Public Repository Safety

**Files to exclude (.gitignore):**
- `.env` - Contains your API key
- `.vercel/` - Contains Vercel project config
- `node_modules/` - Dependencies (auto-installed)
- `package-lock.json` - Lock file (recreated on npm install)

**Safe to publish:**
- `index.html` - Static markup
- `style.css` - Styling
- `script.js` - Frontend logic (no keys)
- `api/generate-itinerary.js` - Server code (keys read from env)
- `package.json` - Dependency list only
- `vercel.json` - Deployment config
- `README.md` - Documentation

**Security checklist:**
- [ ] No API keys in committed files
- [ ] `.env` not tracked in git
- [ ] `.vercel` folder not in repository
- [ ] `vercel env ls` shows key is linked

### Phase 7: Production Verification
1. Visit deployed URL in incognito mode
2. Test complete form submission flow
3. Check Vercel function logs for any errors
4. Verify API costs in OpenAI dashboard (minimal expected)

### Phase 8: Ongoing Development
```powershell
# After changes
git add .
git commit -m "Your changes"
git push

# Vercel auto-deploys on push (if connected to GitHub)
# Or manually: vercel --prod
```