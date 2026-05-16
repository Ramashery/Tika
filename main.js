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

// --- SITE CONFIG ---
const BASE_PATH = '/Tika';
const SUPPORTED_LANGS = ['ru', 'ka'];
const LANG_NAMES = { ru: 'Русский', ka: 'ქართული' };
const SECTION_LABELS = {
    ru: { services: 'Услуги', blog: 'Блог', creative: 'Творческое', reviews: 'Отзывы' },
    ka: { services: 'სერვისები', blog: 'ბლოგი', creative: 'შემოქმედება', reviews: 'გამოხმაურებები' },
};
const MENU_LABELS = {
    ru: { home: 'Главная', services: 'Услуги', blog: 'Блог', creative: 'Творческое', reviews: 'Отзывы' },
    ka: { home: 'მთავარი', services: 'სერვისები', blog: 'ბლოგი', creative: 'შემოქმედება', reviews: 'გამოხმაურებები' },
};
const RELATED_LABEL = { ru: 'Вам также может быть интересно', ka: 'ასევე შეიძლება დაინტერესდეთ' };
const TOC_LABEL = { ru: 'Содержание', ka: 'სარჩევი' };
const EYEBROW_LABEL = { ru: 'TIKA · ГРУЗИНСКИЙ ЯЗЫК', ka: 'TIKA · ქართული ენა' };

let db;
let siteData = {};
let currentLang = 'ru';

// Читаем язык из data-атрибута (статические страницы) или URL
function detectLang() {
    const bodyLang = document.body.dataset.lang;
    if (bodyLang && SUPPORTED_LANGS.includes(bodyLang)) return bodyLang;
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    // /Tika/ru/... → pathParts = ['Tika','ru',...]
    const langInPath = pathParts[1];
    if (langInPath && SUPPORTED_LANGS.includes(langInPath)) return langInPath;
    return 'ru';
}

// --- TRANSLITERATION ---
const GEO_MAP = {
    'ა':'a','ბ':'b','გ':'g','დ':'d','ე':'e','ვ':'v','ზ':'z','თ':'t','ი':'i',
    'კ':'k','ლ':'l','მ':'m','ნ':'n','ო':'o','პ':'p','ჟ':'zh','რ':'r','ს':'s',
    'ტ':'t','უ':'u','ფ':'p','ქ':'k','ღ':'gh','ყ':'q','შ':'sh','ჩ':'ch','ც':'ts',
    'ძ':'dz','წ':'ts','ჭ':'ch','ხ':'kh','ჯ':'j','ჰ':'h',
};
const CYR_MAP = {
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z',
    'и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r',
    'с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch',
    'ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
};
function slugify(text) {
    text = String(text).toLowerCase();
    if ([...text].some(c => c >= '\u10D0' && c <= '\u10FF'))
        text = [...text].map(c => GEO_MAP[c] || c).join('');
    if ([...text].some(c => c >= '\u0400' && c <= '\u04FF'))
        text = [...text].map(c => CYR_MAP[c] || c).join('');
    return text.replace(/[^a-z0-9-]+/g, '-').replace(/--+/g, '-').replace(/^-+|-+$/g, '');
}

