import type { Enums } from '../../lib/database.types';

export type BetriebKontext = {
  betriebId: string;
  betriebName: string;
  flaecheHa: number | null;
  bundesland: string;
  rolle: Enums<'betrieb_rolle'>;
  istInhaber: boolean;
  userId: string;
  neuLaden: () => Promise<void>;
};
