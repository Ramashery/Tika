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

const SUPPORTED_LANGS = ['ru', 'ka'];
const LANG_NAMES = { ru: 'Русский', ka: 'ქართული' };
const COLLECTIONS = ['services', 'blog', 'creative', 'reviews'];
const COLLECTION_LABELS = { services: 'Услуги', blog: 'Блог', creative: 'Творческое', reviews: 'Отзывы' };
const defaultLang = 'ru';
let siteData = {};

// --- DATA ---
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
    } catch(e) {
        console.error('loadData error:', e);
        alert('Ошибка загрузки: ' + e.message);
        return {};
    }
}

// --- RENDER ---
function renderAdminPanel() {
    renderAdminHome();
    COLLECTIONS.forEach(col => renderAdminSection(col));
}

// --- HOME ---
function renderAdminHome() {
    const container = document.querySelector('[data-tab-content="home"]');
    if (!container) return;
    const d = siteData.home || {};
    const dateValue = d.lastModified ? d.lastModified.substring(0,10) : '';

    container.innerHTML = `
    <div class="admin-section-header"><h2>Главная страница</h2></div>
    <div class="admin-item" id="admin-home-item">
        <div class="admin-item-content">
            <h4>Контент Hero (RU)</h4>
            <label>H1 заголовок (RU)</label>
            <input type="text" id="home-h1" value="${esc(d.h1||'')}" disabled>
            <label>Подзаголовок (RU, HTML)</label>
            <textarea id="home-subtitle" rows="3" disabled>${esc(d.subtitle||'')}</textarea>

            <h4>Контент Hero (KA)</h4>
            <label>H1 заголовок (KA)</label>
            <input type="text" id="home-h1-ka" value="${esc(d.h1Ka||'')}" disabled>
            <label>Подзаголовок (KA, HTML)</label>
            <textarea id="home-subtitle-ka" rows="3" disabled>${esc(d.subtitleKa||'')}</textarea>

            <h4>SEO</h4>
            <label>SEO Title (RU)</label>
            <input type="text" id="home-seoTitle" value="${esc(d.seoTitle||'')}" disabled>
            <label>SEO Title (KA)</label>
            <input type="text" id="home-seoTitle-ka" value="${esc(d.seoTitleKa||'')}" disabled>
            <label>Meta Description (RU)</label>
            <textarea id="home-metaDescription" rows="3" disabled>${esc(d.metaDescription||'')}</textarea>
            <label>Meta Description (KA)</label>
            <textarea id="home-metaDescription-ka" rows="3" disabled>${esc(d.metaDescriptionKa||'')}</textarea>

            <h4>Open Graph</h4>
            <label>OG Title</label>
            <input type="text" id="home-ogTitle" value="${esc(d.ogTitle||'')}" disabled>
            <label>OG Description</label>
            <textarea id="home-ogDescription" rows="2" disabled>${esc(d.ogDescription||'')}</textarea>
            <label>OG Image URL (1200×630)</label>
            <input type="text" id="home-ogImage" value="${esc(d.ogImage||'')}" disabled>

            <h4>Прочее</h4>
            <label>Фоновый HTML / JS / CSS</label>
            <textarea id="home-backgroundHtml" rows="8" disabled>${esc(d.backgroundHtml||'')}</textarea>
            <label>Schema JSON-LD</label>
            <textarea id="home-schemaJsonLd" rows="8" disabled>${typeof d.schemaJsonLd==='object'?JSON.stringify(d.schemaJsonLd,null,2):esc(d.schemaJsonLd||'{}')}</textarea>
            <label>Last Modified</label>
            <input type="date" id="home-lastModified" value="${dateValue}" disabled>
        </div>
        <div class="admin-item-actions">
            <button class="admin-btn edit-btn" data-action="edit-home">Edit</button>
            <button class="admin-btn save-btn" data-action="save-home">Save</button>
        </div>
    </div>`;
}

async function saveHome() {
    const data = {
        h1: val('home-h1'), h1Ka: val('home-h1-ka'),
        subtitle: val('home-subtitle'), subtitleKa: val('home-subtitle-ka'),
        seoTitle: val('home-seoTitle'), seoTitleKa: val('home-seoTitle-ka'),
        metaDescription: val('home-metaDescription'), metaDescriptionKa: val('home-metaDescription-ka'),
        ogTitle: val('home-ogTitle'), ogDescription: val('home-ogDescription'), ogImage: val('home-ogImage'),
        backgroundHtml: val('home-backgroundHtml'),
        lastModified: val('home-lastModified') || new Date().toISOString(),
        lang: 'ru',
    };
    const schema = val('home-schemaJsonLd').trim();
    data.schemaJsonLd = schema ? (()=>{ try{return JSON.parse(schema);}catch{return schema;} })() : {};
    try {
        await db.collection('home').doc('content').set(data, {merge:true});
        siteData.home = {...siteData.home,...data};
        alert('✓ Главная сохранена');
        renderAdminHome();
    } catch(e) { alert('✗ ' + e.message); }
}

