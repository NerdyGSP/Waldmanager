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
      bestaende: {
        Row: {
          abteilung: string | null
          aktualisiert_am: string
          baumarten: Json
          bemerkung: string | null
          bestandestyp: string | null
          betrieb_id: string
          erstellt_am: string
          erstellt_von: string | null
          farbe: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          geom: unknown
          id: string
          name: string
          pflanzjahr: number | null
          sortierung: number
          vorrat_vfm_ha: number | null
        }
        Insert: {
          abteilung?: string | null
          aktualisiert_am?: string
          baumarten?: Json
          bemerkung?: string | null
          bestandestyp?: string | null
          betrieb_id: string
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name: string
          pflanzjahr?: number | null
          sortierung?: number
          vorrat_vfm_ha?: number | null
        }
        Update: {
          abteilung?: string | null
          aktualisiert_am?: string
          baumarten?: Json
          bemerkung?: string | null
          bestandestyp?: string | null
          betrieb_id?: string
          erstellt_am?: string
          erstellt_von?: string | null
          farbe?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          geom?: unknown
          id?: string
          name?: string
          pflanzjahr?: number | null
          sortierung?: number
          vorrat_vfm_ha?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bestaende_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betriebe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bestaende_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bestaende_geaendert_von_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      betrieb_grenzen: {
        Row: {
          aktualisiert_am: string
          betrieb_id: string
          erstellt_am: string
          erstellt_von: string | null
          geaendert_von: string | null
          geom: unknown
        }
        Insert: {
          aktualisiert_am?: string
          betrieb_id: string
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geom: unknown
        }
        Update: {
          aktualisiert_am?: string
          betrieb_id?: string
          erstellt_am?: string
          erstellt_von?: string | null
          geaendert_von?: string | null
          geom?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "betrieb_grenzen_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: true
            referencedRelation: "betriebe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betrieb_grenzen_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betrieb_grenzen_geaendert_von_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      betrieb_mitglieder: {
        Row: {
          betrieb_id: string
          erstellt_am: string
          rolle: Database["public"]["Enums"]["betrieb_rolle"]
          user_id: string
        }
        Insert: {
          betrieb_id: string
          erstellt_am?: string
          rolle: Database["public"]["Enums"]["betrieb_rolle"]
          user_id: string
        }
        Update: {
          betrieb_id?: string
          erstellt_am?: string
          rolle?: Database["public"]["Enums"]["betrieb_rolle"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "betrieb_mitglieder_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betriebe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "betrieb_mitglieder_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      betriebe: {
        Row: {
          aktualisiert_am: string
          bundesland: string
          erstellt_am: string
          flaeche_ha: number | null
          id: string
          name: string
        }
        Insert: {
          aktualisiert_am?: string
          bundesland?: string
          erstellt_am?: string
          flaeche_ha?: number | null
          id?: string
          name: string
        }
        Update: {
          aktualisiert_am?: string
          bundesland?: string
          erstellt_am?: string
          flaeche_ha?: number | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      einladungen: {
        Row: {
          betrieb_id: string | null
          code: string
          eingeloest_am: string | null
          eingeloest_von: string | null
          email: string | null
          erstellt_am: string
          erstellt_von: string | null
          gueltig_bis: string
          id: string
          rolle: string
        }
        Insert: {
          betrieb_id?: string | null
          code: string
          eingeloest_am?: string | null
          eingeloest_von?: string | null
          email?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          gueltig_bis: string
          id?: string
          rolle: string
        }
        Update: {
          betrieb_id?: string | null
          code?: string
          eingeloest_am?: string | null
          eingeloest_von?: string | null
          email?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          gueltig_bis?: string
          id?: string
          rolle?: string
        }
        Relationships: [
          {
            foreignKeyName: "einladungen_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betriebe"
            referencedColumns: ["id"]
          },
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
        ]
      }
      flurstuecke: {
        Row: {
          aktualisiert_am: string
          betrieb_id: string
          bezeichnung: string
          erstellt_am: string
          erstellt_von: string | null
          flaeche_amtlich_ha: number | null
          flaeche_ha: number
          flur: string | null
          geaendert_von: string | null
          gemarkung: string | null
          geom: unknown
          id: string
          nummer: string | null
        }
        Insert: {
          aktualisiert_am?: string
          betrieb_id: string
          bezeichnung?: string
          erstellt_am?: string
          erstellt_von?: string | null
          flaeche_amtlich_ha?: number | null
          flaeche_ha: number
          flur?: string | null
          geaendert_von?: string | null
          gemarkung?: string | null
          geom: unknown
          id?: string
          nummer?: string | null
        }
        Update: {
          aktualisiert_am?: string
          betrieb_id?: string
          bezeichnung?: string
          erstellt_am?: string
          erstellt_von?: string | null
          flaeche_amtlich_ha?: number | null
          flaeche_ha?: number
          flur?: string | null
          geaendert_von?: string | null
          gemarkung?: string | null
          geom?: unknown
          id?: string
          nummer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flurstuecke_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betriebe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flurstuecke_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flurstuecke_geaendert_von_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      funde: {
        Row: {
          aktualisiert_am: string
          anzahl: number
          beobachtet_am: string
          bestand_id: string | null
          betrieb_id: string
          erfasst_von: string | null
          erledigt_am: string | null
          erledigt_von: string | null
          erstellt_am: string
          foto_pfad: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          genauigkeit_m: number | null
          geom: unknown
          id: string
          menge_fm: number | null
          merkmal: string | null
          notiz: string | null
          status: string
          typ: string
        }
        Insert: {
          aktualisiert_am?: string
          anzahl?: number
          beobachtet_am?: string
          bestand_id?: string | null
          betrieb_id: string
          erfasst_von?: string | null
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          foto_pfad?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          genauigkeit_m?: number | null
          geom: unknown
          id?: string
          menge_fm?: number | null
          merkmal?: string | null
          notiz?: string | null
          status?: string
          typ: string
        }
        Update: {
          aktualisiert_am?: string
          anzahl?: number
          beobachtet_am?: string
          bestand_id?: string | null
          betrieb_id?: string
          erfasst_von?: string | null
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          foto_pfad?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          genauigkeit_m?: number | null
          geom?: unknown
          id?: string
          menge_fm?: number | null
          merkmal?: string | null
          notiz?: string | null
          status?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "funde_bestand_id_fkey"
            columns: ["bestand_id"]
            isOneToOne: false
            referencedRelation: "bestaende"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funde_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betriebe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funde_erfasst_von_fkey"
            columns: ["erfasst_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funde_erledigt_von_fkey"
            columns: ["erledigt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funde_geaendert_von_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      massnahmen: {
        Row: {
          aktualisiert_am: string
          beschreibung: string | null
          bestand_id: string | null
          betrieb_id: string
          erledigt_am: string | null
          erledigt_von: string | null
          erstellt_am: string
          erstellt_von: string | null
          faellig_am: string | null
          geaendert_von: string | null
          geloescht_am: string | null
          id: string
          status: string
          titel: string
          typ: string
          zugewiesen_an: string | null
          zustaendig_extern: string | null
        }
        Insert: {
          aktualisiert_am?: string
          beschreibung?: string | null
          bestand_id?: string | null
          betrieb_id: string
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          faellig_am?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          status?: string
          titel: string
          typ?: string
          zugewiesen_an?: string | null
          zustaendig_extern?: string | null
        }
        Update: {
          aktualisiert_am?: string
          beschreibung?: string | null
          bestand_id?: string | null
          betrieb_id?: string
          erledigt_am?: string | null
          erledigt_von?: string | null
          erstellt_am?: string
          erstellt_von?: string | null
          faellig_am?: string | null
          geaendert_von?: string | null
          geloescht_am?: string | null
          id?: string
          status?: string
          titel?: string
          typ?: string
          zugewiesen_an?: string | null
          zustaendig_extern?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "massnahmen_bestand_id_fkey"
            columns: ["bestand_id"]
            isOneToOne: false
            referencedRelation: "bestaende"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "massnahmen_betrieb_id_fkey"
            columns: ["betrieb_id"]
            isOneToOne: false
            referencedRelation: "betriebe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "massnahmen_erledigt_von_fkey"
            columns: ["erledigt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "massnahmen_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "massnahmen_geaendert_von_fkey"
            columns: ["geaendert_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "massnahmen_zugewiesen_an_fkey"
            columns: ["zugewiesen_an"]
            isOneToOne: false
            referencedRelation: "profiles"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aktivitaet_melden: { Args: never; Returns: undefined }
      bestaende_flaechen: {
        Args: { p_betrieb_id: string }
        Returns: {
          bestand_id: string
          flaeche_ha: number
        }[]
      }
      bestand_an_position: {
        Args: { p_betrieb_id: string; p_lat: number; p_lon: number }
        Returns: string
      }
      bestand_geometrie_setzen: {
        Args: { p_bestand_id: string; p_geojson: Json; p_zuschneiden?: boolean }
        Returns: number
      }
      betrieb_letzte_logins: {
        Args: { p_betrieb_id: string }
        Returns: {
          letzter_login: string
          user_id: string
          zuletzt_aktiv_am: string
        }[]
      }
      einladung_einloesen: { Args: { p_code: string }; Returns: string }
      einladung_erstellen: {
        Args: {
          p_betrieb_id: string
          p_email?: string
          p_gueltig_tage?: number
          p_rolle: Database["public"]["Enums"]["betrieb_rolle"]
        }
        Returns: string
      }
      einladung_pruefen: {
        Args: { p_code: string }
        Returns: {
          betrieb_name: string
          gueltig: boolean
          rolle: string
        }[]
      }
      flurstuecke_importieren: {
        Args: { p_betrieb_id: string; p_objekte: Json }
        Returns: Json
      }
      funde_laden: {
        Args: {
          p_betrieb_id: string
          p_bis?: string
          p_typ?: string
          p_von?: string
        }
        Returns: Json
      }
      grenze_aus_flurstuecken: {
        Args: { p_betrieb_id: string }
        Returns: number
      }
      grenze_setzen: {
        Args: { p_betrieb_id: string; p_geojson: Json }
        Returns: number
      }
      karte_daten: { Args: { p_betrieb_id: string }; Returns: Json }
      masteradmin_letzte_logins: {
        Args: never
        Returns: {
          letzter_login: string
          user_id: string
        }[]
      }
    }
    Enums: {
      betrieb_rolle: "inhaber" | "mitarbeiter"
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
      betrieb_rolle: ["inhaber", "mitarbeiter"],
    },
  },
} as const
