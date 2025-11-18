import { createNavigationContainerRef } from '@react-navigation/native';

type GenericParamList = Record<string, object | undefined>;

export const navigationRef = createNavigationContainerRef<GenericParamList>();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

