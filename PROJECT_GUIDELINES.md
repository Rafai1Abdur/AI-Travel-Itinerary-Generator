# AI Travel Itinerary Generator - Project Guidelines

## Project Objectives

- Build a single-page responsive web application for generating AI-powered travel itineraries
- Prioritize cost-efficiency in AI API usage while maintaining quality output
- Implement secure credential management with server-side proxy architecture
- Create subtle, professional animations that enhance UX without distraction

## Scope

### In Scope
- Client-side form for travel preferences (destination, dates, budget, travelers, interests)
- Server-side proxy endpoint for AI API communication
- Day-by-day itinerary display with staggered card animations
- Mobile-first responsive design
- Error handling and loading states

### Out of Scope
- User authentication/accounts
- Persistent storage/database
- Payment processing
- External booking integrations
- Real-time weather/event data

## Roles & Responsibilities

### Frontend Developer
- Implement semantic HTML structure
- Create responsive CSS with CSS variables
- Build JavaScript form handling and DOM rendering
- Integrate animation triggers and micro-interactions

### Backend/API Manager
- Create `/api/generate-itinerary` proxy endpoint
- Manage environment variables and API credentials
- Implement request validation and error responses
- Configure rate limiting and usage monitoring

### DevOps
- Configure hosting platform (Vercel/Netlify)
- Set up environment variables in deployment
- Monitor API costs and usage quotas

## Implementation Procedures

### 1. Setup
```bash
# Initialize project
npm init -y
npm install node-fetch dotenv

# Create .env
OPENAI_API_KEY=sk-xxxxx
```

### 2. API Proxy Structure
```javascript
// api/generate-itinerary.js
export default async function handler(req, res) {
  // Validate input
  // Call OpenAI with sanitized prompt
  // Return structured JSON
}
```

### 3. Prompt Engineering
- Use `gpt-4.1-mini` with `temperature: 0.3`
- Enforce strict JSON output format
- Include system prompt for context containment
- Pre-validate all user inputs

### 4. Frontend Flow
1. User completes form → validate inputs
2. Show loading state with skeleton cards
3. POST to `/api/generate-itinerary`
4. Parse response → render day cards
5. Trigger staggered entrance animations

### 5. Animation Implementation
- Use CSS transitions with `cubic-bezier(0.4, 0, 0.2, 1)`
- Apply 50-100ms stagger delay between cards
- Respect `prefers-reduced-motion` media query
- Keep micro-interactions under 200ms

## Security Protocols

### Credential Management
- **Never** expose API keys in frontend code
- Store keys in platform environment variables
- Use server-side proxy for all API calls
- Restrict key permissions via provider dashboard

### Input Sanitization
- Escape special characters before API submission
- Limit input lengths (destination: 100 chars, interests: array max 10)
- Validate date ranges before processing

## Cost Optimization

### Model Selection
- **OpenAI**: gpt-4.1-mini (pay-per-use, ~$0.0036 per request)
- **Free Local Option**: Ollama with Llama 3.1 (zero cost, runs locally)
- **Zero AI Option**: Template-based itineraries (no costs, no external dependencies)

### Token Management
- Set `max_tokens: 1500` for typical 5-day itinerary
- Use `response_format: { type: "json_object" }` for structured output
- Cache responses for identical requests (optional)

### Free Alternatives
- **Ollama**: Download model once (~4-8GB), run unlimited requests locally
- **Templates**: Pre-built activity templates by interest type
- See LOCAL_SETUP.md for detailed free setup instructions

### Monitoring
- Track token usage per request
- Set monthly spending limits in provider dashboard
- Implement request deduplication on frontend

## Quality Assurance

### Testing Checklist
- [ ] Form validation works correctly
- [ ] API proxy returns expected format
- [ ] Cards render day-by-day activities
- [ ] Loading state displays during API call
- [ ] Errors display user-friendly messages
- [ ] Mobile layout is functional
- [ ] Animations respect reduced-motion preference

### Testing Resources
- See LOCAL_SETUP.md for complete testing plan
- Use `npm run start` for local Vercel environment
- Use `npm run start:static` for frontend-only testing