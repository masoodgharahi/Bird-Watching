let birdsData = [];
let currentBirdId = null;

// 1. Load Data (ضدخطا و هوشمند)
async function init() {
    try {
        // ابتدا سعی می‌کند فایل تمیز شده را بخواند، اگر نبود فایل اصلی را می‌خواند
        let res = await fetch('birds_clean.json');
        if (!res.ok) {
            res = await fetch('birds.json');
        }
        
        if (!res.ok) {
            throw new Error("File not found");
        }

        birdsData = await res.json();
        
        // اطمینان از اینکه داده‌ها به صورت آرایه هستند
        if (!Array.isArray(birdsData)) {
            throw new Error("Data is not an array");
        }

        renderBirdList(birdsData);
    } catch (err) {
        console.error("Error loading birds data:", err);
        document.getElementById('bird-list').innerHTML = 
            "<p style='padding:20px; text-align:center; color:red;'>خطا در بارگذاری فایل پرندگان.<br>لطفاً مطمئن شوید فایل birds_clean.json یا birds.json در کنار این فایل قرار دارد.</p>";
    }
}

// 2. Render List (کاملاً ایمن در برابر داده‌های ناقص)
function renderBirdList(birds) {
    const list = document.getElementById('bird-list');
    list.innerHTML = '';
    
    birds.forEach(bird => {
        if (!bird) return; // رد کردن آیتم‌های خالی یا نامعتبر
        
        // استخراج ایمن داده‌ها (اگر وجود نداشت، رشته خالی برمی‌گرداند تا خطای trim رخ ندهد)
        const id = String(bird.id || bird['id '] || '').trim();
        const nameFa = String(bird.nameFa || bird['nameFa '] || 'نامشخص').trim();
        const sciName = String(bird.scientificName || bird['scientificName '] || '').trim();
        const imgUrl = String(bird.imageUrl || bird['imageUrl '] || '').trim();

        const card = document.createElement('div');
        card.className = 'bird-card';
        card.onclick = () => openBirdDetail(id);
        
        const displayImg = imgUrl || 'https://via.placeholder.com/150?text=No+Image';

        card.innerHTML = `
            <img src="${displayImg}" alt="${nameFa}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
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
    const term = e.target.value.trim().toLowerCase();
    if (!term) return renderBirdList(birdsData);
    
    const filtered = birdsData.filter(b => {
        if (!b) return false;
        const name = String(b.nameFa || b['nameFa '] || '').toLowerCase();
        const sci = String(b.scientificName || b['scientificName '] || '').toLowerCase();
        return name.includes(term) || sci.includes(term);
    });
    renderBirdList(filtered);
});

// 4. Bird Detail
async function openBirdDetail(birdId) {
    currentBirdId = birdId;
    
    const bird = birdsData.find(b => {
        const bId = String(b.id || b['id '] || '').trim();
        return bId === birdId;
    });
    
    if (!bird) {
        console.error("Bird not found:", birdId);
        return;
    }

    const nameFa = String(bird.nameFa || bird['nameFa '] || 'نامشخص').trim();
    const sciName = String(bird.scientificName || bird['scientificName '] || '').trim();
    const imgUrl = String(bird.imageUrl || bird['imageUrl '] || '').trim();
    const description = String(bird.description || bird['description '] || 'توضیحاتی موجود نیست.').trim();
    const wikiUrl = String(bird.wikiUrl || bird['wikiUrl '] || '#').trim();

    document.getElementById('modal-img').src = imgUrl || 'https://via.placeholder.com/300?text=No+Image';
    document.getElementById('modal-name').textContent = nameFa;
    document.getElementById('modal-sci-name').textContent = sciName;
    
    // نمایش توضیحات و لینک ویکی‌پدیا
    const descDiv = document.getElementById('modal-desc');
    descDiv.textContent = description;
    if (wikiUrl && wikiUrl !== '#') {
        descDiv.innerHTML += `<br><br><a href="${wikiUrl}" target="_blank" style="color:var(--primary); text-decoration:none; font-weight:bold;">🔗 مطالعه بیشتر در ویکی‌پدیا</a>`;
    }
    
    openModal('bird-modal');
    await renderSightingHistory(birdId);
}

// 5. Sighting History
async function renderSightingHistory(birdId) {
    const historyDiv = document.getElementById('sighting-history');
    historyDiv.innerHTML = '<p style="text-align:center;">در حال بارگذاری...</p>';
    
    const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
    
    if (sightings.length === 0) {
        historyDiv.innerHTML = '<p style="color:#888; text-align:center;">هنوز مشاهده‌ای برای این پرنده ثبت نکرده‌اید.</p>';
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
            <div class="date">📅 ${sighting.date}</div>
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
        photos: [...pendingPhotos]
    });
    
    await localforage.setItem(`sightings_${currentBirdId}`, sightings);
    pendingPhotos = [];
    
    closeModal('log-modal');
    await renderSightingHistory(currentBirdId);
    alert('مشاهده شما با موفقیت ذخیره شد! (آفلاین)');
};

// 7. Image Compression (فشرده‌سازی تصاویر برای ذخیره آفلاین)
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
