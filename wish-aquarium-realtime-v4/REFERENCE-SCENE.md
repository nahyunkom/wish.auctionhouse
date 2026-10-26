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
