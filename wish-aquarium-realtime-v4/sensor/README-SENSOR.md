# D455 손 인식 → 공유수족관 (2026-11-05)

## 흐름

```
D455 → depth_interaction_relaxed.py → POST /api/depth (서버) → 'aquarium:touch' (Socket.io) → 공유수족관 화면 → 물빛 일렁임 · 생물 반응
```

- 좌표는 **프로젝터 화면 기준 0~1** (x 오른쪽, y 아래)로 보냅니다. 수족관 화면이 캡슐·회전(rotate=270)이어도 화면 쪽에서 알아서 바꿉니다.
- 보내는 형식: `{"points":[{"x":0.42,"y":0.61,"k":"tip|end|blob","s":0.8}]}`
  - `tip` 손끝, `end` 팔 끝점, `blob` 윤곽 대표점. 손끝을 못 찾아도 찾은 만큼 보내면 반응합니다.
- 화면은 받은 위치를 부드럽게 따라가며(흔들리는 인식도 매끄럽게), 움직임이 클수록 세게, 작아도 최소한으로 반응합니다. 처음 닿을 때와 크게 휘저을 때만 빛의 고리가 생깁니다.

## 대여 컴퓨터에서 바로 실행

1. 대여 컴퓨터 크롬에서 `https://wish-auctionhouse.onrender.com/assets/d455-wish-aquarium.zip` 를 받아 압축을 풀어요.
2. D455를 USB 3(파란색) 포트에 꽂고 `start-d455.bat` 를 더블클릭해요. 처음 한 번은 필요한 패키지를 설치해요.
3. 사람 없이 **B** → "벽 저장 완료" → 팔을 뻗으면 수족관 물결이 따라와요.

## 파이썬 (새 파일, 기존 성공 파일은 그대로)

```
pip install pyrealsense2 opencv-python numpy
python depth_interaction_relaxed.py
```

- 처음 한 번: 사람 없이 **B** → "벽 저장 완료"가 **한 번만** 나옵니다. `wall_depth.npy`에 저장돼 다음 실행부터 자동으로 불러옵니다. 다시 저장은 **R**.
  - 예전에 저장 메시지가 반복된 것은 키를 누르고 있는 동안 생기는 키 반복 입력으로 보입니다. 이 버전은 같은 키를 1.5초 안에 한 번만 받고, 저장 중에는 다시 시작하지 않으며, 인식이 안 된다고 저절로 다시 저장하지 않습니다.
- 인식 조건(파일 위쪽 설정): 벽보다 45mm 이상 앞(`NEAR_MM`), 최소 면적 180px(`MIN_AREA`), 화면 전체(가장자리 2%만 제외), 3프레임 중 2프레임, 끊겨도 0.35초 유지.
- **SCREEN_CORNERS**: 카메라 화면에서 프로젝터 화면 네 모서리 위치(0~1). 기본은 카메라 전체 = 프로젝터 전체. 손 위치와 물결 위치가 어긋나면 이 값을 맞추세요. 좌우·상하가 반대면 **M** / **F**.
- 카메라 없이 통신만 시험: `python depth_interaction_relaxed.py --simulate`

## 카메라 없이 웹 확인

- 수족관에서 마우스를 D455처럼: `.../shared-aquarium?shape=capsule&rotate=270&sensorTest=1`
  (마우스 → 서버 → 화면으로 한 바퀴 돌아오는 같은 경로)
- 다른 기기(폰·노트북)에서 D455처럼 보내기: `https://wish-auctionhouse.onrender.com/sensor-test.html`
- 받은 점을 화면에 작은 점으로 보기(현장 맞춤용): 주소 끝에 `&sensorDebug=1`
- 서버가 신호를 받고 있는지: `https://wish-auctionhouse.onrender.com/api/depth/status`
- 화면 쪽에서 반전이 필요하면: `&sensorMirror=1`, `&sensorFlipY=1`

## 보안 (선택)

Render 환경변수에 `SENSOR_KEY`를 넣으면 같은 키를 보낸 신호만 받습니다(파이썬 `SENSOR_KEY`, 테스트 페이지 '키' 칸).
