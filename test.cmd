@echo off
echo START
set "CMD_TO_RUN=%*"
echo 1
echo %ACTION%| findstr /r "^[0-9][0-9]*$" >nul 2>&1
echo 2
