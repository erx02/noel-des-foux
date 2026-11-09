# Architecture — listes de cadeaux familiales

## Phase 1 — Architecture, modèle de menace et autorisations

Cette architecture est conçue pour la première version : une famille par compte,
des comptes individuels et une seule famille par utilisateur. Les autorisations
doivent rester effectives lorsqu'un utilisateur appelle directement l'API
Supabase sans passer par l'interface.

## Architecture retenue

- **Interface** : React et TypeScript strict, compilés en fichiers statiques par
  Vite. CSS simple, sans framework d'interface ni dépendance superflue.
- **Hébergement** : GitHub Pages et déploiement par GitHub Actions. Aucun serveur
  applicatif permanent.
- **Services de données** : Supabase Auth, PostgreSQL et Realtime. Le navigateur
  communique directement avec Supabase.
- **Autorité de sécurité** : PostgreSQL Row Level Security (RLS), contraintes,
  privilèges SQL et fonctions RPC limitées si nécessaire. Les contrôles React
  servent uniquement à l'expérience utilisateur.
- **Clés navigateur** : seulement `VITE_SUPABASE_URL` et
  `VITE_SUPABASE_ANON_KEY`. Ces valeurs sont publiques. Une clé `service_role`
  n'est jamais requise ni livrée au navigateur.
- **État client** : cache en mémoire uniquement. La base reste la source de
  vérité. Les sessions sont gérées par le client officiel Supabase Auth.

### Flux de données

1. Supabase Auth authentifie individuellement chaque membre.
2. À partir de la session, le navigateur demande son profil familial, puis les
   souhaits et les seules réservations visibles selon les politiques RLS.
3. Les commandes de création, modification, suppression et réservation sont
   soumises à PostgreSQL, qui dérive l'identité de `auth.uid()` et vérifie les
   invariants.
4. Realtime signale les changements autorisés ; son contenu n'est jamais une
   preuve d'autorisation. Le client relit ensuite les données via les requêtes
   RLS.
5. Un rechargement au premier plan, au retour réseau, manuel et périodique
   (environ 60 secondes si nécessaire) couvre les événements manqués.

Les URL de produit sont du texte validé (HTTP/HTTPS), sans chargement automatique
d'image externe. Une image, si elle est ultérieurement affichée, devra être
facultative, désactivable et chargée avec `referrerPolicy="no-referrer"`.

## Modèle de menace

### Actifs à protéger

- Les noms et appartenances des familles, profils et souhaits.
- L'identité de la personne ayant réservé un souhait.
- L'intégrité des souhaits, réservations, rôles et appartenance familiale.
- Les sessions d'authentification et la configuration de déploiement.

### Adversaires et capacités supposées

- Un visiteur non connecté connaissant l'URL de l'application.
- Un membre connecté qui modifie le JavaScript, appelle directement REST/RPC ou
  Realtime, falsifie les paramètres, ou connaît l'URL et la clé anon de Supabase.
- Un membre d'une autre famille qui tente d'énumérer ou de modifier des données.
- Deux membres qui tentent de réserver simultanément le même souhait.
- Un attaquant pouvant fournir des titres, descriptions et URL malveillants.
- Un tiers observant les requêtes réseau ou les références HTTP.

Les administrateurs du projet Supabase et les personnes ayant accès à sa clé
`service_role` sont des opérateurs de confiance hors du modèle utilisateur. La
clé `service_role` contourne RLS : elle doit rester dans les paramètres protégés
du tableau de bord et ne doit jamais être utilisée par l'application statique.

### Mesures et limites

- RLS restrictive sur chaque table exposée, privilèges accordés au minimum et
  contraintes SQL pour les invariants. Aucune permission n'est accordée au rôle
  `anon`.
- Chaque compte est lié à une seule famille. Les filtres d'appartenance sont
  réévalués en base et non pris depuis les paramètres du navigateur.
- Le propriétaire d'un souhait ne peut pas lire la ligne de réservation de ce
  souhait. Les requêtes directes et les abonnements Realtime doivent appliquer
  la même restriction ; aucune vue ou fonction ne doit réintroduire l'identité.
