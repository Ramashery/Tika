// --- FIREBASE CONFIGURATION (tika-c756e) ---
const firebaseConfig = {
    apiKey: "AIzaSyD_placeholder_replace_with_web_api_key",
    authDomain: "tika-c756e.firebaseapp.com",
    projectId: "tika-c756e",
    storageBucket: "tika-c756e.firebasestorage.app",
    messagingSenderId: "107031456777379880366",
    appId: "replace_with_web_app_id"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- STATE ---
let siteData = {};
const defaultLang = 'ru';
const supportedLangs = ['ru'];

// --- DATA LOADING ---
async function loadData() {
    const freshSiteData = {};
    try {
        const collections = ['services', 'blog', 'creative', 'reviews'];
        const dataPromises = [
            db.collection('home').doc('content').get(),
            ...collections.map(col => db.collection(col).get())
        ];
        const [homeDoc, ...snapshots] = await Promise.all(dataPromises);

        const processDocData = (data) => {
            if (data && typeof data.schemaJsonLd === 'string' && data.schemaJsonLd.trim().startsWith('{')) {
                try { data.schemaJsonLd = JSON.parse(data.schemaJsonLd); } catch (e) { data.schemaJsonLd = {}; }
            }
            return data;
        };

        freshSiteData.home = homeDoc.exists ? processDocData(homeDoc.data()) : {};
        collections.forEach((col, index) => {
            freshSiteData[col] = snapshots[index].docs.map(doc => ({ id: doc.id, ...processDocData(doc.data()) }));
        });
        return freshSiteData;
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Ошибка загрузки данных. Проверьте консоль.");
        return {};
    }
}

// --- RENDER ADMIN PANEL ---
function renderAdminPanel() {
    renderAdminHome();
    renderAdminSection('services');
    renderAdminSection('blog');
    renderAdminSection('creative');
    renderAdminSection('reviews');
}

function renderAdminHome() {
    const container = document.querySelector('[data-tab-content="home"]');
    if (!container) return;
    const home = siteData.home || {};
    container.innerHTML = `
        <h2>Главная страница</h2>
        <div class="admin-form">
            <label>H1 заголовок</label>
            <input type="text" id="home-h1" value="${escHtml(home.h1 || '')}" placeholder="Заголовок страницы">
            
            <label>Подзаголовок (HTML)</label>
            <textarea id="home-subtitle" rows="4">${escHtml(home.subtitle || '')}</textarea>
            
            <label>SEO Title</label>
            <input type="text" id="home-seoTitle" value="${escHtml(home.seoTitle || '')}" placeholder="Tika — Грузинский язык для русскоязычных">
            
            <label>Meta Description</label>
            <textarea id="home-metaDescription" rows="3">${escHtml(home.metaDescription || '')}</textarea>
            
            <label>OG Title</label>
            <input type="text" id="home-ogTitle" value="${escHtml(home.ogTitle || '')}">
            
            <label>OG Description</label>
            <textarea id="home-ogDescription" rows="3">${escHtml(home.ogDescription || '')}</textarea>
            
            <label>OG Image URL</label>
            <input type="text" id="home-ogImage" value="${escHtml(home.ogImage || '')}" placeholder="https://...">
            
            <label>Фоновый HTML (анимация/iframe)</label>
            <textarea id="home-backgroundHtml" rows="5">${escHtml(home.backgroundHtml || '')}</textarea>
            
            <label>Schema JSON-LD (JSON)</label>
            <textarea id="home-schemaJsonLd" rows="6">${typeof home.schemaJsonLd === 'object' ? JSON.stringify(home.schemaJsonLd, null, 2) : escHtml(home.schemaJsonLd || '')}</textarea>
            
            <button onclick="saveHome()">Сохранить главную страницу</button>
            <p id="home-save-status" style="margin-top:8px;color:var(--color-accent)"></p>
        </div>
    `;
}

async function saveHome() {
    const data = {
        h1: document.getElementById('home-h1').value,
        subtitle: document.getElementById('home-subtitle').value,
        seoTitle: document.getElementById('home-seoTitle').value,
        metaDescription: document.getElementById('home-metaDescription').value,
        ogTitle: document.getElementById('home-ogTitle').value,
        ogDescription: document.getElementById('home-ogDescription').value,
        ogImage: document.getElementById('home-ogImage').value,
        backgroundHtml: document.getElementById('home-backgroundHtml').value,
        lang: 'ru',
        lastModified: new Date().toISOString(),
    };
    const schemaRaw = document.getElementById('home-schemaJsonLd').value.trim();
    if (schemaRaw) {
        try { data.schemaJsonLd = JSON.parse(schemaRaw); } catch (e) { data.schemaJsonLd = schemaRaw; }
    } else {
        data.schemaJsonLd = {};
    }
    try {
        await db.collection('home').doc('content').set(data, { merge: true });
        document.getElementById('home-save-status').textContent = '✓ Сохранено';
        siteData.home = { ...siteData.home, ...data };
        setTimeout(() => { document.getElementById('home-save-status').textContent = ''; }, 3000);
    } catch (e) {
        document.getElementById('home-save-status').textContent = `✗ Ошибка: ${e.message}`;
    }
}

// --- COLLECTION SECTION RENDERING ---
const SECTION_LABELS = {
    services: 'Услуги',
    blog: 'Блог',
    creative: 'Творческое',
    reviews: 'Отзывы',
};

function renderAdminSection(key) {
    const container = document.querySelector(`[data-tab-content="${key}"]`);
    if (!container) return;
    const items = siteData[key] || [];
    const label = SECTION_LABELS[key] || key;

    const itemsHtml = items.map((item, index) => renderItemCard(item, key, index)).join('');

    container.innerHTML = `
        <h2>${label}</h2>
        <button class="btn-add" onclick="addItem('${key}')">+ Добавить запись</button>
        <div class="admin-items-list" id="list-${key}">
            ${itemsHtml || '<p style="opacity:0.5">Записей пока нет.</p>'}
        </div>
    `;
}

function renderItemCard(item, collection, index) {
    const statusBadge = item.status === 'archived'
        ? '<span style="color:#ff6b6b;font-size:12px"> [архив]</span>'
        : '';
    return `
        <div class="admin-item-card" id="item-card-${collection}-${item.id}">
            <div class="admin-item-header" onclick="toggleItemCard('${collection}','${item.id}')">
                <strong>${escHtml(item.title || '(без названия)')}</strong>${statusBadge}
                <span class="admin-item-toggle">▼</span>
            </div>
            <div class="admin-item-body" id="item-body-${collection}-${item.id}" style="display:none">
                ${renderItemForm(item, collection)}
                <div class="admin-item-actions">
                    <button onclick="saveItem('${collection}','${item.id}')">Сохранить</button>
                    <button class="btn-danger" onclick="deleteItem('${collection}','${item.id}')">Удалить</button>
                </div>
                <p id="status-${collection}-${item.id}" class="save-status"></p>
            </div>
        </div>
    `;
}

function renderItemForm(item, collection) {
    const isReviews = collection === 'reviews';
    return `
        <label>Заголовок (title)</label>
        <input type="text" data-field="title" value="${escHtml(item.title || '')}">
        
        <label>H1 (если отличается от title)</label>
        <input type="text" data-field="h1" value="${escHtml(item.h1 || '')}">

        <label>Подзаголовок (subtitle)</label>
        <input type="text" data-field="subtitle" value="${escHtml(item.subtitle || '')}">

        <label>Краткое описание (для карточки)</label>
        <textarea data-field="description" rows="3">${escHtml(item.description || '')}</textarea>

        ${isReviews ? `
        <label>Автор отзыва</label>
        <input type="text" data-field="author" value="${escHtml(item.author || '')}">
        <label>Откуда (город, страна)</label>
        <input type="text" data-field="authorFrom" value="${escHtml(item.authorFrom || '')}">
        <label>Рейтинг (1–5)</label>
        <input type="number" data-field="rating" min="1" max="5" value="${escHtml(String(item.rating || 5))}">
        ` : ''}

        <label>Основной контент (mainContent, HTML/текст)</label>
        <textarea data-field="mainContent" rows="12">${escHtml(item.mainContent || '')}</textarea>

        <label>URL Slug (латиница, без пробелов)</label>
        <input type="text" data-field="urlSlug" value="${escHtml(item.urlSlug || '')}">

        <label>Цена (если есть)</label>
        <input type="text" data-field="price" value="${escHtml(item.price || '')}" placeholder="2000 ₽/месяц">

        <label>Media (URLs изображений, по одному на строку)</label>
        <textarea data-field="media" rows="3">${escHtml((item.media || []).join('\n'))}</textarea>

        <label>Alt текст главного изображения</label>
        <input type="text" data-field="mainImageAlt" value="${escHtml(item.mainImageAlt || '')}">

        <label>SEO Title</label>
        <input type="text" data-field="seoTitle" value="${escHtml(item.seoTitle || '')}">

        <label>Meta Description</label>
        <textarea data-field="metaDescription" rows="3">${escHtml(item.metaDescription || '')}</textarea>

        <label>OG Title</label>
        <input type="text" data-field="ogTitle" value="${escHtml(item.ogTitle || '')}">

        <label>OG Description</label>
        <textarea data-field="ogDescription" rows="3">${escHtml(item.ogDescription || '')}</textarea>

        <label>Фоновый HTML</label>
        <textarea data-field="backgroundHtml" rows="4">${escHtml(item.backgroundHtml || '')}</textarea>

        <label>Schema JSON-LD</label>
        <textarea data-field="schemaJsonLd" rows="5">${typeof item.schemaJsonLd === 'object' ? JSON.stringify(item.schemaJsonLd, null, 2) : escHtml(item.schemaJsonLd || '')}</textarea>

        <label>Статус</label>
        <select data-field="status">
            <option value="published" ${(item.status || 'published') === 'published' ? 'selected' : ''}>Опубликовано</option>
            <option value="draft" ${item.status === 'draft' ? 'selected' : ''}>Черновик</option>
            <option value="archived" ${item.status === 'archived' ? 'selected' : ''}>Архив</option>
        </select>
    `;
}

function toggleItemCard(collection, id) {
    const body = document.getElementById(`item-body-${collection}-${id}`);
    if (!body) return;
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

async function saveItem(collection, id) {
    const card = document.getElementById(`item-card-${collection}-${id}`);
    const statusEl = document.getElementById(`status-${collection}-${id}`);
    if (!card || !statusEl) return;

    const data = { lang: 'ru', lastModified: new Date().toISOString() };

    card.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'media') {
            data[field] = el.value.split('\n').map(s => s.trim()).filter(Boolean);
        } else if (field === 'schemaJsonLd') {
            const raw = el.value.trim();
            if (raw) { try { data[field] = JSON.parse(raw); } catch (e) { data[field] = raw; } }
            else { data[field] = {}; }
        } else if (field === 'rating') {
            data[field] = parseInt(el.value) || 5;
        } else {
            data[field] = el.value;
        }
    });

    try {
        await db.collection(collection).doc(id).set(data, { merge: true });
        statusEl.textContent = '✓ Сохранено';
        statusEl.style.color = 'var(--color-accent)';
        const idx = (siteData[collection] || []).findIndex(i => i.id === id);
        if (idx > -1) siteData[collection][idx] = { ...siteData[collection][idx], ...data, id };
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch (e) {
        statusEl.textContent = `✗ Ошибка: ${e.message}`;
        statusEl.style.color = '#ff6b6b';
    }
}