// --- SECTION (like original - list + editor) ---
function renderAdminSection(key) {
    const container = document.querySelector(`[data-tab-content="${key}"]`);
    if (!container) return;
    const label = COLLECTION_LABELS[key] || key;
    const items = siteData[key] || [];

    const groupedItems = {};
    items.forEach(item => {
        const lang = item.lang || defaultLang;
        if (!groupedItems[lang]) groupedItems[lang] = [];
        groupedItems[lang].push(item);
    });

    const listsHTML = SUPPORTED_LANGS.map(lang => {
        const langItems = groupedItems[lang] || [];
        if (!langItems.length) return `<div class="admin-lang-group"><h4>${LANG_NAMES[lang]} (${lang})</h4><p style="opacity:0.5;font-size:0.85rem;padding:8px 0">Нет записей</p></div>`;
        const itemsHTML = langItems
            .sort((a,b) => (a.title||'').localeCompare(b.title||''))
            .map(item => `<li class="admin-list-item ${item.status==='archived'?'is-archived':''}" 
                data-id="${item.id}" data-key="${key}" data-status="${item.status||'published'}">
                ${esc(item.title||'No Title')}
                <span class="admin-list-item-slug">(/${item.urlSlug||'no-slug'})</span>
            </li>`).join('');
        return `<div class="admin-lang-group"><h4>${LANG_NAMES[lang]} (${lang})</h4><ul class="admin-item-list">${itemsHTML}</ul></div>`;
    }).join('');

    container.innerHTML = `
        <div class="admin-section-header">
            <h2>Управление: ${label}</h2>
            <button class="admin-btn" data-action="add" data-key="${key}">+ Добавить</button>
        </div>
        ${listsHTML}
        <div class="admin-item-editor-container"></div>
    `;
}

