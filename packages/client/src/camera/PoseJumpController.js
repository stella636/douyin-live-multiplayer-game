import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
/** High / tight hit zone: only reachable while jumping. Normalized camera coords. */
export const CAMERA_HIT_ZONE = {
    left: 0.38,
    right: 0.62,
    top: 0.02,
    bottom: 0.24
};
export class PoseJumpController {
    constructor(options) {
        this.options = options;
        this.running = false;
        this.calibratedFrames = 0;
        this.jumpDown = false;
        this.lastNoseX = null;
        this.lastNoseY = null;
        this.lastHeadTopX = null;
        this.lastHeadTopY = null;
        this.lastFootCenterX = null;
        this.lastFootBottomY = null;
        this.smoothedGroundY = null;
    }
    async start(video) {
        this.options.onStatusChange?.("正在加载人体姿态识别...");
        const vision = await FilesetResolver.forVisionTasks(WASM_URL);
        this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: MODEL_URL
            },
            runningMode: "VIDEO",
            numPoses: 1
        });
        this.running = true;
        this.options.onStatusChange?.("请站好，再跳起来用头顶碰上方大礼盒");
        this.loop(video);
    }
    stop() {
        this.running = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        this.poseLandmarker?.close();
    }
    loop(video) {
        if (!this.running || !this.poseLandmarker) {
            return;
        }
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            const result = this.poseLandmarker.detectForVideo(video, performance.now());
            const landmarks = result.landmarks[0];
            if (landmarks) {
                const nose = landmarks[0];
                const leftEye = landmarks[2];
                const rightEye = landmarks[5];
                const leftHip = landmarks[23];
                const rightHip = landmarks[24];
                const leftShoulder = landmarks[11];
                const rightShoulder = landmarks[12];
                const leftAnkle = landmarks[27];
                const rightAnkle = landmarks[28];
                const leftHeel = landmarks[29];
                const rightHeel = landmarks[30];
                const leftFootIndex = landmarks[31];
                const rightFootIndex = landmarks[32];
                this.lastNoseX = typeof nose?.x === "number" ? nose.x : null;
                this.lastNoseY = typeof nose?.y === "number" ? nose.y : null;
                const eyeY = average([leftEye?.y, rightEye?.y]);
                const shoulderX = average([leftShoulder?.x, rightShoulder?.x]);
                const baseHeadY = average([this.lastNoseY ?? undefined, eyeY]);
                this.lastHeadTopY =
                    typeof baseHeadY === "number" ? Math.max(0, baseHeadY - 0.07) : null;
                this.lastHeadTopX =
                    typeof this.lastNoseX === "number"
                        ? this.lastNoseX
                        : typeof shoulderX === "number"
                            ? shoulderX
                            : null;
                this.lastFootCenterX = average([
                    leftAnkle?.x,
                    rightAnkle?.x,
                    leftHeel?.x,
                    rightHeel?.x,
                    leftFootIndex?.x,
                    rightFootIndex?.x
                ]) ?? null;
                this.lastFootBottomY = max([
                    leftAnkle?.y,
                    rightAnkle?.y,
                    leftHeel?.y,
                    rightHeel?.y,
                    leftFootIndex?.y,
                    rightFootIndex?.y
                ]) ?? null;
                if (this.lastFootBottomY !== null) {
                    const nextGroundY = Math.min(0.98, this.lastFootBottomY + 0.015);
                    this.smoothedGroundY =
                        this.smoothedGroundY === null ? nextGroundY : this.smoothedGroundY * 0.82 + nextGroundY * 0.18;
                }
                const hipY = average([leftHip?.y, rightHip?.y, leftShoulder?.y, rightShoulder?.y]);
                if (hipY !== undefined) {
                    this.processHipY(hipY);
                }
                else {
                    this.emitState(false, false, 0);
                }
            }
        }
        this.rafId = requestAnimationFrame(() => this.loop(video));
    }
    processHipY(hipY) {
        if (this.baselineHipY === undefined) {
            this.baselineHipY = hipY;
            this.calibratedFrames = 1;
            this.emitState(false, false, 0);
            return;
        }
        const smoothFactor = this.jumpDown ? 0.015 : 0.06;
        this.baselineHipY = this.baselineHipY * (1 - smoothFactor) + hipY * smoothFactor;
        if (this.calibratedFrames < 30) {
            this.calibratedFrames += 1;
        }
        const deltaY = this.baselineHipY - hipY;
        // Require a clearer upward burst — walking into the zone alone is not enough.
        const nextJumpDown = this.calibratedFrames >= 15 && deltaY > 0.06;
        if (nextJumpDown !== this.jumpDown) {
            this.jumpDown = nextJumpDown;
            this.options.onStatusChange?.(nextJumpDown ? "检测到起跳！" : this.calibratedFrames >= 15 ? "站立中，请跳跃顶盒" : "正在校准站姿");
        }
        this.emitState(nextJumpDown, this.calibratedFrames >= 15, deltaY);
    }
    emitState(jumpDown, calibrated, deltaY) {
        const insideZone = this.isHeadInsideHighZone();
        // Must be actively jumping AND head enters the raised hit zone.
        const hitBox = calibrated && jumpDown && insideZone;
        this.options.onStateChange({
            jumpDown,
            calibrated,
            deltaY,
            noseX: this.lastNoseX,
            noseY: this.lastNoseY,
            headTopX: this.lastHeadTopX,
            headTopY: this.lastHeadTopY,
            footCenterX: this.lastFootCenterX,
            footBottomY: this.lastFootBottomY,
            groundY: this.smoothedGroundY,
            hitBox
        });
    }
    isHeadInsideHighZone() {
        if (this.lastHeadTopX === null || this.lastHeadTopY === null) {
            return false;
        }
        const { left, right, top, bottom } = CAMERA_HIT_ZONE;
        const x = this.lastHeadTopX;
        const y = this.lastHeadTopY;
        return x >= left && x <= right && y >= top && y <= bottom;
    }
}
function average(values) {
    const filtered = values.filter((value) => typeof value === "number");
    if (filtered.length === 0) {
        return undefined;
    }
    return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}
function max(values) {
    const filtered = values.filter((value) => typeof value === "number");
    if (filtered.length === 0) {
        return undefined;
    }
    return Math.max(...filtered);
}
