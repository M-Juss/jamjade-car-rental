import { Text, View } from 'react-native';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function ProgressSteps({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-[12px] font-black text-[#346EF6]">
          Step {currentStep} of {totalSteps}
        </Text>
        <Text className="text-[12px] font-bold text-[#91A0B8]">Onboarding</Text>
      </View>
      <View className="flex-row gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isActive = index < currentStep;

          return (
            <View
              key={index}
              className={cx('h-2 flex-1 rounded-full', isActive ? 'bg-[#346EF6]' : 'bg-[#DDE8FF]')}
            />
          );
        })}
      </View>
    </View>
  );
}
