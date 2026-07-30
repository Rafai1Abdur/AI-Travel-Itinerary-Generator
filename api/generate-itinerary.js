// api/generate-itinerary.js
// Version A: AI-powered with OpenAI, Ollama, OpenRouter, or mock fallback
// Set OPENAI_API_KEY, OLLAMA_URL, or OPENROUTER_API_KEY in environment

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

function normalizeItinerary(data) {
    if (!data) return data;

    let itinerary = data;

    // Handle { travelItinerary: { itinerary: [...] } } format (latest OpenRouter response)
    // Note: this is handled in script.js; server-side normalization covers the other formats
    if (data.travelItinerary && data.travelItinerary.itinerary && Array.isArray(data.travelItinerary.itinerary)) {
        itinerary = {
            days: data.travelItinerary.itinerary.map((day, idx) => {
                let dayLabel = day.day;
                if (typeof day.day === 'number') {
                    dayLabel = `Day ${day.day}`;
                } else if (typeof day.day === 'string' && !day.day.startsWith('Day ')) {
                    dayLabel = `Day ${day.day}`;
                }
                const normalizedDate = (typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.date))
                    ? new Date(day.date + 'T00:00:00').toDateString()
                    : (data.travelItinerary.dates ? data.travelItinerary.dates.start : '');
                let activities = (day.activities || []).map((act, actIdx) => {
                    let timeLabel;
                    let actName;
                    let actDesc;
                    if (typeof act === 'string') {
                        timeLabel = actIdx < 1 ? 'Morning' : actIdx < 3 ? 'Afternoon' : 'Evening';
                        actName = act;
                        actDesc = '';
                    } else {
                        timeLabel = act.time ? capitalizeTime(act.time) : (actIdx < 1 ? 'Morning' : actIdx < 3 ? 'Afternoon' : 'Evening');
                        actName = act.name || act.activity || 'Unknown';
                        actDesc = act.description || '';
                    }
                    return { time: timeLabel, name: actName, description: actDesc };
                });
                return { day: dayLabel, date: normalizedDate, location: day.location || '', activities };
            })
        };
    }
    // Handle { itinerary: { days: [...] } } format (OpenRouter format with ISO dates)
    else if (data.itinerary && data.itinerary.days && Array.isArray(data.itinerary.days)) {
    if (data.itinerary && data.itinerary.days && Array.isArray(data.itinerary.days)) {
        itinerary = {
            days: data.itinerary.days.map((day, idx) => {
                let dayLabel = day.day;
                if (typeof day.day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.day)) {
                    dayLabel = `Day ${idx + 1}`;
                } else if (typeof day.day === 'number') {
                    dayLabel = `Day ${day.day}`;
                } else if (typeof day.day === 'string' && !day.day.startsWith('Day ')) {
                    dayLabel = `Day ${day.day}`;
                }
                const normalizedDate = (typeof day.day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.day))
                    ? new Date(day.day + 'T00:00:00').toDateString()
                    : (data.itinerary.travel_dates ? data.itinerary.travel_dates.start : '');
                let activities = day.activities || [];
                activities = activities.map((act, actIdx) => {
                    let timeLabel;
                    if (actIdx < 1) timeLabel = 'Morning';
                    else if (actIdx < 3) timeLabel = 'Afternoon';
                    else timeLabel = 'Evening';
                    return {
                        time: timeLabel,
                        name: act.name || act.activity || 'Unknown',
                        description: act.description || ''
                    };
                });
                return { day: dayLabel, date: normalizedDate, activities };
            })
        };
    }
    // Handle { itinerary: { destinations: [...] } } format
    else if (data.itinerary && data.itinerary.destinations) {
        itinerary = {
            days: data.itinerary.destinations.map((dest, idx) => ({
                day: `Day ${idx + 1}`,
                date: dest.date,
                location: dest.location,
                activities: (dest.activities || []).map(act => ({
                    time: act.time || (actIdx => {
                        if (actIdx < 1) return 'Morning';
                        if (actIdx < 3) return 'Afternoon';
                        return 'Evening';
                    })(0),
                    name: act.activity || act.name || 'Unknown',
                    description: act.description || ''
                }))
            }))
        };
    }
    // Handle standard { days: [...] } format
    else if (data.days) {
        itinerary = data;
    } else {
        return data;
    }

    return {
        ...itinerary,
        days: itinerary.days.map(day => {
            let dayLabel = day.day;
            if (typeof day.day === 'number') {
                dayLabel = `Day ${day.day}`;
            } else if (typeof day.day === 'string') {
                const dayNum = parseInt(day.day);
                if (!isNaN(dayNum) && dayNum > 0) {
                    dayLabel = `Day ${dayNum}`;
                } else if (!day.day.startsWith('Day ')) {
                    dayLabel = `Day ${day.day}`;
                }
            }
            let normalizedDate = day.date || '';
            if (typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.date)) {
                normalizedDate = new Date(day.date + 'T00:00:00').toDateString();
            }
            let activities = day.activities;
            if (activities && Array.isArray(activities)) {
                activities = activities.map((act, actIdx) => {
                    let timeLabel = act.time;
                    if (typeof act.time === 'string' && /^\d{1,2}:\d{2}/.test(act.time)) {
                        const hour = parseInt(act.time.split(':')[0]);
                        if (hour < 6) timeLabel = 'Night';
                        else if (hour < 12) timeLabel = 'Morning';
                        else if (hour < 17) timeLabel = 'Afternoon';
                        else if (hour < 21) timeLabel = 'Evening';
                        else timeLabel = 'Night';
                    } else if (!act.time) {
                        if (actIdx < 1) timeLabel = 'Morning';
                        else if (actIdx < 3) timeLabel = 'Afternoon';
                        else timeLabel = 'Evening';
                    } else {
                        timeLabel = capitalizeTime(act.time);
                    }
                    return {
                        time: timeLabel,
                        name: act.name || act.activity || 'Unknown',
                        description: act.description || ''
                    };
                });
            }
            return {
                day: dayLabel,
                date: normalizedDate,
                location: day.location || '',
                activities
            };
        })
    };
}

