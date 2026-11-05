import { BookOpen } from 'lucide-react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton, SectionCard } from '@/components/bookings';
import { exerciseCatalog, type ExerciseProtocol } from '@/lib/research/collection';

export function ExerciseGuide({ protocol, onClose, onStop }: { protocol: ExerciseProtocol | null; onClose: () => void; onStop?: () => void }) {
  return <Modal visible={protocol !== null} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView className="flex-1 bg-background"><ScrollView contentContainerClassName="gap-4 p-screen">
      <Text accessibilityRole="header" className="font-sans text-title font-semibold text-foreground">{protocol?.label}</Text>
      <Text className="font-sans text-caption text-secondary-foreground">{exerciseCatalog.catalog_version} · Provisional</Text>
      {protocol?.steps.map((step, index) => <View key={step.stage} className="flex-row gap-3">
        <Text className="font-sans text-body font-semibold text-primary">{index + 1}</Text>
        <Text className="font-sans flex-1 text-body text-foreground">{step.instruction}</Text>
      </View>)}
      {protocol?.layout_key === 'straight_start_stop' && <SectionCard title="Straight course" icon={BookOpen}>
        {['A · Start · cones 1–2', protocol.code === 'RSS' ? 'B · Release to neutral · cones 3–4' : 'B · Begin braking · cones 3–4', 'C · Stop before here · cones 5–6', 'Clear buffer beyond C'].map(label => <View key={label} className="border-b border-border py-3"><Text className="font-sans text-body text-foreground">{label}</Text></View>)}
        <Text className="font-sans mt-3 text-caption text-secondary-foreground">Spacing is provisional. Rehearse at low speed with room to stop.</Text>
      </SectionCard>}
      {protocol && ['left_turn', 'right_turn', 'swerve_recovery'].includes(protocol.layout_key) && <Text className="font-sans text-body text-secondary-foreground">Radius and spacing are provisional. Check that the full movement fits before recording.</Text>}
    </ScrollView><View className="gap-2 px-screen py-3">{onStop && <ActionButton label="Stop & save" variant="primary" onPress={onStop} />}<ActionButton label="Close protocol" onPress={onClose} /></View></SafeAreaView>
  </Modal>;
}

export function AbbreviationGuide({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView className="flex-1 bg-background">
    <ScrollView contentContainerClassName="gap-4 p-screen"><Text accessibilityRole="header" className="font-sans text-title font-semibold text-foreground">Abbreviation guide</Text>
      <Text className="font-sans text-section font-semibold text-primary">S02-FSS-R038</Text>
      <Text className="font-sans text-body text-foreground">S02 · Session 02{ '\n' }R038 · Recording 038 (zero, not letter O)</Text>
      {exerciseCatalog.protocols.map(protocol => <View key={protocol.code} className="border-b border-border pb-3"><Text className="font-sans text-body text-foreground">{protocol.code} · {protocol.label}</Text></View>)}
    </ScrollView><View className="px-screen py-3"><ActionButton label="Close" onPress={onClose} /></View>
  </SafeAreaView></Modal>;
}
