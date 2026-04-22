@echo off
echo =====================================
echo  WohnungsScout – Start
echo =====================================
SET PYTHON=C:\Users\Andreas Q-Service\AppData\Local\Programs\Python\Python312\python.exe
echo.
echo [Starte Server...]
echo Dashboard: http://localhost:8000
echo Druecke Ctrl+C zum Beenden
echo.
"%PYTHON%" main.py
pause
