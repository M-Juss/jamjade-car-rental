import { CheckCircle2, Eraser, FileSignature, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type SignaturePoint = {
  x: number;
  y: number;
};

type SignatureStroke = SignaturePoint[];

type TermsSection = {
  title: string;
  terms: {
    title: string;
    details?: string[];
  }[];
};

const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'General Terms and Conditions',
    terms: [
      {
        title: 'Gasoline must be refilled upon return of the unit to the same level as when it was endorsed.',
      },
      {
        title: 'Twenty-four (24) hours is the minimum rental period per day. Excess time will be charged as follows:',
        details: [
          'Sedan / Toyota Vios: PHP 200.00 per hour.',
          'Van / Hiace / Innova / Fortuner: PHP 300.00 per hour.',
        ],
      },
      {
        title: 'Pickup and delivery of the unit to the renter will be charged PHP 900.00.',
      },
      {
        title: 'A rental extension is allowed only after surrendering the unit first and paying the remaining balance.',
      },
      {
        title: 'The rented vehicle must be clean when returned to the company.',
      },
      {
        title: 'Pets are not allowed. A PHP 1,000.00 fee will be charged for violations.',
      },
      {
        title: 'Smoking is strictly prohibited.',
      },
      {
        title: 'All transactions, including additional charges, must be completed online. All payments must be made payable to Mr. Alvin N. Macalam.',
      },
      {
        title: 'Cancellation of any vehicle booking or reservation is not allowed due to the possible loss of vehicle availability and profit.',
      },
      {
        title: 'A down payment upon delivery of the unit is acceptable.',
      },
      {
        title: 'For down-payment rentals, the remaining balance must be completed within five (5) days from the reservation date or before the scheduled rental date, whichever comes first.',
      },
    ],
  },
  {
    title: 'Terms and Conditions for Self-Drive Renters',
    terms: [
      {
        title: 'For self-drive renters, all damages will be charged to the renter.',
      },
      {
        title: 'A refundable participation fee of PHP 10,000.00 must be paid in advance for any damages incurred in an accident.',
      },
      {
        title: 'A rental fee will be charged for each day the vehicle cannot be used for business because of repairs.',
      },
      {
        title: 'Physical verification of documentation is required once the vehicle has been delivered.',
      },
      {
        title: 'Clutch damage will be charged PHP 9,000.00.',
      },
      {
        title: 'Before operating the vehicle, the renter must calibrate the telematics in the mobile application. Telematics must be active while the vehicle is in motion and may be paused when the renter is outside the vehicle.',
      },
    ],
  },
  {
    title: "Terms and Conditions for Renting a Car with Owner's Driver",
    terms: [
      {
        title: "Renting a car with the owner's driver includes an additional daily fee based on travel coverage:",
        details: [
          'Within Metro Manila: PHP 700.00 per day.',
          'Outside Metro Manila: PHP 1,000.00 per day.',
        ],
      },
      {
        title: "The renter is responsible for the driver's accommodations.",
      },
    ],
  },
];

function pointFromEvent(event: GestureResponderEvent): SignaturePoint | null {
  const x = Number(event.nativeEvent.locationX);
  const y = Number(event.nativeEvent.locationY);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { x, y };
}

