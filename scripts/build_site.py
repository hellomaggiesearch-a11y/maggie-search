#!/usr/bin/env python3
"""
Maggie Search — Awin Feed Processor
Baixa os datafeeds CSV do Awin, extrai preços reais,
e gera o index.html atualizado automaticamente.
"""

import os
import csv
import gzip
import json
import re
import urllib.request
import urllib.error
from datetime import datetime

# ── Configuração ────────────────────────────────────────────
AWIN_API_TOKEN = os.environ.get("AWIN_API_TOKEN", "")
PUBLISHER_ID   = os.environ.get("AWIN_PUBLISHER_ID", "2955355")

# Merchants aprovados no Awin com seus IDs
MERCHANTS = {
    "VioVet":          {"id": "4782",  "url": "https://www.viovet.co.uk/"},
    "Morgan & French": {"id": "9897",  "url": "https://www.morganandfrence.co.uk/"},
    "Vetz Petz Antinol UK": {"id": "14799", "url": "https://vetzpetz.co.uk/"},
}

# Medicamentos a rastrear — nome, princípio ativo (ai, confirmado na VMD) e dosagens UK
MEDICINES_LOOKUP = [
    {"name": "Apoquel",           "ai": "oclacitinib", "doses": ["3.6mg", "5.4mg", "16mg"],  "cat": "Anti-inflammatory", "sp": "Dogs"},
    {"name": "Bravecto",          "ai": "fluralaner",  "doses": ["4.5-10kg", "10-20kg", "20-40kg", "2.8-6.25kg"], "cat": "Antiparasitic", "sp": "Dogs"},
    {"name": "Rimadyl",           "ai": "carprofen",   "doses": ["20mg", "50mg", "100mg"],   "cat": "Anti-inflammatory", "sp": "Dogs"},
    {"name": "Carprieve",         "ai": "carprofen",   "doses": ["20mg", "50mg", "100mg"],   "cat": "Anti-inflammatory", "sp": "Dogs"},
    {"name": "Rimifin",           "ai": "carprofen",   "doses": ["20mg", "50mg", "100mg"],   "cat": "Anti-inflammatory", "sp": "Dogs"},
    {"name": "Metacam",           "ai": "meloxicam",   "doses": ["1.5mg/ml"],                "cat": "Anti-inflammatory", "sp": "Dogs"},
    {"name": "Loxicom",           "ai": "meloxicam",   "doses": ["1.5mg/ml"],                "cat": "Anti-inflammatory", "sp": "Dogs"},
    {"name": "Meloxidyl",         "ai": "meloxicam",   "doses": ["1.5mg/ml"],                "cat": "Anti-inflammatory", "sp": "Dogs"},
    {"name": "Inflacam",          "ai": "meloxicam",   "doses": ["1.5mg/ml"],                "cat": "Anti-inflammatory", "sp": "Dogs"},
    {"name": "NexGard",           "ai": "afoxolaner",  "doses": ["10-25kg"],                 "cat": "Antiparasitic",     "sp": "Dogs"},
    {"name": "Frontline Spot-on", "ai": "fipronil",    "doses": ["Dog", "Cat"],              "cat": "Antiparasitic",     "sp": "Dogs"},
    {"name": "Effipro Spot-on",   "ai": "fipronil",    "doses": ["Dog", "Cat"],              "cat": "Antiparasitic",     "sp": "Dogs"},
    {"name": "Fiprotec Spot-on",  "ai": "fipronil",    "doses": ["Dog", "Cat"],              "cat": "Antiparasitic",     "sp": "Dogs"},
    {"name": "Cerenia",           "ai": "maropitant",  "doses": ["16mg", "24mg"],            "cat": "Digestive",         "sp": "Dogs"},
]

