"""Build game3d/manifest.json from the build/verify stats (game3d/assets/_work) and facts/nasa_facts.json.
Run with plain python3:  python3 game3d/assets/_build/make_manifest.py
"""
import json, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(HERE)
GAME = os.path.dirname(ASSETS)
ROOT = os.path.dirname(GAME)
WORK = os.path.join(ASSETS, '_work')

CREDIT = 'NASA 3D Resources / NASA Science (NASA/JPL-Caltech). Not endorsed by NASA.'
NASA3D = 'https://science.nasa.gov/3d-resources/'

# id: (station, role, real-size note, source URL, mass_kg, mass_status, mass_note, extra credit / notes)
INFO = {
    'hdu-1': ('oy', 'Moon habitat shell (the caravanserai). Place hdu-1 and hdu-2 at the SAME transform.',
              'HDU pressure shell inner diameter 5.0 m, shell height 3.3 m; model scaled by the 5.0 m diameter.',
              'https://www.nasa.gov/pdf/468441main_HDU_FactSheet_508.pdf', None, None,
              'Mass not in the NASA fact sheet (~12 t is unverified).',
              'Shares one origin with hdu-2 (NASA frame: deck base at y=0, shell axis at x=z=0). Airlock end faces +Z.'),
    'hdu-2': ('oy', 'Habitat deck/cradle, porch ramp and stairs (second part of the same NASA model).',
              'Same unit system as hdu-1 (5.0 m shell diameter). Real cradle is 4.2 m square; the model deck is larger.',
              'https://science.nasa.gov/3d-resources/habitat-demonstration-unit/', None, None,
              'Unknown.', 'Shares one origin with hdu-1. 8 dark radial fins (not on the real habitat) removed.'),
    'sev': ('oy', 'Space Exploration Vehicle: drivable storm shelter (real NASA idea: ~72 h SPE shelter).',
            'LER/SEV length 4.48 m, height 3.05 m, 12 wheels 0.99 m. Model scale 0.76.',
            'https://www.nasa.gov/wp-content/uploads/2015/08/464826main_sev_factsheet_508.pdf', 2994, 'confirmed', '', ''),
    'rassor': ('oy', 'RASSOR digging robot: scout / regolith and ice digger.',
               'RASSOR 2.0; overall size not confirmed by NASA (model is already in metres).',
               'https://ntrs.nasa.gov/citations/20210011366', 66, 'confirmed', 'RASSOR 2.0', ''),
    'solar-wing': ('oy', 'Solar panel pair (power). Mount on a mast in-engine.',
                   'Generic NASA Ames Satellite Kit wing, not a real spacecraft part; scaled x50 to a 4.5 x 4.95 m pair.',
                   'https://science.nasa.gov/3d-resources/satellite-kit/', None, None, 'Generic part.',
                   'Lies flat, cells face +Y. Rotate -90 deg about X to stand it up facing +Z.'),
    'crew-lock-bag': ('oy', "Water-wall 'brick' (soft bag filled with water); also ISS EVA tool bag.",
                      'NASA publishes no size for the CLB; inches assumed (0.36 x 0.39 x 0.14 m). Water-wall studies used CTBs: 42.5 x 50.2 x 23.5 cm.',
                      'https://science.nasa.gov/3d-resources/crew-lock-bag/', None, None,
                      'Unknown. For a water brick use water volume x 1000 kg/m3 (a full CTB carries up to 27 kg).',
                      'Size is an assumption - do not show it as a real NASA size.'),
    'astronaut': ('all', 'Generic suited astronaut (crew member / player stand-in). The rigged player is in game3d/characters/.',
                  'Generic figure (no real size); scaled to 1.90 m like a suited astronaut.',
                  'https://science.nasa.gov/3d-resources/astronaut/', None, None, 'Generic figure.',
                  'T-pose, not rigged. US flags / NASA logo / patch painted out of the texture.'),
    'emu': ('xks', 'ISS spacewalk suit (EMU) - display / NPC.',
            'Fits people 1.57-1.88 m; scaled to 1.90 m incl. PLSS.',
            'https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf', 145, 'confirmed', 'with PLSS + SAFER, on Earth', ''),
    'mark-3': ('oy', 'Planetary surface suit (Mark III) - display / NPC on Moon or Mars.',
               'Height not confirmed; scaled to 1.89 m.', 'https://science.nasa.gov/3d-resources/mark-iii-spacesuit/',
               59, 'approximate', 'secondary source', ''),
    'helmet': ('xks', 'EVA helmet prop.', 'Generic model; ~0.40 m assumed (no official size).',
               'https://science.nasa.gov/3d-resources/helmet/', None, None, 'Unknown.', ''),
    'hammer': ('oy', 'Apollo 15 hammer-and-feather drop mini-game.',
               'Generic hammer; 39.1 cm length is unverified (NSSDC gives only the mass).',
               'https://nssdc.gsfc.nasa.gov/planetary/lunar/apollo_15_feather_drop.html', 1.32, 'confirmed',
               'Apollo 15 geologic hammer (feather 0.03 kg; dropped from ~1.6 m)', ''),
    'sample-tube': ('mars', 'Sample tube pickup (Perseverance).', 'Mars 2020 tube length < 15.2 cm (model 14.2 cm).',
                    'https://www.jpl.nasa.gov/news/a-martian-roundtrip-nasas-perseverance-rover-sample-tubes/', 0.057,
                    'confirmed', 'upper bound (< 57 g)', ''),
    'orion': ('oy', 'Orion crew module: ride home / rescue capsule.', 'Heat shield diameter 5.03 m (16.5 ft).',
              'https://www.nasa.gov/reference/crew-module/', 9300, 'approximate', 'crew module at landing (estimate)',
              'Crew module only (no service module). Orion stays in orbit - it does not land on the Moon.'),
    'apollo-lm': ('oy', 'History card: Apollo Lunar Module.', 'Overall height ~7.0 m (approx.); model scaled to 7.0 m.',
                  'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C', 15103, 'confirmed',
                  'Apollo 11 LM incl. propellant', 'US flag and UNITED STATES lettering painted out.'),
    'lro': ('oy', 'Lunar Reconnaissance Orbiter (CRaTER radiation meter) - orbit/sky prop.',
            'Model already in metres (array area ~11 m2 vs NASA 10.7 m2).',
            'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=2009-031A', 1846, 'confirmed', 'launch mass', ''),
    'gateway': ('oy', 'Gateway (planned lunar station, cancelled by NASA on 2026-03-24) - show as "was planned".',
                'NASA FAQ: ~43 x 19 x 20 m planned; model 39 m tall (metres).',
                'https://www.nasa.gov/gateway-frequently-asked-questions/', 63000, 'confirmed', 'planned, fully assembled',
                "'Canada' wordmark on Canadarm3 painted out. Not a working station in 2026."),
    'apollo-11-site': ('oy', 'Backdrop terrain: Apollo 11 site, 30 x 30 km.',
                       'Height map 30 x 30 km; NASA print exaggerates Z 60x - exaggeration REMOVED here (real relief, almost flat). Scale Y x60 for the print look.',
                       'https://science.nasa.gov/3d-resources/apollo-11-landing-site/', None, None, 'Terrain.',
                       'Collider COL_apollo-11-site is a low-poly mesh, not boxes.'),
    'moon-near-side': ('oy', 'Backdrop / map terrain: Moon near side, ~400 x 400 km.',
                       '1:5,000,000 print, 400 km across; vertical exaggeration not stated by NASA (relief ~8 km is a model estimate).',
                       'https://science.nasa.gov/3d-resources/moon/', None, None, 'Terrain.', 'Collider is a low-poly mesh.'),
    'mount-hadley': ('oy', 'Horizon mountain (Apollo 15 site), ~40 km tile, peak ~4.5 km above the plain.',
                     'Mons Hadley ~4,500 m above the plain (AS15-87-11849; the 3D page value 4,765 ft is wrong).',
                     'https://www.nasa.gov/history/alsj/a15/a15psrf5-17.html', None, None, 'Terrain.',
                     'Collider is a low-poly mesh. Tile width is an estimate.'),
    'moon-globe': ('oy', 'Moon globe (map / menu / sky).', 'Exported at radius 1 m. Real radius 1,737.4 km.',
                   'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html', None, None,
                   'Moon mass 7.346e22 kg (not for game physics).', 'Texture: NASA SVS CGI Moon Kit (LRO).'),
    'earth-globe': ('yer', 'Earth globe (map / menu / sky).', 'Exported at radius 1 m. Real equatorial radius 6,378.1 km (mean 6,371 km).',
                    'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html', None, None,
                    'Earth mass 5.9722e24 kg (not for game physics).', 'Texture: NASA Blue Marble Next Generation.'),
    'mars-globe': ('mars', 'Mars globe (map / menu / sky).', 'Exported at radius 1 m. Real equatorial radius 3,396.2 km (mean 3,389.5 km).',
                   'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html', None, None,
                   'Mars mass 6.4169e23 kg (not for game physics).', 'Texture: NASA/JPL-Caltech/USGS Viking mosaic.'),
    'iss': ('xks', 'International Space Station (caravan stop; water tank refill).', 'End to end 109 m (356 ft); model scaled by the 109 m span.',
            'https://www.nasa.gov/international-space-station/space-station-facts-and-figures/', 419725, 'confirmed', '',
            'Older (~2011) configuration; untextured grey.'),
    'robonaut-2': ('xks', 'Robonaut 2 helper robot.', 'Waist to head 1.02 m; with legs ~2.40 m tall.',
                   'https://www.nasa.gov/wp-content/uploads/2016/09/robonaut2_508.pdf', 150, 'confirmed', '', 'R2 returned to Earth in 2018.'),
    'oru': ('xks', 'Orbital Replacement Unit / battery box pickup.', 'Scaled to a Li-ion battery ORU length 1.04 m (104 x 94 x 53 cm); the model is an ORU carrier.',
            'https://ntrs.nasa.gov/api/citations/20160012048/downloads/20160012048.pdf', 197, 'confirmed',
            'Li-ion battery ORU (the model is a generic ORU carrier)', ''),
    'sls': ('yer', 'Space Launch System rocket (caravan launch).', 'SLS Block 1 height 98.1 m (322 ft).',
            'https://www.nasa.gov/sites/default/files/files/SLS-Fact-Sheet_aug2014-finalv3.pdf', 2600000, 'confirmed',
            'fully fuelled (5.75 million lb)', 'Untextured STL: flat colours (orange core, white boosters).'),
    'mobile-launcher': ('yer', 'Mobile Launcher 1 tower and base.', 'Total height ~380 ft (116 m), tower 40 ft square; model scaled by the tower width.',
                        'https://www.nasa.gov/humans-in-space/exploration-ground-systems/mobile-launcher/', 5200000, 'confirmed', '11.5 million lb', ''),
    'mission-control': ('yer', 'Mission Control room "Houston" (walk-in room).', 'Room size not published; model already in metres (desk 0.74 m high).',
                        'https://www.nasa.gov/johnson/jsc-mission-control-center/', None, None, 'Room.',
                        'Collider: floor + 4 walls + console boxes. Source colours were black -> simple palette.'),
    'dsn-34m': ('yer', 'Deep Space Network 34 m antenna (talks to Moon and Mars).', 'Dish 34 m across, ~35 m tall.',
                'https://www.cdscc.nasa.gov/Pages/Antennas/dss34.html', None, None, 'Not found in NASA/JPL sources.',
                'Dish aimed 45 deg up toward +Z.'),
    'saturn-v': ('yer', 'History card: Saturn V.', 'Height 111 m (363 ft).',
                 'https://www.nasa.gov/learning-resources/for-kids-and-students/what-was-the-saturn-v-grades-5-8/', 2800000, 'confirmed',
                 'fully fuelled', "Red 'UNITED STATES'/USA lettering painted out."),
    'goes': ('yer', 'GOES weather satellite: first storm signal.', 'Bus 6.1 x 5.6 x 3.9 m; model scaled by the bus box.',
             'https://www.goes-r.gov/spacesegment/spacecraft.html', 5192, 'confirmed', 'launch mass (dry 2857 kg)', ''),
    'sdo': ('koinot', 'Solar Dynamics Observatory: the "Sun camera".', 'Solar panel span 6.25 m, 4.5 m along the Sun axis.',
            'https://sdo.gsfc.nasa.gov/mission/spacecraft.php', 3000, 'confirmed', 'launch mass', 'Inverted normals fixed.'),
    'curiosity': ('mars', 'Curiosity rover (RAD radiation detector).', '3.0 x 2.7 x 2.2 m; model already in metres.',
                  'https://mars.nasa.gov/multimedia/interactives/learncuriosity/index-2.html', 899, 'confirmed', '',
                  'Lettering, mission medallions, US flag, NASA logo painted out.'),
    'perseverance': ('mars', 'Perseverance rover (sample collector).', '3 x 2.7 x 2.2 m, mast up; model already in metres.',
                     'https://science.nasa.gov/mission/mars-2020-perseverance/rover-components/', 1025, 'confirmed', '',
                     'MARS 2020 / PERSEVERANCE lettering, NASA/JPL logos, flag plate painted out.'),
    'viking': ('mars', 'History card: Viking lander (1976).', '~2.0 m tall; model scaled to 2.0 m.',
               'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1975-075C', 600, 'confirmed', 'after landing', ''),
}