// --- ITEM FORM (full, like original) ---
function generateItemFormHTML(item, key) {
    const isArchived = item.status === 'archived';
    const archiveBtnText = isArchived ? 'Опубликовать' : 'В архив';
    const langOptions = SUPPORTED_LANGS.map(l =>
        `<option value="${l}" ${item.lang===l?'selected':''}>${LANG_NAMES[l]} (${l})</option>`
    ).join('');

    const dateValue = (item.lastModified||'').substring(0,10);

    return `<div class="admin-item" data-id="${item.id}" data-key="${key}" data-status="${item.status||'published'}">
        <div class="admin-item-content">
            <h4>Контент карточки (на главной)</h4>
            <label>Заголовок карточки (Title)</label>
            <input type="text" class="admin-input-title" value="${esc(item.title||'')}" disabled>
            <label>Подзаголовок / Дата</label>
            <input type="text" class="admin-input-subtitle" value="${esc(item.subtitle||'')}" disabled>
            <label>Описание карточки</label>
            <textarea class="admin-input-description" rows="3" disabled>${esc(item.description||'')}</textarea>

            <h4>Детальная страница</h4>
            <label>Язык</label>
            <select class="admin-input-lang" disabled>${langOptions}</select>
            <label>URL Slug (латиница, без пробелов)</label>
            <input type="text" class="admin-input-urlSlug" value="${esc(item.urlSlug||'')}" disabled>
            <label>H1 заголовок страницы</label>
            <input type="text" class="admin-input-h1" value="${esc(item.h1||'')}" disabled>
            <label>Цена / Бюджет</label>
            <input type="text" class="admin-input-price" value="${esc(item.price||'')}" disabled>
            <label>Основной контент (HTML / текст)</label>
            <textarea class="admin-input-mainContent" rows="10" disabled>${esc(item.mainContent||'')}</textarea>
            <label>Media (URLs, по одному на строку)</label>
            <textarea class="admin-input-media" rows="4" disabled>${esc((item.media||[]).join('\n'))}</textarea>
            <label>Alt текст главного изображения</label>
            <input type="text" class="admin-input-mainImageAlt" value="${esc(item.mainImageAlt||'')}" disabled>

            <h4>SEO & Метаданные</h4>
            <label>SEO Title</label>
            <input type="text" class="admin-input-seoTitle" value="${esc(item.seoTitle||'')}" disabled>
            <label>Meta Description</label>
            <textarea class="admin-input-metaDescription" rows="3" disabled>${esc(item.metaDescription||'')}</textarea>

            <h4>Sitemap & Переводы</h4>
            <label>Translation Group Key (одинаковый для RU и KA версий одной страницы)</label>
            <input type="text" class="admin-input-translationGroupKey" value="${esc(item.translationGroupKey||'')}" placeholder="unique-key" disabled>
            <div style="display:flex;align-items:center;gap:10px;margin-top:5px;padding:10px;background:rgba(255,255,255,0.05);border-radius:4px">
                <input type="checkbox" class="admin-input-isXDefault" id="xdefault-${item.id}" ${item.isXDefault||item.lang==='ru'?'checked':''} style="width:auto" disabled>
                <label for="xdefault-${item.id}" style="margin-bottom:0;cursor:pointer">
                    x-default (главная версия для SEO)<br>
                    <small style="opacity:0.7">Автоматически для RU, вручную для других</small>
                </label>
            </div>
            <label>Last Modified</label>
            <input type="date" class="admin-input-lastModified" value="${dateValue}" disabled>
            <label>Priority (0.1–1.0)</label>
            <input type="number" step="0.1" class="admin-input-sitemapPriority" value="${item.sitemapPriority||'0.7'}" disabled>
            <label>Change Frequency</label>
            <select class="admin-input-sitemapChangefreq" disabled>
                <option value="monthly" ${!item.sitemapChangefreq||item.sitemapChangefreq==='monthly'?'selected':''}>monthly</option>
                <option value="weekly" ${item.sitemapChangefreq==='weekly'?'selected':''}>weekly</option>
                <option value="yearly" ${item.sitemapChangefreq==='yearly'?'selected':''}>yearly</option>
            </select>
            <label>Schema JSON-LD</label>
            <textarea class="admin-input-schemaJsonLd" rows="5" disabled>${typeof item.schemaJsonLd==='object'?JSON.stringify(item.schemaJsonLd,null,2):esc(item.schemaJsonLd||'{}')}</textarea>

            <h4>Social Media (OG)</h4>
            <label>OG Title</label>
            <input type="text" class="admin-input-ogTitle" value="${esc(item.ogTitle||'')}" disabled>
            <label>OG Description</label>
            <textarea class="admin-input-ogDescription" rows="2" disabled>${esc(item.ogDescription||'')}</textarea>
            <label>OG Image URL</label>
            <input type="text" class="admin-input-ogImage" value="${esc(item.ogImage||'')}" disabled>
            <label>Custom Background HTML</label>
            <textarea class="admin-input-backgroundHtml" rows="6" disabled>${esc(item.backgroundHtml||'')}</textarea>
        </div>
        <div class="admin-item-actions">
            <button class="admin-btn edit-btn" data-action="edit">Edit</button>
            <button class="admin-btn save-btn" data-action="save">Save</button>
            <button class="admin-btn archive-btn" data-action="archive">${archiveBtnText}</button>
            <button class="admin-btn delete-btn" data-action="delete">Удалить навсегда</button>
        </div>
    </div>`;
}

