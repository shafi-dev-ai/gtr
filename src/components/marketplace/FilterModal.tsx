import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchFilters } from '../../services/search';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: SearchFilters) => void;
  initialFilters?: SearchFilters;
}

const GT_R_MODELS = [
  'Nissan GT-R R35',
  'Nissan GT-R R34',
  'Nissan GT-R R33',
  'Nissan GT-R R32',
  'Nissan GT-R Nismo',
];

const CONDITIONS = ['Excellent', 'Very Good', 'Good', 'Fair'];
const TRANSMISSIONS = ['6-Speed Dual Clutch', '6-Speed Manual', '5-Speed Manual'];

export const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters = {},
}) => {
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({});
    onApply({});
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Filters</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Model Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Model</Text>
              <View style={styles.chipContainer}>
                {GT_R_MODELS.map((model) => (
                  <TouchableOpacity
                    key={model}
                    style={[
                      styles.chip,
                      filters.model === model && styles.chipActive,
                    ]}
                    onPress={() =>
                      setFilters({ ...filters, model: filters.model === model ? undefined : model })
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filters.model === model && styles.chipTextActive,
                      ]}
                    >
                      {model.replace('Nissan GT-R ', '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Price Range</Text>
              <View style={styles.rangeContainer}>
                <View style={styles.rangeInput}>
                  <Text style={styles.rangeLabel}>Min</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#808080"
                    keyboardType="numeric"
                    value={filters.priceMin?.toString()}
                    onChangeText={(text) =>
                      setFilters({ ...filters, priceMin: text ? parseFloat(text) : undefined })
                    }
                  />
                </View>
                <View style={styles.rangeInput}>
                  <Text style={styles.rangeLabel}>Max</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="500000"
                    placeholderTextColor="#808080"
                    keyboardType="numeric"
                    value={filters.priceMax?.toString()}
                    onChangeText={(text) =>
                      setFilters({ ...filters, priceMax: text ? parseFloat(text) : undefined })
                    }
                  />
                </View>
              </View>
            </View>

            {/* Year Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Year Range</Text>
              <View style={styles.rangeContainer}>
                <View style={styles.rangeInput}>
                  <Text style={styles.rangeLabel}>Min</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1990"
                    placeholderTextColor="#808080"
                    keyboardType="numeric"
                    value={filters.yearMin?.toString()}
                    onChangeText={(text) =>
                      setFilters({ ...filters, yearMin: text ? parseInt(text) : undefined })
                    }
                  />
                </View>
                <View style={styles.rangeInput}>
                  <Text style={styles.rangeLabel}>Max</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2024"
                    placeholderTextColor="#808080"
                    keyboardType="numeric"
                    value={filters.yearMax?.toString()}
                    onChangeText={(text) =>
                      setFilters({ ...filters, yearMax: text ? parseInt(text) : undefined })
                    }
                  />
                </View>
              </View>
            </View>

            {/* Condition */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Condition</Text>
              <View style={styles.chipContainer}>
                {CONDITIONS.map((condition) => (
                  <TouchableOpacity
                    key={condition}
                    style={[
                      styles.chip,
                      filters.condition === condition && styles.chipActive,
                    ]}
                    onPress={() =>
                      setFilters({
                        ...filters,
                        condition: filters.condition === condition ? undefined : condition,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filters.condition === condition && styles.chipTextActive,
                      ]}
                    >
                      {condition}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Transmission */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Transmission</Text>
              <View style={styles.chipContainer}>
                {TRANSMISSIONS.map((transmission) => (
                  <TouchableOpacity
                    key={transmission}
                    style={[
                      styles.chip,
                      filters.transmission === transmission && styles.chipActive,
                    ]}
                    onPress={() =>
                      setFilters({
                        ...filters,
                        transmission: filters.transmission === transmission ? undefined : transmission,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filters.transmission === transmission && styles.chipTextActive,
                      ]}
                    >
                      {transmission.replace('-Speed ', '')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1F222A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Rubik',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    maxHeight: 500,
    paddingHorizontal: 24,
  },
  filterSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#181920',
    borderWidth: 1,
    borderColor: '#333333',
  },
  chipActive: {
    backgroundColor: '#DC143C',
    borderColor: '#DC143C',
  },
  chipText: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '500',
    color: '#FFFFFF',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  rangeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  rangeInput: {
    flex: 1,
  },
  rangeLabel: {
    fontSize: 14,
    fontFamily: 'Rubik',
    fontWeight: '500',
    color: '#808080',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#181920',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '400',
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#333333',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
  applyButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#DC143C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik',
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

