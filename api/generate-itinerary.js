// api/generate-itinerary.js
// Version A: AI-powered with OpenAI, Ollama, OpenRouter, or mock fallback
// Set OPENAI_API_KEY, OLLAMA_URL, or OPENROUTER_API_KEY in environment

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// Only attempt Ollama if explicitly configured (prevents timeout delays when not installed)
// OLLAMA_ENABLED takes precedence; if unset, fall back to checking OLLAMA_URL (backward compat)
const OLLAMA_ENABLED = process.env.OLLAMA_ENABLED === 'true' || (process.env.OLLAMA_ENABLED === undefined && !!process.env.OLLAMA_URL);

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
            description: ''
        };
    }
    return {
        time: normalizeTimeLabel(act.time, actIdx),
        name: act.name || act.activity || 'Unknown',
        description: act.description || ''
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
        activities
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
        days: days.map((day, idx) => normalizeDay(day, idx, meta.fallbackDate))
    };
}

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { destination, startDate, endDate, budget, travelers, travelStyle, interests } = req.body || {};

    if (!destination || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate inclusive day count (handles DST edge cases)
    const dayCount = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);

    // Generate mock fallback (no AI costs)
    const mockItinerary = {
        days: Array.from({ length: dayCount }, (_, i) => ({
            day: `Day ${i + 1}`,
            date: new Date(new Date(startDate).getTime() + i * 86400000).toDateString(),
            activities: [
                { time: 'Morning', name: 'Sightseeing', description: `Explore ${destination}` },
                { time: 'Afternoon', name: 'Lunch', description: 'Try local cuisine' },
                { time: 'Evening', name: 'Relaxation', description: 'Rest at accommodation' }
            ]
        }))
    };

    const prompt = `Generate a day-by-day travel itinerary for ${destination} from ${startDate} to ${endDate}. Budget: ${budget}. Travelers: ${travelers}. Style: ${travelStyle}. Interests: ${interests?.join(', ') || 'general'}. Return only JSON with a "days" array. Each day has "day", "date", and "activities" (array with "time", "name", "description").`;

    // Try OpenAI first
    if (OPENAI_API_KEY) {
        try {
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
                    max_tokens: 1500
                })
            });

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
                            if (textParsed) return res.status(200).json(textParsed);
                        }
                        return res.status(200).json(normalized);
                    } catch {
                        // JSON parse failed - try text parsing
                        const textParsed = parseTextItinerary(content);
                        if (textParsed) return res.status(200).json(textParsed);
                        return res.status(200).json(mockItinerary);
                    }
                }
            }
        } catch (error) {
            console.log('OpenAI error, falling back:', error.message);
        }
    }

    // Try Ollama (local, free) - only if explicitly configured
    if (OLLAMA_ENABLED) {
        try {
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
                    stream: false
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.message?.content) {
                    const content = result.message.content;
                    try {
                        const parsed = JSON.parse(content);
                        const normalized = normalizeItinerary(parsed);
                        if (!normalized.days) {
                            const textParsed = parseTextItinerary(content);
                            if (textParsed) return res.status(200).json(textParsed);
                        }
                        return res.status(200).json(normalized);
                    } catch {
                        const textParsed = parseTextItinerary(content);
                        if (textParsed) return res.status(200).json(textParsed);
                        return res.status(200).json(mockItinerary);
                    }
                }
            }
        } catch (error) {
            console.log('Ollama error, using mock data:', error.message);
        }
    }

    // Try OpenRouter (unified AI access)
    if (OPENROUTER_API_KEY) {
        try {
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
                    max_tokens: 1500
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.choices?.[0]?.message?.content) {
                    const content = result.choices[0].message.content;
                    try {
                        const parsed = JSON.parse(content);
                        const normalized = normalizeItinerary(parsed);
                        if (!normalized.days) {
                            const textParsed = parseTextItinerary(content);
                            if (textParsed) return res.status(200).json(textParsed);
                        }
                        return res.status(200).json(normalized);
                    } catch {
                        const textParsed = parseTextItinerary(content);
                        if (textParsed) return res.status(200).json(textParsed);
                        return res.status(200).json(mockItinerary);
                    }
                }
            }
        } catch (error) {
            console.log('OpenRouter error, falling back:', error.message);
        }
    }

    // Fallback to mock data
    res.status(200).json(mockItinerary);
}