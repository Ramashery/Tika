// --- FIREBASE CONFIGURATION (tika-c756e) ---
const firebaseConfig = {
  apiKey: "AIzaSyD_placeholder_replace_with_web_api_key",
  authDomain: "tika-c756e.firebaseapp.com",
  projectId: "tika-c756e",
  storageBucket: "tika-c756e.firebasestorage.app",
  messagingSenderId: "107031456777379880366",
  appId: "replace_with_web_app_id"
};

// NOTE: Replace apiKey and appId above with values from Firebase Console →
// Project Settings → Your apps → Web app config.
// The service account key is only for the Python backend (generate_site.py).

let db;
let siteData = {};
const initialSiteData = {
    home: { h1: "", subtitle: "", lang: "ru", seoTitle: "Tika", metaDescription: "Грузинский язык для русскоязычных" },
    services: [], blog: [], creative: [], reviews: []
};

const BASE_PATH = '/Tika';
const mainContentEl = document.querySelector('main');
let floatingObserver, animateOnceObserver, animateAlwaysObserver;

// --- TRANSLITERATION MAPS ---
const GEORGIAN_TRANSLIT_MAP = {
    'ა': 'a', 'ბ': 'b', 'გ': 'g', 'დ': 'd', 'ე': 'e', 'ვ': 'v', 'ზ': 'z', 'თ': 't', 'ი': 'i',
    'კ': 'k', 'ლ': 'l', 'მ': 'm', 'ნ': 'n', 'ო': 'o', 'პ': 'p', 'ჟ': 'zh', 'რ': 'r', 'ს': 's',
    'ტ': 't', 'უ': 'u', 'ფ': 'p', 'ქ': 'k', 'ღ': 'gh', 'ყ': 'q', 'შ': 'sh', 'ჩ': 'ch', 'ც': 'ts',
    'ძ': 'dz', 'წ': 'ts', 'ჭ': 'ch', 'ხ': 'kh', 'ჯ': 'j', 'ჰ': 'h',
};

const CYRILLIC_TRANSLIT_MAP = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z',
    'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

function slugify(text) {
    text = String(text).toLowerCase();
    let hasGeorgian = false;
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode >= 0x10D0 && charCode <= 0x10FF) { hasGeorgian = true; break; }
    }
    if (hasGeorgian) {
        let transliterated = '';
        for (let i = 0; i < text.length; i++) transliterated += GEORGIAN_TRANSLIT_MAP[text[i]] || text[i];
        text = transliterated;
    }
    let hasCyrillic = false;
    for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode >= 0x0400 && charCode <= 0x04FF) { hasCyrillic = true; break; }
    }
    if (hasCyrillic) {
        let transliterated = '';
        for (let i = 0; i < text.length; i++) transliterated += CYRILLIC_TRANSLIT_MAP[text[i]] || text[i];
        text = transliterated;
    }
    text = text.replace(/[^a-z0-9-]+/g, '-');
    text = text.replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    return text;
}

