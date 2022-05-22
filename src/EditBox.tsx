import * as React from "react";
import { ImageSourcePropType, StyleSheet, View } from "react-native";
import { PanGestureHandler, PanGestureHandlerGestureEvent } from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { BOX_BORDER, BOX_INDICATOR_BORDER, BOX_INDICATOR_SIZE } from "./constants";
import Gridlines from "./Gridlines";

export type RotationAngles = -270 | -180 | -90 | 90 | 180 | 270;

export type Adjustments = {
  rotate: number;
  flipHorizontal: boolean;
  originX: number;
  originY: number;
  width: number;
  height: number;
};

interface Source {
  source: ImageSourcePropType;
}

interface EditBoxProps {
  gridlines?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  source: Source & { height: number; width: number };
}

interface EditBoxRefMethods {
  calculateAdjustments: () => Adjustments;
  flip: () => void;
  reset: () => void;
  rotate: (degrees: RotationAngles) => void;
}

interface GestureEventContext extends Record<string, unknown> {
  topY: number;
  bottomY: number;
  leftX: number;
  rightX: number;
  verticalMode: "top" | "bottom" | null;
  horizontalMode: "left" | "right" | null;
}

interface Bounds {
  topY: number;
  bottomY: number;
  leftX: number;
  rightX: number;
}

function createBoundsValues(initialBounds: Bounds) {
  return {
    topY: useSharedValue(initialBounds.topY),
    bottomY: useSharedValue(initialBounds.bottomY),
    leftX: useSharedValue(initialBounds.leftX),
    rightX: useSharedValue(initialBounds.rightX),
  };
}