function capitalizeTime(time) {
    if (typeof time !== 'string') return time || '';
    const lower = time.toLowerCase();
    if (lower === 'morning' || lower === 'am') return 'Morning';
    if (lower === 'afternoon' || lower === 'midday') return 'Afternoon';
    if (lower === 'evening' || lower === 'pm') return 'Evening';
    if (lower === 'night' || lower === 'late') return 'Night';
    return time;
}

function capitalizeTime(time) {
    if (typeof time !== 'string') return time || '';
    const lower = time.toLowerCase();
    if (lower === 'morning' || lower === 'am') return 'Morning';
    if (lower === 'afternoon' || lower === 'midday') return 'Afternoon';
    if (lower === 'evening' || lower === 'pm') return 'Evening';
    if (lower === 'night' || lower === 'late') return 'Night';
    return time;
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

    // Generate mock fallback (no AI costs)
    const mockItinerary = {
        days: Array.from({ length: (new Date(endDate) - new Date(startDate)) / 86400000 + 1 }, (_, i) => ({
            day: `Day ${i + 1}`,
            date: new Date(new Date(startDate).getTime() + i * 86400000).toDateString(),
            activities: [
                { time: 'Morning', name: 'Sightseeing', description: `Explore ${destination}` },
                { time: 'Afternoon', name: 'Lunch', description: 'Try local cuisine' },
                { time: 'Evening', name: 'Relaxation', description: 'Rest at accommodation' }
            ]
        }))
    };

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
                        { role: 'user', content: `Generate a day-by-day travel itinerary for ${destination} from ${startDate} to ${endDate}. Budget: ${budget}. Travelers: ${travelers}. Style: ${travelStyle}. Interests: ${interests?.join(', ')}. Return only JSON.` }
                    ],
                    response_format: { type: 'json_object' },
                    max_tokens: 1500
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.choices?.[0]?.message?.content) {
                    try {
                        return res.status(200).json(normalizeItinerary(JSON.parse(result.choices[0].message.content)));
                    } catch {
                        return res.status(200).json(mockItinerary);
                    }
                }
            }
        } catch (error) {
            console.log('OpenAI error, falling back:', error.message);
        }
    }

    // Try Ollama (local, free)
    try {
        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3.1:8b',
                messages: [
                    { role: 'system', content: 'You are a travel expert. Output only valid JSON.' },
                    { role: 'user', content: `Generate a day-by-day travel itinerary for ${destination} from ${startDate} to ${endDate}. Budget: ${budget}. Travelers: ${travelers}. Style: ${travelStyle}. Interests: ${interests?.join(', ')}. Return only JSON.` }
                ],
                stream: false
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.message?.content) {
                try {
                    return res.status(200).json(normalizeItinerary(JSON.parse(result.message.content)));
                } catch {
                    return res.status(200).json(mockItinerary);
                }
            }
        }
    } catch (error) {
        console.log('Ollama error, using mock data:', error.message);
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
                        { role: 'user', content: `Generate a day-by-day travel itinerary for ${destination} from ${startDate} to ${endDate}. Budget: ${budget}. Travelers: ${travelers}. Style: ${travelStyle}. Interests: ${interests?.join(', ')}. Return only JSON.` }
                    ],
                    response_format: { type: 'json_object' },
                    max_tokens: 1500
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.choices?.[0]?.message?.content) {
                    try {
                        return res.status(200).json(normalizeItinerary(JSON.parse(result.choices[0].message.content)));
                    } catch {
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