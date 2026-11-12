// `@remotion/google-fonts/<Family>` is made by the kinetograph CLI when it bundles the project, so the type checker
// finds no file for it. This declares the part the starter uses.
declare module '@remotion/google-fonts/*' {
  export function loadFont(
    style?: string,
    options?: { weights?: string[]; subsets?: string[] },
  ): { fontFamily: string };
  export const fontFamily: string;
}
