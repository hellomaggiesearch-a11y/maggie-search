#!/usr/bin/env python3
"""
Maggie Search — Awin Feed Processor
Baixa os datafeeds CSV do Awin, extrai preços reais,
e gera o index.html atualizado automaticamente.
"""

import os
import csv
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

def download_feed(merchant_id: str) -> list[dict]:
    """Baixa o datafeed CSV de um merchant via Awin API."""
    if not AWIN_API_TOKEN:
        print(f"  [SKIP] Sem AWIN_API_TOKEN — usando dados de fallback")
        return []

    url = (
        f"https://productdata.awin.com/datafeed/download/apikey/{AWIN_API_TOKEN}"
        f"/language/en/fid/{merchant_id}/columns/aw_product_id,product_name,"
        f"search_price,merchant_deep_link,merchant_name/format/csv/"
    )
    try:
        print(f"  Baixando feed merchant {merchant_id}...")
        req = urllib.request.Request(url, headers={"User-Agent": "MaggieSearch/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
        # Salva o feed bruto para o artifact de diagnóstico (workflow passo 4)
        os.makedirs("feeds", exist_ok=True)
        with open(f"feeds/feed_{merchant_id}.csv", "w", encoding="utf-8") as f:
            f.write(raw)
        lines = raw.splitlines()
        reader = csv.DictReader(lines)
        rows = list(reader)
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
    """Constrói a lista de medicamentos com preços reais dos feeds."""

    # Fallback — preços hardcoded para quando não há feed ainda
    FALLBACK_PRICES = {
        ("Apoquel", "3.6mg"):        {"VioVet": 15.99, "Pet Drugs Online": 16.50, "Pets at Home": 17.99, "VetUK": 15.50, "Animed Direct": 14.99},
        ("Apoquel", "5.4mg"):        {"VioVet": 18.99, "Pet Drugs Online": 19.50, "Pets at Home": 20.99, "VetUK": 18.50, "Animed Direct": 17.99},
        ("Apoquel", "16mg"):         {"VioVet": 32.99, "Pet Drugs Online": 34.50, "Pets at Home": 35.99, "VetUK": 32.50, "Animed Direct": 31.50},
        ("Bravecto", "4.5-10kg"):    {"VioVet": 24.99, "Pet Drugs Online": 25.50, "Pets at Home": 27.99, "VetUK": 24.50, "Animed Direct": 23.99},
        ("Bravecto", "10-20kg"):     {"VioVet": 34.99, "Pet Drugs Online": 36.50, "Pets at Home": 38.99, "VetUK": 34.50, "Animed Direct": 33.99},
        ("Bravecto", "20-40kg"):     {"VioVet": 44.99, "Pet Drugs Online": 46.50, "Pets at Home": 48.99, "VetUK": 44.50, "Animed Direct": 43.99},
        ("Rimadyl", "20mg"):         {"VioVet": 12.99, "Pet Drugs Online": 13.50, "Pets at Home": 14.99, "VetUK": 12.50, "Animed Direct": 11.99},
        ("Rimadyl", "50mg"):         {"VioVet": 15.99, "Pet Drugs Online": 16.50, "Pets at Home": 17.99, "VetUK": 15.50, "Animed Direct": 14.99},
        ("Rimadyl", "100mg"):        {"VioVet": 22.99, "Pet Drugs Online": 24.50, "Pets at Home": 25.99, "VetUK": 22.50, "Animed Direct": 21.99},
        ("Carprieve", "20mg"):       {"VioVet": 10.49, "Pet Drugs Online": 10.99, "Pets at Home": 12.49, "VetUK":  9.99, "Animed Direct":  9.79},
        ("Carprieve", "50mg"):       {"VioVet": 12.99, "Pet Drugs Online": 13.49, "Pets at Home": 14.99, "VetUK": 12.49, "Animed Direct": 12.29},
        ("Carprieve", "100mg"):      {"VioVet": 17.99, "Pet Drugs Online": 18.99, "Pets at Home": 20.49, "VetUK": 17.49, "Animed Direct": 17.29},
        ("Rimifin", "20mg"):         {"VioVet":  9.99, "Pet Drugs Online": 10.49, "Pets at Home": 11.99, "VetUK":  9.49, "Animed Direct":  9.29},
        ("Rimifin", "50mg"):         {"VioVet": 12.49, "Pet Drugs Online": 12.99, "Pets at Home": 14.49, "VetUK": 11.99, "Animed Direct": 11.79},
        ("Rimifin", "100mg"):        {"VioVet": 17.49, "Pet Drugs Online": 18.49, "Pets at Home": 19.99, "VetUK": 16.99, "Animed Direct": 16.79},
        ("Metacam", "1.5mg/ml"):     {"VioVet": 24.99, "Pet Drugs Online": 25.50, "Pets at Home": 27.99, "VetUK": 24.50, "Animed Direct": 23.99},
        ("Loxicom", "1.5mg/ml"):     {"VioVet": 18.99, "Pet Drugs Online": 19.50, "Pets at Home": 21.99, "VetUK": 18.49, "Animed Direct": 17.99},
        ("Meloxidyl", "1.5mg/ml"):   {"VioVet": 19.49, "Pet Drugs Online": 19.99, "Pets at Home": 22.49, "VetUK": 18.99, "Animed Direct": 18.49},
        ("Inflacam", "1.5mg/ml"):    {"VioVet": 18.49, "Pet Drugs Online": 18.99, "Pets at Home": 21.49, "VetUK": 17.99, "Animed Direct": 17.49},
        ("NexGard", "10-25kg"):      {"VioVet": 29.99, "Pet Drugs Online": 31.50, "Pets at Home": 33.99, "VetUK": 29.50, "Animed Direct": 28.99},
        ("Frontline Spot-on", "Dog"):{"VioVet":  8.99, "Pet Drugs Online":  9.50, "Pets at Home": 10.99, "VetUK":  8.50, "Animed Direct":  7.99},
        ("Effipro Spot-on", "Dog"):  {"VioVet":  6.99, "Pet Drugs Online":  7.50, "Pets at Home":  8.99, "VetUK":  6.50, "Animed Direct":  6.29},
        ("Fiprotec Spot-on", "Dog"): {"VioVet":  6.49, "Pet Drugs Online":  6.99, "Pets at Home":  8.49, "VetUK":  5.99, "Animed Direct":  5.79},
        ("Cerenia", "16mg"):         {"VioVet": 18.99, "Pet Drugs Online": 19.50, "Pets at Home": 21.99, "VetUK": 18.50, "Animed Direct": 17.99},
        ("Cerenia", "24mg"):         {"VioVet": 24.99, "Pet Drugs Online": 25.99, "Pets at Home": 27.99, "VetUK": 24.49, "Animed Direct": 23.99},
        ("Bravecto", "2.8-6.25kg"):  {"VioVet": 19.99, "Pet Drugs Online": 21.50, "Pets at Home": 23.99, "VetUK": 19.50, "Animed Direct": 18.99},
        ("Frontline Spot-on", "Cat"):{"VioVet":  7.99, "Pet Drugs Online":  8.50, "Pets at Home":  9.99, "VetUK":  7.50, "Animed Direct":  6.99},
        ("Effipro Spot-on", "Cat"):  {"VioVet":  5.99, "Pet Drugs Online":  6.50, "Pets at Home":  7.99, "VetUK":  5.50, "Animed Direct":  5.29},
        ("Fiprotec Spot-on", "Cat"): {"VioVet":  5.49, "Pet Drugs Online":  5.99, "Pets at Home":  7.49, "VetUK":  4.99, "Animed Direct":  4.79},
    }

    FALLBACK_LINKS = {
        "VioVet":          "https://www.viovet.co.uk/",
        "Pet Drugs Online":"https://www.petdrugsonline.co.uk/",
        "Pets at Home":    "https://www.petsathome.com/",
        "VetUK":           "https://www.vetuk.co.uk/",
        "Animed Direct":   "https://www.animeddirect.co.uk/",
    }

    # Baixa todos os feeds disponíveis
    feeds = {}
    for merchant_name, info in MERCHANTS.items():
        print(f"Processando {merchant_name}...")
        rows = download_feed(info["id"])
        if rows:
            feeds[merchant_name] = rows

    medicines_out = []

    for med_def in MEDICINES_LOOKUP:
        name = med_def["name"]
        for dose in med_def["doses"]:
            prices = {}
            links  = {}

            # Tenta preços reais dos feeds
            for merchant_name, rows in feeds.items():
                price, link = find_price(rows, name, dose)
                if price and link:
                    prices[merchant_name] = price
                    links[merchant_name]  = link
                    print(f"  ✓ {merchant_name}: {name} {dose} = £{price:.2f}")

            # Completa com fallback para merchants sem feed ainda
            fallback = FALLBACK_PRICES.get((name, dose), {})
            for ph, pr in fallback.items():
                if ph not in prices:
                    prices[ph] = pr
                    links[ph]  = FALLBACK_LINKS.get(ph, "#")

            if prices:
                sp = "Cats" if ("Cat" in dose or dose == "2.8-6.25kg") else med_def["sp"]
                medicines_out.append({
                    "name":   name,
                    "ai":     med_def.get("ai", ""),
                    "dose":   dose,
                    "cat":    med_def["cat"],
                    "sp":     sp,
                    "prices": prices,
                    "links":  links,
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
            f'sp:"{m["sp"]}", prices:{{{prices_js}}}, links:{{{links_js}}}}},'
        )

    lines.append("];")
    return "\n".join(lines)

def inject_into_html(template_path: str, medicines_js: str, output_path: str):
    """Substitui o bloco medicinesData no HTML pelo novo gerado."""
    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    # Regex que captura o bloco var medicinesData = [...];
    pattern = r'/\* Auto-generated.*?\*/\s*var medicinesData = \[.*?\];'
    replacement = medicines_js

    if re.search(pattern, html, re.DOTALL):
        html_new = re.sub(pattern, replacement, html, flags=re.DOTALL)
        print("  Bloco medicinesData atualizado no HTML")
    else:
        # Primeira vez — injeta antes do fechamento do script
        html_new = html.replace(
            "var medicinesData = [",
            medicines_js.split("var medicinesData")[0] + "var medicinesData = ["
        )
        # Fallback simples: substitui var medicinesData = [ ... ]; inteiro
        pattern2 = r'var medicinesData = \[.*?\];'
        html_new = re.sub(pattern2, medicines_js, html, flags=re.DOTALL)
        print("  Primeira injeção do bloco medicinesData")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_new)
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

    print("\n[2/3] Gerando bloco JavaScript...")
    medicines_js = medicines_to_js(medicines)

    print("\n[3/3] Injetando no HTML...")
    inject_into_html(template, medicines_js, output)

    print("\n✅ Build concluído com sucesso!")
    return 0

if __name__ == "__main__":
    exit(main())
