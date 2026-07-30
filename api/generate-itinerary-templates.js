var templates = {
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
        Morning: { name: 'Local Market', description: 'Browse artisan markets' },
        Afternoon: { name: 'Shopping District', description: 'Shop at popular retail areas' },
        Evening: { name: 'Souvenir Hunt', description: 'Find unique mementos' }
    },
    entertainment: {
        Morning: { name: 'Theme Park', description: 'Ride attractions and shows' },
        Afternoon: { name: 'Live Performance', description: 'Catch street performers or shows' },
        Evening: { name: 'Nightlife', description: 'Experience local bars or clubs' }
    },
    default: {
        Morning: { name: 'Sightseeing', description: 'Explore the city' },
        Afternoon: { name: 'Lunch', description: 'Try local cuisine' },
        Evening: { name: 'Relaxation', description: 'Rest at accommodation' }
    }
};

function getActivities(interests) {
    const activities = [];
    const timeSlots = ['Morning', 'Afternoon', 'Evening'];
    
    timeSlots.forEach((time, index) => {
        const interest = interests[index % interests.length];
        const template = templates[interest] || templates.default;
        activities.push({
            time: time,
            name: template[time].name,
            description: template[time].description
        });
    });
    
    return activities;
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

    // Template-based itinerary (no AI, 100% free)
    const daysCount = Math.max(1, (new Date(endDate) - new Date(startDate)) / 86400000 + 1);
    
    const itinerary = {
        days: Array.from({ length: daysCount }, (_, i) => ({
            day: `Day ${i + 1}`,
            date: new Date(new Date(startDate).getTime() + i * 86400000).toDateString(),
            activities: getActivities(interests.length > 0 ? interests : ['default'])
        }))
    };

    res.status(200).json(itinerary);
}