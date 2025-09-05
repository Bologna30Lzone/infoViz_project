#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script per convertire un file RDF/XML in un file CSV,
auto-detectando il namespace dal file e chiedendo all'utente i percorsi.
"""

import xml.etree.ElementTree as ET
import csv
import sys


def detect_namespace(root, record_local_name: str) -> str:
    """
    Scorre tutti gli elementi del documento per trovare il primo
    con il localname == record_local_name e restituisce la URI di namespace.
    """
    for elem in root.iter():
        if isinstance(elem.tag, str) and elem.tag.startswith("{"):
            uri, local = elem.tag[1:].split('}')
            if local == record_local_name:
                return uri
    raise ValueError(f"Tag record '{record_local_name}' non trovato nel documento.")


def rdfxml_to_csv(rdf_path: str, csv_path: str):
    # Parsiamo l'albero XML
    tree = ET.parse(rdf_path)
    root = tree.getroot()

    # Local name del record e campi da estrarre (hard-coded per questo dataset)
    record_local = 'colonnine-conta-bici-record'
    fields = [
        'colonnina',
        'totale',
        'direzione_periferia',
        'direzione_centro',
        'geo_point_2d',
        'data'
    ]

    # Auto-detect del namespace in base al record
    namespace_uri = detect_namespace(root, record_local)
    ns = {'ns': namespace_uri}

    # Troviamo tutti gli elementi <ns:colonnine-conta-bici-record>
    records = root.findall(f'.//ns:{record_local}', ns)

    if not records:
        print(f"[WARN] Nessun elemento <{record_local}> trovato nel documento.")
        return

    # Apriamo il CSV in scrittura
    with open(csv_path, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(fields)

        # Iteriamo su ogni record
        for rec in records:
            row = []
            for fld in fields:
                el = rec.find(f'ns:{fld}', ns)
                text = el.text.strip() if (el is not None and el.text) else ''
                row.append(text)
            writer.writerow(row)

    print(f"[OK] Convertito '{rdf_path}' → '{csv_path}' ({len(records)} record totali)")


if __name__ == '__main__':
    try:
        # Prompt per il file di input e output
        rdf_path = input("Inserisci il percorso del file RDF/XML di input: ")
        csv_path = input("Inserisci il percorso del file CSV di output: ")
        rdfxml_to_csv(rdf_path, csv_path)
    except Exception as e:
        print(f"[ERROR] {e}", file=sys.stderr)
        sys.exit(1)
