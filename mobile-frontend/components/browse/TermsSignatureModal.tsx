import type { LateReturnPolicy } from '@/types/browse';
import { themeColors } from '@/constants/theme';
import { Eraser, X } from 'lucide-react-native';
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
    lateReturn?: boolean;
  }[];
};

const TERMS_SECTIONS: TermsSection[] = [
  {
    title: 'General rental terms',
    terms: [
      {
        title: 'Gasoline must be refilled upon return of the unit to the same level as when it was endorsed.',
      },
      {
        title:
          'Twenty-four (24) hours is the minimum rental period per day. Late returns are charged at the agreed hourly rate:',
        lateReturn: true,
      },
      {
        title: 'Garage pickup and return are free. Delivery is charged at the accepted quote amount. Actual tolls, if incurred, are billed after the rental.',
      },
      {
        title:
          'A rental extension is allowed only after surrendering the unit first and paying the remaining balance.',
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
        title:
          'All transactions, including additional charges, must be completed online. All payments must be made payable to Mr. Alvin N. Macalam.',
      },
      { title: 'A 50% down payment confirms the reservation. The remaining balance must be successfully paid before the rental start date begins. If the deadline is missed, the booking is cancelled and the down payment is forfeited.' },
      { title: 'Customers may request cancellation and provide a reason. The owner decides refund eligibility and amount individually, subject to applicable law. Cancellation does not guarantee a refund.' },
      { title: 'The vehicle is reserved for the agreed rental interval. Pickup may be arranged later within that interval. Late collection does not reduce the price or extend the return deadline.' },
      { title: 'After the entire reserved period ends without collection or an approved cancellation, staff may record a no-show. All rental payments are non-refundable for a no-show, subject to applicable law.' },
    ],
  },
  {
    title: 'Self-drive rentals',
    terms: [
      {
        title: 'For self-drive renters, all damages will be charged to the renter.',
      },
      {
        title:
          'A rental fee will be charged for each day the vehicle cannot be used for business because of repairs.',
      },
      {
        title: 'Physical verification of documentation is required once the vehicle has been delivered.',
      },
      {
        title: 'Clutch damage will be charged PHP 9,000.00.',
      },
      {
        title:
          'Before operating the vehicle, the renter must complete Jamjade’s staff-controlled telematics handover. Any future mobile monitoring requires clear consent and an authorized trip start.',
      },
    ],
  },
  {
    title: 'Rentals with a driver',
    terms: [
      {
        title:
          "Renting a car with the owner's driver includes an additional daily fee based on travel coverage:",
        details: ['Within Metro Manila: PHP 700.00 per day.', 'Outside Metro Manila: PHP 1,000.00 per day.'],
      },
      {
        title: "The renter is responsible for the driver's accommodations.",
      },
      {
        title: 'The assigned Driver may share the vehicle’s latest location with you and JamJade during the rental after agreeing to location sharing. Sharing starts after staff releases the vehicle and stops when the Driver stops sharing or staff receives the vehicle.',
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
  lateReturnPolicy,
}: {
  lateReturnPolicy: LateReturnPolicy;
  visible: boolean;
  onClose: () => void;
  onSubmit: (signature: string) => void;
}) {
  const termsSections = TERMS_SECTIONS.map((section) => ({ ...section, terms: section.terms.map((term) => term.lateReturn ? { ...term, details: [
    `${lateReturnPolicy.seatBracket === 'up_to_5' ? '5 seats or fewer' : '6 seats or more'}: PHP ${lateReturnPolicy.hourlyRate.toFixed(2)} per late hour for this booking.`,
    'Any late return costs at least one hour. After the first hour, remaining time rounds up only when it exceeds 30 minutes.',
    'Long delays continue hourly without conversion to a daily charge. Physical receipt stops the late clock; charges are reviewed by staff.',
  ] } : term) }));
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
      <View className="flex-1 bg-foreground/55">
        <View
          className="mt-auto max-h-[94%] overflow-hidden rounded-t-sheet bg-surface"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
          <View className="flex-row items-center gap-3 border-b border-border bg-surface px-5 pb-4 pt-5">
            <View className="min-w-0 flex-1">
              <Text
                accessibilityRole="header"
                className="font-sans text-[19px] font-semibold text-foreground">
                {step === 'terms' ? 'Terms and Conditions' : 'Customer Signature'}
              </Text>
              <Text className="font-sans mt-1 text-[12px] font-normal text-secondary-foreground">
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
              <X size={19} color={themeColors.foreground} strokeWidth={2.5} />
            </Pressable>
          </View>

          {step === 'terms' ? (
            <>
              <ScrollView className="px-5" showsVerticalScrollIndicator>
                <View className="pb-6 pt-5">
                  {termsSections.map((section, sectionIndex) => (
                    <View
                      className={sectionIndex === 0 ? '' : 'mt-6 border-t border-border pt-6'}
                      key={section.title}>
                      <Text
                        accessibilityRole="header"
                        className="font-sans mb-4 text-section font-semibold text-foreground">
                        {section.title}
                      </Text>
                      {section.terms.map((term, termIndex) => (
                        <View className="mb-3 flex-row items-start gap-2" key={term.title}>
                          <Text
                            accessible={false}
                            className="font-sans min-w-[24px] text-body leading-6 text-secondary-foreground">
                            {termIndex + 1}.
                          </Text>
                          <View className="min-w-0 flex-1">
                            <Text className="font-sans text-body leading-6 text-foreground">
                              {term.title}
                            </Text>
                            {term.details?.map((detail) => (
                              <View className="mt-2 flex-row items-start gap-2" key={detail}>
                                <Text
                                  accessible={false}
                                  className="font-sans text-body leading-6 text-secondary-foreground">
                                  –
                                </Text>
                                <Text className="font-sans min-w-0 flex-1 text-body leading-6 text-secondary-foreground">
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
                  <Text className="font-sans text-[15px] font-semibold text-surface">Sign</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View className="px-5 pb-2 pt-5">
              <View>
                <Text className="font-sans text-[13px] font-semibold text-foreground">
                  Draw your signature below
                </Text>
                <Text className="font-sans mt-1 text-[12px] font-normal leading-5 text-secondary-foreground">
                  Use your finger to sign. Submitting confirms that you have read and agree to all rental
                  terms.
                </Text>
                <View
                  {...signatureResponder.panHandlers}
                  collapsable={false}
                  className="mt-4 h-[240px] overflow-hidden rounded-[20px] border border-dashed border-[#AFC5FF] bg-background">
                  <Svg height="100%" pointerEvents="none" width="100%">
                    {strokes.map((stroke, index) =>
                      stroke.length > 1 ? (
                        <Path
                          d={strokeToPath(stroke)}
                          fill="none"
                          key={`signature-stroke-${index}`}
                          stroke={themeColors.foreground}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                        />
                      ) : null,
                    )}
                  </Svg>
                  <View
                    pointerEvents="none"
                    className="absolute bottom-10 left-5 right-5 h-px bg-[#C8D4E8]"
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStrokes([])}
                  className="mt-3 min-h-[44px] flex-row items-center justify-center gap-2 rounded-full border border-border bg-background">
                  <Eraser size={17} color={themeColors.primary} strokeWidth={2.4} />
                  <Text className="font-sans text-[13px] font-semibold text-primary">Clear Signature</Text>
                </Pressable>
              </View>

              <View className="mt-5 flex-row gap-3">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setStep('terms')}
                  className="min-h-[56px] flex-1 items-center justify-center rounded-full border border-border bg-surface">
                  <Text className="font-sans text-[14px] font-semibold text-foreground">Review Terms</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !hasSignature }}
                  disabled={!hasSignature}
                  onPress={handleSubmit}
                  className={`min-h-[56px] flex-1 items-center justify-center rounded-full ${
                    hasSignature ? 'bg-primary' : 'bg-[#C8D4E8]'
                  }`}>
                  <Text className="font-sans text-[14px] font-semibold text-surface">Submit</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}
