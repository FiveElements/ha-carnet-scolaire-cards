# Politique de sécurité

## Versions suivies

Seule la dernière version publiée reçoit des correctifs. Les cartes sont un
seul fichier JavaScript installé par HACS : mettre à jour, c'est la correction.

## Signaler une vulnérabilité

**N'ouvrez pas de ticket public.** Utilisez le signalement privé de GitHub :
onglet **Security** du dépôt, puis **Report a vulnerability**
(<https://github.com/FiveElements/ha-carnet-scolaire-cards/security/advisories/new>).
Le rapport n'est visible que des mainteneurs.

Indiquez la version concernée, la carte, et de quoi reproduire — avec des
**valeurs synthétiques uniquement** : ni nom d'élève, ni nom d'établissement,
ni identifiant de compte, ni URL iCal. Une URL iCal se traite comme un mot de
passe ; si vous en avez collé une quelque part, régénérez-la depuis PRONOTE.

Un accusé de réception est donné sous une semaine. Le projet est maintenu
bénévolement : aucun délai de correction n'est garanti, mais une faille qui
expose des données d'élève passe avant tout le reste.

## Ce qui relève de ce dépôt

Les cartes Lovelace : ce qu'elles affichent, ce qu'elles injectent dans la
page, les services qu'elles appellent. Les quatre appels autorisés et ce que
le projet s'interdit sont décrits dans [`docs/limites.md`](docs/limites.md).

La collecte, l'authentification auprès de PRONOTE et le stockage des données
relèvent de l'intégration `carnet_scolaire`, et se signalent sur son dépôt.
