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
            if (itinerary.days) {
                console.log('Days count:', itinerary.days.length);
            }
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

    function renderItinerary(itinerary) {
        results.innerHTML = '';
        
        if (!itinerary || !itinerary.days) {
            showError('Invalid response from server');
            return;
        }
        
        itinerary.days.forEach((day, index) => {
            const card = document.createElement('div');
            card.className = 'day-card';
            card.style.transitionDelay = `${index * 100}ms`;
            
            const activitiesHtml = day.activities && day.activities.length > 0
                ? day.activities.map(activity => `
                    <div class="activity">
                        <div class="activity-time">${activity.time}</div>
                        <div class="activity-name">${activity.name}</div>
                        <div class="activity-desc">${activity.description}</div>
                    </div>
                `).join('')
                : '<div class="activity">No activities planned</div>';
            
            card.innerHTML = `
                <div class="day-header">${day.day}: ${day.date}</div>
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
});