// --- EVENTS ---
document.addEventListener('click', async e => {
    // Home edit/save
    if (e.target.dataset.action === 'edit-home') {
        document.getElementById('admin-home-item')?.querySelectorAll('[disabled]').forEach(el => el.removeAttribute('disabled'));
        e.target.style.display = 'none';
        return;
    }
    if (e.target.dataset.action === 'save-home') { await saveHome(); return; }

    // Add new item
    if (e.target.dataset.action === 'add') {
        const key = e.target.dataset.key;
        const lang = prompt('Язык (ru / ka):', 'ru') || 'ru';
        const newItem = {
            title:'Новая запись', h1:'', subtitle:'', description:'', mainContent:'',
            urlSlug:`novaya-${Date.now()}`, lang: SUPPORTED_LANGS.includes(lang)?lang:'ru',
            status:'draft', media:[], seoTitle:'', metaDescription:'',
            translationGroupKey:'', isXDefault: lang==='ru',
            sitemapPriority:0.7, sitemapChangefreq:'monthly',
            ogTitle:'', ogDescription:'', ogImage:'', backgroundHtml:'',
            schemaJsonLd:{}, lastModified: new Date().toISOString(),
        };
        try {
            const ref = await db.collection(key).add(newItem);
            newItem.id = ref.id;
            if (!siteData[key]) siteData[key] = [];
            siteData[key].unshift(newItem);
            renderAdminSection(key);
            // Show editor
            const container = document.querySelector(`[data-tab-content="${key}"]`);
            const editorContainer = container?.querySelector('.admin-item-editor-container');
            if (editorContainer) {
                editorContainer.innerHTML = generateItemFormHTML(newItem, key);
                editorContainer.querySelectorAll('[disabled]').forEach(el => el.removeAttribute('disabled'));
                editorContainer.scrollIntoView({behavior:'smooth'});
            }
        } catch(err) { alert('Ошибка: ' + err.message); }
        return;
    }

    // List item click → open editor
    if (e.target.closest('.admin-list-item')) {
        const li = e.target.closest('.admin-list-item');
        const id = li.dataset.id;
        const key = li.dataset.key;
        const item = (siteData[key]||[]).find(i => i.id === id);
        if (!item) return;
        const container = document.querySelector(`[data-tab-content="${key}"]`);
        const editorContainer = container?.querySelector('.admin-item-editor-container');
        if (editorContainer) {
            editorContainer.innerHTML = generateItemFormHTML(item, key);
            editorContainer.scrollIntoView({behavior:'smooth'});
        }
        return;
    }

    // Edit
    if (e.target.dataset.action === 'edit') {
        const adminItem = e.target.closest('.admin-item');
        adminItem?.querySelectorAll('[disabled]').forEach(el => el.removeAttribute('disabled'));
        e.target.style.display = 'none';
        return;
    }

    // Save
    if (e.target.dataset.action === 'save') {
        const adminItem = e.target.closest('.admin-item');
        if (!adminItem) return;
        const id = adminItem.dataset.id;
        const key = adminItem.dataset.key;
        const data = {lastModified: new Date().toISOString()};
        adminItem.querySelectorAll('[class^="admin-input-"]').forEach(el => {
            const cls = [...el.classList].find(c => c.startsWith('admin-input-'));
            if (!cls) return;
            const field = cls.replace('admin-input-','');
            if (field === 'media') data[field] = el.value.split('\n').map(s=>s.trim()).filter(Boolean);
            else if (field === 'schemaJsonLd') { const r=el.value.trim(); data[field]=r?(()=>{try{return JSON.parse(r);}catch{return r;}})():{};  }
            else if (field === 'isXDefault') data[field] = el.checked;
            else if (field === 'sitemapPriority') data[field] = parseFloat(el.value)||0.7;
            else data[field] = el.value;
        });
        try {
            await db.collection(key).doc(id).set(data, {merge:true});
            const idx = (siteData[key]||[]).findIndex(i=>i.id===id);
            if (idx>-1) siteData[key][idx] = {...siteData[key][idx],...data};
            renderAdminSection(key);
            alert('✓ Сохранено');
        } catch(err) { alert('✗ ' + err.message); }
        return;
    }

    // Archive
    if (e.target.dataset.action === 'archive') {
        const adminItem = e.target.closest('.admin-item');
        if (!adminItem) return;
        const id = adminItem.dataset.id; const key = adminItem.dataset.key;
        const item = (siteData[key]||[]).find(i=>i.id===id);
        if (!item) return;
        const newStatus = item.status==='archived' ? 'published' : 'archived';
        try {
            await db.collection(key).doc(id).update({status: newStatus});
            item.status = newStatus;
            renderAdminSection(key);
        } catch(err) { alert('✗ ' + err.message); }
        return;
    }

    // Delete
    if (e.target.dataset.action === 'delete') {
        const adminItem = e.target.closest('.admin-item');
        if (!adminItem) return;
        const id = adminItem.dataset.id; const key = adminItem.dataset.key;
        if (!confirm('Удалить навсегда?')) return;
        try {
            await db.collection(key).doc(id).delete();
            siteData[key] = (siteData[key]||[]).filter(i=>i.id!==id);
            adminItem.closest('.admin-item-editor-container').innerHTML = '';
            renderAdminSection(key);
        } catch(err) { alert('✗ ' + err.message); }
        return;
    }
});

// --- TABS ---
function initTabs() {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.admin-tab').forEach(t=>t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
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
        const pass = document.getElementById('login-password').value;
        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } catch(err) {
            document.getElementById('login-error').textContent = 'Ошибка входа: ' + err.message;
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => auth.signOut());
}

// --- HELPERS ---
function esc(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function val(id) { return document.getElementById(id)?.value||''; }

initAuth();
