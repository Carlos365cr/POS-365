#!/bin/zsh
cd "${0:A:h}" || exit 1
cedi_client=$(osascript -e 'POSIX path of (choose file with prompt "Elegí el JSON OAuth de aplicación de escritorio descargado desde Google Cloud")') || exit 1
read 'cedi_from?Fecha inicial (AAAA-MM-DD): '
read 'cedi_to?Fecha final (AAAA-MM-DD): '
cedi_output=$(mktemp -d "$HOME/Downloads/CEDI-XML-XXXXXXXX") || exit 1
python3 gmail_xml.py "$cedi_client" "$cedi_from" "$cedi_to" "$cedi_output" && open "$cedi_output"
