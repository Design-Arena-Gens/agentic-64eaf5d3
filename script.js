(function () {
  'use strict';

  const STORAGE_KEY = 'zoo_ratings_v1';
  const categories = ['ice cream', 'coffee', 'casserole', 'waffle', 'other'];

  const zooCenter = { lat: 32.7353, lng: -117.1490 }; // San Diego Zoo area
  const restaurants = [
    { id: 'rst-1', name: 'Safari Bites', lat: 32.7359, lng: -117.1498 },
    { id: 'rst-2', name: 'Elephant Grounds', lat: 32.7351, lng: -117.1509 },
    { id: 'rst-3', name: 'Penguin Scoop', lat: 32.7345, lng: -117.1482 },
    { id: 'rst-4', name: 'Giraffe Grill', lat: 32.7362, lng: -117.1477 },
    { id: 'rst-5', name: 'Waffle Warden', lat: 32.7349, lng: -117.1466 }
  ];

  function loadRatings() {
    try {
      const text = localStorage.getItem(STORAGE_KEY);
      if (!text) return {};
      const data = JSON.parse(text);
      return typeof data === 'object' && data ? data : {};
    } catch {
      return {};
    }
  }

  function saveRatings(all) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function ensureRestaurant(all, restaurantId) {
    if (!all[restaurantId]) all[restaurantId] = {};
    for (const c of categories) {
      if (!Array.isArray(all[restaurantId][c])) all[restaurantId][c] = [];
    }
  }

  function addRatings(restaurantId, newRatings) {
    const all = loadRatings();
    ensureRestaurant(all, restaurantId);
    for (const [cat, value] of Object.entries(newRatings)) {
      const num = Number(value);
      if (Number.isFinite(num) && num >= 1 && num <= 5) {
        all[restaurantId][cat].push(num);
      }
    }
    saveRatings(all);
  }

  function average(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const sum = arr.reduce((a, b) => a + b, 0);
    return Math.round((sum / arr.length) * 10) / 10; // one decimal
  }

  function getRestaurantStats(restaurantId) {
    const all = loadRatings();
    ensureRestaurant(all, restaurantId);
    const stats = {};
    for (const c of categories) {
      const arr = all[restaurantId][c];
      stats[c] = { avg: average(arr), count: arr.length };
    }
    return stats;
  }

  function templatePopup(restaurant) {
    const stats = getRestaurantStats(restaurant.id);
    const statsRows = categories.map(c => {
      const s = stats[c];
      const avgText = s.avg === null ? '?' : `${s.avg} ?`;
      return `<tr><th>${escapeHtml(titleCase(c))}</th><td>${avgText}</td><td>${s.count} vote${s.count === 1 ? '' : 's'}</td></tr>`;
    }).join('');

    const inputs = categories.map(c => {
      const name = `rate-${restaurant.id}-${c}`;
      const buttons = [1,2,3,4,5].map(v => (
        `<button type="button" class="rating-input" data-name="${name}" data-category="${c}" data-value="${v}"><span>${v}</span></button>`
      )).join('');
      return `<div class="category"><label>${escapeHtml(titleCase(c))}</label><div class="ratings-row" role="radiogroup" aria-label="${escapeHtml(c)}">${buttons}</div></div>`;
    }).join('');

    return `
      <div class="popup-container" data-restaurant-id="${restaurant.id}">
        <h3 class="popup-title">${escapeHtml(restaurant.name)}</h3>
        <div class="popup-section stats">
          <table>
            <thead><tr><th>Category</th><th>Avg</th><th>Votes</th></tr></thead>
            <tbody>${statsRows}</tbody>
          </table>
        </div>
        <div class="popup-section">
          ${inputs}
          <div class="actions">
            <button class="button" data-action="submit">Submit Selected Ratings</button>
            <button class="button secondary" data-action="clear">Clear Selections</button>
          </div>
        </div>
      </div>
    `;
  }

  function titleCase(s) {
    return s.replace(/(^|\s)([a-z])/g, (_, sp, ch) => sp + ch.toUpperCase());
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Selection state per open popup (not persisted)
  const selection = new Map(); // key: name, value: number

  function clearSelection() {
    selection.clear();
    updateButtonsCheckedState();
  }

  function updateButtonsCheckedState() {
    const buttons = document.querySelectorAll('.rating-input');
    buttons.forEach(btn => {
      const name = btn.getAttribute('data-name');
      const value = Number(btn.getAttribute('data-value'));
      const checked = selection.get(name) === value;
      btn.setAttribute('data-checked', String(checked));
    });
  }

  function bindPopupInteractions(containerEl, restaurant) {
    containerEl.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target) return;
      const action = target.getAttribute('data-action');
      if (action === 'submit') {
        const selectedForRestaurant = {};
        // collect selections for this restaurant only
        for (const [name, value] of selection.entries()) {
          const [, id, cat] = name.split('-');
          if (id === restaurant.id) selectedForRestaurant[cat] = value;
        }
        if (Object.keys(selectedForRestaurant).length > 0) {
          addRatings(restaurant.id, selectedForRestaurant);
          // re-render popup to show fresh stats
          const content = templatePopup(restaurant);
          currentPopup.setContent(content);
          // after leafet injects HTML, re-bind
          setTimeout(() => {
            const el = document.querySelector('.popup-container');
            if (el) bindPopupInteractions(el, restaurant);
            // clear only the selections for this restaurant
            for (const [name] of Array.from(selection.entries())) {
              const [, id] = name.split('-');
              if (id === restaurant.id) selection.delete(name);
            }
            updateButtonsCheckedState();
          }, 0);
        }
        return;
      }
      if (action === 'clear') {
        // clear only this restaurant's selections
        for (const [name] of Array.from(selection.entries())) {
          const [, id] = name.split('-');
          if (id === restaurant.id) selection.delete(name);
        }
        updateButtonsCheckedState();
        return;
      }
      // handle rating button
      if (target.classList.contains('rating-input')) {
        const name = target.getAttribute('data-name');
        const value = Number(target.getAttribute('data-value'));
        // toggle logic: clicking same value unselects
        selection.set(name, selection.get(name) === value ? undefined : value);
        if (selection.get(name) === undefined) selection.delete(name);
        updateButtonsCheckedState();
      }
    });
  }

  // Initialize map
  const map = L.map('map', { zoomControl: true }).setView([zooCenter.lat, zooCenter.lng], 17);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let currentPopup = null;

  const redIcon = new L.Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  restaurants.forEach((r) => {
    const marker = L.marker([r.lat, r.lng], { title: r.name, icon: redIcon }).addTo(map);
    marker.on('click', () => {
      const html = templatePopup(r);
      currentPopup = L.popup({ closeButton: true, autoPan: true })
        .setLatLng([r.lat, r.lng])
        .setContent(html)
        .openOn(map);
      setTimeout(() => {
        const el = document.querySelector('.popup-container');
        if (el) bindPopupInteractions(el, r);
        updateButtonsCheckedState();
      }, 0);
    });
  });
})();