// --- INTERSECTION OBSERVER SETUP (WITH LAZY LOADING) ---
function setupObservers() {
    if (floatingObserver) floatingObserver.disconnect();
    if (animateOnceObserver) animateOnceObserver.disconnect();
    if (animateAlwaysObserver) animateAlwaysObserver.disconnect();

    floatingObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const target = entry.target;
            const isAboveViewport = entry.boundingClientRect.top < 0 && !entry.isIntersecting;
            if (entry.isIntersecting) {
                target.classList.add('is-visible');
                target.classList.remove('is-above');
            } else {
                target.classList.remove('is-visible');
                if (isAboveViewport) target.classList.add('is-above');
                else target.classList.remove('is-above');
            }
        });
    }, { threshold: 0, rootMargin: "-50px 0px -50px 0px" });

    animateOnceObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const lazyBackgrounds = Array.from(target.querySelectorAll('[data-bg-src]'));
                if (target.hasAttribute('data-bg-src')) lazyBackgrounds.push(target);
                lazyBackgrounds.forEach(el => {
                    el.style.backgroundImage = `url('${el.dataset.bgSrc}')`;
                    el.removeAttribute('data-bg-src');
                });
                const lazyImage = target.querySelector('img.lazy-load-image[data-src]');
                if (lazyImage) {
                    lazyImage.onload = () => { lazyImage.classList.add('loaded'); lazyImage.onload = null; };
                    lazyImage.src = lazyImage.dataset.src;
                    lazyImage.removeAttribute('data-src');
                }
                target.classList.add('is-visible');
                observer.unobserve(target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px 50px 0px" });

    animateAlwaysObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('is-visible');
            else entry.target.classList.remove('is-visible');
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    document.querySelectorAll('.floating-item').forEach(el => floatingObserver.observe(el));
    document.querySelectorAll('.animate-on-scroll').forEach(el => animateOnceObserver.observe(el));
    document.querySelectorAll('.animate-always').forEach(el => animateAlwaysObserver.observe(el));
}

// --- SEO TAG RENDERING ---
function renderSeoTags(data) {
    document.querySelectorAll('meta[name="description"], meta[property^="og:"], script[type="application/ld+json"], link[rel="canonical"]').forEach(el => el.remove());
    document.title = data.seoTitle || "Tika — Грузинский язык";
    document.documentElement.lang = 'ru';

    const createMeta = (attr, key, value) => {
        if (value) {
            const meta = document.createElement('meta');
            meta.setAttribute(attr, key);
            meta.content = value;
            document.head.appendChild(meta);
        }
    };

    createMeta('name', 'description', data.metaDescription);
    createMeta('property', 'og:title', data.ogTitle || data.seoTitle);
    createMeta('property', 'og:description', data.ogDescription || data.metaDescription);
    const mediaArray = data.media || [];
    const ogImage = data.ogImage || (mediaArray.find && mediaArray.find(url => !/youtube|vimeo/.test(url))) || '';
    if (ogImage) createMeta('property', 'og:image', ogImage);

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    let path = window.location.pathname;
    if (path.length > 1 && !path.endsWith('/')) path += '/';
    canonical.href = 'https://ramashery.github.io' + path;
    document.head.appendChild(canonical);

    let schemaData = data.schemaJsonLd;
    if (typeof schemaData === 'string' && schemaData.trim()) {
        try { schemaData = JSON.parse(schemaData); } catch (e) { schemaData = null; }
    }
    if (schemaData && typeof schemaData === 'object' && Object.keys(schemaData).length > 0) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schemaData);
        document.head.appendChild(script);
    }
}

// --- DATA LOADING FROM FIREBASE ---
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
            freshSiteData[col] = snapshots[index].docs
                .map(doc => ({ id: doc.id, ...processDocData(doc.data()) }))
                .filter(item => item.status !== 'archived');
        });
        return freshSiteData;
    } catch (error) {
        console.error("Error loading data from Firebase:", error);
        return JSON.parse(JSON.stringify(initialSiteData));
    }
}

