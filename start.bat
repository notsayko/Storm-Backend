@echo off
title thanks for using storm backend by notsayko and metixw

bun install >nul 2>&1
if errorlevel 1 exit /b 1

bun run src/index.ts
