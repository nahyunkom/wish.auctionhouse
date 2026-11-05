"""
소망경매장 D455 → 공유수족관 (완화된 인식 버전)

기존 depth_interaction_SUCCESS_147m.py 는 건드리지 않는 별도 파일입니다.

무엇이 다른가
- 손끝을 못 찾아도 반응합니다. 찾은 만큼 보냅니다.
    1) 손끝(tip)  2) 팔 끝점(end)  3) 팔/몸 윤곽의 대표점(blob)
- 벽 캘리브레이션은 한 번만 합니다. B(또는 R)를 눌렀을 때만 다시 하고,
  키를 꾹 누르고 있어도(키 반복) 한 번만 실행됩니다. 결과는 wall_depth.npy 로 저장돼
  다음 실행 때 그대로 불러옵니다. 인식이 안 된다고 저절로 다시 저장하지 않습니다.
- 관심 영역(ROI)은 화면 전체(가장자리 2%만 제외)입니다.
- 최소 면적·깊이 차이 기준을 낮췄고, 3프레임 중 2프레임 이상 잡히면 인식으로 봅니다.
  잠깐 끊겨도 0.35초 동안은 마지막 위치를 유지합니다.
- 좌표는 프로젝터 화면 기준 0~1 로 바꿔 서버의 /api/depth 로 보냅니다(HTTP, 추가 패키지 없음).

실행
    python depth_interaction_relaxed.py                 # 카메라 사용
    python depth_interaction_relaxed.py --simulate      # 카메라 없이 가짜 팔로 통신 시험
    python depth_interaction_relaxed.py --server http://localhost:3000

키
    B  벽 저장 (사람 없는 상태에서)     R  벽 다시 저장
    M  좌우 반전                        F  상하 반전
    ESC / Q  종료

필요한 것: pip install pyrealsense2 opencv-python numpy
"""
import argparse
import json
import os
import queue
import threading
import time
import urllib.request

import cv2
import numpy as np

# ---------------------------------------------------------------- 설정
SERVER_URL = "https://wish-auctionhouse.onrender.com"
SENSOR_KEY = ""                       # 서버에 SENSOR_KEY 를 설정한 경우에만 같은 값을 넣으세요
WIDTH, HEIGHT, FPS = 848, 480, 30
WALL_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wall_depth.npy")
CALIBRATION_FRAMES = 45               # 벽 저장 때 모으는 프레임 수 (약 1.5초)

NEAR_MM = 45          # 벽보다 이만큼(mm) 이상 앞에 있어야 사람/팔로 봄 (기존보다 완화)
FAR_MM = 1500         # 벽보다 이만큼보다 더 앞이면 잡음으로 봄 (카메라 바로 앞 물체 제외)
MIN_AREA = 180        # 윤곽 최소 면적(px) (기존보다 완화)
ROI_MARGIN = 0.02     # 가장자리 제외 비율
STABLE_NEED = 2       # 최근 3프레임 중 이만큼 잡혀야 인식
HOLD_SECONDS = 0.35   # 잠깐 끊겨도 마지막 위치 유지 시간
SEND_HZ = 25

# 카메라 화면에서 프로젝터 화면의 네 모서리 (0~1, 왼쪽위·오른쪽위·오른쪽아래·왼쪽아래).
# 기본값은 카메라 화면 전체 = 프로젝터 화면 전체. 현장에서 맞추세요.
SCREEN_CORNERS = [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)]
MIRROR = False
FLIP_Y = False


