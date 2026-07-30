// test-server.mjs - Simple test server (uses template-based logic for testing)
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templates = {
    culture: {
        Morning: { name: 'Museum Visit', description: 'Explore local museums and galleries' },
        Afternoon: { name: 'Historic Sites', description: 'Tour historical landmarks' },
        Evening: { name: 'Cultural Show', description: 'Experience local arts or theater' }
    },
    food: {
        Morning: { name: 'Local Breakfast', description: 'Try traditional morning cuisine' },
        Afternoon: { name: 'Food Tour', description: 'Sample street food and markets' },
        Evening: { name: 'Dinner Restaurant', description: 'Enjoy authentic local dining' }
    },
    nature: {
        Morning: { name: 'Nature Trail', description: 'Hike scenic trails' },
        Afternoon: { name: 'Park Visit', description: 'Relax in botanical gardens' },
        Evening: { name: 'Scenic Viewpoint', description: 'Watch sunset from great vantage' }
    },
    shopping: {
        Morning: { name: 'Shopping Mall', description: 'Visit modern shopping centers' },
        Afternoon: { name: 'Local Boutiques', description: 'Browse artisan shops' },
        Evening: { name: 'Souvenir Market', description: 'Find unique local crafts' }
    },
    entertainment: {
        Morning: { name: 'Amusement Park', description: 'Ride attractions and shows' },
        Afternoon: { name: 'Live Performance', description: 'Catch street performers or shows' },
        Evening: { name: 'Nightlife District', description: 'Experience bars or clubs' }
    },
    default: {
        Morning: { name: 'Sightseeing', description: 'Explore the city' },
        Afternoon: { name: 'Lunch', description: 'Try local cuisine' },
        Evening: { name: 'Relaxation', description: 'Rest at accommodation' }
    }
};

function generateItinerary(destination, startDate, endDate, interests) {
    const daysCount = Math.max(1, (new Date(endDate) - new Date(startDate)) / 86400000 + 1);
    
    return {
        days: Array.from({ length: daysCount }, (_, i) => {
            const interest = interests && interests.length > 0 
                ? interests[Math.floor(i % interests.length)] 
                : 'default';
            const template = templates[interest] || templates.default;
            
            return {
                day: `Day ${i + 1}`,
                date: new Date(new Date(startDate).getTime() + i * 86400000).toDateString(),
                activities: [
                    { time: 'Morning', name: template.Morning.name, description: template.Morning.description },
                    { time: 'Afternoon', name: template.Afternoon.name, description: template.Afternoon.description },
                    { time: 'Evening', name: template.Evening.name, description: template.Evening.description }
                ]
            };
        })
    };
}

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript'
};

const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.end();
    
    if (req.url === '/api/generate-itinerary' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = body.trim() ? JSON.parse(body) : {};
                console.log('Request:', data.destination || 'no dest', data.startDate || 'no start', data.endDate || 'no end');
                const itinerary = generateItinerary(
                    data.destination || 'Paris', 
                    data.startDate || '2026-07-01', 
                    data.endDate || '2026-07-03', 
                    data.interests || []
                );
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(itinerary, null, 2));
            } catch (e) {
                console.error('Parse error:', e.message, 'body:', body);
                res.statusCode = 400;
                res.end(JSON.stringify({ error: 'Invalid request', details: e.message }));
            }
        });
    } else {
        const path = req.url === '/' ? '/index.html' : req.url;
        try {
            const ext = path.substring(path.lastIndexOf('.'));
            res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain');
            const file = await readFile(join(__dirname, '.' + path));
            res.end(file);
        } catch {
            res.statusCode = 404;
            res.end('Not found');
        }
    }
});

server.listen(8000, () => {
    console.log('Test server: http://localhost:8000');
    console.log('Uses template-based logic (no AI costs)');
});