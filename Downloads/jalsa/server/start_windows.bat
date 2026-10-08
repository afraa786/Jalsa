@echo off
call .venv\Scripts\activate
python train.py
uvicorn api:app --reload
