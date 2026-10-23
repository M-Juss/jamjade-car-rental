# Noto Sans for booking PDFs

The booking confirmation embeds these unmodified static TrueType fonts locally:

- `NotoSans-Regular.ttf` (400)
- `NotoSans-Bold.ttf` (700)

Source: [Noto Fonts static Noto Sans files](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans).
The accompanying `OFL.txt` contains the SIL Open Font License and copyright notice.

Keep both files and the license in deployments. Dompdf writes generated font metrics to
`storage/fonts`, which must remain writable along with the rest of Laravel's storage directory.
Generated metrics are ignored by Git. Email uses Arial and does not load these files.