async function deleteItem(collection, id) {
    if (!confirm('Удалить запись? Это действие нельзя отменить.')) return;
    try {
        await db.collection(collection).doc(id).delete();
        siteData[collection] = (siteData[collection] || []).filter(i => i.id !== id);
        renderAdminSection(collection);
    } catch (e) {
        alert(`Ошибка удаления: ${e.message}`);
    }
}

async function addItem(collection) {
    const newItem = {
        title: 'Новая запись',
        h1: '',
        subtitle: '',
        description: '',
        mainContent: '',
        urlSlug: `novaya-zapis-${Date.now()}`,
        lang: 'ru',
        status: 'draft',
        media: [],
        seoTitle: '',
        metaDescription: '',
        lastModified: new Date().toISOString(),
    };
    try {
        const docRef = await db.collection(collection).add(newItem);
        newItem.id = docRef.id;
        if (!siteData[collection]) siteData[collection] = [];
        siteData[collection].unshift(newItem);
        renderAdminSection(collection);
        // Auto-open new card
        setTimeout(() => toggleItemCard(collection, newItem.id), 100);
    } catch (e) {
        alert(`Ошибка создания: ${e.message}`);
    }
}

// --- TABS ---
function initTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            const key = tab.dataset.tab;
            document.querySelector(`[data-tab-content="${key}"]`)?.classList.add('active');
        });
    });
}

// --- AUTH ---
function initAuth() {
    const loginScreen = document.getElementById('login-screen');
    const adminContainer = document.querySelector('.admin-container');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');

    auth.onAuthStateChanged(async user => {
        if (user) {
            loginScreen.style.display = 'none';
            adminContainer.style.display = 'flex';
            siteData = await loadData();
            renderAdminPanel();
            initTabs();
        } else {
            loginScreen.style.display = 'flex';
            adminContainer.style.display = 'none';
        }
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err) {
            loginError.textContent = 'Ошибка входа: ' + err.message;
        }
    });

    logoutBtn.addEventListener('click', () => auth.signOut());
}

// --- HELPERS ---
function escHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// --- INIT ---
initAuth();
