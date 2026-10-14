import { Text, View } from 'react-native';

function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function ProgressSteps({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans text-[12px] font-semibold text-primary">
          Step {currentStep} of {totalSteps}
        </Text>
        <Text className="font-sans text-[12px] font-medium text-secondary-foreground">Onboarding</Text>
      </View>
      <View className="flex-row gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const isActive = index < currentStep;

          return (
            <View
              key={index}
              className={cx('h-1 flex-1 rounded-full', isActive ? 'bg-primary' : 'bg-border')}
            />
          );
        })}
      </View>
    </View>
  );
}
