import { AbsoluteFill, Rect, Text, interpolate, useCurrentFrame } from '@kinetographdev/core';
import { loadFont } from '@remotion/google-fonts/Inter';

const { fontFamily } = loadFont('normal', { weights: ['400', '700'] });
const ink = '#17315F', blue = '#346EF6', pale = '#DDE8FF', muted = '#627493';
const label = (x: number, y: number, value: string, size = 24, color = ink) => <Text x={x} y={y} font={fontFamily} size={size} color={color}>{value}</Text>;
const box = (x: number, y: number, width: number, height: number, fill: string, radius = 12) => <Rect x={x} y={y} width={width} height={height} fill={fill} radius={radius} />;

export const Title = () => {
  const frame = useCurrentFrame();
  const scene = Math.min(4, Math.floor(frame / 180));
  const progress = interpolate(frame % 180, [0, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <>
    {box(0, 0, 1280, 720, '#F8FAFF', 0)}
    {box(0, 0, 1280, 9, blue, 0)}
    {label(64, 42, 'JAMJADE', 27, blue)}
    {label(1030, 48, 'PRODUCT DEMO', 15, muted)}
    {scene === 0 && <>
      {label(90, 195, 'Car rental,', 76)}
      {label(90, 285, 'connected.', 76, blue)}
      {label(94, 402, 'One experience for customers and staff.', 26, muted)}
      {box(90, 481, 300 * progress, 6, blue, 3)}
      {box(800, 185, 300, 350, pale, 28)}
      {box(839, 220, 222, 280, '#FFFFFF', 20)}
      {label(864, 256, 'JamJade', 25, blue)}
      {label(864, 320, 'Your rental', 22)}
      {box(864, 370, 172, 66, '#F0F5FF', 12)}
      {label(884, 392, 'On the road', 16)}
    </>}
    {scene === 1 && <>
      {label(80, 175, 'FOR CUSTOMERS', 19, blue)}
      {label(80, 229, 'Find your', 60)}
      {label(80, 300, 'next rental.', 60)}
      {label(82, 405, 'Browse vehicles and request a booking', 24, muted)}
      {label(82, 443, 'from the Android app.', 24, muted)}
      {box(820, 128, 255, 468, ink, 30)}{box(829, 138, 237, 448, '#FFFFFF', 24)}
      {label(850, 165, 'Vehicles', 25)}{label(850, 214, 'Find a vehicle', 17, muted)}
      {box(850, 252, 195, 112, '#EAF1FF', 14)}{label(867, 280, 'SEDAN', 18, blue)}{label(867, 316, 'View details  →', 17)}
      {box(850, 380, 195, 112, '#F4F7FC', 14)}{label(867, 407, 'SUV', 18, blue)}{label(867, 443, 'View details  →', 17)}
      {label(850, 535, 'Illustrative screen', 13, muted)}
    </>}
    {scene === 2 && <>
      {label(80, 175, 'FOR CUSTOMERS', 19, blue)}
      {label(80, 229, 'Keep your rental', 57)}{label(80, 298, 'in view.', 57)}
      {label(82, 405, 'Review booking details, documents', 24, muted)}
      {label(82, 443, 'and rental updates in one place.', 24, muted)}
      {box(820, 128, 255, 468, ink, 30)}{box(829, 138, 237, 448, '#FFFFFF', 24)}
      {label(850, 165, 'My bookings', 24)}{box(850, 225, 195, 205, '#F0F5FF', 14)}
      {label(868, 252, 'Booking details', 19)}{label(868, 297, 'Vehicle', 16, muted)}{label(868, 333, 'Rental dates', 16, muted)}
      {box(868, 372, 130, 34, blue, 9)}{label(883, 380, 'View booking', 15, '#FFFFFF')}
      {label(850, 535, 'Illustrative screen', 13, muted)}
    </>}
    {scene === 3 && <>
      {label(70, 175, 'FOR ADMIN AND STAFF', 19, blue)}
      {label(70, 229, 'Manage the', 57)}{label(70, 298, 'rental workflow.', 57)}
      {label(72, 405, 'Coordinate bookings, vehicles', 24, muted)}
      {label(72, 443, 'and inspections on the web.', 24, muted)}
      {box(675, 160, 525, 350, ink, 16)}{box(683, 168, 509, 326, '#FFFFFF', 10)}
      {box(683, 168, 125, 326, '#F0F5FF', 0)}{label(700, 190, 'JAMJADE', 15, blue)}
      {label(700, 245, 'Dashboard', 14)}{label(700, 282, 'Bookings', 14, blue)}{label(700, 319, 'Vehicles', 14)}
      {label(830, 192, 'Bookings', 25)}{box(830, 242, 335, 50, '#F0F5FF', 8)}
      {label(845, 257, 'Booking', 15, muted)}{label(1030, 257, 'Status', 15, muted)}
      {box(830, 305, 335, 53, '#F8FAFF', 8)}{label(845, 323, 'Rental request', 15)}{label(1030, 323, 'Review', 15, blue)}
      {box(830, 368, 335, 53, '#F8FAFF', 8)}{label(845, 386, 'Upcoming rental', 15)}{label(1030, 386, 'Details', 15, blue)}
      {label(840, 462, 'Illustrative screen', 13, muted)}
    </>}
    {scene === 4 && <>
      {label(90, 220, 'From booking', 68)}{label(90, 302, 'to return.', 68, blue)}
      {label(94, 416, 'JamJade Car Rental', 28)}
      {label(94, 464, 'Customer app  •  Management website', 22, muted)}
      {box(90, 530, 300 * progress, 6, blue, 3)}
    </>}
    {label(65, 670, 'JAMJADE CAR RENTAL', 13, muted)}
    {box(1040, 676, 165, 3, pale, 2)}{box(1040, 676, 165 * frame / 900, 3, blue, 2)}
  </>;
};
