import {
  Camera,
  GeoJSONSource,
  Layer,
  Map as MapView,
  Marker,
  type CameraRef,
  type LngLatBounds,
} from '@maplibre/maplibre-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { NearMosque } from '@/domain/mosques';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

import { MosqueIcon } from '../icons';

import type { MosqueMapProps } from './mapTypes';

/**
 * Картата на джамиите (етап 12): MapLibre + OpenFreeMap (тъмен стил, без ключ и без Google –
 * работи и на Huawei). Най-близките джамии са с икона, останалите – златни точки.
 * Картата не се завърта (север е горе) – стрелките в списъка сочат спрямо север.
 */
const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
/** Толкова най-близки джамии са с икона (истински изгледи); останалите – слой с точки (бързо). */
const ICON_PINS = 20;

export function MosqueMap({ center, me, mosques, selectedId, onSelect, recenter, bottomInset, attribution, label }: MosqueMapProps) {
  const camera = useRef<CameraRef>(null);
  const [ready, setReady] = useState(false);

  const selected = mosques.find((m) => m.id === selectedId) ?? null;
  const pins = mosques.slice(0, ICON_PINS);
  const dots = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: 'FeatureCollection',
      features: mosques.slice(ICON_PINS).map((m) => ({
        type: 'Feature',
        id: m.id,
        properties: { id: m.id },
        geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
      })),
    }),
    [mosques],
  );

  // камерата: избраната джамия отблизо; иначе – ти и най-близките джамии
  useEffect(() => {
    const cam = camera.current;
    if (!ready || !cam) return;
    const padding = { top: 90, bottom: bottomInset + 30, left: 40, right: 40 };
    if (selected) {
      cam.easeTo({ center: [selected.lon, selected.lat], zoom: 16, padding: { ...padding, top: 60 }, duration: 600 });
      return;
    }
    const near = mosques.slice(0, 5);
    if (near.length === 0) {
      cam.easeTo({ center: [center.lon, center.lat], zoom: 14, padding, duration: 600 });
      return;
    }
    cam.fitBounds(boundsOf([center, ...near]), { padding, duration: 600 });
  }, [ready, selected, mosques, center, recenter, bottomInset]);

  return (
    <View style={StyleSheet.absoluteFill} accessible accessibilityLabel={label}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={STYLE_URL}
        attribution={false}
        logo={false}
        compass={false}
        touchRotate={false}
        touchPitch={false}
        onDidFinishLoadingMap={() => setReady(true)}
      >
        <Camera ref={camera} initialViewState={{ center: [center.lon, center.lat], zoom: 14 }} minZoom={9} maxZoom={18.5} />

        <GeoJSONSource
          id="mosques"
          data={dots}
          onPress={(e) => {
            const id = e.nativeEvent.features[0]?.properties?.id;
            if (typeof id === 'string') onSelect(id);
          }}
        >
          <Layer
            type="circle"
            id="mosque-dots"
            paint={{
              'circle-radius': 6,
              'circle-color': colors.gold,
              'circle-opacity': 0.85,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': colors.goldInk,
            }}
          />
        </GeoJSONSource>

        {pins.map((m) => (
          <Marker key={m.id} id={m.id} lngLat={[m.lon, m.lat]} onPress={() => onSelect(m.id)} selected={m.id === selectedId}>
            <Pin mosque={m} selected={m.id === selectedId} nearest={m === mosques[0]} />
          </Marker>
        ))}
        {selected && !pins.includes(selected) && (
          <Marker key={`sel-${selected.id}`} lngLat={[selected.lon, selected.lat]} selected>
            <Pin mosque={selected} selected nearest={false} />
          </Marker>
        )}

        {me && (
          <Marker key="me" lngLat={[me.lon, me.lat]}>
            <View style={styles.meHalo}>
              <View style={styles.me} />
            </View>
          </Marker>
        )}
      </MapView>
      <View style={[styles.attributionBox, { bottom: bottomInset + 6 }]} pointerEvents="none">
        <Text style={styles.attribution}>{attribution}</Text>
      </View>
    </View>
  );
}

function Pin({ selected, nearest }: { mosque: NearMosque; selected: boolean; nearest: boolean }) {
  const size = selected ? 36 : nearest ? 30 : 26;
  return (
    <View
      style={[
        styles.pin,
        { width: size, height: size, borderRadius: size / 2 },
        selected && styles.pinSelected,
        !selected && !nearest && styles.pinDim,
      ]}
    >
      <MosqueIcon size={selected ? 20 : 15} color={colors.goldInk} strokeWidth={2} />
    </View>
  );
}

function boundsOf(points: { lat: number; lon: number }[]): LngLatBounds {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lon);
    e = Math.max(e, p.lon);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [w, s, e, n];
}

const styles = StyleSheet.create({
  pin: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: 'rgba(26,20,8,0.6)',
  },
  pinSelected: { borderWidth: 4, borderColor: 'rgba(212,168,87,0.35)' },
  pinDim: { backgroundColor: 'rgba(212,168,87,0.88)' },
  meHalo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(120,190,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  me: { width: 13, height: 13, borderRadius: 7, backgroundColor: '#6FB6FF', borderWidth: 2.5, borderColor: colors.text },
  attributionBox: { position: 'absolute', left: 10 },
  attribution: {
    fontFamily: fonts.medium,
    fontSize: 9.5,
    color: 'rgba(242,239,232,0.6)',
  },
});
