// --- FIREBASE CONFIG (tika-c756e) ---
const firebaseConfig = {
    apiKey: "AIzaSyCuUGjxzWMRueB5_y4rMRQK5WRE66g2vVM",
    authDomain: "tika-c756e.firebaseapp.com",
    projectId: "tika-c756e",
    storageBucket: "tika-c756e.firebasestorage.app",
    messagingSenderId: "311456375252",
    appId: "1:311456375252:web:d42f82dd72f5cece8d3641",
    measurementId: "G-87RM7S166J"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- CONFIG ---
const SUPPORTED_LANGS = ['ru', 'ka'];
const LANG_NAMES = { ru: 'Русский', ka: 'ქართული' };
const COLLECTIONS = ['services', 'blog', 'creative', 'reviews'];
const COLLECTION_LABELS = { services: 'Услуги', blog: 'Блог', creative: 'Творческое', reviews: 'Отзывы' };
let siteData = {};

// --- DATA LOADING ---
async function loadData() {
    try {
        const [homeDoc, ...snaps] = await Promise.all([
            db.collection('home').doc('content').get(),
            ...COLLECTIONS.map(c => db.collection(c).get())
        ]);
        const proc = d => {
            if (d && typeof d.schemaJsonLd === 'string') { try { d.schemaJsonLd = JSON.parse(d.schemaJsonLd); } catch { d.schemaJsonLd = {}; } }
            return d;
        };
        const data = { home: homeDoc.exists ? proc(homeDoc.data()) : {} };
        COLLECTIONS.forEach((col, i) => {
            data[col] = snaps[i].docs.map(doc => ({ id: doc.id, ...proc(doc.data()) }));
        });
        return data;
    } catch (e) {
        console.error('loadData error:', e);
        alert('Ошибка загрузки: ' + e.message);
        return {};
    }
}

// --- RENDER ADMIN PANEL ---
function renderAdminPanel() {
    renderAdminHome();
    COLLECTIONS.forEach(col => renderAdminSection(col));
}

// --- HOME FORM ---
function renderAdminHome() {
    const container = document.querySelector('[data-tab-content="home"]');
    if (!container) return;
    const d = siteData.home || {};
    container.innerHTML = `
        <h2>Главная страница</h2>
        <div class="admin-form">
            <label>H1 заголовок (RU)</label>
            <input type="text" id="home-h1" value="${esc(d.h1 || '')}" placeholder="Заголовок на русском">
            <label>H1 заголовок (KA)</label>
            <input type="text" id="home-h1-ka" value="${esc(d.h1Ka || '')}" placeholder="სათაური ქართულად">
            <label>Подзаголовок (RU, HTML)</label>
            <textarea id="home-subtitle" rows="4">${esc(d.subtitle || '')}</textarea>
            <label>Подзаголовок (KA, HTML)</label>
            <textarea id="home-subtitle-ka" rows="4">${esc(d.subtitleKa || '')}</textarea>
            <label>SEO Title (RU)</label>
            <input type="text" id="home-seoTitle" value="${esc(d.seoTitle || '')}">
            <label>SEO Title (KA)</label>
            <input type="text" id="home-seoTitle-ka" value="${esc(d.seoTitleKa || '')}">
            <label>Meta Description (RU)</label>
            <textarea id="home-metaDescription" rows="3">${esc(d.metaDescription || '')}</textarea>
            <label>Meta Description (KA)</label>
            <textarea id="home-metaDescription-ka" rows="3">${esc(d.metaDescriptionKa || '')}</textarea>
            <label>OG Title (RU)</label>
            <input type="text" id="home-ogTitle" value="${esc(d.ogTitle || '')}">
            <label>OG Description (RU)</label>
            <textarea id="home-ogDescription" rows="2">${esc(d.ogDescription || '')}</textarea>
            <label>OG Image URL</label>
            <input type="text" id="home-ogImage" value="${esc(d.ogImage || '')}" placeholder="https://...">
            <label>Фоновый HTML</label>
            <textarea id="home-backgroundHtml" rows="5">${esc(d.backgroundHtml || '')}</textarea>
            <label>Schema JSON-LD</label>
            <textarea id="home-schemaJsonLd" rows="6">${typeof d.schemaJsonLd === 'object' ? JSON.stringify(d.schemaJsonLd, null, 2) : esc(d.schemaJsonLd || '')}</textarea>
            <button onclick="saveHome()">Сохранить главную страницу</button>
            <p id="home-save-status" style="color:var(--color-accent);min-height:1.2em"></p>
        </div>
    `;
}

async function saveHome() {
    const data = {
        h1: val('home-h1'), h1Ka: val('home-h1-ka'),
        subtitle: val('home-subtitle'), subtitleKa: val('home-subtitle-ka'),
        seoTitle: val('home-seoTitle'), seoTitleKa: val('home-seoTitle-ka'),
        metaDescription: val('home-metaDescription'), metaDescriptionKa: val('home-metaDescription-ka'),
        ogTitle: val('home-ogTitle'), ogDescription: val('home-ogDescription'),
        ogImage: val('home-ogImage'), backgroundHtml: val('home-backgroundHtml'),
        lang: 'ru', lastModified: new Date().toISOString(),
    };
    const schema = val('home-schemaJsonLd').trim();
    if (schema) { try { data.schemaJsonLd = JSON.parse(schema); } catch { data.schemaJsonLd = schema; } }
    else { data.schemaJsonLd = {}; }

    try {
        await db.collection('home').doc('content').set(data, { merge: true });
        siteData.home = { ...siteData.home, ...data };
        showStatus('home-save-status', '✓ Сохранено');
    } catch (e) {
        showStatus('home-save-status', `✗ ${e.message}`, true);
    }
}

// --- SECTION RENDERING ---
function renderAdminSection(key) {
    const container = document.querySelector(`[data-tab-content="${key}"]`);
    if (!container) return;
    const items = siteData[key] || [];
    const label = COLLECTION_LABELS[key] || key;

    // Группируем по языкам
    const byLang = {};
    SUPPORTED_LANGS.forEach(l => byLang[l] = []);
    items.forEach(item => {
        const l = item.lang || 'ru';
        if (byLang[l]) byLang[l].push(item);
        else byLang['ru'].push(item);
    });

    const langGroupsHTML = SUPPORTED_LANGS.map(lang => {
        const langItems = byLang[lang];
        const itemsHTML = langItems.length
            ? langItems.map(item => renderItemCard(item, key)).join('')
            : `<p style="opacity:0.5;font-size:0.9rem">Нет записей на ${LANG_NAMES[lang]}</p>`;
        return `
            <div class="admin-lang-group">
                <h4>${LANG_NAMES[lang]} (${lang})</h4>
                <div class="admin-items-list" id="list-${key}-${lang}">${itemsHTML}</div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <h2>${label}</h2>
        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap">
            ${SUPPORTED_LANGS.map(l => `<button class="btn-add" onclick="addItem('${key}','${l}')">+ Добавить (${l.toUpperCase()})</button>`).join('')}
        </div>
        ${langGroupsHTML}
    `;
}

function renderItemCard(item, collection) {
    const statusBadge = item.status === 'archived' ? '<span style="color:#f0ad4e;font-size:11px"> [архив]</span>' : '';
    const statusDraft = item.status === 'draft' ? '<span style="color:#aaa;font-size:11px"> [черновик]</span>' : '';
    return `
        <div class="admin-item-card" id="item-card-${collection}-${item.id}">
            <div class="admin-item-header" onclick="toggleCard('${collection}','${item.id}')">
                <strong>${esc(item.title || '(без названия)')}</strong>${statusBadge}${statusDraft}
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
    const langOptions = SUPPORTED_LANGS.map(l =>
        `<option value="${l}" ${item.lang === l ? 'selected' : ''}>${LANG_NAMES[l]} (${l})</option>`
    ).join('');

    return `
        <label>Язык</label>
        <select data-field="lang">${langOptions}</select>

        <label>Заголовок (title)</label>
        <input type="text" data-field="title" value="${esc(item.title || '')}">

        <label>H1 (если отличается)</label>
        <input type="text" data-field="h1" value="${esc(item.h1 || '')}">

        <label>Подзаголовок (subtitle)</label>
        <input type="text" data-field="subtitle" value="${esc(item.subtitle || '')}">

        <label>Краткое описание (для карточки)</label>
        <textarea data-field="description" rows="3">${esc(item.description || '')}</textarea>

        <label>Основной контент (mainContent)</label>
        <textarea data-field="mainContent" rows="12">${esc(item.mainContent || '')}</textarea>

        <label>URL Slug (латиница)</label>
        <input type="text" data-field="urlSlug" value="${esc(item.urlSlug || '')}">

        <label>Translation Group Key (одинаковый для RU+KA переводов)</label>
        <input type="text" data-field="translationGroupKey" value="${esc(item.translationGroupKey || '')}" placeholder="уникальный-ключ">

        <label>Цена</label>
        <input type="text" data-field="price" value="${esc(item.price || '')}" placeholder="2000 ₽/месяц">

        <label>Media (URLs, по одному на строку)</label>
        <textarea data-field="media" rows="3">${esc((item.media || []).join('\n'))}</textarea>

        <label>Alt текст главного изображения</label>
        <input type="text" data-field="mainImageAlt" value="${esc(item.mainImageAlt || '')}">

        <label>SEO Title</label>
        <input type="text" data-field="seoTitle" value="${esc(item.seoTitle || '')}">

        <label>Meta Description</label>
        <textarea data-field="metaDescription" rows="3">${esc(item.metaDescription || '')}</textarea>

        <label>OG Title</label>
        <input type="text" data-field="ogTitle" value="${esc(item.ogTitle || '')}">

        <label>OG Description</label>
        <textarea data-field="ogDescription" rows="2">${esc(item.ogDescription || '')}</textarea>

        <label>Schema JSON-LD</label>
        <textarea data-field="schemaJsonLd" rows="4">${typeof item.schemaJsonLd === 'object' ? JSON.stringify(item.schemaJsonLd, null, 2) : esc(item.schemaJsonLd || '')}</textarea>

        <label>Sitemap Priority (0.1–1.0)</label>
        <input type="number" step="0.1" min="0.1" max="1.0" data-field="sitemapPriority" value="${item.sitemapPriority || '0.7'}">

        <label>Sitemap Changefreq</label>
        <select data-field="sitemapChangefreq">
            <option value="monthly" ${(!item.sitemapChangefreq || item.sitemapChangefreq==='monthly')?'selected':''}>monthly</option>
            <option value="weekly" ${item.sitemapChangefreq==='weekly'?'selected':''}>weekly</option>
            <option value="yearly" ${item.sitemapChangefreq==='yearly'?'selected':''}>yearly</option>
        </select>

        <label>Статус</label>
        <select data-field="status">
            <option value="published" ${(!item.status||item.status==='published')?'selected':''}>Опубликовано</option>
            <option value="draft" ${item.status==='draft'?'selected':''}>Черновик</option>
            <option value="archived" ${item.status==='archived'?'selected':''}>Архив</option>
        </select>
    `;
}

function toggleCard(collection, id) {
    const body = document.getElementById(`item-body-${collection}-${id}`);
    if (body) body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

async function saveItem(collection, id) {
    const card = document.getElementById(`item-card-${collection}-${id}`);
    const statusEl = document.getElementById(`status-${collection}-${id}`);
    if (!card || !statusEl) return;

    const data = { lastModified: new Date().toISOString() };
    card.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        if (field === 'media') {
            data[field] = el.value.split('\n').map(s => s.trim()).filter(Boolean);
        } else if (field === 'schemaJsonLd') {
            const raw = el.value.trim();
            if (raw) { try { data[field] = JSON.parse(raw); } catch { data[field] = raw; } }
            else { data[field] = {}; }
        } else if (field === 'sitemapPriority') {
            data[field] = parseFloat(el.value) || 0.7;
        } else {
            data[field] = el.value;
        }
    });

    try {
        await db.collection(collection).doc(id).set(data, { merge: true });
        const idx = (siteData[collection] || []).findIndex(i => i.id === id);
        if (idx > -1) siteData[collection][idx] = { ...siteData[collection][idx], ...data };
        showStatus(`status-${collection}-${id}`, '✓ Сохранено');
        // Обновляем секцию чтобы перегруппировать по языку если изменился
        renderAdminSection(collection);
    } catch (e) {
        showStatus(`status-${collection}-${id}`, `✗ ${e.message}`, true);
    }
}

async function deleteItem(collection, id) {
    if (!confirm('Удалить запись навсегда?')) return;
    try {
        await db.collection(collection).doc(id).delete();
        siteData[collection] = (siteData[collection] || []).filter(i => i.id !== id);
        renderAdminSection(collection);
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}

async function addItem(collection, lang) {
    const newItem = {
        title: 'Новая запись',
        h1: '', subtitle: '', description: '', mainContent: '',
        urlSlug: `novaya-${Date.now()}`,
        lang: lang, status: 'draft',
        media: [], seoTitle: '', metaDescription: '',
        translationGroupKey: '',
        sitemapPriority: 0.7, sitemapChangefreq: 'monthly',
        lastModified: new Date().toISOString(),
    };
    try {
        const ref = await db.collection(collection).add(newItem);
        newItem.id = ref.id;
        if (!siteData[collection]) siteData[collection] = [];
        siteData[collection].unshift(newItem);
        renderAdminSection(collection);
        setTimeout(() => toggleCard(collection, newItem.id), 100);
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
}

// --- TABS ---
function initTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.querySelector(`[data-tab-content="${tab.dataset.tab}"]`)?.classList.add('active');
        });
    });
}

// --- AUTH ---
function initAuth() {
    const loginScreen = document.getElementById('login-screen');
    const adminContainer = document.querySelector('.admin-container');

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

    document.getElementById('login-form').addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        try {
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err) {
            document.getElementById('login-error').textContent = 'Ошибка: ' + err.message;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
}

// --- HELPERS ---
function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function val(id) { return document.getElementById(id)?.value || ''; }
function showStatus(id, msg, isError = false) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#ff6b6b' : 'var(--color-accent)';
    setTimeout(() => { el.textContent = ''; }, 3000);
}

// --- INIT ---
initAuth();
