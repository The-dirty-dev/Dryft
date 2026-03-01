import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { linkPreviewService, LinkPreviewData } from '../../services/linkPreview';
import { ThemeColors, useColors } from '../../theme/ThemeProvider';

const withAlpha = (color: string, alphaHex: string): string => `${color}${alphaHex}`;

// ============================================================================
// Types
// ============================================================================

interface LinkPreviewProps {
  url: string;
  isSent?: boolean;
  compact?: boolean;
  onPress?: () => void;
}

interface LinkPreviewCardProps {
  data: LinkPreviewData;
  isSent?: boolean;
  compact?: boolean;
  onPress?: () => void;
}

// ============================================================================
// Link Preview Card Component
// ============================================================================

function LinkPreviewCard({ data, isSent = false, compact = false, onPress }: LinkPreviewCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (data.url) {
      Linking.openURL(data.url);
    }
  };

  const domain = linkPreviewService.getDomain(data.url);

  // Compact variant for inline display
  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, isSent && styles.compactCardSent]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        {data.favicon && (
          <Image source={{ uri: data.favicon }} style={styles.compactFavicon} />
        )}
        <View style={styles.compactContent}>
          <Text
            style={[styles.compactTitle, isSent && styles.compactTitleSent]}
            numberOfLines={1}
          >
            {data.title || domain}
          </Text>
          <Text
            style={[styles.compactDomain, isSent && styles.compactDomainSent]}
            numberOfLines={1}
          >
            {domain}
          </Text>
        </View>
        <Ionicons
          name="open-outline"
          size={16}
          color={isSent ? colors.textSecondary : colors.textMuted}
        />
      </TouchableOpacity>
    );
  }

  // Full variant with image
  return (
    <TouchableOpacity
      style={[styles.card, isSent && styles.cardSent]}
      onPress={handlePress}
      activeOpacity={0.9}
    >
      {/* Image */}
      {data.image && (
        <Image
          source={{ uri: data.image }}
          style={styles.image}
          resizeMode="cover"
        />
      )}

      {/* Video Play Button Overlay */}
      {data.type === 'video' && data.image && (
        <View style={styles.playButtonOverlay}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={24} color={colors.text} />
          </View>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Site info */}
        <View style={styles.siteInfo}>
          {data.favicon && (
            <Image source={{ uri: data.favicon }} style={styles.favicon} />
          )}
          <Text style={[styles.siteName, isSent && styles.siteNameSent]}>
            {data.siteName || domain}
          </Text>
        </View>

        {/* Title */}
        {data.title && (
          <Text
            style={[styles.title, isSent && styles.titleSent]}
            numberOfLines={2}
          >
            {data.title}
          </Text>
        )}

        {/* Description */}
        {data.description && (
          <Text
            style={[styles.description, isSent && styles.descriptionSent]}
            numberOfLines={2}
          >
            {data.description}
          </Text>
        )}

        {/* Author / Date */}
        {(data.author || data.publishedDate) && (
          <View style={styles.meta}>
            {data.author && (
              <Text style={[styles.metaText, isSent && styles.metaTextSent]}>
                {data.author}
              </Text>
            )}
            {data.author && data.publishedDate && (
              <Text style={[styles.metaText, isSent && styles.metaTextSent]}>
                {' • '}
              </Text>
            )}
            {data.publishedDate && (
              <Text style={[styles.metaText, isSent && styles.metaTextSent]}>
                {new Date(data.publishedDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// Link Preview Component (with loading state)
// ============================================================================

export function LinkPreview({ url, isSent = false, compact = false, onPress }: LinkPreviewProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchPreview = async () => {
      setIsLoading(true);
      setError(false);

      const preview = await linkPreviewService.getPreview(url);

      if (isMounted) {
        if (preview) {
          setData(preview);
        } else {
          setError(true);
        }
        setIsLoading(false);
      }
    };

    fetchPreview();

    return () => {
      isMounted = false;
    };
  }, [url]);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.loadingCard, isSent && styles.cardSent]}>
        <ActivityIndicator size="small" color={isSent ? colors.text : colors.accent} />
        <Text style={[styles.loadingText, isSent && styles.loadingTextSent]}>
          Loading preview...
        </Text>
      </View>
    );
  }

  // Error state - show simple link
  if (error || !data) {
    return (
      <TouchableOpacity
        style={[styles.errorCard, isSent && styles.errorCardSent]}
        onPress={() => Linking.openURL(url)}
      >
        <Ionicons
          name="link"
          size={16}
          color={isSent ? colors.text : colors.accent}
        />
        <Text
          style={[styles.errorUrl, isSent && styles.errorUrlSent]}
          numberOfLines={1}
        >
          {linkPreviewService.getDomain(url) || url}
        </Text>
        <Ionicons
          name="open-outline"
          size={14}
          color={isSent ? colors.textSecondary : colors.textMuted}
        />
      </TouchableOpacity>
    );
  }

  return <LinkPreviewCard data={data} isSent={isSent} compact={compact} onPress={onPress} />;
}

// ============================================================================
// useLinkDetection Hook
// ============================================================================

export function useLinkDetection(text: string) {
  const [links, setLinks] = useState<string[]>([]);

  useEffect(() => {
    const result = linkPreviewService.detectLinks(text);
    setLinks(result.links);
  }, [text]);

  return {
    hasLinks: links.length > 0,
    links,
    firstLink: links[0] || null,
  };
}

// ============================================================================
// Styles
// ============================================================================

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // Full Card
  card: {
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 12,
    overflow: 'hidden',
    maxWidth: 280,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardSent: {
    backgroundColor: withAlpha(colors.accent, '4D'),
    borderColor: withAlpha(colors.accent, '80'),
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: colors.border,
  },
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.background, '4D'),
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: withAlpha(colors.background, 'B3'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 12,
  },
  siteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  favicon: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  siteName: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
  },
  siteNameSent: {
    color: colors.text,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  titleSent: {
    color: colors.text,
  },
  description: {
    fontSize: 13,
    color: colors.textTertiary,
    lineHeight: 18,
  },
  descriptionSent: {
    color: colors.textSecondary,
  },
  meta: {
    flexDirection: 'row',
    marginTop: 8,
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  metaTextSent: {
    color: colors.textSecondary,
  },

  // Compact Card
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 8,
    padding: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  compactCardSent: {
    backgroundColor: withAlpha(colors.accent, '4D'),
    borderColor: withAlpha(colors.accent, '80'),
  },
  compactFavicon: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  compactTitleSent: {
    color: colors.text,
  },
  compactDomain: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  compactDomainSent: {
    color: colors.textSecondary,
  },

  // Loading State
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  loadingTextSent: {
    color: colors.textSecondary,
  },

  // Error State
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDarkest,
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  errorCardSent: {
    backgroundColor: withAlpha(colors.accent, '4D'),
    borderColor: withAlpha(colors.accent, '80'),
  },
  errorUrl: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
  },
  errorUrlSent: {
    color: colors.text,
  },
});

export default LinkPreview;
