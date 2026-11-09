# Phase 2 — Schéma SQL, RLS et tests de sécurité

Migration : `supabase/migrations/20261109000000_family_gift_lists.sql`.
Tests : `supabase/tests/database_security.test.sql`.

## Tables, contraintes et index

- `families` : UUID généré par `gen_random_uuid()`, nom non vide limité à
  100 caractères, créateur Auth et date de création.
- `family_members` : une seule famille par compte (`user_id` primaire), rôle
  limité à `admin`/`member`, profil limité au nom d'affichage et à un identifiant
  d'avatar illustré de la liste autorisée dans la migration
  `20261109120000_family_member_avatars.sql`.
- `wishes` : propriétaire et famille liés à une appartenance existante ; titre
  1–150 caractères après trim ; description maximale de 2 000 caractères ;
  URL facultatives HTTP/HTTPS uniquement ; prix de 1 à 10 000 000 centimes
  (100 000 € maximum) ; la priorité historique reste contrainte à `low`,
  `normal` ou `high`, mais n'est plus utilisée par l'interface.
  L'identifiant et l'horodatage sont générés par la base.
- `reservations` : une réservation au maximum par souhait grâce à la contrainte
  unique sur `wish_id`. Une clé étrangère composite lie le réservataire et le
  souhait à la même famille.
- Les index servent la lecture des membres et souhaits par famille et celle des
  réservations par famille/réservataire. La suppression d'un membre supprime
  intentionnellement ses souhaits et réservations ; la suppression d'un souhait
  libère intentionnellement sa réservation.
- `updated_at` est maintenu par un trigger de base de données. Le client ne peut
  pas fournir les UUID de souhait, le propriétaire ou la famille.

## Fonctions privilégiées

Les fonctions `private.current_family_id`,
`private.is_family_member` et `private.is_family_admin` sont les seules
fonctions `SECURITY DEFINER` exposées aux requêtes authentifiées. Elles fixent
`search_path`, utilisent `auth.uid()`, consultent uniquement l'appartenance de
l'appelant et retournent un UUID ou un booléen. Elles n'acceptent pas de SQL
dynamique et leur exécution est révoquée à `PUBLIC` et `anon`.

`private.set_reservation_identity` est un trigger `SECURITY DEFINER`, non
exécutable directement par les rôles applicatifs. Il rejette avec la même erreur
générique toute réservation anonyme, inexistante, hors famille ou portant sur
son propre souhait ; il dérive `family_id` et `reserved_by` du souhait et de
`auth.uid()`. Les colonnes correspondantes ne sont pas insérables par le client.
La fonction de trigger `updated_at` n'est pas privilégiée.

Aucune fonction métier RPC n'est nécessaire : les opérations passent par les
tables soumises à RLS et aux contraintes. L'initialisation des familles et la
promotion d'un administrateur sont des opérations techniques manuelles.

## Explication des politiques

Toutes les tables activent et forcent RLS. Les privilèges SQL sont révoqués
avant les octrois nécessaires ; aucune politique ne donne un accès général.
Chaque politique est ciblée au rôle `authenticated`, et chaque test
d'appartenance recalcule la famille depuis `family_members` et `auth.uid()`.
Un appel REST direct utilise ces mêmes privilèges et politiques.

