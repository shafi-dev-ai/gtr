import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SearchBarProps {
  placeholder?: string;
  onPress?: () => void;
  onFocus?: () => void;
  value?: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  onSubmitEditing?: () => void;
  noMargin?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search',
  onPress,
  onFocus,
  value,
  onChangeText,
  editable = true,
  onSubmitEditing,
  noMargin = false,
}) => {
  const containerStyle = noMargin ? [styles.container, styles.containerNoMargin] : styles.container;

  // If editable and has onChangeText, show TextInput
  // Otherwise, show TouchableOpacity for navigation
  if (editable && onChangeText) {
    return (
      <View style={containerStyle}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder={placeholder}
            placeholderTextColor="#8E8E93"
            value={value}
            onChangeText={onChangeText}
            onFocus={onFocus}
            editable={editable}
            returnKeyType="search"
            onSubmitEditing={onSubmitEditing}
          />
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
    >
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color="#8E8E93" style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#8E8E93"
          value={value}
          editable={false}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  containerNoMargin: {
    marginBottom: 0,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#282A2E',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#333333',
  },
  icon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    padding: 0,
  },
});

