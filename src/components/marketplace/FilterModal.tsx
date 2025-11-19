import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SearchFilters } from '../../services/search';
import {
  getCountries,
  getCountryName,
  getStatesByCountry,
  getStateName,
  getCitySuggestions,
} from '../../utils/locationData';

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
  const [showCountryOptions, setShowCountryOptions] = useState(false);
  const [showStateOptions, setShowStateOptions] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [stateSearch, setStateSearch] = useState('');
  const [cityQuery, setCityQuery] = useState(initialFilters.city || '');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    return getCountries().filter((country) =>
      country.name.toLowerCase().includes(query)
    );
  }, [countrySearch]);

  const filteredStates = useMemo(() => {
    if (!filters.country) return [];
    const query = stateSearch.trim().toLowerCase();
    return getStatesByCountry(filters.country).filter((state) =>
      state.name.toLowerCase().includes(query)
    );
  }, [filters.country, stateSearch]);

  const citySuggestions = useMemo(() => {
    if (!filters.state || !showCitySuggestions || cityQuery.length === 0) {
      return [];
    }
    return getCitySuggestions(filters.country || 'US', filters.state, cityQuery);
  }, [filters.country, filters.state, cityQuery, showCitySuggestions]);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    setFilters({});
    setCityQuery('');
    setCountrySearch('');
    setStateSearch('');
    setShowCountryOptions(false);
    setShowStateOptions(false);
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

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Location */}
            <View style={styles.filterSection}>
              <Text style={styles.filterTitle}>Country</Text>
              <TouchableOpacity
                style={styles.selector}
                onPress={() => setShowCountryOptions(!showCountryOptions)}
                activeOpacity={0.8}
              >
                <Text style={styles.selectorText}>
                  {filters.country
                    ? getCountryName(filters.country) || filters.country
                    : 'Select country'}
                </Text>
                <Ionicons
                  name={showCountryOptions ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              {showCountryOptions && (
                <View style={styles.dropdown}>
                  <TextInput
                    style={[styles.input, styles.dropdownSearch]}
                    placeholder="Search country"
                    placeholderTextColor="#808080"
                    value={countrySearch}
                    onChangeText={setCountrySearch}
                  />
                  <ScrollView
                    style={styles.dropdownList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters({ ...filters, country: undefined, state: undefined, city: undefined });
                        setShowCountryOptions(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>Any country</Text>
                    </TouchableOpacity>
                    {filteredCountries.map((country) => (
                      <TouchableOpacity
                        key={country.code}
                        style={styles.dropdownItem}
                          onPress={() => {
                            setFilters({
                              ...filters,
                              country: country.code,
                              state: undefined,
                              city: undefined,
                            });
                            setShowCountryOptions(false);
                            setStateSearch('');
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{country.name}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.filterTitle, { marginTop: 24 }]}>State / Region</Text>
              <TouchableOpacity
                style={[
                  styles.selector,
                  !filters.country && styles.selectorDisabled,
                ]}
                onPress={() => filters.country && setShowStateOptions(!showStateOptions)}
                activeOpacity={filters.country ? 0.8 : 1}
              >
                <Text style={styles.selectorText}>
                  {filters.state && filters.country
                    ? getStateName(filters.country, filters.state) || filters.state
                    : filters.country
                    ? 'Select state'
                    : 'Select country first'}
                </Text>
                <Ionicons
                  name={showStateOptions ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#FFFFFF"
                />
              </TouchableOpacity>
              {showStateOptions && filters.country && (
                <View style={styles.dropdown}>
                  <TextInput
                    style={[styles.input, styles.dropdownSearch]}
                    placeholder="Search state"
                    placeholderTextColor="#808080"
                    value={stateSearch}
                    onChangeText={setStateSearch}
                  />
                  <ScrollView
                    style={styles.dropdownList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFilters({ ...filters, state: undefined, city: undefined });
                        setShowStateOptions(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>Any state</Text>
                    </TouchableOpacity>
                    {filteredStates.map((state) => (
                      <TouchableOpacity
                        key={state.code}
                        style={styles.dropdownItem}
                          onPress={() => {
                            setFilters({
                              ...filters,
                              state: state.code,
                              city: undefined,
                            });
                            setShowStateOptions(false);
                            setStateSearch('');
                          }}
                        >
                          <Text style={styles.dropdownItemText}>{state.name}</Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              <Text style={[styles.filterTitle, { marginTop: 24 }]}>City</Text>
              <TextInput
                style={styles.input}
                placeholder="Start typing to search"
                placeholderTextColor="#808080"
                value={cityQuery}
                onChangeText={(text) => {
                  setCityQuery(text);
                  setShowCitySuggestions(Boolean(text.trim()) && !!filters.state);
                  setFilters({ ...filters, city: text ? text : undefined });
                }}
                onFocus={() => filters.state && setShowCitySuggestions(cityQuery.length > 0)}
                onBlur={() => setShowCitySuggestions(false)}
                editable={!!filters.state}
              />
              {filters.state && showCitySuggestions && citySuggestions.length > 0 && (
                <View style={styles.suggestionBox}>
                  {citySuggestions.map((city) => (
                    <TouchableOpacity
                      key={`${city.state}-${city.name}`}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setCityQuery(city.name);
                        setFilters({ ...filters, city: city.name });
                        setShowCitySuggestions(false);
                      }}
                    >
                      <Text style={styles.suggestionText}>
                        {city.name},{' '}
                        {getStateName(filters.country || 'US', city.state) || city.state}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

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
  selector: {
    backgroundColor: '#181920',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#333333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorDisabled: {
    opacity: 0.4,
  },
  selectorText: {
    fontSize: 15,
    fontFamily: 'Rubik',
    fontWeight: '500',
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
  dropdown: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: '#16171F',
  },
  dropdownSearch: {
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D3A',
    borderRadius: 0,
  },
  dropdownList: {
    maxHeight: 200,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2D3A',
  },
  dropdownItemText: {
    fontSize: 15,
    fontFamily: 'Rubik',
    color: '#FFFFFF',
  },
  suggestionBox: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2D3A',
    backgroundColor: '#16171F',
  },
  suggestionItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1F212B',
  },
  suggestionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Rubik',
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