// --- CONTENT FORMATTING (CLIENT-SIDE) ---
function formatContentHtml(content) {
    if (!content) return '';

    let processedContent = content.replace(/<pre(.*?)>([\s\S]*?)<\/pre>/gim, function(match, attrs, inner) {
        const codeMatch = inner.match(/^\s*<code(.*?)>([\s\S]*?)<\/code>\s*$/i);
        if (codeMatch) {
            const escaped = codeMatch[2].replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre${attrs}><code${codeMatch[1]}>${escaped}</code></pre>`;
        }
        return `<pre${attrs}>${inner.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
    });

    processedContent = processedContent.replace(/\r\n/g, '\n');
    const blocks = processedContent.split(/\n{2,}/);

    const html_parts = blocks.map(block => {
        const trimmedBlock = block.trim();
        if (!trimmedBlock) return '';

        const youtubeRegex = /^https?:\/\/(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch?v=|watch\?.*&v=|shorts\/))([a-zA-Z0-9_-]{11}).*$/;
        const imageRegex = /^https?:\/\/[^<>"']+\.(?:jpg|jpeg|png|gif|webp|svg)\s*$/i;
        const youtubeMatch = trimmedBlock.match(youtubeRegex);
        const imageMatch = trimmedBlock.match(imageRegex);

        if (/^<(p|div|h[1-6]|ul|ol|li|blockquote|hr|table|pre)/i.test(trimmedBlock)) {
            return trimmedBlock;
        } else if (youtubeMatch) {
            return `<div class="embedded-video" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;background:#000;margin:1.5em 0;border-radius:4px;border:1px solid var(--color-border)"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%" src="https://www.youtube.com/embed/${youtubeMatch[1]}" frameborder="0" allowfullscreen></iframe></div>`;
        } else if (imageMatch) {
            const placeholder = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201%201'%3E%3C/svg%3E";
            return `<p class="animate-on-scroll" style="margin:1.5em 0"><img data-src="${trimmedBlock}" src="${placeholder}" class="lazy-load-image" alt="Embedded content" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:4px;border:1px solid var(--color-border)" /></p>`;
        } else {
            return `<p>${trimmedBlock.replace(/\n/g, '<br>')}</p>`;
        }
    }).filter(Boolean);

    const groupedHtml = [];
    const GROUP_SIZE = 3;
    let temp_group = [];
    html_parts.forEach(part => {
        temp_group.push(part);
        if (temp_group.length >= GROUP_SIZE) {
            groupedHtml.push(`<div class="content-group">${temp_group.join('')}</div>`);
            temp_group = [];
        }
    });
    if (temp_group.length > 0) groupedHtml.push(`<div class="content-group">${temp_group.join('')}</div>`);
    return groupedHtml.join('\n');
}

// --- HOMEPAGE SECTION RENDERING ---
function renderSection(key, title, items) {
    const section = document.getElementById(key);
    if (!section) return;
    const itemsFromDb = items || siteData[key] || [];

    const cardsHTML = itemsFromDb.map(item => {
        const itemUrl = `${BASE_PATH}/${key}/${item.urlSlug}/`;
        const mediaArray = item.media || [];
        const imageUrl = (mediaArray.find && mediaArray.find(url => !/youtube|vimeo/.test(url))) || '';
        return `<a href="${itemUrl}" class="item-card animate-on-scroll">
            <div class="item-card__image" role="img" aria-label="${item.mainImageAlt || item.title || ''}" data-bg-src="${imageUrl}"></div>
            <div class="item-card__content">
                <h3>${item.title}</h3>
                <div class="card-subtitle">${item.subtitle || ''}</div>
                <p>${item.description || ''}</p>
            </div>
        </a>`;
    }).join('');

    section.innerHTML = `<h2 class="animate-on-scroll is-visible">${title}</h2><div class="item-grid">${cardsHTML}</div>`;
}

// --- FLOATING TOC TOGGLE ---
let floatingTocToggleInitialized = false;
function initFloatingTocToggle() {
    if (floatingTocToggleInitialized) return;
    const floatingTocWrapper = document.getElementById('floating-toc-wrapper');
    const toggleBtn = document.getElementById('toc-toggle-btn');
    const contentPanel = document.getElementById('toc-content-panel');
    if (!floatingTocWrapper || !toggleBtn || !contentPanel) return;

    const closeToc = () => {
        toggleBtn.setAttribute('aria-expanded', 'false');
        contentPanel.setAttribute('aria-hidden', 'true');
        contentPanel.classList.remove('is-visible');
        toggleBtn.classList.remove('is-active');
    };

    toggleBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
        if (isExpanded) { closeToc(); }
        else {
            toggleBtn.setAttribute('aria-expanded', 'true');
            contentPanel.setAttribute('aria-hidden', 'false');
            contentPanel.classList.add('is-visible');
            toggleBtn.classList.add('is-active');
        }
    });
    document.addEventListener('click', (event) => {
        if (contentPanel.classList.contains('is-visible') && !floatingTocWrapper.contains(event.target)) closeToc();
    });
    contentPanel.addEventListener('click', (event) => {
        if (event.target.closest('a')) setTimeout(closeToc, 100);
    });
    floatingTocToggleInitialized = true;
}

