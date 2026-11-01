import { useState } from 'react';
import { LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { Card } from '../domain';
import { Language } from '../application/types';
import { HandFit, fitHandCards } from './tableLayout';
import { CardFace } from './CardFace';

type Props = {
  cards: Card[];
  selectedIds: string[];
  legalIds?: Set<string>;
  selectionLegal: boolean | null;
  language: Language;
  disabled?: boolean;
  fit?: HandFit;
  cardMax?: { width: number; height: number };
  onToggle: (cardId: string) => void;
};

export function HandStrip({
  cards,
  selectedIds,
  legalIds,
  selectionLegal,
  language,
  disabled,
  fit = fitHandCards(cards.length, 900),
  cardMax,
  onToggle,
}: Props) {
  const [boxW, setBoxW] = useState(0);
  const resolved = boxW > 0 ? fitHandCards(cards.length, boxW, cardMax) : fit;
  const mid = (cards.length - 1) / 2;
  const tiltStep = 0.8;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      onLayout={(event: LayoutChangeEvent) => setBoxW(event.nativeEvent.layout.width)}
      contentContainerStyle={[styles.row, styles.rowCenter, { paddingTop: resolved.lift }]}
      style={styles.scroller}
    >
      {cards.map((card, index) => {
        const selected = selectedIds.includes(card.id);
        const dimmed = legalIds ? !legalIds.has(card.id) && !selected : false;
        const tilt = (index - mid) * tiltStep;
        const arc = Math.abs(index - mid) * 0.8;
        const last = index === cards.length - 1;
        const stride = last ? resolved.width : resolved.width - resolved.overlap;
        return (
          <View
            key={card.id}
            style={[
              styles.slot,
              dimmed && styles.dimmed,
              {
                width: stride,
                zIndex: index,
                marginTop: arc,
                transform: [{ translateY: selected ? -resolved.lift : 0 }],
              },
            ]}
          >
            <CardFace
              card={card}
              selected={selected}
              legal={selected ? selectionLegal : null}
              language={language}
              disabled={disabled}
              width={resolved.width}
              height={resolved.height}
              hitWidth={stride}
              tilt={selected ? 0 : tilt}
              liftOnSelect={false}
              sharedLayout={false}
              onPress={() => onToggle(card.id)}
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroller: {
    overflow: 'visible',
  },
  row: {
    paddingHorizontal: 10,
    paddingBottom: 0,
    alignItems: 'flex-end',
  },
  rowCenter: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  slot: {
    overflow: 'visible',
  },
  dimmed: {
    opacity: 0.55,
  },
});
