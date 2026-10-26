# Real-time aquarium water

The reference photograph is not included in or used by the scene. Water is a procedural WebGL participating volume with a perspective camera, 28 ray samples, wavelength-dependent extinction, animated surface refraction and cyan light shafts. A bounded adaptive resolution and Canvas fallback support lower-power devices. Context loss and restoration are handled.

38 existing catalog PNG specimens form the exhibition scenery. They are local residents, never submitted as visitor releases or counted by the server. Real Socket.io releases remain a separate list and join the same scene. Source assets are unchanged. Resident sizes and opacity vary with depth; their PNG pixels deform using the existing GPU swimmer renderer. These are animated 2D source specimens within a depth-composed scene, not newly modelled fish meshes.

Only fullscreen is visible. Reduced-motion freezes water, particles and swimmer movement. The scene contains no photograph, settings, extra panels, arrival labels or counters.

Checks: node scripts/verify-environment.cjs; node --check aquarium-environment.js; node --check shared-aquarium.js. Browser visual check verifies actual GPU shader compilation and zero image elements.

## 2026-10-26 오후 · 수중감 보강 (사용자 요청)

- 생물 표시용 셰이더에 수심 블러(먼 생물일수록 흐림, 유리 가까이 지나가는 큰 생물은 초점 밖 블러), 물빛 안개, 화면 전체에 공통으로 흐르는 굴절 일렁임, 위쪽일수록 강한 일렁이는 빛(커스틱)을 더했다. 원본 PNG·해시·카탈로그는 바뀌지 않는다.
- 물 셰이더: 수면 물결과 빛기둥의 흔들림·밝기 깜빡임을 빠르게 하고, 수면 아래에 일렁이는 빛 무늬를 추가했다.
- 생물 앞 전경 캔버스: 방울은 사물이 아니라 물이 실어 올리는 빛으로 그린다. 테두리 원 대신 가산 합성의 부드러운 빛점이고, 빛기둥과 수면 가까이에서만 밝게 빛나며 그늘에서는 거의 보이지 않는다. 돌면서 순간적으로 반짝이고, 지나간 자리에 곧 사라지는 옅은 빛의 실을 남긴다. 몇 개씩 천천히 숨을 내쉬듯 올라오고, 드물게 유리 가까이 큰 보케가 지나간다. 부유 입자도 빛이 닿는 곳에서만 보인다. 이전의 "방울 없음" 기준은 사용자 요청으로 바뀌었다.
- 방류 순간 그 자리에서 방울 무리가 올라온다. 글자·숫자 없이 새 생물이 왔다는 신호다.
- 움직임 줄이기 설정에서는 굴절·방울·입자 움직임을 멈춘다.
- 확인 범위: npm run check 8종 통과, 로컬 Chromium(소프트웨어 GPU) 화면 확인. 실제 전시 PC·프로젝터에서 프레임 속도와 블러 강도는 아직 확인하지 않았다.

## 표현 원칙 (사용자 확정, 2026-10-26)

- 게임 같은 효과가 아니라 미디어아트처럼. 사물을 그리기보다 빛으로 표현하고, 모든 반응은 천천히 흐른다.
- 인터랙션도 같은 결을 따른다: 손을 따라 튀거나 즉시 반응하지 않고, 빛이 천천히 모이고 흩어진다.

## 빛의 존재감 인터랙션 (2026-10-26 수정)

- 손(터치·마우스)을 따라다니는 빛 덩어리·선·빛가루는 쓰지 않는다. 사용자 피드백: "마우스 따라다니게 하지 말 것, 빛 위주로 일렁이게".
- 손이 닿은 자리의 물이 흔들린다: 그 주변 물속의 빛 무늬(커스틱)가 넓고 부드럽게 엮여 밝아지고, 천천히 퍼지는 고리로 일렁인다. 약 1초에 걸쳐 일어나고 약 3초에 걸쳐 잦아든다. 위치도 천천히 옮겨 간다.
- 그 자리 앞의 생물은 굴절 일렁임이 커지고 빛을 조금 더 받는다. 방울은 그 근처에서 더 반짝일 뿐 움직임은 바뀌지 않는다.
- 입력 입구: AquariumEnvironment.feel(x, y, 세기 0~1). 나중에 D455 손 좌표를 같은 함수로 넣으면 된다.
- 움직임 줄이기 설정에서는 꺼진다.

## 세로 투사 (2026-10-26)

- 세로 디스플레이(예: 1080×1920)로 열면 자동으로 세로 구도가 된다. 생물 크기는 짧은 변 기준이라 가로와 같고, 상주 생물은 긴 물기둥 전체에 퍼진다.
- 컴퓨터는 가로로 출력하고 프로젝터만 옆으로 돌려 설치할 때: `/shared-aquarium?rotate=90` 또는 `?rotate=-90`. 화면 전체(물·생물·방울·손 인터랙션·전체화면 버튼)가 90도 돌아가고, 터치/마우스 좌표도 같이 변환된다. 수면이 위로 보이는 쪽을 현장에서 골라 쓴다.
- 수면 빛은 더 느리고 넓은 저대비 결로 조정했다.
