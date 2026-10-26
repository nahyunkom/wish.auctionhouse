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

## 빛의 존재감 인터랙션

- 공유수족관 화면에 손(터치·마우스)이 닿으면, 수면의 빛이 그 자리로 기울어 내려오고 부드러운 빛이 모인다. 위치는 천천히 따라오며(약 0.7초 지연), 밝기도 서서히 오르고 내린다.
- 지나간 자리에는 4~5초 동안 빛의 리본(넓고 흐린 빛 + 가는 밝은 심)이 남아 넓어지며 사라지고, 움직인 만큼 빛가루가 떨어져 반짝이며 수면의 빛기둥 쪽으로 천천히 돌아간다.
- 손의 빛이 지나가는 근처 생물은 안개에서 조금 벗어나 실제로 빛을 받아 밝아진다.
- 가까운 방울은 밀려나지 않고 빛 주위를 느리게 돈다. 손을 떼면 1~2초에 걸쳐 빛이 흩어진다.
- 입력 입구: AquariumEnvironment.feel(x, y, 세기 0~1). 지금은 터치·포인터가 쓰고, 나중에 D455 손 좌표를 같은 함수로 넣으면 된다.
- 움직임 줄이기 설정에서는 표시하지 않는다.
