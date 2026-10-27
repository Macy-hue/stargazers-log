@echo off
chcp 65001 >nul
setlocal
title 拾光拼贴 MOMENTO
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py serve.py --open
  goto :end
)
where python >nul 2>nul
if %errorlevel%==0 (
  python serve.py --open
  goto :end
)
echo.
echo  需要 Python 3 才能启动本地预览。
echo  也可以把整个文件夹拖到任意静态网站托管服务上。
echo  https://python.org/downloads
echo.
pause
:end
endlocal
