// api/generate-itinerary.js
// Version A: AI-powered with OpenAI, Ollama, OpenRouter, or mock fallback
// Set OPENAI_API_KEY, OLLAMA_URL, or OPENROUTER_API_KEY in environment

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Only attempt Ollama if explicitly configured (prevents timeout delays when not installed)
// OLLAMA_ENABLED takes precedence; if unset, fall back to checking OLLAMA_URL (backward compat)
const OLLAMA_ENABLED = process.env.OLLAMA_ENABLED === 'true' || (process.env.OLLAMA_ENABLED === undefined && !!process.env.OLLAMA_URL);

// Configuration status (logged at handler start for debugging)
console.log('[AI Config]', {
    openai: !!OPENAI_API_KEY,
    openrouter: !!OPENROUTER_API_KEY,
    ollama: OLLAMA_ENABLED,
    ollamaUrl: OLLAMA_URL
});

function capitalizeTime(time) {
    if (typeof time !== 'string') return time || '';
    const lower = time.toLowerCase();
    if (lower === 'morning' || lower === 'am') return 'Morning';
    if (lower === 'afternoon' || lower === 'midday') return 'Afternoon';
    if (lower === 'evening' || lower === 'pm') return 'Evening';
    if (lower === 'night' || lower === 'late') return 'Night';
    return time;
}

function normalizeTimeLabel(time, actIdx) {
    if (typeof time === 'string' && /^\d{1,2}:\d{2}/.test(time)) {
        const hour = parseInt(time.split(':')[0]);
        if (hour < 6) return 'Night';
        if (hour < 12) return 'Morning';
        if (hour < 17) return 'Afternoon';
        if (hour < 21) return 'Evening';
        return 'Night';
    }
    if (time) return capitalizeTime(time);
    if (actIdx < 1) return 'Morning';
    if (actIdx < 3) return 'Afternoon';
    return 'Evening';
}

function normalizeActivity(act, actIdx) {
    if (typeof act === 'string') {
        return {
            time: actIdx < 1 ? 'Morning' : actIdx < 3 ? 'Afternoon' : 'Evening',
            name: act,
            description: '',
            cost: '',
            duration: '',
            tip: ''
        };
    }
    return {
        time: normalizeTimeLabel(act.time, actIdx),
        name: act.name || act.activity || 'Unknown',
        description: act.description || '',
        cost: act.cost || act.price || '',
        duration: act.duration || '',
        tip: act.tip || act.insiderTip || ''
    };
}

function normalizeDay(day, idx, fallbackDate) {
    let dayLabel = day.day;
    if (typeof day.day === 'number') {
        dayLabel = `Day ${day.day}`;
    } else if (typeof day.day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.day)) {
        dayLabel = `Day ${idx + 1}`;
    } else if (typeof day.day === 'string' && !day.day.startsWith('Day ')) {
        dayLabel = `Day ${day.day}`;
    } else if (typeof day.day === 'undefined') {
        dayLabel = `Day ${idx + 1}`;
    }

    let normalizedDate = day.date || fallbackDate || '';
    if (typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.date)) {
        normalizedDate = new Date(day.date + 'T00:00:00').toDateString();
    } else if (typeof day.day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.day)) {
        normalizedDate = new Date(day.day + 'T00:00:00').toDateString();
    }

    let activities = [];
    if (day.activities && Array.isArray(day.activities)) {
        activities = day.activities.map(normalizeActivity);
    }

    return {
        day: dayLabel,
        date: normalizedDate,
        location: day.location || '',
        activities,
        summary: day.summary || day.dailySummary || null,
        mealPlan: day.mealPlan || day.meals || null,
        transportation: day.transportation || day.transport || ''
    };
}

/**
 * Recursively search any JSON structure for a "days-like" array.
 * A days-like array is an array of objects that have at least one of:
 * day, date, location, activities, itinerary, schedule, plan keys.
 * This handles unexpected wrapper formats from AI providers.
 */
