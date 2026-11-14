# Oy karvonsaroyi — 3D model inventory

Generated with Blender 5.3 headless (glTF importer, Draco supported). All 35 models imported without errors.
Sizes are world-space bounding boxes in Blender units after import (Blender is Z-up; the importer converts glTF Y-up to Z-up), so Z is height.
Logo-suspect sources: `name` = material/image/object name matches flag|logo|patch|nasa|meatball|insignia|decal|text|vitruvian|usa;
`artifact` = flagged in the Model Studio artifact; `visual` = found in a visual sweep of base-color textures.
NASA brand rules: no NASA logos, flags or mission patches may appear in game art — every row with a logo-suspect entry needs those textures/materials hidden or repainted.

Full data (bbox min/max, object types, material→image map, extensions) is in `inventory.json`.

| model | size x×y×z | longest | tris | mesh objs | mats | textures | logo-suspect parts |
|---|---|---|---|---|---|---|---|
| apollo-11-site | 256×256×18.7 | X | 142,768 | 1 | 1 | - | - |
| apollo-lm | 6.43×6.43×5.01 | X | 97,588 | 134 | 12 | BOOSTER3 400x400, TEXTURE_ 900x900, TEXTUREA 900x900 | visual: TEXTURE_ (mat blinn12SG.001): US flag; TEXTUREA (mat blinn8SG.001): 'UNITED STATES' lettering |
| astronaut | 68.9×27.6×74.3 | Z | 6,381 | 1 | 2 | astnt1_1 1024x1024, astnt1_2 128x128 | artifact: painted flags/logos in texture / visual: astnt1_1 (mat astnt1_1): US flags + NASA meatball on suit |
| crew-lock-bag | 14.1×5.41×15.5 | Z | 514 | 1 | 1 | crwlckbg 1024x512 | - |
| curiosity | 2.78×3.94×2.22 | Y | 51,305 | 1 | 9 | 9 images (1024x1024, 512x512) | visual: tex_05.jpg (mat tex_05): 'CURIOSITY' lettering, NASA meatball and flag-style medallions |
| dsn-34m | 34×34×36.8 | Z | 31,842 | 8 | 9 | 5 images (1024x1024, 512x512) | - |
| earth-globe | 2×2×2 | X | 9,024 | 1 | 1 | Image_0 2048x1024 | - |
| emu | 1.13×1.41×2 | Z | 343,455 | 1 | 25 | emusuitbox4 1000x1032, emusuitFLAGpatch 582x564, emusuitvitruvianpatch 582x564 | name: emusuitFLAGpatch, emusuitvitruvianpatch / artifact: hides emusuitFLAGpatch, emusuitvitruvianpatch, emusuitbox4 / visual: emusuitFLAGpatch (mats emusuit5_jetpack2SG, lambert9SG): US flag; emusuitvitruvianpatch (mat lambert8SG): mission-style patch; emusuitbox4 (mat lambert7SG): small control-box lettering |
| gateway | 17.9×30.1×39 | Z | 97,764 | 9 | 14 | 37 images (1024x1024) | visual: DSXR_BaseColor (mat DSXR): 'Canada' wordmark |
| goes | 0.134×0.111×0.122 | X | 40,935 | 1 | 24 | - | - |
| hammer | 0.156×0.356×0.0692 | Y | 692 | 1 | 3 | - | - |
| hdu-1 | 380×166×217 | X | 2,264 | 1 | 1 | HDU_01 1024x1024 | artifact: painted flags/logos in texture / visual: HDU_01 (mat lambert2SG): US flags, NASA meatballs, 'AIRLOCK' lettering |
| hdu-2 | 656×459×226 | X | 4,320 | 1 | 1 | HDU_02 1024x1024 | artifact: painted flags/logos in texture / visual: HDU_02 (mat lambert3SG): no flag/logo visible at full res, only hazard-stripe decals |
| helmet | 14.1×14.1×13.7 | Y | 64,664 | 6 | 4 | - | - |
| iss | 14.4×45.5×45.4 | Y | 174,440 | 10 | 19 | - | - |
| lro | 5.45×5.51×3.66 | Y | 8,142 | 7 | 7 | 5 images (1024x1024, 256x256) | - |
| mark-3 | 1.11×1.13×1.99 | Z | 69,202 | 1 | 14 | texturelogo 700x700 | name: texturelogo / artifact: hides texturelogo / visual: texturelogo (mat lambert5SG): NASA meatball |
| mars-globe | 2×2×2 | X | 9,024 | 1 | 1 | Image_0 1440x720 | - |
| mission-control | 14.5×24.6×5.89 | Y | 11,130 | 1 | 45 | - | - |
| mobile-launcher | 1.02×0.867×2.46 | Z | 19,296 | 1 | 2 | mobilelauncher_d 512x512, mobilelauncher_railings_d_o 512x512 | - |
| moon-globe | 2×2×2 | X | 9,024 | 1 | 1 | Image_0 2048x1024 | - |
| moon-near-side | 78.4×78.4×3.65 | X | 200,000 | 1 | 1 | - | - |
| mount-hadley | 304×304×57 | X | 200,000 | 1 | 1 | - | - |
| orion | 16.3×16.3×10.6 | X | 51,736 | 1 | 1 | - | - |
| oru | 174×151×141 | X | 2,776 | 1 | 4 | naming_d-naming_d.tga 512x1024, spstob_1 128x64, spstob_e 128x128, spstob_s 512x512 | - |
| perseverance | 2.7×3.11×2.85 | Y | 199,601 | 69 | 47 | 22 images (1024x1024, 1024x512, 128x128, 256x256, 512x512, 64x64) | visual: arm_graphics (mat arm_graphics): NASA meatball, JPL logo, 'MARS 2020'/'PERSEVERANCE' lettering; blade (mat blades): JPL logo, US flag, NASA meatball |
| rassor | 0.848×1.66×0.938 | Y | 1,994,682 | 1 | 1 | - | - |
| robonaut-2 | 2.34×0.681×2.61 | Z | 213,244 | 47 | 13 | - | - |
| sample-tube | 0.905×0.968×5.6 | Z | 42,416 | 1 | 1 | - | - |
| saturn-v | 2.01×2.01×13 | Z | 34,814 | 22 | 13 | SATURNVA 1000x1000, SATURNVT 1000x1000, SATURNVU 1000x1000, SATURNVW 1000x1000 | artifact: painted flags/logos in texture / visual: SATURNVA/T/U (mats blinn9SG/8SG/10SG): red 'UNITED STATES'/USA lettering |
| sdo | 37×37×30.7 | Y | 272,770 | 1 | 31 | - | - |
| sev | 4.04×5.91×3.97 | Y | 412,999 | 1 | 1 | MMSEV_Bump_v1s 2048x2048, MMSEV_Color_v2s 2048x2048, MMSEV_spec_color_v1s 2048x2048 | - |
| sls | 45.3×23×199 | Z | 199,979 | 1 | 1 | - | - |
| solar-wing | 0.09×0.099×0.002 | Y | 216 | 2 | 2 | - | - |
| viking | 16.7×12.6×8.97 | X | 99,526 | 2 | 9 | - | - |