# ---------------------------------------------------------------- 보내기 (최신 값만, 백그라운드)
class Sender:
    def __init__(self, server, key):
        self.url = server.rstrip("/") + "/api/depth"
        self.key = key
        self.box = queue.Queue(maxsize=1)
        self.ok = self.fail = 0
        self.last_error = ""
        threading.Thread(target=self._run, daemon=True).start()

    def push(self, points):
        body = {"points": points}
        if self.key:
            body["key"] = self.key
        try:
            self.box.get_nowait()
        except queue.Empty:
            pass
        self.box.put_nowait(body)

    def _run(self):
        gap = 1.0 / SEND_HZ
        while True:
            body = self.box.get()
            started = time.time()
            try:
                req = urllib.request.Request(self.url, data=json.dumps(body).encode("utf-8"),
                                             headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=2) as r:
                    answer = json.loads(r.read().decode("utf-8") or "{}")
                if answer.get("ok"):
                    self.ok += 1
                else:
                    self.fail += 1
                    self.last_error = "서버가 거절함 (키 또는 전송 빈도 확인)"
            except Exception as error:  # noqa: BLE001
                self.fail += 1
                self.last_error = str(error)[:80]
            time.sleep(max(0.0, gap - (time.time() - started)))


# ---------------------------------------------------------------- 카메라
class Camera:
    def __init__(self):
        import pyrealsense2 as rs
        self.rs = rs
        self.pipe = rs.pipeline()
        cfg = rs.config()
        cfg.enable_stream(rs.stream.depth, WIDTH, HEIGHT, rs.format.z16, FPS)
        profile = self.pipe.start(cfg)
        dev = profile.get_device().first_depth_sensor()
        if dev.supports(rs.option.emitter_enabled):
            dev.set_option(rs.option.emitter_enabled, 1)
        self.scale_mm = dev.get_depth_scale() * 1000.0
        self.spatial = rs.spatial_filter()
        self.temporal = rs.temporal_filter()
        self.hole = rs.hole_filling_filter()

    def depth_mm(self):
        frames = self.pipe.wait_for_frames(5000)
        d = frames.get_depth_frame()
        if not d:
            return None
        d = self.spatial.process(d)
        d = self.temporal.process(d)
        d = self.hole.process(d)
        return np.asanyarray(d.get_data()).astype(np.float32) * self.scale_mm

    def stop(self):
        self.pipe.stop()


class FakeCamera:
    """카메라 없이 시험: 1.47m 벽 앞에서 사람이 팔을 좌우로 휘젓는 깊이 영상."""
    def __init__(self):
        self.t0 = time.time()

    def depth_mm(self):
        t = time.time() - self.t0
        d = np.full((HEIGHT, WIDTH), 1470.0, np.float32) + np.random.normal(0, 6, (HEIGHT, WIDTH)).astype(np.float32)
        time.sleep(1.0 / FPS)
        if t < 2.0:                       # 처음 2초는 사람 없음 (벽 저장용)
            return d
        cx = int(WIDTH * (0.5 + 0.25 * np.sin(t * 0.8)))
        cv2.ellipse(d, (cx, HEIGHT - 60), (70, 160), 0, 0, 360, 900.0, -1)     # 몸
        ang = np.sin(t * 1.6) * 0.9
        ex, ey = int(cx + np.cos(ang) * 230), int(HEIGHT - 200 - np.sin(ang) * 120)
        cv2.line(d, (cx, HEIGHT - 190), (ex, ey), 1000.0, 26)                    # 팔
        if int(t * 2) % 5 == 0:          # 가끔 인식이 끊기는 상황
            d[:, :] = 1470.0
        return d

    def stop(self):
        pass


# ---------------------------------------------------------------- 분석
def screen_mapper():
    src = np.float32([[x * WIDTH, y * HEIGHT] for x, y in SCREEN_CORNERS])
    dst = np.float32([[0, 0], [1, 0], [1, 1], [0, 1]])
    return cv2.getPerspectiveTransform(src, dst)


def to_screen(m, x, y, mirror, flip_y):
    p = cv2.perspectiveTransform(np.float32([[[x, y]]]), m)[0][0]
    sx, sy = float(p[0]), float(p[1])
    if mirror:
        sx = 1 - sx
    if flip_y:
        sy = 1 - sy
    return sx, sy


