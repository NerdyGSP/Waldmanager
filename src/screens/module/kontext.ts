import type { Enums } from '../../lib/database.types';

export type RevierKontext = {
  revierId: string;
  revierName: string;
  flaecheHa: number | null;
  bundesland: string;
  rolle: Enums<'revier_rolle'>;
  istInhaber: boolean;
  userId: string;
  neuLaden: () => Promise<void>;
};