function strokeToPath(stroke: SignatureStroke) {
  return stroke
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function isMeaningfulMove(previousPoint: SignaturePoint, nextPoint: SignaturePoint) {
  return Math.hypot(nextPoint.x - previousPoint.x, nextPoint.y - previousPoint.y) >= 1.5;
}

export function TermsSignatureModal({
  onClose,
  onSubmit,
  visible,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (signature: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'terms' | 'signature'>('terms');
  const [strokes, setStrokes] = useState<SignatureStroke[]>([]);
  const hasSignature = strokes.some((stroke) => stroke.length > 1);

  useEffect(() => {
    if (visible) {
      setStep('terms');
      setStrokes([]);
    }
  }, [visible]);

  const signatureResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onShouldBlockNativeResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const point = pointFromEvent(event);

        if (point) {
          setStrokes((current) => [...current, [point]]);
        }
      },
      onPanResponderMove: (event) => {
        const point = pointFromEvent(event);

        if (!point) {
          return;
        }

        setStrokes((current) => {
          const activeStroke = current[current.length - 1];

          if (!activeStroke) {
            return [[point]];
          }

          const previousPoint = activeStroke[activeStroke.length - 1];

          if (!previousPoint || !isMeaningfulMove(previousPoint, point)) {
            return current;
          }

          const next = current.slice();
          next[next.length - 1] = [...activeStroke, point];
          return next;
        });
      },
    }),
  ).current;

  const handleSubmit = () => {
    if (!hasSignature) {
      return;
    }

    onSubmit(JSON.stringify(strokes));
  };

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View className="flex-1 bg-[#0B1220]/55">
        <View
          className="mt-auto max-h-[94%] overflow-hidden rounded-t-[34px] bg-background"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <View className="flex-row items-center gap-3 border-b border-border bg-surface px-5 pb-4 pt-5">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-muted">
              <FileSignature size={21} color="#346EF6" strokeWidth={2.4} />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-[19px] font-black text-foreground">
                {step === 'terms' ? 'Terms and Conditions' : 'Customer Signature'}
              </Text>
              <Text className="mt-1 text-[12px] font-semibold text-muted-foreground">
                {step === 'terms'
                  ? 'Review all rental conditions before signing.'
                  : 'Agreement to these terms requires your signature.'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close terms and conditions"
              accessibilityRole="button"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full bg-muted">
              <X size={19} color="#17315F" strokeWidth={2.5} />
            </Pressable>
          </View>

          {step === 'terms' ? (
            <>
              <ScrollView className="px-5" showsVerticalScrollIndicator>
                <View className="pb-6 pt-5">
                  {TERMS_SECTIONS.map((section, sectionIndex) => (
                    <View className={sectionIndex === 0 ? '' : 'mt-5'} key={section.title}>
                      <View className="mb-3 rounded-[18px] bg-foreground px-4 py-3">
                        <Text className="text-[13px] font-black leading-5 text-surface">{section.title}</Text>
                      </View>
                      {section.terms.map((term, termIndex) => (
                        <View
                          className="mb-3 flex-row items-start gap-3 rounded-[22px] border border-border bg-surface p-4"
                          key={term.title}>
                          <View className="h-7 w-7 items-center justify-center rounded-full bg-muted">
                            <Text className="text-[11px] font-black text-primary">{termIndex + 1}</Text>
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text className="text-[13px] font-bold leading-5 text-foreground">{term.title}</Text>
                            {term.details?.map((detail) => (
                              <View className="mt-2 flex-row items-start gap-2" key={detail}>
                                <CheckCircle2 size={14} color="#159947" strokeWidth={2.4} />
                                <Text className="min-w-0 flex-1 text-[12px] font-semibold leading-5 text-[#5D6B82]">
                                  {detail}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
              <View className="border-t border-border bg-surface px-5 pt-4">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep('signature')}
                  className="min-h-[58px] items-center justify-center rounded-full bg-primary">
                  <Text className="text-[15px] font-black text-surface">Sign</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View className="px-5 pb-2 pt-5">
              <View className="rounded-[24px] border border-border bg-surface p-4">
                <Text className="text-[13px] font-black text-foreground">Draw your signature below</Text>
                <Text className="mt-1 text-[12px] font-semibold leading-5 text-muted-foreground">
                  Use your finger to sign. Submitting confirms that you have read and agree to all rental terms.
                </Text>
                <View
                  {...signatureResponder.panHandlers}
                  collapsable={false}
                  className="mt-4 h-[240px] overflow-hidden rounded-[20px] border border-dashed border-[#AFC5FF] bg-[#FBFCFF]">
                  <Svg height="100%" pointerEvents="none" width="100%">
                    {strokes.map((stroke, index) =>
                      stroke.length > 1 ? (
                        <Path
                          d={strokeToPath(stroke)}
                          fill="none"
                          key={`signature-stroke-${index}`}
                          stroke="#17315F"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                        />
                      ) : null,
                    )}
                  </Svg>
                  <View pointerEvents="none" className="absolute bottom-10 left-5 right-5 h-px bg-[#C8D4E8]" />
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStrokes([])}
                  className="mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-full border border-border bg-background">
                  <Eraser size={17} color="#346EF6" strokeWidth={2.4} />
                  <Text className="text-[13px] font-black text-primary">Clear Signature</Text>
                </Pressable>
              </View>

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep('terms')}
                  className="min-h-[56px] flex-1 items-center justify-center rounded-full border border-border bg-surface">
                  <Text className="text-[14px] font-black text-foreground">Review Terms</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !hasSignature }}
                  disabled={!hasSignature}
                  onPress={handleSubmit}
                  className={`min-h-[56px] flex-1 items-center justify-center rounded-full ${
                    hasSignature ? 'bg-primary' : 'bg-[#C8D4E8]'
                  }`}>
                  <Text className="text-[14px] font-black text-surface">Submit</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
