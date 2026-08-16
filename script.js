document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('itinerary-form');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const error = document.getElementById('error');
    const spinner = document.getElementById('spinner');
    const countrySelect = document.getElementById('country');
    const citySelect = document.getElementById('city');
    const loadingText = document.getElementById('loading-text');
    const loadingProgressBar = document.getElementById('loading-progress-bar');
    let loadingTextInterval = null;
    const loadingMessages = [
        'Planning your adventure...',
        'Finding hidden gems...',
        'Checking local events...',
        'Optimizing your route...',
        'Adding insider tips...',
        'Almost there...'
    ];
    let loadingMsgIndex = 0;

    // ======== Populate Country Dropdown ========
    const countries = Object.keys(COUNTRIES).sort();
    countries.forEach(country => {
        const option = document.createElement('option');
        option.value = country;
        option.textContent = country;
        countrySelect.appendChild(option);
    });

    // ======== Handle Country → City Dependency ========
    countrySelect.addEventListener('change', () => {
        const selectedCountry = countrySelect.value;
        citySelect.innerHTML = '<option value="">Select City</option>';
        citySelect.disabled = !selectedCountry;

        if (selectedCountry && COUNTRIES[selectedCountry]) {
            COUNTRIES[selectedCountry].forEach(city => {
                const option = document.createElement('option');
                option.value = city;
                option.textContent = city;
                citySelect.appendChild(option);
            });
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const country = formData.get('country');
        const city = formData.get('city');
        const destination = city && city !== '' ? `${city}, ${country}` : country;

        const data = {
            destination: sanitizeInput(destination),
            country: sanitizeInput(country),
            city: sanitizeInput(city),
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

        // Animate button press
        if (window.Motion) {
            const btn = form.querySelector('button');
            Motion.animate(btn, { scale: 0.95 }, { duration: 0.1 }).finished.then(() => {
                Motion.animate(btn, { scale: 1 }, { duration: 0.2, easing: 'ease-out' });
            });
        }

        try {
            const response = await fetch('/api/generate-itinerary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            // Check if the response is OK before parsing
            if (!response.ok) {
                let errorMsg = `Server error (${response.status})`;
                try {
                    const errData = await response.json();
                    if (errData && errData.error) errorMsg = errData.error;
                } catch {
                    // Response wasn't JSON - try text
                    try {
                        const text = await response.text();
                        if (text) errorMsg = text.substring(0, 200);
                    } catch { /* ignore */ }
                }
                showError(errorMsg);
                return;
            }

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
            showError('Please select a country and city.');
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
            // Start cycling loading messages
            loadingMsgIndex = 0;
            if (loadingText) loadingText.textContent = loadingMessages[0];
            if (loadingProgressBar) loadingProgressBar.style.width = '0%';
            loadingTextInterval = setInterval(() => {
                loadingMsgIndex = (loadingMsgIndex + 1) % loadingMessages.length;
                if (loadingText) loadingText.textContent = loadingMessages[loadingMsgIndex];
                if (loadingProgressBar) {
                    const progress = Math.min(90, (loadingMsgIndex / loadingMessages.length) * 100);
                    loadingProgressBar.style.width = `${progress}%`;
                }
            }, 1200);
        } else {
            button.classList.remove('btn-loading');
            spinner.classList.add('hidden');
            // Stop cycling loading messages
            if (loadingTextInterval) {
                clearInterval(loadingTextInterval);
                loadingTextInterval = null;
            }
            if (loadingProgressBar) loadingProgressBar.style.width = '100%';
        }
    }

    function showError(message) {
        error.textContent = message;
        error.classList.remove('hidden');
        if (window.Motion) {
            Motion.animate(error, { opacity: [0, 1], y: [-10, 0] }, { duration: 0.3 });
        }
    }

    function clearError() {
        error.classList.add('hidden');
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

    function renderItinerary(data) {
        results.innerHTML = '';

        let days = [];
        let meta = {};
        let overview = null;
        let accommodations = null;
        let packingList = null;
        let travelTips = null;

        // Detect format and extract days array + metadata
        if (data && Array.isArray(data)) {
            days = data;
        } else if (data && data.days && Array.isArray(data.days)) {
            days = data.days;
            overview = data.overview || null;
            accommodations = data.accommodations || null;
            packingList = data.packingList || null;
            travelTips = data.travelTips || null;
        } else if (data && data.travelItinerary && data.travelItinerary.itinerary && Array.isArray(data.travelItinerary.itinerary)) {
            days = data.travelItinerary.itinerary;
            meta = { destination: data.travelItinerary.destination };
        } else if (data && data.itinerary && data.itinerary.days && Array.isArray(data.itinerary.days)) {
            days = data.itinerary.days;
            meta = data.itinerary;
            overview = data.itinerary.overview || data.overview || null;
            accommodations = data.itinerary.accommodations || data.accommodations || null;
            packingList = data.itinerary.packingList || data.packingList || null;
            travelTips = data.itinerary.travelTips || data.travelTips || null;
        } else if (data && data.itinerary && data.itinerary.destinations && Array.isArray(data.itinerary.destinations)) {
            days = data.itinerary.destinations;
            meta = { destination: data.itinerary.destination };
        } else {
            // Deep-search fallback for ANY unexpected wrapper structure
            const found = findDaysArray(data);
            if (found) {
                days = found;
                if (data.destination) meta.destination = data.destination;
                else if (data.trip?.destination) meta.destination = data.trip.destination;
                else if (data.data?.destination) meta.destination = data.data.destination;
                overview = data.overview || data.tripOverview || null;
                accommodations = data.accommodations || data.hotels || null;
                packingList = data.packingList || data.packing || null;
                travelTips = data.travelTips || data.tips || null;
            }
        }

        if (days.length === 0) {
            // Show a diagnostic error with the actual response keys
            const keys = data && typeof data === 'object' ? Object.keys(data).join(', ') : typeof data;
            showError(`Invalid response from server. Received format with keys: ${keys || 'empty'}`);
            console.error('renderItinerary: No days found. data:', data);
            return;
        }

        const destination = meta.destination || data?.destination || '';

        // ======== Trip Overview Section ========
        if (overview || destination) {
            const overviewCard = document.createElement('div');
            overviewCard.className = 'trip-overview-card';

            if (destination) {
                const destTitle = document.createElement('h2');
                destTitle.className = 'trip-destination-title';
                destTitle.textContent = `Your ${destination} Adventure`;
                overviewCard.appendChild(destTitle);
            }

            if (overview) {
                if (overview.summary) {
                    const summary = document.createElement('p');
                    summary.className = 'trip-overview-summary';
                    summary.textContent = overview.summary;
                    overviewCard.appendChild(summary);
                }

                const statsRow = document.createElement('div');
                statsRow.className = 'trip-stats-row';
                const stats = [
                    { label: 'Total Days', value: days.length },
                    { label: 'Total Activities', value: days.reduce((sum, d) => sum + (d.activities?.length || 0), 0) },
                    { label: 'Budget', value: overview.totalBudget || '—' }
                ];
                stats.forEach(stat => {
                    const statItem = document.createElement('div');
                    statItem.className = 'trip-stat';
                    const statValue = document.createElement('div');
                    statValue.className = 'trip-stat-value';
                    statValue.textContent = String(stat.value);
                    const statLabel = document.createElement('div');
                    statLabel.className = 'trip-stat-label';
                    statLabel.textContent = stat.label;
                    statItem.appendChild(statValue);
                    statItem.appendChild(statLabel);
                    statsRow.appendChild(statItem);
                });
                overviewCard.appendChild(statsRow);

                if (overview.bestTimeToVisit) {
                    const bestTime = document.createElement('p');
                    bestTime.className = 'trip-best-time';
                    bestTime.textContent = `🌤️ Best time to visit: ${overview.bestTimeToVisit}`;
                    overviewCard.appendChild(bestTime);
                }
            }

            results.appendChild(overviewCard);
        }

        // ======== Accommodations Section ========
        if (accommodations && accommodations.length > 0) {
            const accomSection = document.createElement('div');
            accomSection.className = 'section-card';

            const accomTitle = document.createElement('h3');
            accomTitle.className = 'section-title';
            accomTitle.textContent = '🏨 Accommodations';
            accomSection.appendChild(accomTitle);

            accommodations.forEach(hotel => {
                const hotelItem = document.createElement('div');
                hotelItem.className = 'hotel-item';

                const hotelName = document.createElement('div');
                hotelName.className = 'hotel-name';
                hotelName.textContent = hotel.name || 'Hotel';
                hotelItem.appendChild(hotelName);

                const hotelDetails = document.createElement('div');
                hotelDetails.className = 'hotel-details';
                const parts = [];
                if (hotel.area) parts.push(`📍 ${hotel.area}`);
                if (hotel.pricePerNight) parts.push(`💰 ${hotel.pricePerNight}/night`);
                if (hotel.rating) parts.push(`⭐ ${hotel.rating}`);
                hotelDetails.textContent = parts.join(' • ');
                hotelItem.appendChild(hotelDetails);

                if (hotel.note) {
                    const hotelNote = document.createElement('div');
                    hotelNote.className = 'hotel-note';
                    hotelNote.textContent = hotel.note;
                    hotelItem.appendChild(hotelNote);
                }

                accomSection.appendChild(hotelItem);
            });

            results.appendChild(accomSection);
        }

        // ======== Day Cards (Timeline) ========
        const timeline = document.createElement('div');
        timeline.className = 'timeline';

        days.forEach((day, index) => {
            const dayItem = document.createElement('div');
            dayItem.className = 'timeline-item';
            dayItem.style.transitionDelay = `${index * 100}ms`;

            // Timeline node
            const node = document.createElement('div');
            node.className = 'timeline-node';
            node.textContent = index + 1;
            dayItem.appendChild(node);

            const card = document.createElement('div');
            card.className = 'day-card';

            // Day Header
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

            const header = document.createElement('div');
            header.className = 'day-header';
            header.textContent = `${dayLabel}: ${dateLabel}`;

            if (day.location) {
                const locationSpan = document.createElement('span');
                locationSpan.className = 'day-location';
                locationSpan.textContent = ` • ${day.location}`;
                header.appendChild(locationSpan);
            }
            card.appendChild(header);

            // Daily Summary
            if (day.summary) {
                const summaryDiv = document.createElement('div');
                summaryDiv.className = 'day-summary';
                summaryDiv.textContent = day.summary;
                card.appendChild(summaryDiv);
            }

            // Activities
            if (day.activities && day.activities.length > 0) {
                day.activities.forEach((activity, actIdx) => {
                    let timeLabel;
                    let actName;
                    let actDesc;
                    let actCost = '';
                    let actDuration = '';
                    let actTip = '';

                    if (typeof activity === 'string') {
                        timeLabel = actIdx < 1 ? 'Morning' : actIdx < 3 ? 'Afternoon' : 'Evening';
                        actName = activity;
                        actDesc = '';
                    } else {
                        timeLabel = activity.time ? normalizeTime(activity.time) : (actIdx < 1 ? 'Morning' : actIdx < 3 ? 'Afternoon' : 'Evening');
                        actName = activity.name || activity.activity || 'Unknown';
                        actDesc = activity.description || '';
                        actCost = activity.cost || activity.price || '';
                        actDuration = activity.duration || '';
                        actTip = activity.tip || activity.insiderTip || '';
                    }

                    const activityDiv = document.createElement('div');
                    activityDiv.className = 'activity';

                    const activityHeader = document.createElement('div');
                    activityHeader.className = 'activity-header';

                    const timeDiv = document.createElement('div');
                    timeDiv.className = 'activity-time';
                    timeDiv.textContent = timeLabel;
                    activityHeader.appendChild(timeDiv);

                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'activity-name';
                    nameDiv.textContent = actName;
                    activityHeader.appendChild(nameDiv);

                    activityDiv.appendChild(activityHeader);

                    if (actDesc) {
                        const descDiv = document.createElement('div');
                        descDiv.className = 'activity-desc';
                        descDiv.textContent = actDesc;
                        activityDiv.appendChild(descDiv);
                    }

                    // Metadata row
                    const metaParts = [];
                    if (actDuration) metaParts.push(`⏱️ ${actDuration}`);
                    if (actCost) metaParts.push(`💰 ${actCost}`);
                    if (metaParts.length > 0) {
                        const metaDiv = document.createElement('div');
                        metaDiv.className = 'activity-meta';
                        metaDiv.textContent = metaParts.join(' • ');
                        activityDiv.appendChild(metaDiv);
                    }

                    if (actTip) {
                        const tipDiv = document.createElement('div');
                        tipDiv.className = 'activity-tip';
                        tipDiv.textContent = `💡 ${actTip}`;
                        activityDiv.appendChild(tipDiv);
                    }

                    card.appendChild(activityDiv);
                });
            } else {
                const noActivity = document.createElement('div');
                noActivity.className = 'activity';
                noActivity.textContent = 'No activities planned';
                card.appendChild(noActivity);
            }

            // Meal Plan
            if (day.mealPlan && typeof day.mealPlan === 'object') {
                const mealDiv = document.createElement('div');
                mealDiv.className = 'meal-plan';
                const mealTitle = document.createElement('div');
                mealTitle.className = 'meal-plan-title';
                mealTitle.textContent = '🍽️ Meals';
                mealDiv.appendChild(mealTitle);

                const mealGrid = document.createElement('div');
                mealGrid.className = 'meal-grid';
                const meals = [
                    { label: 'Breakfast', value: day.mealPlan.breakfast },
                    { label: 'Lunch', value: day.mealPlan.lunch },
                    { label: 'Dinner', value: day.mealPlan.dinner }
                ];
                meals.forEach(meal => {
                    if (meal.value) {
                        const mealItem = document.createElement('div');
                        mealItem.className = 'meal-item';
                        const mealLabel = document.createElement('span');
                        mealLabel.className = 'meal-label';
                        mealLabel.textContent = meal.label + ': ';
                        const mealValue = document.createElement('span');
                        mealValue.className = 'meal-value';
                        mealValue.textContent = meal.value;
                        mealItem.appendChild(mealLabel);
                        mealItem.appendChild(mealValue);
                        mealGrid.appendChild(mealItem);
                    }
                });
                if (mealGrid.children.length > 0) {
                    mealDiv.appendChild(mealGrid);
                    card.appendChild(mealDiv);
                }
            }

            // Transportation
            if (day.transportation) {
                const transportDiv = document.createElement('div');
                transportDiv.className = 'day-transport';
                transportDiv.textContent = `🚆 ${day.transportation}`;
                card.appendChild(transportDiv);
            }

            dayItem.appendChild(card);
            timeline.appendChild(dayItem);
        });

        results.appendChild(timeline);

        // ======== Packing List Section ========
        if (packingList && packingList.length > 0) {
            const packingSection = document.createElement('div');
            packingSection.className = 'section-card';

            const packingTitle = document.createElement('h3');
            packingTitle.className = 'section-title';
            packingTitle.textContent = '🎒 Packing List';
            packingSection.appendChild(packingTitle);

            const packingGrid = document.createElement('div');
            packingGrid.className = 'packing-grid';
            packingList.forEach(item => {
                const packingItem = document.createElement('div');
                packingItem.className = 'packing-item';
                packingItem.textContent = `✓ ${item}`;
                packingGrid.appendChild(packingItem);
            });
            packingSection.appendChild(packingGrid);

            results.appendChild(packingSection);
        }

        // ======== Travel Tips Section ========
        if (travelTips && travelTips.length > 0) {
            const tipsSection = document.createElement('div');
            tipsSection.className = 'section-card';

            const tipsTitle = document.createElement('h3');
            tipsTitle.className = 'section-title';
            tipsTitle.textContent = '💡 Travel Tips';
            tipsSection.appendChild(tipsTitle);

            const tipsList = document.createElement('ul');
            tipsList.className = 'tips-list';
            travelTips.forEach(tip => {
                const tipItem = document.createElement('li');
                tipItem.className = 'tip-item';
                tipItem.textContent = tip;
                tipsList.appendChild(tipItem);
            });
            tipsSection.appendChild(tipsList);

            results.appendChild(tipsSection);
        }

        // ======== Action Buttons ========
        const actionRow = document.createElement('div');
        actionRow.className = 'action-row';

        const printBtn = document.createElement('button');
        printBtn.className = 'btn-secondary';
        printBtn.textContent = '🖨️ Print / Save PDF';
        printBtn.addEventListener('click', () => window.print());
        actionRow.appendChild(printBtn);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-secondary';
        copyBtn.textContent = '📋 Copy Itinerary';
        copyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                copyBtn.textContent = '✅ Copied!';
                setTimeout(() => { copyBtn.textContent = '📋 Copy Itinerary'; }, 2000);
            } catch {
                copyBtn.textContent = '❌ Copy failed';
                setTimeout(() => { copyBtn.textContent = '📋 Copy Itinerary'; }, 2000);
            }
        });
        actionRow.appendChild(copyBtn);

        results.appendChild(actionRow);

        results.classList.remove('hidden');

        // ======== Confetti on Success ========
        if (window.Motion) {
            // Create confetti particles
            const confettiColors = ['#2563eb', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
            for (let i = 0; i < 30; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti-piece';
                confetti.style.left = `${Math.random() * 100}%`;
                confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
                confetti.style.width = `${6 + Math.random() * 6}px`;
                confetti.style.height = `${6 + Math.random() * 6}px`;
                confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
                document.body.appendChild(confetti);
                Motion.animate(confetti, {
                    y: [0, window.innerHeight + 100],
                    x: [0, (Math.random() - 0.5) * 200],
                    rotate: [0, Math.random() * 720 - 360],
                    opacity: [1, 0.8, 0]
                }, {
                    duration: 1.5 + Math.random() * 1.5,
                    delay: Math.random() * 0.5,
                    easing: 'ease-in'
                }).finished.then(() => confetti.remove());
            }
        }

        // ======== Motion One Animations ========
        if (window.Motion) {
            // Animate overview card
            const overviewCard = results.querySelector('.trip-overview-card');
            if (overviewCard) {
                Motion.animate(overviewCard, { opacity: [0, 1], y: [-20, 0] }, { duration: 0.5, easing: 'ease-out' });
            }

            // Animate section cards
            results.querySelectorAll('.section-card').forEach((card, i) => {
                Motion.animate(card, { opacity: [0, 1], y: [20, 0] }, { duration: 0.4, delay: 0.1 + i * 0.1 });
            });

            // Animate timeline items with stagger
            const items = results.querySelectorAll('.timeline-item');
            items.forEach((item, i) => {
                Motion.animate(item, { opacity: [0, 1], y: [30, 0] }, {
                    duration: 0.5,
                    delay: 0.2 + i * 0.08,
                    easing: [0.34, 1.56, 0.64, 1] // spring-like easing
                });
            });

            // Animate action buttons
            Motion.animate(actionRow, { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: 0.5 });
        } else {
            // Fallback: just show everything
            setTimeout(() => {
                document.querySelectorAll('.timeline-item').forEach(item => {
                    item.classList.add('visible');
                });
            }, 50);
        }
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