import { RecordingReviewModule } from "@/modules/management/research/RecordingReviewModule";

export default async function RecordingPage({ params }: { params: Promise<{ trialId: string }> }) {
  const { trialId } = await params;
  return <RecordingReviewModule key={trialId} trialId={trialId} />;
}