def detect(depth, wall):
    """벽보다 앞에 있는 부분에서 손끝 → 팔 끝점 → 윤곽 대표점 순서로 찾은 만큼 돌려준다."""
    valid = (depth > 0) & (wall > 0)
    diff = wall - depth
    mask = (valid & (diff > NEAR_MM) & (diff < FAR_MM)).astype(np.uint8) * 255
    mx, my = int(WIDTH * ROI_MARGIN), int(HEIGHT * ROI_MARGIN)
    mask[:my, :] = 0; mask[-my:, :] = 0; mask[:, :mx] = 0; mask[:, -mx:] = 0
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    found = []
    dist = None
    for c in sorted(contours, key=cv2.contourArea, reverse=True)[:3]:
        area = cv2.contourArea(c)
        if area < MIN_AREA:
            continue
        m = cv2.moments(c)
        if not m["m00"]:
            continue
        cx, cy = m["m10"] / m["m00"], m["m01"] / m["m00"]
        pts = c[:, 0, :].astype(np.float32)
        far = np.hypot(pts[:, 0] - cx, pts[:, 1] - cy)
        i = int(np.argmax(far))
        ex, ey = float(pts[i, 0]), float(pts[i, 1])
        (_, _), (w, h), _ = cv2.minAreaRect(c)
        elongated = max(w, h) / max(1.0, min(w, h)) > 1.5 or far[i] > 2.2 * np.sqrt(area / np.pi)
        strength = float(min(1.0, 0.4 + area / 20000.0))
        if elongated:
            if dist is None:
                dist = cv2.distanceTransform(mask, cv2.DIST_L2, 3)
            # 끝점에서 조금 안쪽의 두께가 얇으면 손끝으로 본다.
            ix = int(np.clip(ex + (cx - ex) * 0.08, 0, WIDTH - 1)); iy = int(np.clip(ey + (cy - ey) * 0.08, 0, HEIGHT - 1))
            kind = "tip" if dist[iy, ix] <= 14 else "end"
            found.append({"x": ex, "y": ey, "k": kind, "s": strength})
        found.append({"x": cx, "y": cy, "k": "blob", "s": strength * 0.8})
    return found, mask


