import type { CardScope, EntityKey, CarnetCardConfig } from './types';
import type { HomeAssistant } from './ha-types';

export const PLATFORM = 'carnet_scolaire';

/** Un appareil d'enfant est rattaché à un appareil de compte par via_device_id. */
export function isChildDevice(hass: HomeAssistant, deviceId: string): boolean {
  return Boolean(hass.devices[deviceId]?.via_device_id);
}

/**
 * L'appareil réellement porteur des entités de la carte.
 * Une carte de compte suit via_device_id ; l'utilisateur ne configure jamais
 * que le device_id de l'enfant.
 */
export function resolveDevice(
  hass: HomeAssistant,
  deviceId: string | undefined,
  scope: CardScope
): string | undefined {
  if (!deviceId) return undefined;
  const device = hass.devices[deviceId];
  if (!device) return undefined;
  if (scope === 'account') return device.via_device_id ?? device.id;
  return device.id;
}

/**
 * Rend, pour chaque clé demandée, l'identifiant de la PREMIÈRE entité qui
 * correspond. Aucune détection de conflit : si deux entités du même appareil
 * partagent domaine et `translation_key` — ce que fait l'intégration pour les
 * périodes closes — celle qui est rendue dépend de l'ordre du registre. C'est
 * la raison pour laquelle aucune carte n'expose d'option de période (spec §4.1).
 *
 * La surcharge (`overrides`) subit la même vérification de domaine que le
 * chemin normal : une clé `'sensor:x'` ne peut se résoudre qu'à un
 * `entity_id` commençant par `sensor.`. Un identifiant d'un autre domaine
 * (faute de frappe, copier-coller) est silencieusement ignoré plutôt
 * qu'accepté sans un mot — au même titre qu'une entité introuvable côté
 * registre.
 */
export function resolveEntities(
  hass: HomeAssistant,
  deviceId: string | undefined,
  scope: CardScope,
  keys: readonly EntityKey[],
  overrides?: Record<string, string>
): Map<EntityKey, string> {
  const out = new Map<EntityKey, string>();
  const target = resolveDevice(hass, deviceId, scope);

  // Un index par appareil évite de reparcourir tout le registre par clé.
  const onDevice = target
    ? Object.values(hass.entities).filter((e) => e.device_id === target && e.platform === PLATFORM)
    : [];

  for (const key of keys) {
    const sep = key.indexOf(':');
    if (sep < 0) continue;
    const domain = key.slice(0, sep);
    const translationKey = key.slice(sep + 1);

    const override = overrides?.[key];
    if (override) {
      if (override.startsWith(`${domain}.`)) out.set(key, override);
      continue;
    }

    const match = onDevice.find(
      (e) => e.translation_key === translationKey && e.entity_id.startsWith(`${domain}.`)
    );
    if (match) out.set(key, match.entity_id);
  }

  return out;
}

/**
 * Cache de résolution, un par instance : la carte et son éditeur en créent
 * chacun un (voir base-card.ts et editor.ts), c'est le MÉCANISME qui est
 * commun, pas le cache. Il mémoïse `resolveEntities` sur l'identité de
 * `hass.entities` et `hass.devices`, plutôt que de rebalayer tout le
 * registre (`Object.values(hass.entities)`) à chaque mise à jour d'état —
 * Home Assistant remplace tout l'objet `hass` à chaque évènement, mais ces
 * deux sous-objets ne changent que si le registre lui-même a changé.
 */
export interface ResolveCache {
  resolve(
    hass: HomeAssistant,
    deviceId: string | undefined,
    scope: CardScope,
    keys: EntityKey[],
    overrides: CarnetCardConfig['entities']
  ): Map<EntityKey, string>;
}

export function createResolveCache(): ResolveCache {
  let cache:
    | {
        entities: HomeAssistant['entities'];
        devices: HomeAssistant['devices'];
        deviceId: string | undefined;
        overrides: CarnetCardConfig['entities'];
        keys: string;
        result: Map<EntityKey, string>;
      }
    | undefined;

  return {
    resolve(hass, deviceId, scope, keys, overrides) {
      const keysJoined = keys.join(',');
      if (
        cache &&
        cache.entities === hass.entities &&
        cache.devices === hass.devices &&
        cache.deviceId === deviceId &&
        cache.overrides === overrides &&
        cache.keys === keysJoined
      ) {
        return cache.result;
      }
      const result = resolveEntities(hass, deviceId, scope, keys, overrides);
      cache = {
        entities: hass.entities,
        devices: hass.devices,
        deviceId,
        overrides,
        keys: keysJoined,
        result,
      };
      return result;
    },
  };
}