# Páginas de produto na VioVet — links SIMPLES (não-afiliados), usados no botão
# "Check today's price" enquanto não há preço real de feed. Sem valor monetário.
VIOVET_PRODUCT_URLS = {
    "Apoquel":           "https://www.viovet.co.uk/Apoquel-Film-Coated-Tablets/c18584/",
    "Bravecto":          "https://www.viovet.co.uk/Bravecto-Flea-Treatments-for-Cats-Dogs/c19178/",
    "Rimadyl":           "https://www.viovet.co.uk/Rimadyl-for-Dogs/c4/",
    "Carprieve":         "https://www.viovet.co.uk/Carprieve/c66/",
    "Metacam":           "https://www.viovet.co.uk/Metacam-Oral-Suspension/c5/",
    "Loxicom":           "https://www.viovet.co.uk/Loxicom-for-Dogs-Cats---Oral-Suspension/c1463/",
    "NexGard":           "https://www.viovet.co.uk/NexGard-Tablets-for-Dogs/c19457/",
    "Frontline Spot-on": "https://www.viovet.co.uk/FRONTLINE-Spot-On-Flea-Tick-Treatment-Dogs-Cats/c42/",
    "Meloxidyl":         "https://www.viovet.co.uk/Meloxidyl-Oral-Liquid-for-Dogs-and-Cats/c697/",
    "Inflacam":          "https://www.viovet.co.uk/Inflacam-Oral-Suspension-For-Dogs/c34852/",
    "Effipro Spot-on":   "https://www.viovet.co.uk/Effipro-Spot-On-Flea-Treatment-for-Dogs-Cats/c6057/",
    "Cerenia":           "https://www.viovet.co.uk/Cerenia/c488/",
    # Rimifin e Fiprotec: sem página própria na VioVet — caem no fallback (home)
}

def viovet_check_url(name: str) -> str:
    """Link simples para conferir o preço na VioVet (nunca afiliado)."""
    return VIOVET_PRODUCT_URLS.get(name, "https://www.viovet.co.uk/")

