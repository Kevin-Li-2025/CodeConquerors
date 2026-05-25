import React from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppTheme } from '@/constants/theme';

export type SearchSuggestion = {
  id: string;
  title: string;
  subtitle?: string;
};

type SearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  onClear: () => void;
  suggestions?: SearchSuggestion[];
  onSuggestionPress?: (suggestion: SearchSuggestion) => void;
};

export default function SearchBar({
  value,
  onChangeText,
  onSubmitEditing,
  onClear,
  suggestions = [],
  onSuggestionPress,
}: SearchBarProps) {
  const showSuggestions = suggestions.length > 0 && typeof onSuggestionPress === 'function';

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <Ionicons name="search-outline" size={22} color={AppTheme.color.textSubtle} />

        <TextInput
          style={styles.input}
          placeholder="Search destination in Birmingham…"
          placeholderTextColor={AppTheme.color.textSubtle}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          returnKeyType="search"
        />

        {value.trim().length > 0 && (
          <TouchableOpacity onPress={onClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={22} color={AppTheme.color.textSubtle} />
          </TouchableOpacity>
        )}
      </View>

      {showSuggestions && (
        <ScrollView
          style={styles.suggestionsContainer}
          contentContainerStyle={styles.suggestionsContent}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map((suggestion, index) => (
            <TouchableOpacity
              key={suggestion.id}
              style={[
                styles.suggestionItem,
                index === suggestions.length - 1 && styles.suggestionItemLast,
              ]}
              onPress={() => onSuggestionPress(suggestion)}
            >
              <Ionicons name="location-outline" size={18} color={AppTheme.color.primary} />

              <View style={styles.suggestionTextContainer}>
                <Text style={styles.suggestionTitle} numberOfLines={1}>
                  {suggestion.title}
                </Text>

                {!!suggestion.subtitle && (
                  <Text style={styles.suggestionSubtitle} numberOfLines={2}>
                    {suggestion.subtitle}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 58,
    left: AppTheme.space.lg,
    right: 84,
    zIndex: 20,
  },

  container: {
    height: 56,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.pill,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppTheme.space.lg,
    ...AppTheme.shadow.card,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    color: AppTheme.color.text,
    ...AppTheme.type.body,
  },

  clearButton: {
    marginLeft: 8,
    padding: 2,
  },

  suggestionsContainer: {
    marginTop: 8,
    maxHeight: 260,
    backgroundColor: AppTheme.color.surface,
    borderRadius: AppTheme.radius.lg,
    borderWidth: 1,
    borderColor: AppTheme.color.border,
    ...AppTheme.shadow.floating,
  },

  suggestionsContent: {
    paddingVertical: 6,
  },

  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: AppTheme.space.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.color.border,
  },

  suggestionItemLast: {
    borderBottomWidth: 0,
  },

  suggestionTextContainer: {
    flex: 1,
    marginLeft: 10,
  },

  suggestionTitle: {
    color: AppTheme.color.text,
    ...AppTheme.type.cardTitle,
  },

  suggestionSubtitle: {
    marginTop: 2,
    color: AppTheme.color.textMuted,
    ...AppTheme.type.meta,
  },
});
