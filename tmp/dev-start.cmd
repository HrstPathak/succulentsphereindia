@echo off
cd /d "%~dp0.."
npm run dev > .next-dev.log 2> .next-dev-error.log