// --- DETAIL PAGE RENDERING ---
function renderDetailPage(collection, slug) {
    const item = siteData[collection]?.find(d => d.urlSlug === slug);
    const floatingTocWrapper = document.getElementById('floating-toc-wrapper');
    const tocContentPanel = document.getElementById('toc-content-panel');
    const tocToggleBtn = document.getElementById('toc-toggle-btn');

    if (!item) {
        mainContentEl.innerHTML = `<section class="detail-page-header"><h1>404 — Страница не найдена</h1><p>Запрашиваемой страницы не существует.</p><a href="${BASE_PATH}/">На главную</a></section>`;
        if (floatingTocWrapper) floatingTocWrapper.style.display = 'none';
        return;
    }
    renderSeoTags(item);
    applyCustomBackground(item);

    const rawContent = item.mainContent || '';
    let tocHtmlContent = '';
    let finalContentHtml = '';

    if (rawContent.trim().startsWith('[TOC]')) {
        const contentWithoutToc = rawContent.replace('[TOC]', '').trim();
        const contentHtml = formatContentHtml(contentWithoutToc);
        const parser = new DOMParser();
        const doc = parser.parseFromString(contentHtml, 'text/html');
        const tocItems = [];
        doc.querySelectorAll('h2, h3').forEach(header => {
            const headerText = header.innerText.trim();
            if (headerText) {
                const headerSlug = slugify(headerText);
                header.id = headerSlug;
                tocItems.push({ level: header.tagName.toLowerCase(), text: headerText, slug: headerSlug });
            }
        });
        if (tocItems.length > 0) {
            let tocListHtml = '<ul>';
            tocItems.forEach(t => {
                tocListHtml += `<li class="${t.level === 'h3' ? 'toc-level-h3' : ''}"><a href="#${t.slug}">${t.text}</a></li>`;
            });
            tocListHtml += '</ul>';
            tocHtmlContent = tocListHtml;
        }
        finalContentHtml = doc.body.innerHTML;
    } else {
        finalContentHtml = formatContentHtml(rawContent);
    }

    mainContentEl.innerHTML = `
        <section>
            <div class="detail-page-header">
                <h1 class="animate-always is-visible">${item.h1 || item.title || ''}</h1>
                ${item.price ? `<div class="detail-price animate-on-scroll"><span>${item.price}</span></div>` : ''}
            </div>
            <div class="detail-content">${finalContentHtml}</div>
        </section>
        <button id="scroll-to-top-btn" title="Наверх">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                <path fill="none" d="M0 0h24v24H0z"/>
                <path d="M13 7.828V20h-2V7.828l-5.364 5.364-1.414-1.414L12 4l7.778 7.778-1.414 1.414L13 7.828z"/>
            </svg>
        </button>
    `;

    document.querySelectorAll('.detail-content > .content-group').forEach(el => el.classList.add('floating-item'));

    if (floatingTocWrapper && tocContentPanel && tocToggleBtn) {
        if (tocHtmlContent) {
            tocToggleBtn.innerHTML = `Содержание <span class="toc-arrow"></span>`;
            tocContentPanel.innerHTML = tocHtmlContent;
            floatingTocWrapper.style.display = 'flex';
            initFloatingTocToggle();
        } else {
            floatingTocWrapper.style.display = 'none';
            tocContentPanel.innerHTML = '';
        }
    }

    renderRelatedPosts(collection, slug);
    document.getElementById('site-footer').style.display = 'none';
}

