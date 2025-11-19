import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export type TabType = 'home' | 'marketplace' | 'create' | 'explore' | 'profile';

interface BottomNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface TabItem {
  id: TabType;
  label: string;
  icon: string;
  activeIcon: string;
}

const tabs: TabItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: 'home-outline',
    activeIcon: 'home',
  },
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: 'globe-outline',
    activeIcon: 'globe',
  },
  {
    id: 'create',
    label: 'Create',
    icon: 'add-circle-outline',
    activeIcon: 'add-circle',
  },
  {
    id: 'explore',
    label: 'Explore',
    icon: 'compass-outline',
    activeIcon: 'compass',
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: 'person-outline',
    activeIcon: 'person',
  },
];

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
}) => {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.container}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={styles.tab}
              onPress={() => onTabChange(tab.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={24}
                color={isActive ? '#FFFFFF' : '#808080'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  isActive && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#1F222A',
  },
  container: {
    flexDirection: 'row',
    backgroundColor: '#1F222A',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingTop: 8,
    paddingHorizontal: 4,
    justifyContent: 'space-around',
    alignItems: 'center',
    minHeight: 60,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#808080',
    marginTop: 4,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