function findDaysArray(obj, depth = 0) {
    if (!obj || depth > 6) return null;

    // If it's an array, check if it looks like a days array
    if (Array.isArray(obj)) {
        if (obj.length > 0 && obj.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
            const hasDayLike = obj.some(item =>
                item.day !== undefined ||
                item.date !== undefined ||
                item.location !== undefined ||
                item.activities !== undefined ||
                item.itinerary !== undefined ||
                item.schedule !== undefined ||
                item.plan !== undefined
            );
            if (hasDayLike) return obj;
        }
        // Search inside array elements
        for (const item of obj) {
            const found = findDaysArray(item, depth + 1);
            if (found) return found;
        }
        return null;
    }

    // If it's an object, search its values
    if (typeof obj === 'object') {
        // Check common wrapper keys first
        for (const key of ['days', 'itinerary', 'destinations', 'schedule', 'plan', 'trip', 'data', 'response', 'result', 'travelItinerary']) {
            if (obj[key] !== undefined) {
                const found = findDaysArray(obj[key], depth + 1);
                if (found) return found;
            }
        }
        // Then search all values
        for (const value of Object.values(obj)) {
            const found = findDaysArray(value, depth + 1);
            if (found) return found;
        }
    }

    return null;
}

/**
 * Try to parse plain-text/markdown AI responses into a basic itinerary.
 * Handles lines like "Day 1:", "Day 1 - Paris", "Morning: Visit Eiffel Tower", etc.
 */
function parseTextItinerary(text) {
    if (typeof text !== 'string' || text.trim().length === 0) return null;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const days = [];
    let currentDay = null;

    for (const line of lines) {
        // Match "Day 1", "Day 1:", "Day 1 - Paris", "Day 1: Paris"
        const dayMatch = line.match(/^day\s+(\d+)\s*[:.\-–—]?\s*(.*)$/i);
        if (dayMatch) {
            if (currentDay) days.push(currentDay);
            currentDay = {
                day: `Day ${dayMatch[1]}`,
                date: '',
                location: dayMatch[2] || '',
                activities: []
            };
            continue;
        }

        // Match time slots: "Morning:", "Afternoon:", "Evening:", "Night:"
        const timeMatch = line.match(/^(morning|afternoon|evening|night|am|pm)\s*[:.\-–—]?\s*(.*)$/i);
        if (timeMatch && currentDay) {
            const timeLabel = capitalizeTime(timeMatch[1]);
            const activityName = timeMatch[2] || 'Activity';
            currentDay.activities.push({ time: timeLabel, name: activityName, description: '' });
            continue;
        }

        // Any other line while a day is active becomes an activity
        if (currentDay) {
            currentDay.activities.push({
                time: currentDay.activities.length < 1 ? 'Morning' : currentDay.activities.length < 3 ? 'Afternoon' : 'Evening',
                name: line,
                description: ''
            });
        }
    }

    if (currentDay) days.push(currentDay);

    return days.length > 0 ? { days } : null;
}

/**
 * Attempt to repair truncated JSON by closing unclosed brackets, quotes, and removing trailing commas.
 * Returns the repaired JSON string, or null if repair is not possible.
 */
function repairTruncatedJson(text) {
    if (typeof text !== 'string' || text.trim().length === 0) return null;

    let repaired = text.trim();

    // Remove trailing commas before closing brackets
    repaired = repaired.replace(/,\s*([}\]])/g, '$1');

    // Track bracket/quote balance
    const stack = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < repaired.length; i++) {
        const char = repaired[i];
        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }
        if (char === '"') {
            inString = true;
        } else if (char === '{' || char === '[') {
            stack.push(char);
        } else if (char === '}' || char === ']') {
            const expected = char === '}' ? '{' : '[';
            if (stack.length > 0 && stack[stack.length - 1] === expected) {
                stack.pop();
            }
        }
    }

    // If we're inside a string, close it
    if (inString) {
        repaired += '"';
    }

    // Close any unclosed brackets in reverse order
    while (stack.length > 0) {
        const open = stack.pop();
        repaired += open === '{' ? '}' : ']';
    }

    // Try to parse the repaired JSON
    try {
        const parsed = JSON.parse(repaired);
        return parsed;
    } catch {
        // Full repair failed - try partial recovery
        return partialJsonRecovery(text);
    }
}

