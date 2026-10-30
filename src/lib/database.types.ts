// Automatisch aus Supabase generiert (Projekt Hegewerk). Nicht von Hand ändern.
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
          fang_ergebnis: string | null
          fang_zustand: string | null
          art: string
          aktualisiert_am: string
          altersklasse: string | null
          bemerkung: string | null
          einrichtung_id: string | null
          erfasst_von: string | null
          erleger_id: string | null
          erlegt_am: string
          erstellt_am: string
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
          fang_ergebnis?: string | null
          fang_zustand?: string | null
          art?: string
          aktualisiert_am?: string
          altersklasse?: string | null
          bemerkung?: string | null
          einrichtung_id?: string | null
          erfasst_von?: string | null
          erleger_id?: string | null
          erlegt_am: string
          erstellt_am?: string
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
          fang_ergebnis?: string | null
          fang_zustand?: string | null
          art?: string
          aktualisiert_am?: string
          altersklasse?: string | null
          bemerkung?: string | null
          einrichtung_id?: string | null
          erfasst_von?: string | null
          erleger_id?: string | null
          erlegt_am?: string
          erstellt_am?: string
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
      beobachtungen: {
        Row: {
          aktualisiert_am: string
          altersklasse: string | null
          anzahl: number
          bemerkung: string | null
          erfasst_von: string | null
          erstellt_am: string
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
            foreignKeyName: "einrichtungen_revier_id_fkey"
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
          erstellt_am: string
          geloescht_am: string | null
          geom: unknown
          id: string
          name: string
          revier_id: string
        }
        Insert: {
          aktualisiert_am?: string
          bemerkung?: string | null
          erstellt_am?: string
          geloescht_am?: string | null
          geom: unknown
          id?: string
          name: string
          revier_id: string
        }
        Update: {
          aktualisiert_am?: string
          bemerkung?: string | null
          erstellt_am?: string
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name?: string
          revier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pirschwege_revier_id_fkey"
            columns: ["revier_id"]
            isOneToOne: false
            referencedRelation: "reviere"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aktualisiert_am: string
          email: string
          erstellt_am: string
          id: string
          name: string
        }
        Insert: {
          aktualisiert_am?: string
          email: string
          erstellt_am?: string
          id: string
          name: string
        }
        Update: {
          aktualisiert_am?: string
          email?: string
          erstellt_am?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      revier_grenzen: {
        Row: {
          aktualisiert_am: string
          geom: unknown
          revier_id: string
        }
        Insert: {
          aktualisiert_am?: string
          geom: unknown
          revier_id: string
        }
        Update: {
          aktualisiert_am?: string
          geom?: unknown
          revier_id?: string
        }
        Relationships: [
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
          erstellt_am: string
          flaeche_ha: number | null
          hegering_id: string
          id: string
          name: string
        }
        Insert: {
          aktualisiert_am?: string
          erstellt_am?: string
          flaeche_ha?: number | null
          hegering_id: string
          id?: string
          name: string
        }
        Update: {
          aktualisiert_am?: string
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
      zaehlsitzungen: {
        Row: {
          ebene_id: string | null
          aktualisiert_am: string
          beginn: string | null
          bemerkung: string | null
          datum: string
          ende: string | null
          erstellt_am: string
          erstellt_von: string | null
          geloescht_am: string | null
          id: string
          mondphase: string | null
          revier_id: string
          status: Database["public"]["Enums"]["sitzung_status"]
          wetter: Json | null
        }
        Insert: {
          ebene_id?: string | null
          aktualisiert_am?: string
          beginn?: string | null
          bemerkung?: string | null
          datum: string
          ende?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geloescht_am?: string | null
          id?: string
          mondphase?: string | null
          revier_id: string
          status?: Database["public"]["Enums"]["sitzung_status"]
          wetter?: Json | null
        }
        Update: {
          ebene_id?: string | null
          aktualisiert_am?: string
          beginn?: string | null
          bemerkung?: string | null
          datum?: string
          ende?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geloescht_am?: string | null
          id?: string
          mondphase?: string | null
          revier_id?: string
          status?: Database["public"]["Enums"]["sitzung_status"]
          wetter?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "zaehlsitzungen_erstellt_von_fkey"
            columns: ["erstellt_von"]
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
          ebene_id: string | null
          aktualisiert_am: string
          erstellt_am: string
          farbe: string | null
          geloescht_am: string | null
          geom: unknown
          id: string
          name: string
          revier_id: string
          sortierung: number
        }
        Insert: {
          ebene_id?: string | null
          aktualisiert_am?: string
          erstellt_am?: string
          farbe?: string | null
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name: string
          revier_id: string
          sortierung?: number
        }
        Update: {
          ebene_id?: string | null
          aktualisiert_am?: string
          erstellt_am?: string
          farbe?: string | null
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name?: string
          revier_id?: string
          sortierung?: number
        }
        Relationships: [
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
          wte_aktiv: boolean
          aktualisiert_am: string
          erstellt_am: string
          farbe: string | null
          id: string
          name: string
          revier_id: string
          sortierung: number
        }
        Insert: {
          wte_aktiv?: boolean
          aktualisiert_am?: string
          erstellt_am?: string
          farbe?: string | null
          id?: string
          name: string
          revier_id: string
          sortierung?: number
        }
        Update: {
          wte_aktiv?: boolean
          aktualisiert_am?: string
          erstellt_am?: string
          farbe?: string | null
          id?: string
          name?: string
          revier_id?: string
          sortierung?: number
        }
        Relationships: []
      }
      aufgabenlisten: {
        Row: {
          aktualisiert_am: string
          bewegungsjagd_id: string | null
          erstellt_am: string
          erstellt_von: string | null
          geloescht_am: string | null
          id: string
          name: string
          revier_id: string
          status: string
        }
        Insert: {
          aktualisiert_am?: string
          bewegungsjagd_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geloescht_am?: string | null
          id?: string
          name: string
          revier_id: string
          status?: string
        }
        Update: {
          aktualisiert_am?: string
          bewegungsjagd_id?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          geloescht_am?: string | null
          id?: string
          name?: string
          revier_id?: string
          status?: string
        }
        Relationships: []
      }
      aufgaben: {
        Row: {
          aktualisiert_am: string
          beschreibung: string | null
          einrichtung_id: string | null
          erledigt_am: string | null
          erstellt_am: string
          erstellt_von: string | null
          faellig_am: string | null
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
          erstellt_am?: string
          erstellt_von?: string | null
          faellig_am?: string | null
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
          erstellt_am?: string
          erstellt_von?: string | null
          faellig_am?: string | null
          geloescht_am?: string | null
          id?: string
          liste_id?: string | null
          revier_id?: string
          status?: string
          titel?: string
          zugewiesen_an?: string | null
        }
        Relationships: []
      }
      bewegungsjagd_teilnehmer: {
        Row: {
          telefon: string | null
          aktiv: boolean
          anschrift: string | null
          antwort_am: string | null
          auto_vorhanden: boolean | null
          bewegungsjagd_id: string
          einladungscode: string
          email: string
          erstellt_am: string
          hat_hornblaeser: boolean | null
          hat_hund: boolean | null
          id: string
          mail_fehler: string | null
          mail_gesendet_am: string | null
          mail_status: string | null
          mitfahrplaetze: number | null
          name: string
          schuesseltreiben_teilnahme: boolean | null
          status: string
          user_id: string | null
          zugeordnete_einrichtung_id: string | null
        }
        Insert: {
          telefon?: string | null
          aktiv?: boolean
          anschrift?: string | null
          antwort_am?: string | null
          auto_vorhanden?: boolean | null
          bewegungsjagd_id: string
          einladungscode?: string
          email: string
          erstellt_am?: string
          hat_hornblaeser?: boolean | null
          hat_hund?: boolean | null
          id?: string
          mail_fehler?: string | null
          mail_gesendet_am?: string | null
          mail_status?: string | null
          mitfahrplaetze?: number | null
          name: string
          schuesseltreiben_teilnahme?: boolean | null
          status?: string
          user_id?: string | null
          zugeordnete_einrichtung_id?: string | null
        }
        Update: {
          telefon?: string | null
          aktiv?: boolean
          anschrift?: string | null
          antwort_am?: string | null
          auto_vorhanden?: boolean | null
          bewegungsjagd_id?: string
          einladungscode?: string
          email?: string
          erstellt_am?: string
          hat_hornblaeser?: boolean | null
          hat_hund?: boolean | null
          id?: string
          mail_fehler?: string | null
          mail_gesendet_am?: string | null
          mail_status?: string | null
          mitfahrplaetze?: number | null
          name?: string
          schuesseltreiben_teilnahme?: boolean | null
          status?: string
          user_id?: string | null
          zugeordnete_einrichtung_id?: string | null
        }
        Relationships: []
      }
      bewegungsjagden: {
        Row: {
          abschlusskommentar: string | null
          aktualisiert_am: string
          art: string
          datum: string
          einladungstext: string | null
          erstellt_am: string
          erstellt_von: string | null
          geloescht_am: string | null
          hegebeitrag_aktiv: boolean
          hegebeitrag_betrag: number | null
          id: string
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
          abschlusskommentar?: string | null
          art?: string
          datum: string
          einladungstext?: string | null
          geloescht_am?: string | null
          hegebeitrag_aktiv?: boolean
          hegebeitrag_betrag?: number | null
          id?: string
          revier_id: string
          schuesseltreiben?: boolean
          schuesseltreiben_adresse?: string | null
          schuesseltreiben_anmeldung_pflicht?: boolean
          status?: string
          titel: string
          treffpunkt?: unknown
          uhrzeit?: string | null
        }
        Update: {
          abschlusskommentar?: string | null
          art?: string
          datum?: string
          einladungstext?: string | null
          geloescht_am?: string | null
          hegebeitrag_aktiv?: boolean
          hegebeitrag_betrag?: number | null
          id?: string
          revier_id?: string
          schuesseltreiben?: boolean
          schuesseltreiben_adresse?: string | null
          schuesseltreiben_anmeldung_pflicht?: boolean
          status?: string
          titel?: string
          treffpunkt?: unknown
          uhrzeit?: string | null
        }
        Relationships: []
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
          geloescht_am?: string | null
          gueltig_bis?: string
          gueltig_von?: string
          id?: string
          jagdschein_nr?: string | null
          revier_id?: string
          widerrufen_am?: string | null
          wildarten?: string[]
        }
        Relationships: []
      }
      wildschaeden: {
        Row: {
          aktualisiert_am: string
          angemeldet_am: string | null
          bemerkung: string | null
          erfasst_von: string | null
          erstellt_am: string
          flaeche_ha: number | null
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
          erstellt_am?: string
          flaeche_ha?: number | null
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
          erstellt_am?: string
          flaeche_ha?: number | null
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
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bj_absagen_loeschen: { Args: { p_code: string; p_jagd: string }; Returns: boolean }
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
      grenze_setzen: { Args: { p_geojson: Json; p_revier_id: string }; Returns: number }
      masteradmin_letzte_logins: {
        Args: Record<PropertyKey, never>
        Returns: { user_id: string; letzter_login: string | null }[]
      }
      karte_daten: { Args: { p_revier_id: string; p_tage?: number }; Returns: Json }
      zone_an_position: {
        Args: { p_lat: number; p_lon: number; p_revier_id: string }
        Returns: string
      }
      zone_geometrie_setzen: {
        Args: { p_geojson: Json; p_zone_id: string }
        Returns: number
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
          wildart_id: string
          wildart_name: string
          zaehlsitzungen: number
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

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]
