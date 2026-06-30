// api/generate-itinerary.js
// Hybrid: Uses OpenAI API key if available, falls back to mock data

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { destination, startDate, endDate, budget, travelers, travelStyle, interests } = req.body || {};

    if (!destination || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate mock fallback
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

    // Try OpenAI if key is configured
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
                        { role: 'user', content: `Generate a day-by-day travel itinerary for ${destination} from ${startDate} to ${endDate}. Budget: ${budget}. Travelers: ${travelers}. Style: ${travelStyle}. Interests: ${interests?.join(', ')}. Return only JSON with structure: {"days":[{"day":"Day 1","date":"Date","activities":[{"time":"Morning","name":"Activity","description":"Desc"}]}]}` }
                    ],
                    response_format: { type: 'json_object' },
                    max_tokens: 1500
                })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.choices?.[0]?.message?.content) {
                    try {
                        const parsed = JSON.parse(result.choices[0].message.content);
                        return res.status(200).json(parsed);
                    } catch {
                        return res.status(200).json(mockItinerary);
                    }
                }
            }
        } catch (error) {
            console.log('OpenAI error, using mock data:', error.message);
        }
    }

    // Fallback to mock data
    res.status(200).json(mockItinerary);
}