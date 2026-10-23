# Transparent vehicle images

These seven PNG cutouts were made from the existing primary vehicle uploads
using the built-in imagegen tool's background-extraction mode. Original uploads
and database records are unchanged. Filenames follow the current catalog labels;
the Innova labeled 2026 still shows the original photo's `INNOVA 2017` plate.

`lib/browse/vehicle-image-source.ts` matches the exact original upload filename
to its bundled cutout. New or replaced uploads and other gallery photos keep
their original source; they do not inherit a cutout based on model or vehicle ID.
Add a new cutout and filename mapping when another image needs extraction.

Prompt used for the cutouts:

> Remove only the surrounding background to true transparent alpha. Preserve
> the exact vehicle, silhouette, perspective, body color, white paint, mirrors,
> roof accessories, tyres, wheels, windows, reflections, badges and plate text.
> Do not redesign or repaint the vehicle. Keep the whole vehicle uncropped,
> with clean antialiased edges and no white halo, ground, added shadow, new
> text or checkerboard pixels.

The front-facing Innova received a second background-extraction pass to remove
disconnected background debris above its roof while preserving the vehicle.
