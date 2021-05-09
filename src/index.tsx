import * as React from "react";
import {
  ActivityIndicator,
  Image,
  ImageURISource,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { PADDING_HORIZONTAL, SCREEN_WIDTH } from "./constants";
import CropperBox from "./CropperBox";
import fetchImageDimensions from "./fetch-image-dimensions";

interface ImageCropperProps {
  source: ImageURISource;
}

export default function ImageCropper({ source }: ImageCropperProps) {
  const cropperBoxRef = React.useRef<typeof CropperBox>();
  const [hasDimensions, setHasDimensions] = React.useState(false);
  const [dimensions, setDimensions] = React.useState({ height: 0, width: 0 });

  React.useEffect(() => {
    fetchImageDimensions(source)
      .then(result => {
        setDimensions(result);
        setHasDimensions(true);
      })
      .catch(() => {
        setDimensions({ height: 0, width: 0 });
        setHasDimensions(false);
      });
  }, [source]);

  const handleOnReset = () => {
    cropperBoxRef.current?.reset();
  };

  return (
    <View style={styles.page}>
      {false !== hasDimensions && (
        <Image blurRadius={28} resizeMode="cover" source={source} style={styles.backgroundCover} />
      )}
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={styles.safeArea}>
          <View style={styles.content}>
            {false === hasDimensions ? (
              <ActivityIndicator color="white" />
            ) : (
              <CropperBox ref={cropperBoxRef} dimensions={dimensions} source={source} />
            )}
          </View>
          <Pressable onPress={handleOnReset} style={styles.resetButton}>
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <View style={styles.bottomButtons}>
            <Text style={styles.bottomButtonText}>Cancel</Text>
            <Text style={styles.bottomButtonText}>Done</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  backgroundCover: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: "100%",
    opacity: 0.1,
  },
  bottomButtons: {
    backgroundColor: "rgb(56, 56, 56)",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: PADDING_HORIZONTAL,
    paddingVertical: 10,
  },
  bottomButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  container: {
    flex: 1,
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  resetButton: {
    alignItems: "center",
    paddingBottom: 15,
  },
  resetText: {
    color: "white",
    fontSize: 16,
  },
  page: {
    backgroundColor: "rgb(56, 56, 56)",
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
});
