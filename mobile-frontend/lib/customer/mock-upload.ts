import { Platform } from 'react-native';

type WebFileInput = {
  accept: string;
  click: () => void;
  files?: { [index: number]: Blob | undefined; length: number } | null;
  onchange: (() => void) | null;
  type: string;
};

type WebDocument = {
  createElement: (tagName: 'input') => WebFileInput;
};

type WebFileReader = {
  onerror: (() => void) | null;
  onload: (() => void) | null;
  readAsDataURL: (file: unknown) => void;
  result: ArrayBuffer | string | null;
};

type WebFileReaderConstructor = new () => WebFileReader;

function sanitizeSvgText(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pickImageFromWeb() {
  const webGlobals = globalThis as typeof globalThis & {
    document?: WebDocument;
    FileReader?: WebFileReaderConstructor;
  };

  if (!webGlobals.document || !webGlobals.FileReader) {
    return Promise.resolve<string | null>(null);
  }

  return new Promise<string | null>((resolve) => {
    const input = webGlobals.document?.createElement('input');
    const FileReaderConstructor = webGlobals.FileReader;

    if (!input || !FileReaderConstructor) {
      resolve(null);
      return;
    }

    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const selectedFile = input.files?.[0];

      if (!selectedFile) {
        resolve(null);
        return;
      }

      const reader = new FileReaderConstructor();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(selectedFile);
    };
    input.click();
  });
}

function createMockImage(label: string, subtitle: string) {
  const safeLabel = sanitizeSvgText(label);
  const safeSubtitle = sanitizeSvgText(subtitle);
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
      <rect width="900" height="560" rx="42" fill="#EEF4FF"/>
      <rect x="54" y="60" width="792" height="440" rx="32" fill="#FFFFFF"/>
      <circle cx="450" cy="210" r="74" fill="#346EF6" opacity="0.14"/>
      <text x="450" y="292" text-anchor="middle" font-family="Arial" font-size="46" font-weight="800" fill="#17315F">${safeLabel}</text>
      <text x="450" y="348" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="#346EF6">${safeSubtitle}</text>
    </svg>`,
  );

  return `data:image/svg+xml;charset=UTF-8,${svg}`;
}

export async function pickImageOrMock(label: string, subtitle = 'Stored image preview') {
  if (Platform.OS === 'web') {
    return pickImageFromWeb();
  }

  return createMockImage(label, subtitle);
}