- La réservation est atomique et limitée à une ligne par souhait. La contrainte
  unique règle les courses ; l'interface affiche à l'échec un message neutre et
  relit l'état autorisé.
- Le rendu React échappe le texte. Pas de HTML brut, de secrets dans le bundle,
  de télémétrie, de CDN tiers ou de chargement d'image distant automatique.
- Une CSP en balise meta complète les protections statiques. GitHub Pages ne
  permet pas de garantir tous les en-têtes HTTP (notamment `frame-ancestors`) :
  cela reste une limite documentée, pas une garantie de sécurité absolue.
- Les politiques SQL protègent contre un client modifié, mais pas contre la
  compromission d'un compte, d'un opérateur Supabase, d'une clé privilégiée ou
  d'une vulnérabilité du fournisseur.

## Matrice des autorisations

`A` = administrateur de la famille, `M` = membre, `P` = propriétaire du souhait,
`R` = membre ayant réservé. Tous les accès supposent une session valide ; la
famille doit être celle liée à l'utilisateur par la base.

| Ressource / action | Anonyme | Membre de la famille | Admin de la famille | Autre famille |
|---|---:|---|---|---:|
| Lire le nom de famille | Non | Oui, sa famille | Oui, sa famille | Non |
| Lire les profils limités | Non | Oui, sa famille | Oui, sa famille | Non |
| Administrer les membres | Non | Non | Oui, sa famille, avec protection contre l'auto-promotion | Non |
| Modifier le nom de famille | Non | Non | Oui, sa famille | Non |
| Lire les souhaits | Non | Oui, sa famille | Oui, sa famille | Non |
| Créer un souhait | Non | Oui, uniquement avec son propre `owner_id` et sa famille dérivée | Idem | Non |
| Modifier / supprimer un souhait | Non | Oui, ses propres souhaits seulement | Idem, pas de privilège sur les souhaits d'autrui | Non |
| Lire la réservation d'un souhait | Non | Oui, sauf si l'utilisateur est propriétaire du souhait | Même règle que membre | Non |
| Réserver un souhait | Non | Oui, si le souhait appartient à un autre membre de sa famille et est libre | Idem | Non |
| Annuler une réservation | Non | Oui, ses propres réservations seulement | Idem | Non |
| Voir l'identité du réservataire | Non | Oui, sauf le propriétaire du souhait | Même règle que membre | Non |
| Appeler les fonctions métier | Non | Seulement opérations explicitement autorisées | Seulement opérations explicitement autorisées | Non |

### Protection des colonnes et des réservations

La ligne de réservation ne doit être sélectionnable que par un membre de la
famille du souhait qui n'en est pas le propriétaire. Cela inclut le réservataire
et autorise les autres membres à voir son identité, conformément au choix de
surprise demandé. Le propriétaire n'obtient ni la ligne ni `reserved_by` par
REST, Realtime, jointure, vue, erreur ou fonction RPC.

Les écritures de réservation ne laissent jamais choisir librement
`reserved_by` ou `family_id` : ces valeurs seront dérivées de l'utilisateur et du
souhait en base. La possibilité d'annulation est limitée au réservataire.
L'unicité sur `wish_id` empêche deux réservations actives.

Les fonctions `SECURITY DEFINER`, si le schéma en nécessite, seront minimisées,
avec `search_path` fixé, vérification explicite de `auth.uid()` et de
l'appartenance familiale, absence de SQL dynamique, résultats minimaux et droit
`EXECUTE` accordé uniquement à `authenticated`. Toute fonction qui pourrait
contourner la confidentialité des réservations sera exclue.

## Décisions appliquées en phase 2

- L'identité du réservataire est visible aux membres de la famille sauf au
  propriétaire du souhait ; le propriétaire ne voit même pas si le cadeau est
  réservé.
- La création et l'invitation des comptes se font manuellement depuis le
  tableau de bord Supabase. L'application n'inclura pas de clé privilégiée.
- L'administrateur familial peut gérer les noms et appartenances des membres,
  mais ne peut pas modifier les rôles depuis le navigateur. Les promotions sont
  réservées à un opérateur Supabase.
