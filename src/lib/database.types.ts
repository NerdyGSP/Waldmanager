export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      abschuesse: {
        Row: {
          aktualisiert_am: string
          altersklasse: string | null
          art: string
          bemerkung: string | null
          bewegungsjagd_id: string | null
          einrichtung_id: string | null
          erfasst_von: string | null
          erleger_id: string | null
          erleger_name: string | null
          erleger_teilnehmer_id: string | null
          erlegt_am: string
          erstellt_am: string
          fallwild_ursache: string | null
          fang_ergebnis: string | null
          fang_zustand: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          geom: unknown
          geschlecht: Database["public"]["Enums"]["geschlecht"]
          gewicht_kg: number | null
          id: string
          revier_id: string
          wildart_id: string | null
          zone_id: string | null
        }
        Insert: {
          aktualisiert_am?: string
          altersklasse?: string | null
          art?: string
          bemerkung?: string | null
          bewegungsjagd_id?: string | null
          einrichtung_id?: string | null
          erfasst_von?: string | null
          erleger_id?: string | null
          erleger_name?: string | null
          erleger_teilnehmer_id?: string | null
          erlegt_am: string
          erstellt_am?: string
          fallwild_ursache?: string | null
          fang_ergebnis?: string | null
          fang_zustand?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          geschlecht?: Database["public"]["Enums"]["geschlecht"]
          gewicht_kg?: number | null
          id?: string
          revier_id: string
          wildart_id?: string | null
          zone_id?: string | null
        }
        Update: {
          aktualisiert_am?: string
          altersklasse?: string | null
          art?: string
          bemerkung?: string | null
          bewegungsjagd_id?: string | null
          einrichtung_id?: string | null
          erfasst_von?: string | null
          erleger_id?: string | null
          erleger_name?: string | null
          erleger_teilnehmer_id?: string | null
          erlegt_am?: string
          erstellt_am?: string
          fallwild_ursache?: string | null
          fang_ergebnis?: string | null
          fang_zustand?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          geschlecht?: Database["public"]["Enums"]["geschlecht"]
          gewicht_kg?: number | null
          id?: string
          revier_id?: string
          wildart_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abschuesse_bewegungsjagd_id_fkey"
            columns: ["bewegungsjagd_id"]
            isOneToOne: false
            referencedRelation: "bewegungsjagden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abschuesse_einrichtung_id_fkey"
            columns: ["einrichtung_id"]
            isOneToOne: false
            referencedRelation: "einrichtungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abschuesse_erfasst_von_fkey"
            columns: ["erfasst_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abschuesse_erleger_id_fkey"
            columns: ["erleger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abschuesse_erleger_teilnehmer_id_fkey"
            columns: ["erleger_teilnehmer_id"]
            isOneToOne: false
            referencedRelation: "bewegungsjagd_teilnehmer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abschuesse_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abschuesse_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abschuesse_wildart_id_fkey"
            columns: ["wildart_id"]
            isOneToOne: false
            referencedRelation: "wildarten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "abschuesse_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zonen"
            referencedColumns: ["id"]
          },
        ]
      }
      aufgaben: {
        Row: {
          aktualisiert_am: string
          beschreibung: string | null
          einrichtung_id: string | null
          erledigt_am: string | null
          erledigt_von: string | null
          erstellt_am: string
          erstellt_von: string | null
          faellig_am: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          id: string
          liste_id: string | null
          revier_id: string
          status: string
          titel: string
          zugewiesen_an: string | null
        }
        Insert: {
          aktualisiert_am?: string
          beschreibung?: string | null
          einrichtung_id?: string | null
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          faellig_am?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          liste_id?: string | null
          revier_id: string
          status?: string
          titel: string
          zugewiesen_an?: string | null
        }
        Update: {
          aktualisiert_am?: string
          beschreibung?: string | null
          einrichtung_id?: string | null
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          faellig_am?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          liste_id?: string | null
          revier_id?: string
          status?: string
          titel?: string
          zugewiesen_an?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aufgaben_einrichtung_id_fkey"
            columns: ["einrichtung_id"]
            isOneToOne: false
            referencedRelation: "einrichtungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgaben_erledigt_von_profil_fkey"
            columns: ["erledigt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgaben_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgaben_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgaben_liste_id_fkey"
            columns: ["liste_id"]
            isOneToOne: false
            referencedRelation: "aufgabenlisten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgaben_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      aufgabenlisten: {
        Row: {
          aktualisiert_am: string
          bewegungsjagd_id: string | null
          erledigt_am: string | null
          erledigt_von: string | null
          erstellt_am: string
          erstellt_von: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          id: string
          name: string
          revier_id: string
          status: string
        }
        Insert: {
          aktualisiert_am?: string
          bewegungsjagd_id?: string | null
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          name: string
          revier_id: string
          status?: string
        }
        Update: {
          aktualisiert_am?: string
          bewegungsjagd_id?: string | null
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          name?: string
          revier_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "aufgabenlisten_bewegungsjagd_id_fkey"
            columns: ["bewegungsjagd_id"]
            isOneToOne: true
            referencedRelation: "bewegungsjagden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgabenlisten_erledigt_von_profil_fkey"
            columns: ["erledigt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgabenlisten_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgabenlisten_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aufgabenlisten_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      begehungsscheine: {
        Row: {
          aktualisiert_am: string
          art: string
          ausgestellt_von: string | null
          bedingungen: string | null
          bereich: string | null
          entgelt_eur: number | null
          erstellt_am: string
          gast_kontakt: string | null
          gast_name: string
          geaendert_von: string | null
          geloescht_am: string | null
          gueltig_bis: string
          gueltig_von: string
          id: string
          jagdschein_nr: string | null
          revier_id: string
          widerrufen_am: string | null
          wildarten: string[]
        }
        Insert: {
          aktualisiert_am?: string
          art?: string
          ausgestellt_von?: string | null
          bedingungen?: string | null
          bereich?: string | null
          entgelt_eur?: number | null
          erstellt_am?: string
          gast_kontakt?: string | null
          gast_name: string
          geaendert_von?: string | null
          geloescht_am?: string | null
          gueltig_bis: string
          gueltig_von: string
          id?: string
          jagdschein_nr?: string | null
          revier_id: string
          widerrufen_am?: string | null
          wildarten?: string[]
        }
        Update: {
          aktualisiert_am?: string
          art?: string
          ausgestellt_von?: string | null
          bedingungen?: string | null
          bereich?: string | null
          entgelt_eur?: number | null
          erstellt_am?: string
          gast_kontakt?: string | null
          gast_name?: string
          geaendert_von?: string | null
          geloescht_am?: string | null
          gueltig_bis?: string
          gueltig_von?: string
          id?: string
          jagdschein_nr?: string | null
          revier_id?: string
          widerrufen_am?: string | null
          wildarten?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "begehungsscheine_ausgestellt_von_profil_fkey"
            columns: ["ausgestellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "begehungsscheine_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "begehungsscheine_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      beobachtungen: {
        Row: {
          aktualisiert_am: string
          altersklasse: string | null
          anzahl: number
          bemerkung: string | null
          erfasst_von: string | null
          erstellt_am: string
          geaendert_von: string | null
          geloescht_am: string | null
          geom: unknown
          geschlecht: Database["public"]["Enums"]["geschlecht"]
          id: string
          revier_id: string
          wildart_id: string
          zeitpunkt: string
          zone_id: string | null
        }
        Insert: {
          aktualisiert_am?: string
          altersklasse?: string | null
          anzahl?: number
          bemerkung?: string | null
          erfasst_von?: string | null
          erstellt_am?: string
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          geschlecht?: Database["public"]["Enums"]["geschlecht"]
          id?: string
          revier_id: string
          wildart_id: string
          zeitpunkt?: string
          zone_id?: string | null
        }
        Update: {
          aktualisiert_am?: string
          altersklasse?: string | null
          anzahl?: number
          bemerkung?: string | null
          erfasst_von?: string | null
          erstellt_am?: string
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          geschlecht?: Database["public"]["Enums"]["geschlecht"]
          id?: string
          revier_id?: string
          wildart_id?: string
          zeitpunkt?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beobachtungen_erfasst_von_fkey"
            columns: ["erfasst_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beobachtungen_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beobachtungen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beobachtungen_wildart_id_fkey"
            columns: ["wildart_id"]
            isOneToOne: false
            referencedRelation: "wildarten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beobachtungen_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zonen"
            referencedColumns: ["id"]
          },
        ]
      }
      bewegungsjagd_jagdleitung: {
        Row: {
          bewegungsjagd_id: string
          erstellt_am: string
          funktion: string | null
          id: string
          name: string
          sortierung: number
          telefon: string | null
        }
        Insert: {
          bewegungsjagd_id: string
          erstellt_am?: string
          funktion?: string | null
          id?: string
          name: string
          sortierung?: number
          telefon?: string | null
        }
        Update: {
          bewegungsjagd_id?: string
          erstellt_am?: string
          funktion?: string | null
          id?: string
          name?: string
          sortierung?: number
          telefon?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bewegungsjagd_jagdleitung_bewegungsjagd_id_fkey"
            columns: ["bewegungsjagd_id"]
            isOneToOne: false
            referencedRelation: "bewegungsjagden"
            referencedColumns: ["id"]
          },
        ]
      }
      bewegungsjagd_rettungspunkte: {
        Row: {
          bemerkung: string | null
          bewegungsjagd_id: string
          erstellt_am: string
          id: string
          lat: number
          lng: number
          name: string
        }
        Insert: {
          bemerkung?: string | null
          bewegungsjagd_id: string
          erstellt_am?: string
          id?: string
          lat: number
          lng: number
          name: string
        }
        Update: {
          bemerkung?: string | null
          bewegungsjagd_id?: string
          erstellt_am?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bewegungsjagd_rettungspunkte_bewegungsjagd_id_fkey"
            columns: ["bewegungsjagd_id"]
            isOneToOne: false
            referencedRelation: "bewegungsjagden"
            referencedColumns: ["id"]
          },
        ]
      }
      bewegungsjagd_teilnehmer: {
        Row: {
          aktiv: boolean
          anschrift: string | null
          ansteller_id: string | null
          antwort_am: string | null
          auto_vorhanden: boolean | null
          bewegungsjagd_id: string
          einladungscode: string
          email: string
          erstellt_am: string
          hat_hornblaeser: boolean | null
          hat_hund: boolean | null
          id: string
          ist_ansteller: boolean
          mail_fehler: string | null
          mail_gesendet_am: string | null
          mail_status: string | null
          mitfahrplaetze: number | null
          name: string
          schuesseltreiben_teilnahme: boolean | null
          status: string
          telefon: string | null
          user_id: string | null
          zugeordnete_einrichtung_id: string | null
        }
        Insert: {
          aktiv?: boolean
          anschrift?: string | null
          ansteller_id?: string | null
          antwort_am?: string | null
          auto_vorhanden?: boolean | null
          bewegungsjagd_id: string
          einladungscode?: string
          email: string
          erstellt_am?: string
          hat_hornblaeser?: boolean | null
          hat_hund?: boolean | null
          id?: string
          ist_ansteller?: boolean
          mail_fehler?: string | null
          mail_gesendet_am?: string | null
          mail_status?: string | null
          mitfahrplaetze?: number | null
          name: string
          schuesseltreiben_teilnahme?: boolean | null
          status?: string
          telefon?: string | null
          user_id?: string | null
          zugeordnete_einrichtung_id?: string | null
        }
        Update: {
          aktiv?: boolean
          anschrift?: string | null
          ansteller_id?: string | null
          antwort_am?: string | null
          auto_vorhanden?: boolean | null
          bewegungsjagd_id?: string
          einladungscode?: string
          email?: string
          erstellt_am?: string
          hat_hornblaeser?: boolean | null
          hat_hund?: boolean | null
          id?: string
          ist_ansteller?: boolean
          mail_fehler?: string | null
          mail_gesendet_am?: string | null
          mail_status?: string | null
          mitfahrplaetze?: number | null
          name?: string
          schuesseltreiben_teilnahme?: boolean | null
          status?: string
          telefon?: string | null
          user_id?: string | null
          zugeordnete_einrichtung_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bewegungsjagd_teilnehmer_ansteller_id_fkey"
            columns: ["ansteller_id"]
            isOneToOne: false
            referencedRelation: "bewegungsjagd_teilnehmer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bewegungsjagd_teilnehmer_bewegungsjagd_id_fkey"
            columns: ["bewegungsjagd_id"]
            isOneToOne: false
            referencedRelation: "bewegungsjagden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bewegungsjagd_teilnehmer_zugeordnete_einrichtung_id_fkey"
            columns: ["zugeordnete_einrichtung_id"]
            isOneToOne: false
            referencedRelation: "einrichtungen"
            referencedColumns: ["id"]
          },
        ]
      }
      bewegungsjagden: {
        Row: {
          abgeschlossen_am: string | null
          abgeschlossen_von: string | null
          abschlusskommentar: string | null
          aktualisiert_am: string
          art: string
          datum: string
          einladungstext: string | null
          erstellt_am: string
          erstellt_von: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          hegebeitrag_aktiv: boolean
          hegebeitrag_betrag: number | null
          id: string
          info_jagdleitung: string | null
          revier_id: string
          schuesseltreiben: boolean
          schuesseltreiben_adresse: string | null
          schuesseltreiben_anmeldung_pflicht: boolean
          status: string
          titel: string
          treffpunkt: unknown
          treffpunkt_lat: number | null
          treffpunkt_lng: number | null
          uhrzeit: string | null
        }
        Insert: {
          abgeschlossen_am?: string | null
          abgeschlossen_von?: string | null
          abschlusskommentar?: string | null
          aktualisiert_am?: string
          art?: string
          datum: string
          einladungstext?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          hegebeitrag_aktiv?: boolean
          hegebeitrag_betrag?: number | null
          id?: string
          info_jagdleitung?: string | null
          revier_id: string
          schuesseltreiben?: boolean
          schuesseltreiben_adresse?: string | null
          schuesseltreiben_anmeldung_pflicht?: boolean
          status?: string
          titel: string
          treffpunkt?: unknown
          treffpunkt_lat?: number | null
          treffpunkt_lng?: number | null
          uhrzeit?: string | null
        }
        Update: {
          abgeschlossen_am?: string | null
          abgeschlossen_von?: string | null
          abschlusskommentar?: string | null
          aktualisiert_am?: string
          art?: string
          datum?: string
          einladungstext?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          hegebeitrag_aktiv?: boolean
          hegebeitrag_betrag?: number | null
          id?: string
          info_jagdleitung?: string | null
          revier_id?: string
          schuesseltreiben?: boolean
          schuesseltreiben_adresse?: string | null
          schuesseltreiben_anmeldung_pflicht?: boolean
          status?: string
          titel?: string
          treffpunkt?: unknown
          treffpunkt_lat?: number | null
          treffpunkt_lng?: number | null
          uhrzeit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bewegungsjagden_abgeschlossen_von_profil_fkey"
            columns: ["abgeschlossen_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bewegungsjagden_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bewegungsjagden_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bewegungsjagden_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      einladungen: {
        Row: {
          code: string
          eingeloest_am: string | null
          eingeloest_von: string | null
          email: string | null
          erstellt_am: string
          erstellt_von: string | null
          gueltig_bis: string
          id: string
          revier_id: string | null
          rolle: string
        }
        Insert: {
          code: string
          eingeloest_am?: string | null
          eingeloest_von?: string | null
          email?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          gueltig_bis: string
          id?: string
          revier_id?: string | null
          rolle: string
        }
        Update: {
          code?: string
          eingeloest_am?: string | null
          eingeloest_von?: string | null
          email?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          gueltig_bis?: string
          id?: string
          revier_id?: string | null
          rolle?: string
        }
        Relationships: [
          {
            foreignKeyName: "einladungen_eingeloest_von_fkey"
            columns: ["eingeloest_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einladungen_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einladungen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      einrichtungen: {
        Row: {
          aktualisiert_am: string
          bemerkung: string | null
          erstellt_am: string
          erstellt_von: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          geom: unknown
          id: string
          name: string | null
          revier_id: string
          typ: Database["public"]["Enums"]["einrichtung_typ"]
          zustand: string | null
        }
        Insert: {
          aktualisiert_am?: string
          bemerkung?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom: unknown
          id?: string
          name?: string | null
          revier_id: string
          typ: Database["public"]["Enums"]["einrichtung_typ"]
          zustand?: string | null
        }
        Update: {
          aktualisiert_am?: string
          bemerkung?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name?: string | null
          revier_id?: string
          typ?: Database["public"]["Enums"]["einrichtung_typ"]
          zustand?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einrichtungen_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einrichtungen_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einrichtungen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      ereignis_gelesen: {
        Row: {
          revier_id: string
          user_id: string
          zuletzt_gelesen_am: string
        }
        Insert: {
          revier_id: string
          user_id: string
          zuletzt_gelesen_am?: string
        }
        Update: {
          revier_id?: string
          user_id?: string
          zuletzt_gelesen_am?: string
        }
        Relationships: [
          {
            foreignKeyName: "ereignis_gelesen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ereignis_gelesen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ereignisse: {
        Row: {
          akteur_id: string | null
          akteur_name: string | null
          anzahl: number
          erstellt_am: string
          gruppe: string
          hervorgehoben: boolean
          id: string
          ref: string | null
          revier_id: string
          sichtbar_fuer: string
          titel: string
          typ: string
          ziel_id: string | null
          ziel_typ: string | null
        }
        Insert: {
          akteur_id?: string | null
          akteur_name?: string | null
          anzahl?: number
          erstellt_am?: string
          gruppe: string
          hervorgehoben?: boolean
          id?: string
          ref?: string | null
          revier_id: string
          sichtbar_fuer?: string
          titel: string
          typ: string
          ziel_id?: string | null
          ziel_typ?: string | null
        }
        Update: {
          akteur_id?: string | null
          akteur_name?: string | null
          anzahl?: number
          erstellt_am?: string
          gruppe?: string
          hervorgehoben?: boolean
          id?: string
          ref?: string | null
          revier_id?: string
          sichtbar_fuer?: string
          titel?: string
          typ?: string
          ziel_id?: string | null
          ziel_typ?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ereignisse_akteur_id_fkey"
            columns: ["akteur_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ereignisse_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      freigaben: {
        Row: {
          freigegeben_am: string
          freigegeben_von: string | null
          revier_id: string
          wildart_id: string
        }
        Insert: {
          freigegeben_am?: string
          freigegeben_von?: string | null
          revier_id: string
          wildart_id: string
        }
        Update: {
          freigegeben_am?: string
          freigegeben_von?: string | null
          revier_id?: string
          wildart_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "freigaben_freigegeben_von_fkey"
            columns: ["freigegeben_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freigaben_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freigaben_wildart_id_fkey"
            columns: ["wildart_id"]
            isOneToOne: false
            referencedRelation: "wildarten"
            referencedColumns: ["id"]
          },
        ]
      }
      hegeringe: {
        Row: {
          aktualisiert_am: string
          erstellt_am: string
          id: string
          name: string
        }
        Insert: {
          aktualisiert_am?: string
          erstellt_am?: string
          id?: string
          name: string
        }
        Update: {
          aktualisiert_am?: string
          erstellt_am?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      jagdzeiten: {
        Row: {
          bundesland: string
          eingeschraenkt: boolean
          ganzjaehrig: boolean
          gueltig_ab: string
          id: string
          jagdzeit_bis: string | null
          jagdzeit_von: string | null
          klasse: string | null
          quelle: string
          quelle_url: string | null
          schonzeit_text: string | null
          sonderregel: string | null
          sortierung: number
          wildart_id: string
        }
        Insert: {
          bundesland: string
          eingeschraenkt?: boolean
          ganzjaehrig?: boolean
          gueltig_ab: string
          id?: string
          jagdzeit_bis?: string | null
          jagdzeit_von?: string | null
          klasse?: string | null
          quelle: string
          quelle_url?: string | null
          schonzeit_text?: string | null
          sonderregel?: string | null
          sortierung?: number
          wildart_id: string
        }
        Update: {
          bundesland?: string
          eingeschraenkt?: boolean
          ganzjaehrig?: boolean
          gueltig_ab?: string
          id?: string
          jagdzeit_bis?: string | null
          jagdzeit_von?: string | null
          klasse?: string | null
          quelle?: string
          quelle_url?: string | null
          schonzeit_text?: string | null
          sonderregel?: string | null
          sortierung?: number
          wildart_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jagdzeiten_wildart_id_fkey"
            columns: ["wildart_id"]
            isOneToOne: false
            referencedRelation: "wildarten"
            referencedColumns: ["id"]
          },
        ]
      }
      masteradmins: {
        Row: {
          erstellt_am: string
          user_id: string
        }
        Insert: {
          erstellt_am?: string
          user_id: string
        }
        Update: {
          erstellt_am?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "masteradmins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pirschwege: {
        Row: {
          aktualisiert_am: string
          bemerkung: string | null
          bewegungsjagd_id: string | null
          ebene_id: string | null
          erstellt_am: string
          erstellt_von: string | null
          farbe: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          geom: unknown
          id: string
          name: string
          revier_id: string
          typ: string
          zaehlsitzung_id: string | null
        }
        Insert: {
          aktualisiert_am?: string
          bemerkung?: string | null
          bewegungsjagd_id?: string | null
          ebene_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom: unknown
          id?: string
          name: string
          revier_id: string
          typ?: string
          zaehlsitzung_id?: string | null
        }
        Update: {
          aktualisiert_am?: string
          bemerkung?: string | null
          bewegungsjagd_id?: string | null
          ebene_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name?: string
          revier_id?: string
          typ?: string
          zaehlsitzung_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pirschwege_bewegungsjagd_id_fkey"
            columns: ["bewegungsjagd_id"]
            isOneToOne: false
            referencedRelation: "bewegungsjagden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pirschwege_ebene_id_fkey"
            columns: ["ebene_id"]
            isOneToOne: false
            referencedRelation: "routen_ebenen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pirschwege_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pirschwege_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pirschwege_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pirschwege_zaehlsitzung_id_fkey"
            columns: ["zaehlsitzung_id"]
            isOneToOne: false
            referencedRelation: "zaehlsitzungen"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aktualisiert_am: string
          benachrichtigungen: Json
          email: string
          erstellt_am: string
          id: string
          name: string
          zuletzt_aktiv_am: string | null
        }
        Insert: {
          aktualisiert_am?: string
          benachrichtigungen?: Json
          email: string
          erstellt_am?: string
          id: string
          name: string
          zuletzt_aktiv_am?: string | null
        }
        Update: {
          aktualisiert_am?: string
          benachrichtigungen?: Json
          email?: string
          erstellt_am?: string
          id?: string
          name?: string
          zuletzt_aktiv_am?: string | null
        }
        Relationships: []
      }
      revier_grenzen: {
        Row: {
          aktualisiert_am: string
          erstellt_am: string
          erstellt_von: string | null
          geaendert_von: string | null
          geom: unknown
          revier_id: string
        }
        Insert: {
          aktualisiert_am?: string
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geom: unknown
          revier_id: string
        }
        Update: {
          aktualisiert_am?: string
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geom?: unknown
          revier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revier_grenzen_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revier_grenzen_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revier_grenzen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: true
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      revier_mitglieder: {
        Row: {
          erstellt_am: string
          revier_id: string
          rolle: Database["public"]["Enums"]["revier_rolle"]
          user_id: string
        }
        Insert: {
          erstellt_am?: string
          revier_id: string
          rolle: Database["public"]["Enums"]["revier_rolle"]
          user_id: string
        }
        Update: {
          erstellt_am?: string
          revier_id?: string
          rolle?: Database["public"]["Enums"]["revier_rolle"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revier_mitglieder_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revier_mitglieder_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviere: {
        Row: {
          aktualisiert_am: string
          bundesland: string
          erstellt_am: string
          flaeche_ha: number | null
          hegering_id: string
          id: string
          name: string
        }
        Insert: {
          aktualisiert_am?: string
          bundesland?: string
          erstellt_am?: string
          flaeche_ha?: number | null
          hegering_id: string
          id?: string
          name: string
        }
        Update: {
          aktualisiert_am?: string
          bundesland?: string
          erstellt_am?: string
          flaeche_ha?: number | null
          hegering_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviere_hegering_id_fkey"
            columns: ["hegering_id"]
            isOneToOne: false
            referencedRelation: "hegeringe"
            referencedColumns: ["id"]
          },
        ]
      }
      routen_ebenen: {
        Row: {
          aktualisiert_am: string
          erstellt_am: string
          erstellt_von: string | null
          farbe: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          id: string
          name: string
          reihenfolge: number
          revier_id: string
          typ: string
          wte_aktiv: boolean
        }
        Insert: {
          aktualisiert_am?: string
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          name: string
          reihenfolge?: number
          revier_id: string
          typ: string
          wte_aktiv?: boolean
        }
        Update: {
          aktualisiert_am?: string
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          name?: string
          reihenfolge?: number
          revier_id?: string
          typ?: string
          wte_aktiv?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "routen_ebenen_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routen_ebenen_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routen_ebenen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      wildarten: {
        Row: {
          altersklassen: string[]
          gruppe: string
          id: string
          name: string
          sortierung: number
        }
        Insert: {
          altersklassen?: string[]
          gruppe: string
          id: string
          name: string
          sortierung?: number
        }
        Update: {
          altersklassen?: string[]
          gruppe?: string
          id?: string
          name?: string
          sortierung?: number
        }
        Relationships: []
      }
      wildschaeden: {
        Row: {
          aktualisiert_am: string
          angemeldet_am: string | null
          bemerkung: string | null
          erfasst_von: string | null
          erledigt_am: string | null
          erledigt_von: string | null
          erstellt_am: string
          flaeche_ha: number | null
          geaendert_von: string | null
          geloescht_am: string | null
          geom: unknown
          geschaedigter: string | null
          id: string
          kenntnis_am: string
          kontakt: string | null
          kultur: string
          ort: string | null
          revier_id: string
          schaden_eur: number | null
          status: string
          wildart_id: string | null
          zone_id: string | null
        }
        Insert: {
          aktualisiert_am?: string
          angemeldet_am?: string | null
          bemerkung?: string | null
          erfasst_von?: string | null
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          flaeche_ha?: number | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          geschaedigter?: string | null
          id?: string
          kenntnis_am?: string
          kontakt?: string | null
          kultur: string
          ort?: string | null
          revier_id: string
          schaden_eur?: number | null
          status?: string
          wildart_id?: string | null
          zone_id?: string | null
        }
        Update: {
          aktualisiert_am?: string
          angemeldet_am?: string | null
          bemerkung?: string | null
          erfasst_von?: string | null
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          flaeche_ha?: number | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          geschaedigter?: string | null
          id?: string
          kenntnis_am?: string
          kontakt?: string | null
          kultur?: string
          ort?: string | null
          revier_id?: string
          schaden_eur?: number | null
          status?: string
          wildart_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wildschaeden_erfasst_von_profil_fkey"
            columns: ["erfasst_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildschaeden_erledigt_von_profil_fkey"
            columns: ["erledigt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildschaeden_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildschaeden_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildschaeden_wildart_id_fkey"
            columns: ["wildart_id"]
            isOneToOne: false
            referencedRelation: "wildarten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wildschaeden_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zonen"
            referencedColumns: ["id"]
          },
        ]
      }
      zaehlsitzung_routen: {
        Row: {
          erstellt_am: string
          revier_id: string
          route_id: string
          sitzung_id: string
        }
        Insert: {
          erstellt_am?: string
          revier_id: string
          route_id: string
          sitzung_id: string
        }
        Update: {
          erstellt_am?: string
          revier_id?: string
          route_id?: string
          sitzung_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zaehlsitzung_routen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlsitzung_routen_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "pirschwege"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlsitzung_routen_sitzung_id_fkey"
            columns: ["sitzung_id"]
            isOneToOne: false
            referencedRelation: "zaehlsitzungen"
            referencedColumns: ["id"]
          },
        ]
      }
      zaehlsitzungen: {
        Row: {
          abgeschlossen_am: string | null
          abgeschlossen_von: string | null
          aktualisiert_am: string
          beginn: string | null
          bemerkung: string | null
          datum: string
          ebene_id: string | null
          ende: string | null
          erstellt_am: string
          erstellt_von: string | null
          flaeche_ha: number | null
          flaechenmodus: string
          geaendert_von: string | null
          geloescht_am: string | null
          id: string
          mondphase: string | null
          revier_id: string
          status: Database["public"]["Enums"]["sitzung_status"]
          strecke_km: number | null
          streifenbreite_m: number
          wetter: Json | null
        }
        Insert: {
          abgeschlossen_am?: string | null
          abgeschlossen_von?: string | null
          aktualisiert_am?: string
          beginn?: string | null
          bemerkung?: string | null
          datum: string
          ebene_id?: string | null
          ende?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          flaeche_ha?: number | null
          flaechenmodus?: string
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          mondphase?: string | null
          revier_id: string
          status?: Database["public"]["Enums"]["sitzung_status"]
          strecke_km?: number | null
          streifenbreite_m?: number
          wetter?: Json | null
        }
        Update: {
          abgeschlossen_am?: string | null
          abgeschlossen_von?: string | null
          aktualisiert_am?: string
          beginn?: string | null
          bemerkung?: string | null
          datum?: string
          ebene_id?: string | null
          ende?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          flaeche_ha?: number | null
          flaechenmodus?: string
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          mondphase?: string | null
          revier_id?: string
          status?: Database["public"]["Enums"]["sitzung_status"]
          strecke_km?: number | null
          streifenbreite_m?: number
          wetter?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "zaehlsitzungen_abgeschlossen_von_profil_fkey"
            columns: ["abgeschlossen_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlsitzungen_ebene_id_fkey"
            columns: ["ebene_id"]
            isOneToOne: false
            referencedRelation: "zonen_ebenen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlsitzungen_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlsitzungen_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlsitzungen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      zaehlungen: {
        Row: {
          aktualisiert_am: string
          altersklasse: string | null
          anzahl: number
          bemerkung: string | null
          erfasst_von: string | null
          erstellt_am: string
          geloescht_am: string | null
          geschlecht: Database["public"]["Enums"]["geschlecht"]
          id: string
          revier_id: string
          sitzung_id: string
          wildart_id: string
          zone_id: string | null
        }
        Insert: {
          aktualisiert_am?: string
          altersklasse?: string | null
          anzahl: number
          bemerkung?: string | null
          erfasst_von?: string | null
          erstellt_am?: string
          geloescht_am?: string | null
          geschlecht?: Database["public"]["Enums"]["geschlecht"]
          id?: string
          revier_id: string
          sitzung_id: string
          wildart_id: string
          zone_id?: string | null
        }
        Update: {
          aktualisiert_am?: string
          altersklasse?: string | null
          anzahl?: number
          bemerkung?: string | null
          erfasst_von?: string | null
          erstellt_am?: string
          geloescht_am?: string | null
          geschlecht?: Database["public"]["Enums"]["geschlecht"]
          id?: string
          revier_id?: string
          sitzung_id?: string
          wildart_id?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zaehlungen_erfasst_von_fkey"
            columns: ["erfasst_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlungen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlungen_sitzung_id_fkey"
            columns: ["sitzung_id"]
            isOneToOne: false
            referencedRelation: "zaehlsitzungen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlungen_wildart_id_fkey"
            columns: ["wildart_id"]
            isOneToOne: false
            referencedRelation: "wildarten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zaehlungen_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "zonen"
            referencedColumns: ["id"]
          },
        ]
      }
      zonen: {
        Row: {
          aktualisiert_am: string
          ebene_id: string | null
          erstellt_am: string
          erstellt_von: string | null
          farbe: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          geom: unknown
          id: string
          name: string
          revier_id: string
          sortierung: number
        }
        Insert: {
          aktualisiert_am?: string
          ebene_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name: string
          revier_id: string
          sortierung?: number
        }
        Update: {
          aktualisiert_am?: string
          ebene_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name?: string
          revier_id?: string
          sortierung?: number
        }
        Relationships: [
          {
            foreignKeyName: "zonen_ebene_id_fkey"
            columns: ["ebene_id"]
            isOneToOne: false
            referencedRelation: "zonen_ebenen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zonen_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zonen_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zonen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      zonen_ebenen: {
        Row: {
          aktualisiert_am: string
          erstellt_am: string
          erstellt_von: string | null
          farbe: string | null
          geaendert_von: string | null
          id: string
          name: string
          revier_id: string
          sortierung: number
          wte_aktiv: boolean
        }
        Insert: {
          aktualisiert_am?: string
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          id?: string
          name: string
          revier_id: string
          sortierung?: number
          wte_aktiv?: boolean
        }
        Update: {
          aktualisiert_am?: string
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          id?: string
          name?: string
          revier_id?: string
          sortierung?: number
          wte_aktiv?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "zonen_ebenen_erstellt_von_profil_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zonen_ebenen_geaendert_von_profil_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zonen_ebenen_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aktivitaet_melden: { Args: never; Returns: undefined }
      aufgaben_faellig_pruefen: {
        Args: { p_revier_id: string }
        Returns: undefined
      }
      bj_absagen_loeschen: {
        Args: { p_code: string; p_jagd: string }
        Returns: boolean
      }
      bj_antworten: {
        Args: {
          p_anschrift: string
          p_auto: boolean
          p_code: string
          p_hornblaeser: boolean
          p_hund: boolean
          p_jagd: string
          p_name: string
          p_plaetze: number
          p_schuesseltreiben: boolean
          p_telefon?: string
          p_zusage: boolean
        }
        Returns: boolean
      }
      bj_laden: { Args: { p_code: string; p_jagd: string }; Returns: Json }
      einladung_einloesen: { Args: { p_code: string }; Returns: string }
      einladung_erstellen: {
        Args: {
          p_email?: string
          p_gueltig_tage?: number
          p_revier_id: string
          p_rolle: Database["public"]["Enums"]["revier_rolle"]
        }
        Returns: string
      }
      einladung_pruefen: {
        Args: { p_code: string }
        Returns: {
          gueltig: boolean
          revier_name: string
          rolle: string
        }[]
      }
      grenze_setzen: {
        Args: { p_geojson: Json; p_revier_id: string }
        Returns: number
      }
      jagdjahr_report: {
        Args: { p_bis_jahr: number; p_revier_id: string; p_von_jahr: number }
        Returns: Json
      }
      karte_daten: {
        Args: { p_revier_id: string; p_tage?: number }
        Returns: Json
      }
      masteradmin_letzte_logins: {
        Args: never
        Returns: {
          letzter_login: string
          user_id: string
        }[]
      }
      quervergleich: {
        Args: { p_bis: string; p_revier_id: string; p_von: string }
        Returns: {
          abschuesse: number
          abschuesse_je_100ha: number
          abschuesse_maennlich: number
          abschuesse_weiblich: number
          flaeche_ha: number
          gezaehlt_max: number
          gezaehlt_max_je_100ha: number
          gezaehlt_schnitt: number
          ist_durchschnitt: boolean
          ist_eigenes: boolean
          revier_id: string
          revier_name: string
          strecke_zaehlungen: number
          wildart_id: string
          wildart_name: string
          zaehlsitzungen: number
        }[]
      }
      revier_aufteilen: {
        Args: { p_anzahl: number; p_name?: string; p_revier_id: string }
        Returns: string
      }
      revier_aufteilen_vorschau: {
        Args: { p_anzahl: number; p_revier_id: string }
        Returns: Json
      }
      revier_letzte_logins: {
        Args: { p_revier_id: string }
        Returns: {
          letzter_login: string
          user_id: string
          zuletzt_aktiv_am: string
        }[]
      }
      routen_ebene_loeschen: {
        Args: { p_ebene_id: string; p_mit_routen?: boolean }
        Returns: number
      }
      sitzung_flaeche_berechnen: {
        Args: { p_breite_m?: number; p_modus?: string; p_sitzung_id: string }
        Returns: {
          breite_m: number
          flaeche_ha: number
          modus: string
          routen: number
          strecke_km: number
        }[]
      }
      zaehlsitzung_flaeche_setzen: {
        Args: { p_sitzung_id: string }
        Returns: number
      }
      zone_an_position: {
        Args: { p_lat: number; p_lon: number; p_revier_id: string }
        Returns: string
      }
      zone_geometrie_setzen: {
        Args: { p_geojson: Json; p_zone_id: string; p_zuschneiden?: boolean }
        Returns: number
      }
      zonen_flaechen: {
        Args: { p_revier_id: string }
        Returns: {
          flaeche_ha: number
          zone_id: string
        }[]
      }
    }
    Enums: {
      einrichtung_typ:
        | "hochsitz"
        | "kanzel"
        | "ansitzleiter"
        | "bodensitz"
        | "kirrung"
        | "salzlecke"
        | "fuetterung"
        | "wildacker"
        | "wildkamera"
        | "falle"
        | "sonstiges"
        | "drueckjagdbock"
      geschlecht: "maennlich" | "weiblich" | "unbekannt"
      revier_rolle: "inhaber" | "mitjaeger"
      sitzung_status: "offen" | "abgeschlossen"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      einrichtung_typ: [
        "hochsitz",
        "kanzel",
        "ansitzleiter",
        "bodensitz",
        "kirrung",
        "salzlecke",
        "fuetterung",
        "wildacker",
        "wildkamera",
        "falle",
        "sonstiges",
        "drueckjagdbock",
      ],
      geschlecht: ["maennlich", "weiblich", "unbekannt"],
      revier_rolle: ["inhaber", "mitjaeger"],
      sitzung_status: ["offen", "abgeschlossen"],
    },
  },
} as const
