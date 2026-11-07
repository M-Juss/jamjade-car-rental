type RecordingName = { name?: string; displayCode?: string | null; surface?: string };

// Read the existing native-generated name; never number records from their list position.
export function recordingPresentation({ name, displayCode, surface }: RecordingName) {
  const recording = name?.match(/^(.+) \u00b7 Recording ([0-9]{1,9})$/);
  const number = recording ? Number(recording[2]) : 0;
  if (!recording || number < 1) {
    return { title: displayCode ?? name ?? 'Unavailable recording', metadata: [] as { label: string; value: string }[] };
  }

  const title = `R${String(number).padStart(3, '0')}`;
  const group = recording[1].match(/^(.+) - (Level|Uphill|Downhill) - Group ([0-9]{1,9})$/i);
  const shortGroup = group && Number(group[3]) > 0 ? group : null;
  const metadata = [{ label: 'Group', value: shortGroup ? `G${Number(shortGroup[3])}` : recording[1] }];
  const recordedSurface = surface || shortGroup?.[1];
  if (recordedSurface) metadata.push({ label: 'Surface', value: recordedSurface });
  if (shortGroup) metadata.push({ label: 'Slope', value: shortGroup[2][0].toUpperCase() + shortGroup[2].slice(1).toLowerCase() });
  if (displayCode && displayCode !== title) metadata.push({ label: 'Code', value: displayCode });
  return { title, metadata };
}