function EditBox({ gridlines = true, maxWidth, maxHeight, source }: EditBoxProps, ref: React.Ref<EditBoxRefMethods>) {
  const aspectRatio = source.width / source.height;

  let imageWidth = (undefined !== maxWidth ? Math.min(maxWidth, source.width) : source.width) - 2 * BOX_BORDER;
  let imageHeight = imageWidth / aspectRatio;

  if (undefined !== maxHeight && imageHeight + 2 * BOX_BORDER > maxHeight) {
    imageHeight = maxHeight - 2 * BOX_BORDER;
    imageWidth = imageHeight * aspectRatio;
  }

  const initialBounds: Bounds = {
    topY: -BOX_INDICATOR_BORDER + BOX_BORDER,
    bottomY: imageHeight - BOX_INDICATOR_SIZE + BOX_INDICATOR_BORDER + BOX_BORDER,
    leftX: -BOX_INDICATOR_BORDER + BOX_BORDER,
    rightX: imageWidth - BOX_INDICATOR_SIZE + BOX_INDICATOR_BORDER + BOX_BORDER,
  };

  const isActive = useSharedValue(false);
  const rotationZ = useSharedValue(0);
  const rotationY = useSharedValue(0);
  const scale = useSharedValue(1);

  const currentBounds = createBoundsValues(initialBounds);
  const boundingBoxRect = createBoundsValues(initialBounds);

  const resetBoundingBox = () => {
    boundingBoxRect.topY.value = withTiming(initialBounds.topY);
    boundingBoxRect.bottomY.value = withTiming(initialBounds.bottomY);
    boundingBoxRect.leftX.value = withTiming(initialBounds.leftX);
    boundingBoxRect.rightX.value = withTiming(initialBounds.rightX);
  };

  const resetCurrentBounds = () => {
    currentBounds.topY.value = initialBounds.topY;
    currentBounds.bottomY.value = initialBounds.bottomY;
    currentBounds.leftX.value = initialBounds.leftX;
    currentBounds.rightX.value = initialBounds.rightX;
  };

  const handleOnReset = () => {
    resetCurrentBounds();
    resetBoundingBox();

    rotationZ.value = withTiming(0);
    scale.value = withTiming(1);
  };

  const handleOnRotate = (degrees: RotationAngles) => {
    const isOriginalOrientation = degrees % 180 === 0;

    let nextScale = isOriginalOrientation ? 1 : aspectRatio;
    // Check if scaled and rotated height doesnt exceed max height
    if (undefined !== maxHeight && imageWidth * nextScale > maxHeight) {
      nextScale = maxHeight / imageWidth;
    }

    rotationZ.value = withTiming(degrees);
    scale.value = withTiming(nextScale);

    if (isOriginalOrientation) {
      resetBoundingBox();
      resetCurrentBounds();

      return;
    }

    const horizontal = imageWidth * nextScale - imageHeight;
    const vertical = imageHeight * nextScale - imageWidth;

    const topY = initialBounds.topY - horizontal / 2;
    const bottomY = initialBounds.bottomY + horizontal / 2;
    const leftX = initialBounds.leftX - vertical / 2;
    const rightX = initialBounds.rightX + vertical / 2;

    boundingBoxRect.topY.value = withTiming(topY);
    boundingBoxRect.bottomY.value = withTiming(bottomY);
    boundingBoxRect.leftX.value = withTiming(leftX);
    boundingBoxRect.rightX.value = withTiming(rightX);

    currentBounds.topY.value = topY;
    currentBounds.bottomY.value = bottomY;
    currentBounds.leftX.value = leftX;
    currentBounds.rightX.value = rightX;
  };

  React.useImperativeHandle(ref, () => ({
    calculateAdjustments: () => {
      const rotate = rotationZ.value;

      const indicatorSpace = BOX_INDICATOR_SIZE - 2 * BOX_INDICATOR_BORDER;
      const viewBoxWidth = boundingBoxRect.rightX.value - boundingBoxRect.leftX.value + indicatorSpace;
      const viewBoxHeight = boundingBoxRect.bottomY.value - boundingBoxRect.topY.value + indicatorSpace;

      const viewOriginX = boundingBoxRect.leftX.value - currentBounds.leftX.value;
      const viewOriginY = boundingBoxRect.topY.value - currentBounds.topY.value;

      let actualBoxWidth = (viewBoxWidth / imageWidth) * source.width;
      let actualBoxHeight = (viewBoxHeight / imageHeight) * source.height;

      if (!(rotate % 180 === 0)) {
        const scaledWidth = imageHeight * scale.value;
        const scaledHeight = imageWidth * scale.value;

        actualBoxHeight = (viewBoxHeight / scaledHeight) * source.width;
        actualBoxWidth = (viewBoxWidth / scaledWidth) * source.height;
      }

      return {
        rotate,
        flipHorizontal: rotationY.value === 180,
        originX: (viewOriginX / viewBoxWidth) * actualBoxWidth,
        originY: (viewOriginY / viewBoxHeight) * actualBoxHeight,
        width: actualBoxWidth,
        height: actualBoxHeight,
      };
    },
    flip: () => {
      rotationY.value = (rotationY.value + 180) % 360;
    },
    reset: handleOnReset,
    rotate: handleOnRotate,
  }));

  const gestureHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent, GestureEventContext>({
    onStart: (event, context) => {
      isActive.value = true;

      context.topY = boundingBoxRect.topY.value;
      context.bottomY = boundingBoxRect.bottomY.value;
      context.leftX = boundingBoxRect.leftX.value;
      context.rightX = boundingBoxRect.rightX.value;

      const boxWidth = boundingBoxRect.rightX.value - boundingBoxRect.leftX.value;
      const boxHeight = boundingBoxRect.bottomY.value - boundingBoxRect.topY.value;

      context.verticalMode = event.y <= (1 / 3) * boxHeight ? "top" : event.y >= (2 / 3) * boxHeight ? "bottom" : null;
      context.horizontalMode = event.x <= (1 / 3) * boxWidth ? "left" : event.x >= (2 / 3) * boxWidth ? "right" : null;
    },
    onActive: (event, context) => {
      if (context.verticalMode === "top") {
        boundingBoxRect.topY.value = Math.min(
          Math.max(currentBounds.topY.value, context.topY + event.translationY),
          currentBounds.bottomY.value
        );
      } else if (context.verticalMode === "bottom") {
        boundingBoxRect.bottomY.value = Math.max(
          Math.min(currentBounds.bottomY.value, context.bottomY + event.translationY),
          currentBounds.topY.value
        );
      }

      if (context.horizontalMode === "left") {
        boundingBoxRect.leftX.value = Math.min(
          Math.max(currentBounds.leftX.value, context.leftX + event.translationX),
          currentBounds.rightX.value
        );
      } else if (context.horizontalMode === "right") {
        boundingBoxRect.rightX.value = Math.max(
          Math.min(currentBounds.rightX.value, context.rightX + event.translationX),
          currentBounds.leftX.value
        );
      }
    },
    onFinish: () => {
      isActive.value = false;
    },
  });

  const backgroundImageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotateZ: `${rotationZ.value}deg` }, { rotateY: `${rotationY.value}deg` }],
  }));

  const foregroundImageStyle = useAnimatedStyle(() => ({
    top: -boundingBoxRect.topY.value + initialBounds.topY,
    left: -boundingBoxRect.leftX.value + initialBounds.leftX,
    transform: [{ scale: scale.value }, { rotateZ: `${rotationZ.value}deg` }, { rotateY: `${rotationY.value}deg` }],
  }));

  const boundingBoxStyles = useAnimatedStyle(() => ({
    top: boundingBoxRect.topY.value - initialBounds.topY,
    left: boundingBoxRect.leftX.value - initialBounds.leftX,
    bottom: initialBounds.bottomY - boundingBoxRect.bottomY.value,
    right: initialBounds.rightX - boundingBoxRect.rightX.value,
  }));

  const foregroundImageBoxStyles = useAnimatedStyle(() => ({
    top: boundingBoxRect.topY.value - initialBounds.topY,
    left: boundingBoxRect.leftX.value - initialBounds.leftX,
    bottom: initialBounds.bottomY - boundingBoxRect.bottomY.value,
    right: initialBounds.rightX - boundingBoxRect.rightX.value,
  }));

  const imageDimensions = { height: imageHeight, width: imageWidth };

  return (
    <View style={{ height: imageHeight + 2 * BOX_BORDER, width: imageWidth + 2 * BOX_BORDER }}>
      <Animated.Image
        source={source.source}
        style={[styles.image, styles.backgroundImage, imageDimensions, backgroundImageStyle]}
      />
      <Animated.View style={[styles.imageBoundingBox, foregroundImageBoxStyles]}>
        <Animated.Image source={source.source} style={[styles.image, imageDimensions, foregroundImageStyle]} />
        {gridlines && (
          <Gridlines
            topY={boundingBoxRect.topY}
            bottomY={boundingBoxRect.bottomY}
            leftX={boundingBoxRect.leftX}
            rightX={boundingBoxRect.rightX}
            isActive={isActive}
          />
        )}
      </Animated.View>
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.boundingBox, boundingBoxStyles]}>
          <Animated.View style={[styles.indicator, styles.indicatorTopLeft]} />
          <Animated.View style={[styles.indicator, styles.indicatorTopRight]} />
          <Animated.View style={[styles.indicator, styles.indicatorBottomLeft]} />
          <Animated.View style={[styles.indicator, styles.indicatorBottomRight]} />
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  boundingBox: {
    borderColor: "white",
    borderWidth: BOX_BORDER,
    position: "absolute",
  },
  imageBoundingBox: {
    borderColor: "transparent",
    borderWidth: BOX_BORDER,
    position: "absolute",
    overflow: "hidden",
  },
  backgroundImage: {
    opacity: 0.25,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    top: BOX_BORDER,
    left: BOX_BORDER,
  },
  indicator: {
    position: "absolute",
    height: BOX_INDICATOR_SIZE,
    width: BOX_INDICATOR_SIZE,
  },
  indicatorTopLeft: {
    borderTopColor: "white",
    borderTopWidth: BOX_INDICATOR_BORDER,
    borderStartColor: "white",
    borderStartWidth: BOX_INDICATOR_BORDER,
    top: -BOX_INDICATOR_BORDER,
    left: -BOX_INDICATOR_BORDER,
  },
  indicatorTopRight: {
    borderTopColor: "white",
    borderTopWidth: BOX_INDICATOR_BORDER,
    borderEndColor: "white",
    borderEndWidth: BOX_INDICATOR_BORDER,
    top: -BOX_INDICATOR_BORDER,
    right: -BOX_INDICATOR_BORDER,
  },
  indicatorBottomLeft: {
    borderBottomColor: "white",
    borderBottomWidth: BOX_INDICATOR_BORDER,
    borderStartColor: "white",
    borderStartWidth: BOX_INDICATOR_BORDER,
    bottom: -BOX_INDICATOR_BORDER,
    left: -BOX_INDICATOR_BORDER,
  },
  indicatorBottomRight: {
    borderBottomColor: "white",
    borderBottomWidth: BOX_INDICATOR_BORDER,
    borderEndColor: "white",
    borderEndWidth: BOX_INDICATOR_BORDER,
    bottom: -BOX_INDICATOR_BORDER,
    right: -BOX_INDICATOR_BORDER,
  },
});

export default React.forwardRef(EditBox);
