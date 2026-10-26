import { NativeRecordingReview } from "@/modules/management/research/NativeRecordingReview";

export default async function NativeRecordingPage({ params }: { params: Promise<{ recordingId: string }> }) {
  const { recordingId } = await params;
  return <NativeRecordingReview key={recordingId} id={recordingId} />;
}