def get_feed_list() -> list[dict]:
    """Baixa a lista de datafeeds do publisher (Create-a-Feed list).

    O endpoint de download exige o FEED ID (fid), que é diferente do
    advertiser/merchant ID — esta lista é onde os fids são descobertos.
    """
    if not AWIN_API_TOKEN:
        return []
    url = f"https://productdata.awin.com/datafeed/list/apikey/{AWIN_API_TOKEN}/"
    try:
        print("Baixando lista de datafeeds...")
        req = urllib.request.Request(url, headers={"User-Agent": "MaggieSearch/1.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
        os.makedirs("feeds", exist_ok=True)
        # A apikey aparece embutida nas URLs — remover antes de salvar, pois o
        # arquivo vai para um artifact em repositório público
        with open("feeds/feed_list.csv", "w", encoding="utf-8") as f:
            f.write(re.sub(r"/apikey/[^/]+/", "/apikey/REDACTED/", raw))
        # Normaliza os nomes de coluna (o header da Awin usa "Advertiser ID" etc.)
        rows = []
        for row in csv.DictReader(raw.splitlines()):
            clean = {}
            for k, v in row.items():
                if not isinstance(k, str):
                    continue  # colunas extras sem header
                if not isinstance(v, str):
                    v = "" if v is None else str(v)
                clean[k.strip().lower()] = v.strip()
            rows.append(clean)
        print(f"  → {len(rows)} feeds disponíveis para o publisher")
        return rows
    except urllib.error.HTTPError as e:
        print(f"  [ERRO] Lista de feeds: HTTP {e.code} — se 401/403/404, o secret "
              f"AWIN_API_TOKEN pode ser o token errado (precisa da API key de "
              f"datafeed da página Create-a-Feed, não o token OAuth da api.awin.com)")
        return []
    except Exception as e:
        print(f"  [ERRO] Lista de feeds: {e}")
        return []

def download_feed(merchant_id: str, feed_list: list[dict]) -> list[dict]:
    """Baixa o datafeed CSV de um merchant, resolvendo o feed ID pela lista."""
    if not AWIN_API_TOKEN:
        print(f"  [SKIP] Sem AWIN_API_TOKEN — usando dados de fallback")
        return []

    candidates = [r for r in feed_list if r.get("advertiser id") == merchant_id]
    if not candidates:
        print(f"  [ERRO] Nenhum feed na lista para o advertiser {merchant_id} "
              f"(verificar aprovação/assinatura do feed no painel Awin)")
        return []

    feed = candidates[0]
    url = feed.get("url", "")
    if not url:
        print(f"  [ERRO] Feed do advertiser {merchant_id} sem URL na lista")
        return []

    try:
        print(f"  Baixando feed {feed.get('feed id', '?')} do advertiser {merchant_id}...")
        req = urllib.request.Request(url, headers={"User-Agent": "MaggieSearch/1.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read()
        if "/compression/gzip" in url or data[:2] == b"\x1f\x8b":
            data = gzip.decompress(data)
        raw = data.decode("utf-8", errors="replace")
        # Salva o feed bruto para o artifact de diagnóstico (workflow passo 4)
        os.makedirs("feeds", exist_ok=True)
        with open(f"feeds/feed_{merchant_id}.csv", "w", encoding="utf-8") as f:
            f.write(raw)
        rows = list(csv.DictReader(raw.splitlines()))
        print(f"  → {len(rows)} produtos encontrados")
        return rows
    except Exception as e:
        print(f"  [ERRO] Feed {merchant_id}: {e}")
        return []

def find_price(rows: list[dict], medicine: str, dose: str) -> tuple[float | None, str | None]:
    """Procura preço e link para um medicamento+dose específico."""
    medicine_lower = medicine.lower()
    dose_lower     = dose.lower()

    for row in rows:
        name = row.get("product_name", "").lower()
        if medicine_lower in name and dose_lower in name:
            try:
                price = float(row.get("search_price", "0").replace("£", "").strip())
                link  = row.get("merchant_deep_link", "") or row.get("aw_deep_link", "")
                if price > 0 and link:
                    return price, link
            except (ValueError, AttributeError):
                continue
    return None, None

def build_medicines_data() -> list[dict]:
    """Constrói a lista de medicamentos.

    Preços vêm EXCLUSIVAMENTE dos feeds Awin — sem feed, o produto sai sem
    preço (prices vazio) e a UI mostra o botão "Check today's price at VioVet".
    Nunca inventar valor monetário aqui.
    """
    feed_list = get_feed_list()
    feeds = {}
    for merchant_name, info in MERCHANTS.items():
        print(f"Processando {merchant_name}...")
        rows = download_feed(info["id"], feed_list)
        if rows:
            feeds[merchant_name] = rows

    medicines_out = []

    for med_def in MEDICINES_LOOKUP:
        name = med_def["name"]
        for dose in med_def["doses"]:
            prices = {}
            links  = {}

            # Só preços reais dos feeds
            for merchant_name, rows in feeds.items():
                price, link = find_price(rows, name, dose)
                if price and link:
                    prices[merchant_name] = price
                    links[merchant_name]  = link
                    print(f"  ✓ {merchant_name}: {name} {dose} = £{price:.2f}")

            sp = "Cats" if ("Cat" in dose or dose == "2.8-6.25kg") else med_def["sp"]
            medicines_out.append({
                "name":   name,
                "ai":     med_def.get("ai", ""),
                "dose":   dose,
                "cat":    med_def["cat"],
                "sp":     sp,
                "prices": prices,
                "links":  links,
                "check":  viovet_check_url(name),
            })

    return medicines_out

def medicines_to_js(medicines: list[dict]) -> str:
    """Converte lista de medicamentos para bloco JS."""
    now = datetime.utcnow().strftime("%d %b %Y %H:%M UTC")
    lines = [f'/* Auto-generated by build_site.py — {now} */']
    lines.append("var medicinesData = [")

    for m in medicines:
        prices_js = ", ".join(
            f'"{ph}": {pr:.2f}'
            for ph, pr in m["prices"].items()
        )
        links_js = ", ".join(
            f'"{ph}": "{lk}"'
            for ph, lk in m["links"].items()
        )
        lines.append(
            f'  {{name:"{m["name"]}", ai:"{m.get("ai", "")}", dose:"{m["dose"]}", cat:"{m["cat"]}", '
            f'sp:"{m["sp"]}", prices:{{{prices_js}}}, links:{{{links_js}}}, '
            f'check:"{m.get("check", "https://www.viovet.co.uk/")}"}},'
        )

    lines.append("];")
    return "\n".join(lines)

def ai_groups_to_js(data_path: str = "data/active_ingredients_uk.json") -> str:
    """Gera o bloco aiGroups/aiUiCopy a partir do JSON de princípios ativos.

    Entram APENAS grupos vmd_verified=true e nunca exclude_from_site=true.
    """
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    ui = data.get("ui_copy", {})
    groups = [
        g for g in data.get("ingredients", [])
        if g.get("vmd_verified") is True and g.get("exclude_from_site") is not True
    ]

    slim = [
        {
            "ai":          g["active_ingredient"],
            "ref":         g["reference_brand"],
            "equivalents": g.get("equivalents", []),
            "category":    g.get("category", ""),
            "species":     g.get("species", []),
        }
        for g in groups
    ]

    lines = ["/* Auto-generated aiGroups by build_site.py — from data/active_ingredients_uk.json */"]
    lines.append("var aiUiCopy = " + json.dumps({
        "heading":    ui.get("alternatives_heading", ""),
        "badge":      ui.get("alternative_badge", ""),
        "disclaimer": ui.get("disclaimer", ""),
    }, ensure_ascii=False) + ";")
    lines.append("var aiGroups = [")
    for g in slim:
        lines.append("  " + json.dumps(g, ensure_ascii=False) + ",")
    lines.append("];")
    print(f"  → {len(slim)} grupos de princípio ativo elegíveis")
    return "\n".join(lines)

def inject_into_html(template_path: str, medicines_js: str, ai_js: str, output_path: str):
    """Substitui os blocos medicinesData e aiGroups no HTML pelos novos gerados."""
    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Bloco medicinesData (marcador "Auto-generated by build_site.py")
    pattern_med = r'/\* Auto-generated by build_site\.py[^*]*\*/\s*var medicinesData = \[.*?\];'
    if re.search(pattern_med, html, re.DOTALL):
        html = re.sub(pattern_med, medicines_js.replace("\\", "\\\\"), html, flags=re.DOTALL)
        print("  Bloco medicinesData atualizado no HTML")
    else:
        html = re.sub(r'var medicinesData = \[.*?\];', medicines_js.replace("\\", "\\\\"), html, flags=re.DOTALL)
        print("  Primeira injeção do bloco medicinesData")

    # Bloco aiGroups (marcador "Auto-generated aiGroups")
    pattern_ai = r'/\* Auto-generated aiGroups[^*]*\*/\s*var aiUiCopy = .*?var aiGroups = \[.*?\];'
    if re.search(pattern_ai, html, re.DOTALL):
        html = re.sub(pattern_ai, ai_js.replace("\\", "\\\\"), html, flags=re.DOTALL)
        print("  Bloco aiGroups atualizado no HTML")
    else:
        print("  [AVISO] Marcador aiGroups não encontrado no HTML — bloco não injetado")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"  Arquivo gerado: {output_path}")

def main():
    print("=" * 50)
    print("Maggie Search — Build Site")
    print("=" * 50)

    template = "index.html"
    output   = "index.html"

    if not os.path.exists(template):
        print(f"ERRO: {template} não encontrado")
        return 1

    print("\n[1/3] Baixando feeds do Awin...")
    medicines = build_medicines_data()
    print(f"\n  Total: {len(medicines)} variações de medicamentos")

    print("\n[2/3] Gerando blocos JavaScript...")
    medicines_js = medicines_to_js(medicines)
    ai_js        = ai_groups_to_js()

    print("\n[3/3] Injetando no HTML...")
    inject_into_html(template, medicines_js, ai_js, output)

    print("\n✅ Build concluído com sucesso!")
    return 0

if __name__ == "__main__":
    exit(main())
