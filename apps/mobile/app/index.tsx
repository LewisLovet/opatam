import { View, Text } from 'react-native';
import { APP_CONFIG, CATEGORIES } from '@booking-app/shared';
import { colors } from '@booking-app/theme';

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-gray-50 items-center justify-center p-4">
      <Text className="text-3xl font-bold text-gray-900 mb-2">
        {APP_CONFIG.name}
      </Text>
      <Text className="text-lg text-gray-600 mb-6 text-center">
        Plateforme de reservation multi-secteurs
      </Text>
      <View className="bg-primary-500 px-6 py-3 rounded-lg">
        <Text className="text-white font-medium">
          Configuration reussie
        </Text>
      </View>

      <View className="mt-8">
        <Text className="text-sm text-gray-500 text-center mb-2">
          {CATEGORIES.length} categories disponibles
        </Text>
        <Text className="text-xs text-gray-400 text-center">
          Packages: shared, theme, firebase, ui
        </Text>
      </View>
    </View>
  );
}
