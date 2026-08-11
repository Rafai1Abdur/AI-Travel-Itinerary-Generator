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
            const response = await fetch('/api/generate-itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const itinerary = await response.json();
            renderItinerary(itinerary);
        } catch (err) {
            console.error('Fetch error:', err);
            showError('Unable to generate itinerary. Please try again.');
        } finally {
            setLoading(false);
        }
    });

    function validateForm(data) {
        if (!data.destination || data.destination.length > 100) {
            showError('Please enter a valid destination.');
            return false;
        }

        const start = new Date(data.startDate);
        const end = new Date(data.endDate);

        // Reject invalid dates (NaN timestamps) and ensure end > start
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            showError('Please enter valid dates.');
            return false;
        }

        if (end <= start) {
            showError('End date must be after start date.');
            return false;
        }

        return true;
    }

    function sanitizeInput(str) {
        if (typeof str !== 'string') return '';
        // Strip control characters (including NUL) which could cause prompt injection issues
        return str.replace(/[\u0000-\u001F\u007F]/g, '').trim();
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

        // Detect format and extract days array
        if (data && Array.isArray(data)) {
            days = data;
        } else if (data && data.days && Array.isArray(data.days)) {
            days = data.days;
        } else if (data && data.travelItinerary && data.travelItinerary.itinerary && Array.isArray(data.travelItinerary.itinerary)) {
            days = data.travelItinerary.itinerary;
            meta = { destination: data.travelItinerary.destination };
        } else if (data && data.itinerary && data.itinerary.days && Array.isArray(data.itinerary.days)) {
            days = data.itinerary.days;
            meta = data.itinerary;
        } else if (data && data.itinerary && data.itinerary.destinations && Array.isArray(data.itinerary.destinations)) {
            days = data.itinerary.destinations;
            meta = { destination: data.itinerary.destination };
        }

        if (days.length === 0) {
            showError('Invalid response from server');
            console.error('renderItinerary: No days found. data keys:', Object.keys(data || {}));
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
            }

            // Build header using textContent (XSS-safe)
            const header = document.createElement('div');
            header.className = 'day-header';
            header.textContent = `${dayLabel}: ${dateLabel}`;

            if (day.location) {
                const locationSpan = document.createElement('span');
                locationSpan.className = 'day-location';
                locationSpan.textContent = ` (${day.location})`;
                header.appendChild(locationSpan);
            }

            if (meta.destination) {
                const destSpan = document.createElement('span');
                destSpan.className = 'day-destination';
                destSpan.textContent = ` ${meta.destination}`;
                header.appendChild(destSpan);
            }

            card.appendChild(header);

            if (day.activities && day.activities.length > 0) {
                day.activities.forEach((activity, actIdx) => {
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

                    // Build activity using textContent (XSS-safe)
                    const activityDiv = document.createElement('div');
                    activityDiv.className = 'activity';

                    const timeDiv = document.createElement('div');
                    timeDiv.className = 'activity-time';
                    timeDiv.textContent = timeLabel;
                    activityDiv.appendChild(timeDiv);

                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'activity-name';
                    nameDiv.textContent = actName;
                    activityDiv.appendChild(nameDiv);

                    if (actDesc) {
                        const descDiv = document.createElement('div');
                        descDiv.className = 'activity-desc';
                        descDiv.textContent = actDesc;
                        activityDiv.appendChild(descDiv);
                    }

                    card.appendChild(activityDiv);
                });
            } else {
                const noActivity = document.createElement('div');
                noActivity.className = 'activity';
                noActivity.textContent = 'No activities planned';
                card.appendChild(noActivity);
            }

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