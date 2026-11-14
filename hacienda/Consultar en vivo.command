#!/bin/zsh
cd "${0:A:h}" || exit 1
exec python3 consulta_en_vivo.py
