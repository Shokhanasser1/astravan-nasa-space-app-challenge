/**
 * The camera and MediaPipe Hand Landmarker (Apache-2.0), loaded only when the child presses the hand button.
 * Everything runs on the device: the picture is never drawn, kept or sent — only 21 hand points leave this
 * function, 15 times a second. The WASM comes from our own server (public/mediapipe, copied from npm by
 * scripts/copy-decoders.mjs); the model file (7.8 MB) from Google's model store on first use.
 */
import type { Pt } from './gestures';

const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const EVERY_MS = 66; // ~15 checks a second: enough for a cursor, cheap for the 3D scene

export async function startHands(onHand: (points: Pt[] | null) => void): Promise<() => void> {
  const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
  const fileset = await FilesetResolver.forVisionTasks(new URL('mediapipe', document.baseURI).href);
  const make = (delegate: 'GPU' | 'CPU') =>
    HandLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetPath: MODEL, delegate }, runningMode: 'VIDEO', numHands: 1 });
  const landmarker = await make('GPU').catch(() => make('CPU'));

  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 240 }, audio: false });
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play();

  let alive = true;
  let raf = 0;
  let last = 0;
  const loop = (t: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (t - last < EVERY_MS || video.readyState < 2) return;
    last = t;
    const r = landmarker.detectForVideo(video, t);
    onHand(r.landmarks?.[0] ?? null);
  };
  raf = requestAnimationFrame(loop);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
    landmarker.close();
  };
}
