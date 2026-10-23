let birdsData = [];
let customBirds = [];
let currentBirdId = null;
let pendingPhotos = [];
let editingSightingIndex = null;

// متغیرهای کراپ
let cropper = null;
let cropSuccessCallback = null;
let cropCancelCallback = null;
let cropQueue = [];
let cropTargetInput = null;

// 1. Load Data
async function init() {
    try {
        let res = await fetch('birds_clean.json');
        if (!res.ok) res = await fetch('birds.json');
        if (res.ok) {
            birdsData = await res.json();
            if (!Array.isArray(birdsData)) birdsData = [];
        } else {
            birdsData = [];
        }

        customBirds = await localforage.getItem('custom_birds') || [];
        renderBirdList(getAllBirds());
    } catch (err) {
        console.error("Error loading data:", err);
        document.getElementById('bird-list').innerHTML = 
            "<p style='padding:20px; text-align:center; color:red;'>خطا در بارگذاری داده‌ها.</p>";
    }
}

function getAllBirds() {
    return [...birdsData, ...customBirds];
}

// 2. Render List
function renderBirdList(birds) {
    const list = document.getElementById('bird-list');
    list.innerHTML = '';
    
    birds.forEach(bird => {
        if (!bird) return;
        const id = String(bird.id || '').trim();
        const nameFa = String(bird.nameFa || 'نامشخص').trim();
        const sciName = String(bird.scientificName || '').trim();
        const imgUrl = String(bird.imageUrl || '').trim();
        const isCustom = bird.isCustom === true;

        const card = document.createElement('div');
        card.className = 'bird-card';
        card.onclick = () => openBirdDetail(id);
        const displayImg = imgUrl || 'https://via.placeholder.com/150?text=No+Image';
        card.innerHTML = `
            ${isCustom ? '<span class="custom-badge">سفارشی</span>' : ''}
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
    const allBirds = getAllBirds();
    if (!term) return renderBirdList(allBirds);
    const filtered = allBirds.filter(b => {
        if (!b) return false;
        const name = String(b.nameFa || '').toLowerCase();
        const sci = String(b.scientificName || '').toLowerCase();
        const en = String(b.nameEn || '').toLowerCase();
        return name.includes(term) || sci.includes(term) || en.includes(term);
    });
    renderBirdList(filtered);
});

// 4. Bird Detail
async function openBirdDetail(birdId) {
    currentBirdId = birdId;
    const allBirds = getAllBirds();
    const bird = allBirds.find(b => String(b.id || '').trim() === birdId);
    if (!bird) return;

    const nameFa = String(bird.nameFa || 'نامشخص').trim();
    const sciName = String(bird.scientificName || '').trim();
    const imgUrl = String(bird.imageUrl || '').trim();
    const description = String(bird.description || 'توضیحاتی موجود نیست.').trim();
    const wikiUrl = String(bird.wikiUrl || '#').trim();

    document.getElementById('modal-img').src = imgUrl || 'https://via.placeholder.com/300?text=No+Image';
    document.getElementById('modal-name').textContent = nameFa;
    document.getElementById('modal-sci-name').textContent = sciName;
    
    const descDiv = document.getElementById('modal-desc');
    descDiv.textContent = description;
    if (wikiUrl && wikiUrl !== '#' && !bird.isCustom) {
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
    sightings.slice().reverse().forEach((sighting, reverseIdx) => {
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

    historyDiv.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = () => editSighting(birdId, parseInt(btn.dataset.index));
    });
    historyDiv.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = () => deleteSighting(birdId, parseInt(btn.dataset.index));
    });
}

// 6. Delete Sighting
async function deleteSighting(birdId, index) {
    if (!confirm('آیا از حذف این مشاهده مطمئن هستید؟')) return;
    const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
    sightings.splice(index, 1);
    await localforage.setItem(`sightings_${birdId}`, sightings);
    await renderSightingHistory(birdId);
}

// 7. Edit Sighting
async function editSighting(birdId, index) {
    const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
    const sighting = sightings[index];
    if (!sighting) return;

    document.getElementById('sighting-date').value = sighting.date || '';
    document.getElementById('sighting-notes').value = sighting.notes || '';
    
    pendingPhotos = [...(sighting.photos || [])];
    const preview = document.getElementById('photo-preview');
    preview.innerHTML = '';
    pendingPhotos.forEach(p => {
        const img = document.createElement('img');
        img.src = p;
        preview.appendChild(img);
    });

    document.getElementById('log-modal-title').textContent = 'ویرایش مشاهده';
    document.getElementById('submit-btn').textContent = 'بروزرسانی مشاهده';
    editingSightingIndex = index;

    openModal('log-modal');
}

// 8. New Sighting Form
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

// ✂️ 9. Photo Upload with Crop (Sighting)
document.getElementById('sighting-photo').addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    cropTargetInput = e.target;
    cropQueue = [...files];
    processCropQueue((croppedDataUrl) => {
        pendingPhotos.push(croppedDataUrl);
        const img = document.createElement('img');
        img.src = croppedDataUrl;
        document.getElementById('photo-preview').appendChild(img);
    });
});

// ✂️ 10. Photo Upload with Crop (New Bird)
let newBirdPhoto = null;
document.getElementById('new-bird-photo').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    cropTargetInput = e.target;
    cropQueue = [file];
    processCropQueue((croppedDataUrl) => {
        newBirdPhoto = croppedDataUrl;
        const preview = document.getElementById('new-bird-photo-preview');
        preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = croppedDataUrl;
        preview.appendChild(img);
    });
});

// ✂️ 11. Crop Queue Processor
function processCropQueue(successCallback) {
    if (cropQueue.length === 0) {
        if (cropTargetInput) {
            cropTargetInput.value = '';
            cropTargetInput = null;
        }
        return;
    }
    
    const file = cropQueue.shift();
    cropSuccessCallback = successCallback;
    cropCancelCallback = () => processCropQueue(successCallback);
    
    openCropModal(file);
}

// ✂️ 12. Open Crop Modal
function openCropModal(file) {
    const modal = document.getElementById('crop-modal');
    const image = document.getElementById('crop-image');
    
    document.body.classList.add('crop-open');
    
    const reader = new FileReader();
    reader.onload = function(e) {
        image.src = e.target.result;
        modal.classList.add('active');
        
        // مقداردهی اولیه Cropper
        if (cropper) {
            cropper.destroy();
        }
        
        cropper = new Cropper(image, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 0.85,
            responsive: true,
            restore: false,
            guides: true,
            center: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false,
            background: false,
        });
        
        // reset نسبت به "آزاد"
        setAspectRatio('free');
    };
    reader.readAsDataURL(file);
}

// ✂️ 13. Confirm Crop
function confirmCrop() {
    if (!cropper || !cropSuccessCallback) return;
    
    const canvas = cropper.getCroppedCanvas({
        maxWidth: 1200,
        maxHeight: 1200,
        imageSmoothingQuality: 'high',
    });
    
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const callback = cropSuccessCallback;
    
    closeCropModal();
    callback(croppedDataUrl);
}

// ✂️ 14. Cancel Crop
function cancelCrop() {
    closeCropModal();
    if (cropCancelCallback) {
        cropCancelCallback();
    }
}

// ✂️ 15. Close Crop Modal
function closeCropModal() {
    const modal = document.getElementById('crop-modal');
    modal.classList.remove('active');
    document.body.classList.remove('crop-open');
    
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    document.getElementById('crop-image').src = '';
    cropSuccessCallback = null;
    cropCancelCallback = null;
}

// ✂️ 16. Crop Tools
function rotateCrop(degrees) {
    if (cropper) cropper.rotate(degrees);
}

function flipCrop(direction) {
    if (!cropper) return;
    const data = cropper.getData();
    if (direction === 'x') {
        cropper.scaleX(data.scaleX === -1 ? 1 : -1);
    } else {
        cropper.scaleY(data.scaleY === -1 ? 1 : -1);
    }
}

function resetCrop() {
    if (cropper) cropper.reset();
    setAspectRatio('free');
}

function setAspectRatio(ratio) {
    if (!cropper) return;
    if (ratio === 'free') {
        cropper.setAspectRatio(NaN);
    } else {
        const [w, h] = ratio.split(':').map(Number);
        cropper.setAspectRatio(w / h);
    }
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ratio === String(ratio));
    });
}

// 17. Submit Sighting
document.getElementById('sighting-form').onsubmit = async (e) => {
    e.preventDefault();
    if (!currentBirdId) return;

    let date = document.getElementById('sighting-date').value;
    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }
    const notes = document.getElementById('sighting-notes').value;
    
    const sightings = await localforage.getItem(`sightings_${currentBirdId}`) || [];
    
    const sightingData = {
        date: date,
        notes: notes,
        photos: [...pendingPhotos]
    };

    if (editingSightingIndex !== null) {
        sightings[editingSightingIndex] = sightingData;
    } else {
        sightings.push(sightingData);
    }
    
    await localforage.setItem(`sightings_${currentBirdId}`, sightings);
    pendingPhotos = [];
    editingSightingIndex = null;
    
    closeModal('log-modal');
    await renderSightingHistory(currentBirdId);
    alert(editingSightingIndex !== null ? 'مشاهده بروزرسانی شد!' : 'مشاهده شما با موفقیت ذخیره شد!');
};

// 18. Show All Sightings
document.getElementById('all-sightings-btn').onclick = showAllSightings;

async function showAllSightings() {
    openModal('all-sightings-modal');
    const listDiv = document.getElementById('all-sightings-list');
    const statsDiv = document.getElementById('sightings-stats');
    listDiv.innerHTML = '<p style="text-align:center;">در حال بارگذاری...</p>';
    statsDiv.innerHTML = '';

    const allSightings = [];
    const keys = await localforage.keys();
    const uniqueBirdIds = new Set();
    
    for (const key of keys) {
        if (!key.startsWith('sightings_')) continue;
        const birdId = key.replace('sightings_', '');
        const allBirds = getAllBirds();
        const bird = allBirds.find(b => String(b.id || '').trim() === birdId);
        if (!bird) continue;
        
        const sightings = await localforage.getItem(key) || [];
        sightings.forEach((s, idx) => {
            allSightings.push({
                birdId: birdId,
                index: idx,
                birdName: String(bird.nameFa || 'نامشخص').trim(),
                birdImage: String(bird.imageUrl || '').trim(),
                ...s
            });
            uniqueBirdIds.add(birdId);
        });
    }

    const totalSightings = allSightings.length;
    const uniqueSpecies = uniqueBirdIds.size;
    statsDiv.innerHTML = `
        <div class="stat-item">
            <span class="number">${totalSightings}</span>
            <span class="label">کل مشاهدات</span>
        </div>
        <div class="stat-item">
            <span class="number">${uniqueSpecies}</span>
            <span class="label">گونه‌های مشاهده‌شده</span>
        </div>
    `;

    if (allSightings.length === 0) {
        listDiv.innerHTML = '<p class="empty-state">هنوز هیچ مشاهده‌ای ثبت نکرده‌اید.<br>برای شروع، روی یک پرنده کلیک کنید و "ثبت مشاهده" را بزنید.</p>';
        return;
    }

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

    listDiv.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async () => {
            if (!confirm('آیا از حذف این مشاهده مطمئن هستید؟')) return;
            const birdId = btn.dataset.bird;
            const index = parseInt(btn.dataset.index);
            const sightings = await localforage.getItem(`sightings_${birdId}`) || [];
            sightings.splice(index, 1);
            await localforage.setItem(`sightings_${birdId}`, sightings);
            showAllSightings();
        };
    });
}

// 19. Add New Bird
document.getElementById('add-bird-btn').onclick = () => {
    document.getElementById('add-bird-form').reset();
    document.getElementById('new-bird-photo-preview').innerHTML = '';
    newBirdPhoto = null;
    openModal('add-bird-modal');
};

document.getElementById('add-bird-form').onsubmit = async (e) => {
    e.preventDefault();
    const nameFa = document.getElementById('new-bird-name-fa').value.trim();
    if (!nameFa) return;

    const newBird = {
        id: 'custom_' + Date.now(),
        nameFa: nameFa,
        nameEn: document.getElementById('new-bird-name-en').value.trim(),
        scientificName: document.getElementById('new-bird-sci-name').value.trim(),
        description: document.getElementById('new-bird-desc').value.trim(),
        imageUrl: newBirdPhoto || '',
        isCustom: true
    };

    customBirds.push(newBird);
    await localforage.setItem('custom_birds', customBirds);
    newBirdPhoto = null;
    
    closeModal('add-bird-modal');
    renderBirdList(getAllBirds());
    alert('پرنده جدید با موفقیت اضافه شد!');
};

// 20. Export Backup
document.getElementById('export-btn').onclick = async () => {
    const backup = {
        version: 1,
        exportDate: new Date().toISOString(),
        customBirds: customBirds,
        sightings: {}
    };

    const keys = await localforage.keys();
    for (const key of keys) {
        if (key.startsWith('sightings_')) {
            backup.sightings[key] = await localforage.getItem(key);
        }
    }

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `birds-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('فایل پشتیبان با موفقیت دانلود شد!');
};

// 21. Import Backup
document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('هشدار: بازیابی پشتیبان، همه داده‌های فعلی را جایگزین می‌کند. آیا مطمئن هستید؟')) {
        e.target.value = '';
        return;
    }

    try {
        const text = await file.text();
        const backup = JSON.parse(text);

        if (!backup.sightings || !backup.customBirds) {
            alert('فایل پشتیبان نامعتبر است.');
            return;
        }

        const keys = await localforage.keys();
        for (const key of keys) {
            if (key.startsWith('sightings_') || key === 'custom_birds') {
                await localforage.removeItem(key);
            }
        }

        customBirds = backup.customBirds || [];
        await localforage.setItem('custom_birds', customBirds);

        for (const [key, value] of Object.entries(backup.sightings)) {
            await localforage.setItem(key, value);
        }

        renderBirdList(getAllBirds());
        alert('پشتیبان با موفقیت بازیابی شد!');
        showAllSightings();
    } catch (err) {
        console.error(err);
        alert('خطا در بازیابی فایل پشتیبان.');
    }
    e.target.value = '';
});

// 22. Modal Helpers
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { 
    const modal = document.getElementById(id);
    if (id !== 'crop-modal') { // جلوگیری از بستن تصادفی crop modal
        modal.classList.remove('active'); 
    }
}
window.onclick = function(event) {
    if (event.target.classList.contains('modal') && !event.target.classList.contains('crop-modal')) {
        event.target.classList.remove('active');
    }
}

// Start App
init();
