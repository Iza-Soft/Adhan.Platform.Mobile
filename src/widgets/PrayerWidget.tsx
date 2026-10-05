import {
  AccessoryWidgetBackground,
  HStack,
  ProgressView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  background,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  kerning,
  lineLimit,
  minimumScaleFactor,
  monospacedDigit,
  opacity,
  padding,
  progressViewStyle,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { WidgetEntry } from '@/domain/widget';

/**
 * Widget-ите за iPhone (етап 8) – по одобрения mockup.
 *
 * Функциите с 'widget' се превеждат в отделен пакет, който върви в разширението на WidgetKit:
 * в тях не може да се ползва нищо извън функцията – всичко идва от props (кадъра от
 * src/domain/widget.ts) и от environment. Компонентите и модификаторите са тези на @expo/ui.
 * Оставащото време е Text с таймер – брои го iOS, без приложението.
 */

export type PrayerWidgetProps = WidgetEntry | { empty: true; emptyText: string };

const PrayerWidget = (props: PrayerWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const GOLD = '#D4A857';
  const TEXT = '#F2EFE8';
  const DIM = 'rgba(242,239,232,0.78)';
  const family = environment.widgetFamily;
  const lock = family === 'accessoryCircular' || family === 'accessoryRectangular' || family === 'accessoryInline';

  if ('empty' in props) {
    return (
      <VStack
        alignment="leading"
        spacing={6}
        modifiers={[
          containerBackground({ type: 'linearGradient', colors: ['#0F1B2D', '#1A2A44'], startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } }, 'widget'),
          widgetURL('adhan://'),
        ]}
      >
        {lock ? null : <Text modifiers={[font({ size: 26, weight: 'bold' }), foregroundStyle(GOLD)]}>أذان</Text>}
        <Text modifiers={[font({ size: lock ? 12 : 13, weight: 'semibold' }), foregroundStyle(lock ? '#FFFFFF' : TEXT)]}>
          {props.emptyText}
        </Text>
      </VStack>
    );
  }

  const e = props;
  const timer = { lower: new Date(e.prevAt), upper: new Date(e.nextAt) };
  const bg = containerBackground(
    { type: 'linearGradient', colors: [...e.colors], startPoint: { x: 0.5, y: 0 }, endPoint: { x: 0.5, y: 1 } },
    'widget',
  );
  const url = widgetURL('adhan://');

  /* ---------------------------------------------------------- заключен екран */
  if (family === 'accessoryInline') {
    return <Text modifiers={[url]}>{`${e.nextName} ${e.shortAt}`}</Text>;
  }

  if (family === 'accessoryCircular') {
    return (
      <ZStack modifiers={[url, containerBackground('#00000000', 'widget')]}>
        <AccessoryWidgetBackground />
        <ProgressView timerInterval={timer} countsDown={false} modifiers={[progressViewStyle('circular')]} />
        <VStack spacing={0}>
          <Text modifiers={[font({ size: 10, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.6)]}>
            {e.nextName.toLocaleUpperCase()}
          </Text>
          <Text modifiers={[font({ size: 15, weight: 'heavy' }), monospacedDigit()]}>{e.nextTime}</Text>
        </VStack>
      </ZStack>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={0} modifiers={[url, containerBackground('#00000000', 'widget'), frame({ maxWidth: 10000, alignment: 'leading' })]}>
        <HStack spacing={6} alignment="firstTextBaseline">
          <Text modifiers={[font({ size: 15, weight: 'heavy' })]}>{`${e.nextName} ${e.nextTime}`}</Text>
          <Text modifiers={[font({ size: 15, weight: 'bold' })]}>{e.nextArabic}</Text>
        </HStack>
        <Text timerInterval={timer} countsDown modifiers={[font({ size: 20, weight: 'heavy' }), monospacedDigit()]} />
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), opacity(0.7), lineLimit(1)]}>
          {`${e.leftLabel} · ${e.place.charAt(0)}${e.place.slice(1).toLocaleLowerCase()}`}
        </Text>
      </VStack>
    );
  }

  /* ---------------------------------------------------------- начален екран */
  const nextBlock = (
    <VStack alignment="leading" spacing={0}>
      <Text modifiers={[font({ size: 26, weight: 'bold' }), foregroundStyle(GOLD)]}>{e.nextArabic}</Text>
      <HStack spacing={0}>
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(DIM)]}>{`${e.nextLabel} · `}</Text>
        <Text modifiers={[font({ size: 13, weight: 'heavy' }), foregroundStyle(TEXT)]}>{e.nextName}</Text>
      </HStack>
      <Text
        timerInterval={timer}
        countsDown
        modifiers={[font({ size: 30, weight: 'heavy' }), monospacedDigit(), foregroundStyle(TEXT), lineLimit(1), minimumScaleFactor(0.7)]}
      />
      <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle(DIM), monospacedDigit()]}>{e.atText}</Text>
    </VStack>
  );

  if (family === 'systemMedium') {
    return (
      <HStack spacing={14} alignment="top" modifiers={[bg, url]}>
        <VStack alignment="leading" spacing={0} modifiers={[frame({ width: 146, alignment: 'leading' })]}>
          <Text modifiers={[font({ size: 10.5, weight: 'bold' }), kerning(1), foregroundStyle(DIM)]}>{e.place}</Text>
          <Spacer />
          {nextBlock}
        </VStack>
        <VStack
          spacing={1}
          modifiers={[
            padding({ vertical: 5, horizontal: 6 }),
            background('rgba(6,10,20,0.32)', shapes.roundedRectangle({ cornerRadius: 14 })),
          ]}
        >
          {e.rows.map((r) => (
            <HStack
              key={r.id}
              modifiers={[
                padding({ vertical: 1, horizontal: 8 }),
                background(r.state === 'now' ? 'rgba(212,168,87,0.16)' : '#00000000', shapes.roundedRectangle({ cornerRadius: 8 })),
              ]}
            >
              <Text
                modifiers={[
                  font({ size: 12.5, weight: r.state === 'now' || r.state === 'next' ? 'heavy' : r.state === 'past' ? 'medium' : 'semibold' }),
                  foregroundStyle(r.state === 'now' ? GOLD : r.state === 'past' ? 'rgba(242,239,232,0.45)' : r.state === 'next' ? TEXT : 'rgba(242,239,232,0.85)'),
                ]}
              >
                {r.name}
              </Text>
              <Spacer />
              <Text
                modifiers={[
                  font({ size: 12.5, weight: r.state === 'now' || r.state === 'next' ? 'heavy' : r.state === 'past' ? 'medium' : 'semibold' }),
                  monospacedDigit(),
                  foregroundStyle(r.state === 'now' ? GOLD : r.state === 'past' ? 'rgba(242,239,232,0.45)' : r.state === 'next' ? TEXT : 'rgba(242,239,232,0.85)'),
                ]}
              >
                {r.time}
              </Text>
            </HStack>
          ))}
        </VStack>
      </HStack>
    );
  }

  // systemSmall
  return (
    <VStack alignment="leading" spacing={0} modifiers={[bg, url]}>
      <HStack alignment="firstTextBaseline">
        <Text modifiers={[font({ size: 24, weight: 'bold' }), foregroundStyle(GOLD)]}>{e.nextArabic}</Text>
        <Spacer />
        <Text modifiers={[font({ size: 9.5, weight: 'bold' }), kerning(1), foregroundStyle(DIM), lineLimit(1)]}>{e.place}</Text>
      </HStack>
      <HStack spacing={5} alignment="firstTextBaseline">
        <Text modifiers={[font({ size: 17, weight: 'heavy' }), foregroundStyle(TEXT)]}>{e.nextName}</Text>
        <Text modifiers={[font({ size: 17, weight: 'medium' }), foregroundStyle(DIM), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.7)]}>
          {e.shortAt}
        </Text>
      </HStack>
      <Spacer />
      <Text
        timerInterval={timer}
        countsDown
        modifiers={[font({ size: 31, weight: 'heavy' }), monospacedDigit(), foregroundStyle(TEXT), lineLimit(1), minimumScaleFactor(0.7)]}
      />
      <Text modifiers={[font({ size: 11.5, weight: 'medium' }), foregroundStyle(DIM), lineLimit(1)]}>{e.untilText}</Text>
    </VStack>
  );
};

/** Вторият кръгъл widget за заключения екран: арабското име и оставащото време. */
const PrayerArabicWidget = (props: PrayerWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  if ('empty' in props) {
    return <Text modifiers={[font({ size: 18, weight: 'bold' }), containerBackground('#00000000', 'widget')]}>أذان</Text>;
  }
  const e = props;
  return (
    <ZStack modifiers={[widgetURL('adhan://'), containerBackground('#00000000', 'widget')]}>
      <AccessoryWidgetBackground />
      <VStack spacing={0}>
        <Text modifiers={[font({ size: 17, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.6)]}>{e.nextArabic}</Text>
        <Text
          timerInterval={{ lower: new Date(e.prevAt), upper: new Date(e.nextAt) }}
          countsDown
          modifiers={[font({ size: 12, weight: 'heavy' }), monospacedDigit(), lineLimit(1), minimumScaleFactor(0.6), padding({ horizontal: 6 })]}
        />
      </VStack>
    </ZStack>
  );
};

export const prayerWidget = createWidget<PrayerWidgetProps>('PrayerWidget', PrayerWidget);
export const prayerArabicWidget = createWidget<PrayerWidgetProps>('PrayerArabicWidget', PrayerArabicWidget);
