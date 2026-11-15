/**
 * The robot arm's hand scanner: the camera and MediaPipe hand + pose (Apache-2.0), loaded only when the player turns
 * the scanner on (a separate chunk; the first download stays small). Everything runs on the device: the picture is
 * never kept or sent anywhere. The scanner panel shows it live (only there, with the hand sharp and the rest blurred,
 * so a face is not shown). The WASM comes from our own server (public/mediapipe, copied from npm by
 * scripts/copy-decoders.mjs); the two model files (hand ~7.8 MB, pose lite ~5.6 MB) from Google's model store on
 * first use, then from the browser cache.
 */
import type { Pt } from './reach';

const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const POSE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const EVERY_MS = 66; // ~15 checks a second

export interface ScanFrame {
  pose: Pt[] | null;
  hand: Pt[] | null;
  aspect: number;
  video: HTMLVideoElement;
}
export type ScanStatus = 'camera' | 'models' | 'running';

/** Start the camera and both trackers; resolves to stop(). */
export async function startScan(onFrame: (f: ScanFrame) => void, onStatus: (s: ScanStatus) => void = () => {}): Promise<() => void> {
  onStatus('camera');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  });
  const stopTracks = () => {
    for (const track of stream.getTracks()) track.stop();
  };
  let hands: import('@mediapipe/tasks-vision').HandLandmarker;
  let pose: import('@mediapipe/tasks-vision').PoseLandmarker;
  try {
    onStatus('models');
    const { FilesetResolver, HandLandmarker, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(new URL('mediapipe', document.baseURI).href);
    const handOf = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: HAND_MODEL, delegate }, runningMode: 'VIDEO', numHands: 1 });
    const poseOf = (delegate: 'GPU' | 'CPU') =>
      PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: POSE_MODEL, delegate }, runningMode: 'VIDEO', numPoses: 1 });
    [hands, pose] = await Promise.all([handOf('GPU').catch(() => handOf('CPU')), poseOf('GPU').catch(() => poseOf('CPU'))]);
  } catch (e) {
    stopTracks();
    throw e;
  }

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();
  onStatus('running');

  let alive = true;
  let raf = 0;
  let last = 0;
  const loop = (t: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (t - last < EVERY_MS || video.readyState < 2) return;
    last = t;
    const p = pose.detectForVideo(video, t);
    const h = hands.detectForVideo(video, t);
    onFrame({
      pose: (p.landmarks?.[0] as Pt[] | undefined) ?? null,
      hand: (h.landmarks?.[0] as Pt[] | undefined) ?? null,
      aspect: video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 4 / 3,
      video,
    });
  };
  raf = requestAnimationFrame(loop);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    stopTracks();
    video.srcObject = null;
    hands.close();
    pose.close();
  };
}
