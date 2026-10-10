#!/usr/bin/env python3
"""
Converte o export da planilha de conferência manual (artifact db, coleções
`products` e `prices`, salvas como JSON por ArtifactData com out_dir) em
data/manual_prices.json, que o build_site.py usa para o comparador.

Uso:
    python scripts/manual_prices_from_db.py <pasta_do_export>

<pasta_do_export> contém products/*.json e prices/*.json.
Só preços conferidos entram aqui — nunca as pistas (`leads`) do Adapta.
"""

import glob
import json
import os
import sys
from datetime import datetime, timezone

ARTIFACT_URL = "https://claude.ai/artifact/Q1JMxKy8FCDHdhkKvR9hHF"

PHARMACIES = {  # id do db → nome exibido no site (ordem = desempate)
    "viovet": "VioVet",
    "pdo":    "Pet Drugs Online",
    "animed": "Animed Direct",
    "vetuk":  "VetUK",
}

# Categoria do filtro da sidebar, por princípio ativo (base, sem "(gatos)")
CATEGORY_BY_AI = {
    "oclacitinib":    "Skin & Allergy",
    "ciclosporin":    "Skin & Allergy",
    "meloxicam":      "Anti-inflammatory",
    "carprofen":      "Anti-inflammatory",
    "grapiprant":     "Anti-inflammatory",
    "pimobendan":     "Heart",
    "benazepril":     "Heart",
    "furosemide":     "Heart",
    "spironolactone": "Heart",
    "telmisartan":    "Kidney",
    "phenobarbital":  "Epilepsy",
    "levothyroxine":  "Hormonal",
    "thiamazole":     "Hormonal",
    "trilostane":     "Hormonal",
    "toceranib":      "Cancer",
}

# Espécie por produto. Padrão: cão. Só gato/ambos precisam estar aqui.
SPECIES_BY_PRODUCT = {
    "metacam-cat-0.5mg-ml":   ["Cats"],
    "loxicom-cat-0.5mg-ml":   ["Cats"],
    "meloxidyl-cat-0.5mg-ml": ["Cats"],
    "rheumocam-cat-0.5mg-ml": ["Cats"],
    "nelio-cat-5mg":          ["Cats"],
    "felimazole-2.5mg":       ["Cats"],
    "thiafeline-2.5mg":       ["Cats"],
    "thyronorm-5mg-ml":       ["Cats"],
    "semintra-4mg-ml":        ["Cats"],
    "semintra-10mg-ml":       ["Cats"],
    "fortekor-5mg":           ["Dogs", "Cats"],
    "benazecare-5mg":         ["Dogs", "Cats"],
    "benefortin-5mg":         ["Dogs", "Cats"],
    "kelapril-5mg":           ["Dogs", "Cats"],
    "furosemide-generic-40mg": ["Dogs", "Cats"],
    "furosoral-40mg":         ["Dogs", "Cats"],
}

# Nome exibido (o db guarda anotações em português em alguns nomes)
NAME_OVERRIDE = {
    "furosemide-generic-40mg": "Furosemide (generic)",
}

# Forma em inglês limpo (o db mistura notas em português)
FORM_OVERRIDE = {
    "semintra-10mg-ml": "oral solution (cats)",
}

# Produtos que são o mesmo item de outro (não viram card próprio)
SKIP = {"norocarp-50mg"}


def load_dir(path: str) -> dict:
    out = {}
    for f in glob.glob(os.path.join(path, "*.json")):
        with open(f, encoding="utf-8") as fh:
            d = json.load(fh)
        out[os.path.basename(f)[:-5]] = d.get("data", d)
    return out


def pack_label(doc: dict, unit: str) -> str:
    """Rótulo da opção gravada (a de menor preço por unidade)."""
    for v in doc.get("variants") or []:
        if v.get("price") == doc.get("price") and v.get("qty") == doc.get("packQty"):
            return v.get("pack") or ""
    qty = doc.get("packQty") or 0
    return f"{qty} {unit}{'s' if qty != 1 else ''}"


def main(src: str) -> int:
    products = load_dir(os.path.join(src, "products"))
    prices = load_dir(os.path.join(src, "prices"))
    if not products or not prices:
        print(f"ERRO: export vazio em {src}")
        return 1

    out = []
    for pid, p in sorted(products.items(), key=lambda kv: (kv[1].get("order", 99), kv[0])):
        if pid in SKIP:
            continue
        ai_raw = p.get("ai", "")
        ai = ai_raw.split(" (")[0].strip()
        unit = p.get("unit", "tablet")
        offers, not_sold, checked = [], [], []

        for ph_id, ph_name in PHARMACIES.items():
            d = prices.get(f"{pid}__{ph_id}")
            if not d:
                print(f"  [AVISO] sem registro: {pid} @ {ph_id}")
                continue
            if d.get("pending"):
                print(f"  [AVISO] pendente, fica fora: {pid} @ {ph_id}: {d['pending']}")
                continue
            if d.get("checkedAt"):
                checked.append(d["checkedAt"])
            if d.get("notSold"):
                not_sold.append(ph_name)
                continue
            price, qty = d.get("price"), d.get("packQty")
            if not price or not qty:
                # vende, mas sem preço legível (ex.: só "From", sem estoque)
                offers.append({
                    "pharmacy": ph_name, "unitPrice": None, "price": None,
                    "packQty": None, "pack": "", "inStock": d.get("inStock"),
                    "url": d.get("url", ""),
                })
                continue
            offers.append({
                "pharmacy":  ph_name,
                "unitPrice": round(price / qty, 4),
                "price":     round(price, 2),
                "packQty":   qty,
                "pack":      pack_label(d, unit),
                "inStock":   d.get("inStock"),  # None = não informado
                "url":       d.get("url", ""),
            })

        out.append({
            "id":       pid,
            "name":     NAME_OVERRIDE.get(pid, p.get("brand", pid)),
            "strength": p.get("strength", ""),
            "form":     FORM_OVERRIDE.get(pid, p.get("form", "")),
            "unit":     unit,
            "ai":       ai,
            "species":  SPECIES_BY_PRODUCT.get(pid, ["Dogs"]),
            "category": CATEGORY_BY_AI.get(ai, "Other"),
            "checkedAt": min(checked) if checked else None,
            "offers":   offers,
            "notSold":  not_sold,
        })

    doc = {
        "_comment": ("Preços conferidos manualmente (prints/leitura de página) nas 4 "
                     "farmácias. Gerado por scripts/manual_prices_from_db.py a partir de "
                     + ARTIFACT_URL + ". Não editar à mão."),
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "products": out,
    }
    dest = os.path.join(os.path.dirname(__file__), "..", "data", "manual_prices.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    n_off = sum(len(x["offers"]) for x in out)
    print(f"OK: {len(out)} produtos, {n_off} ofertas -> data/manual_prices.json")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
