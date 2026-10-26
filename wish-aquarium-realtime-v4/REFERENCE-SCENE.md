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

## 빛의 존재감 인터랙션 (2026-10-26 확장)

원칙: 손을 따라다니는 빛 덩어리나 선은 쓰지 않는다. 손은 물을 건드리고, 반응은 빛으로 천천히 일어난다.

1. 물빛: 손이 닿은 자리의 물속 빛 무늬(커스틱)가 밝고 선명하게 엮인다. 약 1초에 걸쳐 일어나 약 3초에 걸쳐 잦아든다.
2. 빛의 고리: 손을 대는 순간, 그리고 움직이는 동안 약 220px마다 빛의 고리가 물결무늬를 따라 천천히 퍼져 나가 4초 뒤 사라진다(동시에 최대 6개).
3. 빛 플랑크톤: 물속에 희미하게 떠 있던 90개의 빛 입자가 손 주변(약 400px 안)에서 천천히 모여들어 손을 맴돌고, 손을 떼면 제자리로 흩어진다.
4. 생물: 일렁이는 빛이나 고리가 닿은 생물은 몸 안에서 빛이 차오르듯 천천히 밝아지고, 물빛 안개에서 벗어나 또렷해지고, 조금 빨라지며 손에서 살짝 비켜 간다. 군집 무리는 흩어졌다가 다시 모인다. 모두 몇 초에 걸쳐 가라앉는다.

입력 입구: AquariumEnvironment.feel(x, y, 세기 0~1, 처음 닿음 여부). 나중에 D455 손 좌표를 같은 함수로 넣으면 된다. 움직임 줄이기 설정에서는 모두 꺼진다.

## 세로 투사 (2026-10-26)

- 세로 디스플레이(예: 1080×1920)로 열면 자동으로 세로 구도가 된다. 생물 크기는 짧은 변 기준이라 가로와 같고, 상주 생물은 긴 물기둥 전체에 퍼진다.
- 컴퓨터는 가로로 출력하고 프로젝터만 옆으로 돌려 설치할 때: `/shared-aquarium?rotate=90` 또는 `?rotate=-90`. 화면 전체(물·생물·방울·손 인터랙션·전체화면 버튼)가 90도 돌아가고, 터치/마우스 좌표도 같이 변환된다. 수면이 위로 보이는 쪽을 현장에서 골라 쓴다.
- 수면 빛은 더 느리고 넓은 저대비 결로 조정했다.

## 군집 생물과 유영 (2026-10-26)

- 소망 세부유형이 '소속 군체형'인 생물은 같은 원본 PNG를 작게 여러 번(7~11마리) 그려 물고기 떼처럼 함께 헤엄친다. 각 개체는 무리 안 자기 자리를 부드러운 탄성으로 따라가서, 방향이 바뀔 때 물결처럼 번지고 무리 전체가 천천히 조였다 풀린다. 원본 파일은 바뀌지 않는다.
- 관객이 소속 군체형 생물을 방류해도 무리로 들어온다.
- 상주 생물에 소속 군체형 2종(WC-979b35e1c2a7, WC-e5f58f89958c)을 추가해 40종이 되었다. 기존 WC-a24e50a2dece도 무리로 헤엄친다. 빈 PNG(WC-dbd94f7b5b95)는 쓰지 않는다.
- 모든 생물은 속도가 느리게 오르내리고, 위아래로 천천히 떠돌며, 오르내림에 따라 몸이 살짝 기운다.

## 대형 수조 느낌 (2026-10-26 밤, 사용자 참고 사진 기준)

- 가운데 빛기둥을 더 넓고 밝게 하고, 가장자리가 물결처럼 일렁이며 흰 심이 생기게 했다.
- 기포 커튼: 바닥에서 빛기둥을 따라 작은 기포들이 촘촘히(화면 크기에 비례, 최대 초당 약 260개) 빠르게 솟구치며 반짝인다. 가운데일수록 밝고, 위로 갈수록 기둥이 좁아지며 흔들린다.
- 빛기둥 아래 바닥이 빛을 받아 커스틱 무늬로 밝게 일렁인다.
- 물 전체에 옅은 세로 빛줄기가 천천히 흐른다.

## 방류된 생물의 탄생 (2026-10-26 밤 수정)

사용자 피드백: 나선·번쩍임 같은 애니메이션은 별로, 미디어아트처럼 물결과 입자를 통해 천천히 아름답게 등장.
약 11초, 생물 PNG가 준비된 순간부터:
- 태어날 자리의 물이 크고 느린 물결 두 번(0초, 2.6초)으로 부드럽게 일렁인다.
- 작은 빛 입자들이 주로 아래와 옆에서 물살을 타고 천천히 떠올라, 생물 원본 PNG에서 읽은 형체 주변에 느슨하게 모인다. 윤곽에 딱 붙지 않고 형체를 암시만 한다.
- 생물은 처음엔 물 너머로 흐릿하게 일렁이는 형체로 비치다가 약 6초에 걸쳐 서서히 또렷해진다. 번쩍임 없음.
- 6.5초부터 빛 입자는 위로 흘러가며 사라지고, 7초부터 생물이 4초에 걸쳐 아주 천천히 헤엄치기 시작한다.
- 움직임 줄이기 설정에서는 입자 없이 서서히 나타나기만 한다.
