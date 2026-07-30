document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('itinerary-form');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');
    const spinner = document.getElementById('spinner');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData(form);
        const data = {
            destination: sanitizeInput(formData.get('destination')),
            startDate: formData.get('startDate'),
            endDate: formData.get('endDate'),
            budget: formData.get('budget'),
            travelers: parseInt(formData.get('travelers')),
            travelStyle: formData.get('travelStyle'),
            interests: formData.getAll('interests').slice(0, 10)
        };

        if (!validateForm(data)) return;

        setLoading(true);
        clearError();

        try {
            console.log('Sending request:', data);
            const response = await fetch('/api/generate-itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            console.log('Response status:', response.status);
            const itinerary = await response.json();
            console.log('Received itinerary:', JSON.stringify(itinerary, null, 2));
            const daysCount = itinerary.days ? itinerary.days.length : (itinerary.itinerary ? (itinerary.itinerary.days ? itinerary.itinerary.days.length : itinerary.itinerary.destinations ? itinerary.itinerary.destinations.length : 0) : 0);
            console.log('Days count:', daysCount);
            renderItinerary(itinerary);
        } catch (err) {
            console.error('Fetch error:', err);
            showError('Unable to generate itinerary. Please try again.');
        } finally {
            setLoading(false);
        }
    });

    function validateForm(data) {
        const start = new Date(data.startDate);
        const end = new Date(data.endDate);
        
        if (!data.destination || data.destination.length > 100) {
            showError('Please enter a valid destination.');
            return false;
        }
        
        if (end <= start) {
            showError('End date must be after start date.');
            return false;
        }
        
        return true;
    }

    function sanitizeInput(str) {
        return str.replace(/[<>'"&]/g, (char) => ({
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
        }[char]));
    }

    function setLoading(show) {
        loading.classList.toggle('hidden', !show);
        const button = form.querySelector('button');
        button.disabled = show;
        if (show) {
            button.classList.add('btn-loading');
            spinner.classList.remove('hidden');
            // Hide results only when starting loading
            results.classList.add('hidden');
        } else {
            button.classList.remove('btn-loading');
            spinner.classList.add('hidden');
        }
    }

    function showError(message) {
        error.textContent = message;
        error.classList.remove('hidden');
    }

    function clearError() {
        error.classList.add('hidden');
    }

    function renderItinerary(data) {
        results.innerHTML = '';

        let days = [];
        let meta = {};
        let sourceFormat = '';

        // Detect format and extract days array
        if (data && Array.isArray(data)) {
            days = data;
            sourceFormat = 'array';
        } else if (data && data.days && Array.isArray(data.days)) {
            days = data.days;
            sourceFormat = 'top-level-days';
        } else if (data && data.travelItinerary && data.travelItinerary.itinerary && Array.isArray(data.travelItinerary.itinerary)) {
            days = data.travelItinerary.itinerary;
            meta = { destination: data.travelItinerary.destination };
            sourceFormat = 'travelItinerary';
        } else if (data && data.itinerary && data.itinerary.days && Array.isArray(data.itinerary.days)) {
            days = data.itinerary.days;
            meta = data.itinerary;
            sourceFormat = 'nested-itinerary-days';
        } else if (data && data.itinerary && data.itinerary.destinations && Array.isArray(data.itinerary.destinations)) {
            days = data.itinerary.destinations;
            meta = { destination: data.itinerary.destination };
            sourceFormat = 'nested-itinerary-destinations';
        }

        if (days.length === 0) {
            showError('Invalid response from server');
            console.error('renderItinerary: No days found. data keys:', Object.keys(data || {}), 'format:', sourceFormat);
            return;
        }

        days.forEach((day, index) => {
            const card = document.createElement('div');
            card.className = 'day-card';
            card.style.transitionDelay = `${index * 100}ms`;

            let dayLabel = day.day;
            if (typeof day.day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.day)) {
                dayLabel = `Day ${index + 1}`;
            } else if (typeof day.day === 'number') {
                dayLabel = `Day ${day.day}`;
            } else if (typeof day.day === 'string' && !day.day.startsWith('Day ')) {
                dayLabel = `Day ${day.day}`;
            } else if (typeof day.day === 'undefined') {
                dayLabel = `Day ${index + 1}`;
            }

            let dateLabel = day.date || '';
            if (typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day.date)) {
                dateLabel = new Date(day.date + 'T00:00:00').toDateString();
            } else if (typeof day.date === 'string') {
                dateLabel = day.date;
            }

            const locationLabel = day.location ? ` <span class="day-location">(${day.location})</span>` : '';
            const metaLabel = meta.destination ? ` <span class="day-destination">${meta.destination}</span>` : '';

            const activitiesHtml = day.activities && day.activities.length > 0
                ? day.activities.map((activity, actIdx) => {
                    let timeLabel;
                    let actName;
                    let actDesc;

                    if (typeof activity === 'string') {
                        timeLabel = actIdx < 1 ? 'Morning' : actIdx < 3 ? 'Afternoon' : 'Evening';
                        actName = activity;
                        actDesc = '';
                    } else {
                        timeLabel = activity.time ? normalizeTime(activity.time) : (actIdx < 1 ? 'Morning' : actIdx < 3 ? 'Afternoon' : 'Evening');
                        actName = activity.name || activity.activity || 'Unknown';
                        actDesc = activity.description || '';
                    }

                    return `
                    <div class="activity">
                        <div class="activity-time">${timeLabel}</div>
                        <div class="activity-name">${actName}</div>
                        ${actDesc ? `<div class="activity-desc">${actDesc}</div>` : ''}
                    </div>
                `;
                }).join('')
                : '<div class="activity">No activities planned</div>';

            card.innerHTML = `
                <div class="day-header">${dayLabel}${metaLabel}: ${dateLabel}${locationLabel}</div>
                ${activitiesHtml}
            `;

            results.appendChild(card);
        });

        results.classList.remove('hidden');

        setTimeout(() => {
            document.querySelectorAll('.day-card').forEach(card => {
                card.classList.add('visible');
            });
        }, 50);
    }

    function normalizeTime(time) {
        if (typeof time !== 'string') return time || '';
        const lower = time.toLowerCase();
        if (lower === 'morning' || lower === 'am') return 'Morning';
        if (lower === 'afternoon' || lower === 'midday') return 'Afternoon';
        if (lower === 'evening' || lower === 'pm') return 'Evening';
        if (lower === 'night' || lower === 'late') return 'Night';
        return time;
    }
});