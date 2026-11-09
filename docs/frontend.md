# Phase 3 — Frontend, authentification et synchronisation

## Parcours livrés

- Connexion individuelle par e-mail/mot de passe via Supabase Auth ; aucun
  formulaire d'inscription publique. L'administrateur crée/invite les comptes
  depuis le tableau de bord Supabase.
- Tableau de famille, profils limités, nombre de souhaits par personne, ma liste,
  listes partagées, filtres et tris, ajout/modification/suppression, réservation
  et annulation de sa propre réservation.
- Vue d'administration pour renommer la famille, ajouter un compte Auth déjà
  créé comme membre et retirer un membre. PostgreSQL reste l'autorité : le rôle
  de membre ne peut pas être modifié depuis l'interface.
- Profil permettant de modifier le nom affiché et de se déconnecter. Le bouton
  de déconnexion est également accessible depuis chaque page authentifiée.
- Formulaires accessibles avec validations client et contraintes SQL
  complémentaires. Aucun HTML utilisateur n'est rendu comme HTML ; l'image
  distante est un lien et n'est jamais chargée automatiquement.

## Sessions et confidentialité des réservations

Le client Supabase officiel gère les sessions (persistance et rafraîchissement
automatique) ; l'application ne stocke aucune session ou donnée métier dans son
propre `localStorage`. À l'expiration de la session, l'état Auth retire les
pages privées et affiche la connexion.

Les requêtes de réservation sont soumises à RLS. Le navigateur ne fournit que
l'identifiant du souhait à réserver ; PostgreSQL dérive l'identité et la famille.
Le propriétaire reçoit un résultat vide pour ses réservations et sa liste ne
rend jamais d'indicateur de réservation. Les autres membres voient le statut et
le prénom du réservataire conformément à la politique choisie.

Les événements Realtime sont des signaux de rechargement ; le client ne lit pas
leur payload pour autoriser ou modifier une opération. Les changements de
famille, de profils et de souhaits déclenchent une relecture protégée. La table
`reservations` est volontairement absente de la publication Realtime, car même
un événement sans colonne sensible révélerait le statut au propriétaire par son
seul timing. Les réservations sont rechargées après les actions, au retour de
l'onglet ou du réseau, à la demande et au plus tard au prochain contrôle
périodique de 60 secondes.

Les réponses `23505` à une réservation concurrente sont traduites en message
neutre (« Ce cadeau vient d’être réservé »), puis l'état autorisé est relu.

## Configuration et vérifications

Copier `.env.example` vers `.env.local` et fournir l'URL Supabase ainsi que sa
clé publique `anon`. Aucune clé `service_role` n'est consommée par le code.
L'URL doit être hébergée sur un domaine Supabase standard (`*.supabase.co`) pour
correspondre à la CSP actuellement définie dans `index.html`.

La vérification `npm run build` (TypeScript strict et build Vite) passe. Les
tests pgTAP passent également en local avec `npx supabase test db` : 25
assertions. Ces tests s'exécutent sur une stack locale et ne remplacent pas une
revue de configuration du projet Supabase de production.

## Risques et limites avant la phase 4

- Aucun test navigateur automatisé n'est encore fourni.
- GitHub Pages ne permet pas de définir de façon fiable les en-têtes HTTP
  `frame-ancestors`, `X-Content-Type-Options` et `Referrer-Policy`. La balise meta
  CSP ne remplace pas ces en-têtes et ne peut pas fournir une protection
  anti-iframe complète.
- La CSP autorise les API Realtime et Auth des projets Supabase standards ;
  l'usage d'un domaine Supabase personnalisé demandera de l'adapter.
- La suppression d'un membre supprime ses souhaits et réservations par cascade ;
  l'interface demande confirmation et explique cet effet.
- Le flux d'invitation reste manuel, tout comme l'attribution initiale des rôles
  administrateur.
