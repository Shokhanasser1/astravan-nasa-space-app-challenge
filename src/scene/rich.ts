import { initialTier } from './quality';

/**
 * The richer base (ASTRA's procedural models, src/scene/AstraProps.tsx) on computers with a real graphics card
 * only: they cost ~150 meshes and ~100k triangles, past the phone budget (< 100k triangles, ~50 draw calls), and a
 * computer that draws in software (SwiftShader, llvmpipe: no GPU, also the e2e and shot.sh browsers) slows down.
 * Phones and those keep the light shapes. `?rich` forces it on (try it on a phone), `?lite` forces it off.
 */
function softwareGl(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return true;
  }
}

const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const rich: boolean =
  q.has('rich') || (!q.has('lite') && typeof window !== 'undefined' && initialTier() === 'pc' && !softwareGl());
