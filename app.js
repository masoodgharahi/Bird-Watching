let birdsData = [];
let currentBirdId = null;

// 1. Load Data
async function init() {
    try {
        const res = await fetch('birds_clean.json'); 
        birdsData = await res.json();
        renderBirdList(birdsData);
    } catch (err) {
        console.error("Error loading birds.json", err);
        document.getElementById('bird-list').innerHTML = "<p style='padding:20px; text-align:center;'>خطا در بارگذاری فایل پرندگان. لطفاً فایل birds_clean.json را در کنار این فایل قرار دهید.</p>";
    }
}

// 2. Render List
function renderBirdList(birds) {
    const list = document.getElementById('bird-list');
    list.innerHTML = '';
    birds.forEach(bird => {
        // Handle potential trailing spaces in keys from the raw JSON
        const id = (bird.id || bird['id ']).trim();
        const nameFa = (bird.nameFa || bird['nameFa ']).trim();
        const sciName = (bird.scientificName || bird['scientificName ']).trim();
        const imgUrl = (bird.imageUrl || bird['imageUrl ']).trim();

        const card = document.createElement('div');
        card.className = 'bird-card';
        card.onclick = () => openBirdDetail(id);
        card.innerHTML = `
            <img src="${imgUrl}" alt="${nameFa}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
            <div class="bird-card-info">
                <h3>${nameFa}</h3>
                <p>${sciName}</p>
            </div>
        `;
        list.appendChild(card);
    });
}

// 3. Search
document.getElementById('search-input').addEventListener('input', (e) => {
    const term = e.target.value.trim();
    if (!term) return renderBirdList(birdsData);
    const filtered = birdsData.filter(b => {
        const name = (b.nameFa || b['nameFa ']).trim();
        const sci = (b.scientificName || b['scientificName ']).trim();
        return name.includes(term) || sci.toLowerCase().includes(term.toLowerCase());
    });
    renderBirdList(filtered);
});

// 4. Bird Detail
async function openBirdDetail(birdId) {
    currentBirdId = birdId;
    const bird = birdsData.find(b => (b.id || b['id ']).trim() === birdId);
    if (!bird) return;

    document.getElementById('modal-img').src = (bird.imageUrl || bird['imageUrl ']).trim();
    document.getElementById('modal-name').textContent = (bird.nameFa || bird['nameFa ']).trim();
    document.getElementById('modal-sci-name').textContent = (bird.scientificName || bird['scientificName ']).trim();
    document.getElementById('modal-desc').textContent = (bird.description || bird['description ']).trim();
    
    openModal('bird-modal');
    await renderSightingHistory(birdId);
}

// 5. Sighting History
async function renderSightingHistory(birdId) {
    const historyDiv = document.getElementById('sighting-history');
    historyDiv.innerHTML = '<p>در حال بارگذاری...</p>';
    
    const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
    
    if (sightings.length === 0) {
        historyDiv.innerHTML = '<p style="color:#888; text-align:center;">هنوز مشاهده‌ای ثبت نکرده‌اید.</p>';
        return;
    }

    historyDiv.innerHTML = '';
    sightings.reverse().forEach(sighting => {
        const item = document.createElement('div');
        item.className = 'sighting-item';
        
        let photosHtml = '';
        if (sighting.photos && sighting.photos.length > 0) {
            photosHtml = '<div class="sighting-photos">';
            sighting.photos.forEach(p => photosHtml += `<img src="${p}" alt="عکس پرنده">`);
            photosHtml += '</div>';
        }

        item.innerHTML = `
            <div class="date">${sighting.date}</div>
            <div class="notes">${sighting.notes || 'بدون توضیحات'}</div>
            ${photosHtml}
        `;
        historyDiv.appendChild(item);
    });
}

// 6. Log Sighting Form
document.getElementById('log-sighting-btn').onclick = () => {
    document.getElementById('sighting-date').valueAsDate = new Date();
    document.getElementById('sighting-form').reset();
    document.getElementById('photo-preview').innerHTML = '';
    pendingPhotos = [];
    openModal('log-modal');
};

let pendingPhotos = [];
document.getElementById('sighting-photo').addEventListener('change', async (e) => {
    const files = e.target.files;
    const preview = document.getElementById('photo-preview');
    
    for (let file of files) {
        const compressed = await compressImage(file);
        pendingPhotos.push(compressed);
        const img = document.createElement('img');
        img.src = compressed;
        preview.appendChild(img);
    }
});

document.getElementById('sighting-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentBirdId) return;

    const date = document.getElementById('sighting-date').value;
    const notes = document.getElementById('sighting-notes').value;
    
    const sightings = await localforage.getItem(`sightings_${currentBirdId}`) || [];
    sightings.push({
        date: date,
        notes: notes,
        photos: [...pendingPhotos] // Save compressed base64 images
    });
    
    await localforage.setItem(`sightings_${currentBirdId}`, sightings);
    pendingPhotos = [];
    
    closeModal('log-modal');
    await renderSightingHistory(currentBirdId);
    alert('مشاهده شما با موفقیت ذخیره شد! (آفلاین)');
};

// 7. Image Compression (Crucial for mobile storage)
function compressImage(file, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 8. Modal Helpers
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// Start App
init();