// --- RELATED POSTS ---
function renderRelatedPosts(currentCollection, currentSlug) {
    const pool = [
        ...( siteData.services || []).map(i => ({...i, collection: 'services'})),
        ...( siteData.blog     || []).map(i => ({...i, collection: 'blog'})),
        ...( siteData.creative || []).map(i => ({...i, collection: 'creative'})),
        ...( siteData.reviews  || []).map(i => ({...i, collection: 'reviews'})),
    ];
    const relatedItems = pool
        .filter(item => !(item.collection === currentCollection && item.urlSlug === currentSlug))
        .sort(() => 0.5 - Math.random())
        .slice(0, 6);

    if (relatedItems.length === 0) return;

    const itemsHTML = relatedItems.map(item => {
        const itemUrl = `${BASE_PATH}/${item.collection}/${item.urlSlug}/`;
        const mediaArray = item.media || [];
        const imageUrl = (mediaArray.find && mediaArray.find(url => !/youtube|vimeo/.test(url))) || '';
        return `<a href="${itemUrl}" class="item-card animate-on-scroll">
            <div class="item-card__image" role="img" aria-label="${item.mainImageAlt || item.title || ''}" data-bg-src="${imageUrl}"></div>
            <div class="item-card__content">
                <h3>${item.title}</h3>
                <div class="card-subtitle">${item.subtitle || ''}</div>
                <p>${item.description || ''}</p>
            </div>
        </a>`;
    }).join('');

    const relatedSection = document.createElement('section');
    relatedSection.id = 'related-posts';
    relatedSection.innerHTML = `<h2 class="animate-on-scroll">Вам также может быть интересно</h2><div class="item-grid">${itemsHTML}</div>`;
    mainContentEl.appendChild(relatedSection);
}

// --- NAVIGATION MENU ---
function renderMenu() {
    const menuEl = document.querySelector('.nav-menu');
    if (!menuEl) return;
    const menuItems = [
        { label: 'Главная',    href: `${BASE_PATH}/` },
        { label: 'Услуги',     href: `${BASE_PATH}/#services` },
        { label: 'Блог',       href: `${BASE_PATH}/#blog` },
        { label: 'Творческое', href: `${BASE_PATH}/#creative` },
        { label: 'Отзывы',     href: `${BASE_PATH}/#reviews` },
    ];
    menuEl.innerHTML = menuItems.map(item => `<li><a href="${item.href}">${item.label}</a></li>`).join('');
}

// --- CUSTOM BACKGROUND ---
function applyCustomBackground(item) {
    const iframe = document.getElementById('custom-background-iframe');
    if (!iframe) return;
    const homeBgHtml = (siteData.home && siteData.home.backgroundHtml) || '';
    const itemBgHtml = (item && item.backgroundHtml) || '';
    const customCode = itemBgHtml || homeBgHtml || '';
    if (customCode && customCode.trim() !== "") {
        if (iframe.srcdoc === customCode && iframe.style.display === 'block') return;
        iframe.classList.remove('is-visible');
        iframe.onload = () => { iframe.classList.add('is-visible'); iframe.onload = null; };
        iframe.style.display = 'block';
        iframe.srcdoc = customCode;
    } else {
        iframe.classList.remove('is-visible');
        iframe.style.display = 'none';
        iframe.srcdoc = '';
    }
}

