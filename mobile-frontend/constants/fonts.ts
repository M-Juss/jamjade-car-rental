import fontFamilies from './font-families.json';

export { fontFamilies };

export const mobileFontAssets = {
  [fontFamilies.regular]: require('../assets/fonts/urbanist/Urbanist-Regular.ttf'),
  [fontFamilies.medium]: require('../assets/fonts/urbanist/Urbanist-Medium.ttf'),
  [fontFamilies.semibold]: require('../assets/fonts/urbanist/Urbanist-SemiBold.ttf'),
  [fontFamilies.bold]: require('../assets/fonts/urbanist/Urbanist-Bold.ttf'),
  [fontFamilies.extrabold]: require('../assets/fonts/urbanist/Urbanist-ExtraBold.ttf'),
  [fontFamilies.black]: require('../assets/fonts/urbanist/Urbanist-Black.ttf'),
};