# ---------------------------------------------------------------- 메인
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", default=SERVER_URL)
    ap.add_argument("--key", default=SENSOR_KEY)
    ap.add_argument("--simulate", action="store_true", help="카메라 없이 가짜 팔로 시험")
    ap.add_argument("--no-window", action="store_true")
    ap.add_argument("--seconds", type=float, default=0, help="시험용: 이 시간 뒤 종료")
    args = ap.parse_args()

    cam = FakeCamera() if args.simulate else Camera()
    sender = Sender(args.server, args.key)
    mapper = screen_mapper()
    mirror, flip_y = MIRROR, FLIP_Y

    wall = np.load(WALL_FILE) if os.path.exists(WALL_FILE) and not args.simulate else None
    calibrating, samples = False, []
    last_key_at = {}
    history = []
    last_points, last_seen = [], 0.0
    last_log = time.time()
    started = time.time()

    print("=" * 46)
    print(" 소망경매장 D455 · 완화된 인식 모드")
    print(" 서버:", args.server)
    print(" 벽:", "저장된 벽을 불러왔어요" if wall is not None else "아직 없음 → 사람 없이 B")
    print(" B 벽 저장 / R 다시 저장 / M 좌우 반전 / F 상하 반전 / ESC 종료")
    print("=" * 46)
    if args.simulate:
        calibrating, samples = True, []   # 시험 모드: 첫 2초 동안 자동으로 한 번만 벽 저장
        print("시험 모드: 첫 2초 동안 벽을 한 번 저장해요.")

    try:
        while True:
            depth = cam.depth_mm()
            if depth is None:
                continue
            now = time.time()

            # 벽 저장: 시작될 때 한 번 알리고, 끝날 때 한 번 알린다.
            if calibrating:
                samples.append(depth)
                if len(samples) >= CALIBRATION_FRAMES:
                    stack = np.stack(samples)
                    stack[stack <= 0] = np.nan
                    wall = np.nan_to_num(np.nanmedian(stack, axis=0), nan=0.0).astype(np.float32)
                    if not args.simulate:
                        np.save(WALL_FILE, wall)
                    calibrating, samples = False, []
                    print("벽 저장 완료. 이제 팔을 뻗어 보세요.")

            points, mask = [], None
            if wall is not None and not calibrating:
                points, mask = detect(depth, wall)

            # 최근 3프레임 중 2프레임 이상 잡혀야 인식. 잠깐 끊기면 마지막 위치 유지.
            history = (history + [bool(points)])[-3:]
            if points and sum(history) >= STABLE_NEED:
                last_points, last_seen = points, now
            out = last_points if now - last_seen <= HOLD_SECONDS else []
            if out:
                fade = 1.0 if points else max(0.3, 1 - (now - last_seen) / HOLD_SECONDS)
                payload = []
                for p in out[:4]:
                    sx, sy = to_screen(mapper, p["x"], p["y"], mirror, flip_y)
                    payload.append({"x": round(sx, 4), "y": round(sy, 4), "k": p["k"], "s": round(p["s"] * fade, 3)})
                sender.push(payload)

            if now - last_log > 5:
                state = "벽 없음(B)" if wall is None else ("인식 중" if out else "대기")
                print(f"[{time.strftime('%H:%M:%S')}] {state} · 보냄 {sender.ok} · 실패 {sender.fail}" + (f" · {sender.last_error}" if sender.fail else ""))
                last_log = now

            if not args.no_window:
                view = cv2.applyColorMap(cv2.convertScaleAbs(depth, alpha=255.0 / 3000.0), cv2.COLORMAP_OCEAN)
                if mask is not None:
                    view[mask > 0] = (0.4 * view[mask > 0] + 0.6 * np.array([200, 120, 255])).astype(np.uint8)
                mx, my = int(WIDTH * ROI_MARGIN), int(HEIGHT * ROI_MARGIN)
                cv2.rectangle(view, (mx, my), (WIDTH - mx, HEIGHT - my), (255, 160, 60), 1)
                colors = {"tip": (200, 120, 255), "end": (120, 220, 255), "blob": (255, 220, 140)}
                for p in out:
                    cv2.circle(view, (int(p["x"]), int(p["y"])), 9, colors[p["k"]], 2)
                    cv2.putText(view, p["k"], (int(p["x"]) + 10, int(p["y"])), cv2.FONT_HERSHEY_SIMPLEX, .5, colors[p["k"]], 1)
                label = "CALIBRATING..." if calibrating else ("NO WALL - press B" if wall is None else f"sent {sender.ok}  fail {sender.fail}")
                cv2.putText(view, label, (12, 24), cv2.FONT_HERSHEY_SIMPLEX, .6, (255, 255, 255), 1)
                cv2.imshow("Wish Aquarium D455 (relaxed)", view)
                key = cv2.waitKey(1) & 0xFF
                if key != 255:
                    # 키를 꾹 눌러 생기는 반복 입력은 무시 (1.5초 안 같은 키 한 번만)
                    if now - last_key_at.get(key, 0) < 1.5:
                        key = 255
                    else:
                        last_key_at[key] = now
                if key in (27, ord("q")):
                    break
                if key in (ord("b"), ord("B"), ord("r"), ord("R")) and not calibrating:
                    calibrating, samples = True, []
                    print("벽 계산 중... (사람이 화면 밖에 있어야 해요)")
                if key in (ord("m"), ord("M")):
                    mirror = not mirror; print("좌우 반전:", mirror)
                if key in (ord("f"), ord("F")):
                    flip_y = not flip_y; print("상하 반전:", flip_y)

            if args.seconds and now - started > args.seconds:
                break
    finally:
        cam.stop()
        cv2.destroyAllWindows()
        print(f"종료 · 보냄 {sender.ok} · 실패 {sender.fail}")


if __name__ == "__main__":
    main()