def main():
    facts = {c['id']: c for c in json.load(open(os.path.join(ROOT, 'facts', 'nasa_facts.json')))['kartalar']}
    out = []
    total = 0
    for mid in sorted(INFO):
        st, role, size_note, url, mass, mstat, mnote, notes = INFO[mid]
        b = json.load(open(os.path.join(WORK, f'build_{mid}.json'))) if os.path.exists(os.path.join(WORK, f'build_{mid}.json')) else None
        v = json.load(open(os.path.join(WORK, f'verify_{mid}.json'))) if os.path.exists(os.path.join(WORK, f'verify_{mid}.json')) else None
        if not b or not v:
            print('MISSING', mid)
            continue
        total += v['bytes']
        f = facts.get(mid, {})
        credit = '3D model: ' + CREDIT
        if mid == 'earth-globe':
            credit += ' Texture: NASA Blue Marble Next Generation.'
        elif mid == 'moon-globe':
            credit += ' Texture: NASA SVS CGI Moon Kit (LRO).'
        elif mid == 'mars-globe':
            credit += ' Texture: NASA/JPL-Caltech/USGS Viking.'
        cb = b.get('col_boxes_gltf')
        out.append({
            'id': mid,
            'name': f.get('rasmiy_nomi', mid),
            'file': 'assets/' + b['file'],
            'bytes': v['bytes'],
            'triangles': v['tris'],
            'source_triangles': b['source_tris'],
            'bbox_m': {'x': v['size_m_gltf_xyz'][0], 'y': v['size_m_gltf_xyz'][1], 'z': v['size_m_gltf_xyz'][2]},
            'origin': 'centre' if mid.endswith('globe') else ('shared NASA frame with hdu-1/hdu-2 (deck base y=0)' if mid.startswith('hdu') else 'bottom-centre'),
            'scale_from_source': b['scale_from_source'],
            'real_size': size_note,
            'source_url': url,
            'mass_kg': mass,
            'mass_status': mstat,
            'mass_note': mnote,
            'collider': {'node': 'COL_' + mid, 'type': 'mesh' if cb is None else 'boxes',
                         'boxes_gltf': cb},
            'textures': list(v['images'].keys()),
            'suggested_use': {'station': st, 'role': role},
            'role_uz': f.get('oyin_roli', ''),
            'fixes': b['fixes'],
            'notes': notes,
            'credit': credit,
        })
    man = {
        'project': 'Oy karvonsaroyi - Team OUTPOST, NASA Space Apps 2026',
        'generated': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
        'units': 'metres; glTF Y-up; front = +Z where it makes sense',
        'loader': {'three': 'GLTFLoader + DRACOLoader', 'draco_decoder_path': 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/',
                   'extensions_used': ['KHR_draco_mesh_compression', 'EXT_texture_webp']},
        'collision_convention': "Each GLB has the visual mesh node '<id>' and a collider node 'COL_<id>' (no material; hide it). "
                                "Box colliders: node extras/userData.boxes = JSON string of [cx, cy, cz, sx, sy, sz] in metres (glTF axes, asset space). "
                                "Terrain colliders are low-poly meshes (userData.collider = 'mesh').",
        'gravity': {'earth': 9.81, 'moon': 1.62, 'mars': 3.71, 'unit': 'm/s^2',
                    'sources': ['https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html',
                                'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
                                'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html'],
                    'source_index': 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/',
                    'note': 'NSSDC fact sheets (read 2026-11-14): Earth mean surface gravity 9.820 (equator 9.780) - 9.81 is standard g rounded; '
                            'Moon 1.62; Mars mean 3.73 (equator 3.69) - 3.71 is used as the game value.'},
        'credit': '3D models: NASA 3D Resources / NASA Science (NASA/JPL-Caltech). Not endorsed by NASA.',
        'brand_rule': 'No NASA logos, seals, US flags, mission patches or agency wordmarks in any exported texture (checked by eye).',
        'moon_level': 'Not made yet - the Moon level will be built later from the team spec (game3d/levels/).',
        'total_bytes': total,
        'assets': out,
    }
    with open(os.path.join(GAME, 'manifest.json'), 'w') as fh:
        json.dump(man, fh, indent=1, ensure_ascii=False)
    print('manifest:', len(out), 'assets,', round(total / 1e6, 2), 'MB')


if __name__ == '__main__':
    main()
