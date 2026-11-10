import { describe, expect, it } from 'vitest';
import { csvLesen, datumLesen, geschlechtLesen, normalisieren, trennzeichenErkennen, uhrzeitLesen, wildartFinden, zahlLesen } from './csv';

describe('csvLesen', () => {
  it('erkennt Semikolon, Tabulator und Komma als Trennzeichen', () => {
    expect(trennzeichenErkennen('a;b;c\n1;2;3')).toBe(';');
    expect(trennzeichenErkennen('a\tb\n1\t2')).toBe('\t');
    expect(trennzeichenErkennen('a,b\n1,2')).toBe(',');
    expect(trennzeichenErkennen('nur eine Spalte')).toBe(';');
  });

  it('liest Anführungszeichen, doppelte Anführungszeichen und Zeilenumbrüche im Feld', () => {
    const zeilen = csvLesen('Name;Bemerkung\r\n"Kanzel ""Eiche""";"Zeile 1\nZeile 2"\r\n');
    expect(zeilen).toEqual([
      ['Name', 'Bemerkung'],
      ['Kanzel "Eiche"', 'Zeile 1\nZeile 2'],
    ]);
  });

  it('überspringt Leerzeilen und entfernt Leerraum um Felder', () => {
    expect(csvLesen(' a ; b \n;\n\nc;d')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('datumLesen', () => {
  it('liest deutsche und ISO-Datumsangaben mit optionaler Uhrzeit', () => {
    expect(datumLesen('3.5.2024')).toEqual({ datum: '2024-05-03', stunde: null, minute: null });
    expect(datumLesen('03.05.24 18:45')).toEqual({ datum: '2024-05-03', stunde: 18, minute: 45 });
    expect(datumLesen('2024-05-03T06:05')).toEqual({ datum: '2024-05-03', stunde: 6, minute: 5 });
  });

  it('lehnt unmögliche und unplausible Daten ab', () => {
    expect(datumLesen('31.02.2024')).toBeNull();
    expect(datumLesen('01.01.1900')).toBeNull();
    expect(datumLesen('kein Datum')).toBeNull();
  });
});

describe('Feldwerte', () => {
  it('liest Uhrzeiten', () => {
    expect(uhrzeitLesen('7.30')).toEqual({ stunde: 7, minute: 30 });
    expect(uhrzeitLesen('24:00')).toBeNull();
  });

  it('liest Zahlen mit deutschem Dezimalkomma', () => {
    expect(zahlLesen('1.234,5')).toBe(1234.5);
    expect(zahlLesen('12.5')).toBe(12.5);
    expect(zahlLesen('')).toBeNull();
    expect(zahlLesen('abc')).toBeNull();
  });

  it('ordnet Geschlechtsbezeichnungen zu', () => {
    expect(geschlechtLesen('Bock')).toBe('maennlich');
    expect(geschlechtLesen('Ricke')).toBe('weiblich');
    expect(geschlechtLesen('w')).toBe('weiblich');
    expect(geschlechtLesen('')).toBe('unbekannt');
    expect(geschlechtLesen('Kitz')).toBe('unbekannt');
  });

  it('normalisiert Umlaute und Sonderzeichen', () => {
    expect(normalisieren('Waschbär (jung)')).toBe('waschbaerjung');
  });

  it('findet Wildarten über Name, Schlüssel und Alias', () => {
    const wildarten = [
      { id: 'rehwild', name: 'Rehwild' },
      { id: 'schwarzwild', name: 'Schwarzwild' },
      { id: 'waschbaer', name: 'Waschbär' },
    ];
    expect(wildartFinden('Rehwild', wildarten)).toBe('rehwild');
    expect(wildartFinden('Sauen', wildarten)).toBe('schwarzwild');
    expect(wildartFinden('Waschbär', wildarten)).toBe('waschbaer');
    expect(wildartFinden('Hase', wildarten)).toBeNull(); // Alias vorhanden, Wildart im Revier nicht
    expect(wildartFinden('Einhorn', wildarten)).toBeNull();
  });
});
