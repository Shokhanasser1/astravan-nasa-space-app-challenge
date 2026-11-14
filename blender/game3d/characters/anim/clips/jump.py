"""Standing Moon jump in place (speed 0): JumpStart, JumpAir, JumpLand and the combined Jump.
Design and physics notes: clips/_jump_core.py."""
import _jump_core as J


def jump_start(t):
    return J.start_pose(t)


def jump_air(t):
    return J.air_pose(t)


def jump_land(t):
    return J.land_pose(t)


def jump(t):
    return J.combined_pose(t)


CLIPS = [
    dict(name='JumpStart', fn=jump_start, frames=J.START_FRAMES, loop=False, speed=0.0,
         sheet=[0, 8, 13, 16, 20, 23, 25],
         meta={'note': 'idle -> lunar crouch (bottom f16) -> push -> take-off on the toe tips, hips +1.2 m/s at '
                       'the last frame; scrub by wind-up progress',
               'takeoff_v': J.V_TO, 'crouch_bottom_frame': J.START_BOTTOM_FRAME}),
    dict(name='JumpAir', fn=jump_air, frames=J.AIR_FRAMES, loop=False, speed=0.0,
         sheet=[0, 6, 14, 22, 30, 38, 45],
         meta={'note': 'flight pose, scrub by flight progress u (0 take-off, 0.5 apex, 1 touch-down); no vertical '
                       'root motion, boots reach z=0 on the last frame'}),
    dict(name='JumpLand', fn=jump_land, frames=J.LAND_FRAMES, loop=False, speed=0.0,
         sheet=[0, 3, 7, 11, 15, 22],
         meta={'note': 'touch-down (hips arrive at -1.24 m/s) -> absorb (bottom f7) -> idle_params(0.0)'}),
    dict(name='Jump', fn=jump, frames=J.COMBINED_FRAMES, loop=False, speed=0.0,
         sheet=[0, 16, 25, 36, 47, 59, 71, 78, 94],
         meta={'note': 'JumpStart + flight on the real parabola (apex f47) + JumpLand in one clip'}),
]
