@echo off
chcp 65001 > nul
title 소망경매장 D455 → 공유수족관
cd /d "%~dp0"
echo ==============================================
echo  소망경매장 D455 → 공유수족관
echo  (처음 한 번은 필요한 프로그램을 설치해요)
echo ==============================================

set PY=
where py > nul 2>&1 && set PY=py -3
if "%PY%"=="" where python > nul 2>&1 && set PY=python
if "%PY%"=="" (
  echo [!] 파이썬이 없어요. https://www.python.org/downloads/ 에서 3.11 버전을 설치하고
  echo     설치 화면에서 "Add python.exe to PATH" 를 꼭 체크한 뒤 다시 실행해 주세요.
  pause
  exit /b 1
)

%PY% -c "import pyrealsense2, cv2, numpy" > nul 2>&1
if errorlevel 1 (
  echo 필요한 패키지를 설치하는 중...
  %PY% -m pip install --upgrade pip
  %PY% -m pip install pyrealsense2 opencv-python numpy
  %PY% -c "import pyrealsense2, cv2, numpy" > nul 2>&1
  if errorlevel 1 (
    echo [!] 설치에 실패했어요. pyrealsense2 는 파이썬 3.8~3.11 에서 가장 잘 설치돼요.
    echo     파이썬 3.11 을 설치한 뒤 다시 실행해 주세요.
    pause
    exit /b 1
  )
)

echo.
echo D455 를 USB 3 포트(파란색)에 꽂았는지 확인해 주세요.
echo 처음 한 번은 사람이 화면 밖으로 나간 뒤 창에서 B 를 눌러 벽을 저장해요.
echo.
%PY% depth_interaction_relaxed.py %*
echo.
echo 프로그램이 끝났어요. 오류가 보이면 이 창을 사진으로 찍어 보내 주세요.
pause
