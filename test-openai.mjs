import { readFileSync } from 'fs';

const env = readFileSync('.env', 'utf8');
const lines = env.split('\n');
let OPENAI_API_KEY = null;
let OPENROUTER_API_KEY = null;
for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('OPENAI_API_KEY=') && !trimmed.startsWith('#')) {
        OPENAI_API_KEY = trimmed.split('=').slice(1).join('=');
    }
    if (trimmed.startsWith('OPENROUTER_API_KEY=') && !trimmed.startsWith('#')) {
        OPENROUTER_API_KEY = trimmed.split('=').slice(1).join('=');
    }
}

const payload = {
    model: 'gpt-4.1-mini',
    messages: [
        { role: 'system', content: 'You are a travel expert. Output only valid JSON.' },
        { role: 'user', content: 'Generate a 2-day travel itinerary for Paris, France. Budget: moderate. Travelers: 2. Style: couple. Interests: culture, food. Return only JSON with a "days" array. Each day has "day", "date", and "activities" (array with "time", "name", "description").' }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500
};

const routerPayload = {
    model: 'openai/gpt-4o-mini',
    messages: [
        { role: 'system', content: 'You are a travel expert. Output only valid JSON.' },
        { role: 'user', content: 'Generate a 2-day travel itinerary for Paris, France. Budget: moderate. Travelers: 2. Style: couple. Interests: culture, food. Return only JSON with a "days" array. Each day has "day", "date", and "activities" (array with "time", "name", "description").' }
    ],
    response_format: { type: 'json_object' },
    max_tokens: 1500
};

async function testOpenAI() {
    console.log('Sending request to OpenAI...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
        const err = await response.text();
        console.error('OpenAI error:', err);
        return false;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
        console.error('No content in response:', JSON.stringify(result, null, 2));
        return false;
    }

    console.log('Raw response:', content);

    const itinerary = JSON.parse(content);
    console.log('\n--- Parsed Itinerary ---');
    console.log('Days:', itinerary.days ? itinerary.days.length : 0);

    if (itinerary.days) {
        itinerary.days.forEach(day => {
            console.log(`\n${day.day}: ${day.date}`);
            if (day.activities) {
                day.activities.forEach(act => {
                    console.log(`  [${act.time}] ${act.name}: ${act.description}`);
                });
            }
        });
    }

    console.log('\nOpenAI test passed!');
    return true;
}

async function testOpenRouter() {
    console.log('Sending request to OpenRouter...');
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://travelgenie.example.com',
            'X-Title': 'TravelGenie'
        },
        body: JSON.stringify(routerPayload)
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
        const err = await response.text();
        console.error('OpenRouter error:', err);
        return false;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
        console.error('No content in response:', JSON.stringify(result, null, 2));
        return false;
    }

    console.log('Raw response:', content);

    const itinerary = JSON.parse(content);
    console.log('\n--- Parsed Itinerary ---');
    console.log('Days:', itinerary.days ? itinerary.days.length : 0);

    if (itinerary.days) {
        itinerary.days.forEach(day => {
            console.log(`\n${day.day}: ${day.date}`);
            if (day.activities) {
                day.activities.forEach(act => {
                    console.log(`  [${act.time}] ${act.name}: ${act.description}`);
                });
            }
        });
    }

    console.log('\nOpenRouter test passed!');
    return true;
}

async function main() {
    let tested = false;

    if (OPENAI_API_KEY) {
        tested = true;
        const ok = await testOpenAI();
        if (ok) return;
    }

    if (OPENROUTER_API_KEY) {
        tested = true;
        const ok = await testOpenRouter();
        if (ok) return;
    }

    if (!tested) {
        console.error('No API key found in .env (need OPENAI_API_KEY or OPENROUTER_API_KEY)');
        process.exit(1);
    }

    console.error('All API tests failed.');
    process.exit(1);
}

main();