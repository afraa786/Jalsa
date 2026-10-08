#!/usr/bin/env bash
set -e
source .venv/bin/activate
python train.py
uvicorn api:app --reload
