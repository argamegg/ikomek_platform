import { useWindowDimensions } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;

  return {
    isTablet,
    width,
    height,
  };
}

export function getNewsCardSizes(isTablet: boolean) {
  if (isTablet) {
    return {
      borderRadius: 24,
      paddingHorizontal: 20,
      paddingVertical: 20,
      gap: 16,
      shadowOffsetHeight: 12,
      shadowRadius: 24,
      elevation: 4,
      sideAccentWidth: 5,
      sideAccentInset: 20,
      headerGap: 14,
      iconWrapSize: 56,
      iconWrapRadius: 18,
      iconSize: 24,
      typeLabelSize: 18,
      typeLabelLineHeight: 22,
      dateLabelSize: 12,
      categoryChipHorizontal: 12,
      categoryChipVertical: 7,
      categoryChipTextSize: 11,
      typeBadgeGap: 6,
      typeBadgeHorizontal: 10,
      typeBadgeVertical: 6,
      typeDotSize: 8,
      typeDotTextSize: 11,
      typeIconSize: 13,
      titleSize: 18,
      titleLineHeight: 23,
      previewSize: 13,
      previewLineHeight: 19,
      footerGap: 12,
      footerIconSize: 13,
      footerTextSize: 11,
    };
  }

  return {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
    shadowOffsetHeight: 10,
    shadowRadius: 20,
    elevation: 3,
    sideAccentWidth: 4,
    sideAccentInset: 16,
    headerGap: 10,
    iconWrapSize: 46,
    iconWrapRadius: 14,
    iconSize: 20,
    typeLabelSize: 16,
    typeLabelLineHeight: 20,
    dateLabelSize: 11,
    categoryChipHorizontal: 10,
    categoryChipVertical: 6,
    categoryChipTextSize: 10,
    typeBadgeGap: 5,
    typeBadgeHorizontal: 8,
    typeBadgeVertical: 5,
    typeDotSize: 7,
    typeDotTextSize: 10,
    typeIconSize: 12,
    titleSize: 16,
    titleLineHeight: 20,
    previewSize: 12,
    previewLineHeight: 17,
    footerGap: 10,
    footerIconSize: 12,
    footerTextSize: 10,
  };
}
