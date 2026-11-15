// Point d'entrée du module de cartes.
//
// Chaque carte s'enregistre auprès du navigateur et de Home Assistant au
// chargement du module. L'éditeur générique est défini une seule fois, par
// le premier `defineCard` qui passe.
import { defineCard } from './core/registry';

import { SPEC as PROCHAIN_COURS } from './cards/prochain-cours';
import { SPEC as EMPLOI_DU_TEMPS } from './cards/emploi-du-temps';
import { SPEC as DEVOIRS } from './cards/devoirs';
import { SPEC as NOTES } from './cards/notes';
import { SPEC as VIE_SCOLAIRE } from './cards/vie-scolaire';
import { SPEC as MENU } from './cards/menu';
import { SPEC as ELEVE } from './cards/eleve';
import { SPEC as LIMITEUR } from './cards/limiteur';
import { SPEC as MODE_COLLECTE } from './cards/mode-collecte';
import { SPEC as EVALUATIONS } from './cards/evaluations';
import { SPEC as JOURNEE } from './cards/journee';
import { SPEC as AGENDA } from './cards/agenda';

defineCard(PROCHAIN_COURS);
defineCard(EMPLOI_DU_TEMPS);
defineCard(DEVOIRS);
defineCard(NOTES);
defineCard(VIE_SCOLAIRE);
defineCard(MENU);
defineCard(ELEVE);
defineCard(LIMITEUR);
defineCard(MODE_COLLECTE);
defineCard(EVALUATIONS);
defineCard(JOURNEE);
defineCard(AGENDA);

export { defineCard };
export type { CardSpec, RenderCtx, CarnetCardConfig, EntityKey } from './core/types';
