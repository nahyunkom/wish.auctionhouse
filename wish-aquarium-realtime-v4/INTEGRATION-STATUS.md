# 소망생물 연결 상태 — 2026-10-22

## 검증 완료

- 원본 직접 하위 조합 폴더 중 PNG 1장과 video_result.json이 있는 438쌍을 원장과 대조했다. SHA-256, 영상 주소, 원본 분류 및 세부유형이 모두 일치한다.
- 원본 PNG 중복 0, 영상 URL 중복 0, 사용 자산의 불일치 0. 438개 영상 주소 모두 HTTP 200 및 video 형식으로 응답했다.
- PNG와 영상 결과가 모두 없는 조합 폴더 563개는 결과에서 제외했다. 보조 폴더 _upload_temp, 여분, diagonal_converted도 제외했다.
- 7×7 중 42칸에 실제 자산이 있다. 인정 소망의 7칸은 비어 있으며 임의 대체하지 않는다. SOURCE-AUDIT.md에 전체 분포와 미완성 폴더를 기록했다.
- 모든 438개 결과의 선택 도달성, 동일 PNG/영상 렌더링, 서버의 catalogId 검증, 임의 이미지 주입 거부, 오프라인 방류 처리가 통과했다.
- 배포용 68개 묶음에서 PNG 438장을 복원하고 원본 바이트 일치를 검증했다.
- 실제 Edge 브라우저 1180×820 화면에서 진단 6문항 → 세부유형 2단계 → WC-6ee8ade5c4f5 결과 PNG/영상 재생 → 공유수족관 도착을 확인했다.
- 가로 화면 결과의 겹침 및 원형 잘림을 수정했다. 영상 버튼 44px, 저장·방류 버튼 64px을 확인했다.
- 공유 기능이 지원된다고 표시돼도 실제 공유 창이 거절되는 경우 원본 다운로드로 이어지도록 보완했다. 성공·거절·사용자 취소·미지원 경우 및 바이트 보존 검증을 통과했다.

## 운영 배포 완료

- 운영: https://wish-auctionhouse.onrender.com
- GitHub: nahyunkom/wish.auctionhouse, 작업 브랜치 creature-catalog-438.
- 운영 main 기준 커밋 11b6d86140a4977a994c91a62b3313a1668b99bf를 확인했고 Render의 On Commit 자동 배포를 확인했다.
- 브라우저 업로드의 용량 제한을 피하기 위해 Git으로 동일한 68개 묶음을 올렸고 운영 main에 정상 반영했다.
- 원본 파일은 변경하지 않았다. 운영 배포 커밋: 921a571654775063a3dab727f9b719d4f76b2569. Render 배포 ID: dep-dbd0voc9v7es73c33830. Live 상태 확인 완료.

## 검증 범위의 한계

- 실제 iPad Safari와 iOS 사진 앱 저장은 아직 확인하지 않았다. 가로 화면 검증은 데스크톱 Edge에서 수행했다.
- 모든 영상 주소는 응답 여부를 검사했고, 실제 재생은 대표 조합을 브라우저에서 확인했다.

## 운영 검증 결과

- /health: ok=true, catalogCount=438.
- 운영 결과 원장과 검증본 일치. PNG 438개 모두 HTTP 200, image/png 및 원본 파일 크기 일치. 대표 3개 원본 SHA-256 일치.
- 실제 운영 브라우저에서 진단 → WC-6ee8ade5c4f5 결과 PNG 및 영상 재생 → 공유수족관 도착과 생물 수 01을 확인했다.
- 운영 검증 기록: 작업 루트 PRODUCTION-VERIFICATION.json, evidence/production-result.png, evidence/production-aquarium.png.
