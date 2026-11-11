import { describe, expect, it } from 'vitest';
import { fotoPfad, gewicht, imZeitraum, jeBestand, mengeText, merkmalLabel, typLabel, zeitraumBeginn, zielGroesse } from './funde';

describe('Bezeichnungen', () => {
  it('übersetzt Typen und Merkmale', () => {
    expect(typLabel('kaeferbaum')).toBe('Käferbaum');
    expect(merkmalLabel('kaeferbaum', 'rote_krone')).toBe('Rote Krone');
    expect(merkmalLabel('windwurf', null)).toBeNull();
    expect(merkmalLabel('sonstiges', 'frei')).toBe('frei');
  });
  it('beschreibt die Menge je Typ', () => {
    expect(mengeText({ typ: 'kaeferbaum', anzahl: 3, menge_fm: null })).toBe('3 Bäume');
    expect(mengeText({ typ: 'kaeferbaum', anzahl: 1, menge_fm: null })).toBe('1 Baum');
    expect(mengeText({ typ: 'windwurf', anzahl: 1, menge_fm: 25 })).toBe('ca. 25 fm');
    expect(mengeText({ typ: 'wildschaden', anzahl: 1, menge_fm: null })).toBe('');
  });
});

describe('Zeiträume', () => {
  const nov = new Date('2026-11-11T12:00:00');
  it('beginnt die Käfersaison am 1. April', () => {
    expect(new Date(zeitraumBeginn('saison', nov)!).getMonth()).toBe(3);
    expect(new Date(zeitraumBeginn('saison', nov)!).getFullYear()).toBe(2026);
    // Im Februar gilt noch die Saison des Vorjahres
    expect(new Date(zeitraumBeginn('saison', new Date('2027-02-10T12:00:00'))!).getFullYear()).toBe(2026);
  });
  it('rechnet Tage zurück und kennt „alle“', () => {
    expect(zeitraumBeginn('30', nov)!.slice(0, 10)).toBe('2026-10-12');
    expect(zeitraumBeginn('alle', nov)).toBeNull();
    expect(imZeitraum('2026-10-20T08:00:00Z', zeitraumBeginn('30', nov))).toBe(true);
    expect(imZeitraum('2026-09-01T08:00:00Z', zeitraumBeginn('30', nov))).toBe(false);
    expect(imZeitraum('2001-01-01T00:00:00Z', null)).toBe(true);
  });
});

describe('Auswertung', () => {
  it('gewichtet Käferbäume nach Anzahl mit Obergrenze', () => {
    expect(gewicht({ typ: 'kaeferbaum', anzahl: 4 })).toBe(4);
    expect(gewicht({ typ: 'kaeferbaum', anzahl: 50 })).toBe(20);
    expect(gewicht({ typ: 'windwurf', anzahl: 7 })).toBe(1);
  });
  it('summiert je Bestand absteigend', () => {
    expect(
      jeBestand([
        { bestand_id: 'a', typ: 'kaeferbaum', anzahl: 2 },
        { bestand_id: 'b', typ: 'kaeferbaum', anzahl: 5 },
        { bestand_id: 'a', typ: 'kaeferbaum', anzahl: 1 },
        { bestand_id: null, typ: 'windwurf', anzahl: 1 },
      ]),
    ).toEqual([
      { bestandId: 'b', summe: 5 },
      { bestandId: 'a', summe: 3 },
      { bestandId: '', summe: 1 },
    ]);
  });
});

describe('Foto', () => {
  it('legt den Pfad unter dem Betrieb ab und verkleinert proportional', () => {
    expect(fotoPfad('b1', 'f1')).toBe('b1/f1.jpg');
    expect(zielGroesse(4032, 3024)).toEqual({ breite: 1600, hoehe: 1200 });
    expect(zielGroesse(800, 600)).toEqual({ breite: 800, hoehe: 600 });
  });
});
