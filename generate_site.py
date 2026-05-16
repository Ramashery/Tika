import os
import json
import re
import shutil
import html
import random
import sys
from datetime import date, datetime
from lxml import etree as ET
import firebase_admin
from firebase_admin import credentials, firestore
from jinja2 import Environment, FileSystemLoader
from transliterate import translit

print("--- Инициализация скрипта ---")
try:
    if not firebase_admin._apps:
        service_account_env = os.environ.get('FIREBASE_SERVICE_ACCOUNT')
        if not service_account_env:
            print("✗ ОШИБКА: FIREBASE_SERVICE_ACCOUNT не найден.")
            sys.exit(1)
        service_account_info = json.loads(service_account_env)
        cred = credentials.Certificate(service_account_info)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("✓ Подключение к Firebase успешно.")
except Exception as e:
    print(f"✗ ОШИБКА ПОДКЛЮЧЕНИЯ: {e}")
    sys.exit(1)

try:
    env = Environment(loader=FileSystemLoader('.'))
    home_template = env.get_template('home_template.html')
    detail_template = env.get_template('template.html')
    error_404_template = env.get_template('404_template.html')
    print("✓ Шаблоны загружены.")
except Exception as e:
    print(f"✗ ОШИБКА загрузки шаблонов: {e}")
    sys.exit(1)

OUTPUT_DIR = 'public'
BASE_URL = "https://ramashery.github.io/Tika"
SUPPORTED_LANGS = ['ru', 'ka']
LANG_NAMES = {'ru': 'Русский', 'ka': 'ქართული'}
COLLECTIONS = ['services', 'blog', 'creative', 'reviews']

SITEMAP_DEFAULTS = {
    'home':     {'priority': '1.0', 'changefreq': 'weekly'},
    'services': {'priority': '0.9', 'changefreq': 'monthly'},
    'blog':     {'priority': '0.7', 'changefreq': 'monthly'},
    'creative': {'priority': '0.8', 'changefreq': 'monthly'},
    'reviews':  {'priority': '0.6', 'changefreq': 'monthly'},
}

if os.path.exists(OUTPUT_DIR):
    shutil.rmtree(OUTPUT_DIR)
os.makedirs(OUTPUT_DIR, exist_ok=True)
print(f"✓ Папка '{OUTPUT_DIR}' создана.")

GEORGIAN_TRANSLIT_MAP = {
    'ა':'a','ბ':'b','გ':'g','დ':'d','ე':'e','ვ':'v','ზ':'z','თ':'t','ი':'i',
    'კ':'k','ლ':'l','მ':'m','ნ':'n','ო':'o','პ':'p','ჟ':'zh','რ':'r','ს':'s',
    'ტ':'t','უ':'u','ფ':'ph','ქ':'k','ღ':'gh','ყ':'q','შ':'sh','ჩ':'ch','ც':'ts',
    'ძ':'dz','წ':'ts','ჭ':'ch','ხ':'kh','ჯ':'j','ჰ':'h',
}

def slugify(text):
    text = str(text).lower()
    if any('\u10D0' <= c <= '\u10FF' for c in text):
        text = "".join(GEORGIAN_TRANSLIT_MAP.get(c, c) for c in text)
    if any('\u0400' <= c <= '\u04FF' for c in text):
        try:
            text = translit(text, 'ru', reversed=True)
        except Exception:
            pass
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s-]+', '-', text).strip('-')
    return text

def get_all_data():
    print("--- Загрузка данных из Firebase ---")
    site_data = {}
    try:
        home_doc = db.collection('home').document('content').get()
        site_data['home'] = home_doc.to_dict() if home_doc.exists else {}
        for col in COLLECTIONS:
            print(f"  > {col}...")
            site_data[col] = []
            for doc in db.collection(col).stream():
                d = doc.to_dict()
                d['id'] = doc.id
                d['collection_name'] = col
                if d.get('status') == 'archived':
                    continue
                if isinstance(d.get('schemaJsonLd'), str):
                    try:
                        d['schemaJsonLd'] = json.loads(d['schemaJsonLd'])
                    except json.JSONDecodeError:
                        d['schemaJsonLd'] = {}
                site_data[col].append(d)
            print(f"    ✓ {len(site_data[col])} документов.")
        return site_data
    except Exception as e:
        print(f"✗ ОШИБКА Firestore: {e}")
        sys.exit(1)

