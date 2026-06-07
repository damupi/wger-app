import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { fetchExerciseInfo, getEnglishDescription, getEnglishName } from '@/lib/wger';

export default function ExerciseDetailScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const navigation = useNavigation();
  const { width } = useWindowDimensions();

  const { data, isLoading, error } = useQuery({
    queryKey: ['exercise', exerciseId],
    queryFn: () => fetchExerciseInfo(Number(exerciseId)),
  });

  useEffect(() => {
    if (data) navigation.setOptions({ title: getEnglishName(data) });
  }, [data, navigation]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load exercise</Text>
      </View>
    );
  }

  const name = getEnglishName(data);
  const description = getEnglishDescription(data);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{name}</Text>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{data.category?.name}</Text>
      </View>

      {data.images.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
          {data.images.map((img) => (
            <Image
              key={img.id}
              source={{ uri: `http://192.168.0.11:8009${img.image}` }}
              style={styles.image}
              resizeMode="contain"
            />
          ))}
        </ScrollView>
      )}

      {description ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <RenderHtml
            contentWidth={width - 40}
            source={{ html: description }}
            baseStyle={{ color: '#ccc', fontSize: 15, lineHeight: 22 }}
            tagsStyles={{ p: { marginVertical: 4 } }}
          />
        </View>
      ) : (
        <Text style={styles.noDesc}>No description available.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0d0d0d', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#f44' },
  title: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginBottom: 8 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1a3d1a',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 16,
  },
  badgeText: { color: '#4CAF50', fontSize: 12, fontWeight: '600' },
  imageScroll: { marginBottom: 16 },
  image: { width: 200, height: 160, borderRadius: 10, marginRight: 10, backgroundColor: '#1a1a1a' },
  section: { marginTop: 8 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  noDesc: { color: '#666', fontStyle: 'italic', marginTop: 16 },
});
