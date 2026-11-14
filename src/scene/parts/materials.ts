/**
 * Shared materials (developer guide §10 colour table). One material object per look, reused by every part, so the
 * renderer switches programs as little as possible. Glowing parts are unlit `MeshBasicMaterial`s with colour > 1 and
 * `toneMapped: false`: only they pass Bloom (threshold 1).
 */
import * as THREE from 'three';

const std = (color: string, roughness: number, metalness: number) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** A colour brighter than white, so it crosses the Bloom threshold. */
export const glowColor = (hex: string, k: number) => new THREE.Color(hex).multiplyScalar(k);

const glow = (hex: string, k: number) => new THREE.MeshBasicMaterial({ color: glowColor(hex, k), toneMapped: false });
const flat = (hex: string) => new THREE.MeshBasicMaterial({ color: hex, toneMapped: false });

export const MAT = {
  panel: std('#e9ecf2', 0.55, 0.05), // white panel: buildings, Scout, poles
  gold: std('#c9972b', 0.38, 0.85), // gold foil: lander base, roofs
  glass: std('#141a33', 0.3, 0.4), // black glass: doors, windows, wheels, solar panels
  regolith: std('#8a7a5c', 1, 0), // soil wall rings
  dome: new THREE.MeshStandardMaterial({
    color: '#dfe8f5',
    roughness: 0.15,
    metalness: 0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  }),
  wire: new THREE.MeshBasicMaterial({ color: '#6a7390', wireframe: true, transparent: true, opacity: 0.55 }),
};

export const GLOW = {
  window: glow('#ffd98a', 3.2), // lit habitat windows
  cableOn: glow('#f0b43c', 2.2), // powered cable, hub battery light
  cableOff: flat('#3a3f55'), // unpowered cable, placed battery
  grow: glow('#ff6fd8', 2.4), // garden grow light
  eye: glow('#8fe3ff', 2.6), // Scout's eye
  marker: glow('#9fe0ff', 1.4), // standing-point markers (soft, just above the Bloom threshold)
  dark: flat('#1c2133'), // unlit lamp
};
