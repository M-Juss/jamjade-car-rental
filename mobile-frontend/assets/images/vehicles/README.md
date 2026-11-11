# Transparent vehicle images

The current vehicle catalog has 40 active photos across 10 vehicles. All 40
original upload filenames map to transparent PNG cutouts in both the web and
mobile apps. Existing catalog cutouts cover some images; the remaining photos
were cut out locally with macOS Vision foreground segmentation. Gallery angles
and source uploads are preserved.

`lib/browse/vehicle-image-source.ts` maps each exact original upload filename
to a bundled cutout for mobile. The web uses the matching files in
`web-frontend/public/vehicles-transparent/`. New vehicle uploads should receive
a cutout and filename mapping before they are used in the catalog.
