import { BookOpen } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { ActionButton } from '@/components/bookings';
import { MetadataList } from '@/components/common/MetadataList';
import { exerciseCatalog, type ExerciseProtocol } from '@/lib/research/collection';
import { ResearchDialog } from './ResearchControls';

export function ExerciseGuide({ protocol, onClose, onStop }: { protocol: ExerciseProtocol | null; onClose: () => void; onStop?: () => void }) {
  return <ResearchDialog visible={protocol !== null} title={protocol?.label ?? 'Protocol'} icon={BookOpen} onClose={onClose}
    footer={onStop ? <ActionButton density="compact" label="Stop & save" variant="primary" onPress={onStop} /> : undefined}>
    {protocol?.steps.map((step, index) => <View key={step.stage} className="flex-row gap-3">
      <Text className="font-sans text-body font-semibold text-primary">{index + 1}</Text>
      <Text className="font-sans flex-1 text-body text-foreground">{step.instruction}</Text>
    </View>)}
    {protocol?.layout_key === 'straight_start_stop' && <View className="gap-2 border-t border-border pt-3">
      <Text className="font-sans text-body font-semibold text-foreground">Course</Text>
      {[['A', 'Start (1–2)'], ['B', `${protocol.expected_stop_method === 'neutral_release' ? 'Release to neutral' : 'Begin braking'} (3–4)`], ['C', 'Stop before here (5–6)']].map(([point, instruction]) => <View key={point} className="flex-row gap-3">
        <Text className="font-sans text-body font-semibold text-primary">{point}</Text>
        <Text className="font-sans min-w-0 flex-1 text-body text-foreground">{instruction}</Text>
      </View>)}
      <Text className="font-sans text-caption text-secondary-foreground">Keep a clear buffer beyond C. Spacing is provisional; rehearse at low speed.</Text>
    </View>}
    {protocol && ['left_turn', 'right_turn', 'swerve_recovery'].includes(protocol.layout_key) && <Text className="font-sans text-caption text-secondary-foreground">Radius and spacing are provisional. Rehearse the full movement before recording.</Text>}
  </ResearchDialog>;
}

export function ResearchNotes({ visible, onClose, onReset }: { visible: boolean; onClose: () => void; onReset?: () => void }) {
  return <ResearchDialog visible={visible} title="Research notes" onClose={onClose}>
    <Text className="font-sans text-body font-semibold text-foreground">Collection</Text>
    <Text className="font-sans text-body text-secondary-foreground">One exercise per recording. Allow settling and about five quiet seconds before and after moving.</Text>
    <Text className="font-sans text-body text-secondary-foreground">Mount: MN-82S roof, adjustable screw, screen up, camera/notch toward the RC front. Recheck after moving the phone and capture a fresh forward reference.</Text>
    <Text className="font-sans text-body font-semibold text-foreground">Pilot data</Text>
    <Text className="font-sans text-body text-secondary-foreground">Setup limits and alignment are unvalidated. A measured check does not approve training data. Current collection uses guided protocols; Pilot history keeps earlier recordings.</Text>
    <Text className="font-sans text-body font-semibold text-foreground">Saving & sync</Text>
    <Text className="font-sans text-body text-secondary-foreground">Stop saves the original before observations. Upload is explicit. Originals stay on the phone after verification. Observations and setup may still need syncing; unavailable or cached status is identified separately.</Text>
    <Text className="font-sans text-body font-semibold text-foreground">Names</Text>
    <Text className="font-sans text-body font-medium text-foreground">S02-FSS-R038</Text>
    <MetadataList items={[{ label: 'Session', value: '02' }, { label: 'Exercise', value: 'Forward Start-Stop' }, { label: 'Recording', value: '038' }]} />
    <Text className="font-sans text-caption text-secondary-foreground">Earlier recordings keep their names.</Text>
    {onReset && <ActionButton density="compact" label="Delete local research data" variant="danger" onPress={onReset} />}
    {exerciseCatalog.protocols.map(protocol => <View key={protocol.code} className="flex-row items-start gap-3">
      <Text className="font-sans w-10 text-body font-semibold text-foreground">{protocol.code}</Text>
      <Text className="font-sans min-w-0 flex-1 text-body text-foreground">{protocol.label}</Text>
    </View>)}
  </ResearchDialog>;
}