def create_lean_preview(items, lang=None):
    """Returns ALL items regardless of lang - cards show for all lang versions of the site."""
    previews = []
    for item in items:
        media_list = item.get('media', [])
        first_image = media_list[0] if media_list else ''
        desc = item.get('description', '')
        if len(desc) > 500:
            desc = desc[:497] + '...'
        previews.append({
            'title': item.get('title', ''),
            'subtitle': item.get('subtitle', ''),
            'description': desc,
            'urlSlug': item.get('urlSlug', ''),
            'lang': item.get('lang', 'ru'),
            'collection_name': item.get('collection_name', ''),
            'media': [first_image],
        })
    return previews

def format_content(content_string, lang='ru'):
    if not content_string:
        return ""

    def escape_pre(match):
        attrs, inner = match.group(1), match.group(2)
        code_match = re.match(r'\s*<code>(.*)</code>\s*', inner, re.DOTALL | re.IGNORECASE)
        if code_match:
            return f'<pre{attrs}><code>{html.escape(code_match.group(1))}</code></pre>'
        return f'<pre{attrs}>{html.escape(inner)}</pre>'

    content = re.sub(r'<pre(.*?)>(.*?)</pre>', escape_pre, content_string, flags=re.DOTALL | re.IGNORECASE)
    content = content.replace('\r\n', '\n')
    blocks = re.split(r'\n{2,}', content)
    parts = []

    yt_re = r"https?://(?:www\.|m\.)?(?:youtu\.be/|youtube\.com/(?:embed/|v/|watch\?v=|shorts/))([a-zA-Z0-9_-]{11})"
    img_re = r"^https?://[^<>\s]+\.(?:jpg|jpeg|png|gif|webp|svg)\s*$"
    html_re = r"^\s*<(p|div|h[1-6]|ul|ol|li|blockquote|hr|table|pre)"

    for block in blocks:
        b = block.strip()
        if not b:
            continue
        yt = re.search(yt_re, b)
        img = re.match(img_re, b)
        htm = re.match(html_re, b, re.IGNORECASE)
        if htm:
            parts.append(b)
        elif yt:
            vid = yt.group(1)
            parts.append(f'<div class="embedded-video" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;max-width:100%;background:#000;margin:1.5em 0;border-radius:4px"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%" src="https://www.youtube.com/embed/{vid}" frameborder="0" allowfullscreen></iframe></div>')
        elif img:
            ph = "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%201%201'%3E%3C/svg%3E"
            parts.append(f'<p class="animate-on-scroll"><img data-src="{b}" src="{ph}" class="lazy-load-image" alt="" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:4px" /></p>')
        else:
            parts.append('<p>' + b.replace('\n', '<br>') + '</p>')

    groups = []
    tmp = []
    for p in parts:
        tmp.append(p)
        if len(tmp) >= 3:
            groups.append(f'<div class="content-group">{"".join(tmp)}</div>')
            tmp = []
    if tmp:
        groups.append(f'<div class="content-group">{"".join(tmp)}</div>')
    return '\n'.join(groups)