// --- HOMEPAGE HYDRATION ---
function hydrateHomePageContent() {
    const preData = document.getElementById('preloaded-data');
    if (preData) {
        try {
            const data = JSON.parse(preData.textContent);
            ['services', 'blog', 'creative', 'reviews'].forEach(k => {
                if (!siteData[k] || siteData[k].length === 0) siteData[k] = data[k] || [];
            });
            preData.remove();
        } catch (e) {
            console.error("[hydrateHomePageContent] Error parsing preloaded data:", e);
        }
    }
    applyCustomBackground(siteData.home);

    renderSection('services', 'Услуги',     siteData.services);
    renderSection('blog',     'Блог',        siteData.blog);
    renderSection('creative', 'Творческое',  siteData.creative);
    renderSection('reviews',  'Отзывы',      siteData.reviews);

    document.querySelectorAll('.item-card').forEach(el => el.classList.add('animate-on-scroll'));

    const footer = document.getElementById('site-footer');
    if (footer) {
        footer.style.display = 'block';
        footer.innerHTML = `© ${new Date().getFullYear()} Tika — Грузинский язык`;
        footer.onclick = () => { window.location.href = `${BASE_PATH}/admin.html`; };
    }
}

// --- NAVIGATION ---
async function navigateToHome(hash = '') {
    try {
        const response = await fetch(`${BASE_PATH}/`);
        if (!response.ok) throw new Error('Failed to fetch home page');
        const htmlText = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const newMain = doc.querySelector('main');
        if (newMain) {
            mainContentEl.innerHTML = newMain.innerHTML;
            document.title = doc.querySelector('title')?.textContent || 'Tika';
        }
        applyCustomBackground(siteData.home);
        hydrateHomePageContent();
        requestAnimationFrame(() => {
            const h1 = document.querySelector('.hero h1');
            const sub = document.querySelector('.hero-subtitle-container');
            if (h1) h1.classList.add('is-visible');
            if (sub) sub.classList.add('is-visible');
        });
        if (hash) setTimeout(() => scrollToElementWithOffset(hash.substring(1)), 100);
    } catch (error) {
        console.error("[navigateToHome] Error:", error);
    } finally {
        const toc = document.getElementById('floating-toc-wrapper');
        if (toc) toc.style.display = 'none';
    }
}

function scrollToElementWithOffset(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    let absoluteTop = 0;
    let el = element;
    while (el) { absoluteTop += el.offsetTop; el = el.offsetParent; }
    window.scrollTo({ top: Math.max(0, absoluteTop - Math.floor(window.innerHeight * 0.25)), behavior: 'smooth' });
}

async function routeAndRender(isPopState = false, hash = '') {
    const path = window.location.pathname;
    // Pattern: /Tika/collection/slug/
    const detailPageRegex = /\/Tika\/(services|blog|creative|reviews)\/([a-zA-Z0-9-]+)\/?$/;
    const match = path.match(detailPageRegex);

    if (match) {
        const [, col, slug] = match;
        renderDetailPage(col, slug);
    } else {
        await navigateToHome(hash || window.location.hash);
    }

    requestAnimationFrame(() => setupObservers());
    document.documentElement.style.setProperty('--main-visibility', 'visible');
    updateScrollButtonVisibility();
    if (!hash && !window.location.hash) window.scrollTo({ top: 0, behavior: 'instant' });
}

function handleNavigation(e) {
    const link = e.target.closest('a');
    if (!link || link.target === '_blank' || link.protocol !== window.location.protocol || link.host !== window.location.host || e.metaKey || e.ctrlKey || e.shiftKey) return;

    const targetUrl = new URL(link.href);
    e.preventDefault();

    const menuToggle = document.querySelector('.menu-toggle');
    const navOverlay = document.querySelector('.nav-overlay');
    const isMenuOpen = document.body.classList.contains('nav-is-open');
    if (isMenuOpen) {
        document.body.classList.remove('nav-is-open');
        if (menuToggle) menuToggle.classList.remove('is-active');
        if (navOverlay) navOverlay.classList.remove('is-active');
    }
    const delay = isMenuOpen ? 350 : 0;

    if (targetUrl.pathname === window.location.pathname && targetUrl.hash) {
        setTimeout(() => {
            window.history.pushState({}, '', targetUrl.href);
            scrollToElementWithOffset(targetUrl.hash.substring(1));
        }, delay);
        return;
    }

    if (targetUrl.href === window.location.href) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }

    setTimeout(() => {
        mainContentEl.classList.add('is-transitioning');
        setTimeout(() => {
            window.history.pushState({}, '', targetUrl.href);
            routeAndRender(false, targetUrl.hash);
            requestAnimationFrame(() => requestAnimationFrame(() => mainContentEl.classList.remove('is-transitioning')));
        }, 400);
    }, delay);
}