/**
 * Partial JSON recovery: extract complete day objects from truncated JSON.
 * Finds all complete day objects in the "days" array and returns them.
 */
function partialJsonRecovery(text) {
    if (typeof text !== 'string' || text.trim().length === 0) return null;

    // Try to find complete day objects in the truncated JSON
    // Look for patterns like {"day": 1, ...} or {"day":"Day 1", ...}
    const dayPattern = /\{\s*"day"\s*:\s*(\d+|\"[^\"]+\")\s*,[\s\S]*?\}(?=\s*[,}\]]|\s*$)/g;
    const matches = [];
    let match;

    while ((match = dayPattern.exec(text)) !== null) {
        try {
            const dayObj = JSON.parse(match[0]);
            if (dayObj && dayObj.day !== undefined) {
                matches.push(dayObj);
            }
        } catch {
            // Skip incomplete day objects
        }
    }

    if (matches.length > 0) {
        return { days: matches };
    }

    return null;
}

function normalizeItinerary(data) {
    if (!data) return data;

    let days = null;
    let meta = {};

    // Format 1: { days: [...] }
    if (Array.isArray(data.days)) {
        days = data.days;
    }
    // Format 2: { travelItinerary: { itinerary: [...] } }
    else if (data.travelItinerary && Array.isArray(data.travelItinerary.itinerary)) {
        days = data.travelItinerary.itinerary;
        meta = {
            destination: data.travelItinerary.destination,
            fallbackDate: data.travelItinerary.dates?.start || ''
        };
    }
    // Format 3: { itinerary: { days: [...] } }
    else if (data.itinerary && Array.isArray(data.itinerary.days)) {
        days = data.itinerary.days;
        meta = {
            destination: data.itinerary.destination,
            fallbackDate: data.itinerary.travel_dates?.start || ''
        };
    }
    // Format 4: { itinerary: { destinations: [...] } }
    else if (data.itinerary && Array.isArray(data.itinerary.destinations)) {
        days = data.itinerary.destinations;
        meta = { destination: data.itinerary.destination };
    }
    // Format 5: top-level array
    else if (Array.isArray(data)) {
        days = data;
    }
    // Format 6: Deep-search fallback for ANY unexpected wrapper structure
    else {
        const found = findDaysArray(data);
        if (found) {
            days = found;
            // Try to extract destination from the data
            if (data.destination) meta.destination = data.destination;
            else if (data.trip?.destination) meta.destination = data.trip.destination;
            else if (data.data?.destination) meta.destination = data.data.destination;
        }
    }

    if (!days) return data;

    return {
        ...(meta.destination ? { destination: meta.destination } : {}),
        days: days.map((day, idx) => normalizeDay(day, idx, meta.fallbackDate)),
        overview: data.overview || data.tripOverview || data.summary || null,
        accommodations: data.accommodations || data.hotels || null,
        packingList: data.packingList || data.packing || null,
        travelTips: data.travelTips || data.tips || null
    };
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        destination, startDate, endDate, budget, travelers, travelStyle, interests,
        sourceCountry, sourceCity, sourceLocation,
        departureTime, arrivalTime, returnDepartureTime, returnArrivalTime,
        restDayAfterArrival, restDayBeforeDeparture,
        budgetAmount, budgetCurrency
    } = req.body || {};

    if (!destination || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Configuration message when no AI provider is available
    const configError = (provider) => ({
        error: provider
            ? `${provider} failed. Please check your API configuration.`
            : 'Please Configure Ollama, OpenAI/OpenRouter API key',
        source: provider ? 'provider-error' : 'unconfigured'
    });

    // Log request for debugging
    console.log('[Request]', {
        destination,
        sourceLocation,
        startDate,
        endDate,
        budget,
        budgetAmount,
        budgetCurrency,
        travelers,
        travelStyle,
        interests,
        departureTime,
        arrivalTime,
        restDayAfterArrival,
        restDayBeforeDeparture
    });

    // Calculate trip length in days for dynamic token allocation
    const tripDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
    // Allocate ~600 tokens per day + 1000 buffer for the rich JSON structure
    const maxTokens = Math.min(16000, tripDays * 600 + 1000);
    console.log('[Request] Trip days:', tripDays, '| Max tokens:', maxTokens);

    // Build budget description
    let budgetDesc = budget;
    if (budget === 'custom' && budgetAmount && budgetCurrency) {
        const currencyInfo = budgetCurrency;
        budgetDesc = `${budgetAmount} ${currencyInfo} (custom budget)`;
    }

    // Build travel details
    const travelDetails = [];
    if (sourceLocation) travelDetails.push(`Traveling from: ${sourceLocation}`);
    if (departureTime) travelDetails.push(`Departure time from source: ${departureTime}`);
    if (arrivalTime) travelDetails.push(`Arrival time at destination: ${arrivalTime}`);
    if (returnDepartureTime) travelDetails.push(`Return departure time: ${returnDepartureTime}`);
    if (returnArrivalTime) travelDetails.push(`Return arrival time: ${returnArrivalTime}`);
    if (restDayAfterArrival) travelDetails.push('Include a rest day after arrival to recover from jet lag');
    if (restDayBeforeDeparture) travelDetails.push('Include a rest day before departure');

    const prompt = `Generate a detailed day-by-day travel itinerary for ${destination} from ${startDate} to ${endDate} (${tripDays} days). Budget: ${budgetDesc}. Travelers: ${travelers}. Style: ${travelStyle}. Interests: ${interests?.join(', ') || 'general'}. ${travelDetails.join('. ')}.

Return ONLY valid JSON with this structure:
{
  "overview": { "summary": "2-3 sentence trip overview", "totalBudget": "estimated total in USD" },
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "location": "area/neighborhood",
      "summary": "1 sentence daily summary",
      "mealPlan": { "breakfast": "place", "lunch": "place", "dinner": "place" },
      "transportation": "how to get around",
      "activities": [
        { "time": "9:00 AM", "name": "Activity name", "description": "brief description", "cost": "$25", "duration": "2 hours", "tip": "insider tip" }
      ]
    }
  ],
  "accommodations": [ { "name": "Hotel name", "area": "neighborhood", "pricePerNight": "$150", "rating": "4.5", "note": "brief note" } ],
  "travelAgencies": [ { "name": "Agency name", "area": "location", "specialty": "what they do", "approxCost": "cost" } ],
  "carRentals": [ { "company": "Rental company", "location": "where", "dailyRate": "rate" } ],
  "localTransport": { "options": ["Metro", "Bus", "Taxi"], "dailyCost": "estimated", "tips": "advice" },
  "recommendedFood": [ { "dish": "Dish name", "restaurant": "Restaurant name", "area": "location", "priceRange": "range" } ],
  "cinemas": [ { "name": "Cinema name", "area": "location", "ticketPrice": "price", "budgetTier": "budget/moderate/luxury" } ],
  "sportsEvents": [ { "name": "Event name", "date": "date", "venue": "venue", "ticketPrice": "price" } ],
  "weatherClothing": { "season": "season", "typicalForecast": "forecast", "clothingRecommendations": "what to wear", "extremeAlternatives": "backup plan" },
  "culturalAdvice": { "greetings": "how to greet", "taboos": "what to avoid", "dressCode": "what to wear", "dosAndDonts": ["do", "don't"] },
  "packingList": ["item 1", "item 2"],
  "travelTips": ["tip 1", "tip 2"]
}

Keep descriptions VERY concise (under 10 words). Include 2-3 activities per day. Do NOT include any text outside the JSON.`;

    // Try OpenAI first
    if (OPENAI_API_KEY) {
        try {
            console.log('[OpenAI] Attempting request...');
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'gpt-4.1-mini',
                    messages: [
                        { role: 'system', content: 'You are a travel expert. Output only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3,
                    max_tokens: maxTokens
                })
            });

            console.log('[OpenAI] Response status:', response.status);
            if (!response.ok) {
                const errText = await response.text();
                console.log('[OpenAI] Error response:', errText.substring(0, 200));
            }

            if (response.ok) {
                const result = await response.json();
                if (result.choices?.[0]?.message?.content) {
                    const content = result.choices[0].message.content;
                    try {
                        const parsed = JSON.parse(content);
                        const normalized = normalizeItinerary(parsed);
                        // If normalization returned the raw data (no days found), try text parsing
                        if (!normalized.days) {
                            const textParsed = parseTextItinerary(content);
                            if (textParsed) return res.status(200).json({ source: 'openai-text-parsed', ...textParsed });
                        }
                        return res.status(200).json({ source: 'openai', ...normalized });
                    } catch {
                        // JSON parse failed - try text parsing
                        const textParsed = parseTextItinerary(content);
                        if (textParsed) return res.status(200).json({ source: 'openai-text-parsed', ...textParsed });
                        return res.status(503).json(configError('OpenAI'));
                    }
                }
            }
        } catch (error) {
            console.log('[OpenAI] Request error:', error.message);
            return res.status(503).json(configError('OpenAI'));
        }
    }

    // Try Ollama (local, free) - only if explicitly configured
    if (OLLAMA_ENABLED) {
        try {
            console.log('[Ollama] Attempting request...');
            const response = await fetch(`${OLLAMA_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'llama3.1:8b',
                    messages: [
                        { role: 'system', content: 'You are a travel expert. Output only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    format: 'json',
                    temperature: 0.3,
                    num_predict: maxTokens,
                    stream: false
                })
            });

            console.log('[Ollama] Response status:', response.status);
            if (!response.ok) {
                const errText = await response.text();
                console.log('[Ollama] Error response:', errText.substring(0, 200));
            }

            if (response.ok) {
                const result = await response.json();
                if (result.message?.content) {
                    const content = result.message.content;
                    try {
                        const parsed = JSON.parse(content);
                        const normalized = normalizeItinerary(parsed);
                        if (!normalized.days) {
                            const textParsed = parseTextItinerary(content);
                            if (textParsed) return res.status(200).json({ source: 'ollama-text-parsed', ...textParsed });
                        }
                        return res.status(200).json({ source: 'ollama', ...normalized });
                    } catch {
                        const textParsed = parseTextItinerary(content);
                        if (textParsed) return res.status(200).json({ source: 'ollama-text-parsed', ...textParsed });
                        return res.status(503).json(configError('Ollama'));
                    }
                }
            }
        } catch (error) {
            console.log('[Ollama] Request error:', error.message);
        }
    }

    // Try OpenRouter (unified AI access)
    if (OPENROUTER_API_KEY) {
        try {
            console.log('[OpenRouter] Attempting request...');
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'HTTP-Referer': 'https://travelgenie.example.com',
                    'X-Title': 'TravelGenie'
                },
                body: JSON.stringify({
                    model: 'openai/gpt-4o-mini',
                    messages: [
                        { role: 'system', content: 'You are a travel expert. Output only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    response_format: { type: 'json_object' },
                    temperature: 0.3,
                    max_tokens: maxTokens
                })
            });

            console.log('[OpenRouter] Response status:', response.status);
            if (!response.ok) {
                const errText = await response.text();
                console.log('[OpenRouter] Error response:', errText.substring(0, 200));
            }

            if (response.ok) {
                const result = await response.json();
                console.log('[OpenRouter] Response keys:', Object.keys(result));
                console.log('[OpenRouter] choices:', Array.isArray(result.choices) ? result.choices.length : 'not array');
                console.log('[OpenRouter] message keys:', result.choices?.[0]?.message ? Object.keys(result.choices[0].message) : 'no message');
                console.log('[OpenRouter] content type:', typeof result.choices?.[0]?.message?.content);

                // Handle different content structures
                let content = null;
                if (typeof result.choices?.[0]?.message?.content === 'string') {
                    content = result.choices[0].message.content;
                } else if (Array.isArray(result.choices?.[0]?.message?.content)) {
                    // Some models return content as an array of parts
                    content = result.choices[0].message.content
                        .map(part => typeof part === 'string' ? part : (part.text || part.content || ''))
                        .join('');
                } else if (result.message?.content) {
                    // Some OpenRouter responses use result.message instead of result.choices[0].message
                    content = typeof result.message.content === 'string'
                        ? result.message.content
                        : JSON.stringify(result.message.content);
                }

                console.log('[OpenRouter] Content found:', !!content, '| Length:', content?.length);
                if (content) console.log('[OpenRouter] Content preview:', content.substring(0, 200));

                if (content) {
                    try {
                        const parsed = JSON.parse(content);
                        console.log('[OpenRouter] JSON parse: SUCCESS');
                        const normalized = normalizeItinerary(parsed);
                        console.log('[OpenRouter] Normalized days:', normalized?.days?.length);
                        if (!normalized.days) {
                            const textParsed = parseTextItinerary(content);
                            console.log('[OpenRouter] Text parse:', !!textParsed);
                            if (textParsed) return res.status(200).json({ source: 'openrouter-text-parsed', ...textParsed });
                        }
                        return res.status(200).json({ source: 'openrouter', ...normalized });
                    } catch (parseErr) {
                        console.log('[OpenRouter] JSON parse FAILED:', parseErr.message);
                        // Try to repair truncated JSON
                        const repaired = repairTruncatedJson(content);
                        if (repaired) {
                            console.log('[OpenRouter] JSON repair: SUCCESS');
                            const normalized = normalizeItinerary(repaired);
                            console.log('[OpenRouter] Repaired normalized days:', normalized?.days?.length);
                            if (normalized.days) {
                                return res.status(200).json({ source: 'openrouter-repaired', ...normalized });
                            }
                        } else {
                            console.log('[OpenRouter] JSON repair: FAILED');
                        }
                        // JSON parse failed - try text parsing
                        const textParsed = parseTextItinerary(content);
                        console.log('[OpenRouter] Text parse:', !!textParsed);
                        if (textParsed) return res.status(200).json({ source: 'openrouter-text-parsed', ...textParsed });
                        return res.status(503).json(configError('OpenRouter'));
                    }
                } else {
                    console.log('[OpenRouter] No content found in response');
                    console.log('[OpenRouter] Full response:', JSON.stringify(result).substring(0, 500));
                }
            }
        } catch (error) {
            console.log('[OpenRouter] Request error:', error.message);
        }
    }

    // No AI provider configured or all failed - show configuration message
    const configuredProviders = [];
    if (OPENAI_API_KEY) configuredProviders.push('OpenAI');
    if (OPENROUTER_API_KEY) configuredProviders.push('OpenRouter');
    if (OLLAMA_ENABLED) configuredProviders.push('Ollama');

    if (configuredProviders.length > 0) {
        console.log('[AI] All configured providers failed:', configuredProviders.join(', '));
        return res.status(503).json(configError(configuredProviders.join(' / ')));
    }

    // No provider configured at all
    console.log('[AI] No AI provider configured');
    res.status(503).json(configError(null));
}