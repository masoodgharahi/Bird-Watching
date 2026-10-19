let birdsData = [];
let currentBirdId = null;
let pendingPhotos = [];
let editingSightingIndex = null; // برای حالت ویرایش

// 1. Load Data
async function init() {
    try {
        let res = await fetch('birds_clean.json');
        if (!res.ok) res = await fetch('birds.json');
        if (!res.ok) throw new Error("File not found");

        birdsData = await res.json();
        if (!Array.isArray(birdsData)) throw new Error("Data is not an array");

        renderBirdList(birdsData);
    } catch (err) {
        console.error("Error loading birds data:", err);
        document.getElementById('bird-list').innerHTML = 
            "<p style='padding:20px; text-align:center; color:red;'>خطا در بارگذاری فایل پرندگان.</p>";
    }
}

// 2. Render List
function renderBirdList(birds) {
    const list = document.getElementById('bird-list');
    list.innerHTML = '';
    
    birds.forEach(bird => {
        if (!bird) return;
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
    const bird = birdsData.find(b => String(b.id || b['id '] || '').trim() === birdId);
    if (!bird) return;

    const nameFa = String(bird.nameFa || bird['nameFa '] || 'نامشخص').trim();
    const sciName = String(bird.scientificName || bird['scientificName '] || '').trim();
    const imgUrl = String(bird.imageUrl || bird['imageUrl '] || '').trim();
    const description = String(bird.description || bird['description '] || 'توضیحاتی موجود نیست.').trim();
    const wikiUrl = String(bird.wikiUrl || bird['wikiUrl '] || '#').trim();

    document.getElementById('modal-img').src = imgUrl || 'https://via.placeholder.com/300?text=No+Image';
    document.getElementById('modal-name').textContent = nameFa;
    document.getElementById('modal-sci-name').textContent = sciName;
    
    const descDiv = document.getElementById('modal-desc');
    descDiv.textContent = description;
    if (wikiUrl && wikiUrl !== '#') {
        descDiv.innerHTML += `<br><br><a href="${wikiUrl}" target="_blank" style="color:var(--primary); text-decoration:none; font-weight:bold;">🔗 مطالعه بیشتر در ویکی‌پدیا</a>`;
    }
    
    openModal('bird-modal');
    await renderSightingHistory(birdId);
}

// 5. Sighting History (با دکمه‌های ویرایش و حذف)
async function renderSightingHistory(birdId) {
    const historyDiv = document.getElementById('sighting-history');
    historyDiv.innerHTML = '<p style="text-align:center;">در حال بارگذاری...</p>';
    
    const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
    
    if (sightings.length === 0) {
        historyDiv.innerHTML = '<p style="color:#888; text-align:center;">هنوز مشاهده‌ای برای این پرنده ثبت نکرده‌اید.</p>';
        return;
    }

    historyDiv.innerHTML = '';
    sightings.slice().reverse().forEach((sighting, reverseIdx) => {
        // چون reverse کردیم، index واقعی = length - 1 - reverseIdx
        const realIndex = sightings.length - 1 - reverseIdx;
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
            <div class="sighting-actions">
                <button class="btn-edit" data-index="${realIndex}">✏️ ویرایش</button>
                <button class="btn-delete" data-index="${realIndex}">🗑️ حذف</button>
            </div>
        `;
        historyDiv.appendChild(item);
    });

    // اضافه کردن event listener به دکمه‌ها
    historyDiv.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = () => editSighting(birdId, parseInt(btn.dataset.index));
    });
    historyDiv.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = () => deleteSighting(birdId, parseInt(btn.dataset.index));
    });
}

// 6. حذف مشاهده
async function deleteSighting(birdId, index) {
    if (!confirm('آیا از حذف این مشاهده مطمئن هستید؟')) return;
    
    const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
    sightings.splice(index, 1);
    await localforage.setItem(`sightings_${birdId}`, sightings);
    await renderSightingHistory(birdId);
}

// 7. ویرایش مشاهده
async function editSighting(birdId, index) {
    const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
    const sighting = sightings[index];
    if (!sighting) return;

    // باز کردن فرم با داده‌های از پیش پر شده
    document.getElementById('sighting-date').value = sighting.date || '';
    document.getElementById('sighting-notes').value = sighting.notes || '';
    
    // نمایش عکس‌های قبلی در preview
    pendingPhotos = [...(sighting.photos || [])];
    const preview = document.getElementById('photo-preview');
    preview.innerHTML = '';
    pendingPhotos.forEach(p => {
        const img = document.createElement('img');
        img.src = p;
        preview.appendChild(img);
    });

    // تغییر عنوان و دکمه برای حالت ویرایش
    document.getElementById('log-modal-title').textContent = 'ویرایش مشاهده';
    document.getElementById('submit-btn').textContent = 'بروزرسانی مشاهده';
    editingSightingIndex = index;

    openModal('log-modal');
}

// 8. باز کردن فرم ثبت جدید
document.getElementById('log-sighting-btn').onclick = () => {
    document.getElementById('sighting-date').valueAsDate = new Date();
    document.getElementById('sighting-notes').value = '';
    document.getElementById('photo-preview').innerHTML = '';
    pendingPhotos = [];
    editingSightingIndex = null;
    document.getElementById('log-modal-title').textContent = 'ثبت مشاهده';
    document.getElementById('submit-btn').textContent = 'ذخیره مشاهده (آفلاین)';
    openModal('log-modal');
};

// 9. اضافه کردن عکس جدید (در کنار عکس‌های قبلی در حالت ویرایش)
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
    // پاک کردن input تا بتوان دوباره همان فایل را انتخاب کرد
    e.target.value = '';
});

// 10. Submit فرم (هم برای ثبت جدید و هم ویرایش)
document.getElementById('sighting-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentBirdId) return;

    let date = document.getElementById('sighting-date').value;
    if (!date) {
        const today = new Date();
        date = today.toISOString().split('T')[0];
    }
    const notes = document.getElementById('sighting-notes').value;
    
    const sightings = await localforage.getItem(`sightings_${currentBirdId}`) || [];
    
    const sightingData = {
        date: date,
        notes: notes,
        photos: [...pendingPhotos]
    };

    if (editingSightingIndex !== null) {
        // حالت ویرایش
        sightings[editingSightingIndex] = sightingData;
    } else {
        // حالت ثبت جدید
        sightings.push(sightingData);
    }
    
    await localforage.setItem(`sightings_${currentBirdId}`, sightings);
    
    // ریست کردن حالت
    pendingPhotos = [];
    editingSightingIndex = null;
    
    closeModal('log-modal');
    await renderSightingHistory(currentBirdId);
    alert(editingSightingIndex !== null ? 'مشاهده بروزرسانی شد!' : 'مشاهده شما با موفقیت ذخیره شد!');
};

// 11. نمایش همه مشاهدات
document.getElementById('all-sightings-btn').onclick = showAllSightings;

async function showAllSightings() {
    openModal('all-sightings-modal');
    const listDiv = document.getElementById('all-sightings-list');
    listDiv.innerHTML = '<p style="text-align:center;">در حال بارگذاری...</p>';

    // جمع‌آوری همه مشاهدات از همه پرندگان
    const allSightings = [];
    const keys = await localforage.keys();
    
    for (const key of keys) {
        if (!key.startsWith('sightings_')) continue;
        const birdId = key.replace('sightings_', '');
        const bird = birdsData.find(b => String(b.id || b['id '] || '').trim() === birdId);
        if (!bird) continue;
        
        const sightings = await localforage.getItem(key) || [];
        sightings.forEach((s, idx) => {
            allSightings.push({
                birdId: birdId,
                index: idx,
                birdName: String(bird.nameFa || bird['nameFa '] || 'نامشخص').trim(),
                birdImage: String(bird.imageUrl || bird['imageUrl '] || '').trim(),
                ...s
            });
        });
    }

    if (allSightings.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">هنوز هیچ مشاهده‌ای ثبت نکرده‌اید.<br>برای شروع، روی یک پرنده کلیک کنید و "ثبت مشاهده" را بزنید.</p>';
        return;
    }

    // مرتب‌سازی بر اساس تاریخ (جدیدترین در بالا)
    allSightings.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    listDiv.innerHTML = '';
    allSightings.forEach(s => {
        const card = document.createElement('div');
        card.className = 'all-sighting-card';
        
        let photosHtml = '';
        if (s.photos && s.photos.length > 0) {
            photosHtml = '<div class="sighting-photos">';
            s.photos.forEach(p => photosHtml += `<img src="${p}" alt="عکس">`);
            photosHtml += '</div>';
        }

        card.innerHTML = `
            <div class="all-sighting-header">
                <img src="${s.birdImage || 'https://via.placeholder.com/50?text=?'}" onerror="this.src='https://via.placeholder.com/50?text=?'">
                <div class="info">
                    <h4>${s.birdName}</h4>
                    <div class="date">📅 ${s.date}</div>
                </div>
            </div>
            <div class="notes">${s.notes || 'بدون توضیحات'}</div>
            ${photosHtml}
            <div class="sighting-actions">
                <button class="btn-delete" data-bird="${s.birdId}" data-index="${s.index}">🗑️ حذف</button>
            </div>
        `;
        listDiv.appendChild(card);
    });

    // event listener برای دکمه حذف
    listDiv.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('آیا از حذف این مشاهده مطمئن هستید؟')) return;
            const birdId = btn.dataset.bird;
            const index = parseInt(btn.dataset.index);
            const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
            sightings.splice(index, 1);
            await localforage.setItem(`sightings_${birdId}`, sightings);
            // رفرش کردن لیست
            showAllSightings();
        };
    });
}

// 12. Image Compression
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

// 13. Modal Helpers
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// Start App
init();