// --- STATIC PAGE HYDRATION ---
async function hydrateStaticPage() {
    renderMenu();
    updateScrollButtonVisibility();
    try {
        siteData = await loadData();
        const path = window.location.pathname;
        const match = path.match(/\/Tika\/(services|blog|creative|reviews)\/([a-zA-Z0-9-]+)\/?$/);
        if (match) {
            const [, col, slug] = match;
            const item = siteData[col]?.find(d => d.urlSlug === slug);
            if (item) {
                applyCustomBackground(item);
                if (!document.getElementById('related-posts')) renderRelatedPosts(col, slug);
            }
        } else {
            hydrateHomePageContent();
        }
    } catch (error) {
        console.error("[hydrateStaticPage] Error:", error);
    }
}

// --- EVENT LISTENERS ---
function initStaticEventListeners() {
    document.body.addEventListener('click', handleNavigation);
    window.addEventListener('popstate', () => routeAndRender(true));

    const menuToggle = document.querySelector('.menu-toggle');
    const navOverlay = document.querySelector('.nav-overlay');

    function closeMenu() {
        document.body.classList.remove('nav-is-open');
        if (menuToggle) menuToggle.classList.remove('is-active');
        if (navOverlay) navOverlay.classList.remove('is-active');
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            document.body.classList.toggle('nav-is-open');
            menuToggle.classList.toggle('is-active');
            if (navOverlay) navOverlay.classList.toggle('is-active');
        });
    }

    document.addEventListener('click', (e) => {
        if (!document.body.classList.contains('nav-is-open')) return;
        if (!e.target.closest('.nav-overlay') && !e.target.closest('.menu-toggle')) closeMenu();
    });

    mainContentEl.addEventListener('click', (e) => {
        if (e.target.closest('#scroll-to-top-btn')) window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// --- SCROLL HASH UPDATER ---
let scrollHashUpdateTimer = null;
function initScrollHashUpdater() {
    window.addEventListener('scroll', () => {
        if (scrollHashUpdateTimer) return;
        scrollHashUpdateTimer = setTimeout(() => {
            scrollHashUpdateTimer = null;
            const headings = document.querySelectorAll('.detail-content h2[id], .detail-content h3[id]');
            if (headings.length === 0) return;
            let bestMatch = null;
            const viewportMid = window.innerHeight / 2;
            headings.forEach(h => { if (h.getBoundingClientRect().top <= viewportMid) bestMatch = h; });
            const newHash = bestMatch ? '#' + bestMatch.id : '';
            if (newHash !== window.location.hash) {
                window.history.replaceState(null, '', window.location.pathname + window.location.search + newHash);
            }
        }, 150);
    }, { passive: true });
}

function updateScrollButtonVisibility() {
    const b = document.getElementById('scroll-to-top-btn');
    if (b) { window.scrollY > 300 ? b.classList.add('visible') : b.classList.remove('visible'); }
}

// --- APP INIT ---
async function initApp() {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

    initStaticEventListeners();
    initScrollHashUpdater();
    window.addEventListener('scroll', updateScrollButtonVisibility, { passive: true });

    if (document.body.dataset.staticPage === 'true') {
        await hydrateStaticPage();
        routeAndRender(false, window.location.hash);
    } else {
        siteData = await loadData();
        renderMenu();
        await routeAndRender();
    }
}

window.addEventListener('DOMContentLoaded', initApp);