| Politique | Qui / lignes autorisées | Isolation, champs et appel direct |
|---|---|---|
| `families_select_own_family` | Tout membre authentifié lit l'unique ligne de sa famille. | Le prédicat vérifie l'appartenance en base ; les autres familles sont filtrées même si leur UUID est connu. REST suit la même règle. |
| `families_update_admin` | Admin de la famille modifie son nom seulement. | Le privilège SQL ne porte que sur `name`, et `USING`/`WITH CHECK` exigent l'admin de la même famille. Pas de création/suppression de famille depuis le navigateur. |
| `family_members_select_own_family` | Tout membre lit les profils limités de sa famille. | Le schéma ne contient ni adresse e-mail ni donnée Auth ; la RLS bloque les autres familles. |
| `family_members_insert_admin` | Admin peut ajouter un compte Auth à sa famille comme membre. | `role` n'est pas insérable et la politique n'accepte que `member`. L'appartenance d'un compte à une seule famille est imposée par la clé primaire `user_id`. |
| `family_members_update_names` | Un membre modifie son nom et son avatar ; un admin peut modifier ceux de sa famille. | Les privilèges de colonne excluent `role`, `family_id` et `user_id`. Une contrainte vérifie l'identifiant d'avatar. Un appel direct ne peut ni changer de famille ni promouvoir un compte. |
| `family_members_delete_admin` | Admin peut retirer un autre membre de sa famille, pas lui-même. | Vérification admin et famille en base. Les souhaits/réservations du membre sont supprimés par les cascades intentionnelles. |
| `wishes_select_own_family` | Tout membre consulte les souhaits de sa famille. | L'appartenance de la famille est réévaluée par PostgreSQL ; aucun accès croisé REST. |
| `wishes_insert_self` | Un membre crée un souhait pour lui-même. | `family_id` provient de la fonction de défaut et `owner_id` de `auth.uid()` ; les colonnes d'identité ne sont pas insérables. `WITH CHECK` vérifie les deux ainsi que l'appartenance. |
| `wishes_update_owner` | Seul le propriétaire modifie ses champs de souhait. | `USING` vérifie la ligne avant modification ; `WITH CHECK` répète l'identité et l'appartenance après modification. Les colonnes d'identité et `updated_at` ne sont pas modifiables par le client. |
| `wishes_delete_owner` | Seul le propriétaire supprime son souhait. | Vérification du propriétaire et de la famille en base, y compris via API directe. |
| `reservations_select_non_owner_family` | Membres de la famille lisent la réservation des souhaits appartenant à un autre membre. | La ligne entière, y compris `reserved_by`, est masquée au propriétaire par RLS. Les réservations sont exclues de Realtime ; aucun endpoint/vu RPC ne contourne ce filtrage. |
| `reservations_insert_other_member_wish` | Membre réserve le souhait libre d'un autre membre de sa famille. | `reserved_by` et `family_id` sont dérivés en trigger ; `WITH CHECK` revérifie l'appartenance et le propriétaire du souhait. L'unicité sur `wish_id` arbitre les courses. |
| `reservations_delete_own` | Seul le réservataire annule sa réservation sur le souhait d'un autre membre. | `USING` vérifie le réservataire, la famille et le propriétaire du souhait. Pas de privilège UPDATE. |

Le rôle `anon` ne reçoit aucun privilège sur les tables et aucune exécution des
fonctions privées. La clé anon est une clé publique ; elle n'accorde pas de
droit sans session authentifiée. `service_role` contourne RLS par conception et
ne doit être utilisé que par l'opérateur, jamais dans le frontend.

## Realtime et confidentialité

La publication Supabase contient `families`, `family_members` et `wishes`, mais
pas `reservations`. La présence, l'absence ou le moment d'un événement de
réservation pourrait révéler un état interdit même sans inclure `reserved_by`.
Le frontend devra donc revalider les réservations via des requêtes RLS lors du
rafraîchissement périodique, au retour réseau/onglet et sur demande. Realtime
reste un signal de rafraîchissement pour les autres données, jamais une
autorisation.

## Exécution des tests

Dans un projet Supabase local initialisé avec `supabase init`, démarrer la base
et lancer :

```sh
supabase start
supabase test db
```

Le script crée des utilisateurs et données synthétiques, émule les rôles SQL
`anon` et `authenticated` ainsi que le claim JWT `request.jwt.claim.sub`, puis
annule toute la transaction. Les accès effectués sous ces rôles correspondent
aux privilèges appliqués aux appels REST directs. Les tests couvrent les
privilèges anonymes, l'isolation inter-familles, la propriété des souhaits,
l'immutabilité des identités, la confidentialité des réservations et l'unicité
qui arbitre deux réservations concurrentes.

Les 30 assertions pgTAP couvrent aussi le choix d'avatar : valeur par défaut,
modification du profil, isolation entre familles et contrainte sur les valeurs
admises. Le test d'unicité démontre la garantie atomique en base mais ne
remplace pas un test de charge multi-session du flux complet. Les tests de
sécurité en local ne remplacent pas une vérification des réglages Auth et API du
projet de production.

## Risques restant ouverts

- L'envoi d'invitations et le provisionnement initial nécessitent une action
  manuelle depuis le tableau de bord Supabase.
- L'administrateur familial peut ajouter un compte Auth connu comme membre, mais
  ne peut ni changer les rôles ni créer un administrateur depuis l'application.
  La gestion des rôles reste opérateur-only.
- Le schéma `private` ne doit pas être ajouté aux schémas exposés par l'API
  PostgREST ; les fonctions qu'il contient sont des aides de politiques, pas
  une API applicative.
- Les réservations ne sont pas instantanément reflétées par Realtime ; elles
  doivent être rechargées selon le mécanisme de secours défini.
- Cette migration est destinée à un nouveau projet Supabase. Elle doit être
  revue avant application à un projet contenant déjà des tables, politiques ou
  publication Realtime.