def generate_home_pages(all_data):
    print("--- Генерация главных страниц ---")
    # Корневой редирект на /ru/
    redirect = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0;url=/Tika/ru/"><link rel="canonical" href="https://ramashery.github.io/Tika/ru/"/></head><body></body></html>'
    with open(os.path.join(OUTPUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(redirect)

    home_data = all_data.get('home', {})
    alternates = [{'lang': lang, 'url': f"{BASE_URL}/{lang}/"} for lang in SUPPORTED_LANGS]

    for lang in SUPPORTED_LANGS:
        lang_dir = os.path.join(OUTPUT_DIR, lang)
        os.makedirs(lang_dir, exist_ok=True)
        sections_data = {col: create_lean_preview(all_data.get(col, [])) for col in COLLECTIONS}
        html_content = home_template.render(
            home=home_data, sections_data=sections_data,
            current_lang=lang, alternates=alternates,
            supported_langs=SUPPORTED_LANGS, lang_names=LANG_NAMES, base_url=BASE_URL,
        )
        with open(os.path.join(lang_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(html_content)
        print(f"  ✓ [{lang}] главная сгенерирована.")

def generate_detail_page(item, all_data, alternates):
    col = item['collection_name']
    lang = item.get('lang', 'ru')
    slug = item['urlSlug']
    path = os.path.join(OUTPUT_DIR, lang, col, slug, 'index.html')
    os.makedirs(os.path.dirname(path), exist_ok=True)

    try:
        raw = item.get('mainContent', '')
        toc_html = None
        toc_titles = {'ru': 'Содержание', 'ka': 'სარჩევი'}
        toc_title = toc_titles.get(lang, 'Содержание')
        final_html = ''

        if raw and raw.strip().startswith('[TOC]'):
            content_no_toc = raw.replace('[TOC]', '', 1).strip()
            content_html = format_content(content_no_toc, lang)
            parser = ET.HTMLParser(remove_blank_text=True)
            try:
                tree = ET.fromstring(f'<div>{content_html}</div>', parser)
                toc_items = []
                for hdr in tree.xpath('.//h2|.//h3'):
                    txt = "".join(hdr.itertext()).strip()
                    if txt:
                        hid = slugify(txt)
                        hdr.set('id', hid)
                        toc_items.append({'level': hdr.tag, 'text': txt, 'slug': hid})
                if toc_items:
                    tl = '<ul>'
                    for t in toc_items:
                        cls = 'toc-level-h3' if t['level'] == 'h3' else ''
                        tl += f'<li class="{cls}"><a href="#{t["slug"]}">{t["text"]}</a></li>'
                    tl += '</ul>'
                    toc_html = tl
                body = tree.find('body')
                if body is not None:
                    final_html = "".join([ET.tostring(c, encoding='unicode', method='html') for c in body])
                else:
                    final_html = "".join([ET.tostring(c, encoding='unicode', method='html') for c in tree])
            except Exception as e:
                print(f"  ! TOC ошибка {slug}: {e}")
                final_html = format_content(content_no_toc, lang)
        else:
            final_html = format_content(raw, lang)

        pool = sum([all_data.get(c, []) for c in COLLECTIONS], [])
        candidates = [c for c in pool if c.get('lang') == lang and c.get('urlSlug') != slug]
        related = random.sample(candidates, min(6, len(candidates)))

        x_default_url = next((a['url'] for a in alternates if a.get('lang') == 'ru'), f"{BASE_URL}/{lang}/{col}/{slug}/")

        html_content = detail_template.render(
            item=item, related_items=related, alternates=alternates,
            x_default_url=x_default_url, toc_html=toc_html, toc_title=toc_title,
            final_content_html=final_html, current_lang=lang,
            supported_langs=SUPPORTED_LANGS, lang_names=LANG_NAMES, base_url=BASE_URL,
        )
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    except Exception as e:
        print(f"✗ ОШИБКА {col}/{lang}/{slug}: {e}")

def copy_static_assets():
    print("--- Копирование статики ---")
    ignore_list = {
        '.git', '.github', OUTPUT_DIR, 'generate_site.py',
        'template.html', 'home_template.html', '404_template.html',
        'firebase.json', 'README.md', '__pycache__', 'index.html',
        'package.json', 'package-lock.json', 'node_modules', 'requirements.txt',
    }
    for item_name in os.listdir('.'):
        if item_name not in ignore_list:
            src = os.path.join('.', item_name)
            dst = os.path.join(OUTPUT_DIR, item_name)
            try:
                if os.path.isfile(src):
                    shutil.copy2(src, dst)
                elif os.path.isdir(src):
                    shutil.copytree(src, dst, dirs_exist_ok=True)
            except Exception as e:
                print(f"✗ Ошибка копирования '{item_name}': {e}")
    print("✓ Копирование завершено.")

def generate_sitemap_xml(valid_pages, all_data):
    print("--- Генерация Sitemap ---")
    SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
    XHTML_NS = "http://www.w3.org/1999/xhtml"
    NSMAP = {None: SITEMAP_NS, "xhtml": XHTML_NS}
    urlset = ET.Element("urlset", nsmap=NSMAP)

    # Главная
    url_el = ET.SubElement(urlset, "url")
    ET.SubElement(url_el, "loc").text = f"{BASE_URL}/ru/"
    ET.SubElement(url_el, "lastmod").text = date.today().isoformat()
    ET.SubElement(url_el, "changefreq").text = "weekly"
    ET.SubElement(url_el, "priority").text = "1.0"
    ET.SubElement(url_el, f"{{{XHTML_NS}}}link", rel="alternate", hreflang="x-default", href=f"{BASE_URL}/ru/")
    for lang in SUPPORTED_LANGS:
        ET.SubElement(url_el, f"{{{XHTML_NS}}}link", rel="alternate", hreflang=lang, href=f"{BASE_URL}/{lang}/")

    # Группировка
    grouped = {}
    loners = []
    for page in valid_pages:
        key = page.get('translationGroupKey', '').strip()
        if key:
            grouped.setdefault(key, []).append(page)
        else:
            loners.append(page)

    for group_key, pages in grouped.items():
        hmap = {}
        for p in pages:
            lg = p.get('lang')
            if lg in SUPPORTED_LANGS:
                hmap[lg] = f"{BASE_URL}/{lg}/{p['collection_name']}/{p['urlSlug']}/"

        x_default = hmap.get('ru') or list(hmap.values())[0]

        for page in pages:
            col = page.get('collection_name', '')
            defaults = SITEMAP_DEFAULTS.get(col, {'priority': '0.6', 'changefreq': 'monthly'})
            loc = f"{BASE_URL}/{page['lang']}/{col}/{page['urlSlug']}/"
            url_el = ET.SubElement(urlset, "url")
            ET.SubElement(url_el, "loc").text = loc
            lm = date.today().isoformat()
            if page.get('lastModified'):
                try:
                    lm = datetime.fromisoformat(page['lastModified'].replace("Z", "+00:00")).strftime('%Y-%m-%d')
                except ValueError:
                    pass
            ET.SubElement(url_el, "lastmod").text = lm
            ET.SubElement(url_el, "changefreq").text = str(page.get('sitemapChangefreq') or defaults['changefreq'])
            ET.SubElement(url_el, "priority").text = str(page.get('sitemapPriority') or defaults['priority'])
            if len(hmap) > 1:
                ET.SubElement(url_el, f"{{{XHTML_NS}}}link", rel="alternate", hreflang="x-default", href=x_default)
                for lc, hu in hmap.items():
                    ET.SubElement(url_el, f"{{{XHTML_NS}}}link", rel="alternate", hreflang=lc, href=hu)

    for page in loners:
        col = page.get('collection_name', '')
        defaults = SITEMAP_DEFAULTS.get(col, {'priority': '0.6', 'changefreq': 'monthly'})
        url_el = ET.SubElement(urlset, "url")
        ET.SubElement(url_el, "loc").text = f"{BASE_URL}/{page['lang']}/{col}/{page['urlSlug']}/"
        ET.SubElement(url_el, "lastmod").text = date.today().isoformat()
        ET.SubElement(url_el, "changefreq").text = str(page.get('sitemapChangefreq') or defaults['changefreq'])
        ET.SubElement(url_el, "priority").text = str(page.get('sitemapPriority') or defaults['priority'])

    with open(os.path.join(OUTPUT_DIR, 'sitemap.xml'), 'wb') as f:
        f.write(ET.tostring(urlset, pretty_print=True, xml_declaration=True, encoding='UTF-8'))
    print("✓ sitemap.xml создан.")

def main():
    print("!!! TIKA — ГЕНЕРАЦИЯ (RU/KA) !!!")
    all_data = get_all_data()
    generate_home_pages(all_data)

    # Строим карту переводов
    translations_map = {}
    for col in COLLECTIONS:
        for item in all_data.get(col, []):
            key = item.get('translationGroupKey', '').strip()
            if key:
                translations_map.setdefault(key, []).append(item)

    valid_pages = []
    print("--- Генерация детальных страниц ---")
    for col in COLLECTIONS:
        for item in all_data.get(col, []):
            if not item.get('urlSlug') or not item.get('lang'):
                continue
            key = item.get('translationGroupKey', '').strip()
            group = translations_map.get(key, [item])
            alternates = [
                {'lang': a['lang'], 'url': f"{BASE_URL}/{a['lang']}/{col}/{a['urlSlug']}/"}
                for a in group if a.get('lang') and a.get('urlSlug')
            ]
            generate_detail_page(item, all_data, alternates)
            valid_pages.append(item)

    print("✓ Детальные страницы готовы.")
    copy_static_assets()
    if valid_pages:
        generate_sitemap_xml(valid_pages, all_data)

    try:
        with open(os.path.join(OUTPUT_DIR, '404.html'), 'w', encoding='utf-8') as f:
            f.write(error_404_template.render())
        print("✓ 404.html создан.")
    except Exception as e:
        print(f"✗ 404: {e}")

    if not os.path.exists(os.path.join(OUTPUT_DIR, 'index.html')):
        print("❌ index.html отсутствует!")
        sys.exit(1)

    print("\n" + "=" * 60 + "\nГотово!\n" + "=" * 60)

if __name__ == '__main__':
    main()