// --- OBSERVERS ---
let floatingObserver, animateOnceObserver, animateAlwaysObserver;
function setupObservers() {
    [floatingObserver, animateOnceObserver, animateAlwaysObserver].forEach(o => o && o.disconnect());

    floatingObserver = new IntersectionObserver(entries => {
        entries.forEach(e => {
            e.target.classList.toggle('is-visible', e.isIntersecting);
            e.target.classList.toggle('is-above', !e.isIntersecting && e.boundingClientRect.top < 0);
        });
    }, { threshold: 0, rootMargin: '-50px 0px -50px 0px' });

    animateOnceObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach(e => {
            if (!e.isIntersecting) return;
            const t = e.target;
            [...t.querySelectorAll('[data-bg-src]'), ...(t.hasAttribute('data-bg-src') ? [t] : [])].forEach(el => {
                el.style.backgroundImage = `url('${el.dataset.bgSrc}')`;
                el.removeAttribute('data-bg-src');
            });
            const img = t.querySelector('img.lazy-load-image[data-src]');
            if (img) { img.src = img.dataset.src; img.removeAttribute('data-src'); img.onload = () => img.classList.add('loaded'); }
            t.classList.add('is-visible');
            obs.unobserve(t);
        });
    }, { threshold: 0.1, rootMargin: '0px 0px 50px 0px' });

    animateAlwaysObserver = new IntersectionObserver(entries => {
        entries.forEach(e => e.target.classList.toggle('is-visible', e.isIntersecting));
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.floating-item').forEach(el => floatingObserver.observe(el));
    document.querySelectorAll('.animate-on-scroll').forEach(el => animateOnceObserver.observe(el));
    document.querySelectorAll('.animate-always').forEach(el => animateAlwaysObserver.observe(el));
}

// --- SEO ---
function renderSeoTags(data, lang) {
    document.querySelectorAll('meta[name="description"],meta[property^="og:"],script[type="application/ld+json"],link[rel="canonical"],link[rel="alternate"]').forEach(el => el.remove());
    document.title = data.seoTitle || 'Tika';
    document.documentElement.lang = lang;

    const addMeta = (attr, key, val) => {
        if (!val) return;
        const m = document.createElement('meta');
        m.setAttribute(attr, key); m.content = val;
        document.head.appendChild(m);
    };
    addMeta('name', 'description', data.metaDescription);
    addMeta('property', 'og:title', data.ogTitle || data.seoTitle);
    addMeta('property', 'og:description', data.ogDescription || data.metaDescription);
    const img = (data.media || []).find(u => !/youtube|vimeo/.test(u)) || data.ogImage || '';
    if (img) addMeta('property', 'og:image', img);

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    let p = window.location.pathname;
    if (p.length > 1 && !p.endsWith('/')) p += '/';
    canonical.href = 'https://ramashery.github.io' + p;
    document.head.appendChild(canonical);

    let schema = data.schemaJsonLd;
    if (typeof schema === 'string') { try { schema = JSON.parse(schema); } catch { schema = null; } }
    if (schema && Object.keys(schema).length) {
        const s = document.createElement('script');
        s.type = 'application/ld+json';
        s.textContent = JSON.stringify(schema);
        document.head.appendChild(s);
    }
}

// --- FIREBASE DATA ---
async function loadData() {
    try {
        const cols = ['services', 'blog', 'creative', 'reviews'];
        const [homeDoc, ...snaps] = await Promise.all([
            db.collection('home').doc('content').get(),
            ...cols.map(c => db.collection(c).get())
        ]);
        const proc = d => {
            if (d && typeof d.schemaJsonLd === 'string') { try { d.schemaJsonLd = JSON.parse(d.schemaJsonLd); } catch { d.schemaJsonLd = {}; } }
            return d;
        };
        const data = { home: homeDoc.exists ? proc(homeDoc.data()) : {} };
        cols.forEach((col, i) => {
            data[col] = snaps[i].docs.map(doc => ({ id: doc.id, ...proc(doc.data()) })).filter(item => item.status !== 'archived');
        });
        return data;
    } catch (e) {
        console.error('Firebase load error:', e);
        return { home: {}, services: [], blog: [], creative: [], reviews: [] };
    }
}

// --- CONTENT FORMAT ---
function formatContent(content) {
    if (!content) return '';
    const yt_re = /^https?:\/\/(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([a-zA-Z0-9_-]{11})/;
    const img_re = /^https?:\/\/[^<>"'\s]+\.(?:jpg|jpeg|png|gif|webp|svg)\s*$/i;
    const ph = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E";
    const parts = content.replace(/\r\n/g, '\n').split(/\n{2,}/).map(block => {
        const b = block.trim(); if (!b) return '';
        const yt = b.match(yt_re); const img = b.match(img_re);
        if (/^<(p|div|h[1-6]|ul|ol|li|blockquote|hr|table|pre)/i.test(b)) return b;
        if (yt) return `<div class="embedded-video" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;background:#000;margin:1.5em 0;border-radius:4px"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%" src="https://www.youtube.com/embed/${yt[1]}" frameborder="0" allowfullscreen></iframe></div>`;
        if (img) return `<p class="animate-on-scroll"><img data-src="${b}" src="${ph}" class="lazy-load-image" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:4px"/></p>`;
        return `<p>${b.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean);
    const groups = []; let tmp = [];
    parts.forEach(p => { tmp.push(p); if (tmp.length >= 3) { groups.push(`<div class="content-group">${tmp.join('')}</div>`); tmp = []; } });
    if (tmp.length) groups.push(`<div class="content-group">${tmp.join('')}</div>`);
    return groups.join('\n');
}

// --- MENU ---
function renderMenu(lang) {
    const menuEl = document.querySelector('.nav-menu');
    if (!menuEl) return;
    const labels = MENU_LABELS[lang] || MENU_LABELS.ru;
    const items = [
        { label: labels.home,     href: `${BASE_PATH}/${lang}/` },
        { label: labels.services, href: `${BASE_PATH}/${lang}/#services` },
        { label: labels.blog,     href: `${BASE_PATH}/${lang}/#blog` },
        { label: labels.creative, href: `${BASE_PATH}/${lang}/#creative` },
        { label: labels.reviews,  href: `${BASE_PATH}/${lang}/#reviews` },
    ];
    // Lang switcher
    const switcherItems = SUPPORTED_LANGS.filter(l => l !== lang).map(l => {
        const path = window.location.pathname.replace(`/${lang}/`, `/${l}/`);
        return `<li class="lang-switch"><a href="${path}" title="${LANG_NAMES[l]}">${l.toUpperCase()}</a></li>`;
    }).join('');
    menuEl.innerHTML = items.map(i => `<li><a href="${i.href}">${i.label}</a></li>`).join('') + switcherItems;
}

// --- SECTION RENDERING (home) ---
function renderSection(col, lang) {
    const section = document.getElementById(col);
    if (!section) return;
    const items = (siteData[col] || []).filter(i => i.lang === lang);
    const labels = SECTION_LABELS[lang] || SECTION_LABELS.ru;
    const cardsHTML = items.map(item => {
        const url = `${BASE_PATH}/${lang}/${col}/${item.urlSlug}/`;
        const img = (item.media || []).find(u => !/youtube|vimeo/.test(u)) || '';
        return `<a href="${url}" class="item-card animate-on-scroll">
            <div class="item-card__image" role="img" aria-label="${item.mainImageAlt || item.title || ''}" data-bg-src="${img}"></div>
            <div class="item-card__content">
                <h3>${item.title || ''}</h3>
                <div class="card-subtitle">${item.subtitle || ''}</div>
                <p>${item.description || ''}</p>
            </div>
        </a>`;
    }).join('');
    section.innerHTML = `<h2 class="animate-on-scroll is-visible">${labels[col]}</h2><div class="item-grid">${cardsHTML}</div>`;
}

// --- HOME PAGE ---
function hydrateHomePage(lang) {
    // Сначала пробуем preloaded-data
    const preEl = document.getElementById('preloaded-data');
    if (preEl) {
        try {
            const data = JSON.parse(preEl.textContent);
            ['services','blog','creative','reviews'].forEach(col => {
                if (!siteData[col] || !siteData[col].length) siteData[col] = data[col] || [];
            });
            preEl.remove();
        } catch(e) {}
    }
    ['services','blog','creative','reviews'].forEach(col => renderSection(col, lang));
    document.querySelectorAll('.item-card').forEach(el => el.classList.add('animate-on-scroll'));

    const footer = document.getElementById('site-footer');
    if (footer) {
        footer.style.display = 'block';
        footer.innerHTML = `© ${new Date().getFullYear()} Tika`;
        footer.onclick = () => { window.location.href = `${BASE_PATH}/admin.html`; };
    }
}

// --- TOC TOGGLE ---
let tocInitialized = false;
function initTocToggle() {
    if (tocInitialized) return;
    const wrapper = document.getElementById('floating-toc-wrapper');
    const btn = document.getElementById('toc-toggle-btn');
    const panel = document.getElementById('toc-content-panel');
    if (!wrapper || !btn || !panel) return;
    const close = () => { btn.setAttribute('aria-expanded','false'); panel.setAttribute('aria-hidden','true'); panel.classList.remove('is-visible'); btn.classList.remove('is-active'); };
    btn.addEventListener('click', e => {
        e.stopPropagation();
        const open = btn.getAttribute('aria-expanded') === 'true';
        if (open) { close(); } else { btn.setAttribute('aria-expanded','true'); panel.setAttribute('aria-hidden','false'); panel.classList.add('is-visible'); btn.classList.add('is-active'); }
    });
    document.addEventListener('click', e => { if (panel.classList.contains('is-visible') && !wrapper.contains(e.target)) close(); });
    panel.addEventListener('click', e => { if (e.target.closest('a')) setTimeout(close, 100); });
    tocInitialized = true;
}

// --- DETAIL PAGE ---
function renderDetailPage(col, slug, lang) {
    const mainEl = document.querySelector('main');
    const item = (siteData[col] || []).find(d => d.urlSlug === slug && d.lang === lang);
    const tocWrapper = document.getElementById('floating-toc-wrapper');
    const tocPanel = document.getElementById('toc-content-panel');
    const tocBtn = document.getElementById('toc-toggle-btn');

    if (!item) {
        if (mainEl) mainEl.innerHTML = `<section class="detail-page-header"><h1>404</h1><p>Страница не найдена.</p><a href="${BASE_PATH}/${lang}/">На главную</a></section>`;
        if (tocWrapper) tocWrapper.style.display = 'none';
        return;
    }

    renderSeoTags(item, lang);

    const raw = item.mainContent || '';
    let tocHtml = '';
    let finalHtml = '';

    if (raw.trim().startsWith('[TOC]')) {
        const content = raw.replace('[TOC]', '').trim();
        const htmlContent = formatContent(content);
        const doc = new DOMParser().parseFromString(htmlContent, 'text/html');
        const tocItems = [];
        doc.querySelectorAll('h2,h3').forEach(h => {
            const txt = h.innerText.trim();
            if (txt) { const id = slugify(txt); h.id = id; tocItems.push({ level: h.tagName.toLowerCase(), text: txt, id }); }
        });
        if (tocItems.length) {
            tocHtml = '<ul>' + tocItems.map(t => `<li class="${t.level === 'h3' ? 'toc-level-h3' : ''}"><a href="#${t.id}">${t.text}</a></li>`).join('') + '</ul>';
        }
        finalHtml = doc.body.innerHTML;
    } else {
        finalHtml = formatContent(raw);
    }

    if (mainEl) {
        mainEl.innerHTML = `
        <section>
            <div class="detail-page-header">
                <h1 class="animate-always is-visible">${item.h1 || item.title || ''}</h1>
                ${item.price ? `<div class="detail-price animate-on-scroll"><span>${item.price}</span></div>` : ''}
            </div>
            <div class="detail-content">${finalHtml}</div>
        </section>
        <button id="scroll-to-top-btn" title="Наверх">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M13 7.828V20h-2V7.828l-5.364 5.364-1.414-1.414L12 4l7.778 7.778-1.414 1.414L13 7.828z"/>
            </svg>
        </button>`;
        document.querySelectorAll('.detail-content > .content-group').forEach(el => el.classList.add('floating-item'));
    }

    if (tocWrapper && tocPanel && tocBtn) {
        if (tocHtml) {
            tocBtn.innerHTML = `${TOC_LABEL[lang] || 'Содержание'} <span class="toc-arrow"></span>`;
            tocPanel.innerHTML = tocHtml;
            tocWrapper.style.display = 'flex';
            initTocToggle();
        } else {
            tocWrapper.style.display = 'none';
        }
    }

    renderRelated(col, slug, lang);
    const footer = document.getElementById('site-footer');
    if (footer) footer.style.display = 'none';
}

function renderRelated(col, slug, lang) {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;
    const pool = ['services','blog','creative','reviews'].flatMap(c => (siteData[c]||[]).map(i => ({...i,_col:c})));
    const candidates = pool.filter(i => i.lang === lang && !(i._col === col && i.urlSlug === slug));
    const related = candidates.sort(() => .5 - Math.random()).slice(0, 6);
    if (!related.length) return;
    const sec = document.createElement('section');
    sec.id = 'related-posts';
    sec.innerHTML = `<h2 class="animate-on-scroll">${RELATED_LABEL[lang] || ''}</h2><div class="item-grid">` +
        related.map(item => {
            const img = (item.media||[]).find(u => !/youtube|vimeo/.test(u)) || '';
            return `<a href="${BASE_PATH}/${lang}/${item._col}/${item.urlSlug}/" class="item-card animate-on-scroll">
                <div class="item-card__image" data-bg-src="${img}"></div>
                <div class="item-card__content"><h3>${item.title||''}</h3><div class="card-subtitle">${item.subtitle||''}</div><p>${item.description||''}</p></div>
            </a>`;
        }).join('') + '</div>';
    mainEl.appendChild(sec);
}

// --- ROUTING ---
function parseRoute() {
    // Expected: /Tika/{lang}/{col}/{slug}/ or /Tika/{lang}/
    const parts = window.location.pathname.split('/').filter(Boolean);
    // parts[0] = 'Tika', parts[1] = lang, parts[2] = col, parts[3] = slug
    const lang = SUPPORTED_LANGS.includes(parts[1]) ? parts[1] : 'ru';
    const col = ['services','blog','creative','reviews'].includes(parts[2]) ? parts[2] : null;
    const slug = parts[3] || null;
    return { lang, col, slug };
}

function scrollToHash(hash) {
    if (!hash) return;
    const el = document.getElementById(hash.replace('#',''));
    if (!el) return;
    let top = 0; let e = el; while (e) { top += e.offsetTop; e = e.offsetParent; }
    window.scrollTo({ top: Math.max(0, top - window.innerHeight * 0.25), behavior: 'smooth' });
}

async function routeAndRender() {
    const { lang, col, slug } = parseRoute();
    currentLang = lang;
    renderMenu(lang);

    if (col && slug) {
        renderDetailPage(col, slug, lang);
    } else {
        hydrateHomePage(lang);
        if (window.location.hash) setTimeout(() => scrollToHash(window.location.hash), 100);
    }

    requestAnimationFrame(setupObservers);
    document.documentElement.style.setProperty('--main-visibility', 'visible');
    updateScrollBtn();
}

// --- NAVIGATION ---
function handleClick(e) {
    const link = e.target.closest('a');
    if (!link || link.target === '_blank' || link.host !== location.host || e.metaKey || e.ctrlKey) return;
    const url = new URL(link.href);
    e.preventDefault();

    const toggleMenu = () => {
        const isOpen = document.body.classList.contains('nav-is-open');
        if (isOpen) {
            document.body.classList.remove('nav-is-open');
            document.querySelector('.menu-toggle')?.classList.remove('is-active');
            document.querySelector('.nav-overlay')?.classList.remove('is-active');
        }
        return isOpen;
    };
    const wasOpen = toggleMenu();
    const delay = wasOpen ? 350 : 0;

    if (url.pathname === location.pathname && url.hash) {
        setTimeout(() => { history.pushState({}, '', url.href); scrollToHash(url.hash); }, delay);
        return;
    }
    if (url.href === location.href) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    setTimeout(() => {
        const main = document.querySelector('main');
        if (main) main.classList.add('is-transitioning');
        setTimeout(async () => {
            history.pushState({}, '', url.href);
            tocInitialized = false;
            await routeAndRender();
            if (main) requestAnimationFrame(() => requestAnimationFrame(() => main.classList.remove('is-transitioning')));
            if (!url.hash) window.scrollTo({ top: 0, behavior: 'instant' });
        }, 400);
    }, delay);
}

function updateScrollBtn() {
    const b = document.getElementById('scroll-to-top-btn');
    if (b) b.classList.toggle('visible', window.scrollY > 300);
}

// --- INIT ---
async function initApp() {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

    document.body.addEventListener('click', handleClick);
    window.addEventListener('popstate', routeAndRender);
    window.addEventListener('scroll', updateScrollBtn, { passive: true });

    // Mobile menu toggle
    document.querySelector('.menu-toggle')?.addEventListener('click', e => {
        e.stopPropagation();
        document.body.classList.toggle('nav-is-open');
        e.currentTarget.classList.toggle('is-active');
        document.querySelector('.nav-overlay')?.classList.toggle('is-active');
    });
    document.addEventListener('click', e => {
        if (!document.body.classList.contains('nav-is-open')) return;
        if (!e.target.closest('.nav-overlay') && !e.target.closest('.menu-toggle')) {
            document.body.classList.remove('nav-is-open');
            document.querySelector('.menu-toggle')?.classList.remove('is-active');
            document.querySelector('.nav-overlay')?.classList.remove('is-active');
        }
    });
    document.querySelector('main')?.addEventListener('click', e => {
        if (e.target.closest('#scroll-to-top-btn')) window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    siteData = await loadData();
    await routeAndRender();
}

window.addEventListener('DOMContentLoaded', initApp);
